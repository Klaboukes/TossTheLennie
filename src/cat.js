import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The family's cat: a fluffy grey-black and white one (a tuxedo, with a white
// bib, belly, socks and muzzle) that wanders about the living room, the
// kitchen, the utility room and the back garden. It naps on the couch and the
// lounge set, eats from its bowls in the kitchen, uses its litter box, sits
// on the trampoline, grooms itself and watches the garden through the window,
// and goes in and out through the cat flaps in the glass doors to the utility
// room and the garden (house.js builds those).
//
// Toss Lennie near it and it puffs up, hisses and pounces: it clings to him,
// claws going, scratching him (effects.js draws the scratches), then leaps
// off and runs for it. That's a bonus once a toss (main.js).
//
// Cheap on purpose: the cat is eight meshes (a body, a head, four legs and a
// tail in two halves), each one merged geometry with its colours painted on
// the vertices, so one material for all of it and eight draw calls. It has no
// physics body; Lennie only finds out about it when it lands on him. It walks
// a small hand-made network of paths between the furniture.

const WALK = 0.7; // m/s
const RUN = 2.4;
const TURN = 7; // rad/s
const REACH = 1.4; // a tossed Lennie this close (sideways) to the cat gets attacked
const COOLDOWN = 8; // seconds after an attack before it attacks again
const ALERT = 0.35; // puffed up and hissing before it pounces
const POUNCE = 0.32;
const CLING = 2.3; // seconds clinging to him, scratching
const GRAVITY = 9.8;

const GREY = [0x55555c, 0x4c4c53, 0x606067, 0x45454b, 0x6a6a71]; // greyish black, a bit lighter and darker in tufts
const WHITE = [0xf3f1ec, 0xeceae4, 0xfaf9f6];
const EYE = 0xb9c93c;
const PINK = 0xe59aa2;
const BLACK = 0x111111;

// Lennie's body, head and hips as the cat clings to them: ellipsoids [rx, ry, rz] in each part's frame (ragdoll.js)
const CLING_SHAPES = { head: [0.12, 0.13, 0.12], chest: [0.23, 0.22, 0.16], pelvis: [0.2, 0.1, 0.14] };

const ATTACK_LINES = ['HISSSS!', 'Angry kitty!', 'Claws out!', 'Cat attack!', 'MRRRAOW!'];
const CLING_LINES = ['Get it off!', 'Bad kitty!', 'Not the face!', 'Scratch scratch!', 'Ow ow ow!', 'Nice kitty... NOT!'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const ease = (t) => t * t * (3 - 2 * t);
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// ------------------------------------------------------------ where it goes
// Spots on the floor (and a few on furniture) it walks between, in the house
// (living room, kitchen, utility room) and the back garden. `do` is what it
// does when it stops there; `face` the way it faces then (yaw, 0 = +z).
const N = (x, y, z, out, act = null, face = null) => ({ x, y, z, out, do: act, face });
const NODES = {
  // living room (the couch is at the left, the dining table at the right)
  lrA: N(1.1, 0, -3.1, false, ['sit', 'groom']),
  lrB: N(-0.7, 0, -3.25, false),
  lrC: N(-2.4, 0, -3.3, false, ['groom']),
  window: N(-1.4, 0, -4.4, false, ['watch'], Math.PI), // looking out into the garden
  lrE: N(0.45, 0, -2.0, false),
  lrDoor: N(1.475, 0, -4.4, false),
  couchFront: N(-2.45, 0, -2.1, false),
  couch: N(-2.5, 0.52, -1.33, false, ['nap', 'loaf'], 2.6),
  // round the back of the room, so a Lennie lying in the middle (where he starts) doesn't cut it off:
  // between the side table and the couch, past the couch's end, and along the dining table
  sofaW: N(-1.75, 0, -1.82, false),
  sofaE: N(-0.3, 0, -1.85, false),
  lrN: N(0.45, 0, -0.55, false),
  lrT: N(1.0, 0, -2.4, false),
  lrS: N(0.35, 0, -3.32, false), // (and in front of the comfy chair)
  // kitchen, through the gap past the end of the couch
  kA: N(0.3, 0, 0.6, false),
  kB: N(0.45, 0, 2.6, false, ['sit']),
  kC: N(2.2, 0, 3.0, false, ['groom', 'sit']),
  bowls: N(1.62, 0, 2.47, false, ['eat'], Math.PI),
  // the utility room, behind the living room's back wall
  uIn: N(1.475, 0, -5.5, false),
  uMid: N(1.2, 0, -5.82, false),
  litter: N(1.8, 0.03, -6.22, false, ['litter'], -Math.PI / 2),
  // the back garden
  gOut: N(0.2, 0, -5.82, true),
  gA: N(-0.7, 0, -7.6, true, ['groom', 'sit']),
  gB: N(-0.5, 0, -10.4, true),
  loungeFront: N(1.1, 0, -10.95, true),
  lounge: N(1.55, 0.47, -10.3, true, ['nap', 'loaf'], Math.PI / 2),
  trampSide: N(-0.6, 0, -13.55, true),
  tramp: N(0.3, 0.88, -13.55, true, ['sit', 'loaf', 'groom'], Math.PI / 2),
  gD: N(-0.4, 0, -16.9, true, ['sit', 'groom'], Math.PI),
  gE: N(2.3, 0, -17.3, true, ['sit'], Math.PI),
};
const EDGES = [
  ['lrA', 'lrB'], ['lrB', 'lrC'], ['lrC', 'window'], ['lrB', 'window'], ['lrA', 'lrDoor'], ['lrA', 'lrE'], ['lrB', 'lrE'],
  ['lrC', 'couchFront'], ['couchFront', 'couch'],
  ['couchFront', 'sofaW'], ['sofaW', 'sofaE'], ['sofaE', 'lrN'], ['sofaE', 'lrE'], ['lrE', 'lrN'], ['lrN', 'lrT'], ['lrT', 'lrA'], ['lrT', 'lrE'], ['lrN', 'kA'], ['lrB', 'lrS'], ['lrS', 'lrA'],
  ['lrE', 'kA'], ['kA', 'kB'], ['kB', 'kC'], ['kB', 'bowls'], ['kC', 'bowls'],
  ['lrDoor', 'uIn', { door: true }], ['uIn', 'uMid'], ['uMid', 'litter', { jump: true }], ['uIn', 'litter', { jump: true }],
  ['uMid', 'gOut', { door: true }], ['gOut', 'gA'], ['gA', 'gB'], ['gB', 'loungeFront'], ['loungeFront', 'lounge'],
  ['gB', 'trampSide'], ['trampSide', 'tramp'], ['trampSide', 'gD'], ['gD', 'gE'],
];

// ------------------------------------------------------------ how it looks
// One merged geometry per moving part, coloured per vertex.

function paint(geo, colorAt) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    c.setHex(typeof colorAt === 'function' ? colorAt(p) : colorAt);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** A blob at (x, y, z), scaled, in one colour (or a colour picked by where it is). */
function blob(r, [x, y, z], [sx, sy, sz] = [1, 1, 1], color, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  geo.scale(sx, sy, sz).translate(x, y, z);
  return paint(geo, color);
}

function shape(geo, [x, y, z], color, rot = null) {
  if (rot) geo.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]);
  geo.translate(x, y, z);
  return paint(geo, color);
}

