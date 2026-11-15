import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { textures, meterBoxUVs, floorGeometry } from './textures.js';
import { makeDetails, buildNeighbours, LAYOUT, PORCH_Y } from './street.js';
import { buildClutter } from './clutter.js';
import { buildTV } from './tv.js';
import { hangDrawings } from './drawings.js';
import { createLoose } from './loose.js';

// A Dutch terraced house: two brick storeys and an attic under a steep roof,
// with a dormer. Footprint x ∈ [-6, 6], z ∈ [-5, 5]; the front door faces +z.
// The ground floor follows the owner's floor plan (GF below, and
// docs/house-design.md), with a utility room built on at the back. Floor 2
// and the attic: a landing along the back with the stairs up, and two rooms
// at the front split by a wall at x = 1. It's the second house in a block of
// five; the neighbours (solid, no rooms; see street.js) share one long roof.
export const HOUSE = { x0: -6, x1: 6, z0: -5, z1: 5, H: 3, T: 0.4, stories: 3, brickStories: 2, eaveY: 6, ridgeY: 11 };
// The roof's underside runs from the wall tops (eaveY at z = ±5) up to the ridge.
const PITCH = (HOUSE.ridgeY - HOUSE.eaveY) / HOUSE.z1;
const underside = (z) => HOUSE.ridgeY - PITCH * Math.abs(z);

const { H, T } = HOUSE;
const EXT = 0.25; // exterior wall thickness (visual)
const EXT_PHYS = 0.6; // physics walls are thicker (extending outwards) so fast throws don't tunnel
const INT = 0.18;
const INT_PHYS = 0.3;
const IN = { x0: -5.875, x1: 5.875, z0: -4.875, z1: 4.875 }; // inner wall faces
const OUT = { x0: -6.125, x1: 6.125, z0: -5.125, z1: 5.125 }; // outer wall faces
const HALL_Z = -2.4; // wall between the hallway (back) and the rooms (front)
const MID_X = 1; // wall between the left and right rooms
const WIN = { sill: 0.9, top: 2.2 };
// The dormer on the front slope, above the window column: a real bit of the
// attic (the bathroom), with a window Lennie can be thrown out of. Its left
// side is the attic's middle wall; `back` is where its flat roof meets the
// roof's underside, `front` the middle of its front wall.
export const DORMER = { x0: 1.0, x1: 4.7, back: HOUSE.ridgeY - 8.4, front: 4.0, top: 8.4, wallT: 0.2 };
const DOOR_TOP = 2.15;
const DOOR_COLORS = { inside: 0xf4f2ee, front: 0x3b3735 }; // the inside doors are white
const FADED = 0.12;

// The ground floor follows the owner's sketch (docs/floorplan-floor1.png),
// stretched to the house's width: the toilet in the front left corner, the
// hallway beside it with the stairs going up along the left wall and the coat
// rack, the storage cupboard under the stairs, the kitchen at the front right,
// and the living room all across the back. These are the walls' centre lines.
const GF = {
  toiletZ: 3.05, // between the toilet and the hallway
  toiletX: -3.4, // the toilet's and the storage cupboard's right-hand walls
  hallX: -0.9, // between the hallway and the kitchen
  hallZ: 1.1, // the back of the hallway, with the door to the living room
  stairX: -4.56, // beside the stairs (the storage cupboard's left wall, and on floor 2 the corridor's wall)
  storeZ: -0.7, // the back of the storage cupboard, where the stairs reach floor 2
};
// The utility room: a little flat-roofed extension behind the kitchen side,
// between the house and the garage (walls' centre lines; z1 is the house's back wall).
export const UTILITY = { x0: 1.43, x1: 6, z0: -6.7, z1: -5, top: 2.6 };
// The garage behind it, after the sketch: the same width, its door near the
// utility room in the side facing the garden (walls' centre lines; z1 is the
// utility room's back wall). Lennie can be thrown in through the open door.
export const GARAGE = { x0: UTILITY.x0, x1: UTILITY.x1, z0: -9.675, z1: UTILITY.z0, top: 2.6, door: [-7.92, -6.97] };

// Stairs: flight A climbs storey 0→1 along −z against the left party wall,
// from the hallway over the storage cupboard; flight B climbs 1→2 along −x in
// the landing at the back.
const STAIR = { steps: 12, rise: 0.25, run: 0.3, xLow: -1.8, xHigh: 1.8, stripB: [-3.7, HALL_Z - INT / 2], a: { x0: IN.x0, x1: -4.65, zLow: 2.9 } };
STAIR.a.zHigh = STAIR.a.zLow - STAIR.steps * STAIR.run;
const HOLES = {
  1: { x0: STAIR.a.x0, x1: STAIR.a.x1, z0: STAIR.a.zHigh, z1: STAIR.a.zLow },
  2: { x0: STAIR.xLow, x1: STAIR.xHigh, z0: STAIR.stripB[0], z1: STAIR.stripB[1] },
};

// White painted walls (no wallpaper) for the living room, the kitchen, the
// toilet, the bedrooms and the attic.
const WHITE_PAINT = { wall: 0xfbfbf8, wallTex: 'paint' };
const ROOMS = [
  {
    hall: { name: 'Hallway', wall: 0xeadfc8, floor: 'wood' },
    left: { name: 'Living room', floor: 'wood', ...WHITE_PAINT },
    right: { name: 'Kitchen', floor: 'tiles', floorTint: 0xf1ece2, ...WHITE_PAINT },
    toilet: { name: 'Toilet', floor: 'tiles', floorTint: 0xd9d4cc, ...WHITE_PAINT }, // white walls, tiles only on the floor
    storage: { name: 'Storage cupboard', wall: 0xeadfc8, floor: 'wood' },
    utility: { name: 'Utility room', wall: 0xe4ece6, floor: 'tiles', floorTint: 0xc9c2b6, wallTex: 'tiles' },
    garage: { name: 'Garage', wall: 0xd6d2c9, wallTex: 'paint', floor: 'stone', floorTint: 0x9d9a94 },
  },
  {
    hall: { name: 'Landing', wall: 0xeadfc8, floor: 'wood' },
    left: { name: 'Bedroom', floor: 'wood', ...WHITE_PAINT },
    right: { name: 'Kids room', floor: 'carpet', floorTint: 0x9fcf9a, ...WHITE_PAINT },
  },
  {
    hall: { name: 'Attic landing', floor: 'wood', ...WHITE_PAINT },
    left: { name: 'Attic study', floor: 'wood', ...WHITE_PAINT },
    right: { name: 'Attic bathroom', wall: 0xf3f6f8, floor: 'tiles', floorTint: 0xcfe6f0, wallTex: 'tiles' },
  },
];

/** The room of storey k that (x, z) is in. */
function roomOf(k, x, z) {
  const R = ROOMS[k];
  if (k === 0) {
    if (z < UTILITY.z0) return R.garage;
    if (z < IN.z0) return R.utility;
    if (z > GF.hallZ) return x > GF.hallX ? R.right : x < GF.toiletX && z > GF.toiletZ ? R.toilet : R.hall;
    if (z > GF.storeZ && x < GF.toiletX) return x < GF.stairX ? R.hall : R.storage;
    return R.left;
  }
  if (z < HALL_Z || (k === 1 && x < GF.stairX)) return R.hall; // on floor 2 the corridor from the stairs is part of the landing
  return x < MID_X ? R.left : R.right;
}

// The front follows a 1970s Dutch terraced house: porch and front door on the
// left, a tall window column right of centre (one window per storey, dark
// panels between them) and small high windows top left. Openings are [a, b]
// along the wall plus optional sill/top heights and glazing bars (fractions).
// The side walls are party walls with the neighbours, so they have no windows.
const COLUMN = [1.2, 4.5];
// The low windows (the bedroom's small high ones and the dormer's) look as
// small as the real ones, but give Lennie some slack to get through (see `wall`).
const SLACK = { side: 0.15, below: 0.35, above: 0.2 };
// A doorway gets a little too: a tumbling Lennie's arms and legs snagged on its frame.
const DOOR_SLACK = { side: 0.12, below: 0, above: 0.15 };
const SMALL = { sill: 1.45, top: 2.25, bars: { v: [], h: [] }, slack: SLACK };
const KITCHEN_SILL = 0.905;
const FRONT = [
  // the kitchen's window in the column (the toilet's is in its bump-out, see TOILET_OUT)
  // (the kitchen's sill is 5 mm above the 0.9 m worktop it reaches over, not level with it: that flickered)
  [{ a: COLUMN[0], b: COLUMN[1], sill: KITCHEN_SILL, bars: { v: [1 / 3, 2 / 3], h: [0.7] } }],
  // the first small one lights the corridor from the stairs, clear of its wall
  [{ a: -5.65, b: -4.8, ...SMALL }, { a: -4.0, b: -2.6, ...SMALL }, { a: COLUMN[0], b: COLUMN[1], sill: 0.6, top: 2.5, bars: { v: [0.32], h: [] } }],
];
const BACK = [{ a: -5.2, b: -3.8 }, { a: 3.6, b: 5.0 }];
// The living room's back wall: one big window frame onto the garden, a wide
// pane with a side window on its right, and the door to the utility room.
// The convector heating trench runs in the floor under it.
const BACK_GROUND = [{ a: -4.75, b: 0.95, sill: 0.55, bars: { v: [0.84], h: [] } }];
const UTILITY_DOOR = [1.7, 2.8];
const FRONT_DOOR = [-2.2, -1.1];
// The toilet sticks out of the front, as in the floor plan: a little brick
// bump-out beside the front door, under the canopy, from the party wall to just
// past the toilet's own wall (outer faces; the shared layout is in street.js).
const TOILET_OUT = { x0: -6.125 + LAYOUT.toilet[0], x1: -6.125 + LAYOUT.toilet[1], z1: LAYOUT.toiletFront, top: PORCH_Y };
// The row: a block of five, Lennie's house second from the left, so one
// neighbour on the left and three on the right. x0 / x1 are the row's two ends.
export const ROW = { width: 12.25, left: 1, right: 3 };
ROW.x0 = -6.125 - ROW.left * ROW.width;
ROW.x1 = 6.125 + ROW.right * ROW.width;

/** The convector trench's grille: wooden slats across it, 3 per 10 cm, over the dark trench. */
function grilleTexture(length) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1c1916';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 3; i++) {
    const x = Math.round((i * 64) / 3);
    g.fillStyle = ['#b98b5c', '#c39668', '#b08353'][i];
    g.fillRect(x + 2, 0, 17, 64);
    g.fillStyle = 'rgba(90,60,30,0.35)'; // a bit of grain
    for (let y = 3; y < 64; y += 11) g.fillRect(x + 4 + ((y * 7) % 11), y, 1, 6);
    g.fillStyle = 'rgba(255,240,215,0.25)';
    g.fillRect(x + 2, 0, 2, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(length / 0.1, 1);
  t.anisotropy = 8;
  return t;
}

