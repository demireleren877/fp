# Karakter Avatarları — dosya kuralı

Oyun içi konuşma balonları, karakter seçimi ve HUD'da gösterilen AI portreler.
Dosya **yoksa** ilgili karakter emoji yüzüne düşer (güvenli). Koydukça otomatik görünür.

- Format: **.webp** (kare, tercihen 512×512), portre/baş-omuz, daire içine oturur.
- Aynı stil/ışık tutarlı olsun ki masa birlikte görünsün.

## Klasör düzeni — oyun bazlı
İzolasyon hem kodda (motor sadece aktif senaryonun karakterlerini çözer) hem de
**fiziksel olarak** klasörde: her oyunun avatarları kendi alt klasöründe. Ortak
(genel) anlatıcı kökte durur. Yollar `src/data/scenarios.ts`'te tek tek yazılı.

```
avatars/
  narrator.webp            → genel/nötr anlatıcı (tüm oyunlar) — fallback
  istanbul-exe/            → İstanbul.exe oyununun avatarları
    narrator.webp          → İstanbul.exe'ye özel anlatıcı (cyberpunk)
    rosie.webp   → Rosie  (empat, metin yazarı)
    leo.webp     → Leo    (19, hacker)
    tahir.webp   → Tahir  (35, eski kolluk · pazarlamacı)
    marek.webp   → Marek  (departman amiri)
    parker.webp  → Parker (47, müşteri)
    selim.webp   → Selim  (Parker'ın avukatı)
    melis.webp   → Melis  (24, ağır sibernetik)
  golge-orman/             → (ileride) Gölge Orman avatarları
```

> Yeni oyun = yeni alt klasör. Bir karakterin avatarını seçmek = scenarios.ts'te o
> karakterin `avatar:` yolunu, anlatıcıyı seçmek = senaryonun `narratorAvatar:` yolunu
> ilgili alt klasöre göstermek. Aynı dosya adı farklı oyunlarda ayrı klasörde durduğu
> için isim çakışması olmaz.
