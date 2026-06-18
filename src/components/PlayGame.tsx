import { useEffect, useMemo, useRef, useState } from "react";
import type { Series } from "../data/series";
import GameDice from "./GameDice";
import {
  scenariosForSeries,
  hasScenarios,
  type Scenario,
  type PlayCharacter,
} from "../data/scenarios";

type Step = "series" | "character" | "episode" | "play";

/* karakter renk paleti — sahnede konuşanları ayırt etmek için */
const CHAR_COLORS = ["#d8b45a", "#9b6fd0", "#5fd0a8", "#e8884c", "#6f9bd0", "#b23148"];

/* eğlenceli konuşmacı yüzü — karakterde face yoksa role'den türet */
const FACE_BY_ROLE: Record<string, string> = {
  Büyücü: "🧙",
  Savaşçı: "⚔️",
  Hırsız: "🗡️",
  "Oyun Yöneticisi": "🎲",
};
const deriveFace = (role?: string) => (role && FACE_BY_ROLE[role]) || "🎭";
const faceOfChar = (c?: { face?: string; role?: string }) => c?.face ?? deriveFace(c?.role);

const NARRATOR = { name: "Anlatıcı", face: "🎲", color: "#caa84e" };

function Avatar({
  face,
  color,
  me = false,
  size = 40,
}: {
  face: string;
  color: string;
  me?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`pg-avatar ${me ? "me" : ""}`}
      style={{ ["--ac" as string]: color, width: size, height: size, fontSize: size * 0.52 }}
      aria-hidden="true"
    >
      {face}
    </span>
  );
}

