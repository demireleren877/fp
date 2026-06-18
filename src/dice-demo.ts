import DiceBox from "@3d-dice/dice-box";

/**
 * Gerçekçi 3D zar demosu — @3d-dice/dice-box (Babylon + ammo fizik).
 * Masaya atılan, sekip yuvarlanan, sonucu okunan altın D20.
 */
const box = new DiceBox({
  container: "#tray",
  assetPath: "/assets/dice-box/",
  theme: "default",
  themeColor: "#d8b45a", // altın
  scale: 5,
  enableShadows: true,
  shadowTransparency: 0.55,
  lightIntensity: 1.25,
});

const readout = document.getElementById("readout") as HTMLDivElement;
const btn = document.getElementById("roll") as HTMLButtonElement;

let ready = false;

function show(text: string, cls: "" | "crit" | "fail" = "") {
  readout.textContent = text;
  readout.className = cls;
}

box
  .init()
  .then(() => {
    ready = true;
    btn.disabled = false;
    show("zar seni bekliyor");

    box.onRollComplete = (results: Array<{ value: number }>) => {
      const v = results?.[0]?.value ?? 0;
      btn.disabled = false;
      if (v === 20) show("★ Doğal 20 — Kritik Başarı!", "crit");
      else if (v === 1) show("✷ Doğal 1 — Kritik Başarısızlık!", "fail");
      else show(`${v} geldi`);
    };
  })
  .catch((err: unknown) => {
    console.error(err);
    show("zar yüklenemedi — konsola bak");
  });

btn.addEventListener("click", () => {
  if (!ready) return;
  btn.disabled = true;
  show("kader dönüyor…");
  box.roll("1d20");
});