export function buildHouse(scene, world, physMats) {
  const tex = textures();
  const groups = [0, 1, 2, 3].map(() => {
    const g = new THREE.Group();
    scene.add(g);
    return g;
  });
  const lines = new Map();
  const matLine = new Map(); // faded material clone → its line
  const windows = [];
  const doors = [];
  const stairBodies = [];

  // ------------------------------------------------------------ materials
  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...opts });
  const M = {
    brick: std({ map: tex.brick }),
    brickLight: std({ map: tex.brickLight }),
    canopy: std({ color: 0x2c2522, roughness: 0.7 }),
    pipe: std({ color: 0x4a4644, roughness: 0.5 }),
    spandrel: std({ map: tex.grooves, color: 0x3a4566, roughness: 0.6 }),
    glassSky: std({ map: tex.glassSky, roughness: 0.15 }),
    glassWarm: std({ map: tex.glassWarm, roughness: 0.3 }),
    cladding: std({ color: 0xf1eee6, roughness: 0.7 }),
    darkRoof: std({ color: 0x35302e, roughness: 0.8 }),
    trim: std({ color: 0xfbfaf6, roughness: 0.6 }),
    // Ceilings: a warm off-white, just set apart from the white walls. They face down,
    // where only the lawn's greenish bounce light reaches, so a glow of their own keeps them light.
    ceiling: std({ color: 0xf3efe6, emissive: 0xa8a398 }),
    wood: std({ map: tex.wood, roughness: 0.6 }),
    stairSide: std({ color: 0xf3efe6 }),
    roofTiles: std({ map: tex.pantiles, roughness: 0.8 }),
    soffit: std({ color: 0xe9e4da }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }),
    door: std({ color: DOOR_COLORS.inside, roughness: 0.55 }),
    doorPanel: std({ color: 0xe4e1da, roughness: 0.55 }),
    frontDoor: std({ color: DOOR_COLORS.front, roughness: 0.5 }),
    frontDoorPanel: std({ color: 0x2a2725, roughness: 0.5 }),
    frontDoorGlass: std({ color: 0xa9d3ea, roughness: 0.15 }),
    handle: std({ color: 0xc9a74a, roughness: 0.3, metalness: 0.8 }),
  };
  const wallpaperCache = new Map();
  const wallpaper = (room) => {
    const key = `${room.wall}-${room.wallTex ?? 'paper'}`;
    if (!wallpaperCache.has(key)) {
      // 'paint' is a plain painted wall, without the wallpaper's stripes
      const map = room.wallTex === 'paint' ? null : room.wallTex === 'tiles' ? tex.tiles : tex.wallpaper;
      wallpaperCache.set(key, std({ map, color: room.wall }));
    }
    return wallpaperCache.get(key);
  };
  const floorMat = (room) => std({ map: tex[room.floor], color: room.floorTint ?? 0xffffff, roughness: room.floor === 'tiles' ? 0.4 : 0.7 });
  // The ground floor's laminate runs from the front to the back; the other floors' boards run across.
  const turnedFloor = (k, room) => k === 0 && room.floor === 'wood';

  // Each "line" (one wall of one storey, one slab...) fades as a unit when it
  // blocks the view, so its meshes get their own material clones.
  function lineMat(line, mat) {
    const entry = lines.get(line);
    let clone = entry.cache.get(mat);
    if (!clone) {
      clone = mat.clone();
      clone.transparent = true;
      entry.cache.set(mat, clone);
      entry.mats.add(clone);
      matLine.set(clone, entry);
    }
    return clone;
  }

  // `plane` ({ p, n }) is for a line that isn't axis-aligned (a roof slope).
  function registerLine(line, story, plane = null) {
    if (!lines.has(line)) {
      lines.set(line, { story, plane, meshes: [], mats: new Set(), cache: new Map(), opacity: 1, target: 1, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    }
  }

  function addToLine(mesh, line, min, max) {
    const entry = lines.get(line);
    entry.meshes.push(mesh);
    for (let i = 0; i < 3; i++) {
      entry.min[i] = Math.min(entry.min[i], min[i]);
      entry.max[i] = Math.max(entry.max[i], max[i]);
    }
  }

  // ------------------------------------------------------------ primitives
  function box(min, max, mats, { story, line = null, cast = false }) {
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const geo = new THREE.BoxGeometry(...size);
    meterBoxUVs(geo, min, max);
    let material = mats;
    if (line) {
      registerLine(line, story);
      material = Array.isArray(mats) ? mats.map((m) => lineMat(line, m)) : lineMat(line, mats);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    groups[story].add(mesh);
    if (line) addToLine(mesh, line, min, max);
    return mesh;
  }

  /** Adds any mesh to a storey group, fading with `line` (if given) by its bounding box. */
  function addMesh(mesh, story, line = null) {
    groups[story].add(mesh);
    if (!line) return mesh;
    registerLine(line, story);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => lineMat(line, m)) : lineMat(line, mesh.material);
    mesh.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(mesh);
    addToLine(mesh, line, bb.min.toArray(), bb.max.toArray());
    return mesh;
  }

  /** Static convex physics body from world-space points and faces (any winding). */
  function convexBody(points, faces, surface) {
    const c = [0, 1, 2].map((i) => points.reduce((sum, p) => sum + p[i], 0) / points.length);
    const verts = points.map((p) => new CANNON.Vec3(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    const oriented = faces.map((f) => {
      const [a, b, d] = f.map((i) => verts[i]);
      const n = b.vsub(a).cross(d.vsub(a));
      const mid = f.reduce((sum, i) => sum.vadd(verts[i]), new CANNON.Vec3()).scale(1 / f.length);
      return n.dot(mid) < 0 ? [...f].reverse() : f; // normals point away from the centre
    });
    const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.ConvexPolyhedron({ vertices: verts, faces: oriented }) });
    b.position.set(...c);
    b.surface = surface;
    world.addBody(b);
    return b;
  }

  /**
   * A wall with a non-rectangular outline: the attic walls under the sloping
   * roof. `poly` is a convex outline as [along, y] points; mats.pos / mats.neg
   * face along +normal / -normal. Physics is one convex prism.
   */
  function prismWall({ run, at, poly, thick, physThick = thick, physOffset = 0, mats, story, line }) {
    registerLine(line, story);
    const shape = new THREE.Shape(poly.map(([a, y]) => new THREE.Vector2(a, y)));
    const d = thick / 2;
    for (const [side, mat] of [[1, mats.pos], [-1, mats.neg]]) {
      // Extruded along local +z, one half-thickness each so the two faces can differ.
      // Walls across z turn so local x runs along z; that turn sends local z to -x.
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
      const flip = run === 'z' ? -side : side;
      geo.translate(0, 0, flip > 0 ? 0 : -d);
      if (run === 'z') geo.rotateY(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, [lineMat(line, mat), lineMat(line, M.trim)]);
      if (run === 'x') mesh.position.z = at;
      else mesh.position.x = at;
      mesh.receiveShadow = true;
      groups[story].add(mesh);
      const as = poly.map((p) => p[0]);
      const ys = poly.map((p) => p[1]);
      const lo = [Math.min(...as), Math.min(...ys), at - d];
      const hi = [Math.max(...as), Math.max(...ys), at + d];
      addToLine(mesh, line, run === 'x' ? lo : [lo[2], lo[1], lo[0]], run === 'x' ? hi : [hi[2], hi[1], hi[0]]);
    }
    const n0 = at + physOffset - physThick / 2;
    const n1 = at + physOffset + physThick / 2;
    const P = (a, y, n) => (run === 'x' ? [a, y, n] : [n, y, a]);
    const m = poly.length;
    const points = [...poly.map(([a, y]) => P(a, y, n0)), ...poly.map(([a, y]) => P(a, y, n1))];
    const faces = [[...Array(m).keys()], [...Array(m).keys()].map((i) => m + i)];
    for (let i = 0; i < m; i++) faces.push([i, (i + 1) % m, m + ((i + 1) % m), m + i]);
    convexBody(points, faces, { kind: 'wall' });
  }

  function body(min, max, material, surface) {
    const half = new CANNON.Vec3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2);
    const b = new CANNON.Body({ mass: 0, material, shape: new CANNON.Box(half) });
    b.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    b.surface = surface;
    world.addBody(b);
    return b;
  }

  // Wall slab across `run` ('x' or 'z') at `at` on the other axis.
  function extents(run, at, a, b, y0, y1, thick, offset = 0) {
    const c = at + offset;
    return run === 'x'
      ? [[a, y0, c - thick / 2], [b, y1, c + thick / 2]]
      : [[c - thick / 2, y0, a], [c + thick / 2, y1, b]];
  }

  /**
   * One wall with rectangular openings. mats.pos / mats.neg are the materials
   * of the faces pointing along +normal / −normal (or functions of the
   * position along the wall returning one).
   */
  // `splits` are spots along the wall where its look changes (from one room to the next).
  function wall({ run, at, from, to, y0, y1, thick, physThick, physOffset = 0, openings = [], splits = [], mats, story, line, outward = 0 }) {
    const ops = [...openings].sort((p, q) => p.a - q.a);
    const piecesAround = (holes) => {
      const pieces = [];
      let cur = from;
      for (const o of holes) {
        if (o.a > cur) pieces.push([cur, o.a, y0, y1]);
        if (o.bottom > y0) pieces.push([o.a, o.b, y0, o.bottom]);
        if (o.top < y1) pieces.push([o.a, o.b, o.top, y1]);
        cur = o.b;
      }
      if (cur < to) pieces.push([cur, to, y0, y1]);
      return pieces;
    };
    // An opening with `slack` has a bigger hole in the physics than you see: its
    // glass or door reaches into the frame around it, so once that's smashed a
    // flailing Lennie fits through instead of snagging on it.
    const physHole = (o) => (o.slack ? {
      ...o,
      a: Math.max(from, o.a - o.slack.side),
      b: Math.min(to, o.b + o.slack.side),
      bottom: Math.max(y0, o.bottom - o.slack.below),
      top: Math.min(y1, o.top + o.slack.above),
    } : o);

    const pick = (m, along) => (typeof m === 'function' ? m(along) : m);
    const cut = (pieces) => pieces.flatMap(([a, b, ya, yb]) => {
      const at_ = [a, ...splits.filter((s) => s > a && s < b).sort((p, q) => p - q), b];
      return at_.slice(1).map((e, i) => [at_[i], e, ya, yb]);
    });
    for (const [a, b, ya, yb] of cut(piecesAround(ops))) {
      const mid = (a + b) / 2;
      const pos = pick(mats.pos, mid);
      const neg = pick(mats.neg, mid);
      // Outside corners show the facade material instead of white trim.
      const endHi = mats.ends && b === to ? mats.ends : M.trim;
      const endLo = mats.ends && a === from ? mats.ends : M.trim;
      // (a box's faces go +x, −x, +y, −y, +z, −z; the `b` end is the + side either way)
      const faceMats = run === 'x' ? [endHi, endLo, M.trim, M.trim, pos, neg] : [pos, neg, M.trim, M.trim, endHi, endLo];
      const [min, max] = extents(run, at, a, b, ya, yb, thick);
      box(min, max, faceMats, { story, line });
    }
    for (const [a, b, ya, yb] of piecesAround(ops.map(physHole))) {
      const [pmin, pmax] = extents(run, at, a, b, ya, yb, physThick, physOffset);
      body(pmin, pmax, physMats.hard, { kind: 'wall' });
    }

    for (const o of ops) {
      if (o.open) continue; // just a gap: no frame, glass or door
      const t = thick + 0.05;
      const w = 0.07;
      const trimBox = (a, b, ya, yb, depth = t) => {
        const [min, max] = extents(run, at, a, b, ya, yb, depth);
        box(min, max, M.trim, { story, line });
      };
      trimBox(o.a - w, o.a, o.bottom, o.top + w);
      trimBox(o.b, o.b + w, o.bottom, o.top + w);
      trimBox(o.a - w, o.b + w, o.top, o.top + w);
      if (o.glass) {
        trimBox(o.a - 0.1, o.b + 0.1, o.bottom - 0.05, o.bottom, thick + 0.12);
        addWindow(run, at, o, physHole(o), physThick, physOffset, story, outward, line);
      } else {
        addDoor(run, at, o, physThick, physOffset, story, line, physHole(o));
      }
    }
  }

  // A closed door filling the opening. A hard hit breaks it at once; a softer
  // one cracks it, and the next knock finishes it off (see main.js).
  function addDoor(run, at, o, physThick, physOffset, story, line, hole = o) {
    const midA = (o.a + o.b) / 2;
    const midY = (o.bottom + o.top) / 2;
    const [cmin, cmax] = extents(run, at, midA, midA, midY, midY, 0);
    const center = new THREE.Vector3(...cmin);
    const group = new THREE.Group();
    group.position.copy(center);
    const part = (a, b, ya, yb, depth, mat) => {
      const [min, max] = extents(run, at, a, b, ya, yb, depth);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), lineMat(line, mat));
      mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2).sub(center);
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    const slab = o.front ? M.frontDoor : M.door;
    const panel = o.front ? M.frontDoorPanel : M.doorPanel;
    if (o.glazed) {
      // a glass door: two see-through panes, one above and one below the middle rail
      const [ga, gb] = [o.a + 0.14, o.b - 0.14];
      const panes = [[o.bottom + 0.18, o.bottom + 0.9], [o.bottom + 1.08, o.top - 0.16]];
      part(o.a + 0.01, ga, o.bottom + 0.01, o.top - 0.01, 0.06, slab); // the stiles
      part(gb, o.b - 0.01, o.bottom + 0.01, o.top - 0.01, 0.06, slab);
      part(ga, gb, o.bottom + 0.01, panes[0][0], 0.06, slab); // the rails
      part(ga, gb, panes[0][1], panes[1][0], 0.06, slab);
      part(ga, gb, panes[1][1], o.top - 0.01, 0.06, slab);
      for (const [gy0, gy1] of panes) {
        // glazing beads around the pane
        for (const [a, b, ya, yb] of [[ga, gb, gy0, gy0 + 0.025], [ga, gb, gy1 - 0.025, gy1], [ga, ga + 0.025, gy0, gy1], [gb - 0.025, gb, gy0, gy1]]) part(a, b, ya, yb, 0.075, panel);
        // 2 mm inside the beads, so the pane's edges don't lie in one plane with theirs
        const [min, max] = extents(run, at, ga + 0.002, gb - 0.002, gy0 + 0.002, gy1 - 0.002, 0.02);
        const pane = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), M.glass);
        pane.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2).sub(center);
        pane.userData.line = line; // like the windows' glass
        group.add(pane);
      }
    } else {
      part(o.a + 0.01, o.b - 0.01, o.bottom + 0.01, o.top - 0.01, 0.06, slab);
      // raised panels on both faces
      part(o.a + 0.14, o.b - 0.14, o.bottom + 1.15, o.top - 0.16, 0.08, o.front ? M.frontDoorGlass : panel);
      part(o.a + 0.14, o.b - 0.14, o.bottom + 0.18, o.bottom + 0.98, 0.08, panel);
    }
    // a lever handle on each side
    part(o.b - 0.2, o.b - 0.07, o.bottom + 1.0, o.bottom + 1.03, 0.2, M.handle);
    groups[story].add(group);

    const [pmin, pmax] = extents(run, at, hole.a, hole.b, hole.bottom, hole.top, physThick, physOffset);
    const door = {
      kind: 'door',
      group,
      broken: false,
      cracked: false,
      story,
      color: o.front ? DOOR_COLORS.front : DOOR_COLORS.inside,
      center,
      normal: run === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0),
      width: o.b - o.a,
      height: o.top - o.bottom,
      body: null,
    };
    door.body = body(pmin, pmax, physMats.hard, { kind: 'door', piece: door });
    doors.push(door);
  }

  function addWindow(run, at, o, hole, physThick, physOffset, story, outward, line) {
    const group = new THREE.Group();
    // the glass stops 2 mm inside the frame, so its edges don't lie in one plane with the bars' ends
    const [min, max] = extents(run, at, o.a + 0.002, o.b - 0.002, o.bottom + 0.002, o.top - 0.002, 0.03);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), M.glass);
    pane.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    pane.userData.line = line; // the glass has its own material but fades out of the way with its wall
    group.add(pane);
    const midA = (o.a + o.b) / 2;
    const midY = (o.bottom + o.top) / 2;
    const bars = o.bars ?? { v: [0.5], h: [0.5] };
    const at_ = (p, q, f) => p + (q - p) * f;
    for (const [a, b, ya, yb] of [
      ...bars.v.map((f) => [at_(o.a, o.b, f) - 0.03, at_(o.a, o.b, f) + 0.03, o.bottom, o.top]),
      ...bars.h.map((f) => [o.a, o.b, at_(o.bottom, o.top, f) - 0.03, at_(o.bottom, o.top, f) + 0.03]),
    ]) {
      const [bmin, bmax] = extents(run, at, a, b, ya, yb, 0.06);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]), lineMat(line, M.trim));
      bar.position.set((bmin[0] + bmax[0]) / 2, (bmin[1] + bmax[1]) / 2, (bmin[2] + bmax[2]) / 2);
      group.add(bar);
    }
    groups[story].add(group);

    const [pmin, pmax] = extents(run, at, hole.a, hole.b, hole.bottom, hole.top, physThick, physOffset);
    const win = {
      kind: 'window',
      group,
      broken: false,
      story,
      center: new THREE.Vector3((min[0] + max[0]) / 2, midY, (min[2] + max[2]) / 2),
      normal: run === 'x' ? new THREE.Vector3(0, 0, outward) : new THREE.Vector3(outward, 0, 0),
      width: o.b - o.a,
      height: o.top - o.bottom,
      body: null,
    };
    win.body = body(pmin, pmax, physMats.glass, { kind: 'glass', piece: win });
    windows.push(win);
  }

  function rectMinus(r, h) {
    if (!h || h.x0 >= r.x1 || h.x1 <= r.x0 || h.z0 >= r.z1 || h.z1 <= r.z0) return [r];
    const out = [];
    const mx0 = Math.max(r.x0, h.x0);
    const mx1 = Math.min(r.x1, h.x1);
    if (h.x0 > r.x0) out.push({ x0: r.x0, x1: h.x0, z0: r.z0, z1: r.z1 });
    if (h.x1 < r.x1) out.push({ x0: h.x1, x1: r.x1, z0: r.z0, z1: r.z1 });
    if (h.z0 > r.z0) out.push({ x0: mx0, x1: mx1, z0: r.z0, z1: h.z0 });
    if (h.z1 < r.z1) out.push({ x0: mx0, x1: mx1, z0: h.z1, z1: r.z1 });
    return out;
  }

  // ------------------------------------------------------------ storeys
  for (let k = 0; k < HOUSE.stories; k++) {
    const y0 = k * H;
    const y1 = (k + 1) * H - T;
    const R = ROOMS[k];
    const win = (o) => ({ ...o, bottom: y0 + (o.sill ?? WIN.sill), top: y0 + (o.top ?? WIN.top), glass: true });
    const door = ([a, b], front = false, glazed = false) => ({ a, b, bottom: y0, top: y0 + DOOR_TOP, front, glazed, slack: DOOR_SLACK });
    const roomAt = (x, z) => roomOf(k, x, z);
    const common = { y0, y1, story: k, thick: EXT, physThick: EXT_PHYS };
    const off = (EXT_PHYS - EXT) / 2;

    if (k >= HOUSE.brickStories) buildAttic(k, R, off);
    else {
    wall({
      ...common, run: 'x', at: HOUSE.z1, from: OUT.x0, to: OUT.x1, physOffset: off, outward: 1, line: `south-${k}`,
      // on the ground floor the toilet carries on into its bump-out, through an open gap
      openings: [...FRONT[k].map(win), ...(k === 0 ? [door(FRONT_DOOR, true), { a: OUT.x0, b: GF.toiletX - INT / 2, bottom: y0, top: TOILET_OUT.top, open: true }] : [])],
      splits: k === 0 ? [GF.toiletX, GF.hallX] : [GF.stairX, MID_X],
      mats: { pos: M.brick, neg: (x) => wallpaper(roomAt(x, IN.z1 - 0.1)), ends: M.brick },
    });
    wall({
      ...common, run: 'x', at: HOUSE.z0, from: OUT.x0, to: OUT.x1, physOffset: -off, outward: -1, line: `north-${k}`,
      openings: k === 0 ? [...BACK_GROUND.map(win), door(UTILITY_DOOR, false, true)] : BACK.map(win),
      mats: { pos: (x) => wallpaper(roomAt(x, IN.z0 + 0.1)), neg: M.brick, ends: M.brick },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x0, from: IN.z0, to: IN.z1, physOffset: -off, outward: -1, line: `west-${k}`,
      splits: k === 0 ? [GF.storeZ, GF.toiletZ] : [HALL_Z],
      mats: { pos: (z) => wallpaper(roomAt(IN.x0 + 0.1, z)), neg: M.brick },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x1, from: IN.z0, to: IN.z1, physOffset: off, outward: 1, line: `east-${k}`,
      splits: k === 0 ? [GF.hallZ] : [HALL_Z],
      mats: { pos: M.brick, neg: (z) => wallpaper(roomAt(IN.x1 - 0.1, z)) },
    });
    }

    // Interior walls
    const inner = { y0, y1, story: k, thick: INT, physThick: INT_PHYS };
    if (k === 0) buildGroundWalls(inner, R, door);
    else {
      // On floor 2 the hall wall starts at the corridor from the stairs, which is open to the landing.
      wall({
        ...inner, run: 'x', at: HALL_Z, from: k === 1 ? GF.stairX - INT / 2 : IN.x0, to: IN.x1, line: `hall-${k}`,
        openings: [door(k === 1 ? [-3.9, -2.8] : [-4.6, -3.4]), door([3.2, 4.4])],
        mats: { pos: (x) => wallpaper(roomAt(x, 0)), neg: wallpaper(R.hall) },
      });
    }
    if (k === 1) {
      wall({
        ...inner, run: 'z', at: MID_X, from: HALL_Z + INT / 2, to: IN.z1, line: `mid-${k}`,
        openings: [door([0.6, 1.8])],
        mats: { pos: wallpaper(R.right), neg: wallpaper(R.left) },
      });
      // the corridor along the left wall, where the stairs come up from the hallway
      wall({
        ...inner, run: 'z', at: GF.stairX, from: HALL_Z + INT / 2, to: IN.z1, line: `stairs-${k}`,
        mats: { pos: wallpaper(R.left), neg: wallpaper(R.hall) },
      });
    }

    // Dark panel joining this storey's window in the front column to the one above.
    if (k < HOUSE.brickStories - 1) {
      const [a, b] = COLUMN;
      const above = FRONT[k + 1].find((o) => o.a === a);
      const yb = y0 + WIN.top + 0.07;
      const yt = y0 + H + (above.sill ?? WIN.sill) - 0.05;
      const line = `south-${k}`;
      // (just in front of the brick, not sunk into it: their ends lay in one plane with the wall's and flickered)
      box([a, yb, OUT.z1 + 0.001], [b, yt, OUT.z1 + 0.03], M.spandrel, { story: k, line });
      box([a - 0.07, yb, OUT.z1 + 0.001], [a, yt, OUT.z1 + 0.05], M.trim, { story: k, line });
      box([b, yb, OUT.z1 + 0.001], [b + 0.07, yt, OUT.z1 + 0.05], M.trim, { story: k, line });
    }

    // Floor finishes (visual), sharing the fade line of this storey's slab.
    // The pieces never overlap (overlapping floors flicker).
    const fy = y0 + 0.01;
    const slabLine = k > 0 ? `slab-${k}` : null;
    if (slabLine) registerLine(slabLine, k);
    const addFloor = (rect, room) => {
      const mat = floorMat(room);
      const mesh = new THREE.Mesh(floorGeometry(rect.x0, rect.z0, rect.x1, rect.z1, turnedFloor(k, room)), slabLine ? lineMat(slabLine, mat) : mat);
      mesh.position.y = fy;
      mesh.receiveShadow = true;
      groups[k].add(mesh);
      if (slabLine) lines.get(slabLine).meshes.push(mesh);
    };
    const floors = k === 0 ? [
      [{ x0: IN.x0, x1: IN.x1, z0: IN.z0, z1: GF.hallZ }, R.left],
      [{ x0: GF.hallX, x1: IN.x1, z0: GF.hallZ, z1: IN.z1 }, R.right],
      [{ x0: IN.x0, x1: GF.hallX, z0: GF.hallZ, z1: GF.toiletZ }, R.hall],
      [{ x0: GF.toiletX, x1: GF.hallX, z0: GF.toiletZ, z1: IN.z1 }, R.hall],
      [{ x0: IN.x0, x1: GF.toiletX, z0: GF.toiletZ, z1: IN.z1 }, R.toilet],
    ] : [
      [{ x0: k === 1 ? GF.stairX : IN.x0, x1: MID_X, z0: HALL_Z, z1: IN.z1 }, R.left],
      [{ x0: MID_X, x1: IN.x1, z0: HALL_Z, z1: IN.z1 }, R.right],
      [{ x0: IN.x0, x1: IN.x1, z0: IN.z0, z1: HALL_Z }, R.hall],
      ...(k === 1 ? [[{ x0: IN.x0, x1: GF.stairX, z0: HALL_Z, z1: IN.z1 }, R.hall]] : []),
    ];
    for (const [rect, room] of floors) for (const r of rectMinus(rect, HOLES[k])) addFloor(r, room);
  }

  // ------------------------------------------------------------ slabs (floor 2 and the attic floor)
  // The ground floor sits on a foundation; the yard's ground plane is its physics.
  // (Its top is 5 mm under the ground, not level with the grass, which it would flicker against.)
  box([OUT.x0, -0.3, OUT.z0], [OUT.x1, -0.005, OUT.z1], [M.trim, M.trim, M.ceiling, M.ceiling, M.trim, M.trim], { story: 0 });
  for (let k = 1; k < HOUSE.stories; k++) {
    const top = k * H;
    const line = `slab-${k}`;
    // Slab edges on the outside carry on the brick of the storey below; the
    // attic floor's edge stays white, like the band under the eaves.
    const edge = k < HOUSE.brickStories ? M.brick : M.trim;
    for (const r of rectMinus({ x0: OUT.x0, x1: OUT.x1, z0: OUT.z0, z1: OUT.z1 }, HOLES[k])) {
      const side = (outside) => (outside ? edge : M.trim);
      const mats = [side(r.x1 === OUT.x1), side(r.x0 === OUT.x0), M.ceiling, M.ceiling, side(r.z1 === OUT.z1), side(r.z0 === OUT.z0)];
      box([r.x0, top - T, r.z0], [r.x1, top, r.z1], mats, { story: k, line });
      // Visual and physics slabs match, so Lennie never sinks into a visible ceiling.
      body([r.x0, top - T, r.z0], [r.x1, top, r.z1], physMats.hard, { kind: 'floor' });
    }
  }

  // ------------------------------------------------------------ stairs
  const stairMats = [M.stairSide, M.stairSide, M.wood, M.stairSide, M.stairSide, M.stairSide];
  for (let i = 0; i < STAIR.steps; i++) {
    const A = STAIR.a;
    const minA = [A.x0, 0, A.zLow - (i + 1) * STAIR.run];
    const maxA = [A.x1, (i + 1) * STAIR.rise, A.zLow - i * STAIR.run];
    box(minA, maxA, stairMats, { story: 0, cast: true });
    stairBodies.push(body(minA, maxA, physMats.hard, { kind: 'stair', id: `A${i}` }));

    const [zc, zd] = STAIR.stripB;
    const xb = STAIR.xHigh - (i + 1) * STAIR.run;
    const minB = [xb, H, zc];
    const maxB = [xb + STAIR.run, H + (i + 1) * STAIR.rise, zd];
    box(minB, maxB, stairMats, { story: 1, cast: true });
    stairBodies.push(body(minB, maxB, physMats.hard, { kind: 'stair', id: `B${i}` }));
  }

  // Shared details (street.js); x = OUT.x0 + u for Lennie's house.
  const kit = { box, body, addMesh, groups, M, std, tex, physMats, world, HOUSE, OUT, EXT, ROW, DORMER };
  const details = makeDetails(kit);
  const ux = ([u0, u1]) => [OUT.x0 + u0, OUT.x0 + u1];
  buildRoof();
  details.porch({ x0: ux(LAYOUT.porch)[0], x1: ux(LAYOUT.porch)[1], fascia: M.canopy }); // over the toilet's bump-out (built below) and the door
  details.downpipe(OUT.x0 + LAYOUT.pipe, 2.55, (k) => ({ story: k, line: `south-${k}` }));
  buildNeighbours(kit, details);
  buildUtility();
  buildGarage();
  buildToiletOut();
  // the dining chairs, the piano stool and the small round tables, which Lennie knocks over (loose.js)
  const loose = createLoose(world, physMats.loose);
  buildFurniture();
  // the kids' drawings and paintings on the living room's white walls, and the photos of friends in the toilet (drawings.js)
  const wx = IN.x0 + 0.006; // just off the left and right walls' faces
  const ex = IN.x1 - 0.006;
  hangDrawings(kit, [
    { pic: 0, face: '+x', x: wx, y: 1.45, z: -2.2, w: 0.56, tilt: 0.04, line: 'west-0' }, // above the couch
    { pic: 3, face: '+x', x: wx, y: 1.78, z: -1.45, w: 0.46, tilt: -0.06, line: 'west-0' },
    { pic: 5, face: '-z', x: -3.98, y: 1.6, z: GF.storeZ - INT / 2 - 0.006, w: 0.7, line: 'storeback-0' },
    { pic: 1, face: '-z', x: -3.0, y: 1.5, z: GF.hallZ - INT / 2 - 0.006, w: 0.44, tilt: -0.05, line: 'hallback-0' }, // either side of the hallway door
    { pic: 4, face: '-z', x: -1.2, y: 1.42, z: GF.hallZ - INT / 2 - 0.006, w: 0.36, tilt: 0.05, line: 'hallback-0' },
    { pic: 2, face: '-x', x: ex, y: 1.5, z: -3.4, w: 0.55, tilt: -0.05, line: 'east-0' }, // by the dining table
    { pic: 6, face: '-x', x: ex, y: 1.82, z: -2.6, w: 0.45, tilt: 0.07, line: 'east-0' },
    { pic: 7, face: '-x', x: ex, y: 1.5, z: -1.7, w: 0.65, line: 'east-0' },
    // framed snapshots of friends in the toilet: on its back wall, its side, and in its bump-out by the loo
    { pic: 8, face: '+z', x: -4.95, y: 1.62, z: GF.toiletZ + INT / 2 + 0.006, w: 0.42, tilt: 0.02, line: 'toilet-0' },
    { pic: 9, face: '+z', x: -4.15, y: 1.48, z: GF.toiletZ + INT / 2 + 0.006, w: 0.36, tilt: -0.02, line: 'toilet-0' },
    { pic: 10, face: '+x', x: wx, y: 1.55, z: 4.3, w: 0.42, line: 'west-0' },
    { pic: 11, face: '+x', x: wx, y: 1.6, z: 5.4, w: 0.36, tilt: 0.02, line: 'toiletoutw-0' },
  ]);
  // the TV on its cabinet, which cracks and sparks when Lennie hits it (tv.js)
  const tv = buildTV(kit);
  // the mess: dishes, toys, clothes, household stuff and the board game closet (clutter.js)
  const clutter = buildClutter({ ...kit, H });

  // ------------------------------------------------------------ the ground floor's own walls
  // The toilet's two walls, the wall between the hallway and the kitchen, the
  // hallway's back wall (with the door to the living room), and the storage
  // cupboard under the stairs. The kitchen and the living room are open to
  // each other: only the counter and the piano stand between them.
  function buildGroundWalls(inner, R, door) {
    const paper = (room) => wallpaper(R[room]);
    wall({ ...inner, run: 'x', at: GF.toiletZ, from: IN.x0, to: GF.toiletX + INT / 2, line: 'toilet-0', mats: { pos: paper('toilet'), neg: paper('hall') } });
    wall({
      ...inner, run: 'z', at: GF.toiletX, from: GF.toiletZ + INT / 2, to: IN.z1, line: 'toiletside-0',
      openings: [door([3.4, 4.5])], mats: { pos: paper('hall'), neg: paper('toilet') },
    });
    wall({ ...inner, run: 'z', at: GF.hallX, from: GF.hallZ + INT / 2, to: IN.z1, line: 'kitchenside-0', mats: { pos: paper('right'), neg: paper('hall') } });
    wall({
      ...inner, run: 'x', at: GF.hallZ, from: GF.stairX - INT / 2, to: GF.hallX + INT / 2, line: 'hallback-0',
      openings: [door([-2.6, -1.5], false, true)], // a glass door
      splits: [GF.toiletX],
      mats: { pos: paper('hall'), neg: (x) => paper(x < GF.toiletX ? 'storage' : 'left') },
    });
    // the storage cupboard: the stairs on its left, its door onto the living room
    wall({ ...inner, run: 'x', at: GF.storeZ, from: GF.stairX - INT / 2, to: GF.toiletX + INT / 2, line: 'storeback-0', mats: { pos: paper('storage'), neg: paper('left') } });
    wall({ ...inner, run: 'z', at: GF.stairX, from: GF.storeZ + INT / 2, to: GF.hallZ - INT / 2, line: 'storeleft-0', mats: { pos: paper('storage'), neg: paper('hall') } });
    wall({
      ...inner, run: 'z', at: GF.toiletX, from: GF.storeZ + INT / 2, to: GF.hallZ - INT / 2, line: 'storeright-0',
      openings: [door([-0.45, 0.55])], mats: { pos: paper('left'), neg: paper('storage') },
    });
  }

  // ------------------------------------------------------------ the utility room
  // A little flat-roofed brick extension behind the kitchen side, as in the
  // sketch: a door from the living room, a door out into the garden, the
  // fridge and the cat's litter box. The garage is behind it (buildGarage). Its
  // roof belongs to the floor-2 group, so the cutaway lifts it off when you
  // look down into the ground floor.
  function buildUtility() {
    const U = UTILITY;
    const room = ROOMS[0].utility;
    const paper = wallpaper(room);
    const off = (EXT_PHYS - EXT) / 2;
    const xo = U.x0 - EXT / 2; // its outer faces
    const zo = U.z0 - EXT / 2;
    const zi = U.z0 + EXT / 2; // inner face of its back wall
    const ext = { y0: 0, y1: U.top, story: 0, thick: EXT, physThick: EXT_PHYS };
    box([xo, -0.3, zo], [OUT.x1, -0.005, OUT.z0], [M.trim, M.trim, M.ceiling, M.ceiling, M.trim, M.trim], { story: 0 }); // foundation
    const floor = new THREE.Mesh(floorGeometry(U.x0 + EXT / 2, zi, IN.x1, OUT.z0), floorMat(room));
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    groups[0].add(floor);
    wall({
      ...ext, run: 'x', at: U.z0, from: xo, to: OUT.x1, physOffset: -off, outward: -1, line: 'utility-n',
      mats: { pos: paper, neg: (along) => (along > U.x0 + EXT / 2 && along < U.x1 - EXT / 2 ? wallpaper(ROOMS[0].garage) : M.brick), ends: M.brick },
      splits: [U.x0 + EXT / 2, U.x1 - EXT / 2],
    });
    wall({
      ...ext, run: 'z', at: U.x0, from: zi, to: OUT.z0, physOffset: -off, outward: -1, line: 'utility-w',
      openings: [{ a: -6.35, b: -5.3, bottom: 0, top: DOOR_TOP, slack: DOOR_SLACK, glazed: true }],
      mats: { pos: paper, neg: M.brick, ends: M.brick },
    });
    wall({
      ...ext, run: 'z', at: U.x1, from: zi, to: OUT.z0, physOffset: off, outward: 1, line: 'utility-e',
      mats: { pos: M.brick, neg: paper },
    });
    // no overhang at the back: the garage's roof carries on from there (overlapping, the two flickered)
    const rMin = [xo - 0.1, U.top, zo];
    const rMax = [OUT.x1, U.top + 0.2, OUT.z0];
    box(rMin, rMax, [M.trim, M.trim, M.darkRoof, M.ceiling, M.trim, M.trim], { story: 1, cast: true, line: 'utility-roof' });
    body([rMin[0], U.top - 0.1, rMin[2]], rMax, physMats.hard, { kind: 'roof' }); // thicker downwards, so a fast Lennie doesn't slip through
  }

  // ------------------------------------------------------------ the garage
  // Brick and flat-roofed, behind the utility room, as in the sketch. Its side
  // door, near the utility room, stands wide open onto the garden. Inside, on a
  // concrete floor: shelves of camping stuff, a table piled with stuff, and the
  // tool shelves against the utility room (buildFurniture). Like the utility
  // room's, its roof belongs to the floor-2 group, so the cutaway lifts it off.
  function buildGarage() {
    const G = GARAGE;
    const room = ROOMS[0].garage;
    const paint = wallpaper(room);
    const off = (EXT_PHYS - EXT) / 2;
    const xo = G.x0 - EXT / 2; // its outer faces
    const zo = G.z0 - EXT / 2;
    const zi = G.z0 + EXT / 2; // inner face of its back wall
    const zu = G.z1 - EXT / 2; // the utility room's back wall
    const ext = { y0: 0, y1: G.top, story: 0, thick: EXT, physThick: EXT_PHYS };
    box([xo, -0.3, zo], [OUT.x1, -0.005, zu], [M.trim, M.trim, M.ceiling, M.ceiling, M.trim, M.trim], { story: 0 }); // foundation
    const floor = new THREE.Mesh(floorGeometry(G.x0 + EXT / 2, zi, IN.x1, zu), floorMat(room));
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    groups[0].add(floor);
    wall({
      ...ext, run: 'x', at: G.z0, from: xo, to: OUT.x1, physOffset: -off, outward: -1, line: 'garage-n',
      mats: { pos: paint, neg: M.brick, ends: M.brick },
    });
    wall({
      ...ext, run: 'z', at: G.x0, from: zi, to: zu, physOffset: -off, outward: -1, line: 'garage-w',
      openings: [{ a: G.door[0], b: G.door[1], bottom: 0, top: DOOR_TOP, open: true, slack: DOOR_SLACK }],
      mats: { pos: paint, neg: M.brick, ends: M.brick },
    });
    wall({
      ...ext, run: 'z', at: G.x1, from: zi, to: zu, physOffset: off, outward: 1, line: 'garage-e',
      mats: { pos: M.brick, neg: paint },
    });
    // the door's white frame, on the outside
    const [d0, d1] = G.door;
    const trim = (min, max) => box(min, max, M.trim, { story: 0, line: 'garage-w' });
    trim([xo - 0.03, 0, d0 - 0.07], [xo, DOOR_TOP + 0.07, d0]);
    trim([xo - 0.03, 0, d1], [xo, DOOR_TOP + 0.07, d1 + 0.07]);
    trim([xo - 0.03, DOOR_TOP, d0], [xo, DOOR_TOP + 0.07, d1]);
    // the door itself, green, hinged on the far side and swung wide open into the garden
    const leafMat = std({ color: 0x2f5d4a, roughness: 0.6 });
    const w = d1 - d0 - 0.02;
    const swing = 1.75; // radians: a bit past square, so it never stands in the way
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, DOOR_TOP - 0.02, w).translate(-0.02, (DOOR_TOP - 0.02) / 2, w / 2), leafMat);
    leaf.position.set(xo - 0.03, 0.01, d0 + 0.01);
    leaf.rotation.y = -swing;
    leaf.castShadow = true;
    leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.12).translate(-0.06, 1.0, w - 0.1), M.handle));
    groups[0].add(leaf);
    const ld = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(0.05, DOOR_TOP / 2, w / 2)) });
    ld.position.set(xo - 0.05 - Math.sin(swing) * w / 2, DOOR_TOP / 2, d0 + Math.cos(swing) * w / 2);
    ld.quaternion.setFromEuler(0, -swing, 0);
    ld.surface = { kind: 'furniture' };
    world.addBody(ld);
    // the flat roof, carrying on from the utility room's (they meet, so they don't overlap and flicker)
    const rMin = [xo - 0.1, G.top, zo - 0.1];
    const rMax = [OUT.x1, G.top + 0.2, zu];
    box(rMin, rMax, [M.trim, M.trim, M.darkRoof, M.ceiling, M.trim, M.trim], { story: 1, cast: true, line: 'garage-roof' });
    body([rMin[0], G.top - 0.1, rMin[2]], rMax, physMats.hard, { kind: 'roof' });
    // a fluorescent tube on the ceiling (with the roof, so it goes when the cutaway lifts that off)
    box([3.2, G.top - 0.06, -8.3], [4.4, G.top - 0.005, -8.22], std({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 0.9 }), { story: 1 });
  }

  // ------------------------------------------------------------ the toilet's bump-out
  // The toilet carries on through a gap in the front wall into a little brick
  // bump-out under the canopy, whose underside is its ceiling. Its front has
  // the toilet's small high window. Each wall fades on its own line.
  function buildToiletOut() {
    const T = TOILET_OUT;
    const tiles = wallpaper(ROOMS[0].toilet);
    const off = (EXT_PHYS - EXT) / 2;
    const zi = T.z1 - EXT; // inner face of its front
    const ext = { y0: 0, y1: T.top, story: 0, thick: EXT, physThick: EXT_PHYS };
    box([T.x0, -0.3, OUT.z1], [T.x1, 0, T.z1], [M.trim, M.trim, M.ceiling, M.ceiling, M.trim, M.trim], { story: 0 }); // foundation
    const floor = new THREE.Mesh(floorGeometry(IN.x0, IN.z1, T.x1 - EXT, zi), floorMat(ROOMS[0].toilet));
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    groups[0].add(floor);
    const cx = (T.x0 + T.x1) / 2;
    wall({
      ...ext, run: 'x', at: T.z1 - EXT / 2, from: T.x0, to: T.x1, physOffset: off, outward: 1, line: 'toiletout-0',
      openings: [{ a: cx - 0.55, b: cx + 0.55, bottom: 1.3, top: 2.0, glass: true, bars: { v: [], h: [] }, slack: SLACK }],
      mats: { pos: M.brick, neg: tiles, ends: M.brick },
    });
    // the side on the party wall, and the one beside the front door
    wall({ ...ext, run: 'z', at: HOUSE.x0, from: IN.z1, to: zi, physOffset: -off, outward: -1, line: 'toiletoutw-0', mats: { pos: tiles, neg: M.brick } });
    wall({ ...ext, run: 'z', at: T.x1 - EXT / 2, from: OUT.z1, to: zi, physOffset: off, outward: 1, line: 'toiletoute-0', mats: { pos: M.brick, neg: tiles } });
  }

  // ------------------------------------------------------------ attic
  // The top floor is the attic: no front or back wall (the roof slopes down to
  // the floor), gable walls shared with the neighbours, a middle wall cut to
  // the roof line, and the dormer on the front with a window to throw Lennie
  // out of. The hall wall happens to fit under the roof exactly.
  function buildAttic(k, R, off) {
    const y0 = k * H;
    // gable (party) walls: one piece for the landing and one for the room in front
    for (const [x, side, room] of [[HOUSE.x0, -1, R.left], [HOUSE.x1, 1, R.right]]) {
      for (const [za, zb, rm] of [[IN.z0, HALL_Z, R.hall], [HALL_Z, IN.z1, room]]) {
        const poly = [[za, y0], [zb, y0], [zb, underside(zb)]];
        if (za < 0 && zb > 0) poly.push([0, HOUSE.ridgeY]);
        poly.push([za, underside(za)]);
        const mats = side < 0 ? { pos: wallpaper(rm), neg: M.brick } : { pos: M.brick, neg: wallpaper(rm) };
        prismWall({ run: 'z', at: x, poly, thick: EXT, physThick: EXT_PHYS, physOffset: side * off, mats, story: k, line: `${side < 0 ? 'west' : 'east'}-${k}` });
      }
    }

    // middle wall, cut to the roof line, with its door
    const line = `mid-${k}`;
    const z0 = HALL_Z + INT / 2;
    const [d0, d1] = [0.6, 1.8];
    const dTop = y0 + DOOR_TOP;
    const zf = DORMER.front + DORMER.wallT / 2; // the dormer's outside face
    const bath = wallpaper(R.right);
    const mid = (poly, mats = { pos: bath, neg: wallpaper(R.left) }) =>
      prismWall({ run: 'z', at: MID_X, poly, thick: INT, physThick: INT_PHYS, mats, story: k, line });
    mid([[z0, y0], [d0, y0], [d0, underside(d0)], [0, HOUSE.ridgeY], [z0, underside(z0)]]);
    mid([[d0, dTop], [d1, dTop], [d1, underside(d1)], [d0, underside(d0)]]);
    mid([[d1, y0], [IN.z1, y0], [IN.z1, underside(IN.z1)], [d1, underside(d1)]]);
    // ...and above the roof line it carries on as the dormer's left side
    mid([[DORMER.back, DORMER.top], [zf, DORMER.top], [zf, underside(zf)]], { pos: bath, neg: M.cladding });
    addDoor('z', MID_X, { a: d0, b: d1, bottom: y0, top: dTop }, INT_PHYS, 0, k, line);
    for (const [a, b, ya, yb] of [[d0 - 0.07, d0, y0, dTop + 0.07], [d1, d1 + 0.07, y0, dTop + 0.07], [d0 - 0.07, d1 + 0.07, dTop, dTop + 0.07]]) {
      const [min, max] = extents('z', MID_X, a, b, ya, yb, INT + 0.05);
      box(min, max, M.trim, { story: k, line });
    }

    // the dormer's right side: inside the bathroom below the roof line, white cladding above it
    const cheek = (poly, mats) =>
      prismWall({ run: 'z', at: DORMER.x1, poly, thick: DORMER.wallT, physThick: 0.3, mats, story: k, line: `cheek-${k}` });
    cheek([[DORMER.back, y0], [zf, y0], [zf, underside(zf)], [DORMER.back, DORMER.top]], { pos: bath, neg: bath });
    cheek([[DORMER.back, DORMER.top], [zf, DORMER.top], [zf, underside(zf)]], { pos: M.cladding, neg: bath });

    // the dormer's front wall, with a breakable window; it fits between the
    // sides like the middle wall's (running into the right side, its corner flickered)
    wall({
      run: 'x', at: DORMER.front, from: MID_X + INT / 2, to: DORMER.x1 - DORMER.wallT / 2, y0, y1: DORMER.top,
      thick: DORMER.wallT, physThick: 0.5, physOffset: 0.15, outward: 1, story: k, line: `dormer-${k}`,
      openings: [{ a: 1.5, b: 4.2, bottom: underside(zf) + 0.45, top: DORMER.top - 0.25, glass: true, bars: { v: [0.5], h: [] }, slack: SLACK }],
      mats: { pos: M.cladding, neg: bath, ends: M.cladding },
    });
  }

  // ------------------------------------------------------------ roof
  // One long roof over the whole row. Lennie's part is in the top group (the
  // cutaway hides it), fades out of the way like a wall, has a hole for the
  // dormer and is only a shell, since the attic under it is a room. The
  // neighbours' parts always stay, over solid attics.
  function buildRoof() {
    const rise = HOUSE.ridgeY - HOUSE.eaveY;
    const angle = Math.atan(PITCH);
    const hyp = Math.hypot(1, PITCH);
    const runOut = HOUSE.z1 + 0.5; // plan distance from the ridge to the eave edge
    const thick = 0.18;
    const inward = 0.3; // Lennie's roof is thicker on the inside in physics, so fast throws don't tunnel out
    const ends = [ROW.x0 - 0.3, ROW.x1 + 0.3];
    const sections = [[ends[0], OUT.x0, 0], [OUT.x0, OUT.x1, 3], [OUT.x1, ends[1], 0]];
    const ridgeMat = std({ color: 0x2b2523 });
    const LINES = { 1: 'roof-front', [-1]: 'roof-back' };
    for (const side of [1, -1]) {
      registerLine(LINES[side], 3, { p: new THREE.Vector3(0, HOUSE.ridgeY, 0), n: new THREE.Vector3(0, Math.cos(angle), side * Math.sin(angle)) });
    }

    // A strip of one slope, from plan distance zA to zB from the ridge, x0 to x1.
    function slope(side, x0, x1, zA, zB, { story, line = null, inner = 0 }) {
      const L = (zB - zA) * hyp;
      const zm = (zA + zB) / 2;
      const normal = new THREE.Vector3(0, Math.cos(angle), side * Math.sin(angle));
      const mid = new THREE.Vector3((x0 + x1) / 2, HOUSE.ridgeY - PITCH * zm, side * zm);
      const geo = new THREE.BoxGeometry(x1 - x0, thick, L);
      meterBoxUVs(geo, [x0, -thick / 2, zA * hyp], [x1, thick / 2, zB * hyp]);
      const mats = [M.soffit, M.soffit, M.roofTiles, M.ceiling, M.soffit, M.soffit];
      const mesh = new THREE.Mesh(geo, line ? mats.map((m) => lineMat(line, m)) : mats);
      mesh.position.copy(mid).addScaledVector(normal, thick / 2);
      mesh.rotation.x = side * angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      groups[story].add(mesh);
      if (line) {
        const zs = [side * zA, side * zB].sort((p, q) => p - q);
        addToLine(mesh, line, [x0, underside(zB), zs[0]], [x1, underside(zA) + thick * hyp, zs[1]]);
      }
      const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3((x1 - x0) / 2, (thick + inner) / 2, L / 2)) });
      const c = mid.clone().addScaledVector(normal, (thick - inner) / 2);
      b.position.set(c.x, c.y, c.z);
      b.quaternion.setFromEuler(side * angle, 0, 0);
      b.surface = { kind: 'roof' };
      world.addBody(b);
    }

    const fy = HOUSE.ridgeY - PITCH * runOut; // underside at the eave edge
    // At the two ends of the row, the fascia boards and the ridge stick out 2 cm
    // past the roof, so their ends don't flicker against the roof's ends.
    const past = (x) => (x === ends[0] ? x - 0.02 : x === ends[1] ? x + 0.02 : x);
    // Lennie's part of the roof stops 1 cm short of the party walls, where the
    // neighbours' parts take over, and 2 cm inside the dormer's sides. So its
    // ends never lie in one plane with the ends of the walls, the attic floor,
    // the fascia boards or the ridge (they'd flicker; see flickercheck.js).
    const [L0, L1] = [OUT.x0 + 0.01, OUT.x1 - 0.01];
    for (const side of [1, -1]) {
      const line = LINES[side];
      for (const [x0, x1] of [[ends[0], L0], [L1, ends[1]]]) slope(side, x0, x1, 0, runOut, { story: 0 });
      const own = { story: 3, line, inner: inward };
      if (side > 0) {
        slope(side, L0, DORMER.x0 - 0.02, 0, runOut, own);
        slope(side, DORMER.x1 + 0.02, L1, 0, runOut, own);
        slope(side, DORMER.x0, DORMER.x1, 0, DORMER.back, own);
        slope(side, DORMER.x0, DORMER.x1, DORMER.front + DORMER.wallT / 2, runOut, own);
      } else slope(side, L0, L1, 0, runOut, own);
      // white fascia boards along the eave
      const z = side * (runOut + 0.05);
      for (const [x0, x1, story] of sections) box([past(x0), fy - 0.15, z - 0.07], [past(x1), fy + 0.3, z + 0.07], M.trim, { story, cast: true, line: story === 3 ? line : null });
    }
    const ry = HOUSE.ridgeY + thick * hyp;
    for (const [x0, x1, story] of sections) box([past(x0), ry - 0.15, -0.2], [past(x1), ry + 0.1, 0.2], ridgeMat, { story, cast: true, line: story === 3 ? LINES[1] : null });

    // The dormer's flat roof (its sides and front are attic walls, see buildAttic).
    const dMin = [DORMER.x0 - 0.15, DORMER.top, DORMER.back - 0.15];
    const dMax = [DORMER.x1 + 0.15, DORMER.top + 0.16, DORMER.front + DORMER.wallT / 2 + 0.15];
    box(dMin, dMax, [M.trim, M.trim, M.darkRoof, M.ceiling, M.trim, M.trim], { story: 3, cast: true, line: LINES[1] });
    body(dMin, dMax, physMats.hard, { kind: 'roof' });

    // Gables at the two ends of the row (visual) and the neighbours' solid attics (physics).
    const shape = new THREE.Shape();
    shape.moveTo(HOUSE.z0, 0);
    shape.lineTo(HOUSE.z1, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    for (const x of [ROW.x0, ROW.x1 - EXT]) {
      const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: EXT, bevelEnabled: false }), M.brick);
      gable.rotation.y = Math.PI / 2;
      gable.position.set(x, HOUSE.eaveY, 0);
      gable.receiveShadow = true;
      groups[0].add(gable);
    }
    const ey = HOUSE.eaveY;
    for (const [a0, a1] of [[ROW.x0, OUT.x0], [OUT.x1, ROW.x1]]) {
      convexBody(
        [[a0, ey, HOUSE.z0], [a1, ey, HOUSE.z0], [a1, ey, HOUSE.z1], [a0, ey, HOUSE.z1], [a0, HOUSE.ridgeY, 0], [a1, HOUSE.ridgeY, 0]],
        [[0, 1, 2, 3], [0, 4, 5, 1], [3, 2, 5, 4], [0, 3, 4], [1, 5, 2]],
        { kind: 'roof' },
      );
    }

    // Lennie's own roof: chimney and a few vents, as in the photo.
    details.chimney(...ux(LAYOUT.chimney), 3, LINES[1]);
    for (const [x, z] of [[-1.2, 2.6], [0.0, 1.2], [-2.0, -2.8]]) details.vent(x, z, 3, LINES[z > 0 ? 1 : -1]);
  }

  // ------------------------------------------------------------ furniture
  function buildFurniture() {
    const colorMats = new Map();
    const col = (hex, extra) => {
      const key = `${hex}-${JSON.stringify(extra ?? {})}`;
      if (!colorMats.has(key)) colorMats.set(key, std({ color: hex, roughness: 0.7, ...extra }));
      return colorMats.get(key);
    };
    // Each part: [min, max, color, { soft, phys = true, mat }]
    const piece = (story, parts) => {
      const y = story * H;
      for (const [min, max, color, opts = {}] of parts) {
        const lo = [min[0], min[1] + y, min[2]];
        const hi = [max[0], max[1] + y, max[2]];
        box(lo, hi, opts.mat ?? col(color), { story, cast: true });
        if (opts.phys !== false) body(lo, hi, opts.soft ? physMats.soft : physMats.hard, { kind: opts.soft ? 'cushion' : 'furniture' });
      }
    };
    const legs = (x0, z0, x1, z1, h, color, t = 0.06) => [
      [[x0, 0, z0], [x0 + t, h, z0 + t], color],
      [[x1 - t, 0, z0], [x1, h, z0 + t], color],
      [[x0, 0, z1 - t], [x0 + t, h, z1], color],
      [[x1 - t, 0, z1 - t], [x1, h, z1], color],
    ];
    const table = (x0, z0, x1, z1, h, color) => [[[x0, h - 0.06, z0], [x1, h, z1], color], ...legs(x0, z0, x1, z1, h - 0.06, color)];
    // A small round table Lennie knocks over (loose.js): a top on three thin legs.
    const roundTable = (x, z, r, h, topColor, legColor) => {
      const ROUND = { round: true };
      const legs = [0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const [lx, lz] = [x + Math.cos(a) * r * 0.65, z + Math.sin(a) * r * 0.65];
        return [[lx - 0.016, 0, lz - 0.016], [lx + 0.016, h - 0.03, lz + 0.016], col(legColor), ROUND];
      });
      loose.add(groups[0], [[[x - r, h - 0.03, z - r], [x + r, h, z + r], col(topColor), ROUND], ...legs], { mass: 4, surface: { kind: 'furniture' } });
    };
    const chair = (x, z, facing, color) => {
      // facing: +1 → sitter faces +x, −1 → faces −x
      const bx = facing > 0 ? x - 0.22 : x + 0.18;
      return [
        ...table(x - 0.22, z - 0.22, x + 0.22, z + 0.22, 0.46, color),
        [[bx, 0.46, z - 0.22], [bx + 0.04, 0.95, z + 0.22], color],
      ];
    };
    const rug = (story, x0, z0, x1, z1, color, round = false) => {
      const geo = round ? new THREE.CircleGeometry(Math.min(x1 - x0, z1 - z0) / 2, 40) : new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      // just above the floorboards (pulled in front of them, so they never
      // flicker through) and below the 0.012 where loose things lie
      const mesh = new THREE.Mesh(geo, col(color, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((x0 + x1) / 2, story * H + 0.011, (z0 + z1) / 2);
      mesh.receiveShadow = true;
      groups[story].add(mesh);
      return mesh;
    };
    // Little pot plants on the kitchen's window sill, in the window's recess.
    function windowPlants() {
      const z = 4.925;
      const y = KITCHEN_SILL;
      const add = (geo, mat, x, py, pz) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, py, pz);
        m.castShadow = true;
        groups[0].add(m);
        return m;
      };
      const pot = new THREE.CylinderGeometry(0.052, 0.04, 0.09, 12);
      const leafy = new THREE.SphereGeometry(0.075, 12, 8);
      const cactus = col(0x5e9a4a);
      for (const [x, kind] of [[1.42, 'round'], [1.66, 'cactus'], [2.55, 'spiky'], [3.05, 'flower'], [3.75, 'round'], [4.22, 'spiky']]) {
        add(pot, col(kind === 'spiky' ? 0xe9e4da : 0xc0643c), x, y + 0.045, z);
        const top = y + 0.09;
        if (kind === 'round' || kind === 'flower') {
          add(leafy, col(0x3f8f3a), x, top + 0.05, z).scale.set(1, 0.85, 0.7);
          if (kind === 'flower') {
            for (const [dx, dy, dz] of [[-0.03, 0.1, 0.02], [0.035, 0.09, -0.01], [0, 0.115, -0.015], [0.02, 0.08, 0.03]]) {
              add(new THREE.SphereGeometry(0.016, 8, 6), col(0xe86fa0), x + dx, top + dy, z + dz);
            }
          }
        } else if (kind === 'cactus') {
          add(new THREE.CapsuleGeometry(0.028, 0.11, 4, 10), cactus, x, top + 0.08, z);
          add(new THREE.CapsuleGeometry(0.015, 0.04, 4, 8), cactus, x + 0.04, top + 0.1, z).rotation.z = -0.5;
        } else {
          // tall pointy leaves, fanning out
          for (let i = 0; i < 5; i++) {
            const leaf = add(new THREE.BoxGeometry(0.026, 0.2 + (i % 2) * 0.06, 0.006), col(0x4c7d3a), x + (i - 2) * 0.012, top + 0.1, z + (((i * 7) % 3) - 1) * 0.01);
            leaf.rotation.set(0, i * 1.1, (i - 2) * 0.16);
          }
        }
      }
    }
    const WOOD = 0x9b6a3f;
    const DARK = 0x3a3440;
    const WHITE = 0xf4f2ee;

    // --- Storey 0, after the sketch (docs/floorplan-floor1.png)
    const SOFA = 0x4a4d52; // dark grey
    const SOFA_ARM = 0x3f4247;
    const SOFA_CUSHION = 0x585c62;
    const CABINET = 0x5d8fb3;
    const WORKTOP = 0xe8e4dc;
    const PIANO = 0x1d1a1c;
    const STEEL = { mat: std({ color: 0xc9ced3, roughness: 0.35, metalness: 0.3 }) };
    const KITCHEN_FRONT = GF.hallX + INT / 2;
    piece(0, [
      // living room: the corner couch with its back to the storage cupboard,
      // facing the garden, as long as the low white cabinet behind it
      [[-5.875, 0, -1.6], [-1.0, 0.45, -0.8], SOFA, { soft: true }],
      [[-5.875, 0, -2.4], [-4.85, 0.45, -1.6], SOFA, { soft: true }],
      [[-5.875, 0.45, -1.1], [-1.0, 0.88, -0.8], SOFA, { soft: true }],
      // the arms end against the back cushion, so their ends don't flicker against its ends
      [[-5.875, 0.45, -2.4], [-5.65, 0.66, -1.1], SOFA_ARM, { soft: true }],
      [[-1.22, 0.45, -1.6], [-1.0, 0.66, -1.1], SOFA_ARM, { soft: true }],
      [[-5.62, 0.45, -2.35], [-4.9, 0.52, -1.15], SOFA_CUSHION, { soft: true, phys: false }],
      [[-4.8, 0.45, -1.55], [-3.65, 0.52, -1.12], SOFA_CUSHION, { soft: true, phys: false }],
      [[-3.6, 0.45, -1.55], [-2.45, 0.52, -1.12], SOFA_CUSHION, { soft: true, phys: false }],
      [[-2.4, 0.45, -1.55], [-1.25, 0.52, -1.12], SOFA_CUSHION, { soft: true, phys: false }],
      // the low cabinet behind the couch, and the TV's low cabinet in the back corner
      [[-2.9, 0, -0.75], [-1.0, 0.55, -0.35], WHITE],
      [[-5.875, 0, -4.75], [-4.95, 0.5, -2.75], DARK],
      // the comfy chair by the back window, just in front of the heating trench
      [[-0.4, 0, -4.6], [0.6, 0.42, -3.5], SOFA, { soft: true }],
      [[-0.4, 0.42, -4.6], [0.6, 1.05, -4.3], SOFA, { soft: true }],
      [[-0.4, 0.42, -4.3], [-0.2, 0.65, -3.5], SOFA_ARM, { soft: true }],
      [[0.4, 0.42, -4.3], [0.6, 0.65, -3.5], SOFA_ARM, { soft: true }],
      // the dining table (its six chairs and the piano stool are loose, below)
      ...table(3.0, -2.2, 4.1, -0.3, 0.78, 0xc9a06a),
      // the piano, its back to the kitchen counter
      [[2.95, 0, 0.55], [4.65, 1.25, 1.12], PIANO],
      [[3.0, 0.68, 0.33], [4.6, 0.76, 0.55], PIANO],
      [[3.03, 0.76, 0.36], [4.57, 0.775, 0.5], WHITE, { phys: false }],
      [[3.0, 0, 0.38], [3.08, 0.68, 0.46], PIANO],
      [[4.52, 0, 0.38], [4.6, 0.68, 0.46], PIANO],
      // kitchen: a U of counters, along the front under the window, along the right wall, and across the back
      [[KITCHEN_FRONT, 0, 4.225], [5.875, 0.85, 4.875], CABINET],
      [[KITCHEN_FRONT, 0.85, 4.2], [5.875, 0.9, 4.875], WORKTOP],
      [[5.225, 0, 1.85], [5.875, 0.85, 4.225], CABINET],
      [[5.2, 0.85, 1.85], [5.875, 0.9, 4.2], WORKTOP],
      [[0.8, 0, 1.2], [5.875, 0.85, 1.85], CABINET],
      [[0.78, 0.85, 1.18], [5.875, 0.9, 1.85], WORKTOP],
      // the hanging cupboards on the side wall, above the counter, four doors with handles
      [[5.525, 1.5, 1.9], [5.875, 2.25, 4.875], CABINET],
      ...[0, 1, 2, 3].flatMap((i) => {
        const z0 = 1.9 + i * 0.74375;
        const zc = z0 + 0.372;
        return [
          [[5.51, 1.51, z0 + 0.008], [5.525, 2.24, z0 + 0.736], 0x6b9cc0, { phys: false }],
          [[5.49, 1.54, zc - 0.07], [5.51, 1.56, zc + 0.07], 0x9aa3ad, { phys: false }],
        ];
      }),
      // the cooker: a black hob on the counter and the oven under it
      [[-0.55, 0.9, 4.3], [0.25, 0.912, 4.8], 0x18181a, { phys: false }],
      [[-0.5, 0.1, 4.205], [0.2, 0.75, 4.225], 0x2b2b2e, { phys: false }],
      // the steel extractor hood above it, its chimney up to the ceiling
      [[-0.62, 1.58, 4.28], [0.32, 1.7, 4.875], null, STEEL],
      [[-0.58, 1.575, 4.32], [0.28, 1.58, 4.84], 0x3a3c40, { phys: false }],
      [[-0.28, 1.7, 4.6], [-0.02, H - T, 4.875], null, STEEL],
      // toilet: the loo against the front of its bump-out, and the little hand basin in the corner
      [[-4.93, 0, 5.725], [-4.43, 0.85, 5.95], WHITE],
      [[-4.88, 0, 5.225], [-4.48, 0.42, 5.725], WHITE],
      [[-4.9, 0.42, 5.195], [-4.46, 0.45, 5.695], 0xe6e1d8, { phys: false }],
      [[-5.875, 0.75, 3.2], [-5.5, 0.85, 3.6], WHITE],
      [[-5.75, 0, 3.33], [-5.63, 0.75, 3.47], WHITE],
      // hallway: the coat rack on the toilet wall, with the family's coats on it
      [[-4.5, 1.62, 2.92], [-3.55, 1.72, 2.96], WOOD, { phys: false }],
      [[-4.45, 0.85, 2.74], [-4.15, 1.62, 2.92], 0xd95d39, { phys: false }],
      [[-4.13, 0.95, 2.76], [-3.87, 1.62, 2.92], 0x2c3e5a, { phys: false }],
      [[-3.85, 1.15, 2.78], [-3.62, 1.62, 2.92], 0xf2c14e, { phys: false }],
      // storage cupboard: a crate of empties
      [[-4.4, 0, 0.45], [-3.95, 0.3, 0.85], 0xf2c14e],
      // utility room: the fridge, and the cat's litter box
      [[5.15, 0, -5.85], [5.875, 1.95, -5.125], WHITE],
      [[5.13, 1.1, -5.78], [5.15, 1.7, -5.72], 0x9aa3ad, { phys: false }],
      [[2.6, 0, -6.55], [3.2, 0.04, -6.1], 0x4a7fa8],
      [[2.6, 0.04, -6.55], [2.63, 0.17, -6.1], 0x4a7fa8],
      [[3.17, 0.04, -6.55], [3.2, 0.17, -6.1], 0x4a7fa8],
      [[2.63, 0.04, -6.55], [3.17, 0.17, -6.52], 0x4a7fa8],
      [[2.63, 0.04, -6.13], [3.17, 0.17, -6.1], 0x4a7fa8],
      [[2.63, 0.04, -6.52], [3.17, 0.1, -6.13], 0xd8c9a3, { phys: false }],
    ]);
    // the six dining chairs and the piano stool, loose so Lennie knocks them
    // over instead of getting stuck between them (loose.js); on the ground floor, so y is as built
    const knockable = (parts, mass) => loose.add(groups[0], parts.map(([min, max, color]) => [min, max, col(color)]), { mass, surface: { kind: 'furniture' } });
    for (const z of [-1.85, -1.25, -0.65]) {
      knockable(chair(2.6, z, 1, 0xd95d39), 5);
      knockable(chair(4.5, z, -1, 0xd95d39), 5);
    }
    knockable([[[3.4, 0, -0.05], [4.2, 0.5, 0.3], PIANO]], 9);
    // burners on the hob
    for (const [x, z] of [[-0.35, 4.43], [0.05, 4.43], [-0.35, 4.67], [0.05, 4.67]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 20).rotateX(Math.PI / 2), col(0x55555a));
      ring.position.set(x, 0.915, z);
      groups[0].add(ring);
    }
    rug(0, -2.25, 4.2, -1.05, 4.8, 0x6b5a45); // the doormat

    // the convector heating trench in the floor along the back window, from the
    // TV's corner to the comfy chair: a long wooden grille
    const trench = { a: BACK_GROUND[0].a + 0.15, b: -0.5 };
    const grille = rug(0, trench.a, IN.z0, trench.b, IN.z0 + 0.26, 0xffffff);
    grille.material = std({ map: grilleTexture(trench.b - trench.a), roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });

    // plants on the kitchen window sill, either side of the tap
    windowPlants();

    // the small round side table in front of the couch: an oak top on three black legs
    roundTable(-2.5, -2.3, 0.3, 0.45, 0xc8a172, 0x26262a);
    // and the low round table at the lounge set in the garden (garden.js), on a rattan stand
    {
      const [x, z, r, h] = [3.3, -11.25, 0.42, 0.42];
      loose.add(groups[0], [
        [[x - r, h - 0.04, z - r], [x + r, h, z + r], col(0xd8d2c4), { round: true }],
        [[x - r * 0.65, 0, z - r * 0.65], [x + r * 0.65, h - 0.04, z + r * 0.65], col(0x7d7368), { round: true }],
      ], { mass: 8, surface: { kind: 'furniture' } });
    }

    // --- the garage (buildGarage): camping shelves along the garden side,
    // a table piled with stuff on the far side, tool shelves against the utility room
    const NO = { phys: false };
    const SHELF = 0x8b8f94; // grey steel shelving
    const shelving = (x0, z0, x1, z1, levels, color) => {
      const top = levels[levels.length - 1] + 0.03;
      const parts = [];
      for (const [x, z] of [[x0, z0], [x1 - 0.04, z0], [x0, z1 - 0.04], [x1 - 0.04, z1 - 0.04]]) parts.push([[x, 0, z], [x + 0.04, top, z + 0.04], color, NO]);
      for (const y of levels) parts.push([[x0 + 0.005, y, z0 + 0.04], [x1 - 0.005, y + 0.03, z1 - 0.04], color, NO]);
      // one solid block for the lot, so Lennie can't get wedged between the shelves
      body([x0, 0, z0], [x1, top, z1], physMats.hard, { kind: 'furniture' });
      return parts;
    };
    const GZ0 = GARAGE.z0 + EXT / 2; // inner face of its back wall
    const GZ1 = GARAGE.z1 - EXT / 2; // the utility room's wall
    const GX0 = GARAGE.x0 + EXT / 2;
    piece(0, [
      // shelves with camping stuff
      ...shelving(GX0, GZ0 + 0.05, GX0 + 0.5, -8.05, [0.08, 0.6, 1.12, 1.64, 2.1], SHELF),
      [[GX0 + 0.06, 0.11, GZ0 + 0.15], [GX0 + 0.46, 0.5, GZ0 + 0.75], 0x2f6fb5, NO], // cool box
      [[GX0 + 0.05, 0.5, GZ0 + 0.15], [GX0 + 0.47, 0.56, GZ0 + 0.75], 0xf2f2ee, NO], // its lid
      [[GX0 + 0.08, 0.11, -8.95], [GX0 + 0.45, 0.45, -8.2], 0x6b7d5a, NO], // a crate of pegs and ropes
      [[GX0 + 0.1, 1.15, -8.9], [GX0 + 0.42, 1.55, -8.15], 0xd95d39, NO], // the kids' camping chairs, folded
      [[GX0 + 0.06, 1.67, GZ0 + 0.12], [GX0 + 0.46, 1.92, -8.6], 0x3f4a3a, NO], // the tent poles' bag
      // the table piled with stuff, and more under it
      ...table(5.05, GZ0 + 0.05, IN.x1 - 0.02, -8.2, 0.85, 0x8a6a48).map((part) => [...part.slice(0, 3), NO]),
      [[5.12, 0, GZ0 + 0.12], [5.8, 0.42, -9.0], 0xb8895a, NO],
      [[5.15, 0, -8.95], [5.75, 0.5, -8.3], 0x4a4d52, NO], // a crate of empties
      [[5.08, 0.85, GZ0 + 0.1], [5.5, 1.25, -9.15], 0xc99d6b, NO],
      [[5.1, 1.25, GZ0 + 0.15], [5.45, 1.55, -9.3], 0xa47a4d, NO],
      [[5.5, 0.85, GZ0 + 0.08], [5.86, 1.1, -9.0], 0xc4352f, NO], // the toolbox
      [[5.15, 0.85, -9.05], [5.55, 1.05, -8.6], 0x6f8fa8, NO], // a plastic tub
      [[5.6, 0.85, -8.9], [5.86, 1.35, -8.45], 0xb8895a, NO],
      [[5.12, 0.85, -8.5], [5.4, 0.98, -8.25], 0x2f8a5b, NO], // garden gloves and seed packets
      // tool shelves against the utility room's wall, with a pegboard of tools above
      ...shelving(2.7, GZ1 - 0.4, IN.x1, GZ1, [0.1, 0.5, 0.9], SHELF),
      [[2.75, 0.93, GZ1 - 0.02], [IN.x1 - 0.02, 1.85, GZ1 - 0.005], 0xc9b48f, NO], // the pegboard
      [[2.9, 1.2, GZ1 - 0.05], [3.25, 1.27, GZ1 - 0.02], 0x4a3020, NO], // a saw
      [[3.0, 1.27, GZ1 - 0.05], [3.15, 1.6, GZ1 - 0.02], 0x9aa3ad, NO],
      [[3.5, 1.15, GZ1 - 0.06], [3.56, 1.6, GZ1 - 0.02], 0xd95d39, NO], // a hammer
      [[3.46, 1.52, GZ1 - 0.07], [3.66, 1.58, GZ1 - 0.02], 0x55595f, NO],
      [[3.95, 1.1, GZ1 - 0.1], [4.25, 1.4, GZ1 - 0.02], 0xf2c14e, NO], // the drill
      // a row of screwdrivers (coloured handles) and spanners
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const x = 4.55 + i * 0.11;
        return i < 4
          ? [[x, 1.35, GZ1 - 0.04], [x + 0.035, 1.62, GZ1 - 0.02], [0xd95d39, 0xf2c14e, 0x2f6fb5, 0x2f8a5b][i], NO]
          : [[x, 1.3 + (i - 4) * 0.04, GZ1 - 0.035], [x + 0.03, 1.72, GZ1 - 0.02], 0x9aa3ad, NO];
      }),
      [[2.8, 0.53, GZ1 - 0.36], [3.3, 0.8, GZ1 - 0.05], 0x55595f, NO], // tins of paint and screws
      [[3.4, 0.53, GZ1 - 0.36], [4.1, 0.85, GZ1 - 0.05], 0x2f6fb5, NO],
      [[4.3, 0.13, GZ1 - 0.36], [5.2, 0.45, GZ1 - 0.05], 0x4a4d52, NO],
      [[2.8, 0.13, GZ1 - 0.36], [3.7, 0.4, GZ1 - 0.05], 0xb8895a, NO],
    ]);
    // one solid block for the table and its heap
    body([5.05, 0, GZ0], [IN.x1, 1.4, -8.2], physMats.hard, { kind: 'furniture' });
    // rolled-up sleeping bags and the tent on the camping shelves
    for (const [y, z, r, len, color] of [[0.63, -9.25, 0.13, 0.4, 0x2f8a5b], [0.63, -8.9, 0.13, 0.4, 0xd95d39], [0.63, -8.55, 0.12, 0.4, 0x5d8fb3], [1.15, -9.25, 0.13, 0.42, 0x3f4a3a], [1.67, -8.3, 0.11, 0.42, 0xf2c14e]]) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12).rotateZ(Math.PI / 2), col(color));
      roll.position.set(GX0 + 0.25, y + r, z);
      groups[0].add(roll);
    }
    // a bike against the back wall, between the shelves and the table
    {
      const bike = new THREE.Group();
      const tyre = col(0x1b1b1b);
      const frame = col(0x2f6fb5);
      for (const x of [-0.52, 0.52]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 24), tyre);
        wheel.position.set(x, 0.35, 0);
        bike.add(wheel);
      }
      for (const [x, y, len, rz] of [[-0.25, 0.55, 0.62, 1.0], [0.2, 0.57, 0.62, -0.9], [0.0, 0.8, 0.75, Math.PI / 2], [0.48, 0.65, 0.65, 0.35], [-0.42, 0.6, 0.5, -0.5]]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 6), frame);
        tube.position.set(x, y, 0);
        tube.rotation.z = rz;
        bike.add(tube);
      }
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.1), col(0x222222));
      saddle.position.set(-0.32, 0.95, 0);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6).rotateX(Math.PI / 2), col(0x55595f));
      bar.position.set(0.42, 1.0, 0);
      bike.add(saddle, bar);
      bike.position.set(3.6, 0, GZ0 + 0.22);
      bike.rotation.x = -0.06;
      groups[0].add(bike);
      body([2.7, 0, GZ0], [4.5, 1.05, GZ0 + 0.4], physMats.hard, { kind: 'furniture' });
    }

    // --- Storey 1: bedroom + kids room
    piece(1, [
      // the bed, its head against the wall of the corridor from the stairs
      [[-4.455, 0, 0.6], [-4.36, 0.86, 2.4], WOOD],
      [[-4.36, 0, 0.6], [-2.28, 0.32, 2.4], WOOD],
      [[-4.33, 0.32, 0.65], [-2.33, 0.58, 2.35], WHITE, { soft: true }],
      [[-3.48, 0.58, 0.62], [-2.3, 0.61, 2.38], 0x7c6bc4, { phys: false }],
      [[-4.28, 0.58, 0.8], [-3.83, 0.68, 2.2], 0xffffff, { phys: false }],
      [[-4.43, 0, 2.55], [-3.98, 0.5, 3.0], WOOD],
      [[0.3, 0, 2.6], [0.89, 2.0, 4.4], 0xb48a5c],
      // kids room
      [[4.0, 0, -2.25], [5.875, 0.3, -1.2], 0xf2c14e],
      [[4.05, 0.3, -2.2], [5.85, 0.52, -1.25], 0x5b8def, { soft: true }],
      [[2.0, 0, 4.2], [3.0, 0.5, 4.85], 0xe24a4a],
    ]);
    rug(1, -2.18, 0.6, 0.0, 2.6, 0xe8d6f5);
    rug(1, 2.2, 1.6, 4.4, 3.8, 0xffe08a, true);
    const beanbag = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), col(0xff7f50));
    beanbag.scale.set(1, 0.7, 1);
    beanbag.position.set(3.6, H + 0.35, 3.0);
    beanbag.castShadow = true;
    groups[1].add(beanbag);
    const bb = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(0.42) });
    bb.position.set(3.6, H + 0.3, 3.0);
    bb.surface = { kind: 'cushion' };
    world.addBody(bb);

    // --- Storey 2: the attic study + bathroom, kept clear of the sloping roof
    const tub = { x0: 2.65, x1: 4.5, z0: 2.75, z1: 3.75 };
    piece(2, [
      ...table(-5.875, -1.6, -5.1, 0.2, 0.76, WOOD),
      [[-5.8, 0.76, -1.0], [-5.74, 1.2, -0.3], 0x111114],
      ...chair(-4.6, -0.7, -1, 0x2f3e57),
      [[-3.0, 0, -2.3], [-1.4, 1.9, -1.95], WOOD],
      [[-1.2, 0, 2.2], [0.85, 0.45, 3.4], 0xc75b7a, { soft: true }],
      [[-1.2, 0.45, 3.1], [0.85, 1.0, 3.4], 0xc75b7a, { soft: true }],
      // bathroom: a hollow tub Lennie can land in, in the dormer under its window
      [[tub.x0, 0, tub.z0], [tub.x1, 0.12, tub.z1], WHITE],
      [[tub.x0, 0.12, tub.z0], [tub.x0 + 0.08, 0.55, tub.z1], WHITE],
      [[tub.x1 - 0.08, 0.12, tub.z0], [tub.x1, 0.55, tub.z1], WHITE],
      [[tub.x0 + 0.08, 0.12, tub.z0], [tub.x1 - 0.08, 0.55, tub.z0 + 0.08], WHITE],
      [[tub.x0 + 0.08, 0.12, tub.z1 - 0.08], [tub.x1 - 0.08, 0.55, tub.z1], WHITE],
      [[tub.x0 + 0.08, 0.12, tub.z0 + 0.08], [tub.x1 - 0.08, 0.14, tub.z1 - 0.08], 0x8fd3f0, { phys: false }],
      [[5.2, 0, -1.6], [5.75, 0.42, -1.1], WHITE],
      [[5.65, 0.42, -1.65], [5.875, 0.85, -1.05], WHITE],
      [[5.0, 0, 0.2], [5.875, 0.85, 1.4], 0x6a9fb5],
    ]);
    // books on the shelf
    const bookColors = [0xd95d39, 0x3f5fd6, 0xf2c14e, 0x22a06b, 0x8e44ad];
    for (let shelf = 0; shelf < 3; shelf++) {
      let x = -2.95;
      let i = shelf * 2;
      while (x < -1.5) {
        const w = 0.06 + ((i * 37) % 5) * 0.012;
        const h = 0.3 + ((i * 53) % 4) * 0.04;
        box([x, 2 * H + 0.3 + shelf * 0.55, -2.28], [x + w, 2 * H + 0.3 + shelf * 0.55 + h, -1.97], col(bookColors[i % 5]), { story: 2 });
        x += w + 0.01;
        i++;
      }
    }
    rug(2, 1.5, 1.2, 3.4, 2.3, 0x9ad0e6);
  }

  // ------------------------------------------------------------ queries
  const inFootprint = (p) => p.x > HOUSE.x0 && p.x < HOUSE.x1 && p.z > HOUSE.z0 && p.z < HOUSE.z1;
  const inDormer = (p) => p.x > DORMER.x0 && p.x < DORMER.x1 && p.z > DORMER.back - 0.2 && p.z < DORMER.front && p.y > HOUSE.eaveY && p.y < DORMER.top;
  const inUtility = (p) => p.x > UTILITY.x0 && p.x < UTILITY.x1 && p.z > UTILITY.z0 && p.z < UTILITY.z1 && p.y < UTILITY.top;
  const inGarage = (p) => p.x > GARAGE.x0 && p.x < GARAGE.x1 && p.z > GARAGE.z0 && p.z < GARAGE.z1 && p.y < GARAGE.top;
  const inToiletOut = (p) => p.x > TOILET_OUT.x0 && p.x < TOILET_OUT.x1 && p.z > OUT.z1 - 0.3 && p.z < TOILET_OUT.z1 - EXT && p.y < TOILET_OUT.top;
  const isInside = (p) => p.y > -1 && ((inFootprint(p) && p.y < underside(p.z) - 0.05) || inDormer(p) || inUtility(p) || inGarage(p) || inToiletOut(p));
  const isOnRoof = (p) => !isInside(p) && p.x > ROW.x0 - 0.6 && p.x < ROW.x1 + 0.6 && Math.abs(p.z) < OUT.z1 + 0.6 && p.y > HOUSE.eaveY - 0.4;
  const nearHouse = (p) => Math.abs(p.x) < OUT.x1 + 1.2 && Math.abs(p.z) < OUT.z1 + 1.2;
  const storyAt = (y) => THREE.MathUtils.clamp(Math.floor((y + 0.3) / H), 0, HOUSE.stories - 1);
  const levelOf = (p) => (isOnRoof(p) ? 3 : storyAt(p.y));

  function locate(p) {
    if (isOnRoof(p)) return 'on the roof';
    if (!isInside(p)) return p.y > 1.5 && nearHouse(p) ? 'hanging out of a window' : 'in the yard';
    const k = storyAt(p.y);
    const room = roomOf(k, p.x, p.z);
    return `in the ${room.name.toLowerCase()} (floor ${k + 1})`;
  }

  // Landing spots worth a bonus: where Lennie's hips or chest come to rest.
  // Boxes are [min, max] in world space, just above each piece of furniture.
  const S = (id, label, value, say, min, max) => ({ id, label, value, say, min, max });
  const spots = [
    S('bath', 'In the bath!', 500, 'SPLASH!', [2.65, 2 * H, 2.75], [4.5, 2 * H + 1.0, 3.75]),
    S('loo', 'On the loo!', 500, 'OOPS!', [5.05, 2 * H + 0.3, -1.8], [5.9, 2 * H + 1.1, -0.95]),
    S('desk', 'Asleep on the desk', 200, 'ZZZ', [-5.9, 2 * H + 0.7, -1.65], [-5.05, 2 * H + 1.4, 0.25]),
    S('armchair', 'Comfy in the armchair', 150, 'AHH!', [-1.25, 2 * H + 0.3, 2.15], [0.9, 2 * H + 1.2, 3.45]),
    S('wardrobe', 'On top of the wardrobe!', 500, 'HELP!', [0.25, H + 1.95, 2.55], [0.95, H + 2.7, 4.45]),
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [-4.43, H + 0.3, 0.55], [-2.23, H + 1.1, 2.45]),
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [3.95, H + 0.25, -2.3], [5.9, H + 1.05, -1.15]),
    S('beanbag', 'Beanbag flop!', 250, 'FLUMP!', [3.0, H + 0.4, 2.4], [4.2, H + 1.2, 3.6]),
    S('toybox', 'On the toy box!', 250, 'TOYS!', [1.95, H + 0.45, 4.15], [3.05, H + 1.2, 4.9]),
    S('fridge', 'On top of the fridge!', 450, 'CHILLY!', [5.05, 1.9, -5.95], [5.9, 2.6, -5.1]),
    S('table', 'On the dinner table!', 200, 'DINNER!', [2.95, 0.75, -2.25], [4.15, 1.45, -0.25]),
    S('counter', 'On the kitchen counter', 200, 'CHEF!', [-0.85, 0.88, 4.15], [5.9, 1.55, 4.9]),
    S('counter', 'On the kitchen counter', 200, 'CHEF!', [5.15, 0.88, 1.8], [5.9, 1.55, 4.2]),
    S('counter', 'On the kitchen counter', 200, 'CHEF!', [0.75, 0.88, 1.15], [5.9, 1.55, 1.9]),
    S('couch', 'Couch potato', 150, 'AHH!', [-5.9, 0.3, -2.45], [-0.95, 1.2, -0.75]),
    S('armchair', 'Comfy in the armchair', 150, 'AHH!', [-0.45, 0.3, -4.65], [0.65, 1.2, -3.45]),
    S('piano', 'On the piano!', 350, 'PLINK!', [2.9, 1.2, 0.5], [4.7, 2.0, 1.17]),
    S('loo', 'On the loo!', 500, 'OOPS!', [-4.98, 0.3, 5.12], [-4.38, 1.1, 5.95]),
    S('litter', 'In the cat litter!', 400, 'EWW!', [2.55, 0, -6.6], [3.25, 0.6, -6.05]),
    S('junk', 'On the junk pile!', 300, 'CLATTER!', [5.0, 1.3, -9.6], [5.9, 2.2, -8.15]),
    S('camping', 'Up on the camping shelf!', 450, 'CAMPING!', [1.5, 2.05, -9.6], [2.1, 2.6, -8.0]),
    S('lounge', 'Chilling on the lounge set', 200, 'AHH!', [1.55, 0.25, -12.05], [5.98, 1.1, -9.8]),
    ...clutter.spots,
  ];

  // a clear bit of floor on each storey: the living room, the bedroom, the attic study
  const SPAWN = [{ x: -0.6, z: -2.5 }, { x: -1.2, z: 1.0 }, { x: -2.4, z: 1.6 }];
  function spawnPoint(level) {
    if (level >= 3) return { x: -1.5, z: 0.2, height: HOUSE.ridgeY + 0.3 };
    return { ...SPAWN[level], height: level * H + 0.05 };
  }

  // ------------------------------------------------------------ view: cutaway + fading
  // Every line is a thin slab (a wall or a floor); its plane is across its
  // thinnest axis. It fades when the sight line from the camera target to the
  // camera crosses that plane within the line's extent (plus a margin), which
  // also catches sight lines that slip through a doorway or window.
  // A roof slope isn't axis-aligned: its line carries its own plane instead.
  for (const entry of lines.values()) {
    if (entry.plane) continue;
    const size = [0, 1, 2].map((i) => entry.max[i] - entry.min[i]);
    entry.axis = size.indexOf(Math.min(...size));
    entry.value = (entry.min[entry.axis] + entry.max[entry.axis]) / 2;
  }
  const FADE_MARGIN = 0.8;
  let level = 3;
  // How close under a ceiling the camera counts as up at it. The camera draws
  // nothing nearer than its near plane (main.js), so this close the ceiling
  // gets clipped off at the top of the picture and you'd see through it.
  const underCeiling = (camera, k) => (k + 1) * H - T - camera.near;

  /**
   * Hides storeys above the one the camera target is on when the camera looks
   * down into it (or is right up against its ceiling), and fades any
   * wall/floor between the camera and the target.
   */
  function updateView(camera, target, dt, cutaway) {
    level = 3;
    if (cutaway && isInside(target)) {
      const k = storyAt(target.y);
      if (camera.position.y > underCeiling(camera, k)) level = k;
    }
    groups.forEach((g, k) => (g.visible = k <= level));

    const a = [target.x, target.y, target.z];
    const b = [camera.position.x, camera.position.y, camera.position.z];
    for (const entry of lines.values()) {
      entry.target = 1;
      if (entry.story > level) continue;
      const ax = entry.axis;
      let da;
      let db;
      if (entry.plane) {
        const { p, n } = entry.plane;
        da = (a[0] - p.x) * n.x + (a[1] - p.y) * n.y + (a[2] - p.z) * n.z;
        db = (b[0] - p.x) * n.x + (b[1] - p.y) * n.y + (b[2] - p.z) * n.z;
      } else {
        da = a[ax] - entry.value;
        db = b[ax] - entry.value;
      }
      if (da * db >= 0) continue;
      const t = da / (da - db);
      let inside = true;
      for (let i = 0; i < 3 && inside; i++) {
        if (i === ax && !entry.plane) continue;
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
        m.opacity = entry.opacity;
        m.depthWrite = entry.opacity > 0.95;
      }
    }
  }

  /**
   * The underside of the ceiling over `p` (Lennie) while the camera is below
   * it too, else Infinity. The see-through window around him leaves that
   * ceiling whole: a hole in it would show the floor above, which the cutaway
   * only hides once the camera rises (almost) to the ceiling. The attic has
   * no floor above, just the roof, so that may still be cut.
   */
  function ceilingOver(p, camera) {
    if (!isInside(p)) return Infinity;
    const k = storyAt(p.y);
    if (k >= HOUSE.stories - 1) return Infinity;
    // a little under it, so rounding never counts the ceiling's own face as below
    return camera.position.y < underCeiling(camera, k) ? (k + 1) * H - T - 0.02 : Infinity;
  }

  /** True when a mesh is hidden by the cutaway or faded out of the way, so aiming looks past it. */
  function isFaded(mesh) {
    for (let o = mesh; o; o = o.parent) if (!o.visible) return true;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const entry = matLine.get(mat) ?? lines.get(mesh.userData.line);
    return !!entry && entry.opacity < 0.5;
  }

  /** Smashes a window or a door out of its opening. */
  function breakPiece(piece) {
    if (piece.broken) return;
    piece.broken = true;
    piece.group.visible = false;
    world.removeBody(piece.body);
  }

  /** A door that took a knock sags in its frame, pushed towards `dir` (±1 along its normal). */
  function crackDoor(door, dir) {
    door.cracked = true;
    door.group.position.copy(door.center).addScaledVector(door.normal, 0.03 * dir);
    if (door.normal.z) door.group.rotation.z = 0.03 * dir;
    else door.group.rotation.x = 0.03 * dir;
  }

  /** Fixes the windows and doors, and puts all the mess and the knocked-over chairs back where they were. */
  function repairAll() {
    clutter.restock();
    loose.reset();
    tv.repair();
    for (const piece of [...windows, ...doors]) {
      if (piece.kind === 'door') {
        piece.cracked = false;
        piece.group.position.copy(piece.center);
        piece.group.rotation.set(0, 0, 0);
      }
      if (!piece.broken) continue;
      piece.broken = false;
      piece.group.visible = true;
      world.addBody(piece.body);
    }
  }

  return {
    nearHouse,
    windows,
    doors,
    stairBodies,
    isInside,
    isOnRoof,
    levelOf,
    locate,
    spawnPoint,
    spots,
    updateView,
    ceilingOver,
    isFaded,
    breakPiece,
    crackDoor,
    repairAll,
    tv,
    loose,
    scatter: clutter.scatter,
    update(dt) {
      loose.update();
      clutter.update(dt);
      tv.update(dt);
    },
    get cutLevel() { return level; },
  };
}
