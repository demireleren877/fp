/**
 * Senaryonun ruh haline (mood) ve sahne geçişlerine duyarlı, basit ama sağlam
 * adaptif müzik motoru. HTMLAudioElement + manuel ses rampası ile pürüzsüz
 * crossfade yapar; Web Audio'nun decode/buffer yükünü taşımaz.
 *
 * - Loop dosyaları: /assets/audio/{ambiance}-{mood}.mp3  (ör. cyber-tense.mp3)
 * - Stinger (tek atımlık): /assets/audio/{name}.mp3      (ör. stinger-scene.mp3)
 *
 * Dosya yoksa (404) sessizce yok sayılır — motor her zaman güvenli.
 * Tarayıcı autoplay politikası: ses ancak kullanıcı etkileşiminden sonra çalar;
 * bu yüzden `setEnabled(true)` ilk gesture'da yeniden denemek için kanca kurar.
 */

const BASE = "/assets/audio/";
const FADE_MS = 1200;
const LOOP_VOL = 0.4;

export type Amb = "cyber" | "forest";
export type AudioMood = "calm" | "tense" | "danger" | "wonder";

export class GameAudio {
  private loops = new Map<string, HTMLAudioElement>();
  private fadeTimers = new Map<HTMLAudioElement, number>();
  private current: HTMLAudioElement | null = null;
  private currentKey = "";
  private enabled = false;

  /** loop öğesini tembel oluştur (dosya yoksa error ile sessizce ölür) */
  private get(key: string): HTMLAudioElement {
    const found = this.loops.get(key);
    if (found) return found;
    const a = new Audio(`${BASE}${key}.mp3`);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    a.addEventListener("error", () => {
      /* dosya yok / desteklenmiyor — sessizce yoksay */
    });
    this.loops.set(key, a);
    return a;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.stopAll();
      return;
    }
    this.kick();
  }

  /** ambiance/mood değişince çağrılır — gerekiyorsa crossfade başlatır */
  setTrack(amb: Amb, mood: AudioMood) {
    const key = `${amb}-${mood}`;
    if (key === this.currentKey && this.current && !this.current.paused) return;
    this.currentKey = key;
    if (this.enabled) this.play(key);
  }

  /** tek atımlık vuruş — sahne geçişi, kritik zar vb. */
  stinger(name: string, vol = 0.55) {
    if (!this.enabled) return;
    const a = new Audio(`${BASE}${name}.mp3`);
    a.volume = vol;
    a.play()?.catch(() => {});
  }

  private play(key: string) {
    const next = this.get(key);
    const prev = this.current;
    if (next.paused) next.play()?.catch(() => {});
    this.fade(next, LOOP_VOL);
    if (prev && prev !== next) this.fade(prev, 0, () => prev.pause());
    this.current = next;
  }

  /** mevcut parçayı (varsa) başlat; autoplay engellenirse ilk gesture'da tekrar dene */
  private kick() {
    if (!this.enabled || !this.currentKey) return;
    this.play(this.currentKey);
    const retry = () => {
      if (this.enabled && this.current?.paused) this.play(this.currentKey);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
  }

  private fade(el: HTMLAudioElement, to: number, done?: () => void) {
    const from = el.volume;
    const start = performance.now();
    const prev = this.fadeTimers.get(el);
    if (prev) cancelAnimationFrame(prev);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) {
        this.fadeTimers.set(el, requestAnimationFrame(tick));
      } else {
        this.fadeTimers.delete(el);
        done?.();
      }
    };
    this.fadeTimers.set(el, requestAnimationFrame(tick));
  }

  private stopAll() {
    this.loops.forEach((a) => this.fade(a, 0, () => a.pause()));
    this.current = null;
  }

  dispose() {
    this.fadeTimers.forEach((id) => cancelAnimationFrame(id));
    this.fadeTimers.clear();
    this.loops.forEach((a) => {
      a.pause();
      a.src = "";
    });
    this.loops.clear();
    this.current = null;
  }
}
