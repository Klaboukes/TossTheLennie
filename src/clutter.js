import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStock, PRODUCTS, halfSize } from './products.js';
import { canvasTexture } from './supermarket.js';

// The mess in Lennie's house: dirty dishes in the kitchen, toys all over the
// living room and the kids room, clothes everywhere in the bedrooms, and the
// usual household stuff (washing-up liquid, loo rolls, shampoo, a vacuum
// cleaner...). And in the living room a tall closet stuffed with Dutch board
// games, which empties itself all over the floor when Lennie crashes into it.
//
// The small things are loose "products" (products.js): they have no physics
// bodies, so they never get in Lennie's way, but when he lands among them or
// crashes into the table they're on, they go flying and tumble to the floor.
// The board game boxes spill their pawns, dice, cards and puzzle pieces as
// they go. A few bigger things (trash bags, the laundry basket, the vacuum
// cleaner, the plant) are only decoration; the closet, the clothes chair and
// the washing machine are solid furniture.
//
// The names on the packaging and the boxes are plain Dutch words, no brands.

const TAU = Math.PI * 2;
const INK = '#2b2b2b';

// The rooms, as their inner wall faces (x, z) on each floor (k).
const ROOMS = {
  living: { k: 0, x0: -5.875, x1: 0.91, z0: -2.31, z1: 4.875 },
  kitchen: { k: 0, x0: 1.09, x1: 5.875, z0: -2.31, z1: 4.875 },
  bedroom: { k: 1, x0: -5.875, x1: 0.91, z0: -2.31, z1: 4.875 },
  kids: { k: 1, x0: 1.09, x1: 5.875, z0: -2.31, z1: 4.875 },
  study: { k: 2, x0: -5.875, x1: 0.91, z0: -2.31, z1: 3.9 }, // the roof slopes down towards the front
  bath: { k: 2, x0: 1.09, x1: 5.875, z0: -2.31, z1: 3.8 },
};

// Where the furniture stands in each room, so things strewn on the floor stay clear of it.
const FURNITURE = {
  living: [[-5.875, -4.85, 0.2, 3.2], [-4.2, -2.9, 0.9, 2.5], [0.25, 0.91, 2.2, 4.0], [-3.4, -1.2, -2.31, -1.6], [0.2, 0.91, -2.31, -1.4], [-5.875, -5.2, 4.1, 4.875]],
  kitchen: [[5.1, 5.875, -2.31, 4.75], [1.7, 4.6, 1.3, 3.4], [4.2, 5.1, 4.1, 4.875]],
  bedroom: [[-5.875, -3.6, 0.5, 3.1], [0.2, 0.91, 2.5, 4.5], [-3.35, -2.6, 3.9, 4.875], [-0.8, -0.1, -2.31, -1.5]],
  kids: [[3.9, 5.875, -2.31, -1.1], [1.9, 3.1, 4.1, 4.875], [3.0, 4.2, 2.4, 3.6]],
  study: [[-5.875, -5.0, -1.7, 0.3], [-4.95, -4.25, -1.05, -0.35], [-3.1, -1.3, -2.31, -1.85], [-1.3, 0.91, 2.1, 3.9]],
  bath: [[2.55, 4.6, 2.65, 3.8], [5.1, 5.875, -1.75, -0.95], [4.9, 5.875, 0.1, 1.5], [5.2, 5.875, -0.85, -0.05]],
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
    [new THREE.CircleGeometry(0.11, 20).rotateX(Math.PI / 2).translate(0, -0.0175, 0), panM],
    [new THREE.CircleGeometry(0.06, 14).rotateX(-Math.PI / 2).translate(0.02, -0.012, 0.01), mat(0xf6d04d, { roughness: 0.4 })],
    [at(Box(0.18, 0.015, 0.03), 0.22, 0.01, 0), mat(0x5a3a1c)],
  ]);
  C.cutlery = item(Box(0.18, 0.004, 0.018), mat(0xc9ced3, { roughness: 0.25, metalness: 0.8 }));
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
  // tiny things cast no shadows (there are hundreds of them)
  for (const [id, p] of Object.entries(C)) {
    if (PRODUCTS[id] || p.base) continue;
    const [hx, hy, hz] = halfSize(p);
    if (Math.max(hx, hy, hz) < 0.06) p.shadow = false;
  }
  return C;
}

