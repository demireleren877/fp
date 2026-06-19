import { useEffect, useRef, useState } from "react";
import {
  PHYSICS_PRESETS,
  DESIGN_PRESETS,
  type DicePhysics,
  type DiceDesign,
} from "../data/dicePresets";

/**
 * Tahtanın sağ üstünde açılır-kapanır zar ayar popup'ı.
 * Fizik + tasarım preset'lerini seçtirir; her seçimde `onChange` ile
 * güncel ikiliyi yukarı verir. Dışarı tıklama / Esc ile kapanır.
 * Hem hero arenasında (DiceArena) hem oyun içi zarda (GameDice) kullanılır.
 */
/** seçilebilir mat tasarımı — opsiyonel, yalnızca hero arenasında gösterilir */
export type MatOption = { id: string; label: string; src: string };

const lsGet = (k: string, fallback: string) => {
  try {
    return localStorage.getItem(k) || fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* yoksay */
  }
};

export default function DicePresetLab({
  onChange,
  mats,
  matId,
  onMat,
}: {
  onChange: (physics: DicePhysics, design: DiceDesign) => void;
  mats?: readonly MatOption[];
  matId?: string;
  onMat?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [physId, setPhysId] = useState(() => lsGet("fp:dice:phys", PHYSICS_PRESETS[0].id));
  const [designId, setDesignId] = useState(() => lsGet("fp:dice:design", DESIGN_PRESETS[0].id));
  const labRef = useRef<HTMLDivElement | null>(null);

  const physics = PHYSICS_PRESETS.find((p) => p.id === physId) ?? PHYSICS_PRESETS[0];
  const design = DESIGN_PRESETS.find((d) => d.id === designId) ?? DESIGN_PRESETS[0];

  // seçim değiştikçe güncel ikiliyi yukarı bildir (ilk mount dahil) + localStorage'a yaz
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    cb.current(physics, design);
    lsSet("fp:dice:phys", physics.id);
    lsSet("fp:dice:design", design.id);
  }, [physics, design]);

  // popup açıkken: dışarı tıklama veya Esc kapatır
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (labRef.current && !labRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dice-lab" ref={labRef}>
      <button
        type="button"
        className={`dice-lab-toggle ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-label="Zar ayarları"
        title="Zar ayarları"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "✕" : "⚙"}
      </button>

      {open && (
        <div className="dice-lab-popup" role="dialog" aria-label="Zar ayarları">
          {mats && matId && onMat && (
            <div className="dice-lab-group">
              <span className="dice-lab-label">Mat</span>
              <div className="dice-lab-chips">
                {mats.map((m) => (
                  <button
                    key={m.id}
                    className={`dice-chip ${m.id === matId ? "is-on" : ""}`}
                    onClick={() => onMat(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dice-lab-group">
            <span className="dice-lab-label">Fizik</span>
            <div className="dice-lab-chips">
              {PHYSICS_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`dice-chip ${p.id === physId ? "is-on" : ""}`}
                  onClick={() => setPhysId(p.id)}
                  title={p.hint}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dice-lab-group">
            <span className="dice-lab-label">Tasarım</span>
            <div className="dice-lab-chips">
              {DESIGN_PRESETS.map((d) => (
                <button
                  key={d.id}
                  className={`dice-chip ${d.id === designId ? "is-on" : ""}`}
                  onClick={() => setDesignId(d.id)}
                  title={d.hint}
                >
                  <span className="dice-chip-dot" style={{ background: d.themeColor }} />
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <p className="dice-lab-hint">
            <b>{physics.label}:</b> {physics.hint}
            <br />
            <b>{design.label}:</b> {design.hint}
          </p>
        </div>
      )}
    </div>
  );
}
