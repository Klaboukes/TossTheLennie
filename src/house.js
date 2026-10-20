import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { textures, meterBoxUVs, floorGeometry } from './textures.js';

// A three-storey family house. Footprint x ∈ [-6, 6], z ∈ [-5, 5]; the front
// door faces +z. Each storey: a hallway with the stairs along the back, and two
// rooms at the front split by a wall at x = 1.
export const HOUSE = { x0: -6, x1: 6, z0: -5, z1: 5, H: 3, T: 0.4, stories: 3, eaveY: 9, ridgeY: 11.5 };

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
const DOOR_TOP = 2.15;
const DOOR_COLORS = { inside: 0xc9935f, front: 0x9c2f2f };
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
    hall: { name: 'Top landing', wall: 0xeadfc8, floor: 'wood' },
    left: { name: 'Study', wall: 0xcadbb0, floor: 'wood' },
    right: { name: 'Bathroom', wall: 0xf3f6f8, floor: 'tiles', floorTint: 0xcfe6f0, wallTex: 'tiles' },
  },
];

// Window and door openings per wall, as [from, to] along the wall.
const OPENINGS = {
  south: [[-4.8, -2.8], [2.6, 4.6]],
  north: [[-5.2, -3.8], [3.6, 5.0]],
  west: [[0.4, 2.6]],
  east: [[0.4, 2.6]],
};
const FRONT_DOOR = [-1.2, -0.1];

