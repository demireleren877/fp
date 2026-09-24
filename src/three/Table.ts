import * as THREE from "three";

/**
 * Oyun masası — oyun adımında 3D dünyanın merkezi.
 *
 * Yuvarlak ahşap masa, çuha, mumlar, karakter kâğıtları ve anlatıcının
 * paravanı. Etrafında kukuletalı figürler oturur (her birinin üstünde
 * portre madalyonu). Oyuncunun kendisi kameradır — kendi koltuğundan bakar.
 *
 * - Konuşan figür öne eğilir, madalyonu büyüyüp parlar, üstüne renkli ışık
 *   düşer; diğerleri başını ona çevirir.
 * - Anlatıcının seslendirdiği NPC'ler masanın ortasında hologram olarak belirir.
 * - `roll(value, from)`: D20 atanın koltuğundan masaya fırlar, sekip yuvarlanır
 *   ve istenen yüz yukarı bakacak şekilde durur.
 */

export type Seat = {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  face: string;
  isGm?: boolean;
  isMe?: boolean;
};
export type NpcCard = { name: string; color: string; avatar?: string; face: string } | null;

export const TABLE_Y = 1.0;
const TABLE_R = 2.5;
const SEAT_R = 3.3;
const DIE_S = 0.26;

type SeatObj = {
  seat: Seat;
  root: THREE.Group;
  body?: THREE.Group;
  head?: THREE.Group;
  eyes?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>[];
  medal?: THREE.Sprite;
  glow?: THREE.Sprite;
  headPos: THREE.Vector3;
  handPos: THREE.Vector3;
  blinkAt: number;
  talk: number;
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

export class TableScene {
  group = new THREE.Group();
  private figures = new THREE.Group();
  private seats = new Map<string, SeatObj>();
  private speaker: string | null = null;
  private owned: { dispose: () => void }[] = [];
  private shadows: boolean;

  private candles: { flame: THREE.Sprite; base: number }[] = [];
  private candleLight: THREE.PointLight;
  private lamp: THREE.PointLight;
  private key: THREE.SpotLight;
  private speakLight: THREE.PointLight;
  private feltMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;

  private npcSprite: THREE.Sprite;
  private npcBeam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private npcKey = "";
  private npcOn = 0;
  private npcTarget = 0;

  private die: THREE.Mesh;
  private dieGlow: THREE.Sprite;
  private rolling: Roll | null = null;
  private dieShown = 0;
  private settlePulse = 0;
  private faceNormals: THREE.Vector3[] = [];
  private faceUps: THREE.Vector3[] = [];

  private glowTex: THREE.Texture;

  constructor(opts: { shadows: boolean; dieGeo: THREE.BufferGeometry; dieMat: THREE.Material; glowTex: THREE.Texture }) {
    this.shadows = opts.shadows;
    this.glowTex = opts.glowTex;
    this.group.visible = false;
    this.group.add(this.figures);

    /* ── zemin ── */
    const floorAlpha = this.radialCanvas(512, [
      [0, "#ffffff"],
      [0.45, "#9a9a9a"],
      [1, "#000000"],
    ]);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(13, 64),
      new THREE.MeshStandardMaterial({ color: "#120f19", roughness: 0.92, metalness: 0.05, alphaMap: floorAlpha, transparent: true })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = this.shadows;
    this.group.add(floor);

    /* ── masa ── */
    const wood = this.woodTexture();
    const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.08, color: "#8a6a4a" });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - 0.04, 0.12, 72), woodMat);
    top.position.y = TABLE_Y - 0.06;
    top.castShadow = top.receiveShadow = this.shadows;
    this.group.add(top);
    this.rimMat = new THREE.MeshStandardMaterial({ color: "#c9a24e", metalness: 0.95, roughness: 0.3 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, 0.045, 12, 120), this.rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = TABLE_Y;
    this.group.add(rim);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, TABLE_Y - 0.12, 24), woodMat);
    ped.position.y = (TABLE_Y - 0.12) / 2;
    ped.castShadow = this.shadows;
    this.group.add(ped);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.08, 32), woodMat);
    foot.position.y = 0.04;
    this.group.add(foot);

    /* çuha (zar matı) — halka: kenarda ahşap şerit kalır */
    this.feltMat = new THREE.MeshStandardMaterial({ color: "#1c2a24", roughness: 0.95, metalness: 0 });
    const felt = new THREE.Mesh(new THREE.CircleGeometry(TABLE_R - 0.32, 72), this.feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = TABLE_Y + 0.002;
    felt.receiveShadow = this.shadows;
    this.group.add(felt);
    const feltEdge = new THREE.Mesh(
      new THREE.RingGeometry(TABLE_R - 0.34, TABLE_R - 0.3, 96),
      new THREE.MeshStandardMaterial({ color: "#c9a24e", metalness: 0.9, roughness: 0.35 })
    );
    feltEdge.rotation.x = -Math.PI / 2;
    feltEdge.position.y = TABLE_Y + 0.004;
    this.group.add(feltEdge);

    /* ── mumlar ── */
    const flameTex = this.radialCanvas(128, [
      [0, "rgba(255,255,255,1)"],
      [0.25, "rgba(255,220,150,0.8)"],
      [1, "rgba(255,120,40,0)"],
    ]);
    const candleMat = new THREE.MeshStandardMaterial({ color: "#e9dcc0", roughness: 0.7, emissive: "#3a2a10", emissiveIntensity: 0.4 });
    [
      [2.35, 1.9, 0.26],
      [0.75, 1.95, 0.2],
      [-2.2, 1.55, 0.32],
    ].forEach(([ang, r, h]) => {
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, h, 12), candleMat);
      c.position.set(x, TABLE_Y + h / 2, z);
      c.castShadow = this.shadows;
      this.group.add(c);
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.02, 20), this.rimMat);
      dish.position.set(x, TABLE_Y + 0.01, z);
      this.group.add(dish);
      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: flameTex, color: "#ffc070", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      flame.position.set(x, TABLE_Y + h + 0.07, z);
      flame.scale.set(0.12, 0.2, 1);
      this.group.add(flame);
      this.candles.push({ flame, base: Math.random() * 10 });
    });
    this.candleLight = new THREE.PointLight("#ffb060", 4, 6, 1.8);
    this.candleLight.position.set(0, TABLE_Y + 0.6, 0.4);
    this.group.add(this.candleLight);

    /* ── ışıklar: tavan lambası + gölge atan anahtar ışık + konuşmacı ışığı ── */
    this.lamp = new THREE.PointLight("#ffd9a0", 10, 9, 1.6);
    this.lamp.position.set(0, 3.6, 0);
    this.group.add(this.lamp);
    this.key = new THREE.SpotLight("#fff0d8", 55, 16, 0.75, 0.6, 1.4);
    this.key.position.set(0.6, 7, 2.2);
    this.key.target.position.set(0, TABLE_Y, -0.6);
    this.key.castShadow = this.shadows;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0006;
    this.key.shadow.radius = 4;
    this.group.add(this.key, this.key.target);
    this.speakLight = new THREE.PointLight("#ffffff", 0, 3.2, 1.5);
    this.group.add(this.speakLight);

    /* ── NPC hologramı (masanın ortasında) ── */
    this.npcSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    this.npcSprite.position.set(0, TABLE_Y + 1.55, -0.3);
    this.npcSprite.scale.set(1.25, 1.56, 1);
    this.group.add(this.npcSprite);
    this.npcBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.9, 1.3, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#5fe6d2",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaMap: this.beamAlpha(),
      })
    );
    this.npcBeam.position.set(0, TABLE_Y + 0.85, -0.3);
    this.npcBeam.scale.set(1, 1.3, 1);
    this.group.add(this.npcBeam);

    /* ── atılan zar ── */
    this.die = new THREE.Mesh(opts.dieGeo, opts.dieMat);
    this.die.scale.setScalar(0.001);
    this.die.castShadow = this.shadows;
    this.group.add(this.die);
    this.dieGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })
    );
    this.dieGlow.scale.setScalar(1.4);
    this.group.add(this.dieGlow);
    this.computeFaces(opts.dieGeo);
  }

  /* ════════ API ════════ */

  setSeats(list: Seat[]) {
    this.clearSeats();
    const gm = list.find((s) => s.isGm);
    const me = list.find((s) => s.isMe);
    const others = list.filter((s) => s !== gm && s !== me);
    const L = Math.ceil(others.length / 2);
    const R = others.length - L;
    const spread = (n: number, a: number, b: number, one: number) =>
      n === 1 ? [one] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));
    const leftAngles = spread(L, 160, 235, 205);
    const rightAngles = spread(R, 15, -55, -25);
    const place: [Seat, number][] = [];
    if (me) place.push([me, 90]);
    if (gm) place.push([gm, 270]);
    others.forEach((s, i) => place.push([s, i < L ? leftAngles[i] : rightAngles[i - L]]));

    place.forEach(([seat, deg]) => {
      const a = THREE.MathUtils.degToRad(deg);
      const pos = new THREE.Vector3(Math.cos(a) * SEAT_R, 0, Math.sin(a) * SEAT_R);
      const root = new THREE.Group();
      root.position.copy(pos);
      root.rotation.y = Math.atan2(-pos.x, -pos.z);
      this.figures.add(root);
      const obj: SeatObj = {
        seat,
        root,
        headPos: new THREE.Vector3(),
        handPos: new THREE.Vector3(),
        blinkAt: 2 + Math.random() * 4,
        talk: 0,
      };
      this.addSheet(root, seat);
      if (seat.isMe) {
        obj.headPos.set(0, 2.6, 4.9);
        obj.handPos.set(0.25, TABLE_Y + 0.55, SEAT_R - 0.9);
      } else {
        this.buildFigure(obj);
        if (seat.isGm) this.addScreen(root);
        // masa grubunun kendi uzayında (grup giriş animasyonunda aşağıda olabilir)
        this.group.updateMatrixWorld(true);
        this.group.worldToLocal(obj.head!.getWorldPosition(obj.headPos));
        obj.handPos.copy(this.group.worldToLocal(root.localToWorld(new THREE.Vector3(0.2, TABLE_Y + 0.35, 0.85))));
        this.buildMedal(obj);
      }
      this.seats.set(seat.id, obj);
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

  /** zar atan koltuktan masaya D20 fırlat; istenen yüz yukarı bakar */
  roll(value: number, fromId: string): Promise<THREE.Vector3> {
    this.rolling?.done(this.die.position.clone());
    const from = this.seats.get(fromId);
    const start = from ? from.handPos.clone() : new THREE.Vector3(0, TABLE_Y + 0.6, 1.8);
    start.y = Math.max(start.y, TABLE_Y + 0.45);
    // masanın ortasına doğru, atana biraz yakın bir noktaya düşer
    const toward = new THREE.Vector3(-start.x, 0, -start.z).normalize();
    const end = new THREE.Vector3(start.x, 0, start.z).multiplyScalar(0.18).add(toward.multiplyScalar(0.25));
    end.x += (Math.random() - 0.5) * 0.6;
    end.z += (Math.random() - 0.5) * 0.4;
    if (end.length() > 1.4) end.setLength(1.4);
    end.y = TABLE_Y + DIE_S * 0.795;

    const f = Math.max(0, Math.min(19, value - 1));
    const qn = new THREE.Quaternion().setFromUnitVectors(this.faceNormals[f], new THREE.Vector3(0, 1, 0));
    // rakamın "üstü" kameradan uzağa baksın → düz okunur
    const upDir = this.faceUps[f].clone().applyQuaternion(qn);
    const phi = Math.atan2(upDir.x, upDir.z);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - phi);
    const q = qy.multiply(qn);

    return new Promise((resolve) => {
      this.rolling = {
        start,
        end,
        q,
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        spin: Math.PI * (5 + Math.random() * 3),
        t: 0,
        dur: 1.75,
        done: resolve,
      };
      this.dieShown = 1;
    });
  }

  /** kameranın bakacağı yer: yuvarlanan zar > konuşmacı */
  focus(): { pos: THREE.Vector3; kind: "die" | "speaker" } | null {
    if (this.rolling || this.settlePulse > 0.2) return { pos: this.diePosition, kind: "die" };
    const s = this.speaker ? this.seats.get(this.speaker) : null;
    if (s && !s.seat.isMe) return { pos: this.group.localToWorld(s.headPos.clone()), kind: "speaker" };
    return null;
  }
  get diePosition() {
    return this.group.localToWorld(this.die.position.clone());
  }

  update(dt: number, t: number, colA: THREE.Color, colB: THREE.Color, active: boolean, cyber: number) {
    this.group.visible = active;
    if (!active) return;

    /* ambiyans: çuha rengi, pirinç kenar */
    this.feltMat.color.setRGB(0.07, 0.1, 0.09).lerp(new THREE.Color(0.02, 0.06, 0.09), cyber);
    this.feltMat.emissive.copy(colA).multiplyScalar(0.05);

    /* mumlar */
    const flick = 0.8 + Math.sin(t * 11.3) * 0.06 + Math.sin(t * 7.1 + 1) * 0.08 + Math.random() * 0.06;
    this.candles.forEach((c) => {
      const f = 0.85 + Math.sin(t * 13 + c.base) * 0.08 + Math.random() * 0.07;
      c.flame.scale.set(0.12 * f, 0.21 * f, 1);
      c.flame.material.color.set("#ffc070").lerp(colB, 0.35 + cyber * 0.4);
    });
    this.candleLight.intensity = 4 * flick;
    this.candleLight.color.set("#ffb060").lerp(colB, 0.3 + cyber * 0.4);
    this.lamp.color.set("#ffd9a0").lerp(colA, 0.25 + cyber * 0.45);
    this.rimMat.emissive.copy(colB).multiplyScalar(0.06);

    /* figürler */
    const sp = this.speaker ? this.seats.get(this.speaker) : null;
    const lookAt = sp ? sp.headPos : new THREE.Vector3(0, TABLE_Y, 0);
    this.seats.forEach((o) => {
      const talking = o === sp ? 1 : 0;
      o.talk = damp(o.talk, talking, 5, dt);
      if (o.body && o.head) {
        o.body.rotation.x = o.talk * 0.16 + Math.sin(t * 1.3 + o.blinkAt) * 0.012;
        o.body.scale.y = 1 + Math.sin(t * 1.6 + o.blinkAt * 3) * 0.012 + (talking ? Math.abs(Math.sin(t * 9)) * 0.012 : 0);
        // başını konuşana çevir (kendisi konuşuyorsa masaya baksın)
        const target = o === sp ? new THREE.Vector3(0, TABLE_Y + 0.4, 0) : lookAt;
        const local = o.root.worldToLocal(target.clone());
        const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
        o.head.rotation.y = damp(o.head.rotation.y, yaw, 3, dt);
        o.head.rotation.x = damp(o.head.rotation.x, o === sp ? 0.15 : -0.05, 3, dt);
        // göz kırpma
        o.blinkAt -= dt;
        const blink = o.blinkAt < 0 && o.blinkAt > -0.12;
        if (o.blinkAt < -0.12) o.blinkAt = 2.5 + Math.random() * 4;
        o.eyes?.forEach((e) => {
          e.scale.y = blink ? 0.15 : 1;
          e.material.emissiveIntensity = 1.6 + o.talk * 2.5;
        });
      }
      if (o.medal && o.glow) {
        const s = 1 + o.talk * 0.22;
        o.medal.scale.set(0.78 * s, 0.975 * s, 1);
        o.medal.position.y = o.headPos.y + 0.78 + o.talk * 0.12 + Math.sin(t * 1.4 + o.blinkAt) * 0.03;
        o.glow.position.copy(o.medal.position);
        o.glow.position.y += 0.1;
        o.glow.material.opacity = 0.12 + o.talk * 0.7;
        o.glow.scale.setScalar(1.3 + o.talk * 0.5);
        // anlatıcı bir NPC'yi seslendirirken kendi madalyonu söner, sahne hologramındır
        const hide = o.seat.isGm ? this.npcOn : 0;
        o.medal.material.opacity = (0.72 + o.talk * 0.28) * (1 - hide);
        o.glow.material.opacity *= 1 - hide;
      }
    });
    if (sp && !sp.seat.isMe) {
      this.speakLight.position.lerp(new THREE.Vector3(sp.headPos.x * 0.8, 2.9, sp.headPos.z * 0.8), 1 - Math.exp(-4 * dt));
      this.speakLight.color.set(sp.seat.color);
      this.speakLight.intensity = damp(this.speakLight.intensity, 9, 3, dt);
    } else {
      this.speakLight.intensity = damp(this.speakLight.intensity, 0, 3, dt);
    }

    /* NPC hologramı */
    this.npcOn = damp(this.npcOn, this.npcTarget, 4, dt);
    const holo = this.npcOn * (0.85 + Math.sin(t * 23) * 0.05 + (Math.random() < 0.03 ? -0.3 : 0));
    this.npcSprite.material.opacity = holo;
    this.npcSprite.visible = this.npcOn > 0.01;
    this.npcSprite.position.y = TABLE_Y + 1.75 + Math.sin(t * 1.2) * 0.05;
    this.npcBeam.material.opacity = this.npcOn * 0.35;
    this.npcBeam.visible = this.npcOn > 0.01;
    this.npcBeam.rotation.y += dt * 0.6;

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
      const spinQ = new THREE.Quaternion().setFromAxisAngle(r.axis, r.spin * (1 - e));
      this.die.quaternion.copy(r.q).multiply(spinQ);
      if (r.t >= 1) {
        this.rolling = null;
        this.settlePulse = 1;
        r.done(p.clone());
      }
    }
    this.settlePulse = Math.max(0, this.settlePulse - dt * 0.45);
    const ds = damp(this.die.scale.x, this.dieShown ? DIE_S : 0.001, 8, dt);
    this.die.scale.setScalar(ds);
    this.die.visible = ds > 0.01;
    this.dieGlow.position.copy(this.die.position);
    this.dieGlow.material.color.copy(colB);
    this.dieGlow.material.opacity = (this.rolling ? 0.35 : 0) + this.settlePulse * 0.9;
    this.dieGlow.scale.setScalar(0.9 + this.settlePulse * 0.9);
  }

  dispose() {
    this.clearSeats();
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

  /* ════════ yapım ════════ */

  private clearSeats() {
    this.seats.forEach((o) => {
      o.root.traverse((c) => {
        const m = c as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        });
      });
      o.root.removeFromParent();
      if (o.medal) {
        o.medal.material.map?.dispose();
        o.medal.material.dispose();
        o.medal.removeFromParent();
      }
      if (o.glow) {
        o.glow.material.dispose();
        o.glow.removeFromParent();
      }
    });
    this.seats.clear();
  }

  private buildFigure(o: SeatObj) {
    const col = new THREE.Color(o.seat.color);
    const cloth = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#18141f").lerp(col, 0.12),
      roughness: 0.82,
      metalness: 0.05,
    });
    const dark = new THREE.MeshStandardMaterial({ color: "#050408", roughness: 1 });
    const accent = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.35 });
    const chairMat = new THREE.MeshStandardMaterial({ color: "#2b1d14", roughness: 0.7 });
    const cast = (m: THREE.Mesh) => {
      m.castShadow = this.shadows;
      m.receiveShadow = this.shadows;
      return m;
    };

    /* sandalye */
    const chair = new THREE.Group();
    const seatBox = cast(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.62), chairMat));
    seatBox.position.set(0, 0.5, -0.05);
    const back = cast(new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.05, 0.07), chairMat));
    back.position.set(0, 1.02, -0.36);
    chair.add(seatBox, back);
    [
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.2],
      [0.3, 0.2],
    ].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), chairMat);
      leg.position.set(x, 0.25, z);
      chair.add(leg);
    });
    o.root.add(chair);

    /* gövde — pelerin (lathe) */
    const body = new THREE.Group();
    body.position.set(0, 0.52, 0);
    // bel → göğüs → omuz → boyun: insan silueti veren pelerin profili
    const prof = [
      [0, 0],
      [0.4, 0],
      [0.37, 0.22],
      [0.31, 0.48],
      [0.35, 0.7],
      [0.37, 0.8],
      [0.3, 0.9],
      [0.13, 0.97],
      [0.09, 1.04],
      [0, 1.05],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const cloak = cast(new THREE.Mesh(new THREE.LatheGeometry(prof, 28), cloth));
    cloak.scale.set(1, 1, 0.82);
    body.add(cloak);
    // omuz yakası — kimlik rengi
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 28), accent);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.97;
    body.add(collar);
    // kollar: omuzdan dirseğe iner, önkol masaya uzanır, eller masada durur
    const skin = new THREE.MeshStandardMaterial({ color: "#b99176", roughness: 0.65 });
    const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
      const len = a.distanceTo(b);
      const m = cast(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10), cloth));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return m;
    };
    [-1, 1].forEach((sgn) => {
      const shoulder = new THREE.Vector3(sgn * 0.33, 0.8, 0.02);
      const elbow = new THREE.Vector3(sgn * 0.4, 0.46, 0.2);
      const wrist = new THREE.Vector3(sgn * 0.2, 0.52, 0.66);
      body.add(limb(shoulder, elbow, 0.085), limb(elbow, wrist, 0.075));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skin);
      hand.scale.set(1, 0.6, 1.3);
      hand.position.copy(wrist).add(new THREE.Vector3(0, -0.02, 0.07));
      body.add(hand);
    });

    /* baş — kukuleta + gölgeli yüz + parlayan gözler */
    const head = new THREE.Group();
    head.position.set(0, 1.27, 0.03);
    const hood = cast(new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 18), cloth));
    hood.scale.set(1, 1.12, 1.02);
    // kukuletanın arkaya sarkan kısmı
    const hoodBack = cast(new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), cloth));
    hoodBack.position.set(0, -0.06, -0.12);
    hoodBack.scale.set(1.05, 1.1, 1);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), dark);
    face.position.set(0, -0.03, 0.12);
    face.scale.set(1, 1.05, 0.8);
    head.add(hood, hoodBack, face);
    const eyes: SeatObj["eyes"] = [];
    [-1, 1].forEach((sgn) => {
      const e = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 10, 8),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6 })
      );
      e.position.set(sgn * 0.07, 0.0, 0.265);
      head.add(e);
      eyes.push(e);
    });
    body.add(head);
    if (o.seat.isGm) {
      // anlatıcıya küçük bir taç halkası
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 6), accent);
      crown.rotation.x = Math.PI / 2 - 0.25;
      crown.position.set(0, 0.24, 0.02);
      head.add(crown);
      body.scale.setScalar(1.08);
    }
    o.root.add(body);
    o.body = body;
    o.head = head;
    o.eyes = eyes;
  }

  private addSheet(root: THREE.Group, seat: Seat) {
    const tex = this.sheetTexture(seat.color);
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.46),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = (Math.random() - 0.5) * 0.4;
    sheet.position.set(seat.isMe ? -0.35 : -0.15, TABLE_Y + 0.006, 1.2);
    sheet.receiveShadow = this.shadows;
    root.add(sheet);
    // koltuğun önünde küçük renkli bir d6
    const d6 = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshStandardMaterial({ color: seat.color, roughness: 0.35, metalness: 0.2 })
    );
    d6.position.set(0.3, TABLE_Y + 0.045, 1.08);
    d6.rotation.y = Math.random() * 3;
    d6.castShadow = this.shadows;
    root.add(d6);
  }

  private addScreen(root: THREE.Group) {
    const tex = this.screenTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 });
    const back = new THREE.MeshStandardMaterial({ color: "#1e140c", roughness: 0.8 });
    [-1, 0, 1].forEach((i) => {
      // ön yüz (+z) oyunculara bakar: malzeme sırası px,nx,py,ny,pz,nz
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.02), [back, back, back, back, mat, back]);
      const a = i * 0.5;
      p.position.set(Math.sin(a) * 0.52, TABLE_Y + 0.21, 1.02 + Math.cos(a) * 0.08 - Math.abs(i) * 0.16);
      p.rotation.y = a;
      p.castShadow = this.shadows;
      root.add(p);
    });
  }

  private buildMedal(o: SeatObj) {
    const map = this.medalTexture(o.seat.avatar, o.seat.face, o.seat.color, o.seat.name, false);
    const medal = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    medal.position.copy(o.headPos).add(new THREE.Vector3(0, 0.78, 0));
    medal.renderOrder = 5;
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, color: o.seat.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })
    );
    glow.renderOrder = 4;
    this.group.add(glow, medal);
    o.medal = medal;
    o.glow = glow;
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
      // rakamın üstü = 0. köşe yönü (atlas UV'sinde tepe köşe)
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
    grd.addColorStop(0.6, "#444");
    grd.addColorStop(1, "#fff");
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 128);
    const t = this.tex(c, false);
    this.owned.push(t);
    return t;
  }

  private woodTexture() {
    const [c, g] = this.canvas(1024, 1024);
    g.fillStyle = "#6b4a2e";
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 520; i++) {
      const y = Math.random() * 1024;
      const amp = 4 + Math.random() * 14;
      const fr = 0.004 + Math.random() * 0.01;
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? "30,18,8" : "150,105,65"},${0.05 + Math.random() * 0.12})`;
      g.lineWidth = 0.6 + Math.random() * 2.4;
      g.beginPath();
      for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y + Math.sin(x * fr + i) * amp);
      g.stroke();
    }
    // tahta birleşimleri
    g.strokeStyle = "rgba(15,8,3,0.5)";
    g.lineWidth = 3;
    for (let x = 128; x < 1024; x += 170) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 1024);
      g.stroke();
    }
    const t = this.tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
    const [c, g] = this.canvas(256, 208);
    const grd = g.createLinearGradient(0, 0, 0, 208);
    grd.addColorStop(0, "#3a2414");
    grd.addColorStop(1, "#1a0f08");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 208);
    g.strokeStyle = "#d8b45a";
    g.lineWidth = 5;
    g.strokeRect(10, 10, 236, 188);
    g.lineWidth = 2;
    g.strokeRect(20, 20, 216, 168);
    g.fillStyle = "#d8b45a";
    g.font = "700 72px Cinzel, Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("✦", 128, 104);
    const t = this.tex(c);
    this.owned.push(t);
    return t;
  }

  /** portre madalyonu: yuvarlak portre + renk halkası + isim */
  private medalTexture(avatar: string | undefined, face: string, color: string, name: string, holo: boolean) {
    const [c, g] = this.canvas(256, 320);
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
        g.fillStyle = "rgba(95,230,210,0.10)";
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
      // isim plakası
      g.font = "700 30px Cinzel, Georgia, serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      let label = name;
      while (g.measureText(label).width > 236 && label.length > 3) label = label.slice(0, -2);
      if (label !== name) label += "…";
      const w = Math.min(248, g.measureText(label).width + 34);
      g.fillStyle = "rgba(8,6,14,0.82)";
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
    const t = this.tex(c);
    draw();
    if (avatar) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = avatar;
    }
    return t;
  }
}
