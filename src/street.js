import * as THREE from 'three';

// The rest of the terrace: a block of five houses, built like the photo it's
// based on (a 1970s Dutch row), with Lennie's house second from the left. The
// four neighbours have the same front layout, mirrored in pairs, and their own
// colour of panels. Their windows are boarded up with plywood, to show they
// aren't places to go. They're solid blocks: Lennie bounces off them and can land on their roofs, porches and
// dormers, but can't go inside. At the back the roof comes down to just above
// the ground floor, with a wide dormer, as on Lennie's own house. Also the
// shared details (porch, chimney, dormers, skylight, vents, solar panels,
// downpipe) that Lennie's own house uses too.
//
// Positions along a house are given as u (metres from its left end, seen from
// the street); a mirrored house flips them.

/**
 * kit: { box, body, convexBody, tiltedBody, addMesh, groups, M, std, tex, physMats, HOUSE, OUT, EXT, ROW, DORMER, BACK_DORMER }
 * from house.js; box(min, max, mats, { story, line, cast }) adds a mesh to
 * groups[story] (fading with `line`), addMesh(mesh, story, line) does the same
 * for any other mesh, body(min, max, material, surface) a static physics box,
 * convexBody(points, faces, surface) any convex one, and
 * tiltedBody(center, half, rotX, surface) a box lying on a roof slope.
 * Roof details take a `line` so Lennie's own chimney and vents fade with his roof.
 */
