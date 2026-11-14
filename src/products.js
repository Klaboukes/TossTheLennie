import * as THREE from 'three';

// The supermarket's groceries: every product is a little model with its own
// cartoon packaging (bread in bags, milk cartons, cheese wheels, bottles of
// cola, soup cans...), drawn on canvases so there are no image files. The
// names are plain Dutch words, not real brands.
//
// All products of one kind share one InstancedMesh, so thousands of them cost
// a few draw calls. When Lennie crashes into a shelf (or the fruit and veg
// crates), the products near the
// impact tumble off: they fly, bounce and come to rest on the floor (simple
// hand-rolled motion, not physics bodies, so they never slow the game down or
// get in Lennie's way). restock() puts everything back.

const PX_PER_M = 900; // texture resolution on the packaging
const INK = '#2b2b2b';

// ---------------------------------------------------------------- the catalogue
// shape: box (w × h × d, the w × h face looks out), can, jar, tub (cylinders
// r × h), wheel (a flat cylinder), ball, bun (a squashed ball: rolls), stick
// (a capsule len long lying along the shelf: baguettes, cucumbers), bottle.
// face: bg colour, optional band (a coloured stripe behind the name), fg
// (text colour), text (the name), sub (a small second line), art (a picture),
// stripes (layers across a face, top to bottom: [colour, fraction]).
// stack: short products are stacked on top of each other on the shelf.
// lay: a flat pack whose label is on top too (it lies on sloping shelves).
// top: the colour of a box's top, when it isn't the background colour.
export const PRODUCTS = {
  // bread and breakfast
  volkoren: { shape: 'box', w: 0.26, h: 0.13, d: 0.12, face: { bg: '#f4ecd9', band: '#2f7d32', text: 'VOLKOREN', art: ['loaf', '#8a5a2b'] } },
  witbrood: { shape: 'box', w: 0.26, h: 0.13, d: 0.12, face: { bg: '#f4f6fb', band: '#3b7dd8', text: 'WITBROOD', art: ['loaf', '#e7bf7f'] } },
  tijgerbrood: { shape: 'box', w: 0.28, h: 0.14, d: 0.13, face: { bg: '#f6efe0', band: '#d9822b', text: 'TIJGERBROOD', art: ['tigerloaf'] } },
  suikerbrood: { shape: 'box', w: 0.24, h: 0.13, d: 0.12, face: { bg: '#fdf8ee', band: '#8e44ad', text: 'SUIKERBROOD', art: ['loaf', '#d9a35a'] } },
  bolletjes: { shape: 'box', w: 0.24, h: 0.11, d: 0.16, face: { bg: '#fbf3e4', band: '#3fae3a', text: 'BOLLETJES', art: ['rolls'] } },
  croissants: { shape: 'box', w: 0.22, h: 0.09, d: 0.14, stack: true, face: { bg: '#fff7e0', band: '#f59a23', text: 'CROISSANTS', art: ['croissant'] } },
  stokbrood: { shape: 'stick', r: 0.035, len: 0.5, color: '#d9a052' },
  krentenbol: { shape: 'box', w: 0.2, h: 0.1, d: 0.14, face: { bg: '#fbf3e4', band: '#e2231a', text: 'KRENTENBOLLEN', art: ['buns'] } },
  hagelslag: { shape: 'box', w: 0.11, h: 0.2, d: 0.06, face: { bg: '#2a1f1a', band: '#7b4a2a', fg: '#ffffff', text: 'HAGELSLAG', art: ['sprinkles'] } },
  melkhagel: { shape: 'box', w: 0.11, h: 0.2, d: 0.06, face: { bg: '#6b3f22', band: '#e8c48a', fg: '#6b3f22', text: 'MELKHAGEL', art: ['sprinkles'] } },
  vlokken: { shape: 'box', w: 0.11, h: 0.2, d: 0.06, face: { bg: '#8a4f2a', band: '#f6d04d', fg: '#8a4f2a', text: 'VLOKKEN', art: ['flakes'] } },
  muisjesRoze: { shape: 'box', w: 0.1, h: 0.16, d: 0.05, face: { bg: '#ffffff', band: '#e86fa0', text: 'MUISJES', art: ['muisjes', '#e86fa0'] } },
  muisjesBlauw: { shape: 'box', w: 0.1, h: 0.16, d: 0.05, face: { bg: '#ffffff', band: '#3b7dd8', text: 'MUISJES', art: ['muisjes', '#6fa8e8'] } },
  beschuit: { shape: 'jar', r: 0.05, h: 0.2, lid: '#e2231a', fill: '#f4ecd9', face: { bg: '#f4ecd9', band: '#e2231a', text: 'BESCHUIT', art: ['rusk'] } },
  ontbijtkoek: { shape: 'box', w: 0.26, h: 0.08, d: 0.09, stack: true, face: { bg: '#e8a33c', fg: '#5a2d0c', text: 'ONTBIJTKOEK', art: ['cake'] } },
  pindakaas: { shape: 'jar', r: 0.045, h: 0.13, lid: '#d22d2d', fill: '#a0662b', face: { bg: '#f2c14e', fg: '#c0392b', text: 'PINDAKAAS', art: ['peanut'] } },
  pindakaasNoot: { shape: 'jar', r: 0.045, h: 0.13, lid: '#2e7d32', fill: '#a0662b', face: { bg: '#f2c14e', fg: '#2e7d32', text: 'PINDAKAAS', sub: 'met stukjes noot', art: ['peanut'] } },
  pindakaasXL: { shape: 'jar', r: 0.2, h: 0.5, lid: '#d22d2d', fill: '#a0662b', face: { bg: '#f2c14e', fg: '#c0392b', text: 'PINDAKAAS', sub: 'XXL', art: ['peanut'] } },
  chocopasta: { shape: 'jar', r: 0.045, h: 0.13, lid: '#5b3a29', fill: '#5b3a29', face: { bg: '#ffffff', fg: '#5b3a29', text: 'CHOCOPASTA', art: ['choco'] } },
  appelstroop: { shape: 'jar', r: 0.04, h: 0.1, lid: '#3a1d12', fill: '#3a1d12', face: { bg: '#7a1f1f', fg: '#ffffff', text: 'APPELSTROOP', art: ['apple'] } },
  honing: { shape: 'jar', r: 0.04, h: 0.12, lid: '#f2b632', fill: '#e8a01a', face: { bg: '#f6d04d', fg: '#7b3f00', text: 'HONING' } },
  jam: { shape: 'jar', r: 0.04, h: 0.11, lid: '#e8e0d0', fill: '#b3122e', face: { bg: '#ffffff', fg: '#c0392b', text: 'AARDBEIEN', sub: 'jam', art: ['strawberry'] } },
  // the bakery's loose rolls, in baskets on a table, and the pastries in the glass case
  bol: { shape: 'bun', r: 0.075, color: '#c98a3b' },
  pistolet: { shape: 'bun', r: 0.05, color: '#e3b56a' },
  krentenbolLos: { shape: 'bun', r: 0.055, color: '#a8682c' },
  tompouce: { shape: 'box', w: 0.12, h: 0.055, d: 0.055, top: '#f48fb6', face: { bg: '#f6d76b', stripes: [['#f48fb6', 0.22], ['#e0b278', 0.16], ['#f6d76b', 0.46], ['#e0b278', 0.16]] } },
  appeltaart: { shape: 'wheel', r: 0.13, h: 0.07, rind: '#c98a3b', capArt: 'lattice', face: { bg: '#d39a4f' } },
  gevuldekoek: { shape: 'wheel', r: 0.055, h: 0.022, stack: true, rind: '#d9a35a', capArt: 'almond', face: { bg: '#d9a35a' } },
  kaneelbroodje: { shape: 'wheel', r: 0.05, h: 0.035, stack: true, rind: '#c98a3b', capArt: 'swirl', face: { bg: '#c98a3b' } },
  // dairy
  melk: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#ffffff', band: '#3b7dd8', text: 'MELK', sub: 'halfvol', art: ['cow'] } },
  karnemelk: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#ffffff', band: '#2e8b57', text: 'KARNEMELK', art: ['cow'] } },
  chocomelk: { shape: 'box', w: 0.09, h: 0.24, d: 0.09, face: { bg: '#5b3a29', band: '#f6d04d', fg: '#5b3a29', text: 'CHOCOMELK', art: ['choco'] } },
  yoghurt: { shape: 'box', w: 0.09, h: 0.2, d: 0.09, face: { bg: '#ffffff', band: '#e86fa0', text: 'YOGHURT', art: ['strawberry'] } },
  vla: { shape: 'box', w: 0.09, h: 0.2, d: 0.09, face: { bg: '#f6d04d', band: '#8a5a3c', text: 'VLA', sub: 'vanille', art: ['custard'] } },
  boter: { shape: 'box', w: 0.13, h: 0.05, d: 0.07, stack: true, face: { bg: '#f3c64a', fg: '#1d4f9a', text: 'ROOMBOTER' } },
  eieren: { shape: 'box', w: 0.3, h: 0.07, d: 0.11, stack: true, face: { bg: '#c9bfae', fg: '#5a4632', text: 'EIEREN', art: ['eggs'] } },
  kwark: { shape: 'tub', r: 0.055, h: 0.09, stack: true, lid: '#3b7dd8', face: { bg: '#ffffff', fg: '#3b7dd8', text: 'KWARK' } },
  slagroom: { shape: 'can', r: 0.03, h: 0.2, face: { bg: '#ffffff', fg: '#3b7dd8', text: 'SLAGROOM' } },
  koffiemelk: { shape: 'bottle', r: 0.035, h: 0.18, body: '#fff8e8', cap: '#d22d2d', face: { bg: '#d22d2d', text: 'KOFFIEMELK' } },
  // cheese: wheels, and flat packs lying on the cheese cooler's sloping shelves
  gouda: { shape: 'wheel', r: 0.16, h: 0.1, stack: true, rind: '#f2b632', face: { bg: '#f2b632', band: '#ffffff', fg: '#c0392b', text: 'GOUDA' } },
  belegen: { shape: 'wheel', r: 0.13, h: 0.09, stack: true, rind: '#e2972a', face: { bg: '#e2972a', band: '#ffffff', fg: '#1d4f9a', text: 'BELEGEN' } },
  kaaswiel: { shape: 'wheel', r: 0.21, h: 0.12, stack: true, rind: '#f0a23a', face: { bg: '#f0a23a', band: '#f9d65c', fg: '#a3123a', text: 'GOUDA' } },
  jongkaas: { shape: 'box', w: 0.18, h: 0.04, d: 0.12, stack: true, lay: true, face: { bg: '#f6d04d', band: '#3fae3a', text: 'JONG', art: ['cheese'] } },
  oudekaas: { shape: 'box', w: 0.18, h: 0.04, d: 0.12, stack: true, lay: true, face: { bg: '#e8a33c', band: '#8a2a2a', text: 'OUD', art: ['cheese'] } },
  komijnekaas: { shape: 'box', w: 0.18, h: 0.04, d: 0.12, stack: true, lay: true, face: { bg: '#f0d27a', band: '#5b3a29', text: 'KOMIJN', art: ['cheese'] } },
  geitenkaas: { shape: 'box', w: 0.16, h: 0.04, d: 0.11, stack: true, lay: true, face: { bg: '#fbf7ea', band: '#2e8b57', text: 'GEIT', art: ['cheese'] } },
  plakken: { shape: 'box', w: 0.14, h: 0.03, d: 0.14, stack: true, lay: true, face: { bg: '#fff3c4', band: '#3b7dd8', text: 'PLAKKEN' } },
  edammer: { shape: 'ball', r: 0.07, face: { bg: '#d8312a' } },
  // sweets, and it's Sinterklaas season
  chipsPaprika: { shape: 'box', w: 0.2, h: 0.28, d: 0.07, face: { bg: '#e8473b', band: '#f6d04d', fg: '#c0392b', text: 'CHIPS', sub: 'paprika', art: ['chips'] } },
  chipsNaturel: { shape: 'box', w: 0.2, h: 0.28, d: 0.07, face: { bg: '#f6d04d', band: '#1d4f9a', text: 'CHIPS', sub: 'naturel', art: ['chips'] } },
  drop: { shape: 'box', w: 0.14, h: 0.2, d: 0.05, face: { bg: '#1b1b1b', band: '#e2231a', text: 'DROP', art: ['drop'] } },
  snoepmix: { shape: 'box', w: 0.14, h: 0.2, d: 0.05, face: { bg: '#f2a2b8', band: '#8e44ad', text: 'SNOEPMIX', art: ['candy'] } },
  chocolade: { shape: 'box', w: 0.16, h: 0.08, d: 0.02, stack: true, face: { bg: '#5b2a86', fg: '#ffffff', text: 'CHOCOLADE' } },
  stroopwafels: { shape: 'can', r: 0.05, h: 0.14, face: { bg: '#f6d04d', fg: '#7b3f00', text: 'STROOPWAFELS', art: ['waffle'] } },
  speculaas: { shape: 'box', w: 0.2, h: 0.08, d: 0.06, stack: true, face: { bg: '#c98a3b', fg: '#ffffff', text: 'SPECULAAS', art: ['windmill'] } },
  pepernoten: { shape: 'box', w: 0.14, h: 0.2, d: 0.06, face: { bg: '#c0392b', band: '#f6d04d', fg: '#c0392b', text: 'PEPERNOTEN', art: ['pepernoten'] } },
  kruidnoten: { shape: 'box', w: 0.14, h: 0.2, d: 0.06, face: { bg: '#7b3f00', band: '#f6d04d', fg: '#7b3f00', text: 'KRUIDNOTEN', art: ['pepernoten'] } },
  letterL: { shape: 'box', w: 0.13, h: 0.17, d: 0.03, face: { bg: '#d8312a', fg: '#ffffff', text: 'MELK', art: ['letter', 'L'] } },
  letterS: { shape: 'box', w: 0.13, h: 0.17, d: 0.03, face: { bg: '#1d4f9a', fg: '#ffffff', text: 'PUUR', art: ['letter', 'S'] } },
  // coffee and tea
  koffie: { shape: 'box', w: 0.12, h: 0.18, d: 0.07, face: { bg: '#c0392b', band: '#2b1a12', text: 'KOFFIE', sub: 'snelfilter', art: ['cup', '#5b3a29'] } },
  koffiepads: { shape: 'box', w: 0.14, h: 0.16, d: 0.1, face: { bg: '#1d4f9a', band: '#f6d04d', fg: '#1d4f9a', text: 'KOFFIEPADS', art: ['cup', '#5b3a29'] } },
  thee: { shape: 'box', w: 0.14, h: 0.08, d: 0.07, stack: true, face: { bg: '#3fae3a', fg: '#ffffff', text: 'THEE', art: ['cup', '#c0782a'] } },
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
  appelmoes: { shape: 'jar', r: 0.05, h: 0.13, lid: '#3fae3a', fill: '#e9d27a', face: { bg: '#ffffff', fg: '#3f8f2a', text: 'APPELMOES', art: ['apple'] } },
  pindasaus: { shape: 'jar', r: 0.045, h: 0.14, lid: '#7b3f00', fill: '#a0662b', face: { bg: '#e2231a', fg: '#ffffff', text: 'PINDASAUS', art: ['peanut'] } },
  sambal: { shape: 'jar', r: 0.035, h: 0.09, lid: '#2e8b57', fill: '#b3241b', face: { bg: '#b3241b', fg: '#ffffff', text: 'SAMBAL' } },
  mosterd: { shape: 'jar', r: 0.035, h: 0.1, lid: '#f6d04d', fill: '#d9a520', face: { bg: '#f6d04d', fg: '#7b3f00', text: 'MOSTERD' } },
  mayonaise: { shape: 'bottle', r: 0.04, h: 0.22, body: '#fbf5df', cap: '#3b7dd8', face: { bg: '#3b7dd8', text: 'MAYO' } },
  fritessaus: { shape: 'bottle', r: 0.04, h: 0.22, body: '#fbf0c8', cap: '#f6d04d', face: { bg: '#f6d04d', fg: '#c0392b', text: 'FRITESSAUS' } },
  // the snack freezer: flat packs lying in an open chest
  kroketten: { shape: 'box', w: 0.24, h: 0.05, d: 0.15, stack: true, lay: true, face: { bg: '#c7742c', band: '#ffffff', fg: '#c7742c', text: 'KROKETTEN', art: ['kroket'] } },
  frikandellen: { shape: 'box', w: 0.26, h: 0.05, d: 0.15, stack: true, lay: true, face: { bg: '#7a3e2a', band: '#f6d04d', fg: '#7a3e2a', text: 'FRIKANDELLEN', art: ['frikandel'] } },
  bitterballen: { shape: 'box', w: 0.22, h: 0.06, d: 0.15, stack: true, lay: true, face: { bg: '#f6d04d', fg: '#7b3f00', text: 'BITTERBALLEN', art: ['bitterbal'] } },
  kaassouffle: { shape: 'box', w: 0.22, h: 0.05, d: 0.15, stack: true, lay: true, face: { bg: '#3b7dd8', band: '#f6d04d', fg: '#3b7dd8', text: 'KAASSOUFFLÉS', art: ['cheese'] } },
  // frozen
  pizza: { shape: 'box', w: 0.28, h: 0.28, d: 0.04, face: { bg: '#c0392b', band: '#f6d04d', fg: '#c0392b', text: 'PIZZA', art: ['pizza'] } },
  ijsVanille: { shape: 'tub', r: 0.1, h: 0.13, stack: true, lid: '#3b7dd8', face: { bg: '#f7e3b5', fg: '#3b7dd8', text: 'VANILLE-IJS', art: ['icecream', '#fff6d8'] } },
  ijsAardbei: { shape: 'tub', r: 0.1, h: 0.13, stack: true, lid: '#e2231a', face: { bg: '#f2a2b8', fg: '#a3123a', text: 'AARDBEIEN-IJS', art: ['icecream', '#f37fa0'] } },
  friet: { shape: 'box', w: 0.2, h: 0.3, d: 0.07, face: { bg: '#3b7dd8', band: '#e2231a', text: 'FRIET', art: ['fries'] } },
  doperwten: { shape: 'box', w: 0.2, h: 0.28, d: 0.06, face: { bg: '#2e8b57', band: '#ffffff', fg: '#2e8b57', text: 'DOPERWTEN', art: ['peas'] } },
  vissticks: { shape: 'box', w: 0.2, h: 0.06, d: 0.12, stack: true, face: { bg: '#3b7dd8', fg: '#ffffff', text: 'VISSTICKS', art: ['fish'] } },
  // fruit and veg, loose on the crate tables by the door (veg: a faceted, matt ball)
  appel: { shape: 'ball', veg: true, r: 0.085, face: { bg: '#e8473b' } },
  sinaasappel: { shape: 'ball', veg: true, r: 0.085, face: { bg: '#f59a23' } },
  kool: { shape: 'ball', veg: true, r: 0.16, face: { bg: '#8cc63f' } },
  citroen: { shape: 'ball', veg: true, r: 0.07, face: { bg: '#f6d04d' } },
  tomaat: { shape: 'ball', veg: true, r: 0.06, face: { bg: '#d8312a' } },
  pruim: { shape: 'ball', veg: true, r: 0.075, face: { bg: '#7a3e9d' } },
  boontjes: { shape: 'ball', veg: true, r: 0.05, face: { bg: '#3e8f3a' } },
  wortel: { shape: 'ball', veg: true, r: 0.06, face: { bg: '#e07b2a' } },
  peer: { shape: 'ball', veg: true, r: 0.08, face: { bg: '#a5d36b' } },
  paprikaRood: { shape: 'ball', veg: true, r: 0.055, face: { bg: '#d8231a' } },
  paprikaGeel: { shape: 'ball', veg: true, r: 0.055, face: { bg: '#f6c21d' } },
  paprikaGroen: { shape: 'ball', veg: true, r: 0.055, face: { bg: '#3e8f3a' } },
  broccoli: { shape: 'ball', veg: true, r: 0.075, face: { bg: '#3d7a2e' } },
  ui: { shape: 'ball', veg: true, r: 0.045, face: { bg: '#c58b3d' } },
  aardappel: { shape: 'bun', r: 0.045, color: '#c9a066' },
  champignon: { shape: 'bun', r: 0.03, color: '#ece4d4' },
  komkommer: { shape: 'stick', r: 0.026, len: 0.22, color: '#2f6b2a' },
  prei: { shape: 'stick', r: 0.024, len: 0.22, color: '#a7cf72' },
  aubergine: { shape: 'stick', r: 0.04, len: 0.1, color: '#4b2a5a' },
};

