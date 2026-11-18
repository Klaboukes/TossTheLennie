import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { floorGeometry, meterBoxUVs } from './textures.js';
import { createStock, ASSORTMENT, PRODUCTS, halfSize } from './products.js';
import { CLEAR_NEAR, CLEAR_FAR } from './house.js';
import { setFade } from './batching.js';
import { farCopy } from './farview.js';
import { drawn } from './pictures.js';

// The supermarket across the road, after the real one: a long orange box
// whose wall steps up and down along the street, with dark slate and glazed
// gables rising in the dips, a brick-and-glass entrance and a big green
// four-dot logo. Lennie can be flung in through the open sliding doors:
// inside are checkouts, a sloping stand of fruit and veg crates, aisles of
// shelves stocked with products (products.js) that tumble off when Lennie hits
// them, and glass-door freezers and fridges. The shop window and every
// freezer and fridge door is breakable glass. The west end is a closed storeroom.
// Walls, the roof and the entrance fade like the house's walls when they block
// the view of the camera target.
export const SHOP = {
  x0: -36, end: 20, // whole building
  hall: -22, x1: 14, // the shop floor runs from hall to x1; west of it is the storeroom, east of it a back room
  z0: 30, z1: 46, // front (street side) and back walls
  h: 4.2, // wall height; the ceiling is at 3.95
  t: 0.3, // wall thickness
  door: [-5.6, -2.4], doorTop: 2.6, // the open sliding doors
};
// inside faces of the shop floor's walls
const IN = { x0: SHOP.hall + SHOP.t, x1: SHOP.x1 - SHOP.t, z0: SHOP.z0 + SHOP.t, z1: SHOP.z1 - SHOP.t, y1: SHOP.h - 0.25 };

const FADED = 0.12;
const INK_SIGN = '#2b2b2b';
const FADE_MARGIN = 0.6;

// What pops up when Lennie knocks a pile of things over: one line at random
// from the list for that spot (main.js picks it, never the same twice in a row).
const MESS = {
  aisle: ['Price check: everything!', 'Shopping the fast way!', 'Everything must go!', 'Self-service!', 'Mind the shelves, Lennie!'],
  freezers: ['Clean-up at the freezers!', 'Brain freeze!', 'Chill out, Lennie!', 'Frozen chaos!', 'Cool landing!'],
  fridges: ['Clean-up at the fridges!', 'Fizzy business!', 'Shaken, not stirred!', 'Pop goes the fridge!', 'Soda splash!'],
  veg: ['Clean-up at the veg!', 'Lettuce pray!', 'Peas out!', 'Eat your greens, Lennie!', 'Romaine calm!', 'Fruit salad!'],
  bread: ['Crumbs, Lennie!', 'Loaf me alone!', 'Use your loaf!', 'Fresh out of the oven, onto the floor!', 'Lekker brood!'],
  rolls: ['Rock and roll!', 'Bun voyage!', 'The rolls are rolling!', 'Krentenbollen on the run!', 'Crumbs, Lennie!'],
  pastries: ['Taart attack!', 'Custard catastrophe!', 'Pink icing on your nose!', 'Splat goes the tompouce!', 'Who ordered a tompouce sandwich?'],
  cheese: ['Say cheese!', 'Kaastastrophe!', 'Gouda grief!', 'Holey moley!', 'A wheel-y good crash!', 'Brie-lliant!'],
  pindakaas: ['Smooth move!', 'Nuts!', 'Crunchy or smooth?', 'Sticky situation!', 'Going nuts, Lennie!'],
  snacks: ['Snack attack!', 'Bitterballen bonanza!', 'Frikandel frenzy!', 'Mustard not included!', 'Frozen solid... and flying!'],
  sausage: ['What the sausage?!', 'Wurst landing ever!', 'Best of the wurst!', 'Rookworst rain!', 'Meat you on the floor!'],
  hagelslag: ['Hagelslag hailstorm!', 'Sprinkles everywhere!', 'Breakfast is served!', 'Stacked and smacked!', 'Muisjes? No, hagelslag!'],
  marsepein: ['This little piggy went flying!', 'Pigs can fly!', 'Pink pig party!', 'Sweet as marsepein!', 'Sint saw that!'],
  letters: ['L is for Lennie!', 'Chocolate alphabet soup!', 'Spell it out, Lennie!', 'Sint saw that!', 'Is it 5 December already?'],
  flowers: ['Flower power!', 'Say it with flowers!', 'Tulip trouble!', 'Oops-a-daisy!', 'Painting the town red!'],
  sint: ['In de zak, Lennie!', 'Sint saw that!', 'Strooi, strooi, strooi!', 'Is it 5 December already?', 'Pepernoten party!'],
};