export function makeDetails(kit) {
  const { box, body, tiltedBody, addMesh, groups, M, std, physMats, HOUSE, OUT, DORMER, BACK_DORMER } = kit;
  // The front slope comes down to the front wall's top, the back one, steeper, to just above floor 2 (house.js).
  const pitch = (HOUSE.ridgeY - HOUSE.eaveY) / HOUSE.z1;
  const backPitch = (HOUSE.ridgeY - HOUSE.backEaveY) / HOUSE.z1;
  const pitchAt = (z) => (z < 0 ? backPitch : pitch);
  const angle = Math.atan(pitch);
  const backAngle = Math.atan(backPitch);
  const underside = (z) => HOUSE.ridgeY - pitchAt(z) * Math.abs(z);
  /** Height of the top of the roof tiles (0.18 thick) at depth z. */
  const roofTop = (z) => underside(z) + 0.18 * Math.hypot(1, pitchAt(z));
  const potMat = std({ color: 0x3a3534 });
  const capMat = std({ color: 0x8b8b8b });
  const frameGrey = std({ color: 0x9a9a9a, roughness: 0.5 });

  function cylinder(r, h, x, y, z, mat, story, line) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 12), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    addMesh(mesh, story, line);
  }

  /** Big brick chimney straddling the ridge, with two pots. It starts just under the roof. */
  function chimney(x0, x1, story, line = null) {
    const min = [x0, underside(0.7) - 0.05, -0.3];
    const max = [x1, HOUSE.ridgeY + 0.9, 0.7];
    box(min, max, M.brick, { story, cast: true, line });
    box([x0 - 0.06, max[1], min[2] - 0.06], [x1 + 0.06, max[1] + 0.12, max[2] + 0.06], capMat, { story, cast: true, line });
    body(min, [x1, max[1] + 0.12, max[2]], physMats.hard, { kind: 'roof' });
    for (const f of [0.3, 0.7]) cylinder(0.09, 0.45, x0 + (x1 - x0) * f, max[1] + 0.34, 0.2, potMat, story, line);
  }

  /** A little vent pipe poking through the tiles. */
  function vent(x, z, story, line = null) {
    cylinder(0.08, 0.5, x, roofTop(z) + 0.15, z, potMat, story, line);
  }

  /**
   * A neighbour's dormer: a solid white flat-roofed block with a window
   * boarded up with plywood, the same shape as the real one on Lennie's house (house.js).
   */
  function dormer(x0, x1, story, frame = M.trim) {
    const zf = DORMER.front + DORMER.wallT / 2;
    const D = { z0: DORMER.back, z1: zf, y0: underside(zf) - 0.3, y1: DORMER.top };
    box([x0, D.y0, D.z0], [x1, D.y1, D.z1], M.cladding, { story, cast: true });
    box([x0 - 0.15, D.y1, D.z0 - 0.15], [x1 + 0.15, D.y1 + 0.16, D.z1 + 0.15], [M.trim, M.trim, M.darkRoof, M.trim, M.trim, M.trim], { story, cast: true });
    const wy0 = underside(zf) + 0.45 - 0.07;
    const wy1 = D.y1 - 0.18;
    box([x0 + 0.25, wy0, D.z1], [x1 - 0.25, wy1, D.z1 + 0.03], frame, { story });
    // the board just clear of the frame's face, a strip of frame showing round it
    box([x0 + 0.3, wy0 + 0.05, D.z1 + 0.035], [x1 - 0.3, wy1 - 0.05, D.z1 + 0.055], M.plywood, { story });
    body([x0 - 0.15, D.y0, D.z0 - 0.15], [x1 + 0.15, D.y1 + 0.16, D.z1 + 0.15], physMats.hard, { kind: 'roof' });
  }

  /**
   * A neighbour's back dormer: a solid white flat-roofed block with a dark
   * edge, its windows (x ranges) boarded up, the same shape as the real one
   * on Lennie's house (house.js).
   */
  function backDormer(x0, x1, windows, story, frame = M.trim) {
    const B = BACK_DORMER;
    const zf = B.front - B.wallT / 2; // its front face (the back of the house is -z)
    const y0 = underside(zf) - 0.3;
    box([x0, y0, zf], [x1, B.top, B.back], M.cladding, { story, cast: true });
    M.dormerEdge ??= std({ color: 0x3b3d40, roughness: 0.6 });
    box([x0 - 0.15, B.top, zf - 0.15], [x1 + 0.15, B.top + 0.16, B.back], [M.dormerEdge, M.dormerEdge, M.darkRoof, M.trim, M.dormerEdge, M.dormerEdge], { story, cast: true });
    const [wy0, wy1] = [B.sill - 0.07, B.head + 0.07];
    for (const [a, b] of windows) {
      box([a - 0.07, wy0, zf - 0.03], [b + 0.07, wy1, zf], frame, { story });
      // the board just clear of the frame's face, a strip of frame showing round it
      box([a - 0.02, wy0 + 0.05, zf - 0.055], [b + 0.02, wy1 - 0.05, zf - 0.035], M.plywood, { story });
    }
    body([x0 - 0.15, y0, zf - 0.15], [x1 + 0.15, B.top + 0.16, B.back], physMats.hard, { kind: 'roof' });
  }

  // Solar panels, after the photo of the back: black, with a fine grid of
  // cells and a silver frame. One look for all of them; each panel is a thin
  // slab lying on the tiles, its top 10 cm above them.
  const PANEL = { w: 0.99, l: 1.68, t: 0.04, lift: 0.08 };
  let panelMats = null;
  function panelLook() {
    if (panelMats) return panelMats;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 216;
    const g = c.getContext('2d');
    g.fillStyle = '#c9ccd0'; // the aluminium frame
    g.fillRect(0, 0, 128, 216);
    g.fillStyle = '#0d1119'; // between the cells
    g.fillRect(4, 4, 120, 208);
    const [cols, rows] = [6, 10];
    const [cw, ch] = [120 / cols, 208 / rows];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = 4 + i * cw + 0.8;
        const y = 4 + j * ch + 0.8;
        const grad = g.createLinearGradient(x, y, x + cw, y + ch);
        grad.addColorStop(0, '#1d2840');
        grad.addColorStop(1, '#121a2c');
        g.fillStyle = grad;
        g.fillRect(x, y, cw - 1.6, ch - 1.6);
        g.fillStyle = 'rgba(150,165,190,0.25)'; // the thin busbars along each cell
        for (const f of [0.33, 0.66]) g.fillRect(x + (cw - 1.6) * f, y, 0.8, ch - 1.6);
      }
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const frame = std({ color: 0xbfc3c8, roughness: 0.4, metalness: 0.5 });
    panelMats = [frame, frame, std({ map, roughness: 0.25, metalness: 0.3 }), frame, frame, frame];
    return panelMats;
  }

  /**
   * Rows of solar panels on the back slope: each row { d, x } has its middle
   * d metres (in plan) behind the ridge and its panels' middles at x. One
   * physics slab per row, so Lennie lands on the panels rather than in them.
   */
  function solarPanels(rows, story, line = null) {
    const mats = panelLook();
    const n = new THREE.Vector3(0, Math.cos(backAngle), -Math.sin(backAngle)); // the slope's outward normal
    for (const { d, x } of rows) {
      const c = new THREE.Vector3(0, roofTop(-d), -d).addScaledVector(n, PANEL.lift);
      for (const px of x) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(PANEL.w, PANEL.t, PANEL.l), mats);
        mesh.position.set(px, c.y, c.z);
        mesh.rotation.x = -backAngle;
        addMesh(mesh, story, line);
      }
      // physics: from the tiles up to the panels' tops
      const [x0, x1] = [Math.min(...x) - PANEL.w / 2, Math.max(...x) + PANEL.w / 2];
      const h = PANEL.lift + PANEL.t / 2;
      const pc = new THREE.Vector3(0, roofTop(-d), -d).addScaledVector(n, h / 2);
      tiltedBody([(x0 + x1) / 2, pc.y, pc.z], [(x1 - x0) / 2, h / 2, PANEL.l / 2], -backAngle, { kind: 'roof', sound: 'metal' });
    }
  }

  /** A roof window in the back slope, from x0 to x1, its middle d metres (plan) behind the ridge: grey frame, dark glass (just its look). */
  function roofWindow(x0, x1, d, story, line = null) {
    const n = new THREE.Vector3(0, Math.cos(backAngle), -Math.sin(backAngle));
    const c = new THREE.Vector3((x0 + x1) / 2, roofTop(-d), -d);
    const glass = std({ color: 0x2a3644, roughness: 0.12, metalness: 0.4 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.14, 0.07, 1.14), frameGrey);
    frame.position.copy(c).addScaledVector(n, 0.02);
    frame.rotation.x = -backAngle;
    addMesh(frame, story, line);
    // its top 1 cm above the frame's, its edges 7 cm inside it
    const pane = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.04, 1.0), glass);
    pane.position.copy(c).addScaledVector(n, 0.045);
    pane.rotation.x = -backAngle;
    addMesh(pane, story, line);
  }

  /** A roof window lying in the front slope, boarded up with plywood like the neighbours' other windows. */
  function skylight(x0, x1, zc, story) {
    const depth = 1.0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.08, depth), [frameGrey, frameGrey, M.plywood, frameGrey, frameGrey, frameGrey]);
    mesh.position.set((x0 + x1) / 2, roofTop(zc) + 0.02, zc);
    mesh.rotation.x = angle;
    groups[story].add(mesh);
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.16, 0.06, depth + 0.16), frameGrey);
    frameMesh.position.copy(mesh.position).y -= 0.02;
    frameMesh.rotation.x = angle;
    groups[story].add(frameMesh);
  }

  /** Square downpipe down the front, from the gutter to `bottom`, in storey slices so it fades and cuts away with each storey's wall. */
  function downpipe(x, bottom, lineOf) {
    for (let k = 0; k < HOUSE.brickStories; k++) {
      const y0 = Math.max(bottom, k * HOUSE.H);
      const y1 = k === HOUSE.brickStories - 1 ? HOUSE.eaveY - 0.4 : (k + 1) * HOUSE.H;
      if (y1 <= y0) continue;
      const { story, line } = lineOf(k);
      box([x - 0.06, y0, OUT.z1], [x + 0.06, y1, OUT.z1 + 0.12], M.pipe, { story, line });
    }
  }

  /**
   * Flat canopy over the front door (fascia material `fascia`), optionally
   * over a neighbour's toilet, which sticks out of the front beside the door:
   * a solid brick block with the toilet's window (Lennie's own is a real room, house.js).
   */
  function porch({ x0, x1, toilet = null, fascia = M.trim }) {
    const c = { y0: PORCH_Y, y1: PORCH_TOP, z1: PORCH_FRONT };
    box([x0, c.y0, OUT.z1], [x1, c.y1, c.z1], [fascia, fascia, M.darkRoof, M.soffit, fascia, fascia], { story: 0, cast: true });
    // thicker downwards in physics, so a fast Lennie doesn't slip through it
    body([x0, c.y0 - 0.06, OUT.z1], [x1, c.y1, c.z1], physMats.hard, { kind: 'wall' });
    if (!toilet) return;
    const [t0, t1] = toilet;
    const zf = LAYOUT.toiletFront;
    box([t0, 0, OUT.z1], [t1, c.y0, zf], M.brick, { story: 0, cast: true });
    body([t0, 0, OUT.z1], [t1, c.y0, zf], physMats.hard, { kind: 'wall' });
    toiletWindow((t0 + t1) / 2, zf, 1);
  }

  // The toilet's window, as in the photo of the real house: two square concrete
  // breeze blocks set in the brick, one above the other, each with four
  // L-shaped holes in its corners and one in the middle. Dark holes seen from
  // the street; from inside the toilet (side -1) daylight shines through them.
  const BLOCK = 0.3; // each block is 30 cm square
  const blockMats = {};
  function blockMat(side) {
    if (blockMats[side]) return blockMats[side];
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#b3ada1';
    g.fillRect(0, 0, 128, 256);
    const hole = side > 0 ? '#15130f' : '#eef3f2';
    for (const y0 of [0, 128]) {
      g.strokeStyle = '#8a8478'; // the mortar joint around the block
      g.lineWidth = 5;
      g.strokeRect(2.5, y0 + 2.5, 123, 123);
      g.fillStyle = hole;
      const [m, arm, t] = [16, 36, 14]; // margin, length and thickness of the corner Ls
      for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const x = sx ? 128 - m - arm : m;
        const y = y0 + (sy ? 128 - m - arm : m);
        g.fillRect(x, sy ? y + arm - t : y, arm, t); // the L's flat stroke
        g.fillRect(sx ? x + arm - t : x, y, t, arm); // its upright stroke
      }
      g.fillRect(64 - 13, y0 + 64 - 19, 26, 38); // the hole in the middle, a bit taller than wide
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const look = side > 0 ? { roughness: 0.9 } : { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.25, roughness: 0.9 };
    blockMats[side] = std({ map, ...look, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    return blockMats[side];
  }

  /** The toilet's breeze-block window on a wall face at z, centred on x, facing +z (side 1) or -z (side -1). */
  function toiletWindow(x, z, side, line = null) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, 2 * BLOCK), blockMat(side));
    mesh.position.set(x, 1.25 + BLOCK, z + side * 0.004);
    if (side < 0) mesh.rotation.y = Math.PI;
    addMesh(mesh, 0, line);
  }

  /**
   * The house number on a little white plaque on the wall beside the front
   * door, at x, about shoulder height, as on the real house. Fades with `line`.
   */
  function houseNumber(n, x, line = null) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 104;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f1ec';
    g.fillRect(0, 0, 128, 104);
    g.strokeStyle = '#9c9a94';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 124, 100);
    g.fillStyle = '#1d2433';
    g.font = 'bold 72px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 64, 56);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const mat = std({ map, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.146), mat);
    mesh.position.set(x, 1.7, OUT.z1 + 0.006);
    addMesh(mesh, 0, line);
  }

  return { roofTop, angle, chimney, vent, dormer, backDormer, solarPanels, roofWindow, skylight, downpipe, porch, toiletWindow, houseNumber };
}