// What goes on each shelf (bottom to top) of each aisle, the freezers and the
// drinks fridges, and the bakery's bread rack, pastry case and the Sinterklaas stand.
export const ASSORTMENT = {
  BROODBELEG: [['beschuit', 'ontbijtkoek'], ['hagelslag', 'melkhagel', 'vlokken', 'muisjesRoze', 'muisjesBlauw'], ['pindakaas', 'pindakaasNoot', 'pindakaas', 'chocopasta'], ['jam', 'appelstroop', 'pindakaas', 'honing']],
  ZUIVEL: [['eieren', 'boter'], ['melk', 'karnemelk', 'chocomelk'], ['yoghurt', 'vla', 'kwark'], ['melk', 'vla', 'slagroom', 'koffiemelk']],
  'KOFFIE & THEE': [['koffie', 'koffiepads'], ['thee', 'koffiemelk', 'koffie'], ['koffiepads', 'stroopwafels', 'speculaas'], ['thee', 'koffie']],
  SNOEP: [['chipsPaprika', 'chipsNaturel'], ['drop', 'snoepmix', 'pepernoten'], ['chocolade', 'stroopwafels', 'speculaas'], ['chipsNaturel', 'snoepmix', 'drop']],
  DRINKEN: [['water', 'cola'], ['cola', 'sinas'], ['jus', 'appelsap'], ['limo', 'icetea']],
  'PASTA & SAUS': [['rijst', 'macaroni', 'spaghetti'], ['tomatensoep', 'erwtensoep', 'appelmoes'], ['pastasaus', 'pindasaus', 'sambal', 'mosterd'], ['mayonaise', 'fritessaus']],
  DIEPVRIES: [['ijsVanille', 'ijsAardbei'], ['pizza', 'friet'], ['doperwten', 'vissticks']],
  FRISDRANK: [['water', 'appelsap'], ['cola', 'sinas', 'jus'], ['limo', 'icetea', 'cola']],
  BAKKERIJ: [['tijgerbrood', 'volkoren', 'witbrood'], ['witbrood', 'suikerbrood', 'tijgerbrood'], ['stokbrood'], ['krentenbol', 'croissants', 'bolletjes']],
  GEBAK: [['tompouce', 'appeltaart', 'gevuldekoek', 'kaneelbroodje']],
  SINT: [['pepernoten', 'kruidnoten'], ['letterL', 'letterS', 'speculaas'], ['pepernoten', 'letterL', 'kruidnoten']],
};

