import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useSpring, useInView, useReducedMotion } from "framer-motion";
import DiceArena from "../components/DiceArena";
import PlayGame from "../components/PlayGame";
import RpgTablePoster from "../components/RpgTablePoster";
import Marquee from "../components/Marquee";
import Magnetic from "../components/Magnetic";
import { usePageMeta } from "../components/usePageMeta";
import { channel, social } from "../data/channel";
import { formatDate } from "../data/episodes";
import { useYouTube, formatCount } from "../data/youtube";
import { cast } from "../data/cast";
import { events } from "../data/events";

/* ── scroll reveal ── */
function Reveal({
  children,
  delay = 0,
  className,
  y = 36,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-12%" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── sayaç ── */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView) return;
    if (reduce) return setN(to);
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - start) / 1100, 1);
      setN(Math.round(p * to));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, to, reduce]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
}

/* ── sosyal ikon ── */
function SocialIcon({ id }: { id: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };
  if (id === "instagram")
    return (
      <svg {...common}>
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.71 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
      </svg>
    );
  if (id === "twitter")
    return (
      <svg {...common}>
        <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3L17.61 20.65Z" />
      </svg>
    );
  if (id === "youtube")
    return (
      <svg {...common}>
        <path d="M23.5 6.5a3 3 0 0 0-2.12-2.12C19.5 3.87 12 3.87 12 3.87s-7.5 0-9.38.5A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.12 2.12c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51A3 3 0 0 0 23.5 17.5C24 15.6 24 12 24 12s0-3.6-.5-5.5ZM9.6 15.57V8.43L15.8 12l-6.2 3.57Z" />
      </svg>
    );
  // tiktok
  return (
    <svg {...common}>
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.3v13.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1 0-5.2c.27 0 .53.04.77.12v-3.36a5.9 5.9 0 0 0-.77-.05A5.92 5.92 0 1 0 15.3 16.3V9.4a7.55 7.55 0 0 0 4.42 1.42V7.5a4.27 4.27 0 0 1-3.12-1.68Z" />
    </svg>
  );
}

/* ── tek tip bölüm başlığı ── */
function SecHead({ num, title, sub }: { num: string; title: string; sub: string }) {
  return (
    <Reveal>
      <div className="sec-head">
        <span className="sec-num">{num}</span>
        <h2 className="sec-title">{title}</h2>
      </div>
      <p className="sec-sub">{sub}</p>
    </Reveal>
  );
}

const SECTIONS = [
  { id: "hakkimizda", label: "Biz Kimiz" },
  { id: "seriler", label: "Seriler" },
  { id: "kadro", label: "Kadro" },
  { id: "oyna", label: "Oyna" },
  { id: "etkinlikler", label: "Yakında" },
  { id: "magaza", label: "Mağaza" },
];

