/**
 * Oynanabilir senaryolar — "Oyna" modu.
 *
 * Her bölüm = bir Scenario. İçi sırayla "beat"lerden oluşur (sahne, anlatım,
 * diyalog, karar, zar). Kullanıcı seri → karakter → bölüm seçer ve bölümü
 * o karakterin gözünden, sahne sahne oynar.
 *
 * ⚠️ Buradaki tek senaryo bir DEMO'dur (demo: true). Gerçek bölüm senaryoları
 * videolardan üretilip buraya eklenecek; demo yalnızca mekaniği gösterir.
 *
 * Yeni bölüm eklemek = bu diziye yeni bir Scenario nesnesi eklemek.
 */

/**
 * Sahnenin ruh hali — atmosfer katmanlarını (sis, kıvılcım, vinyet) ve renk
 * tonlamasını sürükler. Verilmezse "tense" varsayılır.
 */
export type Mood = "calm" | "tense" | "danger" | "wonder";

/** oyuncunun topladığı ipucu / eşya — günlük defterine ve sonuç kartına işlenir */
export type Clue = { kind: "clue" | "item"; label: string; note?: string };

/**
 * Sahneyle uyumlu çizim. `scene` beat'inde → o sahne boyunca tam ekran backdrop
 * (yavaş zoom). `narration` beat'inde → balonun üstünde çizgi-roman karesi paneli.
 * Verilmezse prosedürel atmosfer devreye girer; görsel kısmi olsa da site bozulmaz.
 */
export type SceneArt = {
  src: string;
  alt: string;
  /** atmosferik döngü videosu (varsa src üstünde oynar; src poster/fallback olur) */
  video?: { webm?: string; mp4: string };
};

export type Beat =
  | { kind: "scene"; title: string; subtitle?: string; mood?: Mood; art?: SceneArt }
  | { kind: "narration"; text: string; gain?: Clue; art?: SceneArt }
  | { kind: "line"; who: string; text: string }
  | {
      kind: "choice";
      actor: string; // hangi karakterin kararı (character id)
      prompt: string;
      options: { text: string; canon?: boolean; result: string }[];
    }
  | {
      kind: "roll";
      actor: string; // zarı atan karakter (character id)
      prompt: string;
      dc: number; // hedef değer
      success: string;
      failure: string;
      canonSuccess?: boolean; // videoda gerçekte başarılı mı oldu (başka karakter için)
      canonRoll?: number; // videoda masada gerçekte atılan sayı (başka karakter için gösterilir)
    };

export interface PlayCharacter {
  id: string;
  name: string;
  player: string;
  role?: string;
  /** eğlenceli konuşmacı yüzü (emoji) — yoksa role'den türetilir */
  face?: string;
  /** AI portre görseli (varsa emoji yerine gösterilir; yüklenemezse emoji'ye düşer) */
  avatar?: string;
  /** NPC (anlatıcının seslendirdiği yan karakter) — karakter seçiminde çıkmaz */
  npc?: boolean;
}

export interface Scenario {
  id: string;
  seriesId: string; // src/data series id
  episode: number;
  title: string;
  demo?: boolean;
  /** taban atmosfer paleti — verilmezse seriesId'den türetilir (orman/cyber) */
  ambiance?: "forest" | "cyber";
  /** hikayeye özel anlatıcı portresi — verilmezse genel anlatıcı (narrator.webp) kullanılır */
  narratorAvatar?: string;
  characters: PlayCharacter[];
  beats: Beat[];
}

