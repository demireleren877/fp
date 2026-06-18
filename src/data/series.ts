import generated from "./series.generated.json";

export interface Series {
  id: string;
  title: string;
  /** Kart vurgu rengi */
  accent: string;
  playlistId: string;
  /** YouTube oynatma listesi linki */
  url: string;
  /** Listedeki bölüm sayısı */
  count: number;
  /** Kapak görseli (son bölümün küçük resmi) */
  thumbnail: string;
  /** Son güncelleme (ISO) */
  updatedAt: string | null;
}

/** Build sırasında fetch-youtube.mjs tarafından YouTube Data API v3'ten üretilir. */
export const series: Series[] = generated as Series[];