// The front door's canopy: its underside, which is also the top of the toilet's bump-out.
export const PORCH_Y = 2.26;
const PORCH_TOP = 2.55;
const PORCH_FRONT = 6.4; // z of the canopy's front edge

// House numbers along the row, by index (0 is Lennie's), as in the real street.
export const HOUSE_NUMBERS = { [-1]: 12, 0: 10, 1: 8, 2: 6, 3: 4 };

// Front layout of every house in the row, in u (see top). Lennie's house uses
// the same numbers (house.js), so the row lines up.
export const LAYOUT = {
  porch: [0, 3.75], // over the toilet's bump-out and the front door
  porchNoToilet: [1.3, 3.75],
  // The ground-floor toilet sticks out of the front beside the front door, in
  // the owner's floor plan: from the party wall to a little short of the
  // toilet's own wall (leaving some brick beside the door), out to
  // `toiletFront` (z), under the canopy.
  toilet: [0, 2.2],
  toiletFront: 6.2,
  door: [2.555, 3.555],
  number: 3.8, // the house number's plaque, on the wall just past the door's frame, away from the toilet
  column: [4.925, 7.125],
  small: [[0.375, 1.075], [1.675, 2.875]],
  pipe: 1.375,
  chimney: [1.3, 2.3],
  dormer: [4.725, 7.325],
  back: [[0.625, 1.725], [6.425, 7.525]],
  skylight: [5.1, 6.9], // the roof window of the house on Lennie's right, above its window column
  vents: [[3.35, 2.6], [4.3, 1.4], [2.7, -2.6]], // [u, z], clear of the chimney and the dormer
  // The back, after the photo of Lennie's: the roof comes down to just above
  // the ground floor, with a wide dormer over both back rooms of floor 2 (its
  // sides' outer faces), a window for each room, solar panels in rows above it
  // (each row: its middle's plan distance d behind the ridge, its panels'
  // middles u) and a roof window beside them. The house on Lennie's left has
  // panels too.
  backDormer: [0.375, 6.475],
  backWindows: [[0.725, 3.725], [4.225, 6.125]],
  panels: [
    { d: 3.154, u: [1.025, 2.035, 3.045, 4.055, 5.065, 6.075] },
    { d: 2.194, u: [4.025, 5.035, 6.045, 7.055] },
    { d: 1.234, u: [3.825, 4.835, 5.845] },
  ],
  neighbourPanels: [
    { d: 3.154, u: [2.035, 3.045, 4.055, 5.065] },
    { d: 2.194, u: [2.035, 3.045, 4.055] },
  ],
  roofWindow: [2.125, 2.825],
  roofWindowD: 2.2,
};

