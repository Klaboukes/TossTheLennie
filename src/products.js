import * as THREE from 'three';

// The supermarket's groceries: every product is a little model with its own
// cartoon packaging (bread in bags, milk cartons, cheese wheels, bottles of
// cola, soup cans...), drawn on canvases so there are no image files. The
// names are plain Dutch words, not real brands.
//
// All products of one kind share one InstancedMesh, so thousands of them cost
// a few draw calls. When Lennie crashes into a shelf, the products near the
// impact tumble off: they fly, bounce and come to rest on the floor (simple
// hand-rolled motion, not physics bodies, so they never slow the game down or
// get in Lennie's way). restock() puts everything back.

const PX_PER_M = 900; // texture resolution on the packaging
const INK = '#2b2b2b';

// ---------------------------------------------------------------- the catalogue
// shape: box (w × h × d, the w × h face looks out), can, jar, tub (cylinders
// r × h), wheel (a flat cylinder), ball, bottle.
// face: bg colour, optional band (a coloured stripe behind the name), fg
// (text colour), text (the name), sub (a small second line), art (a picture).
// stack: short products are stacked on top of each other on the shelf.
export const PRODUCTS = {
  // bread and breakfast
  volkoren: { shape: 'box', w: 0.26, h: 0.13, d: 0.12, face: { bg: '#f4ecd9', band: '#2f7d32', text: 'VOLKOREN', art: ['loaf', '#8a5a2b'] } },
  witbrood: { shape: 'box', w: 0.26, h: 0.13, d: 0.12, face: { bg: '#f4f6fb', band: '#3b7dd8', text: 'WITBROOD', art: ['loaf', '#e7bf7f'] } },
  krentenbol: { shape: 'box', w: 0.2, h: 0.1, d: 0.14, face: { bg: '#fbf3e4', band: '#e2231a', text: 'KRENTENBOLLEN', art: ['buns'] } },
  hagelslag: { shape: 'box', w: 0.11, h: 0.2, d: 0.06, face: { bg: '#2a1f1a', band: '#7b4a2a', fg: '#ffffff', text: 'HAGELSLAG', art: ['sprinkles'] } },
  ontbijtkoek: { shape: 'box', w: 0.26, h: 0.08, d: 0.09, stack: true, face: { bg: '#e8a33c', fg: '#5a2d0c', text: 'ONTBIJTKOEK', art: ['cake'] } },
  pindakaas: { shape: 'jar', r: 0.045, h: 0.13, lid: '#d22d2d', fill: '#a0662b', face: { bg: '#f2c14e', fg: '#c0392b', text: 'PINDAKAAS', art: ['peanut'] } },
  jam: { shape: 'jar', r: 0.04, h: 0.11, lid: '#e8e0d0', fill: '#b3122e', face: { bg: '#ffffff', fg: '#c0392b', text: 'AARDBEIEN', sub: 'jam', art: ['strawberry'] } },
  // dairy
  melk: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#ffffff', band: '#3b7dd8', text: 'MELK', sub: 'halfvol', art: ['cow'] } },
  karnemelk: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#ffffff', band: '#2e8b57', text: 'KARNEMELK', art: ['cow'] } },
  chocomelk: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#5b3a29', band: '#f6d04d', fg: '#5b3a29', text: 'CHOCOMELK', art: ['choco'] } },
  yoghurt: { shape: 'box', w: 0.09, h: 0.2, d: 0.09, face: { bg: '#ffffff', band: '#e86fa0', text: 'YOGHURT', art: ['strawberry'] } },
  vla: { shape: 'box', w: 0.09, h: 0.2, d: 0.09, face: { bg: '#f6d04d', band: '#8a5a3c', text: 'VLA', sub: 'vanille', art: ['custard'] } },
  boter: { shape: 'box', w: 0.13, h: 0.05, d: 0.07, stack: true, face: { bg: '#f3c64a', fg: '#1d4f9a', text: 'ROOMBOTER' } },
  eieren: { shape: 'box', w: 0.3, h: 0.07, d: 0.11, stack: true, face: { bg: '#c9bfae', fg: '#5a4632', text: 'EIEREN', art: ['eggs'] } },
  // cheese
  gouda: { shape: 'wheel', r: 0.16, h: 0.1, stack: true, rind: '#f2b632', face: { bg: '#f2b632', band: '#ffffff', fg: '#c0392b', text: 'GOUDA' } },
  belegen: { shape: 'wheel', r: 0.13, h: 0.09, stack: true, rind: '#e2972a', face: { bg: '#e2972a', band: '#ffffff', fg: '#1d4f9a', text: 'BELEGEN' } },
  jongkaas: { shape: 'box', w: 0.18, h: 0.04, d: 0.12, stack: true, face: { bg: '#f6d04d', band: '#3fae3a', text: 'JONG', art: ['cheese'] } },
  oudekaas: { shape: 'box', w: 0.18, h: 0.04, d: 0.12, stack: true, face: { bg: '#e8a33c', band: '#8a2a2a', text: 'OUD', art: ['cheese'] } },
  plakken: { shape: 'box', w: 0.14, h: 0.03, d: 0.14, stack: true, face: { bg: '#fff3c4', band: '#3b7dd8', text: 'PLAKKEN' } },
  edammer: { shape: 'ball', r: 0.07, face: { bg: '#d8312a' } },
  // sweets
  chipsPaprika: { shape: 'box', w: 0.2, h: 0.28, d: 0.07, face: { bg: '#e8473b', band: '#f6d04d', fg: '#c0392b', text: 'CHIPS', sub: 'paprika', art: ['chips'] } },
  chipsNaturel: { shape: 'box', w: 0.2, h: 0.28, d: 0.07, face: { bg: '#f6d04d', band: '#1d4f9a', text: 'CHIPS', sub: 'naturel', art: ['chips'] } },
  drop: { shape: 'box', w: 0.14, h: 0.2, d: 0.05, face: { bg: '#1b1b1b', band: '#e2231a', text: 'DROP', art: ['drop'] } },
  snoepmix: { shape: 'box', w: 0.14, h: 0.2, d: 0.05, face: { bg: '#f2a2b8', band: '#8e44ad', text: 'SNOEPMIX', art: ['candy'] } },
  chocolade: { shape: 'box', w: 0.16, h: 0.08, d: 0.02, stack: true, face: { bg: '#5b2a86', fg: '#ffffff', text: 'CHOCOLADE' } },
  stroopwafels: { shape: 'can', r: 0.05, h: 0.14, face: { bg: '#f6d04d', fg: '#7b3f00', text: 'STROOPWAFELS', art: ['waffle'] } },
  // drinks
  cola: { shape: 'bottle', r: 0.045, h: 0.32, body: '#3a1d12', cap: '#d8312a', face: { bg: '#d8312a', text: 'COLA' } },
  sinas: { shape: 'bottle', r: 0.045, h: 0.32, body: '#f59a23', cap: '#3b7dd8', face: { bg: '#3b7dd8', text: 'SINAS' } },
  water: { shape: 'bottle', r: 0.045, h: 0.32, body: '#cfe9f7', cap: '#3b7dd8', face: { bg: '#ffffff', fg: '#3b7dd8', text: 'WATER' } },
  jus: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#f59a23', band: '#3fae3a', text: "JUS D'ORANGE", art: ['orange'] } },
  appelsap: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#a5d36b', band: '#c0392b', text: 'APPELSAP', art: ['apple'] } },
  limo: { shape: 'can', r: 0.033, h: 0.12, stack: true, face: { bg: '#3fae3a', fg: '#ffffff', text: 'LIMO' } },
  icetea: { shape: 'can', r: 0.033, h: 0.12, stack: true, face: { bg: '#c8a24a', fg: '#ffffff', text: 'ICE TEA' } },
  // pasta and soup
  spaghetti: { shape: 'box', w: 0.08, h: 0.28, d: 0.04, face: { bg: '#1d4f9a', fg: '#ffffff', text: 'SPAGHETTI', art: ['spaghetti'] } },
  macaroni: { shape: 'box', w: 0.14, h: 0.22, d: 0.06, face: { bg: '#f6d04d', fg: '#c0392b', text: 'MACARONI', art: ['macaroni'] } },
  rijst: { shape: 'box', w: 0.13, h: 0.18, d: 0.07, face: { bg: '#ffffff', band: '#d8312a', text: 'RIJST', art: ['rice'] } },
  tomatensoep: { shape: 'can', r: 0.04, h: 0.11, stack: true, face: { bg: '#d8312a', fg: '#ffffff', text: 'TOMATENSOEP', art: ['tomato'] } },
  erwtensoep: { shape: 'can', r: 0.04, h: 0.11, stack: true, face: { bg: '#4a7f2f', fg: '#ffffff', text: 'ERWTENSOEP', art: ['peas'] } },
  pastasaus: { shape: 'jar', r: 0.045, h: 0.15, lid: '#e8b330', fill: '#b3241b', face: { bg: '#3fae3a', fg: '#ffffff', text: 'PASTASAUS', art: ['tomato'] } },
  // frozen
  pizza: { shape: 'box', w: 0.28, h: 0.28, d: 0.04, face: { bg: '#c0392b', band: '#f6d04d', fg: '#c0392b', text: 'PIZZA', art: ['pizza'] } },
  ijsVanille: { shape: 'tub', r: 0.1, h: 0.13, stack: true, lid: '#3b7dd8', face: { bg: '#f7e3b5', fg: '#3b7dd8', text: 'VANILLE-IJS', art: ['icecream', '#fff6d8'] } },
  ijsAardbei: { shape: 'tub', r: 0.1, h: 0.13, stack: true, lid: '#e2231a', face: { bg: '#f2a2b8', fg: '#a3123a', text: 'AARDBEIEN-IJS', art: ['icecream', '#f37fa0'] } },
  friet: { shape: 'box', w: 0.2, h: 0.3, d: 0.07, face: { bg: '#3b7dd8', band: '#e2231a', text: 'FRIET', art: ['fries'] } },
  doperwten: { shape: 'box', w: 0.2, h: 0.28, d: 0.06, face: { bg: '#2e8b57', band: '#ffffff', fg: '#2e8b57', text: 'DOPERWTEN', art: ['peas'] } },
  vissticks: { shape: 'box', w: 0.2, h: 0.06, d: 0.12, stack: true, face: { bg: '#3b7dd8', fg: '#ffffff', text: 'VISSTICKS', art: ['fish'] } },
};

