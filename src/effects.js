// Special effects: what happens to Lennie when he lands in, or crashes into,
// certain things. (The TV's electric shock has its own file, zap.js.)
//
// In the house and the garden:
//  - the bath: a splash, bubbles and a rubber duck on his head; it washes him clean
//  - on the washing machine: it starts a spin cycle, shakes him about and
//    flings him off, clean and dizzy
//  - on the cooker's hob: smoke from his trousers, a yelp, and he jumps up by himself
//  - the piano: a crash of keys, louder the harder he lands
//  - a hard landing on a bed: the pillow bursts and feathers float down
//  - the cat litter, the wheelie bins or the bin bags: he stinks, with a green
//    cloud and buzzing flies, until he's washed
//  - the paint tins in the garage: his hoodie gets painted, until R
//  - the brambles behind the trampoline: scratches, and an ouch
//  - the cat (cat.js does the attack): scratches where it clings, and its fur flying
// In the supermarket and the street:
//  - a smashed freezer (or the open snack freezer): he freezes solid, stiff
//    as a plank, then thaws, shivering with chattering teeth
//  - the hagelslag shelf: a box bursts and covers him in sprinkles
//  - the pindakaas pyramid: he's sticky, and sticks to the next wall he hits
//  - the Sinterklaas stand: a mitre lands on his head and pepernoten rain down
//  - a checkout: beep beep, and a price tag pops up
//  - a street lamp: BONK, stars straight away, and the lamps flicker
//  - the trolley by the doors (trolley.js): it rolls off with him in it
//
// Kept cheap for low-end tablets: all the little bits (sprinkles, feathers,
// drops, frost, scratches, flies, pepernoten) are one InstancedMesh, all the
// puffs (smoke, steam, stink, bubbles) another, so it's two draw calls at most
// and none when nothing's going on. Colours go through the materials zap.js
// already paints. No physics bodies are added, except an anchor or two for a
// few seconds while the pindakaas holds him to a wall.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { LAMP_XS, STREET } from './streetscape.js';
import { HOUSE } from './house.js';

const H = HOUSE.H;
const box = (min, max) => ({ min, max });
const inBox = (p, b, m = 0) => p.x > b.min[0] - m && p.x < b.max[0] + m && p.y > b.min[1] - m && p.y < b.max[1] + m
  && p.z > b.min[2] - m && p.z < b.max[2] + m && (!b.when || b.when());

// Where things are (built in house.js, clutter.js, garden.js, streetscape.js and supermarket.js).
const PLACES = {
  hob: box([-0.2, 0.88, 4.25], [0.6, 1.45, 4.85]), // the cooker's hob on the kitchen counter (any body part's middle over it)
  piano: box([2.07, 0, 0.4], [3.9, 1.4, 1.12]), // the piano in the living room, against the right-hand wall
  paint: box([1.75, 0, -7.45], [3.5, 1.0, -6.75]), // the paint tins on the garage's tool shelves
  bins: box([1.35, 0, -16.1], [3.85, 1.2, -15.2]), // the three wheelie bins
  hagelslag: box([-18.62, 0.4, 36.1], [-17.38, 1.45, 42.5]), // aisle 1's shelves of hagelslag, vlokken and muisjes (and just above)
  sint: box([-1.2, 0, 34.7], [0.2, 1.8, 35.45]), // the Sinterklaas stand
  lamps: LAMP_XS.map((x) => box([x - 0.3, 0, STREET.verge[1] - 0.7], [x + 0.3, 7.2, STREET.verge[1] - 0.1])),
};

const FREEZE_TIME = 5; // seconds frozen stiff
const THAW_TIME = 2.5; // then shivering
const SPIN_TIME = 2.6;
const STINK_TIME = 12;
const STICKY_TIME = 10;
const STUCK_TIME = 2.5; // how long the pindakaas holds him to a wall
const MAX_ANCHORS = 3;
const MAX_BITS = 600;
const MAX_PUFFS = 90;
const MAX_SCRATCHES = 50;

const ICE = new THREE.Color(0xd4f0ff);
const ICE_GLOW = new THREE.Color(0x24557d);
const PEANUT = new THREE.Color(0xc98a3c);
const PAINTS = [0x2f6fb5, 0x2f8a5b, 0xf4f2ee]; // the garage's tins: blue, green and white
const SPRINKLES = [0x3d2314, 0x4a2a17, 0x4a2a17, 0x5c351c, 0x6b3b1f, 0xf3a6c8, 0xffffff, 0x9fc6ef];
const WATER = [0x9fd6f5, 0xcfeeff, 0xffffff];
const FROST = [0xffffff, 0xe6f7ff, 0xbfe6ff];
const FEATHERS = [0xffffff, 0xfbf6ea, 0xf2ece0];
const PEPERNOTEN = [0xa0632e, 0x8a5226, 0xb87a3d];
const SCRATCHES = [0xc0392b, 0xa93226, 0xd9534f];
const CAT_FUR = [0x55555c, 0x606067, 0xf3f1ec, 0xeceae4]; // the cat's (cat.js): grey-black and white