// ---------------------------------------------------------------- building it all
export function buildClutter({ box, body, groups, std, physMats, H }) {
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
    [0, -4.1, -3.0, 1.0, 2.4, 0.45], // coffee table
    [0, 0.35, 0.88, 2.3, 3.9, 0.5], // TV cabinet
    [0, -5.5, -4.95, 0.55, 2.85, 0.52], // couch seat
    [0, 2.4, 3.9, 1.5, 3.2, 0.78], // dining table
    [0, 5.2, 5.875, -2.25, 3.45, 0.9], // kitchen counter
    [0, 5.1, 5.875, 3.6, 4.65, 1.95], // fridge
    [1, -5.78, -3.7, 0.6, 2.4, 0.61], // bed
    [1, -5.85, -5.4, 2.55, 3.0, 0.5], // nightstand
    [1, 0.3, 0.89, 2.6, 4.4, 2.0], // wardrobe
    [1, -3.3, -2.86, 4.18, 4.62, 0.46], // clothes chair
    [1, 4.0, 5.875, -2.25, -1.2, 0.52], // kids bed
    [1, 2.0, 3.0, 4.2, 4.85, 0.5], // toy box
    [2, -5.875, -5.1, -1.6, 0.2, 0.76], // desk
    [2, -1.2, 0.85, 2.2, 3.1, 0.45], // armchair
    [2, 5.0, 5.875, 0.2, 1.4, 0.85], // bathroom cabinet
    [2, 5.25, 5.875, -0.75, -0.15, 0.85], // washing machine
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

  /** Puts something in a room: (x, z), y above that floor; yaw random unless given. */
  function put(room, id, x, y, z, { yaw = rnd() * TAU, ...opts } = {}) {
    const sec = rooms[room];
    return stocks[sec.k].place(id, x, sec.k * H + y, z, yaw, sec, 0, opts);
  }
  /** A pile of the same thing (plates, books), each resting on the one below. */
  function pile(room, id, x, y, z, n, { yaw = rnd() * TAU, jitter = 0.012 } = {}) {
    const h = 2 * half(id)[1];
    let below = null;
    for (let i = 0; i < n; i++) below = put(room, id, x + (rnd() - 0.5) * jitter, y + i * h, z + (rnd() - 0.5) * jitter, { yaw: yaw + (rnd() - 0.5) * 0.3, on: below });
    return below;
  }
  /** Things strewn over the floor of a room, clear of its furniture. */
  function strew(room, ids, n, { area = null, how = null } = {}) {
    const r = area ?? ROOMS[room];
    const avoid = FURNITURE[room] ?? [];
    for (let i = 0; i < n; i++) {
      const id = ids[Math.floor(rnd() * ids.length)];
      const reach = Math.max(...half(id)) + 0.05;
      for (let tries = 0; tries < 25; tries++) {
        const x = r.x0 + reach + rnd() * (r.x1 - r.x0 - 2 * reach);
        const z = r.z0 + reach + rnd() * (r.z1 - r.z0 - 2 * reach);
        if (avoid.some(([x0, x1, z0, z1]) => x > x0 - reach && x < x1 + reach && z > z0 - reach && z < z1 + reach)) continue;
        put(room, id, x, 0, z, how?.(id) ?? {});
        break;
      }
    }
  }
  const lying = (id) => (/^(cola|sinas|water|limo|icetea|afwas|allesreiniger|shampoo|douchegel|crayon|mikado|wcRol)/.test(id) && rnd() < 0.7 ? tipped(id) : {});

  // ---------------------------------------------------------------- living room
  const living = 'living';
  // the coffee table: snacks, drinks and the remote
  put(living, 'chipsPaprika', -3.75, 0.45, 1.35, { yaw: 0.4, ...onFace('chipsPaprika') });
  put(living, 'cola', -3.3, 0.45, 2.15, { yaw: 1.2, ...tipped('cola') });
  put(living, 'mugRed', -3.2, 0.45, 1.25);
  put(living, 'mugBlue', -3.85, 0.45, 2.15);
  put(living, 'plateC', -3.5, 0.45, 1.75);
  put(living, 'remote', -3.25, 0.45, 1.7, { yaw: 0.3 });
  put(living, 'magazine', -3.85, 0.45, 1.8, { yaw: 0.2 });
  put(living, 'magazine', -3.82, 0.456, 1.78, { yaw: -0.3 });
  // the TV cabinet: the game console's controllers
  put(living, 'controller', 0.62, 0.5, 2.55, { yaw: 1.4 });
  put(living, 'controller', 0.7, 0.5, 3.6, { yaw: 2.0 });
  // the couch: a blanket, a cushion on the floor, crisps
  put(living, 'blanket', -5.25, 0.52, 2.2, { yaw: 0.3 });
  put(living, 'cushion', -4.55, 0, 3.55, { yaw: 0.6 });
  put(living, 'chipsNaturel', -5.2, 0.52, 1.0, { yaw: 1.2, ...onFace('chipsNaturel') });
  // toys, toys, toys
  const toys = ['blockA', 'blockB', 'blockC', 'blockD', 'brickRed', 'brickBlue', 'brickYellow', 'brickWhite', 'carRed', 'carBlue', 'crayonRed', 'crayonGreen'];
  strew(living, toys, 34, { how: lying });
  strew(living, ['blockA', 'blockB', 'brickRed', 'brickYellow', 'carYellow', 'teddy', 'drawing'], 10, { area: { x0: -4.9, x1: -2.2, z0: 0.3, z1: 3.2 }, how: lying });
  put(living, 'beachBall', -1.0, 0, 3.6);
  put(living, 'ball', -4.4, 0, -0.9);
  put(living, 'teddy', -1.7, 0, 0.3, { yaw: 2.2 });
  put(living, 'drawing', -2.6, 0, 2.6, { yaw: 0.3 });
  // a tower of blocks somebody built
  const tower = ['blockA', 'blockC', 'blockB', 'blockD', 'blockA'];
  let below = null;
  tower.forEach((id, i) => (below = put(living, id, -0.6, i * 0.07, 2.2, { yaw: 0.2 * i, on: below })));
  // shoes kicked off by the front door, and a pair of socks
  put(living, 'sneaker', -1.75, 0, 4.45, { yaw: 1.3 });
  put(living, 'sneaker', -1.35, 0, 4.2, { yaw: 2.4 });
  put(living, 'shoeBlack', -2.5, 0, 4.5, { yaw: -0.4 });
  put(living, 'sockBlack', -4.4, 0, 3.4);
  put(living, 'sockRed', -0.8, 0, 1.1);

  // ---------------------------------------------------------------- kitchen
  const kitchen = 'kitchen';
  // the counter: piles of dirty dishes, pans, bottles and jars
  pile(kitchen, 'plate', 5.55, 0.9, -1.8, 6);
  pile(kitchen, 'plateB', 5.55, 0.9, -1.35, 4);
  pile(kitchen, 'bowl', 5.5, 0.9, -0.9, 3, { jitter: 0.02 });
  pile(kitchen, 'plateC', 5.6, 0.9, 1.35, 5);
  put(kitchen, 'pot', 5.55, 0.9, 1.9);
  put(kitchen, 'pan', 5.5, 0.9, 2.65, { yaw: Math.PI + 0.3 });
  put(kitchen, 'afwas', 5.75, 0.9, 0.95);
  put(kitchen, 'allesreiniger', 5.78, 0.9, -2.1);
  for (const [id, z] of [['mugRed', -0.45], ['mugYellow', -0.3], ['mugWhite', 1.05], ['glass', -0.6], ['glass', 1.65], ['mugBlue', 3.2]]) put(kitchen, id, 5.32 + rnd() * 0.25, 0.9, z);
  for (const z of [-1.1, 1.6, 2.3, 2.35, 3.0]) put(kitchen, 'cutlery', 5.4 + rnd() * 0.2, 0.9, z);
  put(kitchen, 'pindakaas', 5.75, 0.9, 2.2);
  put(kitchen, 'hagelslag', 5.78, 0.9, 3.05, { yaw: -Math.PI / 2 });
  put(kitchen, 'witbrood', 5.6, 0.9, -2.1, { yaw: -Math.PI / 2 });
  put(kitchen, 'melk', 5.35, 0.9, 3.3);
  put(kitchen, 'stroopwafels', 5.38, 1.95, 4.2); // on top of the fridge
  put(kitchen, 'chocolade', 5.5, 1.95, 3.9, { yaw: 0.6 });
  // the dining table: breakfast nobody cleared away
  for (const [id, x, z] of [['plate', 2.75, 1.8], ['plateB', 3.55, 2.9], ['plateC', 3.55, 1.85], ['bowl', 2.75, 2.85]]) put(kitchen, id, x, 0.78, z);
  put(kitchen, 'glass', 3.1, 0.78, 2.3);
  put(kitchen, 'mugWhite', 3.3, 0.78, 2.6);
  put(kitchen, 'glass', 2.95, 0.78, 2.55, tipped('glass'));
  put(kitchen, 'jam', 3.2, 0.78, 2.0);
  put(kitchen, 'krentenbol', 3.25, 0.78, 3.05, { yaw: 0.4 });
  put(kitchen, 'chocomelk', 2.6, 0.78, 2.35, tipped('chocomelk'));
  for (const [x, z] of [[2.9, 1.75], [3.75, 2.75], [2.6, 2.95], [3.4, 1.9]]) put(kitchen, 'cutlery', x, 0.78, z);
  // the floor
  put(kitchen, 'pizzaBox', 1.7, 0, 4.2, { yaw: 0.3 });
  put(kitchen, 'pizzaBox', 1.75, 0.04, 4.18, { yaw: 0.6 });
  put(kitchen, 'plateB', 4.4, 0, 0.2);
  strew(kitchen, ['limo', 'icetea', 'cola', 'sockWhite', 'chipsNaturel', 'cutlery', 'krentenbol', 'mugBlue', 'drop', 'snoepmix'], 14, {
    how: (id) => (id.startsWith('chips') || id === 'drop' || id === 'snoepmix' ? onFace(id) : lying(id)),
  });

  // ---------------------------------------------------------------- bedroom
  const bedroom = 'bedroom';
  const clothes = ['shirtRed', 'shirtBlue', 'shirtWhite', 'shirtGreen', 'jeans', 'sockWhite', 'sockBlack', 'sockRed', 'underpants', 'boxers', 'heapGrey', 'heapRed', 'heapBlue'];
  strew(bedroom, clothes, 30);
  strew(bedroom, ['shirtWhite', 'jeans', 'heapBlue', 'sockBlack', 'shirtRed'], 6, { area: { x0: -3.5, x1: -0.5, z0: 0.2, z1: 3.0 } });
  // on the bed
  put(bedroom, 'shirtBlue', -4.3, 0.61, 1.1, { yaw: 0.4 });
  put(bedroom, 'jeans', -4.6, 0.61, 1.9, { yaw: 1.8 });
  put(bedroom, 'heapGrey', -5.1, 0.61, 1.5);
  put(bedroom, 'phone', -5.35, 0.61, 2.05, { yaw: 0.2 });
  // the chair everyone has: buried under clothes
  let chairPile = null;
  let chairTop = 0.46;
  for (const id of ['jeans', 'shirtWhite', 'heapBlue', 'heapRed', 'shirtGreen', 'heapGrey']) {
    chairPile = put(bedroom, id, -3.08 + (rnd() - 0.5) * 0.06, chairTop, 4.4 + (rnd() - 0.5) * 0.06, { on: chairPile });
    chairTop += entry(id).h * 0.8; // clothes squash a bit
  }
  // the nightstand
  put(bedroom, 'mugYellow', -5.55, 0.5, 2.68);
  put(bedroom, 'glass', -5.7, 0.5, 2.9);
  put(bedroom, 'bookRed', -5.6, 0.5, 2.82, { yaw: 0.3 });
  // the laundry basket, overflowing (the basket itself is decoration)
  for (const [id, dx, dz, y] of [['heapGrey', 0, 0, 0.36], ['shirtRed', 0.05, 0.03, 0.47], ['sockWhite', -0.08, 0.06, 0.48], ['heapBlue', -0.05, -0.05, 0.42]]) put(bedroom, id, -0.45 + dx, y, -1.9 + dz);
  put(bedroom, 'waspoeder', -0.15, 0, -2.15, { yaw: 0.2 });
  put(bedroom, 'slipper', -3.4, 0, 0.35, { yaw: 1.4 });
  put(bedroom, 'slipper', -3.1, 0, 0.25, { yaw: 2.0 });

  // ---------------------------------------------------------------- kids room
  const kids = 'kids';
  strew(kids, [...toys, 'teddy', 'beachBall', 'ball', 'carYellow', 'drawing', 'crayonBlue', 'duck'], 46, { how: lying });
  strew(kids, ['shirtKid', 'shirtKidPink', 'jeansKid', 'sockRed', 'sockWhite', 'slipper'], 10);
  // on top of the toy box, and on the bed
  put(kids, 'teddy', 2.3, 0.5, 4.5, { yaw: 0.3 });
  put(kids, 'carRed', 2.75, 0.5, 4.45, { yaw: 1.1 });
  put(kids, 'blockC', 2.55, 0.5, 4.65);
  put(kids, 'ball', 2.1, 0.5, 4.7);
  put(kids, 'shirtKid', 4.6, 0.52, -1.8, { yaw: 0.6 });
  put(kids, 'teddy', 5.5, 0.52, -1.95, { yaw: -1.4 });
  put(kids, 'bookBlue', 3.6, 0.72, 3.0, { yaw: 0.8 }); // on the beanbag
  // a block tower and a crayon drawing session on the rug
  below = null;
  ['blockB', 'blockD', 'blockA', 'blockC'].forEach((id, i) => (below = put(kids, id, 2.2, i * 0.07, 2.0, { yaw: 0.3 * i, on: below })));
  for (const [x, z, r] of [[3.0, 1.7, 0.2], [3.3, 1.9, -0.5]]) put(kids, 'drawing', x, 0, z, { yaw: r });
  for (const id of ['crayonRed', 'crayonBlue', 'crayonGreen']) put(kids, id, 3.0 + rnd() * 0.5, 0.002, 1.6 + rnd() * 0.5, tipped(id));

  // ---------------------------------------------------------------- attic study
  const study = 'study';
  put(study, 'pizzaBox', -5.48, 0.76, -0.5, { yaw: 0.1 });
  put(study, 'limo', -5.3, 0.76, -1.35, tipped('limo'));
  put(study, 'icetea', -5.6, 0.76, 0.05);
  put(study, 'cola', -5.25, 0.76, -0.9);
  put(study, 'mugWhite', -5.3, 0.76, 0.0);
  for (const [x, z, r] of [[-5.55, -1.25, 0.1], [-5.45, -1.2, -0.3], [-5.5, 0.05, 1.5]]) put(study, 'paper', x, 0.76, z, { yaw: r });
  pile(study, 'bookGreen', -5.6, 0.76, -1.45, 3);
  strew(study, ['paper', 'paper', 'bookRed', 'bookBlue', 'limo', 'icetea', 'heapGrey', 'sockBlack', 'chipsPaprika', 'magazine'], 20, {
    area: { x0: ROOMS.study.x0, x1: ROOMS.study.x1, z0: ROOMS.study.z0, z1: 2.6 },
    how: (id) => (id.startsWith('chips') ? onFace(id) : lying(id)),
  });
  // boxes of stuff, waiting to go up to the loft since the day they moved in
  const doos = put(study, 'doos', -2.3, 0, 0.9, { yaw: 0.15 });
  put(study, 'doos', -2.25, 0.32, 0.88, { yaw: -0.1, on: doos });
  put(study, 'doos', -0.4, 0, -1.6, { yaw: 0.4 });
  put(study, 'blanket', -0.15, 0.45, 2.6, { yaw: 1.0 }); // in the armchair
  put(study, 'bookBlue', 0.3, 0.45, 2.3, { yaw: 0.4 });

  // ---------------------------------------------------------------- attic bathroom
  const bath = 'bath';
  put(bath, 'duck', 3.2, 0.14, 3.2, { yaw: 0.4 });
  put(bath, 'duck', 3.9, 0.14, 3.0, { yaw: 2.5 });
  put(bath, 'shampoo', 4.44, 0.55, 2.82);
  put(bath, 'douchegel', 2.71, 0.55, 3.68);
  put(bath, 'tandpasta', 5.4, 0.85, 0.5, { yaw: 1.3 });
  put(bath, 'mugWhite', 5.6, 0.85, 0.9);
  put(bath, 'douchegel', 5.65, 0.85, 1.2, tipped('douchegel'));
  put(bath, 'waspoeder', 5.55, 0.85, -0.45, { yaw: -Math.PI / 2 });
  pile(bath, 'wcRol', 5.0, 0, -1.6, 3, { jitter: 0.01 });
  put(bath, 'wcRol', 4.6, 0, -0.6, tipped('wcRol'));
  put(bath, 'emmer', 4.7, 0, 1.9);
  strew(bath, ['towelWhite', 'towelBlue', 'heapGrey', 'sockWhite', 'underpants', 'shirtWhite', 'shampoo', 'wcRol'], 12, { how: lying });

  // ---------------------------------------------------------------- the board game closet
  const closet = buildCloset();

  for (const s of stocks) s.build();

  // ---------------------------------------------------------------- decoration (no physics)
  decorate();

  function buildCloset() {
    const k = 0;
    const X0 = -3.3;
    const X1 = -1.3;
    const Z0 = -2.31;
    const Z1 = -1.81;
    const TOP = 2.05;
    const T = 0.03;
    const oak = std({ color: 0xc9a06a, roughness: 0.6 });
    const inside = std({ color: 0xb08a58, roughness: 0.7 });
    const b = (min, max, m) => box(min, max, m, { story: k, cast: true });
    b([X0, 0, Z0], [X0 + T, TOP, Z1], oak);
    b([X1 - T, 0, Z0], [X1, TOP, Z1], oak);
    b([X0, 0, Z0], [X1, TOP, Z0 + 0.02], inside);
    b([(X0 + X1) / 2 - T / 2, 0.08, Z0], [(X0 + X1) / 2 + T / 2, TOP - T, Z1 - 0.01], oak);
    b([X0, 0, Z1 - 0.04], [X1, 0.08, Z1], oak); // plinth
    const shelves = [0.08, 0.47, 0.86, 1.25, 1.64];
    for (const y of [...shelves, TOP - T]) b([X0, y - (y === 0.08 ? 0.08 : 0), Z0], [X1, y + (y === 0.08 ? 0 : T), Z1], oak);
    b([X0 - 0.02, TOP, Z0], [X1 + 0.02, TOP + 0.04, Z1 + 0.03], oak); // the crown on top
    const solid = body([X0, 0, Z0], [X1, TOP + 0.12, Z1], physMats.hard, { kind: 'furniture' });

    // the sjoelbak lies on top, with puzzles and a few games piled on it
    const sjoel = std({ color: 0xe0c08a, roughness: 0.5 });
    b([X0 + 0.02, TOP + 0.04, Z0 + 0.05], [X1 - 0.02, TOP + 0.08, Z1 - 0.03], sjoel);
    b([X0 + 0.02, TOP + 0.08, Z0 + 0.05], [X1 - 0.02, TOP + 0.1, Z0 + 0.08], sjoel);
    b([X0 + 0.02, TOP + 0.08, Z1 - 0.06], [X1 - 0.02, TOP + 0.1, Z1 - 0.03], sjoel);

    const sec = stocks[k].section({ bounds: ROOMS.living, floorY: 0.012, k, name: 'closet', fresh: false });
    sections[k].push(sec);
    const games = GAMES.map((g) => g.id);
    let bag = [];
    const nextGame = () => {
      if (!bag.length) bag = [...games].sort(() => rnd() - 0.5);
      return bag.pop();
    };
    /** A pile of game boxes, biggest at the bottom, with their pieces inside. */
    function gamePile(cx, y, z, maxH) {
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
    const cols = [[X0 + T, (X0 + X1) / 2 - T / 2], [(X0 + X1) / 2 + T / 2, X1 - T]];
    shelves.forEach((y, i) => {
      const shelfTop = y + (i === 0 ? 0 : T);
      const ceiling = (shelves[i + 1] ?? TOP - T) - 0.01;
      for (const [a, c] of cols) {
        const w = c - a;
        gamePile(a + w * 0.27, shelfTop, Z1 - 0.22, ceiling - shelfTop - 0.01);
        gamePile(a + w * 0.73, shelfTop, Z1 - 0.22, ceiling - shelfTop - 0.01);
      }
    });
    gamePile(X0 + 0.45, TOP + 0.08, Z1 - 0.24, 0.3);
    gamePile(X1 - 0.5, TOP + 0.08, Z1 - 0.24, 0.22);
    // a stack of sjoel pucks in the corner of the sjoelbak
    let puck = null;
    for (let i = 0; i < 8; i++) puck = stocks[k].place('sjoelschijf', X0 + 1.0 + (rnd() - 0.5) * 0.01, TOP + 0.08 + i * 0.012, Z1 - 0.2, 0, sec, 0, { on: puck });

    // Crashing into it empties it: the harder, the more of it comes down.
    // Everything falls out of the front, and the games spill as they go.
    const out = new THREE.Vector3(0, 0, 1);
    solid.surface.tally = 'games';
    solid.surface.mess = 'Board game avalanche!';
    solid.surface.onHit = (point, strength, push) => stocks[k].knock(sec, point, out, strength, push, {
      radius: 0.5 + strength * 0.12,
      chance: 0.9,
      power: 1.15,
    });
    return { x0: X0, x1: X1, z0: Z0, z1: Z1, top: TOP };
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
    // the kitchen sink and tap in the counter, with a dish rack
    const steelM = std({ color: 0xb8bec4, roughness: 0.25, metalness: 0.8 });
    add(0, mesh(Box(0.48, 0.006, 0.6), steelM, 5.56, 0.903, 0.25), false);
    add(0, mesh(Box(0.4, 0.004, 0.5), std({ color: 0x6d7378, roughness: 0.3, metalness: 0.6 }), 5.56, 0.907, 0.25), false);
    add(0, mesh(Cyl(0.015, 0.015, 0.3, 10), steelM, 5.8, 1.05, 0.25));
    add(0, mesh(Cyl(0.012, 0.012, 0.18, 10).rotateZ(Math.PI / 2), steelM, 5.72, 1.19, 0.25));
    // two full trash bags by the fridge
    const bagM = std({ color: 0x1b1b1e, roughness: 0.25 });
    for (const [x, z, r, s] of [[4.75, 4.45, 0.3, 0], [4.35, 4.6, 0.25, 7]]) {
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
    spill(0, 3.1, 0.9, 0.25, 0x7b4a2a);
    spill(0, 4.6, 2.0, 0.18, 0xb3241b);
    spill(0, 2.1, 4.0, 0.3, 0x5a3a1c, 0.35);
    spill(0, -3.6, 0.6, 0.22, 0xf59a23);
    spill(1, 2.6, 1.4, 0.2, 0x2a5bd7, 0.45); // felt-tip on the carpet
    // the vacuum cleaner, left in the living room
    const red = std({ color: 0xd8312a, roughness: 0.4 });
    const black = std({ color: 0x222222, roughness: 0.5 });
    add(0, mesh(Sph(0.18, 1.3, 0.85, 1), red, 0.5, 0.17, -2.0));
    add(0, mesh(Cyl(0.012, 0.012, 1.0, 8), black, 0.55, 0.55, -1.55)).rotation.x = -0.45;
    add(0, mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 16, Math.PI * 1.3), black, 0.55, 0.22, -1.75)).rotation.y = Math.PI / 2;
    add(0, mesh(Box(0.3, 0.04, 0.08), black, 0.55, 0.02, -1.12));
    // a droopy plant in the corner (it needs water)
    add(0, mesh(Cyl(0.16, 0.12, 0.3, 14), std({ color: 0xb5652f, roughness: 0.8 }), -5.55, 0.15, 4.5));
    const leaf = std({ color: 0x7a8a3a, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const l = add(0, mesh(new THREE.PlaneGeometry(0.1, 0.4).translate(0, 0.2, 0), leaf, -5.55, 0.3, 4.5));
      l.rotation.set(1.1 + (i % 3) * 0.25, (i / 7) * TAU, 0, 'YXZ');
    }
    // the laundry basket in the bedroom
    const wicker = std({ color: 0xc9a77a, roughness: 0.9, side: THREE.DoubleSide });
    add(1, mesh(Cyl(0.26, 0.22, 0.42, 18, true), wicker, -0.45, H + 0.21, -1.9));
    add(1, mesh(new THREE.CircleGeometry(0.22, 18).rotateX(-Math.PI / 2), wicker, -0.45, H + 0.01, -1.9), false);
    // a sleeve and a trouser leg caught in the wardrobe door
    add(1, mesh(Box(0.01, 0.55, 0.1), std({ color: 0xc0392b, roughness: 1 }), 0.295, H + 1.15, 3.55));
    add(1, mesh(Box(0.01, 0.7, 0.13), std({ color: 0x3a5a8c, roughness: 1 }), 0.295, H + 0.55, 3.85));
    // the clothes chair (solid)
    const chairM = std({ color: 0x9b6a3f, roughness: 0.7 });
    const cy = H;
    for (const [lx, lz] of [[-3.28, 4.2], [-2.92, 4.2], [-3.28, 4.58], [-2.92, 4.58]]) box([lx - 0.02, cy, lz - 0.02], [lx + 0.02, cy + 0.44, lz + 0.02], chairM, { story: 1, cast: true });
    box([-3.3, cy + 0.42, 4.18], [-2.88, cy + 0.46, 4.62], chairM, { story: 1, cast: true });
    box([-3.3, cy + 0.46, 4.58], [-2.88, cy + 0.95, 4.62], chairM, { story: 1, cast: true });
    body([-3.3, cy, 4.18], [-2.88, cy + 0.46, 4.62], physMats.hard, { kind: 'furniture' });
    body([-3.3, cy + 0.46, 4.58], [-2.88, cy + 0.95, 4.62], physMats.hard, { kind: 'furniture' });
    // the washing machine up in the attic bathroom (solid)
    const y2 = 2 * H;
    const white = std({ color: 0xf4f2ee, roughness: 0.4 });
    box([5.25, y2, -0.75], [5.875, y2 + 0.85, -0.15], white, { story: 2, cast: true });
    body([5.25, y2, -0.75], [5.875, y2 + 0.85, -0.15], physMats.hard, { kind: 'furniture' });
    const door = add(2, mesh(Cyl(0.19, 0.19, 0.03, 24).rotateZ(Math.PI / 2), std({ color: 0x9aa3ad, roughness: 0.3, metalness: 0.5 }), 5.24, y2 + 0.42, -0.45));
    door.castShadow = false;
    add(2, mesh(Cyl(0.14, 0.14, 0.035, 24).rotateZ(Math.PI / 2), std({ color: 0x3b4a5a, roughness: 0.1 }), 5.235, y2 + 0.42, -0.45), false);
    add(2, mesh(Box(0.02, 0.08, 0.5), std({ color: 0xd9dcdf, roughness: 0.4 }), 5.245, y2 + 0.79, -0.45), false);
  }

  // ---------------------------------------------------------------- what the rest of the game uses
  /**
   * Lennie hit something at `point` this hard: the clutter around it goes
   * flying, the things already on the floor too. Returns how many things
   * left their place (not counting ones kicked about again).
   */
  function scatter(point, strength, push) {
    const k = THREE.MathUtils.clamp(Math.floor((point.y + 0.3) / H), 0, 2);
    let n = 0;
    for (const sec of sections[k]) {
      const r = sec.bounds;
      if (point.x < r.x0 - 0.3 || point.x > r.x1 + 0.3 || point.z < r.z0 - 0.3 || point.z > r.z1 + 0.3) continue;
      n += stocks[k].knock(sec, point, null, strength, push, {
        radial: true, again: true, fresh: sec.fresh !== false, chance: 0.9, power: 0.75, radius: Math.min(0.85, 0.25 + strength * 0.05),
      });
    }
    return n;
  }

  const spots = [
    { id: 'closet', label: 'On top of the game closet!', value: 450, say: 'GAME ON!', min: [closet.x0 - 0.1, closet.top, closet.z0 - 0.1], max: [closet.x1 + 0.1, closet.top + 0.8, closet.z1 + 0.25] },
    { id: 'washer', label: 'In the wash!', value: 250, say: 'SPIN!', min: [5.2, 2 * H + 0.8, -0.8], max: [5.9, 2 * H + 1.5, -0.1] },
  ];

  return {
    scatter,
    spots,
    update: (dt) => { for (const s of stocks) s.update(dt); },
    restock: () => { for (const s of stocks) s.restock(); },
  };
}
