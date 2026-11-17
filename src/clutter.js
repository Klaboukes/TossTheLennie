import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStock, PRODUCTS, halfSize } from './products.js';
import { canvasTexture } from './supermarket.js';

// The mess in Lennie's house: dirty dishes in the kitchen, toys all over the
// living room and the kids room, clothes everywhere in the bedrooms, and the
// usual household stuff (washing-up liquid, loo rolls, shampoo, a vacuum
// cleaner...). And in the living room a tall closet stuffed with Dutch board
// games behind two painted doors: once Lennie smashes a door, the games behind
// it empty themselves all over the floor when he crashes into the closet.
//
// The small things are loose "products" (products.js): they have no physics
// bodies, so they never get in Lennie's way, but when he lands among them or
// crashes into the table they're on, they go flying and tumble to the floor.
// The board game boxes spill their pawns, dice, cards and puzzle pieces as
// they go. A few bigger things (trash bags, the laundry basket, the vacuum
// cleaner, the plant) are only decoration; the closet, the clothes chair and
// the washing machine are solid furniture.
//
// The names on the packaging and the boxes are plain Dutch words, no brands,
// except the five big games the family actually plays (Catan, Risk, Axis &
// Allies, Dungeons & Dragons, Carcassonne), which the owner asked for by name.
// Their box art is our own drawing, not a copy of the real boxes.

const TAU = Math.PI * 2;
const INK = '#2b2b2b';

// The TV cabinet's three painted doors (buildTVCabinet), left to right as you face it.
const DOOR_LOOKS = [
  { bg: '#2fb5b0', rim: '#f6efe0', horse: '#f6efe0', mane: '#c8302a', saddle: '#f2c230', dots: '#2a5fb0' },
  { bg: '#f2c230', rim: '#2a5fb0', horse: '#2a5fb0', mane: '#e8559a', saddle: '#c8302a', dots: '#f6efe0' },
  { bg: '#e8559a', rim: '#f6efe0', horse: '#1f2a6b', mane: '#f2c230', saddle: '#2fb5b0', dots: '#f6efe0' },
];

/**
 * One painted door of the TV cabinet: a folk-art horse mid-prance, a painted
 * line inside the edge, flowers in the corners. `flip` -1 has the horse face left.
 */
function horseDoorTexture(d, flip, aspect = 256 / 152) {
  const H = 152;
  const W = Math.round(H * aspect); // as wide as the door, so the horse isn't stretched
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = d.bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = d.rim;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(9, 9, W - 18, H - 18, 7);
  g.stroke();
  const dot = (x, y, r) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  // flowers in the corners, a row of dots along the bottom
  for (const [x, y] of [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]]) {
    g.fillStyle = d.rim;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 3.9, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = d.mane;
    dot(x, y, 4.2);
  }
  g.fillStyle = d.saddle;
  for (let k = 0; k < 7; k++) dot(W / 2 - 54 + k * 18, H - 20, 2.5);

  // the horse, drawn in units about 100 by 90 around its middle
  g.save();
  g.translate(W / 2, 78);
  g.scale(0.95 * flip, 0.95);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const stroke = (color, width, pts) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  };
  // the tail, behind everything
  g.strokeStyle = d.mane;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(-28, -6);
  g.quadraticCurveTo(-50, -4, -44, 26);
  g.stroke();
  // the legs, the front pair lifted
  for (const leg of [[-22, 4, -26, 22, -30, 38], [-14, 6, -12, 22, -14, 38], [16, 4, 26, 16, 24, 28], [22, 2, 34, 8, 36, 20]]) stroke(d.horse, 7, leg);
  // body, neck, head and ears
  g.fillStyle = d.horse;
  g.beginPath();
  g.ellipse(0, -2, 32, 15, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(14, -14);
  g.quadraticCurveTo(22, -34, 30, -44);
  g.lineTo(42, -38);
  g.quadraticCurveTo(34, -20, 30, 2);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(42, -38, 15, 7, 0.55, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(30, -46);
  g.lineTo(31, -56);
  g.lineTo(37, -46);
  g.fill();
  // the mane: a row of tufts down the neck
  g.fillStyle = d.mane;
  for (let i = 0; i < 5; i++) dot(27 - i * 4, -44 + i * 7, 5);
  // the painted saddle cloth, dotted
  g.fillStyle = d.saddle;
  g.beginPath();
  g.moveTo(-14, -15);
  g.lineTo(10, -15);
  g.quadraticCurveTo(12, 4, -2, 8);
  g.quadraticCurveTo(-16, 4, -14, -15);
  g.fill();
  g.fillStyle = d.dots;
  for (const [x, y] of [[-11, -8], [-6, 1], [1, 3], [7, -2], [8, -10]]) dot(x, y, 2);
  // bridle and eye
  stroke(d.saddle, 2.5, [32, -43, 46, -30]);
  g.fillStyle = '#1a1414';
  dot(39, -42, 2.2);
  g.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The rooms, as their inner wall faces (x, z) on each floor (k).
// The ground floor follows the floor plan (house.js): the living room all
// across the back, the kitchen at the front right, the hallway at the front
// left (the toilet in its corner is left out), the utility room behind.
const ROOMS = {
  living: { k: 0, x0: -3.875, x1: 3.875, z0: -4.875, z1: 1.01 },
  kitchen: { k: 0, x0: -0.31, x1: 3.875, z0: 1.19, z1: 4.875 },
  hall: { k: 0, x0: -2.95, x1: -0.49, z0: 1.19, z1: 4.875 }, // from the stairs to the kitchen wall
  utility: { k: 0, x0: 0.875, x1: 3.875, z0: -6.575, z1: -5.125 },
  garage: { k: 0, x0: 0.875, x1: 3.875, z0: -9.55, z1: -6.825 },
  bedroom: { k: 1, x0: -2.77, x1: 0.51, z0: -2.31, z1: 4.875 },
  kids: { k: 1, x0: 0.69, x1: 3.875, z0: -2.31, z1: 4.875 },
  study: { k: 2, x0: -3.875, x1: 0.51, z0: -2.31, z1: 3.9 }, // the roof slopes down towards the front
  bath: { k: 2, x0: 0.69, x1: 3.875, z0: -2.31, z1: 3.8 },
};

// What pops up when Lennie sends a room's mess flying (main.js mixes in a few
// general shouts and never says the same thing twice in a row).
const ROOM_MESS = {
  living: ['Who left their socks here?', 'Remote? What remote?', 'Movie night is cancelled!', 'Controller down!', 'Living room? Flying room!', 'Crisps for everyone!'],
  hall: ['Shoes everywhere!', 'Welcome home!', 'Wipe your feet!', 'Coming through!'],
  utility: ['Kitty litter!', 'Meow?!', 'The cat did it!', 'Cool down, Lennie!', 'Flying boots!', 'Coats everywhere!'],
  storage: ['Spring cleaning!', 'Who keeps all this stuff?', 'Never throw anything away!', 'Cupboard avalanche!', 'Everything must go!', 'Found the Christmas stuff!'],
  garage: ['Garage sale!', "Where's my hammer?", 'Camping trip cancelled!', 'DIY disaster!', 'Junk everywhere!', 'Tools down!'],
  kitchen: ['Hagelslag avalanche!', "Who's doing the dishes?", 'Breakfast in the air!', 'Pan-demonium!', "Don't cry over spilt milk!", 'Plate-tectonics!'],
  bedroom: ['Laundry day!', 'Sock it to me!', 'Lost a slipper!', 'Wake-up call!', 'Bedtime? Not yet!', 'Bed head!'],
  kids: ['Teddy, nooo!', 'Clean your room, Lennie!', 'Art attack!', 'Playtime!', 'Ouch, building blocks!', 'Teddy takes flight!'],
  study: ['Homework destroyed!', 'Out of office!', 'Box office smash!', 'Working from home!', 'Paperwork? Flying work!', 'Undo! Undo!'],
  bath: ['Rubber duck rescue!', 'Splish splash!', 'Quack attack!', 'Toilet roll tornado!', 'Bath time!', 'Squeaky clean... not!'],
};

// The little toy cabinet beside the piano, its back to the bar (buildToyCabinet).
const TOY_CABINET = { x0: 1.45, x1: 2.05, z0: 0.75, z1: 1.115, top: 0.62 };
// What pops up when Lennie crashes into the TV cabinet or the toy cabinet and the toys come out.
const TOY_MESS = ['Toy avalanche!', 'Toy story!', 'Playtime!', 'Who put all that in there?', 'Tidy up time!'];

// Where the furniture stands in each room, so things strewn on the floor stay clear of it.
const FURNITURE = {
  living: [
    [-3.875, -0.6, -2.4, -0.8], [-3.875, -2.95, -4.75, -2.41], [-1.55, -0.6, -0.75, -0.35], [-3.875, -1.66, -0.79, 1.01], // couch, TV cabinet, low cabinet, stairs and storage
    [-0.25, 0.75, -4.875, -3.5], [1.28, 3.62, -2.2, -0.3], [2.17, 3.875, -0.05, 1.12], [2.175, 3.875, -4.875, -4.3], // comfy chair, dining table, piano, game closet
    [TOY_CABINET.x0, TOY_CABINET.x1, TOY_CABINET.z0, TOY_CABINET.z1], // the toy cabinet
  ],
  kitchen: [[-0.31, 3.875, 4.2, 4.875], [3.2, 3.875, 2.01, 4.2], [0.85, 3.875, 1.19, 2.01]], // the counters, and the bar behind the back one
  hall: [[-3.875, -1.66, 2.96, 4.875], [-2.95, -1.95, 2.7, 2.96]], // the toilet, the coat rack
  utility: [[3.15, 3.875, -5.85, -5.125], [1.3, 2.3, -6.575, -5.9], [2.25, 3.55, -6.575, -6.05], [2.1, 3.15, -5.7, -5.125]], // fridge, litter box, clothes rack, trash bags
  garage: [[0.875, 1.375, -9.55, -8.05], [3.05, 3.875, -9.55, -8.2], [1.4, 3.2, -9.55, -9.15], [1.7, 3.875, -7.225, -6.825]], // camping shelves, table, bike, tool shelves
  bedroom: [[-2.77, -0.49, 0.5, 3.1], [-0.18, 0.51, 2.5, 4.5], [-2.7, -1.95, 3.9, 4.875], [-0.8, -0.1, -2.31, -1.5]], // bed, wardrobe, clothes chair, laundry basket
  kids: [[1.9, 3.875, -2.31, -1.1], [1.1, 2.3, 4.1, 4.875], [2.0, 3.2, 2.4, 3.6]], // bed, toy box, beanbag
  study: [[-3.875, -3.0, -1.7, 0.3], [-2.95, -2.25, -1.05, -0.35], [-2.4, -0.6, -2.31, -1.85], [-1.68, 0.51, 2.1, 3.9]], // desk, desk chair, bookshelf, armchair
  bath: [[0.9, 2.95, 2.65, 3.8], [3.1, 3.875, -1.75, -0.95], [2.9, 3.875, 0.1, 1.5], [3.2, 3.875, -0.85, -0.05]], // tub, loo, cabinet, washing machine
};

const mats = new Map();
/** A shared plain material. */
const mat = (color, opts = {}) => {
  const key = `${color}-${JSON.stringify(opts)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...opts }));
  return mats.get(key);
};
const texMat = (map, opts = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0, ...opts });
const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
/** Biggest bold text that fits in maxW × maxH, centred on (x, y). */
function label(g, text, x, y, maxW, maxH, color) {
  let size = maxH;
  g.font = `900 ${size}px "Arial Black", "Trebuchet MS", sans-serif`;
  const w = g.measureText(text).width;
  if (w > maxW) size *= maxW / w;
  g.font = `900 ${Math.max(6, Math.floor(size))}px "Arial Black", "Trebuchet MS", sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

// ---------------------------------------------------------------- models
// Every loose thing is a catalogue entry like the supermarket's products,
// with its own model: geometry centred on its middle, sized by its bounds.
function item(geo, material, extra = {}) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const c = bb.getCenter(new THREE.Vector3());
  const s = bb.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z);
  return { w: s.x, h: Math.max(s.y, 0.002), d: s.z, look: () => ({ geo, material }), ...extra };
}

/** Several parts in one geometry: [geometry, material] pairs (one draw call per material). */
function parts(list, extra) {
  const byMat = new Map();
  for (const [g, m] of list) {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(name)) n.deleteAttribute(name);
    if (!byMat.has(m)) byMat.set(m, []);
    byMat.get(m).push(n);
  }
  const geos = [...byMat.values()].map((gs) => (gs.length === 1 ? gs[0] : mergeGeometries(gs, false)));
  const list2 = [...byMat.keys()];
  return geos.length === 1 ? item(geos[0], list2[0], extra) : item(mergeGeometries(geos, true), list2, extra);
}
/** The same model as `base` in another colour (the base's own colour is white). */
const tint = (base, color) => ({ base, color });

const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  return geo.translate(x, y, z);
};
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (r0, r1, h, n = 16, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
const Sph = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 14, 10).scale(sx, sy, sz);
/** A flat cut-out (clothes, puzzle pieces) from an outline in metres, lying flat. */
function flat(points, thick) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }).rotateX(-Math.PI / 2);
}
/** A crumpled heap of cloth: a lumpy, squashed ball. */
function heap(r, sx, sy, sz, seed) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 0.75 + 0.35 * Math.abs(Math.sin(x * 41 + y * 29 + z * 37 + seed));
    p.setXYZ(i, x * n * sx, Math.max(y * n * sy, -r * sy * 0.55), z * n * sz);
  }
  geo.computeVertexNormals();
  return geo;
}

// --- little textures
function pips(n, bg = '#ffffff', fg = '#1b1b1b') {
  return canvasTexture(64, 64, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
    g.fillStyle = fg;
    const P = { 1: [[32, 32]], 2: [[16, 16], [48, 48]], 3: [[16, 16], [32, 32], [48, 48]], 4: [[16, 16], [48, 16], [16, 48], [48, 48]], 5: [[16, 16], [48, 16], [32, 32], [16, 48], [48, 48]], 6: [[16, 14], [48, 14], [16, 32], [48, 32], [16, 50], [48, 50]] };
    for (const [x, y] of P[n]) { circle(g, x, y, 6); g.fill(); }
  });
}
const dirtyPlate = (stains) => canvasTexture(128, 128, (g) => {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#d9d4c8'; g.lineWidth = 4; circle(g, 64, 64, 46); g.stroke();
  for (const [x, y, r, c] of stains) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r, r * 0.7, x, 0, TAU); g.fill(); }
});
const letterTex = (ch, bg) => canvasTexture(64, 64, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 4; g.strokeRect(2, 2, 60, 60);
  label(g, ch, 32, 35, 30, 30, '#ffffff');
});