export function buildHouse(scene, world, physMats) {
  const tex = textures();
  const groups = [0, 1, 2, 3].map(() => {
    const g = new THREE.Group();
    scene.add(g);
    return g;
  });
  const lines = new Map();
  const windows = [];
  const doors = [];
  const stairBodies = [];

  // ------------------------------------------------------------ materials
  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...opts });
  const M = {
    siding: std({ map: tex.siding, color: 0xa8c3dc }),
    trim: std({ color: 0xfbfaf6, roughness: 0.6 }),
    ceiling: std({ color: 0xf7f4ee }),
    wood: std({ map: tex.wood, roughness: 0.6 }),
    stairSide: std({ color: 0xf3efe6 }),
    shingles: std({ map: tex.shingles, roughness: 0.9 }),
    soffit: std({ color: 0xe9e4da }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }),
    brick: std({ color: 0xa4523e }),
    door: std({ color: DOOR_COLORS.inside, roughness: 0.55 }),
    doorPanel: std({ color: 0xb07a48, roughness: 0.55 }),
    frontDoor: std({ color: DOOR_COLORS.front, roughness: 0.5 }),
    frontDoorPanel: std({ color: 0x7e2323, roughness: 0.5 }),
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
    }
    return clone;
  }

  function registerLine(line, story) {
    if (!lines.has(line)) {
      lines.set(line, { story, meshes: [], mats: new Set(), cache: new Map(), opacity: 1, target: 1, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
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
    if (line) {
      const entry = lines.get(line);
      entry.meshes.push(mesh);
      for (let i = 0; i < 3; i++) {
        entry.min[i] = Math.min(entry.min[i], min[i]);
        entry.max[i] = Math.max(entry.max[i], max[i]);
      }
    }
    return mesh;
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
    const pieces = [];
    let cur = from;
    for (const o of ops) {
      if (o.a > cur) pieces.push([cur, o.a, y0, y1]);
      if (o.bottom > y0) pieces.push([o.a, o.b, y0, o.bottom]);
      if (o.top < y1) pieces.push([o.a, o.b, o.top, y1]);
      cur = o.b;
    }
    if (cur < to) pieces.push([cur, to, y0, y1]);

    const pick = (m, along) => (typeof m === 'function' ? m(along) : m);
    for (const [a, b, ya, yb] of pieces) {
      const mid = (a + b) / 2;
      const pos = pick(mats.pos, mid);
      const neg = pick(mats.neg, mid);
      const faceMats = run === 'x' ? [M.trim, M.trim, M.trim, M.trim, pos, neg] : [pos, neg, M.trim, M.trim, M.trim, M.trim];
      const [min, max] = extents(run, at, a, b, ya, yb, thick);
      box(min, max, faceMats, { story, line });
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
        addWindow(run, at, o, physThick, physOffset, story, outward, line);
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
    part(o.a + 0.14, o.b - 0.14, o.bottom + 1.15, o.top - 0.16, 0.08, panel);
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

  function addWindow(run, at, o, physThick, physOffset, story, outward, line) {
    const group = new THREE.Group();
    const [min, max] = extents(run, at, o.a, o.b, o.bottom, o.top, 0.03);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), M.glass);
    pane.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    group.add(pane);
    const midA = (o.a + o.b) / 2;
    const midY = (o.bottom + o.top) / 2;
    for (const [a, b, ya, yb] of [[midA - 0.03, midA + 0.03, o.bottom, o.top], [o.a, o.b, midY - 0.03, midY + 0.03]]) {
      const [bmin, bmax] = extents(run, at, a, b, ya, yb, 0.06);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]), lineMat(line, M.trim));
      bar.position.set((bmin[0] + bmax[0]) / 2, (bmin[1] + bmax[1]) / 2, (bmin[2] + bmax[2]) / 2);
      group.add(bar);
    }
    groups[story].add(group);

    const [pmin, pmax] = extents(run, at, o.a, o.b, o.bottom, o.top, physThick, physOffset);
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
    const win = ([a, b]) => ({ a, b, bottom: y0 + WIN.sill, top: y0 + WIN.top, glass: true });
    const door = ([a, b], front = false) => ({ a, b, bottom: y0, top: y0 + DOOR_TOP, front });
    const roomAt = (x, z) => (z < HALL_Z ? R.hall : x < MID_X ? R.left : R.right);
    const common = { y0, y1, story: k, thick: EXT, physThick: EXT_PHYS };
    const off = (EXT_PHYS - EXT) / 2;

    wall({
      ...common, run: 'x', at: HOUSE.z1, from: OUT.x0, to: OUT.x1, physOffset: off, outward: 1, line: `south-${k}`,
      openings: [...OPENINGS.south.map(win), ...(k === 0 ? [door(FRONT_DOOR, true)] : [])],
      mats: { pos: M.siding, neg: (x) => wallpaper(roomAt(x, 0)) },
    });
    wall({
      ...common, run: 'x', at: HOUSE.z0, from: OUT.x0, to: OUT.x1, physOffset: -off, outward: -1, line: `north-${k}`,
      openings: OPENINGS.north.map(win),
      mats: { pos: wallpaper(R.hall), neg: M.siding },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x0, from: IN.z0, to: IN.z1, physOffset: -off, outward: -1, line: `west-${k}`,
      openings: OPENINGS.west.map(win),
      mats: { pos: (z) => wallpaper(roomAt(-5, z)), neg: M.siding },
    });
    wall({
      ...common, run: 'z', at: HOUSE.x1, from: IN.z0, to: IN.z1, physOffset: off, outward: 1, line: `east-${k}`,
      openings: OPENINGS.east.map(win),
      mats: { pos: M.siding, neg: (z) => wallpaper(roomAt(5, z)) },
    });

    // Interior walls
    wall({
      y0, y1, story: k, thick: INT, physThick: INT_PHYS, run: 'x', at: HALL_Z, from: IN.x0, to: IN.x1, line: `hall-${k}`,
      openings: [door([-4.6, -3.4]), door([3.2, 4.4])],
      mats: { pos: (x) => wallpaper(roomAt(x, 0)), neg: wallpaper(R.hall) },
    });
    wall({
      y0, y1, story: k, thick: INT, physThick: INT_PHYS, run: 'z', at: MID_X, from: HALL_Z + INT / 2, to: IN.z1, line: `mid-${k}`,
      openings: [door([0.6, 1.8])],
      mats: { pos: wallpaper(R.right), neg: wallpaper(R.left) },
    });

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

  // ------------------------------------------------------------ slabs (floors 1, 2 and the attic floor)
  // The ground floor sits on a foundation; the yard's ground plane is its physics.
  box([OUT.x0, -0.3, OUT.z0], [OUT.x1, 0, OUT.z1], [M.trim, M.trim, M.ceiling, M.ceiling, M.trim, M.trim], { story: 0 });
  for (let k = 1; k <= 3; k++) {
    const top = k * H;
    const line = `slab-${k}`;
    for (const r of rectMinus({ x0: OUT.x0, x1: OUT.x1, z0: OUT.z0, z1: OUT.z1 }, HOLES[k])) {
      box([r.x0, top - T, r.z0], [r.x1, top, r.z1], [M.trim, M.trim, M.ceiling, M.ceiling, M.trim, M.trim], { story: k, line });
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

  buildRoof();
  buildFurniture();

  // ------------------------------------------------------------ roof
  function buildRoof() {
    const g = groups[3];
    const rise = HOUSE.ridgeY - HOUSE.eaveY;
    const halfDepth = HOUSE.z1;
    const angle = Math.atan2(rise, halfDepth);
    const overhang = 0.5;
    const runOut = halfDepth + overhang;
    const slope = Math.hypot(runOut, runOut * (rise / halfDepth));
    const thick = 0.18;
    const length = OUT.x1 - OUT.x0 + 1.0;

    for (const side of [1, -1]) {
      const geo = new THREE.BoxGeometry(length, thick, slope);
      meterBoxUVs(geo, [-length / 2, -thick / 2, -slope / 2], [length / 2, thick / 2, slope / 2]);
      const roof = new THREE.Mesh(geo, [M.soffit, M.soffit, M.shingles, M.soffit, M.soffit, M.soffit]);
      const normal = new THREE.Vector3(0, Math.cos(angle), side * Math.sin(angle));
      const mid = new THREE.Vector3(0, HOUSE.ridgeY - (rise / halfDepth) * runOut / 2, side * runOut / 2);
      roof.position.copy(mid).addScaledVector(normal, thick / 2);
      roof.rotation.x = side * angle;
      roof.castShadow = true;
      roof.receiveShadow = true;
      g.add(roof);

      const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(length / 2, thick / 2, slope / 2)) });
      b.position.set(roof.position.x, roof.position.y, roof.position.z);
      b.quaternion.setFromEuler(side * angle, 0, 0);
      b.surface = { kind: 'roof' };
      world.addBody(b);
    }

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.16, 0.4), std({ color: 0x6b2a20 }));
    ridge.position.set(0, HOUSE.ridgeY + 0.17, 0);
    ridge.castShadow = true;
    g.add(ridge);

    // Gable ends (visual) and the solid attic volume (physics).
    const shape = new THREE.Shape();
    shape.moveTo(HOUSE.z0, 0);
    shape.lineTo(HOUSE.z1, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    for (const x of [OUT.x0, OUT.x1 - EXT]) {
      const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: EXT, bevelEnabled: false }), M.siding);
      gable.rotation.y = Math.PI / 2;
      gable.position.set(x, HOUSE.eaveY, 0);
      gable.receiveShadow = true;
      g.add(gable);
    }
    // Cannon expects convex shapes around their local origin, so centre it.
    const cy = HOUSE.eaveY + rise / 3;
    const V = (x, y, z) => new CANNON.Vec3(x, y - cy, z);
    const ey = HOUSE.eaveY;
    const ry = HOUSE.ridgeY;
    const attic = new CANNON.ConvexPolyhedron({
      vertices: [V(OUT.x0, ey, HOUSE.z0), V(OUT.x1, ey, HOUSE.z0), V(OUT.x1, ey, HOUSE.z1), V(OUT.x0, ey, HOUSE.z1), V(OUT.x0, ry, 0), V(OUT.x1, ry, 0)],
      faces: [[0, 1, 2, 3], [0, 4, 5, 1], [3, 2, 5, 4], [0, 3, 4], [1, 5, 2]],
    });
    const atticBody = new CANNON.Body({ mass: 0, material: physMats.hard, shape: attic });
    atticBody.position.set(0, cy, 0);
    atticBody.surface = { kind: 'roof' };
    world.addBody(atticBody);

    // Chimney
    const cmin = [2.6, HOUSE.eaveY + 0.5, -2.4];
    const cmax = [3.4, HOUSE.ridgeY + 1.0, -1.6];
    box(cmin, cmax, M.brick, { story: 3, cast: true });
    box([cmin[0] - 0.06, cmax[1], cmin[2] - 0.06], [cmax[0] + 0.06, cmax[1] + 0.12, cmax[2] + 0.06], std({ color: 0x8b8b8b }), { story: 3, cast: true });
    body(cmin, [cmax[0], cmax[1] + 0.12, cmax[2]], physMats.hard, { kind: 'roof' });
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
      const mesh = new THREE.Mesh(geo, col(color, { roughness: 1 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((x0 + x1) / 2, story * H + 0.018, (z0 + z1) / 2);
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

    // --- Storey 2: study + bathroom
    piece(2, [
      ...table(-5.875, -1.6, -5.1, 0.2, 0.76, WOOD),
      [[-5.8, 0.76, -1.0], [-5.74, 1.2, -0.3], 0x111114],
      ...chair(-4.6, -0.7, -1, 0x2f3e57),
      [[-3.0, 0, -2.3], [-1.4, 1.9, -1.95], WOOD],
      [[-1.2, 0, 3.5], [0.85, 0.45, 4.7], 0xc75b7a, { soft: true }],
      [[-1.2, 0.45, 4.4], [0.85, 1.0, 4.7], 0xc75b7a, { soft: true }],
      // bathroom: a hollow tub Lennie can land in
      [[3.9, 0, 3.95], [5.875, 0.12, 4.875], WHITE],
      [[3.9, 0.12, 3.95], [3.98, 0.55, 4.875], WHITE],
      [[5.8, 0.12, 3.95], [5.875, 0.55, 4.875], WHITE],
      [[3.98, 0.12, 3.95], [5.8, 0.55, 4.03], WHITE],
      [[3.98, 0.12, 4.8], [5.8, 0.55, 4.875], WHITE],
      [[3.98, 0.12, 4.03], [5.8, 0.14, 4.8], 0x8fd3f0, { phys: false }],
      [[5.2, 0, -1.6], [5.75, 0.42, -1.1], WHITE],
      [[5.65, 0.42, -1.65], [5.875, 0.85, -1.05], WHITE],
      [[1.1, 0, 3.9], [2.3, 0.85, 4.875], 0x6a9fb5],
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
    rug(2, 1.5, 2.2, 3.4, 3.3, 0x9ad0e6);
  }

  // ------------------------------------------------------------ queries
  const isInside = (p) => p.x > HOUSE.x0 && p.x < HOUSE.x1 && p.z > HOUSE.z0 && p.z < HOUSE.z1 && p.y < HOUSE.eaveY - 0.1 && p.y > -1;
  const isOnRoof = (p) => Math.abs(p.x) < OUT.x1 + 0.6 && Math.abs(p.z) < OUT.z1 + 0.6 && p.y > HOUSE.eaveY - 0.4;
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

  function spawnPoint(level) {
    if (level >= 3) return { x: -1.5, z: 0.2, height: HOUSE.ridgeY + 0.3 };
    return { x: -2.4, z: 1.6, height: level * H + 0.05 };
  }

  // ------------------------------------------------------------ view: cutaway + fading
  // Every line is a thin slab (a wall or a floor); its plane is across its
  // thinnest axis. It fades when the sight line from the camera target to the
  // camera crosses that plane within the line's extent (plus a margin), which
  // also catches sight lines that slip through a doorway or window.
  for (const entry of lines.values()) {
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
        m.opacity = entry.opacity;
        m.depthWrite = entry.opacity > 0.95;
      }
    }
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

  function repairAll() {
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
    updateView,
    breakPiece,
    crackDoor,
    repairAll,
    get cutLevel() { return level; },
  };
}
