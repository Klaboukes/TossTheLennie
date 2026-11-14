import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { textures, meterBoxUVs, floorGeometry } from './textures.js';
import { makeDetails, buildNeighbours, LAYOUT } from './street.js';
import { buildClutter } from './clutter.js';

// A Dutch terraced house: two brick storeys and an attic under a steep roof,
// with a dormer. Footprint x ∈ [-6, 6], z ∈ [-5, 5]; the front door faces +z.
// Each floor: a hallway with the stairs along the back, and two rooms at the
// front split by a wall at x = 1. Neighbours (solid, no rooms; see street.js)
// continue the row on both sides under one long roof.
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
const DOOR_COLORS = { inside: 0xc9935f, front: 0x3b3735 };
const FADED = 0.12;

// Stairs: flight A climbs storey 0→1 along +x in the back strip; flight B
// climbs 1→2 along −x in the strip in front of it (a switchback).
const STAIR = { steps: 12, rise: 0.25, run: 0.3, xLow: -1.8, xHigh: 1.8, stripA: [IN.z0, -3.7], stripB: [-3.7, HALL_Z - INT / 2] };
const HOLES = {
  1: { x0: STAIR.xLow, x1: STAIR.xHigh, z0: STAIR.stripA[0], z1: STAIR.stripA[1] },
  2: { x0: STAIR.xLow, x1: STAIR.xHigh, z0: STAIR.stripB[0], z1: STAIR.stripB[1] },
};

const ROOMS = [
  {
    hall: { name: 'Hallway', wall: 0xeadfc8, floor: 'wood' },
    left: { name: 'Living room', wall: 0xf4d88a, floor: 'wood' },
    right: { name: 'Kitchen', wall: 0xbfe4cf, floor: 'tiles', floorTint: 0xf1ece2 },
  },
  {
    hall: { name: 'Landing', wall: 0xeadfc8, floor: 'wood' },
    left: { name: 'Bedroom', wall: 0xd2c3ea, floor: 'wood' },
    right: { name: 'Kids room', wall: 0xa9d5f2, floor: 'carpet', floorTint: 0x9fcf9a },
  },
  {
    hall: { name: 'Attic landing', wall: 0xeadfc8, floor: 'wood' },
    left: { name: 'Attic study', wall: 0xcadbb0, floor: 'wood' },
    right: { name: 'Attic bathroom', wall: 0xf3f6f8, floor: 'tiles', floorTint: 0xcfe6f0, wallTex: 'tiles' },
  },
];

