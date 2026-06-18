/**
 * Runtime (full live) YouTube Data API v3 istemcisi.
 *
 * - Oynatma listelerini OTOMATİK keşfeder (elle SERIES_DEFS gerekmez).
 * - Abone / video / izlenme sayılarını canlı çeker.
 * - Tarayıcıda kısa süreli (5 dk) cache → kota dostu ama pratikte canlı.
 * - API yoksa / hata olursa build-time JSON'a (staticSeries) düşer; site kırılmaz.
 *
 * Anahtar: .env içindeki VITE_YT_API_KEY (kısıtlanmış olmalı).
 */
import { useEffect, useState } from "react";
import { series as staticSeries, type Series } from "./series";
import { channel } from "./channel";

const API_KEY = import.meta.env.VITE_YT_API_KEY as string | undefined;
const CHANNEL_ID = channel.channelId;
const BASE = "https://www.googleapis.com/youtube/v3";
const CACHE_KEY = "fp_yt_cache_v1";
const TTL = 1000 * 60 * 5; // 5 dakika

/** Bilinmeyen (yeni) listeler için vurgu renk paleti. */
const PALETTE = ["#e8884c", "#5fd0a8", "#9b6fd0", "#c9a84c", "#b23148", "#d0a85f", "#6f9bd0", "#19f0c3"];

/** Build-time veriden playlistId → {accent, updatedAt} eşlemesi (renk + son güncelleme korunur). */
const META = new Map(staticSeries.map((s) => [s.playlistId, s]));

export interface ChannelStats {
  subscribers: number | null;
  videos: number | null;
  views: number | null;
}

export interface YouTubeData {
  series: Series[];
  stats: ChannelStats;
}

interface Cached {
  at: number;
  data: YouTubeData;
}

const playlistLink = (id: string) => `https://www.youtube.com/playlist?list=${id}`;

function readCache(): YouTubeData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (Date.now() - c.at > TTL) return null;
    return c.data;
  } catch {
    return null;
  }
}

function writeCache(data: YouTubeData) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data } satisfies Cached));
  } catch {
    /* sessionStorage dolu/engelli olabilir — sorun değil */
  }
}

async function getJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  return res.json();
}

/** Kanalın tüm (public) oynatma listelerini sayfalayarak çeker. */
interface RawPlaylist {
  playlistId: string;
  title: string;
  snippetThumb: string;
}

interface PublicInfo {
  /** Listedeki gerçek public (izlenebilir) video sayısı */
  count: number;
  /** En yeni public videonun tarihi */
  updatedAt: string | null;
  /** En yeni public videonun kapağı */
  thumbnail: string;
}

/**
 * Bir listenin içindeki YALNIZCA public videoları sayar.
 * itemCount private/silinmiş videoları da sayar; biz gerçek izlenebilir olanları
 * baz alıyoruz. İçi tamamen private olan listeler 0 döner → gösterilmez.
 */
async function fetchPlaylistPublic(pid: string): Promise<PublicInfo> {
  let pageToken = "";
  let count = 0;
  let latest: { date: string; videoId: string } | null = null;
  do {
    const url =
      `${BASE}/playlistItems?part=status,contentDetails&playlistId=${pid}` +
      `&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const data = await getJSON(url);
    for (const x of data.items ?? []) {
      if (x.status?.privacyStatus !== "public") continue;
      count++;
      const vid: string | undefined = x.contentDetails?.videoId;
      const date: string | null = x.contentDetails?.videoPublishedAt ?? null;
      if (vid && date && (!latest || date > latest.date)) latest = { date, videoId: vid };
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return {
    count,
    updatedAt: latest?.date ?? null,
    thumbnail: latest ? `https://i.ytimg.com/vi/${latest.videoId}/hqdefault.jpg` : "",
  };
}

async function fetchAllPlaylists(): Promise<Series[]> {
  // 1) Kanaldaki public listeleri topla (henüz içeriklerine bakmadan)
  const raw: RawPlaylist[] = [];
  let pageToken = "";
  do {
    const url =
      `${BASE}/playlists?part=snippet,status&channelId=${CHANNEL_ID}` +
      `&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const data = await getJSON(url);
    for (const it of data.items ?? []) {
      if (it.status?.privacyStatus !== "public") continue; // gizli/unlisted listeyi atla
      const t = it.snippet?.thumbnails ?? {};
      raw.push({
        playlistId: it.id,
        title: it.snippet?.title ?? "Liste",
        snippetThumb:
          t.maxres?.url || t.standard?.url || t.high?.url || t.medium?.url || t.default?.url || "",
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  // 2) Her listenin içine bakıp gerçek public video sayısını çıkar
  const enriched = await Promise.all(
    raw.map(async (p) => {
      const pub = await fetchPlaylistPublic(p.playlistId);
      const meta = META.get(p.playlistId);
      const serie: Series = {
        id: meta?.id ?? p.playlistId,
        title: p.title,
        accent: meta?.accent ?? "#9b6fd0",
        playlistId: p.playlistId,
        url: playlistLink(p.playlistId),
        count: pub.count,
        thumbnail: pub.thumbnail || p.snippetThumb || meta?.thumbnail || "",
        updatedAt: pub.updatedAt ?? meta?.updatedAt ?? null,
      };
      return serie;
    })
  );

  // 3) İçinde izlenebilir videosu olmayan listeleri ele, palet rengini ata, sırala
  const visible = enriched.filter((s) => s.count > 0);
  visible.forEach((s, i) => {
    if (!META.has(s.playlistId)) s.accent = PALETTE[i % PALETTE.length];
  });
  visible.sort((a, b) => {
    if (a.updatedAt && b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    return b.count - a.count;
  });
  return visible;
}

async function fetchStats(): Promise<ChannelStats> {
  const url = `${BASE}/channels?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`;
  const data = await getJSON(url);
  const st = data.items?.[0]?.statistics ?? {};
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    subscribers: st.hiddenSubscriberCount ? null : num(st.subscriberCount),
    videos: num(st.videoCount),
    views: num(st.viewCount),
  };
}

async function fetchLive(): Promise<YouTubeData> {
  const [series, stats] = await Promise.all([fetchAllPlaylists(), fetchStats()]);
  return { series: series.length ? series : staticSeries, stats };
}

const STATIC_FALLBACK: YouTubeData = {
  series: staticSeries,
  stats: { subscribers: null, videos: null, views: null },
};

/**
 * React hook — anında build-time veriyle başlar, ardından canlı API verisini biner.
 * `live` true ise gösterilen veri YouTube'dan tazedir.
 */
export function useYouTube(): YouTubeData & { live: boolean; loading: boolean } {
  const [data, setData] = useState<YouTubeData>(() => readCache() ?? STATIC_FALLBACK);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(!!API_KEY);

  useEffect(() => {
    if (!API_KEY) {
      setLoading(false);
      return;
    }
    const cached = readCache();
    if (cached) {
      setData(cached);
      setLive(true);
      setLoading(false);
      return;
    }
    let alive = true;
    fetchLive()
      .then((fresh) => {
        if (!alive) return;
        setData(fresh);
        setLive(true);
        writeCache(fresh);
      })
      .catch((err) => {
        console.warn("[youtube] canlı veri alınamadı, build-time veri kullanılıyor:", err);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { ...data, live, loading };
}

/** Abone/izlenme gibi sayıları "1.2B", "3,4 Mn" gibi kısaltır. */
export function formatCount(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace(".", ",") + " Mn";
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(".", ",") + " B";
  return String(n);
}
