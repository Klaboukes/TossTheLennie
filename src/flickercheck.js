import * as THREE from 'three';

// Finds spots that will flicker. When two surfaces facing the same way lie in
// (almost) the same place, the graphics chip can't tell which one is in front,
// and as the camera moves it flips between them ("z-fighting"). Every one of
// those spots so far was two parts built into each other: a kick strip level
// with a cabinet's side, walls overlapping at a corner, clothes at exactly the
// same height.
//
// The check looks at every triangle of the scenery and lists each pair of
// differently coloured surfaces that face the same way, lie less than GAP
// apart and overlap where it can be seen (not inside or right up against
// another solid thing). main.js runs it when the game is played on the
// developer's own computer (localhost) and prints what it finds in the
// browser console, so a new spot shows up the first time a change is played.
// The live game never runs it.
//
// Fixing a spot: fit the parts between each other instead of into each other,
// or move the thinner one a few millimetres out. For something flat lying on
// something else (a rug, a road marking, a poster) give its material
// `polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4`: that
// pulls it in front in the depth test. Surfaces whose materials have
// different polygonOffset settings are left out here, as that is the intended
// fix.

const GAP = 0.0009; // m: same-facing surfaces closer together than this can flicker
const LAYER = 0.01; // m: surfaces are sorted into layers this thick before they're compared
const PROBES = [0.002, 0.025]; // m: a spot is hidden if a solid thing fills the space this far in front of it
const GROUND = 0; // m: the height of the ground (the camera never goes under it)
const MIN_AREA = 1e-3; // m² (10 cm²): smaller spots (a 1 cm sliver along a window edge) hardly show
const SAMPLES = 16; // spots looked at per overlap, to see how much of it can be seen
const SHOW = 25; // at most this many spots are listed
const CELL = 1; // m: grid for finding the parts near a spot

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _ray = new THREE.Ray();
const _col = new THREE.Color();

const shown = (o) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};
const opaque = (mat) => mat.visible && mat.depthWrite && (!mat.transparent || mat.opacity > 0.95);
const hex = (c) => (c && c.isColor ? c.getHexString() : '');
/** What a material looks like (two surfaces that look the same can't be seen flickering). */
const lookOf = (m) => [m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.map?.uuid,
  m.normalMap?.uuid, m.vertexColors, m.flatShading, m.transparent ? Math.round(m.opacity * 100) : 100].join('|');

/**
 * Notes down where every scenery mesh is. Call it before combineScenery()
 * glues the meshes together, so the check can still name each part.
 */
export function sceneryParts(scene, skip = () => false) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isBatchedMesh || o.isSkinnedMesh || !shown(o) || skip(o) || !o.geometry.attributes.position) return;
    const count = o.isInstancedMesh ? o.count : 1;
    for (let i = 0; i < count; i++) {
      const matrix = o.matrixWorld.clone();
      if (o.isInstancedMesh) {
        const im = new THREE.Matrix4();
        o.getMatrixAt(i, im);
        matrix.multiply(im);
      }
      parts.push({ mesh: o, instance: o.isInstancedMesh ? i : -1, matrix });
    }
  });
  return parts;
}

/** Calls fn(a, b, c, material, firstVertex) for each triangle of `part`, in world space. */
function eachTriangle(part, fn) {
  const { mesh, matrix } = part;
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const index = geo.index;
  const vert = (i) => (index ? index.getX(i) : i);
  const count = index ? index.count : pos.count;
  const groups = Array.isArray(mesh.material)
    ? geo.groups.map((g) => [g.start, Math.min(g.start + g.count, count), mesh.material[g.materialIndex]])
    : [[0, count, mesh.material]];
  for (const [start, end, mat] of groups) {
    if (!mat) continue;
    for (let t = start; t + 2 < end; t += 3) {
      _a.fromBufferAttribute(pos, vert(t)).applyMatrix4(matrix);
      _b.fromBufferAttribute(pos, vert(t + 1)).applyMatrix4(matrix);
      _c.fromBufferAttribute(pos, vert(t + 2)).applyMatrix4(matrix);
      fn(_a, _b, _c, mat, vert(t));
    }
  }
}

/** Twice the signed area of a 2D polygon given as [u, v] points. */
function area2(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s;
}

