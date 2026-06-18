/**
 * Fantastik Pazar — YouTube Data API v3 çekici (build-time).
 *
 * RSS DEĞİL: tamamen YouTube Data API v3 kullanır (runtime youtube.ts ile aynı
 * mantık). İki şey üretir:
 *   1) src/data/series.generated.json   — kanaldaki PUBLIC oynatma listeleri
 *      (başlık, link, gerçek public video sayısı, kapak, son güncelleme).
 *   2) src/data/episodes.generated.json — hiçbir oynatma listesinde olmayan
 *      bağımsız videolar (uploads − listelerdekiler).
 *
 * Bu JSON'lar sitenin "build-time fallback"ıdır; tarayıcıda youtube.ts canlı
 * API ile üzerine taze veri biner. API erişilemezse mevcut JSON korunur — site
 * asla kırılmaz.
 *
 * Anahtar: sunucu tarafı build anahtarı `YT_API_KEY` (tercih edilen), yoksa
 * `VITE_YT_API_KEY`. NOT: Node'dan çağrıldığı için anahtar HTTP-referrer ile
 * KISITLANMIŞSA reddedilir; build anahtarını kısıtsız ya da IP/API kısıtlı tut.
 *
 * Build öncesi (prebuild) ve `npm run fetch` ile çalışır.
 */
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "src", "data");
const OUT_SERIES = join(DATA, "series.generated.json");
const OUT_EPISODES = join(DATA, "episodes.generated.json");

const API_KEY = process.env.YT_API_KEY || process.env.VITE_YT_API_KEY || "";
const CHANNEL_ID = process.env.YT_CHANNEL_ID || "UCQK6e6c4StZgA8WBxkXn_Hg"; // @FantastikPazar
const BASE = "https://www.googleapis.com/youtube/v3";

/** Bilinmeyen (yeni) listeler için vurgu renk paleti. */
const PALETTE = ["#e8884c", "#5fd0a8", "#9b6fd0", "#c9a84c", "#b23148", "#d0a85f", "#6f9bd0", "#19f0c3"];

/**
 * Stabil kimlik + vurgu rengi eşlemesi (playlistId → {id, accent}).
 * Listeler API'den otomatik keşfedilir; burada yalnızca bilinen listelerin
 * site içi id'si ve teması sabitlenir. Yeni liste eklenince otomatik gelir ve
 * palet renklerinden birini alır — istersen buraya bir satır ekleyip sabitlersin.
 */
const SERIES_META = {
  "PLtWq3cmvPcpyvZstYjX-HEhqGKKVg0Cmr": { id: "ekinoks", accent: "#e8884c" },
  "PLtWq3cmvPcpxKDGcUeWsF4c1FH8MuMmlM": { id: "dongu", accent: "#5fd0a8" },
  "PLtWq3cmvPcpwl1t-Z96p2wTu09dP2Ve4Z": { id: "golge-orman", accent: "#9b6fd0" },
  "PLtWq3cmvPcpwcrAHmyDOdESO11WMcQM1S": { id: "dragon-heist", accent: "#c9a84c" },
  "PLtWq3cmvPcpzRPd1fTUOcKddh7fLzbM41": { id: "mukavemet", accent: "#b23148" },
  "PLtWq3cmvPcpw7GvUiNS0zvggD8ow6o0wC": { id: "dungeons-konuks", accent: "#d0a85f" },
  "PLtWq3cmvPcpzDBVC1OuDypxvYO-CtF6Tx": { id: "efruz", accent: "#6f9bd0" },
  "PLtWq3cmvPcpx1hZw6MF3kgnSnIikQMor3": { id: "istanbul-exe", accent: "#19f0c3" },
};
const metaFor = (pid) => SERIES_META[pid] || null;

const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const playlistLink = (id) => `https://www.youtube.com/playlist?list=${id}`;

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

function keepExisting(label, out) {
  if (existsSync(out)) {
    console.warn(`[fetch-youtube] ${label}: mevcut veri korunuyor.`);
    return true;
  }
  return false;
}