// The front follows a 1970s Dutch terraced house: porch and front door on the
// left, a tall window column right of centre (one window per storey, dark
// panels between them) and small high windows top left. Openings are [a, b]
// along the wall plus optional sill/top heights and glazing bars (fractions).
// The side walls are party walls with the neighbours, so they have no windows.
const COLUMN = [1.2, 4.5];
// The low windows (the bedroom's small high ones and the dormer's) look as
// small as the real ones, but give Lennie some slack to get through (see `wall`).
const SLACK = { side: 0.15, below: 0.35, above: 0.2 };
const SMALL = { sill: 1.45, top: 2.25, bars: { v: [], h: [] }, slack: SLACK };
const FRONT = [
  [{ a: -4.8, b: -2.9 }, { a: COLUMN[0], b: COLUMN[1], bars: { v: [1 / 3, 2 / 3], h: [0.7] } }],
  [{ a: -5.7, b: -4.6, ...SMALL }, { a: -4.0, b: -2.6, ...SMALL }, { a: COLUMN[0], b: COLUMN[1], sill: 0.6, top: 2.5, bars: { v: [0.32], h: [] } }],
];
const BACK = [{ a: -5.2, b: -3.8 }, { a: 3.6, b: 5.0 }];
const FRONT_DOOR = [-2.2, -1.1];
// The row: our house in the middle and this many neighbours on each side.
export const ROW = { width: 12.25, perSide: 2 };
ROW.half = 6.125 + ROW.perSide * ROW.width;

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
    spandrel: std({ map: tex.grooves, color: 0x5a4458, roughness: 0.6 }),
    glassSky: std({ map: tex.glassSky, roughness: 0.15 }),
    glassWarm: std({ map: tex.glassWarm, roughness: 0.3 }),
    breezeBlock: std({ map: tex.breezeBlock, roughness: 0.9 }), // one block per face (plain 0..1 UVs)
    cladding: std({ color: 0xf1eee6, roughness: 0.7 }),
    darkRoof: std({ color: 0x35302e, roughness: 0.8 }),
    trim: std({ color: 0xfbfaf6, roughness: 0.6 }),
    ceiling: std({ color: 0xf7f4ee }),
    wood: std({ map: tex.wood, roughness: 0.6 }),
    stairSide: std({ color: 0xf3efe6 }),
    roofTiles: std({ map: tex.pantiles, roughness: 0.8 }),
    soffit: std({ color: 0xe9e4da }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }),
    door: std({ color: DOOR_COLORS.inside, roughness: 0.55 }),
    doorPanel: std({ color: 0xb07a48, roughness: 0.55 }),
    frontDoor: std({ color: DOOR_COLORS.front, roughness: 0.5 }),
    frontDoorPanel: std({ color: 0x2a2725, roughness: 0.5 }),
    frontDoorGlass: std({ color: 0xa9d3ea, roughness: 0.15 }),
    handle: std({ color: 0xc9a74a, roughness: 0.3, metalness: 0.8 }),
  };
  const wallpaperCache = new Map();
  const wallpaper = (room) => {
    const key = `${room.wall}-${room.wallTex ?? 'paper'}`;
    if (!wallpaperCache.has(key)) wallpaperCache.set(key, std({ map: room.wallTex === 'tiles' ? tex.tiles : tex.wallpaper, color: room.wall }));
    return wallpaperCache.get(key);
  };
  const floorMat = (room) => std({ map: tex[room.floor], color: room.floorTint ?? 0xffffff, roughness: room.floor === 'tiles' ? 0.4 : 0.7 });

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
  function wall({ run, at, from, to, y0, y1, thick, physThick, physOffset = 0, openings = [], mats, story, line, outward = 0 }) {
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
    // A window with `slack` has a bigger hole in the physics than you see: its
    // glass reaches into the frame around it, so once that's smashed a
    // flailing Lennie fits through a small window instead of snagging on it.
    const physHole = (o) => (o.slack ? {
      ...o,
      a: Math.max(from, o.a - o.slack.side),
      b: Math.min(to, o.b + o.slack.side),
      bottom: Math.max(y0, o.bottom - o.slack.below),
      top: Math.min(y1, o.top + o.slack.above),
    } : o);

    const pick = (m, along) => (typeof m === 'function' ? m(along) : m);
    for (const [a, b, ya, yb] of piecesAround(ops)) {
      const mid = (a + b) / 2;
      const pos = pick(mats.pos, mid);
      const neg = pick(mats.neg, mid);
      // Outside corners show the facade material instead of white trim.
      const endHi = mats.ends && b === to ? mats.ends : M.trim;
      const endLo = mats.ends && a === from ? mats.ends : M.trim;
      const faceMats = run === 'x' ? [endHi, endLo, M.trim, M.trim, pos, neg] : [pos, neg, M.trim, M.trim, endLo, endHi];
      const [min, max] = extents(run, at, a, b, ya, yb, thick);
      box(min, max, faceMats, { story, line });
    }
    for (const [a, b, ya, yb] of piecesAround(ops.map(physHole))) {
      const [pmin, pmax] = extents(run, at, a, b, ya, yb, physThick, physOffset);
      body(pmin, pmax, physMats.hard, { kind: 'wall' });
    }

    for (const o of ops) {
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
        addDoor(run, at, o, physThick, physOffset, story, line);
      }
    }
  }

  // A closed door filling the opening. A hard hit breaks it at once; a softer
  // one cracks it, and the next knock finishes it off (see main.js).
  function addDoor(run, at, o, physThick, physOffset, story, line) {
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
    part(o.a + 0.01, o.b - 0.01, o.bottom + 0.01, o.top - 0.01, 0.06, o.front ? M.frontDoor : M.door);
    // raised panels on both faces, and a lever handle on each side
    const panel = o.front ? M.frontDoorPanel : M.doorPanel;
    part(o.a + 0.14, o.b - 0.14, o.bottom + 1.15, o.top - 0.16, 0.08, o.front ? M.frontDoorGlass : panel);
    part(o.a + 0.14, o.b - 0.14, o.bottom + 0.18, o.bottom + 0.98, 0.08, panel);
    part(o.b - 0.2, o.b - 0.07, o.bottom + 1.0, o.bottom + 1.03, 0.2, M.handle);
    groups[story].add(group);

    const [pmin, pmax] = extents(run, at, o.a, o.b, o.bottom, o.top, physThick, physOffset);
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
    const [min, max] = extents(run, at, o.a, o.b, o.bottom, o.top, 0.03);
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
    const door = ([a, b], front = false) => ({ a, b, bottom: y0, top: y0 + DOOR_TOP, front });
    const roomAt = (x, z) => (z < HALL_Z ? R.hall : x < MID_X ? R.left : R.right);
    const common = { y0, y1, story: k, thick: EXT, physThick: EXT_PHYS };
    const off = (EXT_PHYS - EXT) / 2;

    if (k >= HOUSE.brickStories) buildAttic(k, R, off);
    else {
    wall({
      ...common, run: 'x', at: HOUSE.z1, from: OUT.x0, to: OUT.x1, physOffset: off, outward: 1, line: `south-${k}`,
      openings: [...FRONT[k].map(win), ...(k === 0 ? [door(FRONT_DOOR, true)] : [])],
      mats: { pos: M.brick, neg: (x) => wallpaper(roomAt(x, 0)), ends: M.brick },
    });
    wall({
      ...common, run: 'x', at: HOUSE.z0, from: OUT.x0, to: OUT.x1, physOffset: -off, outward: -1, line: `north-${k}`,
      openings: BACK.map(win),
      mats: { pos: wallpaper(R.hall), neg: M.brick, ends: M.brick },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x0, from: IN.z0, to: IN.z1, physOffset: -off, outward: -1, line: `west-${k}`,
      mats: { pos: (z) => wallpaper(roomAt(-5, z)), neg: M.brick },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x1, from: IN.z0, to: IN.z1, physOffset: off, outward: 1, line: `east-${k}`,
      mats: { pos: M.brick, neg: (z) => wallpaper(roomAt(5, z)) },
    });
    }

    // Interior walls
    wall({
      y0, y1, story: k, thick: INT, physThick: INT_PHYS, run: 'x', at: HALL_Z, from: IN.x0, to: IN.x1, line: `hall-${k}`,
      openings: [door([-4.6, -3.4]), door([3.2, 4.4])],
      mats: { pos: (x) => wallpaper(roomAt(x, 0)), neg: wallpaper(R.hall) },
    });
    if (k < HOUSE.brickStories) {
      wall({
        y0, y1, story: k, thick: INT, physThick: INT_PHYS, run: 'z', at: MID_X, from: HALL_Z + INT / 2, to: IN.z1, line: `mid-${k}`,
        openings: [door([0.6, 1.8])],
        mats: { pos: wallpaper(R.right), neg: wallpaper(R.left) },
      });
    }

    // Dark panel joining this storey's window in the front column to the one above.
    if (k < HOUSE.brickStories - 1) {
      const [a, b] = COLUMN;
      const above = FRONT[k + 1].find((o) => o.a === a);
      const yb = y0 + WIN.top + 0.07;
      const yt = y0 + H + (above.sill ?? WIN.sill) - 0.05;
      const line = `south-${k}`;
      box([a, yb, OUT.z1 - 0.01], [b, yt, OUT.z1 + 0.03], M.spandrel, { story: k, line });
      box([a - 0.07, yb, OUT.z1 - 0.01], [a, yt, OUT.z1 + 0.05], M.trim, { story: k, line });
      box([b, yb, OUT.z1 - 0.01], [b + 0.07, yt, OUT.z1 + 0.05], M.trim, { story: k, line });
    }

    // Floor finishes (visual), sharing the fade line of this storey's slab.
    const fy = y0 + 0.01;
    const slabLine = k > 0 ? `slab-${k}` : null;
    if (slabLine) registerLine(slabLine, k);
    const addFloor = (rect, room) => {
      const mat = floorMat(room);
      const mesh = new THREE.Mesh(floorGeometry(rect.x0, rect.z0, rect.x1, rect.z1), slabLine ? lineMat(slabLine, mat) : mat);
      mesh.position.y = fy;
      mesh.receiveShadow = true;
      groups[k].add(mesh);
      if (slabLine) lines.get(slabLine).meshes.push(mesh);
    };
    addFloor({ x0: IN.x0, x1: MID_X, z0: HALL_Z, z1: IN.z1 }, R.left);
    addFloor({ x0: MID_X, x1: IN.x1, z0: HALL_Z, z1: IN.z1 }, R.right);
    for (const r of rectMinus({ x0: IN.x0, x1: IN.x1, z0: IN.z0, z1: HALL_Z }, HOLES[k])) addFloor(r, R.hall);
  }

  // ------------------------------------------------------------ slabs (floor 2 and the attic floor)
  // The ground floor sits on a foundation; the yard's ground plane is its physics.
  box([OUT.x0, -0.3, OUT.z0], [OUT.x1, 0, OUT.z1], [M.trim, M.trim, M.ceiling, M.ceiling, M.trim, M.trim], { story: 0 });
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
    const [za, zb] = STAIR.stripA;
    const xa = STAIR.xLow + i * STAIR.run;
    const minA = [xa, 0, za];
    const maxA = [xa + STAIR.run, (i + 1) * STAIR.rise, zb];
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
  const kit = { box, body, addMesh, groups, M, std, tex, physMats, HOUSE, OUT, EXT, ROW, DORMER };
  const details = makeDetails(kit);
  const ux = ([u0, u1]) => [OUT.x0 + u0, OUT.x0 + u1];
  buildRoof();
  details.porch({ x0: ux(LAYOUT.porch)[0], x1: ux(LAYOUT.porch)[1], screen: ux(LAYOUT.screen), fascia: M.canopy });
  details.downpipe(OUT.x0 + LAYOUT.pipe, 2.55, (k) => ({ story: k, line: `south-${k}` }));
  buildNeighbours(kit, details);
  buildFurniture();
  // the mess: dishes, toys, clothes, household stuff and the board game closet (clutter.js)
  const clutter = buildClutter({ ...kit, H });

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

    // the dormer's front wall, with a breakable window
    wall({
      run: 'x', at: DORMER.front, from: MID_X + INT / 2, to: DORMER.x1 + DORMER.wallT / 2, y0, y1: DORMER.top,
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
    const ends = ROW.half + 0.3;
    const sections = [[-ends, OUT.x0, 0], [OUT.x0, OUT.x1, 3], [OUT.x1, ends, 0]];
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
    for (const side of [1, -1]) {
      const line = LINES[side];
      for (const [x0, x1] of [[-ends, OUT.x0], [OUT.x1, ends]]) slope(side, x0, x1, 0, runOut, { story: 0 });
      const own = { story: 3, line, inner: inward };
      if (side > 0) {
        slope(side, OUT.x0, DORMER.x0, 0, runOut, own);
        slope(side, DORMER.x1, OUT.x1, 0, runOut, own);
        slope(side, DORMER.x0, DORMER.x1, 0, DORMER.back, own);
        slope(side, DORMER.x0, DORMER.x1, DORMER.front + DORMER.wallT / 2, runOut, own);
      } else slope(side, OUT.x0, OUT.x1, 0, runOut, own);
      // white fascia boards along the eave
      const z = side * (runOut + 0.05);
      for (const [x0, x1, story] of sections) box([x0, fy - 0.15, z - 0.07], [x1, fy + 0.3, z + 0.07], M.trim, { story, cast: true, line: story === 3 ? line : null });
    }
    const ry = HOUSE.ridgeY + thick * hyp;
    for (const [x0, x1, story] of sections) box([x0, ry - 0.15, -0.2], [x1, ry + 0.1, 0.2], ridgeMat, { story, cast: true, line: story === 3 ? LINES[1] : null });

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
    for (const x of [-ROW.half, ROW.half - EXT]) {
      const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: EXT, bevelEnabled: false }), M.brick);
      gable.rotation.y = Math.PI / 2;
      gable.position.set(x, HOUSE.eaveY, 0);
      gable.receiveShadow = true;
      groups[0].add(gable);
    }
    const ey = HOUSE.eaveY;
    for (const [a0, a1] of [[-ROW.half, OUT.x0], [OUT.x1, ROW.half]]) {
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
    };
    const WOOD = 0x9b6a3f;
    const DARK = 0x3a3440;
    const WHITE = 0xf4f2ee;

    // --- Storey 0: living room + kitchen
    piece(0, [
      [[-5.85, 0, 0.3], [-4.95, 0.45, 3.1], 0x3f8f8a, { soft: true }],
      [[-5.85, 0.45, 0.3], [-5.55, 0.88, 3.1], 0x3f8f8a, { soft: true }],
      [[-5.85, 0.45, 0.3], [-4.95, 0.66, 0.52], 0x367d78, { soft: true }],
      [[-5.85, 0.45, 2.88], [-4.95, 0.66, 3.1], 0x367d78, { soft: true }],
      [[-5.5, 0.45, 0.6], [-5.0, 0.52, 1.65], 0x4fa7a0, { soft: true, phys: false }],
      [[-5.5, 0.45, 1.75], [-5.0, 0.52, 2.8], 0x4fa7a0, { soft: true, phys: false }],
      ...table(-4.1, 1.0, -3.0, 2.4, 0.45, WOOD),
      [[0.35, 0, 2.3], [0.88, 0.5, 3.9], DARK],
      [[0.55, 0.5, 2.45], [0.62, 1.25, 3.75], 0x111114],
      // kitchen
      [[5.25, 0, -2.2], [5.875, 0.85, 3.4], 0x5d8fb3],
      [[5.2, 0.85, -2.25], [5.875, 0.9, 3.45], 0xe8e4dc],
      [[5.1, 0, 3.6], [5.875, 1.95, 4.65], WHITE],
      [[5.08, 1.1, 3.7], [5.1, 1.7, 3.76], 0x9aa3ad, { phys: false }],
      ...table(2.4, 1.5, 3.9, 3.2, 0.78, 0xc9a06a),
      ...chair(2.0, 2.35, 1, 0xd95d39),
      ...chair(4.3, 2.35, -1, 0xd95d39),
    ]);
    rug(0, -4.7, 0.5, -2.4, 2.9, 0xc0574a);

    // --- Storey 1: bedroom + kids room
    piece(1, [
      [[-5.875, 0, 0.6], [-5.78, 0.86, 2.4], WOOD],
      [[-5.78, 0, 0.6], [-3.7, 0.32, 2.4], WOOD],
      [[-5.75, 0.32, 0.65], [-3.75, 0.58, 2.35], WHITE, { soft: true }],
      [[-4.9, 0.58, 0.62], [-3.72, 0.61, 2.38], 0x7c6bc4, { phys: false }],
      [[-5.7, 0.58, 0.8], [-5.25, 0.68, 2.2], 0xffffff, { phys: false }],
      [[-5.85, 0, 2.55], [-5.4, 0.5, 3.0], WOOD],
      [[0.3, 0, 2.6], [0.89, 2.0, 4.4], 0xb48a5c],
      // kids room
      [[4.0, 0, -2.25], [5.875, 0.3, -1.2], 0xf2c14e],
      [[4.05, 0.3, -2.2], [5.85, 0.52, -1.25], 0x5b8def, { soft: true }],
      [[2.0, 0, 4.2], [3.0, 0.5, 4.85], 0xe24a4a],
    ]);
    rug(1, -3.6, 0.6, -1.4, 2.6, 0xe8d6f5);
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
  const isInside = (p) => p.y > -1 && ((inFootprint(p) && p.y < underside(p.z) - 0.05) || inDormer(p));
  const isOnRoof = (p) => !isInside(p) && Math.abs(p.x) < ROW.half + 0.6 && Math.abs(p.z) < OUT.z1 + 0.6 && p.y > HOUSE.eaveY - 0.4;
  const nearHouse = (p) => Math.abs(p.x) < OUT.x1 + 1.2 && Math.abs(p.z) < OUT.z1 + 1.2;
  const storyAt = (y) => THREE.MathUtils.clamp(Math.floor((y + 0.3) / H), 0, HOUSE.stories - 1);
  const levelOf = (p) => (isOnRoof(p) ? 3 : storyAt(p.y));

  function locate(p) {
    if (isOnRoof(p)) return 'on the roof';
    if (!isInside(p)) return p.y > 1.5 && nearHouse(p) ? 'hanging out of a window' : 'in the yard';
    const k = storyAt(p.y);
    const room = p.z < HALL_Z ? ROOMS[k].hall : p.x < MID_X ? ROOMS[k].left : ROOMS[k].right;
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
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [-5.85, H + 0.3, 0.55], [-3.65, H + 1.1, 2.45]),
    S('bed', 'Tucked into bed', 250, 'NIGHT!', [3.95, H + 0.25, -2.3], [5.9, H + 1.05, -1.15]),
    S('beanbag', 'Beanbag flop!', 250, 'FLUMP!', [3.0, H + 0.4, 2.4], [4.2, H + 1.2, 3.6]),
    S('toybox', 'On the toy box!', 250, 'TOYS!', [1.95, H + 0.45, 4.15], [3.05, H + 1.2, 4.9]),
    S('fridge', 'On top of the fridge!', 450, 'CHILLY!', [5.0, 1.9, 3.5], [5.9, 2.7, 4.7]),
    S('table', 'On the dinner table!', 200, 'DINNER!', [2.35, 0.75, 1.45], [3.95, 1.45, 3.25]),
    S('counter', 'On the kitchen counter', 200, 'CHEF!', [5.15, 0.88, -2.3], [5.9, 1.55, 3.5]),
    S('couch', 'Couch potato', 150, 'AHH!', [-5.9, 0.3, 0.25], [-4.85, 1.2, 3.15]),
    ...clutter.spots,
  ];

  function spawnPoint(level) {
    if (level >= 3) return { x: -1.5, z: 0.2, height: HOUSE.ridgeY + 0.3 };
    return { x: -2.4, z: 1.6, height: level * H + 0.05 };
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

  /**
   * Hides storeys above the one the camera target is on when the camera looks
   * down into it, and fades any wall/floor between the camera and the target.
   */
  function updateView(camera, target, dt, cutaway) {
    level = 3;
    if (cutaway && isInside(target)) {
      const k = storyAt(target.y);
      if (camera.position.y > (k + 1) * H - T) level = k;
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

  /** Fixes the windows and doors, and puts all the mess back where it was. */
  function repairAll() {
    clutter.restock();
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
    isFaded,
    breakPiece,
    crackDoor,
    repairAll,
    scatter: clutter.scatter,
    update: clutter.update,
    get cutLevel() { return level; },
  };
}