function buildLooks() {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const grey = () => GREY[Math.floor(rnd() * GREY.length)];
  const white = () => WHITE[Math.floor(rnd() * WHITE.length)];

  // The body, round its middle (0, 0, 0), nose towards +z: an egg of fur
  // with tufts all over it. White underneath and on the chest (the bib).
  const coat = (p) => (p.y < -0.045 || (p.z > 0.11 && p.y < 0.07) ? white() : grey());
  const R = [0.12, 0.115, 0.215];
  const body = [blob(1, [0, 0, 0], R, coat, 2)];
  for (let i = 0; i < 70; i++) {
    // a point spread evenly over the egg, pushed out a little: the fluff
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const d = new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a));
    const at = new THREE.Vector3(d.x * R[0], d.y * R[1], d.z * R[2]).multiplyScalar(0.93);
    const r = (d.z > 0.5 ? 0.06 : 0.048) * (0.8 + rnd() * 0.4); // a fuller ruff round the chest
    body.push(blob(r, at.toArray(), [1, 0.85, 1.1], coat(at), 1));
  }

  // The head, round the top of its neck: a round furry head with big
  // cheeks, pointy ears, a white muzzle and chin and a white blaze up the
  // nose, yellow-green eyes, a pink nose and white whiskers.
  const face = (p) => ((p.z > 0.085 && p.y < 0.04) || (p.z > 0.12 && Math.abs(p.x) < 0.018 && p.y < 0.09) ? white() : grey());
  const headParts = (eyesShut) => {
    const parts = [blob(0.085, [0, 0.04, 0.07], [1.08, 0.95, 0.92], face, 2)];
    for (const s of [-1, 1]) {
      parts.push(blob(0.05, [s * 0.055, 0.015, 0.09], [1, 0.85, 0.9], face, 1)); // cheek fluff
      parts.push(blob(0.035, [s * 0.075, 0.0, 0.06], [1, 0.9, 1.1], grey(), 1));
      parts.push(shape(new THREE.ConeGeometry(0.036, 0.075, 6), [s * 0.05, 0.125, 0.055], grey(), [-0.15, 0, -s * 0.35])); // ears
      parts.push(shape(new THREE.ConeGeometry(0.022, 0.05, 5), [s * 0.049, 0.118, 0.066], PINK, [-0.15, 0, -s * 0.35]));
      if (eyesShut) {
        parts.push(shape(new THREE.BoxGeometry(0.03, 0.006, 0.01), [s * 0.034, 0.055, 0.147], BLACK, [0, 0, s * 0.25]));
      } else {
        parts.push(blob(0.019, [s * 0.034, 0.056, 0.137], [1, 1.05, 0.7], EYE, 1));
        parts.push(blob(0.009, [s * 0.034, 0.056, 0.151], [0.55, 1.7, 0.5], BLACK, 1)); // slit pupils
      }
      for (const k of [-1, 0, 1]) {
        // whiskers, fanning out sideways from the muzzle
        parts.push(shape(new THREE.BoxGeometry(0.11, 0.0025, 0.0025), [s * 0.075, 0.012 + k * 0.009, 0.15], 0xffffff, [0, s * 0.25, s * k * 0.12]));
      }
    }
    parts.push(blob(0.042, [0, 0.008, 0.135], [1.2, 0.75, 0.8], white(), 1)); // the muzzle
    parts.push(blob(0.012, [0, 0.028, 0.168], [1.2, 0.8, 0.8], PINK, 1)); // the nose
    return mergeGeometries(parts);
  };

  // A leg hangs down from its pivot (the shoulder or hip) 0.2 m to the paw,
  // with a white sock. Hind legs have fluffy thighs.
  const leg = (hind) => {
    const sock = (p) => (p.y < (hind ? -0.12 : -0.07) ? white() : grey());
    const parts = [
      shape(new THREE.CylinderGeometry(0.03, 0.026, 0.19, 8), [0, -0.095, 0], sock),
      blob(0.034, [0, -0.19, 0.012], [1, 0.6, 1.25], white(), 1),
    ];
    for (let i = 0; i < 5; i++) parts.push(blob(0.032, [rnd() * 0.02 - 0.01, -0.03 - i * 0.03, rnd() * 0.02 - 0.01], [1, 1, 1], sock, 1));
    if (hind) parts.push(blob(0.06, [0, -0.02, -0.01], [0.85, 1.1, 1.1], grey(), 1));
    return mergeGeometries(parts);
  };

  // The tail in two halves, each 0.17 m along −z from its pivot: a bushy
  // chain of tufts, grey all the way.
  const tail = (tip) => {
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const r = (tip ? 0.042 - i * 0.003 : 0.045) * (0.9 + rnd() * 0.2);
      parts.push(blob(r, [rnd() * 0.012 - 0.006, rnd() * 0.012 - 0.006, -0.012 - i * 0.026], [1, 1, 1.25], grey(), 1));
    }
    return mergeGeometries(parts);
  };

  return { body: mergeGeometries(body), head: headParts(false), headShut: headParts(true), front: leg(false), hind: leg(true), tailA: tail(false), tailB: tail(true) };
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------ poses
// Each pose is a set of numbers the drawing eases towards; walking, running
// and scratching swing the legs and tail on top of that.
const STAND = {
  bodyY: 0.235, bodyZ: 0, pitch: 0, sx: 1, sy: 1, sz: 1,
  headY: 0.33, headZ: 0.19, headPitch: 0,
  frontY: 0.2, frontZ: 0.12, front: 0, frontLen: 1,
  hindY: 0.2, hindZ: -0.13, hind: 0, hindLen: 1,
  tailPitch: 1.0, tailBend: 0.5, tailYaw: 0, tailScale: 1,
};
const POSES = {
  stand: STAND,
  walk: { ...STAND, tailPitch: 0.85, tailBend: 0.75 }, // tail up, its tip curled over
  run: { ...STAND, bodyY: 0.22, pitch: 0.05, sz: 1.08, headY: 0.31, headZ: 0.21, tailPitch: 0.35, tailBend: 0.2 },
  sit: {
    ...STAND, bodyY: 0.2, bodyZ: -0.05, pitch: -0.55, headY: 0.43, headZ: 0.12, headPitch: 0.05,
    frontY: 0.27, frontZ: 0.08, frontLen: 1.33, hindY: 0.08, hindZ: -0.12, hind: -1.45, hindLen: 0.85,
    tailPitch: -0.45, tailBend: 0.45, tailYaw: 0.9,
  },
  loaf: {
    ...STAND, bodyY: 0.125, sy: 0.88, headY: 0.23, headZ: 0.2, headPitch: 0.05,
    frontY: 0.07, frontZ: 0.1, front: -1.5, frontLen: 0.55, hindY: 0.07, hindZ: -0.1, hind: -1.5, hindLen: 0.55,
    tailPitch: -0.6, tailBend: 0.6, tailYaw: 1.3,
  },
  eat: { ...STAND, pitch: 0.12, headY: 0.26, headZ: 0.22, headPitch: 0.95, frontZ: 0.13, front: 0.15, frontLen: 0.92 },
  alert: {
    ...STAND, bodyY: 0.29, sx: 1.22, sy: 1.25, sz: 1.04, headY: 0.31, headZ: 0.23, headPitch: 0.25,
    frontY: 0.26, frontLen: 1.3, hindY: 0.26, hindLen: 1.3, tailPitch: 1.55, tailBend: -0.05, tailScale: 1.6,
  },
  leap: {
    ...STAND, sx: 1.12, sy: 1.12, sz: 1.15, headPitch: -0.1, front: -1.25, hind: 1.15, frontLen: 1.1, hindLen: 1.1,
    tailPitch: 0.15, tailBend: 0.1, tailScale: 1.4,
  },
  cling: {
    ...STAND, bodyY: 0.15, sx: 1.15, sy: 1.1, sz: 1.05, headY: 0.24, headZ: 0.2, headPitch: 0.45,
    frontY: 0.13, front: -0.35, frontLen: 0.75, hindY: 0.13, hind: 0.35, hindLen: 0.75, tailPitch: 0.3, tailBend: 0.4, tailScale: 1.5,
  },
};
POSES.nap = { ...POSES.loaf, bodyY: 0.115, headY: 0.19, headZ: 0.21, headPitch: 0.35, tailYaw: 1.5 };
POSES.watch = POSES.sit;
POSES.groom = POSES.sit;
POSES.litter = POSES.sit;
const KEYS = Object.keys(STAND);