export default function Landing() {
  usePageMeta(
    "Fantastik Pazar — Zar Atıp Rol Yapıyoruz",
    "Doğaçlama masaüstü RPG. Atılan her zar hikâyenin kaderini değiştirir. Her Pazar 17:00."
  );

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  const { series, stats } = useYouTube();

  const [playOpen, setPlayOpen] = useState(false);
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const toplamBolum = series.reduce((acc, s) => acc + s.count, 0);

  return (
    <>
      <motion.div className="progress-bar" style={{ scaleX }} />

      {/* YAN GÖSTERGE — nerede olduğunu söyler */}
      <nav className="dots" aria-label="Bölümler">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={active === s.id ? "active" : ""}>
            <span className="label">{s.label}</span>
            <span className="pip" />
          </a>
        ))}
      </nav>

      {/* ÜST NAV */}
      <nav className="nav">
        <a href="#top" className="nav-brand">
          <img className="brand-logo" src="/assets/FantastikTransparan.png" alt="" />
          Fantastik Pazar
        </a>
        <div className="nav-menu">
          <a href="#hakkimizda">Biz Kimiz</a>
          <a href="#seriler">Seriler</a>
          <a href="#kadro">Kadro</a>
          <a href="#oyna">Oyna</a>
          <a href="#etkinlikler">Yakında</a>
          <a href={channel.youtubeUrl} target="_blank" rel="noreferrer" className="nav-sub">
            Abone Ol
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero" id="top">
        <div className="hero-text">
          <motion.div
            className="hero-eyebrow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="rule" />
            <span className="kicker">Doğaçlama Masaüstü RPG</span>
          </motion.div>

          <h1>
            {["Zar Atıp", "Rol", "Yapıyoruz"].map((line, i) => (
              <span className="line" key={i}>
                <motion.span
                  style={{ display: "inline-block" }}
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  {line === "Rol" ? <em>Rol</em> : line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className="hero-lead"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            Her karar masada, <b>her kader zarda</b> belirlenir. Tek bir atış bütün hikâyeyi
            değiştirebilir.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.82 }}
          >
            <Magnetic>
              <a href={channel.youtubeUrl} target="_blank" rel="noreferrer" className="btn">
                ▶ İzlemeye Başla
              </a>
            </Magnetic>
            <Magnetic>
              <a href="#seriler" className="btn ghost">
                Serileri Gör
              </a>
            </Magnetic>
          </motion.div>

          <motion.div
            className="hero-schedule"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Yeni bölüm: <b>{channel.schedule}</b>
          </motion.div>
        </div>

        <motion.div
          className="hero-dice-slot"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.7 }}
        >
          <DiceArena lab />
        </motion.div>
      </header>

      <Marquee items={["Ekinoks", "Döngü", "Gölge Orman", "Dragon Heist", "Mukavemet", "D20"]} />

      {/* 01 · BİZ KİMİZ */}
      <section className="section" id="hakkimizda">
        <div className="wrap">
          <SecHead
            num="01"
            title="Biz Kimiz?"
            sub="Fantastik Pazar; stüdyoda canlı oynanan, doğaçlamaya dayalı bir masaüstü rol yapma oyunu kanalıdır."
          />
          <div className="manifesto-grid">
            <Reveal>
              <p>
                Bir anlatıcı, birkaç oyuncu ve bir avuç zar var. Anlatıcı dünyayı kurar,
                oyuncular kararları masada anlık verir,
                <b> zarlar gerisini yazar</b>. Her Pazar yeni bir bölümle masaya dönüyoruz.
              </p>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="manifesto-points">
                {[
                  ["Anlatıcı", "Dünyayı kurar, karakterlere ses verir, sahneyi hazırlar."],
                  ["Oyuncular", "Karakterlerini canlandırır, kararları masada anlık verir."],
                  ["Zar", "D20 atılır; sonuç hikâyeyi anında bir yöne savurur."],
                ].map(([h, p], i) => (
                  <div className="point" key={h}>
                    <span className="num">{i + 1}</span>
                    <div>
                      <h4>{h}</h4>
                      <p>{p}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.16}>
            <div className="stats">
              {[
                { n: series.length, s: "", l: "Seri" },
                { n: toplamBolum, s: "+", l: "Bölüm" },
                { n: 4, s: "", l: "Oyuncu" },
                stats.subscribers != null
                  ? { text: formatCount(stats.subscribers), l: "Abone" }
                  : { n: 20, s: "", l: "Yüzlü Zar" },
              ].map((s) => (
                <div className="stat" key={s.l}>
                  <div className="stat-n">
                    {"text" in s ? s.text : <CountUp to={s.n} suffix={s.s} />}
                  </div>
                  <div className="stat-l">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 02 · SERİLER (oynatma listeleri) */}
      <section className="section alt" id="seriler">
        <div className="wrap">
          <SecHead
            num="02"
            title="Seriler"
            sub="Her seri ayrı bir kampanya/macera. Karta tıkla, YouTube oynatma listesi baştan sona açılsın."
          />
          <div className="series-grid">
            {series.map((s, i) => (
              <Reveal key={s.id} delay={(i % 4) * 0.07}>
                <a
                  className="serie"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ["--c" as string]: s.accent }}
                >
                  <div className="serie-thumb">
                    {s.thumbnail ? (
                      <img src={s.thumbnail} alt={s.title} loading="lazy" />
                    ) : (
                      <div className="serie-thumb-empty" />
                    )}
                    <span className="serie-count">{s.count} bölüm</span>
                    <div className="serie-play">
                      <span />
                    </div>
                  </div>
                  <div className="serie-body">
                    <div className="serie-title">{s.title}</div>
                    <div className="serie-meta">
                      {s.updatedAt ? `Son: ${formatDate(s.updatedAt)}` : "Oynatma listesi"}
                    </div>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 03 · KADRO */}
      <section className="section" id="kadro">
        <div className="wrap">
          <SecHead
            num="03"
            title="Kadro"
            sub="Masanın etrafındaki ekip: dünyayı kuran anlatıcı ve kaderini zara emanet eden oyuncular."
          />
          <div className="cast-grid">
            {cast.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.08}>
                <div className={`member ${m.gm ? "gm" : ""}`}>
                  <span className="member-corner">{String(i + 1).padStart(2, "0")}</span>
                  <div className="member-tag">
                    <span className="pip" /> {m.gm ? "Anlatıcı" : "Oyuncu"}
                  </div>
                  <div className="member-name">{m.name}</div>
                  <div className="member-class">{m.role}</div>
                  {m.character && <p className="member-bio">{m.character.bio}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 04 · OYNA */}
      <section className="section alt" id="oyna">
        <div className="wrap">
          <SecHead
            num="04"
            title="Oyna"
            sub="Bir bölümün içine gir: seriyi, karakteri ve bölümü seç; senaryoyu o karakterin gözünden, sahne sahne oyna. Kararları sen ver, zarı sen at."
          />

          <Reveal>
            <div className="play-promo">
              <div className="play-promo-info">
                <span className="play-promo-eyebrow">İnteraktif · Beta</span>
                <h3 className="play-promo-title">Bölümün içine gir, kararı sen ver</h3>
                <p className="play-promo-text">
                  Bir seri, bir karakter ve bir bölüm seç. Senaryoyu o karakterin gözünden
                  sahne sahne yaşa; kararları sen ver, zarı sen at.
                </p>
                <div className="play-promo-flow">
                  <span><b>01</b> Seri</span>
                  <span><b>02</b> Karakter</span>
                  <span><b>03</b> Bölüm</span>
                  <span><b>04</b> Oyna</span>
                </div>
                <Magnetic>
                  <button className="btn" onClick={() => setPlayOpen(true)}>
                    🎲 Oynamaya Başla
                  </button>
                </Magnetic>
              </div>
              <div className="play-promo-art" aria-hidden="true">
                <RpgTablePoster />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 05 · YAKINDA / CANLI ETKİNLİKLER */}
      <section className="section" id="etkinlikler">
        <div className="wrap">
          <SecHead
            num="05"
            title="Yakında"
            sub="Canlı oturumlar, buluşmalar ve yayınlar. Detaylar netleştikçe burada duyuracağız."
          />
          <div className="coming-grid">
            {events.map((ev, i) => {
              const live = ev.badge.toLocaleLowerCase("tr").includes("aktif");
              return (
                <Reveal key={ev.name} delay={(i % 3) * 0.08}>
                  <div className="coming">
                    <div className="coming-kicker">{ev.date}</div>
                    <div className="coming-title">{ev.name}</div>
                    <div className="coming-sub">{ev.location}</div>
                    <span className={`coming-pill ${live ? "live" : ""}`}>{ev.badge}</span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 06 · MAĞAZA */}
      <section className="section alt" id="magaza">
        <div className="wrap">
          <SecHead
            num="06"
            title="Mağaza"
            sub="Kanala özel ürünler hazırlık aşamasında. İlk koleksiyon için bizi takipte kal."
          />
          <Reveal>
            <div className="shop">
              <h3>Çok Yakında</h3>
              <p>
                Tişört, çıkartma, zar kesesi ve daha fazlası. Mağaza açıldığında ilk haberi
                YouTube kanalımızdan vereceğiz.
              </p>
              <div className="shop-tags">
                {["Tişört", "Zar Kesesi", "Çıkartma", "Poster"].map((t) => (
                  <span className="shop-tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="shop-pill">Hazırlanıyor</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="wrap">
          <Reveal>
            <h2>
              Masaya <em>Dön</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="cta-sub">
              Her Pazar yeni bir bölüm. Abone ol, zar atılmadan yerini al.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <Magnetic>
              <a href={channel.youtubeUrl} target="_blank" rel="noreferrer" className="btn">
                ▶ YouTube'da Abone Ol
              </a>
            </Magnetic>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap footer-row">
          <a href="#top" className="footer-brand" aria-label="Fantastik Pazar">
            <img className="brand-logo" src="/assets/FantastikTransparan.png" alt="" />
            Fantastik Pazar
          </a>

          <div className="footer-social">
            {social.map((s) => (
              <a key={s.id} className="social-link" href={s.url} target="_blank" rel="noreferrer" aria-label={s.label}>
                <SocialIcon id={s.id} />
              </a>
            ))}
            <a className="social-link" href={channel.youtubeUrl} target="_blank" rel="noreferrer" aria-label="YouTube">
              <SocialIcon id="youtube" />
            </a>
          </div>

          <span className="footer-copy">© {new Date().getFullYear()} Fantastik Pazar</span>
        </div>
      </footer>

      <PlayGame series={series} open={playOpen} onClose={() => setPlayOpen(false)} />
    </>
  );
}
