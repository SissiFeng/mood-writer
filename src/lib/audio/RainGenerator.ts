// Procedural rain: filtered white noise + slow LFO for "breathing".
// Intensity changes cutoff/gain to go from mist → downpour.

export class RainGenerator {
  private ctx: AudioContext;
  private noise: AudioBufferSourceNode | null = null;
  private lowpass: BiquadFilterNode;
  private highpass: BiquadFilterNode;
  private gain: GainNode;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private started = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 1100;
    this.lowpass.Q.value = 0.7;

    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 250;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
  }

  start(destination: AudioNode) {
    if (this.started) return;
    this.started = true;

    const buf = this.makeNoiseBuffer(2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.lowpass);
    this.lowpass.connect(this.highpass);
    this.highpass.connect(this.gain);
    this.gain.connect(destination);
    src.start();
    this.noise = src;

    // Gentle LFO on gain for ebb-and-flow
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.08;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 0.25;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.gain.gain);
    this.lfo.start();
  }

  stop() {
    if (!this.started) return;
    try { this.noise?.stop(); } catch {}
    try { this.lfo?.stop(); } catch {}
    this.noise = null;
    this.lfo = null;
    this.lfoGain = null;
    this.started = false;
  }

  // intensity 0..1 drives cutoff (mist→storm) and base gain.
  // baseVolume 0..1 is the user's master rain volume.
  setIntensity(intensity: number, baseVolume: number) {
    const now = this.ctx.currentTime;
    const cutoff = 500 + intensity * 2000; // 500 .. 2500 Hz
    this.lowpass.frequency.linearRampToValueAtTime(cutoff, now + 0.3);

    // base gain mapped from intensity, then scaled by user master
    const base = (0.06 + intensity * 0.18) * baseVolume;
    // LFO modulates around base, so set baseline via offset (lfoGain has depth)
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.linearRampToValueAtTime(base, now + 0.3);
    if (this.lfoGain) {
      this.lfoGain.gain.linearRampToValueAtTime(base * 0.3, now + 0.3);
    }
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = sr * seconds;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // pink-ish noise (Paul Kellett's filter) for softer texture than pure white
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buf;
  }
}