// ---------------------------------------------------------------- board games
// Each game: its box (lid art and the name on the side) and what's inside.
// The pieces are hidden in the box until it gets knocked off the shelf.
const LID_ART = {
  mejn(g, x, y, s) {
    g.fillStyle = '#fff6d8'; g.fillRect(x - s / 2, y - s / 2, s, s);
    ['#d8312a', '#3b7dd8', '#3fae3a', '#f6d04d'].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(x + (i % 2 ? s * 0.12 : -s * 0.46), y + (i < 2 ? -s * 0.46 : s * 0.12), s * 0.34, s * 0.34);
    });
    g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 2;
    for (let t = -4; t <= 4; t++) for (const [a, b] of [[t, 0], [0, t]]) { circle(g, x + a * s * 0.1, y + b * s * 0.1, s * 0.035); g.fill(); g.stroke(); }
  },
  ganzen(g, x, y, s) {
    g.fillStyle = '#f6d04d'; g.fillRect(x - s / 2, y - s / 2, s, s);
    g.strokeStyle = '#2e8b57'; g.lineWidth = s * 0.06;
    g.beginPath();
    for (let a = 0; a < 16; a += 0.1) { const r = s * 0.44 * (1 - a / 18); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.stroke();
    g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y + s * 0.05, s * 0.14, s * 0.09, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(x + s * 0.12, y - s * 0.08, s * 0.04, s * 0.1, 0.3, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#f59a23'; g.fillRect(x + s * 0.15, y - s * 0.16, s * 0.07, s * 0.03);
  },
  dammen(g, x, y, s) {
    const n = 10;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#5a3a1c' : '#f2deb4'; g.fillRect(x - s / 2 + (i * s) / n, y - s / 2 + (j * s) / n, s / n, s / n); }
    for (const [i, j, c] of [[1, 2, '#ffffff'], [3, 4, '#1b1b1b'], [6, 5, '#ffffff'], [4, 7, '#1b1b1b']]) { g.fillStyle = c; circle(g, x - s / 2 + (i + 0.5) * s / n, y - s / 2 + (j + 0.5) * s / n, s * 0.04); g.fill(); }
  },
  schaken(g, x, y, s) {
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#1b1b1b' : '#ffffff'; g.fillRect(x - s / 2 + (i * s) / n, y - s / 2 + (j * s) / n, s / n, s / n); }
    g.fillStyle = '#c9a74a'; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - s * 0.15, y + s * 0.3); g.lineTo(x + s * 0.15, y + s * 0.3); g.lineTo(x + s * 0.08, y); g.lineTo(x + s * 0.12, y - s * 0.2); g.lineTo(x - s * 0.12, y - s * 0.2); g.lineTo(x - s * 0.08, y); g.closePath(); g.fill(); g.stroke();
    g.fillRect(x - s * 0.02, y - s * 0.32, s * 0.04, s * 0.12); g.fillRect(x - s * 0.06, y - s * 0.28, s * 0.12, s * 0.04);
  },
  zeeslag(g, x, y, s) {
    g.fillStyle = '#3b7dd8'; g.fillRect(x - s / 2, y - s / 2, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1;
    for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(x - s / 2 + (i * s) / 10, y - s / 2); g.lineTo(x - s / 2 + (i * s) / 10, y + s / 2); g.stroke(); g.beginPath(); g.moveTo(x - s / 2, y - s / 2 + (i * s) / 10); g.lineTo(x + s / 2, y - s / 2 + (i * s) / 10); g.stroke(); }
    g.fillStyle = '#9aa3ad'; g.strokeStyle = INK; g.lineWidth = 2;
    for (const [a, b, l] of [[-0.3, -0.2, 0.4], [0.05, 0.15, 0.3], [0.1, -0.3, 0.2]]) { g.beginPath(); g.moveTo(x + a * s, y + b * s); g.lineTo(x + (a + l) * s, y + b * s); g.lineTo(x + (a + l - 0.05) * s, y + (b + 0.08) * s); g.lineTo(x + (a + 0.05) * s, y + (b + 0.08) * s); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#e2231a'; for (const [a, b] of [[0.3, 0.3], [-0.35, 0.3], [0.32, -0.05]]) { circle(g, x + a * s, y + b * s, s * 0.035); g.fill(); }
  },
  vier(g, x, y, s) {
    g.fillStyle = '#1d4f9a'; g.fillRect(x - s / 2, y - s / 2, s, s * 0.9);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 6; j++) {
      const c = (i * 7 + j * 3) % 5;
      g.fillStyle = j < 2 ? '#ffffff' : c === 0 || c === 3 ? '#e2231a' : c === 1 ? '#f6d04d' : '#ffffff';
      circle(g, x - s / 2 + (i + 0.5) * s / 7, y - s / 2 + (j + 0.5) * s * 0.9 / 6, s * 0.055); g.fill();
    }
  },
  molen(g, x, y, s) {
    g.fillStyle = '#9ad0f0'; g.fillRect(x - s / 2, y - s / 2, s, s);
    ['#e2231a', '#f6d04d', '#e86fa0', '#f59a23'].forEach((c, i) => { g.fillStyle = c; g.fillRect(x - s / 2, y + s * (0.1 + i * 0.1), s, s * 0.06); g.fillStyle = '#3fae3a'; g.fillRect(x - s / 2, y + s * (0.16 + i * 0.1), s, s * 0.04); });
    g.fillStyle = '#5a3a1c'; g.beginPath(); g.moveTo(x - s * 0.08, y + s * 0.1); g.lineTo(x + s * 0.08, y + s * 0.1); g.lineTo(x + s * 0.05, y - s * 0.15); g.lineTo(x - s * 0.05, y - s * 0.15); g.closePath(); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = s * 0.03;
    for (let a = 0.4; a < TAU; a += Math.PI / 2) { g.beginPath(); g.moveTo(x, y - s * 0.15); g.lineTo(x + Math.cos(a) * s * 0.3, y - s * 0.15 + Math.sin(a) * s * 0.3); g.stroke(); }
  },
  gracht(g, x, y, s) {
    g.fillStyle = '#bfe0f5'; g.fillRect(x - s / 2, y - s / 2, s, s);
    ['#8a3b2a', '#4a2a17', '#b5652f', '#2f2a26', '#9a4a2a'].forEach((c, i) => {
      const hx = x - s / 2 + i * s * 0.2;
      const top = y - s * (0.2 + (i % 2) * 0.12);
      g.fillStyle = c; g.fillRect(hx, top, s * 0.19, s * 0.45 - (top - y));
      g.beginPath(); g.moveTo(hx, top); g.lineTo(hx + s * 0.095, top - s * 0.1); g.lineTo(hx + s * 0.19, top); g.fill();
      g.fillStyle = '#ffffff'; for (let r = 0; r < 3; r++) g.fillRect(hx + s * 0.04, top + s * (0.05 + r * 0.1), s * 0.04, s * 0.05), g.fillRect(hx + s * 0.11, top + s * (0.05 + r * 0.1), s * 0.04, s * 0.05);
    });
    g.fillStyle = '#2f6ea8'; g.fillRect(x - s / 2, y + s * 0.3, s, s * 0.2);
  },
  domino(g, x, y, s) {
    for (const [a, b, r] of [[-0.25, 0, -0.3], [0.05, -0.05, 0.2], [0.3, 0.05, -0.1]]) {
      g.save(); g.translate(x + a * s, y + b * s); g.rotate(r);
      g.fillStyle = '#1b1b1b'; g.fillRect(-s * 0.1, -s * 0.2, s * 0.2, s * 0.4);
      g.fillStyle = '#ffffff'; g.fillRect(-s * 0.08, -s * 0.005, s * 0.16, s * 0.01);
      for (const [px, py] of [[-0.04, -0.12], [0.04, -0.06], [0, 0.1]]) { circle(g, px * s, py * s, s * 0.018); g.fill(); }
      g.restore();
    }
  },
  kaarten(g, x, y, s) {
    for (const [r, c] of [[-0.4, '#3b7dd8'], [-0.1, '#3fae3a'], [0.2, '#f6d04d'], [0.5, '#e2231a']]) {
      g.save(); g.translate(x, y + s * 0.25); g.rotate(r);
      g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(-s * 0.15, -s * 0.5, s * 0.3, s * 0.45); g.strokeRect(-s * 0.15, -s * 0.5, s * 0.3, s * 0.45);
      g.fillStyle = c; g.fillRect(-s * 0.11, -s * 0.46, s * 0.22, s * 0.2);
      g.restore();
    }
  },
  memo(g, x, y, s) {
    const cols = ['#e2231a', '#3b7dd8', '#3fae3a', '#f59a23'];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      g.fillStyle = (i + j) % 3 ? '#3b7dd8' : '#ffffff';
      g.fillRect(x - s * 0.45 + i * s * 0.31, y - s * 0.45 + j * s * 0.31, s * 0.28, s * 0.28);
      if (!((i + j) % 3)) { g.fillStyle = cols[(i + j * 2) % 4]; circle(g, x - s * 0.31 + i * s * 0.31, y - s * 0.31 + j * s * 0.31, s * 0.08); g.fill(); }
    }
  },
  rummy(g, x, y, s) {
    [['7', '#e2231a'], ['8', '#1b1b1b'], ['9', '#3b7dd8'], ['10', '#f59a23']].forEach(([t, c], i) => {
      const tx = x - s * 0.42 + i * s * 0.22;
      g.fillStyle = '#fbf3e4'; g.fillRect(tx, y - s * 0.2, s * 0.19, s * 0.3);
      label(g, t, tx + s * 0.095, y - s * 0.05, s * 0.15, s * 0.18, c);
    });
  },
  toren(g, x, y, s) {
    for (let r = 0; r < 9; r++) {
      g.fillStyle = r % 2 ? '#d9b27c' : '#c49a5e'; g.strokeStyle = '#7a5a30'; g.lineWidth = 1;
      const off = r === 5 ? s * 0.06 : 0;
      g.fillRect(x - s * 0.15 + off, y + s * 0.4 - r * s * 0.09, s * 0.3, s * 0.08); g.strokeRect(x - s * 0.15 + off, y + s * 0.4 - r * s * 0.09, s * 0.3, s * 0.08);
    }
  },
  dobbel(g, x, y, s) {
    for (const [a, b, n] of [[-0.2, 0, 5], [0.15, -0.1, 3], [0.1, 0.22, 6]]) {
      g.save(); g.translate(x + a * s, y + b * s); g.rotate(a * 2);
      g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(-s * 0.13, -s * 0.13, s * 0.26, s * 0.26); g.strokeRect(-s * 0.13, -s * 0.13, s * 0.26, s * 0.26);
      g.fillStyle = INK;
      for (let i = 0; i < n; i++) { circle(g, (((i % 3) - 1) * 0.07) * s, ((Math.floor(i / 3) - 0.5) * 0.08) * s, s * 0.022); g.fill(); }
      g.restore();
    }
  },
  mikado(g, x, y, s) {
    const cols = ['#e2231a', '#3b7dd8', '#3fae3a', '#f6d04d', '#1b1b1b'];
    for (let i = 0; i < 9; i++) { g.strokeStyle = cols[i % 5]; g.lineWidth = s * 0.04; g.beginPath(); const a = i * 0.7; g.moveTo(x - Math.cos(a) * s * 0.45, y - Math.sin(a) * s * 0.2); g.lineTo(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.2); g.stroke(); }
  },
  straten(g, x, y, s) {
    g.fillStyle = '#d7ecd9'; g.fillRect(x - s / 2, y - s / 2, s, s);
    const cols = ['#8a3b2a', '#9ad0f0', '#e86fa0', '#f59a23', '#e2231a', '#f6d04d', '#3fae3a', '#1d4f9a'];
    for (let i = 0; i < 8; i++) {
      const c = cols[i];
      g.fillStyle = c;
      g.fillRect(x - s / 2 + i * s / 8, y - s / 2, s / 8 - 2, s * 0.1);
      g.fillRect(x - s / 2 + i * s / 8, y + s * 0.4, s / 8 - 2, s * 0.1);
    }
    label(g, '€', x, y, s * 0.4, s * 0.4, '#3fae3a');
  },
  catan(g, x, y, s) {
    // an island of hexes in the sea, with a few little houses on the corners
    g.fillStyle = '#3b7dd8'; g.fillRect(x - s / 2, y - s / 2, s, s);
    const r = s * 0.15;
    const hexes = [[0, 0], [1, 0], [-1, 0], [0.5, -1], [-0.5, -1], [0.5, 1], [-0.5, 1]];
    const cols = ['#e3d39a', '#e8c35a', '#2e7d32', '#9ccc65', '#c1582f', '#8a939c', '#e8c35a'];
    g.strokeStyle = '#f2deb4'; g.lineWidth = 3;
    hexes.forEach(([a, b], i) => {
      const cx = x + a * r * Math.sqrt(3);
      const cy = y + b * r * 1.5;
      g.fillStyle = cols[i];
      g.beginPath();
      for (let k = 0; k < 6; k++) g.lineTo(cx + Math.cos(Math.PI / 6 + (k * TAU) / 6) * r, cy + Math.sin(Math.PI / 6 + (k * TAU) / 6) * r);
      g.closePath(); g.fill(); g.stroke();
    });
    g.fillStyle = '#e2231a'; g.strokeStyle = INK; g.lineWidth = 2;
    for (const [a, b] of [[0, -r], [r * 0.87, r * 0.5], [-r * 1.73, r]]) {
      g.beginPath(); g.moveTo(x + a - s * 0.03, y + b + s * 0.025); g.lineTo(x + a + s * 0.03, y + b + s * 0.025); g.lineTo(x + a + s * 0.03, y + b - s * 0.01); g.lineTo(x + a, y + b - s * 0.04); g.lineTo(x + a - s * 0.03, y + b - s * 0.01); g.closePath(); g.fill(); g.stroke();
    }
  },
  risk(g, x, y, s) {
    // a world of coloured continents, armies and an attack arrow
    g.fillStyle = '#9ad0f0'; g.fillRect(x - s / 2, y - s / 2, s, s);
    g.strokeStyle = INK; g.lineWidth = 2;
    for (const [a, b, rx, ry, c] of [[-0.3, -0.2, 0.15, 0.12, '#f6d04d'], [-0.22, 0.2, 0.08, 0.16, '#f59a23'], [0.02, -0.22, 0.09, 0.08, '#3b7dd8'], [0.05, 0.12, 0.1, 0.17, '#8a3b2a'], [0.28, -0.15, 0.17, 0.13, '#3fae3a'], [0.32, 0.3, 0.1, 0.07, '#b05cc8']]) {
      g.fillStyle = c; g.beginPath(); g.ellipse(x + a * s, y + b * s, rx * s, ry * s, a, 0, TAU); g.fill(); g.stroke();
    }
    for (const [a, b, c] of [[-0.3, -0.2, '#e2231a'], [0.28, -0.15, '#1b1b1b'], [0.05, 0.12, '#e2231a']]) { g.fillStyle = c; g.fillRect(x + a * s - s * 0.03, y + b * s - s * 0.03, s * 0.06, s * 0.06); }
    g.strokeStyle = '#e2231a'; g.lineWidth = s * 0.03;
    g.beginPath(); g.moveTo(x - s * 0.22, y - s * 0.12); g.quadraticCurveTo(x, y - s * 0.4, x + s * 0.18, y - s * 0.18); g.stroke();
    g.fillStyle = '#e2231a'; g.beginPath(); g.moveTo(x + s * 0.22, y - s * 0.14); g.lineTo(x + s * 0.12, y - s * 0.15); g.lineTo(x + s * 0.18, y - s * 0.24); g.closePath(); g.fill();
  },
  axis(g, x, y, s) {
    // a war map with tanks on the land and planes over the sea
    g.fillStyle = '#7fa8c9'; g.fillRect(x - s / 2, y - s / 2, s, s);
    g.fillStyle = '#c9b98a'; g.fillRect(x - s / 2, y, s, s / 2);
    g.fillStyle = '#9aa86a'; g.beginPath(); g.ellipse(x + s * 0.2, y + s * 0.25, s * 0.25, s * 0.15, 0, 0, TAU); g.fill();
    const tank = (tx, ty, c) => {
      g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 2;
      g.fillRect(tx - s * 0.1, ty, s * 0.2, s * 0.06); g.strokeRect(tx - s * 0.1, ty, s * 0.2, s * 0.06);
      g.fillRect(tx - s * 0.05, ty - s * 0.04, s * 0.09, s * 0.04); g.strokeRect(tx - s * 0.05, ty - s * 0.04, s * 0.09, s * 0.04);
      g.fillRect(tx + s * 0.04, ty - s * 0.03, s * 0.12, s * 0.015);
      g.fillStyle = INK; for (let i = 0; i < 4; i++) { circle(g, tx - s * 0.075 + i * s * 0.05, ty + s * 0.075, s * 0.018); g.fill(); }
    };
    tank(x - s * 0.18, y + s * 0.1, '#556b2f');
    tank(x + s * 0.15, y + s * 0.28, '#6b6f72');
    const plane = (px, py) => {
      g.fillStyle = '#4a4f55';
      g.fillRect(px - s * 0.12, py - s * 0.015, s * 0.24, s * 0.03);
      g.fillRect(px - s * 0.02, py - s * 0.12, s * 0.05, s * 0.24);
      g.fillRect(px - s * 0.12, py - s * 0.05, s * 0.025, s * 0.1);
    };
    plane(x - s * 0.15, y - s * 0.25);
    plane(x + s * 0.22, y - s * 0.32);
  },
  dnd(g, x, y, s) {
    // a big twenty-sided die in front of a sword
    g.fillStyle = '#d9d2c0'; g.fillRect(x - s * 0.02, y - s * 0.48, s * 0.04, s * 0.8);
    g.fillStyle = '#c9a74a'; g.fillRect(x - s * 0.14, y + s * 0.3, s * 0.28, s * 0.04); g.fillRect(x - s * 0.025, y + s * 0.34, s * 0.05, s * 0.12);
    const r = s * 0.3;
    const p = (k) => [x + Math.cos(-Math.PI / 2 + (k * TAU) / 6) * r, y + Math.sin(-Math.PI / 2 + (k * TAU) / 6) * r];
    const t = [0, 1, 2].map((k) => [x + Math.cos(-Math.PI / 2 + (k * TAU) / 3) * r * 0.55, y + Math.sin(-Math.PI / 2 + (k * TAU) / 3) * r * 0.55]);
    g.fillStyle = '#6c3483'; g.strokeStyle = '#f6d04d'; g.lineWidth = 3;
    g.beginPath(); for (let k = 0; k < 6; k++) g.lineTo(...p(k)); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8e44ad';
    g.beginPath(); for (const v of t) g.lineTo(...v); g.closePath(); g.fill(); g.stroke();
    g.beginPath();
    for (const [a, b] of [[0, 0], [0, 1], [0, 5], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [2, 5]]) { g.moveTo(...t[a]); g.lineTo(...p(b)); }
    g.stroke();
    label(g, '20', x, y + s * 0.02, r * 0.5, r * 0.4, '#f6d04d');
  },
  carc(g, x, y, s) {
    // square landscape tiles with roads, a walled city and little wooden people
    const n = 3;
    const w = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const tx = x - s / 2 + i * w;
      const ty = y - s / 2 + j * w;
      g.fillStyle = (i + j) % 2 ? '#7cb342' : '#8bc34a'; g.fillRect(tx, ty, w, w);
      g.strokeStyle = '#4e6b2a'; g.lineWidth = 1; g.strokeRect(tx, ty, w, w);
    }
    g.strokeStyle = '#f2deb4'; g.lineWidth = s * 0.05;
    g.beginPath(); g.moveTo(x - s / 2, y + w * 0.5); g.lineTo(x + s / 2, y + w * 0.5); g.moveTo(x, y + w * 0.5); g.lineTo(x, y + s / 2); g.stroke();
    g.fillStyle = '#c49a5e'; g.strokeStyle = '#7a5a30'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s * 0.2, y - s / 2); g.quadraticCurveTo(x - s * 0.05, y - s * 0.1, x - s / 2, y - s * 0.05); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#c0392b'; for (const [a, b] of [[-0.38, -0.38], [-0.22, -0.4], [-0.33, -0.25]]) g.fillRect(x + a * s, y + b * s, s * 0.06, s * 0.05);
    const meeple = (mx, my, c) => {
      g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); circle(g, mx, my - s * 0.05, s * 0.025); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(mx - s * 0.05, my); g.lineTo(mx + s * 0.05, my); g.lineTo(mx + s * 0.03, my + s * 0.03); g.lineTo(mx + s * 0.04, my + s * 0.07); g.lineTo(mx - s * 0.04, my + s * 0.07); g.lineTo(mx - s * 0.03, my + s * 0.03); g.closePath(); g.fill(); g.stroke();
    };
    meeple(x + s * 0.3, y - s * 0.25, '#2a5bd7');
    meeple(x - s * 0.25, y + s * 0.28, '#f6d04d');
    meeple(x + s * 0.12, y + s * 0.05, '#e2231a');
  },
};

const GAMES = [
  { id: 'gMejn', name: 'MENS ERGER JE NIET', size: [0.4, 0.055, 0.4], bg: '#d8312a', fg: '#ffffff', art: 'mejn', in: [['pawnRed', 3], ['pawnBlue', 3], ['pawnYellow', 3], ['pawnGreen', 3], ['die', 1]] },
  { id: 'gGanzen', name: 'GANZENBORD', size: [0.4, 0.05, 0.4], bg: '#2e8b57', fg: '#fff6d8', art: 'ganzen', in: [['pawnRed', 2], ['pawnYellow', 2], ['die', 2]] },
  { id: 'gDammen', name: 'DAMMEN', size: [0.36, 0.05, 0.36], bg: '#7b4a2a', fg: '#ffffff', art: 'dammen', in: [['damWit', 8], ['damZwart', 8]] },
  { id: 'gSchaken', name: 'SCHAKEN', size: [0.36, 0.06, 0.36], bg: '#1b1b1b', fg: '#ffffff', art: 'schaken', in: [['chessWhite', 5], ['chessBlack', 5]] },
  { id: 'gZeeslag', name: 'ZEESLAG', size: [0.42, 0.07, 0.28], bg: '#1d4f9a', fg: '#ffffff', art: 'zeeslag', in: [['ship', 5], ['peg', 8]] },
  { id: 'gVier', name: 'VIER OP EEN RIJ', size: [0.32, 0.07, 0.26], bg: '#3b7dd8', fg: '#f6d04d', art: 'vier', in: [['schijfRood', 8], ['schijfGeel', 8]] },
  { id: 'gMolen', name: 'PUZZEL 1000', size: [0.38, 0.07, 0.27], bg: '#f4f0e6', fg: '#1d4f9a', art: 'molen', in: [['puzzleRed', 6], ['puzzleBlue', 6], ['puzzleGreen', 6]] },
  { id: 'gGracht', name: 'PUZZEL 500', size: [0.38, 0.07, 0.27], bg: '#2f2a26', fg: '#f6d04d', art: 'gracht', in: [['puzzleBrown', 8], ['puzzleBlue', 8]] },
  { id: 'gDomino', name: 'DOMINO', size: [0.22, 0.05, 0.11], bg: '#c9935f', fg: '#3a2210', art: 'domino', in: [['domino', 10]] },
  { id: 'gKwartet', name: 'KWARTET', size: [0.1, 0.035, 0.14], bg: '#e86fa0', fg: '#ffffff', art: 'kaarten', in: [['cardRed', 8]] },
  { id: 'gKlaver', name: 'KLAVERJASSEN', size: [0.08, 0.03, 0.11], bg: '#2a5bd7', fg: '#ffffff', art: 'kaarten', in: [['cardBlue', 8]] },
  { id: 'gMemo', name: 'MEMO', size: [0.22, 0.06, 0.22], bg: '#f6d04d', fg: '#c0392b', art: 'memo', in: [['memoCard', 12]] },
  { id: 'gRummy', name: 'RUMMY', size: [0.3, 0.07, 0.2], bg: '#5b2a86', fg: '#f6d04d', art: 'rummy', in: [['rummyTile', 12]] },
  { id: 'gToren', name: 'WANKELTOREN', size: [0.28, 0.09, 0.09], bg: '#e8a33c', fg: '#5a2d0c', art: 'toren', in: [['torenBlok', 12]] },
  { id: 'gDobbel', name: 'DOBBELSPEL', size: [0.16, 0.06, 0.12], bg: '#e2231a', fg: '#ffffff', art: 'dobbel', in: [['die', 5]] },
  { id: 'gMikado', name: 'MIKADO', size: [0.22, 0.04, 0.05], bg: '#3fae3a', fg: '#ffffff', art: 'mikado', in: [['mikado', 10]] },
  { id: 'gStraten', name: 'STRATENSPEL', size: [0.4, 0.06, 0.27], bg: '#ffffff', fg: '#3fae3a', art: 'straten', in: [['geldRoze', 6], ['geldGroen', 6], ['geldBlauw', 6], ['pawnBlue', 2], ['die', 2]] },
  // the big ones the family plays
  { id: 'gCatan', name: 'CATAN', size: [0.4, 0.08, 0.28], bg: '#c8501e', fg: '#fff6d8', art: 'catan', in: [['catanWheat', 3], ['catanWood', 3], ['catanWool', 3], ['catanBrick', 3], ['catanOre', 3], ['catanHouseRed', 3], ['catanHouseBlue', 3], ['catanRoadRed', 4], ['catanRoadBlue', 4], ['die', 2]] },
  { id: 'gRisk', name: 'RISK', size: [0.42, 0.07, 0.28], bg: '#1b1b1b', fg: '#e2231a', art: 'risk', in: [['armyRed', 8], ['armyBlue', 8], ['armyGreen', 6], ['armyYellow', 6], ['die', 3]] },
  { id: 'gAxis', name: 'AXIS & ALLIES', size: [0.42, 0.08, 0.29], bg: '#55583a', fg: '#f2deb4', art: 'axis', in: [['tankGreen', 5], ['tankGrey', 5], ['tankTan', 4], ['planeGrey', 3], ['planeGreen', 3], ['chipRed', 4], ['chipBlue', 4], ['die', 3]] },
  { id: 'gDnd', name: 'DUNGEONS & DRAGONS', size: [0.3, 0.06, 0.3], bg: '#7a0d12', fg: '#f6d04d', art: 'dnd', in: [['d20Purple', 2], ['d20Red', 2], ['d20Blue', 1], ['d8Purple', 2], ['d4Red', 2], ['die', 3], ['dndMini', 4]] },
  { id: 'gCarc', name: 'CARCASSONNE', size: [0.3, 0.07, 0.3], bg: '#2a4f9a', fg: '#f6d04d', art: 'carc', in: [['carcTile', 12], ['meepleRed', 3], ['meepleBlue', 3], ['meepleYellow', 3], ['meepleGreen', 3]] },
];

function gameBox(game) {
  const [w, h, d] = game.size;
  const lid = canvasTexture(256, Math.round((256 * d) / w), (g, W, Hh) => {
    g.fillStyle = game.bg; g.fillRect(0, 0, W, Hh);
    const band = Hh * 0.24;
    const s = Math.min(W * 0.8, Hh - band - 14);
    g.lineJoin = 'round';
    LID_ART[game.art](g, W / 2, band + 4 + (Hh - band) / 2 - 4, s);
    g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, Hh - 3);
    label(g, game.name, W / 2, band / 2 + 2, W * 0.9, band * 0.75, game.fg);
  });
  const spine = canvasTexture(512, Math.max(32, Math.round((512 * h) / w)), (g, W, Hh) => {
    g.fillStyle = game.bg; g.fillRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, Hh * 0.08, W, Hh * 0.08); g.fillRect(0, Hh * 0.84, W, Hh * 0.08);
    label(g, game.name, W / 2, Hh / 2 + 1, W * 0.9, Hh * 0.62, game.fg);
  });
  const side = mat(new THREE.Color(game.bg).getHex());
  const s = texMat(spine);
  return { w, h, d, look: () => ({ geo: Box(w, h, d), material: [side, side, texMat(lid), mat(0xe9e1cf), s, s] }) };
}

// ---------------------------------------------------------------- the closet doors' painting
// The closet's doors are painted like a Mongolian chest: vermilion, a gold key
// pattern on a dark blue border, cloud scrolls shaded in bands from dark to
// light, and an endless knot in a round medallion. The right door is the left
// one mirrored.
const MN = {
  red: '#c8381e', dark: '#6e1a0e', gold: '#f2b53a', ink: '#2a1208',
  blue: ['#0f2f6b', '#2a63b8', '#6aa6e8', '#d4ecff'],
  green: ['#17502a', '#2f8f45', '#78c987', '#e0f7da'],
  teal: ['#0b5c5c', '#1f9e9a', '#72d6cf', '#e3fffb'],
};
/** A curl of cloud scroll (a ram's horn), curling in from `turn`, shaded from dark to light. */
function cloudScroll(g, x, y, r, turn, shades, flip = 1) {
  g.beginPath();
  for (let t = 0; t <= Math.PI * 2.4; t += 0.06) {
    const rr = r * (1 - t / (Math.PI * 3));
    g.lineTo(x + flip * Math.cos(turn + t) * rr, y + Math.sin(turn + t) * rr);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = MN.ink; g.lineWidth = r * 0.5; g.stroke();
  [0.42, 0.3, 0.18, 0.07].forEach((w, i) => { g.strokeStyle = shades[i]; g.lineWidth = r * w; g.stroke(); });
}
/** The endless knot: an interlaced lattice turned on its corner, with a loop at each corner. */
function endlessKnot(g, x, y, s) {
  g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
  const n = 4;
  const a = s / 2;
  const step = s / n;
  const path = () => {
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const o = -a + i * step;
      g.moveTo(o, -a); g.lineTo(o, a); g.moveTo(-a, o); g.lineTo(a, o);
    }
    for (const [cx, cy] of [[-a, -a], [a, -a], [a, a], [-a, a]]) {
      const lx = cx + Math.sign(cx) * step * 0.45;
      const ly = cy + Math.sign(cy) * step * 0.45;
      g.moveTo(lx + step * 0.6, ly); g.arc(lx, ly, step * 0.6, 0, TAU);
    }
  };
  g.lineCap = 'round';
  path(); g.strokeStyle = MN.ink; g.lineWidth = s * 0.1; g.stroke();
  path(); g.strokeStyle = MN.gold; g.lineWidth = s * 0.055; g.stroke();
  g.restore();
}
/** A strip of the square key pattern, `len` long from (x, y), across or (vertical) down. */
function keyStrip(g, x, y, len, u, vertical) {
  const P = (a, b) => (vertical ? [x + b * u, y + a * u] : [x + a * u, y + b * u]);
  g.beginPath();
  for (let ox = 0; ox + 4 <= len / u; ox += 4) {
    g.moveTo(...P(ox, 4)); g.lineTo(...P(ox + 4, 4));
    for (const [a, b] of [[ox, 4], [ox, 0], [ox + 3, 0], [ox + 3, 3], [ox + 1, 3], [ox + 1, 1.5], [ox + 2, 1.5]]) g.lineTo(...P(a, b));
  }
  g.strokeStyle = MN.gold; g.lineWidth = u * 0.55; g.lineCap = 'square'; g.lineJoin = 'miter'; g.stroke();
}
/**
 * The front of one closet door, as a canvas texture 512 high and as wide as
 * the door's `aspect` (width / height) makes it, so the painting isn't squashed.
 */
function closetDoorArt(mirror, aspect) {
  return canvasTexture(Math.round(512 * aspect), 512, (g, W, H) => {
    if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
    // The dark blue border with its gold key pattern runs round the outside of
    // the whole closet: along this door's outer edge, top and bottom, but not
    // down the middle, where the two doors meet.
    const bw = 22;
    g.fillStyle = MN.blue[0]; g.fillRect(0, 0, W, H);
    const u = (bw - 6) / 4.5;
    keyStrip(g, bw, 4, W - bw, u, false);
    keyStrip(g, bw, H - bw + 2, W - bw, u, false);
    keyStrip(g, 4, bw, H - 2 * bw, u, true);
    g.fillStyle = MN.red; g.fillRect(bw, bw, W - bw, H - 2 * bw);
    g.strokeStyle = MN.gold; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W, bw + 2); g.lineTo(bw + 2, bw + 2); g.lineTo(bw + 2, H - bw - 2); g.lineTo(W, H - bw - 2); g.stroke();

    // two panels, each framed in teal and gold
    const panel = (x0, y0, x1, y1) => {
      g.fillStyle = MN.dark; g.fillRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
      g.fillStyle = MN.teal[1]; g.fillRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6);
      g.fillStyle = MN.red; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = MN.gold; g.lineWidth = 2; g.strokeRect(x0 + 5, y0 + 5, x1 - x0 - 10, y1 - y0 - 10);
    };
    const px0 = bw + 20;
    const px1 = W - 20;
    const cx = (px0 + px1) / 2;
    panel(px0, 48, px1, 318);
    panel(px0, 348, px1, H - 46);
    // The motifs are drawn for panels 194 wide (a door 1 m wide); on a
    // narrower door they shrink to fit, keeping their shape.
    const s = Math.min(1, (px1 - px0) / 194);
    /** Draws `art` with (0, 0) at (x, y), scaled by s. */
    const motif = (x, y, art) => { g.save(); g.translate(x, y); g.scale(s, s); art(); g.restore(); };

    // the upper panel: the medallion with the endless knot, clouds curling around it
    const my = 183;
    motif(cx, my, () => {
      for (const f of [1, -1]) {
        cloudScroll(g, f * 34, -92, 22, Math.PI * 0.9, MN.blue, f);
        cloudScroll(g, f * 34, 92, 22, -Math.PI * 0.9, MN.blue, f);
        cloudScroll(g, f * 70, 0, 18, Math.PI * 1.5, MN.green, f);
      }
    });
    for (const [x, y, f, t] of [[px0 + 18, 66, 1, 0], [px1 - 18, 66, -1, 0], [px0 + 18, 300, 1, Math.PI], [px1 - 18, 300, -1, Math.PI]]) cloudScroll(g, x, y, 12, t, MN.teal, f);
    motif(cx, my, () => {
      const R = 52;
      g.fillStyle = MN.ink; circle(g, 0, 0, R + 5); g.fill();
      g.fillStyle = MN.gold; circle(g, 0, 0, R + 2); g.fill();
      g.fillStyle = MN.blue[0]; circle(g, 0, 0, R - 3); g.fill();
      g.strokeStyle = MN.blue[2]; g.lineWidth = 2; circle(g, 0, 0, R - 9); g.stroke();
      endlessKnot(g, 0, 0, R * 0.95);
    });

    // the lower panel: two big horns curling away from a gold diamond
    const ly = (348 + H - 46) / 2;
    motif(cx, ly, () => {
      for (const f of [1, -1]) {
        cloudScroll(g, f * 46, -8, 30, Math.PI, f > 0 ? MN.blue : MN.green, f);
        cloudScroll(g, f * 50, 46, 14, 0, MN.teal, f);
        cloudScroll(g, f * 50, -58, 14, 0, MN.teal, f);
      }
      g.fillStyle = MN.ink;
      g.beginPath(); g.moveTo(0, -30); g.lineTo(18, 0); g.lineTo(0, 30); g.lineTo(-18, 0); g.closePath(); g.fill();
      g.fillStyle = MN.gold;
      g.beginPath(); g.moveTo(0, -25); g.lineTo(14, 0); g.lineTo(0, 25); g.lineTo(-14, 0); g.closePath(); g.fill();
      g.fillStyle = MN.red; circle(g, 0, 0, 5); g.fill();
    });
  });
}

