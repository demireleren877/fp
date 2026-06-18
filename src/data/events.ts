export interface SiteEvent {
  date: string;
  name: string;
  location: string;
  badge: string;
}

/** Etkinlikler — gerçek tarih/yer bilgisi geldikçe güncellenir. */
export const events: SiteEvent[] = [
  {
    date: "Yakında Duyurulacak",
    name: "İlk Canlı Oturum",
    location: "Yer ve tarih yakında açıklanacak",
    badge: "Planlama Aşamasında",
  },
  {
    date: "2026",
    name: "Fan Buluşması",
    location: "Detaylar için bizi takip edin",
    badge: "Duyuru Bekleniyor",
  },
  {
    date: "Her Pazar 17:00",
    name: "Yeni Bölüm Yayını",
    location: "YouTube",
    badge: "Aktif",
  },
];