/** Kanaldaki tüm public oynatma listelerini (sayfalayarak) topla. */
async function fetchPlaylists() {
  const out = [];
  let pageToken = "";
  do {
    const url =
      `${BASE}/playlists?part=snippet,status&channelId=${CHANNEL_ID}` +
      `&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const data = await getJSON(url);
    for (const it of data.items ?? []) {
      if (it.status?.privacyStatus !== "public") continue;
      const t = it.snippet?.thumbnails ?? {};
      out.push({
        playlistId: it.id,
        title: it.snippet?.title ?? "Liste",
        snippetThumb: t.maxres?.url || t.standard?.url || t.high?.url || t.medium?.url || t.default?.url || "",
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

/** Bir listenin YALNIZCA public videolarını say + en yeni public videoyu bul. */
async function fetchPlaylistPublic(pid) {
  let pageToken = "";
  let count = 0;
  let latest = null;
  const videoIds = new Set();
  do {
    const url =
      `${BASE}/playlistItems?part=status,contentDetails&playlistId=${pid}` +
      `&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const data = await getJSON(url);
    for (const x of data.items ?? []) {
      const vid = x.contentDetails?.videoId;
      if (vid) videoIds.add(vid);
      if (x.status?.privacyStatus !== "public") continue;
      count++;
      const date = x.contentDetails?.videoPublishedAt ?? null;
      if (vid && date && (!latest || date > latest.date)) latest = { date, videoId: vid };
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return {
    count,
    updatedAt: latest?.date ?? null,
    thumbnail: latest ? thumb(latest.videoId) : "",
    videoIds,
  };
}

/** Kanalın uploads (tüm yüklemeler) oynatma listesi id'sini al. */
async function fetchUploadsPlaylistId() {
  const url = `${BASE}/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`;
  const data = await getJSON(url);
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

/** Uploads listesindeki public videoları (id, başlık, tarih) çek. */
async function fetchUploads(uploadsId) {
  const out = [];
  let pageToken = "";
  do {
    const url =
      `${BASE}/playlistItems?part=snippet,status,contentDetails&playlistId=${uploadsId}` +
      `&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const data = await getJSON(url);
    for (const x of data.items ?? []) {
      if (x.status?.privacyStatus !== "public") continue;
      const id = x.contentDetails?.videoId;
      const title = x.snippet?.title;
      const published = x.contentDetails?.videoPublishedAt ?? x.snippet?.publishedAt ?? null;
      if (id && title) out.push({ id, title, published });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

async function main() {
  if (!API_KEY) {
    console.warn("[fetch-youtube] API anahtarı yok (YT_API_KEY / VITE_YT_API_KEY). Mevcut JSON korunuyor.");
    keepExisting("series", OUT_SERIES);
    keepExisting("episodes", OUT_EPISODES);
    return;
  }

  let playlists;
  try {
    playlists = await fetchPlaylists();
  } catch (err) {
    console.warn(`[fetch-youtube] listeler çekilemedi (${err.message}).`);
    keepExisting("series", OUT_SERIES);
    keepExisting("episodes", OUT_EPISODES);
    return;
  }

  // ── 1) Seriler: her listenin gerçek public içeriğini çıkar ──
  const playlistVideoIds = new Set();
  const enriched = await Promise.all(
    playlists.map(async (p) => {
      const pub = await fetchPlaylistPublic(p.playlistId);
      pub.videoIds.forEach((v) => playlistVideoIds.add(v));
      const meta = metaFor(p.playlistId);
      return {
        id: meta?.id ?? p.playlistId,
        title: p.title,
        accent: meta?.accent ?? null, // palet sonra atanır
        playlistId: p.playlistId,
        url: playlistLink(p.playlistId),
        count: pub.count,
        thumbnail: pub.thumbnail || p.snippetThumb || "",
        updatedAt: pub.updatedAt,
      };
    })
  );

  // İçinde izlenebilir video olmayan listeleri ele, palet rengini ata, sırala
  const visible = enriched.filter((s) => s.count > 0);
  visible.forEach((s, i) => {
    if (!s.accent) s.accent = PALETTE[i % PALETTE.length];
  });
  visible.sort((a, b) => {
    if (a.updatedAt && b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    return b.count - a.count;
  });

  if (visible.length || !keepExisting("series", OUT_SERIES)) {
    writeFileSync(OUT_SERIES, JSON.stringify(visible, null, 2) + "\n");
    console.log(`[fetch-youtube] ${visible.length} seri yazıldı → ${OUT_SERIES}`);
  }

  // ── 2) Bağımsız videolar: uploads − listelerdekiler ──
  try {
    const uploadsId = await fetchUploadsPlaylistId();
    if (!uploadsId) throw new Error("uploads listesi bulunamadı");
    const uploads = await fetchUploads(uploadsId);
    const normal = uploads
      .filter((v) => !playlistVideoIds.has(v.id))
      .map((v) => ({
        id: v.id,
        title: v.title,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnail: thumb(v.id),
        publishedAt: v.published,
      }))
      .sort((a, b) => (String(a.publishedAt) < String(b.publishedAt) ? 1 : -1));
    writeFileSync(OUT_EPISODES, JSON.stringify(normal, null, 2) + "\n");
    console.log(`[fetch-youtube] ${normal.length} bağımsız video yazıldı → ${OUT_EPISODES}`);
  } catch (err) {
    console.warn(`[fetch-youtube] bağımsız videolar çekilemedi (${err.message}).`);
    if (!keepExisting("episodes", OUT_EPISODES)) writeFileSync(OUT_EPISODES, "[]\n");
  }
}

main();
