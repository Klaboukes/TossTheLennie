import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { floorGeometry, meterBoxUVs } from './textures.js';
import { createStock, ASSORTMENT, PRODUCTS, halfSize } from './products.js';

// The supermarket across the road, after the real one: a long orange box
// under a zigzag of grey gables, with a brick-and-glass entrance and a big
// green four-dot logo. Lennie can be flung in through the open sliding doors:
// inside are checkouts, fruit and veg crates with red offer signs, aisles of
// shelves stocked with products (products.js) that tumble off when Lennie hits
// them, and glass-door freezers and fridges. The shop window and every
// freezer and fridge door is breakable glass. The west end is a closed storeroom.
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
const INK_SIGN = '#2b2b2b';
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
  // (in the back corner, past the cheese cooler)
  boxAt([IN.x0, 0, 43.1], [IN.x0 + 0.04, 2.2, 44.5], std({ color: 0x8d949a, roughness: 0.5 }));
  boxAt([IN.x0, 2.3, 43.1], [IN.x0 + 0.04, 2.6, 44.5], std({ map: labelTexture('Alleen personeel', '#ffffff', '#c0392b', 512, 96) }));

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

  // ---------------------------------------------------------------- fruit and veg crates with offer signs
  // The fruit and veg are loose products (products.js), like the groceries on
  // the shelves: a knock against a crate table sends them rolling, off the
  // table and across the floor.
  const crate = std({ color: 0x4b7f33, roughness: 0.8 });
  const produceKinds = ['appel', 'sinaasappel', 'kool', 'citroen', 'tomaat', 'pruim', 'boontjes', 'wortel', 'peer'];
  const prices = ['0,99', '1,49', '2,49', '0,79', '1,99', '0,89'];
  const CRATE = { z0: IN.z0 + 2.0, z1: IN.z0 + 3.6, top: 0.72 };
  const crateXs = [[0.6, 3.6], [4.1, 7.1], [7.6, 10.6]];
  const crateTables = crateXs.map(([x0, x1]) => ({ x0, x1, z0: CRATE.z0, z1: CRATE.z1, y: CRATE.top }));
  // the bakery's table of bread baskets, by the bread rack
  const breadTable = { x0: -20.1, x1: -18.8, z0: 32.3, z1: 34.4, y: 0.72 };
  const stock = createStock(scene, { bounds: IN, tables: [...crateTables, breadTable] });
  const _mid = new THREE.Vector3();
  /**
   * A table piled with loose products (fruit, rolls) in compartments, one kind
   * each: a knock sends them rolling off the table and across the floor.
   * `card` puts a red offer card on a pole behind each compartment.
   */
  function looseTable({ x0, x1, z0, z1, y: top }, kinds, mat, mess, card = null) {
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
      if (card) {
        const cx = (a0 + a1) / 2;
        boxAt([cx - 0.02, top, z1 - 0.06], [cx + 0.02, 1.55, z1 - 0.02], darkFrame);
        const m = std({ map: offerTexture(card(p)) });
        boxAt([cx - 0.24, 1.45, z1 - 0.06], [cx + 0.24, 2.05, z1 - 0.03], m);
      }
    }
  }
  crateTables.forEach((t, i) => looseTable(t, [0, 1, 2].map((p) => produceKinds[(i * 3 + p) % produceKinds.length]), crate, 'Clean-up at the veg!', (p) => prices[(i * 3 + p) % prices.length]));

  // ---------------------------------------------------------------- aisles of shelves
  // Each aisle is stocked with products that belong there (products.js); a
  // hard knock against a shelf sends the ones near the impact tumbling out.
  const shelfMat = std({ color: 0xd9dcdf, roughness: 0.5, metalness: 0.2 });
  const endCap = green;
  const AISLE = { z0: 36.2, z1: 42.4, h: 1.95, half: 0.55 };
  const shelfYs = [0.12, 0.55, 0.98, 1.41];
  const aisleNames = ['BROODBELEG', 'ZUIVEL', 'KOFFIE & THEE', 'SNOEP', 'DRINKEN', 'PASTA & SAUS'];
  const aisleXs = [-18, -13, -8, -3, 2, 7];
  aisleXs.forEach((cx, a) => {
    const { z0, z1, h, half } = AISLE;
    boxAt([cx - half, 0, z0], [cx + half, 0.12, z1], shelfMat);
    boxAt([cx - 0.04, 0.12, z0], [cx + 0.04, h, z1], shelfMat, { cast: true });
    for (const y of shelfYs.slice(1)) boxAt([cx - half, y - 0.03, z0], [cx + half, y, z1], shelfMat);
    boxAt([cx - half, h - 0.05, z0], [cx + half, h, z1], shelfMat);
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
    shelf.surface.mess = `Clean-up in aisle ${a + 1}!`;
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
    part(u0, 0, 0, u1, base, depth, darkFrame, { phys: true });
    part(u0, top, 0, u1, height, depth, cabinetWhite, { phys: true, cast: true });
    const signTex = labelTexture(`${sign}   •   ${sign}   •   ${sign}`, signColor, '#ffffff', 1024, 64);
    signTex.wrapS = THREE.RepeatWrapping;
    signTex.repeat.set(Math.max(1, Math.round((u1 - u0) / 6)), 1);
    boxAt(...box(u0, top + 0.03, -0.01, u1, height - 0.03, 0), std({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.2 }));
    for (const u of [u0, u1 - 0.06]) part(u, 0, 0, u + 0.06, height, depth, cabinetWhite, { phys: true, cast: true });
    part(u0, base, depth - 0.04, u1, top, depth, coldLight);
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
  const freezers = cabinets({ axis: 'x', wall: IN.z1, u0: IN.x0 + 1.2, u1: IN.x1 - 1.3, assortment: ASSORTMENT.DIEPVRIES, sign: 'DIEPVRIES', signColor: '#3b7dd8', mess: 'Clean-up at the freezers!' });
  const fridges = cabinets({ axis: 'z', wall: IN.x1, u0: IN.z0 + 5.5, u1: IN.z1 - 0.95, assortment: ASSORTMENT.FRISDRANK, sign: 'FRISDRANK', signColor: '#3fae3a', mess: 'Clean-up at the fridges!' });

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
  function shelfUnit({ axis, back, dir, u0, u1, depth, h, ys, assortment, mats, mess }) {
    const F = frame(axis, back, dir);
    const part = (ua, ya, wa, ub, yb, wb, m, cast = false) => boxAt(...F.box(ua, ya, wa, ub, yb, wb), m, { cast });
    part(u0, 0, 0, u1, h, 0.04, mats.back, true);
    for (const u of [u0, u1 - 0.04]) part(u, 0, 0, u + 0.04, h, depth, mats.frame, true);
    part(u0, 0, 0.04, u1, ys[0], depth, mats.frame);
    for (const y of ys.slice(1)) part(u0 + 0.04, y - 0.03, 0.04, u1 - 0.04, y, depth, mats.shelf);
    part(u0, h - 0.04, 0, u1, h, depth, mats.frame);
    const section = stock.section();
    ys.forEach((y, i) => {
      const above = (ys[i + 1] ?? h) - 0.04;
      stock.fillRow(assortment[i], {
        along: axis, a: u0 + 0.07, b: u1 - 0.07, y, yaw: F.yaw, maxH: Math.min(0.42, above - y), section,
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
    assortment: ASSORTMENT.BAKKERIJ, mats: { frame: wood, shelf: wood, back: darkWood }, mess: 'Bread everywhere!',
  });
  boxAt(...breadRack.box(IN.z0 + 0.2, 2.0, 0, 35.4, 2.45, 0.6), breadRack.withFront(wood, std({ map: labelTexture('VERS GEBAKKEN', '#f4e3c3', brown, 1024, 96) })), { cast: true });
  const bakerySign = std({ map: labelTexture('BAKKERIJ', brown, '#f4e3c3') });
  boxAt([-20.4, 2.75, 33.3], [-18.6, 3.2, 33.35], faces(darkWood, darkWood, darkWood, darkWood, bakerySign, bakerySign));
  for (const x of [-20.2, -18.8]) boxAt([x - 0.01, 3.2, 33.31], [x + 0.01, IN.y1, 33.33], darkFrame);
  looseTable(breadTable, ['bol', 'pistolet', 'krentenbolLos'], std({ color: 0xb07a3c, roughness: 0.95 }), 'Rolls everywhere!');

  // the pastry case along the front wall: a counter with a glass case on top
  const caseF = frame('x', IN.z0, 1);
  const CASE = { u0: -21.1, u1: -18.6, depth: 0.82, top: 0.85, glass: 1.3 };
  boxAt(...caseF.box(CASE.u0, 0, 0, CASE.u1, CASE.top, CASE.depth), caseF.withFront(wood, std({ map: labelTexture('Vers van de bakker', '#f4e3c3', brown, 1024, 160) })), { cast: true });
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
  counter.surface.mess = 'Tompouces everywhere!';
  counter.surface.onHit = (point, strength, push) => (point.y > CASE.top - 0.05 ? stock.knock(pastries, point, caseF.out, strength, push) : 0);

  // the bread slicer, on its own little stand next to the case
  const steel = std({ color: 0xc9ced3, metalness: 0.5, roughness: 0.35 });
  boxAt([-18.45, 0, IN.z0 + 0.05], [-17.85, 0.85, IN.z0 + 0.65], wood, { cast: true });
  boxAt([-18.42, 0.85, IN.z0 + 0.1], [-17.88, 1.45, IN.z0 + 0.6], faces(steel, steel, steel, steel, std({ map: labelTexture('SNIJMACHINE', '#c9ced3', '#2b2b2b', 512, 96) }), steel), { cast: true });
  boxAt([-18.3, 1.12, IN.z0 + 0.6], [-18.0, 1.32, IN.z0 + 0.62], darkFrame);
  boxAt([-18.06, 0.95, IN.z0 + 0.6], [-17.98, 1.03, IN.z0 + 0.63], std({ color: 0x3fae3a, emissive: 0x1d5a1b }));
  solid([-18.45, 0, IN.z0 + 0.05], [-17.85, 1.45, IN.z0 + 0.65], 'furniture');

  // ---------------------------------------------------------------- the sloping fruit and veg stand against the east wall
  // Rows of black crates tilted towards the shop, each piled with one kind of
  // vegetable, with price screens on poles behind them.
  const VEG = { u0: IN.z0 + 0.3, u1: 35.5, depth: 1.55, front: 0.7, back: 1.2, rows: 3 };
  const vegF = frame('z', IN.x1, -1);
  const slope = Math.atan2(VEG.back - VEG.front, VEG.depth - 0.1);
  const slopeLen = Math.hypot(VEG.back - VEG.front, VEG.depth - 0.1);
  // a point on the slope: s up it from the front edge, n off its surface, at u along the stand
  const slopeDir = new THREE.Vector3(Math.cos(slope) * -vegF.out.x, Math.sin(slope), 0);
  const slopeNormal = new THREE.Vector3(Math.sin(slope) * vegF.out.x, Math.cos(slope), 0);
  const [fx] = vegF.P(0, 0, VEG.depth);
  const onSlope = (s, u, n) => new THREE.Vector3(fx, VEG.front, u).addScaledVector(slopeDir, s).addScaledVector(slopeNormal, n);
  const slopeQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -vegF.out.x * slope);
  const lightWood = std({ color: 0xd8b98a, roughness: 0.8 });
  boxAt(...vegF.box(VEG.u0, 0, 0.08, VEG.u1, VEG.front - 0.04, VEG.depth), lightWood, { cast: true });
  boxAt(...vegF.box(VEG.u0, 0, 0, VEG.u1, VEG.back + 0.3, 0.08), lightWood, { cast: true });
  const plate = add(new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.04, VEG.u1 - VEG.u0), lightWood));
  plate.position.copy(onSlope(slopeLen / 2, (VEG.u0 + VEG.u1) / 2, -0.02));
  plate.quaternion.copy(slopeQ);
  // the crates: one instanced mesh of black boxes (floors and rims)
  const vegKinds = ['paprikaRood', 'komkommer', 'paprikaGeel', 'broccoli', 'tomaat', 'prei', 'paprikaGroen', 'champignon', 'ui', 'aubergine', 'wortel', 'aardappel', 'boontjes', 'citroen'];
  const vegSection = stock.section();
  const crateW = { s: (slopeLen - 0.08) / VEG.rows - 0.04, u: 0.6 };
  const cratesAlong = Math.floor((VEG.u1 - VEG.u0 - 0.04) / (crateW.u + 0.04));
  const crateParts = [];
  const _p = new THREE.Vector3();
  for (let r = 0; r < VEG.rows; r++) {
    for (let c = 0; c < cratesAlong; c++) {
      const sc = 0.04 + r * (crateW.s + 0.04) + crateW.s / 2;
      const uc = VEG.u0 + 0.04 + c * (crateW.u + 0.04) + crateW.u / 2;
      const { s: ws, u: wu } = crateW;
      // floor, then the four rims, as (s, n, u) centre and size
      crateParts.push([sc, 0.01, uc, ws, 0.02, wu], [sc - ws / 2, 0.06, uc, 0.015, 0.12, wu], [sc + ws / 2, 0.06, uc, 0.015, 0.12, wu], [sc, 0.06, uc - wu / 2, ws, 0.12, 0.015], [sc, 0.06, uc + wu / 2, ws, 0.12, 0.015]);
      const id = vegKinds[(c * 2 + r * 5) % vegKinds.length];
      const [hu, hn, hs] = halfSize(PRODUCTS[id]); // a stick lies along u
      for (let s = sc - ws / 2 + hs + 0.02; s < sc + ws / 2 - hs - 0.01; s += hs * 2.1) {
        for (let u = uc - wu / 2 + hu + 0.02; u < uc + wu / 2 - hu - 0.01; u += hu * 2.1) {
          _p.copy(onSlope(s, u, 0.02 + hn + rnd() * 0.01));
          stock.place(id, _p.x, _p.y - hn, _p.z, Math.PI / 2 + (PRODUCTS[id].shape === 'stick' ? 0 : rnd() * Math.PI * 2), vegSection);
        }
      }
    }
  }
  const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ color: 0x1f2123, roughness: 0.7 }), crateParts.length);
  crateParts.forEach(([s, n, u, ws, hn, wu], i) => {
    crateMesh.setMatrixAt(i, new THREE.Matrix4().compose(onSlope(s, u, n), slopeQ, new THREE.Vector3(ws, hn, wu)));
  });
  add(crateMesh, { cast: true });
  const vegHit = (point, strength, push) => stock.knock(vegSection, point, vegF.out, strength, push, { radius: Math.min(0.8, 0.25 + strength * 0.05) });
  for (const b of [
    solid(...vegF.box(VEG.u0, 0, 0, VEG.u1, VEG.front - 0.04, VEG.depth), 'furniture'),
    solid(...vegF.box(VEG.u0, 0, 0, VEG.u1, VEG.back + 0.3, 0.08), 'furniture'),
  ]) {
    b.surface.mess = 'Clean-up at the veg!';
    b.surface.onHit = vegHit;
  }
  {
    // the slope itself, tilted like the crates
    const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(slopeLen / 2, 0.15, (VEG.u1 - VEG.u0) / 2)) });
    const c = onSlope(slopeLen / 2, (VEG.u0 + VEG.u1) / 2, 0.08 - 0.15);
    b.position.set(c.x, c.y, c.z);
    b.quaternion.set(slopeQ.x, slopeQ.y, slopeQ.z, slopeQ.w);
    b.surface = { kind: 'furniture', mess: 'Clean-up at the veg!', onHit: vegHit };
    world.addBody(b);
  }
  // price screens on poles behind the crates
  const screens = [['KOMKOMMER', '0,89'], ['PAPRIKA', '1,29'], ['PREI', '0,99'], ['BROCCOLI', '1,49'], ['TOMATEN', '1,79'], ['UIEN', '0,69']];
  [0.2, 0.5, 0.8].forEach((f, i) => {
    const u = VEG.u0 + (VEG.u1 - VEG.u0) * f;
    boxAt(...vegF.box(u - 0.03, VEG.back + 0.3, 0.02, u + 0.03, 2.1, 0.07), darkFrame);
    const tex = canvasTexture(384, 224, (g, w, h) => {
      g.fillStyle = '#10213a'; g.fillRect(0, 0, w, h);
      g.font = 'bold 34px "Trebuchet MS", sans-serif'; g.textBaseline = 'middle';
      for (const [k, [name, price]] of screens.slice(i * 2, i * 2 + 2).entries()) {
        const y = 62 + k * 100;
        g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText(name, 20, y);
        g.fillStyle = '#f6d04d'; g.textAlign = 'right'; g.fillText(price, w - 20, y);
      }
      g.strokeStyle = '#3c4146'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
    });
    boxAt(...vegF.box(u - 0.38, 1.65, 0.07, u + 0.38, 2.1, 0.12), vegF.withFront(darkFrame, std({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 })));
  });
  const vegSign = std({ map: labelTexture('GROENTE & FRUIT') });
  boxAt([12.88, 2.75, (VEG.u0 + VEG.u1) / 2 - 0.9], [12.93, 3.2, (VEG.u0 + VEG.u1) / 2 + 0.9], faces(vegSign, vegSign, green, green, green, green));
  for (const dz of [-0.7, 0.7]) boxAt([12.9, 3.2, (VEG.u0 + VEG.u1) / 2 + dz - 0.01], [12.91, IN.y1, (VEG.u0 + VEG.u1) / 2 + dz + 0.01], darkFrame);

  // ---------------------------------------------------------------- the open cheese cooler along the west wall
  // Sloping shelves of cheese packs under a lit canopy, with big Gouda wheels
  // stacked on top and a sign with a cow above them.
  const cheeseF = frame('z', IN.x0, 1);
  const CH = { u0: 36.4, u1: 42.6, depth: 1.05, top: 1.85, roof: 2.0 };
  const cpart = (ua, ya, wa, ub, yb, wb, m, cast = false) => boxAt(...cheeseF.box(ua, ya, wa, ub, yb, wb), m, { cast });
  cpart(CH.u0, 0, 0, CH.u1, 0.36, CH.depth, darkFrame);
  cpart(CH.u0, 0.3, CH.depth - 0.05, CH.u1, 0.42, CH.depth, cabinetWhite);
  cpart(CH.u0, 0, 0, CH.u1, CH.roof, 0.05, coldLight);
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
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, CH.u1 - CH.u0 - 0.12), wireShelf));
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
  cooler.surface.mess = 'Cheese everywhere!';
  cooler.surface.onHit = (point, strength, push) => {
    if (point.y > CH.roof - 0.05) return stock.knock(wheels, point, cheeseF.out, strength, push, { radius: Math.min(1.2, 0.4 + strength * 0.06) });
    return stock.knock(cheesePacks, point, cheeseF.out, strength, push);
  };

  // ---------------------------------------------------------------- the pindakaas pyramid by the entrance
  // A cardboard pallet stacked with jars in steps, the giant jar on top. Knock
  // out enough of a layer and everything above it comes down too.
  {
    const P0 = { x: -7.4, z: 34.2 };
    const base = 0.45;
    const pitch = 0.095;
    const jarH = halfSize(PRODUCTS.pindakaas)[1] * 2;
    const cardboard = std({ color: 0xb8925a, roughness: 0.9 });
    const printed = std({ map: labelTexture('PINDAKAAS', '#f2c14e', '#c0392b', 512, 112) });
    boxAt([P0.x - 0.62, 0, P0.z - 0.52], [P0.x + 0.62, base, P0.z + 0.52], faces(printed, printed, cardboard, cardboard, printed, printed), { cast: true });
    const baseBody = solid([P0.x - 0.62, 0, P0.z - 0.52], [P0.x + 0.62, base, P0.z + 0.52], 'furniture');
    const layers = [];
    let y = base;
    for (let L = 0; L < 5; L++) {
      const cols = 12 - 2 * L;
      const rows = 10 - 2 * L;
      const hx = (cols * pitch) / 2;
      const hz = (rows * pitch) / 2;
      boxAt([P0.x - hx - 0.01, y, P0.z - hz - 0.01], [P0.x + hx + 0.01, y + 0.008, P0.z + hz + 0.01], cardboard);
      y += 0.008;
      const section = stock.section();
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) stock.place('pindakaas', P0.x - hx + (i + 0.5) * pitch, y, P0.z - hz + (j + 0.5) * pitch, Math.PI + (rnd() - 0.5) * 0.6, section);
      }
      layers.push({ section, min: [P0.x - hx, y - 0.008, P0.z - hz], max: [P0.x + hx, y + jarH, P0.z + hz] });
      y += jarH;
    }
    const xlSection = stock.section();
    stock.place('pindakaasXL', P0.x, y, P0.z, Math.PI, xlSection);
    const xlR = halfSize(PRODUCTS.pindakaasXL)[0];
    layers.push({ section: xlSection, min: [P0.x - xlR, y, P0.z - xlR], max: [P0.x + xlR, y + 2 * halfSize(PRODUCTS.pindakaasXL)[1], P0.z + xlR] });
    const pyramidTop = layers.at(-1).max[1];
    const left = (sec) => sec.items.filter((it) => it.state === 'home').length / sec.items.length;
    const hit = (point, strength, push) => {
      _out.set(point.x - P0.x, 0, point.z - P0.z);
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
            _mid.set(item.home.x - P0.x, 0, item.home.z - P0.z);
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
      l.body.surface.mess = 'Pindakaas everywhere!';
      l.body.surface.onHit = hit;
    }
    baseBody.surface.mess = 'Pindakaas everywhere!';
    baseBody.surface.onHit = (point, strength, push) => hit(point.setY(Math.max(point.y, base + 0.02)), strength * 0.7, push);
    onRestock.push(() => {
      toRemove.clear();
      for (const l of layers) if (!l.body.world) world.addBody(l.body);
    });
    // the offer: buy one, get one free
    boxAt([P0.x + 0.56, base, P0.z + 0.46], [P0.x + 0.6, 2.1, P0.z + 0.5], darkFrame);
    const card = std({ map: offerTexture('1+1') });
    boxAt([P0.x + 0.28, 1.5, P0.z + 0.45], [P0.x + 0.88, 2.25, P0.z + 0.48], card);
    spotsExtra.push(['pindakaas', 'In the pindakaas!', 550, 'PINDAKAAS!', [P0.x - 0.75, base - 0.1, P0.z - 0.65], [P0.x + 0.75, 1.9, P0.z + 0.65]]);
  }

  // ---------------------------------------------------------------- the open snack freezer: kroketten, frikandellen, bitterballen
  {
    const FZ = { x0: 9.6, x1: 10.8, z0: 36.6, z1: 41.6, floor: 0.45, rim: 0.85, wall: 0.1 };
    const icy = std({ color: 0xdff2fa, emissive: 0x6a8a99, roughness: 0.5 });
    const band = std({ map: labelTexture('SNACKS  •  SNACKS  •  SNACKS', '#3b7dd8', '#ffffff', 1024, 96) });
    boxAt([FZ.x0, 0, FZ.z0], [FZ.x1, FZ.floor, FZ.z1], faces(cabinetWhite, cabinetWhite, icy, cabinetWhite, cabinetWhite, cabinetWhite), { cast: true });
    boxAt([FZ.x0, 0.06, FZ.z0 - 0.01], [FZ.x1, 0.12, FZ.z1 + 0.01], darkFrame);
    const walls = [
      [[FZ.x0, FZ.floor, FZ.z0], [FZ.x0 + FZ.wall, FZ.rim, FZ.z1], faces(icy, band, cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite)],
      [[FZ.x1 - FZ.wall, FZ.floor, FZ.z0], [FZ.x1, FZ.rim, FZ.z1], faces(band, icy, cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite)],
      [[FZ.x0, FZ.floor, FZ.z0], [FZ.x1, FZ.rim, FZ.z0 + FZ.wall], faces(cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite, icy, cabinetWhite)],
      [[FZ.x0, FZ.floor, FZ.z1 - FZ.wall], [FZ.x1, FZ.rim, FZ.z1], faces(cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite, cabinetWhite, icy)],
    ];
    const snacks = stock.section();
    const snackHit = (point, strength, push) => {
      _out.set(point.x < (FZ.x0 + FZ.x1) / 2 ? -1 : 1, 0, 0);
      return stock.knock(snacks, point, _out, strength, push, { radius: Math.min(0.9, 0.3 + strength * 0.06) });
    };
    for (const [lo, hi, m] of walls) {
      boxAt(lo, hi, m, { cast: true });
      const b = solid(lo, hi, 'furniture');
      b.surface.mess = 'Kroketten everywhere!';
      b.surface.onHit = snackHit;
    }
    const bottom = solid([FZ.x0, 0, FZ.z0], [FZ.x1, FZ.floor, FZ.z1], 'furniture');
    bottom.surface.mess = 'Kroketten everywhere!';
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

  // ---------------------------------------------------------------- the Sinterklaas stand: pepernoten and chocolate letters
  {
    const red = std({ color: 0xc8102e, roughness: 0.8 });
    const sint = shelfUnit({
      axis: 'x', back: 35.3, dir: -1, u0: -1.1, u1: 0.1, depth: 0.45, h: 1.3, ys: [0.1, 0.5, 0.9],
      assortment: ASSORTMENT.SINT, mats: { frame: red, shelf: cabinetWhite, back: red }, mess: 'Pepernoten everywhere!',
    });
    const header = canvasTexture(512, 192, (g, w, h) => {
      g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h);
      // a mitre
      g.lineWidth = 5; g.strokeStyle = INK_SIGN;
      g.fillStyle = '#e8473b';
      g.beginPath(); g.moveTo(45, 175); g.lineTo(45, 95); g.quadraticCurveTo(45, 45, 95, 12); g.quadraticCurveTo(145, 45, 145, 95); g.lineTo(145, 175); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f6d04d'; g.fillRect(45, 150, 100, 22); g.strokeRect(45, 150, 100, 22);
      g.fillRect(87, 55, 16, 80); g.fillRect(68, 80, 54, 15);
      g.font = '900 52px "Arial Black", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffffff'; g.fillText('SINT', 330, 65);
      g.fillStyle = '#f6d04d'; g.font = '900 40px "Arial Black", "Trebuchet MS", sans-serif'; g.fillText('pepernoten!', 330, 135);
    });
    boxAt(...sint.box(-1.1, 1.3, 0, 0.1, 1.75, 0.04), sint.withFront(red, std({ map: header })), { cast: true });
  }

  // ---------------------------------------------------------------- tulips by the entrance, and the bottle return machine
  {
    const T = { x0: -8.7, x1: -6.3, z0: IN.z0 + 0.1, z1: IN.z0 + 0.85 };
    boxAt([T.x0, 0, T.z0], [T.x1, 0.25, T.z1], darkWood, { cast: true });
    boxAt([T.x0, 0.25, T.z0], [T.x1, 0.5, (T.z0 + T.z1) / 2], darkWood, { cast: true });
    boxAt([T.x0 + 0.6, 0.12, T.z1], [T.x1 - 0.6, 0.24, T.z1 + 0.01], std({ map: labelTexture('BLOEMEN', '#ffffff', '#3fae3a', 512, 112) }));
    const colours = [0xe2231a, 0xf6c21d, 0xf28cb1, 0xf59a23, 0xfbf5f0, 0x8e44ad, 0xe2231a, 0xf6c21d];
    const buckets = [];
    for (let i = 0; i < 8; i++) {
      const back = i >= 4;
      buckets.push([T.x0 + 0.3 + (i % 4) * 0.6, back ? 0.5 : 0.25, back ? T.z0 + 0.2 : T.z1 - 0.18, colours[i]]);
    }
    const bucketMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 14), std({ color: 0xa9b1b8, metalness: 0.5, roughness: 0.4 }), buckets.length);
    const perBucket = 14;
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.45, 4), std({ color: 0x3e8f3a }), buckets.length * perBucket);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 8, 6), std({ color: 0xffffff, roughness: 0.6 }), buckets.length * perBucket);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    let k = 0;
    buckets.forEach(([x, y0, z, c], i) => {
      bucketMesh.setMatrixAt(i, m4.makeTranslation(x, y0 + 0.14, z));
      for (let j = 0; j < perBucket; j++) {
        const a = j * 2.4;
        const r = 0.03 + (j % 4) * 0.025;
        e.set(Math.cos(a) * r * 1.6, 0, -Math.sin(a) * r * 1.6);
        q.setFromEuler(e);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const base = new THREE.Vector3(x + Math.sin(a) * r, y0 + 0.2, z + Math.cos(a) * r);
        stems.setMatrixAt(k, m4.compose(base.clone().addScaledVector(up, 0.225), q, new THREE.Vector3(1, 1, 1)));
        heads.setMatrixAt(k, m4.compose(base.clone().addScaledVector(up, 0.46), q, new THREE.Vector3(1, 1.4, 1)));
        heads.setColorAt(k, col.setHex(c));
        k++;
      }
    });
    for (const m of [bucketMesh, stems, heads]) add(m, { cast: true });
    solid([T.x0, 0, T.z0], [T.x1, 0.5, T.z1], 'furniture');
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
  const S = (id, label, value, say, min, max, when = null) => ({ id, label, value, say, min, max, when });
  const [freezerInside, fridgeInside] = [freezers.inside, fridges.inside];
  const spots = [
    ...freezers.doorways.map((d) => S('freezer', 'In the freezer!', 600, 'BRRR!', d.min, d.max, d.when)),
    ...fridges.doorways.map((d) => S('drinksfridge', 'In the drinks fridge!', 550, 'BRRR!', d.min, d.max, d.when)),
    S('fridges', 'On top of the drinks fridges!', 500, 'WHOA!', [fridgeInside[0][0] - 0.1, CAB.height - 0.05, fridgeInside[0][2]], [IN.x1, 3.0, fridgeInside[1][2]]),
    S('freezertop', 'On top of the freezers!', 500, 'WHOA!', [freezerInside[0][0], CAB.height - 0.05, freezerInside[0][2] - 0.1], [freezerInside[1][0], 3.0, IN.z1]),
    S('trolley', 'In the trolleys!', 400, 'WHEEE!', [0.15, 0.95, IN.z0 + 0.1], [1.8, 1.8, IN.z0 + 1.25]),
    S('fruit', 'In the fruit and veg!', 400, 'SQUISH!', [0.55, 0.7, IN.z0 + 1.95], [12.15, 1.5, IN.z0 + 3.65]),
    ...[-17, -13.5, -10].map((c) => S('checkout', 'Scanned at the checkout!', 500, 'BEEP!', [c - 0.45, 0.85, IN.z0 + 1.15], [c + 1.05, 1.6, IN.z0 + 3.85])),
    ...[-18, -13, -8, -3, 2, 7].map((cx) => S('shelves', 'On top of the shelves!', 500, 'HELP!', [cx - 0.6, 1.9, 36.1], [cx + 0.6, 2.8, 42.5])),
    S('fruit', 'In the fruit and veg!', 400, 'SQUISH!', [12.05, 0.6, VEG.u0], [IN.x1, 1.9, VEG.u1]),
    S('pastry', 'In the pastry case!', 600, 'TOMPOUCE!', ...caseF.box(CASE.u0, CASE.top - 0.1, 0, CASE.u1, CASE.glass + 0.5, CASE.depth + 0.1), () => pastryCase.broken),
    S('bread', 'In the bread baskets!', 400, 'FRESH!', [breadTable.x0 - 0.05, 0.7, breadTable.z0 - 0.05], [breadTable.x1 + 0.05, 1.5, breadTable.z1 + 0.05]),
    S('breadrack', 'On top of the bread rack!', 500, 'HELP!', ...breadRack.box(IN.z0 + 0.2, 2.4, 0, 35.4, 3.2, 0.65)),
    S('cheese', 'On top of the cheese!', 500, 'SAY CHEESE!', ...cheeseF.box(CH.u0, CH.roof - 0.05, 0, CH.u1, 3.0, CH.depth)),
    ...spotsExtra.map((a) => S(...a)),
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
  // the sliding doors, between the checkouts, the fruit crates and the aisles.
  const spawnPoint = () => ({ x: -4.5, z: 34.4, height: 0.05 });

  const api = { isInside, isOnRoof, spawnPoint, updateView, isFaded, spots, windows, breakPiece, repairAll, update };
  for (const piece of windows) piece.owner = api;
  return api;
}
