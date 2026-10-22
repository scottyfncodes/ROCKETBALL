/**
 * Procedural sound effects with Web Audio. No audio files. The context is created lazily
 * and resumed on the first user gesture (required by iOS Safari). Every call is a no-op if
 * Web Audio is unavailable or muted.
 */
type Ctx = AudioContext;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private thrust: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  muted = false;

  /** Call from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.7;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
    if (m) this.stopThrust();
  }

  suspend(): void {
    this.stopThrust();
    try {
      if (this.ctx?.state === 'running') void this.ctx.suspend();
    } catch {
      /* ignore */
    }
  }

  private ready(): Ctx | null {
    if (!this.ctx || !this.master || this.muted) return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const c = this.ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', slideTo?: number, delay = 0): void {
    const c = this.ready();
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  click(): void {
    this.tone(880, 0.06, 'triangle', 0.15, 1320);
  }
  launch(power = 1): void {
    this.noise(0.25, 0.5, 600, 0.8, 'bandpass', 2400);
    this.tone(140, 0.12, 'sine', 0.5 * (0.6 + power * 0.4), 60);
  }
  kick(power = 1): void {
    this.tone(110, 0.14, 'sine', 0.7 * (0.6 + power * 0.4), 45);
    this.noise(0.08, 0.35, 1800, 1.5);
  }
  crack(quality = 1): void {
    this.noise(0.12, 0.6, 3200, 1.2);
    this.tone(1200 + quality * 600, 0.08, 'square', 0.12, 400);
  }
  whiff(): void {
    this.noise(0.3, 0.25, 900, 0.7, 'bandpass', 300);
  }
  ignite(): void {
    this.noise(0.5, 0.6, 300, 0.7, 'lowpass', 3000);
    this.tone(220, 0.35, 'sawtooth', 0.12, 660);
  }
  thrustOn(): void {
    const c = this.ready();
    if (!c || !this.noiseBuf || this.thrust) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.08);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    this.thrust = { src, gain, filter };
  }
  thrustLevel(steer: number): void {
    if (this.thrust && this.ctx) this.thrust.filter.frequency.setTargetAtTime(900 + Math.abs(steer) * 700, this.ctx.currentTime, 0.05);
  }
  stopThrust(): void {
    if (!this.thrust || !this.ctx) {
      this.thrust = null;
      return;
    }
    const { src, gain } = this.thrust;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0.0001, t, 0.04);
    src.stop(t + 0.2);
    this.thrust = null;
  }
  fuelOut(): void {
    this.tone(330, 0.18, 'square', 0.12, 160);
  }
  bounce(speed: number): void {
    this.tone(90 + Math.min(speed, 20) * 4, 0.1, 'sine', Math.min(0.5, 0.1 + speed * 0.025), 50);
  }
  hit(): void {
    this.noise(0.18, 0.5, 500, 1);
    this.tone(160, 0.15, 'square', 0.15, 70);
  }
  ring(): void {
    this.tone(1046, 0.12, 'triangle', 0.25);
    this.tone(1568, 0.22, 'triangle', 0.2, undefined, 0.07);
  }
  score(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.25, undefined, i * 0.09));
    this.noise(1.6, 0.25, 900, 0.4, 'bandpass', 1400, 0.1);
  }
  star(i: number): void {
    this.tone(880 * Math.pow(1.26, i), 0.2, 'triangle', 0.22);
  }
  fail(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.09, f * 0.97, i * 0.14));
  }
  unlockFanfare(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'square', 0.08, undefined, i * 0.07));
  }
}
