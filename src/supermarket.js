import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { floorGeometry, meterBoxUVs } from './textures.js';

// The supermarket across the road, after the real one: a long orange box
// under a zigzag of grey gables, with a brick-and-glass entrance and a big
// green four-dot logo. Lennie can be flung in through the open sliding doors:
// inside are checkouts, fruit and veg crates with red offer signs, aisles of
// shelves, freezers and fridges. The west end is a closed storeroom.
// Walls, the roof and the entrance fade like the house's walls when they block
// the view of the camera target.
export const SHOP = {
  x0: -36, x1: 14, // whole building
  hall: -22, // the shop floor runs from here to x1; west of it is the storeroom
  z0: 30, z1: 46, // front (street side) and back walls
  h: 4.2, // wall height; the ceiling is at 3.95
  t: 0.3, // wall thickness
  door: [-5.6, -2.4], doorTop: 2.6, // the open sliding doors
};
// inside faces of the shop floor's walls
const IN = { x0: SHOP.hall + SHOP.t, x1: SHOP.x1 - SHOP.t, z0: SHOP.z0 + SHOP.t, z1: SHOP.z1 - SHOP.t, y1: SHOP.h - 0.25 };

const FADED = 0.12;
const FADE_MARGIN = 0.6;

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
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

export function buildSupermarket(scene, world, physMats, { std, tex }) {
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
      clone.transparent = true;
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
    b.surface = { kind };
    world.addBody(b);
  };
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
  boxAt([SHOP.x0 - 0.05, SHOP.h - 0.15, SHOP.z0 - 0.06], [SHOP.hall, SHOP.h, SHOP.z0 + 0.02], white);

  // ---------------------------------------------------------------- walls of the shop floor
  const [d0, d1] = SHOP.door;
  // the wall is open behind the glass entrance (E below), so you can see in
  const frontMats = faces(orange, orange, orange, orange, innerWall, orange);
  for (const [a, b] of [[SHOP.hall, -9.0], [-0.1, SHOP.x1]]) {
    boxAt([a, 0, SHOP.z0], [b, SHOP.h, SHOP.z0 + SHOP.t], frontMats, { cast: true, fade: 'front' });
    solid([a, 0, SHOP.z0], [b, SHOP.h, SHOP.z0 + SHOP.t], 'wall');
  }
  boxAt([SHOP.hall, SHOP.h - 0.15, SHOP.z0 - 0.06], [SHOP.x1 + 0.05, SHOP.h, SHOP.z0 + 0.02], white, { fade: 'front' });

  boxAt([IN.x1, 0, SHOP.z0], [SHOP.x1, SHOP.h, SHOP.z1], faces(orange, innerWall, orange, orange, orange, orange), { cast: true, fade: 'east' });
  solid([IN.x1, 0, SHOP.z0], [SHOP.x1, SHOP.h, SHOP.z1], 'wall');
  boxAt([SHOP.hall, 0, IN.z1], [IN.x1, SHOP.h, SHOP.z1], faces(orange, orange, orange, orange, orange, innerWall), { fade: 'back' });
  solid([SHOP.hall, 0, IN.z1], [IN.x1, SHOP.h, SHOP.z1], 'wall');
  // the storeroom's wall, with a staff door on the shop side
  boxAt([SHOP.hall, 0, IN.z0], [IN.x0, SHOP.h, IN.z1], innerWall);
  solid([SHOP.hall, 0, IN.z0], [IN.x0, SHOP.h, IN.z1], 'wall');
  boxAt([IN.x0, 0, 40], [IN.x0 + 0.04, 2.2, 41.4], std({ color: 0x8d949a, roughness: 0.5 }));
  boxAt([IN.x0, 2.3, 40], [IN.x0 + 0.04, 2.6, 41.4], std({ map: labelTexture('Alleen personeel', '#ffffff', '#c0392b', 512, 96) }));

  // ---------------------------------------------------------------- roof, with the zigzag of gables
  boxAt([SHOP.hall, IN.y1, SHOP.z0], [SHOP.x1, SHOP.h, SHOP.z1], faces(orange, orange, roofGrey, ceiling, orange, orange), { fade: 'roof' });
  solid([SHOP.hall, IN.y1, SHOP.z0], [SHOP.x1, SHOP.h, SHOP.z1], 'roof');
  const gableW = 5;
  const gableH = 2.6;
  const tri = new THREE.Shape([new THREE.Vector2(-gableW / 2, 0), new THREE.Vector2(gableW / 2, 0), new THREE.Vector2(0, gableH)]);
  const gableGeo = new THREE.ExtrudeGeometry(tri, { depth: SHOP.z1 - SHOP.z0 - 0.4, bevelEnabled: false });
  const slate = [std({ color: 0x5b6268, emissive: 0x1c1f22, roughness: 0.7 }), std({ color: 0x8e959b, roughness: 0.6 })];
  const glazed = [std({ color: 0x8fb6b9, emissive: 0x22302f, roughness: 0.2 }), slate[1]];
  for (let x = SHOP.x0 + gableW / 2; x < SHOP.x1; x += gableW) {
    const overEntrance = x === -8.5 || x === -3.5;
    const m = add(new THREE.Mesh(gableGeo, overEntrance ? glazed : slate), { cast: true, fade: x > SHOP.hall ? 'roof' : null });
    m.position.set(x, SHOP.h, SHOP.z0 + 0.2);
    gableBody(x, gableW, gableH, SHOP.z0 + 0.2, SHOP.z1 - 0.2);
  }
  /** A solid triangular prism under one gable, so Lennie lands on (and slides down) its slopes. */
  function gableBody(cx, w, hgt, za, zb) {
    const y = SHOP.h;
    const pts = [[cx - w / 2, y, za], [cx + w / 2, y, za], [cx, y + hgt, za], [cx - w / 2, y, zb], [cx + w / 2, y, zb], [cx, y + hgt, zb]];
    const c = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);
    const verts = pts.map((p) => new CANNON.Vec3(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    const faceList = [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]].map((f) => {
      const [a, b, d] = f.map((i) => verts[i]);
      const n = b.vsub(a).cross(d.vsub(a));
      const mid = f.reduce((s, i) => s.vadd(verts[i]), new CANNON.Vec3()).scale(1 / f.length);
      return n.dot(mid) < 0 ? [...f].reverse() : f; // normals point away from the centre
    });
    const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.ConvexPolyhedron({ vertices: verts, faces: faceList }) });
    b.position.set(...c);
    b.surface = { kind: 'roof' };
    world.addBody(b);
  }

  // ---------------------------------------------------------------- the entrance: brick and glass under the logo
  const E = { x0: -9.6, x1: 0.5, z0: SHOP.z0 - 0.7, top: 5.6 };
  const fadeFront = { fade: 'front', cast: true };
  boxAt([E.x0, 0, E.z0], [E.x0 + 0.6, E.top, SHOP.z0], brick, { ...fadeFront, uv: true });
  boxAt([E.x1 - 0.6, 0, E.z0], [E.x1, E.top, SHOP.z0], brick, { ...fadeFront, uv: true });
  boxAt([E.x0 + 0.6, E.top - 0.45, E.z0], [E.x1 - 0.6, E.top, SHOP.z0], brick, { ...fadeFront, uv: true });
  boxAt([E.x0 - 0.2, E.top, E.z0 - 0.2], [E.x1 + 0.2, E.top + 0.15, SHOP.z0 + 0.1], white, fadeFront);
  const gz = [E.z0 + 0.2, E.z0 + 0.26];
  for (const [a, b, y0, y1] of [[E.x0 + 0.6, d0, 0, E.top - 0.45], [d1, E.x1 - 0.6, 0, E.top - 0.45], [d0, d1, SHOP.doorTop, E.top - 0.45]]) {
    boxAt([a, y0, gz[0]], [b, y1, gz[1]], shopGlass, { fade: 'front' });
  }
  for (const [a, b, y0, y1] of [[E.x0 + 0.6, E.x1 - 0.6, SHOP.doorTop, SHOP.doorTop + 0.1], [d0 - 0.12, d0, 0, SHOP.doorTop], [d1, d1 + 0.12, 0, SHOP.doorTop], [-7.6, -7.5, 0, SHOP.doorTop], [-0.8, -0.7, 0, SHOP.doorTop]]) {
    boxAt([a, y0, gz[0] - 0.02], [b, y1, gz[1] + 0.02], darkFrame, { fade: 'front' });
  }
  // the sliding doors stand open, slid behind the fixed glass
  for (const [a, b] of [[d0 - 1.4, d0 - 0.05], [d1 + 0.05, d1 + 1.4]]) boxAt([a, 0.02, gz[1] + 0.04], [b, SHOP.doorTop - 0.05, gz[1] + 0.08], shopGlass, { fade: 'front' });
  solid([E.x0, 0, E.z0], [d0, E.top, SHOP.z0], 'wall');
  solid([d1, 0, E.z0], [E.x1, E.top, SHOP.z0], 'wall');
  solid([d0, SHOP.doorTop, E.z0], [d1, E.top, SHOP.z0], 'wall');
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
  ];
  [-30, -20.5, 4.5, 10].forEach((x, i) => {
    boxAt([x, 1.3, SHOP.z0 - 0.04], [x + 2.4, 3.1, SHOP.z0], faces(white, white, white, white, white, std({ map: posters[i] })), { fade: x > SHOP.hall ? 'front' : null });
  });
  boxAt([-14, 0, SHOP.z0 - 0.05], [-12.4, 2.4, SHOP.z0], std({ color: 0x8d949a, roughness: 0.5 }), { fade: 'front' });

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
  const lamp = std({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.9 });
  for (let x = IN.x0 + 2.5; x < IN.x1 - 1; x += 5) boxAt([x - 0.15, IN.y1 - 0.04, IN.z0 + 1.5], [x + 0.15, IN.y1, IN.z1 - 1.5], lamp, { fade: 'roof' });
  const bandTex = labelTexture('LEKKER VERS  •  ELKE DAG VOORDELIG  •  LEKKER VERS', '#3fae3a', '#ffffff', 2048, 96);
  boxAt([IN.x0 + 0.5, 2.75, IN.z1 - 0.03], [IN.x1 - 0.5, 3.35, IN.z1], faces(green, green, green, green, green, std({ map: bandTex })));

  // a little seeded randomness so the shelves look the same every time
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const _c = new THREE.Color();

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

  // ---------------------------------------------------------------- fruit and veg crates with offer signs
  const crate = std({ color: 0x4b7f33, roughness: 0.8 });
  const produceKinds = [
    { color: 0xe8473b, r: 0.085 }, // apples
    { color: 0xf59a23, r: 0.085 }, // oranges
    { color: 0x8cc63f, r: 0.16 }, // cabbages
    { color: 0xf6d04d, r: 0.07 }, // lemons
    { color: 0xd8312a, r: 0.06 }, // tomatoes
    { color: 0x7a3e9d, r: 0.075 }, // plums
    { color: 0x3e8f3a, r: 0.05 }, // green beans (in bunches)
    { color: 0xe07b2a, r: 0.06 }, // carrots
    { color: 0xa5d36b, r: 0.08 }, // pears
  ];
  const produce = [];
  const prices = ['0,99', '1,49', '2,49', '0,79', '1,99', '0,89'];
  const tables = [[0.6, 4.1], [4.6, 8.1], [8.6, 12.1]];
  tables.forEach(([x0, x1], t) => {
    const z0 = IN.z0 + 2.0;
    const z1 = z0 + 1.6;
    boxAt([x0, 0, z0], [x1, 0.72, z1], crate, { cast: true });
    solid([x0, 0, z0], [x1, 0.8, z1], 'furniture');
    const parts = 3;
    const w = (x1 - x0) / parts;
    for (let p = 0; p < parts; p++) {
      const kind = produceKinds[(t * parts + p) % produceKinds.length];
      const r = kind.r;
      for (let x = x0 + p * w + r + 0.05; x < x0 + (p + 1) * w - r - 0.03; x += r * 2.05) {
        for (let z = z0 + r + 0.05; z < z1 - r - 0.03; z += r * 2.05) {
          produce.push([x + (rnd() - 0.5) * 0.02, 0.72 + r * (0.85 + rnd() * 0.3), z, r, kind.color]);
        }
      }
      // the red offer card on a pole behind each compartment
      const cx = x0 + (p + 0.5) * w;
      boxAt([cx - 0.02, 0.72, z1 - 0.06], [cx + 0.02, 1.55, z1 - 0.02], darkFrame);
      const card = std({ map: offerTexture(prices[(t * parts + p) % prices.length]) });
      boxAt([cx - 0.24, 1.45, z1 - 0.06], [cx + 0.24, 2.05, z1 - 0.03], faces(card, card, card, card, card, card));
    }
  });
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const fruit = new THREE.InstancedMesh(ball, std({ color: 0xffffff, roughness: 0.55, flatShading: true }), produce.length);
  produce.forEach(([x, y, z, r, color], i) => {
    fruit.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.identity(), _s.set(r, r, r)));
    fruit.setColorAt(i, _c.setHex(color));
  });
  fruit.castShadow = true;
  scene.add(fruit);

  // ---------------------------------------------------------------- aisles of shelves
  const shelfMat = std({ color: 0xd9dcdf, roughness: 0.5, metalness: 0.2 });
  const endCap = green;
  const AISLE = { z0: 36.2, z1: 42.4, h: 1.95, half: 0.55 };
  const shelfYs = [0.12, 0.55, 0.98, 1.41];
  const items = [];
  const packColors = [0xe8473b, 0xf6d04d, 0x3b7dd8, 0xffffff, 0x3fae3a, 0xf59a23, 0x8e44ad, 0xe86fa0, 0x6b4a32, 0x1b1b1b, 0x5fc4e0];
  const aisleNames = ['BROOD', 'ZUIVEL', 'KAAS', 'SNOEP', 'DRINKEN', 'PASTA & SOEP'];
  [-18, -13, -8, -3, 2, 7].forEach((cx, a) => {
    const { z0, z1, h, half } = AISLE;
    boxAt([cx - half, 0, z0], [cx + half, 0.12, z1], shelfMat);
    boxAt([cx - 0.04, 0.12, z0], [cx + 0.04, h, z1], shelfMat, { cast: true });
    for (const y of shelfYs.slice(1)) boxAt([cx - half, y - 0.03, z0], [cx + half, y, z1], shelfMat);
    boxAt([cx - half, h - 0.05, z0], [cx + half, h, z1], shelfMat);
    for (const z of [z0, z1]) boxAt([cx - half, 0, z - 0.05], [cx + half, h, z + 0.05], endCap, { cast: true });
    solid([cx - half, 0, z0 - 0.05], [cx + half, h, z1 + 0.05], 'furniture');
    // the goods: rows of boxes, jars and bags in bright packaging, on both sides
    for (const side of [-1, 1]) {
      for (const y of shelfYs) {
        const col = packColors[Math.floor(rnd() * packColors.length)];
        let z = z0 + 0.1;
        while (z < z1 - 0.3) {
          const w = 0.14 + rnd() * 0.16;
          const ht = 0.16 + rnd() * 0.2;
          // runs of the same product, like on real shelves
          const c = rnd() < 0.2 ? packColors[Math.floor(rnd() * packColors.length)] : col;
          items.push([cx + side * 0.3, y + ht / 2, z + w / 2, 0.36, ht, w, c]);
          z += w + 0.02;
        }
      }
    }
    // a hanging sign over the front end of the aisle
    const label = std({ map: labelTexture(aisleNames[a]) });
    boxAt([cx - 0.9, 2.75, z0 - 0.45], [cx + 0.9, 3.2, z0 - 0.4], faces(green, green, green, green, label, label));
    for (const dx of [-0.7, 0.7]) boxAt([cx + dx - 0.01, 3.2, z0 - 0.43], [cx + dx + 0.01, IN.y1, z0 - 0.42], darkFrame);
  });
  const goods = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ color: 0xffffff, roughness: 0.6 }), items.length);
  items.forEach(([x, y, z, sx, sy, sz, color], i) => {
    goods.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.identity(), _s.set(sx, sy, sz)));
    goods.setColorAt(i, _c.setHex(color).offsetHSL(0, 0, (rnd() - 0.5) * 0.08));
  });
  goods.castShadow = true;
  scene.add(goods);

  // ---------------------------------------------------------------- freezers along the back, fridges along the side
  const freezerBody = std({ color: 0xf4f6f8, roughness: 0.4 });
  const freezerTop = std({ color: 0xbfe3f2, roughness: 0.1, emissive: 0x16323d });
  const iceCream = [0xf7e3b5, 0xf2a2b8, 0x8a5a3c, 0xffffff, 0x9ad0e8];
  const tubs = [];
  for (let x = IN.x0 + 1.2; x + 3 < IN.x1 - 1.4; x += 3.3) {
    const z0 = IN.z1 - 1.3;
    boxAt([x, 0, z0], [x + 3, 0.86, IN.z1 - 0.1], freezerBody, { cast: true });
    boxAt([x + 0.08, 0.86, z0 + 0.08], [x + 2.92, 0.9, IN.z1 - 0.18], freezerTop);
    solid([x, 0, z0], [x + 3, 0.9, IN.z1 - 0.1], 'furniture');
    for (let tx = x + 0.25; tx < x + 2.8; tx += 0.3) for (const tz of [z0 + 0.35, z0 + 0.75]) tubs.push([tx, tz, iceCream[Math.floor(rnd() * iceCream.length)]]);
  }
  const tubMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.1, 0.12, 10), std({ color: 0xffffff, roughness: 0.5 }), tubs.length);
  tubs.forEach(([x, z, color], i) => {
    tubMesh.setMatrixAt(i, _m.makeTranslation(x, 0.8, z));
    tubMesh.setColorAt(i, _c.setHex(color));
  });
  scene.add(tubMesh);
  boxAt([IN.x0 + 1.2, 2.35, IN.z1 - 0.06], [IN.x0 + 5.2, 2.7, IN.z1 - 0.03], faces(white, white, white, white, white, std({ map: labelTexture('DIEPVRIES', '#3b7dd8') })));

  const fridgeMat = std({ map: fridgeTexture(), emissive: 0x3a4a50, roughness: 0.15 });
  for (let z = IN.z0 + 5.5; z + 1.6 < IN.z1 - 1.6; z += 1.7) {
    boxAt([IN.x1 - 0.85, 0, z], [IN.x1, 2.15, z + 1.6], faces(freezerBody, fridgeMat, freezerBody, freezerBody, freezerBody, freezerBody), { cast: true });
  }
  solid([IN.x1 - 0.85, 0, IN.z0 + 5.5], [IN.x1, 2.15, IN.z1 - 1.6], 'furniture');

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
  const isOnRoof = (p) => p.y > IN.y1 && p.x > SHOP.x0 - 0.5 && p.x < SHOP.x1 + 0.5 && p.z > SHOP.z0 - 0.5 && p.z < SHOP.z1 + 0.5;

  function updateView(camera, target, dt) {
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
      if (inside) entry.target = FADED;
    }
    const k = 1 - Math.exp(-dt * 10);
    for (const entry of lines.values()) {
      if (entry.opacity === entry.target) continue;
      entry.opacity += (entry.target - entry.opacity) * k;
      if (Math.abs(entry.opacity - entry.target) < 0.01) entry.opacity = entry.target;
      for (const m of entry.mats) {
        m.opacity = entry.opacity * m.userData.baseOpacity;
        m.depthWrite = entry.opacity > 0.95 && m.userData.baseOpacity === 1;
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
  let freezerEnd = IN.x0 + 1.2;
  while (freezerEnd + 3.3 + 3 < IN.x1 - 1.4) freezerEnd += 3.3;
  const S = (id, label, value, say, min, max) => ({ id, label, value, say, min, max });
  const spots = [
    S('freezer', 'In the freezer!', 600, 'BRRR!', [IN.x0 + 1.2, 0.8, IN.z1 - 1.35], [freezerEnd + 3, 1.8, IN.z1]),
    S('fridges', 'On top of the drinks fridges!', 500, 'WHOA!', [IN.x1 - 0.9, 2.1, IN.z0 + 5.4], [IN.x1, 3.0, IN.z1 - 1.5]),
    S('trolley', 'In the trolleys!', 400, 'WHEEE!', [0.15, 0.95, IN.z0 + 0.1], [1.8, 1.8, IN.z0 + 1.25]),
    S('fruit', 'In the fruit and veg!', 400, 'SQUISH!', [0.55, 0.7, IN.z0 + 1.95], [12.15, 1.5, IN.z0 + 3.65]),
    ...[-17, -13.5, -10].map((c) => S('checkout', 'Scanned at the checkout!', 500, 'BEEP!', [c - 0.45, 0.85, IN.z0 + 1.15], [c + 1.05, 1.6, IN.z0 + 3.85])),
    ...[-18, -13, -8, -3, 2, 7].map((cx) => S('shelves', 'On top of the shelves!', 500, 'HELP!', [cx - 0.6, 1.9, 36.1], [cx + 0.6, 2.8, 42.5])),
  ];

  return { isInside, isOnRoof, updateView, isFaded, spots };
}
