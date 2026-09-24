import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { TavernScene, TABLE_Y, MIRROR, type Seat, type NpcCard, type Shot } from "./Tavern";

export type { Seat, NpcCard, Shot };

/**
 * "Oyna" modunun 3D dünyası — tek bir WebGL sahnesi, tüm adımlar boyunca yaşar.
 *
 * - Seçim adımlarında: nebula gökyüzü + yıldızlar + süzülen, üzerinde rakamları
 *   parlayan metal bir D20, etrafında yörünge halkaları ve altında dönen bir
 *   büyü çemberi. Kamera her adımda başka bir kadraja kayar.
 * - Oyun adımında: sahne çizimi (ya da döngü videosu) kavisli bir perdeye
 *   yansıtılır; önünde derinlikli sis katmanları ve ambiyansa göre kıvılcım /
 *   dijital yağmur uçuşur. Fare/dokunma ile gerçek paralaks oluşur.
 * - Mood (calm/tense/danger/wonder) renk, hız ve enerjiyi sürükler; kritik
 *   zarlarda parçacık patlaması + kamera sarsıntısı.
 *
 * React'ten bağımsız, emir kipli bir sınıf. WebGL yoksa constructor hata
 * fırlatır — sarmalayıcı bunu yakalayıp DOM yedeğine düşer.
 */

export type WorldStep = "series" | "character" | "episode" | "play";
export type WorldAmb = "arcane" | "forest" | "cyber";
export type WorldMood = "calm" | "tense" | "danger" | "wonder";
export type WorldArt = { src: string; video?: { webm?: string; mp4: string } } | null;

const PAL: Record<WorldAmb, [string, string, string]> = {
  arcane: ["#8a5fd0", "#d8b45a", "#07060d"],
  forest: ["#7b5cc4", "#e6a24a", "#070709"],
  cyber: ["#0fb8a6", "#ff3d8b", "#02050a"],
};

const MOOD: Record<WorldMood, { speed: number; energy: number; tint?: string }> = {
  calm: { speed: 0.6, energy: 0.75 },
  tense: { speed: 1, energy: 1 },
  danger: { speed: 1.7, energy: 1.25, tint: "#ff2a44" },
  wonder: { speed: 0.85, energy: 1.2, tint: "#ffe3a0" },
};

type V3 = [number, number, number];
type Rig = { d20: V3; s: number; circle: number; art: number; cam: V3; look: V3; fog: number };
const RIG: Record<WorldStep, Rig> = {
  series: { d20: [3.0, 0.9, 0], s: 1, circle: 1, art: 0, cam: [0, 0, 8], look: [0, 0, 0], fog: 0.5 },
  character: { d20: [4.4, 1.7, -3.5], s: 0.7, circle: 0.7, art: 0, cam: [0, -0.3, 8], look: [0, 0, 0], fog: 0.55 },
  episode: { d20: [3.5, -0.3, -1.2], s: 1.05, circle: 1, art: 0, cam: [0.5, 0.25, 8], look: [0, 0, 0], fog: 0.5 },
  // oyun: oyuncunun koltuğundan masaya bakış — arkada sahne vizyonu
  play: { d20: [0, 0.6, -22], s: 0.001, circle: 0, art: 1, cam: [0.95, 3.95, 8.1], look: [0.1, 1.95, -2.4], fog: 0 },
};

/* ── ortak GLSL parçaları ── */
const NOISE = /* glsl */ `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + vec2(17.1, 9.2); a *= .5; }
  return v;
}
`;
const OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

export class PlayWorld {
  private el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  private clock = { last: performance.now(), t: 0 };
  private raf = 0;
  private ro: ResizeObserver;
  private reduced: boolean;
  private small: boolean;
  private disposables: { dispose: () => void }[] = [];

  /* durum */
  private step: WorldStep = "series";
  private amb: WorldAmb = "arcane";
  private mood: WorldMood = "tense";
  private accent: string | null = null;
  private hover = 0;
  private hoverCur = 0;
  private pointer = new THREE.Vector2();
  private pointerCur = new THREE.Vector2();
  private spinKick = 0;
  private shake = 0;
  private speedCur = 1;
  private energyCur = 1;
  private colA = new THREE.Color(PAL.arcane[0]);
  private colB = new THREE.Color(PAL.arcane[1]);
  private colBg = new THREE.Color(PAL.arcane[2]);
  private tgtA = this.colA.clone();
  private tgtB = this.colB.clone();
  private tgtBg = this.colBg.clone();
  private cyberCur = 0;
  private rigCur = { ...RIG.series, d20: [...RIG.series.d20] as V3, cam: [...RIG.series.cam] as V3, look: [...RIG.series.look] as V3 };
  private playBlend = 0;
  private dieW = 0;
  private speakW = 0;
  private focusPos = new THREE.Vector3(0, TABLE_Y, 0);
  private table!: TavernScene;
  private mirrorW = 0;
  private lensShift = 0;
  private artHasCur = 0;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private roomFog = new THREE.FogExp2(0x0a0710, 0);
  private camLook = new THREE.Vector3();

  /* nesneler */
  private nebula!: THREE.ShaderMaterial;
  private stars!: THREE.ShaderMaterial;
  private d20 = new THREE.Group();
  private die!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private dieEdges!: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private glow!: THREE.Sprite;
  private rings: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private gems: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private circle!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private motes!: THREE.ShaderMaterial;
  private burstMat!: THREE.ShaderMaterial;
  private burstT = 99;
  private fogs: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
  private grid!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private art!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private lights: THREE.PointLight[] = [];

