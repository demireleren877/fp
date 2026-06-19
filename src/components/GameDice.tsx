import { useEffect, useId, useRef, useState } from "react";
import DiceBox, { type DieResult } from "@3d-dice/dice-box";
import { savedPhysics, savedDesign, savedMat } from "../data/dicePresets";

type Readout = { text: string; cls: "" | "crit" | "fail" };

const defaultInterpret = (v: number): Readout =>
  v === 20
    ? { text: "★ Doğal 20 — Kritik Başarı!", cls: "crit" }
    : v === 1
      ? { text: "✷ Doğal 1 — Kritik Başarısızlık!", cls: "fail" }
      : { text: `${v} attın`, cls: "" };

/**
 * Oyun içi gerçek 3D zar — ana sayfadaki DiceArena ile aynı dice-box motoru,
 * ama atış sonucunu (`onResult`) dışarı verir; senaryo başarı/başarısızlığı
 * bu değere göre belirlenir. Sonuç okuması `interpret` ile özelleştirilebilir.
 */
export default function GameDice({
  onResult,
  interpret = defaultInterpret,
}: {
  onResult: (v: number) => void;
  interpret?: (v: number) => Readout;
}) {
  const uid = useId().replace(/:/g, "");
  const canvasId = `game-dice-${uid}`;
  const boxRef = useRef<DiceBox | null>(null);
  // taze closure: init bir kez çalışır, callback'ler her render değişebilir
  const cb = useRef(onResult);
  cb.current = onResult;
  const interp = useRef(interpret);
  interp.current = interpret;
  // ana sayfada seçilip localStorage'a yazılmış fizik + tasarım + mat — oyun içinde de aynısı
  const presetRef = useRef({ physics: savedPhysics(), design: savedDesign() });
  const mat = savedMat();

  const [ready, setReady] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [out, setOut] = useState<Readout>({ text: "yükleniyor…", cls: "" });

  useEffect(() => {
    let disposed = false;
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
            setRolled(true);
            setOut(interp.current(v));
            cb.current(v);
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
    if (!ready || rolled || !boxRef.current) return;
    const { design: d, physics: p } = presetRef.current;
    setOut({ text: "kader dönüyor…", cls: "" });
    boxRef.current.updateConfig({ themeColor: d.themeColor, ...d.config, ...p.config });
    boxRef.current.roll("1d20", { themeColor: d.themeColor });
  };

  return (
    <div className="arena compact">
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
      </div>
      <div className={`arena-readout ${out.cls}`}>{out.text}</div>
      {!rolled && (
        <button className="dice-cta" onClick={roll} disabled={!ready}>
          🎲 Zar At
        </button>
      )}
    </div>
  );
}
