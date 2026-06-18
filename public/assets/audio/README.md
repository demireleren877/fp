# Oyun Müzikleri — dosya kuralı

Adaptif müzik motoru (src/audio/GameAudio.ts) bu klasördeki dosyaları kullanır.
Dosya **yoksa** motor sessizce çalışır; koydukça otomatik devreye girer.
Format: **.mp3** (en geniş uyumluluk). Loop'lar **kusursuz döngülenebilir** (seamless) olmalı.

## Döngü (loop) dosyaları — mood'a göre
İstanbul.exe (cyber) — öncelikli:
- cyber-calm.mp3     → sakin / melankolik synth ambient
- cyber-tense.mp3    → düşük tempolu gerilim, nabız gibi bas
- cyber-danger.mp3   → tehditkâr, yüksek tansiyon
- cyber-wonder.mp3   → geniş, etkileyici, hayranlık uyandıran pad

Gölge Orman (forest) — opsiyonel:
- forest-calm.mp3    → sakin fantezi/orman ambient
- forest-tense.mp3   → kasvetli orman gerilimi
- forest-danger.mp3  → tehlike, davul/gerilim
- forest-wonder.mp3  → büyülü, mistik

## Stinger (tek atımlık vuruş)
- stinger-scene.mp3  → her yeni sahnede kısa geçiş (~1-2 sn whoosh/impact)
- stinger-crit.mp3   → Doğal 20 (ihtişamlı pozitif vuruş)
- stinger-fail.mp3   → Doğal 1 (olumsuz / düşüş)
