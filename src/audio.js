// Tiny synthesised sound effects: no audio files needed.
//
// To keep them from getting old: every sound has a few variations and never
// picks the same one twice in a row, pitch and loudness wobble a little each
// time, each surface sounds like what it's made of, and the same sound
// repeated in quick succession gets quieter ("tired") instead of hammering.

const VOWELS = { a: [800, 1250], o: [500, 900], u: [330, 800], i: [290, 2300], e: [480, 1900] };

// Lennie's lines. Each line is one or more syllables:
//   v: vowel glide ('au' = from a to u), f: pitch from/to in Hz, d: seconds,
//   h: breathy "h" before it, breath: a puff of air with it, ch: a "ch" after it,
//   wobble: wavering voice.
const LINES = {
  // A hard knock mid-flight.
  hit: [
    [{ v: 'au', f: [300, 210], d: 0.38 }], // ow!
    [{ v: 'u', f: [230, 170], d: 0.2, breath: true }], // oof
    [{ v: 'au', f: [320, 240], d: 0.2 }, { v: 'u', f: [250, 200], d: 0.08, ch: true }], // ouch
    [{ v: 'i', f: [620, 720], d: 0.22 }], // eek!
    [{ v: 'ua', f: [200, 150], d: 0.24, breath: true }], // ugh
    [{ v: 'oi', f: [260, 340], d: 0.28 }], // oi!
    [{ v: 'au', f: [340, 260], d: 0.16 }, { v: 'i', f: [330, 390], d: 0.18 }], // owie
    [{ v: 'o', f: [280, 240], d: 0.1 }, { v: 'o', f: [240, 180], d: 0.14 }], // oh-oh
  ],
  // Flung through the air or off the trampoline.
  fly: [
    [{ v: 'ui', f: [330, 620], d: 0.6 }], // wheee
    [{ v: 'ua', f: [300, 420], d: 0.18 }, { v: 'u', f: [430, 540], d: 0.42, h: true }], // wa-hoo
    [{ v: 'ia', f: [380, 460], d: 0.16 }, { v: 'u', f: [480, 610], d: 0.42, h: true }], // ya-hoo
    [{ v: 'ao', f: [460, 300], d: 0.75, wobble: 9 }], // aaaah
    [{ v: 'i', f: [500, 780], d: 0.45 }], // eeee!
    [{ v: 'u', f: [360, 600], d: 0.5, h: true, wobble: 8 }], // whoooo
  ],
  // Lying still after a good toss.
  land: [
    [{ v: 'ou', f: [260, 140], d: 0.9, wobble: 7 }], // ohhh
    [{ v: 'ua', f: [180, 130], d: 0.6, wobble: 5 }], // uhhh
    [{ v: 'o', f: [300, 260], d: 0.16 }, { v: 'ou', f: [240, 150], d: 0.55, wobble: 6 }], // oh-ohhh
    [{ v: 'au', f: [270, 170], d: 0.5, wobble: 8 }], // owww
    [{ v: 'o', f: [330, 200], d: 0.3, h: true }, { v: 'o', f: [220, 140], d: 0.45, wobble: 6 }], // hoo-boy
  ],
  // Lying still after a small toss.
  grunt: [
    [{ v: 'u', f: [230, 170], d: 0.2, breath: true }], // oof
    [{ v: 'ua', f: [190, 150], d: 0.22, breath: true }], // ugh
    [{ v: 'u', f: [200, 170], d: 0.14, breath: true }], // hmph
    [{ v: 'e', f: [240, 200], d: 0.12 }, { v: 'u', f: [210, 170], d: 0.16 }], // eh-uh
  ],
  // Picked up.
  grab: [
    [{ v: 'ei', f: [300, 400], d: 0.22, h: true }], // hey!
    [{ v: 'ua', f: [230, 330], d: 0.2, h: true }], // huh?
    [{ v: 'i', f: [640, 700], d: 0.12 }], // eep
    [{ v: 'u', f: [260, 380], d: 0.24, wobble: 10 }], // uh?
  ],
  // Electrocuted: a long shaky scream.
  zap: [
    [{ v: 'a', f: [380, 420], d: 1.1, wobble: 24 }], // aaa-a-a-a-ah
    [{ v: 'ai', f: [420, 560], d: 1.0, wobble: 20 }], // aaaiii
    [{ v: 'e', f: [300, 340], d: 0.25 }, { v: 'ao', f: [420, 380], d: 0.9, wobble: 26 }], // eh-aaah
  ],
  // Frozen solid and thawing: brrr.
  cold: [
    [{ v: 'u', f: [250, 230], d: 0.9, wobble: 30 }], // brrrr
    [{ v: 'i', f: [300, 270], d: 0.8, wobble: 28 }], // iiiii
    [{ v: 'o', f: [260, 250], d: 0.2 }, { v: 'u', f: [250, 220], d: 0.7, wobble: 30 }], // oh-brrr
  ],
  // Sat on the hot cooker: a high yelp.
  hot: [
    [{ v: 'au', f: [520, 760], d: 0.28 }, { v: 'u', f: [700, 480], d: 0.3 }], // au-ooh!
    [{ v: 'i', f: [700, 950], d: 0.45 }], // iiee!
    [{ v: 'a', f: [600, 820], d: 0.22, h: true }, { v: 'a', f: [800, 560], d: 0.3, h: true }], // ha-haa!
  ],
  // Something stinks: bleh.
  yuck: [
    [{ v: 'e', f: [230, 180], d: 0.5, breath: true }], // bleh
    [{ v: 'ua', f: [210, 160], d: 0.45, h: true }], // bwah
    [{ v: 'i', f: [330, 300], d: 0.15 }, { v: 'u', f: [260, 190], d: 0.4, wobble: 9 }], // ie-uw
  ],
  // A challenge done or a match won.
  cheer: [
    [{ v: 'ea', f: [380, 520], d: 0.4 }], // yay
    [{ v: 'u', f: [350, 420], d: 0.15 }, { v: 'u', f: [450, 630], d: 0.42, h: true }], // woo-hoo
    [{ v: 'u', f: [360, 440], d: 0.12 }, { v: 'ea', f: [480, 620], d: 0.4 }], // hooray
    [{ v: 'ia', f: [420, 560], d: 0.16 }, { v: 'i', f: [560, 640], d: 0.24 }], // yippee
  ],
};

