// Procedural mechanical keyboard sound.
// Each keystroke = short impulse (click) + bandpass noise burst (shell resonance).
// Layered with a "switch profile" that emulates different mechanical switches.

type KeyClass = 'letter' | 'space' | 'return' | 'backspace' | 'modifier';

function classify(key: string): KeyClass {
  if (key === ' ' || key === 'Spacebar') return 'space';
  if (key === 'Enter') return 'return';
  if (key === 'Backspace' || key === 'Delete') return 'backspace';
  if (key.length === 1) return 'letter';
  return 'modifier';
}

interface BaseProfile {
  clickFreq: number;   // impulse tone Hz
  bpFreq: number;      // bandpass center Hz
  bpQ: number;
  decay: number;       // seconds
  gainScale: number;
  jitter: number;      // +/- cents pitch jitter
}

const PROFILES: Record<KeyClass, BaseProfile> = {
  letter:    { clickFreq: 2400, bpFreq: 1800, bpQ: 6, decay: 0.050, gainScale: 1.0, jitter: 80 },
  space:     { clickFreq: 1100, bpFreq: 700,  bpQ: 4, decay: 0.075, gainScale: 1.3, jitter: 30 },
  return:    { clickFreq: 1400, bpFreq: 1100, bpQ: 5, decay: 0.080, gainScale: 1.2, jitter: 40 },
  backspace: { clickFreq: 2800, bpFreq: 2200, bpQ: 8, decay: 0.035, gainScale: 0.85, jitter: 60 },
  modifier:  { clickFreq: 1800, bpFreq: 1400, bpQ: 5, decay: 0.045, gainScale: 0.75, jitter: 50 },
};

// --- Switch profiles ---------------------------------------------------------
// Each switch is a multiplicative modifier on top of the base KeyClass profile,
// plus some special behaviors (release click, low-frequency rumble).

export interface SwitchProfile {
  id: string;
  name: string;
  description: string;
  clickFreqMul: number;
  bpFreqMul: number;
  bpQMul: number;
  decayMul: number;
  gainMul: number;
  waveform: OscillatorType;  // 'triangle' | 'square' | 'sine' | 'sawtooth'
  releaseClick: boolean;     // add an up-click ~25-45ms after press (Blue-style)
  releaseDelayMs: [number, number]; // min/max if releaseClick
  releaseGainMul: number;    // quiet release click
  thock: boolean;            // add a soft low-frequency rumble for "thock"
  thockFreq: number;         // Hz
}

export const SWITCHES: SwitchProfile[] = [
  {
    id: 'cherry-blue',
    name: 'Cherry Blue',
    description: 'Crisp click, high and bright, with a release snap.',
    clickFreqMul: 1.1, bpFreqMul: 1.1, bpQMul: 1.4, decayMul: 1.1, gainMul: 1.0,
    waveform: 'square',
    releaseClick: true,  releaseDelayMs: [22, 36], releaseGainMul: 0.55,
    thock: false, thockFreq: 0,
  },
  {
    id: 'cherry-brown',
    name: 'Cherry Brown',
    description: 'Soft tactile bump, balanced tone, no release click.',
    clickFreqMul: 0.85, bpFreqMul: 0.85, bpQMul: 0.9, decayMul: 1.0, gainMul: 0.85,
    waveform: 'triangle',
    releaseClick: false, releaseDelayMs: [0, 0], releaseGainMul: 0,
    thock: false, thockFreq: 0,
  },
  {
    id: 'cherry-red',
    name: 'Cherry Red',
    description: 'Linear and quiet — just the keycap bottoming out.',
    clickFreqMul: 0.65, bpFreqMul: 0.7, bpQMul: 0.7, decayMul: 0.7, gainMul: 0.7,
    waveform: 'sine',
    releaseClick: false, releaseDelayMs: [0, 0], releaseGainMul: 0,
    thock: false, thockFreq: 0,
  },
  {
    id: 'cherry-black',
    name: 'Cherry Black',
    description: 'Heavier linear, lower pitch, more bass.',
    clickFreqMul: 0.55, bpFreqMul: 0.55, bpQMul: 0.8, decayMul: 0.85, gainMul: 0.95,
    waveform: 'triangle',
    releaseClick: false, releaseDelayMs: [0, 0], releaseGainMul: 0,
    thock: false, thockFreq: 0,
  },
  {
    id: 'topre',
    name: 'Topre',
    description: 'Rubber-dome "thock" — soft and hollow.',
    clickFreqMul: 0.5, bpFreqMul: 0.45, bpQMul: 0.6, decayMul: 1.4, gainMul: 0.9,
    waveform: 'sine',
    releaseClick: false, releaseDelayMs: [0, 0], releaseGainMul: 0,
    thock: true, thockFreq: 140,
  },
  {
    id: 'silent',
    name: 'Silent',
    description: 'Muted silent linear — just a breath of a tap.',
    clickFreqMul: 1.3, bpFreqMul: 1.1, bpQMul: 0.5, decayMul: 0.45, gainMul: 0.35,
    waveform: 'sine',
    releaseClick: false, releaseDelayMs: [0, 0], releaseGainMul: 0,
    thock: false, thockFreq: 0,
  },
];