export default function PlayGame({
  series,
  open,
  onClose,
}: {
  series: Series[];
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("series");
  const [seriesId, setSeriesId] = useState("");
  const [charId, setCharId] = useState("");
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // sayfa açıkken arka planı kilitle + ESC ile çık + tarayıcı "geri" desteği
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const activeSeries = series.find((s) => s.id === seriesId);
  const episodes = seriesId ? scenariosForSeries(seriesId) : [];
  const roster: PlayCharacter[] =
    (seriesId && episodes[0]?.characters.filter((c) => c.id !== "gm" && !c.npc)) || [];
  const activeChar = roster.find((c) => c.id === charId);
  const charColor = (id: string) => {
    const all = episodes[0]?.characters ?? [];
    if (id === "gm") return "#caa84e";
    const i = all.findIndex((c) => c.id === id);
    return CHAR_COLORS[(i < 0 ? 0 : i) % CHAR_COLORS.length];
  };
  const faceOf = (id: string) =>
    faceOfChar((episodes[0]?.characters ?? []).find((c) => c.id === id));

  const crumb = (s: Step) => {
    const order: Step[] = ["series", "character", "episode", "play"];
    return order.indexOf(s) <= order.indexOf(step);
  };

  return (
    <div className="playpage">
      {/* ── üst çubuk ── */}
      <header className="playpage-top">
        <button
          className="playpage-back"
          onClick={() => {
            if (step === "play") setStep("episode");
            else if (step === "episode") setStep("character");
            else if (step === "character") setStep("series");
            else onClose();
          }}
        >
          ‹ {step === "series" ? "Siteye dön" : "Geri"}
        </button>

        <nav className="playpage-crumbs" aria-label="Adımlar">
          {(
            [
              ["series", "Seri", activeSeries?.title],
              ["character", "Karakter", activeChar?.name],
              ["episode", "Bölüm", scenario ? `Bölüm ${scenario.episode}` : undefined],
            ] as const
          ).map(([key, label, value]) => (
            <span key={key} className={`crumb ${crumb(key) ? "done" : ""} ${step === key ? "now" : ""}`}>
              <span className="crumb-label">{label}</span>
              <span className="crumb-value">{value ?? "—"}</span>
            </span>
          ))}
        </nav>

        <button className="playpage-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
      </header>

      {/* ── içerik ── */}
      <main className="playpage-main">
        {/* 1) SERİ */}
        {step === "series" && (
          <div className="pick">
            <span className="pick-eyebrow">Adım 01 · Seri</span>
            <h1 className="pick-title">Hangi seriye gireceksin?</h1>
            <p className="pick-lead">
              Her seri ayrı bir kampanya. Oynanabilir olanlardan birini seç; sonra o
              maceradaki bir karakterin gözünden bölümü baştan oyna.
            </p>
            <div className="pick-series">
              {series.map((s) => {
                const ready = hasScenarios(s.id);
                return (
                  <button
                    key={s.id}
                    className={`sCard ${ready ? "" : "locked"}`}
                    style={{ ["--c" as string]: s.accent }}
                    disabled={!ready}
                    onClick={() => {
                      setSeriesId(s.id);
                      setStep("character");
                    }}
                  >
                    <div className="sCard-thumb">
                      {s.thumbnail ? (
                        <img src={s.thumbnail} alt="" loading="lazy" />
                      ) : (
                        <div className="sCard-thumb-ph" />
                      )}
                      <span className={`sCard-badge ${ready ? "on" : ""}`}>
                        {ready ? "Oynanabilir" : "Yakında"}
                      </span>
                    </div>
                    <div className="sCard-body">
                      <span className="sCard-title">{s.title}</span>
                      <span className="sCard-meta">
                        {ready ? `${episodesCount(s.id)} oynanabilir bölüm` : `${s.count} bölüm`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2) KARAKTER */}
        {step === "character" && (
          <div className="pick">
            <span className="pick-eyebrow">Adım 02 · Karakter</span>
            <h1 className="pick-title">Kimin gözünden oynayacaksın?</h1>
            <p className="pick-lead">
              <b>{activeSeries?.title}</b> masasındaki oyuncular. Birini seç — bölümü onun
              kararları ve zar atışlarıyla yaşayacaksın.
            </p>
            <div className="pick-chars">
              {roster.map((c) => (
                <button
                  key={c.id}
                  className="cCard"
                  style={{ ["--c" as string]: charColor(c.id) }}
                  onClick={() => {
                    setCharId(c.id);
                    setStep("episode");
                  }}
                >
                  <Avatar face={faceOf(c.id)} color={charColor(c.id)} size={56} />
                  <span className="cCard-name">{c.name}</span>
                  {c.role && <span className="cCard-role">{c.role}</span>}
                  <span className="cCard-player">{c.player}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3) BÖLÜM */}
        {step === "episode" && (
          <div className="pick">
            <span className="pick-eyebrow">Adım 03 · Bölüm</span>
            <h1 className="pick-title">Hangi bölümü oynayacaksın?</h1>
            <p className="pick-lead">
              <b>{activeChar?.name}</b> olarak oynayacaksın. Bir bölüm seç, senaryoyu sahne
              sahne yaşa.
            </p>
            <div className="pick-eps">
              {episodes.map((sc) => (
                <button
                  key={sc.id}
                  className="eCard"
                  onClick={() => {
                    setScenario(sc);
                    setStep("play");
                  }}
                >
                  <span className="eCard-no">{String(sc.episode).padStart(2, "0")}</span>
                  <span className="eCard-body">
                    <span className="eCard-title">{sc.title}</span>
                    <span className="eCard-meta">{sc.beats.length} sahne</span>
                  </span>
                  {sc.demo && <span className="eCard-demo">Demo</span>}
                  <span className="eCard-go">Oyna ›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4) OYNA */}
        {step === "play" && scenario && activeSeries && (
          <PlayEngine
            scenario={scenario}
            series={activeSeries}
            charId={charId}
            onExit={() => setStep("episode")}
            onReplay={() => setScenario({ ...scenario })}
          />
        )}
      </main>
    </div>
  );

  function episodesCount(id: string) {
    return scenariosForSeries(id).length;
  }
}

/* ════════ SENARYO MOTORU — akan sohbet / actual-play günlüğü ════════ */

/* daktilo efekti */
function useTypewriter(text: string, speed = 20) {
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [text]);
  useEffect(() => {
    if (i >= text.length) return;
    const t = setTimeout(() => setI((n) => n + 1), speed);
    return () => clearTimeout(t);
  }, [i, text, speed]);
  return { shown: text.slice(0, i), done: i >= text.length, skip: () => setI(text.length) };
}

const EMBERS = Array.from({ length: 16 });

/* sahnede tek bir sohbet satırı / sonuç / bölüm ayracı için mesaj modeli */
type Msg =
  | { type: "scene"; title: string; subtitle?: string }
  | { type: "say"; name: string; face: string; color: string; me: boolean; tag?: string; text: string }
  | { type: "outcome"; ok?: boolean; text: string };

function PlayEngine({
  scenario,
  series,
  charId,
  onExit,
  onReplay,
}: {
  scenario: Scenario;
  series: Series;
  charId: string;
  onExit: () => void;
  onReplay: () => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, { text: string; ok?: boolean }>>({});
  const feedRef = useRef<HTMLDivElement | null>(null);

  const charMap = useMemo(() => new Map(scenario.characters.map((c) => [c.id, c])), [scenario]);
  const nameOf = (id: string) => (id === charId ? "Sen" : charMap.get(id)?.name ?? id);
  const faceOf = (id: string) => faceOfChar(charMap.get(id));
  /* renk: aktif senaryonun karakter sırasına göre — NPC'ler de stabil renk alır */
  const charColor = (id: string) => {
    if (id === "gm") return "#caa84e";
    const i = scenario.characters.findIndex((c) => c.id === id);
    return CHAR_COLORS[(i < 0 ? 0 : i) % CHAR_COLORS.length];
  };
  const me = charMap.get(charId);

  const beats = scenario.beats;
  const finished = cursor >= beats.length;
  const progress = Math.round((cursor / beats.length) * 100);

  /* bir beat → ekrandaki mesaj(lar) */
  const beatMsgs = (i: number): Msg[] => {
    const bt = beats[i];
    switch (bt.kind) {
      case "scene":
        return [{ type: "scene", title: bt.title, subtitle: bt.subtitle }];
      case "narration":
        return [{ type: "say", ...NARRATOR, me: false, text: bt.text }];
      case "line":
        return [
          {
            type: "say",
            name: nameOf(bt.who),
            face: faceOf(bt.who),
            color: charColor(bt.who),
            me: bt.who === charId,
            text: bt.text,
          },
        ];
      case "choice": {
        if (bt.actor === charId) {
          const base: Msg[] = [
            { type: "say", ...NARRATOR, me: false, tag: "Karar · senin sıran", text: bt.prompt },
          ];
          if (outcomes[i]) base.push({ type: "outcome", text: outcomes[i].text });
          return base;
        }
        const r = (bt.options.find((o) => o.canon) ?? bt.options[0]).result;
        return [
          {
            type: "say",
            name: nameOf(bt.actor),
            face: faceOf(bt.actor),
            color: charColor(bt.actor),
            me: false,
            tag: "kararı",
            text: r,
          },
        ];
      }
      case "roll": {
        if (bt.actor === charId) {
          const base: Msg[] = [
            {
              type: "say",
              ...NARRATOR,
              me: false,
              tag: `Zar · senin atışın · hedef ${bt.dc}+`,
              text: bt.prompt,
            },
          ];
          if (outcomes[i]) base.push({ type: "outcome", ok: outcomes[i].ok, text: outcomes[i].text });
          return base;
        }
        // başka bir oyuncunun zarı — masada gerçekte attığı sonuçla, kendi adı altında
        const ok = bt.canonSuccess !== false;
        const t = ok ? bt.success : bt.failure;
        const tag =
          bt.canonRoll != null ? `🎲 ${bt.canonRoll} attı · hedef ${bt.dc}` : `🎲 zar · hedef ${bt.dc}`;
        return [
          {
            type: "say",
            name: nameOf(bt.actor),
            face: faceOf(bt.actor),
            color: charColor(bt.actor),
            me: false,
            tag,
            text: t,
          },
        ];
      }
    }
  };

  /* yalnızca canlı (en yeni) beat'in son repliği daktiloyla yazılır */
  const liveMsgs = finished ? [] : beatMsgs(cursor);
  const liveSay = [...liveMsgs].reverse().find((m) => m.type === "say") as
    | Extract<Msg, { type: "say" }>
    | undefined;
  const tw = useTypewriter(liveSay?.text ?? "");

  /* her ilerlemede / yazıldıkça akışı en alta kaydır */
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cursor, tw.shown, finished]);

  const advance = () => setCursor((c) => c + 1);
  const restart = () => {
    setCursor(0);
    setOutcomes({});
    onReplay();
  };

  const live = finished ? null : beats[cursor];
  const myChoice = live?.kind === "choice" && live.actor === charId ? live : null;
  const myRoll = live?.kind === "roll" && live.actor === charId ? live : null;

  return (
    <div className="vn">
      {/* atmosfer katmanları */}
      <div className="vn-fog" aria-hidden="true" />
      <div className="vn-embers" aria-hidden="true">
        {EMBERS.map((_, i) => (
          <span
            key={i}
            style={{
              ["--x" as string]: `${(i * 61) % 100}%`,
              ["--d" as string]: `${((i * 1.7) % 8).toFixed(2)}s`,
              ["--s" as string]: `${7 + (i % 5) * 1.6}s`,
            }}
          />
        ))}
      </div>
      <div className="vn-vignette" aria-hidden="true" />

      {/* HUD */}
      <div className="vn-hud">
        <div className="vn-hud-who">
          <Avatar face={faceOfChar(me)} color={charColor(charId)} me size={38} />
          <div>
            <span className="vn-hud-name">{me?.name}</span>
            <span className="vn-hud-sub">
              {series.title} · Bölüm {scenario.episode}
            </span>
          </div>
        </div>
        <div className="vn-hud-prog">
          <div className="vn-hud-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <button className="vn-hud-exit" onClick={onExit}>
            çık
          </button>
        </div>
      </div>

      {/* akan sohbet günlüğü */}
      <div className="vn-feed" ref={feedRef}>
        <div className="vn-feed-inner">
          {/* geçmiş — kaybolmayan akış */}
          {beats.slice(0, cursor).flatMap((_, i) =>
            beatMsgs(i).map((m, mi) => <Row key={`${i}-${mi}`} msg={m} />)
          )}

          {/* canlı beat — son replik daktiloyla */}
          {!finished &&
            liveMsgs.map((m, mi) => {
              const typing = m === liveSay;
              return (
                <Row
                  key={`live-${cursor}-${mi}`}
                  msg={m}
                  live
                  typed={typing ? tw.shown : undefined}
                  caret={typing && !tw.done}
                />
              );
            })}

          {/* bitiş kartı */}
          {finished && (
            <div className="vn-end">
              <span className="vn-end-orn">✦</span>
              <h3 className="vn-end-title">Bölümü Tamamladın</h3>
              <p className="vn-end-sub">
                {scenario.title} — {series.title}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* alt aksiyon çubuğu — sıra sende olduğunda */}
      <div className="vn-bar">
        {finished ? (
          <div className="vn-bar-end">
            <button className="btn ghost" onClick={restart}>
              ↻ Baştan oyna
            </button>
            <button className="btn" onClick={onExit}>
              Başka bölüm
            </button>
          </div>
        ) : myChoice ? (
          tw.done ? (
            <div className="vn-opts">
              {myChoice.options.map((o, i) => (
                <button
                  key={i}
                  className="vn-opt"
                  onClick={() => {
                    setOutcomes((p) => ({ ...p, [cursor]: { text: o.result } }));
                    advance();
                  }}
                >
                  <span className="vn-opt-i">{String.fromCharCode(65 + i)}</span>
                  <span>{o.text}</span>
                </button>
              ))}
            </div>
          ) : (
            <button className="vn-skip" onClick={tw.skip}>
              seçenekler için bekle… <span className="vn-skip-x">(atla)</span>
            </button>
          )
        ) : myRoll ? (
          tw.done ? (
            <div className="vn-dice">
              <GameDice
                interpret={(v) => {
                  const ok = v >= myRoll.dc;
                  return {
                    text: ok ? `${v} — Başarılı!` : `${v} — Başarısız`,
                    cls: ok ? "crit" : "fail",
                  };
                }}
                onResult={(v) => {
                  const ok = v >= myRoll.dc;
                  const text = `Zar ${v} (hedef ${myRoll.dc}) — ${ok ? myRoll.success : myRoll.failure}`;
                  setTimeout(() => {
                    setOutcomes((p) => ({ ...p, [cursor]: { text, ok } }));
                    advance();
                  }, 1900);
                }}
              />
            </div>
          ) : (
            <button className="vn-skip" onClick={tw.skip}>
              zar için bekle… <span className="vn-skip-x">(atla)</span>
            </button>
          )
        ) : (
          <button className="vn-advance" onClick={tw.done ? advance : tw.skip}>
            {tw.done ? "Devam ›" : "atla »"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── tek satır: sahne ayracı / sohbet balonu / sonuç rozeti ── */
function Row({
  msg,
  live = false,
  typed,
  caret = false,
}: {
  msg: Msg;
  live?: boolean;
  typed?: string;
  caret?: boolean;
}) {
  if (msg.type === "scene") {
    return (
      <div className={`vn-scene ${live ? "live" : ""}`}>
        <span className="vn-scene-orn">✦ ✦ ✦</span>
        <h2 className="vn-scene-title">{msg.title}</h2>
        {msg.subtitle && <span className="vn-scene-sub">{msg.subtitle}</span>}
      </div>
    );
  }

  if (msg.type === "outcome") {
    return (
      <div className={`vn-outcome ${msg.ok === true ? "ok" : msg.ok === false ? "no" : ""}`}>
        <span className="vn-outcome-tag">Sonuç</span>
        <span className="vn-outcome-text">{msg.text}</span>
      </div>
    );
  }

  const text = typed ?? msg.text;
  return (
    <div className={`vn-row ${msg.me ? "me" : ""} ${live ? "is-live" : ""}`}>
      <Avatar face={msg.face} color={msg.color} me={msg.me} size={48} />
      <div className="vn-bubble" style={{ ["--ac" as string]: msg.me ? "var(--gold)" : msg.color }}>
        <span className="vn-bubble-name">{msg.tag ? `${msg.name} · ${msg.tag}` : msg.name}</span>
        <p className="vn-bubble-text">
          {text}
          {caret && <span className="vn-caret" />}
        </p>
      </div>
    </div>
  );
}
