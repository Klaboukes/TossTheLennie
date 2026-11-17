import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { textures, meterBoxUVs, floorGeometry } from './textures.js';
import { makeDetails, buildNeighbours, LAYOUT, PORCH_Y, HOUSE_NUMBERS } from './street.js';
import { buildClutter } from './clutter.js';
import { buildTV } from './tv.js';
import { hangDrawings, hangPainting, hangWhiteboard } from './drawings.js';
import { createLoose } from './loose.js';
import { parkBikes } from './bikes.js';

// A Dutch terraced house: two brick storeys and an attic under a steep roof,
// with a dormer. Footprint x ∈ [-4, 4], z ∈ [-5, 5]; the front door faces +z.
// The ground floor follows the owner's floor plan (GF below, and
// docs/house-design.md), with a utility room built on at the back. Floor 2
// follows the owner's floor plan too (F2 below): four rooms round a hallway at
// the top of the stairs. The attic follows the owner's floor plan too (ATTIC
// below): a wall from the back to the front, the loft with the washing
// machine on the left, the attic bedroom on the right. It's the second house in a block of
// five; the neighbours (solid, no rooms; see street.js) share one long roof.
export const HOUSE = { x0: -4, x1: 4, z0: -5, z1: 5, H: 3, T: 0.4, stories: 3, brickStories: 2, eaveY: 6, ridgeY: 11 };
// The roof's underside runs from the wall tops (eaveY at z = ±5) up to the ridge.
const PITCH = (HOUSE.ridgeY - HOUSE.eaveY) / HOUSE.z1;
const underside = (z) => HOUSE.ridgeY - PITCH * Math.abs(z);

const { H, T } = HOUSE;
const EXT = 0.25; // exterior wall thickness (visual)
const EXT_PHYS = 0.6; // physics walls are thicker (extending outwards) so fast throws don't tunnel
const INT = 0.18;
const INT_PHYS = 0.3;
const IN = { x0: -3.875, x1: 3.875, z0: -4.875, z1: 4.875 }; // inner wall faces
const OUT = { x0: -4.125, x1: 4.125, z0: -5.125, z1: 5.125 }; // outer wall faces
const WIN = { sill: 0.9, top: 2.2 };
// The dormer on the front slope, above the window column: a real bit of the
// attic (the bedroom), with a window Lennie can be thrown out of. `back` is
// where its flat roof meets the roof's underside, `front` the middle of its front wall.
export const DORMER = { x0: 0.6, x1: 3.2, back: HOUSE.ridgeY - 8.4, front: 4.0, top: 8.4, wallT: 0.2 };
const DOOR_TOP = 2.15;
const DOOR_COLORS = { inside: 0xf4f2ee, front: 0x3b3735 }; // the inside doors are white
// A wall faded out of the camera's way keeps this faint ghost of itself, but
// only with the camera well back from it: from close by, the ghost would lie
// over most of the picture like a grey haze. So it's fully see-through with
// the camera within CLEAR_NEAR metres of it, and the ghost only comes back
// gradually up to CLEAR_FAR. (supermarket.js does the same.)
const FADED = 0.12;
export const CLEAR_NEAR = 1.5;
export const CLEAR_FAR = 5;

// The ground floor follows the owner's sketch (docs/floorplan-floor1.png),
// stretched to the house's width: the toilet in the front left corner, the
// hallway beside it with the stairs going up along the left wall and the coat
// rack, the storage cupboard under the stairs, the kitchen at the front right,
// and the living room all across the back. These are the walls' centre lines.
const GF = {
  toiletZ: 3.05, // between the toilet and the hallway
  toiletX: -1.75, // the toilet's and the storage cupboard's right-hand walls
  hallX: -0.4, // between the hallway and the kitchen
  hallZ: 1.1, // the back of the hallway, with the door to the living room
  stairX: -2.86, // beside the stairs (the storage cupboard's left wall, and on floor 2 the corridor's wall)
  storeZ: -0.7, // the back of the storage cupboard, where the stairs reach floor 2
};
// Floor 2 follows the owner's floor plan (docs/floorplan-floor2.png), fitted
// round the stairs: they come up along the left wall and turn a quarter into
// the hallway. Behind the stairs and the hallway a kids room, in front of them
// the bathroom; on the right the bedroom at the back and the other kids room at
// the front. These are the walls' centre lines.
const F2 = {
  midX: -0.15, // between the left-hand rooms (and the hallway) and the right-hand ones
  backZ: GF.storeZ - INT / 2, // the back kids room's wall, its face level with the top of the stairs
  frontZ: 1.69, // the bathroom's back wall, over the stairs' third step
  rightZ: 0.45, // between the bedroom and the front kids room
};
// The utility room: a little flat-roofed extension behind the kitchen side,
// between the house and the garage (walls' centre lines; z1 is the house's back wall).
export const UTILITY = { x0: 0.75, x1: 4, z0: -6.7, z1: -5, top: 2.6 };
// The garage behind it, after the sketch: the same width, its door near the
// utility room in the side facing the garden (walls' centre lines; z1 is the
// utility room's back wall). Lennie can be thrown in through the open door.
export const GARAGE = { x0: UTILITY.x0, x1: UTILITY.x1, z0: -9.675, z1: UTILITY.z0, top: 2.6, door: [-7.92, -6.97] };

// Stairs, as in the floor plans. Flight A climbs storey 0→1 along −z against
// the left party wall, from the hallway beside the storage cupboard, and turns
// a quarter to the right at the top: four winders fanning out from the newel,
// the last one level with floor 2, so you step off into its hallway. It's a
// steep Dutch stair: its top stays at the back of the storage cupboard (the
// couch is right behind it), so its shorter steps leave room in the hallway to
// walk onto its bottom step, instead of that step butting against the toilet wall.
// Flight C to the attic is stacked above it and makes two quarter turns: two
// steps up from floor 2's hallway towards the left wall, four winders in the
// front corner of the stairwell, two steps back along the wall, and four
// winders over the top of flight A, arriving in the attic the same way.
const STAIR = { steps: 12, rise: 0.25, a: { x0: IN.x0, x1: -2.95, zHigh: GF.storeZ, run: 0.23, straight: 8 }, c: { first: 2, run: 0.23 } };
STAIR.width = STAIR.a.x1 - STAIR.a.x0;
STAIR.zTurn = STAIR.a.zHigh + STAIR.width; // where flight A's straight part meets its winders
STAIR.a.zLow = STAIR.zTurn + STAIR.a.straight * STAIR.a.run;
// The stairwell through floor 2 and the attic floor: over flight A from its
// third step up (the bathroom's floor reaches over the first two), up to the bathroom wall.
const WELL = { x0: STAIR.a.x0, x1: STAIR.a.x1, z0: STAIR.a.zHigh, z1: F2.frontZ - INT / 2 };
const HOLES = { 1: WELL, 2: WELL };
// The attic follows the owner's floor plan (docs/floorplan-attic.png): a wall
// from the back to the front, with a door near the top of the stairs. On the
// left the stairs come up, the washing machine and the dryer stand side by
// side at the back, and the rest is the loft, piled with boxes and junk
// (clutter.js); on the right the attic bedroom, with the bed against the
// right-hand wall and a low cabinet under the dormer window, and more junk at
// the back. midX is the wall's centre line, door its doorway.
export const ATTIC = { midX: -0.3, door: [-1.95, -1.05] };

// The bath on floor 2, all along the bathroom's left wall, and the beanbag in the front kids room.
const BATH2 = { x0: IN.x0, x1: -3.0, z0: F2.frontZ + INT / 2, z1: IN.z1 }; // all along the wall, from the bathroom's back wall to its front
const BEANBAG = { x: 1.2, z: 3.75 };
// The attic bedroom's bed, its head end standing free in the room and its
// foot just short of the dormer's side, and the low cabinet in the dormer,
// under its window (inner faces: the dormer's sides at 0.7 and 3.1, its front at 3.9).
const BED3 = { x0: 2.45, x1: IN.x1, z0: 0.3, z1: 2.5 };
const LOW3 = { x0: 0.72, x1: 3.08, z0: 3.32, z1: 3.89, h: 0.55 };

