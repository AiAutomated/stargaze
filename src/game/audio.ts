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

  // ── Continuous engine hum — pitch rises with velocity ────────────────────
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  /** ratio 0..1 of max speed; call every few frames. Pass 0 to fade out. */
  setHum(ratio: number) {
    this.ensure();
    if (!this.ctx || !this.master) return;
    if (this.muted || ratio <= 0.02) {
      if (this.humGain) this.humGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      return;
    }
    if (!this.humOsc) {
      this.humOsc = this.ctx.createOscillator();
      this.humGain = this.ctx.createGain();
      this.humOsc.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 180;
      this.humGain.gain.value = 0.0001;
      this.humOsc.connect(f);
      f.connect(this.humGain);
      this.humGain.connect(this.master);
      this.humOsc.start();
    }
    const t = this.ctx.currentTime;
    this.humOsc.frequency.setTargetAtTime(40 + ratio * 55, t, 0.1);
    this.humGain!.gain.setTargetAtTime(0.02 + ratio * 0.045, t, 0.12);
  }

  stopHum() {
    if (this.humGain && this.ctx) this.humGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
  }

  /** Victory fanfare — sector captured / campaign won */
  fanfare() {
    this.ensure();
    const seq: [number, number][] = [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36]];
    for (const [f, delay] of seq) {
      setTimeout(() => this.tone(f, 0.35, 'triangle', 0.16), delay * 1000);
    }
  }

  /** Dramatic fail stinger on death */
  failStinger() {
    this.ensure();
    this.tone(220, 0.5, 'sawtooth', 0.16, 110);
    setTimeout(() => this.tone(165, 0.7, 'sawtooth', 0.14, 82), 250);
    this.noise(0.6, 0.14);
  }
}