// (`draw` runs again when the picture is needed again, see pictures.js)
export function canvasTexture(w, h, draw) {
  const t = drawn(w, h, draw);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A cheerful comic food poster for the outside wall: produce on a coloured background. */
function poster(bg, items) {
  return canvasTexture(256, 192, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = bg;
    g.fillRect(10, 10, w - 20, h - 20);
    for (const [kind, x, y, r] of items) {
      g.lineWidth = 4;
      g.strokeStyle = '#2b2b2b';
      if (kind === 'apple' || kind === 'orange' || kind === 'tomato') {
        g.fillStyle = { apple: '#e8473b', orange: '#f59a23', tomato: '#d8312a' }[kind];
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#3e9a3c';
        g.beginPath(); g.ellipse(x + r * 0.3, y - r * 0.95, r * 0.35, r * 0.18, -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
      } else if (kind === 'bread') {
        g.fillStyle = '#d99a4e';
        g.beginPath(); g.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = '#8a5a26';
        for (const d of [-0.7, 0, 0.7]) { g.beginPath(); g.moveTo(x + d * r - 8, y - 8); g.lineTo(x + d * r + 8, y + 8); g.stroke(); }
      } else if (kind === 'cheese') {
        g.fillStyle = '#f6d04d';
        g.beginPath(); g.moveTo(x - r * 1.4, y + r * 0.8); g.lineTo(x + r * 1.4, y + r * 0.8); g.lineTo(x + r * 1.4, y - r * 0.4); g.lineTo(x - r * 1.4, y + r * 0.2); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#e0b52f';
        for (const [dx, dy] of [[-0.4, 0.4], [0.5, 0.2], [0.9, 0.55]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, r * 0.16, 0, Math.PI * 2); g.fill(); }
      }
    }
  });
}

/**
 * The glazed gable ends: grey-green glass with the frames running at 45°,
 * parallel to the roof slopes, in diamonds 2 m across, and a pale sky in it.
 */
function glazingTexture() {
  const t = canvasTexture(128, 128, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#b9cdd0');
    sky.addColorStop(1, '#8ea7aa');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(0, h * 0.55); g.lineTo(w * 0.45, h); g.lineTo(w * 0.7, h); g.lineTo(0, h * 0.3); g.closePath(); g.fill();
    // both diagonals of the tile: tiled, they make a lattice of diamonds
    g.strokeStyle = '#66706f';
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 2, 1 / 2); // (the gable ends' corners are in metres)
  return t;
}

/** The shop's logo, hand-drawn in comic style: four green dots and a bold green name, on a clear background. */
function logoTexture() {
  return canvasTexture(1024, 256, (g) => {
    const green = '#3fae3a';
    const ink = '#1d4f1b';
    // four dots in a square, leaving a white plus between them
    const cx = 150;
    const cy = 112;
    const r = 52;
    const d = 56;
    g.lineWidth = 9;
    g.strokeStyle = ink;
    g.fillStyle = green;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath(); g.arc(cx + sx * d, cy + sy * d, r, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.fillRect(cx - 9, cy - 66, 18, 132);
    g.fillRect(cx - 66, cy - 9, 132, 18);
    // the name
    g.font = '900 190px "Arial Black", "Trebuchet MS", sans-serif';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = ink;
    g.strokeText('PLUS', 290, cy + 6);
    g.fillStyle = green;
    g.fillText('PLUS', 290, cy + 6);
    g.font = 'bold 52px "Trebuchet MS", sans-serif';
    g.lineWidth = 8;
    g.strokeText('supermarkt', 600, 222);
    g.fillStyle = '#ffffff';
    g.fillText('supermarkt', 600, 222);
  });
}

/** A red offer card: "ACTIE" in a white circle over a price. */
function offerTexture(price) {
  return canvasTexture(128, 160, (g, w) => {
    g.fillStyle = '#e2231a';
    g.fillRect(0, 0, w, 160);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(64, 54, 42, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e2231a';
    g.font = 'bold 26px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ACTIE', 64, 56);
    g.fillStyle = '#ffffff';
    g.fillRect(10, 106, 108, 46);
    g.fillStyle = '#1b1b1b';
    g.font = 'bold 36px "Trebuchet MS", sans-serif';
    g.fillText(price, 64, 131);
  });
}

function labelTexture(text, bg = '#3fae3a', fg = '#ffffff', w = 512, h = 112) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `bold ${Math.round(h * 0.55)}px "Trebuchet MS", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  });
}

/** Rows of drinks and cartons seen through a fridge door. */
function fridgeTexture() {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#d9eef5';
    g.fillRect(0, 0, w, h);
    const cols = ['#e8473b', '#ffffff', '#3b7dd8', '#f6d04d', '#3fae3a', '#f59a23'];
    let k = 0;
    for (let row = 0; row < 5; row++) {
      const y = 20 + row * 98;
      g.fillStyle = '#9fb3ba';
      g.fillRect(0, y + 80, w, 6);
      for (let x = 10; x < w - 20; x += 30) {
        g.fillStyle = cols[k++ % cols.length];
        const tall = row % 2 ? 70 : 52;
        g.fillRect(x, y + 80 - tall, 22, tall);
        g.fillRect(x + 7, y + 80 - tall - 10, 8, 10);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(20, 0, 24, h);
    g.strokeStyle = '#7d8b90';
    g.lineWidth = 10;
    g.strokeRect(0, 0, w, h);
  });
}

export function buildSupermarket(root, world, physMats, { std, tex }) {
  // The shop is built in a group of its own (`scene` from here on), which is
  // switched off while the shop is seen from across the road: a cheap copy of
  // its fixed parts stands in for it then (finish(), farview.js). What has to
  // stay itself goes in the outer group: the products, and the shop window's panes.
  const outer = new THREE.Group();
  root.add(outer);
  const scene = new THREE.Group();
  outer.add(scene);
  // ---------------------------------------------------------------- fading
  // Like the house: each "line" (a wall, the roof) is a plane with an extent;
  // it fades when the sight line from the camera target to the camera crosses
  // it within that extent.
  const lines = new Map();
  const matLine = new Map();
  function line(name, axis, value, min, max) {
    lines.set(name, { axis, value, min, max, mats: new Set(), cache: new Map(), opacity: 1, target: 1 });
  }
  line('front', 2, SHOP.z0, [SHOP.hall, 0, 0], [SHOP.x1 + 0.5, 6, 0]);
  line('east', 0, SHOP.x1, [0, 0, SHOP.z0], [0, SHOP.h, SHOP.z1]);
  line('back', 2, SHOP.z1, [SHOP.hall, 0, 0], [SHOP.x1, SHOP.h, 0]);
  line('roof', 1, IN.y1 + 0.1, [SHOP.hall, 0, SHOP.z0], [SHOP.x1, 0, SHOP.z1]);

  function lineMat(name, mat) {
    const entry = lines.get(name);
    let clone = entry.cache.get(mat);
    if (!clone) {
      clone = mat.clone();
      clone.userData.baseOpacity = mat.transparent ? mat.opacity : 1;
      // see-through only while it fades (see setFade in batching.js), unless it's glass anyway
      clone.userData.fades = true;
      clone.userData.seeThrough = mat.transparent;
      entry.cache.set(mat, clone);
      entry.mats.add(clone);
      matLine.set(clone, entry);
    }
    return clone;
  }

  const add = (mesh, { cast = false, fade = null } = {}) => {
    if (fade) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => lineMat(fade, m)) : lineMat(fade, mesh.material);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    scene.add(mesh);
    return mesh;
  };
  const boxAt = (min, max, mat, opts = {}) => {
    const geo = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    if (opts.uv) meterBoxUVs(geo, min, max);
    const m = add(new THREE.Mesh(geo, mat), opts);
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    return m;
  };
  const solid = (min, max, kind, material = physMats.hard) => {
    const b = new CANNON.Body({ mass: 0, material, shape: new CANNON.Box(new CANNON.Vec3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2)) });
    b.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    // The shop's shelves, fridges and counters are metal: they clang.
    b.surface = kind === 'furniture' ? { kind, sound: 'metal' } : { kind };
    world.addBody(b);
    return b;
  };
  // Breakable glass, like the house's windows (main.js smashes them): the
  // meshes of one pane, the box its physics body fills, and the way it faces.
  const windows = [];
  function pane(meshes, min, max, normal, onBreak = null) {
    const group = new THREE.Group();
    for (const m of meshes) group.add(m);
    scene.add(group);
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const b = new CANNON.Body({ mass: 0, material: physMats.glass, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)) });
    b.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const piece = {
      kind: 'window', owner: null, group, broken: false, story: 0,
      center: new THREE.Vector3(b.position.x, b.position.y, b.position.z),
      normal: normal.clone(),
      width: normal.z ? size[0] : size[2],
      height: size[1],
      body: b,
      onBreak,
    };
    b.surface = { kind: 'glass', piece };
    world.addBody(b);
    windows.push(piece);
    return piece;
  }

  // (box faces: +x, −x, +y, −y, +z, −z; the shop's street side is −z)
  const faces = (px, nx, py, ny, pz, nz) => [px, nx, py, ny, pz, nz];

  const white = std({ color: 0xf6f6f2, roughness: 0.6 });
  // its street side faces away from the game's sun, so a little glow keeps the orange bright
  const orange = std({ color: 0xf07448, emissive: 0x5a2410, roughness: 0.8 });
  const roofGrey = std({ color: 0x5b5f64 });
  const innerWall = std({ color: 0xece8df, roughness: 0.9 });
  // the ceiling faces down, away from the sun, so it glows a little to stay light
  const ceiling = std({ color: 0xdedbd3, emissive: 0x9a978f, roughness: 0.9 });
  const darkFrame = std({ color: 0x3c4146, roughness: 0.5 });
  const shopGlass = std({ color: 0x9cc9d9, roughness: 0.1, transparent: true, opacity: 0.4 });
  const brick = std({ map: tex.brick, color: 0xffc8b8 });
  const green = std({ color: 0x3fae3a, roughness: 0.6 });

  // ---------------------------------------------------------------- the storeroom (closed, solid)
  boxAt([SHOP.x0, 0, SHOP.z0], [SHOP.hall, SHOP.h, SHOP.z1], faces(orange, orange, roofGrey, orange, orange, orange), { cast: true });
  solid([SHOP.x0, 0, SHOP.z0], [SHOP.hall, SHOP.h, SHOP.z1], 'wall');
  // and a back room east of the shop floor, closed too; it fades with the
  // shop floor's east wall, so you can still look in from that side
  boxAt([SHOP.x1, 0, SHOP.z0], [SHOP.end, SHOP.h, SHOP.z1], faces(orange, orange, roofGrey, orange, orange, orange), { cast: true, fade: 'east' });
  solid([SHOP.x1, 0, SHOP.z0], [SHOP.end, SHOP.h, SHOP.z1], 'wall');

  // ---------------------------------------------------------------- walls of the shop floor
  // The walls stop under the roof slab (at the ceiling), which forms the top
  // band of the facade by itself: drawn up to the roof's top too, their tops
  // and outsides lay exactly on the roof's and flickered against it.
  const [d0, d1] = SHOP.door;
  // the wall is open behind the glass entrance (E below), so you can see in
  const frontMats = faces(orange, orange, orange, orange, innerWall, orange);
  for (const [a, b] of [[SHOP.hall, -9.0], [-0.1, SHOP.x1]]) {
    boxAt([a, 0, SHOP.z0], [b, IN.y1, SHOP.z0 + SHOP.t], frontMats, { cast: true, fade: 'front' });
    solid([a, 0, SHOP.z0], [b, SHOP.h, SHOP.z0 + SHOP.t], 'wall');
  }

  boxAt([IN.x1, 0, SHOP.z0], [SHOP.x1, IN.y1, SHOP.z1], faces(orange, innerWall, orange, orange, orange, orange), { cast: true, fade: 'east' });
  solid([IN.x1, 0, SHOP.z0], [SHOP.x1, SHOP.h, SHOP.z1], 'wall');
  boxAt([SHOP.hall, 0, IN.z1], [IN.x1, IN.y1, SHOP.z1], faces(orange, orange, orange, orange, orange, innerWall), { fade: 'back' });
  solid([SHOP.hall, 0, IN.z1], [IN.x1, SHOP.h, SHOP.z1], 'wall');
  // the storeroom's wall, with a staff door on the shop side
  boxAt([SHOP.hall, 0, IN.z0], [IN.x0, IN.y1, IN.z1], innerWall);
  solid([SHOP.hall, 0, IN.z0], [IN.x0, SHOP.h, IN.z1], 'wall');
  // (in the back corner, past the cheese cooler)
  boxAt([IN.x0, 0, 43.1], [IN.x0 + 0.04, 2.2, 44.5], std({ color: 0x8d949a, roughness: 0.5 }));
  boxAt([IN.x0, 2.3, 43.1], [IN.x0 + 0.04, 2.6, 44.5], std({ map: labelTexture('Alleen personeel', '#ffffff', '#c0392b', 512, 96) }));

  // ---------------------------------------------------------------- the street front: orange blocks before tall gables
  // After the photo of the real shop. Pitched roofs run front to back over
  // the flat roof, and their gable ends come all the way down to the ground:
  // tall house-shaped panels, dark slate or glazed, side by side. Orange
  // blocks stand just in front of them, their top corners cut off at 45°
  // under the roof slopes. So between two blocks a gable pair shows as a
  // grey Y: two slanting arms under the roofs, meeting in a strip down to the
  // ground with a drainpipe from the valley (and a door, in the first one).
  // A low orange point stands in front of the valley between the two dark
  // pairs. Seen from the street (+x is on the left): a short block, four dark
  // gables with the point, a short block, the entrance, a short block, two
  // glazed gables, and the long block with the name to the far end.
  boxAt([SHOP.hall, IN.y1, SHOP.z0], [SHOP.x1, SHOP.h, SHOP.z1], faces(orange, orange, roofGrey, ceiling, orange, orange), { fade: 'roof' });
  solid([SHOP.hall, IN.y1, SHOP.z0], [SHOP.x1, SHOP.h, SHOP.z1], 'roof');

  /** A mesh of `poly` ([x, y] corners around `at`, in the x-y plane) stretched in z from za to zb; materials [ends, sides]. */
  function prism(poly, at, za, zb, mats, opts) {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const m = add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: zb - za, bevelEnabled: false }), mats), opts);
    m.position.set(at[0], at[1], za);
    return m;
  }
  /** A solid body of a convex `poly` stretched like prism(), so Lennie lands on (and slides down) its slopes. */
  function prismBody(poly, at, za, zb, kind) {
    const n = poly.length;
    const pts = [za, zb].flatMap((z) => poly.map(([x, y]) => [at[0] + x, at[1] + y, z]));
    const c = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);
    const verts = pts.map((p) => new CANNON.Vec3(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    const ring = [...Array(n).keys()];
    const faceList = [ring, ring.map((i) => i + n), ...ring.map((i) => [i, (i + 1) % n, (i + 1) % n + n, i + n])].map((f) => {
      const [a, b, d] = f.map((i) => verts[i]);
      const nrm = b.vsub(a).cross(d.vsub(a));
      const mid = f.reduce((s, i) => s.vadd(verts[i]), new CANNON.Vec3()).scale(1 / f.length);
      return nrm.dot(mid) < 0 ? [...f].reverse() : f; // normals point away from the centre
    });
    const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.ConvexPolyhedron({ vertices: verts, faces: faceList }) });
    b.position.set(...c);
    b.surface = { kind };
    world.addBody(b);
  }

  // Sizes, in metres. Every slope is 45°, except the orange point's gentler one.
  const HIGH = 5.0; // the orange blocks' flat tops
  const VALLEY = 4.75; // where two gables meet (their eaves), just under the blocks' tops
  const G = 1.6; // half a gable's width: its peak is this much above the valley
  const CUT = 1.6; // the blocks' cut corners drop this much (and run this far sideways)
  const FOOT = HIGH - CUT; // the height where a cut corner meets the block's vertical edge
  const GAP = 1.0; // half the width of the strip between two blocks, down to the ground
  const POINT = 2 * G - GAP; // half the orange point's width, so it fills the space between two strips
  // The valleys over the strips (and the one behind the point). The dark
  // pairs stand over the shop floor between the entrance and the back room,
  // their outer gables short of the entrance; the glazed pair
  // stands as far on the entrance's other side, so the entrance is in the middle.
  const E = { x0: -9.6, x1: 0.5, z0: SHOP.z0 - 0.7, top: 5.6 }; // the entrance (built below)
  const v3 = 3.9; // the dark pair beside the entrance
  const v2 = v3 + 2 * G; // behind the orange point
  const v1 = v2 + 2 * G; // the dark pair near the east end
  const vg = E.x0 + E.x1 - v3; // the glazed pair
  // Layers from the street in: the blocks' fronts, the gable ends (a thin
  // panel each), then the shop's own wall at SHOP.z0.
  const Z = { block: SHOP.z0 - 0.16, panel: SHOP.z0 - 0.08, panelBack: SHOP.z0 - 0.02, back: SHOP.z0 + SHOP.t - 0.05 };
  const fadeAt = (x) => (x > SHOP.hall ? 'front' : null);

  // The orange blocks, each a convex outline from the ground up (so each is one solid body too).
  // Their backs are 5 cm inside the wall, so no face of them lies in one plane with the wall's inside.
  const E0 = -9.3; // (the blocks either side of the entrance end inside its brick pillars)
  const E1 = 0.2;
  const SEAM = SHOP.hall + 0.05; // the long block is in two, so the part in front of the shop floor can fade
  const blocks = [
    [[v1 + GAP, 0], [SHOP.end + 0.02, 0], [SHOP.end + 0.02, HIGH], [v1 + GAP + CUT, HIGH], [v1 + GAP, FOOT]], // the east end's block
    [[v2 - POINT, 0], [v2 + POINT, 0], [v2 + POINT, FOOT], [v2, VALLEY - 0.02], [v2 - POINT, FOOT]], // the orange point
    [[E1, 0], [v3 - GAP, 0], [v3 - GAP, FOOT], [v3 - GAP - CUT, HIGH], [E1, HIGH]], // the short block beside the entrance
    [[vg + GAP, 0], [E0, 0], [E0, HIGH], [vg + GAP + CUT, HIGH], [vg + GAP, FOOT]], // the short block on the entrance's other side
    [[SEAM, 0], [vg - GAP, 0], [vg - GAP, FOOT], [vg - GAP - CUT, HIGH], [SEAM, HIGH]], // the long block with the name...
    [[SHOP.x0 - 0.02, 0], [SEAM, 0], [SEAM, HIGH], [SHOP.x0 - 0.02, HIGH]], // ...on in front of the storeroom
  ];
  for (const poly of blocks) {
    prism(poly, [0, 0], Z.block, Z.back, orange, { cast: true, fade: fadeAt(poly[0][0]) });
    prismBody(poly, [0, 0], Z.block, Z.back, 'wall');
  }
  // the blocks' tops run on round both ends of the building, all the way to the back
  for (const [x0, x1, fade] of [[SHOP.x0 - 0.02, SHOP.x0 + SHOP.t], [SHOP.end - SHOP.t, SHOP.end + 0.02, 'east']]) {
    boxAt([x0, SHOP.h - 0.1, Z.back], [x1, HIGH, SHOP.z1 + 0.02], orange, { cast: true, fade });
    solid([x0, SHOP.h - 0.1, Z.back], [x1, HIGH, SHOP.z1 + 0.02], 'wall');
  }

  // The gables: a tall panel from the ground for the end, and the roof
  // behind it on the flat roof, 8 cm higher so its corrugated edge shows
  // above the panel. Dark slate or glass on the ends, light grey sheet on the roofs.
  // (facing away from the sun like the orange, so it glows a little too, or it's near black)
  const slate = std({ color: 0x66717b, emissive: 0x2b3238, roughness: 0.7 });
  const roofing = std({ map: tex.grooves, color: 0xa5acb1, roughness: 0.6 }); // (the ribs run down the slopes)
  const glazing = std({ map: glazingTexture(), emissive: 0x1d2a2c, roughness: 0.2 });
  const gables = [
    ...[v1 + G, v1 - G, v3 + G, v3 - G].map((x) => [x, slate, slate]),
    ...[vg + G, vg - G].map((x) => [x, glazing, darkFrame]),
  ];
  for (const [x, end, edge] of gables) {
    const panel = [[-G, 0], [G, 0], [G, VALLEY], [0, VALLEY + G], [-G, VALLEY]];
    prism(panel, [x, 0], Z.panel, Z.panelBack, [end, edge], { cast: true, fade: fadeAt(x) });
    prismBody(panel, [x, 0], Z.panel, Z.panelBack, 'wall');
    const up = VALLEY + 0.08 - SHOP.h;
    const roof = [[-G, -0.05], [G, -0.05], [G, up], [0, up + G], [-G, up]];
    prism(roof, [x, SHOP.h], SHOP.z0 - 0.01, SHOP.z1 - 0.2, [end, roofing], { cast: true, fade: x > SHOP.hall ? 'roof' : null });
    prismBody(roof, [x, SHOP.h], SHOP.z0 - 0.01, SHOP.z1 - 0.2, 'roof');
  }
  // a drainpipe down each strip from the valley, as on the real one
  for (const v of [v1, v3, vg]) boxAt([v - 0.07, 0, Z.block - 0.01], [v + 0.07, VALLEY, Z.panel - 0.01], orange, { fade: fadeAt(v) });

  // ---------------------------------------------------------------- the entrance: brick and glass under the logo
  const fadeFront = { fade: 'front', cast: true };
  boxAt([E.x0, 0, E.z0], [E.x0 + 0.6, E.top, SHOP.z0], brick, { ...fadeFront, uv: true });
  boxAt([E.x1 - 0.6, 0, E.z0], [E.x1, E.top, SHOP.z0], brick, { ...fadeFront, uv: true });
  boxAt([E.x0 + 0.6, E.top - 0.45, E.z0], [E.x1 - 0.6, E.top, SHOP.z0], brick, { ...fadeFront, uv: true });
  boxAt([E.x0 - 0.2, E.top, E.z0 - 0.2], [E.x1 + 0.2, E.top + 0.15, SHOP.z0 + 0.1], white, fadeFront);
  const gz = [E.z0 + 0.2, E.z0 + 0.26];
  const gTop = E.top - 0.45;
  const top = SHOP.doorTop + 0.1;
  // the frames between the panes (solid, so they stay standing when the glass goes)
  for (const [a, b, y0, y1] of [
    [E.x0 + 0.6, E.x1 - 0.6, SHOP.doorTop, top],
    [d0 - 0.12, d0, 0, SHOP.doorTop], [d1, d1 + 0.12, 0, SHOP.doorTop], [-7.6, -7.5, 0, SHOP.doorTop], [-0.8, -0.7, 0, SHOP.doorTop],
    [d0 - 0.06, d0 + 0.06, top, gTop], [d1 - 0.06, d1 + 0.06, top, gTop],
  ]) {
    boxAt([a, y0, gz[0] - 0.02], [b, y1, gz[1] + 0.02], darkFrame, { fade: 'front' });
    solid([a, y0, gz[0] - 0.1], [b, y1, gz[1] + 0.1], 'wall');
  }
  // the panes, each one breakable; the sliding doors stand open, slid behind the fixed glass
  const slider = (a, b) => boxAt([a, 0.02, gz[1] + 0.04], [b, SHOP.doorTop - 0.05, gz[1] + 0.08], shopGlass, { fade: 'front' });
  const street = new THREE.Vector3(0, 0, -1);
  for (const [a, b, y0, y1, extra] of [
    [E.x0 + 0.6, -7.6, 0, SHOP.doorTop],
    [-7.5, d0 - 0.12, 0, SHOP.doorTop, () => slider(d0 - 1.4, d0 - 0.05)],
    [d1 + 0.12, -0.8, 0, SHOP.doorTop, () => slider(d1 + 0.05, d1 + 1.4)],
    [-0.7, E.x1 - 0.6, 0, SHOP.doorTop],
    [E.x0 + 0.6, d0 - 0.06, top, gTop], [d0 + 0.06, d1 - 0.06, top, gTop], [d1 + 0.06, E.x1 - 0.6, top, gTop],
  ]) {
    const glass = boxAt([a, y0, gz[0]], [b, y1, gz[1]], shopGlass, { fade: 'front' });
    pane([glass, ...(extra ? [extra()] : [])], [a, y0, gz[0] - 0.12], [b, y1, gz[1] + 0.12], street);
  }
  // the brick around the glass
  solid([E.x0, 0, E.z0], [E.x0 + 0.6, E.top, SHOP.z0], 'wall');
  solid([E.x1 - 0.6, 0, E.z0], [E.x1, E.top, SHOP.z0], 'wall');
  solid([E.x0 + 0.6, gTop, E.z0], [E.x1 - 0.6, E.top, SHOP.z0], 'wall');
  // the big logo on the glass above the doors
  const logoTex = logoTexture();
  const logo = add(new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.15), std({ map: logoTex, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.35, transparent: true, alphaTest: 0.05 })), { fade: 'front' });
  logo.rotation.y = Math.PI;
  logo.position.set((E.x0 + E.x1) / 2, 4.05, E.z0 + 0.15);
  // a green carpet from the doors to the road, like on the opening day photos
  const carpet = add(new THREE.Mesh(floorGeometry(-4.6, 25.1, -3.4, E.z0), std({ color: 0x4fbf3f, roughness: 1 })));
  carpet.position.y = 0.012;
  // an offer board on wheels by the door
  const board = new THREE.Group();
  const boardFace = std({ map: offerTexture('1,99') });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.0, 0.06), [green, green, green, green, boardFace, boardFace]);
  sign.position.y = 0.95;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.5), green);
  foot.position.y = 0.06;
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), green);
  stem.position.y = 0.3;
  board.add(sign, foot, stem);
  board.position.set(-6.8, 0, E.z0 - 1.0);
  board.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(board);
  solid([-7.1, 0, E.z0 - 1.25], [-6.5, 1.45, E.z0 - 0.75], 'wall');

  // ---------------------------------------------------------------- the outside wall: posters, a service door, bikes
  const posters = [
    poster('#7cc6e8', [['apple', 70, 100, 34], ['orange', 140, 90, 30], ['tomato', 196, 110, 26]]),
    poster('#f3d36b', [['bread', 128, 100, 40]]),
    poster('#a7d98a', [['cheese', 128, 100, 44]]),
    poster('#f2a2b8', [['orange', 80, 96, 32], ['apple', 170, 100, 36]]),
    poster('#ffd59e', [['tomato', 84, 100, 32], ['cheese', 172, 104, 34]]),
    poster('#b9d7f2', [['bread', 96, 100, 34], ['apple', 186, 104, 28]]),
  ];
  // like the real wall: posters on the orange blocks, grey service doors
  // (one of them in the first grey strip, beside its drainpipe)
  [v2 - 1.2, -21.2, -27.0, -17.4, 12.6, 16.4].forEach((x, i) => {
    boxAt([x, 1.3, Z.block - 0.04], [x + 2.4, 3.1, Z.block], faces(white, white, white, white, white, std({ map: posters[i] })), { fade: fadeAt(x) });
  });
  const serviceDoor = std({ color: 0x8d949a, roughness: 0.5 });
  for (const [x, z, w] of [[v1 - 0.95, Z.panel, 0.8], [-23.6, Z.block, 1.1], [-33.9, Z.block, 1.1]]) {
    boxAt([x, 0, z - 0.05], [x + w, 2.3, z], serviceDoor, { fade: fadeAt(x) });
  }
  // and the name once more, high up on the long block (cut out, not see-through: no blending to pay for)
  const wallLogo = add(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), std({ map: logoTex, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.35, alphaTest: 0.5 })), { fade: 'front' });
  wallLogo.rotation.y = Math.PI;
  wallLogo.position.set(-19.5, 4.3, Z.block - 0.01);

  const bikeColors = [0x2c6fb6, 0x222222, 0xc0392b, 0x2e8b57, 0x7d3c98];
  const tyre = std({ color: 0x1d1d1d, roughness: 0.7 });
  const rack = std({ color: 0x9aa0a6, metalness: 0.4, roughness: 0.4 });
  boxAt([-20.2, 0.6, SHOP.z0 - 0.9], [-15.8, 0.66, SHOP.z0 - 0.84], rack);
  for (let i = 0; i < 6; i++) {
    const frame = std({ color: bikeColors[i % bikeColors.length], roughness: 0.5 });
    const bike = new THREE.Group();
    for (const z of [-0.55, 0.55]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 20), tyre);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0, 0.35, z);
      bike.add(wheel);
    }
    for (const [y, z, len, rot] of [[0.62, 0, 0.9, 0], [0.48, -0.25, 0.6, 0.9], [0.48, 0.28, 0.6, -0.9]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), frame);
      bar.position.set(0, y, z);
      bar.rotation.x = rot;
      bike.add(bar);
    }
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.25), tyre);
    saddle.position.set(0, 0.92, -0.3);
    bike.add(saddle);
    const bars = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), tyre);
    bars.position.set(0, 0.98, 0.5);
    bike.add(bars);
    bike.position.set(-19.8 + i * 0.75, 0, SHOP.z0 - 1.05);
    bike.rotation.z = (i % 2 ? 1 : -1) * 0.05;
    bike.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(bike);
  }

  // ---------------------------------------------------------------- inside: floor, lights, a band of text
  const floor = add(new THREE.Mesh(floorGeometry(IN.x0, IN.z0, IN.x1, IN.z1), std({ map: tex.tiles, color: 0xe9e5dc, roughness: 0.45 })));
  floor.position.y = 0.012;
  // A concrete base under the whole building and its glass entrance, so a faded
  // wall shows that instead of the grass (4 mm above the grass, under the floor and the carpet).
  const base = std({ color: 0xa9a59d, roughness: 0.9 });
  for (const [x0, z0, x1, z1] of [[SHOP.x0, SHOP.z0, SHOP.x1, SHOP.z1], [E.x0, E.z0, E.x1, SHOP.z0]]) {
    add(new THREE.Mesh(floorGeometry(x0, z0, x1, z1), base)).position.y = 0.004;
  }
  const lamp = std({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.9 });
  for (let x = IN.x0 + 2.5; x < IN.x1 - 1; x += 5) boxAt([x - 0.15, IN.y1 - 0.04, IN.z0 + 1.5], [x + 0.15, IN.y1, IN.z1 - 1.5], lamp, { fade: 'roof' });
  const bandTex = labelTexture('LEKKER VERS  •  ELKE DAG VOORDELIG  •  LEKKER VERS', '#3fae3a', '#ffffff', 2048, 96);
  boxAt([IN.x0 + 0.5, 2.75, IN.z1 - 0.03], [IN.x1 - 0.5, 3.35, IN.z1], faces(green, green, green, green, green, std({ map: bandTex })));

  // a little seeded randomness so the shelves look the same every time
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const _out = new THREE.Vector3();

  // ---------------------------------------------------------------- checkouts by the windows
  const counterMat = std({ color: 0xf2f0ea, roughness: 0.6 });
  const belt = std({ color: 0x222426, roughness: 0.9 });
  for (const [i, c] of [-17, -13.5, -10].entries()) {
    const z0 = IN.z0 + 1.2;
    const z1 = z0 + 2.6;
    boxAt([c - 0.4, 0, z0], [c + 0.4, 0.85, z1], counterMat, { cast: true });
    boxAt([c - 0.34, 0.85, z0 + 0.8], [c + 0.34, 0.88, z1 - 0.05], belt);
    boxAt([c + 0.45, 0.85, z0 + 0.15], [c + 0.75, 1.15, z0 + 0.45], darkFrame, { cast: true }); // the till
    boxAt([c + 0.4, 0, z0], [c + 1.0, 0.85, z0 + 0.6], green, { cast: true });
    solid([c - 0.4, 0, z0], [c + 1.0, 0.88, z1], 'furniture');
    // a numbered lamp on a pole
    boxAt([c + 0.36, 0.85, z1 - 0.12], [c + 0.42, 2.2, z1 - 0.06], darkFrame);
    boxAt([c + 0.2, 2.2, z1 - 0.18], [c + 0.6, 2.6, z1], faces(green, green, green, green, std({ map: labelTexture(String(i + 1), '#3fae3a', '#ffffff', 96, 96) }), std({ map: labelTexture(String(i + 1), '#3fae3a', '#ffffff', 96, 96) })));
  }

  // ---------------------------------------------------------------- the products, and tables for loose ones
  // the bakery's table of bread baskets, by the bread rack
  const breadTable = { x0: -20.1, x1: -18.8, z0: 32.3, z1: 34.4, y: 0.72 };
  // the stand of tulip buckets by the entrance: a low front step and a higher back one
  const FLOWERS = { x0: -8.7, x1: -6.3, z0: IN.z0 + 0.1, z1: IN.z0 + 0.85, low: 0.25, high: 0.5 };
  const flowerSteps = [
    { x0: FLOWERS.x0, x1: FLOWERS.x1, z0: (FLOWERS.z0 + FLOWERS.z1) / 2, z1: FLOWERS.z1, y: FLOWERS.low },
    { x0: FLOWERS.x0, x1: FLOWERS.x1, z0: FLOWERS.z0, z1: (FLOWERS.z0 + FLOWERS.z1) / 2, y: FLOWERS.high },
  ];
  const stock = createStock(outer, { bounds: IN, tables: [breadTable, ...flowerSteps] });
  const _mid = new THREE.Vector3();
  /**
   * A table piled with loose products (rolls) in compartments, one kind
   * each: a knock sends them rolling off the table and across the floor.
   */
  function looseTable({ x0, x1, z0, z1, y: top }, kinds, mat, mess) {
    boxAt([x0, 0, z0], [x1, top, z1], mat, { cast: true });
    const table = solid([x0, 0, z0], [x1, top + 0.08, z1], 'furniture');
    const section = stock.section();
    table.surface.mess = mess;
    table.surface.onHit = (point, strength, push) => {
      if (point.y > top + 0.05) {
        // on top: they scatter away from where he lands, the way he was going
        _out.set(push?.x ?? 0, 0, push?.z ?? 0);
        if (_out.lengthSq() < 1) _out.add(_mid.set(point.x - (x0 + x1) / 2, 0, point.z - (z0 + z1) / 2).normalize());
        return stock.knock(section, point, _out.normalize(), strength, push, { radius: Math.min(0.9, 0.3 + strength * 0.06) });
      }
      // a side: the ones along that edge roll off it
      const dx = Math.min(point.x - x0, x1 - point.x);
      const dz = Math.min(point.z - z0, z1 - point.z);
      if (dx < dz) _out.set(point.x < (x0 + x1) / 2 ? -1 : 1, 0, 0);
      else _out.set(0, 0, point.z < (z0 + z1) / 2 ? -1 : 1);
      return stock.knock(section, _mid.set(point.x, top, point.z), _out, strength, push, { chance: 0.8 });
    };
    // compartments across the long side
    const alongX = x1 - x0 >= z1 - z0;
    const parts = kinds.length;
    const w = ((alongX ? x1 - x0 : z1 - z0)) / parts;
    for (let p = 0; p < parts; p++) {
      const id = kinds[p];
      const r = halfSize(PRODUCTS[id])[0];
      const [a0, a1] = alongX ? [x0 + p * w, x0 + (p + 1) * w] : [z0 + p * w, z0 + (p + 1) * w];
      const [b0, b1] = alongX ? [z0, z1] : [x0, x1];
      for (let a = a0 + r + 0.05; a < a1 - r - 0.03; a += r * 2.05) {
        for (let b = b0 + r + 0.05; b < b1 - r - 0.03; b += r * 2.05) {
          const [x, z] = alongX ? [a, b] : [b, a];
          stock.place(id, x + (rnd() - 0.5) * 0.02, top + r * (rnd() - 0.5) * 0.3, z, rnd() * Math.PI * 2, section);
        }
      }
    }
  }

  // ---------------------------------------------------------------- aisles of shelves
  // Each aisle is stocked with products that belong there (products.js); a
  // hard knock against a shelf sends the ones near the impact tumbling out.
  const shelfMat = std({ color: 0xd9dcdf, roughness: 0.5, metalness: 0.2 });
  const endCap = green;
  const AISLE = { z0: 36.2, z1: 42.4, h: 1.95, half: 0.55 };
  const shelfYs = [0.12, 0.55, 0.98, 1.41];
  // (where a sixth aisle stood, by the cheese, the pindakaas and hagelslag pyramids are now)
  const aisleNames = ['ZUIVEL', 'KOFFIE & THEE', 'SNOEP', 'DRINKEN', 'PASTA & SAUS'];
  const aisleXs = [-13, -8, -3, 2, 7];
  aisleXs.forEach((cx, a) => {
    const { z0, z1, h, half } = AISLE;
    // (the shelves run between the green end caps, not into them, or their sides and tops flicker through)
    const [s0, s1] = [z0 + 0.05, z1 - 0.05];
    boxAt([cx - half, 0, s0], [cx + half, 0.12, s1], shelfMat);
    boxAt([cx - 0.04, 0.12, s0], [cx + 0.04, h, s1], shelfMat, { cast: true });
    for (const y of shelfYs.slice(1)) boxAt([cx - half, y - 0.03, s0], [cx + half, y, s1], shelfMat);
    boxAt([cx - half, h - 0.05, s0], [cx + half, h, s1], shelfMat);
    for (const z of [z0, z1]) boxAt([cx - half, 0, z - 0.05], [cx + half, h, z + 0.05], endCap, { cast: true });
    // the goods, on both sides, facing out into the aisles
    const sides = {};
    for (const side of [-1, 1]) {
      const section = stock.section();
      sides[side] = section;
      shelfYs.forEach((y, i) => {
        const above = (shelfYs[i + 1] ?? h) - 0.03;
        stock.fillRow(ASSORTMENT[aisleNames[a]][i], {
          along: 'z', a: z0 + 0.08, b: z1 - 0.08, y, yaw: (side * Math.PI) / 2, maxH: Math.min(0.42, above - y), section,
          depthAt: (row, depth) => cx + side * (half - 0.02 - depth / 2 - row * (depth + 0.01)), room: half - 0.08,
        });
      });
    }
    const shelf = solid([cx - half, 0, z0 - 0.05], [cx + half, h, z1 + 0.05], 'furniture');
    shelf.surface.mess = [`Clean-up in aisle ${a + 1}!`, ...MESS.aisle];
    shelf.surface.onHit = (point, strength, push) => {
      if (point.y > h - 0.08) {
        // on top: the top shelves on both sides
        let n = 0;
        for (const side of [-1, 1]) n += stock.knock(sides[side], point, _out.set(side, 0, 0), strength, push, { chance: 0.6 });
        return n;
      }
      if (point.z < z0 + 0.02 || point.z > z1 - 0.02) {
        // an end of the aisle: the products at that end slide off lengthwise
        _out.set(0, 0, point.z < z0 + 0.02 ? -1 : 1);
        return stock.knock(sides[-1], point, _out, strength, push, { chance: 0.7 }) + stock.knock(sides[1], point, _out, strength, push, { chance: 0.7 });
      }
      const side = point.x < cx ? -1 : 1;
      return stock.knock(sides[side], point, _out.set(side, 0, 0), strength, push);
    };
    // a hanging sign over the front end of the aisle
    const label = std({ map: labelTexture(aisleNames[a]) });
    boxAt([cx - 0.9, 2.75, z0 - 0.45], [cx + 0.9, 3.2, z0 - 0.4], faces(green, green, green, green, label, label));
    for (const dx of [-0.7, 0.7]) boxAt([cx + dx - 0.01, 3.2, z0 - 0.43], [cx + dx + 0.01, IN.y1, z0 - 0.42], darkFrame);
  });

  // ---------------------------------------------------------------- glass-door freezers along the back, drinks fridges along the side
  // Stand-up cabinets with a glass door every 80 cm or so. Every door is
  // breakable glass: smash one and the products behind it spill out, and
  // Lennie can end up inside, between the shelves.
  const cabinetWhite = std({ color: 0xf4f6f8, roughness: 0.4 });
  const cabinetGlass = new THREE.MeshStandardMaterial({ color: 0xcfeaf5, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
  const handleMat = std({ color: 0xb8bec4, metalness: 0.6, roughness: 0.3 });
  const coldLight = std({ color: 0xe8f6fc, emissive: 0xbfe3f2, emissiveIntensity: 0.55, roughness: 0.6 });
  const lightStrip = std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
  const wireShelf = std({ color: 0xc9ced3, metalness: 0.4, roughness: 0.4 });
  const CAB = { depth: 0.85, height: 2.15, base: 0.12, canopy: 0.22, door: 0.8, shelves: [0.12, 0.78, 1.42] };
  /**
   * A row of cabinets against the wall at `wall` (z for axis 'x', x for axis
   * 'z'), from u0 to u1 along it, the glass facing into the shop. Returns the
   * box inside the cabinets and, for each door, the doorway Lennie can end up
   * in once its glass is smashed (half in counts: he's taller than they're deep).
   */
  function cabinets({ axis, wall, u0, u1, assortment, sign, signColor, mess }) {
    const { depth, height, base, canopy } = CAB;
    // (u along the row, y up, w from the glass back to the wall) → world
    const P = (u, y, w) => (axis === 'x' ? [u, y, wall - depth + w] : [wall - depth + w, y, u]);
    const box = (ua, ya, wa, ub, yb, wb) => {
      const p = P(ua, ya, wa);
      const q = P(ub, yb, wb);
      return [[Math.min(p[0], q[0]), ya, Math.min(p[2], q[2])], [Math.max(p[0], q[0]), yb, Math.max(p[2], q[2])]];
    };
    const out = axis === 'x' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(-1, 0, 0);
    const yaw = axis === 'x' ? Math.PI : -Math.PI / 2;
    const top = height - canopy;
    const part = (ua, ya, wa, ub, yb, wb, mat, { phys = false, cast = false } = {}) => {
      const [lo, hi] = box(ua, ya, wa, ub, yb, wb);
      const m = boxAt(lo, hi, mat, { cast });
      if (phys) solid(lo, hi, 'furniture').surface.mess = mess;
      return m;
    };
    // the cabinet: plinth, a canopy with a lit sign, the ends, a cold white back and the shelves inside
    // (the plinth and the back fit between the ends, so no two faces lie on top of each other and flicker)
    part(u0 + 0.06, 0, 0, u1 - 0.06, base, depth, darkFrame);
    solid(...box(u0, 0, 0, u1, base, depth), 'furniture').surface.mess = mess;
    part(u0, top, 0, u1, height, depth, cabinetWhite, { phys: true, cast: true });
    const signTex = labelTexture(`${sign}   •   ${sign}   •   ${sign}`, signColor, '#ffffff', 1024, 64);
    signTex.wrapS = THREE.RepeatWrapping;
    signTex.repeat.set(Math.max(1, Math.round((u1 - u0) / 6)), 1);
    boxAt(...box(u0, top + 0.03, -0.01, u1, height - 0.03, 0), std({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.2 }));
    for (const u of [u0, u1 - 0.06]) part(u, 0, 0, u + 0.06, height, depth, cabinetWhite, { phys: true, cast: true });
    part(u0 + 0.06, base, depth - 0.04, u1 - 0.06, top, depth, coldLight);
    part(u0 + 0.06, top - 0.03, 0.12, u1 - 0.06, top, 0.18, lightStrip);
    const inside = stock.section();
    for (const [i, y] of CAB.shelves.entries()) {
      if (i > 0) {
        const [lo, hi] = box(u0 + 0.06, y - 0.025, 0.12, u1 - 0.06, y, depth - 0.04);
        boxAt(lo, hi, wireShelf);
        const s = solid(lo, hi, 'furniture');
        s.surface.mess = mess;
        s.surface.onHit = (point, strength, push) => stock.knock(inside, point, out, strength, push);
      }
      const above = (CAB.shelves[i + 1] ?? top) - 0.03;
      stock.fillRow(assortment[i], {
        along: axis, a: u0 + 0.1, b: u1 - 0.1, y, yaw, maxH: Math.min(0.42, above - y), section: inside,
        depthAt: (row, d) => P(0, 0, 0.15 + d / 2 + row * (d + 0.01))[axis === 'x' ? 2 : 0], room: depth - 0.22,
      });
    }
    // the doors: a glass pane in a thin frame with a handle, each one breakable
    const doorways = [];
    const n = Math.max(1, Math.round((u1 - u0 - 0.12) / CAB.door));
    const dw = (u1 - u0 - 0.12) / n;
    for (let i = 0; i < n; i++) {
      const a = u0 + 0.06 + i * dw;
      const b = a + dw;
      const meshes = [part(a + 0.02, base + 0.05, 0, b - 0.02, top - 0.05, 0.02, cabinetGlass)];
      for (const [ya, yb] of [[base, base + 0.05], [top - 0.05, top]]) meshes.push(part(a + 0.012, ya, -0.01, b - 0.012, yb, 0.03, cabinetWhite));
      const hu = i % 2 ? a + 0.06 : b - 0.085;
      meshes.push(part(hu, 0.75, -0.06, hu + 0.025, 1.55, -0.01, handleMat));
      const [lo, hi] = box(a, base, -0.08, b, top, 0.1);
      const piece = pane(meshes, lo, hi, out);
      piece.onBreak = () => stock.knock(inside, piece.center.clone().addScaledVector(out, -0.3), out, 7, null, { radius: 0.75, chance: 0.6 });
      const [dlo, dhi] = box(a, -1, -0.45, b, top, depth - 0.04);
      doorways.push({ min: dlo, max: dhi, when: () => piece.broken });
      // the frame between this door and the one before
      part(a - 0.012, base, -0.012, a + 0.012, top, 0.03, cabinetWhite);
    }
    part(u1 - 0.072, base, -0.012, u1 - 0.048, top, 0.03, cabinetWhite);
    return { inside: box(u0 + 0.06, base, 0.04, u1 - 0.06, top, depth - 0.04), doorways };
  }
  // (they stop short of the back corner, where the butcher's counter is)
  const freezers = cabinets({ axis: 'x', wall: IN.z1, u0: IN.x0 + 1.2, u1: 7.6, assortment: ASSORTMENT.DIEPVRIES, sign: 'DIEPVRIES', signColor: '#3b7dd8', mess: MESS.freezers });
  const fridges = cabinets({ axis: 'z', wall: IN.x1, u0: IN.z0 + 5.5, u1: IN.z1 - 0.95, assortment: ASSORTMENT.FRISDRANK, sign: 'FRISDRANK', signColor: '#3fae3a', mess: MESS.fridges });

  // ---------------------------------------------------------------- one-sided displays
  // Things put back by R besides the products (see repairAll).
  const onRestock = [];
  // Bodies to take out of the world once the physics step that knocked them is over.
  const toRemove = new Set();
  // Landing spots of the displays below: [id, label, value, say, min, max, when]
  const spotsExtra = [];
  /**
   * The frame of a display that runs along `axis` ('z' or 'x') with its back
   * at `back` and faces `dir` (+1 or −1) across it: u runs along it, w from
   * its back towards its front.
   */
  function frame(axis, back, dir) {
    const P = (u, y, w) => (axis === 'z' ? [back + dir * w, y, u] : [u, y, back + dir * w]);
    const box = (ua, ya, wa, ub, yb, wb) => {
      const p = P(ua, ya, wa);
      const q = P(ub, yb, wb);
      return [[Math.min(p[0], q[0]), ya, Math.min(p[2], q[2])], [Math.max(p[0], q[0]), yb, Math.max(p[2], q[2])]];
    };
    const out = axis === 'z' ? new THREE.Vector3(dir, 0, 0) : new THREE.Vector3(0, 0, dir);
    const yaw = axis === 'z' ? (dir * Math.PI) / 2 : dir > 0 ? 0 : Math.PI; // a product's, so its front faces out
    // the box face (+x, −x, +y, −y, +z, −z) that looks out
    const front = axis === 'z' ? (dir > 0 ? 0 : 1) : dir > 0 ? 4 : 5;
    const withFront = (mat, frontMat) => Array.from({ length: 6 }, (_, i) => (i === front ? frontMat : mat));
    return { P, box, out, yaw, withFront, wAxis: axis === 'z' ? 0 : 2 };
  }

  /** A shelf unit against a wall (or back to back with nothing), stocked shelf by shelf from `assortment`. */
  function shelfUnit({ axis, back, dir, u0, u1, depth, h, ys, assortment, mats, mess, rows = 1 }) {
    const F = frame(axis, back, dir);
    const part = (ua, ya, wa, ub, yb, wb, m, cast = false) => boxAt(...F.box(ua, ya, wa, ub, yb, wb), m, { cast });
    // (the back fits between the sides and under the top, so its edges don't flicker through theirs)
    part(u0 + 0.04, 0, 0, u1 - 0.04, h - 0.04, 0.04, mats.back, true);
    for (const u of [u0, u1 - 0.04]) part(u, 0, 0, u + 0.04, h, depth, mats.frame, true);
    part(u0, 0, 0.04, u1, ys[0], depth, mats.frame);
    for (const y of ys.slice(1)) part(u0 + 0.04, y - 0.03, 0.04, u1 - 0.04, y, depth, mats.shelf);
    part(u0, h - 0.04, 0, u1, h, depth, mats.frame);
    const section = stock.section();
    ys.forEach((y, i) => {
      const above = (ys[i + 1] ?? h) - 0.04;
      stock.fillRow(assortment[i], {
        along: axis, a: u0 + 0.07, b: u1 - 0.07, y, yaw: F.yaw, maxH: Math.min(0.42, above - y), section, rows,
        depthAt: (row, d) => F.P(0, 0, depth - 0.02 - d / 2 - row * (d + 0.01))[F.wAxis], room: depth - 0.08,
      });
    });
    const body = solid(...F.box(u0, 0, 0, u1, h, depth), 'furniture');
    body.surface.mess = mess;
    body.surface.onHit = (point, strength, push) => stock.knock(section, point, F.out, strength, push, point.y > h - 0.08 ? { chance: 0.6 } : {});
    return F;
  }

  // ---------------------------------------------------------------- the bakery, in the front corner by the storeroom
  // A wooden bread rack along the wall, a glass case of pastries, a table of
  // rolls in baskets and the bread slicer.
  const wood = std({ color: 0xb98550, roughness: 0.75 });
  const darkWood = std({ color: 0x6b4423, roughness: 0.8 });
  const brown = '#7b4a2a';
  const breadRack = shelfUnit({
    axis: 'z', back: IN.x0, dir: 1, u0: IN.z0 + 0.2, u1: 35.4, depth: 0.55, h: 2.0, ys: [0.12, 0.55, 0.98, 1.41],
    assortment: ASSORTMENT.BAKKERIJ, mats: { frame: wood, shelf: wood, back: darkWood }, mess: MESS.bread,
  });
  boxAt(...breadRack.box(IN.z0 + 0.2, 2.0, 0, 35.4, 2.45, 0.6), breadRack.withFront(wood, std({ map: labelTexture('VERS GEBAKKEN', '#f4e3c3', brown, 1024, 96) })), { cast: true });
  const bakerySign = std({ map: labelTexture('BAKKERIJ', brown, '#f4e3c3') });
  boxAt([-20.4, 2.75, 33.3], [-18.6, 3.2, 33.35], faces(darkWood, darkWood, darkWood, darkWood, bakerySign, bakerySign));
  for (const x of [-20.2, -18.8]) boxAt([x - 0.01, 3.2, 33.31], [x + 0.01, IN.y1, 33.33], darkFrame);
  looseTable(breadTable, ['bol', 'pistolet', 'krentenbolLos'], std({ color: 0xb07a3c, roughness: 0.95 }), MESS.rolls);

  // the pastry case along the front wall: a counter with a glass case on top
  const caseF = frame('x', IN.z0, 1);
  const CASE = { u0: -21.1, u1: -18.6, depth: 0.82, top: 0.85, glass: 1.3 };
  // (the wood stops under the cream top, so the two don't share a surface and flicker)
  boxAt(...caseF.box(CASE.u0, 0, 0, CASE.u1, CASE.top - 0.01, CASE.depth), caseF.withFront(wood, std({ map: labelTexture('Vers van de bakker', '#f4e3c3', brown, 1024, 160) })), { cast: true });
  boxAt(...caseF.box(CASE.u0, CASE.top - 0.01, 0, CASE.u1, CASE.top, CASE.depth), std({ color: 0xf6f1e6, roughness: 0.5 }));
  const pastries = stock.section();
  stock.fillRow(ASSORTMENT.GEBAK[0], {
    along: 'x', a: CASE.u0 + 0.08, b: CASE.u1 - 0.08, y: CASE.top, yaw: 0, maxH: 0.3, section: pastries, rows: 4,
    depthAt: (row, d) => caseF.P(0, 0, CASE.depth - 0.1 - d / 2 - row * (d + 0.03))[2], room: CASE.depth - 0.2,
  });
  const caseMeshes = [
    boxAt(...caseF.box(CASE.u0, CASE.top, CASE.depth - 0.02, CASE.u1, CASE.glass, CASE.depth), cabinetGlass),
    boxAt(...caseF.box(CASE.u0, CASE.glass - 0.02, 0.05, CASE.u1, CASE.glass, CASE.depth), cabinetGlass),
    ...[CASE.u0, CASE.u1 - 0.02].map((u) => boxAt(...caseF.box(u, CASE.top, 0.05, u + 0.02, CASE.glass, CASE.depth), cabinetGlass)),
    boxAt(...caseF.box(CASE.u0, CASE.glass, CASE.depth - 0.03, CASE.u1, CASE.glass + 0.03, CASE.depth), handleMat),
  ];
  const pastryCase = pane(caseMeshes, ...caseF.box(CASE.u0, CASE.top, 0.05, CASE.u1, CASE.glass, CASE.depth + 0.04), caseF.out);
  pastryCase.onBreak = () => stock.knock(pastries, pastryCase.center, caseF.out, 7, null, { radius: 1.4, chance: 0.6 });
  const counter = solid(...caseF.box(CASE.u0, 0, 0, CASE.u1, CASE.top, CASE.depth), 'furniture');
  counter.surface.mess = MESS.pastries;
  counter.surface.onHit = (point, strength, push) => (point.y > CASE.top - 0.05 ? stock.knock(pastries, point, caseF.out, strength, push) : 0);

  // the bread slicer, on its own little stand next to the case
  const steel = std({ color: 0xc9ced3, metalness: 0.5, roughness: 0.35 });
  boxAt([-18.45, 0, IN.z0 + 0.05], [-17.85, 0.85, IN.z0 + 0.65], wood, { cast: true });
  boxAt([-18.42, 0.85, IN.z0 + 0.1], [-17.88, 1.45, IN.z0 + 0.6], faces(steel, steel, steel, steel, std({ map: labelTexture('SNIJMACHINE', '#c9ced3', '#2b2b2b', 512, 96) }), steel), { cast: true });
  boxAt([-18.3, 1.12, IN.z0 + 0.6], [-18.0, 1.32, IN.z0 + 0.62], darkFrame);
  boxAt([-18.06, 0.95, IN.z0 + 0.6], [-17.98, 1.03, IN.z0 + 0.63], std({ color: 0x3fae3a, emissive: 0x1d5a1b }));
  solid([-18.45, 0, IN.z0 + 0.05], [-17.85, 1.45, IN.z0 + 0.65], 'furniture');

  // ---------------------------------------------------------------- the sloping fruit and veg stand, along the east wall and round the corner
  // Rows of black crates tilted towards the shop, each piled with one kind of
  // fruit or vegetable, with price screens on poles behind them. It runs along
  // the east wall and on round the corner along the front wall, up to the
  // bottle return machine. In the corner the east run starts just behind the
  // front run's crates.
  const VEG = { depth: 1.55, front: 0.7, back: 1.2, rows: 3, end: 0.03 };
  const lightWood = std({ color: 0xd8b98a, roughness: 0.8 });
  const vegSign = std({ map: labelTexture('GROENTE & FRUIT') });
  const crateParts = []; // the crates' floors and rims, as [centre, turn, size]: one instanced mesh of black boxes
  const slope = Math.atan2(VEG.back - VEG.front, VEG.depth - 0.1);
  const slopeLen = Math.hypot(VEG.back - VEG.front, VEG.depth - 0.1);
  const crateW = { s: (slopeLen - 0.08) / VEG.rows - 0.04, u: 0.6 };
  const UP_ = new THREE.Vector3(0, 1, 0);
  const _p = new THREE.Vector3();
  /**
   * One run of the stand against a wall (frame F), from u0 to u1 along it.
   * `ends`: which ends get a side panel ([at u0, at u1]; not against a wall).
   * `kinds` picks what's in the crate in row r, column c; `screens` is two
   * [name, price] lines for each price screen, spread along the run.
   */
  function vegRun(F, u0, u1, { ends, kinds, screens }) {
    // the slope: s up it from the front edge, n off its surface, at u along the run
    const slopeDir = F.out.clone().multiplyScalar(-Math.cos(slope)).addScaledVector(UP_, Math.sin(slope));
    const slopeNormal = F.out.clone().multiplyScalar(Math.sin(slope)).addScaledVector(UP_, Math.cos(slope));
    const along = new THREE.Vector3().crossVectors(slopeDir, slopeNormal); // the way u runs
    const slopeQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(slopeDir, slopeNormal, along));
    const onSlope = (s, u, n) => new THREE.Vector3(...F.P(u, VEG.front, VEG.depth)).addScaledVector(slopeDir, s).addScaledVector(slopeNormal, n);
    // the wooden stand: a side panel at an open end, the rest fitting between them
    const a0 = ends[0] ? u0 + VEG.end : u0;
    const a1 = ends[1] ? u1 - VEG.end : u1;
    const side = new THREE.Shape([[0, 0], [-VEG.depth, 0], [-VEG.depth, VEG.front + 0.14], [0, VEG.front + VEG.depth * Math.tan(slope) + 0.14]].map(([x, y]) => new THREE.Vector2(x, y)));
    const sideGeo = new THREE.ExtrudeGeometry(side, { depth: VEG.end, bevelEnabled: false });
    ends.forEach((open, i) => {
      if (!open) return;
      // (the shape's x runs from the wall inwards, mirrored, so its faces still face out)
      const m = add(new THREE.Mesh(sideGeo, lightWood), { cast: true });
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.out.clone().negate(), UP_, along));
      m.position.set(...F.P(i ? u1 - VEG.end : u0, 0, 0));
    });
    boxAt(...F.box(a0, 0, 0.08, a1, VEG.front - 0.04, VEG.depth), lightWood, { cast: true });
    boxAt(...F.box(a0, 0, 0, a1, VEG.back + 0.3, 0.08), lightWood, { cast: true });
    const plate = add(new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.04, a1 - a0), lightWood));
    plate.position.copy(onSlope(slopeLen / 2, (a0 + a1) / 2, -0.02));
    plate.quaternion.copy(slopeQ);
    // the crates, and what's in them
    const section = stock.section();
    const cratesAlong = Math.floor((a1 - a0 - 0.04) / (crateW.u + 0.04));
    const first = (a0 + a1) / 2 - (cratesAlong * (crateW.u + 0.04) - 0.04) / 2; // (centred along the run)
    for (let r = 0; r < VEG.rows; r++) {
      for (let c = 0; c < cratesAlong; c++) {
        const sc = 0.04 + r * (crateW.s + 0.04) + crateW.s / 2;
        const uc = first + c * (crateW.u + 0.04) + crateW.u / 2;
        const { s: ws, u: wu } = crateW;
        // floor, then the four rims, as (s, n, u) centre and size
        for (const [s, n, u, sw, sn, su] of [[sc, 0.01, uc, ws, 0.02, wu], [sc - ws / 2, 0.06, uc, 0.015, 0.12, wu], [sc + ws / 2, 0.06, uc, 0.015, 0.12, wu], [sc, 0.06, uc - wu / 2, ws, 0.12, 0.015], [sc, 0.06, uc + wu / 2, ws, 0.12, 0.015]]) {
          crateParts.push([onSlope(s, u, n), slopeQ, new THREE.Vector3(sw, sn, su)]);
        }
        const id = kinds(r, c);
        const [hu, hn, hs] = halfSize(PRODUCTS[id]); // a stick lies along u
        for (let s = sc - ws / 2 + hs + 0.02; s < sc + ws / 2 - hs - 0.01; s += hs * 2.1) {
          for (let u = uc - wu / 2 + hu + 0.02; u < uc + wu / 2 - hu - 0.01; u += hu * 2.1) {
            _p.copy(onSlope(s, u, 0.02 + hn + rnd() * 0.01));
            stock.place(id, _p.x, _p.y - hn, _p.z, F.yaw + (PRODUCTS[id].shape === 'stick' ? 0 : rnd() * Math.PI * 2), section);
          }
        }
      }
    }
    // a knock sends what's near it rolling out into the shop
    const hit = (point, strength, push) => stock.knock(section, point, F.out, strength, push, { radius: Math.min(0.8, 0.25 + strength * 0.05) });
    for (const b of [solid(...F.box(u0, 0, 0, u1, VEG.front - 0.04, VEG.depth), 'furniture'), solid(...F.box(u0, 0, 0, u1, VEG.back + 0.3, 0.08), 'furniture')]) {
      b.surface.mess = MESS.veg;
      b.surface.onHit = hit;
    }
    {
      // the slope itself, tilted like the crates
      const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(slopeLen / 2, 0.15, (u1 - u0) / 2)) });
      const c = onSlope(slopeLen / 2, (u0 + u1) / 2, 0.08 - 0.15);
      b.position.set(c.x, c.y, c.z);
      b.quaternion.set(slopeQ.x, slopeQ.y, slopeQ.z, slopeQ.w);
      b.surface = { kind: 'furniture', mess: MESS.veg, onHit: hit };
      world.addBody(b);
    }
    // price screens on poles behind the crates
    screens.forEach((lines, i) => {
      const u = u0 + ((u1 - u0) * (i + 0.5)) / screens.length;
      boxAt(...F.box(u - 0.03, VEG.back + 0.3, 0.02, u + 0.03, 2.1, 0.07), darkFrame);
      const tex = canvasTexture(256, 150, (g, w, h) => {
        g.fillStyle = '#10213a'; g.fillRect(0, 0, w, h);
        g.textBaseline = 'middle';
        for (const [k, [name, price]] of lines.entries()) {
          const y = 42 + k * 67;
          g.font = 'bold 23px "Trebuchet MS", sans-serif';
          g.fillStyle = '#f6d04d'; g.textAlign = 'right'; g.fillText(price, w - 14, y);
          // (a long name in smaller letters, so it doesn't run into the price)
          const room = w - 28 - g.measureText(price).width - 12;
          g.font = `bold ${Math.min(23, Math.floor((23 * room) / g.measureText(name).width))}px "Trebuchet MS", sans-serif`;
          g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText(name, 14, y);
        }
        g.strokeStyle = '#3c4146'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
      });
      boxAt(...F.box(u - 0.38, 1.65, 0.07, u + 0.38, 2.1, 0.12), F.withFront(darkFrame, std({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 })));
    });
    // the sign hanging over it, on two wires
    const mid = (u0 + u1) / 2;
    const signMats = F.withFront(green, vegSign);
    signMats[signMats.indexOf(vegSign) ^ 1] = vegSign; // (and on its back: faces come in pairs, +x −x, +y −y, +z −z)
    boxAt(...F.box(mid - 0.9, 2.75, 0.77, mid + 0.9, 3.2, 0.82), signMats);
    for (const du of [-0.7, 0.7]) boxAt(...F.box(mid + du - 0.01, 3.2, 0.79, mid + du + 0.01, IN.y1, 0.8), darkFrame);
    return F.box(u0, 0.6, 0, u1, 1.9, VEG.depth + 0.1); // its landing spot
  }
  const vegSpots = [
    vegRun(frame('z', IN.x1, -1), IN.z0 + VEG.depth + 0.01, 35.5, {
      ends: [true, true],
      kinds: (r, c) => ['paprikaRood', 'komkommer', 'paprikaGeel', 'broccoli', 'tomaat', 'prei', 'paprikaGroen', 'champignon', 'ui', 'aubergine', 'wortel', 'aardappel', 'boontjes', 'citroen'][(c * 2 + r * 5) % 14],
      screens: [[['KOMKOMMER', '0,89'], ['PAPRIKA', '1,29']], [['PREI', '0,99'], ['BROCCOLI', '1,49']]],
    }),
    vegRun(frame('x', IN.z0, 1), 3.2, IN.x1 - 0.01, {
      ends: [true, false],
      kinds: (r, c) => ['appel', 'peer', 'sinaasappel', 'citroen', 'pruim', 'kool', 'tomaat', 'wortel', 'boontjes', 'paprikaRood', 'aardappel'][(c * 3 + r * 4) % 11],
      screens: [[['APPELS', '0,99'], ['PEREN', '1,49']], [['CITROENEN', '0,79'], ['PRUIMEN', '1,99']], [['SINAASAPPELS', '2,49'], ['KOOL', '0,89']]],
    }),
  ];
  const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ color: 0x1f2123, roughness: 0.7 }), crateParts.length);
  const _cm = new THREE.Matrix4();
  crateParts.forEach(([at, q, size], i) => crateMesh.setMatrixAt(i, _cm.compose(at, q, size)));
  add(crateMesh, { cast: true });

  // ---------------------------------------------------------------- the open cheese cooler along the west wall
  // Sloping shelves of cheese packs under a lit canopy, with big Gouda wheels
  // stacked on top and a sign with a cow above them.
  const cheeseF = frame('z', IN.x0, 1);
  const CH = { u0: 36.4, u1: 42.6, depth: 1.05, top: 1.85, roof: 2.0 };
  const cpart = (ua, ya, wa, ub, yb, wb, m, cast = false) => boxAt(...cheeseF.box(ua, ya, wa, ub, yb, wb), m, { cast });
  // (plinth, front strip and back fit between the white ends and under the
  // canopy, so no two faces lie on top of each other and flicker)
  cpart(CH.u0 + 0.06, 0, 0, CH.u1 - 0.06, 0.3, CH.depth, darkFrame);
  cpart(CH.u0 + 0.06, 0.3, CH.depth - 0.05, CH.u1 - 0.06, 0.42, CH.depth, cabinetWhite);
  cpart(CH.u0 + 0.06, 0.3, 0, CH.u1 - 0.06, CH.top, 0.05, coldLight);
  for (const u of [CH.u0, CH.u1 - 0.06]) cpart(u, 0, 0, u + 0.06, CH.roof, CH.depth, cabinetWhite, true);
  cpart(CH.u0, CH.top, 0, CH.u1, CH.roof, 0.8, cheeseF.withFront(cabinetWhite, std({ map: labelTexture('HOLLANDSE KAAS  •  HOLLANDSE KAAS  •  HOLLANDSE KAAS', '#3fae3a', '#ffffff', 2048, 96) })), true);
  cpart(CH.u0 + 0.06, CH.top - 0.03, 0.1, CH.u1 - 0.06, CH.top, 0.16, lightStrip);
  const cheesePacks = stock.section();
  const packKinds = ['jongkaas', 'oudekaas', 'komijnekaas', 'plakken', 'geitenkaas', 'jongkaas'];
  const tilt = 0.2;
  const shelfMesh = [];
  [[1.0, 0.42], [0.9, 0.78], [0.8, 1.12], [0.7, 1.46]].forEach(([wf, yf], i) => {
    // the shelf: a sloping wire shelf from its front edge back to the wall, with a price rail
    const len = (wf - 0.06) / Math.cos(tilt);
    // (2 mm short of the ends at each side, so its ends aren't in one plane with the price rail's)
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, CH.u1 - CH.u0 - 0.124), wireShelf));
    const [mx] = cheeseF.P(0, 0, wf - (wf - 0.06) / 2);
    m.position.set(mx, yf + Math.tan(tilt) * (wf - 0.06) / 2 - 0.01, (CH.u0 + CH.u1) / 2);
    m.rotation.z = -tilt; // rising towards the wall (−x is the back)
    shelfMesh.push(m);
    cpart(CH.u0 + 0.06, yf - 0.04, wf - 0.015, CH.u1 - 0.06, yf + 0.03, wf, cabinetWhite);
    // runs of packs lying on it, in rows up the slope
    let u = CH.u0 + 0.1;
    let n = i;
    while (u < CH.u1 - 0.1) {
      const id = packKinds[n++ % packKinds.length];
      const [hw, hh, hd] = halfSize(PRODUCTS[id]);
      const run = 3 + Math.floor(rnd() * 4);
      for (let j = 0; j < run && u + 2 * hw <= CH.u1 - 0.1; j++) {
        for (let s = 0.03 + hd; (s + hd) * Math.cos(tilt) < wf - 0.08; s += 2 * hd + 0.012) {
          const [x] = cheeseF.P(0, 0, wf - 0.02 - s * Math.cos(tilt));
          stock.place(id, x, yf + s * Math.sin(tilt) + 0.002, u + hw, cheeseF.yaw, cheesePacks, s > 0.2 ? 1 : 0, tilt);
        }
        u += 2 * hw + 0.012;
      }
      u += 0.02;
    }
  });
  // big wheels on the roof of the cooler
  const wheels = stock.section();
  stock.fillRow(['kaaswiel', 'kaaswiel', 'edammer'], {
    along: 'z', a: CH.u0 + 0.1, b: CH.u1 - 0.1, y: CH.roof, yaw: cheeseF.yaw, maxH: 0.3, section: wheels, rows: 1,
    depthAt: (row, d) => cheeseF.P(0, 0, 0.78 - d / 2)[0], room: 0.75,
  });
  const cowTex = canvasTexture(768, 256, (g, w, h) => {
    g.fillStyle = '#3fae3a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9fd36a'; g.fillRect(0, h * 0.72, w, h * 0.28);
    // a comic cow
    g.lineWidth = 6; g.strokeStyle = INK_SIGN; g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(170, 140, 95, 55, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    for (const x of [100, 140, 205, 240]) { g.fillRect(x - 9, 180, 18, 52); g.strokeRect(x - 9, 180, 18, 52); }
    g.beginPath(); g.ellipse(285, 105, 42, 34, 0.3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#f2a2b8'; g.beginPath(); g.ellipse(305, 125, 24, 16, 0.3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = INK_SIGN;
    for (const [x, y, r] of [[140, 120, 26], [200, 160, 20], [120, 165, 14], [270, 92, 9]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.font = '900 64px "Arial Black", "Trebuchet MS", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.lineWidth = 10; g.strokeText('Hollandse', 370, 90); g.fillStyle = '#ffffff'; g.fillText('Hollandse', 370, 90);
    g.fillStyle = INK_SIGN; g.strokeText('kaas', 430, 170); g.fillStyle = '#f6d04d'; g.fillText('kaas', 430, 170);
  });
  const mid = (CH.u0 + CH.u1) / 2;
  boxAt(...cheeseF.box(mid - 1.5, 2.35, 0.02, mid + 1.5, 3.35, 0.07), cheeseF.withFront(darkWood, std({ map: cowTex })), { cast: true });
  const cooler = solid(...cheeseF.box(CH.u0, 0, 0, CH.u1, CH.roof, CH.depth - 0.03), 'furniture');
  cooler.surface.mess = MESS.cheese;
  cooler.surface.onHit = (point, strength, push) => {
    if (point.y > CH.roof - 0.05) return stock.knock(wheels, point, cheeseF.out, strength, push, { radius: Math.min(1.2, 0.4 + strength * 0.06) });
    return stock.knock(cheesePacks, point, cheeseF.out, strength, push);
  };

  // ---------------------------------------------------------------- the pindakaas and hagelslag pyramids, where the first aisle stood
  // A cardboard pallet stacked with jars or boxes in steps, a giant one on
  // top. Knock out enough of a layer and everything above it comes down too.
  const places = { sint: [], hagelslag: [] }; // for effects.js: where Lennie crashing into a Sint stand, or the hagelslag, does something
  const cardboard = std({ color: 0xb8925a, roughness: 0.9 });
  /**
   * A pyramid at (x, z): `kinds` the products of each layer (bottom up), `xl`
   * the giant one on top, `cols` × `rows` the bottom layer (two fewer each way
   * on every layer up), `pitch` [x, z] the spacing; `print` the pallet's
   * printed sides; `offer` the price on the card. Returns its landing spot.
   */
  function pyramid({ x, z, kinds, xl, cols, rows, pitch, jitter, print, offer, mess }) {
    const base = 0.45;
    const [phx, phz] = [(cols * pitch[0]) / 2 + 0.05, (rows * pitch[1]) / 2 + 0.045]; // the pallet's half size
    boxAt([x - phx, 0, z - phz], [x + phx, base, z + phz], faces(print, print, cardboard, cardboard, print, print), { cast: true });
    const baseBody = solid([x - phx, 0, z - phz], [x + phx, base, z + phz], 'furniture');
    const layers = [];
    let y = base;
    kinds.forEach((id, L) => {
      const [cs, rs] = [cols - 2 * L, rows - 2 * L];
      const hx = (cs * pitch[0]) / 2;
      const hz = (rs * pitch[1]) / 2;
      const h = halfSize(PRODUCTS[id])[1] * 2;
      boxAt([x - hx - 0.01, y, z - hz - 0.01], [x + hx + 0.01, y + 0.008, z + hz + 0.01], cardboard);
      y += 0.008;
      const section = stock.section();
      for (let i = 0; i < cs; i++) {
        for (let j = 0; j < rs; j++) stock.place(id, x - hx + (i + 0.5) * pitch[0], y, z - hz + (j + 0.5) * pitch[1], Math.PI + (rnd() - 0.5) * jitter, section);
      }
      layers.push({ section, min: [x - hx, y - 0.008, z - hz], max: [x + hx, y + h, z + hz] });
      y += h;
    });
    const xlSection = stock.section();
    stock.place(xl, x, y, z, Math.PI, xlSection);
    const [xx, xy, xz] = halfSize(PRODUCTS[xl]);
    layers.push({ section: xlSection, min: [x - xx, y, z - xz], max: [x + xx, y + 2 * xy, z + xz] });
    const pyramidTop = layers.at(-1).max[1];
    const left = (sec) => sec.items.filter((it) => it.state === 'home').length / sec.items.length;
    const hit = (point, strength, push) => {
      _out.set(point.x - x, 0, point.z - z);
      if (_out.lengthSq() < 0.01) _out.set(push?.x ?? 0, 0, push?.z ?? 1);
      _out.normalize();
      let n = 0;
      // the layer he hit and the ones above it
      let at = layers.findIndex((l) => point.y < l.max[1]);
      if (at < 0) at = layers.length - 1;
      for (let L = at; L < Math.min(layers.length, at + 2); L++) n += stock.knock(layers[L].section, point, _out, strength, push);
      if (point.y >= pyramidTop - 0.1 || at >= layers.length - 1) n += stock.knock(xlSection, point, _out, strength + 4, push, { radius: 1 });
      // a layer more than half gone: everything on top of it comes down
      const fallen = layers.findIndex((l) => left(l.section) < 0.5);
      if (fallen >= 0) {
        for (let L = fallen; L < layers.length; L++) {
          for (const item of layers[L].section.items) {
            if (item.state !== 'home') continue;
            _mid.set(item.home.x - x, 0, item.home.z - z);
            if (_mid.lengthSq() < 0.01) _mid.copy(_out);
            n += stock.knock({ items: [item] }, item.home, _mid.normalize(), 4 + rnd() * 3, null, { radius: 1 });
          }
          // (not in the middle of a physics step: after it, in update())
          if (layers[L].body.world) toRemove.add(layers[L].body);
        }
      }
      return n;
    };
    for (const l of layers) {
      l.body = solid(l.min, l.max, 'furniture');
      l.body.surface.mess = mess;
      l.body.surface.onHit = hit;
    }
    baseBody.surface.mess = mess;
    baseBody.surface.onHit = (point, strength, push) => hit(point.setY(Math.max(point.y, base + 0.02)), strength * 0.7, push);
    onRestock.push(() => {
      for (const l of layers) if (!l.body.world) world.addBody(l.body);
    });
    // the offer on a pole at a back corner
    boxAt([x + phx - 0.06, base - 0.01, z + phz - 0.06], [x + phx - 0.02, 2.1, z + phz - 0.02], darkFrame); // (its foot sunk into the pallet)
    boxAt([x + phx - 0.34, 1.5, z + phz - 0.07], [x + phx + 0.26, 2.25, z + phz - 0.04], std({ map: offerTexture(offer) }));
    return [[x - phx - 0.13, base - 0.1, z - phz - 0.13], [x + phx + 0.13, 1.9, z + phz + 0.13]];
  }
  onRestock.push(() => toRemove.clear());
  const pindakaasSpot = pyramid({
    x: -18, z: 37.6, kinds: Array(5).fill('pindakaas'), xl: 'pindakaasXL', cols: 12, rows: 10, pitch: [0.095, 0.095], jitter: 0.6,
    print: std({ map: labelTexture('PINDAKAAS', '#f2c14e', '#c0392b', 512, 112) }), offer: '1+1', mess: MESS.pindakaas,
  });
  spotsExtra.push(['pindakaas', 'In the pindakaas!', 550, 'PINDAKAAS!', ...pindakaasSpot]);
  const hagelslagSpot = pyramid({
    x: -18, z: 40.9, kinds: ['hagelslag', 'melkhagel', 'hagelslag', 'vlokken', 'hagelslag'], xl: 'hagelslagXL', cols: 10, rows: 14, pitch: [0.12, 0.07], jitter: 0.05,
    print: std({ map: labelTexture('HAGELSLAG', '#2a1f1a', '#ffffff', 512, 112) }), offer: '1,99', mess: MESS.hagelslag,
  });
  places.hagelslag.push({ min: hagelslagSpot[0], max: [hagelslagSpot[1][0], 2.6, hagelslagSpot[1][2]] });
  // and the aisle's sign, still hanging over them
  {
    const label = std({ map: labelTexture('BROODBELEG') });
    const [cx, sz] = [-18, AISLE.z0 - 0.4];
    boxAt([cx - 0.9, 2.75, sz - 0.05], [cx + 0.9, 3.2, sz], faces(green, green, green, green, label, label));
    for (const dx of [-0.7, 0.7]) boxAt([cx + dx - 0.01, 3.2, sz - 0.03], [cx + dx + 0.01, IN.y1, sz - 0.02], darkFrame);
  }

  // ---------------------------------------------------------------- the open snack freezer: kroketten, frikandellen, bitterballen
  {
    const FZ = { x0: 9.6, x1: 10.8, z0: 36.6, z1: 41.6, floor: 0.45, rim: 0.85, wall: 0.1 };
    const icy = std({ color: 0xdff2fa, emissive: 0x6a8a99, roughness: 0.5 });
    const band = std({ map: labelTexture('SNACKS  •  SNACKS  •  SNACKS', '#3b7dd8', '#ffffff', 1024, 96) });
    boxAt([FZ.x0, 0, FZ.z0], [FZ.x1, FZ.floor, FZ.z1], faces(cabinetWhite, cabinetWhite, icy, cabinetWhite, cabinetWhite, cabinetWhite), { cast: true });
    // The dark kick strip stands 1 cm proud of the white sides all round, and
    // the end walls fit between the long ones: when they overlapped, their
    // faces lay exactly on each other and the edges flickered.
    boxAt([FZ.x0 - 0.01, 0.06, FZ.z0 - 0.01], [FZ.x1 + 0.01, 0.12, FZ.z1 + 0.01], darkFrame);
    const walls = [
      [[FZ.x0, FZ.floor, FZ.z0], [FZ.x0 + FZ.wall, FZ.rim, FZ.z1], faces(icy, band, cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite)],
      [[FZ.x1 - FZ.wall, FZ.floor, FZ.z0], [FZ.x1, FZ.rim, FZ.z1], faces(band, icy, cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite)],
      [[FZ.x0 + FZ.wall, FZ.floor, FZ.z0], [FZ.x1 - FZ.wall, FZ.rim, FZ.z0 + FZ.wall], faces(cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite, icy, cabinetWhite)],
      [[FZ.x0 + FZ.wall, FZ.floor, FZ.z1 - FZ.wall], [FZ.x1 - FZ.wall, FZ.rim, FZ.z1], faces(cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite, icy)],
    ];
    const snacks = stock.section();
    const snackHit = (point, strength, push) => {
      _out.set(point.x < (FZ.x0 + FZ.x1) / 2 ? -1 : 1, 0, 0);
      return stock.knock(snacks, point, _out, strength, push, { radius: Math.min(0.9, 0.3 + strength * 0.06) });
    };
    for (const [lo, hi, m] of walls) {
      boxAt(lo, hi, m, { cast: true });
      const b = solid(lo, hi, 'furniture');
      b.surface.mess = MESS.snacks;
      b.surface.onHit = snackHit;
    }
    const bottom = solid([FZ.x0, 0, FZ.z0], [FZ.x1, FZ.floor, FZ.z1], 'furniture');
    bottom.surface.mess = MESS.snacks;
    bottom.surface.onHit = snackHit;
    stock.fillRow(['kroketten', 'frikandellen', 'bitterballen', 'kaassouffle'], {
      along: 'z', a: FZ.z0 + FZ.wall + 0.02, b: FZ.z1 - FZ.wall - 0.02, y: FZ.floor, yaw: Math.PI / 2, maxH: 0.2, section: snacks, rows: 10,
      depthAt: (row, d) => FZ.x0 + FZ.wall + 0.02 + d / 2 + row * (d + 0.01), room: FZ.x1 - FZ.x0 - 2 * FZ.wall - 0.04,
    });
    const sign = std({ map: labelTexture('SNACKS', '#3b7dd8') });
    const cx = (FZ.x0 + FZ.x1) / 2;
    boxAt([cx - 0.9, 2.75, FZ.z0 - 0.45], [cx + 0.9, 3.2, FZ.z0 - 0.4], faces(green, green, green, green, sign, sign));
    for (const dx of [-0.7, 0.7]) boxAt([cx + dx - 0.01, 3.2, FZ.z0 - 0.43], [cx + dx + 0.01, IN.y1, FZ.z0 - 0.42], darkFrame);
    spotsExtra.push(['snacks', 'In the snack freezer!', 550, 'KROKET!', [FZ.x0, 0.3, FZ.z0], [FZ.x1, 1.3, FZ.z1]]);
  }

  // ---------------------------------------------------------------- the Sinterklaas stands: pepernoten and chocolate letters
  // Against the green end caps on the entrance side of the three middle aisles
  // (just in front of them, not touching), the middle one straight across
  // from the doors: marsepein, pepernoten and chocolate letters.
  const red = std({ color: 0xc8102e, roughness: 0.8 });
  const sintHeaders = new Map();
  // (`rows`: how many rows deep each shelf is filled; loose sweets need a few to look like a heap)
  function sintStand(cx, assortment, line, mess, rows = 1) {
    const [back, u0, u1] = [AISLE.z0 - 0.06, cx - 0.6, cx + 0.6];
    places.sint.push({ min: [u0 - 0.1, 0, back - 0.6], max: [u1 + 0.1, 1.8, back + 0.05] });
    const sint = shelfUnit({
      axis: 'x', back, dir: -1, u0, u1, depth: 0.45, h: 1.3, ys: [0.1, 0.5, 0.9],
      assortment, mats: { frame: red, shelf: cabinetWhite, back: red }, mess, rows,
    });
    if (!sintHeaders.has(line)) sintHeaders.set(line, std({ map: sintHeader(line) }));
    boxAt(...sint.box(u0, 1.3, 0, u1, 1.75, 0.04), sint.withFront(red, sintHeaders.get(line)), { cast: true });
  }
  sintStand(aisleXs[1], ASSORTMENT.MARSEPEIN, 'marsepein!', MESS.marsepein, 3);
  sintStand(aisleXs[2], ASSORTMENT.SINT, 'pepernoten!', MESS.sint);
  sintStand(aisleXs[3], ASSORTMENT.LETTERS, 'chocoladeletters!', MESS.letters);
  /** The red sign on top of a Sinterklaas stand: a mitre, SINT, and what's in it. */
  function sintHeader(line) {
    return canvasTexture(512, 192, (g, w, h) => {
      g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h);
      // a mitre
      g.lineWidth = 5; g.strokeStyle = INK_SIGN;
      g.fillStyle = '#e8473b';
      g.beginPath(); g.moveTo(45, 175); g.lineTo(45, 95); g.quadraticCurveTo(45, 45, 95, 12); g.quadraticCurveTo(145, 45, 145, 95); g.lineTo(145, 175); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f6d04d'; g.fillRect(45, 150, 100, 22); g.strokeRect(45, 150, 100, 22);
      g.fillRect(87, 55, 16, 80); g.fillRect(68, 80, 54, 15);
      g.font = '900 52px "Arial Black", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffffff'; g.fillText('SINT', 330, 65);
      // (a long line in smaller letters, so it fits beside the mitre)
      g.font = '900 40px "Arial Black", "Trebuchet MS", sans-serif';
      g.font = `900 ${Math.min(40, Math.floor((40 * 320) / g.measureText(line).width))}px "Arial Black", "Trebuchet MS", sans-serif`;
      g.fillStyle = '#f6d04d'; g.fillText(line, 330, 135);
    });
  }

  // ---------------------------------------------------------------- tulips by the entrance, and the bottle return machine
  {
    // The buckets are products (products.js): Lennie crashing into the stand
    // sends them flying, and one that lands hard tips over, its tulips all over the floor.
    const T = FLOWERS;
    boxAt([T.x0, 0, T.z0], [T.x1, T.low, T.z1], darkWood, { cast: true });
    boxAt([T.x0, T.low, T.z0], [T.x1, T.high, (T.z0 + T.z1) / 2], darkWood, { cast: true });
    boxAt([T.x0 + 0.6, 0.12, T.z1], [T.x1 - 0.6, 0.24, T.z1 + 0.01], std({ map: labelTexture('BLOEMEN', '#ffffff', '#3fae3a', 512, 112) }));
    const flowers = stock.section();
    ['Rood', 'Geel', 'Roze', 'Oranje', 'Wit', 'Paars', 'Rood', 'Geel'].forEach((colour, i) => {
      const back = i >= 4;
      const id = `tulpen${colour}`;
      const bucket = stock.place(id, T.x0 + 0.3 + (i % 4) * 0.6, back ? T.high : T.low, back ? T.z0 + 0.2 : T.z1 - 0.18, i * 1.3, flowers);
      for (const piece of PRODUCTS[id].breaks) stock.place(piece, 0, 0, 0, 0, flowers, 0, { shardOf: bucket });
    });
    const stand = solid([T.x0, 0, T.z0], [T.x1, T.high, T.z1], 'furniture');
    stand.surface.sound = 'leaves';
    stand.surface.mess = MESS.flowers;
    // they fly away from where he hits, landing on them or crashing into the side
    stand.surface.onHit = (point, strength, push) => stock.knock(flowers, point, _out.set(0, 0, 1), strength, push, { radius: Math.min(1.3, 0.45 + strength * 0.08), radial: true });
    spotsExtra.push(['tulips', 'In the tulips!', 350, 'TULPEN!', [T.x0 - 0.1, 0.2, T.z0 - 0.1], [T.x1 + 0.1, 1.4, T.z1 + 0.2]]);

    // the bottle return: hand in your empties for the deposit
    const B = { x0: 2.3, x1: 3.1, z0: IN.z0, z1: IN.z0 + 0.65, h: 1.9 };
    const machine = canvasTexture(256, 512, (g, w, h) => {
      g.fillStyle = '#4f6b66'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3fae3a'; g.fillRect(0, 0, w, 90);
      g.fillStyle = '#ffffff'; g.font = '900 34px "Arial Black", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('STATIEGELD', w / 2, 32); g.font = 'bold 26px "Trebuchet MS", sans-serif'; g.fillText('lege flessen', w / 2, 68);
      g.fillStyle = '#10213a'; g.fillRect(48, 130, 160, 100);
      g.fillStyle = '#7fd36a'; g.font = 'bold 24px "Trebuchet MS", sans-serif'; g.fillText('€ 0,25', w / 2, 180);
      g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(w / 2, 320, 52, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c9ced3'; g.lineWidth = 10; g.stroke();
      g.fillStyle = '#f6d04d'; g.beginPath(); g.moveTo(w / 2 - 30, 410); g.lineTo(w / 2 + 30, 410); g.lineTo(w / 2, 450); g.closePath(); g.fill();
    });
    const grey = std({ color: 0x4f6b66, roughness: 0.5 });
    boxAt([B.x0, 0, B.z0], [B.x1, B.h, B.z1], faces(grey, grey, grey, grey, std({ map: machine }), grey), { cast: true });
    solid([B.x0, 0, B.z0], [B.x1, B.h, B.z1], 'furniture');
  }

  // ---------------------------------------------------------------- the butcher's counter in the back corner
  // A glass counter of meat on trays, a narrow aisle behind it for the butcher,
  // and a back counter under a tiled wall with rookworsten hanging on a rail.
  // It takes the corner the freezers used to run into, so the floor stays open.
  const butcher = (() => {
    const F = frame('x', IN.z1, -1);
    // u along the wall; w out from it: back counter, the butcher's aisle, then the glass counter
    const B = { u0: 7.75, u1: 12.75, back: 0.45, aisle: 1.05, ledge: 1.3, front: 1.95, bed: 0.8, top: 1.32 };
    const du0 = B.u0 + 0.75; // the glass counter leaves a gap at this end to get behind it
    const bpart = (ua, ya, wa, ub, yb, wb, m, cast = false) => boxAt(...F.box(ua, ya, wa, ub, yb, wb), m, { cast });
    const mess = MESS.sausage;
    const red = '#b3121f';

    // the back counter, the tiled wall above it with a comic pig, and the rail of rookworsten
    bpart(B.u0, 0, 0, B.u1, 0.88, B.back, cabinetWhite, true);
    bpart(B.u0, 0.88, 0, B.u1, 0.92, B.back + 0.02, steel);
    const tiles = canvasTexture(1024, 356, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = red; g.fillRect(0, h - 30, w, 30); g.fillRect(0, 0, w, 30);
      g.strokeStyle = '#d5dade'; g.lineWidth = 2;
      for (let x = 0; x <= w; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      // the pig
      const px = 330;
      const py = 175;
      g.lineWidth = 6; g.strokeStyle = INK_SIGN; g.fillStyle = '#f5a9b8';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(px + s * 40, py - 60); g.lineTo(px + s * 75, py - 100); g.lineTo(px + s * 72, py - 45); g.closePath(); g.fill(); g.stroke(); }
      g.beginPath(); g.arc(px, py, 78, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ef8fa4'; g.beginPath(); g.ellipse(px, py + 22, 36, 26, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = INK_SIGN;
      for (const s of [-1, 1]) {
        g.beginPath(); g.ellipse(px + s * 13, py + 22, 6, 10, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(px + s * 30, py - 22, 9, 0, Math.PI * 2); g.fill();
      }
      g.font = '900 84px "Arial Black", "Trebuchet MS", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.lineWidth = 12; g.lineJoin = 'round'; g.strokeStyle = '#ffffff';
      g.strokeText('SLAGERIJ', 440, 150); g.fillStyle = red; g.fillText('SLAGERIJ', 440, 150);
      g.font = 'bold 40px "Trebuchet MS", sans-serif'; g.fillStyle = INK_SIGN; g.fillText('vers van de slager', 448, 222);
    });
    bpart(B.u0, 0.92, 0, B.u1, 2.65, 0.02, F.withFront(cabinetWhite, std({ map: tiles })));
    bpart(B.u0 + 0.1, 2.38, 0.2, B.u1 - 0.1, 2.41, 0.23, steel);
    for (const u of [B.u0 + 0.1, B.u1 - 0.13]) bpart(u, 2.38, 0.02, u + 0.03, 2.41, 0.23, steel); // (from the tiles out)
    const hanging = stock.section();
    const upright = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const [, , hw] = F.P(0, 0, 0.215);
    const hangDrop = halfSize(PRODUCTS.rookworst)[2];
    for (let u = B.u0 + 0.3; u < B.u1 - 0.25; u += 0.21) stock.place('rookworst', u, 2.385 - hangDrop, hw, F.yaw, hanging, 0, { tilt: upright, lift: 0 });
    // on the back counter: a chopping block with a cleaver, and rookworst and leverworst
    bpart(B.u0 + 0.3, 0.92, 0.06, B.u0 + 0.9, 1.04, 0.4, wood, true);
    bpart(B.u0 + 0.5, 1.04, 0.15, B.u0 + 0.72, 1.05, 0.27, steel);
    bpart(B.u0 + 0.72, 1.04, 0.19, B.u0 + 0.86, 1.07, 0.23, darkFrame);
    const backStock = stock.section();
    stock.fillRow(['rookworst', 'leverworst', 'rookworst', 'saucijs'], {
      along: 'x', a: B.u0 + 1.1, b: B.u1 - 0.1, y: 0.92, yaw: F.yaw, maxH: 0.3, section: backStock, rows: 2,
      depthAt: (row, d) => F.P(0, 0, B.back - 0.03 - d / 2 - row * (d + 0.01))[2], room: B.back - 0.08,
    });
    const backBody = solid(...F.box(B.u0, 0, 0, B.u1, 0.92, B.back + 0.02), 'furniture');
    backBody.surface.mess = mess;
    backBody.surface.onHit = (point, strength, push) => (point.y > 0.86 ? stock.knock(backStock, point, F.out, strength, push) : 0);
    // the rookworsten on the rail come down when he hits them (they're soft)
    const rail = solid(...F.box(B.u0 + 0.1, 2.2, 0.12, B.u1 - 0.1, 2.42, 0.3), 'cushion', physMats.soft);
    rail.surface.mess = mess;
    rail.surface.onHit = (point, strength, push) => stock.knock(hanging, point, F.out, strength, push, { radius: Math.min(1.2, 0.4 + strength * 0.08) });

    // the glass counter: meat on steel trays with parsley between them, and a price rail
    const counterFront = canvasTexture(1024, 192, (g, w, h) => {
      for (let x = 0; x < w; x += 64) { g.fillStyle = (x / 64) % 2 ? '#ffffff' : red; g.fillRect(x, 0, 64, h); }
      g.fillStyle = '#ffffff'; g.fillRect(w * 0.27, h * 0.2, w * 0.46, h * 0.6);
      g.strokeStyle = red; g.lineWidth = 8; g.strokeRect(w * 0.27, h * 0.2, w * 0.46, h * 0.6);
      g.fillStyle = red; g.font = '900 72px "Arial Black", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SLAGERIJ', w / 2, h / 2 + 4);
    });
    // (the counter stops under the cold-light bed and the ledge, and the kick
    // strip is a few mm in from its ends, so no two faces lie on each other and flicker)
    bpart(du0, 0, B.aisle, B.u1, B.bed - 0.01, B.front, F.withFront(cabinetWhite, std({ map: counterFront })), true);
    bpart(du0 + 0.005, 0, B.front - 0.06, B.u1 - 0.005, 0.1, B.front + 0.005, darkFrame);
    bpart(du0, B.bed - 0.01, B.ledge, B.u1, B.bed, B.front, coldLight);
    bpart(du0, B.bed - 0.01, B.aisle, B.u1, 1.25, B.ledge, cabinetWhite, true);
    // the scale on the ledge
    bpart(du0 + 0.4, 1.25, 1.08, du0 + 0.75, 1.3, 1.27, steel);
    bpart(du0 + 0.45, 1.3, 1.1, du0 + 0.7, 1.44, 1.13, darkFrame);
    const trays = [
      ['rookworst', 'ROOKWORST', '2,49'], ['gehaktbal', 'GEHAKTBALLEN', '3,99'], ['slavink', 'SLAVINKEN', '4,29'], ['biefstuk', 'BIEFSTUK', '6,99'],
      ['kipfilet', 'KIPFILET', '5,49'], ['speklap', 'SPEKLAPPEN', '3,79'], ['karbonade', 'KARBONADE', '4,49'], ['runderlap', 'RUNDERLAPPEN', '5,99'],
      ['filetAmericain', 'FILET AMERICAIN', '1,89'], ['saucijs', 'SAUCIJZEN', '3,49'],
    ];
    const meats = stock.section();
    const tw = (B.u1 - 0.04 - du0) / trays.length;
    const parsley = std({ color: 0x3e8f3a, roughness: 0.9 });
    const [w0, w1] = [B.ledge + 0.04, B.front - 0.06];
    trays.forEach(([id], i) => {
      const a = du0 + 0.02 + i * tw;
      bpart(a + 0.02, B.bed, w0, a + tw - 0.02, B.bed + 0.015, w1, steel);
      if (i) bpart(a - 0.018, B.bed, w0, a + 0.018, B.bed + 0.035, w1, parsley);
      const [hu, , hd] = halfSize(PRODUCTS[PRODUCTS[id].base ?? id]);
      for (let u = a + 0.04 + hu; u < a + tw - 0.03 - hu; u += hu * 2.1) {
        for (let w = w0 + 0.02 + hd; w < w1 - 0.02 - hd; w += hd * 2.15) {
          const [x, , z] = F.P(u + (rnd() - 0.5) * 0.01, 0, w);
          stock.place(id, x, B.bed + 0.015, z, F.yaw + (rnd() - 0.5) * 0.3, meats, w < (w0 + w1) / 2 ? 1 : 0);
        }
      }
    });
    const prices = canvasTexture(2048, 64, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      const sw = w / trays.length;
      g.textBaseline = 'middle';
      trays.forEach(([, name, price], i) => {
        g.fillStyle = INK_SIGN; g.font = 'bold 22px "Trebuchet MS", sans-serif'; g.textAlign = 'left';
        g.fillText(name, i * sw + 8, h / 2 + 2, sw - 80);
        g.fillStyle = red; g.font = '900 28px "Arial Black", "Trebuchet MS", sans-serif'; g.textAlign = 'right';
        g.fillText(price, (i + 1) * sw - 8, h / 2 + 2);
        g.fillStyle = '#c9ced3'; g.fillRect((i + 1) * sw - 2, 0, 4, h);
      });
    });
    bpart(du0 + 0.005, B.bed - 0.07, B.front - 0.01, B.u1 - 0.005, B.bed + 0.01, B.front + 0.015, F.withFront(steel, std({ map: prices })));

    // the glass: flat on top, sloping down to the front, glass ends; breakable
    const span = B.u1 - du0;
    const midU = (du0 + B.u1) / 2;
    const glassMeshes = [bpart(du0, B.top - 0.012, B.ledge - 0.05, B.u1, B.top, 1.62, cabinetGlass)];
    const [dy, dw] = [B.top - (B.bed + 0.05), B.front - 0.02 - 1.62];
    const slant = add(new THREE.Mesh(new THREE.BoxGeometry(span, 0.012, Math.hypot(dy, dw)), cabinetGlass));
    slant.position.set(midU, (B.top + B.bed + 0.05) / 2, F.P(0, 0, (1.62 + B.front - 0.02) / 2)[2]);
    slant.rotation.x = Math.atan2(-dy, dw);
    glassMeshes.push(slant);
    const endShape = new THREE.Shape([[B.ledge - 0.05, B.bed], [B.front - 0.02, B.bed], [B.front - 0.02, B.bed + 0.05], [1.62, B.top], [B.ledge - 0.05, B.top]].map(([w, y]) => new THREE.Vector2(w, y)));
    const endGeo = new THREE.ExtrudeGeometry(endShape, { depth: 0.012, bevelEnabled: false });
    // (2 mm outside the counter's ends, so the glass doesn't flicker against them)
    for (const u of [du0 - 0.002, B.u1 - 0.010]) {
      const m = add(new THREE.Mesh(endGeo, cabinetGlass));
      m.rotation.y = Math.PI / 2; // the shape's x runs out from the wall (−z), its depth along u
      m.position.set(u, 0, IN.z1);
      glassMeshes.push(m);
    }
    glassMeshes.push(bpart(du0 + 0.05, B.top - 0.04, B.ledge - 0.04, B.u1 - 0.05, B.top - 0.015, B.ledge + 0.02, lightStrip));
    const glass = pane(glassMeshes, ...F.box(du0, B.bed + 0.02, B.ledge - 0.05, B.u1, B.top + 0.02, B.front + 0.02), F.out);
    glass.onBreak = () => stock.knock(meats, glass.center, F.out, 7, null, { radius: 1.6, chance: 0.6 });
    const base = solid(...F.box(du0, 0, B.aisle, B.u1, B.bed + 0.02, B.front), 'furniture');
    base.surface.mess = mess;
    base.surface.onHit = (point, strength, push) => (glass.broken && point.y > B.bed - 0.05 ? stock.knock(meats, point, F.out, strength, push, { radius: Math.min(1, 0.3 + strength * 0.06) }) : 0);
    const ledge = solid(...F.box(du0, B.bed, B.aisle, B.u1, 1.3, B.ledge - 0.05), 'furniture');
    ledge.surface.mess = mess;

    // the hanging sign, with the "now serving" number next to it
    const sign = canvasTexture(1024, 192, (g, w, h) => {
      g.fillStyle = red; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = '900 96px "Arial Black", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SLAGERIJ', w * 0.38, h / 2 + 4);
      g.fillStyle = '#141414'; g.fillRect(w * 0.76, 24, w * 0.21, h - 48);
      g.fillStyle = '#ff4a3a'; g.font = '900 100px "Courier New", monospace'; g.fillText('42', w * 0.865, h / 2 + 6);
      g.fillStyle = '#ffffff'; g.font = 'bold 22px "Trebuchet MS", sans-serif'; g.fillText('NU AAN DE BEURT', w * 0.865, 14);
    });
    const signMat = std({ map: sign });
    const signRed = std({ color: 0xb3121f });
    const [, , sz] = F.P(0, 0, B.front + 0.35);
    boxAt([midU - 1.3, 2.7, sz - 0.03], [midU + 1.3, 3.19, sz + 0.03], faces(signRed, signRed, signRed, signRed, signMat, signMat));
    for (const dx of [-1.1, 1.1]) boxAt([midU + dx - 0.01, 3.19, sz - 0.01], [midU + dx + 0.01, IN.y1, sz + 0.01], darkFrame);

    return { F, B, du0, glass };
  })();

  stock.build();

  // ---------------------------------------------------------------- a row of shopping trolleys by the door
  const trolleyMat = std({ color: 0xb8bec4, metalness: 0.5, roughness: 0.35, transparent: true, opacity: 0.75 });
  const handle = std({ color: 0x3fae3a, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const x = 0.2 + i * 0.32;
    const z = IN.z0 + 0.25;
    boxAt([x, 0.45, z], [x + 0.55, 1.0, z + 0.9], trolleyMat);
    boxAt([x - 0.02, 0.98, z - 0.06], [x + 0.57, 1.04, z], handle);
    for (const [dx, dz] of [[0.05, 0.05], [0.5, 0.05], [0.05, 0.85], [0.5, 0.85]]) boxAt([x + dx - 0.03, 0, z + dz - 0.03], [x + dx + 0.03, 0.45, z + dz + 0.03], darkFrame);
  }
  solid([0.2, 0, IN.z0 + 0.15], [1.75, 1.05, IN.z0 + 1.2], 'furniture');

  // ---------------------------------------------------------------- queries and the view
  const isInside = (p) => p.y > -1 && p.y < IN.y1 && p.x > IN.x0 && p.x < IN.x1 && p.z > IN.z0 && p.z < IN.z1;
  const isOnRoof = (p) => p.y > IN.y1 && p.x > SHOP.x0 - 0.5 && p.x < SHOP.end + 0.5 && p.z > SHOP.z0 - 0.5 && p.z < SHOP.z1 + 0.5;

  // From across the road (see house.js, which does the same the other way):
  // with the camera's target on the house's side of the cycle path and the
  // camera well short of the shop too, the shop's fixed parts are drawn as a
  // cheap copy, a few meshes in place of a few hundred. The products on the
  // shelves are a few meshes already and stay as they are; the glass doors and
  // counters inside aren't drawn then. `target` and `camera` are where (in z)
  // it switches on, the others where it switches back.
  const FAR = { target: 12.5, targetOff: 15, camera: 22, cameraOff: 24 };
  let farView = null;
  let far = false;
  let farAllowed = true; // (allowFar(false) keeps the real parts in the picture, to measure what the copy saves)

  /** Makes the far copy. main.js calls it once everything is built and the scenery has been combined. */
  function finish() {
    // (a pane of the shop window stays itself, so a broken one stays broken)
    for (const piece of windows) if (piece.center.z < IN.z0 + 0.2) outer.add(piece.group);
    const panes = new Set(windows.map((piece) => piece.group));
    const fixed = [];
    const collect = (parent) => {
      for (const o of parent.children) {
        if (!o.visible || panes.has(o)) continue;
        if (!o.isMesh) collect(o);
        else if (!o.isInstancedMesh && !o.userData.products) fixed.push(o);
      }
    };
    collect(scene);
    farView = farCopy(fixed);
    farView.visible = false;
    root.add(farView);
  }

  function updateView(camera, target, dt) {
    if (farView) {
      const z = camera.position.z;
      const wanted = farAllowed && (far ? target.z < FAR.targetOff && z < FAR.cameraOff : target.z < FAR.target && z < FAR.camera);
      if (wanted !== far) {
        far = wanted;
        scene.visible = !far;
        farView.visible = far;
      }
    }
    const a = [target.x, target.y, target.z];
    const b = [camera.position.x, camera.position.y, camera.position.z];
    for (const entry of lines.values()) {
      entry.target = 1;
      const ax = entry.axis;
      const da = a[ax] - entry.value;
      const db = b[ax] - entry.value;
      if (da * db >= 0) continue;
      const t = da / (da - db);
      let inside = true;
      for (let i = 0; i < 3 && inside; i++) {
        if (i === ax) continue;
        const p = a[i] + (b[i] - a[i]) * t;
        inside = p > entry.min[i] - FADE_MARGIN && p < entry.max[i] + FADE_MARGIN;
      }
      // no grey ghost with the camera close to the wall (see house.js)
      if (inside) entry.target = FADED * THREE.MathUtils.smoothstep(Math.abs(db), CLEAR_NEAR, CLEAR_FAR);
    }
    const k = 1 - Math.exp(-dt * 10);
    for (const entry of lines.values()) {
      if (entry.opacity === entry.target) continue;
      entry.opacity += (entry.target - entry.opacity) * k;
      if (Math.abs(entry.opacity - entry.target) < 0.01) entry.opacity = entry.target;
      for (const m of entry.mats) {
        m.opacity = entry.opacity * m.userData.baseOpacity;
        m.depthWrite = entry.opacity > 0.95 && m.userData.baseOpacity === 1;
        setFade(m, entry.opacity < 1);
      }
    }
  }

  /** True when a mesh is faded out of the way, so aiming looks past it. */
  function isFaded(mesh) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const entry = matLine.get(mat);
    return !!entry && entry.opacity < 0.5;
  }

  // Landing spots worth a bonus (see house.js): just above each fixture.
  const S = (id, label, value, say, min, max, when = null) => ({ id, label, value, say, min, max, when });
  const [freezerInside, fridgeInside] = [freezers.inside, fridges.inside];
  const spots = [
    ...freezers.doorways.map((d) => S('freezer', 'In the freezer!', 600, 'BRRR!', d.min, d.max, d.when)),
    ...fridges.doorways.map((d) => S('drinksfridge', 'In the drinks fridge!', 550, 'BRRR!', d.min, d.max, d.when)),
    S('fridges', 'On top of the drinks fridges!', 500, 'WHOA!', [fridgeInside[0][0] - 0.1, CAB.height - 0.05, fridgeInside[0][2]], [IN.x1, 3.0, fridgeInside[1][2]]),
    S('freezertop', 'On top of the freezers!', 500, 'WHOA!', [freezerInside[0][0], CAB.height - 0.05, freezerInside[0][2] - 0.1], [freezerInside[1][0], 3.0, IN.z1]),
    S('trolley', 'In the trolleys!', 400, 'WHEEE!', [0.15, 0.95, IN.z0 + 0.1], [1.8, 1.8, IN.z0 + 1.25]),
    ...vegSpots.map((box) => S('fruit', 'In the fruit and veg!', 400, 'SQUISH!', ...box)),
    ...[-17, -13.5, -10].map((c) => S('checkout', 'Scanned at the checkout!', 500, 'BEEP!', [c - 0.45, 0.85, IN.z0 + 1.15], [c + 1.05, 1.6, IN.z0 + 3.85])),
    ...aisleXs.map((cx) => S('shelves', 'On top of the shelves!', 500, 'HELP!', [cx - 0.6, 1.9, 36.1], [cx + 0.6, 2.8, 42.5])),
    S('pastry', 'In the pastry case!', 600, 'TOMPOUCE!', ...caseF.box(CASE.u0, CASE.top - 0.1, 0, CASE.u1, CASE.glass + 0.5, CASE.depth + 0.1), () => pastryCase.broken),
    S('bread', 'In the bread baskets!', 400, 'FRESH!', [breadTable.x0 - 0.05, 0.7, breadTable.z0 - 0.05], [breadTable.x1 + 0.05, 1.5, breadTable.z1 + 0.05]),
    S('breadrack', 'On top of the bread rack!', 500, 'HELP!', ...breadRack.box(IN.z0 + 0.2, 2.4, 0, 35.4, 3.2, 0.65)),
    S('cheese', 'On top of the cheese!', 500, 'SAY CHEESE!', ...cheeseF.box(CH.u0, CH.roof - 0.05, 0, CH.u1, 3.0, CH.depth)),
    ...spotsExtra.map((a) => S(...a)),
    // (the butcher's aisle, and the way into it at the end of the glass counter)
    S('butcher', 'Behind the butcher counter!', 500, 'VOLGENDE!', ...butcher.F.box(butcher.B.u0, -1, butcher.B.back, butcher.B.u1, 1.25, butcher.B.aisle)),
    S('butcher', 'Behind the butcher counter!', 500, 'VOLGENDE!', ...butcher.F.box(butcher.B.u0, -1, butcher.B.back, butcher.du0, 1.25, butcher.B.ledge)),
    S('meat', 'In the meat counter!', 600, 'GEHAKT!', ...butcher.F.box(butcher.du0, butcher.B.bed - 0.1, butcher.B.ledge - 0.1, butcher.B.u1, 1.8, butcher.B.front + 0.1), () => butcher.glass.broken),
  ];

  function update(dt) {
    for (const b of toRemove) if (b.world) world.removeBody(b);
    toRemove.clear();
    return stock.update(dt);
  }

  /** Smashes a pane of glass (the shop window or a fridge door) out of its frame. */
  function breakPiece(piece) {
    if (piece.broken) return;
    piece.broken = true;
    piece.group.visible = false;
    world.removeBody(piece.body);
    piece.onBreak?.();
  }

  /** New glass everywhere and the shelves stocked again. */
  function repairAll() {
    for (const fix of onRestock) fix();
    for (const piece of windows) {
      if (!piece.broken) continue;
      piece.broken = false;
      piece.group.visible = true;
      world.addBody(piece.body);
    }
    stock.restock();
  }

  // Where 'Drop Lennie on the supermarket' puts him: the open floor just inside
  // the sliding doors, between the checkouts and the Sint stands before the aisles.
  const spawnPoint = () => ({ x: -4.5, z: 34.4, height: 0.05 });

  const fadeMaterials = () => [...lines.values()].flatMap((e) => [...e.mats]);
  const api = {
    finish,
    get farView() { return farView; },
    get far() { return far; },
    allowFar(on) { farAllowed = on; },
    isInside, isOnRoof, spawnPoint, updateView, fadeMaterials, isFaded, spots, places, windows, breakPiece, repairAll, update };
  for (const piece of windows) piece.owner = api;
  return api;
}