// ---------------------------------------------------------------- the catalogue
function buildCatalogue() {
  const C = { ...PRODUCTS };
  const plastic = (c) => mat(c, { roughness: 0.35 });
  const wood = mat(0xd9b27c, { roughness: 0.7 });

  // board game pieces
  const pawn = (c, scale = 1) => {
    const prof = [[0, 0], [0.012, 0], [0.012, 0.004], [0.007, 0.012], [0.005, 0.026], [0, 0.026]].map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
    return parts([[new THREE.LatheGeometry(prof, 12), plastic(c)], [at(Sph(0.0085 * scale), 0, 0.031 * scale, 0), plastic(c)]]);
  };
  C.pawn = pawn(0xffffff);
  C.pawnRed = tint('pawn', 0xe2231a);
  C.pawnBlue = tint('pawn', 0x2a5bd7);
  C.pawnYellow = tint('pawn', 0xf6d04d);
  C.pawnGreen = tint('pawn', 0x3fae3a);
  C.chess = pawn(0xffffff, 1.5);
  C.chessWhite = tint('chess', 0xf4efe4);
  C.chessBlack = tint('chess', 0x2a2a2a);
  C.die = { w: 0.018, h: 0.018, d: 0.018, look: () => ({ geo: Box(0.018, 0.018, 0.018), material: [1, 6, 2, 5, 3, 4].map((n) => texMat(pips(n), { roughness: 0.3 })) }) };
  const disc = (c, r = 0.017, h = 0.007) => item(Cyl(r, r, h, 16), plastic(c));
  C.dam = disc(0xffffff);
  C.damWit = tint('dam', 0xf4efe4);
  C.damZwart = tint('dam', 0x2a2a2a);
  C.schijf = disc(0xffffff, 0.016, 0.006);
  C.schijfRood = tint('schijf', 0xe2231a);
  C.schijfGeel = tint('schijf', 0xf6d04d);
  C.peg = item(Cyl(0.004, 0.004, 0.02, 6), plastic(0xe2231a));
  C.ship = parts([[Box(0.06, 0.012, 0.014), plastic(0x8a939c)], [at(Box(0.018, 0.01, 0.01), -0.005, 0.011, 0), plastic(0x8a939c)]]);
  const card = (c) => {
    const back = canvasTexture(64, 96, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 96); g.fillStyle = c; g.fillRect(5, 5, 54, 86); g.strokeStyle = '#ffffff'; g.lineWidth = 2; for (let i = -96; i < 96; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 96, 96); g.stroke(); } });
    const white = mat(0xffffff);
    return { w: 0.06, h: 0.0025, d: 0.09, look: () => ({ geo: Box(0.06, 0.0025, 0.09), material: [white, white, texMat(back), white, white, white] }) };
  };
  C.cardRed = card('#c0392b');
  C.cardBlue = card('#2a5bd7');
  C.memoCard = item(Box(0.05, 0.003, 0.05), mat(0x3b7dd8));
  const piece = (c) => parts([[Box(0.04, 0.004, 0.04), mat(c)], [at(Cyl(0.009, 0.009, 0.004, 10), 0.024, 0, 0), mat(c)], [at(Cyl(0.009, 0.009, 0.004, 10), 0, 0, 0.024), mat(c)]]);
  C.puzzle = piece(0xffffff);
  C.puzzleRed = tint('puzzle', 0xe2231a);
  C.puzzleBlue = tint('puzzle', 0x7fbbe8);
  C.puzzleGreen = tint('puzzle', 0x3fae3a);
  C.puzzleBrown = tint('puzzle', 0x8a3b2a);
  const domTop = canvasTexture(32, 64, (g) => { g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#ffffff'; g.fillRect(3, 31, 26, 2); for (const [x, y] of [[9, 10], [23, 22], [16, 46]]) { circle(g, x, y, 3.5); g.fill(); } });
  C.domino = { w: 0.024, h: 0.008, d: 0.048, look: () => { const b = mat(0x1b1b1b); return { geo: Box(0.024, 0.008, 0.048), material: [b, b, texMat(domTop), b, b, b] }; } };
  const rummyTop = canvasTexture(48, 64, (g) => { g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, 48, 64); label(g, '7', 24, 30, 30, 40, '#e2231a'); });
  C.rummyTile = { w: 0.028, h: 0.008, d: 0.038, look: () => { const b = mat(0xfbf3e4); return { geo: Box(0.028, 0.008, 0.038), material: [b, b, texMat(rummyTop), b, b, b] }; } };
  C.torenBlok = item(Box(0.075, 0.015, 0.025), wood);
  C.mikado = item(Cyl(0.0025, 0.0025, 0.18, 6).rotateZ(Math.PI / 2), mat(0xe8c35a));
  C.geld = item(Box(0.07, 0.001, 0.035), mat(0xffffff));
  C.geldRoze = tint('geld', 0xf2a2b8);
  C.geldGroen = tint('geld', 0xa5d36b);
  C.geldBlauw = tint('geld', 0x9ad0f0);
  // standing pieces cut from an outline (x across, y up) and given some thickness
  const upright = (pts, depth) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false });
  const woodPiece = mat(0xffffff, { roughness: 0.7 });
  // Catan: land hexes, little houses and roads
  C.catanHex = item(Cyl(0.035, 0.035, 0.004, 6), mat(0xffffff, { roughness: 0.7 }));
  C.catanWheat = tint('catanHex', 0xe8c35a);
  C.catanWood = tint('catanHex', 0x2e7d32);
  C.catanWool = tint('catanHex', 0x9ccc65);
  C.catanBrick = tint('catanHex', 0xc1582f);
  C.catanOre = tint('catanHex', 0x8a939c);
  C.catanHouse = item(upright([[-0.007, 0], [0.007, 0], [0.007, 0.01], [0, 0.017], [-0.007, 0.01]], 0.012), woodPiece);
  C.catanHouseRed = tint('catanHouse', 0xe2231a);
  C.catanHouseBlue = tint('catanHouse', 0x2a5bd7);
  C.catanRoad = item(Box(0.03, 0.006, 0.006), woodPiece);
  C.catanRoadRed = tint('catanRoad', 0xe2231a);
  C.catanRoadBlue = tint('catanRoad', 0x2a5bd7);
  // Risk: little army cubes
  C.army = item(Box(0.01, 0.01, 0.01), plastic(0xffffff));
  C.armyRed = tint('army', 0xe2231a);
  C.armyBlue = tint('army', 0x2a5bd7);
  C.armyGreen = tint('army', 0x3fae3a);
  C.armyYellow = tint('army', 0xf6d04d);
  // Axis & Allies: tanks, planes and chips
  C.tank = parts([
    [Box(0.03, 0.01, 0.018), plastic(0xffffff)],
    [at(Cyl(0.007, 0.007, 0.006, 10), -0.002, 0.008, 0), plastic(0xffffff)],
    [at(Cyl(0.0015, 0.0015, 0.018, 6), 0.012, 0.008, 0, 0, 0, Math.PI / 2), plastic(0xffffff)],
  ]);
  C.tankGreen = tint('tank', 0x556b2f);
  C.tankGrey = tint('tank', 0x6b6f72);
  C.tankTan = tint('tank', 0xc2a36b);
  C.plane = parts([
    [Box(0.03, 0.005, 0.006), plastic(0xffffff)],
    [at(Box(0.008, 0.002, 0.034), 0.002, 0, 0), plastic(0xffffff)],
    [at(Box(0.004, 0.002, 0.014), -0.013, 0.002, 0), plastic(0xffffff)],
  ]);
  C.planeGrey = tint('plane', 0x4a4f55);
  C.planeGreen = tint('plane', 0x556b2f);
  C.chip = disc(0xffffff, 0.012, 0.003);
  C.chipRed = tint('chip', 0xc0392b);
  C.chipBlue = tint('chip', 0x2a5bd7);
  // Dungeons & Dragons: dice with lots of sides and grey miniatures
  C.d20 = item(new THREE.IcosahedronGeometry(0.011), plastic(0xffffff));
  C.d20Purple = tint('d20', 0x8e44ad);
  C.d20Red = tint('d20', 0xc0392b);
  C.d20Blue = tint('d20', 0x2a5bd7);
  C.d8 = item(new THREE.OctahedronGeometry(0.01), plastic(0xffffff));
  C.d8Purple = tint('d8', 0x8e44ad);
  C.d4 = item(new THREE.TetrahedronGeometry(0.011), plastic(0xffffff));
  C.d4Red = tint('d4', 0xc0392b);
  C.dndMini = tint('chess', 0x8a939c);
  // Carcassonne: square land tiles and meeples
  const carcTop = canvasTexture(64, 64, (g) => {
    g.fillStyle = '#7cb342'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#c49a5e'; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.quadraticCurveTo(32, 26, 0, 0); g.fill();
    g.fillStyle = '#f2deb4'; g.fillRect(0, 36, 64, 8); g.fillRect(28, 36, 8, 28);
  });
  C.carcTile = { w: 0.045, h: 0.004, d: 0.045, look: () => { const b = mat(0xe9e1cf); return { geo: Box(0.045, 0.004, 0.045), material: [b, b, texMat(carcTop), b, b, b] }; } };
  C.meeple = item(upright([[-0.008, 0], [-0.0025, 0], [0, 0.005], [0.0025, 0], [0.008, 0], [0.004, 0.008], [0.009, 0.011], [0.008, 0.013], [0.003, 0.012], [0.0035, 0.016], [0, 0.018], [-0.0035, 0.016], [-0.003, 0.012], [-0.008, 0.013], [-0.009, 0.011], [-0.004, 0.008]], 0.005), woodPiece);
  C.meepleRed = tint('meeple', 0xe2231a);
  C.meepleBlue = tint('meeple', 0x2a5bd7);
  C.meepleYellow = tint('meeple', 0xf6d04d);
  C.meepleGreen = tint('meeple', 0x3fae3a);
  for (const game of GAMES) C[game.id] = gameBox(game);
  // the sjoelbak's pucks
  C.sjoelschijf = item(Cyl(0.026, 0.026, 0.012, 16), wood);

  // toys
  const block = (ch, bg) => {
    const m = texMat(letterTex(ch, bg));
    return { w: 0.07, h: 0.07, d: 0.07, look: () => ({ geo: Box(0.07, 0.07, 0.07), material: m }) };
  };
  C.blockA = block('A', '#e2231a');
  C.blockB = block('B', '#2a5bd7');
  C.blockC = block('C', '#e8a33c');
  C.blockD = block('D', '#3fae3a');
  const brick = (c) => parts([[Box(0.064, 0.038, 0.032), plastic(c)], [at(Cyl(0.0095, 0.0095, 0.008, 10), -0.016, 0.023, 0), plastic(c)], [at(Cyl(0.0095, 0.0095, 0.008, 10), 0.016, 0.023, 0), plastic(c)]]);
  C.brick = brick(0xffffff);
  C.brickRed = tint('brick', 0xe2231a);
  C.brickBlue = tint('brick', 0x2a5bd7);
  C.brickYellow = tint('brick', 0xf6d04d);
  C.brickWhite = tint('brick', 0xf4f2ee);
  const beach = canvasTexture(128, 64, (g) => { ['#e2231a', '#ffffff', '#2a5bd7', '#f6d04d', '#ffffff', '#3fae3a'].forEach((c, i) => { g.fillStyle = c; g.fillRect((i * 128) / 6, 0, 128 / 6 + 1, 64); }); });
  C.beachBall = item(new THREE.SphereGeometry(0.11, 18, 12), texMat(beach, { roughness: 0.35 }), { shape: 'ball' });
  const star = canvasTexture(128, 64, (g) => { g.fillStyle = '#e2231a'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#f6d04d'; g.fillRect(0, 26, 128, 12); });
  C.ball = item(new THREE.SphereGeometry(0.075, 16, 10), texMat(star, { roughness: 0.35 }), { shape: 'ball' });
  const car = (c) => {
    const wheel = plastic(0x1b1b1b);
    const w = (x, z) => [at(Cyl(0.016, 0.016, 0.012, 10), x, 0.016, z, Math.PI / 2), wheel];
    return parts([[at(Box(0.12, 0.034, 0.06), 0, 0.03, 0), plastic(c)], [at(Box(0.06, 0.03, 0.054), -0.01, 0.06, 0), plastic(0xbfe4f5)], w(0.04, 0.032), w(-0.04, 0.032), w(0.04, -0.032), w(-0.04, -0.032)]);
  };
  C.carRed = car(0xe2231a);
  C.carBlue = car(0x2a5bd7);
  C.carYellow = car(0xf6d04d);
  const fur = mat(0x9a6a3c, { roughness: 1 });
  const snout = mat(0xd9b48a, { roughness: 1 });
  C.teddy = parts([
    [at(Sph(0.065, 1, 1.1, 0.9), 0, 0.07, 0), fur], [at(Sph(0.05), 0, 0.16, 0), fur],
    [at(Sph(0.02), -0.035, 0.2, 0), fur], [at(Sph(0.02), 0.035, 0.2, 0), fur],
    [at(Sph(0.024), -0.065, 0.09, 0.02), fur], [at(Sph(0.024), 0.065, 0.09, 0.02), fur],
    [at(Sph(0.03), -0.04, 0.025, 0.045), fur], [at(Sph(0.03), 0.04, 0.025, 0.045), fur],
    [at(Sph(0.02), 0, 0.15, 0.045), snout],
  ]);
  const duckY = plastic(0xf6d04d);
  C.duck = parts([[at(Sph(0.05, 1.2, 0.8, 1), 0, 0.04, 0), duckY], [at(Sph(0.032), 0.035, 0.09, 0), duckY], [at(Box(0.03, 0.01, 0.022), 0.072, 0.086, 0), plastic(0xf59a23)]]);
  const crayon = (c) => parts([[Cyl(0.005, 0.005, 0.08, 8).rotateZ(Math.PI / 2), mat(c)], [new THREE.ConeGeometry(0.005, 0.014, 8).rotateZ(-Math.PI / 2).translate(0.047, 0, 0), mat(c)]]);
  C.crayon = crayon(0xffffff);
  C.crayonRed = tint('crayon', 0xe2231a);
  C.crayonBlue = tint('crayon', 0x2a5bd7);
  C.crayonGreen = tint('crayon', 0x3fae3a);
  const drawing = canvasTexture(128, 180, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 180);
    g.lineWidth = 4; g.strokeStyle = '#e2231a'; g.strokeRect(30, 80, 60, 50);
    g.strokeStyle = '#2a5bd7'; g.beginPath(); g.moveTo(24, 82); g.lineTo(60, 48); g.lineTo(96, 82); g.stroke();
    g.fillStyle = '#f6d04d'; circle(g, 104, 26, 14); g.fill();
    g.strokeStyle = '#3fae3a'; g.beginPath(); g.moveTo(0, 150); for (let x = 0; x < 128; x += 8) g.lineTo(x, 146 + (x % 16 ? 6 : -4)); g.stroke();
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 3; g.beginPath(); circle(g, 40, 112, 6); g.stroke(); g.beginPath(); g.moveTo(40, 118); g.lineTo(40, 140); g.stroke();
  });
  C.drawing = { w: 0.21, h: 0.002, d: 0.297, look: () => { const w = mat(0xffffff); return { geo: Box(0.21, 0.002, 0.297), material: [w, w, texMat(drawing), w, w, w] }; } };

  // The kids' stuff in the living room: they're 10 and 13, so no teddies but
  // a gaming headset, comics, game cases, trading
  // cards, a foam dart blaster and its darts, a puzzle cube and Lego bricks.
  // a gaming headset lying flat: the band, two ear cups with green rings on top
  const headsetDark = mat(0x26262a, { roughness: 0.5 });
  C.headphones = parts([
    [new THREE.TorusGeometry(0.085, 0.009, 6, 18, Math.PI).rotateX(-Math.PI / 2).translate(0, 0.015, 0), headsetDark],
    ...[1, -1].map((s) => [at(Cyl(0.045, 0.045, 0.03, 16), s * 0.095, 0.015, 0), headsetDark]),
    ...[1, -1].map((s) => [at(Cyl(0.03, 0.03, 0.005, 14), s * 0.095, 0.0315, 0), mat(0x3fae3a, { roughness: 0.4 })]), // 1 mm into the cups
  ]);
  // comics: a bright cover, white pages
  const comicCover = (bg, title, ink, art) => canvasTexture(128, 192, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 128, 192);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 36);
    label(g, title, 64, 19, 112, 28, ink);
    art(g);
  });
  const burst = (g, x, y, r0, r1, n) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU; const r = i % 2 ? r1 : r0; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
  const heroCover = comicCover('#2a5bd7', 'HELDEN', '#c0392b', (g) => {
    g.fillStyle = '#f6d04d'; burst(g, 64, 116, 58, 36, 12); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
    label(g, 'POW!', 64, 116, 70, 34, '#c0392b');
  });
  const ninjaCover = comicCover('#c0392b', 'NINJA', '#1b1b1b', (g) => {
    g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 3;
    for (const [x, y, w, h] of [[8, 46, 54, 64], [66, 46, 54, 64], [8, 116, 112, 68]]) { g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); }
    g.fillStyle = '#1b1b1b';
    for (const [x, y] of [[35, 80], [93, 80], [64, 154]]) { circle(g, x, y, 14); g.fill(); }
    g.fillStyle = '#f2c69c';
    for (const [x, y] of [[35, 80], [93, 80], [64, 154]]) g.fillRect(x - 11, y - 4, 22, 7);
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(96, 134, 20, 11, 0, 0, TAU); g.fill(); g.stroke();
    label(g, 'HA!', 96, 134, 30, 14, '#c0392b');
  });
  const comic = (cover) => ({ w: 0.17, h: 0.006, d: 0.26, look: () => { const p = mat(0xf5f0e2); return { geo: Box(0.17, 0.006, 0.26), material: [p, p, texMat(cover), p, p, p] }; } });
  C.comicA = comic(heroCover);
  C.comicB = comic(ninjaCover);
  // game cases for the game console: red plastic, a picture on the front under a red band
  const caseCover = (art) => canvasTexture(64, 104, (g) => {
    art(g);
    g.fillStyle = '#e60012'; g.fillRect(0, 0, 64, 14);
    g.fillStyle = '#ffffff'; g.fillRect(24, 4, 16, 6);
  });
  const kartCover = caseCover((g) => {
    g.fillStyle = '#7fc8f0'; g.fillRect(0, 0, 64, 104);
    g.fillStyle = '#8a939c'; g.beginPath(); g.moveTo(0, 104); g.lineTo(26, 50); g.lineTo(38, 50); g.lineTo(64, 104); g.fill();
    g.fillStyle = '#e2231a'; g.fillRect(20, 70, 24, 14);
    g.fillStyle = '#1b1b1b'; for (const x of [22, 42]) { circle(g, x, 86, 5); g.fill(); }
    g.fillStyle = '#f6d04d'; circle(g, 32, 64, 7); g.fill();
  });
  const blockCover = caseCover((g) => {
    g.fillStyle = '#9ad0f0'; g.fillRect(0, 0, 64, 104);
    for (let x = 0; x < 64; x += 8) {
      const top = 56 + ((x * 7) % 24);
      g.fillStyle = '#5aa83a'; g.fillRect(x, top, 8, 8);
      g.fillStyle = '#8a5a3c'; g.fillRect(x, top + 8, 8, 104 - top);
    }
    g.fillStyle = '#3f8f3a'; g.fillRect(40, 30, 16, 16);
    g.fillStyle = '#6b4a2a'; g.fillRect(45, 46, 6, 12);
  });
  const gameCase = (cover) => ({ w: 0.105, h: 0.011, d: 0.17, look: () => { const r = plastic(0xd8312a); return { geo: Box(0.105, 0.011, 0.17), material: [r, r, texMat(cover, { roughness: 0.35 }), r, r, r] }; } });
  C.gameCaseA = gameCase(kartCover);
  C.gameCaseB = gameCase(blockCover);
  // a trading card: a yellow border round a little monster
  const monsterCard = canvasTexture(64, 88, (g) => {
    g.fillStyle = '#f6d04d'; g.fillRect(0, 0, 64, 88);
    g.fillStyle = '#9ad0f0'; g.fillRect(5, 12, 54, 38);
    g.fillStyle = '#f59a23'; circle(g, 32, 34, 13); g.fill();
    g.fillStyle = '#ffffff'; for (const x of [27, 37]) { circle(g, x, 31, 3.5); g.fill(); }
    g.fillStyle = '#1b1b1b'; for (const x of [27, 37]) { circle(g, x, 31, 1.6); g.fill(); }
    g.fillStyle = '#fbf3e4'; g.fillRect(5, 55, 54, 28);
    g.fillStyle = '#8a939c'; for (let y = 60; y < 80; y += 6) g.fillRect(9, y, 40, 2);
  });
  C.cardMonster = { w: 0.063, h: 0.002, d: 0.088, look: () => { const y = mat(0xf6d04d); return { geo: Box(0.063, 0.002, 0.088), material: [y, y, texMat(monsterCard), y, y, y] }; } };
  // a foam dart blaster (blue with orange bits) and its darts
  const blasterBlue = plastic(0x2a5bd7);
  const blasterOrange = plastic(0xf59a23);
  C.blaster = parts([
    [Box(0.3, 0.065, 0.04), blasterBlue],
    [at(Cyl(0.018, 0.018, 0.16, 12), 0.2, 0.01, 0, 0, 0, Math.PI / 2), blasterOrange],
    [at(Box(0.08, 0.02, 0.044), 0.05, 0.035, 0), blasterOrange],
    [at(Box(0.035, 0.09, 0.034), -0.08, -0.07, 0, 0, 0, 0.25), blasterBlue],
  ]);
  C.dart = parts([
    [Cyl(0.0065, 0.0065, 0.06, 8).rotateZ(Math.PI / 2), plastic(0x2a5bd7)],
    [Cyl(0.007, 0.007, 0.012, 8).rotateZ(Math.PI / 2).translate(0.034, 0, 0), blasterOrange],
  ]);
  // a puzzle cube, all mixed up
  const cubeTex = canvasTexture(64, 64, (g) => {
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 64, 64);
    const cols = ['#ffffff', '#e2231a', '#2a5bd7', '#f6d04d', '#3fae3a', '#f59a23'];
    for (let i = 0; i < 9; i++) { g.fillStyle = cols[(i * 4 + 1) % 6]; g.fillRect(3 + (i % 3) * 20, 3 + Math.floor(i / 3) * 20, 18, 18); }
  });
  C.puzzleCube = item(Box(0.057, 0.057, 0.057), texMat(cubeTex, { roughness: 0.3 }));
  // Lego: real-size 2×4 bricks, the ones that hurt when you step on them
  C.lego = parts([
    [Box(0.032, 0.0096, 0.016), plastic(0xffffff)],
    ...[-0.012, -0.004, 0.004, 0.012].flatMap((x) => [-0.004, 0.004].map((z) => [at(Cyl(0.0024, 0.0024, 0.002, 8), x, 0.0056, z), plastic(0xffffff)])),
  ]);
  C.legoRed = tint('lego', 0xe2231a);
  C.legoBlue = tint('lego', 0x2a5bd7);
  C.legoYellow = tint('lego', 0xf6d04d);
  C.legoGreen = tint('lego', 0x3fae3a);
  // The game console in its dock beside the TV, the kind with a red and a
  // blue controller clipped to either side of the screen, which sticks up
  // out of the dock. It faces +z. Drawn by us, no logos.
  const dockM = mat(0x2b2b30, { roughness: 0.45 });
  const btn = (x, y) => [at(Cyl(0.0032, 0.0032, 0.004, 8), x, y, 0.018, Math.PI / 2), dockM];
  const joyRed = plastic(0xff3c28);
  const joyBlue = plastic(0x0ab9e6);
  C.gameConsole = parts([
    [at(Box(0.18, 0.104, 0.054), 0, 0.052, 0), dockM], // the dock
    [at(Box(0.168, 0.034, 0.014), 0, 0.107, 0.004), mat(0x111114, { roughness: 0.2 })], // the console's top edge, sticking up out of it
    [at(Box(0.036, 0.114, 0.028), -0.1, 0.069, 0.004), joyRed], // the controllers either side, 2 mm into the console
    [at(Box(0.036, 0.114, 0.028), 0.1, 0.069, 0.004), joyBlue],
    [at(Cyl(0.0075, 0.0075, 0.006, 10), -0.1, 0.1, 0.019, Math.PI / 2), dockM], // their sticks
    [at(Cyl(0.0075, 0.0075, 0.006, 10), 0.1, 0.06, 0.019, Math.PI / 2), dockM],
    ...[[0, 1], [0, -1], [1, 0], [-1, 0]].flatMap(([a, b]) => [btn(0.1 + a * 0.007, 0.1 + b * 0.007), btn(-0.1 + a * 0.007, 0.06 + b * 0.007)]), // buttons
  ]);

  // living room bits
  const dark = plastic(0x2b2b30);
  C.controller = parts([[Box(0.1, 0.025, 0.05), dark], [at(Sph(0.022, 1, 0.6, 1.3), -0.045, -0.003, 0.02), dark], [at(Sph(0.022, 1, 0.6, 1.3), 0.045, -0.003, 0.02), dark], [at(Cyl(0.008, 0.008, 0.01, 8), -0.02, 0.016, -0.005), plastic(0x55555c)]]);
  const remoteTop = canvasTexture(32, 112, (g) => { g.fillStyle = '#1e1e22'; g.fillRect(0, 0, 32, 112); g.fillStyle = '#e2231a'; circle(g, 16, 10, 5); g.fill(); g.fillStyle = '#777'; for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) { circle(g, 7 + c * 9, 30 + r * 12, 3); g.fill(); } });
  C.remote = { w: 0.045, h: 0.018, d: 0.17, look: () => ({ geo: Box(0.045, 0.018, 0.17), material: [dark, dark, texMat(remoteTop), dark, dark, dark] }) };
  const cover = canvasTexture(128, 170, (g) => { g.fillStyle = '#f2a2b8'; g.fillRect(0, 0, 128, 170); label(g, 'WEEKBLAD', 64, 18, 116, 26, '#ffffff'); g.fillStyle = '#d9b48a'; circle(g, 64, 95, 34); g.fill(); g.fillStyle = '#5a3a1c'; g.beginPath(); g.arc(64, 88, 36, Math.PI, 0); g.fill(); label(g, 'ROYAL NIEUWS!', 64, 150, 116, 18, '#c0392b'); });
  C.magazine = { w: 0.21, h: 0.006, d: 0.28, look: () => { const w = mat(0xffffff); return { geo: Box(0.21, 0.006, 0.28), material: [w, w, texMat(cover), w, w, w] }; } };
  C.cushion = item(Sph(0.22, 1, 0.32, 1), mat(0x4fa7a0, { roughness: 0.9 }));
  const book = (c) => {
    const cv = mat(c);
    const pages = mat(0xf5f0e2);
    return { w: 0.15, h: 0.03, d: 0.22, look: () => ({ geo: Box(0.15, 0.03, 0.22), material: [pages, cv, cv, cv, pages, pages] }) };
  };
  C.bookRed = book(0xc0392b);
  C.bookBlue = book(0x2a5bd7);
  C.bookGreen = book(0x2e8b57);
  const lines = canvasTexture(128, 180, (g) => { g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, 128, 180); g.strokeStyle = '#9ab'; g.lineWidth = 1; for (let y = 24; y < 172; y += 9) { g.beginPath(); g.moveTo(10, y); g.lineTo(10 + 40 + ((y * 37) % 70), y); g.stroke(); } });
  C.paper = { w: 0.21, h: 0.001, d: 0.297, look: () => { const w = mat(0xffffff); return { geo: Box(0.21, 0.0015, 0.297), material: [w, w, texMat(lines), w, w, w] }; } };
  const screen = canvasTexture(32, 64, (g) => { g.fillStyle = '#111'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#3b7dd8'; g.fillRect(3, 6, 26, 50); g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) g.fillRect(6, 12 + i * 10, 20, 5); });
  C.phone = { w: 0.07, h: 0.008, d: 0.15, look: () => { const b = mat(0x111111); return { geo: Box(0.07, 0.008, 0.15), material: [b, b, texMat(screen, { roughness: 0.2 }), b, b, b] }; } };

  // kitchen
  const china = mat(0xfbfaf6, { roughness: 0.3, side: THREE.DoubleSide });
  const plate = (stains) => {
    const top = texMat(dirtyPlate(stains), { roughness: 0.3 });
    return { r: 0.12, h: 0.018, look: () => ({ geo: Cyl(0.12, 0.09, 0.018, 24), material: [china, top, china] }) };
  };
  C.plate = plate([[50, 60, 14, '#b3241b'], [80, 72, 8, '#b3241b'], [70, 45, 6, '#7b4a2a'], [44, 82, 5, '#e8b33a']]);
  C.plateB = plate([[60, 66, 18, '#7b4a2a'], [84, 52, 7, '#3e8f3a'], [78, 58, 6, '#3e8f3a'], [44, 48, 6, '#e8b33a']]);
  C.plateC = plate([[64, 64, 10, '#e8c35a'], [74, 70, 9, '#d8312a']]);
  const cereal = canvasTexture(64, 64, (g) => { g.fillStyle = '#f7f3e8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d99a4e'; for (let i = 0; i < 26; i++) { circle(g, 32 + Math.sin(i * 2.3) * 20, 32 + Math.cos(i * 1.7) * 20, 4); g.fill(); } });
  const bowlProf = [[0.001, 0], [0.04, 0], [0.065, 0.05], [0.061, 0.05], [0.037, 0.006], [0.001, 0.006]].map(([r, y]) => new THREE.Vector2(r, y));
  C.bowl = parts([[new THREE.LatheGeometry(bowlProf, 20), china], [new THREE.CircleGeometry(0.056, 18).rotateX(-Math.PI / 2).translate(0, 0.036, 0), texMat(cereal)]]);
  const mug = (c, drink = 0x4a2a17) => {
    const m = mat(c, { roughness: 0.35, side: THREE.DoubleSide });
    return parts([
      [Cyl(0.04, 0.037, 0.09, 16, true), m],
      [new THREE.CircleGeometry(0.037, 16).rotateX(Math.PI / 2).translate(0, -0.045, 0), m],
      [new THREE.TorusGeometry(0.022, 0.006, 6, 12).translate(0.045, 0, 0), m],
      [new THREE.CircleGeometry(0.038, 16).rotateX(-Math.PI / 2).translate(0, 0.02, 0), mat(drink, { roughness: 0.2 })],
    ]);
  };
  C.mugRed = mug(0xd8312a);
  C.mugBlue = mug(0x2a5bd7);
  C.mugYellow = mug(0xf2c14e);
  C.mugWhite = mug(0xf4f2ee, 0xc9b28a);
  const glassM = new THREE.MeshStandardMaterial({ color: 0xdff1ff, roughness: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  C.glass = parts([[Cyl(0.035, 0.03, 0.11, 14, true), glassM], [new THREE.CircleGeometry(0.03, 14).rotateX(-Math.PI / 2).translate(0, -0.05, 0), mat(0xf59a23, { roughness: 0.2 })]]);
  const steel = mat(0xb8bec4, { roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide });
  C.pot = parts([
    [Cyl(0.1, 0.1, 0.11, 18, true), steel],
    [new THREE.CircleGeometry(0.1, 18).rotateX(Math.PI / 2).translate(0, -0.055, 0), steel],
    [new THREE.CircleGeometry(0.098, 18).rotateX(-Math.PI / 2).translate(0, -0.02, 0), mat(0x8a3b1a, { roughness: 0.4 })],
    [at(Box(0.04, 0.012, 0.03), 0.118, 0.04, 0), dark], [at(Box(0.04, 0.012, 0.03), -0.118, 0.04, 0), dark],
  ]);
  const panM = mat(0x2b2b30, { roughness: 0.4, side: THREE.DoubleSide });
  C.pan = parts([
    [Cyl(0.13, 0.11, 0.035, 20, true), panM],
    // its bottom 3 mm up from the rim it stands on, so it doesn't flicker against the hob or counter under it
    [new THREE.CircleGeometry(0.111, 20).rotateX(Math.PI / 2).translate(0, -0.0145, 0), panM],
    [new THREE.CircleGeometry(0.06, 14).rotateX(-Math.PI / 2).translate(0.02, -0.012, 0.01), mat(0xf6d04d, { roughness: 0.4 })],
    [at(Box(0.18, 0.015, 0.03), 0.22, 0.01, 0), mat(0x5a3a1c)],
  ]);
  C.cutlery = item(Box(0.18, 0.004, 0.018), mat(0xc9ced3, { roughness: 0.25, metalness: 0.8 }));
  // the clean ones, in the hanging cupboard
  C.plateClean = plate([]);
  C.bowlClean = item(new THREE.LatheGeometry(bowlProf, 20), china);
  C.glassClean = parts([[Cyl(0.035, 0.03, 0.11, 14, true), glassM], [new THREE.CircleGeometry(0.03, 14).rotateX(Math.PI / 2).translate(0, -0.052, 0), glassM]]); // its bottom 3 mm up, so it doesn't flicker against the shelf
  // Crockery smashes (products.js): each piece breaks into a few shards,
  // hidden in it until then. White china, the mugs' shards in their colour.
  C.shard = item(flat([[0, 0], [0.07, 0.012], [0.055, 0.05], [0.012, 0.062]], 0.004), china);
  C.shardB = item(flat([[0, 0], [0.09, 0.02], [0.03, 0.048]], 0.004), china);
  C.shardGlass = item(flat([[0, 0], [0.055, 0.008], [0.02, 0.065]], 0.003), glassM);
  C.shardRed = tint('shard', 0xd8312a);
  C.shardBlue = tint('shardB', 0x2a5bd7);
  C.shardYellow = tint('shard', 0xf2c14e);
  for (const id of ['plate', 'plateB', 'plateC', 'plateClean']) C[id].breaks = ['shard', 'shardB', 'shard', 'shardB'];
  for (const id of ['bowl', 'bowlClean']) C[id].breaks = ['shardB', 'shard', 'shardB'];
  for (const id of ['glass', 'glassClean']) C[id].breaks = ['shardGlass', 'shardGlass', 'shardGlass'];
  C.mugRed.breaks = ['shardRed', 'shardRed', 'shardRed'];
  C.mugBlue.breaks = ['shardBlue', 'shardBlue', 'shardBlue'];
  C.mugYellow.breaks = ['shardYellow', 'shardYellow', 'shardYellow'];
  C.mugWhite.breaks = ['shard', 'shardB', 'shard'];
  // the blue fruit bowl on the counter across the back
  const fruitProf = [[0.001, 0], [0.08, 0], [0.15, 0.06], [0.145, 0.065], [0.077, 0.006], [0.001, 0.006]].map(([r, y]) => new THREE.Vector2(r, y));
  C.fruitBowl = item(new THREE.LatheGeometry(fruitProf, 24), mat(0x2a5bd7, { roughness: 0.3, side: THREE.DoubleSide }));
  C.fruitBowl.breaks = ['shardBlue', 'shardBlue', 'shardBlue', 'shardBlue'];

  // Plants in pots, on the counter across the back. They smash when they fall:
  // the pot breaks into shards, and the soil and the plant lie where they land.
  const potM = mat(0xffffff, { roughness: 0.85, side: THREE.DoubleSide });
  const terracotta = mat(0xc0643c, { roughness: 0.85, side: THREE.DoubleSide });
  const whitePot = mat(0xe9e4da, { roughness: 0.6, side: THREE.DoubleSide });
  const soilM = mat(0x4a3322, { roughness: 1 });
  const leafM = mat(0x3f8f3a, { roughness: 0.8 });
  const darkLeaf = mat(0x2f6b2a, { roughness: 0.8 });
  // an open pot with soil in it (its bottom 3 mm up, so it doesn't flicker against the counter)
  const pot = (r, h, m) => [
    [at(Cyl(r, r * 0.78, h, 14, true), 0, h / 2, 0), m],
    [new THREE.CircleGeometry(r * 0.78, 14).rotateX(Math.PI / 2).translate(0, 0.003, 0), m],
    [new THREE.CircleGeometry(r * 0.95, 14).rotateX(-Math.PI / 2).translate(0, h - 0.015, 0), soilM],
  ];
  /** A leaf: a flat ellipsoid `len` long, pointing out at angle `a`, tilted up by `up`, its base at height y. */
  const leaf = (len, wide, a, up, y, m = leafM, from = 0.02) => [
    Sph(len / 2, 1, 0.09, wide / len).translate(len / 2, 0, 0).rotateZ(up).rotateY(a).translate(Math.cos(a) * from, y, -Math.sin(a) * from),
    m,
  ];
  C.plantBig = parts([
    ...pot(0.1, 0.2, terracotta),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => leaf(0.24, 0.13, i * 0.9, 0.35 + (i % 3) * 0.3, 0.2 + (i % 4) * 0.06, i % 2 ? leafM : darkLeaf)),
    leaf(0.22, 0.12, 0.5, 1.25, 0.3, leafM, 0), leaf(0.2, 0.11, 3.6, 1.3, 0.28, darkLeaf, 0),
  ]);
  const cactusM = mat(0x5e9a4a, { roughness: 0.7 });
  C.plantCactus = parts([
    ...pot(0.055, 0.09, terracotta),
    [at(new THREE.CapsuleGeometry(0.035, 0.14, 4, 10), 0, 0.18, 0), cactusM],
    [at(new THREE.CapsuleGeometry(0.018, 0.05, 4, 8), 0.045, 0.2, 0, 0, 0, -0.5), cactusM],
    [at(new THREE.CapsuleGeometry(0.016, 0.04, 4, 8), -0.04, 0.23, 0, 0, 0, 0.5), cactusM],
  ]);
  const basilM = mat(0x6abf4b, { roughness: 0.8 });
  C.plantBasil = parts([
    ...pot(0.065, 0.1, terracotta),
    ...[[0, 0.16, 0, 0.05], [0.04, 0.14, 0.02, 0.04], [-0.035, 0.145, 0.025, 0.04], [0.01, 0.15, -0.04, 0.042], [-0.02, 0.19, -0.01, 0.038], [0.025, 0.19, 0.01, 0.035]]
      .map(([x, y, z, r]) => [at(Sph(r, 1, 0.8, 1), x, y, z), basilM]),
  ]);
  // a trailing plant in a white pot, its long stems spilling over the rim onto the counter
  C.plantPothos = parts([
    ...pot(0.07, 0.11, whitePot),
    [at(Sph(0.08, 1, 0.45, 1), 0, 0.12, 0), leafM],
    ...[0.3, 1.9, 3.4, 4.9].flatMap((a) => {
      const vine = new THREE.CatmullRomCurve3([[0.04, 0.13, 0], [0.09, 0.12, 0], [0.13, 0.07, 0], [0.16, 0.025, 0]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      return [
        [new THREE.TubeGeometry(vine, 8, 0.004, 5).rotateY(a), darkLeaf],
        ...[0.4, 0.7, 1].map((t) => {
          const p = vine.getPoint(t);
          return [Sph(0.018, 1, 0.3, 0.7).translate(p.x, p.y, 0.012).rotateY(a), leafM];
        }),
      ];
    }),
  ]);
  // an orchid: two broad leaves, and a curving stem of pink flowers
  const orchidPink = mat(0xe86fa0, { roughness: 0.6 });
  const stemM = mat(0x6b7d3a, { roughness: 0.7 });
  C.plantOrchid = parts([
    ...pot(0.055, 0.1, whitePot),
    leaf(0.16, 0.07, 0.4, 0.25, 0.1, darkLeaf, 0), leaf(0.15, 0.07, 3.5, 0.3, 0.1, darkLeaf, 0),
    [at(Cyl(0.003, 0.003, 0.3, 6), 0, 0.24, 0), stemM],
    ...[[0.02, 0.4], [0.055, 0.39], [0.085, 0.37], [0.11, 0.34], [0.13, 0.305]].map(([x, y]) => [at(Sph(0.022, 1, 1, 0.45), x, y, 0.004), orchidPink]),
  ]);
  // a glass vase of tulips
  const tulipHead = () => Cyl(0.022, 0.014, 0.05, 8);
  const tulipColors = [0xd8312a, 0xf6d04d, 0xf59a23, 0xe86fa0];
  C.tulips = parts([
    [Cyl(0.048, 0.042, 0.18, 14, true).translate(0, 0.09, 0), glassM],
    [new THREE.CircleGeometry(0.042, 14).rotateX(Math.PI / 2).translate(0, 0.003, 0), glassM],
    ...[0, 1, 2, 3, 4, 5, 6].flatMap((i) => {
      const a = i * 0.9;
      const lean = i ? 0.22 : 0;
      const L = 0.28 + (i % 3) * 0.025; // the stem's length
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(lean), Math.cos(lean), -Math.sin(a) * Math.sin(lean));
      const head = dir.clone().multiplyScalar(L + 0.02).add(new THREE.Vector3(0, 0.01, 0));
      return [
        [Cyl(0.0035, 0.0035, L, 5).translate(0, L / 2, 0).rotateZ(-lean).rotateY(a).translate(0, 0.01, 0), stemM],
        [tulipHead().rotateZ(-lean).rotateY(a).translate(head.x, head.y, head.z), mat(tulipColors[i % 4], { roughness: 0.5 })],
      ];
    }),
  ]);
  // what's left of them once they've smashed
  C.potPiece = item(flat([[0, 0], [0.06, 0.01], [0.05, 0.045], [0.008, 0.05]], 0.006), potM);
  C.potShard = tint('potPiece', 0xc0643c);
  C.potShardWhite = tint('potPiece', 0xe9e4da);
  C.soil = item(heap(0.06, 1, 0.3, 0.8, 3), mat(0x4a3322, { roughness: 1, flatShading: true }));
  C.leafTuft = item(heap(0.09, 1, 0.55, 0.9, 5), mat(0x3f8f3a, { roughness: 0.8, flatShading: true }));
  C.herbTuft = item(heap(0.05, 1, 0.6, 0.9, 8), mat(0x6abf4b, { roughness: 0.8, flatShading: true }));
  C.cactusBit = item(new THREE.CapsuleGeometry(0.035, 0.14, 4, 10).rotateZ(Math.PI / 2), cactusM);
  C.orchidFlower = item(Sph(0.022, 1, 0.45, 1), orchidPink);
  C.tulip = item(tulipHead().rotateZ(Math.PI / 2), mat(0xffffff, { roughness: 0.5 })); // a flower head, its stem snapped off
  C.tulipRed = tint('tulip', 0xd8312a);
  C.tulipYellow = tint('tulip', 0xf6d04d);
  C.tulipOrange = tint('tulip', 0xf59a23);
  C.plantBig.breaks = ['potShard', 'potShard', 'potShard', 'soil', 'leafTuft', 'leafTuft'];
  C.plantCactus.breaks = ['potShard', 'potShard', 'soil', 'cactusBit'];
  C.plantBasil.breaks = ['potShard', 'potShard', 'soil', 'herbTuft'];
  C.plantPothos.breaks = ['potShardWhite', 'potShardWhite', 'potShardWhite', 'soil', 'leafTuft'];
  C.plantOrchid.breaks = ['potShardWhite', 'potShardWhite', 'soil', 'orchidFlower', 'orchidFlower', 'orchidFlower'];
  C.tulips.breaks = ['shardGlass', 'shardGlass', 'shardGlass', 'tulipRed', 'tulipYellow', 'tulipOrange', 'tulipRed'];

  // the coffee machine on the counter under the hanging cupboard, its front (+x) to the kitchen
  const machineM = mat(0x26262b, { roughness: 0.35 });
  const chromeM = mat(0xc9ced3, { roughness: 0.25, metalness: 0.7 });
  C.coffeeMachine = parts([
    [at(Box(0.28, 0.025, 0.22), 0.01, 0.0125, 0), machineM], // the foot, with the drip tray
    [at(Box(0.16, 0.32, 0.22), -0.05, 0.185, 0), machineM], // the body, the water tank at the back
    [at(Box(0.13, 0.07, 0.2), 0.09, 0.305, 0), machineM], // the head, over the cup
    [at(Box(0.004, 0.05, 0.16), 0.157, 0.305, 0), chromeM], // its front panel
    [at(Cyl(0.012, 0.009, 0.03, 8), 0.1, 0.255, 0), chromeM], // the spout
    [at(Box(0.1, 0.006, 0.16), 0.08, 0.028, 0), chromeM], // the drip grid
    [at(Cyl(0.012, 0.012, 0.004, 10), 0.1605, 0.32, 0.05, 0, 0, Math.PI / 2), mat(0x3fae3a, { emissive: 0x1d5a1a })], // the "on" light, standing out of the panel
  ]);
  const pizzaLid = canvasTexture(128, 128, (g) => { g.fillStyle = '#d9b48a'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(120,70,20,0.35)'; g.beginPath(); g.ellipse(84, 80, 22, 15, 0.5, 0, TAU); g.fill(); g.fillStyle = '#c0392b'; circle(g, 64, 54, 28); g.fill(); label(g, 'PIZZA', 64, 56, 48, 18, '#ffffff'); label(g, 'LEKKER WARM!', 64, 104, 100, 14, '#c0392b'); });
  C.pizzaBox = { w: 0.33, h: 0.04, d: 0.33, look: () => { const b = mat(0xd9b48a); return { geo: Box(0.33, 0.04, 0.33), material: [b, b, texMat(pizzaLid), b, b, b] }; } };
  C.afwas = { shape: 'bottle', r: 0.04, h: 0.24, body: '#3fae3a', cap: '#ffffff', face: { bg: '#ffffff', fg: '#2e8b57', text: 'AFWAS' } };
  C.allesreiniger = { shape: 'bottle', r: 0.045, h: 0.26, body: '#f6d04d', cap: '#d8312a', face: { bg: '#d8312a', text: 'SCHOON!' } };
  C.shampoo = { shape: 'bottle', r: 0.035, h: 0.2, body: '#e86fa0', cap: '#ffffff', face: { bg: '#ffffff', fg: '#e86fa0', text: 'SHAMPOO' } };
  C.douchegel = { shape: 'bottle', r: 0.035, h: 0.2, body: '#7fbbe8', cap: '#2a5bd7', face: { bg: '#2a5bd7', text: 'DOUCHE' } };
  C.tandpasta = { shape: 'box', w: 0.18, h: 0.035, d: 0.045, face: { bg: '#ffffff', band: '#d8312a', text: 'TANDPASTA' } };
  C.waspoeder = { shape: 'box', w: 0.2, h: 0.26, d: 0.12, face: { bg: '#f59a23', band: '#1d4f9a', text: 'WASPOEDER', sub: 'extra wit' } };
  const roll = canvasTexture(64, 64, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c9a77a'; circle(g, 32, 32, 13); g.fill(); g.fillStyle = '#6a5a4a'; circle(g, 32, 32, 9); g.fill(); });
  C.wcRol = { r: 0.055, h: 0.1, look: () => { const end = texMat(roll); return { geo: Cyl(0.055, 0.055, 0.1, 16), material: [mat(0xffffff, { roughness: 0.9 }), end, end] }; } };
  const tape = canvasTexture(128, 128, (g) => { g.fillStyle = '#c9a06a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#d9b884'; g.fillRect(54, 0, 20, 128); g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126); label(g, 'ZOLDER', 64, 34, 90, 22, '#2b2b2b'); });
  C.doos = { w: 0.45, h: 0.32, d: 0.35, look: () => { const b = mat(0xc9a06a, { roughness: 0.9 }); return { geo: Box(0.45, 0.32, 0.35), material: [b, b, texMat(tape), b, b, b] }; } };
  C.emmer = parts([[Cyl(0.13, 0.1, 0.24, 16, true), mat(0x2a5bd7, { roughness: 0.4, side: THREE.DoubleSide })], [new THREE.CircleGeometry(0.1, 16).rotateX(Math.PI / 2).translate(0, -0.12, 0), mat(0x2a5bd7)]]);

  // clothes
  const cloth = (c) => mat(c, { roughness: 1 });
  const shirtOutline = [[-0.22, -0.31], [0.22, -0.31], [0.22, 0.1], [0.38, 0.15], [0.32, 0.3], [0.14, 0.32], [0.07, 0.32], [0, 0.26], [-0.07, 0.32], [-0.14, 0.32], [-0.32, 0.3], [-0.38, 0.15], [-0.22, 0.1]];
  const shirt = (c, s = 1) => item(flat(shirtOutline.map(([x, y]) => [x * s, y * s]), 0.014), cloth(c));
  C.shirt = shirt(0xffffff);
  C.shirtRed = tint('shirt', 0xc0392b);
  C.shirtBlue = tint('shirt', 0x2a5bd7);
  C.shirtWhite = tint('shirt', 0xf4f2ee);
  C.shirtGreen = tint('shirt', 0x2e8b57);
  C.kidShirt = shirt(0xffffff, 0.6);
  C.shirtKid = tint('kidShirt', 0xf6d04d);
  C.shirtKidPink = tint('kidShirt', 0xf2a2b8);
  C.jeans = item(flat([[-0.2, 0.5], [0.2, 0.5], [0.25, -0.5], [0.04, -0.5], [0, 0.12], [-0.04, -0.5], [-0.25, -0.5]], 0.018), cloth(0x3a5a8c));
  C.jeansKid = item(flat([[-0.2, 0.5], [0.2, 0.5], [0.25, -0.5], [0.04, -0.5], [0, 0.12], [-0.04, -0.5], [-0.25, -0.5]].map(([x, y]) => [x * 0.6, y * 0.6]), 0.016), cloth(0x8e44ad));
  const sock = [[-0.03, 0.12], [0.03, 0.12], [0.03, 0], [0.11, -0.02], [0.11, -0.07], [-0.03, -0.07]];
  C.sock = item(flat(sock, 0.012), cloth(0xffffff));
  C.sockWhite = tint('sock', 0xf4f2ee);
  C.sockBlack = tint('sock', 0x2a2a2a);
  C.sockRed = tint('sock', 0xd8312a);
  const pants = [[-0.15, 0.1], [0.15, 0.1], [0.12, -0.02], [0.04, -0.1], [-0.04, -0.1], [-0.12, -0.02]];
  C.pants = item(flat(pants, 0.012), cloth(0xffffff));
  C.underpants = tint('pants', 0xf4f2ee);
  C.boxers = tint('pants', 0x3fae3a);
  const crumpled = mat(0xffffff, { roughness: 1, flatShading: true });
  C.heap = item(heap(0.2, 1, 0.38, 0.8, 1), crumpled);
  C.heapGrey = tint('heap', 0x8a8f99);
  C.heapRed = tint('heap', 0xa83232);
  C.heapBlue = tint('heap', 0x2a4f8a);
  C.towel = item(heap(0.22, 1, 0.3, 0.7, 4), crumpled);
  C.towelWhite = tint('towel', 0xf4f2ee);
  C.towelBlue = tint('towel', 0x7fbbe8);
  C.blanket = item(heap(0.35, 1, 0.3, 0.7, 6), mat(0xd95d39, { roughness: 1, flatShading: true }));
  const shoe = (upper, sole) => parts([[at(Box(0.28, 0.025, 0.1), 0, 0.0125, 0), mat(sole)], [at(Box(0.2, 0.07, 0.09), -0.03, 0.06, 0), mat(upper, { roughness: 0.8 })], [at(Sph(0.045, 1.2, 0.7, 1), 0.07, 0.035, 0), mat(upper, { roughness: 0.8 })]]);
  C.sneaker = shoe(0xf4f2ee, 0x2a5bd7);
  C.shoeBlack = shoe(0x2b2522, 0x1b1b1b);
  C.slipper = shoe(0xe86fa0, 0xf4f2ee);
  C.shoeBrown = shoe(0x7a4a2a, 0x2b2522);
  // rubber boots (laarzen), standing up: a sole, the foot, the toe and the tall shaft; `s` scales a kid's pair
  const boot = (color, s = 1) => {
    const rubber = mat(color, { roughness: 0.45 });
    return parts([
      [at(Box(0.28 * s, 0.03 * s, 0.1 * s), 0, 0.015 * s, 0), mat(0x2b2b2b, { roughness: 0.8 })],
      [at(Box(0.2 * s, 0.08 * s, 0.09 * s), 0, 0.07 * s, 0), rubber],
      [at(Sph(0.045 * s, 1.3, 0.8, 1), 0.08 * s, 0.045 * s, 0), rubber],
      [at(Cyl(0.06 * s, 0.055 * s, 0.3 * s, 14), -0.06 * s, 0.24 * s, 0), rubber],
      [at(Cyl(0.064 * s, 0.064 * s, 0.025 * s, 14), -0.06 * s, 0.38 * s, 0), mat(0x2b2b2b, { roughness: 0.6 })],
    ]);
  };
  C.bootYellow = boot(0xf2c14e);
  C.bootGreen = boot(0x2f6b3a);
  C.bootBlack = boot(0x2b2b2b);
  C.bootRed = boot(0xd8312a, 0.7);
  C.bootBlue = boot(0x5d8fb3, 0.7);
  // the garage: camping gear, boxes of junk, paint and tools
  const cardboard = (text, w, h, d) => {
    const lid = canvasTexture(128, 128, (g) => { g.fillStyle = '#c9a06a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#d9b884'; g.fillRect(54, 0, 20, 128); g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126); });
    const side = canvasTexture(128, 96, (g) => { g.fillStyle = '#c9a06a'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#b08a55'; g.fillRect(0, 0, 128, 6); label(g, text, 64, 52, 104, 30, '#2b2b2b'); });
    return { w, h, d, look: () => { const b = mat(0xc9a06a, { roughness: 0.9 }); const s = texMat(side, { roughness: 0.9 }); return { geo: Box(w, h, d), material: [s, s, texMat(lid, { roughness: 0.9 }), b, s, s] }; } };
  };
  C.doosKerst = cardboard('KERST', 0.42, 0.3, 0.34);
  C.doosLego = cardboard('LEGO', 0.34, 0.24, 0.3);
  C.doosBoeken = cardboard('BOEKEN', 0.38, 0.26, 0.3);
  C.doosDiversen = cardboard('DIVERSEN', 0.46, 0.34, 0.36);
  C.doosBaby = cardboard('BABYSPUL', 0.4, 0.28, 0.32);
  C.coolBox = parts([[at(Box(0.38, 0.34, 0.56), 0, -0.03, 0), plastic(0x2f6fb5)], [at(Box(0.4, 0.06, 0.58), 0, 0.17, 0), plastic(0xf2f2ee)]]);
  C.campCrate = parts([[Box(0.36, 0.3, 0.68), plastic(0x6b7d5a)], ...[-0.2, 0, 0.2].map((z) => [at(Cyl(0.012, 0.012, 0.18, 6), 0.05 * Math.sign(z + 0.01), 0.2, z, 0.2), mat(0x9aa3ad, { metalness: 0.5, roughness: 0.4 })])]);
  C.campChair = parts([[Box(0.3, 0.36, 0.08), cloth(0xd95d39)], [at(Cyl(0.01, 0.01, 0.4, 6), -0.12, 0, 0.05), mat(0x9aa3ad)], [at(Cyl(0.01, 0.01, 0.4, 6), 0.12, 0, 0.05), mat(0x9aa3ad)]]);
  C.tentBag = item(Cyl(0.11, 0.11, 0.62, 12).rotateX(Math.PI / 2), cloth(0x3f4a3a));
  C.sleepingBag = item(Cyl(0.13, 0.13, 0.4, 14).rotateZ(Math.PI / 2), cloth(0xffffff));
  C.sleepingBagGreen = tint('sleepingBag', 0x2f8a5b);
  C.sleepingBagRed = tint('sleepingBag', 0xd95d39);
  C.sleepingBagBlue = tint('sleepingBag', 0x5d8fb3);
  C.sleepingBagDark = tint('sleepingBag', 0x3f4a3a);
  C.sleepingBagYellow = tint('sleepingBag', 0xf2c14e);
  C.lantern = parts([[Cyl(0.06, 0.07, 0.04, 12), mat(0x2b2b2b)], [at(Cyl(0.05, 0.05, 0.12, 12), 0, 0.08, 0), mat(0xfff3c4, { emissive: 0x5a4a20 })], [at(Cyl(0.06, 0.05, 0.03, 12), 0, 0.155, 0), mat(0x2b2b2b)], [at(new THREE.TorusGeometry(0.04, 0.005, 4, 12, Math.PI), 0, 0.17, 0), mat(0x2b2b2b)]]);
  C.gasCan = parts([[Cyl(0.05, 0.05, 0.11, 14), mat(0x2f6fb5, { roughness: 0.4 })], [at(Cyl(0.015, 0.02, 0.025, 8), 0, 0.068, 0), mat(0x9aa3ad, { metalness: 0.5 })]]);
  C.toolbox = parts([[Box(0.42, 0.2, 0.22), plastic(0xc4352f)], [at(Box(0.42, 0.012, 0.225), 0, 0.03, 0), plastic(0x2b2b2b)], [at(Box(0.2, 0.025, 0.03), 0, 0.12, 0), plastic(0x2b2b2b)]]);
  C.tub = item(Box(0.38, 0.2, 0.44), plastic(0x6f8fa8));
  C.seeds = cardboard('ZADEN', 0.26, 0.12, 0.22);
  C.bottleCrate = parts([[Box(0.4, 0.3, 0.3), plastic(0xd8312a)], ...[0, 1, 2, 3, 4, 5].map((i) => [at(Cyl(0.012, 0.016, 0.06, 8), -0.13 + (i % 3) * 0.13, 0.18, i < 3 ? -0.07 : 0.07), mat(0x5a3a1c, { roughness: 0.2 })])]);
  const tin = (band) => parts([[Cyl(0.085, 0.085, 0.19, 18), mat(0xb8bec4, { metalness: 0.6, roughness: 0.35 })], [Cyl(0.087, 0.087, 0.11, 18), mat(band, { roughness: 0.5 })]]);
  C.paintWhite = tin(0xf4f2ee);
  C.paintBlue = tin(0x2f6fb5);
  C.paintGreen = tin(0x2f8a5b);
  C.screwTin = parts([[Cyl(0.05, 0.05, 0.08, 14), mat(0x9aa3ad, { metalness: 0.6, roughness: 0.35 })], [at(Cyl(0.051, 0.051, 0.015, 14), 0, 0.04, 0), plastic(0xf2c14e)]]);
  // the tools hang on the pegboard, flat against it and handle down
  const toolSteel = mat(0x9aa3ad, { metalness: 0.6, roughness: 0.35 });
  C.hammer = parts([[Cyl(0.014, 0.014, 0.3, 8), mat(0xd95d39)], [at(Box(0.13, 0.03, 0.03), 0.01, 0.16, 0), mat(0x55595f, { metalness: 0.5 })]]);
  C.saw = parts([[at(Box(0.1, 0.4, 0.005), 0.01, -0.07, 0), toolSteel], [at(Box(0.11, 0.12, 0.025), 0, 0.19, 0), mat(0x4a3020)]]);
  C.drill = parts([[Box(0.22, 0.07, 0.06), plastic(0xf2c14e)], [at(Box(0.05, 0.16, 0.05), -0.04, -0.1, 0), plastic(0x2b2b2b)], [at(Cyl(0.015, 0.02, 0.06, 8), 0.14, 0, 0, 0, 0, Math.PI / 2), toolSteel]]);
  const screwdriver = (c) => parts([[at(Cyl(0.014, 0.016, 0.1, 8), 0, 0.075, 0), plastic(c)], [at(Cyl(0.003, 0.003, 0.15, 6), 0, -0.05, 0), toolSteel]]);
  C.screwdriverRed = screwdriver(0xd95d39);
  C.screwdriverYellow = screwdriver(0xf2c14e);
  C.screwdriverBlue = screwdriver(0x2f6fb5);
  C.screwdriverGreen = screwdriver(0x2f8a5b);
  C.spanner = parts([[Box(0.025, 0.24, 0.006), toolSteel], [at(new THREE.TorusGeometry(0.022, 0.007, 6, 12), 0, 0.13, 0), toolSteel], [at(new THREE.TorusGeometry(0.018, 0.006, 6, 12), 0, -0.13, 0), toolSteel]]);

  // tiny things cast no shadows (there are hundreds of them)
  for (const [id, p] of Object.entries(C)) {
    if (PRODUCTS[id] || p.base) continue;
    const [hx, hy, hz] = halfSize(p);
    if (Math.max(hx, hy, hz) < 0.06) p.shadow = false;
  }
  return C;
}

// ---------------------------------------------------------------- building it all
export function buildClutter({ box, body, groups, std, physMats, H, garage }) {
  const C = buildCatalogue();
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const entry = (id) => C[C[id].base ?? id];
  const half = (id) => halfSize(entry(id));
  const _q = new THREE.Quaternion();
  const ALONG_X = new THREE.Vector3(1, 0, 0);
  const ALONG_Z = new THREE.Vector3(0, 0, 1);
  /** Lying on its side: a bottle or can tipped over. */
  const tipped = (id) => ({ tilt: _q.clone().setFromAxisAngle(ALONG_Z, Math.PI / 2), lift: half(id)[0] });
  /** Lying on its face: a bag of chips or a pizza box flat on the ground. */
  const onFace = (id) => ({ tilt: _q.clone().setFromAxisAngle(ALONG_X, -Math.PI / 2), lift: half(id)[2] });

  // Furniture tops things land on (y = their top, from the floor of their storey).
  const TOPS = [
    [0, -3.875, -2.95, -4.75, -2.41, 0.5], // TV cabinet
    [0, -1.55, -0.6, -0.75, -0.35, 0.55], // low cabinet behind the couch
    [0, -2.8, -0.85, -1.55, -1.12, 0.52], // couch seat
    [0, -3.62, -2.9, -2.35, -1.15, 0.52], // the couch's chaise end
    [0, 1.9, 3.0, -2.2, -0.3, 0.78], // dining table
    [0, 2.17, 3.87, 0.55, 1.12, 1.25], // piano
    [0, 0.92, 3.875, 1.135, 1.45, 1.25], // the bar behind it
    [0, 3.62, 3.87, 1.15, 1.435, 1.67], // the cabinet of drawers on it
    [0, TOY_CABINET.x0, TOY_CABINET.x1, TOY_CABINET.z0, TOY_CABINET.z1, TOY_CABINET.top], // the toy cabinet beside it
    [0, -0.31, 3.875, 4.2, 4.875, 0.9], // kitchen counter along the front
    [0, 3.2, 3.875, 2.01, 4.2, 0.9], // ... along the right wall
    [0, 0.93, 3.875, 1.43, 2.01, 0.9], // ... and across the back
    [0, 3.15, 3.875, -5.85, -5.125, 1.95], // fridge
    [0, 3.05, 3.855, -9.5, -8.2, 0.85], // the garage table
    [1, -2.67, -0.59, 0.6, 2.4, 0.61], // bed
    [1, -2.74, -2.29, 2.55, 3.0, 0.5], // nightstand
    [1, -0.1, 0.49, 2.6, 4.4, 2.0], // wardrobe
    [1, -2.65, -2.21, 4.18, 4.62, 0.46], // clothes chair
    [1, 2.0, 3.875, -2.25, -1.2, 0.52], // kids bed
    [1, 1.2, 2.2, 4.2, 4.85, 0.5], // toy box
    [2, -3.875, -3.1, -1.6, 0.2, 0.76], // desk
    [2, -1.58, 0.47, 2.2, 3.1, 0.45], // armchair
    [2, 3.0, 3.875, 0.2, 1.4, 0.85], // bathroom cabinet
    [2, 3.25, 3.875, -0.75, -0.15, 0.85], // washing machine
  ];
  const stocks = [0, 1, 2].map((k) => createStock(groups[k], {
    bounds: ROOMS.living,
    floorY: k * H + 0.012,
    catalogue: C,
    tables: TOPS.filter((t) => t[0] === k).map(([, x0, x1, z0, z1, y]) => ({ x0, x1, z0, z1, y: k * H + y, floor: k * H })),
  }));
  const sections = [[], [], []];
  const rooms = {};
  for (const [name, r] of Object.entries(ROOMS)) {
    rooms[name] = stocks[r.k].section({ bounds: r, floorY: r.k * H + 0.012, k: r.k, name });
    sections[r.k].push(rooms[name]);
  }

  /**
   * Puts something in a room: (x, z), y above that floor; yaw random unless given.
   * Low heights (on the floor, or stacked on something on the floor) count
   * from the top of the floorboards and rugs, which lie FLOOR above the
   * storey's base: otherwise flat things like clothes sink into them and flicker.
   * Thin things are lifted a mm or a few, to a height no flat thing they
   * overlap has, so two shirts lying across each other never share one
   * surface (products.js does the same when they land after a toss).
   */
  const FLOOR = 0.012;
  function put(room, id, x, y, z, { yaw = rnd() * TAU, ...opts } = {}) {
    const sec = rooms[room];
    if (y < 0.35) y += FLOOR;
    if (!opts.on && !opts.inside && Math.min(...half(id)) < 0.012) opts.layer = 'free';
    return breakable(stocks[sec.k].place(id, x, sec.k * H + y, z, yaw, sec, 0, opts), id, sec);
  }
  /** Gives a plate, bowl, mug or glass the shards it smashes into. */
  function breakable(item, id, sec) {
    for (const s of C[id].breaks ?? []) stocks[sec.k].place(s, 0, 0, 0, 0, sec, 0, { shardOf: item });
    return item;
  }
  /** A pile of the same thing (plates, books), each resting on the one below. */
  function pile(room, id, x, y, z, n, { yaw = rnd() * TAU, jitter = 0.012, on = null } = {}) {
    const h = 2 * half(id)[1];
    let below = on;
    for (let i = 0; i < n; i++) below = put(room, id, x + (rnd() - 0.5) * jitter, y + i * h, z + (rnd() - 0.5) * jitter, { yaw: yaw + (rnd() - 0.5) * 0.3, on: below });
    return below;
  }
  /**
   * Things strewn over the floor of a room, clear of its furniture and of
   * each other: two toys of one height lying into each other share a top
   * face, which flickers.
   */
  const strewn = [];
  function strew(room, ids, n, { area = null, how = null } = {}) {
    const r = area ?? ROOMS[room];
    const k = ROOMS[room].k;
    const avoid = FURNITURE[room] ?? [];
    for (let i = 0; i < n; i++) {
      const id = ids[Math.floor(rnd() * ids.length)];
      const size = Math.max(...half(id));
      const reach = size + 0.05;
      for (let tries = 0; tries < 25; tries++) {
        const x = r.x0 + reach + rnd() * (r.x1 - r.x0 - 2 * reach);
        const z = r.z0 + reach + rnd() * (r.z1 - r.z0 - 2 * reach);
        if (avoid.some(([x0, x1, z0, z1]) => x > x0 - reach && x < x1 + reach && z > z0 - reach && z < z1 + reach)) continue;
        if (strewn.some((s) => s.k === k && Math.hypot(s.x - x, s.z - z) < s.size + size + 0.01)) continue;
        strewn.push({ k, x, z, size });
        put(room, id, x, 0, z, how?.(id) ?? {});
        break;
      }
    }
  }
  const lying = (id) => (/^(cola|sinas|water|limo|icetea|afwas|allesreiniger|shampoo|douchegel|crayon|mikado|wcRol)/.test(id) && rnd() < 0.7 ? tipped(id) : {});

  // ---------------------------------------------------------------- living room
  const living = 'living';
  // the low cabinet behind the couch: snacks, drinks and the remote
  // (the snacks lie with their long side along the cabinet, which is only 0.95 m long)
  put(living, 'chipsPaprika', -1.4, 0.55, -0.55, { yaw: 1.5, ...onFace('chipsPaprika') });
  put(living, 'magazine', -1.1, 0.55, -0.55, { yaw: 1.4 });
  put(living, 'magazine', -1.08, 0.556, -0.56, { yaw: 1.7 });
  put(living, 'remote', -0.9, 0.55, -0.55, { yaw: 0.1 });
  put(living, 'mugBlue', -0.78, 0.55, -0.66);
  put(living, 'mugRed', -0.78, 0.55, -0.44);
  put(living, 'cola', -0.67, 0.55, -0.53, { yaw: 1.5, ...tipped('cola') });
  // the TV cabinet: the game console in its dock beside the TV, facing the couch,
  // and further along, by the couch, two controllers and a game case
  put(living, 'gameConsole', -3.5, 0.502, -3.02, { yaw: Math.atan2(0.8, 0.6) });
  put(living, 'controller', -3.15, 0.5, -2.75, { yaw: 1.4 });
  put(living, 'controller', -3.6, 0.5, -2.62, { yaw: 2.0 });
  put(living, 'gameCaseB', -3.3, 0.5, -2.52, { yaw: 1.3 });
  // the couch: a blanket, a cushion on the floor, crisps, a plate on the arm of the comfy chair's side
  put(living, 'blanket', -3.25, 0.52, -1.9, { yaw: 0.3 });
  put(living, 'cushion', -2.4, 0, -2.6, { yaw: 0.6 });
  put(living, 'chipsNaturel', -1.95, 0.52, -1.3, { yaw: 1.2, ...onFace('chipsNaturel') });
  put(living, 'plateC', -2.42, 0.52, -1.35);
  // the piano: sheet music and a forgotten mug
  put(living, 'paper', 2.62, 1.25, 0.85, { yaw: 0.1 });
  put(living, 'mugWhite', 3.57, 1.25, 0.8);
  // on top of the toy cabinet beside it
  put(living, 'puzzleCube', 1.58, TOY_CABINET.top, 0.87, { yaw: 0.4 });
  put(living, 'gameCaseA', 1.88, TOY_CABINET.top, 0.93, { yaw: 0.2 });
  // the kids' stuff (they're 10 and 13), not too much of it: comics, game cases,
  // trading cards, foam darts and a few Lego bricks, more of it in front of the TV
  const kidStuff = ['comicA', 'comicB', 'gameCaseA', 'gameCaseB', 'cardMonster', 'cardMonster', 'dart', 'dart', 'dart', 'legoRed', 'legoBlue', 'legoYellow', 'puzzleCube'];
  strew(living, kidStuff, 14, { how: lying });
  strew(living, ['gameCaseA', 'gameCaseB', 'cardMonster', 'dart', 'comicA', 'legoGreen'], 6, { area: { x0: -2.75, x1: -0.95, z0: -3.9, z1: -1.75 }, how: lying });
  put(living, 'blaster', -1.6, 0, -4.25, { yaw: 0.4, ...onFace('blaster') });
  put(living, 'headphones', -1.3, 0.52, -1.35, { yaw: 0.5 }); // on the couch
  // a pile of comics somebody was reading
  let below = null;
  ['comicB', 'comicA', 'comicB', 'comicA'].forEach((id, i) => (below = put(living, id, 0.3, i * 0.006, -2.05, { yaw: 0.2 + 0.25 * i, on: below })));
  put(living, 'sockRed', -0.3, 0, 0.3);

  // ---------------------------------------------------------------- hallway
  // shoes kicked off by the front door, and a pair of socks
  const hall = 'hall';
  put(hall, 'sneaker', -1.1, 0, 3.9, { yaw: 1.3 });
  put(hall, 'sneaker', -0.7, 0, 3.6, { yaw: 2.4 });
  put(hall, 'shoeBlack', -2.35, 0, 2.45, { yaw: -0.4 }); // under the coat rack
  put(hall, 'shoeBlack', -2.1, 0, 2.55, { yaw: 0.5 });
  put(hall, 'sockBlack', -2.45, 0, 2.2);
  put(hall, 'ball', -1.17, 0, 1.8);

  // ---------------------------------------------------------------- kitchen
  const kitchen = 'kitchen';
  // the counters: piles of dirty dishes, pans, bottles and jars
  // the coffee machine, at the left end of the counter under the hanging cupboard, a mug under its spout
  const coffee = put(kitchen, 'coffeeMachine', 3.62, 0.9, 2.12, { yaw: Math.PI });
  put(kitchen, 'mugWhite', 3.52, 0.931, 2.12, { on: coffee });
  pile(kitchen, 'plate', 3.55, 0.9, 2.5, 6);
  pile(kitchen, 'plateB', 3.55, 0.9, 2.82, 4);
  pile(kitchen, 'bowl', 3.5, 0.9, 3.2, 3, { jitter: 0.02 });
  put(kitchen, 'pot', 0.0, 0.912, 4.43); // on the hob
  put(kitchen, 'pan', 0.4, 0.912, 4.67, { yaw: Math.PI + 0.3 });
  put(kitchen, 'mugBlue', 3.5, 0.9, 3.7);
  put(kitchen, 'cutlery', 3.55, 0.9, 3.95);
  // The washing-up nobody has done, heaped on the counter either side of the
  // sink and in it: towers of dirty plates with bowls, mugs and glasses on
  // top, more mugs and glasses in between. Lennie landing in it smashes the lot (products.js).
  {
    const Y = 0.9;
    /** A pile of plates with something on top. */
    const tower = (id, x, z, n, top = null, topN = 1, y0 = Y) => {
      const below = pile(kitchen, id, x, y0, z, n);
      if (!top) return;
      const y = y0 + n * 2 * half(id)[1];
      pile(kitchen, top, x + (rnd() - 0.5) * 0.03, y, z + (rnd() - 0.5) * 0.03, topN, { jitter: 0.01, on: below });
    };
    // right of the sink, into the corner with the counter along the right wall
    tower('plate', 2.35, 4.36, 7, 'bowl', 2);
    tower('plateB', 2.37, 4.63, 5, 'mugRed');
    tower('plateC', 2.62, 4.37, 9, 'glass');
    tower('plate', 2.64, 4.64, 4, 'bowl', 3);
    tower('plateB', 2.89, 4.38, 6, 'mugYellow');
    pile(kitchen, 'bowl', 2.9, Y, 4.63, 4, { jitter: 0.015 });
    tower('plateC', 3.15, 4.4, 3);
    put(kitchen, 'pot', 3.16, Y, 4.7);
    for (const [id, x, z] of [['mugBlue', 3.37, 4.33], ['mugWhite', 3.4, 4.5], ['glass', 3.37, 4.7], ['mugRed', 3.56, 4.4], ['glass', 3.6, 4.58], ['mugYellow', 3.76, 4.36]]) put(kitchen, id, x, Y, z);
    for (const [x, z, yaw] of [[3.1, 4.24, 0.2], [3.65, 4.75, 1.4], [3.75, 4.55, 2.6]]) put(kitchen, 'cutlery', x, Y, z, { yaw });
    put(kitchen, 'afwas', 2.26, Y, 4.82);
    // in the sink, on its bottom (just above it, which is above the worktop)
    const SINK = 0.909;
    tower('plateB', 1.78, 4.46, 3, 'mugBlue', 1, SINK);
    put(kitchen, 'bowl', 2.0, SINK, 4.62);
    // left of the sink, up to the hob
    tower('plate', 1.45, 4.4, 5, 'bowl');
    tower('plateC', 1.43, 4.66, 4, 'mugWhite');
    pile(kitchen, 'bowl', 1.2, Y, 4.42, 3, { jitter: 0.015 });
    for (const [id, x, z] of [['glass', 1.17, 4.62], ['mugRed', 1.0, 4.4], ['glass', 0.98, 4.66], ['mugYellow', 0.8, 4.5]]) put(kitchen, id, x, Y, z);
    put(kitchen, 'allesreiniger', 1.18, Y, 4.8);
    for (const [x, z, yaw] of [[0.95, 4.27, 0.3], [0.75, 4.3, 2.0]]) put(kitchen, 'cutlery', x, Y, z, { yaw });
  }
  // The bar between the living room and the kitchen (house.js) is full of
  // plants and tulips, with the fruit bowl; the counter behind it has the
  // breakfast things and the dishes. The plants' pots, the vase and the
  // fruit bowl smash when they fall (products.js).
  {
    const BAR = 1.25;
    for (const [id, x, z] of [['plantBig', 1.3, 1.3], ['tulips', 1.68, 1.28], ['plantOrchid', 2.25, 1.28], ['plantCactus', 3.0, 1.27], ['plantBasil', 3.27, 1.3]]) put(kitchen, id, x, BAR, z);
    put(kitchen, 'plantPothos', 3.75, BAR + 0.42, 1.29); // on the little cabinet of drawers at the end of the bar (house.js)
    put(kitchen, 'magazine', 1.97, BAR, 1.3, { yaw: 1.45 });
    const fruit = put(kitchen, 'fruitBowl', 2.62, BAR, 1.29);
    for (const [id, dx, dz, dy] of [['appel', -0.08, -0.04, 0.006], ['sinaasappel', 0.08, -0.03, 0.006], ['peer', 0, 0.08, 0.006], ['citroen', 0.0, -0.01, 0.1]]) put(kitchen, id, 2.62 + dx, BAR + dy, 1.29 + dz, { on: fruit });
    const Y = 0.9;
    pile(kitchen, 'plateC', 1.2, Y, 1.68, 5);
    put(kitchen, 'glass', 1.45, Y, 1.72);
    put(kitchen, 'witbrood', 1.72, Y, 1.66, { yaw: -Math.PI / 2 });
    put(kitchen, 'melk', 1.98, Y, 1.7);
    put(kitchen, 'pindakaas', 2.17, Y, 1.66);
    put(kitchen, 'hagelslag', 2.36, Y, 1.7, { yaw: -Math.PI / 2 });
    put(kitchen, 'mugWhite', 2.62, Y, 1.7);
    for (const [x, z, yaw] of [[2.82, 1.72, 0.3], [2.97, 1.6, 1.2]]) put(kitchen, 'cutlery', x, Y, z, { yaw });
    put(kitchen, 'koffiepads', 3.25, Y, 1.66, { yaw: 0.2 });
    put(kitchen, 'snoepmix', 3.52, Y, 1.66, { yaw: 1.4, ...onFace('snoepmix') });
    put(kitchen, 'phone', 3.75, Y, 1.62, { yaw: 0.3 });
  }
  // the floor
  put(kitchen, 'pizzaBox', 1.15, 0, 3.4, { yaw: 0.3 });
  put(kitchen, 'pizzaBox', 1.19, 0.04, 3.38, { yaw: 0.6 });
  put(kitchen, 'plateB', 2.75, 0, 2.4);
  strew(kitchen, ['limo', 'icetea', 'cola', 'sockWhite', 'chipsNaturel', 'cutlery', 'krentenbol', 'mugBlue', 'drop', 'snoepmix'], 14, {
    how: (id) => (id.startsWith('chips') || id === 'drop' || id === 'snoepmix' ? onFace(id) : lying(id)),
  });

  // ---------------------------------------------------------------- dining table (in the living room)
  // breakfast nobody cleared away
  for (const [id, x, z] of [['plate', 2.15, -1.85], ['plateB', 2.75, -0.65], ['plateC', 2.75, -1.85], ['bowl', 2.15, -0.65]]) put(living, id, x, 0.78, z);
  put(living, 'glass', 2.4, 0.78, -1.3);
  put(living, 'mugWhite', 2.6, 0.78, -1.0);
  put(living, 'glass', 2.2, 0.78, -1.1, tipped('glass'));
  put(living, 'jam', 2.45, 0.78, -1.6);
  put(living, 'krentenbol', 2.65, 0.78, -0.4, { yaw: 0.4 });
  put(living, 'chocomelk', 2.25, 0.78, -1.45, tipped('chocomelk'));
  for (const [x, z] of [[2.05, -1.95], [2.85, -0.8], [2.05, -0.5], [2.8, -1.7]]) put(living, 'cutlery', x, 0.78, z);

  // ---------------------------------------------------------------- utility room
  const utility = 'utility';
  put(utility, 'stroopwafels', 3.4, 1.95, -5.5); // on top of the fridge
  put(utility, 'chocolade', 3.6, 1.95, -5.35, { yaw: 0.6 });
  put(utility, 'waspoeder', 1.08, 0, -6.45, { yaw: 0.2 });
  pile(utility, 'wcRol', 3.7, 0, -6.3, 3, { jitter: 0.01 });
  // the family's boots in a row under the clothes rack, the kids' small ones at the end
  for (const [id, x, z, yaw] of [
    ['bootGreen', 2.45, -6.3, 1.62], ['bootGreen', 2.58, -6.28, 1.5], ['bootYellow', 2.77, -6.3, 1.58], ['bootYellow', 2.9, -6.32, 1.66],
    ['bootRed', 3.1, -6.3, 1.55], ['bootRed', 3.2, -6.28, 1.6], ['bootBlue', 3.35, -6.3, 1.7],
  ]) put(utility, id, x, 0, z, { yaw });
  // one blue boot fell over, and the shoes are kicked off all over the floor,
  // most of them just inside the door from the living room
  put(utility, 'bootBlue', 2.55, 0, -5.88, { yaw: 0.4, ...tipped('bootBlue') });
  put(utility, 'bootBlack', 2.0, 0, -5.8, { yaw: 2.2 });
  put(utility, 'bootBlack', 1.85, 0, -5.4, { yaw: 0.3, ...tipped('bootBlack') });
  for (const [id, x, z, yaw] of [['sneaker', 1.45, -5.45, 1.1], ['sneaker', 1.65, -5.78, 2.6], ['shoeBrown', 1.2, -5.75, 0.5], ['shoeBrown', 1.05, -5.4, 1.9], ['slipper', 2.95, -5.85, 0.8]]) put(utility, id, x, 0, z, { yaw });
  strew(utility, ['sockWhite', 'sockBlack', 'heapGrey', 'cola', 'limo'], 5, { how: lying });

  // ---------------------------------------------------------------- garage
  // Everything on its shelves and its table is loose: crash into a shelf or
  // the table and what's near the impact comes down, like the supermarket's shelves.
  {
    const g = 'garage';
    const GX = ROOMS.garage.x0 + 0.25; // the middle of the camping shelves, against the garage's garden-side wall
    const GZ1 = -6.825; // the utility room's wall
    // the camping shelves (shelf tops 0.11, 0.63, 1.15, 1.67 and 2.13; put() lifts
    // anything this low by the floorboards' thickness, so the bottom shelf's things start that much lower)
    const LOW = 0.012;
    put(g, 'coolBox', GX, 0.11 - LOW, -9.15, { yaw: 0 });
    put(g, 'campCrate', GX, 0.11 - LOW, -8.5, { yaw: 0 });
    for (const [id, z] of [['sleepingBagGreen', -9.3], ['sleepingBagRed', -9.0], ['sleepingBagBlue', -8.7]]) put(g, id, GX, 0.63, z, { yaw: 0 });
    put(g, 'gasCan', GX, 0.63, -8.35);
    put(g, 'gasCan', GX + 0.1, 0.63, -8.25);
    put(g, 'sleepingBagDark', GX, 1.15, -9.3, { yaw: 0 });
    for (const z of [-8.85, -8.75, -8.65, -8.55]) put(g, 'campChair', GX, 1.15, z, { yaw: (rnd() - 0.5) * 0.1 });
    put(g, 'tentBag', GX, 1.67, -9.1, { yaw: 0 });
    put(g, 'sleepingBagYellow', GX, 1.67, -8.4, { yaw: 0 });
    put(g, 'lantern', GX, 2.13, -9.2);
    put(g, 'doosDiversen', GX, 2.13, -8.6, { yaw: Math.PI / 2 });
    // the table, piled with boxes of junk, and more under it
    let b = put(g, 'doosDiversen', 3.3, 0.85, -9.25, { yaw: Math.PI / 2 });
    b = put(g, 'doosKerst', 3.3, 1.19, -9.25, { yaw: Math.PI / 2 + 0.08, on: b });
    put(g, 'doosLego', 3.3, 1.49, -9.28, { yaw: Math.PI / 2 - 0.1, on: b });
    put(g, 'toolbox', 3.65, 0.85, -9.3, { yaw: Math.PI / 2 });
    const tub = put(g, 'tub', 3.32, 0.85, -8.75, { yaw: Math.PI / 2 });
    put(g, 'seeds', 3.3, 1.05, -8.75, { yaw: 1.4, on: tub });
    b = put(g, 'doosBoeken', 3.7, 0.85, -8.7, { yaw: Math.PI / 2 });
    put(g, 'doosBaby', 3.68, 1.11, -8.68, { yaw: Math.PI / 2 + 0.1, on: b });
    put(g, 'emmer', 3.4, 0.85, -8.4);
    put(g, 'doosBoeken', 3.45, 0, -9.25, { yaw: Math.PI / 2 });
    put(g, 'bottleCrate', 3.45, 0, -8.7, { yaw: Math.PI / 2 });
    // the tool shelves (x 1.7 to the wall; tops 0.13, 0.53 and 0.93), and the tools on the pegboard above
    for (const [id, x] of [['paintWhite', 1.85], ['paintBlue', 2.05], ['paintWhite', 2.25]]) put(g, id, x, 0.53, GZ1 - 0.2);
    for (const x of [2.47, 2.58, 2.69]) put(g, 'screwTin', x, 0.53, GZ1 - 0.18);
    put(g, 'doosLego', 2.98, 0.53, GZ1 - 0.2, { yaw: 0 });
    put(g, 'paintGreen', 3.35, 0.53, GZ1 - 0.2);
    put(g, 'waspoeder', 3.65, 0.53, GZ1 - 0.2, { yaw: 0 });
    put(g, 'doos', 1.95, 0.13 - LOW, GZ1 - 0.2, { yaw: 0 });
    put(g, 'paintBlue', 2.4, 0.13 - LOW, GZ1 - 0.2);
    put(g, 'paintGreen', 2.62, 0.13 - LOW, GZ1 - 0.2);
    put(g, 'doosBoeken', 3.0, 0.13 - LOW, GZ1 - 0.2, { yaw: 0 });
    put(g, 'emmer', 3.55, 0.13 - LOW, GZ1 - 0.2);
    const board = GZ1 - 0.04; // just in front of the pegboard
    put(g, 'saw', 1.95, 1.2, board, { yaw: 0 });
    put(g, 'hammer', 2.3, 1.25, board, { yaw: 0 });
    put(g, 'drill', 2.65, 1.25, board - 0.02, { yaw: 0 }); // it's thicker
    ['screwdriverRed', 'screwdriverYellow', 'screwdriverBlue', 'screwdriverGreen'].forEach((id, i) => put(g, id, 2.95 + i * 0.09, 1.38, board, { yaw: 0 }));
    for (let i = 0; i < 4; i++) put(g, 'spanner', 3.35 + i * 0.09, 1.4, board, { yaw: 0 });
    // and on the floor
    put(g, 'ball', 1.9, 0, -7.8);
    put(g, 'emmer', 2.85, 0, -7.6);
    // crashing into the shelves, the table or the pegboard brings down what's near
    const shout = ROOM_MESS.garage;
    for (const [solid, out] of [[garage.camping, [1, 0, 0]], [garage.table, [-1, 0, 0]], [garage.tools, [0, 0, -1]], [garage.pegboard, [0, 0, -1]]]) {
      const dir = new THREE.Vector3(...out);
      solid.surface.tally = 'mess';
      solid.surface.mess = shout;
      solid.surface.onHit = (point, strength, push) => stocks[0].knock(rooms.garage, point, dir, strength, push, {
        radius: 0.55 + strength * 0.1,
        chance: 0.9,
      });
    }
  }

  // ---------------------------------------------------------------- bedroom
  const bedroom = 'bedroom';
  const clothes = ['shirtRed', 'shirtBlue', 'shirtWhite', 'shirtGreen', 'jeans', 'sockWhite', 'sockBlack', 'sockRed', 'underpants', 'boxers', 'heapGrey', 'heapRed', 'heapBlue'];
  strew(bedroom, clothes, 30);
  strew(bedroom, ['shirtWhite', 'jeans', 'heapBlue', 'sockBlack', 'shirtRed'], 6, { area: { x0: -0.55, x1: 0.45, z0: 0.2, z1: 3.0 } }); // on the rug beside the bed
  // on the bed
  put(bedroom, 'shirtBlue', -1.19, 0.61, 1.1, { yaw: 0.4 });
  put(bedroom, 'jeans', -1.49, 0.61, 1.9, { yaw: 1.8 });
  put(bedroom, 'heapGrey', -1.99, 0.61, 1.5);
  put(bedroom, 'phone', -2.24, 0.61, 2.05, { yaw: 0.2 });
  // the chair everyone has: buried under clothes
  let chairPile = null;
  let chairTop = 0.46;
  for (const id of ['jeans', 'shirtWhite', 'heapBlue', 'heapRed', 'shirtGreen', 'heapGrey']) {
    chairPile = put(bedroom, id, -2.43 + (rnd() - 0.5) * 0.06, chairTop, 4.4 + (rnd() - 0.5) * 0.06, { on: chairPile });
    chairTop += entry(id).h * 0.8; // clothes squash a bit
  }
  // the nightstand
  put(bedroom, 'mugYellow', -2.44, 0.5, 2.68);
  put(bedroom, 'glass', -2.59, 0.5, 2.9);
  put(bedroom, 'bookRed', -2.49, 0.5, 2.82, { yaw: 0.3 });
  // the laundry basket, overflowing (the basket itself is decoration)
  for (const [id, dx, dz, y] of [['heapGrey', 0, 0, 0.36], ['shirtRed', 0.05, 0.03, 0.47], ['sockWhite', -0.08, 0.06, 0.48], ['heapBlue', -0.05, -0.05, 0.42]]) put(bedroom, id, -0.45 + dx, y, -1.9 + dz);
  put(bedroom, 'waspoeder', -0.15, 0, -2.15, { yaw: 0.2 });
  put(bedroom, 'slipper', -0.31, 0, 0.35, { yaw: 1.4 });
  put(bedroom, 'slipper', -0.01, 0, 0.25, { yaw: 2.0 });

  // ---------------------------------------------------------------- kids room
  const kids = 'kids';
  const toys = ['blockA', 'blockB', 'blockC', 'blockD', 'brickRed', 'brickBlue', 'brickYellow', 'brickWhite', 'carRed', 'carBlue', 'crayonRed', 'crayonGreen'];
  strew(kids, [...toys, 'teddy', 'beachBall', 'ball', 'carYellow', 'drawing', 'crayonBlue', 'duck'], 46, { how: lying });
  strew(kids, ['shirtKid', 'shirtKidPink', 'jeansKid', 'sockRed', 'sockWhite', 'slipper'], 10);
  // on top of the toy box, and on the bed
  put(kids, 'teddy', 1.5, 0.5, 4.5, { yaw: 0.3 });
  put(kids, 'carRed', 1.95, 0.5, 4.45, { yaw: 1.1 });
  put(kids, 'blockC', 1.75, 0.5, 4.65);
  put(kids, 'ball', 1.3, 0.5, 4.7);
  put(kids, 'shirtKid', 2.6, 0.52, -1.8, { yaw: 0.6 });
  put(kids, 'teddy', 3.5, 0.52, -1.95, { yaw: -1.4 });
  put(kids, 'bookBlue', 2.6, 0.72, 3.0, { yaw: 0.8 }); // on the beanbag
  // a block tower and a crayon drawing session on the rug
  below = null;
  ['blockB', 'blockD', 'blockA', 'blockC'].forEach((id, i) => (below = put(kids, id, 1.2, i * 0.07, 2.0, { yaw: 0.3 * i, on: below })));
  for (const [x, z, r] of [[2.0, 1.7, 0.2], [2.3, 1.9, -0.5]]) put(kids, 'drawing', x, 0, z, { yaw: r });
  for (const id of ['crayonRed', 'crayonBlue', 'crayonGreen']) put(kids, id, 2.0 + rnd() * 0.5, 0.002, 1.6 + rnd() * 0.5, tipped(id));

  // ---------------------------------------------------------------- attic study
  const study = 'study';
  put(study, 'pizzaBox', -3.48, 0.76, -0.5, { yaw: 0.1 });
  put(study, 'limo', -3.3, 0.76, -1.35, tipped('limo'));
  put(study, 'icetea', -3.6, 0.76, 0.05);
  put(study, 'cola', -3.25, 0.76, -0.9);
  put(study, 'mugWhite', -3.3, 0.76, 0.0);
  for (const [x, z, r] of [[-3.55, -1.25, 0.1], [-3.45, -1.2, -0.3], [-3.5, 0.05, 1.5]]) put(study, 'paper', x, 0.76, z, { yaw: r });
  pile(study, 'bookGreen', -3.6, 0.76, -1.45, 3);
  strew(study, ['paper', 'paper', 'bookRed', 'bookBlue', 'limo', 'icetea', 'heapGrey', 'sockBlack', 'chipsPaprika', 'magazine'], 20, {
    area: { x0: ROOMS.study.x0, x1: ROOMS.study.x1, z0: ROOMS.study.z0, z1: 2.6 },
    how: (id) => (id.startsWith('chips') ? onFace(id) : lying(id)),
  });
  // boxes of stuff, waiting to go up to the loft since the day they moved in
  const doos = put(study, 'doos', -2.0, 0, 0.9, { yaw: 0.15 });
  put(study, 'doos', -1.95, 0.32, 0.88, { yaw: -0.1, on: doos });
  put(study, 'doos', 0.1, 0, -1.6, { yaw: 0.4 });
  put(study, 'blanket', -0.53, 0.45, 2.6, { yaw: 1.0 }); // in the armchair
  put(study, 'bookBlue', -0.08, 0.45, 2.3, { yaw: 0.4 });

  // ---------------------------------------------------------------- attic bathroom
  const bath = 'bath';
  put(bath, 'duck', 1.55, 0.14, 3.2, { yaw: 0.4 }); // in the tub
  put(bath, 'duck', 2.25, 0.14, 3.0, { yaw: 2.5 });
  put(bath, 'shampoo', 2.79, 0.55, 2.82); // on its rim
  put(bath, 'douchegel', 1.06, 0.55, 3.68);
  put(bath, 'tandpasta', 3.4, 0.85, 0.5, { yaw: 1.3 }); // on the cabinet
  put(bath, 'mugWhite', 3.6, 0.85, 0.9);
  put(bath, 'douchegel', 3.65, 0.85, 1.2, tipped('douchegel'));
  put(bath, 'waspoeder', 3.55, 0.85, -0.45, { yaw: -Math.PI / 2 }); // on the washing machine
  pile(bath, 'wcRol', 3.0, 0, -1.6, 3, { jitter: 0.01 });
  put(bath, 'wcRol', 2.6, 0, -0.6, tipped('wcRol'));
  put(bath, 'emmer', 2.7, 0, 1.9);
  strew(bath, ['towelWhite', 'towelBlue', 'heapGrey', 'sockWhite', 'underpants', 'shirtWhite', 'shampoo', 'wcRol'], 12, { how: lying });

  // ---------------------------------------------------------------- the board game closet
  const closet = buildCloset();
  // ---------------------------------------------------------------- the TV cabinet, full of toys
  const tvCabinet = buildTVCabinet();
  // ---------------------------------------------------------------- the kitchen's hanging cupboard, full of crockery
  const wallCupboard = buildWallCupboard();
  // ---------------------------------------------------------------- the toy cabinet beside the piano
  buildToyCabinet();
  // ---------------------------------------------------------------- the storage cupboard under the stairs, stuffed full
  const storage = buildStorage();

  for (const s of stocks) s.build();

  // ---------------------------------------------------------------- decoration (no physics)
  decorate();

  function buildCloset() {
    const k = 0;
    // the high board game cabinet against the living room's back wall, as in the
    // floor plan: in the right-hand corner, right of the door to the utility room
    // (5 mm off the side wall, so their faces don't flicker against each other)
    const X0 = 2.175;
    const X1 = 3.87;
    const Z0 = -4.875;
    const Z1 = -4.375;
    const TOP = 2.05;
    const T = 0.03;
    const oak = std({ color: 0xc9a06a, roughness: 0.6 });
    const inside = std({ color: 0xb08a58, roughness: 0.7 });
    const b = (min, max, m) => box(min, max, m, { story: k, cast: true });
    b([X0, 0, Z0], [X0 + T, TOP, Z1], oak);
    b([X1 - T, 0, Z0], [X1, TOP, Z1], oak);
    b([X0 + T, 0, Z0], [X1 - T, TOP, Z0 + 0.02], inside); // between the sides, or its edges flicker through them
    // one cabinet, its shelves running all the way across; they start in front
    // of the back, or their backs flicker against its back
    const ZB = Z0 + 0.02;
    b([X0, 0, Z1 - 0.04], [X1, 0.08, Z1], oak); // plinth
    const shelves = [0.08, 0.47, 0.86, 1.25, 1.64];
    for (const y of [...shelves, TOP - T]) b([X0, y - (y === 0.08 ? 0.08 : 0), ZB], [X1, y + (y === 0.08 ? 0 : T), Z1], oak);
    b([X0 - 0.02, TOP, Z0], [X1 + 0.02, TOP + 0.04, Z1 + 0.03], oak); // the crown on top
    const solid = body([X0, 0, Z0], [X1, TOP + 0.12, Z1], physMats.hard, { kind: 'furniture' });

    // the sjoelbak lies on top, with puzzles and a few games piled on it
    const sjoel = std({ color: 0xe0c08a, roughness: 0.5 });
    b([X0 + 0.02, TOP + 0.04, Z0 + 0.05], [X1 - 0.02, TOP + 0.08, Z1 - 0.03], sjoel);
    b([X0 + 0.02, TOP + 0.08, Z0 + 0.05], [X1 - 0.02, TOP + 0.1, Z0 + 0.08], sjoel);
    b([X0 + 0.02, TOP + 0.08, Z1 - 0.06], [X1 - 0.02, TOP + 0.1, Z1 - 0.03], sjoel);

    // the games behind the left door, behind the right door, and on top
    const [secL, secR, secTop] = [0, 1, 2].map(() => {
      const s = stocks[k].section({ bounds: ROOMS.living, floorY: 0.012, k, name: 'closet', fresh: false });
      sections[k].push(s);
      return s;
    });
    const games = GAMES.map((g) => g.id);
    let bag = [];
    const nextGame = () => {
      if (!bag.length) bag = [...games].sort(() => rnd() - 0.5);
      return bag.pop();
    };
    /** A pile of game boxes, biggest at the bottom, with their pieces inside. */
    function gamePile(sec, cx, y, z, maxH) {
      const pick = [];
      let h = 0;
      for (let tries = 0; tries < 7; tries++) {
        const id = nextGame();
        const gh = C[id].h;
        if (h + gh > maxH) { bag.unshift(id); continue; }
        pick.push(id);
        h += gh;
      }
      pick.sort((p, q) => C[q].w * C[q].d - C[p].w * C[p].d);
      let under = null;
      let top = y;
      for (const id of pick) {
        const [hx, hy, hz] = half(id);
        const x = cx + (rnd() - 0.5) * 0.03;
        const zz = Math.min(z, Z1 - 0.01 - hz) + (rnd() - 0.5) * 0.02;
        const boxItem = stocks[k].place(id, x, top, zz, (rnd() - 0.5) * 0.08, sec, 0, { on: under });
        // the pieces, hidden inside the box until it falls
        for (const [pid, n] of GAMES.find((g) => g.id === id).in) {
          const [px, py, pz] = half(pid);
          for (let i = 0; i < n; i++) {
            stocks[k].place(pid, x + (rnd() - 0.5) * Math.max(0, hx - px - 0.01), top + hy - py, zz + (rnd() - 0.5) * Math.max(0, hz - pz - 0.01), rnd() * 0.3, null, 0, { inside: boxItem, lift: py });
          }
        }
        under = boxItem;
        top += 2 * hy;
      }
    }
    // three piles on every shelf (the biggest boxes are 0.42 m wide, too wide
    // for four): the left one behind the left door, the right one behind the
    // right door, and the middle one, where the doors meet, behind the left
    // door on one shelf and behind the right door on the next
    const inner = X1 - X0 - 2 * T;
    shelves.forEach((y, i) => {
      const shelfTop = y + (i === 0 ? 0 : T);
      const ceiling = (shelves[i + 1] ?? TOP - T) - 0.01;
      [1 / 6, 1 / 2, 5 / 6].forEach((f, p) => {
        const sec = p === 0 ? secL : p === 2 ? secR : i % 2 ? secR : secL;
        gamePile(sec, X0 + T + inner * f, shelfTop, Z1 - 0.22, ceiling - shelfTop - 0.01);
      });
    });
    gamePile(secTop, X0 + 0.4, TOP + 0.08, Z1 - 0.24, 0.3);
    gamePile(secTop, X1 - 0.45, TOP + 0.08, Z1 - 0.24, 0.22);
    // a stack of sjoel pucks on the sjoelbak, between the two piles
    let puck = null;
    for (let i = 0; i < 8; i++) puck = stocks[k].place('sjoelschijf', X0 + 0.85 + (rnd() - 0.5) * 0.01, TOP + 0.08 + i * 0.012, Z1 - 0.2, 0, secTop, 0, { on: puck });

    // Two painted doors, shut. They're doors like the house's (main.js): a
    // knock cracks one, and it swings a little way open on its hinges; a hard
    // hit smashes it, and then the games behind it come pouring out.
    const DT = 0.022;
    const MID = (X0 + X1) / 2;
    const Y0 = 0.015;
    const Y1 = TOP - 0.006;
    let burst = null; // the door just smashed: the next hit behind it empties the whole side
    const doors = [[X0 + 0.004, MID - 0.003, -1], [MID + 0.003, X1 - 0.004, 1]].map(([a, c, hinge], i) => {
      const w = c - a;
      const center = new THREE.Vector3((a + c) / 2, (Y0 + Y1) / 2, Z1 + 0.001 + DT / 2);
      const group = new THREE.Group();
      group.position.copy(center);
      const edge = mat(0x8f2414);
      const slab = new THREE.Mesh(Box(w, Y1 - Y0, DT), [edge, edge, edge, edge, texMat(closetDoorArt(i === 1, w / (Y1 - Y0)), { roughness: 0.45 }), inside]);
      slab.castShadow = true;
      slab.receiveShadow = true;
      group.add(slab);
      // a brass knob near where the doors meet
      const knob = new THREE.Mesh(Sph(0.02), mat(0xc9a74a, { metalness: 0.6, roughness: 0.35 }));
      knob.position.set(-hinge * (w / 2 - 0.06), 1.05 - center.y, DT / 2 + 0.014);
      knob.castShadow = true;
      group.add(knob);
      groups[k].add(group);
      const door = {
        kind: 'door', group, broken: false, cracked: false, story: k,
        color: 0xc8381e, center, normal: new THREE.Vector3(0, 0, 1), width: w, height: Y1 - Y0, body: null,
      };
      door.body = body([a, Y0, Z1 + 0.001], [c, Y1, Z1 + 0.001 + DT], physMats.hard, { kind: 'door', piece: door });
      // cracked, the latch gives and it swings ajar on its hinges (house.js crackDoor)
      door.onCrack = () => {
        const pin = new THREE.Vector3(hinge * w / 2, 0, -DT / 2);
        group.rotation.set(0, hinge * 0.25, 0);
        group.position.copy(center).add(pin).sub(pin.clone().applyEuler(group.rotation));
      };
      door.onBreak = () => { burst = { side: i, at: performance.now() }; };
      return door;
    });

    // Crashing into it empties it, but only where a door is smashed (the top
    // always): the harder, the more of it comes down. Everything falls out of
    // the front, and the games spill as they go.
    const out = new THREE.Vector3(0, 0, 1);
    solid.surface.tally = 'games';
    solid.surface.mess = ['Board game avalanche!', 'Game over!', 'Rules? What rules?', 'Who took the dice?', "Now it's a floor game!"];
    const usual = (strength) => ({ radius: 0.5 + strength * 0.12, chance: 0.9, power: 1.15 });
    solid.surface.onHit = (point, strength, push) => {
      let n = stocks[k].knock(secTop, point, out, strength, push, usual(strength));
      doors.forEach((d, i) => {
        if (!d.broken) return;
        const big = burst?.side === i && performance.now() - burst.at < 1500;
        if (big) burst = null;
        n += stocks[k].knock(i ? secR : secL, point, out, strength, push, big ? { radius: 1.8, chance: 1, power: 1.3 } : usual(strength));
      });
      return n;
    };
    return { x0: X0, x1: X1, z0: Z0, z1: Z1, top: TOP, doors };
  }

  // The low black cabinet the TV stands on, in the living room's back left
  // corner, its front facing the room (+x). Three painted doors with a horse
  // on each, and behind them the kids' toys, crammed in. Crash Lennie into a
  // door hard enough and it flies off and lands on the floor, and the toys
  // behind it come tumbling out; a really hard hit takes the doors next to it
  // along. "Fix everything" (restock) puts the doors back and the toys away.
  function buildTVCabinet() {
    const k = 0;
    const [X0, X1, Z0, Z1, TOP] = [-3.875, -2.95, -4.75, -2.41, 0.5]; // all the way to the couch, 1 cm short of it
    const DOOR_T = 0.02;
    const FRONT = X1 - DOOR_T; // the carcass ends here; the doors are in front of it
    const BASE = 0.06; // the bottom inside, on its plinth
    const LID = TOP - 0.03; // the underside of the top, which reaches over the doors
    const W = (Z1 - Z0) / 3; // one door, and the compartment behind it
    const BREAK = 5; // m/s: a hit this hard sends the door flying
    const ALL = 10; // ... and this hard, the doors next to it too
    const OUT = new THREE.Vector3(1, 0, 0);
    const black = std({ color: 0x1a191c, roughness: 0.45 });
    const inside = std({ color: 0x2a282c, roughness: 0.8 });
    const b = (min, max, m) => box(min, max, m, { story: k, cast: true });
    b([X0, 0, Z0], [FRONT, BASE, Z1], black); // plinth and bottom
    b([X0, LID, Z0], [X1, TOP, Z1], black); // the top
    b([X0, BASE, Z0], [FRONT, LID, Z0 + 0.02], black); // the two ends
    b([X0, BASE, Z1 - 0.02], [FRONT, LID, Z1], black);
    b([X0, BASE, Z0 + 0.02], [X0 + 0.02, LID, Z1 - 0.02], inside); // the back
    for (const i of [1, 2]) b([X0 + 0.02, BASE, Z1 - i * W - 0.01], [FRONT, LID, Z1 - i * W + 0.01], black); // dividers
    const solid = body([X0, 0, Z0], [X1, TOP, Z1], physMats.hard, { kind: 'furniture' });

    // the kids' stuff inside: on the bottom of each compartment, a headset or
    // the foam blaster at the back, and in front of it a grid of piles of game
    // cases, most with something on top (a puzzle cube, Lego, darts, a card)
    const piles = ['gameCaseA', 'gameCaseB'];
    const tops = ['puzzleCube', 'legoRed', 'legoBlue', 'legoYellow', 'legoGreen', 'dart', 'dart', 'cardMonster', 'controller'];
    const big = ['headphones', 'blaster', 'headphones'];
    const pick = (list) => list[Math.floor(rnd() * list.length)];

    const DOOR_H = LID - 0.005 - (BASE + 0.005);
    const brass = std({ color: 0xd9b04a, roughness: 0.35, metalness: 0.6 });
    const doors = DOOR_LOOKS.map((look, i) => {
      const zc = Z1 - (i + 0.5) * W;
      const sec = stocks[k].section({ bounds: ROOMS.living, floorY: 0.012, k, name: 'tvcabinet', fresh: false });
      sections[k].push(sec);
      const [a, c] = [zc - W / 2 + 0.05, zc + W / 2 - 0.05]; // z, clear of the dividers
      if (big[i] === 'headphones') stocks[k].place('headphones', X0 + 0.1, BASE, zc, Math.PI / 2 + (rnd() - 0.5) * 0.3, sec);
      else stocks[k].place(big[i], X0 + 0.12, BASE, zc, Math.PI / 2, sec, 0, onFace(big[i])); // lying on its side, along the back
      for (let x = X0 + 0.3; x + 0.053 < FRONT - 0.03; x += 0.17) {
        for (let z = a + 0.09; z + 0.085 < c; z += 0.22) {
          let below = null;
          let y = BASE;
          const n = Math.floor(rnd() * 5); // 0 to 4 game cases, turned a little
          for (let j = 0; j < n; j++) {
            const id = pick(piles);
            below = stocks[k].place(id, x, y, z, (rnd() - 0.5) * 0.3, sec, 0, { on: below });
            y += 2 * half(id)[1];
          }
          if (rnd() < 0.75) stocks[k].place(pick(tops), x, y, z, rnd() * TAU, sec, 0, { on: below });
        }
      }

      // the door: painted on the front, its colour all round the edges, a brass knob
      const group = new THREE.Group();
      group.rotation.order = 'YXZ'; // when it falls: tipped over (z) first, then turned (y)
      const face = std({ map: horseDoorTexture(look, i === 2 ? -1 : 1, (W - 0.008) / DOOR_H), roughness: 0.55 });
      const edge = std({ color: look.bg, roughness: 0.55 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_T, DOOR_H, W - 0.008), [face, edge, edge, edge, edge, edge]);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 8), brass);
      knob.position.set(DOOR_T / 2 + 0.006, DOOR_H / 2 - 0.1, 0); // top middle, above the horse's back
      for (const m of [panel, knob]) {
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      }
      const home = new THREE.Vector3(FRONT + DOOR_T / 2, BASE + 0.005 + DOOR_H / 2, zc);
      group.position.copy(home);
      groups[k].add(group);
      // lying on the floor: each door a little higher than the last, in case they land across each other
      return { group, home, zc, sec, state: 'shut', t: 0, T: 1, vel: new THREE.Vector3(), yaw: 0, restY: 0.012 + DOOR_T / 2 + 0.004 + i * 0.003 };
    });

    /** Knocks a door off: it flies out into the room, turning over to land flat on its back, horse up. */
    function fling(door, v) {
      const p = Math.min(1, v / 14);
      door.state = 'flying';
      door.t = 0;
      door.vel.set(1.1 + p * 1.2 + rnd() * 0.4, 1.0 + p * 1.0 + rnd() * 0.4, (rnd() - 0.5) * 0.8);
      door.yaw = (rnd() - 0.5) * 1.2;
      const G = 9.8;
      const vy = door.vel.y;
      door.T = (vy + Math.sqrt(vy * vy + 2 * G * (door.home.y - door.restY))) / G; // till it hits the floor
    }

    solid.surface.tally = 'toys';
    solid.surface.mess = TOY_MESS;
    solid.surface.onHit = (point, v, push) => {
      // only a hit on the front counts, coming at it more sideways than down (its top
      // edge too); dropping onto the top, by the TV, leaves the doors shut
      const sideways = push ? -push.x > Math.abs(push.y) * 0.6 : point.y < LID;
      if (point.x < X1 - 0.1 || !sideways) return 0;
      const i = Math.max(0, Math.min(2, Math.floor((Z1 - point.z) / W)));
      let n = 0;
      for (const j of v > ALL ? [i, i - 1, i + 1] : [i]) {
        const door = doors[j];
        if (!door) continue;
        if (door.state === 'shut') {
          if (v < BREAK) continue;
          fling(door, v);
          // everything behind it comes out, the toys at the back a little less often
          n += stocks[k].knock(door.sec, new THREE.Vector3(FRONT, BASE + 0.1, door.zc), OUT, v, push, { radius: 1.1, chance: 1, power: 1.1 });
        } else {
          n += stocks[k].knock(door.sec, point, OUT, v, push, { radius: 0.6, chance: 0.9 });
        }
      }
      return n;
    };

    function update(dt) {
      for (const door of doors) {
        if (door.state !== 'flying') continue;
        door.t = Math.min(door.t + dt, door.T);
        const { t, T, vel, home, group } = door;
        group.position.set(home.x + vel.x * t, home.y + vel.y * t - 4.9 * t * t, home.z + vel.z * t);
        const p = t / T;
        group.rotation.set(0, door.yaw * p, (Math.PI / 2) * (1 - (1 - p) ** 2)); // easing out, so it's flat when it lands
        if (t >= T) {
          group.position.y = door.restY;
          door.state = 'down';
        }
      }
    }

    function reset() {
      for (const door of doors) {
        door.state = 'shut';
        door.group.position.copy(door.home);
        door.group.rotation.set(0, 0, 0);
      }
    }

    return { update, reset };
  }

  // The hanging cupboard on the kitchen's side wall, above the counter, all
  // the way up to the ceiling: four white doors with glass panes, and behind
  // them, on three levels, the clean plates, bowls, mugs and glasses and the
  // breakfast things. Crash Lennie into a door hard enough (from the front
  // or from below) and it flies off into the kitchen, and what's behind it
  // comes tumbling down onto the counter and the floor, where the crockery
  // smashes; a really hard hit takes the doors next to it along. Once a door
  // is off, the next knock brings down more. "Fix everything" puts it all back.
  function buildWallCupboard() {
    const k = 0;
    const [X0, X1, Y0, Y1, Z0, Z1] = [3.525, 3.875, 1.5, 2.595, 1.9, 4.875]; // against the right-hand wall, its top 5 mm under the ceiling (2.6)
    const T = 0.018; // the carcass's boards
    const DOOR_T = 0.016;
    const W = (Z1 - Z0) / 4; // one door, and the compartment behind it
    const SHELVES = [1.86, 2.225]; // the two shelves' undersides
    const BREAK = 5; // m/s: a hit this hard sends a door flying
    const ALL = 10; // ... and this hard, the doors next to it too
    const OUT = new THREE.Vector3(-1, 0, 0);
    const blue = std({ color: 0xf2f0eb, roughness: 0.5 }); // (white now, like the rest of the kitchen)
    const inside = std({ color: 0xe9e6df, roughness: 0.7 });
    const b = (min, max, m) => box(min, max, m, { story: k, cast: true });
    // the boards fit between each other, so no two faces lie in one plane
    b([X0, Y0, Z0], [X1, Y0 + T, Z1], blue); // bottom
    b([X0, Y1 - T, Z0], [X1, Y1, Z1], blue); // top
    b([X0, Y0 + T, Z0], [X1, Y1 - T, Z0 + T], blue); // the two ends
    b([X0, Y0 + T, Z1 - T], [X1, Y1 - T, Z1], blue);
    const BACK = X1 - 0.01;
    b([BACK, Y0 + T, Z0 + T], [X1, Y1 - T, Z1 - T], inside); // the back
    for (let i = 1; i < 4; i++) b([X0, Y0 + T, Z0 + i * W - 0.008], [BACK, Y1 - T, Z0 + i * W + 0.008], blue); // dividers
    for (let i = 0; i < 4; i++) {
      const a = i ? Z0 + i * W + 0.008 : Z0 + T;
      const c = i < 3 ? Z0 + (i + 1) * W - 0.008 : Z1 - T;
      for (const y of SHELVES) b([X0 + 0.015, y, a], [BACK, y + 0.015, c], inside); // the shelves, set back a little
    }
    const solid = body([X0 - DOOR_T, Y0, Z0], [X1, Y1, Z1], physMats.hard, { kind: 'furniture' });

    // what's inside, on the bottom (LOW), the middle shelf (MID) and the top shelf (HIGH) of each compartment
    const LOW = Y0 + T;
    const MID = SHELVES[0] + 0.015;
    const HIGH = SHELVES[1] + 0.015;
    const XM = (X0 + BACK) / 2;
    const secs = [0, 1, 2, 3].map(() => {
      const sec = stocks[k].section({ bounds: ROOMS.kitchen, floorY: 0.012, k, name: 'kitchen', fresh: false });
      sections[k].push(sec);
      return sec;
    });
    const inCupboard = (i, id, x, y, z, opts = {}) => breakable(stocks[k].place(id, x, y, z, opts.yaw ?? rnd() * TAU, secs[i], 0, opts), id, secs[i]);
    const stack = (i, id, x, y, z, n) => {
      let below = null;
      for (let j = 0; j < n; j++) below = inCupboard(i, id, x + (rnd() - 0.5) * 0.01, y + j * 2 * half(id)[1], z + (rnd() - 0.5) * 0.01, { on: below });
    };
    const zOf = (i, f) => Z0 + i * W + f * W; // f across the compartment, 0 to 1
    // 1: the plates and the bowls
    stack(0, 'plateClean', XM, LOW, zOf(0, 0.3), 9);
    stack(0, 'plateClean', XM, LOW, zOf(0, 0.7), 7);
    stack(0, 'bowlClean', XM, MID, zOf(0, 0.22), 5);
    stack(0, 'bowlClean', XM, MID, zOf(0, 0.5), 4);
    stack(0, 'bowlClean', XM, MID, zOf(0, 0.78), 5);
    // 2: the mugs in front, the glasses behind them; the breakfast things above
    const mugs = ['mugRed', 'mugBlue', 'mugYellow', 'mugWhite'];
    for (let j = 0; j < 5; j++) {
      inCupboard(1, mugs[j % 4], X0 + 0.07, LOW, zOf(1, 0.12 + j * 0.19));
      inCupboard(1, 'glassClean', BACK - 0.06, LOW, zOf(1, 0.14 + j * 0.18));
    }
    inCupboard(1, 'vlokken', XM, MID, zOf(1, 0.2), { yaw: -Math.PI / 2 });
    inCupboard(1, 'hagelslag', XM, MID, zOf(1, 0.48), { yaw: -Math.PI / 2 });
    inCupboard(1, 'chocopasta', XM - 0.05, MID, zOf(1, 0.7));
    inCupboard(1, 'pindakaas', XM + 0.05, MID, zOf(1, 0.86));
    // 3: more glasses, and more plates above
    for (let j = 0; j < 4; j++) for (const x of [X0 + 0.07, XM + 0.03, BACK - 0.05]) inCupboard(2, 'glassClean', x, LOW, zOf(2, 0.14 + j * 0.24));
    stack(2, 'plateClean', XM, MID, zOf(2, 0.3), 6);
    stack(2, 'bowlClean', XM, MID, zOf(2, 0.72), 4);
    // 4: a pot and a few mugs, the coffee, the tea and the sprinkles
    inCupboard(3, 'pot', XM, LOW, zOf(3, 0.3));
    for (let j = 0; j < 3; j++) inCupboard(3, mugs[j], XM, LOW, zOf(3, 0.62 + j * 0.15));
    inCupboard(3, 'koffie', XM, MID, zOf(3, 0.18), { yaw: -Math.PI / 2 });
    inCupboard(3, 'thee', XM, MID, zOf(3, 0.42), { yaw: -Math.PI / 2 });
    inCupboard(3, 'muisjesRoze', XM, MID, zOf(3, 0.62), { yaw: -Math.PI / 2 });
    inCupboard(3, 'jam', XM, MID, zOf(3, 0.82));
    // and up top, the things nobody can reach: the good plates and glasses, more bowls, the coffee
    stack(0, 'plateClean', XM, HIGH, zOf(0, 0.28), 6);
    for (let j = 0; j < 3; j++) inCupboard(0, 'glassClean', XM, HIGH, zOf(0, 0.58 + j * 0.15));
    for (let j = 0; j < 4; j++) inCupboard(1, 'glassClean', X0 + 0.07, HIGH, zOf(1, 0.14 + j * 0.24));
    stack(1, 'bowlClean', BACK - 0.08, HIGH, zOf(1, 0.5), 4);
    for (let j = 0; j < 4; j++) inCupboard(2, mugs[j], XM, HIGH, zOf(2, 0.14 + j * 0.24));
    inCupboard(3, 'koffie', XM, HIGH, zOf(3, 0.2), { yaw: -Math.PI / 2 });
    inCupboard(3, 'koffiepads', XM, HIGH, zOf(3, 0.48), { yaw: -Math.PI / 2 });
    stack(3, 'bowlClean', XM, HIGH, zOf(3, 0.78), 3);

    // The doors: a white frame round a pane of glass, so you see the crockery
    // behind it, and a steel handle along the bottom. The pane sits in the
    // middle of the frame's thickness and reaches 2 mm into it all round.
    const doorMat = std({ color: 0xf8f7f3, roughness: 0.45 });
    const glassMat = std({ color: 0xdff1ff, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false });
    const steel = std({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.5 });
    const DOOR_H = Y1 - Y0 - 0.01;
    const DW = W - 0.008;
    const [STILE, RAIL, FOOT] = [0.055, 0.06, 0.09]; // the frame's sides, top and bottom
    const v2 = (pts) => pts.map(([u, v]) => new THREE.Vector2(u, v));
    const outline = new THREE.Shape(v2([[-DW / 2, -DOOR_H / 2], [DW / 2, -DOOR_H / 2], [DW / 2, DOOR_H / 2], [-DW / 2, DOOR_H / 2]]));
    outline.holes.push(new THREE.Path(v2([[-DW / 2 + STILE, -DOOR_H / 2 + FOOT], [-DW / 2 + STILE, DOOR_H / 2 - RAIL], [DW / 2 - STILE, DOOR_H / 2 - RAIL], [DW / 2 - STILE, -DOOR_H / 2 + FOOT]])));
    // extruded along z, then turned so its width runs along z and its thickness along x
    const frameGeo = new THREE.ExtrudeGeometry(outline, { depth: DOOR_T, bevelEnabled: false }).translate(0, 0, -DOOR_T / 2).rotateY(Math.PI / 2);
    const paneGeo = new THREE.BoxGeometry(0.004, DOOR_H - FOOT - RAIL + 0.004, DW - 2 * STILE + 0.004).translate(0, (FOOT - RAIL) / 2, 0);
    const doors = [0, 1, 2, 3].map((i) => {
      const zc = Z0 + (i + 0.5) * W;
      const group = new THREE.Group();
      group.rotation.order = 'YXZ'; // when it falls: tipped over (z) first, then turned (y)
      const panel = new THREE.Mesh(frameGeo, doorMat);
      group.add(new THREE.Mesh(paneGeo, glassMat));
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.14), steel);
      handle.position.set(-DOOR_T / 2 - 0.01, -DOOR_H / 2 + 0.045, 0);
      for (const m of [panel, handle]) {
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      }
      const home = new THREE.Vector3(X0 - DOOR_T / 2, (Y0 + Y1) / 2, zc);
      group.position.copy(home);
      groups[k].add(group);
      // lying on the floor: each door a little higher than the last, in case they land across each other
      return { group, home, zc, sec: secs[i], state: 'shut', t: 0, T: 1, vel: new THREE.Vector3(), yaw: 0, restY: 0.012 + DOOR_T / 2 + 0.004 + i * 0.003 };
    });

    /**
     * Knocks a door off: it flies out over the counter into the kitchen,
     * turning over to land flat on its back on the floor, handle up, clear of the counters.
     */
    function fling(door, v) {
      const p = Math.min(1, v / 14);
      door.state = 'flying';
      door.t = 0;
      const vy = 0.8 + p * 1.0 + rnd() * 0.4;
      const G = 9.8;
      door.T = (vy + Math.sqrt(vy * vy + 2 * G * (door.home.y - door.restY))) / G; // till it hits the floor
      const land = THREE.MathUtils.clamp(door.zc + (rnd() - 0.5) * 0.3, 2.3, 3.8); // the floor between the front and back counters
      door.vel.set(-(1.7 + p * 0.8 + rnd() * 0.4), vy, (land - door.zc) / door.T);
      door.yaw = (rnd() - 0.5) * 0.8;
    }

    solid.surface.tally = 'mess';
    solid.surface.mess = ROOM_MESS.kitchen;
    solid.surface.onHit = (point, v, push) => {
      // a hit on the doors, or from below; landing on top leaves them shut
      if (point.x > X0 + 0.05 && point.y > Y0 + 0.03) return 0;
      const i = Math.max(0, Math.min(3, Math.floor((point.z - Z0) / W)));
      let n = 0;
      for (const j of v > ALL ? [i, i - 1, i + 1] : [i]) {
        const door = doors[j];
        if (!door) continue;
        if (door.state === 'shut') {
          if (v < BREAK) continue;
          fling(door, v);
          // most of what's behind it comes out, the rest with the next knock
          // (it breaks when it lands, not in the cupboard)
          n += stocks[k].knock(door.sec, new THREE.Vector3(X0, (Y0 + Y1) / 2, door.zc), OUT, v, push, { radius: 0.6, chance: 1, power: 0.9, shatter: false });
        } else {
          n += stocks[k].knock(door.sec, point, OUT, v, push, { radius: 0.6, chance: 0.9, power: 0.9, shatter: false });
        }
      }
      return n;
    };

    function update(dt) {
      for (const door of doors) {
        if (door.state !== 'flying') continue;
        door.t = Math.min(door.t + dt, door.T);
        const { t, T, vel, home, group } = door;
        group.position.set(home.x + vel.x * t, home.y + vel.y * t - 4.9 * t * t, home.z + vel.z * t);
        const p = t / T;
        group.rotation.set(0, door.yaw * p, (-Math.PI / 2) * (1 - (1 - p) ** 2)); // easing out, so it's flat when it lands
        if (t >= T) {
          group.position.y = door.restY;
          door.state = 'down';
        }
      }
    }

    function reset() {
      for (const door of doors) {
        door.state = 'shut';
        door.group.position.copy(door.home);
        door.group.rotation.set(0, 0, 0);
      }
    }

    return { update, reset };
  }

  // The little toy cabinet in the living room, beside the piano with its back
  // against the kitchen counter: white, open at the front, four cubbies with a
  // mint back, crammed with toys. Crash into it and the toys near the hit
  // come tumbling out into the room ("Fix everything" puts them back).
  function buildToyCabinet() {
    const k = 0;
    const { x0: X0, x1: X1, z0: Z0, z1: Z1, top: TOP } = TOY_CABINET;
    const T = 0.018;
    const PLINTH = 0.05;
    const MIDY = 0.33; // the middle shelf's underside
    const XM = (X0 + X1) / 2;
    const BACK = Z1 - 0.012; // the back panel's front
    const white = std({ color: 0xf4f2ee, roughness: 0.5 });
    const mint = std({ color: 0x8fd3c1, roughness: 0.6 });
    const b = (min, max, m) => box(min, max, m, { story: k, cast: true });
    // the boards fit between each other, so no two faces lie in one plane
    b([X0, 0, Z0], [X1, PLINTH, Z1], white); // plinth and bottom
    b([X0, TOP - T, Z0], [X1, TOP, Z1], white); // the top
    b([X0, PLINTH, Z0], [X0 + T, TOP - T, Z1], white); // the sides
    b([X1 - T, PLINTH, Z0], [X1, TOP - T, Z1], white);
    b([X0 + T, PLINTH, BACK], [X1 - T, TOP - T, Z1], mint); // the back
    b([XM - T / 2, PLINTH, Z0 + 0.006], [XM + T / 2, TOP - T, BACK], white); // the divider, set back a little
    for (const [a, c] of [[X0 + T, XM - T / 2], [XM + T / 2, X1 - T]]) b([a, MIDY, Z0 + 0.003], [c, MIDY + T, BACK], white); // the shelf, either side of it
    const solid = body([X0, 0, Z0], [X1, TOP, Z1], physMats.hard, { kind: 'furniture' });

    // the toys, in a section of their own that only a crash into the cabinet knocks
    // (it reaches back to the cabinet's back, past the living room's edge at the counter)
    const sec = stocks[k].section({ bounds: { ...ROOMS.living, z1: BACK - 0.01 }, floorY: 0.012, k, name: 'toycabinet', fresh: false });
    sections[k].push(sec);
    const inside = (id, x, y, z, opts = {}) => stocks[k].place(id, x, y, z, opts.yaw ?? rnd() * TAU, sec, 0, opts);
    const L = (X0 + T + XM - T / 2) / 2; // the middle of the left cubbies
    const R = (XM + T / 2 + X1 - T) / 2;
    const UP = MIDY + T;
    /** A pile of flat things, each on the one below, turned a little. */
    const pileUp = (ids, x, y, z, yaw) => {
      let below = null;
      for (const id of ids) {
        below = inside(id, x, y, z, { yaw: yaw + (rnd() - 0.5) * 0.1, on: below });
        y += 2 * half(id)[1];
      }
      return below;
    };
    // bottom left: two piles of game cases
    pileUp(['gameCaseB', 'gameCaseA', 'gameCaseB', 'gameCaseA'], L, PLINTH, 1.01, Math.PI / 2);
    pileUp(['gameCaseA', 'gameCaseB', 'gameCaseA'], L, PLINTH, 0.83, Math.PI / 2);
    // bottom right: a pile of comics, the puzzle cube in front
    pileUp(['comicA', 'comicB', 'comicB', 'comicA', 'comicB'], R, PLINTH, 0.97, 0);
    inside('puzzleCube', R, PLINTH, 0.795, { yaw: 0.3 });
    // top left: the headset
    inside('headphones', L, UP, 0.93, { yaw: Math.PI / 2 + 0.05 });
    // top right: trading cards, Lego and foam darts
    pileUp(['cardMonster', 'cardMonster', 'cardMonster', 'cardMonster'], R - 0.06, UP, 1.03, 0.1);
    const brick = inside('legoRed', R + 0.07, UP, 1.03, { yaw: 0.3 });
    inside('legoBlue', R + 0.07, UP + 2 * half('legoRed')[1], 1.03, { yaw: 0.9, on: brick });
    inside('legoYellow', R + 0.06, UP, 0.93, { yaw: 1.4 });
    for (const z of [0.81, 0.86]) inside('dart', R, UP, z, { yaw: 0.1 + (z - 0.81) * 4 });

    const out = new THREE.Vector3(0, 0, -1);
    solid.surface.tally = 'toys';
    solid.surface.mess = TOY_MESS;
    solid.surface.onHit = (point, strength, push) => stocks[k].knock(sec, point, out, strength, push, { radius: 0.5 + strength * 0.1, chance: 0.9, power: 1.1 });
  }

  // The storage cupboard under the stairs (house.js), stuffed with everything
  // the family never throws away: shelves up high along the back and the left
  // wall, crammed with boxes, paint, cleaning stuff and a secret stash of
  // sweets, and more junk on the floor under them. When Lennie smashes its
  // door it all comes pouring out into the living room (house.js calls
  // spill()). The shelves start at 1.15 m, so the floor stays clear for
  // Lennie: the junk on it is loose and gets kicked about, and a solid
  // crate on the floor made the cupboard a trap.
  function buildStorage() {
    const k = 0;
    // its inner wall faces: the stairs' wall, the wall with the door onto the living room, the back, the hallway
    const [X0, X1, Z0, Z1] = [-2.77, -1.84, -0.61, 1.01];
    const LEFT = X0 + 0.3; // the front of the shelves along the left wall
    const BACK = Z0 + 0.25; // the front of the shelves along the back
    const LEVELS = [1.15, 1.5, 1.85, 2.2]; // the shelves' tops
    const TOP = 2.6; // the ceiling
    const BOARD = 0.022;
    const pine = std({ color: 0xd8c39a, roughness: 0.7 });
    // The boards reach 1 cm into the walls behind and beside them; along the
    // back they stop 1 cm short of the door's wall, clear of the doorframe.
    for (const y of LEVELS) {
      box([X0 - 0.01, y - BOARD, Z0 - 0.01], [X1 - 0.01, y, BACK], pine, { story: k, cast: true });
      box([X0 - 0.01, y - BOARD, BACK], [LEFT, y, Z1 + 0.01], pine, { story: k, cast: true });
    }
    const back = body([X0, LEVELS[0] - BOARD, Z0], [X1, TOP - 0.15, BACK], physMats.hard, { kind: 'furniture' });
    const left = body([X0, LEVELS[0] - BOARD, BACK], [LEFT, TOP - 0.15, Z1], physMats.hard, { kind: 'furniture' });

    // Where it all lands: the cupboard and the strip of living room in front
    // of its door (between the cupboard's back and the hallway's wall, as far
    // as the middle of the room), so nothing flies through the cupboard's walls.
    const AREA = { x0: X0, x1: 0.6, z0: Z0, z1: Z1 };
    const secs = [];
    const section = (fresh) => {
      const s = stocks[k].section({ bounds: AREA, floorY: 0.012, k, name: 'storage', fresh });
      sections[k].push(s);
      secs.push(s);
      return s;
    };
    const shelfSec = section(false); // only Lennie bumping the shelves, or the door smashing, brings these down
    const floorSec = section(true); // these get kicked about like any mess on the floor

    // the shelves, filled from one end to the other with whatever fits
    const shelfStuff = [
      'doosKerst', 'doosLego', 'doosBoeken', 'doosBaby', 'doos', 'seeds', 'tub', 'toolbox', 'lantern', 'gasCan', 'screwTin', 'screwTin',
      'paintWhite', 'paintBlue', 'paintGreen', 'waspoeder', 'wcRol', 'wcRol', 'afwas', 'allesreiniger', 'emmer',
      'sleepingBagRed', 'sleepingBagBlue', 'campChair',
      'stroopwafels', 'chocolade', 'drop', 'snoepmix', 'cola', 'limo', 'hagelslag', 'pindakaas', 'jam', // the secret stash
    ];
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    function fillShelf(along, a, b, y, mid, maxH, maxD) {
      let u = a + 0.02 + rnd() * 0.04;
      for (let tries = 0; tries < 60 && u < b - 0.08; tries++) {
        const id = pick(shelfStuff);
        const [hx, hy, hz] = half(id);
        if (2 * hy > maxH || 2 * hz > maxD || u + 2 * hx > b - 0.01) continue;
        const c = u + hx;
        const [x, z] = along === 'x' ? [c, mid + (rnd() - 0.5) * (maxD - 2 * hz) * 0.6] : [mid + (rnd() - 0.5) * (maxD - 2 * hz) * 0.6, c];
        const yaw = (along === 'x' ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.12;
        let under = stocks[k].place(id, x, y, z, yaw, shelfSec);
        // small things stand two or three high
        let top = y + 2 * hy;
        while (2 * hy < 0.14 && top + 2 * hy < y + maxH && rnd() < 0.6) {
          under = stocks[k].place(id, x + (rnd() - 0.5) * 0.01, top, z + (rnd() - 0.5) * 0.01, yaw + (rnd() - 0.5) * 0.2, shelfSec, 0, { on: under });
          top += 2 * hy;
        }
        u = c + hx + 0.012 + rnd() * 0.03;
      }
    }
    LEVELS.forEach((y, i) => {
      const room = (LEVELS[i + 1] ?? TOP) - BOARD - y - 0.03;
      fillShelf('x', X0 + 0.01, X1 - 0.02, y, (Z0 + BACK) / 2, room, BACK - Z0 - 0.02);
      fillShelf('z', BACK + 0.01, Z1 - 0.01, y, (X0 + LEFT) / 2, room, LEFT - X0 - 0.02);
    });

    // and the floor, along the left wall under the shelves and in the front corner
    // (clear of the vacuum cleaner standing at the back, decorate())
    const FLOOR = 0.012;
    const floorPut = (id, x, z, opts = {}) => stocks[k].place(id, x, FLOOR, z, opts.yaw ?? rnd() * TAU, floorSec, 0, opts);
    floorPut('bottleCrate', X0 + 0.16, 0.79, { yaw: Math.PI / 2 }); // the crate of empties, waiting to go back to the shop
    floorPut('emmer', X0 + 0.15, 0.44);
    const boxes = floorPut('doosDiversen', X0 + 0.19, 0.08, { yaw: Math.PI / 2 + 0.03 });
    stocks[k].place('doosBoeken', X0 + 0.18, FLOOR + 2 * half('doosDiversen')[1], 0.09, Math.PI / 2 - 0.06, floorSec, 0, { on: boxes });
    floorPut('wcRol', X0 + 0.1, -0.26, { yaw: 0.3 });
    floorPut('wcRol', X0 + 0.22, -0.3, { yaw: 1.1 });
    floorPut('waspoeder', X0 + 0.14, -0.5, { yaw: 0.1 });
    floorPut('bootGreen', -2.2, 0.88, { yaw: 0.2 });
    floorPut('bootGreen', -2.05, 0.82, { yaw: 0.35 });
    floorPut('paintWhite', -1.97, 0.32);
    floorPut('ball', -2.0, 0.08);

    // Bumping into the shelves brings down what's near; a smashed door lets it all out.
    const out = new THREE.Vector3(1, 0, 0);
    const DOOR = { x: X1, z0: -0.33, z1: 0.43, y: 1.95 }; // the doorway, leaving room for a product's own size
    /**
     * Products move in straight lines across the floor plan, so a product
     * heading for the cupboard's door wall is aimed through the doorway
     * instead (and low enough to clear its top), in or out.
     */
    function steer() {
      for (const s of secs) {
        for (const item of s.items) {
          if (item.state !== 'flying' || item.t > 0) continue;
          const p = item.pos;
          const v = item.vel;
          const side = p.x - DOOR.x;
          if (side * v.x >= 0) continue; // moving away from the wall, or along it
          const t = -side / v.x;
          const z = p.z + v.z * t;
          const zz = Math.min(DOOR.z1, Math.max(DOOR.z0, z));
          if (zz !== z) v.z = (zz - p.z) / t;
          if (p.y + v.y * t - 4.9 * t * t > DOOR.y) v.y = (DOOR.y - p.y + 4.9 * t * t) / t;
        }
      }
    }
    for (const solid of [back, left]) {
      solid.surface.tally = 'mess';
      solid.surface.mess = ROOM_MESS.storage;
      solid.surface.onHit = (point, strength, push) => {
        const n = stocks[k].knock(shelfSec, point, out, strength, push, { radius: 0.5 + strength * 0.1, chance: 0.9, power: 1.1 });
        steer();
        return n;
      };
    }
    /** The door's smashed: out it all comes. Returns how many things and the shouts for it. */
    function spill() {
      const at = new THREE.Vector3((X0 + X1) / 2, 1.2, (Z0 + Z1) / 2);
      let n = stocks[k].knock(shelfSec, at, out, 10, null, { radius: 3, chance: 1, power: 1.35 });
      n += stocks[k].knock(floorSec, at.setY(0.2), out, 10, null, { radius: 3, chance: 0.9, power: 1.2 });
      steer();
      return { n, mess: ROOM_MESS.storage };
    }
    return { spill, steer };
  }

  function decorate() {
    const add = (k, mesh, cast = true) => {
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      groups[k].add(mesh);
      return mesh;
    };
    const mesh = (geo, m, x, y, z) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      return o;
    };
    // the kitchen sink and tap in the counter, in the middle under the window (x 0.8 to 3.0)
    const SINK_X = 1.9;
    const steelM = std({ color: 0xb8bec4, roughness: 0.25, metalness: 0.8 });
    add(0, mesh(Box(0.6, 0.006, 0.48), steelM, SINK_X, 0.903, 4.52), false);
    add(0, mesh(Box(0.5, 0.004, 0.4), std({ color: 0x6d7378, roughness: 0.3, metalness: 0.6 }), SINK_X, 0.907, 4.52), false);
    add(0, mesh(Cyl(0.015, 0.015, 0.3, 10), steelM, SINK_X, 1.05, 4.78));
    add(0, mesh(Cyl(0.012, 0.012, 0.18, 10).rotateX(Math.PI / 2), steelM, SINK_X, 1.19, 4.7));
    // two full trash bags just inside the door to the utility room (on the
    // living room side there's no room for them between the comfy chair and the closet)
    const bagM = std({ color: 0x1b1b1e, roughness: 0.25 });
    for (const [x, z, r, s] of [[2.4, -5.43, 0.28, 0], [2.88, -5.4, 0.24, 7]]) {
      add(0, mesh(heap(r, 1, 1.05, 1, s), bagM, x, r * 0.58, z));
      const knot = add(0, mesh(Cyl(0.02, 0.05, 0.1, 8), bagM, x, r * 1.65, z));
      knot.castShadow = false;
    }
    // spills and crumbs on the floors
    const spill = (k, x, z, r, color, opacity = 0.55) => {
      const m = std({ color, roughness: 0.2, transparent: true, opacity, depthWrite: false });
      const o = mesh(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2).scale(1, 1, 0.7), m, x, k * H + 0.022, z);
      o.rotation.y = x * 3;
      add(k, o, false);
    };
    spill(0, 2.4, -2.6, 0.25, 0x7b4a2a); // by the dining table
    spill(0, 2.5, 2.3, 0.18, 0xb3241b); // the kitchen floor
    spill(0, 1.4, 3.4, 0.3, 0x5a3a1c, 0.35);
    spill(0, -2.3, -2.2, 0.22, 0xf59a23); // in front of the couch
    spill(1, 1.6, 1.4, 0.2, 0x2a5bd7, 0.45); // felt-tip on the carpet
    // the vacuum cleaner, in the storage cupboard under the stairs
    const red = std({ color: 0xd8312a, roughness: 0.4 });
    const black = std({ color: 0x222222, roughness: 0.5 });
    add(0, mesh(Sph(0.18, 1.3, 0.85, 1), red, -2.2, 0.17, -0.3));
    add(0, mesh(Cyl(0.012, 0.012, 1.0, 8), black, -2.15, 0.55, 0.15)).rotation.x = -0.45;
    add(0, mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 16, Math.PI * 1.3), black, -2.15, 0.22, -0.05)).rotation.y = Math.PI / 2;
    add(0, mesh(Box(0.3, 0.04, 0.08), black, -2.15, 0.02, 0.58));
    // a droopy plant (it needs water) on the low TV cabinet, in the corner behind the TV
    // (its pot stands 2 mm above the cabinet's top, so their faces don't flicker)
    // A big one in a tall pot, its long leaves reaching up above the TV so it shows from the couch.
    const [px, pz, py] = [-3.17, -4.53, 0.502]; // peeking out past the TV's edge
    const potH = 0.4;
    add(0, mesh(Cyl(0.2, 0.15, potH, 16), std({ color: 0xb5652f, roughness: 0.8 }), px, py + potH / 2, pz));
    const leaf = std({ color: 0x7a8a3a, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 12; i++) {
      const l = add(0, mesh(new THREE.PlaneGeometry(0.14, 0.7).translate(0, 0.35, 0), leaf, px, py + potH - 0.03, pz));
      l.rotation.set(0.3 + (i % 3) * 0.22 + (i % 4 === 0 ? 0.4 : 0), (i / 12) * TAU + 0.2, 0, 'YXZ'); // a few droop
    }
    // the laundry basket in the bedroom
    const wicker = std({ color: 0xc9a77a, roughness: 0.9, side: THREE.DoubleSide });
    add(1, mesh(Cyl(0.26, 0.22, 0.42, 18, true), wicker, -0.45, H + 0.21, -1.9));
    // its bottom lies just above the floorboards (at 0.012), not level with them
    add(1, mesh(new THREE.CircleGeometry(0.22, 18).rotateX(-Math.PI / 2), wicker, -0.45, H + 0.016, -1.9), false);
    // a sleeve and a trouser leg caught in the wardrobe door
    add(1, mesh(Box(0.01, 0.55, 0.1), std({ color: 0xc0392b, roughness: 1 }), -0.105, H + 1.15, 3.55));
    add(1, mesh(Box(0.01, 0.7, 0.13), std({ color: 0x3a5a8c, roughness: 1 }), -0.105, H + 0.55, 3.85));
    // the clothes chair (solid)
    const chairM = std({ color: 0x9b6a3f, roughness: 0.7 });
    const cy = H;
    for (const [lx, lz] of [[-2.63, 4.2], [-2.27, 4.2], [-2.63, 4.58], [-2.27, 4.58]]) box([lx - 0.02, cy, lz - 0.02], [lx + 0.02, cy + 0.44, lz + 0.02], chairM, { story: 1, cast: true });
    box([-2.65, cy + 0.42, 4.18], [-2.23, cy + 0.46, 4.62], chairM, { story: 1, cast: true });
    box([-2.65, cy + 0.46, 4.58], [-2.23, cy + 0.95, 4.62], chairM, { story: 1, cast: true });
    body([-2.65, cy, 4.18], [-2.23, cy + 0.46, 4.62], physMats.hard, { kind: 'furniture' });
    body([-2.65, cy + 0.46, 4.58], [-2.23, cy + 0.95, 4.62], physMats.hard, { kind: 'furniture' });
    // the washing machine up in the attic bathroom, against the right-hand wall (solid)
    const y2 = 2 * H;
    const white = std({ color: 0xf4f2ee, roughness: 0.4 });
    box([3.25, y2, -0.75], [3.875, y2 + 0.85, -0.15], white, { story: 2, cast: true });
    body([3.25, y2, -0.75], [3.875, y2 + 0.85, -0.15], physMats.hard, { kind: 'furniture' });
    const door = add(2, mesh(Cyl(0.19, 0.19, 0.03, 24).rotateZ(Math.PI / 2), std({ color: 0x9aa3ad, roughness: 0.3, metalness: 0.5 }), 3.24, y2 + 0.42, -0.45));
    door.castShadow = false;
    add(2, mesh(Cyl(0.14, 0.14, 0.035, 24).rotateZ(Math.PI / 2), std({ color: 0x3b4a5a, roughness: 0.1 }), 3.235, y2 + 0.42, -0.45), false);
    add(2, mesh(Box(0.02, 0.08, 0.5), std({ color: 0xd9dcdf, roughness: 0.4 }), 3.245, y2 + 0.79, -0.45), false);
  }

  // ---------------------------------------------------------------- what the rest of the game uses
  /**
   * Lennie hit something at `point` this hard: the clutter around it goes
   * flying, the things already on the floor too. Returns how many things
   * left their place (not counting ones kicked about again) as `n`, and the
   * popup lines for the room where most of them came from as `mess`.
   */
  function scatter(point, strength, push) {
    const k = THREE.MathUtils.clamp(Math.floor((point.y + 0.3) / H), 0, 2);
    let n = 0;
    let most = 0;
    let mess = null;
    for (const sec of sections[k]) {
      const r = sec.bounds;
      if (point.x < r.x0 - 0.3 || point.x > r.x1 + 0.3 || point.z < r.z0 - 0.3 || point.z > r.z1 + 0.3) continue;
      const m = stocks[k].knock(sec, point, null, strength, push, {
        radial: true, again: true, fresh: sec.fresh !== false, chance: 0.9, power: 0.75, radius: Math.min(0.85, 0.25 + strength * 0.05),
      });
      n += m;
      if (m > most && ROOM_MESS[sec.name]) {
        most = m;
        mess = ROOM_MESS[sec.name];
      }
    }
    if (k === 0) storage.steer(); // through the storage cupboard's doorway, not its walls
    return { n, mess };
  }

  const spots = [
    { id: 'washer', label: 'In the wash!', value: 250, say: 'SPIN!', min: [3.2, 2 * H + 0.8, -0.8], max: [3.9, 2 * H + 1.5, -0.1] },
  ];

  return {
    scatter,
    spots,
    spillStorage: storage.spill, // house.js: when the storage cupboard's door is smashed
    doors: closet.doors, // the board game closet's doors, which house.js smashes and mends like its own
    update: (dt) => {
      for (const s of stocks) s.update(dt);
      tvCabinet.update(dt);
      wallCupboard.update(dt);
    },
    /** How many plates, mugs and glasses smashed since the last call, and where the last one did. */
    takeSmashes: () => {
      let n = 0;
      let point = null;
      for (const s of stocks) {
        const m = s.takeSmashes();
        if (m.n) {
          n += m.n;
          point = m.point;
        }
      }
      return { n, point };
    },
    restock: () => {
      for (const s of stocks) s.restock();
      tvCabinet.reset();
      wallCupboard.reset();
    },
  };
}
