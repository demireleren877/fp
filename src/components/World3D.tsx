import { useEffect, useRef } from "react";
import type { PlayWorld, WorldAmb, WorldArt, WorldMood, WorldStep } from "../three/PlayWorld";

export type WorldBurst = { n: number; kind: "crit" | "fail" } | null;

/**
 * PlayWorld (three.js) için ince React sarmalayıcısı. three yalnızca oyun
 * açıldığında dinamik olarak yüklenir → ana sayfa paketine eklenmez.
 * WebGL başlatılamazsa `onFail` çağrılır; oyun DOM atmosferine düşer.
 */
export default function World3D({
  step,
  amb,
  mood,
  art,
  accent,
  kick,
  burst,
  onFail,
  onReady,
}: {
  step: WorldStep;
  amb: WorldAmb;
  mood: WorldMood;
  art: WorldArt;
  accent: string | null;
  kick: number;
  burst: WorldBurst;
  onFail: () => void;
  /** masa/zar gibi emir kipli çağrılar için dünya örneği (dağılınca null) */
  onReady?: (world: PlayWorld | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<PlayWorld | null>(null);
  // dünya yüklenmeden gelen son durum — hazır olunca tek seferde uygulanır
  const latest = useRef({ step, amb, mood, art, accent });
  latest.current = { step, amb, mood, art, accent };
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    let disposed = false;
    let world: PlayWorld | null = null;
    import("../three/PlayWorld")
      .then(({ PlayWorld }) => {
        if (disposed || !hostRef.current) return;
        try {
          world = new PlayWorld(hostRef.current);
        } catch (e) {
          console.warn("3D dünya başlatılamadı, DOM atmosferine düşülüyor", e);
          failRef.current();
          return;
        }
        const s = latest.current;
        world.setAmbiance(s.amb);
        world.setMood(s.mood);
        world.setAccent(s.accent);
        world.setStep(s.step);
        world.setArt(s.art);
        worldRef.current = world;
        hostRef.current.classList.add("is-ready");
        readyRef.current?.(world);
      })
      .catch(() => failRef.current());
    return () => {
      disposed = true;
      if (world) readyRef.current?.(null);
      world?.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => worldRef.current?.setStep(step), [step]);
  useEffect(() => worldRef.current?.setAmbiance(amb), [amb]);
  useEffect(() => worldRef.current?.setMood(mood), [mood]);
  useEffect(() => worldRef.current?.setAccent(accent), [accent]);
  useEffect(() => worldRef.current?.setArt(art), [art]);
  useEffect(() => {
    if (kick) worldRef.current?.kick();
  }, [kick]);
  useEffect(() => {
    if (burst) worldRef.current?.burst(burst.kind);
  }, [burst]);

  return <div className="world3d" ref={hostRef} aria-hidden="true" />;
}
