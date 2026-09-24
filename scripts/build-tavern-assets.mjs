// KayKit (CC0) varlıklarını web için hazırlar: silah ayıklama, animasyonları tek
// dosyaya toplama, WebP doku, meshopt sıkıştırma, sahne eşyalarını tek pakette birleştirme.
//
// Tek seferlik araç — çıktısı public/assets/tavern altında depoda. Yeniden üretmek için:
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 <SP>/assets/...
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0     <SP>/assets/...
//   npm i -D @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer sharp
//   SP=<klasör> PROPS=floor_wood_large,wall,... node scripts/build-tavern-assets.mjs public/assets/tavern
// (PROPS listesi Tavern.ts'in kullandığı parça adlarıdır; SP, iki paketin klonlandığı "assets" klasörünün üstü.)
import fs from "fs";
import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, resample, textureCompress, meshopt, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

// animasyonu örnekleyici ve kanallarıyla birlikte tamamen sil (aksi hâlde veri kalır)
const killAnim = (a) => {
  a.listChannels().forEach((c) => c.dispose());
  // veri (accessor) diğer kliplerle ortak olabilir — prune() sahipsizleri temizler
  a.listSamplers().forEach((s) => s.dispose());
  a.dispose();
};

const SP = process.env.SP ? path.resolve(process.env.SP) : path.resolve(import.meta.dirname, "..");
const CH = `${SP}/assets/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures`;
const DG = `${SP}/assets/KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf`;
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const compress = (size) => [
  dedup(),
  prune(),
  weld(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size], quality: 88 }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
];

const KEEP_ITEMS = new Set(["Mug"]);
const ANIMS = ["Sit_Chair_Idle", "Sit_Chair_StandUp", "Sit_Chair_Down", "Throw", "Cheer", "Hit_A", "Idle"];

/* ── karakterler: animasyonsuz, silahsız ── */
for (const name of ["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"]) {
  const doc = await io.read(`${CH}/Characters/gltf/${name}.glb`);
  const root = doc.getRoot();
  root.listAnimations().forEach(killAnim);
  for (const n of root.listNodes()) {
    if (!/handslot/.test(n.getName())) continue;
    for (const c of n.listChildren()) if (!KEEP_ITEMS.has(c.getName())) c.dispose();
  }
  await doc.transform(...compress(512));
  const file = `${OUT}/${name.toLowerCase()}.glb`;
  await io.write(file, doc);
  console.log(file, (fs.statSync(file).size / 1024).toFixed(0) + "KB");
}

/* ── ortak animasyon seti (aynı iskelet — isimle bağlanır) ── */
{
  const doc = await io.read(`${CH}/Characters/gltf/Knight.glb`);
  const root = doc.getRoot();
  root.listAnimations().forEach((a) => !ANIMS.includes(a.getName()) && killAnim(a));
  root.listNodes().forEach((n) => n.setMesh(null));
  root.listSkins().forEach((s) => s.dispose());
  root.listMaterials().forEach((m) => m.dispose());
  root.listTextures().forEach((t) => t.dispose());
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const file = `${OUT}/anims.glb`;
  await io.write(file, doc);
  console.log(file, (fs.statSync(file).size / 1024).toFixed(0) + "KB", root.listAnimations().map((a) => a.getName()).join(","));
}

/* ── taverna eşyaları: tek dosya, her parça isimli kök düğüm ── */
{
  const props = (process.env.PROPS || "").split(",").filter(Boolean);
  const extra = { mug_full: `${CH}/Assets/gltf/mug_full.gltf`, spellbook_open: `${CH}/Assets/gltf/spellbook_open.gltf`, spellbook_closed: `${CH}/Assets/gltf/spellbook_closed.gltf` };
  const target = await io.read(`${DG}/${props[0]}.gltf.glb`);
  const scene = target.getRoot().listScenes()[0];
  const nameRoot = (doc, nm) => {
    // kaynak sahnenin kökünü tek bir isimli düğüm altında topla
    const sc = doc.getRoot().listScenes().at(-1);
    const g = doc.createNode(nm);
    sc.listChildren().forEach((c) => {
      sc.removeChild(c);
      g.addChild(c);
    });
    scene.addChild(g);
    if (sc !== scene) sc.dispose();
  };
  nameRoot(target, props[0]);
  for (const p of props.slice(1)) {
    const src = extra[p] ?? (fs.existsSync(`${DG}/${p}.gltf.glb`) ? `${DG}/${p}.gltf.glb` : `${DG}/${p}.glb`);
    const doc = await io.read(src);
    mergeDocuments(target, doc);
    nameRoot(target, p);
  }
  await target.transform(unpartition(), ...compress(1024));
  const file = `${OUT}/tavern.glb`;
  await io.write(file, target);
  console.log(file, (fs.statSync(file).size / 1024).toFixed(0) + "KB", scene.listChildren().length, "parça");
}
