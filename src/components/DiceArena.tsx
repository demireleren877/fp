import { useEffect, useId, useRef, useState } from "react";
import DiceBox, { type DieResult } from "@3d-dice/dice-box";
import {
  MATS,
  DICE_KEYS,
  savedMat,
  savedPhysics,
  savedDesign,
  type DicePhysics,
  type DiceDesign,
} from "../data/dicePresets";
import DicePresetLab from "./DicePresetLab";

type Readout = { text: string; cls: "" | "crit" | "fail" };

/**
 * Hero'daki gerçek 3D zar arenası.
 * Özgün "büyü çemberi" matı (SVG) + dice-box (Babylon + ammo fizik).
 * Zar tuvali çuha alanına oturur → kenarlar fizik duvarı, zar dışarı taşmaz.
 *
 * `lab` açıkken tahtanın sağ üstünde açılır preset popup'ı gelir; seçim
 * `updateConfig` ve atış anındaki `themeColor` ile canlı uygulanır.
 */
export default function DiceArena({ lab = false }: { lab?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const canvasId = `dice-arena-${uid}`;
  const boxRef = useRef<DiceBox | null>(null);
  const [ready, setReady] = useState(false);
  const [out, setOut] = useState<Readout>({ text: "yükleniyor…", cls: "" });
  const [matId, setMatId] = useState<string>(() => savedMat().id);
  const mat = MATS.find((m) => m.id === matId) ?? MATS[0];
  const pickMat = (id: string) => {
    setMatId(id);
    try {
      localStorage.setItem(DICE_KEYS.mat, id);
    } catch {
      /* yoksay */
    }
  };

  // seçili preset'ler — atış anında taze okumak için ref'te (kaydedilmişten başla)
  const presetRef = useRef<{ physics: DicePhysics; design: DiceDesign }>({
    physics: savedPhysics(),
    design: savedDesign(),
  });

  useEffect(() => {
    let disposed = false;
    // setTimeout(0) → StrictMode'un mount/unmount/mount çiftinde yalnızca son
    // mount gerçekten başlatır; çift canvas/çift fizik dünyası oluşmaz.
    const t = window.setTimeout(() => {
      if (disposed) return;
      const { physics, design } = presetRef.current;
      const box = new DiceBox({
        container: `#${canvasId}`,
        assetPath: "/assets/dice-box/",
        theme: "default",
        themeColor: design.themeColor,
        ...design.config,
        ...physics.config,
      });
      boxRef.current = box;

      box
        .init()
        .then(() => {
          if (disposed) return;
          setReady(true);
          setOut({ text: "zar seni bekliyor", cls: "" });
          box.onRollComplete = (results: DieResult[]) => {
            const v = results?.[0]?.value ?? 0;
            if (v === 20) setOut({ text: "★ Doğal 20 — Kritik Başarı!", cls: "crit" });
            else if (v === 1) setOut({ text: "✷ Doğal 1 — Kritik Başarısızlık!", cls: "fail" });
            else setOut({ text: `${v} attın`, cls: "" });
          };
        })
        .catch((e: unknown) => {
          console.error(e);
          if (!disposed) setOut({ text: "zar yüklenemedi", cls: "" });
        });
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(t);
      try {
        boxRef.current?.clear();
      } catch {
        /* yoksay */
      }
      document.getElementById(canvasId)?.querySelectorAll("canvas").forEach((c) => c.remove());
      boxRef.current = null;
    };
  }, [canvasId]);

  const roll = () => {
    if (!ready || !boxRef.current) return;
    const { design: d, physics: p } = presetRef.current;
    setOut({ text: "kader dönüyor…", cls: "" });
    boxRef.current.updateConfig({ themeColor: d.themeColor, ...d.config, ...p.config });
    boxRef.current.roll("1d20", { themeColor: d.themeColor });
  };

  return (
    <div className="arena">
      <div className="arena-stage">
        <img className="arena-mat" src={mat.src} alt="" aria-hidden="true" />
        <div
          id={canvasId}
          className="arena-canvas"
          role="button"
          tabIndex={0}
          aria-label="Zar at"
          onClick={roll}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && roll()}
        />
        {lab && (
          <DicePresetLab
            onChange={(physics, design) => {
              presetRef.current = { physics, design };
            }}
            mats={MATS}
            matId={matId}
            onMat={pickMat}
          />
        )}
      </div>
      <div className={`arena-readout ${out.cls}`}>{out.text}</div>
      <button className="dice-cta" onClick={roll} disabled={!ready}>
        🎲 Zar At
      </button>
    </div>
  );
}