// What pops up (each list says one at random).
const LINES = {
  frozen: ['BRRR!', 'Frozen solid!', 'Lennie on the rocks!', 'Brain freeze!', 'Fish-stick Lennie!'],
  thaw: ['Brrr-brrr-brrr!', 'Need a blanket!', 'Chattering teeth!', 'Defrosting...'],
  splash: ['SPLASH!', 'Bath time!', 'Squeaky clean!', 'Wash behind your ears!', 'Rubber duck!'],
  hagelslag: ['HAGELSLAG!', 'Sprinkle sprinkle!', 'Chocolate shower!', 'Lennie on toast!', 'Breakfast is served!'],
  spin: ['SPIN CYCLE!', 'Forty degrees!', 'Tumble dry!', 'Whirlwind!'],
  hot: ['AU! HOT!', 'Hot seat!', 'Ouch, the hob!', 'Well done, Lennie!', 'Sizzle!'],
  piano: ['PLONK!', 'Bravo!', 'Encore!', 'Grand finale!', 'Chopsticks!'],
  pillow: ['PILLOW FIGHT!', 'Feathers everywhere!', 'Tickle tickle!', 'Goose bumps!'],
  stink: ['PEE-YEW!', 'Stinky Lennie!', 'Shower time!', 'What is that smell?', 'Eau de Lennie!'],
  paint: ['Paint job!', 'Fresh coat!', 'Wet paint!', 'New look, Lennie!', 'Picasso!'],
  sticky: ['Peanut butter Lennie!', 'Smooth or crunchy?', 'Gooey!', 'Sticky fingers!'],
  stuck: ['STUCK!', 'Glued to the wall!', 'Hang in there!', 'Stuck like pindakaas!'],
  sint: ['Dag Sinterklaasje!', 'A mitre for Lennie!', 'Pepernoten rain!', 'Strooi, strooi!'],
  price: ['Lennie: €0,99', '1+1 free!', 'Special offer: Lennie!', 'Price check!', 'Bonus card, please!'],
  lamp: ['BONK!', 'DOINK!', 'Seeing stars!', 'Who put that pole there?', 'Lights out!'],
  trolley: ['WHEEE!', 'Trolley dash!', 'Mind the wheels!', 'Next stop: tulips!'],
  thorns: ['Ouch, thorns!', 'Prickly!', 'Scratch scratch!', 'Bramble trouble!', 'Ow ow ow!'],
};

// Roughly where each body part's surface is, in its own frame, for sticking
// things on him: an ellipsoid [rx, ry, rz] or a capsule [radius, length].
const SHAPES = {
  head: { e: [0.12, 0.13, 0.12] },
  chest: { e: [0.23, 0.22, 0.16] },
  pelvis: { e: [0.2, 0.1, 0.14] },
  upperArm: { c: [0.075, 0.32] },
  lowerArm: { c: [0.066, 0.28] },
  upperLeg: { c: [0.096, 0.44] },
  lowerLeg: { c: [0.083, 0.38] },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _g = new THREE.Color();
const _y = new THREE.Vector3(0, 1, 0);
const _cv = new CANNON.Vec3();
const BLACK = new THREE.Color(0);
const randomQuat = (out) => out.setFromEuler(new THREE.Euler(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)));

/** The storey floor under a height (house: 0, H, 2H; everything outside is at 0). */
const floorOf = (y) => Math.max(0, Math.floor((y + 0.3) / H) * H) + 0.01;