export const RANDOM_SWITCH_ID = 'random';

export function getSwitch(id: string): SwitchProfile | null {
  if (id === RANDOM_SWITCH_ID) return null; // signals random selection per-keystroke
  return SWITCHES.find(s => s.id === id) ?? SWITCHES[0];
}

// -----------------------------------------------------------------------------

export class KeyboardSynth {
  private ctx: AudioContext;
  private master: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private active = 0;
  private maxVoices = 12;
  private switchId: string = 'cherry-blue';

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
    this.master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)) * 0.85, now + 0.08);
  }

  setSwitch(id: string) {
    this.switchId = id;
  }

  play(key: string) {
    if (this.active >= this.maxVoices) return;
    const cls = classify(key);
    const base = PROFILES[cls];

    // pick switch (random picks fresh each keystroke)
    const sw = this.switchId === RANDOM_SWITCH_ID
      ? SWITCHES[Math.floor(Math.random() * SWITCHES.length)]
      : (SWITCHES.find(s => s.id === this.switchId) ?? SWITCHES[0]);

    this.triggerVoice(base, sw, this.ctx.currentTime, 1.0);

    if (sw.releaseClick) {
      const [lo, hi] = sw.releaseDelayMs;
      const delay = (lo + Math.random() * (hi - lo)) / 1000;
      this.triggerVoice(base, sw, this.ctx.currentTime + delay, sw.releaseGainMul);
    }
  }

  private triggerVoice(base: BaseProfile, sw: SwitchProfile, when: number, gainScale: number) {
    const detune = (Math.random() - 0.5) * 2 * base.jitter;

    // 1. Click: short envelope on oscillator (waveform depends on switch)
    const osc = this.ctx.createOscillator();
    osc.type = sw.waveform;
    osc.frequency.value = base.clickFreq * sw.clickFreqMul;
    osc.detune.value = detune;
    const oscGain = this.ctx.createGain();
    const clickPeak = 0.35 * base.gainScale * sw.gainMul * gainScale;
    oscGain.gain.setValueAtTime(0.0001, when);
    oscGain.gain.exponentialRampToValueAtTime(Math.max(0.0005, clickPeak), when + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.012);

    // 2. Shell resonance: bandpass noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoise();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = base.bpFreq * sw.bpFreqMul;
    bp.Q.value = base.bpQ * sw.bpQMul;
    const noiseGain = this.ctx.createGain();
    const noisePeak = 0.25 * base.gainScale * sw.gainMul * gainScale;
    const dur = base.decay * sw.decayMul;
    noiseGain.gain.setValueAtTime(0.0001, when);
    noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0005, noisePeak), when + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(oscGain).connect(this.master);
    noise.connect(bp).connect(noiseGain).connect(this.master);

    osc.start(when); osc.stop(when + 0.02);
    noise.start(when); noise.stop(when + dur + 0.02);

    this.active++;
    noise.onended = () => { this.active = Math.max(0, this.active - 1); };

    // 3. Optional low-frequency "thock" body resonance (Topre-style)
    if (sw.thock) {
      const thock = this.ctx.createOscillator();
      thock.type = 'sine';
      thock.frequency.value = sw.thockFreq * (0.95 + Math.random() * 0.1);
      const thockGain = this.ctx.createGain();
      const thockPeak = 0.18 * sw.gainMul * gainScale;
      thockGain.gain.setValueAtTime(0.0001, when);
      thockGain.gain.exponentialRampToValueAtTime(Math.max(0.0005, thockPeak), when + 0.004);
      thockGain.gain.exponentialRampToValueAtTime(0.0001, when + dur * 1.1);
      thock.connect(thockGain).connect(this.master);
      thock.start(when); thock.stop(when + dur * 1.1 + 0.02);
    }
  }

  private getNoise(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 0.15);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }
}
