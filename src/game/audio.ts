/** Lightweight procedural SFX via Web Audio — no asset downloads */

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.28;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this.ensure();
    this.ctx?.resume();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.3,
    slideTo?: number,
  ) {
    if (this.muted || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol = 0.15) {
    if (this.muted || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 800;
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  laser() {
    this.ensure();
    this.tone(880, 0.08, 'square', 0.12, 220);
  }
  hit() {
    this.ensure();
    this.tone(180, 0.12, 'sawtooth', 0.15, 60);
    this.noise(0.1, 0.1);
  }
  explode() {
    this.ensure();
    this.noise(0.35, 0.22);
    this.tone(120, 0.4, 'sawtooth', 0.18, 30);
  }
  pickup() {
    this.ensure();
    this.tone(523, 0.08, 'sine', 0.15);
    this.tone(784, 0.12, 'sine', 0.12);
  }
  captureTick() {
    this.ensure();
    this.tone(660, 0.05, 'triangle', 0.08);
  }
  captureDone() {
    this.ensure();
    this.tone(392, 0.1, 'sine', 0.15);
    this.tone(523, 0.12, 'sine', 0.15);
    this.tone(784, 0.25, 'sine', 0.18);
  }
  damage() {
    this.ensure();
    this.tone(90, 0.25, 'sawtooth', 0.2, 40);
    this.noise(0.2, 0.12);
  }
  thruster() {
    // soft continuous-ish blip — call sparingly
    this.ensure();
    this.tone(55, 0.06, 'sawtooth', 0.03);
  }
  ui() {
    this.ensure();
    this.tone(440, 0.06, 'triangle', 0.1);
  }
  ambientPulse() {
    this.ensure();
    this.tone(65, 1.2, 'sine', 0.04, 55);
  }
}