  /* sahne çizimi (crossfade) */
  private artKey = "";
  private artToken = 0;
  private artMix = 0;
  private artMixing = false;
  private artHas = 0;
  private video: HTMLVideoElement | null = null;
  private artTextures = new Set<THREE.Texture>();

  constructor(el: HTMLElement) {
    this.el = el;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.small = Math.min(innerWidth, innerHeight) < 700;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.small, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.small ? 1.5 : 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x07060d, 1);
    this.renderer.shadowMap.enabled = !this.small;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    this.disposables.push(envTex);

    this.buildNebula();
    this.buildStars();
    this.buildGrid();
    this.buildArt();
    this.buildFogs();
    this.buildDie();
    this.buildCircle();
    this.buildMotes();
    this.buildBurst();
    this.buildLights();
    this.table = new TavernScene({
      shadows: !this.small,
      dieGeo: this.die.geometry,
      dieMat: this.die.material,
      glowTex: (this.glow.material as THREE.SpriteMaterial).map!,
    });
    this.scene.add(this.table.group);
    this.scene.fog = this.roomFog;

    /* son işlem: yumuşak parlama (alevler, rakamlar, ayna) */
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    window.addEventListener("deviceorientation", this.onTilt, { passive: true });
    this.raf = requestAnimationFrame(this.frame);
    if (import.meta.env.DEV) (window as unknown as { __world?: PlayWorld }).__world = this;
  }

  /* ════════ genel API ════════ */

  setStep(step: WorldStep) {
    if (step === this.step) return;
    this.step = step;
    this.spinKick = 5;
    this.retarget();
  }
  setAmbiance(amb: WorldAmb) {
    this.amb = amb;
    this.retarget();
  }
  setMood(mood: WorldMood) {
    this.mood = mood;
    this.retarget();
  }
  setAccent(accent: string | null) {
    this.accent = accent;
    this.hover = accent ? 1 : 0;
    this.retarget();
  }
  /** seçim anında D20'ye hızlı bir dönüş ver */
  kick(power = 6) {
    this.spinKick = Math.max(this.spinKick, power);
  }
  /** kritik zar anı — parçacık patlaması + sarsıntı */
  burst(kind: "crit" | "fail") {
    this.burstT = 0;
    const c = new THREE.Color(kind === "crit" ? "#ffd77a" : "#ff2a44");
    (this.burstMat.uniforms.uColor.value as THREE.Color).copy(c);
    if (!this.reduced) this.shake = kind === "crit" ? 0.5 : 0.75;
    this.spinKick = 10;
  }

  /** masadaki koltuklar (anlatıcı, oyuncular, sen) */
  setTable(seats: Seat[]) {
    this.table.setSeats(seats);
  }
  /** konuşan koltuk; anlatıcı bir NPC'yi seslendiriyorsa `npc` hologramı */
  setSpeaker(id: string | null, npc: NpcCard = null) {
    this.table.setSpeaker(id, npc);
  }
  /** D20'yi `from` koltuğundan masaya at; istenen değer yukarı bakarak durur */
  rollDie(value: number, from: string, ok?: boolean): Promise<void> {
    return this.table.roll(value, from, ok).then(() => undefined);
  }
  /** kadraj: masa ya da (yeni sahne açılırken) büyü aynası */
  setShot(shot: Shot) {
    this.table.setShot(shot);
  }

  setArt(art: WorldArt) {
    const key = art ? art.src + (art.video?.mp4 ?? "") : "";
    if (key === this.artKey) return;
    this.artKey = key;
    const token = ++this.artToken;
    this.stopVideo();
    if (!art) {
      this.artHas = 0;
      return;
    }
    new THREE.TextureLoader().load(art.src, (tex) => {
      if (token !== this.artToken) return tex.dispose();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      const img = tex.image as HTMLImageElement;
      this.pushArt(tex, img.width / img.height, true);
      if (art.video && !this.reduced) this.loadVideo(art.video, token);
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
    window.removeEventListener("deviceorientation", this.onTilt);
    this.stopVideo();
    this.table.dispose();
    this.artTextures.forEach((t) => t.dispose());
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ════════ iç işler ════════ */

  private retarget() {
    const [a, b, bg] = PAL[this.amb];
    this.tgtA.set(a);
    this.tgtB.set(this.accent && this.step !== "play" ? this.accent : b);
    this.tgtBg.set(bg);
    const tint = MOOD[this.mood].tint;
    if (this.step === "play" && tint) this.tgtB.lerp(new THREE.Color(tint), 0.5);
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  };
  private onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    this.pointer.set(THREE.MathUtils.clamp(e.gamma / 30, -1, 1), THREE.MathUtils.clamp((45 - e.beta) / 30, -1, 1));
  };

  private resize() {
    const w = this.el.clientWidth || innerWidth;
    const h = this.el.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.lensShift = -1; // görünüm ofsetini yeni boyuta göre yeniden kur
    this.camera.updateProjectionMatrix();
    this.nebula.uniforms.uAspect.value = w / h;
    this.fitArt();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) {
      this.clock.last = now;
      return;
    }
    // geliştirme: yavaş (yazılımsal) çizimde ekran görüntüsü için büyük zaman adımı
    const dtMax = (import.meta.env.DEV && (window as unknown as { __dtMax?: number }).__dtMax) || 0.05;
    const dt = Math.min(dtMax, (now - this.clock.last) / 1000);
    this.clock.last = now;
    const m = MOOD[this.mood];
    const inPlay = this.step === "play";
    this.speedCur = damp(this.speedCur, inPlay ? m.speed : 1, 1.5, dt);
    this.energyCur = damp(this.energyCur, (inPlay ? m.energy : 1) + this.hoverCur * 0.25, 1.5, dt);
    this.clock.t += dt * (this.reduced ? 0.3 : 1) * this.speedCur;
    const t = this.clock.t;

    /* renkler */
    const k = 1 - Math.exp(-2.2 * dt);
    this.colA.lerp(this.tgtA, k);
    this.colB.lerp(this.tgtB, k);
    this.colBg.lerp(this.tgtBg, k);
    this.cyberCur = damp(this.cyberCur, this.amb === "cyber" ? 1 : 0, 2, dt);
    this.hoverCur = damp(this.hoverCur, this.hover, 4, dt);

    /* kadraj (adım rig'i) */
    const aspect = this.camera.aspect;
    const narrow = aspect < 0.9;
    const kx = THREE.MathUtils.clamp(aspect / 1.6, 0.34, 1);
    const tgt = RIG[this.step];
    const rc = this.rigCur;
    const rk = this.reduced ? 6 : 2.2;
    const tx = tgt.d20[0] * kx;
    const ty = tgt.d20[1] + (narrow && this.step !== "play" ? 1.6 : 0);
    rc.d20[0] = damp(rc.d20[0], tx, rk, dt);
    rc.d20[1] = damp(rc.d20[1], ty, rk, dt);
    rc.d20[2] = damp(rc.d20[2], tgt.d20[2], rk, dt);
    rc.s = damp(rc.s, tgt.s * (narrow ? 0.62 : 1), rk, dt);
    rc.circle = damp(rc.circle, tgt.circle, rk, dt);
    rc.art = damp(rc.art, tgt.art, 1.6, dt);
    this.artHasCur = damp(this.artHasCur, this.artHas, 2, dt);
    rc.fog = damp(rc.fog, tgt.fog, 1.5, dt);
    for (let i = 0; i < 3; i++) {
      rc.cam[i] = damp(rc.cam[i], tgt.cam[i], rk * 0.8, dt);
      rc.look[i] = damp(rc.look[i], tgt.look[i], rk * 0.8, dt);
    }
    this.playBlend = damp(this.playBlend, inPlay ? 1 : 0, rk * 0.8, dt);
    const pb = this.playBlend;

    /* masa odağı: yuvarlanan zar > konuşan */
    const focus = inPlay ? this.table.focus() : null;
    this.dieW = damp(this.dieW, focus?.kind === "die" ? 1 : 0, 2.2, dt);
    this.speakW = damp(this.speakW, focus?.kind === "speaker" ? 1 : 0, 1.8, dt);
    this.mirrorW = damp(this.mirrorW, focus?.kind === "mirror" ? 1 : 0, 1.2, dt);
    if (focus) this.focusPos.lerp(focus.pos, 1 - Math.exp(-4 * dt));

    /* kamera — kadraj + odak + paralaks + sarsıntı */
    const pk = (this.reduced ? 0.2 : 1) * (1 - pb * 0.55);
    this.pointerCur.x = damp(this.pointerCur.x, this.pointer.x, 3, dt);
    this.pointerCur.y = damp(this.pointerCur.y, this.pointer.y, 3, dt);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const sh = this.shake * this.shake;
    let cx = rc.cam[0];
    let cy = rc.cam[1];
    let cz = rc.cam[2];
    // dikey ekranda: masanın tamamı dar genişliğe sığsın diye uzaktan, ortadan bak
    const nb = narrow ? pb : 0;
    cx += (0 - cx) * nb;
    cy += (4.3 - cy) * nb;
    cz += (9.4 - cz) * nb;
    const fp = this.focusPos;
    // zar kamerası: sağ-önden çapraz, yukarıdan — ayağa kalkan atan kişi kadrajı kapatmasın
    cx += (fp.x + (narrow ? 1.6 : 2.4) - cx) * this.dieW * 0.85;
    cy += (TABLE_Y + (narrow ? 3.4 : 2.7) - cy) * this.dieW * 0.85;
    cz += (fp.z + (narrow ? 3.4 : 2.2) - cz) * this.dieW * 0.85;
    // sahne açılışı: aynaya doğru yavaş bir yaklaşma
    cx += (0 - cx) * this.mirrorW * 0.7;
    cy += 0.35 * this.mirrorW;
    cz -= 1.6 * this.mirrorW;
    this.camera.position.set(
      cx + this.pointerCur.x * 0.55 * pk + (Math.random() - 0.5) * sh,
      cy + this.pointerCur.y * 0.35 * pk + (Math.random() - 0.5) * sh,
      cz + Math.sin(t * 0.15) * 0.12 * (1 - pb * 0.6)
    );
    const lw = this.dieW * 0.9 + (this.speakW * 0.28 + this.mirrorW * 0.85) * (1 - this.dieW);
    this.camLook.set(
      rc.look[0] + (fp.x - rc.look[0]) * lw + this.pointerCur.x * 0.15 * pk,
      rc.look[1] + 0.35 * nb + (fp.y - rc.look[1]) * lw + this.pointerCur.y * 0.1 * pk,
      rc.look[2] + (fp.z - rc.look[2]) * lw
    );
    this.camera.lookAt(this.camLook);
    // geliştirme: dışarıdan kamera (ölçüm/ekran görüntüsü için)
    const dbg = import.meta.env.DEV ? (window as unknown as { __cam?: number[] }).__cam : undefined;
    if (dbg) {
      this.camera.position.set(dbg[0], dbg[1], dbg[2]);
      this.camera.lookAt(dbg[3], dbg[4], dbg[5]);
    }
    const fov = 45 + (narrow ? 18 : 5) * pb;
    // lens kaydırma: sahne, alttaki diyalog kutusunun üstündeki alana otursun
    const shift = (narrow ? 0.09 : 0.1) * pb;
    if (Math.abs(this.camera.fov - fov) > 0.01 || Math.abs(this.lensShift - shift) > 0.0005) {
      this.camera.fov = fov;
      this.lensShift = shift;
      const w = this.el.clientWidth || innerWidth;
      const h = this.el.clientHeight || innerHeight;
      if (shift > 0.001) this.camera.setViewOffset(w, h, 0, shift * h, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
    }
    this.scene.environmentIntensity = 0.55 - 0.42 * pb;
    this.roomFog.density = 0.05 * pb;
    this.roomFog.color.set(this.amb === "cyber" ? 0x04070c : 0x0a0710);

    /* D20 */
    this.spinKick = Math.max(0, this.spinKick - dt * 4);
    const spin = (this.reduced ? 0.3 : 1) * (1 + this.hoverCur * 1.4 + this.spinKick);
    this.die.rotation.x += dt * 0.23 * spin;
    this.die.rotation.y += dt * 0.37 * spin;
    this.dieEdges.rotation.copy(this.die.rotation);
    this.d20.position.set(rc.d20[0], rc.d20[1] + Math.sin(t * 0.9) * 0.14, rc.d20[2]);
    this.d20.scale.setScalar(Math.max(0.001, rc.s * (1 + this.hoverCur * 0.06)));
    this.d20.visible = rc.s > 0.05;
    this.die.material.emissive.copy(this.colB).multiplyScalar(0.9 + this.hoverCur * 0.8 + Math.sin(t * 2) * 0.1);
    this.die.material.color.copy(this.colA).multiplyScalar(0.18).add(new THREE.Color(0.02, 0.015, 0.03));
    this.dieEdges.material.color.copy(this.colB).multiplyScalar(1.4);
    (this.glow.material as THREE.SpriteMaterial).color.copy(this.colA).lerp(this.colB, 0.35).multiplyScalar(0.55 + this.hoverCur * 0.35);
    this.rings.forEach((r, i) => {
      r.rotation.x += dt * (0.18 + i * 0.07) * spin * (i % 2 ? -1 : 1);
      r.rotation.y += dt * (0.12 + i * 0.05) * spin;
      r.material.color.copy(i % 2 ? this.colB : this.colA).multiplyScalar(0.9);
    });
    this.gems.forEach((g, i) => {
      const a = t * (0.7 + i * 0.25) * (i % 2 ? -1 : 1) + i * 2;
      const r = 1.95 + i * 0.35;
      g.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.5, Math.sin(a) * r);
      g.rotation.x += dt * 2;
      g.rotation.y += dt * 3;
      g.material.color.copy(i % 2 ? this.colA : this.colB).multiplyScalar(1.6);
    });

    /* büyü çemberi — D20'nin altında */
    // oyunda masanın ortasına, çuhaya yatar
    this.circle.position.set(
      THREE.MathUtils.lerp(rc.d20[0], 0, pb),
      THREE.MathUtils.lerp(rc.d20[1] - 1.75 * rc.s - 0.2, TABLE_Y + 0.012 + (pb - 1) * 1.5, pb),
      THREE.MathUtils.lerp(rc.d20[2], 0, pb)
    );
    this.circle.rotation.x = -Math.PI / 2 + 0.32 * (1 - pb);
    this.circle.scale.setScalar(Math.max(0.001, THREE.MathUtils.lerp(rc.s, 0.72, pb)));
    const cu = this.circle.material.uniforms;
    cu.uTime.value = t;
    cu.uOpacity.value = rc.circle * (0.6 + this.hoverCur * 0.4) * (1 - pb * 0.4);
    (cu.uA.value as THREE.Color).copy(this.colA);
    (cu.uB.value as THREE.Color).copy(this.colB);
    this.circle.visible = rc.circle > 0.01;

    /* ışıklar */
    this.lights.forEach((l, i) => {
      const a = t * 0.6 + i * Math.PI;
      l.position.set(rc.d20[0] + Math.cos(a) * 3.5, rc.d20[1] + 1.5 - i * 2.5, rc.d20[2] + Math.sin(a) * 3.5);
      l.color.copy(i ? this.colA : this.colB);
      l.intensity = (i ? 14 : 18) * (1 + this.hoverCur * 0.8);
    });

    /* gökyüzü / yıldız / parçacık / sis / ızgara */
    const nu = this.nebula.uniforms;
    nu.uTime.value = t;
    nu.uEnergy.value = this.energyCur;
    nu.uDim.value = 1 - pb * 0.9;
    (nu.uPointer.value as THREE.Vector2).copy(this.pointerCur);
    (nu.uA.value as THREE.Color).copy(this.colA);
    (nu.uB.value as THREE.Color).copy(this.colB);
    (nu.uBg.value as THREE.Color).copy(this.colBg);
    this.stars.uniforms.uTime.value = t;
    this.stars.uniforms.uOpacity.value = 1 - pb;

    const mu = this.motes.uniforms;
    mu.uTime.value = t;
    mu.uCyber.value = this.cyberCur;
    mu.uEnergy.value = this.energyCur * (1 - pb * 0.55);
    (mu.uA.value as THREE.Color).copy(this.colA);
    (mu.uB.value as THREE.Color).copy(this.colB);

    this.fogs.forEach((f, i) => {
      const u = f.material.uniforms;
      u.uTime.value = t + i * 13;
      u.uOpacity.value = rc.fog * (0.9 + this.energyCur * 0.2) * (this.mood === "danger" && inPlay ? 1.3 : 1);
      (u.uA.value as THREE.Color).copy(this.colA);
      (u.uB.value as THREE.Color).copy(this.colB);
      f.visible = u.uOpacity.value > 0.01;
    });

    const gu = this.grid.material.uniforms;
    gu.uTime.value = t;
    gu.uOpacity.value = this.cyberCur * 0.6 * (1 - pb);
    (gu.uA.value as THREE.Color).copy(this.colA);
    (gu.uB.value as THREE.Color).copy(this.colB);
    this.grid.visible = gu.uOpacity.value > 0.01;

    /* sahne perdesi */
    const au = this.art.material.uniforms;
    au.uTime.value = t;
    au.uOpacity.value = rc.art;
    au.uHas.value = this.artHasCur;
    au.uEnergy.value = this.energyCur;
    (au.uA.value as THREE.Color).copy(this.colA);
    (au.uB.value as THREE.Color).copy(this.colB);
    (au.uPointer.value as THREE.Vector2).copy(this.pointerCur);
    if (this.artMixing) {
      this.artMix = Math.min(1, this.artMix + dt / (this.reduced ? 0.3 : 1.4));
      au.uMix.value = this.artMix;
      if (this.artMix >= 1) this.settleArt();
    }
    this.art.visible = rc.art > 0.005;

    /* patlama */
    this.burstT += dt;
    this.burstMat.uniforms.uT.value = this.burstT;
    if (inPlay) this.burstMat.uniforms.uOrigin.value.copy(this.table.diePosition);
    else this.burstMat.uniforms.uOrigin.value.set(rc.d20[0], rc.d20[1], rc.d20[2]);

    /* masa — oyuna girerken aşağıdan yükselir */
    this.table.group.position.y = (pb - 1) * 1.5;
    this.table.update(dt, t, this.colA, this.colB, pb > 0.02, this.cyberCur);

    this.composer.render(dt);
  };

  /* ── gökyüzü: tam ekran nebula ── */
  private buildNebula() {
    this.nebula = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uEnergy: { value: 1 },
        uDim: { value: 1 },
        uPointer: { value: new THREE.Vector2() },
        uA: { value: this.colA.clone() },
        uB: { value: this.colB.clone() },
        uBg: { value: this.colBg.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime, uAspect, uEnergy, uDim;
        uniform vec2 uPointer;
        uniform vec3 uA, uB, uBg;
        ${NOISE}
        void main(){
          vec2 p = (vUv - .5) * vec2(uAspect, 1.) - uPointer * .025;
          float t = uTime * .018;
          float n1 = fbm(p * 1.4 + vec2(t, -t * .7));
          float n2 = fbm(p * 2.6 - vec2(t * .6, t) + n1 * 1.2);
          vec3 col = uBg;
          col += uA * pow(n2, 2.4) * .42 * uEnergy;
          col += uB * pow(n1, 4.) * .45 * uEnergy;
          float v = 1. - smoothstep(.25, 1.15, length(p * vec2(.75, 1.)));
          col *= (.45 + .55 * v) * uDim;
          gl_FragColor = vec4(col, 1.);
          ${OUT}
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.nebula);
    quad.frustumCulled = false;
    quad.renderOrder = -10;
    this.scene.add(quad);
  }

  /* ── yıldız kabuğu ── */
  private buildStars() {
    const n = this.small ? 900 : 1800;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 40);
      v.z = -Math.abs(v.z) - 5;
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = 0.6 + Math.pow(Math.random(), 4) * 3.2;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    this.stars = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPR: { value: this.renderer.getPixelRatio() }, uOpacity: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aSeed;
        uniform float uTime, uPR; varying float vA; varying float vSeed;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          gl_Position = projectionMatrix * mv;
          vA = .5 + .5 * sin(uTime * (.8 + aSeed * 2.5) + aSeed * 40.);
          vSeed = aSeed;
          gl_PointSize = aSize * uPR * (42. / -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vSeed; uniform float uOpacity;
        void main(){
          vec2 c = gl_PointCoord - .5;
          float d = length(c);
          float a = smoothstep(.5, 0., d);
          a = a * a + smoothstep(.06, 0., abs(c.x)) * smoothstep(.5, 0., abs(c.y)) * .25
                    + smoothstep(.06, 0., abs(c.y)) * smoothstep(.5, 0., abs(c.x)) * .25;
          vec3 col = mix(vec3(1., .92, .78), vec3(.78, .82, 1.), vSeed);
          gl_FragColor = vec4(col * a * vA * uOpacity, 1.);
          ${OUT}
        }`,
    });
    const pts = new THREE.Points(g, this.stars);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  /* ── cyber: neon perspektif ızgarası ── */
  private buildGrid() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uA: { value: this.colA.clone() },
        uB: { value: this.colB.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uTime, uOpacity; uniform vec3 uA, uB;
        float line(float x){ float w = fwidth(x) * 1.2; float f = abs(fract(x - .5) - .5); return smoothstep(w, 0., f); }
        void main(){
          vec2 p = vP * .9;
          p.y += uTime * .8;
          float g = max(line(p.x), line(p.y));
          float dist = length(vP) / 40.;
          float fade = smoothstep(1., .05, dist) * smoothstep(0., .08, dist + .05);
          float horizon = smoothstep(-40., -8., vP.y);
          vec3 col = mix(uA, uB, horizon * .8) * (g * 1.4 + .04);
          gl_FragColor = vec4(col * fade * uOpacity, 1.);
          ${OUT}
        }`,
    });
    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 1, 1), mat);
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.set(0, -3.3, -10);
    this.grid.renderOrder = -5;
    this.scene.add(this.grid);
  }

  /* ── oyun sahnesi perdesi: kavisli, crossfade'li ── */
  private buildArt() {
    const blank = new THREE.DataTexture(new Uint8Array([8, 7, 13, 255]), 1, 1);
    blank.needsUpdate = true;
    this.disposables.push(blank);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTexA: { value: blank },
        uTexB: { value: blank },
        uAspA: { value: 16 / 9 },
        uAspB: { value: 16 / 9 },
        uPlaneAsp: { value: 16 / 9 },
        uMix: { value: 0 },
        uHas: { value: 0 },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uEnergy: { value: 1 },
        uPointer: { value: new THREE.Vector2() },
        uA: { value: this.colA.clone() },
        uB: { value: this.colB.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D uTexA, uTexB;
        uniform float uAspA, uAspB, uPlaneAsp, uMix, uOpacity, uTime, uEnergy, uHas;
        uniform vec2 uPointer;
        uniform vec3 uA, uB;
        ${NOISE}
        vec2 cover(vec2 uv, float ta){
          vec2 s = uPlaneAsp > ta ? vec2(1., ta / uPlaneAsp) : vec2(uPlaneAsp / ta, 1.);
          float z = 1.04 + .035 * sin(uTime * .045);
          vec2 pan = vec2(sin(uTime * .031), cos(uTime * .027)) * .012 - uPointer * .012;
          return (uv - .5) * s / z + .5 + pan;
        }
        void main(){
          vec3 a = texture2D(uTexA, cover(vUv, uAspA)).rgb;
          vec3 b = texture2D(uTexB, cover(vUv, uAspB)).rgb;
          float n = fbm(vUv * 3.5 + uTime * .02);
          float m = smoothstep(n - .06, n + .06, uMix * 1.15 - .05);
          vec3 col = mix(a, b, m);
          float edge = (1. - abs(m - .5) * 2.) * step(.001, uMix) * step(uMix, .999);
          col += uB * edge * 1.6;
          float l = dot(col, vec3(.299, .587, .114));
          col = mix(col, col * mix(uA, uB, l) * 2.2, .07);
          col *= .82 + .18 * uEnergy;
          // çizim yokken: aynada dönen büyülü sis
          vec2 sp = (vUv - .5) * vec2(uPlaneAsp, 1.);
          float r = length(sp);
          float ang = atan(sp.y, sp.x);
          float sw = fbm(vec2(ang * 1.6 + uTime * .06 + r * 3.2, r * 4. - uTime * .15));
          vec3 mist = mix(uA * .18, uB * .85, smoothstep(.35, .85, sw)) * (1.15 - r * .8);
          mist += mix(uA, vec3(1.), .3) * pow(max(0., 1. - r * 2.4), 3.) * .9;
          col = mix(mist, col, uHas);
          vec2 q = vUv - .5;
          col *= 1. - smoothstep(.35, .8, length(q * vec2(1., 1.25))) * .45;
          // ayna camı: kenara doğru hafif iç gölge + yansıma şeridi
          float ex = smoothstep(0., .035, min(vUv.x, 1. - vUv.x)) * smoothstep(0., .05, min(vUv.y, 1. - vUv.y));
          col *= .55 + .45 * ex;
          col += vec3(1.) * .05 * smoothstep(.02, 0., abs(vUv.x - vUv.y * .6 - .15));
          gl_FragColor = vec4(col, uOpacity);
          ${OUT}
        }`,
    });
    this.art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 1), mat);
    // tavernadaki büyü aynasının camı
    this.art.position.set(MIRROR.x, MIRROR.y, MIRROR.z);
    this.art.renderOrder = 1;
    this.scene.add(this.art);
  }

  /** sahne çizimi aynanın camına oturur */
  private fitArt() {
    if (!this.art) return;
    const w = MIRROR.w;
    const h = MIRROR.h;
    this.art.geometry.dispose();
    this.art.geometry = new THREE.PlaneGeometry(w, h, 1, 1);
    this.art.material.uniforms.uPlaneAsp.value = w / h;
  }

  private pushArt(tex: THREE.Texture, aspect: number, dissolve: boolean) {
    this.artTextures.add(tex);
    const u = this.art.material.uniforms;
    if (!dissolve || this.artHas === 0) {
      this.releaseArt(u.uTexA.value as THREE.Texture, tex);
      u.uTexA.value = tex;
      u.uAspA.value = aspect;
      u.uTexB.value = tex;
      u.uAspB.value = aspect;
      u.uMix.value = 0;
      this.artMixing = false;
      this.artHas = 1;
      return;
    }
    if (this.artMixing) this.settleArt();
    u.uTexB.value = tex;
    u.uAspB.value = aspect;
    this.artMix = 0;
    this.artMixing = true;
    this.artHas = 1;
  }
  private settleArt() {
    const u = this.art.material.uniforms;
    const old = u.uTexA.value as THREE.Texture;
    u.uTexA.value = u.uTexB.value;
    u.uAspA.value = u.uAspB.value;
    u.uMix.value = 0;
    this.artMix = 0;
    this.artMixing = false;
    this.releaseArt(old, u.uTexA.value as THREE.Texture);
  }
  private releaseArt(old: THREE.Texture, keep: THREE.Texture) {
    if (old !== keep && this.artTextures.has(old)) {
      this.artTextures.delete(old);
      old.dispose();
    }
  }

  private loadVideo(v: { webm?: string; mp4: string }, token: number) {
    const el = document.createElement("video");
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    const canWebm = v.webm && el.canPlayType("video/webm; codecs=vp9") !== "";
    el.src = canWebm ? v.webm! : v.mp4;
    el.addEventListener(
      "playing",
      () => {
        if (token !== this.artToken) return;
        const vt = new THREE.VideoTexture(el);
        vt.colorSpace = THREE.SRGBColorSpace;
        // poster ile aynı kare — yumuşak geçiş için yine dissolve kullan
        this.pushArt(vt, el.videoWidth / el.videoHeight || 16 / 9, true);
      },
      { once: true }
    );
    el.play().catch(() => {});
    this.video = el;
  }
  private stopVideo() {
    if (!this.video) return;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.video = null;
  }

  /* ── derinlik sisi: kameraya farklı uzaklıkta 3 katman ── */
  private buildFogs() {
    const layers = [
      { z: -6, s: 26, a: 0.55 },
      { z: -1, s: 18, a: 0.4 },
      { z: 3.5, s: 11, a: 0.22 },
    ];
    layers.forEach((L, i) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uSeed: { value: i * 7.3 },
          uStrength: { value: L.a },
          uA: { value: this.colA.clone() },
          uB: { value: this.colB.clone() },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv; uniform float uTime, uOpacity, uSeed, uStrength; uniform vec3 uA, uB;
          ${NOISE}
          void main(){
            vec2 p = vUv * 2.2 + vec2(uTime * .012, uTime * .005) + uSeed;
            float n = fbm(p + fbm(p * 1.7 - uTime * .01));
            float mask = smoothstep(.5, .15, length(vUv - .5));
            float d = smoothstep(.42, .9, n) * mask;
            vec3 col = mix(uA, uB, smoothstep(.4, .8, fbm(p * .6 + 3.)));
            gl_FragColor = vec4(col * d * uStrength * uOpacity * .6, 1.);
            ${OUT}
          }`,
      });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(L.s * 1.8, L.s), mat);
      f.position.set((i - 1) * 1.5, -0.6 + i * 0.3, L.z);
      f.renderOrder = -3 + i;
      this.fogs.push(f);
      this.scene.add(f);
    });
  }

  /* ── D20: rakamları parlayan metal zar + halkalar ── */
  private buildDie() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const atlas = this.numberAtlas();
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    const cols = 5;
    const rows = 4;
    for (let f = 0; f < 20; f++) {
      const cx = f % cols;
      const cy = Math.floor(f / cols);
      const u0 = cx / cols;
      const v0 = 1 - (cy + 1) / rows;
      const cw = 1 / cols;
      const ch = 1 / rows;
      uv.setXY(f * 3 + 0, u0 + cw * 0.5, v0 + ch * 0.96);
      uv.setXY(f * 3 + 1, u0 + cw * 0.02, v0 + ch * 0.16);
      uv.setXY(f * 3 + 2, u0 + cw * 0.98, v0 + ch * 0.16);
    }
    uv.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      color: "#1a1330",
      metalness: 0.92,
      roughness: 0.26,
      flatShading: true,
      emissive: new THREE.Color("#d8b45a"),
      emissiveMap: atlas,
      emissiveIntensity: 1.25,
    });
    this.die = new THREE.Mesh(geo, mat);
    this.d20.add(this.die);

    const edges = new THREE.EdgesGeometry(geo);
    this.dieEdges = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: "#d8b45a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    this.dieEdges.scale.setScalar(1.003);
    this.d20.add(this.dieEdges);

    const glowTex = this.radialTexture();
    this.disposables.push(glowTex, atlas);
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
    );
    this.glow.scale.setScalar(6.5);
    this.glow.renderOrder = -1;
    this.d20.add(this.glow);

    [1.65, 2.05, 2.45].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, i === 1 ? 0.012 : 0.007, 6, 160),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 0.7, 0);
      this.rings.push(ring);
      this.d20.add(ring);
    });
    for (let i = 0; i < 3; i++) {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.07 + i * 0.015, 0),
        new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true })
      );
      this.gems.push(gem);
      this.d20.add(gem);
    }
    this.scene.add(this.d20);
  }

  private numberAtlas() {
    const c = document.createElement("canvas");
    c.width = 1280;
    c.height = 1024;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    const cw = c.width / 5;
    const ch = c.height / 4;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 0; i < 20; i++) {
      const x = (i % 5) * cw + cw / 2;
      const y = Math.floor(i / 5) * ch + ch * 0.6;
      const n = String(i + 1);
      // ince iç kenar hattı — yüzeyin kazınmış görünmesi için
      g.strokeStyle = "rgba(255,255,255,0.10)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo((i % 5) * cw + cw * 0.5, Math.floor(i / 5) * ch + ch * 0.1);
      g.lineTo((i % 5) * cw + cw * 0.08, Math.floor(i / 5) * ch + ch * 0.8);
      g.lineTo((i % 5) * cw + cw * 0.92, Math.floor(i / 5) * ch + ch * 0.8);
      g.closePath();
      g.stroke();
      g.shadowColor = "#fff";
      g.shadowBlur = i === 19 ? 26 : 14;
      g.fillStyle = i === 19 ? "#ffffff" : "#f2e3b5";
      g.font = `700 ${n.length > 1 ? 92 : 104}px Cinzel, Georgia, serif`;
      g.fillText(n, x, y);
      if (n === "6" || n === "9") g.fillRect(x - 22, y + 48, 44, 7);
      g.shadowBlur = 0;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  private radialTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.18, "rgba(255,255,255,0.35)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.08)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* ── büyü çemberi (tamamen prosedürel) ── */
  private buildCircle() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uA: { value: this.colA.clone() },
        uB: { value: this.colB.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uTime, uOpacity; uniform vec3 uA, uB;
        #define PI 3.14159265
        float ring(float r, float c, float w){ return smoothstep(w, 0., abs(r - c)); }
        float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float tri(float r, float a, float rot, float R){
          float k = 2. * PI / 3.;
          float d = r * cos(mod(a + rot, k) - k * .5);
          return ring(d, R * .5, .006) * step(r, R + .01);
        }
        void main(){
          vec2 p = vUv * 2. - 1.;
          float r = length(p);
          float a = atan(p.y, p.x);
          float t = uTime;
          float v = ring(r, .96, .008) + ring(r, .9, .004) + ring(r, .64, .006) + ring(r, .585, .003) + ring(r, .33, .005);
          // saat dilimi çentikleri
          float ta = a + t * .12;
          float ticks = step(.9, r) * step(r, .96) * smoothstep(.75, 1., abs(sin(ta * 36.))) * .9;
          // rune bandı: her dilimde 3x4'lük sözde glif
          float ra = a - t * .07 + PI;
          float segs = 28.;
          float sp = ra / (2. * PI) * segs;
          float seg = floor(sp);
          float lx = fract(sp);
          float band = step(.67, r) * step(r, .87);
          float gy = floor((r - .67) / .2 * 4.);
          float gx = floor(lx * 3.);
          float bit = step(.42, h21(vec2(seg * 3. + gx, gy)));
          float cell = step(.12, fract(lx * 3.)) * step(fract(lx * 3.), .88) * step(.15, fract((r - .67) / .2 * 4.)) * step(fract((r - .67) / .2 * 4.), .85);
          float glyph = band * bit * cell * step(.18, lx) * step(lx, .82) * .8;
          // iç içe iki üçgen = heksagram, ters yönde döner
          float star = tri(r, a, t * .2, .585) + tri(r, a, t * .2 + PI / 3., .585);
          // merkez parıltısı
          float core = smoothstep(.33, 0., r) * .25;
          float fade = smoothstep(1., .9, r);
          vec3 col = uB * (v + ticks + star) + mix(uA, uB, .3) * glyph * 1.3 + uA * core;
          float pulse = .85 + .15 * sin(t * 1.6);
          gl_FragColor = vec4(col * fade * uOpacity * pulse, 1.);
          ${OUT}
        }`,
    });
    this.circle = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), mat);
    this.circle.rotation.x = -Math.PI / 2 + 0.32;
    this.scene.add(this.circle);
  }

  /* ── uçuşan kıvılcımlar (orman) / dijital yağmur (cyber) ── */
  private buildMotes() {
    const n = this.small ? 500 : 1100;
    const pos = new Float32Array(n * 3);
    const rnd = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, -10 + Math.random() * 15], i * 3);
      rnd.set([Math.random(), Math.random(), Math.random()], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 3));
    this.motes = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPR: { value: this.renderer.getPixelRatio() },
        uCyber: { value: 0 },
        uEnergy: { value: 1 },
        uA: { value: this.colA.clone() },
        uB: { value: this.colB.clone() },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aRand;
        uniform float uTime, uPR, uCyber;
        varying float vA; varying float vMix;
        void main(){
          vec3 p = position;
          float H = 16.;
          float dir = mix(1., -2.2, uCyber);
          float sp = (.18 + aRand.x * .55) * dir;
          p.y = mod(p.y + 8. + uTime * sp, H) - 8.;
          float sway = 1. - uCyber;
          p.x += sin(uTime * .5 * (.5 + aRand.x) + aRand.y * 6.28) * .45 * sway;
          p.z += cos(uTime * .4 + aRand.y * 6.28) * .25 * sway;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          float edge = smoothstep(8., 5., abs(p.y));
          float tw = .55 + .45 * sin(uTime * (1.5 + aRand.x * 3.) + aRand.y * 20.);
          vA = edge * tw * mix(1., .75, uCyber);
          vMix = aRand.z;
          gl_PointSize = (2. + aRand.x * 3.5) * mix(1., 1.8, uCyber) * uPR * (11. / -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uA, uB; uniform float uCyber, uEnergy;
        varying float vA; varying float vMix;
        void main(){
          vec2 c = gl_PointCoord - .5;
          float d = length(c);
          float round_ = smoothstep(.5, 0., d); round_ *= round_;
          float dash = smoothstep(.12, .02, abs(c.x)) * smoothstep(.5, .1, abs(c.y));
          float shape = mix(round_, dash * .9 + round_ * .25, uCyber);
          vec3 col = mix(uB, uA, step(.62, vMix)) * 1.7;
          gl_FragColor = vec4(col * shape * vA * uEnergy, 1.);
          ${OUT}
        }`,
    });
    const pts = new THREE.Points(g, this.motes);
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    this.scene.add(pts);
  }

  /* ── kritik zar patlaması ── */
  private buildBurst() {
    const n = this.small ? 260 : 520;
    const dir = new Float32Array(n * 3);
    const rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.4 + Math.pow(Math.random(), 0.6) * 1.1);
      dir.set([v.x * 1.4, v.y, v.z * 0.6], i * 3);
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
    this.burstMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: 99 },
        uPR: { value: this.renderer.getPixelRatio() },
        uOrigin: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color("#ffd77a") },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aDir; attribute float aRnd;
        uniform float uT, uPR; uniform vec3 uOrigin; varying float vA;
        void main(){
          float t = uT;
          vec3 p = uOrigin + aDir * (1. - exp(-t * 2.6)) * 5. + vec3(0., -t * t * .35, 0.);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          vA = exp(-t * (1.1 + aRnd)) ;
          gl_PointSize = (3. + aRnd * 7.) * uPR * (10. / -mv.z) * max(.2, 1. - t * .3);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5);
          float a = smoothstep(.5, 0., d);
          gl_FragColor = vec4(uColor * a * a * vA * 2.2, 1.);
          ${OUT}
        }`,
    });
    const pts = new THREE.Points(g, this.burstMat);
    pts.frustumCulled = false;
    pts.renderOrder = 10;
    this.scene.add(pts);
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffffff, 16, 14, 1.6);
      this.lights.push(l);
      this.scene.add(l);
    }
  }
}