// What goes on each shelf (bottom to top) of each aisle, the freezers and the drinks fridges.
export const ASSORTMENT = {
  BROOD: [['volkoren', 'witbrood'], ['witbrood', 'volkoren', 'krentenbol'], ['hagelslag', 'ontbijtkoek'], ['pindakaas', 'jam']],
  ZUIVEL: [['eieren', 'boter'], ['melk', 'karnemelk', 'chocomelk'], ['yoghurt', 'vla'], ['melk', 'vla', 'yoghurt']],
  KAAS: [['gouda', 'belegen'], ['jongkaas', 'oudekaas'], ['plakken', 'edammer'], ['gouda', 'jongkaas']],
  SNOEP: [['chipsPaprika', 'chipsNaturel'], ['drop', 'snoepmix'], ['chocolade', 'stroopwafels'], ['chipsNaturel', 'snoepmix', 'drop']],
  DRINKEN: [['water', 'cola'], ['cola', 'sinas'], ['jus', 'appelsap'], ['limo', 'icetea']],
  'PASTA & SOEP': [['rijst', 'macaroni'], ['spaghetti', 'macaroni'], ['tomatensoep', 'erwtensoep'], ['pastasaus']],
  DIEPVRIES: [['ijsVanille', 'ijsAardbei'], ['pizza', 'friet'], ['doperwten', 'vissticks']],
  FRISDRANK: [['water', 'appelsap'], ['cola', 'sinas', 'jus'], ['limo', 'icetea', 'cola']],
};