const STYLES = {
  // index along the row (0 is Lennie's house, the second from the left), mirrored
  // in pairs like the photo: Lennie's window column sits next to its right-hand
  // neighbour's, and its small windows next to its left-hand neighbour's.
  [-1]: { mirror: true, panel: 0x2f3238, frame: 0xfbfaf6, door: 0x3a3735, roof: ['chimney', 'vents', 'panels'] },
  [1]: { mirror: true, panel: 0x2e3a54, frame: 0xfbfaf6, door: 0x6b4a33, noToilet: true, roof: ['chimney', 'skylight', 'vents'] },
  [2]: { mirror: false, panel: 0xc8372d, frame: 0xc8372d, door: 0x2f2b29, roof: ['dormer', 'vents'] },
  [3]: { mirror: true, panel: 0xeceae3, frame: 0xfbfaf6, door: 0x2d2b2a, roof: ['dormer'] },
};

export function buildNeighbours(kit, details) {
  const { box, convexBody, groups, M, std, tex, HOUSE, OUT, EXT, ROW } = kit;
  const { H } = HOUSE;
  // A neighbour's solid block, seen from the side: up to the front wall's top,
  // and at the back cut along the roof's underside down to the knee wall (house.js).
  const backPitch = (HOUSE.ridgeY - HOUSE.backEaveY) / HOUSE.z1;
  const BLOCK = [[OUT.z0, 0], [OUT.z1, 0], [OUT.z1, HOUSE.eaveY], [-(HOUSE.ridgeY - HOUSE.eaveY) / backPitch, HOUSE.eaveY], [OUT.z0, HOUSE.ridgeY + backPitch * OUT.z0]];
  const plaster = std({ color: 0xd8d1c4 });
  const concrete = std({ color: 0xb9b4ab });

  for (const [key, style] of Object.entries(STYLES)) {
    const i = Number(key);
    const x0 = OUT.x0 + i * ROW.width;
    const x1 = x0 + ROW.width;
    // u → x for this house, and a [u0, u1] span → sorted [x0, x1]
    const X = (u) => (style.mirror ? x1 - u : x0 + u);
    const span = ([u0, u1]) => [X(u0), X(u1)].sort((a, b) => a - b);
    const front = `row${i}-front`;
    const back = `row${i}-back`;
    const frameMat = std({ color: style.frame, roughness: 0.6 });
    const panelMat = std({ map: tex.grooves, color: style.panel, roughness: 0.6 });
    const doorMat = std({ color: style.door, roughness: 0.5 });

    // ---- shell: a brick front with the white band under the eaves, and a
    // brick back up to the knee wall's top, where the roof comes down over it
    // (the row's two end walls go up with the roof, house.js)
    const z = [OUT.z1 - EXT, OUT.z1];
    box([x0, 0, z[0]], [x1, HOUSE.eaveY - 0.4, z[1]], [M.brick, M.brick, M.trim, M.trim, M.brick, plaster], { story: 0, line: front });
    box([x0, HOUSE.eaveY - 0.4, z[0]], [x1, HOUSE.eaveY, z[1]], M.trim, { story: 0, line: front });
    box([x0, 0, OUT.z0], [x1, HOUSE.kneeY, OUT.z0 + EXT], [M.brick, M.brick, M.trim, M.trim, plaster, M.brick], { story: 0, line: back });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROW.width, OUT.z1 - OUT.z0), concrete);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((x0 + x1) / 2, 0.01, 0);
    groups[0].add(floor);
    // a solid block for Lennie to bounce off (the camera may still go inside)
    convexBody([...BLOCK.map(([bz, y]) => [x0, y, bz]), ...BLOCK.map(([bz, y]) => [x1, y, bz])], [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], ...BLOCK.map((_, j) => [j, (j + 1) % 5, 5 + ((j + 1) % 5), 5 + j])], { kind: 'block' });

    // ---- windows, door and panels (decoration on the facades)
    // Every window is boarded up with plywood, so it's plain you can't go in:
    // the board covers the glass and sits on the frame, a strip of frame showing round it.
    const window_ = ({ x: [a, b], y: [ya, yb], side = 1, line }) => {
      const zf = side > 0 ? OUT.z1 : OUT.z0;
      const Z = (d0, d1) => (side > 0 ? [zf + d0, zf + d1] : [zf - d1, zf - d0]);
      const opts = { story: 0, line };
      let z = Z(-0.01, 0.04);
      box([a - 0.07, ya - 0.05, z[0]], [b + 0.07, yb + 0.07, z[1]], frameMat, opts);
      z = Z(0.045, 0.065); // just clear of the frame's face, not in one plane with it
      box([a - 0.03, ya - 0.02, z[0]], [b + 0.03, yb + 0.03, z[1]], M.plywood, opts);
      z = Z(-0.01, 0.13);
      box([a - 0.1, ya - 0.1, z[0]], [b + 0.1, ya - 0.05, z[1]], M.trim, opts);
    };

    const col = span(LAYOUT.column);
    for (let k = 0; k < HOUSE.brickStories; k++) {
      const y0 = k * H;
      window_({ x: col, y: k === 0 ? [y0 + 0.9, y0 + 2.2] : [y0 + 0.6, y0 + 2.5], line: front });
      if (k < HOUSE.brickStories - 1) {
        const yb = y0 + 2.27;
        const yt = y0 + H + 0.5; // up to the sill above, not into it (their tops flickered)
        box([col[0], yb, OUT.z1 - 0.01], [col[1], yt, OUT.z1 + 0.03], panelMat, { story: 0, line: front });
        box([col[0] - 0.07, yb, OUT.z1 - 0.01], [col[0], yt, OUT.z1 + 0.05], frameMat, { story: 0, line: front });
        box([col[1], yb, OUT.z1 - 0.01], [col[1] + 0.07, yt, OUT.z1 + 0.05], frameMat, { story: 0, line: front });
      }
      if (k > 0) for (const s of LAYOUT.small) window_({ x: span(s), y: [y0 + 1.45, y0 + 2.25], line: front });
      if (k === 0) for (const s of LAYOUT.back) window_({ x: span(s), y: [y0 + 0.9, y0 + 2.2], side: -1, line: back }); // (floor 2's are in the back dormer)
    }
    // front door: dark, with a white frame, its tall glass panel boarded up too
    const [d0, d1] = span(LAYOUT.door);
    box([d0 - 0.07, 0, OUT.z1 - 0.01], [d1 + 0.07, 2.22, OUT.z1 + 0.05], M.trim, { story: 0, line: front });
    box([d0, 0, OUT.z1 + 0.05], [d1, 2.15, OUT.z1 + 0.07], doorMat, { story: 0, line: front });
    box([d0 + 0.12, 0.93, OUT.z1 + 0.075], [d1 - 0.12, 2.01, OUT.z1 + 0.095], M.plywood, { story: 0, line: front });

    details.downpipe(X(LAYOUT.pipe), 2.55, () => ({ story: 0, line: front }));
    // the house on Lennie's right has no toilet sticking out in the photo
    const [p0, p1] = span(style.noToilet ? LAYOUT.porchNoToilet : LAYOUT.porch);
    details.porch({ x0: p0, x1: p1, toilet: style.noToilet ? null : span(LAYOUT.toilet) });
    details.houseNumber(HOUSE_NUMBERS[i], X(LAYOUT.number), front);

    // ---- roof details: every house has the back dormer, like Lennie's
    details.backDormer(...span(LAYOUT.backDormer), LAYOUT.backWindows.map(span), 0, frameMat);
    const panels = style.roof.includes('panels');
    for (const what of style.roof) {
      if (what === 'chimney') details.chimney(...span(LAYOUT.chimney), 0);
      if (what === 'dormer') details.dormer(...span(LAYOUT.dormer), 0, frameMat);
      if (what === 'skylight') details.skylight(...span(LAYOUT.skylight), 2.6, 0);
      if (what === 'vents') for (const [u, z] of LAYOUT.vents) if (!(panels && z < 0)) details.vent(X(u), z, 0); // (not through the panels)
      if (what === 'panels') details.solarPanels(LAYOUT.neighbourPanels.map(({ d, u }) => ({ d, x: u.map(X) })), 0);
    }
  }
}