// White painted walls (no wallpaper) for the living room, the kitchen, the
// toilet, the hallway and the landing, the utility room, the bedrooms and the attic: a lived-in, slightly
// grubby white (textures.js), and in the living room with the kids' handprints
// and crayon on it too.
const WHITE_PAINT = { wall: 0xf4f1ea, wallTex: 'paint' };
const ROOMS = [
  {
    hall: { name: 'Hallway', floor: 'wood', ...WHITE_PAINT },
    left: { name: 'Living room', floor: 'wood', ...WHITE_PAINT, wallTex: 'kids' },
    right: { name: 'Kitchen', floor: 'tiles', floorTint: 0xf1ece2, ...WHITE_PAINT },
    toilet: { name: 'Toilet', floor: 'tiles', floorTint: 0xd9d4cc, ...WHITE_PAINT }, // white walls, tiles only on the floor
    storage: { name: 'Storage cupboard', floor: 'wood', ...WHITE_PAINT },
    utility: { name: 'Utility room', floor: 'tiles', floorTint: 0xc9c2b6, ...WHITE_PAINT },
    garage: { name: 'Garage', wall: 0xd6d2c9, wallTex: 'paint', floor: 'stone', floorTint: 0x9d9a94 },
  },
  {
    hall: { name: 'Landing', floor: 'wood', ...WHITE_PAINT },
    bedroom: { name: 'Bedroom', floor: 'wood', ...WHITE_PAINT },
    kids: { name: 'Kids room', floor: 'carpet', floorTint: 0x9fcf9a, ...WHITE_PAINT },
    kidsBack: { name: 'Kids room', floor: 'carpet', floorTint: 0xa9c6ea, ...WHITE_PAINT },
    bath: { name: 'Bathroom', wall: 0xf3f6f8, floor: 'tiles', floorTint: 0xcfe6f0, wallTex: 'tiles' },
  },
  {
    left: { name: 'Junk attic', floor: 'wood', ...WHITE_PAINT },
    right: { name: 'Attic bedroom', floor: 'carpet', floorTint: 0xd9c9ae, ...WHITE_PAINT },
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
  if (k === 1) {
    if (x < F2.midX) return z < F2.backZ ? R.kidsBack : z < F2.frontZ ? R.hall : R.bath;
    return z < F2.rightZ ? R.bedroom : R.kids;
  }
  return x < ATTIC.midX ? R.left : R.right;
}

// The front follows a 1970s Dutch terraced house: porch and front door on the
// left, a tall window column right of centre (one window per storey, dark
// panels between them) and small high windows top left. Openings are [a, b]
// along the wall plus optional sill/top heights and glazing bars (fractions).
// The side walls are party walls with the neighbours, so they have no windows.
const COLUMN = [0.8, 3.0];
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
  // the two small ones light the bathroom, the big one the front kids room
  [{ a: -3.75, b: -3.05, ...SMALL }, { a: -2.45, b: -1.25, ...SMALL }, { a: COLUMN[0], b: COLUMN[1], sill: 0.6, top: 2.5, bars: { v: [0.32], h: [] } }],
];
const BACK = [{ a: -3.5, b: -2.4 }, { a: 2.3, b: 3.4 }];
// The living room's back wall: one big window frame onto the garden, a wide
// pane with a side window on its left (seen from inside, by the TV), and the door to the utility room.
// The convector heating trench runs in the floor under it.
const BACK_GROUND = [{ a: -3.0, b: 0.65, sill: 0.55, bars: { v: [0.16], h: [] } }];
const UTILITY_DOOR = [0.95, 2.0];
const FRONT_DOOR = [-1.57, -0.57]; // its frame (0.07) stays just clear of the toilet and kitchen walls
// The toilet sticks out of the front, as in the floor plan: a little brick
// bump-out beside the front door, under the canopy, from the party wall to a
// little short of the toilet's own wall, so the front door keeps a strip of
// brick beside it (outer faces; the shared layout is in street.js).
const TOILET_OUT = { x0: OUT.x0 + LAYOUT.toilet[0], x1: OUT.x0 + LAYOUT.toilet[1], z1: LAYOUT.toiletFront, top: PORCH_Y };
// The row: a block of five, Lennie's house second from the left, so one
// neighbour on the left and three on the right. x0 / x1 are the row's two ends.
export const ROW = { width: OUT.x1 - OUT.x0, left: 1, right: 3 };
ROW.x0 = OUT.x0 - ROW.left * ROW.width;
ROW.x1 = OUT.x1 + ROW.right * ROW.width;
ROW.z0 = OUT.z0; // the row's back walls

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
    plywood: std({ map: tex.plywood, roughness: 0.9 }), // boarding up the neighbours' windows
    cladding: std({ color: 0xf1eee6, roughness: 0.7 }),
    darkRoof: std({ color: 0x35302e, roughness: 0.8 }),
    trim: std({ color: 0xfbfaf6, roughness: 0.6 }),
    base: std({ color: 0xa9a59d, roughness: 0.9 }), // the concrete top of the foundation, seen under a faded wall
    // Ceilings: a warm off-white, just set apart from the white walls. They face down,
    // where only the lawn's greenish bounce light reaches, so a glow of their own keeps them light.
    // A little grubby, like the walls (the glow too, or it would wash the grime out).
    ceiling: std({ map: tex.ceilingGrime, color: 0xf0ece3, emissive: 0xa8a398, emissiveMap: tex.ceilingGrime }),
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
  // the garage's green door (buildGarage)
  const GARAGE_DOOR = { slab: std({ color: 0x2f5d4a, roughness: 0.6 }), panel: std({ color: 0x29523f, roughness: 0.6 }), color: 0x2f5d4a };
  const wallpaperCache = new Map();
  const wallpaper = (room) => {
    const key = `${room.wall}-${room.wallTex ?? 'paper'}`;
    if (!wallpaperCache.has(key)) {
      // 'paint' is a painted wall, without the wallpaper's stripes but a bit grubby; 'kids' with handprints and crayon
      const map = { paint: tex.grime, kids: tex.kidsWall, tiles: tex.tiles }[room.wallTex] ?? tex.wallpaper;
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
    const b = new CANNON.Body({ mass: 0, material: surface.kind === 'roof' ? physMats.roof ?? physMats.hard : physMats.hard, shape: new CANNON.ConvexPolyhedron({ vertices: verts, faces: oriented }) });
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
    // (a door of its own colour, like the garage's, brings its own materials)
    const slab = o.leaf?.slab ?? (o.front ? M.frontDoor : M.door);
    const panel = o.leaf?.panel ?? (o.front ? M.frontDoorPanel : M.doorPanel);
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
    }
    let flap = null;
    if (o.catFlap && o.glazed) { // (only a glass door has room for one, in its lower pane)
      // A cat flap in the lower pane, for the cat (cat.js): a grey plastic
      // frame round a hole, set in the glass, and a smoky flap hanging from the
      // top of the hole that swings when the cat hops through. The frame is
      // thicker than the glass and thinner than the glazing beads, and stops
      // short of the beads below it, so none of its faces lie in one plane with theirs.
      const [W, w] = [0.16, 0.12]; // half the frame's width, half the hole's
      const [fy0, fy1] = [o.bottom + 0.215, o.bottom + 0.485]; // the frame's bottom and top
      const [hy0, hy1] = [o.bottom + 0.24, o.bottom + 0.46]; // the hole's
      M.flapFrame ??= std({ color: 0xd6d6d0, roughness: 0.5 });
      M.flap ??= std({ color: 0x6f7880, roughness: 0.25 });
      part(midA - W, midA + W, fy0, hy0, 0.05, M.flapFrame);
      part(midA - W, midA + W, hy1, fy1, 0.05, M.flapFrame);
      part(midA - W, midA - w, hy0, hy1, 0.05, M.flapFrame);
      part(midA + w, midA + W, hy0, hy1, 0.05, M.flapFrame);
      const pivot = new THREE.Group();
      const [hinge] = extents(run, at, midA, midA, hy1, hy1, 0);
      pivot.position.set(...hinge).sub(center);
      const [fmin, fmax] = extents(run, at, midA - w + 0.004, midA + w - 0.004, hy0 + 0.004, hy1 - 0.003, 0.008);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(fmax[0] - fmin[0], fmax[1] - fmin[1], fmax[2] - fmin[2]), lineMat(line, M.flap));
      plate.position.set((fmin[0] + fmax[0]) / 2, (fmin[1] + fmax[1]) / 2, (fmin[2] + fmax[2]) / 2).sub(center).sub(pivot.position);
      plate.userData.catFlap = true; // it swings, so it isn't glued to the rest of the door (batching.js)
      pivot.add(plate);
      group.add(pivot);
      // swing(d): the flap's bottom pushed out d (−1..1) along the door's normal
      const sign = run === 'x' ? -1 : 1;
      flap = { pivot, swing: (d) => (run === 'x' ? (pivot.rotation.x = sign * d * 1.2) : (pivot.rotation.z = sign * d * 1.2)) };
    }
    if (!o.glazed) {
      part(o.a + 0.01, o.b - 0.01, o.bottom + 0.01, o.top - 0.01, 0.06, slab);
      // raised panels on both faces
      part(o.a + 0.14, o.b - 0.14, o.bottom + 1.15, o.top - 0.16, 0.08, o.front && !o.leaf ? M.frontDoorGlass : panel);
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
      color: o.leaf?.color ?? (o.front ? DOOR_COLORS.front : DOOR_COLORS.inside),
      center,
      normal: run === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0),
      width: o.b - o.a,
      height: o.top - o.bottom,
      body: null,
      flap, // its cat flap, if it has one
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
      // on the ground floor the toilet carries on into its bump-out, through an open gap as wide as the bump-out inside
      openings: [...FRONT[k].map(win), ...(k === 0 ? [door(FRONT_DOOR, true), { a: OUT.x0, b: TOILET_OUT.x1 - EXT, bottom: y0, top: TOILET_OUT.top, open: true }] : [])],
      splits: k === 0 ? [GF.toiletX, GF.hallX] : [F2.midX],
      mats: { pos: M.brick, neg: (x) => wallpaper(roomAt(x, IN.z1 - 0.1)), ends: M.brick },
    });
    wall({
      ...common, run: 'x', at: HOUSE.z0, from: OUT.x0, to: OUT.x1, physOffset: -off, outward: -1, line: `north-${k}`,
      openings: k === 0 ? [...BACK_GROUND.map(win), { ...door(UTILITY_DOOR, false, true), catFlap: true }] : BACK.map(win),
      splits: k === 0 ? [] : [F2.midX],
      mats: { pos: (x) => wallpaper(roomAt(x, IN.z0 + 0.1)), neg: M.brick, ends: M.brick },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x0, from: IN.z0, to: IN.z1, physOffset: -off, outward: -1, line: `west-${k}`,
      splits: k === 0 ? [GF.storeZ, GF.toiletZ] : [F2.backZ, F2.frontZ],
      mats: { pos: (z) => wallpaper(roomAt(IN.x0 + 0.1, z)), neg: M.brick },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x1, from: IN.z0, to: IN.z1, physOffset: off, outward: 1, line: `east-${k}`,
      splits: k === 0 ? [GF.hallZ] : [F2.rightZ],
      mats: { pos: M.brick, neg: (z) => wallpaper(roomAt(IN.x1 - 0.1, z)) },
    });
    }

    // Interior walls
    const inner = { y0, y1, story: k, thick: INT, physThick: INT_PHYS };
    if (k === 0) buildGroundWalls(inner, R, door);
    else if (k === 1) buildFloor2Walls(inner, R, door);
    // (the attic's middle wall is cut to the roof line, see buildAttic)

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
    ] : k === 1 ? [
      [{ x0: IN.x0, x1: F2.midX, z0: IN.z0, z1: F2.backZ }, R.kidsBack],
      [{ x0: IN.x0, x1: F2.midX, z0: F2.backZ, z1: F2.frontZ }, R.hall],
      [{ x0: IN.x0, x1: F2.midX, z0: F2.frontZ, z1: IN.z1 }, R.bath],
      [{ x0: F2.midX, x1: IN.x1, z0: IN.z0, z1: F2.rightZ }, R.bedroom],
      [{ x0: F2.midX, x1: IN.x1, z0: F2.rightZ, z1: IN.z1 }, R.kids],
    ] : [
      [{ x0: IN.x0, x1: ATTIC.midX, z0: IN.z0, z1: IN.z1 }, R.left],
      [{ x0: ATTIC.midX, x1: IN.x1, z0: IN.z0, z1: IN.z1 }, R.right],
    ];
    for (const [rect, room] of floors) for (const r of rectMinus(rect, HOLES[k])) addFloor(r, room);
  }

  // ------------------------------------------------------------ slabs (floor 2 and the attic floor)
  // The ground floor sits on a foundation; the yard's ground plane is its physics.
  // Its concrete top is what you see under a faded wall: 4 mm above the grass (any
  // lower and the grass showed through there) and 6 mm under the floors, so it
  // lies in one plane with neither.
  const FOUND = [M.trim, M.trim, M.base, M.base, M.trim, M.trim];
  const FOUND_TOP = 0.004;
  // Its raised top layer stops 1 cm inside the walls' outer faces: level with them,
  // its sides lay in one plane with the walls' bottom 4 mm and flickered. The rest
  // stays under the grass, where the top layer's underside faces away from its top.
  const foundation = (x0, z0, x1, z1) => {
    box([x0, -0.3, z0], [x1, -0.005, z1], FOUND, { story: 0 });
    box([x0 + 0.01, -0.005, z0 + 0.01], [x1 - 0.01, FOUND_TOP, z1 - 0.01], FOUND, { story: 0 });
  };
  foundation(OUT.x0, OUT.z0, OUT.x1, OUT.z1);
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
  buildStairs();

  // Shared details (street.js); x = OUT.x0 + u for Lennie's house.
  const kit = { box, body, addMesh, groups, M, std, tex, physMats, world, HOUSE, OUT, EXT, ROW, DORMER };
  const details = makeDetails(kit);
  const ux = ([u0, u1]) => [OUT.x0 + u0, OUT.x0 + u1];
  buildRoof();
  details.porch({ x0: ux(LAYOUT.porch)[0], x1: ux(LAYOUT.porch)[1], fascia: M.canopy }); // over the toilet's bump-out (built below) and the door
  details.houseNumber(HOUSE_NUMBERS[0], OUT.x0 + LAYOUT.number, 'south-0');
  details.downpipe(OUT.x0 + LAYOUT.pipe, 2.55, (k) => ({ story: k, line: `south-${k}` }));
  buildNeighbours(kit, details);
  buildUtility();
  buildGarage();
  buildToiletOut();
  // the dining chairs, the piano stool and the small round tables, which Lennie knocks over (loose.js)
  const loose = createLoose(world, physMats.loose);
  const garage = {}; // the garage's shelves, table and pegboard, whose stuff clutter.js makes loose
  buildFurniture();
  // the kids' drawings and paintings on the living room's white walls, and the photos of friends in the toilet (drawings.js)
  const wx = IN.x0 + 0.006; // just off the left and right walls' faces
  const ex = IN.x1 - 0.006;
  hangDrawings(kit, [
    { pic: 0, face: '+x', x: wx, y: 1.45, z: -2.2, w: 0.56, tilt: 0.04, line: 'west-0' }, // above the couch
    { pic: 3, face: '+x', x: wx, y: 1.78, z: -1.45, w: 0.46, tilt: -0.06, line: 'west-0' },
    { pic: 5, face: '-z', x: -2.3, y: 1.6, z: GF.storeZ - INT / 2 - 0.006, w: 0.7, line: 'storeback-0' }, // behind the couch
    { pic: 2, face: '-x', x: ex, y: 1.5, z: -3.4, w: 0.55, tilt: -0.05, line: 'east-0' }, // by the dining table
    { pic: 6, face: '-x', x: ex, y: 1.82, z: -2.6, w: 0.45, tilt: 0.07, line: 'east-0' },
    // (the hallway door fills the hallway's back wall, so these two hang past the painting, by the piano)
    { pic: 1, face: '-x', x: ex, y: 1.5, z: -0.1, w: 0.44, tilt: -0.05, line: 'east-0' },
    { pic: 4, face: '-x', x: ex, y: 1.42, z: 0.55, w: 0.36, tilt: 0.05, line: 'east-0' },
    { pic: 7, face: '+x', x: wx, y: 1.88, z: -3.05, w: 0.5, tilt: -0.03, line: 'west-0' }, // above the TV's corner
    // framed snapshots of friends in the toilet: on its back wall, its side, and in its bump-out by the loo
    { pic: 8, face: '+z', x: -2.95, y: 1.62, z: GF.toiletZ + INT / 2 + 0.006, w: 0.42, tilt: 0.02, line: 'toilet-0' },
    { pic: 9, face: '+z', x: -2.15, y: 1.48, z: GF.toiletZ + INT / 2 + 0.006, w: 0.36, tilt: -0.02, line: 'toilet-0' },
    { pic: 10, face: '+x', x: wx, y: 1.55, z: 4.3, w: 0.42, line: 'west-0' },
    { pic: 11, face: '+x', x: wx, y: 1.6, z: 5.4, w: 0.36, tilt: 0.02, line: 'toiletoutw-0' },
  ]);
  // the big black-and-white painting of a medieval town on the wall behind the dining table (drawings.js)
  hangPainting(kit, { face: '-x', x: IN.x1, y: 1.62, z: -1.25, w: 1.5, h: 0.98, line: 'east-0' });
  // the family's week schedule on a whiteboard, on the kitchen side of the wall to the hallway, between the counters (drawings.js)
  hangWhiteboard(kit, { face: '+x', x: GF.hallX + INT / 2, y: 1.5, z: 2.75, w: 1.2, h: 0.78, line: 'kitchenside-0' });
  // the TV on its cabinet, which cracks and sparks when Lennie hits it (tv.js)
  const tv = buildTV(kit);
  // the mess: dishes, toys, clothes, household stuff and the board game closet (clutter.js)
  const clutter = buildClutter({ ...kit, H, garage });
  doors.push(...clutter.doors);
  // smash the storage cupboard's door and everything stuffed in it comes pouring out
  const storeDoor = doors.find((d) => d.story === 0 && Math.abs(d.center.x - GF.toiletX) < 0.05 && d.center.z > GF.storeZ && d.center.z < GF.hallZ);
  storeDoor.onBreak = clutter.spillStorage;

  // ------------------------------------------------------------ stairs
  // Flight A from the hallway to floor 2, and flight C stacked above it to the
  // attic (see STAIR). A flight's steps are solid down to the floor they stand
  // on; the ones over the stairwell are blocks about two steps deep, so their
  // undersides step down like a real stair's.
  function buildStairs() {
    const { a: A, c: C, rise, width: w, zTurn } = STAIR;
    const stairMats = [M.stairSide, M.stairSide, M.wood, M.stairSide, M.stairSide, M.stairSide];
    const boxStep = (min, max, story, id) => {
      box(min, max, stairMats, { story, cast: true });
      stairBodies.push(body(min, max, physMats.hard, { kind: 'stair', id }));
    };
    // a winder: its outline in plan ([x, z] points), extruded from y0 up to y1
    const wedgeStep = (pts, y0, y1, story, id) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2); // the outline lies flat: (x, -z) at depth d goes to (x, d, z)
      geo.translate(0, y0, 0);
      const mesh = new THREE.Mesh(geo, [M.wood, M.stairSide]); // its top and bottom, then its sides
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      groups[story].add(mesh);
      const n = pts.length;
      const points = [...pts.map(([x, z]) => [x, y0, z]), ...pts.map(([x, z]) => [x, y1, z])];
      const faces = [[...Array(n).keys()], [...Array(n).keys()].map((i) => n + i)];
      for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
      stairBodies.push(convexBody(points, faces, { kind: 'stair', id }));
    };
    const lerp2 = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    // The n winders of a quarter turn, fanning out from the newel N round the
    // square N, A, C, B: A is the far end of the edge you come in over, C the
    // outer corner, B the far end of the edge you leave over.
    const winders = (N, Ain, Cout, Bout, n) => {
      const at = (th) => (th <= Math.PI / 4 + 1e-9 ? lerp2(Ain, Cout, Math.tan(th)) : lerp2(Bout, Cout, Math.tan(Math.PI / 2 - th)));
      return [...Array(n).keys()].map((j) => [N, at((j * Math.PI) / 2 / n), at(((j + 1) * Math.PI) / 2 / n)]);
    };
    const nTurn = STAIR.steps - A.straight;
    // the turn at the top of flight A, and again (a storey up) at the top of flight C
    const topTurn = winders([A.x1, zTurn], [A.x0, zTurn], [A.x0, A.zHigh], [A.x1, A.zHigh], nTurn);

    // Flight A: straight up from the hallway, then the turn into floor 2's hallway
    for (let i = 0; i < A.straight; i++) {
      boxStep([A.x0, 0, A.zLow - (i + 1) * A.run], [A.x1, (i + 1) * rise, A.zLow - i * A.run], 0, `A${i}`);
    }
    topTurn.forEach((pts, j) => wedgeStep(pts, 0, (A.straight + j + 1) * rise, 0, `A${A.straight + j}`));

    // Flight C: its steps' tops, and how deep the ones over the stairwell are
    const top = (s) => H + (s + 1) * rise;
    const DEEP = 2 * rise - 0.05;
    const zFront = WELL.z1;
    const zCorner = zFront - w; // where its front turn meets the part along the wall
    let s = 0;
    // two steps on floor 2's hallway floor, heading for the left wall
    for (; s < C.first; s++) boxStep([A.x1 + (C.first - s - 1) * C.run, H, zCorner], [A.x1 + (C.first - s) * C.run, top(s), zFront], 1, `C${s}`);
    // a quarter turn in the stairwell's front corner, towards the back
    for (const pts of winders([A.x1, zCorner], [A.x1, zFront], [A.x0, zFront], [A.x0, zCorner], nTurn)) wedgeStep(pts, top(s) - DEEP, top(s), 1, `C${s++}`);
    // back along the wall, over flight A
    const along = STAIR.steps - C.first - 2 * nTurn;
    const runAlong = (zCorner - zTurn) / along;
    for (let i = 0; i < along; i++, s++) boxStep([A.x0, top(s) - DEEP, zCorner - (i + 1) * runAlong], [A.x1, top(s), zCorner - i * runAlong], 1, `C${s}`);
    // and a quarter turn over the top of flight A, into the attic
    for (const pts of topTurn) wedgeStep(pts, top(s) - DEEP, top(s), 1, `C${s++}`);

    // The newel post where flight A turns, on floor 2 just clear of the steps,
    // with a short rail to a second post by flight C's first steps.
    const x0 = A.x1 + 0.005;
    const post = (za, zb) => box([x0, H, za], [x0 + 0.09, H + 1.0, zb], M.stairSide, { story: 1, cast: true });
    const [p0, p1] = [zTurn + 0.045, zCorner - 0.095]; // the posts' inner faces
    post(zTurn - 0.045, p0);
    post(p1, zCorner - 0.005);
    // the rail runs into both posts, the balusters up into the rail
    box([x0 + 0.015, H + 0.86, p0 - 0.02], [x0 + 0.075, H + 0.92, p1 + 0.02], M.wood, { story: 1, cast: true });
    for (const f of [1 / 3, 2 / 3]) {
      const z = p0 + (p1 - p0) * f;
      box([x0 + 0.03, H, z - 0.015], [x0 + 0.06, H + 0.87, z + 0.015], M.stairSide, { story: 1 });
    }
    body([x0, H, zTurn - 0.045], [x0 + 0.09, H + 1.0, zCorner - 0.005], physMats.hard, { kind: 'furniture' });
  }

  // ------------------------------------------------------------ floor 2's own walls
  // After the floor plan (F2): the back kids room's wall across the top of the
  // stairs and the hallway, the bathroom's wall in front of them, the middle
  // wall from the back to the front with the doors to the bedroom and the front
  // kids room, and the wall between those two.
  function buildFloor2Walls(inner, R, door) {
    const paper = (room) => wallpaper(R[room]);
    const { midX, backZ, frontZ, rightZ } = F2;
    wall({
      ...inner, run: 'x', at: backZ, from: IN.x0, to: midX - INT / 2, line: 'kidsback-1',
      openings: [door([-1.3, -0.4])], mats: { pos: paper('hall'), neg: paper('kidsBack') },
    });
    wall({
      ...inner, run: 'x', at: frontZ, from: IN.x0, to: midX - INT / 2, line: 'bathback-1',
      openings: [door([-1.75, -0.85])], mats: { pos: paper('bath'), neg: paper('hall') },
    });
    wall({
      ...inner, run: 'z', at: midX, from: IN.z0, to: IN.z1, line: 'mid-1',
      openings: [door([-0.62, 0.27]), door([0.63, 1.52])],
      splits: [backZ, rightZ, frontZ],
      mats: {
        pos: (z) => paper(z < rightZ ? 'bedroom' : 'kids'),
        neg: (z) => paper(z < backZ ? 'kidsBack' : z < frontZ ? 'hall' : 'bath'),
      },
    });
    wall({
      ...inner, run: 'x', at: rightZ, from: midX + INT / 2, to: IN.x1, line: 'kidsfront-1',
      mats: { pos: paper('kids'), neg: paper('bedroom') },
    });
  }

  // ------------------------------------------------------------ the ground floor's own walls
  // The toilet's two walls, the wall between the hallway and the kitchen, the
  // hallway's back wall (with the door to the living room), and the storage
  // cupboard under the stairs. The kitchen and the living room are open to
  // each other: only the bar, the counter behind it and the piano stand between them.
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
      openings: [door([-1.58, -0.58], false, true)], // a glass door, filling the hall between the storage cupboard and the kitchen
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
  // fridge with an open Kallax full of shoes beside it, and the cat's litter
  // box with the coat rack above it (the fridge and the Kallax are in
  // clutter.js). The garage is behind it (buildGarage). Its
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
    foundation(xo, zo, OUT.x1, OUT.z0);
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
      openings: [{ a: -6.35, b: -5.3, bottom: 0, top: DOOR_TOP, slack: DOOR_SLACK, glazed: true, catFlap: true }], // the garden door, with a cat flap
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
    foundation(xo, zo, OUT.x1, zu);
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
      // its green door is shut; Lennie cracks it, then smashes through it, like the doors in the house
      openings: [{ a: G.door[0], b: G.door[1], bottom: 0, top: DOOR_TOP, slack: DOOR_SLACK, leaf: GARAGE_DOOR }],
      mats: { pos: paint, neg: M.brick, ends: M.brick },
    });
    wall({
      ...ext, run: 'z', at: G.x1, from: zi, to: zu, physOffset: off, outward: 1, line: 'garage-e',
      mats: { pos: M.brick, neg: paint },
    });
    // the flat roof, carrying on from the utility room's (they meet, so they don't overlap and flicker)
    const rMin = [xo - 0.1, G.top, zo - 0.1];
    const rMax = [OUT.x1, G.top + 0.2, zu];
    box(rMin, rMax, [M.trim, M.trim, M.darkRoof, M.ceiling, M.trim, M.trim], { story: 1, cast: true, line: 'garage-roof' });
    body([rMin[0], G.top - 0.1, rMin[2]], rMax, physMats.hard, { kind: 'roof' });
    // a fluorescent tube on the ceiling (with the roof, so it goes when the cutaway lifts that off)
    box([1.8, G.top - 0.06, -8.3], [3.0, G.top - 0.005, -8.22], std({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 0.9 }), { story: 1 });
  }

  // ------------------------------------------------------------ the toilet's bump-out
  // The toilet carries on through a gap in the front wall into a little brick
  // bump-out under the canopy, whose underside is its ceiling. Its front has
  // the toilet's window of two breeze blocks. Each wall fades on its own line.
  function buildToiletOut() {
    const T = TOILET_OUT;
    const tiles = wallpaper(ROOMS[0].toilet);
    const off = (EXT_PHYS - EXT) / 2;
    const zi = T.z1 - EXT; // inner face of its front
    const ext = { y0: 0, y1: T.top, story: 0, thick: EXT, physThick: EXT_PHYS };
    foundation(T.x0, OUT.z1, T.x1, T.z1);
    const floor = new THREE.Mesh(floorGeometry(IN.x0, IN.z1, T.x1 - EXT, zi), floorMat(ROOMS[0].toilet));
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    groups[0].add(floor);
    wall({
      ...ext, run: 'x', at: T.z1 - EXT / 2, from: T.x0, to: T.x1, physOffset: off, outward: 1, line: 'toiletout-0',
      mats: { pos: M.brick, neg: tiles, ends: M.brick },
    });
    // its window: two breeze blocks in the wall, too small for Lennie to fly through (street.js)
    const cx = (T.x0 + T.x1) / 2;
    details.toiletWindow(cx, T.z1, 1, 'toiletout-0');
    details.toiletWindow(cx, zi, -1, 'toiletout-0');
    // the side on the party wall, and the one beside the front door
    wall({ ...ext, run: 'z', at: HOUSE.x0, from: IN.z1, to: zi, physOffset: -off, outward: -1, line: 'toiletoutw-0', mats: { pos: tiles, neg: M.brick } });
    wall({ ...ext, run: 'z', at: T.x1 - EXT / 2, from: OUT.z1, to: zi, physOffset: off, outward: 1, line: 'toiletoute-0', mats: { pos: M.brick, neg: tiles } });
  }

  // ------------------------------------------------------------ attic
  // The top floor is the attic, after the owner's floor plan (ATTIC): no front
  // or back wall (the roof slopes down to the floor), gable walls shared with
  // the neighbours, a middle wall from the back to the front cut to the roof
  // line, and the dormer on the front of the bedroom, with a window to throw
  // Lennie out of.
  function buildAttic(k, R, off) {
    const y0 = k * H;
    const left = wallpaper(R.left);
    const bedroom = wallpaper(R.right);
    // the gable (party) walls, one room each, cut to the roof line
    const gable = [[IN.z0, y0], [IN.z1, y0], [IN.z1, underside(IN.z1)], [0, HOUSE.ridgeY], [IN.z0, underside(IN.z0)]];
    prismWall({ run: 'z', at: HOUSE.x0, poly: gable, thick: EXT, physThick: EXT_PHYS, physOffset: -off, mats: { pos: left, neg: M.brick }, story: k, line: `west-${k}` });
    prismWall({ run: 'z', at: HOUSE.x1, poly: gable, thick: EXT, physThick: EXT_PHYS, physOffset: off, mats: { pos: M.brick, neg: bedroom }, story: k, line: `east-${k}` });

    // the middle wall from the back to the front, with its door near the top of the stairs
    const line = `mid-${k}`;
    const [d0, d1] = ATTIC.door;
    const dTop = y0 + DOOR_TOP;
    const mid = (poly) => prismWall({ run: 'z', at: ATTIC.midX, poly, thick: INT, physThick: INT_PHYS, mats: { pos: bedroom, neg: left }, story: k, line });
    mid([[IN.z0, y0], [d0, y0], [d0, underside(d0)], [IN.z0, underside(IN.z0)]]);
    mid([[d0, dTop], [d1, dTop], [d1, underside(d1)], [d0, underside(d0)]]);
    mid([[d1, y0], [IN.z1, y0], [IN.z1, underside(IN.z1)], [0, HOUSE.ridgeY], [d1, underside(d1)]]);
    addDoor('z', ATTIC.midX, { a: d0, b: d1, bottom: y0, top: dTop }, INT_PHYS, 0, k, line);
    for (const [a, b, ya, yb] of [[d0 - 0.07, d0, y0, dTop + 0.07], [d1, d1 + 0.07, y0, dTop + 0.07], [d0 - 0.07, d1 + 0.07, dTop, dTop + 0.07]]) {
      const [min, max] = extents('z', ATTIC.midX, a, b, ya, yb, INT + 0.05);
      box(min, max, M.trim, { story: k, line });
    }

    // the dormer's sides: inside the bedroom below the roof line, white cladding above it
    const zf = DORMER.front + DORMER.wallT / 2; // the dormer's outside face
    const below = [[DORMER.back, y0], [zf, y0], [zf, underside(zf)], [DORMER.back, DORMER.top]];
    const above = [[DORMER.back, DORMER.top], [zf, DORMER.top], [zf, underside(zf)]];
    for (const [x, out, name] of [[DORMER.x0, -1, 'cheekl'], [DORMER.x1, 1, 'cheek']]) {
      const cheek = (poly, mats) => prismWall({ run: 'z', at: x, poly, thick: DORMER.wallT, physThick: 0.3, mats, story: k, line: `${name}-${k}` });
      cheek(below, { pos: bedroom, neg: bedroom });
      cheek(above, out > 0 ? { pos: M.cladding, neg: bedroom } : { pos: bedroom, neg: M.cladding });
    }

    // the dormer's front wall, with a breakable window; it fits between the
    // sides (running into one, its corner flickered)
    wall({
      run: 'x', at: DORMER.front, from: DORMER.x0 + DORMER.wallT / 2, to: DORMER.x1 - DORMER.wallT / 2, y0, y1: DORMER.top,
      thick: DORMER.wallT, physThick: 0.5, physOffset: 0.15, outward: 1, story: k, line: `dormer-${k}`,
      openings: [{ a: 1.1, b: 2.7, bottom: underside(zf) + 0.45, top: DORMER.top - 0.25, glass: true, bars: { v: [0.5], h: [] }, slack: SLACK }],
      mats: { pos: M.cladding, neg: bedroom, ends: M.cladding },
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
      const b = new CANNON.Body({ mass: 0, material: physMats.roof ?? physMats.hard, shape: new CANNON.Box(new CANNON.Vec3((x1 - x0) / 2, (thick + inner) / 2, L / 2)) });
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
      // The gutter along the eave, in front of the fascia. Its rim sticks up
      // past the tiles, so a Lennie sliding down the roof gets caught in it
      // (stranded on the roof) rather than always sliding off the edge.
      const g0 = runOut + 0.13; // plan distance of its back, just clear of the fascia
      const gz = [side * g0, side * (g0 + 0.22)].sort((p, q) => p - q);
      const gTop = fy + thick * hyp + 0.25;
      for (const [x0, x1, story] of sections) {
        const [a, b] = [x0 === ends[0] ? x0 - 0.04 : x0, x1 === ends[1] ? x1 + 0.04 : x1];
        box([a, fy + 0.05, gz[0]], [b, gTop, gz[1]], M.pipe, { story, cast: true, line: story === 3 ? line : null });
      }
      const lip = [side * (runOut - 0.02), side * (g0 + 0.22)].sort((p, q) => p - q);
      const gb = body([ends[0], fy + thick * hyp - 0.1, lip[0]], [ends[1], gTop, lip[1]], physMats.roof ?? physMats.hard, { kind: 'roof' });
      gb.surface.sound = 'metal';
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
    for (const [x, z] of [[-0.8, 2.6], [0.0, 1.2], [-1.35, -2.8]]) details.vent(x, z, 3, LINES[z > 0 ? 1 : -1]);
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
      for (const [x, kind] of [[0.95, 'round'], [1.11, 'cactus'], [1.7, 'spiky'], [2.03, 'flower'], [2.5, 'round'], [2.81, 'spiky']]) {
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
    // The kitchen cupboards' doors: 4 mm apart, 10 cm above the floor (the
    // plinth) and 1.5 cm under the worktop, sitting on the carcass's front,
    // each with a steel handle near its top. A drawer above the oven.
    function kitchenDoors() {
      const NO = { phys: false };
      const GAP = 0.004;
      const DT = 0.018; // a door's thickness
      const parts = [];
      // `axis` the run's direction, `face` where the carcass's front is, `out` which way it faces (±1)
      const slab = (axis, u0, u1, y0, y1, w0, w1, color, opts) => {
        const [a, b] = [Math.min(w0, w1), Math.max(w0, w1)];
        parts.push(axis === 'x' ? [[u0, y0, a], [u1, y1, b], color, opts] : [[a, y0, u0], [b, y1, u1], color, opts]);
      };
      const door = (axis, face, out, u0, u1, y0 = 0.1, y1 = 0.835, hy = 0.775) => {
        const front = face + out * (0.001 + DT);
        slab(axis, u0, u1, y0, y1, face + out * 0.001, front, KITCHEN_DOOR, NO);
        const c = (u0 + u1) / 2;
        const l = Math.min(0.12, u1 - u0 - 0.04) / 2;
        slab(axis, c - l, c + l, hy - 0.006, hy + 0.006, front, front + out * 0.016, null, { ...STEEL, phys: false });
      };
      const run = (axis, face, out, u0, u1, n) => {
        const w = (u1 - u0) / n;
        for (let i = 0; i < n; i++) door(axis, face, out, u0 + i * w + GAP / 2, u0 + (i + 1) * w - GAP / 2);
      };
      // along the front, either side of the oven, and the drawer above it
      run('x', 4.225, -1, KITCHEN_FRONT + 0.006, -0.156, 1);
      run('x', 4.225, -1, 0.556, 3.2, 5);
      door('x', 4.225, -1, -0.15, 0.55, 0.758, 0.835, 0.8);
      // along the right wall, and the kitchen side of the counter across the back
      run('z', 3.225, -1, 2.01, 4.2, 4);
      run('x', 1.985, 1, 0.97, 3.2, 4);
      return parts;
    }

    // The piano's 52 white keys are one strip with the gaps between them
    // painted on (pianoKeys()); the 36 black keys sit on it, 3 mm sunk in.
    const KEYS = { x0: 2.25, x1: 3.79, n: 52, y0: 0.76, y: 0.775, z0: 0.36, z1: 0.5 };
    function blackKeys() {
      const kw = (KEYS.x1 - KEYS.x0) / KEYS.n;
      const parts = [];
      // from the bottom A: a black key after every A, C, D, F and G
      for (let i = 0; i < KEYS.n - 1; i++) {
        if (!'ACDFG'.includes('ABCDEFG'[i % 7])) continue;
        const x = KEYS.x0 + (i + 1) * kw;
        parts.push([[x - kw * 0.3, KEYS.y - 0.003, KEYS.z0 + 0.055], [x + kw * 0.3, KEYS.y + 0.012, KEYS.z1 - 0.005], 0x121113, { phys: false }]);
      }
      // the cheeks at either end of the keyboard
      parts.push([[KEYS.x0 - 0.03, KEYS.y0, 0.33], [KEYS.x0, 0.8, 0.55], PIANO], [[KEYS.x1, KEYS.y0, 0.33], [KEYS.x1 + 0.03, 0.8, 0.55], PIANO]);
      return parts;
    }
    function pianoKeys() {
      const c = document.createElement('canvas');
      [c.width, c.height] = [1024, 32];
      const g = c.getContext('2d');
      g.fillStyle = '#fbfaf5';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#8d8a84';
      for (let i = 1; i < KEYS.n; i++) g.fillRect(Math.round((i / KEYS.n) * c.width) - 1, 0, 2, c.height);
      const map = new THREE.CanvasTexture(c);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
      const keys = new THREE.Mesh(new THREE.BoxGeometry(KEYS.x1 - KEYS.x0, KEYS.y - KEYS.y0, KEYS.z1 - KEYS.z0), std({ map, roughness: 0.35 }));
      keys.position.set((KEYS.x0 + KEYS.x1) / 2, (KEYS.y0 + KEYS.y) / 2, (KEYS.z0 + KEYS.z1) / 2);
      keys.receiveShadow = true;
      groups[0].add(keys);
    }
    // An open book of piano music on the music desk, leaning back against the piano.
    function sheetMusic() {
      const [W, Hh] = [512, 352];
      const c = document.createElement('canvas');
      [c.width, c.height] = [W, Hh];
      const g = c.getContext('2d');
      g.fillStyle = '#f7f1e1';
      g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#d9d0b8';
      g.fillRect(W / 2 - 2, 0, 4, Hh); // the fold
      g.strokeStyle = '#2b2b2b';
      g.fillStyle = '#2b2b2b';
      let s = 5;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (const px of [0, W / 2]) {
        g.fillRect(px + 70, 22, 116, 7); // the title, as a squiggle-free bar
        for (let row = 0; row < 6; row++) {
          const top = 50 + row * 49;
          g.lineWidth = 1.2;
          for (let l = 0; l < 5; l++) {
            g.beginPath();
            g.moveTo(px + 16, top + l * 6);
            g.lineTo(px + W / 2 - 16, top + l * 6);
            g.stroke();
          }
          g.lineWidth = 1.5;
          for (const bx of [px + 16, px + 82, px + 148, px + 214, px + W / 2 - 16]) {
            g.beginPath();
            g.moveTo(bx, top);
            g.lineTo(bx, top + 24);
            g.stroke();
          }
          for (let n = 0; n < 12; n++) {
            const x = px + 30 + n * 18 + (n >> 2) * 2;
            const y = top - 3 + Math.floor(rnd() * 10) * 3;
            g.beginPath();
            g.ellipse(x, y, 4, 3, -0.4, 0, Math.PI * 2);
            g.fill();
            g.beginPath();
            g.moveTo(x + 3.5, y);
            g.lineTo(x + 3.5, y - 17);
            g.stroke();
          }
        }
      }
      const map = new THREE.CanvasTexture(c);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
      const paper = std({ color: 0xf7f1e1, roughness: 0.9 });
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.003), [paper, paper, paper, paper, paper, std({ map, roughness: 0.9 })]);
      const lean = 0.1;
      // its bottom edge on the desk, just behind the lip; its top 1 cm clear of the piano's front
      book.position.set(3.02, 0.9215 + 0.16 * Math.cos(lean), 0.5035 + 0.16 * Math.sin(lean));
      book.rotation.x = lean;
      book.receiveShadow = true;
      groups[0].add(book);
    }
    const WOOD = 0x9b6a3f;
    const WHITE = 0xf4f2ee;
    // A hollow tub Lennie can land in: its bottom, four sides and the water.
    const hollowTub = (tub) => [
      [[tub.x0, 0, tub.z0], [tub.x1, 0.12, tub.z1], WHITE],
      [[tub.x0, 0.12, tub.z0], [tub.x0 + 0.08, 0.55, tub.z1], WHITE],
      [[tub.x1 - 0.08, 0.12, tub.z0], [tub.x1, 0.55, tub.z1], WHITE],
      [[tub.x0 + 0.08, 0.12, tub.z0], [tub.x1 - 0.08, 0.55, tub.z0 + 0.08], WHITE],
      [[tub.x0 + 0.08, 0.12, tub.z1 - 0.08], [tub.x1 - 0.08, 0.55, tub.z1], WHITE],
      [[tub.x0 + 0.08, 0.12, tub.z0 + 0.08], [tub.x1 - 0.08, 0.14, tub.z1 - 0.08], 0x8fd3f0, { phys: false }],
    ];

    // --- Storey 0, after the sketch (docs/floorplan-floor1.png)
    const SOFA = 0x4a4d52; // dark grey
    const SOFA_ARM = 0x3f4247;
    const SOFA_CUSHION = 0x585c62;
    // the kitchen: white cupboards (the carcass a shade greyer than the doors,
    // so the gaps between the doors show) under beige worktops
    const CABINET = 0xe6e4de;
    const KITCHEN_DOOR = 0xf8f7f3;
    const WORKTOP = 0xd6c29b;
    const PIANO = 0x1d1a1c;
    const STEEL = { mat: std({ color: 0xc9ced3, roughness: 0.35, metalness: 0.3 }) };
    const KITCHEN_FRONT = GF.hallX + INT / 2;
    // the bar: its top from x0 to the right-hand wall, from z0 (by the piano)
    // to z1 (the kitchen counter's back); its white body from x = body, level
    // with the counter's cupboards; the pole near its left end at (pole, poleZ)
    const BAR = { x0: 0.92, body: 0.95, pole: 0.98, z0: 1.135, z1: 1.43, top: 1.25 };
    BAR.poleZ = (BAR.z0 + BAR.z1) / 2;
    // A little wooden cabinet of six drawers (two across, three high) on the
    // bar, its back to the right-hand wall (5 mm off it), its drawers facing
    // along the bar, two of them left pulled out a bit. Drawn only; one body
    // for the whole thing.
    const DRAWERS = { x0: 3.62, x1: 3.87, z0: 1.15, z1: 1.435, h: 0.42 };
    function drawerCabinet() {
      const { x0: X0, x1: X1, z0: Z0, z1: Z1, h: HH } = DRAWERS;
      const NO = { phys: false };
      const METAL = { mat: std({ color: 0x34322f, roughness: 0.4, metalness: 0.6 }), phys: false };
      const [CARCASS, FRONT, BACK, INSIDE] = [0xa8774b, 0xb3824f, 0x6f4c2e, 0xc49a6c];
      const T = 0.012; // the boards
      const U = Z1 - Z0;
      const D = X1 - X0;
      const Y0 = BAR.top;
      const parts = [];
      // u across the front (z), y up from the bar top, w from the front (x0) back to the wall
      const p = (u0, u1, y0, y1, w0, w1, color, opts = NO) => parts.push([[X0 + w0, Y0 + y0, Z0 + u0], [X0 + w1, Y0 + y1, Z0 + u1], color, opts]);
      // the carcass: the boards fit between each other, so no two faces lie in one plane
      p(0, U, HH - T, HH, 0, D, CARCASS); // top
      p(0, T, 0, HH - T, 0, D, CARCASS); // the sides
      p(U - T, U, 0, HH - T, 0, D, CARCASS);
      p(T, U - T, 0, T, 0, D, CARCASS); // bottom
      p(T, U - T, T, HH - T, D - 0.008, D, BACK); // the back
      const UM = U / 2;
      p(UM - T / 2, UM + T / 2, T, HH - T, 0, D - 0.008, CARCASS); // the divider
      const rowH = (HH - 4 * T) / 3;
      const cols = [[T, UM - T / 2], [UM + T / 2, U - T]];
      for (const [a, b] of cols) for (let r = 1; r < 3; r++) p(a, b, T + r * rowH + (r - 1) * T, T + r * (rowH + T), 0, D - 0.008, CARCASS); // the shelves
      // the drawers: a front 3 mm inside its opening with a cup handle on it;
      // [column, row] → how far it's pulled out
      const OUT = { '0,0': 0.09, '1,1': 0.05 };
      cols.forEach(([a, b], c) => {
        for (let r = 0; r < 3; r++) {
          const y0 = T + r * (rowH + T);
          const y1 = y0 + rowH;
          const P = OUT[`${c},${r}`] ?? 0;
          p(a + 0.003, b - 0.003, y0 + 0.003, y1 - 0.003, 0.002 - P, 0.016 - P, FRONT);
          const [m, ym] = [(a + b) / 2, (y0 + y1) / 2];
          p(m - 0.035, m + 0.035, ym - 0.01, ym + 0.016, -0.001 - P, 0.002 - P, null, METAL); // the handle's plate
          p(m - 0.035, m + 0.035, ym - 0.014, ym - 0.005, -0.012 - P, -0.001 - P, null, METAL); // ... and its cup
          if (!P) continue;
          // a pulled-out drawer shows its sides and bottom
          p(a + 0.004, a + 0.012, y0 + 0.002, y1 - 0.025, 0.016 - P, 0.2 - P, INSIDE);
          p(b - 0.012, b - 0.004, y0 + 0.002, y1 - 0.025, 0.016 - P, 0.2 - P, INSIDE);
          p(a + 0.012, b - 0.012, y0 + 0.002, y0 + 0.008, 0.016 - P, 0.2 - P, INSIDE);
        }
      });
      body([X0, Y0, Z0], [X1, Y0 + HH, Z1], physMats.hard, { kind: 'furniture' });
      return parts;
    }
    piece(0, [
      // living room: the corner couch with its back to the storage cupboard,
      // facing the garden, as long as the low white cabinet behind it
      [[-3.875, 0, -1.6], [-0.6, 0.45, -0.8], SOFA, { soft: true }],
      [[-3.875, 0, -2.4], [-2.85, 0.45, -1.6], SOFA, { soft: true }],
      [[-3.875, 0.45, -1.1], [-0.6, 0.88, -0.8], SOFA, { soft: true }],
      // the arms end against the back cushion, so their ends don't flicker against its ends
      [[-3.875, 0.45, -2.4], [-3.65, 0.66, -1.1], SOFA_ARM, { soft: true }],
      [[-0.82, 0.45, -1.6], [-0.6, 0.66, -1.1], SOFA_ARM, { soft: true }],
      [[-3.62, 0.45, -2.35], [-2.9, 0.52, -1.15], SOFA_CUSHION, { soft: true, phys: false }],
      [[-2.8, 0.45, -1.55], [-2.18, 0.52, -1.12], SOFA_CUSHION, { soft: true, phys: false }],
      [[-2.13, 0.45, -1.55], [-1.52, 0.52, -1.12], SOFA_CUSHION, { soft: true, phys: false }],
      [[-1.47, 0.45, -1.55], [-0.85, 0.52, -1.12], SOFA_CUSHION, { soft: true, phys: false }],
      // the low cabinet behind the couch (the TV's painted cabinet is in clutter.js, full of toys)
      [[-1.55, 0, -0.75], [-0.6, 0.55, -0.35], WHITE],
      // the comfy chair by the back window, just in front of the heating trench
      [[-0.25, 0, -4.6], [0.75, 0.42, -3.5], SOFA, { soft: true }],
      [[-0.25, 0.42, -4.6], [0.75, 1.05, -4.3], SOFA, { soft: true }],
      [[-0.25, 0.42, -4.3], [-0.05, 0.65, -3.5], SOFA_ARM, { soft: true }],
      [[0.55, 0.42, -4.3], [0.75, 0.65, -3.5], SOFA_ARM, { soft: true }],
      // the dining table (its six chairs and the piano stool are loose, below)
      ...table(1.9, -2.2, 3.0, -0.3, 0.78, 0xc9a06a),
      // the piano against the right-hand wall (5 mm off it), its back to the bar
      [[2.17, 0, 0.55], [3.87, 1.25, 1.12], PIANO],
      [[2.22, 0.68, 0.33], [3.82, 0.76, 0.55], PIANO],
      // (the keys are below: pianoKeys())
      [[2.22, 0, 0.38], [2.3, 0.68, 0.46], PIANO],
      [[3.74, 0, 0.38], [3.82, 0.68, 0.46], PIANO],
      // the music desk above the keys, with a little lip the sheet music stands against (its book is below)
      [[2.57, 0.9, 0.5], [3.47, 0.92, 0.552], PIANO, { phys: false }],
      [[2.58, 0.92, 0.494], [3.46, 0.935, 0.5005], PIANO, { phys: false }],
      // The bar between the piano and the kitchen, as high as the piano: the
      // counter's back raised up in white, as long as the counter, under a
      // wooden top, and near its left end a wooden pole from the top up to the
      // ceiling (its foot 2 cm sunk into the top). The bar's top stops 1.5 cm
      // behind the piano, so the two tops don't touch.
      [[BAR.body, 0, BAR.z0 + 0.025], [IN.x1, BAR.top - 0.04, BAR.z1], CABINET],
      [[BAR.x0, BAR.top - 0.04, BAR.z0], [IN.x1, BAR.top, BAR.z1 + 0.02], null, { mat: M.wood }],
      [[BAR.pole - 0.035, BAR.top - 0.02, BAR.poleZ - 0.035], [BAR.pole + 0.035, H - T, BAR.poleZ + 0.035], WOOD],
      ...drawerCabinet(),
      // kitchen: a U of counters, along the front under the window, along the right wall, and across the back
      // against the bar (the worktops reach 2.5 cm over the cupboard doors, see kitchenDoors())
      [[KITCHEN_FRONT, 0, 4.225], [IN.x1, 0.85, 4.875], CABINET],
      [[KITCHEN_FRONT, 0.85, 4.2], [IN.x1, 0.9, 4.875], WORKTOP],
      [[3.225, 0, 1.985], [IN.x1, 0.85, 4.225], CABINET],
      [[3.2, 0.85, 2.01], [IN.x1, 0.9, 4.2], WORKTOP],
      [[0.95, 0, BAR.z1], [IN.x1, 0.85, 1.985], CABINET],
      [[0.93, 0.85, BAR.z1], [IN.x1, 0.9, 2.01], WORKTOP],
      ...kitchenDoors(),
      ...blackKeys(),
      // (the hanging cupboard on the side wall, above the counter, is in clutter.js: Lennie smashes its doors)
      // the cooker: a black hob on the counter and the oven under it
      [[-0.2, 0.9, 4.3], [0.6, 0.912, 4.8], 0x18181a, { phys: false }],
      [[-0.15, 0.1, 4.205], [0.55, 0.75, 4.225], 0x2b2b2e, { phys: false }],
      // the steel extractor hood above it, its chimney up to the ceiling
      [[-0.27, 1.58, 4.28], [0.67, 1.7, 4.875], null, STEEL],
      [[-0.23, 1.575, 4.32], [0.63, 1.58, 4.84], 0x3a3c40, { phys: false }],
      [[0.07, 1.7, 4.6], [0.33, H - T, 4.875], null, STEEL],
      // toilet: the loo against the front of its bump-out, and the little hand basin in the corner
      [[-3.45, 0, 5.725], [-2.95, 0.85, 5.95], WHITE],
      [[-3.4, 0, 5.225], [-3.0, 0.42, 5.725], WHITE],
      [[-3.42, 0.42, 5.195], [-2.98, 0.45, 5.695], 0xe6e1d8, { phys: false }],
      [[-3.875, 0.75, 3.2], [-3.5, 0.85, 3.6], WHITE],
      [[-3.75, 0, 3.33], [-3.63, 0.75, 3.47], WHITE],
      // hallway: the coat rack on the toilet wall, with the family's coats on it
      [[-2.75, 1.62, 2.92], [-1.95, 1.72, 2.96], WOOD, { phys: false }],
      [[-2.72, 0.85, 2.74], [-2.46, 1.62, 2.92], 0xd95d39, { phys: false }],
      [[-2.44, 0.95, 2.76], [-2.21, 1.62, 2.92], 0x2c3e5a, { phys: false }],
      [[-2.19, 1.15, 2.78], [-1.99, 1.62, 2.92], 0xf2c14e, { phys: false }],
      // utility room: the cat's litter box, and above it the coat rack on the
      // back wall (the coats are loose, clutter.js; the fridge and the Kallax are there too)
      [[1.25, 1.6, -6.575], [2.35, 1.7, -6.553], WOOD, { phys: false }],
      ...[1.42, 1.63, 1.84, 2.03, 2.2].map((x) => [[x - 0.012, 1.615, -6.553], [x + 0.012, 1.64, -6.5], WOOD, { phys: false }]), // the hooks
      // a big litter tray, drawn only: a solid rim made Lennie bounce right out
      // of it again, so now he lands on the floor inside it (its spot is generous too)
      [[1.3, 0.012, -6.55], [2.3, 0.03, -5.9], 0x4a7fa8, { phys: false }],
      [[1.3, 0.03, -6.55], [1.33, 0.17, -5.9], 0x4a7fa8, { phys: false }],
      [[2.27, 0.03, -6.55], [2.3, 0.17, -5.9], 0x4a7fa8, { phys: false }],
      [[1.33, 0.03, -6.55], [2.27, 0.17, -6.52], 0x4a7fa8, { phys: false }],
      [[1.33, 0.03, -5.93], [2.27, 0.17, -5.9], 0x4a7fa8, { phys: false }],
      [[1.33, 0.03, -6.52], [2.27, 0.1, -5.93], 0xd8c9a3, { phys: false }],
    ]);
    pianoKeys();
    sheetMusic();
    // the six dining chairs and the piano stool, loose so Lennie knocks them
    // over instead of getting stuck between them (loose.js); on the ground floor, so y is as built
    const knockable = (parts, mass) => loose.add(groups[0], parts.map(([min, max, color]) => [min, max, col(color)]), { mass, surface: { kind: 'furniture' } });
    for (const z of [-1.85, -1.25, -0.65]) {
      knockable(chair(1.5, z, 1, 0xd95d39), 5);
      knockable(chair(3.4, z, -1, 0xd95d39), 5);
    }
    knockable([[[2.62, 0, -0.05], [3.42, 0.5, 0.3], PIANO]], 9);

    // burners on the hob
    for (const [x, z] of [[0.0, 4.43], [0.4, 4.43], [0.0, 4.67], [0.4, 4.67]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 20).rotateX(Math.PI / 2), col(0x55555a));
      ring.position.set(x, 0.915, z);
      groups[0].add(ring);
    }
    rug(0, -1.55, 4.2, -0.5, 4.8, 0x6b5a45); // the doormat

    // the convector heating trench in the floor along the back window, from the
    // TV's corner to the comfy chair: a long wooden grille, a little way out from the wall
    const trench = { a: BACK_GROUND[0].a + 0.15, b: -0.35, z0: IN.z0 + 0.15 };
    const grille = rug(0, trench.a, trench.z0, trench.b, trench.z0 + 0.26, 0xffffff);
    grille.material = std({ map: grilleTexture(trench.b - trench.a), roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });

    // plants on the kitchen window sill, either side of the tap
    windowPlants();

    // the small round side table in front of the couch: an oak top on three black legs
    roundTable(-1.7, -2.3, 0.3, 0.45, 0xc8a172, 0x26262a);
    // and the low round table at the lounge set in the garden (garden.js), on a rattan stand
    {
      const [x, z, r, h] = [2.0, -11.25, 0.42, 0.42];
      loose.add(groups[0], [
        [[x - r, h - 0.04, z - r], [x + r, h, z + r], col(0xd8d2c4), { round: true }],
        [[x - r * 0.65, 0, z - r * 0.65], [x + r * 0.65, h - 0.04, z + r * 0.65], col(0x7d7368), { round: true }],
      ], { mass: 8, surface: { kind: 'furniture' } });
    }
    // and the bikes and the moped along the garden's left-hand bushes (bikes.js), loose too
    parkBikes(loose, groups[0], std);

    // --- the garage (buildGarage): camping shelves along the garden side,
    // a table on the far side, tool shelves against the utility room with a
    // pegboard above them. Everything on them is loose (clutter.js), so
    // crashing into them brings it all down; their bodies go there in `garage`.
    const NO = { phys: false };
    const SHELF = 0x8b8f94; // grey steel shelving
    const shelving = (x0, z0, x1, z1, levels, color, name) => {
      const top = levels[levels.length - 1] + 0.03;
      const parts = [];
      for (const [x, z] of [[x0, z0], [x1 - 0.04, z0], [x0, z1 - 0.04], [x1 - 0.04, z1 - 0.04]]) parts.push([[x, 0, z], [x + 0.04, top, z + 0.04], color, NO]);
      for (const y of levels) parts.push([[x0 + 0.005, y, z0 + 0.04], [x1 - 0.005, y + 0.03, z1 - 0.04], color, NO]);
      // one solid block for the lot, so Lennie can't get wedged between the shelves
      garage[name] = body([x0, 0, z0], [x1, top, z1], physMats.hard, { kind: 'furniture' });
      return parts;
    };
    const GZ0 = GARAGE.z0 + EXT / 2; // inner face of its back wall
    const GZ1 = GARAGE.z1 - EXT / 2; // the utility room's wall
    const GX0 = GARAGE.x0 + EXT / 2;
    piece(0, [
      ...shelving(GX0, GZ0 + 0.05, GX0 + 0.5, -8.05, [0.08, 0.6, 1.12, 1.64, 2.1], SHELF, 'camping'),
      ...table(3.05, GZ0 + 0.05, IN.x1 - 0.02, -8.2, 0.85, 0x8a6a48).map((part) => [...part.slice(0, 3), NO]),
      ...shelving(1.7, GZ1 - 0.4, IN.x1, GZ1, [0.1, 0.5, 0.9], SHELF, 'tools'),
      [[1.75, 0.93, GZ1 - 0.02], [IN.x1 - 0.02, 1.85, GZ1 - 0.005], 0xc9b48f, NO], // the pegboard
    ]);
    // one solid block for the table and what's under it, and the pegboard (so a knock on it brings the tools down)
    garage.table = body([3.05, 0, GZ0], [IN.x1, 0.85, -8.2], physMats.hard, { kind: 'furniture' });
    garage.pegboard = body([1.75, 0.96, GZ1 - 0.06], [IN.x1, 1.85, GZ1], physMats.hard, { kind: 'furniture' });
    // a bike against the back wall, between the shelves and the table (a size smaller, to fit in between)
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
      bike.position.set(2.21, 0, GZ0 + 0.22);
      bike.rotation.x = -0.06;
      bike.scale.setScalar(0.9);
      groups[0].add(bike);
      body([1.42, 0, GZ0], [3.0, 0.95, GZ0 + 0.4], physMats.hard, { kind: 'furniture' });
    }

    // --- Storey 1, after the floor plan (docs/floorplan-floor2.png)
    // A single bed along z, its head end against the wall at zh (zh < zf): mattress, duvet and pillow.
    const bed = (x0, x1, zh, zf, frame, duvet) => {
      const [m0, m1] = [zh + 0.12, zf - 0.05];
      return [
        [[x0, 0, zh], [x1, 0.86, zh + 0.09], frame], // the headboard
        [[x0, 0, zh + 0.09], [x1, 0.32, zf], frame],
        [[x0 + 0.03, 0.32, m0], [x1 - 0.03, 0.58, m1], WHITE, { soft: true }],
        [[x0 + 0.01, 0.58, m1 - (m1 - m0) * 0.62], [x1 - 0.01, 0.61, m1 + 0.02], duvet, NO], // over the foot two-thirds
        [[x0 + 0.1, 0.58, m0 + 0.05], [x1 - 0.1, 0.69, m0 + 0.45], 0xffffff, NO],
      ];
    };
    // A bed across x (the big one), head end at xh against the wall.
    const bedX = (xh, xf, z0, z1, frame, duvet) => [
      [[xh - 0.09, 0, z0], [xh, 0.9, z1], frame],
      [[xf, 0, z0], [xh - 0.09, 0.32, z1], frame],
      [[xf + 0.05, 0.32, z0 + 0.03], [xh - 0.12, 0.58, z1 - 0.03], WHITE, { soft: true }],
      [[xf + 0.03, 0.58, z0 + 0.01], [xf + 0.05 + (xh - xf) * 0.62, 0.61, z1 - 0.01], duvet, NO],
      [[xh - 0.57, 0.58, z0 + 0.1], [xh - 0.17, 0.69, (z0 + z1) / 2 - 0.04], 0xffffff, NO],
      [[xh - 0.57, 0.58, (z0 + z1) / 2 + 0.04], [xh - 0.17, 0.69, z1 - 0.1], 0xffffff, NO],
    ];
    // A tall cabinet with its doors facing `face` (±1 along z): body, door seams and knobs.
    const cabinet = (x0, x1, z0, z1, h, color, face, doors) => {
      const zf = face > 0 ? z1 : z0;
      const parts = [[[x0, 0, z0], [x1, h, z1], color]];
      const dw = (x1 - x0) / doors;
      const seam = (a, b) => [[a, 0.04, face > 0 ? zf : zf - 0.004], [b, h - 0.04, face > 0 ? zf + 0.004 : zf], 0x6b5340, NO];
      for (let i = 1; i < doors; i++) parts.push(seam(x0 + i * dw - 0.004, x0 + i * dw + 0.004));
      for (let i = 0; i < doors; i++) {
        const kx = x0 + i * dw + (i % 2 ? 0.07 : dw - 0.07);
        parts.push([[kx - 0.012, h * 0.48, face > 0 ? zf : zf - 0.025], [kx + 0.012, h * 0.48 + 0.1, face > 0 ? zf + 0.025 : zf], 0xc9ced3, NO]);
      }
      return parts;
    };
    const { midX, backZ, rightZ } = F2;
    const [L1, R1] = [midX - INT / 2, midX + INT / 2]; // the middle wall's faces
    piece(1, [
      // the back kids room: a low cabinet under the window, the bed against
      // the middle wall, a high clothes cabinet by the door, and the toy box
      [[IN.x0, 0, IN.z0], [-3.3, 0.8, -3.3], 0xd9c3a0],
      [[-3.3, 0.06, -4.8], [-3.296, 0.74, -4.07], 0xc2a77f, NO], // its two doors' faces, apart
      [[-3.3, 0.06, -4.03], [-3.296, 0.74, -3.36], 0xc2a77f, NO],
      ...bed(-1.2, L1 - 0.01, IN.z0, -2.85, 0x7d9cc0, 0x3fa7d6),
      ...cabinet(IN.x0, -2.55, -1.5, backZ - INT / 2 - 0.005, 2.0, 0xe9e4da, -1, 2),
      [[-2.25, 0, IN.z0], [-1.3, 0.5, -4.25], 0xe24a4a],
      // the bedroom: the bureau against the back wall, the big bed with its
      // head against the right-hand wall, a nightstand, and a high clothes
      // cabinet against the front kids room's wall
      ...table(R1 + 0.06, IN.z0, 1.9, -4.3, 0.76, WOOD),
      [[0.7, 0.86, -4.8], [1.3, 1.22, -4.77], 0x111114], // the monitor, on its stand
      [[0.97, 0.76, -4.82], [1.03, 0.86, -4.7], 0x2a2a2e, NO],
      [[0.9, 0.765, -4.86], [1.1, 0.775, -4.66], 0x2a2a2e, NO],
      [[0.73, 0.765, -4.58], [1.27, 0.785, -4.42], 0x2f3035, NO], // the keyboard
      ...bedX(IN.x1, 1.7, -3.55, -1.65, WOOD, 0x7c6bc4),
      [[3.425, 0, -1.6], [IN.x1, 0.5, -1.15], WOOD],
      ...cabinet(1.2, IN.x1, -0.25, rightZ - INT / 2 - 0.005, 2.1, 0xb48a5c, -1, 4),
      // the front kids room: a high clothes cabinet against the bedroom's wall,
      // the bureau along the middle wall, and the bed along the right-hand wall
      ...cabinet(1.8, IN.x1, rightZ + INT / 2 + 0.005, 1.15, 2.0, 0xe9e4da, 1, 2),
      ...table(R1 + 0.005, 2.7, 0.6, 4.3, 0.76, 0xf2f2ee),
      ...bed(2.9, IN.x1, 2.75, IN.z1, 0x5aa36a, 0xf2a03d),
      // the bathroom: the tub along the left wall, the loo against the front,
      // and the sink cabinet against the middle wall
      ...hollowTub(BATH2),
      [[-2.2, 0, 4.3], [-1.72, 0.42, 4.85], WHITE],
      [[-2.24, 0.42, 4.75], [-1.68, 0.85, IN.z1], WHITE],
      [[-0.75, 0, 3.0], [L1 - 0.005, 0.85, 4.3], 0xf2f2ee],
      [[-0.754, 0.08, 3.05], [-0.75, 0.78, 3.63], 0xdcdcd6, NO], // its two doors, apart
      [[-0.754, 0.08, 3.67], [-0.75, 0.78, 4.25], 0xdcdcd6, NO],
    ]);
    // the sink: a white basin set in the cabinet's top, with a tap from the wall side
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.05, 24), col(0xffffff, { roughness: 0.3 }));
    basin.scale.set(0.8, 1, 1.15);
    basin.position.set(-0.5, H + 0.876, 3.65);
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 10).rotateZ(Math.PI / 2), col(0xc9ced3, { roughness: 0.3, metalness: 0.6 }));
    tap.position.set(-0.36, H + 1.0, 3.65);
    const tapFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 10), tap.material);
    tapFoot.position.set(-0.28, H + 0.925, 3.65);
    // the mirror above it, just off the wall
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.75, 0.9), col(0xbfd3dc, { roughness: 0.08, metalness: 0.7 }));
    mirror.position.set(L1 - 0.007, H + 1.6, 3.65);
    for (const m of [basin, tap, tapFoot, mirror]) {
      m.receiveShadow = true;
      groups[1].add(m);
    }
    // The shower over the bath, at the end by the door: a glass screen on the
    // tub's rim (it shatters like a window), held by a chrome strip on the wall
    // and edged with one at its free end (the glass's ends tucked into both),
    // and a shower head on a rail on the left-hand wall.
    const chrome = col(0xc9ced3, { roughness: 0.25, metalness: 0.7 });
    const SCREEN = { x: BATH2.x1 - 0.04, z0: BATH2.z0 + 0.01, z1: BATH2.z0 + 0.82, y0: H + 0.55, y1: H + 1.95 };
    box([SCREEN.x - 0.018, SCREEN.y0, BATH2.z0], [SCREEN.x + 0.018, SCREEN.y1 + 0.02, SCREEN.z0 + 0.02], chrome, { story: 1 });
    box([SCREEN.x - 0.016, SCREEN.y0, SCREEN.z1 - 0.005], [SCREEN.x + 0.016, SCREEN.y1 + 0.01, SCREEN.z1 + 0.015], chrome, { story: 1 });
    const pane = { a: SCREEN.z0, b: SCREEN.z1, bottom: SCREEN.y0, top: SCREEN.y1, bars: { v: [], h: [] } };
    addWindow('z', SCREEN.x, pane, pane, 0.06, 0, 1, 1, null); // (see-through anyway, so it never fades)
    const zs = BATH2.z0 + 0.4;
    for (const [geo, x, y, rz] of [
      [new THREE.BoxGeometry(0.06, 0.08, 0.2), IN.x0 + 0.03, H + 0.9, 0], // the mixer tap
      [new THREE.CylinderGeometry(0.012, 0.012, 1.1, 10), IN.x0 + 0.03, H + 1.49, 0], // the rail
      [new THREE.BoxGeometry(0.1, 0.02, 0.02), IN.x0 + 0.07, H + 2.04, 0], // the arm
      [new THREE.CylinderGeometry(0.07, 0.05, 0.03, 18), IN.x0 + 0.14, H + 2.02, -0.5], // the head, tipped towards the bath
    ]) {
      const m = new THREE.Mesh(geo, chrome);
      m.position.set(x, y, zs);
      m.rotation.z = rz;
      groups[1].add(m);
    }
    rug(1, 0.55, -3.6, 1.6, -1.6, 0xe8d6f5); // beside the big bed
    rug(1, 0.95, 1.75, 2.75, 3.55, 0xffe08a, true); // in the front kids room
    rug(1, -2.6, -3.9, -1.45, -2.4, 0xf4b6c8, true); // in the back kids room
    rug(1, -2.85, 2.95, -2.1, 3.7, 0x8fc6dc); // the bath mat
    const beanbag = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), col(0xff7f50));
    beanbag.scale.set(1, 0.7, 1);
    beanbag.position.set(BEANBAG.x, H + 0.35, BEANBAG.z);
    beanbag.castShadow = true;
    groups[1].add(beanbag);
    const bb = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(0.42) });
    bb.position.set(BEANBAG.x, H + 0.3, BEANBAG.z);
    bb.surface = { kind: 'cushion' };
    world.addBody(bb);

    // --- Storey 2: the attic, after the floor plan (docs/floorplan-attic.png).
    // The bedroom's bed along the right-hand wall, its head end standing free,
    // and the low cabinet in the dormer under the window. (The washing machine
    // and the dryer, and all the junk in the loft, are in clutter.js.)
    piece(2, [
      ...bed(BED3.x0, BED3.x1, BED3.z0, BED3.z1, 0x8a6f55, 0x5f8f7a),
      ...cabinet(LOW3.x0, LOW3.x1, LOW3.z0, LOW3.z1, LOW3.h, 0xb48a5c, -1, 4),
    ]);
    rug(2, 0.6, 0.5, 2.2, 2.3, 0xc9b28f);
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
    S('bath', 'In the bath!', 500, 'SPLASH!', [BATH2.x0, H, BATH2.z0], [BATH2.x1, H + 1.0, BATH2.z1]),
    S('loo', 'On the loo!', 500, 'OOPS!', [-2.3, H + 0.3, 4.2], [-1.62, H + 1.1, 4.9]),
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [BED3.x0 - 0.05, 2 * H + 0.3, BED3.z0 + 0.05], [BED3.x1 + 0.03, 2 * H + 1.1, BED3.z1 + 0.05]),
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [1.65, H + 0.3, -3.6], [3.9, H + 1.1, -1.6]),
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [-1.25, H + 0.3, -4.85], [-0.2, H + 1.1, -2.8]),
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [2.85, H + 0.3, 2.7], [3.9, H + 1.1, 4.9]),
    S('beanbag', 'Beanbag flop!', 250, 'FLUMP!', [BEANBAG.x - 0.6, H + 0.4, BEANBAG.z - 0.6], [BEANBAG.x + 0.6, H + 1.2, BEANBAG.z + 0.6]),
    S('toybox', 'On the toy box!', 250, 'TOYS!', [-2.3, H + 0.45, -4.9], [-1.25, H + 1.2, -4.2]),
    S('table', 'On the dinner table!', 200, 'DINNER!', [1.85, 0.75, -2.25], [3.05, 1.45, -0.25]),
    S('counter', 'On the kitchen counter', 200, 'CHEF!', [-0.35, 0.88, 4.15], [3.9, 1.55, 4.9]),
    S('counter', 'On the kitchen counter', 200, 'CHEF!', [3.15, 0.88, 2.0], [3.9, 1.55, 4.2]),
    S('counter', 'On the kitchen counter', 200, 'CHEF!', [0.9, 0.88, 1.44], [3.9, 1.55, 2.05]),
    S('bar', 'On the bar!', 250, 'CHEERS!', [0.85, 1.2, 1.13], [3.9, 2.0, 1.44]),
    S('couch', 'Couch potato', 150, 'AHH!', [-3.9, 0.3, -2.45], [-0.55, 1.2, -0.75]),
    S('armchair', 'Comfy in the armchair', 150, 'AHH!', [-0.3, 0.3, -4.65], [0.8, 1.2, -3.45]),
    S('piano', 'On the piano!', 350, 'PLINK!', [2.12, 1.2, 0.5], [3.9, 2.0, 1.13]),
    S('loo', 'On the loo!', 500, 'OOPS!', [-3.5, 0.3, 5.12], [-2.9, 1.1, 5.95]),
    S('litter', 'In the cat litter!', 400, 'EWW!', [1.0, 0, -6.6], [2.6, 0.75, -5.6]),
    S('junk', 'On the junk pile!', 300, 'CLATTER!', [3.0, 0.8, -9.6], [3.9, 1.9, -8.15]),
    S('camping', 'Up on the camping shelf!', 450, 'CAMPING!', [GARAGE.x0 + 0.07, 2.05, -9.6], [GARAGE.x0 + 0.67, 2.6, -8.0]),
    S('lounge', 'Chilling on the lounge set', 200, 'AHH!', [0.85, 0.25, -12.05], [3.98, 1.1, -9.8]),
    ...clutter.spots,
  ];

  // a clear bit of floor on each storey: the living room, floor 2's hallway
  // (between the stairs and its doors), and in the attic the landing at the top
  // of the stairs, on the way to the middle wall's door
  const SPAWN = [{ x: 0.2, z: -2.6 }, { x: -1.3, z: 0.45 }, { x: -1.85, z: -0.4 }];
  function spawnPoint(level) {
    if (level >= 3) return { x: -1.0, z: 0.2, height: HOUSE.ridgeY + 0.3 };
    return { ...SPAWN[level], height: level * H + 0.05 };
  }
  // Where Lennie sits when the game starts (and after R and each new turn):
  // in the comfy chair by the back window, his hips a little forward of its
  // back so his shins hang clear of the seat's front edge (ragdoll.js sit()).
  const homeSeat = { x: 0.25, z: -3.87, seat: 0.42, yaw: 0 };

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
      if (inside) entry.target = FADED * THREE.MathUtils.smoothstep(Math.abs(db), CLEAR_NEAR, CLEAR_FAR);
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

  /**
   * Smashes a window or a door out of its opening. Returns what came out
   * behind it, if anything ({ n, mess }: the storage cupboard's junk).
   */
  function breakPiece(piece) {
    if (piece.broken) return null;
    piece.broken = true;
    piece.group.visible = false;
    world.removeBody(piece.body);
    return piece.onBreak?.() ?? null;
  }

  /** A door that took a knock sags in its frame, pushed towards `dir` (±1 along its normal). */
  function crackDoor(door, dir) {
    door.cracked = true;
    if (door.onCrack) return door.onCrack(dir); // the game closet's doors swing ajar instead
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
        piece.flap?.swing(0);
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
    homeSeat,
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
    takeSmashes: clutter.takeSmashes,
    update(dt) {
      loose.update();
      clutter.update(dt);
      tv.update(dt);
    },
    get cutLevel() { return level; },
  };
}
