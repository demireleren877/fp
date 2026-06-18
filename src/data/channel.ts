/** Kanal geneli meta. Abone sayısı canlı API'den (youtube.ts) gelir; buradaki
 *  değer yalnızca API kapalıyken kullanılan elle güncellenen yedektir. */
export const channel = {
  name: "Fantastik Pazar",
  handle: "@FantastikPazar",
  youtubeUrl: "https://youtube.com/@FantastikPazar",
  channelId: "UCQK6e6c4StZgA8WBxkXn_Hg",
  /** Abone sayısı — gerçek değeri buraya yaz. null ise sayaç gizlenir. */
  subscribers: null as number | null,
  schedule: "Her Pazar 17:00",
  tagline: "Zar Atıp Rol Yapıyoruz",
};

/** Sosyal bağlantılar — footer'da gösterilir. */
export const social = [
  { id: "instagram", label: "Instagram", handle: "instagram.com/fantastik.pazar", url: "https://instagram.com/fantastik.pazar" },
  { id: "twitter", label: "Twitter", handle: "twitter.com/fantastik.pazar", url: "https://twitter.com/fantastik.pazar" },
  { id: "tiktok", label: "TikTok", handle: "tiktok.com/fantastik.pazar", url: "https://tiktok.com/@fantastik.pazar" },
] as const;