export function createCat({ scene, house, ragdoll, effects, sfx, hooks }) {
  const looks = buildLooks();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const root = new THREE.Group();
  const mesh = (geo) => {
    const m = new THREE.Mesh(geo, material);
    m.userData.noAim = true; // not scenery: aiming, the see-through circle and the gluing (batching.js) leave it alone
    return m;
  };
  const body = mesh(looks.body);
  const head = mesh(looks.head);
  const legs = [[-1, false], [1, false], [-1, true], [1, true]].map(([side, hind]) => {
    const m = mesh(hind ? looks.hind : looks.front);
    m.userData.side = side;
    m.userData.hind = hind;
    return m;
  });
  const tailA = mesh(looks.tailA);
  const tailB = mesh(looks.tailB);
  tailB.position.z = -0.17;
  tailA.add(tailB);
  // the tail's pitch is how high it's held, its yaw how far it swings round to the side (in that order)
  tailA.rotation.order = 'YXZ';
  tailB.rotation.order = 'YXZ';
  root.add(body, head, ...legs, tailA);
  root.userData.noAim = true;
  scene.add(root);

  // its food and water bowls on the kitchen floor, against the counter (one mesh)
  {
    const bowl = (x, z, color, inside) => [
      shape(new THREE.CylinderGeometry(0.075, 0.06, 0.05, 16), [x, 0.037, z], color),
      shape(new THREE.CylinderGeometry(0.062, 0.062, 0.004, 16), [x, 0.063, z], inside),
    ];
    const kibble = [];
    for (let i = 0; i < 9; i++) kibble.push(blob(0.012, [1.62 + Math.cos(i * 2.4) * 0.03, 0.067, 2.16 + Math.sin(i * 2.4) * 0.03], [1, 0.6, 1], i % 2 ? 0x7a4a22 : 0x8f5a2b, 0));
    const bowls = new THREE.Mesh(mergeGeometries([...bowl(1.62, 2.16, 0xb5332c, 0x5e3a1c), ...bowl(1.9, 2.16, 0x3d6fb0, 0x9fd0ee), ...kibble]), material);
    bowls.userData.noAim = true;
    scene.add(bowls);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  shadow.userData.noAim = true;
  scene.add(shadow);

  // ------------------------------------------------------------ the paths
  const nodes = {};
  for (const [id, n] of Object.entries(NODES)) nodes[id] = { id, ...n, links: [] };
  for (const [a, b, opts = {}] of EDGES) {
    const A = nodes[a];
    const B = nodes[b];
    let door = null;
    if (opts.door) {
      // the door between them (house.js), whose cat flap it uses
      const mx = (A.x + B.x) / 2;
      const mz = (A.z + B.z) / 2;
      door = house.doors.find((d) => d.flap && Math.hypot(d.center.x - mx, d.center.z - mz) < 0.7) ?? null;
    }
    A.links.push({ to: B, door, jump: !!opts.jump });
    B.links.push({ to: A, door, jump: !!opts.jump });
  }
  const restSpots = Object.values(nodes).filter((n) => n.do);

  // ------------------------------------------------------------ state
  const pos = new THREE.Vector3(nodes.couch.x, nodes.couch.y, nodes.couch.z);
  let yaw = nodes.couch.face;
  const pose = { ...POSES.nap };
  const cat = {
    mode: 'rest', // rest | walk | alert | pounce | cling | fall | gone
    act: 'nap',
    timer: rand(10, 20),
    at: nodes.couch,
    moves: [], // what's left of the way to where it's going: walk, hop (through a cat flap) or jump
    move: null,
    speed: WALK,
    cooldown: 0,
    phase: 0, // the legs' swing
    t: 0, // time in the current mode
    target: null, // the body part it pounces on or clings to
    from: new THREE.Vector3(),
    local: new THREE.Vector3(), // where it clings, in the part's frame
    localQ: new THREE.Quaternion(),
    vel: new THREE.Vector3(),
    scratchT: 0,
    lineT: 0,
    checkT: 0,
    meowT: rand(8, 20),
    flee: false, // running back to its paths after an attack
    dash: false, // running from him, straight past him if need be
  };
  const flaps = new Set(); // flaps still swinging: { flap, angle, vel }
  const flapState = new Map();
  const parts = Object.values(ragdoll.parts);

  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _up = new THREE.Vector3(0, 1, 0);

  // ------------------------------------------------------------ getting about

  /** True if any of Lennie lies close to the point (x, y, z), so the cat won't walk through him. */
  function lennieAt(x, y, z, r = 0.4) {
    for (const p of parts) {
      const b = p.body.position;
      if (b.y - y < 1.0 && b.y - y > -0.4 && Math.hypot(b.x - x, b.z - z) < r) return true;
    }
    return false;
  }

  function edgeBlocked(A, B) {
    const n = Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / 0.25);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      if (lennieAt(lerp(A.x, B.x, f), lerp(A.y, B.y, f), lerp(A.z, B.z, f))) return true;
    }
    return false;
  }

  /** The nodes from `from` to `to`, avoiding Lennie unless it's running from him (null if there's no way). */
  function route(from, to, avoid = true) {
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const n = queue.shift();
      if (n === to) break;
      for (const { to: m } of n.links) {
        if (prev.has(m) || (avoid && edgeBlocked(n, m))) continue;
        prev.set(m, n);
        queue.push(m);
      }
    }
    if (!prev.has(to)) return null;
    const path = [];
    for (let n = to; n; n = prev.get(n)) path.unshift(n);
    return path;
  }

  /** Turns a list of nodes into moves: walking, jumping up or down, and hopping through a cat flap. */
  function movesAlong(path) {
    const moves = [];
    for (let i = 1; i < path.length; i++) {
      const A = path[i - 1];
      const B = path[i];
      const link = A.links.find((l) => l.to === B);
      const to = new THREE.Vector3(B.x, B.y, B.z);
      if (Math.abs(B.y - A.y) > 0.2 || link.jump) {
        moves.push({ kind: 'jump', to, node: B });
      } else if (link.door) {
        // walk up to the door, hop through the flap, walk on
        const d = link.door;
        const n = d.normal;
        const sA = (A.x - d.center.x) * n.x + (A.z - d.center.z) * n.z;
        const sB = (B.x - d.center.x) * n.x + (B.z - d.center.z) * n.z;
        const along = (s) => {
          const f = (s - sA) / (sB - sA);
          return new THREE.Vector3(lerp(A.x, B.x, f), 0, lerp(A.z, B.z, f));
        };
        const dir = Math.sign(sB - sA);
        moves.push({ kind: 'walk', to: along(-0.35 * dir), node: null });
        moves.push({ kind: 'hop', to: along(0.35 * dir), door: d, dir, node: null });
        moves.push({ kind: 'walk', to, node: B });
      } else {
        moves.push({ kind: 'walk', to, node: B });
      }
    }
    return moves;
  }

  /** Off to somewhere new: another rest spot, mostly in the same part (house or garden). */
  function wander(speed = WALK) {
    const here = cat.at;
    const sameSide = Math.random() < 0.7;
    const options = restSpots.filter((n) => n !== here && (n.out === here.out) === sameSide && !lennieAt(n.x, n.y, n.z, 0.9));
    const fallback = restSpots.filter((n) => n !== here && !lennieAt(n.x, n.y, n.z, 0.9));
    for (const list of [options, fallback]) {
      for (const n of [...list].sort(() => Math.random() - 0.5)) if (go(n, speed)) return true;
    }
    return false;
  }

  /** Sets off for node `n` (false if Lennie's in the way of every route there). */
  function go(n, speed = WALK, avoid = true) {
    const here = cat.at;
    const path = route(here, n, avoid);
    if (!path) return false;
    cat.moves = movesAlong(path);
    cat.dash = !avoid; // (then it doesn't stop for him on the way either)
    if (Math.hypot(pos.x - here.x, pos.z - here.z) > 0.05) cat.moves.unshift({ kind: 'walk', to: new THREE.Vector3(here.x, here.y, here.z), node: here });
    cat.speed = speed;
    setMode('walk');
    nextMove();
    return true;
  }

  function nextMove() {
    cat.move = cat.moves.shift() ?? null;
    if (!cat.move) {
      arrive();
      return;
    }
    cat.move.from = pos.clone();
    cat.move.t = 0;
    const m = cat.move;
    if (m.kind === 'jump') m.dur = 0.45 + 0.1 * Math.abs(m.to.y - pos.y);
    if (m.kind === 'hop') m.dur = 0.5;
  }

  function arrive() {
    const n = cat.at;
    if (cat.flee) {
      // back on its paths after an attack: on to one of its spots, as far from Lennie as it can get
      cat.flee = false;
      const c = ragdoll.center(_w);
      const far = [...restSpots].sort((a, b) => Math.hypot(b.x - c.x, b.z - c.z) - Math.hypot(a.x - c.x, a.z - c.z));
      // (dashing straight past him if it has to)
      for (const spot of far.slice(0, 3)) if (spot !== n && go(spot, RUN, false)) return;
    }
    cat.speed = WALK;
    cat.dash = false;
    setMode('rest');
    cat.act = pick(n.do ?? ['sit']);
    cat.timer = cat.act === 'nap' ? rand(10, 18) : cat.act === 'loaf' ? rand(6, 12) : rand(3, 7);
    if (Math.random() < 0.25) meow();
  }

  function setMode(mode) {
    cat.mode = mode;
    cat.t = 0;
  }

  /** A miaow, as loud as the cat is close to the camera, with a "Meow!" now and then. */
  function meow() {
    const d = hooks.cameraDistance(pos);
    if (d > 12) return;
    sfx.meow(1 - d / 13);
    if (Math.random() < 0.5) hooks.pop(_v.copy(pos).setY(pos.y + 0.6), 'Meow!', '');
  }

  // ------------------------------------------------------------ attacking

  /** The part of Lennie nearest the cat that a tossed Lennie brings within reach (with nothing in between), or null. */
  function inReach() {
    if (!hooks.flying() || cat.cooldown > 0 || (cat.mode !== 'rest' && cat.mode !== 'walk') || (cat.move && cat.move.kind !== 'walk' && cat.mode === 'walk')) return null;
    let best = null;
    let bestD = REACH;
    for (const p of parts) {
      const b = p.body.position;
      const dy = b.y - pos.y;
      if (dy < -0.5 || dy > 1.8) continue;
      const d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return null;
    const b = best.body.position;
    if (!hooks.clear(_v.set(pos.x, pos.y + 0.25, pos.z), _w.set(b.x, b.y, b.z))) return null;
    // it goes for his body or his head (on an arm or a leg it would end up wedged into him)
    let target = null;
    let targetD = Infinity;
    for (const name of ['chest', 'pelvis', 'head']) {
      const d = ragdoll.parts[name].body.position.distanceTo(pos);
      if (d < targetD) {
        targetD = d;
        target = ragdoll.parts[name];
      }
    }
    return target;
  }

  function attack(part) {
    cat.target = part;
    setMode('alert');
    cat.moves = [];
    cat.move = null;
    sfx.hiss();
    hooks.pop(_v.copy(pos).setY(pos.y + 0.7), pick(ATTACK_LINES), 'good');
    hooks.feat('cat');
  }

  /** Where the cat holds on to a body part (in the part's frame): on the side it came from, feet towards him, head up. */
  function clingSpot(part) {
    const g = part.group;
    const name = part.name.replace(/[LR]$/, '');
    const [rx, ry, rz] = CLING_SHAPES[name] ?? CLING_SHAPES.chest;
    const inv = _q.copy(g.quaternion).invert();
    // the way from the part to the cat, in the part's frame
    const dir = _v.copy(pos).setY(pos.y + 0.2).sub(g.position).applyQuaternion(inv);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    if (name !== 'head') {
      // on his front or back rather than his side (where his arms are), and not his neck or bottom
      dir.x *= 0.5;
      dir.normalize();
      dir.y = clamp(dir.y, -0.5, 0.5);
    }
    dir.normalize();
    // the point on the part's surface that way, and the way that surface faces there
    const k = 1 / Math.sqrt((dir.x / rx) ** 2 + (dir.y / ry) ** 2 + (dir.z / rz) ** 2);
    cat.local.copy(dir).multiplyScalar(k);
    const out = dir.set(cat.local.x / rx ** 2, cat.local.y / ry ** 2, cat.local.z / rz ** 2).normalize();
    cat.local.addScaledVector(out, 0.015);
    // its head towards the sky, as far as it can
    const fwd = _w.copy(_up).applyQuaternion(inv);
    fwd.addScaledVector(out, -fwd.dot(out));
    if (fwd.lengthSq() < 1e-3) {
      // (on top of him: then the way it was going)
      fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).applyQuaternion(inv);
      fwd.addScaledVector(out, -fwd.dot(out));
      if (fwd.lengthSq() < 1e-3) fwd.set(out.y, -out.x, 0);
    }
    fwd.normalize();
    const side = new THREE.Vector3().crossVectors(out, fwd).normalize();
    cat.localQ.setFromRotationMatrix(_m.makeBasis(side, out, fwd));
  }

  function letGo() {
    if (cat.mode !== 'cling' && cat.mode !== 'pounce') return;
    // leap off, away from him
    const c = ragdoll.center(_w);
    cat.vel.copy(pos).sub(c).setY(0);
    if (cat.vel.lengthSq() < 1e-4) cat.vel.set(1, 0, 0);
    cat.vel.normalize().multiplyScalar(rand(1.5, 2.5)).setY(rand(1.5, 2.5));
    root.quaternion.identity();
    yaw = Math.atan2(cat.vel.x, cat.vel.z);
    cat.target = null;
    setMode('fall');
  }

  /** After a fall: run back to the paths if it can see a way there, else slip off out of sight. */
  function landed() {
    cat.cooldown = COOLDOWN;
    const out = !hooks.inside(pos);
    let best = null;
    let bestD = 5;
    for (const n of Object.values(nodes)) {
      if (n.out !== out || Math.abs(n.y - pos.y) > 0.6) continue;
      const d = Math.hypot(n.x - pos.x, n.z - pos.z);
      if (d < bestD && hooks.clear(_v.set(pos.x, pos.y + 0.2, pos.z), _w.set(n.x, n.y + 0.2, n.z))) {
        bestD = d;
        best = n;
      }
    }
    if (!best) {
      // (somewhere it has no paths: upstairs, the street, the shop) off it goes, and turns up again later
      setMode('gone');
      cat.timer = rand(3, 5);
      return;
    }
    cat.at = best;
    cat.flee = true;
    cat.moves = [{ kind: Math.abs(best.y - pos.y) > 0.2 ? 'jump' : 'walk', to: new THREE.Vector3(best.x, best.y, best.z), node: best }];
    cat.speed = RUN;
    setMode('walk');
    nextMove();
  }

  /** Back again after going off out of sight: at a rest spot well away from Lennie. */
  function reappear() {
    const spots = restSpots.filter((n) => !lennieAt(n.x, n.y, n.z, 2.5));
    const n = pick(spots.length ? spots : restSpots);
    pos.set(n.x, n.y, n.z);
    cat.at = n;
    yaw = n.face ?? rand(-Math.PI, Math.PI);
    root.quaternion.identity();
    root.visible = true;
    arrive();
  }

  // ------------------------------------------------------------ every frame

  function updateRest(dt) {
    cat.timer -= dt;
    // dropped right on top of it: off it goes
    if (lennieAt(pos.x, pos.y, pos.z, 0.45) && !hooks.flying()) {
      if (cat.act === 'nap') sfx.meow(0.5);
      if (!wander(RUN)) cat.timer = 1;
      return;
    }
    if (cat.timer <= 0 && !wander()) cat.timer = rand(1, 3);
  }

  function updateWalk(dt) {
    const m = cat.move;
    if (!m) return;
    m.t += dt;
    if (m.kind === 'walk') {
      _v.copy(m.to).sub(pos).setY(0);
      const dist = _v.length();
      const want = Math.atan2(_v.x, _v.z);
      const turn = angleTo(yaw, want);
      yaw += clamp(turn, -TURN * dt, TURN * dt);
      // slows down to turn round
      const step = Math.min(dist, cat.speed * dt * Math.max(0.15, Math.cos(Math.min(Math.abs(turn), Math.PI / 2))));
      if (dist > 1e-4) pos.addScaledVector(_v.normalize(), step);
      pos.y = lerp(pos.y, m.to.y, Math.min(1, dt * 10));
      cat.phase += step * (cat.speed > 1 ? 9 : 17);
      // Lennie lying in the way now: go somewhere else
      cat.checkT -= dt;
      if (cat.checkT <= 0 && !cat.flee && !cat.dash) {
        cat.checkT = 0.25;
        _w.copy(pos).addScaledVector(_v, Math.min(0.5, dist));
        if (lennieAt(_w.x, pos.y, _w.z, 0.4)) {
          cat.at = nearestNode();
          if (!wander()) {
            setMode('rest');
            cat.act = 'sit';
            cat.timer = 1.5;
          }
          return;
        }
      }
      if (dist < 0.02) {
        if (m.node) cat.at = m.node;
        nextMove();
      }
      return;
    }
    // a jump (up onto something, or down) or a hop through a cat flap: an arc
    const f = Math.min(1, m.t / m.dur);
    const want = Math.atan2(m.to.x - m.from.x, m.to.z - m.from.z);
    yaw += clamp(angleTo(yaw, want), -TURN * 2 * dt, TURN * 2 * dt);
    pos.x = lerp(m.from.x, m.to.x, f);
    pos.z = lerp(m.from.z, m.to.z, f);
    pos.y = lerp(m.from.y, m.to.y, f) + 4 * f * (1 - f) * (m.kind === 'hop' ? 0.25 : 0.3);
    if (m.kind === 'hop' && m.door && !m.door.broken) {
      const s = flapState.get(m.door) ?? { flap: m.door.flap, angle: 0, vel: 0 };
      flapState.set(m.door, s);
      flaps.add(s);
      s.held = true;
      s.angle = m.dir * Math.sin(Math.PI * clamp((f - 0.2) / 0.65, 0, 1)) * 0.9;
      if (f >= 1) {
        s.held = false;
        s.vel = -m.dir * 4;
        sfx.catFlap();
      }
    }
    if (f >= 1) {
      if (m.node) cat.at = m.node;
      nextMove();
    }
  }

  function nearestNode() {
    let best = cat.at;
    let bestD = Infinity;
    const out = !hooks.inside(pos);
    for (const n of Object.values(nodes)) {
      const d = Math.hypot(n.x - pos.x, n.z - pos.z) + Math.abs(n.y - pos.y) * 2;
      if (n.out === out && d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  function updateAttack(dt) {
    const part = cat.target;
    if (cat.mode === 'alert') {
      // puffed up, turned towards him, then the pounce
      if (!part) return setMode('rest');
      const b = part.body.position;
      yaw += clamp(angleTo(yaw, Math.atan2(b.x - pos.x, b.z - pos.z)), -TURN * 2 * dt, TURN * 2 * dt);
      if (cat.t >= ALERT) {
        cat.from.copy(pos);
        setMode('pounce');
        sfx.yowl();
      }
      return;
    }
    if (cat.mode === 'pounce') {
      // a leap that homes in on him, wherever he's flying
      if (!hooks.free()) return letGo();
      const f = Math.min(1, cat.t / POUNCE);
      const g = part.group.position;
      _v.copy(g).sub(cat.from);
      const reach = _v.length();
      _v.setLength(Math.max(0, reach - 0.2));
      pos.copy(cat.from).addScaledVector(_v, ease(f));
      pos.y += 4 * f * (1 - f) * 0.35 - 0.2 * ease(f);
      yaw = Math.atan2(g.x - pos.x, g.z - pos.z);
      if (f >= 1) {
        clingSpot(part);
        setMode('cling');
        cat.scratchT = 0;
        cat.lineT = 0.4;
        ragdoll.setExpression('ouch', CLING);
        sfx.voice('hit');
      }
      return;
    }
    if (cat.mode === 'cling') {
      if (!hooks.free() || !hooks.enabled() || cat.t >= CLING) return letGo();
      // stuck on him: claws going, scratches, fur flying
      cat.scratchT -= dt;
      if (cat.scratchT <= 0) {
        cat.scratchT = rand(0.16, 0.26);
        _v.copy(cat.local).multiplyScalar(0.55).applyQuaternion(part.group.quaternion).add(part.group.position);
        effects.clawed(part, _v);
        if (hooks.free()) {
          // and he squirms
          const body = part.body;
          body.velocity.x += rand(-0.7, 0.7);
          body.velocity.y += rand(0, 0.6);
          body.velocity.z += rand(-0.7, 0.7);
          body.angularVelocity.x += rand(-4, 4);
          body.angularVelocity.z += rand(-4, 4);
          body.wakeUp();
        }
      }
      cat.lineT -= dt;
      if (cat.lineT <= 0) {
        cat.lineT = rand(0.9, 1.3);
        hooks.pop(_v.copy(part.group.position).setY(part.group.position.y + 0.6), pick(CLING_LINES), '');
        sfx.voice('hit');
        if (Math.random() < 0.6) sfx.hiss(0.6);
      }
    }
  }

  function updateFall(dt) {
    cat.vel.y -= GRAVITY * dt;
    pos.addScaledVector(cat.vel, dt);
    const ground = hooks.ground(pos);
    if (pos.y <= ground && cat.vel.y < 0) {
      pos.y = ground;
      cat.vel.set(0, 0, 0);
      landed();
    }
  }

  function updateFlaps(dt) {
    for (const s of flaps) {
      if (!s.held) {
        // swings back and forth, less each time, and stops
        s.vel += (-60 * s.angle - 4 * s.vel) * dt;
        s.angle += s.vel * dt;
        if (Math.abs(s.angle) < 0.005 && Math.abs(s.vel) < 0.05) {
          s.angle = 0;
          flaps.delete(s);
        }
      }
      s.flap.swing(s.angle);
    }
  }

  /** Eases the pose towards `name`'s and adds the swings. */
  function drawPose(dt) {
    let name = cat.mode === 'rest' ? cat.act : cat.mode;
    if (cat.mode === 'walk') name = cat.move?.kind === 'walk' || !cat.move ? (cat.speed > 1 ? 'run' : 'walk') : 'leap';
    if (cat.mode === 'pounce' || cat.mode === 'fall') name = 'leap';
    if (cat.mode === 'gone') name = 'run';
    const target = POSES[name] ?? STAND;
    const k = 1 - Math.exp(-dt * (cat.mode === 'alert' || cat.mode === 'cling' ? 18 : 7));
    for (const key of KEYS) pose[key] = lerp(pose[key], target[key], k);
    const P = pose;
    const t = performance.now() / 1000;

    body.position.set(0, P.bodyY, P.bodyZ);
    body.rotation.set(P.pitch, 0, 0);
    body.scale.set(P.sx, P.sy, P.sz);
    head.position.set(0, P.headY, P.headZ);
    head.rotation.set(P.headPitch, 0, 0);
    head.geometry = cat.mode === 'rest' && cat.act === 'nap' ? looks.headShut : looks.head;
    // the tail's root, at the back of the (tilted) body
    const [ty, tz] = [0.04 * P.sy, -0.19 * P.sz];
    tailA.position.set(0, P.bodyY + ty * Math.cos(P.pitch) - tz * Math.sin(P.pitch), P.bodyZ + ty * Math.sin(P.pitch) + tz * Math.cos(P.pitch));
    tailA.rotation.set(P.tailPitch, P.tailYaw, 0);
    tailB.rotation.set(P.tailBend, P.tailYaw * 0.6, 0);
    tailA.scale.set(P.tailScale, P.tailScale, 1);

    const moving = cat.mode === 'walk' && cat.move?.kind === 'walk';
    const swing = moving ? (cat.speed > 1 ? 0.85 : 0.45) : 0;
    for (const leg of legs) {
      const { side, hind } = leg.userData;
      // walking: diagonal pairs together; running: a gallop, front pair then hind pair
      const ph = cat.speed > 1 ? cat.phase + (hind ? Math.PI : 0) + side * 0.3 : cat.phase + (hind === (side > 0) ? 0 : Math.PI);
      let a = (hind ? P.hind : P.front) + Math.sin(ph) * swing;
      if (cat.mode === 'cling') a += Math.sin(t * (hind ? 24 : 31) + side * 1.7) * (hind ? 0.55 : 0.45); // claws going
      if (cat.mode === 'rest' && cat.act === 'groom' && !hind && side > 0) a = -1.6 + Math.sin(t * 5) * 0.15; // a paw up to lick
      if (cat.mode === 'rest' && cat.act === 'litter' && !hind) a += Math.max(0, Math.sin(t * 9 + side * 2)) * -0.6; // digging
      leg.position.set(side * (hind ? 0.07 : 0.06), hind ? P.hindY : P.frontY, (hind ? P.hindZ : P.frontZ) * P.sz);
      leg.rotation.set(a, 0, 0);
      leg.scale.set(1, hind ? P.hindLen : P.frontLen, 1);
    }

    // a bit of life: the tail sways, the head bobs while eating or grooming, breathing while asleep
    if (cat.mode === 'rest') {
      tailB.rotation.y += Math.sin(t * 1.3) * 0.25;
      if (cat.act === 'eat') head.rotation.x += Math.max(0, Math.sin(t * 6)) * 0.15;
      if (cat.act === 'groom') {
        head.rotation.x += 0.45 + Math.sin(t * 5) * 0.12;
        head.rotation.y = -0.35;
      }
      if (cat.act === 'nap' || cat.act === 'loaf') body.scale.y *= 1 + Math.sin(t * 2.2) * 0.025;
      if (cat.act === 'watch') tailB.rotation.y += Math.sin(t * 4) * 0.3; // the tip twitching at the birds
    } else if (moving) {
      body.position.y += Math.abs(Math.sin(cat.phase)) * 0.008;
      tailA.rotation.y += Math.sin(cat.phase * 0.5) * 0.15;
    } else if (cat.mode === 'cling') {
      tailA.rotation.y += Math.sin(t * 12) * 0.7; // lashing
    } else if (cat.mode === 'alert') {
      body.position.x = Math.sin(t * 40) * 0.006; // trembling with rage
    }
    // crouched low through a cat flap
    const hop = cat.mode === 'walk' && cat.move?.kind === 'hop';
    root.scale.set(1, hop ? 0.72 : 1, 1);
  }

  function place() {
    if (cat.mode === 'cling' && cat.target) {
      const g = cat.target.group;
      root.position.copy(cat.local).applyQuaternion(g.quaternion).add(g.position);
      root.quaternion.copy(g.quaternion).multiply(cat.localQ);
      pos.copy(root.position);
      shadow.visible = false;
      return;
    }
    root.position.copy(pos);
    root.quaternion.setFromAxisAngle(_up, yaw);
    // its shadow on whatever it's on (in a jump: on the way from one to the other)
    const m = cat.move;
    const air = cat.mode === 'pounce' || cat.mode === 'fall' || (cat.mode === 'walk' && m && m.kind !== 'walk');
    let ground = pos.y;
    if (air) ground = m && cat.mode === 'walk' ? lerp(m.from.y, m.to.y, Math.min(1, m.t / m.dur)) : -1;
    shadow.visible = root.visible && ground >= 0;
    if (shadow.visible) {
      shadow.position.set(pos.x, ground + 0.013, pos.z);
      shadow.rotation.y = yaw;
      shadow.scale.set(0.34, 1, 0.55);
    }
  }

  function update(dt) {
    cat.t += dt;
    if (cat.cooldown > 0 && cat.mode !== 'cling') cat.cooldown -= dt;
    if (hooks.enabled()) {
      const part = inReach();
      if (part) attack(part);
    }
    switch (cat.mode) {
      case 'rest': updateRest(dt); break;
      case 'walk': updateWalk(dt); break;
      case 'alert': case 'pounce': case 'cling': updateAttack(dt); break;
      case 'fall': updateFall(dt); break;
      case 'gone':
        // dashes off and vanishes, then turns up again at one of its spots
        if (cat.t < 0.6) {
          pos.x += Math.sin(yaw) * RUN * dt;
          pos.z += Math.cos(yaw) * RUN * dt;
          cat.phase += RUN * dt * 9;
        } else root.visible = false;
        cat.timer -= dt;
        if (cat.timer <= 0) reappear();
        break;
    }
    // now and then, a miaow
    cat.meowT -= dt;
    if (cat.meowT <= 0) {
      cat.meowT = rand(15, 35);
      if (cat.mode === 'rest' && cat.act !== 'nap') meow();
    }
    updateFlaps(dt);
    drawPose(dt);
    place();
  }

  /** Lennie was put somewhere else (R, or a drop key): the cat lets go of him. */
  function release() {
    if (cat.mode === 'alert') {
      setMode('rest');
      cat.act = 'sit';
      cat.timer = 1;
    }
    letGo();
  }

  // (a first pose, so it doesn't start out flat)
  drawPose(1);
  place();

  // (debug: window.lennie.cat.goTo('litter') from the console sends it somewhere)
  return { update, release, root, get mode() { return cat.mode; }, debug: cat, nodes, goTo: (id) => go(nodes[id]) };
}
