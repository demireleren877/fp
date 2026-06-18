import generated from "./episodes.generated.json";

export interface Episode {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  publishedAt: string | null;
}

/**
 * Build sırasında üretilen NORMAL videolar — hiçbir seri oynatma listesinde
 * olmayan bağımsız videolar/klipler.
 */
export const episodes: Episode[] = generated as Episode[];

export const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