// Pitch of each surface's knock, in Hz.
const KNOCK = { furniture: 260, door: 150, stair: 210, fence: 320, tree: 130 };

const rand = (a, b) => a + Math.random() * (b - a);
const semis = (n) => 2 ** (n / 12);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.lastPick = {};
    this.recent = {};
  }

  /** Must be called from a user gesture before anything is audible. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // A gentle limiter so a pile-up of sounds never gets harsh.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(comp);
      const len = this.ctx.sampleRate * 2;
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

  // ------------------------------------------------------------ building blocks

  /** A random variation 0..n-1, never the same as last time for this key. */
  #pick(key, n) {
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === this.lastPick[key]) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.lastPick[key] = i;
    return i;
  }

  /** 1 for a fresh sound, down to 0.35 when the same one keeps repeating. */
  #tire(key, window = 1.2) {
    const now = this.ctx.currentTime;
    const list = (this.recent[key] ?? []).filter((at) => now - at < window);
    list.push(now);
    this.recent[key] = list;
    return Math.max(0.35, 1 / (1 + 0.22 * (list.length - 1)));
  }

  #env(gain, t, peak, attack, release) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  #noiseSource(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 1.2, dur);
    return src;
  }

  /** One enveloped oscillator, optionally gliding from f to `to`. */
  #tone(t, { type = 'sine', f, to, glide = 0.1, peak, attack = 0.003, release = 0.15, lowpass }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + glide);
    const g = ctx.createGain();
    this.#env(g, t, peak, attack, release);
    let node = osc;
    if (lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      node = node.connect(lp);
    }
    node.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + release + 0.05);
    return osc;
  }

  /** One enveloped burst of filtered noise, optionally sweeping from f to `to`. */
  #burst(t, { filter = 'lowpass', f, to, glide = 0.1, Q = 1, peak, attack = 0.002, release = 0.1 }) {
    const ctx = this.ctx;
    const src = this.#noiseSource(t, attack + release + 0.05);
    const fl = ctx.createBiquadFilter();
    fl.type = filter;
    fl.Q.value = Q;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + glide);
    const g = ctx.createGain();
    this.#env(g, t, peak, attack, release);
    src.connect(fl).connect(g).connect(this.master);
  }

  // ------------------------------------------------------------ hitting things

  /** Lennie hitting a surface: it sounds like what the surface is made of. strength 0..1 */
  impact(kind, strength) {
    if (!this.ready) return;
    const s = strength * rand(0.85, 1.1);
    switch (kind) {
      case 'trampoline': return this.boing(strength);
      case 'cushion': return this.#puff(s * this.#tire('puff'));
      case 'leaves': return this.#rustle(s * this.#tire('rustle'));
      case 'metal': return this.#clang(s * this.#tire('clang'));
      case 'glass': return this.#tink(s * this.#tire('tink'));
      case 'ground': return this.#dirt(s * this.#tire('dirt'));
      default:
        if (KNOCK[kind]) return this.#knock(KNOCK[kind], s * this.#tire('knock'));
        return this.thud(s * this.#tire('thud'));
    }
  }

  /** Rubbery trampoline bounce. strength 0..1 */
  boing(strength) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const k = this.#tire('boing', 2);
    const f0 = (110 + Math.random() * 50 + strength * 90) * rand(0.85, 1.2);
    const shapes = [
      [[f0 * 2.2, f0]], // down: bwoiing
      [[f0 * 0.8, f0 * 2.1]], // up: boy-oing
      [[f0 * 2, f0 * 1.1], [f0 * 2.4, f0 * 1.3]], // double: boing-boing
    ];
    shapes[this.#pick('boing', shapes.length)].forEach(([from, to], i) => {
      const tt = t + i * 0.16;
      const dur = i ? 0.25 : 0.35;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, tt);
      osc.frequency.exponentialRampToValueAtTime(to, tt + dur * 0.6);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = rand(14, 30);
      lfoGain.gain.value = f0 * rand(0.1, 0.24);
      lfo.connect(lfoGain).connect(osc.frequency);
      const g = ctx.createGain();
      this.#env(g, tt, (0.15 + strength * 0.5) * k * (i ? 0.7 : 1), 0.008, dur);
      osc.connect(g).connect(this.master);
      osc.start(tt); lfo.start(tt);
      osc.stop(tt + dur + 0.05); lfo.stop(tt + dur + 0.05);
    });
    this.#burst(t, { f: 260 + strength * 300, peak: (0.2 + strength * 0.6) * k, attack: 0.004, release: 0.12 });
  }

  /** Hard knock against a floor, wall or roof. strength 0..1 */
  thud(strength) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const s = strength;
    const p = rand(0.85, 1.15);
    switch (this.#pick('thud', 3)) {
      case 0: // dull knock
        this.#tone(t, { f: (150 + Math.random() * 40) * p, to: 55 * p, glide: 0.12, peak: 0.15 + s * 0.55, release: 0.14 });
        this.#burst(t, { f: 500 + s * 900, peak: 0.1 + s * 0.4, release: 0.08 });
        break;
      case 1: // heavy body slam
        this.#tone(t, { f: 100 * p, to: 40 * p, glide: 0.18, peak: 0.2 + s * 0.6, release: 0.22 });
        this.#burst(t, { f: 300 + s * 300, peak: 0.15 + s * 0.45, release: 0.14 });
        break;
      default: // flat slap
        this.#tone(t, { f: 210 * p, to: 80 * p, glide: 0.07, peak: 0.1 + s * 0.4, release: 0.08 });
        this.#burst(t, { filter: 'bandpass', f: 900 * p, Q: 0.7, peak: 0.15 + s * 0.45, release: 0.05 });
    }
  }

  /** Hollow wooden knock: furniture, stairs, doors, fences, trees. */
  #knock(base, s) {
    const t = this.ctx.currentTime;
    const f = base * rand(0.85, 1.18);
    const ratio = [2.3, 2.76, 3.1][this.#pick('knock', 3)];
    this.#tone(t, { type: 'triangle', f, to: f * 0.92, glide: 0.1, peak: 0.12 + s * 0.4, release: 0.1 + s * 0.06 });
    this.#tone(t, { f: f * ratio, peak: 0.05 + s * 0.15, release: 0.06 });
    this.#burst(t, { filter: 'bandpass', f: f * 4, Q: 2, peak: 0.08 + s * 0.25, release: 0.03 });
    this.#tone(t, { f: 90, to: 50, glide: 0.1, peak: 0.08 + s * 0.3, release: 0.12 });
  }

  /** Metal shelves and fridges in the supermarket: a short clang. */
  #clang(s) {
    const t = this.ctx.currentTime;
    const f = rand(280, 520);
    [[1, 0.4], [2.76, 0.28], [5.4, 0.18], [8.93, 0.1]].forEach(([r, dur], i) => {
      this.#tone(t, { f: f * r * rand(0.98, 1.02), peak: (0.05 + s * 0.12) / (i + 1), release: dur * (0.5 + s * 0.6) });
    });
    this.#burst(t, { filter: 'highpass', f: 2500, peak: 0.05 + s * 0.15, release: 0.03 });
    this.#tone(t, { f: 110, to: 50, glide: 0.1, peak: 0.1 + s * 0.35, release: 0.12 });
  }

  /** A window that holds: a glassy tink with a soft bump. */
  #tink(s) {
    const t = this.ctx.currentTime;
    const f = rand(1700, 2700);
    this.#tone(t, { f, peak: 0.04 + s * 0.12, release: 0.25 });
    this.#tone(t, { f: f * 2.43, peak: 0.02 + s * 0.06, release: 0.15 });
    this.#tone(t, { f: 130, to: 60, glide: 0.1, peak: 0.08 + s * 0.3, release: 0.12 });
  }

  /** Landing in a cushion: a soft puff of air. */
  #puff(s) {
    const t = this.ctx.currentTime;
    if (this.#pick('puff', 2) === 0) {
      this.#burst(t, { f: 1400, to: 250, glide: 0.18, peak: 0.12 + s * 0.4, attack: 0.01, release: 0.18 });
    } else {
      // squishier, with a little squeak of fabric
      this.#burst(t, { filter: 'bandpass', f: 700, to: 300, glide: 0.15, Q: 1.5, peak: 0.12 + s * 0.4, attack: 0.008, release: 0.15 });
      this.#burst(t + 0.02, { filter: 'bandpass', f: 2200 * rand(0.8, 1.2), Q: 8, peak: 0.03 + s * 0.06, attack: 0.01, release: 0.06 });
    }
    this.#tone(t, { f: 110, to: 60, glide: 0.12, peak: 0.05 + s * 0.2, attack: 0.008, release: 0.12 });
  }

  /** Crashing through a hedge or tree crown: rustling leaves, sometimes a snapping twig. */
  #rustle(s) {
    const t = this.ctx.currentTime;
    this.#burst(t, { filter: 'highpass', f: 2500, peak: 0.05 + s * 0.15, attack: 0.02, release: 0.25 });
    const n = 4 + Math.round(s * 8);
    for (let i = 0; i < n; i++) {
      this.#burst(t + Math.random() * 0.3, { filter: 'bandpass', f: rand(2500, 6500), Q: 3, peak: rand(0.03, 0.08) + s * 0.05, release: 0.03 });
    }
    if (s > 0.4 && Math.random() < 0.4) {
      this.#burst(t + rand(0.03, 0.15), { filter: 'bandpass', f: rand(900, 1600), Q: 4, peak: 0.3, release: 0.03 });
    }
  }

  /** Hitting the garden or the street: a dull, dusty flump. */
  #dirt(s) {
    const t = this.ctx.currentTime;
    this.#tone(t, { f: 90 * rand(0.85, 1.15), to: 42, glide: 0.14, peak: 0.15 + s * 0.5, release: 0.16 });
    this.#burst(t, { f: rand(280, 480), peak: 0.15 + s * 0.45, attack: 0.004, release: 0.16 });
    this.#burst(t + 0.02, { filter: 'highpass', f: 3000, peak: 0.02 + s * 0.05, attack: 0.02, release: 0.12 });
  }

  /** Breaking glass. */
  crash() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#burst(t, { filter: 'highpass', f: rand(2000, 3500), peak: 0.5, release: rand(0.4, 0.6) });
    const n = 6 + Math.floor(Math.random() * 7);
    const spread = rand(0.25, 0.5);
    for (let i = 0; i < n; i++) {
      this.#tone(t + 0.02 + Math.random() * spread, { type: 'triangle', f: rand(2500, 7000), peak: rand(0.05, 0.11), attack: 0.002, release: 0.12 });
    }
    // Sometimes a last few shards tinkle down a moment later.
    if (Math.random() < 0.5) {
      for (let i = 0; i < 4; i++) {
        this.#tone(t + 0.55 + Math.random() * 0.3, { f: rand(3000, 6000), peak: rand(0.02, 0.05), release: 0.1 });
      }
    }
  }

  /** Plates and mugs smashing on the floor: a sharp crack each and a clink of china; more for more. */
  smash(count) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime;
    const k = this.#tire('smash', 0.6);
    const n = Math.min(5, count);
    for (let i = 0; i < n; i++) {
      const t = t0 + (i ? Math.random() * 0.12 : 0);
      this.#burst(t, { filter: 'bandpass', f: rand(2200, 4200), Q: 1.2, peak: rand(0.18, 0.3) * k, attack: 0.001, release: rand(0.06, 0.12) });
      for (let j = 0; j < 3; j++) {
        this.#tone(t + 0.01 + Math.random() * 0.15, { type: 'triangle', f: rand(1800, 4500), peak: rand(0.03, 0.07) * k, attack: 0.002, release: 0.08 });
      }
    }
  }

  /** A door giving way: a sharp crack, the boom of the panel and snapping wood. */
  splinter() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const p = rand(0.85, 1.15);
    this.#burst(t, { filter: 'bandpass', f: 1400 * p, Q: 0.8, peak: 0.6, release: 0.3 });
    this.#tone(t, { f: 120 * p, to: 45, glide: 0.25, peak: 0.6, release: 0.3 });
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      this.#burst(t + 0.03 + Math.random() * 0.35, { filter: 'bandpass', f: rand(600, 2000), Q: 4, peak: rand(0.2, 0.35), release: 0.04 });
    }
  }

  /** A door cracking but holding. */
  crack() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const p = rand(0.85, 1.15);
    this.#burst(t, { filter: 'bandpass', f: 1100 * p, Q: 1.5, peak: 0.35, release: 0.12 });
    this.#tone(t, { f: 140 * p, to: 60, glide: 0.15, peak: 0.4, release: 0.18 });
    // a creak as the door settles
    if (Math.random() < 0.5) this.#tone(t + 0.12, { type: 'sawtooth', f: rand(160, 240), to: rand(120, 300), glide: 0.25, peak: 0.04, attack: 0.03, release: 0.25, lowpass: 900 });
  }

  /** An electric shock: a mains hum buzzing in and out, crackles and a pop at the end. */
  zap(duration = 1.4) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const end = t + duration;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    out.gain.setValueAtTime(0.22, end - 0.15);
    out.gain.exponentialRampToValueAtTime(0.0001, end);
    // chopped on and off at random, like an arcing wire
    const chop = ctx.createGain();
    for (let tt = t; tt < end; tt += 0.03 + Math.random() * 0.05) chop.gain.setValueAtTime(Math.random() < 0.75 ? 1 : 0.15, tt);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(900, 1400);
    bp.Q.value = 0.7;
    chop.connect(bp).connect(out).connect(this.master);
    for (const [type, f] of [['sawtooth', 100 * rand(0.95, 1.05)], ['square', 150 * rand(0.95, 1.05)]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.connect(chop);
      osc.start(t);
      osc.stop(end + 0.05);
    }
    const n = 14 + Math.floor(Math.random() * 10);
    for (let i = 0; i < n; i++) {
      this.#burst(t + Math.random() * duration, { filter: 'highpass', f: rand(2500, 6000), peak: rand(0.1, 0.25), release: rand(0.01, 0.04) });
    }
    this.#burst(end - 0.05, { filter: 'bandpass', f: 600, Q: 1.2, peak: 0.35, release: 0.15 });
  }

  /** Groceries raining down: tins, boxes and bottles; more for more products. */
  clatter(count) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime;
    const k = this.#tire('clatter', 2);
    const n = Math.min(14, 2 + Math.round(count * 0.6));
    for (let i = 0; i < n; i++) {
      const t = t0 + 0.15 + Math.random() * 0.7;
      const r = Math.random();
      if (r < 0.35) { // tin
        const f = rand(900, 2200);
        this.#tone(t, { f, peak: rand(0.03, 0.06) * k, release: 0.09 });
        this.#tone(t, { f: f * 2.7, peak: 0.02 * k, release: 0.05 });
      } else if (r < 0.5) { // bottle
        this.#tone(t, { f: rand(2200, 3600), peak: rand(0.02, 0.05) * k, release: 0.14 });
      } else { // box or bag
        this.#burst(t, { filter: 'bandpass', f: rand(500, 2500), Q: 3, peak: rand(0.06, 0.16) * k, release: 0.05 });
      }
    }
  }

  /** Soft flop of limbs hitting each other. */
  flop(strength) {
    if (!this.ready) return;
    const k = this.#tire('flop');
    this.#burst(this.ctx.currentTime, { filter: 'bandpass', f: rand(380, 900), Q: rand(0.8, 1.6), peak: (0.05 + strength * 0.2) * k, attack: 0.003, release: rand(0.05, 0.09) });
  }

  whoosh(strength) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dur = rand(0.28, 0.45);
    this.#burst(t, { filter: 'bandpass', f: rand(220, 400), to: (1600 + strength * 1400) * rand(0.75, 1.25), glide: dur, Q: rand(1.4, 2.8), peak: 0.08 + strength * 0.25, attack: 0.06, release: dur });
  }

  // ------------------------------------------------------------ cars (cars.js)

  /** A car horn: a single toot, a toot-toot, or one long annoyed one. */
  honk() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const k = this.#tire('honk', 3);
    const p = rand(0.85, 1.2); // every car sounds a bit different
    const pattern = [[[0, 0.16], [0.22, 0.3]], [[0, 0.32]], [[0, 0.12], [0.17, 0.12], [0.34, 0.12]]][this.#pick('honk', 3)];
    for (const [at, dur] of pattern) {
      const g = ctx.createGain();
      const t0 = t + at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.09 * k, t0 + 0.015);
      g.gain.setValueAtTime(0.09 * k, t0 + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      lp.connect(g).connect(this.master);
      for (const f of [392 * p, 494 * p]) { // the two notes of a car horn, a third apart
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        osc.connect(lp);
        osc.start(t0);
        osc.stop(t0 + dur + 0.08);
      }
    }
  }

  /**
   * A car driving past: a rumbling engine that grows, drops in pitch as it
   * goes by and fades away, with the swish of its tyres. It's level with the
   * listener after `up` seconds. strength 0..1 (how close)
   */
  carPass(strength, up = 1.2) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = strength * this.#tire('car', 4);
    const at = t + up; // level with him
    const end = at + 1.6;
    const f = rand(46, 58);
    // the engine: two low, slightly detuned sawtooths (they beat against each
    // other, so it's rough rather than one clean buzzy note), through a filter
    // that opens up as it gets close
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(650, at);
    lp.frequency.exponentialRampToValueAtTime(200, end);
    const oscs = [];
    for (const k of [1, 1.025, 0.5]) {
      const osc = ctx.createOscillator();
      osc.type = k === 0.5 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(f * k * 1.08, t);
      osc.frequency.exponentialRampToValueAtTime(f * k, at);
      osc.frequency.exponentialRampToValueAtTime(f * k * 0.86, end); // lower once it's past
      osc.connect(lp);
      oscs.push(osc);
    }
    // the engine's chug: its loudness throbs a dozen times a second (brrrm)
    const chug = ctx.createGain();
    chug.gain.value = 0.65;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(10, 14);
    const depth = ctx.createGain();
    depth.gain.value = 0.35;
    lfo.connect(depth).connect(chug.gain);
    oscs.push(lfo);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 + s * 0.13, at);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(chug).connect(g).connect(this.master);
    for (const o of oscs) {
      o.start(t);
      o.stop(end + 0.05);
    }
    // the tyres on the road: a swish, loudest as it goes by
    const tyres = this.#noiseSource(t, end - t + 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.6;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(1300, at);
    bp.frequency.exponentialRampToValueAtTime(350, end);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.03 + s * 0.08, at);
    tg.gain.exponentialRampToValueAtTime(0.0001, end - 0.3);
    tyres.connect(bp).connect(tg).connect(this.master);
  }

  // ------------------------------------------------------------ picking Lennie up

  /** Squeaky toy sound, in a few shapes and pitches. */
  squeak() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const p = rand(0.8, 1.25);
    const k = this.#tire('squeak', 1.5);
    const shapes = [
      [[700, 1300, 950, 0.16]], // squee-ak
      [[1250, 1350, 700, 0.18]], // skwonk, falling
      [[800, 1200, 1100, 0.07], [900, 1400, 1250, 0.08]], // squik-squik
      [[600, 900, 650, 0.24]], // low rubber honk
    ];
    shapes[this.#pick('squeak', shapes.length)].forEach(([a, b, c, dur], i) => {
      const tt = t + i * 0.1;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(a * p, tt);
      osc.frequency.exponentialRampToValueAtTime(b * p, tt + dur * 0.5);
      osc.frequency.exponentialRampToValueAtTime(c * p, tt + dur);
      const g = ctx.createGain();
      this.#env(g, tt, 0.12 * k, 0.01, dur);
      osc.connect(g).connect(this.master);
      osc.start(tt);
      osc.stop(tt + dur + 0.05);
    });
  }

  /** Grabbed: a squeak, and now and then Lennie says something about it. */
  grab() {
    this.squeak();
    if (Math.random() < 0.3) this.voice('grab');
  }

  // ------------------------------------------------------------ jingles

  /** Little fanfare; level 0..3 adds notes. Key, tune and instrument vary. */
  score(level) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + 0.02;
    const key = 523.25 * semis([0, 2, -3, 5, -5][this.#pick('score-key', 5)]);
    const tunes = [
      [0, 4, 7, 12, 16],
      [0, 2, 4, 7, 9, 12],
      [0, 7, 4, 12, 7, 16],
      [0, 4, 2, 7, 12, 14],
    ];
    const tune = tunes[this.#pick('score-tune', tunes.length)];
    const notes = tune.slice(0, Math.min(tune.length, 2 + level));
    const voice = this.#pick('score-voice', 3);
    const step = rand(0.08, 0.11);
    notes.forEach((n, i) => {
      const t = t0 + i * step;
      const f = key * semis(n);
      const release = i === notes.length - 1 ? 0.5 : 0.18;
      if (voice === 0) {
        this.#tone(t, { type: 'triangle', f, peak: 0.16, attack: 0.01, release });
      } else if (voice === 1) { // bell
        this.#tone(t, { f, peak: 0.14, attack: 0.005, release: release + 0.15 });
        this.#tone(t, { f: f * 2.01, peak: 0.05, attack: 0.005, release: release * 0.6 });
      } else { // chiptune
        this.#tone(t, { type: 'square', f, peak: 0.08, attack: 0.005, release, lowpass: 2500 });
      }
    });
  }

  /** Bright little chime for a finished challenge or a new best. */
  chime() {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + 0.02;
    const key = 783.99 * semis([0, 2, -2, 4][this.#pick('chime', 4)]);
    const steps = Math.random() < 0.5 ? [0, 5, 9, 12] : [0, 4, 7, 12, 16];
    const gap = rand(0.06, 0.08);
    steps.forEach((n, i) => {
      this.#tone(t0 + i * gap, { f: key * semis(n), peak: 0.18, attack: 0.005, release: 0.6 });
    });
  }

  /** Too gentle a throw: a deflating raspberry, a sad slide or a wah-wah. */
  fizzle() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (this.#pick('fizzle', 3)) {
      case 0: // sad slide down
        this.#tone(t, { type: 'sawtooth', f: rand(260, 340), to: 110, glide: 0.4, peak: 0.08, attack: 0.02, release: 0.4, lowpass: 900 });
        break;
      case 1: { // wah wah wah waaah
        const base = rand(220, 260);
        [0, -1, -2, -3].forEach((n, i) => {
          const last = i === 3;
          const osc = this.#tone(t + i * 0.28, { type: 'sawtooth', f: base * semis(n), peak: 0.07, attack: 0.03, release: last ? 0.7 : 0.22, lowpass: 1100 });
          if (last) {
            const lfo = ctx.createOscillator();
            const lg = ctx.createGain();
            lfo.frequency.value = 6;
            lg.gain.value = base * 0.03;
            lfo.connect(lg).connect(osc.frequency);
            lfo.start(t + 0.84);
            lfo.stop(t + 1.6);
          }
        });
        break;
      }
      default: { // pfffbt: a balloon letting go
        const osc = this.#tone(t, { type: 'square', f: 95, to: 60, glide: 0.45, peak: 0.05, attack: 0.02, release: 0.45, lowpass: 700 });
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 28;
        lg.gain.value = 25;
        lfo.connect(lg).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + 0.5);
        this.#burst(t, { filter: 'bandpass', f: 1200, to: 400, glide: 0.4, Q: 1.2, peak: 0.06, attack: 0.02, release: 0.4 });
      }
    }
  }

  // ------------------------------------------------------------ special effects (effects.js)

  /** Into the bath: a big splash, then a few drips. */
  splash(strength = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, strength);
    this.#burst(t, { f: 1600, to: 300, glide: 0.45, Q: 0.6, peak: 0.2 + s * 0.3, attack: 0.01, release: 0.5 });
    this.#burst(t, { filter: 'highpass', f: 2500, peak: 0.06 + s * 0.12, attack: 0.005, release: 0.35 });
    this.#tone(t, { f: 120, to: 55, glide: 0.15, peak: 0.1 + s * 0.3, release: 0.2 });
    for (let i = 0; i < 6; i++) this.#tone(t + 0.3 + Math.random() * 0.9, { f: rand(800, 1400), to: rand(1800, 2600), glide: 0.04, peak: 0.04, release: 0.06 });
  }

  /** A box of hagelslag bursting: a rain of tiny ticks. */
  sprinkle() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#burst(t, { filter: 'bandpass', f: 900, Q: 1.5, peak: 0.25, release: 0.06 }); // the box popping
    for (let i = 0; i < 40; i++) {
      this.#burst(t + 0.05 + Math.random() * 0.9, { filter: 'highpass', f: rand(4000, 7000), peak: rand(0.02, 0.06), release: 0.012 });
    }
  }

  /** The washing machine's spin cycle: a rumble that speeds up, sloshing and thumping. */
  rumble(duration = 2.5) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const end = t + duration;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(30, t);
    osc.frequency.exponentialRampToValueAtTime(90, end - 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.4);
    g.gain.setValueAtTime(0.3, end - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(end + 0.05);
    // thumps, closer together as it speeds up, and water sloshing about
    for (let tt = t + 0.1, gap = 0.3; tt < end - 0.1; tt += gap, gap = Math.max(0.09, gap * 0.88)) {
      this.#tone(tt, { f: 85, to: 50, glide: 0.08, peak: 0.25, release: 0.1 });
    }
    for (let i = 0; i < 4; i++) this.#burst(t + i * 0.55, { filter: 'bandpass', f: 500, to: 1100, glide: 0.4, Q: 1, peak: 0.06, attack: 0.1, release: 0.35 });
  }

  /** Sitting on the hot cooker: a sizzle with crackles. */
  sizzle() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#burst(t, { filter: 'highpass', f: 3500, peak: 0.12, attack: 0.03, release: 1.1 });
    for (let i = 0; i < 14; i++) {
      this.#burst(t + Math.random() * 1.0, { filter: 'bandpass', f: rand(2500, 6000), Q: 4, peak: rand(0.04, 0.1), release: 0.015 });
    }
  }

  /** Landing on the piano: a crash of random keys, louder for a harder landing. strength 0..1 */
  piano(strength) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const k = this.#tire('piano', 1.5);
    const s = Math.min(1, strength) * k;
    const n = 4 + Math.round(Math.min(1, strength) * 6);
    for (let i = 0; i < n; i++) {
      const f = 55 * semis(Math.floor(rand(12, 60)));
      const tt = t + Math.random() * 0.05;
      this.#tone(tt, { type: 'triangle', f, peak: 0.05 + s * 0.08, attack: 0.004, release: rand(0.9, 1.6) });
      this.#tone(tt, { f: f * 2.005, peak: 0.02 + s * 0.04, attack: 0.004, release: 0.5 });
    }
    this.#tone(t, { type: 'triangle', f: 55 * semis(Math.floor(rand(0, 8))), peak: 0.1 + s * 0.15, attack: 0.004, release: 1.8 });
  }

  /** A pillow bursting: a soft poof. */
  poof() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#burst(t, { filter: 'bandpass', f: 900, to: 250, glide: 0.25, Q: 0.8, peak: 0.4, attack: 0.005, release: 0.3 });
    this.#burst(t, { filter: 'highpass', f: 3000, peak: 0.06, attack: 0.02, release: 0.5 });
  }

  /** Flies buzzing round a stinky Lennie. */
  buzz(duration = 2) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = rand(170, 230);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = rand(2, 5);
      lg.gain.value = rand(20, 40);
      lfo.connect(lg).connect(osc.frequency);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 2;
      const g = ctx.createGain();
      const t0 = t + i * rand(0.1, 0.3) * duration;
      const fade = Math.min(0.4, duration * 0.35);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.035, t0 + fade);
      g.gain.setValueAtTime(0.035, t0 + duration - fade);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(bp).connect(g).connect(this.master);
      osc.start(t0); lfo.start(t0);
      osc.stop(t0 + duration + 0.05); lfo.stop(t0 + duration + 0.05);
    }
  }

  /** Frozen solid: ice creaking and crackling over him. */
  freeze() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#burst(t, { filter: 'highpass', f: 1800, to: 6000, glide: 0.6, peak: 0.1, attack: 0.05, release: 0.6 });
    for (let i = 0; i < 10; i++) this.#tone(t + Math.random() * 0.7, { f: rand(2500, 5000), peak: rand(0.03, 0.07), release: 0.12 });
    this.#tone(t, { type: 'sawtooth', f: 90, to: 60, glide: 0.6, peak: 0.05, attack: 0.05, release: 0.6, lowpass: 600 });
  }

  /** Teeth chattering while he thaws. */
  chatter(duration = 1.5) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (let tt = t; tt < t + duration; tt += rand(0.045, 0.07)) {
      this.#burst(tt, { filter: 'bandpass', f: rand(2200, 3000), Q: 5, peak: 0.08, release: 0.012 });
    }
  }

  /** The checkout scanner: beep! */
  beep() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#tone(t, { type: 'square', f: 1850, peak: 0.07, attack: 0.005, release: 0.14, lowpass: 4000 });
  }

  /** Headbutting a lamp post: a ringing metal bonk. */
  bonk() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const f = rand(380, 460);
    [[1, 1.2, 0.18], [2.76, 0.7, 0.08], [5.4, 0.4, 0.05]].forEach(([r, dur, peak]) => this.#tone(t, { f: f * r, peak, release: dur }));
    this.#tone(t, { f: 140, to: 60, glide: 0.1, peak: 0.35, release: 0.15 });
  }

  /** A shopping trolley rattling across the shop floor, and a clank when it stops. */
  rattle(duration = 2) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (let tt = t; tt < t + duration; tt += rand(0.03, 0.06)) {
      this.#burst(tt, { filter: 'bandpass', f: rand(1200, 2600), Q: 3, peak: rand(0.02, 0.06), release: 0.02 });
    }
    this.#tone(t + duration, { f: rand(1400, 1800), peak: 0.08, release: 0.4 });
    this.#burst(t + duration, { filter: 'bandpass', f: 800, Q: 1, peak: 0.25, release: 0.08 });
  }

  /** Squelching into pindakaas or a pot of paint. */
  squelch() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#burst(t, { f: 700, to: 150, glide: 0.2, Q: 2, peak: 0.4, attack: 0.01, release: 0.25 });
    this.#tone(t, { f: 260, to: 90, glide: 0.18, peak: 0.12, attack: 0.01, release: 0.2 });
  }

  /** Thorns catching his clothes: a few quick scratches. */
  scratch() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const k = this.#tire('scratch', 1);
    for (let i = 0; i < 3; i++) {
      this.#burst(t + i * rand(0.05, 0.09), { filter: 'bandpass', f: rand(1800, 2600), to: rand(4500, 6500), glide: 0.06, Q: 2, peak: 0.12 * k, attack: 0.005, release: 0.06 });
    }
  }

  // ------------------------------------------------------------ the cat (cat.js)

  /** A miaow, `volume` 0..1 (quieter further from the camera). */
  meow(volume = 1) {
    if (!this.ready) return;
    const p = rand(0.9, 1.15);
    this.#catVoice(this.ctx.currentTime, {
      f: [600 * p, 920 * p, 560 * p], dur: rand(0.45, 0.7), peak: 0.32 * volume * this.#tire('meow', 3),
      formants: [[420, 950, 480], [2200, 1500, 850]],
    });
  }

  /** The cat puffing up and hissing at him. */
  hiss(volume = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const k = volume * this.#tire('hiss', 2);
    this.#burst(t, { filter: 'bandpass', f: 600, Q: 1, peak: 0.25 * k, attack: 0.003, release: 0.04 }); // the spit
    this.#burst(t + 0.02, { filter: 'highpass', f: rand(2600, 3200), to: rand(4200, 5200), glide: 0.5, Q: 0.7, peak: 0.3 * k, attack: 0.05, release: 0.65 });
  }

  /** A furious "MRRRAOW!" as it pounces. */
  yowl() {
    if (!this.ready) return;
    const p = rand(0.9, 1.1);
    this.#catVoice(this.ctx.currentTime, {
      f: [360 * p, 640 * p, 300 * p], dur: rand(0.55, 0.75), peak: 0.38 * this.#tire('yowl', 2), wobble: 17,
      formants: [[500, 1000, 420], [1400, 1700, 800]],
    });
  }

  /** The cat flap swinging shut behind it: a soft plastic clack-clack. */
  catFlap() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (const [dt, peak] of [[0, 0.12], [0.16, 0.07], [0.27, 0.04]]) {
      this.#burst(t + dt, { filter: 'bandpass', f: rand(1300, 1700), Q: 4, peak, attack: 0.002, release: 0.035 });
    }
  }

  /** A cat's voice: a buzzy tone gliding through f[0], f[1], f[2], through two mouth filters that glide too (m-i-a-ow). */
  #catVoice(t, { f, dur, peak, wobble = 0, formants }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f[0], t);
    osc.frequency.linearRampToValueAtTime(f[1], t + dur * 0.35);
    osc.frequency.linearRampToValueAtTime(f[2], t + dur);
    let vib = null;
    if (wobble) {
      vib = ctx.createOscillator();
      const depth = ctx.createGain();
      vib.frequency.value = wobble;
      depth.gain.value = f[1] * 0.05;
      vib.connect(depth).connect(osc.frequency);
    }
    const out = ctx.createGain();
    const top = Math.max(peak, 0.0002);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(top, t + 0.05);
    out.gain.setValueAtTime(top, t + dur * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.master);
    formants.forEach(([a, b, c], i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = i === 0 ? 5 : 8;
      bp.frequency.setValueAtTime(a, t);
      bp.frequency.linearRampToValueAtTime(b, t + dur * 0.4);
      bp.frequency.linearRampToValueAtTime(c, t + dur);
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.9 : 0.4;
      osc.connect(bp).connect(g).connect(out);
    });
    osc.start(t);
    osc.stop(t + dur + 0.05);
    if (vib) {
      vib.start(t);
      vib.stop(t + dur + 0.05);
    }
  }

  // ------------------------------------------------------------ Lennie's voice

  /**
   * Lennie's cartoon voice: a buzzy tone through two vowel filters that glide
   * from one vowel to the next. kind: 'hit' | 'fly' | 'land' | 'grunt' | 'grab' | 'zap' | 'cold' | 'hot' | 'yuck' | 'cheer';
   * each picks one of several lines, never the same one twice in a row.
   */
  voice(kind) {
    if (!this.ready) return;
    const lines = LINES[kind];
    if (!lines) return;
    const line = lines[this.#pick(`voice-${kind}`, lines.length)];
    const pitch = rand(0.9, 1.15);
    const pace = rand(0.85, 1.15);
    let t = this.ctx.currentTime;
    for (const syl of line) {
      const start = syl.h ? t + 0.05 : t;
      const dur = syl.d * pace;
      this.#syllable(syl, start, dur, pitch);
      t = start + dur + (syl.ch ? 0.1 : 0.04);
    }
  }

  #syllable(syl, t, dur, pitch) {
    const ctx = this.ctx;
    const [f0, f1] = syl.f.map((f) => f * pitch);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = syl.wobble ?? rand(5, 7);
    vibGain.gain.value = f0 * (syl.wobble ? 0.06 : 0.025);
    vib.connect(vibGain).connect(osc.frequency);

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5, t + Math.min(0.03, dur * 0.3));
    out.gain.setValueAtTime(0.5, t + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.master);

    const from = VOWELS[syl.v[0]];
    const to = VOWELS[syl.v[1] ?? syl.v[0]];
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

    if (syl.h) this.#burst(t - 0.05, { filter: 'bandpass', f: 1500, Q: 0.7, peak: 0.12, attack: 0.02, release: 0.06 });
    if (syl.breath) this.#burst(t, { f: 900, peak: 0.25, attack: 0.005, release: 0.1 });
    if (syl.ch) this.#burst(t + dur, { filter: 'highpass', f: 2800, peak: 0.18, attack: 0.01, release: 0.08 });
  }
}