/** Size of a product as half extents (x across the front, y up, z depth). */
export function halfSize(p) {
  if (p.shape === 'box') return [p.w / 2, p.h / 2, p.d / 2];
  if (p.shape === 'ball') return [p.r, p.r, p.r];
  return [p.r, p.h / 2, p.r];
}

// ---------------------------------------------------------------- drawing the packaging
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.max(16, Math.round(w));
  c.height = Math.max(16, Math.round(h));
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };

/** Little pictures for the packaging, centred on (x, y), about s across. */
const ART = {
  loaf(g, x, y, s, color) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, s * 0.55, s * 0.3, 0, Math.PI, 0);
    g.lineTo(x + s * 0.55, y + s * 0.2);
    g.lineTo(x - s * 0.55, y + s * 0.2);
    g.closePath();
    g.fill(); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (const d of [-0.25, 0, 0.25]) { g.beginPath(); g.moveTo(x + d * s - s * 0.06, y - s * 0.18); g.lineTo(x + d * s + s * 0.06, y); g.stroke(); }
  },
  buns(g, x, y, s) {
    for (const dx of [-0.3, 0, 0.3]) {
      g.fillStyle = '#d99a4e'; circle(g, x + dx * s, y, s * 0.2); g.fill(); g.stroke();
      g.fillStyle = '#3a1d12';
      for (const [a, b] of [[-0.06, -0.04], [0.05, 0.03], [0, 0.08]]) { circle(g, x + dx * s + a * s, y + b * s, s * 0.025); g.fill(); }
    }
  },
  sprinkles(g, x, y, s) {
    g.fillStyle = '#f2d7a7'; g.fillRect(x - s * 0.45, y - s * 0.3, s * 0.9, s * 0.6); g.strokeRect(x - s * 0.45, y - s * 0.3, s * 0.9, s * 0.6);
    g.fillStyle = '#4a2a17';
    for (let i = 0; i < 40; i++) {
      g.save(); g.translate(x + (Math.sin(i * 12.9) * 0.4) * s, y + (Math.cos(i * 7.3) * 0.25) * s); g.rotate(i);
      g.fillRect(-s * 0.04, -s * 0.012, s * 0.08, s * 0.024); g.restore();
    }
  },
  cake(g, x, y, s) {
    g.fillStyle = '#9a5a22'; g.fillRect(x - s * 0.5, y - s * 0.18, s, s * 0.36); g.strokeRect(x - s * 0.5, y - s * 0.18, s, s * 0.36);
    g.fillStyle = '#5a2d0c'; g.fillRect(x - s * 0.5, y - s * 0.18, s, s * 0.08);
  },
  peanut(g, x, y, s) {
    g.fillStyle = '#d9a35a';
    g.beginPath(); g.ellipse(x - s * 0.13, y, s * 0.17, s * 0.13, 0.3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(x + s * 0.13, y, s * 0.17, s * 0.13, -0.3, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  strawberry(g, x, y, s) {
    g.fillStyle = '#e2231a';
    g.beginPath(); g.moveTo(x - s * 0.25, y - s * 0.12); g.quadraticCurveTo(x, y - s * 0.3, x + s * 0.25, y - s * 0.12); g.quadraticCurveTo(x + s * 0.2, y + s * 0.2, x, y + s * 0.3); g.quadraticCurveTo(x - s * 0.2, y + s * 0.2, x - s * 0.25, y - s * 0.12); g.fill(); g.stroke();
    g.fillStyle = '#3fae3a'; g.beginPath(); g.ellipse(x, y - s * 0.2, s * 0.18, s * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe9a8'; for (const [a, b] of [[-0.1, 0], [0.08, -0.02], [0, 0.12], [-0.05, 0.08], [0.1, 0.1]]) { circle(g, x + a * s, y + b * s, s * 0.02); g.fill(); }
  },
  cow(g, x, y, s) {
    g.fillStyle = '#1b1b1b';
    for (const [a, b, r] of [[-0.25, -0.15, 0.12], [0.2, 0.05, 0.16], [-0.1, 0.25, 0.09], [0.3, -0.25, 0.07]]) { g.beginPath(); g.ellipse(x + a * s, y + b * s, r * s, r * s * 0.7, a * 3, 0, Math.PI * 2); g.fill(); }
  },
  choco(g, x, y, s) {
    g.fillStyle = '#8a5a3c'; circle(g, x, y, s * 0.3); g.fill(); g.stroke();
    g.fillStyle = '#f6d04d'; circle(g, x, y, s * 0.12); g.fill();
  },
  custard(g, x, y, s) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y + s * 0.05, s * 0.35, s * 0.22, 0, 0, Math.PI); g.fill(); g.stroke();
    g.fillStyle = '#f9e08a'; g.beginPath(); g.ellipse(x, y + s * 0.05, s * 0.35, s * 0.09, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  eggs(g, x, y, s) {
    g.fillStyle = '#f3e1c4';
    for (const dx of [-0.33, 0, 0.33]) { g.beginPath(); g.ellipse(x + dx * s, y, s * 0.11, s * 0.15, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  },
  cheese(g, x, y, s) {
    g.fillStyle = '#ffd84a';
    g.beginPath(); g.moveTo(x - s * 0.4, y + s * 0.2); g.lineTo(x + s * 0.4, y + s * 0.2); g.lineTo(x + s * 0.4, y - s * 0.15); g.lineTo(x - s * 0.4, y + s * 0.05); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e0b52f'; for (const [a, b] of [[-0.1, 0.1], [0.2, 0.05], [0.28, 0.14]]) { circle(g, x + a * s, y + b * s, s * 0.04); g.fill(); }
  },
  chips(g, x, y, s) {
    g.fillStyle = '#f7d36a';
    for (const [a, b, r] of [[-0.18, 0, 0.3], [0.15, -0.1, -0.5], [0.05, 0.18, 1.2]]) { g.beginPath(); g.ellipse(x + a * s, y + b * s, s * 0.2, s * 0.13, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
  },
  drop(g, x, y, s) {
    g.fillStyle = '#3a3a3a'; g.strokeStyle = '#888';
    for (const [a, b] of [[-0.2, -0.05], [0.15, -0.12], [0, 0.15], [0.25, 0.15]]) {
      g.beginPath(); g.moveTo(x + a * s, y + b * s - s * 0.1); g.lineTo(x + a * s + s * 0.1, y + b * s); g.lineTo(x + a * s, y + b * s + s * 0.1); g.lineTo(x + a * s - s * 0.1, y + b * s); g.closePath(); g.fill(); g.stroke();
    }
  },
  candy(g, x, y, s) {
    const cols = ['#e2231a', '#3fae3a', '#f6d04d', '#3b7dd8', '#ffffff', '#f59a23'];
    [[-0.22, -0.1], [0.05, -0.18], [0.25, 0], [-0.05, 0.12], [0.18, 0.2], [-0.25, 0.18]].forEach(([a, b], i) => { g.fillStyle = cols[i]; circle(g, x + a * s, y + b * s, s * 0.09); g.fill(); g.stroke(); });
  },
  waffle(g, x, y, s) {
    g.fillStyle = '#c98a3b'; circle(g, x, y, s * 0.32); g.fill(); g.stroke();
    g.save(); circle(g, x, y, s * 0.32); g.clip(); g.strokeStyle = '#8a5a2b';
    for (let d = -0.4; d <= 0.4; d += 0.1) { g.beginPath(); g.moveTo(x + d * s - s * 0.4, y - s * 0.4); g.lineTo(x + d * s + s * 0.4, y + s * 0.4); g.stroke(); g.beginPath(); g.moveTo(x + d * s + s * 0.4, y - s * 0.4); g.lineTo(x + d * s - s * 0.4, y + s * 0.4); g.stroke(); }
    g.restore();
  },
  orange(g, x, y, s) {
    g.fillStyle = '#f59a23'; circle(g, x, y, s * 0.28); g.fill(); g.stroke();
    g.fillStyle = '#3fae3a'; g.beginPath(); g.ellipse(x + s * 0.1, y - s * 0.28, s * 0.1, s * 0.05, -0.5, 0, Math.PI * 2); g.fill();
  },
  apple(g, x, y, s) {
    g.fillStyle = '#e8473b'; circle(g, x, y, s * 0.28); g.fill(); g.stroke();
    g.fillStyle = '#3fae3a'; g.beginPath(); g.ellipse(x + s * 0.1, y - s * 0.28, s * 0.1, s * 0.05, -0.5, 0, Math.PI * 2); g.fill();
  },
  tomato(g, x, y, s) {
    g.fillStyle = '#e8473b'; circle(g, x, y, s * 0.26); g.fill(); g.stroke();
    g.fillStyle = '#3fae3a'; circle(g, x, y - s * 0.22, s * 0.06); g.fill();
  },
  peas(g, x, y, s) {
    g.fillStyle = '#7cc14a';
    for (const [a, b] of [[-0.2, 0], [0, -0.1], [0.2, 0], [-0.1, 0.17], [0.1, 0.17], [0, 0.08]]) { circle(g, x + a * s, y + b * s, s * 0.1); g.fill(); g.stroke(); }
  },
  spaghetti(g, x, y, s) {
    g.fillStyle = '#ffffff'; g.fillRect(x - s * 0.3, y - s * 0.45, s * 0.6, s * 0.9);
    g.strokeStyle = '#e8c35a';
    for (let d = -0.25; d <= 0.25; d += 0.06) { g.beginPath(); g.moveTo(x + d * s, y - s * 0.42); g.lineTo(x + d * s, y + s * 0.42); g.stroke(); }
  },
  macaroni(g, x, y, s) {
    g.strokeStyle = '#e8b33a'; g.lineWidth = Math.max(2, s * 0.06);
    for (const [a, b, r] of [[-0.2, -0.1, 0.4], [0.15, -0.15, 2], [0, 0.12, 4], [0.22, 0.15, 1], [-0.22, 0.18, 3]]) { g.beginPath(); g.arc(x + a * s, y + b * s, s * 0.09, r, r + 2.5); g.stroke(); }
  },
  rice(g, x, y, s) {
    g.fillStyle = '#fbf7ea';
    g.beginPath(); g.ellipse(x, y + s * 0.05, s * 0.38, s * 0.2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#d8d0b8';
    for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(x + Math.sin(i * 3.1) * s * 0.28, y + s * 0.05 + Math.cos(i * 1.7) * s * 0.1, s * 0.04, s * 0.015, i, 0, Math.PI * 2); g.fill(); }
  },
  pizza(g, x, y, s) {
    g.fillStyle = '#e8b35a'; circle(g, x, y, s * 0.42); g.fill(); g.stroke();
    g.fillStyle = '#d8312a'; circle(g, x, y, s * 0.35); g.fill();
    g.fillStyle = '#ffe17a';
    for (let i = 0; i < 9; i++) { circle(g, x + Math.sin(i * 2.4) * s * 0.22, y + Math.cos(i * 2.4) * s * 0.22, s * 0.07); g.fill(); }
    g.fillStyle = '#8a1b12';
    for (let i = 0; i < 5; i++) { circle(g, x + Math.sin(i * 1.3 + 1) * s * 0.15, y + Math.cos(i * 1.3 + 1) * s * 0.18, s * 0.05); g.fill(); }
  },
  icecream(g, x, y, s, color) {
    g.fillStyle = '#d99a4e';
    g.beginPath(); g.moveTo(x - s * 0.15, y - s * 0.02); g.lineTo(x + s * 0.15, y - s * 0.02); g.lineTo(x, y + s * 0.38); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = color; circle(g, x, y - s * 0.1, s * 0.18); g.fill(); g.stroke();
  },
  fries(g, x, y, s) {
    g.fillStyle = '#f6d04d';
    for (let i = -3; i <= 3; i++) { g.save(); g.translate(x + i * s * 0.06, y - s * 0.12); g.rotate(i * 0.08); g.fillRect(-s * 0.025, -s * 0.2, s * 0.05, s * 0.32); g.strokeRect(-s * 0.025, -s * 0.2, s * 0.05, s * 0.32); g.restore(); }
    g.fillStyle = '#e2231a';
    g.beginPath(); g.moveTo(x - s * 0.25, y); g.lineTo(x + s * 0.25, y); g.lineTo(x + s * 0.18, y + s * 0.32); g.lineTo(x - s * 0.18, y + s * 0.32); g.closePath(); g.fill(); g.stroke();
  },
  fish(g, x, y, s) {
    g.fillStyle = '#f59a23';
    for (const dx of [-0.3, 0, 0.3]) { g.fillRect(x + dx * s - s * 0.12, y - s * 0.06, s * 0.24, s * 0.12); g.strokeRect(x + dx * s - s * 0.12, y - s * 0.06, s * 0.24, s * 0.12); }
  },
};

/** One face of packaging: background, a picture, and the name in a band. */
function drawFace(g, x0, y0, W, H, f) {
  g.fillStyle = f.bg;
  g.fillRect(x0, y0, W, H);
  if (!f.text) return;
  const tall = H > W * 2.2;
  const flat = W > H * 2.6;
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1.5, Math.min(W, H) * 0.025);
  g.strokeStyle = INK;
  if (f.art && !flat) {
    const s = Math.min(W, H) * (tall ? 0.85 : 0.55);
    const cy = y0 + (tall ? H * 0.68 : H * 0.36);
    ART[f.art[0]](g, x0 + W / 2, cy, s, f.art[1]);
  } else if (f.art && flat) {
    ART[f.art[0]](g, x0 + W * 0.82, y0 + H / 2, H * 0.8, f.art[1]);
  }
  g.lineWidth = Math.max(1.5, Math.min(W, H) * 0.025);
  g.strokeStyle = INK;
  // the name, in the band
  const bandH = tall ? W * 0.9 : flat ? H : H * 0.3;
  const by = tall ? y0 + H * 0.1 : flat ? y0 : y0 + H * (f.sub ? 0.6 : 0.64);
  const bw = flat && f.art ? W * 0.66 : W;
  if (f.band) {
    g.fillStyle = f.band;
    if (tall) g.fillRect(x0, y0 + H * 0.06, W, H * 0.44);
    else if (flat) {
      // a label stuck on the middle, not a stripe all the way across
      g.fillRect(x0 + bw * 0.15, y0 + H * 0.15, bw * 0.7, H * 0.7);
      g.strokeRect(x0 + bw * 0.15, y0 + H * 0.15, bw * 0.7, H * 0.7);
    } else g.fillRect(x0, by, bw, bandH);
  }
  g.fillStyle = f.fg ?? '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fit = (text, maxW, maxH) => {
    let size = maxH;
    g.font = `900 ${size}px "Arial Black", "Trebuchet MS", sans-serif`;
    const w = g.measureText(text).width;
    if (w > maxW) size *= maxW / w;
    g.font = `900 ${Math.max(6, Math.floor(size))}px "Arial Black", "Trebuchet MS", sans-serif`;
  };
  if (tall) {
    g.save();
    g.translate(x0 + W / 2, y0 + H * 0.28);
    g.rotate(-Math.PI / 2);
    fit(f.text, H * 0.42, W * 0.7);
    g.fillText(f.text, 0, 2);
    g.restore();
    return;
  }
  fit(f.text, bw * (flat && f.band ? 0.62 : 0.9), bandH * (f.sub ? 0.62 : flat && f.band ? 0.5 : 0.8));
  g.fillText(f.text, x0 + bw / 2, by + bandH * (f.sub ? 0.36 : 0.52));
  if (f.sub) {
    fit(f.sub, bw * 0.8, bandH * 0.36);
    g.fillText(f.sub, x0 + bw / 2, by + bandH * 0.8);
  }
}

const faceTex = (W, H, f) => canvas(W, H, (g, w, h) => drawFace(g, 0, 0, w, h, f));
/** The label all the way round a can, jar or tub: the face twice, on opposite sides. */
// (u = 0 is the front of a cylinder, so the faces are centred on 0 and ½.)
const wrapTex = (r, h, f, decorate) => {
  const W = Math.min(512, 2 * Math.PI * r * PX_PER_M);
  const H = Math.min(256, h * PX_PER_M);
  return canvas(W, H, (g, w, hh) => {
    for (const x of [-w / 4, w / 4, (3 * w) / 4]) drawFace(g, x, 0, w / 2, hh, f);
    decorate?.(g, w, hh);
  });
};

const mat = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, ...opts });

/** Geometry and material(s) of one kind of product, centred on its middle. */
function buildLook(p) {
  const f = p.face;
  const px = (m) => Math.min(256, m * PX_PER_M);
  switch (p.shape) {
    case 'box': {
      const front = mat({ map: faceTex(px(p.w), px(p.h), f) });
      const side = mat({ color: f.band ?? f.bg });
      const top = mat({ color: f.bg });
      return { geo: new THREE.BoxGeometry(p.w, p.h, p.d), material: [side, side, top, top, front, front] };
    }
    case 'can': {
      const label = mat({ map: wrapTex(p.r, p.h, f, (g, w, h) => { g.fillStyle = '#c9ced3'; g.fillRect(0, 0, w, h * 0.07); g.fillRect(0, h * 0.93, w, h * 0.07); }) });
      const metal = mat({ color: 0xc9ced3, metalness: 0.6, roughness: 0.35 });
      return { geo: new THREE.CylinderGeometry(p.r, p.r, p.h, 16), material: [label, metal, metal] };
    }
    case 'jar': {
      const label = mat({
        map: wrapTex(p.r, p.h, f, (g, w, h) => {
          g.fillStyle = p.lid; g.fillRect(0, 0, w, h * 0.17);
          g.fillStyle = p.fill; g.fillRect(0, h * 0.17, w, h * 0.1); g.fillRect(0, h * 0.85, w, h * 0.15);
        }),
        roughness: 0.3,
      });
      return { geo: new THREE.CylinderGeometry(p.r, p.r, p.h, 16), material: [label, mat({ color: p.lid }), mat({ color: p.fill })] };
    }
    case 'tub': {
      const label = mat({ map: wrapTex(p.r, p.h, f) });
      return { geo: new THREE.CylinderGeometry(p.r, p.r * 0.85, p.h, 18), material: [label, mat({ color: p.lid }), mat({ color: f.bg })] };
    }
    case 'wheel': {
      const side = mat({ map: wrapTex(p.r, p.h, f) });
      const cap = mat({
        map: canvas(128, 128, (g) => {
          g.fillStyle = p.rind; g.fillRect(0, 0, 128, 128);
          g.fillStyle = '#ffffff'; g.lineWidth = 3; g.strokeStyle = INK; circle(g, 64, 64, 26); g.fill(); g.stroke();
          g.fillStyle = f.fg; g.font = '900 20px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('48+', 64, 66);
        }),
        roughness: 0.45,
      });
      return { geo: new THREE.CylinderGeometry(p.r, p.r, p.h, 24), material: [side, cap, cap] };
    }
    case 'ball': {
      return { geo: new THREE.SphereGeometry(p.r, 14, 10), material: mat({ color: f.bg, roughness: 0.35 }) };
    }
    case 'bottle': {
      // even steps up the profile, so a height on the bottle is a height on the texture
      const r = p.r;
      const prof = [1, 1, 1, 1, 1, 1, 0.95, 0.75, 0.45, 0.36, 0.36];
      const pts = [new THREE.Vector2(0.001, 0), ...prof.map((k, i) => new THREE.Vector2(r * k, (p.h * i) / 10)), new THREE.Vector2(0.001, p.h)];
      const geo = new THREE.LatheGeometry(pts, 16);
      geo.translate(0, -p.h / 2, 0);
      const vOf = (frac) => (frac * 10 + 1) / (pts.length - 1); // height fraction → texture v
      const map = canvas(256, 256, (g, w, h) => {
        const row = (frac) => (1 - vOf(frac)) * h;
        g.fillStyle = p.body; g.fillRect(0, 0, w, h);
        g.fillStyle = p.cap; g.fillRect(0, 0, w, row(0.9));
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(w * 0.08, row(0.85), w * 0.03, row(0.05) - row(0.85));
        g.fillRect(w * 0.58, row(0.85), w * 0.03, row(0.05) - row(0.85));
        const y0 = row(0.6);
        const y1 = row(0.28);
        for (const x of [-w / 4, w / 4, (3 * w) / 4]) drawFace(g, x, y0, w / 2, y1 - y0, f);
      });
      return { geo, material: mat({ map, roughness: 0.25 }) };
    }
    default:
      throw new Error(`unknown product shape ${p.shape}`);
  }
}

// ---------------------------------------------------------------- the stock: placing, knocking off, restocking
const GRAVITY = 9.8;
const _m = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * All the products in the shop. `bounds` keeps tumbling products inside the
 * shop floor ({x0, x1, z0, z1}); `floorY` is the floor's height.
 */
export function createStock(scene, { bounds, floorY = 0.012 }) {
  const kinds = new Map(); // product id → { look, items, mesh }
  const items = [];
  const flying = new Set();
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  function kind(id) {
    let k = kinds.get(id);
    if (!k) {
      const p = PRODUCTS[id];
      if (!p) throw new Error(`unknown product ${id}`);
      k = { id, p, half: halfSize(p), items: [], mesh: null };
      kinds.set(id, k);
    }
    return k;
  }

  /** Puts one product on a shelf: (x, z) its middle, y the shelf top, yaw which way its front faces. */
  function place(id, x, y, z, yaw, section, row = 0) {
    const k = kind(id);
    const item = {
      k, idx: k.items.length, section, row,
      home: new THREE.Vector3(x, y + k.half[1], z),
      homeQ: new THREE.Quaternion().setFromAxisAngle(UP, yaw + (rnd() - 0.5) * 0.08),
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(),
      vel: new THREE.Vector3(), spin: new THREE.Vector3(),
      state: 'home', restQ: null, t: 0,
    };
    k.items.push(item);
    items.push(item);
    section.items.push(item);
    return item;
  }

  /** Fills a row of shelf from `a` to `b` along its length with runs of products. */
  function fillRow(ids, { along, a, b, y, depthAt, yaw, maxH, section, rows = 2, room = 0.45 }) {
    let u = a;
    let n = Math.floor(rnd() * ids.length);
    while (u < b) {
      const k = kind(ids[n++ % ids.length]);
      const width = 2 * k.half[0];
      const depth = 2 * k.half[2];
      const deep = Math.max(1, Math.min(rows, Math.floor(room / (depth + 0.01))));
      const run = 3 + Math.floor(rnd() * 5);
      const stack = k.p.stack ? Math.max(1, Math.min(3, Math.floor((maxH - 0.03) / (2 * k.half[1])))) : 1;
      for (let i = 0; i < run && u + width <= b; i++) {
        const mid = u + width / 2;
        for (let row = 0; row < deep; row++) {
          const w = depthAt(row, depth);
          for (let s = 0; s < stack; s++) {
            const [x, z] = along === 'z' ? [w, mid] : [mid, w];
            place(k.id, x, y + s * 2 * k.half[1], z, yaw, section, row);
          }
        }
        u += width + 0.012;
      }
      u += 0.02;
    }
  }

  function build() {
    for (const k of kinds.values()) {
      const look = buildLook(k.p);
      const mesh = new THREE.InstancedMesh(look.geo, look.material, k.items.length);
      mesh.frustumCulled = false; // its products move around, so the precomputed bounds would be wrong
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.products = true;
      k.mesh = mesh;
      scene.add(mesh);
    }
    restock();
  }

  function write(item) {
    _m.compose(item.pos, item.quat, _one);
    item.k.mesh.setMatrixAt(item.idx, _m);
    item.k.mesh.instanceMatrix.needsUpdate = true;
  }

  function restock() {
    flying.clear();
    for (const item of items) {
      item.state = 'home';
      item.pos.copy(item.home);
      item.quat.copy(item.homeQ);
      _m.compose(item.pos, item.quat, _one);
      item.k.mesh.setMatrixAt(item.idx, _m);
    }
    for (const k of kinds.values()) k.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Knocks the products of `section` near `point` off the shelf. `out` is the
   * way they fall (out of the shelf), `push` Lennie's velocity, `strength`
   * how hard he hit. Returns how many fell.
   */
  function knock(section, point, out, strength, push = null, { radius = null, chance = 1 } = {}) {
    const r = radius ?? Math.min(0.7, 0.15 + strength * 0.05);
    const power = Math.min(1.6, 0.5 + strength / 10);
    let n = 0;
    for (const item of section.items) {
      if (item.state !== 'home') continue;
      const dx = item.home.x - point.x;
      const dy = (item.home.y - point.y) / 1.2;
      const dz = item.home.z - point.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // the ones nearest the impact almost always go; the row behind the front one less often
      if (d > r || rnd() > chance * (1 - 0.5 * (d / r) ** 2) * (item.row ? 0.45 : 1)) continue;
      launch(item, out, power, push);
      n++;
    }
    return n;
  }

  function launch(item, out, power, push) {
    item.state = 'flying';
    item.t = 0;
    _axis.crossVectors(out, UP); // sideways along the shelf
    item.vel.copy(out).multiplyScalar((0.6 + rnd() * 1.6) * power)
      .addScaledVector(_axis, (rnd() - 0.5) * 1.4 * power)
      .add(_v.set(0, 0.3 + rnd() * 1.4 * power, 0));
    if (push) item.vel.addScaledVector(_v.set(push.x, 0, push.z), 0.15);
    item.spin.set((rnd() - 0.5) * 16, (rnd() - 0.5) * 8, (rnd() - 0.5) * 16).multiplyScalar(power);
    flying.add(item);
  }

  /** Height of the lowest point of a product below its middle, at its current tilt. */
  function lowest(item) {
    _m.makeRotationFromQuaternion(item.quat);
    const e = _m.elements;
    const [hx, hy, hz] = item.k.half;
    return Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz;
  }

  /** Moves everything that's falling, bouncing or settling. */
  function update(dt) {
    if (!flying.size || dt <= 0) return 0;
    let landed = 0;
    for (const item of flying) {
      item.t += dt;
      if (item.state === 'flying') {
        item.vel.y -= GRAVITY * dt;
        item.pos.addScaledVector(item.vel, dt);
        const angle = item.spin.length() * dt;
        if (angle > 0) item.quat.multiply(_q.setFromAxisAngle(_axis.copy(item.spin).normalize(), angle));
        // the shop's walls
        if (item.pos.x < bounds.x0 + 0.1 || item.pos.x > bounds.x1 - 0.1) { item.pos.x = Math.min(bounds.x1 - 0.1, Math.max(bounds.x0 + 0.1, item.pos.x)); item.vel.x *= -0.3; }
        if (item.pos.z < bounds.z0 + 0.1 || item.pos.z > bounds.z1 - 0.1) { item.pos.z = Math.min(bounds.z1 - 0.1, Math.max(bounds.z0 + 0.1, item.pos.z)); item.vel.z *= -0.3; }
        const low = lowest(item);
        if (item.pos.y - low < floorY) {
          item.pos.y = floorY + low;
          if (item.vel.y < -1.4 && item.t < 3) {
            item.vel.y *= -0.3;
            item.vel.x *= 0.6;
            item.vel.z *= 0.6;
            item.spin.multiplyScalar(0.5);
            landed++;
          } else {
            settle(item);
            landed++;
          }
        }
      } else {
        // settling: tip over onto the nearest side and slide to a stop
        const k = 1 - Math.exp(-dt * 14);
        item.quat.slerp(item.restQ, k);
        const f = Math.exp(-dt * (item.k.p.shape === 'ball' ? 1.5 : 7));
        item.vel.x *= f;
        item.vel.z *= f;
        item.pos.x += item.vel.x * dt;
        item.pos.z += item.vel.z * dt;
        item.pos.x = Math.min(bounds.x1 - 0.1, Math.max(bounds.x0 + 0.1, item.pos.x));
        item.pos.z = Math.min(bounds.z1 - 0.1, Math.max(bounds.z0 + 0.1, item.pos.z));
        item.pos.y = floorY + lowest(item);
        if (item.t > 0.6 && item.vel.lengthSq() < 0.0004) {
          item.quat.copy(item.restQ);
          item.pos.y = floorY + lowest(item);
          item.state = 'down';
          flying.delete(item);
        }
      }
      write(item);
    }
    return landed;
  }

  /** On the floor: lay it on whichever side is nearest to facing down. */
  function settle(item) {
    item.state = 'settling';
    item.t = 0;
    item.vel.y = 0;
    _m.makeRotationFromQuaternion(item.quat);
    const e = _m.elements;
    // the product's own axis that's closest to vertical
    const ys = [e[1], e[5], e[9]];
    let a = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(ys[i]) > Math.abs(ys[a])) a = i;
    _axis.set(e[a * 4], e[a * 4 + 1], e[a * 4 + 2]).normalize();
    const target = _v.set(0, Math.sign(ys[a]) || 1, 0);
    item.restQ = new THREE.Quaternion().setFromUnitVectors(_axis, target).multiply(item.quat);
  }

  return {
    place, fillRow, build, restock, knock, update,
    section: () => ({ items: [] }),
    get falling() { return flying.size; },
  };
}
