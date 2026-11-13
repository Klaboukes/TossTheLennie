// Tiny synthesised sound effects: no audio files needed.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
  }

  /** Must be called from a user gesture before anything is audible. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.45;
  }

  get ready() {
    return this.ctx && !this.muted && this.ctx.state === 'running';
  }

  #env(gain, t, peak, attack, release) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  #noiseSource(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 0.5, dur);
    return src;
  }

  /** Rubbery wall bounce. strength 0..1 */
  boing(strength) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f0 = 110 + Math.random() * 50 + strength * 90;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0 * 2.2, t);
    osc.frequency.exponentialRampToValueAtTime(f0, t + 0.22);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 22 + Math.random() * 8;
    lfoGain.gain.value = f0 * 0.18;
    lfo.connect(lfoGain).connect(osc.frequency);
    const g = ctx.createGain();
    this.#env(g, t, 0.15 + strength * 0.5, 0.008, 0.35);
    osc.connect(g).connect(this.master);
    osc.start(t); lfo.start(t);
    osc.stop(t + 0.4); lfo.stop(t + 0.4);

    const thud = this.#noiseSource(t, 0.15);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260 + strength * 300;
    const tg = ctx.createGain();
    this.#env(tg, t, 0.2 + strength * 0.6, 0.004, 0.12);
    thud.connect(lp).connect(tg).connect(this.master);
  }

  /** Hard knock against a floor, wall or furniture. strength 0..1 */
  thud(strength) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 + Math.random() * 40, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    this.#env(g, t, 0.15 + strength * 0.55, 0.003, 0.14);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);

    const src = this.#noiseSource(t, 0.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500 + strength * 900;
    const ng = ctx.createGain();
    this.#env(ng, t, 0.1 + strength * 0.4, 0.002, 0.08);
    src.connect(lp).connect(ng).connect(this.master);
  }

  /** Breaking glass. */
  crash() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.#noiseSource(t, 0.6);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const g = ctx.createGain();
    this.#env(g, t, 0.5, 0.002, 0.5);
    src.connect(hp).connect(g).connect(this.master);
    for (let i = 0; i < 9; i++) {
      const tt = t + 0.02 + Math.random() * 0.35;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 2500 + Math.random() * 4500;
      const og = ctx.createGain();
      this.#env(og, tt, 0.05 + Math.random() * 0.06, 0.002, 0.12);
      osc.connect(og).connect(this.master);
      osc.start(tt);
      osc.stop(tt + 0.2);
    }
  }

  /** A door giving way: a sharp crack, the boom of the panel and snapping wood. */
  splinter() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.#noiseSource(t, 0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    this.#env(g, t, 0.6, 0.002, 0.3);
    src.connect(bp).connect(g).connect(this.master);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    const og = ctx.createGain();
    this.#env(og, t, 0.6, 0.003, 0.3);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.35);

    for (let i = 0; i < 6; i++) {
      const tt = t + 0.03 + Math.random() * 0.3;
      const snap = this.#noiseSource(tt, 0.05);
      const sf = ctx.createBiquadFilter();
      sf.type = 'bandpass';
      sf.frequency.value = 600 + Math.random() * 1400;
      sf.Q.value = 4;
      const sg = ctx.createGain();
      this.#env(sg, tt, 0.2 + Math.random() * 0.15, 0.002, 0.04);
      snap.connect(sf).connect(sg).connect(this.master);
    }
  }

  /** A door cracking but holding. */
  crack() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.#noiseSource(t, 0.15);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    this.#env(g, t, 0.35, 0.002, 0.12);
    src.connect(bp).connect(g).connect(this.master);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    const og = ctx.createGain();
    this.#env(og, t, 0.4, 0.003, 0.18);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  /** Groceries raining down on the floor: a patter of little knocks, more for more products. */
  clatter(count) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const n = Math.min(14, 2 + Math.round(count * 0.6));
    for (let i = 0; i < n; i++) {
      const t = t0 + 0.15 + Math.random() * 0.7;
      const src = this.#noiseSource(t, 0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700 + Math.random() * 2200;
      bp.Q.value = 3;
      const g = ctx.createGain();
      this.#env(g, t, 0.06 + Math.random() * 0.1, 0.002, 0.05);
      src.connect(bp).connect(g).connect(this.master);
    }
  }

  /** Soft flop of limbs hitting each other. */
  flop(strength) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.#noiseSource(t, 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500 + Math.random() * 300;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    this.#env(g, t, 0.05 + strength * 0.2, 0.003, 0.07);
    src.connect(bp).connect(g).connect(this.master);
  }

  whoosh(strength) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.#noiseSource(t, 0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1600 + strength * 1400, t + 0.35);
    const g = ctx.createGain();
    this.#env(g, t, 0.08 + strength * 0.25, 0.06, 0.35);
    src.connect(bp).connect(g).connect(this.master);
  }

  /** Squeaky toy sound when Lennie is grabbed. */
  squeak() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(1300, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.16);
    const g = ctx.createGain();
    this.#env(g, t, 0.12, 0.01, 0.16);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Little fanfare; level 0..3 adds notes. */
  score(level) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5].slice(0, 2 + level);
    notes.forEach((f, i) => {
      const t = t0 + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      this.#env(g, t, 0.16, 0.01, i === notes.length - 1 ? 0.5 : 0.18);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  /**
   * Lennie's cartoon voice: a buzzy tone through two vowel filters that glide
   * from one vowel to the next. kind: 'ow' | 'oof' | 'whee' | 'ohh' | 'yay'.
   */
  voice(kind) {
    if (!this.ready) return;
    const V = { a: [800, 1250], o: [500, 900], u: [330, 800], i: [290, 2300], e: [480, 1900] };
    const LINES = {
      ow: { vowels: ['a', 'u'], f0: [300, 210], dur: 0.38 },
      oof: { vowels: ['u', 'u'], f0: [230, 170], dur: 0.2, breath: true },
      whee: { vowels: ['u', 'i'], f0: [330, 620], dur: 0.6 },
      ohh: { vowels: ['o', 'u'], f0: [260, 140], dur: 0.9, wobble: 7 },
      yay: { vowels: ['e', 'a'], f0: [380, 520], dur: 0.4 },
    };
    const line = LINES[kind];
    if (!line) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pitch = 0.9 + Math.random() * 0.25;
    const { dur } = line;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(line.f0[0] * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(line.f0[1] * pitch, t + dur);
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = line.wobble ?? 6;
    vibGain.gain.value = line.f0[0] * pitch * (line.wobble ? 0.06 : 0.025);
    vib.connect(vibGain).connect(osc.frequency);

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    out.gain.setValueAtTime(0.5, t + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.master);

    const [from, to] = line.vowels.map((v) => V[v]);
    for (let f = 0; f < 2; f++) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = f === 0 ? 6 : 9;
      bp.frequency.setValueAtTime(from[f], t);
      bp.frequency.exponentialRampToValueAtTime(to[f], t + dur * 0.8);
      const g = ctx.createGain();
      g.gain.value = f === 0 ? 0.9 : 0.45;
      osc.connect(bp).connect(g).connect(out);
    }
    osc.start(t); vib.start(t);
    osc.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);

    if (line.breath) {
      const src = this.#noiseSource(t, 0.12);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const ng = ctx.createGain();
      this.#env(ng, t, 0.25, 0.005, 0.1);
      src.connect(lp).connect(ng).connect(this.master);
    }
  }

  /** Bright little chime for a finished challenge. */
  chime() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    [783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
      const t = t0 + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      this.#env(g, t, 0.18, 0.005, 0.6);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  fizzle() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    this.#env(g, t, 0.08, 0.02, 0.4);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}