export class Effects {
  /**
   * hooks: pop(position, text, cls), feat(id) (counts towards this toss's bonus),
   * free() (nobody's holding him and no replay is on).
   */
  constructor({ scene, world, ragdoll, zap, sfx, spots, trolley, hooks }) {
    this.world = world;
    this.ragdoll = ragdoll;
    this.zap = zap;
    this.sfx = sfx;
    this.trolley = trolley;
    this.hooks = hooks;
    this.parts = Object.values(ragdoll.parts);
    this.time = 0;
    this.cooldowns = {};
    this.dwell = {};

    const by = (...ids) => spots.filter((s) => ids.includes(s.id));
    this.zones = {
      ...PLACES,
      freezer: by('freezer', 'snacks'),
      bath: by('bath'),
      washer: by('washer'),
      litter: by('litter'),
      checkout: by('checkout'),
      // a bed from the floor up, with the height of its mattress
      beds: by('bed').map((s) => ({ min: [s.min[0], s.min[1] - 0.45, s.min[2]], max: s.max, top: s.min[1] + 0.2 })),
      pindakaas: by('pindakaas').map((s) => box([s.min[0], 0, s.min[2]], s.max)),
    };
    this.basket = box([0, 0, 0], [0, 0, 0]);

    // all the little bits, and all the puffs
    const bitMat = new THREE.MeshLambertMaterial();
    this.bits = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bitMat, MAX_BITS);
    const puffMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
    this.puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), puffMat, MAX_PUFFS);
    for (const mesh of [this.bits, this.puffs]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.userData.noAim = true;
      scene.add(mesh);
    }
    this.bitList = [];
    this.puffList = [];

    // his own colours, which the effects tint
    this.mats = zap.materials;
    for (const m of this.mats) {
      m.userData.fxBase = m.userData.zapBase.clone();
      m.userData.fxGlow = m.userData.zapGlow?.clone() ?? null;
      m.userData.fxMap = m.map;
      m.userData.hoodie = !!m.map && (m.map === ragdoll.tex.hoodie || m.map === ragdoll.tex.hoodieRib);
    }
    this.look = '';

    // hats: a rubber duck from the bath, a mitre from the Sinterklaas stand
    const head = ragdoll.parts.head.group;
    this.duck = this.#buildDuck();
    this.mitre = this.#buildMitre();
    for (const prop of [this.duck, this.mitre]) {
      prop.visible = false;
      prop.traverse((o) => (o.userData.noAim = true));
      head.add(prop);
    }

    // the street lamps' heads (streetscape.js), for the flicker
    this.lampMat = null;
    scene.traverse((o) => { if (o.userData.lampHead) this.lampMat = o.material; });
    this.lampGlow = this.lampMat?.emissive.clone();

    this.#reset();
  }

  #buildDuck() {
    const g = new THREE.Group();
    const yellow = new THREE.MeshLambertMaterial({ color: 0xffd23f });
    const orange = new THREE.MeshLambertMaterial({ color: 0xff8a1f });
    const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), yellow);
    body.scale.set(1, 0.75, 1.25);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 8), yellow);
    tail.position.set(0, 0.035, -0.085);
    tail.rotation.x = -2.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), yellow);
    head.position.set(0, 0.07, 0.045);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 8), orange);
    beak.position.set(0, 0.062, 0.1);
    beak.rotation.x = Math.PI / 2;
    beak.scale.set(1.3, 1, 0.6);
    g.add(body, tail, head, beak);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), black);
      eye.position.set(s * 0.022, 0.085, 0.08);
      g.add(eye);
    }
    g.position.set(0, 0.175, -0.01);
    return g;
  }

  #buildMitre() {
    const g = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0xd0202e });
    const gold = new THREE.MeshLambertMaterial({ color: 0xf2c230 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.112, 0.22, 16), red);
    cap.position.y = 0.11;
    cap.scale.z = 0.85;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.09, 16), red);
    tip.position.y = 0.265;
    tip.scale.z = 0.85;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.117, 0.119, 0.035, 16), gold);
    band.position.y = 0.012;
    band.scale.z = 0.86;
    // the gold cross on the front, just in front of the red
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.01), gold);
    up.position.set(0, 0.13, 0.087);
    up.rotation.x = -0.21;
    const across = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.01), gold);
    across.position.set(0, 0.15, 0.084);
    across.rotation.x = -0.21;
    g.add(cap, tip, band, up, across);
    g.position.set(0, 0.1, -0.005);
    g.rotation.x = -0.12;
    return g;
  }

  #reset() {
    this.frozen = null;
    this.spinning = null;
    this.frost = 0;
    this.wet = 0;
    this.peanut = 0;
    this.paint = null;
    this.stinkT = 0;
    this.buzzT = 0;
    this.stinkPuffT = 0;
    this.stickyT = 0;
    this.smokeT = 0;
    this.flicker = 0;
    this.anchors = [];
    this.pending = [];
    this.duck.visible = false;
    this.mitre.visible = false;
  }

  /** Everything back to normal: a fresh drop, or R. */
  clear() {
    for (const lock of this.frozen?.locks ?? []) this.world.removeConstraint(lock);
    this.#releaseAnchors();
    this.#reset();
    this.bitList.length = 0;
    this.puffList.length = 0;
    this.cooldowns = {};
    this.dwell = {};
    this.trolley.reset();
    if (this.lampMat) this.lampMat.emissive.copy(this.lampGlow);
    this.#recolor(true);
  }

  /** Picked up: the pindakaas lets go of the wall. */
  grabbed() {
    this.#releaseAnchors();
  }

  // ------------------------------------------------------------ helpers

  /** True while `key` is cooling down; otherwise starts a cooldown of `seconds` and returns false. */
  #cool(key, seconds) {
    if (this.time < (this.cooldowns[key] ?? -Infinity)) return true;
    this.cooldowns[key] = this.time + seconds;
    return false;
  }

  #say(key, position = null, cls = 'good') {
    const p = position ?? _v.copy(this.ragdoll.parts.head.group.position).setY(this.ragdoll.parts.head.group.position.y + 0.5);
    this.hooks.pop(p.clone(), pick(LINES[key]), cls);
  }

  #bit(o) {
    if (this.bitList.length >= MAX_BITS) {
      // make room: the oldest bit that isn't stuck on him
      const i = this.bitList.findIndex((b) => b.mode !== 'stick');
      this.bitList.splice(i < 0 ? 0 : i, 1);
    }
    const b = {
      mode: 'fly', p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), spin: 0, axis: null,
      s: new THREE.Vector3(0.03, 0.03, 0.03), color: new THREE.Color(0xffffff), age: 0, life: Infinity, floor: 0,
      part: null, local: null, lq: null, kind: '', phase: Math.random() * 6.3, ...o,
    };
    this.bitList.push(b);
    return b;
  }

  /** A burst of `n` bits flying out from `at`. */
  #burst(n, at, { colors, size = [0.02, 0.04], shape = null, speed = [1, 3], up = [1, 3], floor = floorOf(at.y), life = [1, 2], mode = 'fly', kind = '', spread = 0.1 }) {
    for (let i = 0; i < n; i++) {
      const sz = rand(size[0], size[1]);
      const s = shape ? new THREE.Vector3(shape[0] * sz, shape[1] * sz, shape[2] * sz) : new THREE.Vector3(sz, sz, sz);
      const a = Math.random() * Math.PI * 2;
      const sp = rand(speed[0], speed[1]);
      this.#bit({
        mode, kind, s, floor,
        p: new THREE.Vector3(at.x + rand(-spread, spread), at.y + rand(-spread, spread) * 0.5, at.z + rand(-spread, spread)),
        v: new THREE.Vector3(Math.cos(a) * sp, rand(up[0], up[1]), Math.sin(a) * sp),
        q: randomQuat(new THREE.Quaternion()), axis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), spin: rand(4, 14),
        color: new THREE.Color(pick(colors)), life: rand(life[0], life[1]),
      });
    }
  }

  /** A point on the surface of body part `part` in its own frame, from direction (dx, dy, dz) out of its middle. */
  #surface(part, out, lift = 0.008) {
    const shape = SHAPES[part.name.replace(/[LR]$/, '')] ?? SHAPES.chest;
    if (shape.e) {
      const [rx, ry, rz] = shape.e;
      out.normalize();
      // (the point on the ellipsoid along that direction)
      const k = 1 / Math.sqrt((out.x / rx) ** 2 + (out.y / ry) ** 2 + (out.z / rz) ** 2);
      return { p: out.clone().multiplyScalar(k + lift), n: out.clone() };
    }
    const [r, len] = shape.c;
    const y = THREE.MathUtils.clamp(out.y, -len / 2, len / 2);
    const n = new THREE.Vector3(out.x, 0, out.z);
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
    n.normalize();
    return { p: new THREE.Vector3(n.x * (r + lift), y, n.z * (r + lift)), n };
  }

  /**
   * Sticks a bit onto him: on `part` (else a random part, weighted to the
   * torso and head), at `local` (in the part's frame; else anywhere), lying
   * flat on him if `flat`, else at any angle.
   */
  #stick({ part = null, local = null, size, color, kind, flat = false, life = Infinity }) {
    part ??= pick([...this.parts, this.ragdoll.parts.chest, this.ragdoll.parts.chest, this.ragdoll.parts.head, this.ragdoll.parts.pelvis]);
    const dir = local ? local.clone() : new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (!local) {
      const shape = SHAPES[part.name.replace(/[LR]$/, '')];
      if (shape?.c) dir.y *= shape.c[1] / 2;
    }
    const { p, n } = this.#surface(part, dir);
    const lq = flat ? new THREE.Quaternion().setFromUnitVectors(_y, n).multiply(_q.setFromAxisAngle(_y, rand(0, 6.3))) : randomQuat(new THREE.Quaternion());
    return this.#bit({ mode: 'stick', part, local: p, lq, s: size.clone(), color: new THREE.Color(color), kind, life });
  }

  /** Lets go of every stuck bit of these kinds, so they fall off him. */
  #shake(kinds) {
    for (const b of this.bitList) {
      if (b.mode !== 'stick' || !kinds.includes(b.kind)) continue;
      b.mode = 'fly';
      b.v.set(rand(-0.8, 0.8), rand(0.2, 1.2), rand(-0.8, 0.8));
      b.axis = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      b.spin = rand(3, 8);
      b.floor = floorOf(b.p.y);
      b.life = b.age + rand(1.2, 2.2);
    }
  }

  #puff(at, { color, size = [0.08, 0.2], rise = 0.4, life = 1.6, drift = 0.15 }) {
    if (this.puffList.length >= MAX_PUFFS) this.puffList.shift();
    this.puffList.push({
      p: at.clone(), v: new THREE.Vector3(rand(-drift, drift), rise * rand(0.7, 1.3), rand(-drift, drift)),
      s0: size[0], s1: size[1], age: 0, life: life * rand(0.8, 1.2), color: new THREE.Color(color),
    });
  }

  #center(out = new THREE.Vector3()) {
    return this.ragdoll.center(out);
  }

  /** Washes him clean: no paint, pindakaas, stink, sprinkles, feathers or soot (the scratches stay). */
  #wash() {
    this.paint = null;
    this.peanut = 0;
    this.stickyT = 0;
    this.stinkT = 0;
    this.#releaseAnchors();
    this.bitList = this.bitList.filter((b) => !(b.mode === 'stick' && ['sprinkle', 'paint', 'feather'].includes(b.kind)) && b.kind !== 'fly');
    this.zap.soot = 0;
  }

  /** Gives every body part a push: `fn(body)` changes its velocities. */
  #kick(fn) {
    for (const p of this.parts) {
      fn(p.body);
      p.body.wakeUp();
    }
  }

  // ------------------------------------------------------------ what sets them off

  /**
   * Lennie (body part `partName`, its `body`) hit something at `point`, at
   * speed `v`, its surface `surf`; `ny` is how much the contact faces up or down.
   * Called from lennie.onCollide, in the middle of a physics step.
   */
  onHit(partName, body, point, v, surf, ny) {
    if (!this.hooks.enabled()) return;
    const z = this.zones;
    if (surf.kind === 'bramble') this.#thorns(body, point, v);
    if ((surf.kind === 'trash' || inBox(point, z.bins, 0.05)) && v > 2) this.#stink();
    if (v > 2.5 && inBox(point, z.piano, 0.05)) this.#piano(point, v);
    if (v > 2 && z.washer.some((b) => inBox(point, b, 0.08))) this.#spin();
    if (v > 3 && inBox(point, z.paint, 0.05)) this.#paintJob(point);
    if (v > 3 && inBox(point, z.hagelslag, 0.05)) this.#hagelslag(point);
    if (v > 3 && inBox(point, z.sint, 0.05)) this.#sint();
    if (v > 3 && z.pindakaas.some((b) => inBox(point, b, 0.05))) this.#sticky();
    if (v > 5) {
      const bed = z.beds.find((b) => inBox(point, b, 0.05));
      if (bed) this.#pillow(point, v, bed);
    }
    if (v > 3 && z.lamps.some((b) => inBox(point, b, 0.05))) this.#lamp();
    // sticky with pindakaas: he sticks to a wall (not a floor), for a bit
    // (not straight away: first he bounces off the pyramid that made him sticky)
    if (this.stickyT > 0 && this.stickyT < STICKY_TIME - 0.5 && v > 2.5 && Math.abs(ny) < 0.6 && this.anchors.length + this.pending.length < MAX_ANCHORS
      && !['glass', 'door', 'car', 'trampoline', 'tv', 'cushion', 'leaves', 'trash', 'bramble'].includes(surf.kind) && this.hooks.free()) {
      this.pending.push({ body, point: point.clone() });
    }
  }

  /** After each physics step: anything that can't change in the middle of one. */
  afterStep() {
    if (!this.pending.length) return;
    for (const { body, point } of this.pending) {
      const anchor = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
      anchor.position.set(point.x, point.y, point.z);
      anchor.collisionResponse = false;
      this.world.addBody(anchor);
      const local = body.pointToLocalFrame(_cv.set(point.x, point.y, point.z), new CANNON.Vec3());
      const c = new CANNON.PointToPointConstraint(body, local, anchor, new CANNON.Vec3(), 1600);
      c.collideConnected = false;
      this.world.addConstraint(c);
      this.anchors.push({ c, anchor, t: STUCK_TIME });
    }
    this.pending.length = 0;
    this.sfx.squelch();
    if (!this.#cool('stuckPop', 1.5)) this.#say('stuck');
    this.hooks.feat('stuck');
  }

  #releaseAnchors() {
    for (const a of this.anchors) {
      this.world.removeConstraint(a.c);
      this.world.removeBody(a.anchor);
    }
    this.anchors = [];
    this.pending.length = 0;
  }

  /** Whether his hips or chest are in any of these boxes. */
  #inside(list) {
    const hips = this.ragdoll.parts.pelvis.body.position;
    const chest = this.ragdoll.parts.chest.body.position;
    return list.some((b) => inBox(hips, b) || inBox(chest, b));
  }

  /** Calls `fire` once he's been in a place for `need` seconds, once per visit. */
  #stay(key, inside, need, dt, fire) {
    const d = this.dwell[key] ?? (this.dwell[key] = { t: 0, fired: false });
    if (!inside) {
      d.t = 0;
      d.fired = false;
      return;
    }
    d.t += dt;
    if (!d.fired && d.t >= need) {
      d.fired = true;
      fire();
    }
  }

  #watch(dt) {
    const z = this.zones;
    this.#stay('freezer', this.#inside(z.freezer), 0.3, dt, () => this.#freeze());
    this.#stay('bath', this.#inside(z.bath), 0, dt, () => this.#splash());
    this.#stay('washer', this.#inside(z.washer), 0.15, dt, () => this.#spin());
    this.#stay('litter', this.#inside(z.litter), 0.15, dt, () => this.#stink());
    this.#stay('checkout', this.#inside(z.checkout), 0.3, dt, () => this.#scan());
    this.#stay('pindakaas', this.#inside(z.pindakaas), 0.15, dt, () => this.#sticky());
    this.#stay('trolley', this.#inside([this.trolley.basket(this.basket)]), 0.35, dt, () => this.#ride());
    // the hob: any part of him on it
    const onHob = this.parts.find((p) => inBox(p.body.position, z.hob));
    if (onHob) this.#hot(onHob.body);
  }

  // ------------------------------------------------------------ the effects

  #freeze() {
    if (this.frozen || this.#cool('freeze', 1)) return;
    const pelvis = this.ragdoll.parts.pelvis.body;
    // locked to his hips just as he lies: stiff as a plank, in whatever pose
    const locks = this.parts.filter((p) => p.body !== pelvis).map((p) => {
      const c = new CANNON.LockConstraint(pelvis, p.body, { maxForce: 1e5 });
      c.collideConnected = false;
      this.world.addConstraint(c);
      return c;
    });
    this.frozen = { t: 0, thaw: false, locks };
    for (let i = 0; i < 50; i++) {
      this.#stick({ size: new THREE.Vector3(1, 1, 1).multiplyScalar(rand(0.02, 0.045)), color: pick(FROST), kind: 'frost' });
    }
    const c = this.#center();
    for (let i = 0; i < 6; i++) this.#puff(c.clone().add(_v.set(rand(-0.4, 0.4), rand(-0.1, 0.3), rand(-0.4, 0.4))), { color: 0xdff4ff, size: [0.1, 0.3], rise: 0.15, life: 1.6 });
    this.ragdoll.setExpression('ouch', FREEZE_TIME + THAW_TIME);
    this.sfx.freeze();
    this.sfx.voice('cold');
    this.#say('frozen');
    this.hooks.feat('frozen');
  }

  #updateFrozen(dt, physics) {
    const f = this.frozen;
    if (!f) return;
    f.t += dt;
    if (!f.thaw) {
      this.frost = Math.min(1, f.t / 0.3);
      if (f.t < FREEZE_TIME) return;
      // thawing: the joints come loose, the frost falls off, and he shivers
      f.thaw = true;
      f.t = 0;
      for (const lock of f.locks) this.world.removeConstraint(lock);
      f.locks = [];
      this.#shake(['frost']);
      this.sfx.chatter(THAW_TIME - 0.3);
      this.sfx.voice('cold');
      this.#say('thaw');
      f.kick = 0;
    }
    this.frost = Math.max(0, 1 - f.t / THAW_TIME);
    f.kick -= dt;
    if (physics && f.kick <= 0 && this.hooks.free()) {
      f.kick = 0.05;
      this.#kick((b) => {
        b.angularVelocity.x += rand(-2.5, 2.5);
        b.angularVelocity.z += rand(-2.5, 2.5);
        b.velocity.x += rand(-0.25, 0.25);
        b.velocity.z += rand(-0.25, 0.25);
      });
    }
    if (f.t >= THAW_TIME) this.frozen = null;
  }

  #splash() {
    if (this.#cool('splash', 1)) return;
    const c = this.#center();
    const bath = this.zones.bath[0];
    const floor = bath ? bath.min[1] + 0.2 : floorOf(c.y);
    this.sfx.splash(Math.min(1, this.ragdoll.coreSpeed() / 7 + 0.4));
    this.#burst(60, c, { colors: WATER, size: [0.02, 0.04], speed: [0.6, 2.4], up: [2, 4.5], floor, life: [0.8, 1.4], spread: 0.3 });
    for (let i = 0; i < 10; i++) this.#puff(c.clone().add(_v.set(rand(-0.5, 0.5), rand(-0.2, 0.1), rand(-0.3, 0.3))), { color: 0xffffff, size: [0.04, 0.09], rise: 0.25, life: 2.4, drift: 0.05 });
    this.duck.visible = true;
    this.#wash();
    this.wet = 1;
    this.#say('splash');
    this.hooks.feat('splash');
  }

  #hagelslag(point) {
    if (this.#cool('hagelslag', 1.5)) return;
    this.sfx.sprinkle();
    this.#burst(150, point, { colors: SPRINKLES, size: [0.03, 0.04], shape: [0.28, 0.28, 1], speed: [0.5, 2.5], up: [0.5, 3], floor: 0.01, life: [2, 3.5], kind: 'sprinkle', spread: 0.15 });
    const stuck = this.bitList.filter((b) => b.mode === 'stick' && b.kind === 'sprinkle').length;
    for (let i = 0; i < Math.min(90, 180 - stuck); i++) {
      const sz = rand(0.03, 0.04);
      this.#stick({ size: new THREE.Vector3(0.28 * sz, 0.28 * sz, sz), color: pick(SPRINKLES), kind: 'sprinkle' });
    }
    this.#say('hagelslag', point.clone().setY(point.y + 0.6));
    this.hooks.feat('hagelslag');
  }

  #spin() {
    if (this.spinning || this.#cool('spin', 4) || !this.hooks.free()) return;
    this.spinning = { t: 0, kick: 0, puff: 0 };
    this.sfx.rumble(SPIN_TIME);
    this.ragdoll.setExpression('ouch', SPIN_TIME);
    this.#say('spin');
    this.hooks.feat('spin');
  }

  #updateSpin(dt, physics) {
    const s = this.spinning;
    if (!s) return;
    s.t += dt;
    const k = 0.4 + s.t / SPIN_TIME;
    s.kick -= dt;
    s.puff -= dt;
    const washer = this.zones.washer[0];
    if (s.puff <= 0 && washer) {
      s.puff = 0.12;
      const at = _v.set(rand(washer.min[0], washer.max[0]), washer.min[1] - 0.2, rand(washer.min[2], washer.max[2]));
      this.#puff(at, { color: 0xffffff, size: [0.05, 0.12], rise: 0.5, life: 1.2 });
    }
    if (physics && s.kick <= 0 && this.hooks.free()) {
      s.kick = 0.05;
      this.#kick((b) => {
        b.velocity.x += rand(-1, 1) * k;
        b.velocity.y += rand(0, 1.2) * k;
        b.velocity.z += rand(-1, 1) * k;
        b.angularVelocity.x += rand(-6, 6) * k;
        b.angularVelocity.y += rand(-6, 6) * k;
        b.angularVelocity.z += rand(-6, 6) * k;
      });
    }
    if (s.t < SPIN_TIME) return;
    this.spinning = null;
    // done: flung off into the bathroom, clean and dizzy
    if (physics && this.hooks.free()) {
      const side = rand(-1.2, 1.2);
      this.#kick((b) => {
        b.velocity.set(-4 + rand(-0.4, 0.4), 4.5 + rand(-0.4, 0.4), side + rand(-0.4, 0.4));
        b.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
      });
      this.sfx.voice('fly');
    }
    this.#wash();
    this.wet = Math.max(this.wet, 0.7);
    this.ragdoll.setExpression('dizzy', 3);
  }

  #hot(body) {
    if (this.#cool('hot', 2.5)) return;
    this.sfx.sizzle();
    this.sfx.voice('hot');
    this.ragdoll.setExpression('ouch', 1.5);
    const at = _v.set(body.position.x, body.position.y, body.position.z);
    for (let i = 0; i < 8; i++) this.#puff(at.clone().add(_n.set(rand(-0.15, 0.15), rand(0, 0.1), rand(-0.15, 0.15))), { color: 0x6e6e6e, size: [0.07, 0.2], rise: 0.6, life: 1.4 });
    this.smokeT = 2; // and his trousers keep smoking a bit
    this.#say('hot');
    this.hooks.feat('hotplate');
    // he jumps up off it, away from the cooker hood above
    if (this.hooks.free()) {
      this.#kick((b) => {
        b.velocity.x += rand(-0.8, 0.8);
        b.velocity.y = Math.max(b.velocity.y, 0) + 5;
        b.velocity.z -= 2.5;
        b.angularVelocity.set(rand(-4, 4), rand(-4, 4), rand(-4, 4));
      });
    }
  }

  #piano(point, v) {
    if (this.#cool('piano', 0.25)) return;
    this.sfx.piano(v / 10);
    if (this.#cool('notes', 0.6)) return;
    this.hooks.pop(point.clone().setY(point.y + 0.5), '♪ ♫', 'good');
    if (v > 5) {
      this.hooks.feat('piano');
      if (!this.#cool('pianoPop', 2)) setTimeout(() => this.#say('piano'), 350);
    }
  }

  #pillow(point, v, bed) {
    if (this.#cool('pillow', 4)) return;
    this.sfx.poof();
    this.#burst(45, point.clone().setY(point.y + 0.15), { colors: FEATHERS, size: [0.05, 0.07], shape: [1, 0.08, 0.4], speed: [0.8, 2.5], up: [1, 2.5], floor: bed.top, life: [4, 7], mode: 'float', spread: 0.25 });
    for (let i = 0; i < 10; i++) {
      const sz = rand(0.05, 0.07);
      this.#stick({ size: new THREE.Vector3(sz, 0.08 * sz, 0.4 * sz), color: pick(FEATHERS), kind: 'feather' });
    }
    this.#say('pillow', point.clone().setY(point.y + 0.6));
    this.hooks.feat('pillow');
  }

  #stink() {
    const was = this.stinkT > 0;
    this.stinkT = STINK_TIME;
    if (was || this.#cool('stink', 1)) return;
    // flies, buzzing round his head
    for (let i = 0; i < 7; i++) {
      this.#bit({ mode: 'swarm', kind: 'fly', s: new THREE.Vector3(0.03, 0.018, 0.022), color: new THREE.Color(0x151515), r: rand(0.22, 0.38), w: rand(3, 6) * (Math.random() < 0.5 ? -1 : 1), h: rand(0.05, 0.35) });
    }
    this.buzzT = 0;
    this.sfx.voice('yuck');
    this.#say('stink');
    this.hooks.feat('stink');
  }

  #updateStink(dt) {
    if (this.stinkT <= 0) return;
    this.stinkT -= dt;
    this.stinkPuffT -= dt;
    this.buzzT -= dt;
    if (this.stinkPuffT <= 0) {
      this.stinkPuffT = 0.3;
      const part = pick(this.parts).group.position;
      this.#puff(_v.copy(part), { color: 0x9bbf3a, size: [0.08, 0.24], rise: 0.35, life: 1.8 });
    }
    if (this.buzzT <= 0) {
      this.buzzT = 3;
      this.sfx.buzz(Math.min(3, this.stinkT));
    }
    if (this.stinkT <= 0) this.bitList = this.bitList.filter((b) => b.kind !== 'fly');
  }

  #paintJob(point) {
    if (this.#cool('paint', 0.8)) return;
    const color = new THREE.Color(pick(PAINTS.filter((c) => c !== this.paint?.getHex())));
    this.paint = color;
    this.sfx.squelch();
    this.#burst(35, point, { colors: [color.getHex()], size: [0.03, 0.05], shape: [1, 0.5, 1], speed: [0.5, 2], up: [1, 2.5], floor: 0.01, life: [1.5, 2.5], spread: 0.15 });
    // splotches all over him, his hoodie too (that's #recolor)
    for (let i = 0; i < 16; i++) {
      const sz = rand(0.05, 0.09);
      this.#stick({ size: new THREE.Vector3(sz, 0.012, sz * rand(0.6, 1)), color, kind: 'paint', flat: true });
    }
    this.#say('paint', point.clone().setY(point.y + 0.8));
    this.hooks.feat('paint');
  }

  #sticky() {
    const was = this.stickyT > 0;
    this.stickyT = STICKY_TIME;
    this.peanut = 1;
    if (was || this.#cool('sticky', 1)) return;
    this.sfx.squelch();
    this.#say('sticky');
    this.hooks.feat('sticky');
  }

  #sint() {
    if (this.#cool('sint', 3)) return;
    this.mitre.visible = true;
    this.duck.visible = false; // (one hat at a time)
    this.sfx.chime();
    setTimeout(() => this.sfx.clatter(10), 300);
    const head = this.ragdoll.parts.head.group.position;
    for (let i = 0; i < 45; i++) {
      const sz = rand(0.025, 0.032);
      this.#bit({
        p: new THREE.Vector3(head.x + rand(-0.7, 0.7), head.y + rand(0.8, 1.8), head.z + rand(-0.7, 0.7)),
        v: new THREE.Vector3(rand(-0.3, 0.3), rand(-1.5, -0.5), rand(-0.3, 0.3)),
        q: randomQuat(new THREE.Quaternion()), axis: new THREE.Vector3(1, 0, 0), spin: rand(2, 6),
        s: new THREE.Vector3(sz, sz * 0.75, sz), color: new THREE.Color(pick(PEPERNOTEN)), life: rand(2.5, 3.5), floor: 0.01,
      });
    }
    this.#say('sint');
    this.hooks.feat('sint');
  }

  #scan() {
    if (this.#cool('scan', 4)) return;
    this.sfx.beep();
    setTimeout(() => this.sfx.beep(), 220);
    this.#say('price', null, 'price');
  }

  #lamp() {
    if (this.#cool('lamp', 1.5)) return;
    this.sfx.bonk();
    this.ragdoll.setExpression('dizzy'); // (until he's picked up again)
    this.flicker = 1.6;
    this.#say('lamp');
    this.hooks.feat('lamp');
  }

  #thorns(body, point, v) {
    if (v < 1 || this.#cool('thorn', 0.3)) return;
    this.sfx.scratch();
    const part = this.parts.find((p) => p.body === body);
    if (part) {
      // red scratches where the thorns caught him
      const old = this.bitList.filter((b) => b.kind === 'scratch');
      if (old.length > MAX_SCRATCHES - 3) this.bitList.splice(this.bitList.indexOf(old[0]), 1);
      const local = new THREE.Vector3();
      for (let i = 0; i < (v > 4 ? 3 : 2); i++) {
        body.pointToLocalFrame(_cv.set(point.x + rand(-0.05, 0.05), point.y + rand(-0.05, 0.05), point.z + rand(-0.05, 0.05)), _cv);
        local.set(_cv.x, _cv.y, _cv.z);
        this.#stick({ part, local, size: new THREE.Vector3(rand(0.06, 0.1), 0.004, 0.008), color: pick(SCRATCHES), kind: 'scratch', flat: true });
      }
    }
    // a few leaves and blackberries knocked off
    this.#burst(4, point, { colors: [0x2f5a2a, 0x3b6b30, 0x2a1030, 0x3a1340], size: [0.025, 0.04], speed: [0.3, 1.2], up: [0.5, 1.5], floor: 0.01, life: [1.5, 2.5] });
    if (!this.#cool('thornPop', 1.4)) {
      this.#say('thorns', point.clone().setY(point.y + 0.5), '');
      this.ragdoll.setExpression('ouch', 0.8);
      this.sfx.voice('hit');
    }
    if (v > 2) this.hooks.feat('scratched');
  }

  /** The cat's claws (cat.js), on body part `part` at `point`: red scratches there, and tufts of its fur floating off. */
  clawed(part, point) {
    if (!this.hooks.enabled()) return;
    this.sfx.scratch();
    const old = this.bitList.filter((b) => b.kind === 'scratch');
    if (old.length > MAX_SCRATCHES - 2) this.bitList.splice(this.bitList.indexOf(old[0]), 1);
    for (let i = 0; i < 2; i++) {
      part.body.pointToLocalFrame(_cv.set(point.x + rand(-0.06, 0.06), point.y + rand(-0.06, 0.06), point.z + rand(-0.06, 0.06)), _cv);
      this.#stick({ part, local: new THREE.Vector3(_cv.x, _cv.y, _cv.z), size: new THREE.Vector3(rand(0.06, 0.1), 0.004, 0.008), color: pick(SCRATCHES), kind: 'scratch', flat: true });
    }
    this.#burst(3, point, { colors: CAT_FUR, size: [0.02, 0.035], shape: [1, 0.5, 1], speed: [0.3, 1.2], up: [0.4, 1.4], life: [1.5, 2.5], mode: 'float', spread: 0.1 });
  }

  #ride() {
    if (!this.hooks.free() || !this.trolley.ride()) return;
    this.sfx.rattle(this.trolley.rideTime);
    this.ragdoll.setExpression('whee', this.trolley.rideTime);
    this.#say('trolley');
    this.hooks.feat('trolley');
  }

  #updateTrolley(dt, physics) {
    if (physics && this.trolley.update(dt) && this.hooks.free()) {
      // it stops dead and tips him out, head first
      this.#kick((b) => {
        b.velocity.x -= 3;
        b.velocity.y += 3.5;
        b.angularVelocity.set(rand(-3, 3), rand(-2, 2), rand(4, 8));
      });
      this.sfx.voice('fly');
    }
    this.trolley.sync();
  }

  // ------------------------------------------------------------ every frame

  /** dt in game time; `physics` is false while a replay has the physics paused. */
  update(dt, physics = true) {
    this.time += dt;
    if (physics && this.hooks.enabled()) this.#watch(dt);
    this.#updateFrozen(dt, physics);
    this.#updateSpin(dt, physics);
    this.#updateStink(dt);
    this.#updateTrolley(dt, physics);
    if (this.stickyT > 0) this.stickyT -= dt;
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const a = this.anchors[i];
      a.t -= dt;
      if (a.t > 0) continue;
      this.world.removeConstraint(a.c);
      this.world.removeBody(a.anchor);
      this.anchors.splice(i, 1);
    }
    if (this.smokeT > 0) {
      this.smokeT -= dt;
      if (Math.random() < dt * 8) this.#puff(_v.copy(this.ragdoll.parts.pelvis.group.position), { color: 0x777777, size: [0.05, 0.14], rise: 0.5, life: 1.1 });
    }
    if (this.wet > 0) this.wet = Math.max(0, this.wet - dt / 12);
    if (this.flicker > 0 && this.lampMat) {
      this.flicker -= dt;
      if (this.flicker <= 0) this.lampMat.emissive.copy(this.lampGlow);
      else if (Math.random() < 0.4) this.lampMat.emissive.setHex(Math.random() < 0.5 ? 0x000000 : 0xfff2b0);
    }
    this.#recolor();
    this.#drawBits(dt);
    this.#drawPuffs(dt);
  }

  #drawBits(dt) {
    const list = this.bitList;
    const head = this.ragdoll.parts.head.group.position;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      b.age += dt;
      if (b.age >= b.life) continue;
      switch (b.mode) {
        case 'stick': {
          const g = b.part.group;
          b.p.copy(b.local).applyQuaternion(g.quaternion).add(g.position);
          b.q.copy(g.quaternion).multiply(b.lq);
          break;
        }
        case 'swarm': {
          const a = b.phase + this.time * b.w;
          b.p.set(head.x + Math.cos(a) * b.r, head.y + b.h + Math.sin(this.time * 3 + b.phase) * 0.06, head.z + Math.sin(a) * b.r);
          b.q.setFromAxisAngle(_y, -a);
          break;
        }
        case 'float': {
          // a feather: slows down fast, then drifts down, swaying
          const drag = Math.exp(-3 * dt);
          b.v.x *= drag;
          b.v.z *= drag;
          b.v.y = Math.max(b.v.y * drag - 3 * dt, -0.3);
          if (b.p.y > b.floor) {
            b.p.addScaledVector(b.v, dt);
            b.p.x += Math.sin(b.age * 3 + b.phase) * 0.25 * dt;
            b.q.setFromEuler(new THREE.Euler(Math.sin(b.age * 3 + b.phase) * 0.6, b.phase, Math.cos(b.age * 2.4 + b.phase) * 0.5));
          } else b.p.y = b.floor;
          break;
        }
        default: { // 'fly': thrown about, falls and lies on the floor
          if (b.p.y > b.floor || b.v.y > 0) {
            b.v.y -= 9.8 * dt;
            b.p.addScaledVector(b.v, dt);
            if (b.axis) b.q.multiply(_q.setFromAxisAngle(b.axis, b.spin * dt));
            if (b.p.y < b.floor) {
              b.p.y = b.floor;
              b.v.set(0, 0, 0);
            }
          }
        }
      }
      // shrinks away at the end of its life
      const fade = b.life === Infinity ? 1 : Math.min(1, (b.life - b.age) / 0.4);
      _s.copy(b.s).multiplyScalar(fade);
      this.bits.setMatrixAt(n, _m.compose(b.p, b.q, _s));
      this.bits.setColorAt(n, b.color);
      list[n++] = b;
    }
    list.length = n;
    this.bits.count = n;
    this.bits.visible = n > 0;
    if (n) {
      this.bits.instanceMatrix.needsUpdate = true;
      this.bits.instanceColor.needsUpdate = true;
    }
  }

  #drawPuffs(dt) {
    const list = this.puffList;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const f = p.age / p.life;
      p.p.addScaledVector(p.v, dt);
      // grows, then shrinks away (all puffs share one see-through material, so they can't fade)
      const size = (p.s0 + (p.s1 - p.s0) * f) * Math.min(1, p.age / 0.12) * Math.min(1, (1 - f) / 0.35);
      _s.setScalar(size);
      this.puffs.setMatrixAt(n, _m.compose(p.p, _q.identity(), _s));
      this.puffs.setColorAt(n, p.color);
      list[n++] = p;
    }
    list.length = n;
    this.puffs.count = n;
    this.puffs.visible = n > 0;
    if (n) {
      this.puffs.instanceMatrix.needsUpdate = true;
      this.puffs.instanceColor.needsUpdate = true;
    }
  }

  /** Tints his materials for the frost, the pindakaas, the paint and being wet (only when that changed). */
  #recolor(force = false) {
    const look = `${this.frost.toFixed(2)}|${this.peanut.toFixed(2)}|${this.wet.toFixed(2)}|${this.paint?.getHex() ?? '-'}`;
    if (look === this.look && !force) return;
    this.look = look;
    for (const m of this.mats) {
      const u = m.userData;
      _c.copy(u.fxBase);
      _g.copy(u.fxGlow ?? BLACK);
      if (u.hoodie) {
        // painted: plain paint instead of the hoodie's fabric
        const map = this.paint ? null : u.fxMap;
        if (m.map !== map) {
          m.map = map;
          m.needsUpdate = true;
        }
        if (this.paint) _c.multiply(this.paint);
      }
      if (this.peanut) _c.lerp(PEANUT, 0.45 * this.peanut);
      if (this.frost) {
        _c.lerp(ICE, 0.6 * this.frost);
        _g.lerp(ICE_GLOW, this.frost);
      }
      if (this.wet) _c.multiplyScalar(1 - 0.3 * this.wet);
      u.zapBase.copy(_c);
      if (u.zapGlow) u.zapGlow.copy(_g);
    }
    this.zap.repaint();
  }
}