/** Size of a product as half extents (x across the front, y up, z depth). */
export function halfSize(p) {
  if (p.w !== undefined) return [p.w / 2, p.h / 2, p.d / 2];
  if (p.shape === 'ball') return [p.r, p.r, p.r];
  if (p.shape === 'bun') return [p.r, p.r * 0.65, p.r];
  if (p.shape === 'stick') return [p.len / 2 + p.r, p.r, p.r];
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
  tigerloaf(g, x, y, s) {
    ART.loaf(g, x, y, s, '#ecc078');
    g.fillStyle = '#9a5f24';
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse(x + Math.sin(i * 2.7) * s * 0.42, y - s * 0.08 + Math.cos(i * 1.9) * s * 0.1, s * 0.06, s * 0.03, i, 0, Math.PI * 2);
      g.fill();
    }
  },
  rolls(g, x, y, s) {
    for (const dx of [-0.3, 0, 0.3]) { g.fillStyle = '#e3b56a'; circle(g, x + dx * s, y, s * 0.18); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x + dx * s - s * 0.1, y); g.lineTo(x + dx * s + s * 0.1, y); g.stroke(); }
  },
  croissant(g, x, y, s) {
    g.fillStyle = '#d99a4e';
    g.beginPath(); g.arc(x, y + s * 0.25, s * 0.42, Math.PI * 1.1, Math.PI * 1.9); g.arc(x, y + s * 0.3, s * 0.2, Math.PI * 1.85, Math.PI * 1.15, true); g.closePath(); g.fill(); g.stroke();
    for (const a of [1.35, 1.5, 1.65]) { g.beginPath(); g.moveTo(x + Math.cos(Math.PI * a) * s * 0.2, y + s * 0.3 + Math.sin(Math.PI * a) * s * 0.2); g.lineTo(x + Math.cos(Math.PI * a) * s * 0.42, y + s * 0.25 + Math.sin(Math.PI * a) * s * 0.42); g.stroke(); }
  },
  flakes(g, x, y, s) {
    g.fillStyle = '#f2d7a7'; g.fillRect(x - s * 0.45, y - s * 0.3, s * 0.9, s * 0.6); g.strokeRect(x - s * 0.45, y - s * 0.3, s * 0.9, s * 0.6);
    g.fillStyle = '#5a2d0c';
    for (let i = 0; i < 14; i++) {
      g.save(); g.translate(x + Math.sin(i * 12.9) * 0.36 * s, y + Math.cos(i * 7.3) * 0.2 * s); g.rotate(i * 0.7);
      g.beginPath(); g.moveTo(-s * 0.08, 0); g.lineTo(0, -s * 0.05); g.lineTo(s * 0.09, s * 0.01); g.lineTo(0, s * 0.05); g.closePath(); g.fill(); g.restore();
    }
  },
  muisjes(g, x, y, s, color) {
    g.fillStyle = '#ead7b0'; circle(g, x, y, s * 0.36); g.fill(); g.stroke();
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? '#ffffff' : color; circle(g, x + Math.sin(i * 2.39) * s * 0.26 * Math.sqrt((i % 9) / 9 + 0.1), y + Math.cos(i * 2.39) * s * 0.26 * Math.sqrt((i % 9) / 9 + 0.1), s * 0.04); g.fill(); }
  },
  rusk(g, x, y, s) {
    g.fillStyle = '#e8c48a'; circle(g, x, y, s * 0.34); g.fill(); g.stroke();
    g.fillStyle = '#f6e7c4'; circle(g, x, y, s * 0.26); g.fill();
  },
  pepernoten(g, x, y, s) {
    g.fillStyle = '#a8682c';
    for (const [a, b] of [[-0.22, -0.08], [0.02, -0.16], [0.24, -0.04], [-0.12, 0.14], [0.14, 0.16], [0, 0.02]]) { circle(g, x + a * s, y + b * s, s * 0.11); g.fill(); g.stroke(); }
  },
  letter(g, x, y, s, ch) {
    g.font = `900 ${Math.round(s * 0.95)}px "Arial Black", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = Math.max(3, s * 0.14);
    g.strokeStyle = '#ffffff'; g.strokeText(ch, x, y + s * 0.1);
    g.fillStyle = '#8a4f2a'; g.fillText(ch, x, y + s * 0.1);
  },
  windmill(g, x, y, s) {
    g.fillStyle = '#7b3f00';
    g.beginPath(); g.moveTo(x - s * 0.12, y + s * 0.3); g.lineTo(x + s * 0.12, y + s * 0.3); g.lineTo(x + s * 0.06, y - s * 0.05); g.lineTo(x - s * 0.06, y - s * 0.05); g.closePath(); g.fill();
    g.strokeStyle = '#7b3f00'; g.lineWidth = Math.max(2, s * 0.07);
    for (const a of [0.8, 2.37, 3.94, 5.5]) { g.beginPath(); g.moveTo(x, y - s * 0.05); g.lineTo(x + Math.cos(a) * s * 0.3, y - s * 0.05 + Math.sin(a) * s * 0.3); g.stroke(); }
  },
  cup(g, x, y, s, color) {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(x - s * 0.22, y - s * 0.1); g.lineTo(x + s * 0.22, y - s * 0.1); g.lineTo(x + s * 0.16, y + s * 0.25); g.lineTo(x - s * 0.16, y + s * 0.25); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(x + s * 0.24, y + s * 0.05, s * 0.08, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.fillStyle = color; g.beginPath(); g.ellipse(x, y - s * 0.1, s * 0.2, s * 0.05, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    for (const dx of [-0.08, 0.06]) { g.beginPath(); g.moveTo(x + dx * s, y - s * 0.18); g.quadraticCurveTo(x + dx * s + s * 0.06, y - s * 0.26, x + dx * s, y - s * 0.34); g.stroke(); }
  },
  kroket(g, x, y, s) {
    g.fillStyle = '#b8682a';
    for (const dy of [-0.12, 0.12]) { g.beginPath(); g.ellipse(x, y + dy * s, s * 0.3, s * 0.1, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  },
  frikandel(g, x, y, s) {
    g.fillStyle = '#8a4a2a';
    for (const dy of [-0.14, 0, 0.14]) { g.beginPath(); g.ellipse(x, y + dy * s, s * 0.4, s * 0.05, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  },
  bitterbal(g, x, y, s) {
    g.fillStyle = '#a8682c';
    for (const [a, b] of [[-0.2, 0], [0, -0.1], [0.2, 0], [0, 0.12]]) { circle(g, x + a * s, y + b * s, s * 0.12); g.fill(); g.stroke(); }
  },
};

/** One face of packaging: background, a picture, and the name in a band. */
function drawFace(g, x0, y0, W, H, f) {
  g.fillStyle = f.bg;
  g.fillRect(x0, y0, W, H);
  if (f.stripes) {
    let y = y0;
    for (const [color, frac] of f.stripes) {
      g.fillStyle = color;
      g.fillRect(x0, y, W, H * frac + 1);
      y += H * frac;
    }
  }
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
  if (p.look) return p.look(p); // a catalogue can bring its own models (the house's clutter does)
  const f = p.face;
  const px = (m) => Math.min(256, m * PX_PER_M);
  switch (p.shape) {
    case 'box': {
      const front = mat({ map: faceTex(px(p.w), px(p.h), f) });
      const side = mat({ color: f.stripes ? f.bg : f.band ?? f.bg });
      const bottom = mat({ color: f.bg });
      // a flat pack shows its label on top as well; a tompouce its pink icing
      const top = p.lay ? mat({ map: faceTex(px(p.w), px(p.d), f) }) : p.top ? mat({ color: p.top, roughness: 0.35 }) : bottom;
      return { geo: new THREE.BoxGeometry(p.w, p.h, p.d), material: [side, side, top, bottom, front, front] };
    }
    case 'bun': {
      const geo = new THREE.SphereGeometry(p.r, 10, 7);
      geo.scale(1, 0.65, 1);
      return { geo, material: mat({ color: p.color, roughness: 0.85 }) };
    }
    case 'stick': {
      const geo = new THREE.CapsuleGeometry(p.r, p.len, 3, 8);
      geo.rotateZ(Math.PI / 2);
      return { geo, material: mat({ color: p.color, roughness: 0.7 }) };
    }
    case 'can': {
      const label = mat({ map: wrapTex(p.r, p.h, f, (g, w, h) => { g.fillStyle = '#c9ced3'; g.fillRect(0, 0, w, h * 0.07); g.fillRect(0, h * 0.93, w, h * 0.07); }) });
      const metal = mat({ color: 0xc9ced3, metalness: 0.6, roughness: 0.35 });
      return { geo: new THREE.CylinderGeometry(p.r, p.r, p.h, 12), material: [label, metal, metal] };
    }
    case 'jar': {
      const label = mat({
        map: wrapTex(p.r, p.h, f, (g, w, h) => {
          g.fillStyle = p.lid; g.fillRect(0, 0, w, h * 0.17);
          g.fillStyle = p.fill; g.fillRect(0, h * 0.17, w, h * 0.1); g.fillRect(0, h * 0.85, w, h * 0.15);
        }),
        roughness: 0.3,
      });
      return { geo: new THREE.CylinderGeometry(p.r, p.r, p.h, 12), material: [label, mat({ color: p.lid }), mat({ color: p.fill })] };
    }
    case 'tub': {
      const label = mat({ map: wrapTex(p.r, p.h, f) });
      return { geo: new THREE.CylinderGeometry(p.r, p.r * 0.85, p.h, 12), material: [label, mat({ color: p.lid }), mat({ color: f.bg })] };
    }
    case 'wheel': {
      const side = mat({ map: wrapTex(p.r, p.h, f) });
      const cap = mat({
        map: canvas(128, 128, (g) => {
          g.fillStyle = p.rind; g.fillRect(0, 0, 128, 128);
          g.lineWidth = 3; g.strokeStyle = INK;
          if (p.capArt === 'lattice') {
            // an apple pie: filling under a lattice of pastry strips
            g.fillStyle = '#b8742a'; circle(g, 64, 64, 54); g.fill();
            g.fillStyle = '#e0a85a';
            for (let d = -48; d <= 48; d += 24) { g.fillRect(64 + d - 5, 12, 10, 104); g.fillRect(12, 64 + d - 5, 104, 10); }
          } else if (p.capArt === 'almond') {
            g.fillStyle = '#c98a3b'; circle(g, 64, 64, 50); g.fill();
            g.fillStyle = '#f2e3c4'; g.beginPath(); g.ellipse(64, 64, 18, 11, 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
          } else if (p.capArt === 'swirl') {
            g.strokeStyle = '#7b3f00'; g.lineWidth = 7; g.beginPath();
            for (let a = 0; a < Math.PI * 7; a += 0.2) g.lineTo(64 + Math.cos(a) * a * 2.6, 64 + Math.sin(a) * a * 2.6);
            g.stroke();
            g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 6; i++) g.fillRect(20 + i * 16, 30 + (i % 3) * 30, 18, 4);
          } else {
            g.fillStyle = '#ffffff'; circle(g, 64, 64, 26); g.fill(); g.stroke();
            g.fillStyle = f.fg; g.font = '900 20px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('48+', 64, 66);
          }
        }),
        roughness: 0.45,
      });
      return { geo: new THREE.CylinderGeometry(p.r, p.r, p.h, 16), material: [side, cap, cap] };
    }
    case 'ball': {
      if (p.veg) return { geo: new THREE.IcosahedronGeometry(p.r, 1), material: mat({ color: f.bg, flatShading: true }) };
      return { geo: new THREE.SphereGeometry(p.r, 10, 7), material: mat({ color: f.bg, roughness: 0.35 }) };
    }
    case 'bottle': {
      // even steps up the profile, so a height on the bottle is a height on the texture
      const r = p.r;
      const prof = [1, 1, 1, 1, 1, 1, 0.95, 0.75, 0.45, 0.36, 0.36];
      const pts = [new THREE.Vector2(0.001, 0), ...prof.map((k, i) => new THREE.Vector2(r * k, (p.h * i) / 10)), new THREE.Vector2(0.001, p.h)];
      const geo = new THREE.LatheGeometry(pts, 12);
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

/**
 * One draw call per material instead of one per face: the faces of a model
 * that share a material (a box's two sides, its front and back) are put
 * together. Geometries shared between looks are only regrouped once.
 */
const regrouped = new WeakMap();
function regroup({ geo, material }) {
  if (!Array.isArray(material) || !geo.groups.length) return { geo, material };
  if (regrouped.has(geo)) return regrouped.get(geo);
  const uniq = [...new Set(geo.groups.map((g) => material[g.materialIndex]))];
  let look = { geo, material };
  if (uniq.length < geo.groups.length) {
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    const src = geo.index.array;
    const out = [];
    const groups = [];
    uniq.forEach((m, mi) => {
      const start = out.length;
      for (const g of geo.groups) if (material[g.materialIndex] === m) for (let i = g.start; i < g.start + g.count; i++) out.push(src[i]);
      groups.push([start, out.length - start, mi]);
    });
    geo.setIndex(out);
    geo.clearGroups();
    if (uniq.length > 1) for (const [start, count, mi] of groups) geo.addGroup(start, count, mi);
    look = { geo, material: uniq.length > 1 ? uniq : uniq[0] };
  }
  regrouped.set(geo, look);
  return look;
}

/**
 * Every material of a mesh is a separate draw call, and there are a few
 * hundred kinds of product and clutter. So a model's materials (a label,
 * plain sides, a lid...) are painted under each other on one picture, and
 * each face is pointed at its own strip of it: the whole model is drawn in one
 * go. Models where that would change how they look (glass, shiny metal next
 * to something matt, pictures that repeat) are only regrouped.
 */
const painted = new WeakMap(); // geometry → its look (catalogue models can share a geometry)

/** The material of every corner of the model, or null when it can't be painted onto one picture. */
function paintPlan(geo, material, unique) {
  const first = unique[0];
  const uv = geo.attributes.uv;
  if (!uv) return null;
  for (const m of unique) {
    if (!m || !m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.transparent || m.alphaTest || m.vertexColors) return null;
    if (m.side !== first.side || m.flatShading !== first.flatShading || Math.abs(m.metalness - first.metalness) > 0.2) return null;
    if (m.emissive.getHex() !== 0 || ['normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'emissiveMap', 'bumpMap', 'lightMap'].some((k) => m[k])) return null;
    const t = m.map;
    if (t && (!t.image?.width || t.repeat.x !== 1 || t.repeat.y !== 1 || t.offset.x || t.offset.y || t.rotation)) return null;
  }
  const index = geo.index?.array;
  const owner = new Map(); // corner → material
  for (const grp of geo.groups) {
    const m = material[grp.materialIndex];
    for (let j = grp.start; j < grp.start + grp.count; j++) {
      const v = index ? index[j] : j;
      if (owner.has(v) && owner.get(v) !== m) return null; // a corner shared by two materials
      owner.set(v, m);
      if (m.map && (uv.getX(v) < -0.001 || uv.getX(v) > 1.001 || uv.getY(v) < -0.001 || uv.getY(v) > 1.001)) return null;
    }
  }
  return owner;
}

function oneMaterial(look) {
  const { geo, material } = look;
  if (!Array.isArray(material) || !geo.groups.length) return look;
  if (painted.has(geo)) return painted.get(geo);
  const unique = [...new Set(geo.groups.map((g) => material[g.materialIndex]))];
  const owner = unique.length > 1 ? paintPlan(geo, material, unique) : null;
  if (!owner) {
    const regrouped = regroup(look);
    painted.set(geo, regrouped);
    return regrouped;
  }
  const PAD = 4; // pixels between strips, so they don't bleed into each other
  const slots = new Map(unique.map((m) => [m, { m, img: m.map?.image ?? null, h: m.map?.image?.height ?? 8 }]));
  const W = Math.max(16, ...[...slots.values()].map((s) => s.img?.width ?? 0));
  let H = 0;
  for (const s of slots.values()) {
    s.y = H + PAD;
    H += s.h + 2 * PAD;
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  for (const s of slots.values()) {
    const colour = s.m.color.getStyle();
    if (s.img) {
      // the picture, with its top and bottom rows stretched into the padding
      g.drawImage(s.img, 0, 0, s.img.width, 1, 0, s.y - PAD, W, PAD);
      g.drawImage(s.img, 0, s.img.height - 1, s.img.width, 1, 0, s.y + s.h, W, PAD);
      g.drawImage(s.img, 0, s.y, W, s.h);
      if (s.m.color.getHex() !== 0xffffff) {
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = colour;
        g.fillRect(0, s.y - PAD, W, s.h + 2 * PAD);
        g.globalCompositeOperation = 'source-over';
      }
    } else {
      g.fillStyle = colour;
      g.fillRect(0, s.y - PAD, W, s.h + 2 * PAD);
    }
  }
  // point every corner at its material's strip
  const uv = geo.attributes.uv;
  for (const [v, m] of owner) {
    const s = slots.get(m);
    const u = s.img ? uv.getX(v) : 0.5;
    const t = s.img ? uv.getY(v) : 0.5;
    uv.setXY(v, u, 1 - (s.y + s.h) / H + (t * s.h) / H);
  }
  uv.needsUpdate = true;
  geo.clearGroups();
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const first = unique[0];
  const label = unique.find((m) => m.map) ?? first;
  const result = { geo, material: mat({ map, roughness: label.roughness, metalness: first.metalness, side: first.side, flatShading: first.flatShading }) };
  painted.set(geo, result);
  return result;
}

const lookOf = (p) => oneMaterial(buildLook(p));

// ---------------------------------------------------------------- the stock: placing, knocking off, restocking
const GRAVITY = 9.8;
const _m = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * All the products in the shop. `bounds` keeps tumbling products inside the
 * shop floor ({x0, x1, z0, z1}); `floorY` is the floor's height. `tables`
 * ({x0, x1, z0, z1, y}, optionally `floor`: the height of the floor they stand
 * on) are flat tops products can land and roll on (and off). A section can
 * have its own `bounds` and `floorY` (a room on another floor of the house).
 * `catalogue` says what each product id looks like (the supermarket's
 * PRODUCTS unless given).
 */
export function createStock(scene, { bounds, floorY = 0.012, tables = [], catalogue = PRODUCTS }) {
  const kinds = new Map(); // product id → { look, items, mesh }
  const items = [];
  const flying = new Set();
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // A catalogue entry can be another one in a different colour ({ base, color }):
  // they share one model, coloured per item, so they cost no extra draw calls.
  function kind(id) {
    const variant = catalogue[id];
    if (variant?.base) id = variant.base;
    let k = kinds.get(id);
    if (!k) {
      const p = catalogue[id];
      if (!p) throw new Error(`unknown product ${id}`);
      k = { id, p, half: halfSize(p), items: [], mesh: null };
      kinds.set(id, k);
    }
    return k;
  }

  /**
   * Puts one product on a shelf: (x, y, z) the middle of its underside, yaw
   * which way its front faces. The last argument is either a number, the
   * slope of a sloping shelf (it leans the product's top that far, in
   * radians, towards its front, so the shelf rises towards the back), or
   * options:
   * `tilt` (a quaternion) turns it further, after the yaw, e.g. to lay it on
   * its side; `lift` is then its middle's height above y.
   * With `inside` it's hidden in another product (the pieces in a board game
   * box): it isn't knocked itself, but comes flying out when that one is.
   * With `on` it rests on another product (a pile of plates, a stack of
   * games), so it falls when that one is knocked away from under it.
   */
  function place(id, x, y, z, yaw, section, row = 0, opts = {}) {
    const { slope = 0, tilt = null, lift = null, inside = null, on = null } = typeof opts === 'number' ? { slope: opts } : opts;
    const k = kind(id);
    const tint = catalogue[id].base ? catalogue[id].color : null;
    if (tint !== null) k.tinted = true;
    const homeQ = new THREE.Quaternion().setFromAxisAngle(UP, yaw + (rnd() - 0.5) * 0.08);
    if (slope) homeQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), slope));
    if (tilt) homeQ.multiply(tilt);
    const home = lift !== null
      ? new THREE.Vector3(x, y + lift, z)
      : new THREE.Vector3(x, y, z).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(homeQ), k.half[1]);
    const item = {
      k, idx: k.items.length, section: inside ? inside.section : section, row,
      home,
      homeQ,
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(),
      vel: new THREE.Vector3(), spin: new THREE.Vector3(),
      state: 'home', restQ: null, t: 0, ground: floorY, contents: null, above: null, tint,
    };
    if (on) (on.above ??= []).push(item);
    k.items.push(item);
    items.push(item);
    if (inside) (inside.contents ??= []).push(item);
    else section.items.push(item);
    return item;
  }

  const boundsOf = (item) => item.section?.bounds ?? bounds;
  const floorOf = (item) => item.section?.floorY ?? floorY;

  /** Fills a row of shelf from `a` to `b` along its length with runs of products. */
  function fillRow(ids, { along, a, b, y, depthAt, yaw, maxH, section, rows = 1, room = 0.45 }) {
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

  // Products move around, but only inside their room (or the shop) and not far
  // above where they stand. A sphere around that area does as a kind's bounds,
  // so it's only drawn when that area is in view.
  function areaOf(k) {
    const box = new THREE.Box3();
    for (const item of k.items) {
      const b = boundsOf(item);
      box.expandByPoint(_v.set(b.x0, item.home.y - 1, b.z0));
      box.expandByPoint(_v.set(b.x1, item.home.y + 3, b.z1));
    }
    return box.getBoundingSphere(new THREE.Sphere());
  }

  function build() {
    for (const k of kinds.values()) {
      const look = lookOf(k.p);
      const mesh = new THREE.InstancedMesh(look.geo, look.material, k.items.length);
      mesh.boundingSphere = areaOf(k);
      if (k.tinted) {
        for (const item of k.items) mesh.setColorAt(item.idx, _color.set(item.tint ?? 0xffffff));
        mesh.instanceColor.needsUpdate = true;
      }
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
      item.ground = floorOf(item);
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
   * With `radial` they fly away from the point instead (things lying on a
   * floor or table that he lands among); with `again` the ones that already
   * fell get kicked about again too (they don't count a second time).
   * `power` makes them fly further (or less far). With `fresh: false` only the
   * ones already knocked down move.
   */
  function knock(section, point, out, strength, push = null, { radius = null, chance = 1, radial = false, again = false, fresh = true, power: boost = 1 } = {}) {
    const r = radius ?? Math.min(0.7, 0.15 + strength * 0.05);
    const power = Math.min(1.6, 0.5 + strength / 10) * boost;
    let n = 0;
    for (const item of section.items) {
      const home = item.state === 'home';
      if (home ? !fresh : !(again && item.state === 'down')) continue;
      const at = home ? item.home : item.pos;
      const dx = at.x - point.x;
      const dy = (at.y - point.y) / 1.2;
      const dz = at.z - point.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // the ones nearest the impact almost always go; the row behind the front one less often
      if (d > r || rnd() > chance * (1 - 0.5 * (d / r) ** 2) * (item.row ? 0.45 : 1)) continue;
      let dir = out;
      if (radial) {
        dir = _dir.set(dx, 0, dz);
        if (dir.lengthSq() < 1e-6) dir.set(rnd() - 0.5, 0, rnd() - 0.5);
        dir.normalize();
      }
      if (home) n += launch(item, dir, power, push);
      else launch(item, dir, power * 0.6, push);
    }
    return n;
  }

  /** Sends a product flying, and whatever rests on it or is inside it. Returns how many of those were home. */
  function launch(item, out, power, push) {
    let n = item.state === 'home' ? 1 : 0;
    if (item.state === 'down') item.pos.y += 0.01; // kicked up off the floor
    item.state = 'flying';
    item.t = 0;
    _axis.crossVectors(out, UP); // sideways along the shelf
    item.vel.copy(out).multiplyScalar((0.6 + rnd() * 1.6) * power)
      .addScaledVector(_axis, (rnd() - 0.5) * 1.4 * power)
      .add(_v.set(0, 0.3 + rnd() * 1.4 * power, 0));
    if (push) item.vel.addScaledVector(_v.set(push.x, 0, push.z), 0.15);
    item.spin.set((rnd() - 0.5) * 16, (rnd() - 0.5) * 8, (rnd() - 0.5) * 16).multiplyScalar(power);
    flying.add(item);
    // what was inside it spills out, every which way
    if (item.contents) {
      const ox = out.x;
      const oz = out.z;
      for (const c of item.contents) {
        if (c.state !== 'home') continue;
        const dir = new THREE.Vector3(ox + (rnd() - 0.5) * 1.6, 0, oz + (rnd() - 0.5) * 1.6).normalize();
        launch(c, dir, power * (0.6 + rnd() * 0.7), push);
      }
    }
    // what was stacked on it topples too (counted: it's a mess as well)
    if (item.above) {
      const ox = out.x;
      const oz = out.z;
      for (const a of item.above) {
        if (a.state !== 'home') continue;
        n += launch(a, new THREE.Vector3(ox + (rnd() - 0.5) * 0.6, 0, oz + (rnd() - 0.5) * 0.6).normalize(), power * (0.5 + rnd() * 0.5), push);
      }
    }
    return n;
  }

  /** Height of the lowest point of a product below its middle, at its current tilt. */
  function lowest(item) {
    _m.makeRotationFromQuaternion(item.quat);
    const e = _m.elements;
    const [hx, hy, hz] = item.k.half;
    return Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz;
  }

  /** What a product would land on right below it: a table top it's above, or the floor. */
  function groundUnder(item, low) {
    let g = floorOf(item);
    const bottom = item.pos.y - low + 0.03;
    for (const t of tables) {
      if (t.y > g && t.y <= bottom && item.pos.x > t.x0 && item.pos.x < t.x1 && item.pos.z > t.z0 && item.pos.z < t.z1) g = t.y;
    }
    return g;
  }

  /** Below a table's top its sides are solid: push a product back out and bounce it off. */
  function keepOutOfTables(item, low) {
    const r = Math.max(item.k.half[0], item.k.half[2]);
    const p = item.pos;
    for (const t of tables) {
      if (p.y - low > t.y - 0.02 || (t.floor !== undefined && p.y < t.floor)) continue;
      if (p.x < t.x0 - r || p.x > t.x1 + r || p.z < t.z0 - r || p.z > t.z1 + r) continue;
      // out through the nearest side
      const sides = [[t.x0 - r - p.x, 'x'], [t.x1 + r - p.x, 'x'], [t.z0 - r - p.z, 'z'], [t.z1 + r - p.z, 'z']];
      let [d, axis] = sides[0];
      for (const s of sides) if (Math.abs(s[0]) < Math.abs(d)) [d, axis] = s;
      p[axis] += d;
      if (item.vel[axis] * d < 0) item.vel[axis] *= -0.3;
    }
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
        const bounds = boundsOf(item);
        if (item.pos.x < bounds.x0 + 0.1 || item.pos.x > bounds.x1 - 0.1) { item.pos.x = Math.min(bounds.x1 - 0.1, Math.max(bounds.x0 + 0.1, item.pos.x)); item.vel.x *= -0.3; }
        if (item.pos.z < bounds.z0 + 0.1 || item.pos.z > bounds.z1 - 0.1) { item.pos.z = Math.min(bounds.z1 - 0.1, Math.max(bounds.z0 + 0.1, item.pos.z)); item.vel.z *= -0.3; }
        const low = lowest(item);
        // both judged from where it was before this step, so landing on a table top isn't hitting its side
        keepOutOfTables(item, low + item.vel.y * dt);
        const ground = groundUnder(item, low + item.vel.y * dt);
        if (item.pos.y - low < ground) {
          item.pos.y = ground + low;
          item.ground = ground;
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
        const bounds = boundsOf(item);
        item.pos.x = Math.min(bounds.x1 - 0.1, Math.max(bounds.x0 + 0.1, item.pos.x));
        item.pos.z = Math.min(bounds.z1 - 0.1, Math.max(bounds.z0 + 0.1, item.pos.z));
        const low = lowest(item);
        if (item.ground < floorOf(item) + 0.05) keepOutOfTables(item, low); // rolling on the floor
        const ground = groundUnder(item, low);
        if (ground < item.ground - 0.01) {
          // rolled off the edge of a table: fall again
          item.state = 'flying';
          item.t = 0;
          write(item);
          continue;
        }
        item.pos.y = ground + low;
        if (item.t > 0.6 && item.vel.lengthSq() < 0.0004) {
          item.quat.copy(item.restQ);
          item.pos.y = ground + lowest(item);
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
    section: (opts = {}) => ({ items: [], ...opts }),
    get falling() { return flying.size; },
  };
}