export const scenarios: Scenario[] = [
  {
    id: "golge-orman-1",
    seriesId: "golge-orman",
    episode: 1,
    title: "Sislerin Eşiği",
    demo: true,
    characters: [
      { id: "gm", name: "Anlatıcı", player: "Soykan Soner", role: "Oyun Yöneticisi", face: "🎲" },
      { id: "can", name: "Can'ın Karakteri", player: "Can Girgin", role: "Savaşçı", face: "⚔️" },
      { id: "okan", name: "Okan'ın Karakteri", player: "Okan Asman", role: "Hırsız", face: "🗡️" },
      { id: "ozge", name: "Özge'nin Karakteri", player: "Özge Özel", role: "Büyücü", face: "🧙" },
    ],
    beats: [
      { kind: "scene", title: "Gölge Orman'ın eşiği", subtitle: "Gün batımı", mood: "wonder" },
      {
        kind: "narration",
        text: "Ağaçların arasından sızan son ışık da çekiliyor. Önünüzde, sisin yuttuğu dar bir patika ve üzerinde eski runeler kazılı yıkık bir taş kemer var.",
      },
      { kind: "line", who: "can", text: "Bu kemerden geçmek hiç içime sinmiyor. Tuzak kokuyor." },
      { kind: "line", who: "okan", text: "Her şey tuzak kokar sana. Ben şu runelere bakayım." },
      {
        kind: "narration",
        text: "Sisin içinden boğuk bir uğultu yükseliyor. Kemerin gölgesinde bir şey kıpırdadı.",
      },
      {
        kind: "choice",
        actor: "ozge",
        prompt: "Kemere yaklaşan o gölge... Ne yaparsın?",
        options: [
          { text: "Büyüyle bir ışık küresi çağırıp gölgeyi aydınlat", canon: true, result: "Avucunda soluk mavi bir küre beliriyor ve ileri süzülüyor." },
          { text: "Sessizce geri çekilip grubu uyar", result: "Bir adım geri atıyorsun ama dalın altındaki kuru yaprak çatırdıyor." },
        ],
      },
      {
        kind: "narration",
        text: "Işık, kemerin altındaki şeye değiyor: paslı bir zırhın içinde, gözleri sönmüş bir nöbetçi. Ve yavaşça başını sana çeviriyor.",
        gain: {
          kind: "clue",
          label: "Sönmüş Nöbetçi",
          note: "Taş kemerin altında, paslı zırhlı, runelerle mühürlü eski bir muhafız",
        },
      },
      {
        kind: "roll",
        actor: "ozge",
        prompt: "Nöbetçi harekete geçmeden büyünü tamamlamalısın. Hızlı bir Büyü kontrolü at.",
        dc: 12,
        success: "Küre parlayarak patlıyor; nöbetçi bir an sersemliyor ve siz o boşlukta kemerin altından geçiyorsunuz.",
        failure: "Büyü sönüyor. Nöbetçinin paslı kılıcı havada bir yay çiziyor — Can araya atılıp darbeyi kalkanıyla karşılıyor.",
      },
      { kind: "line", who: "can", text: "Hadi! Açıklık kapanmadan geçin!" },
      {
        kind: "narration",
        text: "Kemerin ardında orman bambaşka: ağaçlar daha yaşlı, hava daha ağır. Gölge Orman sizi içine aldı. İlk bölümün eşiğini geçtiniz.",
      },
      { kind: "scene", title: "Bölüm 1 — Son", subtitle: "Demo burada bitiyor", mood: "calm" },
    ],
  },

  {
    id: "istanbul-exe-1",
    seriesId: "istanbul-exe",
    episode: 1,
    title: "Rüya Departmanı · 1. Kısım",
    narratorAvatar: "/assets/avatars/istanbul-exe/narrator.webp",
    characters: [
      { id: "gm", name: "Anlatıcı", player: "Soykan Söner", role: "Oyun Yöneticisi", face: "🎲" },
      { id: "ozge", name: "Rosie", player: "Özge Özel", role: "Empat · Metin Yazarı", face: "🔮", avatar: "/assets/avatars/istanbul-exe/rosie.webp" },
      { id: "can", name: "Leo", player: "Can Girgin", role: "Hacker (19)", face: "💻", avatar: "/assets/avatars/istanbul-exe/leo.webp" },
      { id: "okan", name: "Tahir", player: "Okan Asman", role: "Eski Kolluk · Pazarlamacı (35)", face: "🕶️", avatar: "/assets/avatars/istanbul-exe/tahir.webp" },
      { id: "marek", name: "Marek", player: "Soykan Söner", role: "Departman Amiri", face: "🧛", avatar: "/assets/avatars/istanbul-exe/marek.webp", npc: true },
      { id: "parker", name: "Parker", player: "Soykan Söner", role: "Müşteri · 47", face: "🥱", avatar: "/assets/avatars/istanbul-exe/parker.webp", npc: true },
      { id: "selim", name: "Selim", player: "Soykan Söner", role: "Parker'ın Avukatı", face: "👔", avatar: "/assets/avatars/istanbul-exe/selim.webp", npc: true },
    ],
    beats: [
      {
        kind: "scene",
        title: "istanbul.exe",
        subtitle: "1. Kısım · Cyberpunk İstanbul · Sabah",
        mood: "tense",
        art: {
          src: "/assets/scenes/istanbul-open.webp",
          alt: "Cyberpunk İstanbul: cami kubbesi ve minareler, arkada neon gökdelenler, Boğaz köprüsü ve vapur",
          video: {
            webm: "/assets/scenes/istanbul-open.webm",
            mp4: "/assets/scenes/istanbul-open.mp4",
          },
        },
      },
      {
        kind: "narration",
        text: "Soykan masaya 20'lik zarı koyuyor: 'Ben ne gördüğünüzü, ne duyduğunuzu, ne kokladığınızı anlatırım; siz ne yapmak istediğinizi söylersiniz. Anlaşamazsak zar atarız.' Bugün hayal gücünde kalmış bir İstanbul'dayız — cyberpunk bir evren.",
      },
      {
        kind: "narration",
        text: "İki kıtayı yıllar boyunca birbirine bağlamış boğaz, artık şehrin insanlarını ayıran, herkese haddini bildiren bir gümrük kapısına dönüşmüş. Alt mahallelerde oturanlar ancak belli kontrollerle, bir işleri ya da çalışıyorlarsa karşıya geçebiliyor. İki taraftaki gümrüğü de Pars şirketi tutuyor.",
      },
      {
        kind: "narration",
        text: "Siz Realite şirketinin rüya departmanında çalışan üç zihin işçisisiniz. Realite, İstanbul'un bütün medyasını, eğitimini, hatta bazı bireylerin hafıza ve sinir sistemlerini kontrol ediyor. Sizin işiniz: rüya görmeyenlere rüya yazmak, şirketin onaylamadığı rüyaları gören­lerinkini de törpülemek.",
      },
      {
        kind: "narration",
        text: "Şişli. Rosie 1+1 evinde, maskeli kedisiyle tek başına yaşıyor. Bir empat: çevresindeki herkesin duygusunu, düşüncesini oturuşundan, mimiğinden sezdiği için evinde neredeyse hiç eşya yok — eşyalar bile zihnini bulandırıyor. Kalkıyor, kahvesini içiyor, kediye kapsüllerini veriyor, üstüne zimmetli şirket arabasına biniyor.",
      },
      { kind: "line", who: "ozge", text: "Önce Leo'yu evinden alacağım, sonra gümrükten Tahir'i. Kısacık bir yolculuk; ne trafik var artık ne de sokakta araba." },
      {
        kind: "narration",
        text: "Leo'nun evi Beyoğlu'nda: tek göz, camları gazete ve bantla kapatılmış, hiç güneş almayan izbe görünümlü bir yer; analog makinelere düşkün olduğu için birkaç koleksiyon parçası var. Bilgisayarının başında, her zamanki gibi geç kalmış ve geç kaldığının farkında bile değil. Telefonunu kapatmış; ince camını taşla çalıyorsunuz.",
      },
      { kind: "line", who: "can", text: "Benim işlerim var abi, freelance işler yetiştiriyorum... Geç mi kaldım? Pek farkında değilim ya. Biraz yoğunum, bilgisayar başındayım." },
      { kind: "line", who: "okan", text: "Balım, ben köprüdeyim, köprüdeyim! Ne olur çok bekletmeyin, kötü oluyorum." },
      { kind: "line", who: "ozge", text: "Biliyorum canım, geliyoruz — 5 dakika. Bir sigara iç, soluklan; hemen gelip alıyorum seni." },
      {
        kind: "narration",
        text: "Tahir'in beklediği yer eskilerin Boğaziçi Köprüsü dediği, şimdi gümrük kapısı olan merdivenler. 15-20 basamak çıkıp köprüye varıyorsunuz: kapalı bir sera gibi, tepesinde 24 saat ağır silahlı dronelar uçan, Pars askerlerinin beklediği bir geçit. Her gün gördüğünüz gümrük memuru yürüyüşünüzü izleyerek karşılıyor; kamera, parmak izi.",
      },
      { kind: "line", who: "okan", text: "Günaydın memur bey, kolay gelsin. Bakalım kameraya, parmağı tutalım — gerekli işlemleri yapalım da geçelim." },
      {
        kind: "narration",
        text: "'Artık işleyen bir sistemin parçasısın.' Kapıyı geçtikten sonra şehir ışıldamaya başlıyor: gökyüzüne bile sirayet eden o pembe, o mavi neon. Yıllardır gününüzün yarısını bu tarafta geçirdiğiniz için iş heyecanı ve gün başlıyor.",
      },

      {
        kind: "scene",
        title: "Realite Plaza",
        subtitle: "9. Kat · Rüya Departmanı",
        mood: "wonder",
        art: {
          src: "/assets/scenes/realite-plaza.webp",
          alt: "Loş rüya-tekno ofis: parlayan rüya kapsülleri, panoramik pencerede cyberpunk İstanbul silueti",
        },
      },
      {
        kind: "narration",
        text: "Maslak'ta, şirketlerin merkezinde 50 katlı bir plaza. Girişte 'Hissetmenin Ağırlığından Kurtul' afişi — şirketin kendi reklamı — sizi karşılıyor. Resepsiyondaki o üçlü kafa selamı verip RFID parmaklarınızla giriş yapmanızı bekliyor. 9. kata, rüya departmanına çıkıyorsunuz: bomboş bir kat, çalışan az, çoğu sahada; 24 saat açık. Koridorun sonunda Marek odasında bekliyor. Gözleri yine mor.",
      },
      { kind: "line", who: "marek", text: "Rüya gördün mü bugün Leo? ...Uyumuyor musun sen? Sistemde rüyan yok. Görmeyen gösterir mi? Rüya görmeyen bir insanın ekipte bulunması görülmüş şey değil." },
      { kind: "line", who: "can", text: "Uyuyorum işte, dün gece 15 dakikadan kısa kez kez uyudum. Küçük küçük, power-nap gibi. Belli bir dakikadan aşağısı demo olarak düştüğü için sisteme girmiyor, o yüzden görünmüyor." },
      { kind: "line", who: "okan", text: "Minik minik alıştırıyorum kendisini Marek Bey, daydreaming gibi. Çok yoğun çalışıyor; bu akşam güzel bir rüya görecek, söz veriyorum." },
      { kind: "line", who: "marek", text: "Bana anlatma, ben neyin ne olduğunun farkındayım. Son bir hafta daha veriyorum. Ellerine sağlık, şirketimiz için önemli bir değersin — ama böyle olmaz." },
      { kind: "line", who: "marek", text: "Asıl mesele: Galata ve civarında bir kabus anomalisi tespit ettik. Bazı insanlar çok benzer rüyalar görüyor ama içeriğine ulaşamıyoruz. Bu sefer rüya göstermenizi değil — rüya görmenizi istiyorum. Ne gördüklerini bilmem lazım." },
      { kind: "line", who: "ozge", text: "Bir dış etkenden mi şüpheleniyorsunuz? Bizim yaptığımız işi yapan başkaları mı var?" },
      {
        kind: "roll",
        actor: "ozge",
        prompt: "Marek rahat görünüyor, 'halledin gelin' diyor. Ama bir empat olarak ona uzun uzun bakıyorsun — gerçekte ne hissettiğini oku. Bir Empati kontrolü at.",
        dc: 12,
        canonRoll: 18,
        canonSuccess: true,
        success: "Konuşmasından belli etmediği bir tedirginlik seziyorsun. Özellikle 'bu başıma ekşiyor' dediği yerlerde bir kaş çatması, burun kanadında bir gerginlik, şakakta sertleşen bir damar — paternleri yakalıyorsun. Topun ağzında: Marek'in sana söylemediği bir korkusu var.",
        failure: "Yüzünü kapatmayı iyi biliyor. Bir tedirginlik kıvılcımı seziyorsun ama parmak basamıyorsun — net bir okuma alamadın.",
      },
      { kind: "line", who: "marek", text: "Bu haftaki rutin rotalarınızın hepsini iptal ediyorum. Sadece bununla uğraşacaksınız. Çözün — ben yukarıya hesap veremem. Kısa süre içinde çözerseniz krediyle ilgili bir şey düşünmenize de gerek kalmaz, sözüm senet." },
      { kind: "line", who: "okan", text: "Müdürüm, bugün satış primi düzenlememiz vardı; standart satışa gidemeyince oradaki eksik tolere edilir, bir bonus gibi geçer değil mi?" },
      {
        kind: "narration",
        text: "Marek bunu nazikçe yok sayıyor. Bunun yerine Leo'ya çoktan söz verdiği bir şeyi getirtiyor: eski bir film bandı, altına bantlanmış bir VHS kaset — üzerinde 'Johnny Mnemonic', bir Keanu Reeves filmi. Leo çocuk gibi gülümseyip sıkıca sarılıyor. 'İşe yaramayan ne varsa hep benim canıma' diye söyleniyor Tahir, kıskançlıkla. Elinizde anomaliyi yaşayan 27 kişilik bir liste var.",
      },
      { kind: "line", who: "can", text: "27 kişi, hepsi aynı gece çok benzer rüya görmüş — hepsini bugün dolaşamayız. İlk uykuya dalan Parker: 47 yaşında, risk puanı çok düşük, 29. Bir de en yükseği var — Melis: 24 yaşında, 71 risk puanı, üstelik konumu tam Beşiktaş sınırında." },
      {
        kind: "choice",
        actor: "okan",
        prompt: "Günü iki kişiyle kapatmayı planlıyorsunuz. Önce kimin kapısını çalalım?",
        options: [
          { text: "Parker — ilk uykuya dalan, 29 risk; ısınma turu (belki bir abonelik bile satarız)", canon: true, result: "Cihangir'e, Parker'a yöneliyorsunuz. 'Önce ısınalım, ne görmüş bir anlatsın; 47 yaşına abonelik bile satarız' havasında. Sonra Melis." },
          { text: "Melis — 71 risk, en yükseği; doğrudan meselenin göbeğine dalalım", result: "Beşiktaş sınırına, Melis'e dönüyorsunuz. Sabah sabah en riskliden başlamak Tahir'in pek içine sinmiyor ama merak ağır basıyor." },
        ],
      },

      {
        kind: "scene",
        title: "Cihangir",
        subtitle: "Parker'ın Evi",
        mood: "danger",
        art: {
          src: "/assets/scenes/cihangir.webp",
          alt: "Cihangir'de loş, eski bir daire; yağmurlu pencerede kızıl bir parıltı, dışarıda neon şehir",
        },
      },
      {
        kind: "narration",
        text: "Eski bir Çin mahallesi; arka sokaklardan birinde, binanın altındaki neon ışıklı dükkân yüzünden cıvıl cıvıl. Tek tip sentetik hamburgerler; insanlar parmaklarını gösterip 'dıt' sesinden sonra sandviçlerini alıp gidiyor, kapısında sıra var. Asansör burada nadir — döner bir merdivenle dört katlı eski bir Beyoğlu binasının tepesine çıkıyorsunuz. Kapının ardından, zincirin aralığından size bakan yaşlıca bir çift göz.",
      },
      { kind: "line", who: "okan", text: "Merhaba Parker Bey, ben Tahir. Arkadaşlarımla Realite adına ziyaret ediyoruz — ufak bir tanıtım, bir de sohbet etmek istedik. Naçizane minik bir kampanyamız da var. Çok kısa sürecek, inanın." },
      {
        kind: "narration",
        text: "Zincirleri, kilitleri tek tek açıyor. Beklediğinizden çok daha kısa boylu bir adam — 1.55-1.60 — bir yükseltinin üzerinden konuşmuş; inip yükseltiği ayağıyla kapı arkasına itiyor. Geniş, yüksek tavanlı, o eski Cihangir evlerinden. Üstünde gri penye bir hırka; 40'larının sonunda olsa da daha yaşlıymış gibi. Önünde yarım kalmış jölemsi kırmızı ve mavi bir yemek, su, ekmek. Gözleri kan çanağı, gözaltları mosmor.",
      },
      { kind: "line", who: "ozge", text: "Biraz yorgun gözüküyorsunuz Parker Bey. Kötü bir akşam mıydı?" },
      { kind: "line", who: "parker", text: "Belki de rutinleşti hayatım. Uykularım biraz zorlaştı, alışırım. Siz ne için gelmiştiniz? Realite buralara pek uğramaz." },
      {
        kind: "narration",
        text: "Parker birini arıyor; tableti, sizi görebileceği bir yere koyuyor. Takım elbiseli, kravatlı, çok janti biri — avukatı Selim — ofisinden, hologramların arasından bağlanıyor; arkasındaki camdan bu yakadan boğaz manzarası görünüyor.",
      },
      { kind: "line", who: "selim", text: "Merhabalar efendim, kolay gelsin. Ben bugün için sadece gözlemci olacağım." },
      { kind: "line", who: "can", text: "Şu chart dün gece rüya dalgalanmalarınızı gösteriyor Parker Bey. Bu dalgalar normalde bu kadar aşağı inmez; indiyse şunu anlatır: dün gece kabus görmüşsünüz. Bununla ilgili konuşmak isteriz." },
      { kind: "line", who: "parker", text: "Ben rüya falan görmüyorum. Kabus da görmüyorum. Hiçbir şey görmüyorum." },
      {
        kind: "narration",
        text: "Tahir, kayıt sürsün diye Leo'ya 'Rosie'yi kaydet' diye fısıldayıp onu aşağı sandviç kuyruğuna yolluyor. Rosie, Parker ve avukat Selim'le baş başa kalıyor. Selim araya giriyor: şirket politikası gereği yüzünüz blur'lanmadan kayda izin yok — kimlikleriniz, çalışan kartınız zaten sistemde, geldiğiniz belli; bu şekilde uygun. Empat asıl sohbeti şimdi açıyor.",
      },
      { kind: "line", who: "ozge", text: "İlk ne zaman böyle yorgun hissettiniz Parker Bey? Canınızı sıkan, uykunuzu kaçıran ufacık bir detay bile olur." },
      { kind: "line", who: "parker", text: "İki hafta önce. Pazar günü. Hep 11'de uyurum, o gece olmadı; çok uğraştım ama uyuyamadım. Açıkçası olduğum yerden de pek memnun değilim son zamanlarda." },
      {
        kind: "narration",
        text: "İlk ipucu elinizde: iki hafta önce, bir pazar. Parker anlatıyor — çocukken rüyalarını dışarıdan izlermiş; o sıralar ailesiyle Amerika'daymışlar. İlk implantını annesi seçtirmiş, güzel bir gündü. Bir de 45 yıl 'otonom hayatta kalma' implantıyla, otomatik pilotta, hiçbir şey düşünmeden yaşamış; sonra kapattırmışlar. Yorgun, aidiyetsiz bir adam — Rosie bir 'demo rüya' fırsatı seziyor.",
        gain: {
          kind: "clue",
          label: "Parker'ın geçmişi",
          note: "Bir pazar uyuyamadı · 45 yıl otonom implant · annesiyle Amerika · 'demo rüya' fırsatı",
        },
      },
      { kind: "line", who: "ozge", text: "Sorumluluk almadığınız o eski, hafif yıllara dair ücretsiz bir 'demo rüya' yazsak — annenizin yanında olduğunuz günlerden. Ne yapıyor olmak isterdiniz?" },
      { kind: "line", who: "parker", text: "Engin bir denizin ortasında olmak isterdim. Ucu bucağı görünmesin; bu balçık boğazın suyundan bıktım. Küçük bir tekne, dümeninde ben olayım — baş kaptan da olmasın, ben kullanayım. Ve yanımda annem olsun." },
      {
        kind: "choice",
        actor: "ozge",
        prompt: "Demo rüyanın kalbine neyi koyalım? Parker'ı ne yumuşatır?",
        options: [
          { text: "Engin denizde küçük bir tekne — dümende Parker, yanında annesi", canon: true, result: "Parker'ın gözleri parlıyor: 'Tam da bu, bunu rüya olarak görebiliyorsak güzel.' Tekne, açık mavi bahar göğü, annesinin elinde o sevdiği jöle... Notlar alınıyor." },
          { text: "Amerika'daki çocukluk sokakları — ilk implantını seçtiği o gün", result: "Güzel bir anı ama Parker'ın yüzü hafif geriliyor; o sokaklar artık çok uzakta. Onun yerine denize, tekneye yöneliyorsunuz." },
        ],
      },
      {
        kind: "narration",
        text: "Demo için sözleşiliyor: yarın akşam vardiyasından önce, hava kararmadan 5'e kadar gelinecek; Parker'ın bir film gözlüğü var, iş görür. Notlar alınıyor, kibarca ayrılıyorsunuz. Tahir ve Leo'yla arabaya iniyorsunuz; saat ilerledi. Sıra günün en riskli isminde: Beşiktaş sınırında, 24 yaşında, 71 risk puanlı Melis.",
      },
      { kind: "scene", title: "1. Kısım — Son", subtitle: "Parker'ın demosu yarına. Sırada Melis var → 2. Kısım.", mood: "calm" },
    ],
  },

  {
    id: "istanbul-exe-2",
    seriesId: "istanbul-exe",
    episode: 2,
    title: "Galata'nın Kabusu · 2. Kısım",
    narratorAvatar: "/assets/avatars/istanbul-exe/narrator.webp",
    characters: [
      { id: "gm", name: "Anlatıcı", player: "Soykan Söner", role: "Oyun Yöneticisi", face: "🎲" },
      { id: "ozge", name: "Rosie", player: "Özge Özel", role: "Empat · Metin Yazarı", face: "🔮", avatar: "/assets/avatars/istanbul-exe/rosie.webp" },
      { id: "can", name: "Leo", player: "Can Girgin", role: "Hacker (19)", face: "💻", avatar: "/assets/avatars/istanbul-exe/leo.webp" },
      { id: "okan", name: "Tahir", player: "Okan Asman", role: "Eski Kolluk · Pazarlamacı (35)", face: "🕶️", avatar: "/assets/avatars/istanbul-exe/tahir.webp" },
      { id: "melis", name: "Melis", player: "Soykan Söner", role: "Sibernetik · 24", face: "🦾", avatar: "/assets/avatars/istanbul-exe/melis.webp", npc: true },
    ],
    beats: [
      {
        kind: "scene",
        title: "Arabada",
        subtitle: "2. Kısım · Beşiktaş'a Doğru",
        mood: "tense",
        art: {
          src: "/assets/scenes/araba.webp",
          alt: "Eski bir aracın ön camından yağmurlu neon İstanbul caddesi; ışık izleri, ıslak asfalt",
        },
      },
      {
        kind: "narration",
        text: "Parker'ın evinden çıkıp arabaya biniyorsunuz; Beşiktaş'a doğru yola koyuluyorsunuz. Tahir tablete aldığı notları Leo'ya devrediyor: 'Her şeyi benim not ettiğim kelimelerle, sıfatlarla kodla. Bir kelimeyi sıfırdan bire indirip kuru kuru geçme — insan gibi, betimleye betimleye yaz. Ben pazarlamacıyım, sen de işçilik yap.' Leo kulaklığını takıyor; ama araba sallanıyor, herkes bağırıp duruyor.",
      },
      {
        kind: "roll",
        actor: "can",
        prompt: "Sallanan arabada, bağrış çağırış arasında Parker'ın demo rüyasını kodlamaya çalışıyorsun. Bir Kodlama kontrolü at — hedef yüksek, çünkü ortam berbat.",
        dc: 16,
        canonRoll: 9,
        canonSuccess: false,
        success: "Parmakların uçuyor; tekne, gökyüzü, annenin gülümsemesi temiz katmanlar halinde oturuyor.",
        failure: "Araba sallanıyor, ortam gürültülü — anca 9 tutturabiliyorsun, tam odaklanamadın. İskelet duruyor ama üzerinde sonra Soykan'la oturup tek tek işlemeniz gerekecek; şimdilik ham bir taslak.",
      },
      { kind: "line", who: "okan", text: "Sat bana rüyayı, anlat bakayım nasıl olacak. Parker müthiş huzurlu bir uykudan uyanıyor; gözünü açıyor, zemin hafif sallanıyor — bir teknede. Annesi aşağıdaki kamaradan çıkıyor, elinde o sevdiği jöle. İyot kokusu ekle, hafif yasemin, açık mavi bir bahar göğü — soluk değil, canlı olsun." },
      {
        kind: "narration",
        text: "Detaylar yığılıyor: gün batımı annenin yüzüne usulca vursun, Parker annesinin kucağına uzansın, çamaşır yumuşatıcısının o ev kokusu sinsin... Bir de zorunlu Zotek reklamı var — şirket koşulu — ama göze sokmadan: tam anneyi net görmeden önce, tabağın kenarında ufak bir logo gibi, 14 saniye yedirilecek. Ve sonu: Parker tam konuşacakken, en güzel yerde uyandır. 'Devamı için belki abone olursun.' Cliffhanger ustası Tahir bu finali çok seviyor.",
      },

      {
        kind: "scene",
        title: "Beşiktaş Sahili",
        subtitle: "Yeni İstanbul · Melis'in Binası",
        mood: "wonder",
        art: {
          src: "/assets/scenes/besiktas.webp",
          alt: "Sisli, balçık rengi Beşiktaş sahili; yarı batık binalar, tekneler, uzakta minare silueti",
        },
      },
      {
        kind: "narration",
        text: "Dolmabahçe'yi geçip sahile iniyorsunuz: kaçakçıların, tüccarların, kara borsanın uğrağı bir semt. Deniz balçıklaşmış, asit yağmurlarıyla zehirlenmiş, üstünde dev kargo gemileri demirli. Sokaklar bomboş ve sessiz — burada gün, sizin saatlerinizde başlamıyor; bu mahalle geceleri uyanıyor. Belirtilen binanın önündesiniz; Melis ikinci katta.",
      },
      { kind: "line", who: "ozge", text: "Mahallenin enerjisine bakıyorum... Bir sessizlik var ama bu sefer üstüne çok fazla martı sesi biniyor, kulak tırmalayacak kadar gürültülü. Sıfır yeşillik, çarpık bir kentleşme — burası hiç iyi hissettirmiyor, içimi sıkıyor." },
      {
        kind: "roll",
        actor: "can",
        prompt: "Arabadan inerken sistemlerinde bir glitch, rahatsız eden bir parazit hissediyorsun. Kaynağını bul — bir Siber Tarama kontrolü at. (Hedef düşük ama jammer işi zorlaştırıyor.)",
        dc: 11,
        canonRoll: 13,
        canonSuccess: true,
        success: "Kıl payı — 13. Tam bu binadan bir jammer sinyali geldiğini çözüyorsun. Sokağın başında, arabayı park ederken yoktu; inince başladı. Düzenli ama kaotik: sistemini kesip kesip geri getiriyor, yaklaştıkça tamamen kesiyor. Birileri burada bağlantı istemiyor.",
        failure: "Bir şeyler kıpırdıyor sistemde ama net oturtamıyorsun; yine de binaya yaklaştıkça bağlantının bozulduğu kesin.",
      },
      { kind: "line", who: "okan", text: "Jammer varsa içeri sen gelmiyorsun Leo, dışarıda kal. Belki kız koymadı, komşu koydu — bize 'Realite'den geldik' dedirtmeden hayır der. Rosie kapıyı çalsın, kayıt açık, ben idare ederim. Sen fırsat bulursan iz bırakmadan, ghost gibi sız." },

      {
        kind: "scene",
        title: "İkinci Kat",
        subtitle: "Melis",
        mood: "danger",
        art: {
          src: "/assets/scenes/melis.webp",
          alt: "Çürümüş, karanlık bir apartman koridorunda kilitleri açık, aralık duran ağır bir kapı; loş kızıl ışık sızıyor",
        },
      },
      {
        kind: "narration",
        text: "Apartman giriş kapısı açık; ikinci kata çıkıyorsunuz. Rosie kapıyı çalıyor. İçeriden önce sert bir 'İstemiyorum, sağ olun' geliyor. Sonra kapı yarım aralanıyor, art arda kilit sesleri ve aralıktan dışarı uzanan tek bir şey: kaba, derisiz, kara-gri, eklemleri açıkta bir biyonik kol. O kolun ucundaki metal elde bir bardak su, size uzatılıyor.",
      },
      {
        kind: "roll",
        actor: "ozge",
        prompt: "Suyu alıyorsun; aralıktan içerisi, kapının ardındaki kadın ve binanın tüm havası bir anda üstüne geliyor. Bir empat olarak bu ağır enerjiyi oku — bir Empati kontrolü at.",
        dc: 12,
        canonRoll: 15,
        canonSuccess: true,
        success: "İçeriden taşan enerji öyle ağır ki neredeyse fiziksel: bir bunalım, bir yalnızlık, kapana kısılmışlık. Bu kadın çok kötü durumda — ve tehlikeli değil, çaresiz. Onu kazanmanın yolu dürüstlükten geçiyor; bunu net hissediyorsun.",
        failure: "Ağır bir şey var havada ama bulanık; yine de bu evde birinin çok kötü olduğunu seziyorsun.",
      },
      {
        kind: "narration",
        text: "Suyu uzatan biyonik kola parmaklarınla değiyorsun — belki metalden de bir şey okursun diye. Ama hiçbir şey. Metal iletken; duygu taşımıyor, el bir taş gibi sessiz. Bir insandan değil, ancak çevreden okuyabiliyorsun. (Burada zar yok — Soykan yalnızca 'Hiçbir şey' diyor.)",
      },
      { kind: "line", who: "ozge", text: "Bu binada çok ağır bir enerji var Melis Hanım. Siz iyi misiniz? İçeride iyi misiniz?" },
      { kind: "line", who: "melis", text: "Ben hiç iyi değilim. İki dakika soluklanmamız mümkün mü?" },
      { kind: "narration", text: "Bir sessizlik. Sonra kilitler — hepsi, tek tek, takırtıyla — açılıyor. Kapı ardına dek açılıp içeri buyur ediliyorsunuz." },
      {
        kind: "narration",
        text: "Melis karşınızda: bir kolu tamamen biyonik, bir bacağı dizden aşağısı biyonik, çenesi anormal öne çıkmış, koyu kızıl küt saçlı; kulağında garip sembollerle bezeli küpeler, yürürken paslı, gıcırtılı sesler çıkarıyor. Bu kadar implantı bir arada taşıyan birinin zihnen çoktan dağılmış olması gerekir; ama o, jelibon tadında kırmızı suyunu pipetle içip aksi aksi konuşuyor. 'Benim çıkmam lazım, kısa tutalım.'",
      },
      { kind: "line", who: "okan", text: "Melis Hanım, biz aslında bir şey satmaya gelmedik. Anladığım kadarıyla mental olarak çok zorlanıyorsun, bu rüyalarına yansıyor — ve bunu yaşayan tek kişi sen değilsin. Sabahtan beri ev geziyoruz. Bunu birlikte çözebilir miyiz diye buradayız." },
      { kind: "line", who: "melis", text: "Çözmek istiyorsanız şirketinizi kapatın o zaman. Rüyalarımda hep Realite şirketini görüyorum, uyanınca çok kötü oluyorum. Neyse... Bir pahalı rüyam var anlatacak, bir de ucuzu. Hangisini istersiniz?" },
      { kind: "narration", text: "Pahalısı için karşılığında 400 hap istiyor — bu mahalleyi bir hafta ayakta tutacak kadar besin/ilaç hapı." },
      {
        kind: "roll",
        actor: "ozge",
        prompt: "Bu kadın doğruyu mu söylüyor, yoksa fiyatı şişirip sizi mi kafalıyor? Aksiliğinin altında ne var, oku — bir Empati kontrolü at.",
        dc: 5,
        canonRoll: 6,
        canonSuccess: true,
        success: "Kıl payı geçiyorsun ama yetiyor: bu kadın dürüst. Aksi, ters, bıkkın — ama yalan yok. İçinden 'bu kıza tutun, bu işin doğrusu burada' der gibi bir his geçiyor. Dürüstlüğün adresi burası.",
        failure: "Net bir okuma alamıyorsun; yine de aksiliğinin altında bir samimiyet seziliyor. Pazarlığa güvenip girmek Tahir'e kalmış.",
      },
      {
        kind: "choice",
        actor: "okan",
        prompt: "400 hap masada. Yılların pazarlamacısı olarak nasıl karşılık verirsin?",
        options: [
          { text: "Aşağı çek: 'Bu mahallenin haftalık ihtiyacı bu kadar etmez' → ortada buluş", canon: true, result: "'Senin gibi bir implantlıyla bu mahalle çok daha azına döner, gel makul bir rakamda kapatalım.' Çekiştire çekiştire 160 hapta el sıkışıyorsunuz; ihtiyaç olursa tekrar konuşulacak." },
          { text: "400'ü kabul et — değerli bir rüya, riske girme", result: "Melis şaşırıyor; bu kadar kolay pazarlık bu şehirde olmaz. Yine de anlaşma 160 civarında bağlanıyor, çünkü Tahir'in de bir sınırı var." },
        ],
      },
      {
        kind: "narration",
        text: "Anlaşma tamam. Ama Tahir doğrulama istiyor: '160 hap vermeden önce doğru söylediğine emin olmam lazım — izninle zihnine bağlanıp kaydı alalım.' Melis kabul ediyor: 'Girmenizi istemediğim yerlere zaten girilmez, merak etmeyin. İşlem kayıtlı olur.' Gözlüğü takıp koltuğa yaslanıyor, anlatmaya hazırlanıyor. Bu sırada Leo, köşedeki eski masaüstü bilgisayarına çoktan dalmış — jammer'a rağmen izinle bağlı.",
      },
      {
        kind: "roll",
        actor: "can",
        prompt: "Melis sohbete dalmışken bilgisayarındaki günlüğünü ara — 'kabuslar, rüyalar' diye. Jammer kesip duruyor ama izin var. Bir Sızma/Arama kontrolü at.",
        dc: 14,
        canonRoll: 19,
        canonSuccess: true,
        success: "...ve enter. 19 — bir günlük dosyası açılıyor: 'Annem artık rüyaları sayıyor. Geçen kapalı çarşıya gittik, dükkânın birinde yaşlı bir amca... Ben sadece kitap satmıyorum, dedi, bazen geceler de satılır; istersem gecelere bedava hükmedebilirmişim.' Sayfanın kenarında bir ibare: 17B — Katip Kitapları. İkinci bölümün ipucu elinde.",
        failure: "Dosyalara değiyorsun ama jammer kesip duruyor; sadece yarım bir satır gözüne çarpıyor — 'geceler de satılır' — gerisi parazitte kayboluyor.",
      },
      {
        kind: "roll",
        actor: "can",
        prompt: "İzinli kaydın arkasından, gizlice Melis'in zihnine kalıcı bir backdoor açmaya çalışıyorsun. Çok riskli, çok yüksek hedef — bir Hack kontrolü at.",
        dc: 16,
        canonRoll: 9,
        canonSuccess: false,
        success: "Sessizce vektöre giriyorsun; kimse fark etmiyor, ham veriyi sızdırıyorsun.",
        failure: "Sadece 9 — yetmez. Enter'a bastığın an Melis bir gerildi, boynunu düzeltti, anlatmayı yarıda kesip etrafa baktı — neyse ki sonra sohbete döndü. Backdoor tutmadı; elinde yalnızca onun izin verdiği kayıt kalıyor.",
      },
      { kind: "line", who: "melis", text: "Yağmur yağıyordu, asit gibiydi, her damlası canımı yakıyordu. Bir araba — şu ucube, hurda olanlardan — bana doğru geliyor ama bir türlü ulaşamıyor. Üç gün üst üste aynı rüya. Son gördüğümde araba tam evimin önünde durdu ve siz çıktınız. Tam o an bir şeyler bozuldu. Yarın yine gelecek misiniz?" },
      {
        kind: "narration",
        text: "Rüyadaki araba siz misiniz? Kabusun tam ortasında neden Realite var? Galata'nın anomalisi, kapalı çarşıdaki o amca, '17B Katip Kitapları'... ipler çoğalıyor, düğüm büyüyor. İşte İstanbul.exe senaryosunun ilk bölümünün sonuna geldiniz. Haftaya ikinci bölümde görüşmek üzere — senaryoyu bizimle birlikte ilerletin.",
        gain: {
          kind: "clue",
          label: "17B · Katip Kitapları",
          note: "Melis'in günlüğünden: kapalı çarşıda bir amca · 'geceler de satılır' · 2. bölümün ipucu",
        },
      },
      { kind: "scene", title: "Bölüm 1 — Son", subtitle: "İpucu: 17B · Katip Kitapları. Devamı haftaya.", mood: "calm" },
    ],
  },
];

export const scenariosForSeries = (seriesId: string): Scenario[] =>
  scenarios.filter((s) => s.seriesId === seriesId);

export const hasScenarios = (seriesId: string): boolean =>
  scenarios.some((s) => s.seriesId === seriesId);
