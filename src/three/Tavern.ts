import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Taverna — oyun adımının 3D sahnesi.
 *
 * Taş duvarlı, meşale ışıklı bir taverna salonu; ortada uzun bir oyun masası.
 * Anlatıcı masanın başında oturur, arkasında sahne çiziminin aktığı büyü aynası
 * asılıdır. Oyuncular (KayKit maceracıları — CC0) sandalyelerde oturur, konuşan
 * öne eğilip el kol hareketi yapar, diğerleri başını ona çevirir. Zar atan
 * karakter ayağa kalkar, zarı masaya fırlatır, sonuca göre sevinir ya da
 * yıkılır ve yerine oturur. Anlatıcının seslendirdiği NPC'ler masadaki kristal
 * kürenin üstünde hologram olarak belirir.
 *
 * Varlıklar /public/assets/tavern altında (meshopt + WebP ile sıkıştırılmış):
 * tavern.glb (oda eşyaları), anims.glb (ortak iskelet animasyonları),
 * <model>.glb (karakterler).
 */

export type ModelId = "knight" | "barbarian" | "mage" | "rogue" | "rogue_hooded";
export type Seat = {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  face: string;
  model?: ModelId;
  isGm?: boolean;
  isMe?: boolean;
};
export type NpcCard = { name: string; color: string; avatar?: string; face: string } | null;
export type Shot = "table" | "mirror";

const BASE = "/assets/tavern/";
export const TABLE_Y = 1.0;
const DIE_S = 0.2;
/** duvardaki büyü aynası — sahne çizimi bunun içine yansır */
export const MIRROR = { x: 0, y: 3.05, z: -7.25, w: 6.6, h: 3.6 };

type Char = {
  seat: Seat;
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: THREE.AnimationAction | null;
  head: THREE.Object3D | null;
  chest: THREE.Object3D | null;
  armR: THREE.Object3D | null;
  handR: THREE.Object3D | null;
  medal: THREE.Sprite;
  glow: THREE.Sprite;
  talk: number;
  yaw: number;
  phase: number;
  busy: boolean;
  headPos: THREE.Vector3;
};

type Roll = {
  start: THREE.Vector3;
  end: THREE.Vector3;
  q: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
  t: number;
  dur: number;
  done: (p: THREE.Vector3) => void;
};

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* koltuk düzeni: masa uzunlamasına z ekseninde; anlatıcı -z başında, sen +z başında */
const HEAD_Z = 2.75;
const SIDE_X = 1.62;

export class TavernScene {
  group = new THREE.Group();
  private room = new THREE.Group();
  private people = new THREE.Group();
  private owned: { dispose: () => void }[] = [];
  private shadows: boolean;
  private loader: GLTFLoader;
  private props = new Map<string, THREE.Object3D>();
  private clips: THREE.AnimationClip[] = [];
  private models = new Map<ModelId, Promise<GLTF>>();
  private ready: Promise<void>;
  private disposed = false;

  private chars = new Map<string, Char>();
  private seatToken = 0;
  private speaker: string | null = null;
  private shot: Shot = "table";

  /* ışıklar */
  private hemi: THREE.HemisphereLight;
  private key: THREE.SpotLight;
  private mirrorLight: THREE.PointLight;
  private candleLight: THREE.PointLight;
  private speakLight: THREE.PointLight;
  private torches: { light: THREE.PointLight | null; flame: THREE.Sprite; base: number }[] = [];
  private candles: { flame: THREE.Sprite; base: number }[] = [];

  /* ayna, kristal küre, NPC hologramı */
  private mirrorFrame: THREE.Mesh;
  private mirrorRim: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private orb: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private orbGlow: THREE.Sprite;
  private npcSprite: THREE.Sprite;
  private npcBeam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private npcKey = "";
  private npcOn = 0;
  private npcTarget = 0;

  /* zar */
  private die: THREE.Mesh;
  private dieGlow: THREE.Sprite;
  private rolling: Roll | null = null;
  private dieShown = 0;
  private settlePulse = 0;
  private faceNormals: THREE.Vector3[] = [];
  private faceUps: THREE.Vector3[] = [];

  private glowTex: THREE.Texture;
  private flameTex: THREE.Texture;

