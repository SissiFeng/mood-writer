// Procedural mechanical keyboard sound.
// Each keystroke = short impulse (click) + bandpass noise burst (shell resonance).

type KeyClass = 'letter' | 'space' | 'return' | 'backspace' | 'modifier';

function classify(key: string): KeyClass {
  if (key === ' ' || key === 'Spacebar') return 'space';
  if (key === 'Enter') return 'return';
  if (key === 'Backspace' || key === 'Delete') return 'backspace';
  if (key.length === 1) return 'letter';
  return 'modifier';
}

interface Profile {
  clickFreq: number;      // impulse tone Hz
  bpFreq: number;         // bandpass center Hz
  bpQ: number;
  decay: number;          // seconds
  gainScale: number;      // relative
  jitter: number;         // +/- cents pitch jitter
}

const PROFILES: Record<KeyClass, Profile> = {
  letter:    { clickFreq: 2400, bpFreq: 1800, bpQ: 6,  decay: 0.050, gainScale: 1.0, jitter: 80 },
  space:     { clickFreq: 1100, bpFreq: 700,  bpQ: 4,  decay: 0.075, gainScale: 1.3, jitter: 30 },
  return:    { clickFreq: 1400, bpFreq: 1100, bpQ: 5,  decay: 0.080, gainScale: 1.2, jitter: 40 },
  backspace: { clickFreq: 2800, bpFreq: 2200, bpQ: 8,  decay: 0.035, gainScale: 0.85, jitter: 60 },
  modifier:  { clickFreq: 1800, bpFreq: 1400, bpQ: 5,  decay: 0.045, gainScale: 0.75, jitter: 50 },
};

export class KeyboardSynth {
  private ctx: AudioContext;
  private master: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private active = 0;
  private maxVoices = 8;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
  }

  connect(destination: AudioNode) {
    this.master.connect(destination);
  }

  setVolume(v: number) {
    const now = this.ctx.currentTime;
    // scale up global keyboard gain (was 0.35 → too quiet per user feedback)
    this.master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)) * 0.85, now + 0.08);
  }

  play(key: string) {
    if (this.active >= this.maxVoices) return;
    const cls = classify(key);
    const p = PROFILES[cls];
    const now = this.ctx.currentTime;
    const detune = (Math.random() - 0.5) * 2 * p.jitter;

    // 1. Click: tiny triangle tone with very short envelope (attack)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = p.clickFreq;
    osc.detune.value = detune;
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.35 * p.gainScale, now + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    // 2. Shell resonance: bandpass noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoise();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = p.bpFreq;
    bp.Q.value = p.bpQ;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.25 * p.gainScale, now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

    osc.connect(oscGain).connect(this.master);
    noise.connect(bp).connect(noiseGain).connect(this.master);

    osc.start(now);
    osc.stop(now + 0.02);
    noise.start(now);
    noise.stop(now + p.decay + 0.02);

    this.active++;
    const cleanup = () => { this.active = Math.max(0, this.active - 1); };
    noise.onended = cleanup;
  }

  private getNoise(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 0.1);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }
}
