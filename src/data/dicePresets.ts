import type { DiceBoxConfig } from "@3d-dice/dice-box";

/**
 * Zar demosu için hazır ayar setleri.
 * - FİZİK: zarın masada nasıl davrandığı (ağırlık, sekme, dönüş, yerçekimi…).
 * - TASARIM: zarın nasıl göründüğü (renk, boyut, ışık, gölge).
 * İkisi bağımsız seçilir; DiceArena bunları `updateConfig` + atış anında
 * `themeColor` ile canlı uygular — sayfa/motor yeniden yüklenmez.
 */

export type DicePhysics = {
  id: string;
  label: string;
  hint: string;
  /** dice-box fizik parametreleri (kısmi config) */
  config: Pick<
    DiceBoxConfig,
    | "gravity"
    | "mass"
    | "friction"
    | "restitution"
    | "linearDamping"
    | "angularDamping"
    | "spinForce"
    | "throwForce"
    | "settleTimeout"
  >;
};

export type DiceDesign = {
  id: string;
  label: string;
  hint: string;
  themeColor: string;
  config: Pick<DiceBoxConfig, "scale" | "lightIntensity" | "shadowTransparency" | "enableShadows">;
};

export const PHYSICS_PRESETS: DicePhysics[] = [
  {
    id: "klasik",
    label: "Klasik",
    hint: "Dengeli masa hissi — bizim varsayılanımız.",
    config: {
      gravity: 1,
      mass: 1,
      friction: 0.8,
      restitution: 0,
      linearDamping: 0.5,
      angularDamping: 0.4,
      spinForce: 6,
      throwForce: 5,
      settleTimeout: 5000,
    },
  },
  {
    id: "magrur",
    label: "Ağır & Mağrur",
    hint: "Taş gibi ağır, neredeyse hiç sekmez, ağırdan dener — dramatik.",
    config: {
      gravity: 0.85,
      mass: 3,
      friction: 0.95,
      restitution: 0,
      linearDamping: 0.65,
      angularDamping: 0.55,
      spinForce: 4,
      throwForce: 4,
      settleTimeout: 6500,
    },
  },
  {
    id: "ay",
    label: "Ay Çekimi",
    hint: "Tüy gibi, düşük yerçekimi; uzun uzun süzülüp savrulur.",
    config: {
      gravity: 0.3,
      mass: 0.6,
      friction: 0.5,
      restitution: 0.4,
      linearDamping: 0.3,
      angularDamping: 0.2,
      spinForce: 8,
      throwForce: 6,
      settleTimeout: 7500,
    },
  },
  {
    id: "zipzip",
    label: "Zıpzıp",
    hint: "Enerjik, yüksek sekme; masada keyifle zıplar.",
    config: {
      gravity: 1.2,
      mass: 1,
      friction: 0.4,
      restitution: 0.6,
      linearDamping: 0.4,
      angularDamping: 0.3,
      spinForce: 9,
      throwForce: 8,
      settleTimeout: 5500,
    },
  },
  {
    id: "sert",
    label: "Sert & Hızlı",
    hint: "Sert fırlatır, anında oturur; sabırsızlar için.",
    config: {
      gravity: 1.5,
      mass: 1.2,
      friction: 0.95,
      restitution: 0.1,
      linearDamping: 0.7,
      angularDamping: 0.6,
      spinForce: 10,
      throwForce: 9,
      settleTimeout: 3000,
    },
  },
];

export const DESIGN_PRESETS: DiceDesign[] = [
  {
    id: "altin",
    label: "Altın",
    hint: "Kanalın imza altını — sıcak, parıltılı.",
    themeColor: "#d8b45a",
    config: { scale: 8, lightIntensity: 1.25, shadowTransparency: 0.55, enableShadows: true },
  },
  {
    id: "mor",
    label: "Mor Büyü",
    hint: "Büyü çemberi moru; gizemli, soğuk parıltı.",
    themeColor: "#9b6fd0",
    config: { scale: 8, lightIntensity: 1.4, shadowTransparency: 0.5, enableShadows: true },
  },
  {
    id: "bordo",
    label: "Bordo Kan",
    hint: "Koyu bordo; ağır gölgeli, tehditkâr.",
    themeColor: "#b23148",
    config: { scale: 8, lightIntensity: 1.1, shadowTransparency: 0.62, enableShadows: true },
  },
  {
    id: "obsidyen",
    label: "Obsidyen",
    hint: "Gece karası; sert ışık, derin gölge.",
    themeColor: "#3a3550",
    config: { scale: 8, lightIntensity: 1.65, shadowTransparency: 0.72, enableShadows: true },
  },
  {
    id: "kemik",
    label: "Kemik",
    hint: "Fildişi/kemik; eski okul, mat ve sade.",
    themeColor: "#e8e2cf",
    config: { scale: 8, lightIntensity: 1.2, shadowTransparency: 0.45, enableShadows: true },
  },
  {
    id: "dev",
    label: "Dev Altın",
    hint: "Aynı altın ama kocaman — sahneyi dolduran zar.",
    themeColor: "#d8b45a",
    config: { scale: 11, lightIntensity: 1.3, shadowTransparency: 0.55, enableShadows: true },
  },
];
