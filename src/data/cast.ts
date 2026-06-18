export interface CastMember {
  name: string;
  /** Masadaki rolü */
  role: string;
  /** Oyun yöneticisi mi? */
  gm?: boolean;
  /** Canlandırdığı karakter (varsa) */
  character?: {
    name: string;
    /** Sınıf / arketip — bilinmiyorsa "—" bırakılabilir */
    class: string;
    bio: string;
    /** Stat blok estetiği için örnek nitelikler (gösterimlik) */
    stats?: { label: string; value: string }[];
  };
}

/**
 * Kadro. Karakter bilgileri placeholder — gerçek sınıf/bio geldiğinde güncellenir.
 */
export const cast: CastMember[] = [
  {
    name: "Soykan Soner",
    role: "Oyun Yöneticisi & Yazar",
    gm: true,
    character: {
      name: "Anlatıcı",
      class: "Oyun Yöneticisi",
      bio: "Dünyayı kuran, NPC'lere ses veren ve kaderin zarını masaya getiren anlatıcı. Her şey o an, masada doğuyor.",
      stats: [
        { label: "Doğaçlama", value: "20" },
        { label: "Dünya Kurma", value: "18" },
        { label: "Sürpriz", value: "∞" },
      ],
    },
  },
  {
    name: "Can Girgin",
    role: "Oyuncu",
    character: {
      name: "Karakter",
      class: "—",
      bio: "Masadaki kararlarıyla hikâyenin gidişatını değiştiren oyunculardan. Sınıf ve geçmiş bilgisi yakında.",
    },
  },
  {
    name: "Okan Asman",
    role: "Oyuncu",
    character: {
      name: "Karakter",
      class: "—",
      bio: "Atılan zarların ardındaki cesur tercihler. Karakter detayları yakında eklenecek.",
    },
  },
  {
    name: "Özge Özel",
    role: "Oyuncu",
    character: {
      name: "Karakter",
      class: "—",
      bio: "Hikâyeye yön veren refleksif kararların ustası. Karakter detayları yakında.",
    },
  },
];
