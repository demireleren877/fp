/**
 * Tepeden görünüm bir masaüstü RPG masası — "Oyna" tanıtım alanı için poster.
 * Tamamen SVG (dış görsel yok): ahşap masa, parşömen harita, pusula, saçılmış
 * zarlar (d20 altın · d6 mor · d4 bordo) ve mum ışıkları. Site paletiyle uyumlu.
 */
export default function RpgTablePoster() {
  return (
    <svg
      className="rpg-poster"
      viewBox="0 0 440 360"
      role="img"
      aria-label="Masaüstü rol yapma oyunu masası — harita ve zarlar"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="rp-table" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#241d36" />
          <stop offset="60%" stopColor="#171225" />
          <stop offset="100%" stopColor="#0d0a16" />
        </radialGradient>
        <linearGradient id="rp-parch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ecdcab" />
          <stop offset="55%" stopColor="#dcc488" />
          <stop offset="100%" stopColor="#c2a868" />
        </linearGradient>
        <linearGradient id="rp-d20" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#f0d98f" />
          <stop offset="55%" stopColor="#d8b45a" />
          <stop offset="100%" stopColor="#a87f33" />
        </linearGradient>
        <linearGradient id="rp-d6" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b491e0" />
          <stop offset="100%" stopColor="#6f48a8" />
        </linearGradient>
        <radialGradient id="rp-candle" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,214,140,0.9)" />
          <stop offset="40%" stopColor="rgba(232,170,76,0.35)" />
          <stop offset="100%" stopColor="rgba(232,170,76,0)" />
        </radialGradient>
        <radialGradient id="rp-vig" cx="50%" cy="48%" r="70%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(5,4,10,0.6)" />
        </radialGradient>
        <clipPath id="rp-map-clip">
          <path d="M86 70 q-6 100 6 210 q150 16 270 -4 q10 -110 -4 -206 q-140 -14 -272 0 Z" />
        </clipPath>
      </defs>

      {/* ahşap masa zemini + damar */}
      <rect x="0" y="0" width="440" height="360" fill="url(#rp-table)" />
      <g stroke="#2c2440" strokeWidth="1" opacity="0.5" fill="none">
        <path d="M0 60 q220 -16 440 4" />
        <path d="M0 150 q220 14 440 -6" />
        <path d="M0 250 q220 -12 440 6" />
        <path d="M0 320 q220 12 440 -4" />
      </g>

      {/* mum ışıkları */}
      <circle cx="70" cy="64" r="78" fill="url(#rp-candle)" />
      <circle cx="372" cy="300" r="92" fill="url(#rp-candle)" />

      {/* parşömen harita (hafif eğik) */}
      <g transform="rotate(-3 220 175)">
        <path
          d="M86 70 q-6 100 6 210 q150 16 270 -4 q10 -110 -4 -206 q-140 -14 -272 0 Z"
          fill="url(#rp-parch)"
          stroke="#9c7f44"
          strokeWidth="2"
        />
        <g clipPath="url(#rp-map-clip)" stroke="#7a6534" fill="none">
          {/* deniz washı */}
          <path
            d="M86 70 q-6 100 6 210 q70 8 120 4 q-10 -120 18 -218 q-78 -6 -144 4 Z"
            fill="#c9d2c0"
            opacity="0.5"
            stroke="none"
          />
          {/* kıyı şeridi */}
          <path d="M226 66 q-30 90 -8 214" strokeWidth="1.6" opacity="0.7" />
          {/* dağ sıraları */}
          <g strokeWidth="1.6" opacity="0.8">
            <path d="M252 150 l16 -26 l16 26" />
            <path d="M276 150 l18 -30 l18 30" />
            <path d="M300 152 l14 -22 l14 22" />
          </g>
          {/* orman */}
          <g strokeWidth="1.4" opacity="0.75">
            <path d="M270 210 l8 -16 l8 16 Z" />
            <path d="M292 218 l9 -18 l9 18 Z" />
            <path d="M314 210 l8 -16 l8 16 Z" />
            <path d="M282 232 l8 -16 l8 16 Z" />
          </g>
          {/* yol (kesik çizgi) */}
          <path
            d="M150 250 q30 -50 96 -54 q70 -4 110 -70"
            strokeWidth="2"
            strokeDasharray="2 7"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* hazine X */}
        <g stroke="#b23148" strokeWidth="3.4" strokeLinecap="round">
          <path d="M338 92 l16 16 M354 92 l-16 16" />
        </g>

        {/* pusula gülü */}
        <g transform="translate(132 122)" opacity="0.9">
          <circle r="20" fill="none" stroke="#9c7f44" strokeWidth="1.4" />
          <path d="M0 -26 L5 0 L0 26 L-5 0 Z" fill="#9c7f44" />
          <path d="M-26 0 L0 -5 L26 0 L0 5 Z" fill="#b39a5e" />
          <text
            x="0"
            y="-28"
            textAnchor="middle"
            fontFamily="Cinzel, serif"
            fontSize="10"
            fill="#7a6534"
          >
            K
          </text>
        </g>
      </g>

      {/* ── d6 (mor) ── */}
      <g transform="translate(366 78) rotate(8)">
        <path d="M0 -20 L20 -8 L0 4 L-20 -8 Z" fill="#9b6fd0" stroke="#c0a3e8" strokeWidth="1.2" />
        <path d="M-20 -8 L0 4 L0 26 L-20 14 Z" fill="#7a52ac" stroke="#c0a3e8" strokeWidth="1.2" />
        <path d="M20 -8 L0 4 L0 26 L20 14 Z" fill="#6f48a8" stroke="#c0a3e8" strokeWidth="1.2" />
        <circle cx="0" cy="-8" r="2.2" fill="#ece6d6" />
        <circle cx="-10" cy="6" r="2" fill="#efe7f7" />
        <circle cx="-10" cy="16" r="2" fill="#efe7f7" />
      </g>

      {/* ── d4 (bordo) ── */}
      <g transform="translate(96 286) rotate(-10)">
        <path d="M0 -20 L20 14 L-20 14 Z" fill="#b23148" stroke="#e08aa0" strokeWidth="1.2" />
        <path d="M0 -20 L0 8 L-20 14 Z" fill="#8f2438" stroke="#e08aa0" strokeWidth="1" />
        <text x="0" y="9" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="9" fill="#f3d7de">
          4
        </text>
      </g>

      {/* ── d20 (altın · kahraman) ── */}
      <g transform="translate(322 258) rotate(6)">
        <ellipse cx="0" cy="40" rx="44" ry="12" fill="rgba(0,0,0,0.35)" />
        <g stroke="#f0dca0" strokeWidth="1.6" strokeLinejoin="round">
          {/* dış altıgen */}
          <polygon points="0,-46 39.8,-23 39.8,23 0,46 -39.8,23 -39.8,-23" fill="url(#rp-d20)" />
          {/* iç faset üçgenleri */}
          <polygon points="-39.8,-23 39.8,-23 0,46" fill="rgba(255,255,255,0.06)" />
          <polygon points="0,-23 19.9,11.5 -19.9,11.5" fill="rgba(0,0,0,0.12)" />
          <path d="M0 -46 L0 -23 M39.8 23 L19.9 11.5 M-39.8 23 L-19.9 11.5" fill="none" />
        </g>
        <text
          x="0"
          y="2"
          textAnchor="middle"
          fontFamily="Cinzel, serif"
          fontWeight="800"
          fontSize="22"
          fill="#3a2c10"
        >
          20
        </text>
      </g>

      {/* vinyet */}
      <rect x="0" y="0" width="440" height="360" fill="url(#rp-vig)" />
    </svg>
  );
}