/** The part of 2D triangle `a` inside 2D triangle `b` (both counter-clockwise). */
function clip(a, b) {
  let poly = a;
  for (let i = 0; i < 3 && poly.length; i++) {
    const [px, py] = b[i];
    const ex = b[(i + 1) % 3][0] - px;
    const ey = b[(i + 1) % 3][1] - py;
    const side = (p) => ex * (p[1] - py) - ey * (p[0] - px);
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const cur = poly[k];
      const next = poly[(k + 1) % poly.length];
      const sc = side(cur);
      const sn = side(next);
      if (sc >= 0) out.push(cur);
      if ((sc >= 0) !== (sn >= 0)) {
        const t = sc / (sc - sn);
        out.push([cur[0] + t * (next[0] - cur[0]), cur[1] + t * (next[1] - cur[1])]);
      }
    }
    poly = out;
  }
  return poly;
}

// A triangle's normal along axis `ax` (x, y or z), and its plane's height
// along that axis above the point [u, v] of the other two.
const axis = (t) => (t.ax === 0 ? t.nx : t.ax === 1 ? t.ny : t.nz);
function height(t, u, v) {
  const [nu, nv] = t.ax === 0 ? [t.ny, t.nz] : t.ax === 1 ? [t.nz, t.nx] : [t.nx, t.ny];
  return (t.d - nu * u - nv * v) / axis(t);
}

// The [u, v] of a point in a plane drawn flat by dropping axis `ax`, and back.
const AXES = [[1, 2], [2, 0], [0, 1]];
const flat = (p, ax) => [p.getComponent(AXES[ax][0]), p.getComponent(AXES[ax][1])];
function lift(u, v, plane, out) {
  const [iu, iv] = AXES[plane.ax];
  const n = plane.n;
  out.setComponent(iu, u).setComponent(iv, v);
  return out.setComponent(plane.ax, (plane.d - n.getComponent(iu) * u - n.getComponent(iv) * v) / n.getComponent(plane.ax));
}

/**
 * Returns a test inside(point, dir): is `point` inside one of the solid parts?
 * It is inside a part when the first of that part's surfaces a ray from it
 * along `dir` meets is seen from within.
 */