  constructor(opts: { shadows: boolean; dieGeo: THREE.BufferGeometry; dieMat: THREE.Material; glowTex: THREE.Texture }) {
    this.shadows = opts.shadows;
    this.glowTex = opts.glowTex;
    this.group.visible = false;
    this.group.add(this.room, this.people);
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.flameTex = this.radialCanvas(128, [
      [0, "rgba(255,255,255,1)"],
      [0.22, "rgba(255,226,160,0.9)"],
      [0.55, "rgba(255,140,50,0.35)"],
      [1, "rgba(255,90,20,0)"],
    ]);

    /* ── ışıklar ── */
    this.hemi = new THREE.HemisphereLight("#8c7aa8", "#1c1208", 0.55);
    this.key = new THREE.SpotLight("#ffd9a8", 70, 22, 0.62, 0.75, 1.5);
    this.key.position.set(0.8, 8, 2.2);
    this.key.target.position.set(0, TABLE_Y, -0.4);
    this.key.castShadow = this.shadows;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0003;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 5;
    this.mirrorLight = new THREE.PointLight("#8a6ad0", 16, 11, 1.7);
    this.mirrorLight.position.set(MIRROR.x, MIRROR.y - 0.4, MIRROR.z + 1.2);
    this.candleLight = new THREE.PointLight("#ffae5a", 5, 5, 1.8);
    this.candleLight.position.set(0.1, TABLE_Y + 0.9, 0.2);
    this.speakLight = new THREE.PointLight("#ffffff", 0, 3.6, 1.5);
    this.group.add(this.hemi, this.key, this.key.target, this.mirrorLight, this.candleLight, this.speakLight);

    /* ── büyü aynası: altın çerçeve + parlayan iç kenar ── */
    const frameShape = new THREE.Shape();
    const rr = (s: THREE.Shape | THREE.Path, w: number, h: number, r: number) => {
      s.moveTo(-w / 2 + r, -h / 2);
      s.lineTo(w / 2 - r, -h / 2);
      s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      s.lineTo(w / 2, h / 2 - r);
      s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      s.lineTo(-w / 2 + r, h / 2);
      s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      s.lineTo(-w / 2, -h / 2 + r);
      s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    };
    rr(frameShape, MIRROR.w + 0.62, MIRROR.h + 0.62, 0.45);
    const hole = new THREE.Path();
    rr(hole, MIRROR.w, MIRROR.h, 0.28);
    frameShape.holes.push(hole);
    this.mirrorFrame = new THREE.Mesh(
      new THREE.ExtrudeGeometry(frameShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 10 }),
      new THREE.MeshStandardMaterial({ color: "#c9a04a", metalness: 0.95, roughness: 0.32 })
    );
    this.mirrorFrame.position.set(MIRROR.x, MIRROR.y, MIRROR.z - 0.12);
    this.mirrorFrame.castShadow = this.shadows;
    const rimShape = new THREE.Shape();
    rr(rimShape, MIRROR.w + 0.08, MIRROR.h + 0.08, 0.3);
    const rimHole = new THREE.Path();
    rr(rimHole, MIRROR.w - 0.02, MIRROR.h - 0.02, 0.27);
    rimShape.holes.push(rimHole);
    this.mirrorRim = new THREE.Mesh(
      new THREE.ShapeGeometry(rimShape, 10),
      new THREE.MeshBasicMaterial({ color: "#caa0ff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.mirrorRim.position.set(MIRROR.x, MIRROR.y, MIRROR.z + 0.12);
    this.group.add(this.mirrorFrame, this.mirrorRim);

    /* ── kristal küre (masanın ortasında) + NPC hologramı ── */
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.17, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: "#b8913f", metalness: 0.9, roughness: 0.35 })
    );
    stand.position.set(0, TABLE_Y + 0.06, 0.05);
    stand.castShadow = this.shadows;
    this.orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 32, 24),
      new THREE.MeshStandardMaterial({
        color: "#9fd8ff",
        emissive: "#6a4dd0",
        emissiveIntensity: 0.6,
        metalness: 0.1,
        roughness: 0.05,
        transparent: true,
        opacity: 0.82,
      })
    );
    this.orb.position.set(0, TABLE_Y + 0.31, 0.05);
    this.orbGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })
    );
    this.orbGlow.position.copy(this.orb.position);
    this.orbGlow.scale.setScalar(1.1);
    this.group.add(stand, this.orb, this.orbGlow);

    this.npcSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    this.npcSprite.position.set(0, TABLE_Y + 1.35, 0.05);
    this.npcSprite.scale.set(1.0, 1.25, 1);
    this.npcSprite.renderOrder = 6;
    this.npcBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.16, 1.0, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#9f7cff",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaMap: this.beamAlpha(),
      })
    );
    this.npcBeam.position.set(0, TABLE_Y + 0.85, 0.05);
    this.group.add(this.npcSprite, this.npcBeam);

    /* ── atılan zar ── */
    this.die = new THREE.Mesh(opts.dieGeo, opts.dieMat);
    this.die.scale.setScalar(0.001);
    this.die.castShadow = this.shadows;
    this.dieGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })
    );
    this.group.add(this.die, this.dieGlow);
    this.computeFaces(opts.dieGeo);

    this.ready = this.load();
  }

  /* ════════ API ════════ */

  setSeats(list: Seat[]) {
    const token = ++this.seatToken;
    this.clearChars();
    if (!list.length) return;
    this.ready.then(() => {
      if (token === this.seatToken && !this.disposed) this.buildSeats(list, token);
    });
  }

  setSpeaker(id: string | null, npc: NpcCard) {
    this.speaker = id;
    const key = npc ? npc.name : "";
    if (key !== this.npcKey) {
      this.npcKey = key;
      if (npc) {
        const old = this.npcSprite.material.map;
        this.npcSprite.material.map = this.medalTexture(npc.avatar, npc.face, npc.color, npc.name, true);
        this.npcSprite.material.needsUpdate = true;
        old?.dispose();
        this.npcBeam.material.color.set(npc.color);
      }
    }
    this.npcTarget = npc ? 1 : 0;
  }

  setShot(s: Shot) {
    this.shot = s;
  }

  /**
   * Zar atışı: atan karakter ayağa kalkar, fırlatır; zar masada sekip istenen
   * yüz yukarı bakacak şekilde durur. `ok` verilirse karakter sevinir/yıkılır.
   * Söz zar durduğunda çözülür.
   */
  async roll(value: number, fromId: string, ok?: boolean): Promise<THREE.Vector3> {
    this.rolling?.done(this.die.position.clone());
    this.rolling = null;
    await this.ready;
    const ch = this.chars.get(fromId);
    let start: THREE.Vector3;
    if (ch && ch.actions.Throw) {
      ch.busy = true;
      this.play(ch, "Sit_Chair_StandUp", { once: true, fade: 0.2 });
      await wait(720);
      this.play(ch, "Throw", { once: true, fade: 0.18 });
      await wait(560);
      // fırlatma anında sağ el: ayakta, masaya doğru uzanmış
      start = this.worldToGroup(ch.root.localToWorld(new THREE.Vector3(-0.3, 1.75, 0.75)));
    } else {
      start = new THREE.Vector3(0.3, TABLE_Y + 0.9, HEAD_Z - 0.8);
    }
    start.y = Math.max(start.y, TABLE_Y + 0.4);
    const settled = await this.throwDie(value, start);
    if (ch) {
      (async () => {
        await wait(250);
        if (ok === true) this.play(ch, "Cheer", { once: true, fade: 0.25 });
        else if (ok === false) this.play(ch, "Hit_A", { once: true, fade: 0.2 });
        await wait(ok === undefined ? 200 : ok ? 1500 : 900);
        this.play(ch, "Sit_Chair_Down", { once: true, fade: 0.3 });
        await wait(760);
        this.play(ch, "Sit_Chair_Idle", { fade: 0.35 });
        ch.busy = false;
      })();
    }
    return settled;
  }

  /** kameranın bakacağı yer: yuvarlanan zar > ayna (sahne açılışı) > konuşan */
  focus(): { pos: THREE.Vector3; kind: "die" | "speaker" | "mirror" } | null {
    if (this.rolling || this.settlePulse > 0.25) return { pos: this.diePosition, kind: "die" };
    if (this.shot === "mirror") return { pos: this.group.localToWorld(new THREE.Vector3(MIRROR.x, MIRROR.y, MIRROR.z)), kind: "mirror" };
    const c = this.speaker ? this.chars.get(this.speaker) : null;
    if (c && !c.seat.isMe) return { pos: this.group.localToWorld(c.headPos.clone()), kind: "speaker" };
    if (this.speaker && this.npcTarget) return { pos: this.group.localToWorld(this.npcSprite.position.clone()), kind: "speaker" };
    return null;
  }
  get diePosition() {
    return this.group.localToWorld(this.die.position.clone());
  }

  update(dt: number, t: number, colA: THREE.Color, colB: THREE.Color, active: boolean, cyber: number) {
    this.group.visible = active;
    if (!active) return;

    /* meşaleler, mumlar — cyber'de neon alev */
    const flameCol = new THREE.Color("#ffb45a").lerp(colB, 0.15 + cyber * 0.6);
    this.torches.forEach((tc) => {
      const f = 0.82 + Math.sin(t * 12 + tc.base) * 0.08 + Math.sin(t * 7.3 + tc.base * 2) * 0.06 + Math.random() * 0.06;
      tc.flame.scale.set(0.42 * f, 0.62 * f, 1);
      tc.flame.material.color.copy(flameCol);
      if (tc.light) {
        tc.light.intensity = 14 * f;
        tc.light.color.copy(flameCol);
      }
    });
    this.candles.forEach((c) => {
      const f = 0.85 + Math.sin(t * 13 + c.base) * 0.08 + Math.random() * 0.07;
      c.flame.scale.set(0.1 * f, 0.17 * f, 1);
      c.flame.material.color.copy(flameCol);
    });
    this.candleLight.intensity = 5 * (0.85 + Math.random() * 0.15);
    this.candleLight.color.copy(flameCol);
    this.hemi.color.set("#8c7aa8").lerp(colA, 0.35);

    /* ayna ışığı + çerçeve parıltısı */
    this.mirrorLight.color.copy(colA).lerp(colB, 0.35);
    this.mirrorLight.intensity = 14 + Math.sin(t * 1.3) * 2;
    this.mirrorRim.material.color.copy(colA).lerp(colB, 0.5 + Math.sin(t * 0.8) * 0.3).multiplyScalar(1.6);

    /* kristal küre */
    this.orb.material.emissive.copy(colA).lerp(colB, 0.3);
    this.orb.material.emissiveIntensity = 0.5 + this.npcOn * 1.8 + Math.sin(t * 2) * 0.1;
    this.orbGlow.material.color.copy(colA).lerp(colB, 0.3);
    this.orbGlow.material.opacity = 0.35 + this.npcOn * 0.6;
    this.orbGlow.scale.setScalar(0.9 + this.npcOn * 0.8);

    /* karakterler */
    const sp = this.speaker ? this.chars.get(this.speaker) : null;
    const npcTalk = !!this.speaker && this.npcTarget > 0;
    const gazeAt = npcTalk
      ? this.npcSprite.position
      : sp
        ? sp.headPos
        : this.shot === "mirror"
          ? new THREE.Vector3(MIRROR.x, MIRROR.y, MIRROR.z)
          : new THREE.Vector3(0, TABLE_Y + 0.3, 0);
    this.chars.forEach((c) => {
      const talking = c === sp;
      c.talk = damp(c.talk, talking ? 1 : 0, 5, dt);
      c.mixer.update(dt);
      c.model.updateMatrixWorld(true);
      if (!c.busy) this.pose(c, t, gazeAt, talking);
      // baş konumu: koltuğa göre sabit (oturan poz); ayaktayken biraz yükselir
      c.headPos.copy(this.worldToGroup(c.root.localToWorld(new THREE.Vector3(0, c.busy ? 2.35 : 1.95, c.busy ? 0.35 : 0.08))));

      // portre madalyonu başın üstünde
      const s = 1 + c.talk * 0.22;
      c.medal.scale.set(0.62 * s, 0.775 * s, 1);
      c.medal.position.set(c.headPos.x, c.headPos.y + 0.95 + c.talk * 0.1, c.headPos.z);
      c.glow.position.copy(c.medal.position);
      c.glow.position.y += 0.08;
      const hide = c.seat.isGm ? this.npcOn : 0;
      c.medal.material.opacity = (0.68 + c.talk * 0.32) * (1 - hide);
      c.glow.material.opacity = (0.08 + c.talk * 0.7) * (1 - hide);
      c.glow.scale.setScalar(1.1 + c.talk * 0.5);
      c.medal.visible = !c.seat.isMe;
      c.glow.visible = !c.seat.isMe;
    });

    if (sp) {
      this.speakLight.position.lerp(new THREE.Vector3(sp.headPos.x * 0.85, sp.headPos.y + 1.2, sp.headPos.z * 0.85), 1 - Math.exp(-4 * dt));
      this.speakLight.color.set(sp.seat.color);
      this.speakLight.intensity = damp(this.speakLight.intensity, 7, 3, dt);
    } else this.speakLight.intensity = damp(this.speakLight.intensity, 0, 3, dt);

    /* NPC hologramı */
    this.npcOn = damp(this.npcOn, this.npcTarget, 4, dt);
    this.npcSprite.material.opacity = this.npcOn * (0.88 + Math.sin(t * 23) * 0.05 + (Math.random() < 0.03 ? -0.35 : 0));
    this.npcSprite.visible = this.npcOn > 0.01;
    this.npcSprite.position.y = TABLE_Y + 1.35 + Math.sin(t * 1.2) * 0.04;
    this.npcBeam.material.opacity = this.npcOn * 0.4;
    this.npcBeam.visible = this.npcOn > 0.01;
    this.npcBeam.rotation.y += dt * 0.7;

    /* zar */
    const r = this.rolling;
    if (r) {
      r.t = Math.min(1, r.t + dt / r.dur);
      const e = ease(r.t);
      const p = this.die.position;
      p.x = THREE.MathUtils.lerp(r.start.x, r.end.x, e);
      p.z = THREE.MathUtils.lerp(r.start.z, r.end.z, e);
      const hop = Math.abs(Math.sin(Math.PI * (r.t * 3.5 + 0.5))) * Math.pow(1 - r.t, 1.6);
      p.y = r.end.y + (r.start.y - r.end.y) * hop;
      this.die.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromAxisAngle(r.axis, r.spin * (1 - e)));
      if (r.t >= 1) {
        this.rolling = null;
        this.settlePulse = 1;
        r.done(p.clone());
      }
    }
    this.settlePulse = Math.max(0, this.settlePulse - dt * 0.4);
    const ds = damp(this.die.scale.x, this.dieShown ? DIE_S : 0.001, 8, dt);
    this.die.scale.setScalar(ds);
    this.die.visible = ds > 0.01;
    this.dieGlow.position.copy(this.die.position);
    this.dieGlow.material.color.copy(colB);
    this.dieGlow.material.opacity = (this.rolling ? 0.3 : 0) + this.settlePulse * 0.8;
    this.dieGlow.scale.setScalar(0.7 + this.settlePulse * 0.8);
  }

  dispose() {
    this.disposed = true;
    this.clearChars();
    this.npcSprite.material.map?.dispose();
    this.owned.forEach((o) => o.dispose());
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m === this.die) return; // geometri/malzeme PlayWorld'ün
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
  }

  /* ════════ yükleme ════════ */

  private async load() {
    const [tavern, anims] = await Promise.all([this.loader.loadAsync(BASE + "tavern.glb"), this.loader.loadAsync(BASE + "anims.glb")]);
    if (this.disposed) return;
    tavern.scene.children.forEach((c) => this.props.set(c.name, c));
    tavern.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.roughness = 0.82;
      mat.metalness = 0;
    });
    this.clips = anims.animations;
    this.buildRoom();
    this.buildTableTop();
  }

  private loadModel(id: ModelId) {
    let p = this.models.get(id);
    if (!p) {
      p = this.loader.loadAsync(`${BASE}${id}.glb`);
      this.models.set(id, p);
    }
    return p;
  }

  /** bir oda eşyasını yerleştir (geometri/malzeme paylaşılır) */
  private place(name: string, x: number, y: number, z: number, rotY = 0, s = 1, parent: THREE.Object3D = this.room) {
    const src = this.props.get(name);
    if (!src) return null;
    const o = src.clone(true);
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    o.scale.multiplyScalar(s);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = this.shadows;
        m.receiveShadow = this.shadows;
      }
    });
    parent.add(o);
    return o;
  }

  /* ── oda: zemin, duvarlar, sütunlar, meşaleler, eşyalar ── */
  private buildRoom() {
    const P = Math.PI;
    // zemin: ahşap döşeme, ortada koyu halı bölgesi
    for (let x = -8; x <= 8; x += 4)
      for (let z = -6; z <= 10; z += 4) this.place(Math.abs(x) <= 0 && z <= 2 ? "floor_wood_large_dark" : "floor_wood_large", x, 0, z);
    // arka duvar (aynanın arkası) ve yan duvarlar — biraz büyütülmüş, salon hissi
    const W = 1.25;
    [-7.5, -2.5, 2.5, 7.5].forEach((x) => this.place("wall", x, 0, -8, 0, W));
    [-5.5, -0.5, 4.5].forEach((z, i) => {
      this.place(i === 0 ? "wall_window_open" : i === 1 ? "wall_shelves" : "wall", -10, 0, z, P / 2, W);
      this.place(i === 0 ? "wall_arched" : "wall", 10, 0, z, -P / 2, W);
    });
    // köşe ve ek sütunlar
    [
      [-10, -8],
      [10, -8],
    ].forEach(([x, z]) => this.place("pillar", x, 0, z, 0, W));
    this.place("pillar_decorated", -4.35, 0, -7.35, 0, 1.05);
    this.place("pillar_decorated", 4.35, 0, -7.35, P, 1.05);
    // sancaklar aynanın iki yanında
    this.place("banner_patternA_red", -6.6, 0.9, -8.25, 0, 1.15);
    this.place("banner_patternA_red", 6.6, 0.9, -8.25, 0, 1.15);
    this.place("banner_thin_red", -9.25, 0.6, 1.8, P / 2, 1.1);
    this.place("banner_patternC_blue", 9.25, 0.6, 1.8, -P / 2, 1.1);
    // duvar süsleri
    this.place("sword_shield", 9.2, 2.2, -2.9, -P / 2, 1.1);
    this.place("keyring_hanging", -9.3, 2.4, 3.2, P / 2);
    // eşyalar: fıçılar, sandıklar, raflar
    this.place("keg_decorated", -8.2, 0, -6.4, P / 4, 0.95);
    this.place("barrel_large", 8.3, 0, -6.4, 0, 0.9);
    this.place("barrel_small_stack", 8.4, 0, -4.4, -0.4, 0.9);
    this.place("barrel_small", -8.6, 0, -3.9, 0.7);
    this.place("crates_stacked", 8.3, 0, 3.4, -P / 2, 1);
    this.place("box_stacked", -8.4, 0, 5.2, 0.3);
    this.place("chest_gold", -7.9, 0, -1.7, P / 2, 0.9);
    this.place("trunk_medium_A", 8.6, 0, 0.6, -P / 2);
    this.place("shelves", 9.45, 0, -0.2, -P / 2, 1.05);
    this.place("stool", -5.2, 0, 3.9, 0.4);
    this.place("stool", 5.4, 0, -4.9, 1.2);
    this.place("table_medium", 5.8, 0, -5.4, 0.3, 0.9);
    this.place("bottle_A_green", 5.6, 0.9, -5.5, 0, 0.8);
    this.place("bottle_B_brown", 6.1, 0.9, -5.2, 0, 0.8);
    this.place("candle_triple", 5.9, 0.9, -5.7, 0, 0.6);

    // meşaleler: arka duvarda aynanın iki yanı, yan duvarlarda
    const torch = (x: number, y: number, z: number, rot: number, light: boolean) => {
      const o = this.place("torch_mounted", x, y, z, rot, 1.2);
      if (!o) return;
      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.flameTex, color: "#ffb45a", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      const tip = new THREE.Vector3(0, 0.62, 0.36).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).multiplyScalar(1.2);
      flame.position.set(x + tip.x, y + tip.y, z + tip.z);
      this.room.add(flame);
      let pl: THREE.PointLight | null = null;
      if (light) {
        pl = new THREE.PointLight("#ff9a45", 14, 10, 1.7);
        pl.position.copy(flame.position).add(new THREE.Vector3(0, 0.1, 0).add(tip.clone().setLength(0.4)));
        this.room.add(pl);
      }
      this.torches.push({ light: pl, flame, base: Math.random() * 10 });
    };
    torch(-5.3, 2.4, -7.45, 0, true);
    torch(5.3, 2.4, -7.45, 0, true);
    torch(-9.45, 2.4, -2.9, P / 2, true);
    torch(9.45, 2.4, 1.9, -P / 2, false);
    torch(-9.45, 2.4, 6.5, P / 2, false);

    // tavan: koyu ahşap + kirişler — odayı kapatır
    const wood = new THREE.MeshStandardMaterial({ color: "#3a2415", roughness: 0.9 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshStandardMaterial({ color: "#1a110b", roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 5.35, 1);
    this.room.add(ceil);
    for (let z = -7; z <= 9; z += 3.2) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.42, 0.5), wood);
      beam.position.set(0, 5.1, z);
      beam.castShadow = this.shadows;
      this.room.add(beam);
    }
    [-4.2, 4.2].forEach((x) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 18), wood);
      beam.position.set(x, 4.85, 1);
      this.room.add(beam);
    });

    // avize: masanın üstünde zincirle asılı, mumlu demir halka
    const iron = new THREE.MeshStandardMaterial({ color: "#2b2622", metalness: 0.7, roughness: 0.5 });
    const chand = new THREE.Group();
    chand.position.set(0, 4.5, 0.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 8, 48), iron);
    ring.rotation.x = Math.PI / 2;
    chand.add(ring);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6), iron);
      chain.position.set(Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.62);
      chain.rotation.z = Math.cos(a) * 0.6;
      chain.rotation.x = -Math.sin(a) * 0.6;
      chand.add(chain);
    }
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), iron);
    drop.position.y = 0.75;
    drop.scale.y = 0.2;
    chand.add(drop);
    this.room.add(chand);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 0.85;
      const z = Math.sin(a) * 0.85 + 0.6;
      this.place("candle_thin_lit", x, 4.53, z, 0, 0.3);
      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.flameTex, color: "#ffb45a", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      flame.position.set(x, 4.53 + 0.34, z);
      this.room.add(flame);
      this.candles.push({ flame, base: Math.random() * 10 });
    }
  }

  /* ── masa ve üstü ── */
  private buildTableTop() {
    const P = Math.PI;
    this.place("table_long", 0, 0, 0, 0, 1);
    // harita parşömeni masanın ortasında
    const map = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 1.8),
      new THREE.MeshStandardMaterial({ map: this.mapTexture(), roughness: 0.9 })
    );
    map.rotation.x = -P / 2;
    map.rotation.z = 0.06;
    map.position.set(0.05, TABLE_Y + 0.004, -0.05);
    map.receiveShadow = this.shadows;
    this.room.add(map);
    // mumlar
    const candle = (x: number, z: number, name: string, s: number, flameY: number) => {
      this.place(name, x, TABLE_Y, z, Math.random() * 3, s);
      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.flameTex, color: "#ffb45a", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      flame.position.set(x, TABLE_Y + flameY, z);
      this.room.add(flame);
      this.candles.push({ flame, base: Math.random() * 10 });
    };
    candle(0.62, -1.35, "candle_lit", 0.38, 0.42);
    candle(-0.66, 1.2, "candle_thin_lit", 0.42, 0.47);
    this.place("candle_melted", -0.7, TABLE_Y, -1.6, 0, 0.35);
    this.place("coin_stack_medium", 0.7, TABLE_Y, 0.85, 0.3, 0.45);
    this.place("coin_stack_small", 0.55, TABLE_Y, 1.05, 1, 0.45);
    this.place("bottle_A_labeled_brown", -0.72, TABLE_Y, -0.35, 0, 0.5);
    this.place("plate_food_A", 0.62, TABLE_Y, 0.15, 0.4, 0.55);
    this.place("spellbook_closed", -0.55, TABLE_Y, 0.55, 0.5, 0.55);
  }

  private buildSeats(list: Seat[], token: number) {
    const P = Math.PI;
    const gm = list.find((s) => s.isGm);
    const me = list.find((s) => s.isMe);
    const others = list.filter((s) => s !== gm && s !== me);
    const L = Math.ceil(others.length / 2);
    const R = others.length - L;
    const spots = (n: number) => (n === 1 ? [-0.1] : Array.from({ length: n }, (_, i) => -1.05 + (2.1 * i) / Math.max(1, n - 1)));
    const place: [Seat, number, number, number][] = [];
    if (me) place.push([me, 0, HEAD_Z, P]);
    if (gm) place.push([gm, 0, -HEAD_Z, 0]);
    spots(L).forEach((z, i) => place.push([others[i], -SIDE_X, z, P / 2]));
    spots(R).forEach((z, i) => place.push([others[L + i], SIDE_X, z, -P / 2]));

    const used = new Set(list.map((s) => s.model).filter(Boolean) as ModelId[]);
    const pool: ModelId[] = ["knight", "mage", "rogue", "rogue_hooded", "barbarian"].filter((m) => !used.has(m as ModelId)) as ModelId[];

    place.forEach(([seat, x, z, rot]) => {
      const model = seat.model ?? (seat.isGm ? "barbarian" : pool.shift() ?? "rogue");
      const root = new THREE.Group();
      root.position.set(x, 0, z);
      root.rotation.y = rot; // kökün +z'si masaya bakar
      this.people.add(root);
      // karakter modeli +z'ye bakar; KayKit sandalyesi -z'ye → sandalyeyi çevir
      this.place("chair", 0, 0, 0, Math.PI, 1, root);
      // karakter kâğıdı + kupa masada, önünde
      this.addSheet(root, seat);

      this.loadModel(model).then((gltf) => {
        if (token !== this.seatToken || this.disposed) return;
        const m = cloneSkinned(gltf.scene);
        m.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = this.shadows;
            mesh.receiveShadow = this.shadows;
            mesh.frustumCulled = false;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.roughness = 0.75;
            mat.metalness = 0;
          }
        });
        root.add(m);
        const mixer = new THREE.AnimationMixer(m);
        const names = new Set<string>();
        m.traverse((o) => names.add(o.name));
        const actions: Record<string, THREE.AnimationAction> = {};
        this.clips.forEach((clip) => {
          // bu modelde olmayan kemiklere giden izleri at (uyarı spam'i olmasın)
          const c = clip.clone();
          c.tracks = c.tracks.filter((tr) => names.has(tr.name.split(".")[0]));
          actions[clip.name] = mixer.clipAction(c);
        });
        const find = (n: string) => m.getObjectByName(n) ?? null;
        const ch: Char = {
          seat,
          root,
          model: m,
          mixer,
          actions,
          current: null,
          head: find("head"),
          chest: find("chest"),
          armR: find("upperarm.r"),
          handR: find("hand.r"),
          medal: new THREE.Sprite(
            new THREE.SpriteMaterial({ map: this.medalTexture(seat.avatar, seat.face, seat.color, seat.name, false), transparent: true, depthWrite: false })
          ),
          glow: new THREE.Sprite(
            new THREE.SpriteMaterial({ map: this.glowTex, color: seat.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })
          ),
          talk: 0,
          yaw: 0,
          phase: Math.random() * 10,
          busy: false,
          headPos: new THREE.Vector3(x, 2.2, z),
        };
        ch.medal.renderOrder = 5;
        ch.glow.renderOrder = 4;
        this.group.add(ch.glow, ch.medal);
        const idle = actions.Sit_Chair_Idle;
        if (idle) {
          idle.time = Math.random() * idle.getClip().duration;
          idle.timeScale = 0.85 + Math.random() * 0.3;
        }
        this.play(ch, "Sit_Chair_Idle", { fade: 0 });
        this.chars.set(seat.id, ch);
      });
    });
  }

  private play(ch: Char, name: string, o: { once?: boolean; fade?: number } = {}) {
    const next = ch.actions[name];
    if (!next) return;
    const fade = o.fade ?? 0.3;
    next.reset();
    next.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, o.once ? 1 : Infinity);
    next.clampWhenFinished = !!o.once;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (ch.current && ch.current !== next) ch.current.crossFadeTo(next, fade, false);
    ch.current = next;
  }

  /** animasyonun üstüne: konuşurken el kol hareketi, başını konuşana çevirme */
  private pose(c: Char, t: number, gazeAt: THREE.Vector3, talking: boolean) {
    const k = c.talk;
    if (c.head) {
      const local = c.root.worldToLocal(this.group.localToWorld(gazeAt.clone()));
      const target = talking ? 0 : THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
      c.yaw += (target - c.yaw) * 0.08;
      c.head.rotation.y += c.yaw * 0.75;
      c.head.rotation.x += Math.sin(t * 8.5 + c.phase) * 0.07 * k - 0.04 * k;
    }
    if (c.chest) {
      c.chest.rotation.y += c.yaw * 0.25 + Math.sin(t * 2.2 + c.phase) * 0.1 * k;
      c.chest.rotation.x += 0.12 * k;
    }
    if (c.armR) c.armR.rotation.x -= (0.55 + Math.sin(t * 3.1 + c.phase) * 0.35) * k;
  }

  private async throwDie(value: number, start: THREE.Vector3) {
    const toward = new THREE.Vector3(-start.x, 0, -start.z).normalize();
    const end = new THREE.Vector3(start.x, 0, start.z).multiplyScalar(0.25).add(toward.multiplyScalar(0.3));
    end.x = THREE.MathUtils.clamp(end.x + (Math.random() - 0.5) * 0.4, -0.7, 0.7);
    end.z = THREE.MathUtils.clamp(end.z + (Math.random() - 0.5) * 0.5, -1.5, 1.5);
    end.y = TABLE_Y + DIE_S * 0.795;
    const f = Math.max(0, Math.min(19, value - 1));
    const qn = new THREE.Quaternion().setFromUnitVectors(this.faceNormals[f], new THREE.Vector3(0, 1, 0));
    // rakamın üstü kameradan (masanın +z başı) uzağa baksın → düz okunur
    const upDir = this.faceUps[f].clone().applyQuaternion(qn);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - Math.atan2(upDir.x, upDir.z));
    const q = qy.multiply(qn);
    this.die.position.copy(start);
    return new Promise<THREE.Vector3>((resolve) => {
      this.rolling = {
        start,
        end,
        q,
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        spin: Math.PI * (5 + Math.random() * 3),
        t: 0,
        dur: 1.6,
        done: resolve,
      };
      this.dieShown = 1;
    });
  }

  private worldToGroup(v: THREE.Vector3) {
    return this.group.worldToLocal(v);
  }

  private clearChars() {
    this.chars.forEach((c) => {
      c.mixer.stopAllAction();
      c.medal.material.map?.dispose();
      c.medal.material.dispose();
      c.glow.material.dispose();
      c.medal.removeFromParent();
      c.glow.removeFromParent();
    });
    this.chars.clear();
    // koltuk kökleri (sandalye/kâğıt kopyaları geometriyi paylaşır — yalnızca kâğıt dokusu kendine ait)
    this.people.children.slice().forEach((r) => {
      r.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.userData.ownTex) (m.material as THREE.MeshStandardMaterial).map?.dispose();
      });
      r.removeFromParent();
    });
  }

  private addSheet(root: THREE.Group, seat: Seat) {
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.4),
      new THREE.MeshStandardMaterial({ map: this.sheetTexture(seat.color), roughness: 0.9 })
    );
    sheet.userData.ownTex = true;
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = (Math.random() - 0.5) * 0.5;
    sheet.position.set(-0.2, TABLE_Y + 0.005, 0.72);
    sheet.receiveShadow = this.shadows;
    root.add(sheet);
    if (seat.isGm) this.addScreen(root);
    else this.place("mug_full", 0.3, TABLE_Y, 0.62, Math.random() * 3, 0.45, root);
  }

  private addScreen(root: THREE.Group) {
    const tex = this.screenTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1 });
    const back = new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.8 });
    [-1, 0, 1].forEach((i) => {
      // ön yüz (+z) oyunculara bakar: malzeme sırası px,nx,py,ny,pz,nz
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.025), [back, back, back, back, mat, back]);
      const a = -i * 0.45;
      p.position.set(i * 0.47, TABLE_Y + 0.21, 0.78 - Math.abs(i) * 0.1);
      p.rotation.y = a;
      p.castShadow = this.shadows;
      root.add(p);
    });
  }

  private computeFaces(geo: THREE.BufferGeometry) {
    const pos = geo.getAttribute("position");
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let f = 0; f < pos.count / 3; f++) {
      a.fromBufferAttribute(pos, f * 3);
      b.fromBufferAttribute(pos, f * 3 + 1);
      c.fromBufferAttribute(pos, f * 3 + 2);
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      const centroid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
      this.faceNormals.push(n);
      this.faceUps.push(a.clone().sub(centroid).normalize());
    }
  }

  /* ════════ doku üreticiler ════════ */

  private canvas(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")!] as const;
  }
  private tex(c: HTMLCanvasElement, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  private radialCanvas(size: number, stops: [number, string][]) {
    const [c, g] = this.canvas(size, size);
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    const t = this.tex(c, false);
    this.owned.push(t);
    return t;
  }
  private beamAlpha() {
    const [c, g] = this.canvas(8, 128);
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, "#000");
    grd.addColorStop(0.5, "#555");
    grd.addColorStop(1, "#fff");
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 128);
    const t = this.tex(c, false);
    this.owned.push(t);
    return t;
  }

  /** elle çizilmiş gibi bir diyar haritası */
  private mapTexture() {
    const [c, g] = this.canvas(640, 920);
    const grd = g.createRadialGradient(320, 460, 60, 320, 460, 560);
    grd.addColorStop(0, "#efdfb8");
    grd.addColorStop(1, "#b8955c");
    g.fillStyle = grd;
    g.fillRect(0, 0, 640, 920);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(90,60,25,${Math.random() * 0.07})`;
      g.fillRect(Math.random() * 640, Math.random() * 920, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
    g.strokeStyle = "rgba(70,45,20,0.75)";
    g.lineWidth = 3;
    const blob = (cx: number, cy: number, r: number) => {
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.18) {
        const rr = r * (0.75 + 0.25 * Math.sin(a * 3 + cx) + Math.random() * 0.12);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 1.2;
        if (a === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = "rgba(160,125,70,0.35)";
      g.fill();
      g.stroke();
    };
    blob(250, 300, 150);
    blob(420, 620, 130);
    blob(170, 700, 70);
    // dağlar
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = 180 + Math.random() * 160;
      const y = 250 + Math.random() * 120;
      g.beginPath();
      g.moveTo(x - 14, y + 10);
      g.lineTo(x, y - 12);
      g.lineTo(x + 14, y + 10);
      g.stroke();
    }
    // kesikli rota
    g.setLineDash([10, 10]);
    g.strokeStyle = "rgba(150,30,30,0.85)";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(230, 330);
    g.bezierCurveTo(330, 420, 280, 520, 420, 600);
    g.stroke();
    g.setLineDash([]);
    g.font = "700 46px serif";
    g.fillStyle = "rgba(150,30,30,0.9)";
    g.fillText("✕", 405, 620);
    // pusula gülü
    g.translate(520, 150);
    g.strokeStyle = "rgba(70,45,20,0.8)";
    g.beginPath();
    g.arc(0, 0, 44, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.beginPath();
      g.moveTo(0, -60);
      g.lineTo(9, 0);
      g.lineTo(-9, 0);
      g.closePath();
      g.fillStyle = i % 2 ? "rgba(70,45,20,0.8)" : "rgba(150,30,30,0.8)";
      g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const t = this.tex(c);
    this.owned.push(t);
    return t;
  }

  private sheetTexture(color: string) {
    const [c, g] = this.canvas(256, 340);
    g.fillStyle = "#e8dcc0";
    g.fillRect(0, 0, 256, 340);
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 28);
    g.strokeStyle = "rgba(60,40,20,0.45)";
    g.lineWidth = 2;
    for (let y = 60; y < 320; y += 22) {
      g.beginPath();
      g.moveTo(20, y);
      g.lineTo(20 + 120 + Math.random() * 100, y);
      g.stroke();
    }
    g.strokeRect(160, 44, 76, 76);
    return this.tex(c);
  }

  private screenTexture() {
    const [c, g] = this.canvas(256, 216);
    const grd = g.createLinearGradient(0, 0, 0, 216);
    grd.addColorStop(0, "#4a2a16");
    grd.addColorStop(1, "#1e0f07");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 216);
    g.strokeStyle = "#d8b45a";
    g.lineWidth = 6;
    g.strokeRect(10, 10, 236, 196);
    g.lineWidth = 2;
    g.strokeRect(22, 22, 212, 172);
    g.fillStyle = "#d8b45a";
    g.font = "700 76px Cinzel, Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("⚜", 128, 112);
    const t = this.tex(c);
    this.owned.push(t);
    return t;
  }

  /** portre madalyonu: yuvarlak portre + renk halkası + isim */
  private medalTexture(avatar: string | undefined, face: string, color: string, name: string, holo: boolean) {
    const [c, g] = this.canvas(256, 320);
    const t = this.tex(c);
    const draw = (img?: HTMLImageElement) => {
      g.clearRect(0, 0, 256, 320);
      g.save();
      g.beginPath();
      g.arc(128, 118, 100, 0, Math.PI * 2);
      g.closePath();
      g.clip();
      const bg = g.createRadialGradient(128, 90, 10, 128, 118, 110);
      bg.addColorStop(0, "#2a2140");
      bg.addColorStop(1, "#0a0812");
      g.fillStyle = bg;
      g.fillRect(0, 0, 256, 256);
      if (img) {
        const s = Math.max(200 / img.width, 200 / img.height);
        g.drawImage(img, 128 - (img.width * s) / 2, 118 - (img.height * s) / 2, img.width * s, img.height * s);
      } else {
        g.font = "110px serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(face, 128, 124);
      }
      if (holo) {
        g.fillStyle = "rgba(160,200,255,0.10)";
        for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 256, 1.5);
      }
      g.restore();
      g.lineWidth = 9;
      g.strokeStyle = color;
      g.shadowColor = color;
      g.shadowBlur = 18;
      g.beginPath();
      g.arc(128, 118, 102, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
      g.lineWidth = 2;
      g.strokeStyle = "rgba(255,240,200,0.6)";
      g.beginPath();
      g.arc(128, 118, 110, 0, Math.PI * 2);
      g.stroke();
      g.font = "700 30px Cinzel, Georgia, serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      let label = name;
      while (g.measureText(label).width > 236 && label.length > 3) label = label.slice(0, -2);
      if (label !== name) label += "…";
      const w = Math.min(248, g.measureText(label).width + 34);
      g.fillStyle = "rgba(8,6,14,0.85)";
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(128 - w / 2, 250, w, 46, 23);
      g.fill();
      g.stroke();
      g.fillStyle = "#f6e8c3";
      g.fillText(label, 128, 274);
      t.needsUpdate = true;
    };
    draw();
    if (avatar) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = avatar;
    }
    return t;
  }
}
