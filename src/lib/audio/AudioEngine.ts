import { RainGenerator } from './RainGenerator';
import { KeyboardSynth } from './KeyboardSynth';

export interface AudioSettings {
  rainEnabled: boolean;
  rainVolume: number;      // 0..1
  keyboardEnabled: boolean;
  keyboardVolume: number;  // 0..1
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private rain: RainGenerator | null = null;
  private keys: KeyboardSynth | null = null;
  private master: GainNode | null = null;
  private currentIntensity = 0.15;
  private settings: AudioSettings = {
    rainEnabled: true,
    rainVolume: 0.4,
    keyboardEnabled: true,
    keyboardVolume: 0.6,
  };

  get isReady() { return this.ctx !== null && this.ctx.state === 'running'; }

  // Must be called in response to a user gesture.
  async ensureStarted() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);

        this.rain = new RainGenerator(this.ctx);
        if (this.settings.rainEnabled) {
          this.rain.start(this.master);
          this.rain.setIntensity(this.currentIntensity, this.settings.rainVolume);
        }

        this.keys = new KeyboardSynth(this.ctx);
        this.keys.connect(this.master);
        if (this.settings.keyboardEnabled) {
          this.keys.setVolume(this.settings.keyboardVolume);
        }
      } catch (e) {
        console.warn('[AudioEngine] init failed', e);
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch {}
    }
  }

  setRainIntensity(intensity: number) {
    this.currentIntensity = intensity;
    if (this.rain && this.settings.rainEnabled) {
      this.rain.setIntensity(intensity, this.settings.rainVolume);
    }
  }

  playKey(key: string) {
    if (this.settings.keyboardEnabled && this.keys) {
      this.keys.play(key);
    }
  }

  updateSettings(patch: Partial<AudioSettings>) {
    const prev = this.settings;
    this.settings = { ...prev, ...patch };
    if (!this.ctx || !this.master) return;

    if (this.rain) {
      if (this.settings.rainEnabled && !prev.rainEnabled) {
        this.rain.start(this.master);
      } else if (!this.settings.rainEnabled && prev.rainEnabled) {
        this.rain.stop();
      }
      if (this.settings.rainEnabled) {
        this.rain.setIntensity(this.currentIntensity, this.settings.rainVolume);
      }
    }

    if (this.keys) {
      this.keys.setVolume(this.settings.keyboardEnabled ? this.settings.keyboardVolume : 0);
    }
  }

  getSettings(): AudioSettings { return { ...this.settings }; }
}