function solidTest(parts) {
  const grid = new Map();
  const big = [];
  for (const part of parts) {
    if (![].concat(part.mesh.material).every((m) => m && opaque(m))) continue;
    const geo = part.mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const solid = { part, bounds: geo.boundingBox.clone().applyMatrix4(part.matrix), mirrored: part.matrix.determinant() < 0 };
    const lo = solid.bounds.min.clone().divideScalar(CELL).floor();
    const hi = solid.bounds.max.clone().divideScalar(CELL).floor();
    if ((hi.x - lo.x + 1) * (hi.y - lo.y + 1) * (hi.z - lo.z + 1) > 64) {
      big.push(solid);
      continue;
    }
    for (let x = lo.x; x <= hi.x; x++) {
      for (let y = lo.y; y <= hi.y; y++) {
        for (let z = lo.z; z <= hi.z; z++) {
          const k = `${x},${y},${z}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(solid);
        }
      }
    }
  }
  return (point, dir) => {
    if (dir.y < -0.5 && point.y < GROUND) return true; // faces looking down below the ground are never seen
    const near = big.concat(grid.get(`${Math.floor(point.x / CELL)},${Math.floor(point.y / CELL)},${Math.floor(point.z / CELL)}`) || []);
    _ray.set(point, dir);
    for (const solid of near) {
      if (!solid.bounds.containsPoint(point)) continue;
      // Parts overlap (a frame set into a wall), so ask each part on its own.
      let best = Infinity;
      let inside = false;
      eachTriangle(solid.part, (a, b, c) => {
        if (!_ray.intersectTriangle(a, b, c, false, _hit)) return;
        const dist = _hit.distanceTo(point);
        if (dist >= best) return;
        best = dist;
        _n.subVectors(b, a).cross(_e.subVectors(c, a));
        inside = (_n.dot(dir) > 0) !== solid.mirrored;
      });
      if (inside) return true;
    }
    return false;
  };
}

/** Lets the game run a frame every few milliseconds, so the check doesn't freeze it. */
function pauser(ms = 15) {
  let last = performance.now();
  return async () => {
    if (performance.now() - last < ms) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
    last = performance.now();
  };
}

/**
 * Lists the spots among `parts` (from sceneryParts()) where two surfaces lie
 * in the same place and will flicker, biggest first. It takes a few seconds,
 * a little at a time between the game's frames.
 */
export async function findFlicker(parts) {
  const breathe = pauser();
  const sources = []; // what each triangle belongs to: { id, part, material, color, look, offset }
  const planes = new Map(); // facing -> height -> triangles
  let triangles = 0;

  const addTriangle = (src, look, a, b, c, flip) => {
    _n.subVectors(b, a).cross(_e.subVectors(c, a));
    const len = _n.length();
    if (len < 1e-9) return;
    _n.divideScalar(flip ? -len : len);
    const { x: nx, y: ny, z: nz } = _n;
    const ax = Math.abs(nx) >= Math.abs(ny) && Math.abs(nx) >= Math.abs(nz) ? 0 : Math.abs(ny) >= Math.abs(nz) ? 1 : 2;
    let tri = [flat(a, ax), flat(b, ax), flat(c, ax)];
    if (area2(tri) < 0) tri = [tri[0], tri[2], tri[1]];
    // Which way it faces, rounded, as one number.
    const facing = ((Math.round(nx * 1000) + 1000) * 2001 + Math.round(ny * 1000) + 1000) * 2001 + Math.round(nz * 1000) + 1000;
    const d = _n.dot(a);
    // The layer goes by the rounded facing: the exact one, far from the
    // middle of the world, would put the same plane in different layers.
    const level = Math.round((Math.round(nx * 1000) * a.x + Math.round(ny * 1000) * a.y + Math.round(nz * 1000) * a.z) / 1000 / LAYER);
    let levels = planes.get(facing);
    if (!levels) planes.set(facing, (levels = new Map()));
    let list = levels.get(level);
    if (!list) levels.set(level, (list = []));
    list.push({
      src, look, tri, d, ax, nx, ny, nz,
      minU: Math.min(tri[0][0], tri[1][0], tri[2][0]), maxU: Math.max(tri[0][0], tri[1][0], tri[2][0]),
      minV: Math.min(tri[0][1], tri[1][1], tri[2][1]), maxV: Math.max(tri[0][1], tri[1][1], tri[2][1]),
    });
    triangles++;
  };

  for (const part of parts) {
    await breathe();
    const { mesh, instance, matrix } = part;
    const colors = mesh.geometry.attributes.color;
    const mirrored = matrix.determinant() < 0;
    let color = '';
    if (instance >= 0 && mesh.instanceColor) {
      mesh.getColorAt(instance, _col);
      color = _col.getHexString();
    }
    const mine = new Map(); // material -> source
    eachTriangle(part, (a, b, c, mat, v) => {
      if (!mat.visible || !mat.colorWrite || !mat.depthTest) return;
      let src = mine.get(mat);
      if (!src) {
        src = {
          id: sources.length, part, material: mat, color, look: `${lookOf(mat)}#${color}`,
          offset: mat.polygonOffset ? `${mat.polygonOffsetFactor},${mat.polygonOffsetUnits}` : '',
        };
        mine.set(mat, src);
        sources.push(src);
      }
      const look = colors && mat.vertexColors ? src.look + _col.fromBufferAttribute(colors, v).getHexString() : src.look;
      if (mat.side !== THREE.BackSide) addTriangle(src, look, a, b, c, mirrored);
      if (mat.side !== THREE.FrontSide) addTriangle(src, look, a, b, c, !mirrored);
    });
  }

  // Compare each triangle with the others facing the same way at (almost)
  // the same height: the same layer and the next one up. Overlaps of the
  // same two surfaces in the same plane make one spot.
  const groups = new Map();
  const byStart = (p, q) => p.minU - q.minU;
  for (const [facing, levels] of planes) {
    for (const [level, here] of levels) {
      await breathe();
      const above = levels.get(level + 1);
      for (const t of here) t.here = true;
      const list = above ? here.concat(above) : here;
      for (const t of above || []) t.here = false;
      list.sort(byStart);
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        for (let j = i + 1; j < list.length && list[j].minU < s.maxU; j++) {
          const t = list[j];
          if (!s.here && !t.here) continue; // that pair is checked with the bucket above
          if (s.src === t.src || s.look === t.look || s.src.offset !== t.src.offset) continue;
          if (t.minV >= s.maxV || s.minV >= t.maxV || s.ax !== t.ax) continue;
          const poly = clip(s.tri, t.tri);
          if (poly.length < 3) continue;
          // how far apart the two planes are in the middle of the overlap
          let cu = 0;
          let cv = 0;
          for (const [u, v] of poly) {
            cu += u / poly.length;
            cv += v / poly.length;
          }
          if (Math.abs(height(s, cu, cv) - height(t, cu, cv)) * Math.abs(axis(s)) >= GAP) continue;
          const [a, b] = s.src.id < t.src.id ? [s.src, t.src] : [t.src, s.src];
          const gk = `${a.id}|${b.id}|${facing}|${level}`;
          let group = groups.get(gk);
          if (!group) {
            const plane = { ax: s.ax, d: s.d, n: new THREE.Vector3(s.nx, s.ny, s.nz) };
            groups.set(gk, (group = { a, b, plane, area: 0, pieces: [] }));
          }
          const scale = 1 / 2 / Math.abs(group.plane.n.getComponent(s.ax)); // flat area -> real area
          for (let k = 1; k + 1 < poly.length; k++) {
            const [p, q, r] = [poly[0], poly[k], poly[k + 1]];
            const area = Math.abs(area2([p, q, r])) * scale;
            group.area += area;
            group.pieces.push({ area, u: (p[0] + q[0] + r[0]) / 3, v: (p[1] + q[1] + r[1]) / 3 });
          }
        }
      }
    }
  }

  // How much of each overlap can be seen: look at its biggest pieces.
  const inside = solidTest(parts);
  const probe = new THREE.Vector3();
  const spots = [];
  for (const group of groups.values()) {
    await breathe();
    if (group.area < MIN_AREA) continue;
    const { plane } = group;
    const pieces = group.pieces.sort((p, q) => q.area - p.area).slice(0, SAMPLES);
    let looked = 0;
    let seen = 0;
    const sum = new THREE.Vector3();
    const box = new THREE.Box3();
    for (const piece of pieces) {
      looked += piece.area;
      const at = lift(piece.u, piece.v, plane, new THREE.Vector3());
      if (PROBES.some((d) => inside(probe.copy(at).addScaledVector(plane.n, d), plane.n))) continue;
      seen += piece.area;
      sum.addScaledVector(at, piece.area);
      box.expandByPoint(at);
    }
    const area = group.area * (seen / looked);
    if (area < MIN_AREA) continue;
    spots.push({ a: group.a, b: group.b, normal: plane.n, area, at: sum.divideScalar(seen), size: box.getSize(new THREE.Vector3()) });
  }
  spots.sort((p, q) => q.area - p.area);
  return { spots, triangles };
}

