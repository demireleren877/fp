# Fantastik Pazar — Web Sitesi

Doğaçlama masaüstü rol yapma oyunu (TTRPG) YouTube kanalı **Fantastik Pazar** için
çok sayfalı tanıtım sitesi. React + Vite + TypeScript. Bölüm verisi YouTube RSS'ten
**build sırasında** otomatik çekilir (API anahtarı gerekmez).

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run fetch` | YouTube RSS'ten bölümleri çek (`src/data/episodes.generated.json`) |
| `npm run build` | `prebuild` ile RSS çekip prod derleme yapar (`dist/`) |
| `npm run preview` | Derlenmiş siteyi yerelde önizle |

## Sayfalar

- `/` Ana sayfa (hero + D20 zar atıcı, son bölüm, kampanya/video teaser, hakkımızda)
- `/bolumler` Bölüm arşivi (kampanyaya göre filtre)
- `/kampanyalar` ve `/kampanyalar/:id` Kampanyalar + Gölge Orman / istanbul.exe lore
- `/kadro` Oyuncular ve karakter kartları
- `/etkinlikler` Etkinlik takvimi
- `/magaza` Mağaza iskeleti (yakında)

## Dinamik içerik (YouTube)

`scripts/fetch-youtube.mjs` kanalın RSS akışından son 15 videoyu çeker, başlığa göre
kampanyaya ayırır ve bölüm numarasını çıkarır. RSS erişilemezse mevcut veri korunur.

- Kanal: `YT_CHANNEL_ID` env ile değişebilir (varsayılan: `UCQK6e6c4StZgA8WBxkXn_Hg`).
- Yeni kampanya: `scripts/fetch-youtube.mjs` içindeki `CAMPAIGN_RULES`'a bir kural,
  `src/data/campaigns.ts`'e aynı `id` ile bir kayıt ekle.
- Site her deploy'da güncel olur. Otomatik tazeleme için Netlify/Vercel'de **günlük
  zamanlanmış rebuild** (cron) kurabilirsin.

## Sık güncellenenler

- **Abone sayısı:** `src/data/channel.ts` → `subscribers` (RSS'te yok, elle gir; `null` ise gizlenir).
- **Karakter bilgileri:** `src/data/cast.ts` (şu an placeholder).
- **Etkinlikler:** `src/data/events.ts`.
- **Logo:** `public/assets/logo.svg` (ve `favicon.svg`, `og-cover.svg`). Kanalın gerçek
  `FantastikTransparan.png` logosuyla değiştirilebilir; `Nav.tsx`/`Footer.tsx` içindeki
  `src` yolunu güncelle.

## Deploy

Netlify veya Vercel'e statik olarak çıkar (yapılandırma hazır: `netlify.toml`, `vercel.json`,
`public/_redirects` — SPA route fallback dahil).

```bash
npm run build     # dist/ üretir
```

`fantastikpazar.com` alan adını seçtiğin platforma yönlendir.
