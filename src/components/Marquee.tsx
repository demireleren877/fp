interface MarqueeProps {
  items: string[];
  reverse?: boolean;
}

/** Sonsuz akan şerit. İçerik iki kez basılır → kesintisiz döngü. */
export default function Marquee({ items, reverse }: MarqueeProps) {
  const row = (
    <div className="marquee-track" aria-hidden>
      {[...items, ...items].map((t, i) => (
        <span key={i}>{t}</span>
      ))}
    </div>
  );
  return (
    <div className={`marquee ${reverse ? "reverse" : ""}`} role="presentation">
      {row}
    </div>
  );
}