const FACES = { '1,0,0': '+x', '-1,0,0': '-x', '0,1,0': 'up', '0,-1,0': 'down', '0,0,1': '+z', '0,0,-1': '-z' };
const f2 = (v) => v.toFixed(2);

function describe(src) {
  const { mesh, instance, matrix } = src.part;
  const m = src.material;
  const geo = mesh.geometry;
  let what = geo.type.replace(/Geometry$/, '').toLowerCase();
  if (geo.type === 'BoxGeometry') {
    const s = new THREE.Vector3().setFromMatrixScale(matrix);
    const { width, height, depth } = geo.parameters;
    what = `box ${f2(width * s.x)}×${f2(height * s.y)}×${f2(depth * s.z)}`;
  }
  const at = new THREE.Vector3().setFromMatrixPosition(matrix);
  const bits = [`${what} #${src.color || hex(m.color) || '?'}`];
  if (m.map) bits.push('textured');
  if (m.transparent && m.opacity < 1) bits.push(`see-through ${f2(m.opacity)}`);
  if (instance >= 0) bits.push(`copy ${instance} of ${mesh.count}`);
  if (mesh.name) bits.push(`"${mesh.name}"`);
  return `${bits.join(' ')} centred at (${f2(at.x)}, ${f2(at.y)}, ${f2(at.z)})`;
}

/** Runs findFlicker() and prints the result in the browser console. */
export async function reportFlicker(parts) {
  const t0 = performance.now();
  const { spots, triangles } = await findFlicker(parts);
  const how = `${triangles.toLocaleString('en-US')} triangles, checked in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
  if (!spots.length) {
    console.info(`Flicker check: no overlapping surfaces (${how}).`);
    return spots;
  }
  const lines = spots.slice(0, SHOW).map((s, i) => {
    const facing = FACES[s.normal.toArray().map(Math.round).join(',')] ?? 'at a slant';
    return `${i + 1}. ${(s.area * 1e4).toFixed(1)} cm² facing ${facing} around (${f2(s.at.x)}, ${f2(s.at.y)}, ${f2(s.at.z)}), `
      + `${f2(Math.max(s.size.x, s.size.y, s.size.z))} m across:\n   ${describe(s.a)}\n   ${describe(s.b)}`;
  });
  if (spots.length > SHOW) lines.push(`...and ${spots.length - SHOW} more.`);
  console.warn(`Flicker check: ${spots.length} spot(s) where two surfaces lie in the same place and will flicker `
    + `(z-fighting). src/flickercheck.js says how to fix them. (${how})\n${lines.join('\n')}`);
  return spots;
}
