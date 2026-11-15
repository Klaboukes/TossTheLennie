import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { meterBoxUVs } from './textures.js';
import { canvasTexture } from './supermarket.js';
import { GARAGE as GARAGE_WALLS } from './house.js';

// Lennie's back garden, after the owner's sketch (docs/floorplan-floor1.png):
// bushes all along the left fence, and down the right-hand side, behind the
// garage (house.js builds it, as a room Lennie can be thrown into), the
// corner lounge set with its little round table under a flat plastic canopy, the
// round trampoline, and a tree beside the three wheelie bins, with a stretch
// of lawn behind them to the gate in the back fence, where old plywood boards,
// bin bags, boxes and tyres lie about. A wooden fence runs round it, with the alley behind.
// The bikes and the moped parked along the left-hand bushes are loose (bikes.js, built with house.js's loose furniture).
// Lennie bounces off all of it; the bushes, the lounge set, the canopy and the
// trampoline are bouncy.
export const GARDEN = { x0: -6, x1: 6, back: -19.5 }; // the back fence, 3.5 m of lawn behind the bins
const GARAGE = { x0: GARAGE_WALLS.x0 - 0.125, z0: GARAGE_WALLS.z0 - 0.125, top: GARAGE_WALLS.top }; // its outer faces

export function buildGarden(scene, world, physMats, { std, tex }) {
  const add = (mesh, cast = true) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const boxMesh = (min, max, mat, cast = true) => {
    const geo = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    meterBoxUVs(geo, min, max);
    const m = add(new THREE.Mesh(geo, mat), cast);
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    return m;
  };
  const solid = (min, max, kind, material = physMats.hard) => {
    const b = new CANNON.Body({ mass: 0, material, shape: new CANNON.Box(new CANNON.Vec3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2)) });
    b.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    b.surface = { kind };
    world.addBody(b);
    return b;
  };
  const both = (min, max, mat, kind, material) => {
    boxMesh(min, max, mat);
    solid(min, max, kind, material);
  };

  // ------------------------------------------------------------ the fence (a dark wooden schutting) with a gate at the back
  const plank = std({ color: 0x75522f, roughness: 0.9 });
  const post = std({ color: 0x4f3725, roughness: 0.9 });
  const gateMat = std({ color: 0x8a6440, roughness: 0.9 });
  const FH = 1.8;
  function fence(xa, za, xb, zb) {
    const [x0, x1] = [Math.min(xa, xb), Math.max(xa, xb)];
    const [z0, z1] = [Math.min(za, zb), Math.max(za, zb)];
    const alongX = z0 === z1;
    const t = 0.06;
    const min = alongX ? [x0, 0, z0 - t / 2] : [x0 - t / 2, 0, z0];
    const max = alongX ? [x1, FH, z0 + t / 2] : [x0 + t / 2, FH, z1];
    boxMesh(min, max, plank);
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.round(len / 1.8));
    for (let i = 0; i <= n; i++) {
      const a = (alongX ? x0 : z0) + (len * i) / n;
      boxMesh(alongX ? [a - 0.05, 0, z0 - 0.06] : [x0 - 0.06, 0, a - 0.05], alongX ? [a + 0.05, FH + 0.08, z0 + 0.06] : [x0 + 0.06, FH + 0.08, a + 0.05], post);
    }
    // thicker in physics, so a fast Lennie doesn't slip through
    solid(alongX ? [x0, 0, z0 - 0.15] : [x0 - 0.15, 0, z0], alongX ? [x1, FH, z0 + 0.15] : [x0 + 0.15, FH, z1], 'fence');
  }
  const { x0: gx0, x1: gx1, back } = GARDEN;
  const G0 = GARAGE;
  const gate = [2.0, 3.4];
  fence(gx0, -5.125, gx0, back);
  fence(gx1, G0.z0, gx1, back);
  fence(gx0, back, gate[0], back);
  fence(gate[1], back, gx1, back);
  // the gate: a lighter door in the back fence, with a latch
  both([gate[0], 0.05, back - 0.04], [gate[1], FH - 0.05, back + 0.04], gateMat, 'fence');
  boxMesh([gate[1] - 0.25, 1.0, back + 0.04], [gate[1] - 0.1, 1.05, back + 0.08], std({ color: 0x222222, roughness: 0.4, metalness: 0.6 }));

  // ------------------------------------------------------------ the lounge set in the corner behind the garage
  // A corner sofa (grey rattan, cream cushions): its long side against the
  // garage, its short side along the right-hand fence, and a low round table in
  // front of it, all under the canopy.
  const G = GARAGE;
  // the canopy: a flat roof of ribbed see-through plastic on a wooden frame,
  // fixed to the garage wall and the fence, on one wooden post at the corner that hangs out
  const C = { x0: G.x0, x1: 5.97, z0: -11.95, z1: G.z0, y: 2.35 }; // x1: the fence; z1: the garage wall
  const wood = std({ color: 0x8a6440, roughness: 0.85 });
  const ribs = canvasTexture(64, 16, (g, w, h) => {
    g.fillStyle = '#eef3f2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h);
  });
  ribs.wrapS = ribs.wrapT = THREE.RepeatWrapping;
  ribs.repeat.set((C.x1 - C.x0) / 0.5, 1);
  const sheet = boxMesh([C.x0, C.y, C.z0], [C.x1, C.y + 0.02, C.z1], std({ map: ribs, roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false }), false);
  solid([C.x0, C.y - 0.2, C.z0], [C.x1, C.y + 0.02, C.z1], 'roof');
  const B = 0.14; // the beams' height
  boxMesh([C.x0, C.y - B, C.z1 - 0.08], [C.x1, C.y, C.z1], wood); // against the garage wall
  boxMesh([C.x0, C.y - B, C.z0], [C.x1, C.y, C.z0 + 0.08], wood); // along the open front
  boxMesh([C.x0, C.y - B, C.z0 + 0.08], [C.x0 + 0.08, C.y, C.z1 - 0.08], wood); // along the open side
  boxMesh([C.x1 - 0.08, C.y - B, C.z0 + 0.08], [C.x1, C.y, C.z1 - 0.08], wood); // along the fence
  for (let x = C.x0 + 0.95; x < C.x1 - 0.5; x += 0.9) boxMesh([x, C.y - 0.1, C.z0 + 0.08], [x + 0.05, C.y, C.z1 - 0.08], wood); // rafters
  // fixed to the fence by short uprights (clear of its posts), and to the ground by the one post
  for (const z of [C.z1 - 0.35, (C.z0 + C.z1) / 2, C.z0 + 0.45]) boxMesh([C.x1 - 0.07, FH - 0.3, z - 0.04], [C.x1, C.y - B, z + 0.04], wood);
  both([C.x0, 0, C.z0], [C.x0 + 0.1, C.y - B, C.z0 + 0.1], wood, 'tree');
  const rattan = std({ color: 0x7d7368, roughness: 0.9 });
  const cushion = std({ color: 0xece4d2, roughness: 1 });
  const L = { x0: 1.65, x1: 5.9, z1: G.z0, seat: 0.75, end: -11.85 }; // x1: against the fence
  const front = L.z1 - L.seat; // the long side's front edge
  const side = L.x1 - L.seat; // the short side's front edge
  // the long side, with the corner seat
  both([L.x0, 0, front], [L.x1, 0.35, L.z1], rattan, 'cushion', physMats.soft);
  both([L.x0, 0.35, L.z1 - 0.25], [L.x1, 0.8, L.z1], rattan, 'cushion', physMats.soft);
  both([L.x0, 0.35, front], [L.x0 + 0.18, 0.58, L.z1 - 0.25], rattan, 'cushion', physMats.soft); // its arm
  // the short side, along the fence
  both([side, 0, L.end], [L.x1, 0.35, front], rattan, 'cushion', physMats.soft);
  both([L.x1 - 0.25, 0.35, L.end], [L.x1, 0.8, L.z1 - 0.25], rattan, 'cushion', physMats.soft);
  both([side, 0.35, L.end], [L.x1 - 0.25, 0.58, L.end + 0.18], rattan, 'cushion', physMats.soft); // its arm
  for (const [a, b] of [[1.88, 3.08], [3.13, 4.33], [4.38, 5.64]]) boxMesh([a, 0.35, front + 0.05], [b, 0.47, L.z1 - 0.28], cushion);
  for (const [a, b] of [[front - 0.6, front - 0.05], [L.end + 0.23, front - 0.65]]) boxMesh([side + 0.05, 0.35, a], [L.x1 - 0.28, 0.47, b], cushion);
  // (the low round table in front of it can be knocked over, so house.js builds it with the other loose furniture)

  // ------------------------------------------------------------ the trampoline (round, behind the lounge set)
  const pole = std({ color: 0x8a9099, metalness: 0.6, roughness: 0.4 });
  const T = { x: 2.9, z: -13.55, r: 1.35, y: 0.85 };
  const mat = add(new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r, 0.04, 40), std({ color: 0x1d1d22, roughness: 0.6 })), false);
  mat.position.set(T.x, T.y, T.z);
  const tramp = new CANNON.Body({ mass: 0, material: physMats.trampoline, shape: new CANNON.Cylinder(T.r, T.r, 0.16, 20) });
  tramp.position.set(T.x, T.y - 0.06, T.z);
  tramp.surface = { kind: 'trampoline' };
  world.addBody(tramp);
  const pad = add(new THREE.Mesh(new THREE.TorusGeometry(T.r + 0.14, 0.13, 8, 40).rotateX(Math.PI / 2), std({ color: 0x2f7de1, roughness: 0.6 })));
  pad.scale.y = 0.6;
  pad.position.set(T.x, T.y + 0.02, T.z);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const pb = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Box(new CANNON.Vec3(0.15, 0.06, 0.32)) });
    pb.position.set(T.x + Math.cos(a) * (T.r + 0.14), T.y + 0.02, T.z + Math.sin(a) * (T.r + 0.14));
    pb.quaternion.setFromEuler(0, -a, 0);
    pb.surface = { kind: 'cushion' };
    world.addBody(pb);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, T.y, 8), pole));
    leg.position.set(T.x + Math.cos(a) * (T.r + 0.12), T.y / 2, T.z + Math.sin(a) * (T.r + 0.12));
  }

  // ------------------------------------------------------------ the three wheelie bins by the gate: rest, GFT and paper
  const binBody = std({ color: 0x3c3f43, roughness: 0.6 });
  const tyre = std({ color: 0x1b1b1b, roughness: 0.8 });
  [[1.6, 0x3c3f43], [2.9, 0x3c8a3a], [4.2, 0x2f5fbf]].forEach(([x, lid]) => {
    const z0 = -16.0;
    const z1 = -15.3;
    both([x - 0.3, 0.06, z0], [x + 0.3, 1.0, z1], binBody, 'furniture');
    boxMesh([x - 0.32, 1.0, z0 - 0.04], [x + 0.32, 1.07, z1 + 0.02], std({ color: lid, roughness: 0.5 }));
    boxMesh([x - 0.28, 0.9, z1], [x + 0.28, 0.96, z1 + 0.06], binBody); // the handle
    for (const dx of [-0.26, 0.26]) {
      const w = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14).rotateZ(Math.PI / 2), tyre));
      w.position.set(x + dx, 0.1, z0 + 0.08);
    }
  });

  // ------------------------------------------------------------ the tree beside the bins, its crown over them and the trampoline
  {
    const [x, z, s] = [0.7, -15.3, 0.8];
    const trunk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 3 * s, 10), std({ color: 0x7a5232 })));
    trunk.position.set(x, 1.5 * s, z);
    const leafMats = [0x4f9a3c, 0x5fae47, 0x46893a].map((c) => std({ color: c, flatShading: true }));
    for (const [dx, dy, dz, r, mi] of [[0, 3.9, 0, 1.8, 0], [0.9, 3.4, 0.4, 1.2, 1], [-0.8, 3.5, -0.5, 1.3, 2], [0.2, 4.8, -0.2, 1.1, 1]]) {
      const leaf = add(new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), leafMats[mi]));
      leaf.position.set(x + dx * s, dy * s, z + dz * s);
    }
    solid([x - 0.28 * s, 0, z - 0.28 * s], [x + 0.28 * s, 3 * s, z + 0.28 * s], 'tree');
    // The crown catches him: a flat-topped tangle of branches hidden in the
    // leaves, grippy and hardly bouncy. (A round, bouncy ball here sent him
    // rolling off every time, so nobody ever got him stuck in the tree.)
    const nest = { r: 1.35, y0: 2.5, y1: 3.9 }; // (the leaves' bottom and middle; their top is at 4.7)
    const crown = new CANNON.Body({ mass: 0, material: physMats.branches ?? physMats.soft, shape: new CANNON.Cylinder(nest.r, nest.r, nest.y1 - nest.y0, 16) });
    crown.position.set(x, (nest.y0 + nest.y1) / 2, z);
    crown.surface = { kind: 'leaves' }; // landing up here is "Stuck in a tree!"
    world.addBody(crown);
  }

  // ------------------------------------------------------------ junk against the back fence
  // Old plywood boards leaning on the fence (between two of its posts), black
  // bin bags heaped by the bushes, a couple of cardboard boxes by the gate, and
  // old tyres on the other side of it. Lennie bounces off all of it; the bags are soft.
  {
    const face = back + 0.07; // just in front of the planks (back + 0.03) and posts (back + 0.06)
    // weathered: wood grain, grey-brown water stains, and dark damp where they stand in the grass
    let rs = 7;
    const r = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
    const worn = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = `rgba(120, 95, 60, ${0.08 + r() * 0.14})`;
        g.lineWidth = 1 + r() * 2;
        const x = r() * w;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 20, h / 3, x + (r() - 0.5) * 20, (2 * h) / 3, x + (r() - 0.5) * 12, h);
        g.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const [x, y, rad] = [r() * w, h * (0.3 + r() * 0.7), 10 + r() * 22];
        const st = g.createRadialGradient(x, y, 0, x, y, rad);
        st.addColorStop(0, 'rgba(70, 60, 45, 0.35)');
        st.addColorStop(0.8, 'rgba(70, 60, 45, 0.18)');
        st.addColorStop(1, 'rgba(70, 60, 45, 0)');
        g.fillStyle = st;
        g.fillRect(0, 0, w, h);
      }
      const damp = g.createLinearGradient(0, h, 0, h * 0.72);
      damp.addColorStop(0, 'rgba(40, 32, 22, 0.75)');
      damp.addColorStop(1, 'rgba(40, 32, 22, 0)');
      g.fillStyle = damp;
      g.fillRect(0, h * 0.72, w, h * 0.28);
    });
    const ply = [0xbfa67c, 0xa68d66, 0xcbb48c].map((c) => std({ color: c, map: worn, roughness: 0.95 }));
    const T = 0.018; // the boards' thickness
    // Each board leans back onto the one behind it (the first onto the fence),
    // its top back edge resting on that one's front face, and each leans a bit
    // further than the last, so their bottoms stand apart. surface(y): the z of
    // the face behind, at height y.
    let surface = () => face;
    for (const [x0, x1, h, a, mi] of [[-1.9, -0.7, 1.7, 0.13, 0], [-1.5, -0.35, 1.45, 0.2, 1], [-0.95, -0.15, 1.05, 0.3, 2]]) {
      const top = surface(h * Math.cos(a)) + 0.004;
      const zb = top + h * Math.sin(a); // the back face's bottom edge
      const centre = new THREE.Vector3((x0 + x1) / 2, 0, zb)
        .addScaledVector(new THREE.Vector3(0, Math.cos(a), -Math.sin(a)), h / 2)
        .addScaledVector(new THREE.Vector3(0, Math.sin(a), Math.cos(a)), T / 2);
      const board = add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, T), ply[mi]));
      board.position.copy(centre);
      board.rotation.x = -a;
      const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3((x1 - x0) / 2, h / 2, 0.04)) });
      b.position.set(centre.x, centre.y, centre.z);
      b.quaternion.setFromEuler(-a, 0, 0);
      b.surface = { kind: 'junk', sound: 'fence' };
      world.addBody(b);
      surface = (y) => zb + T / Math.cos(a) - y * Math.tan(a);
    }

    // cardboard boxes between the boards and the gate, one knocked askew
    const card = std({ color: 0xb08a5a, roughness: 1 });
    both([0.25, 0, face + 0.01], [0.85, 0.45, face + 0.51], card, 'junk');
    const askew = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), card));
    askew.position.set(1.35, 0.175, -19.05);
    askew.rotation.y = 0.35;
    const ab = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.175, 0.2)) });
    ab.position.set(1.35, 0.175, -19.05);
    ab.quaternion.setFromEuler(0, 0.35, 0);
    ab.surface = { kind: 'junk' };
    world.addBody(ab);

    // black bin bags heaped in the corner by the bushes, each tied at the top
    const bag = std({ color: 0x1f1f22, roughness: 0.6, metalness: 0.1, flatShading: true });
    for (const [x, y, z, r] of [[-3.45, 0, -18.95, 0.36], [-2.85, 0, -19.02, 0.33], [-2.38, 0, -18.92, 0.29], [-3.05, 0, -18.5, 0.3], [-3.15, 0.5, -19.0, 0.27]]) {
      const yc = y + r * 0.78;
      const m = add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bag));
      m.scale.set(1, 0.82, 0.92);
      m.position.set(x, yc, z);
      const knot = add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), bag));
      knot.position.set(x + 0.03, yc + r * 0.82 + 0.03, z);
      knot.rotation.z = -0.3;
      const b = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(r * 0.85) });
      b.position.set(x, yc, z);
      b.surface = { kind: 'trash', sound: 'cushion' };
      world.addBody(b);
    }

    // old tyres right of the gate: two lying stacked, one leaning on the fence
    for (const y of [0.11, 0.33]) {
      const m = add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 6, 18).rotateX(Math.PI / 2), tyre));
      m.position.set(4.7, y, -18.75);
    }
    const tb = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Cylinder(0.41, 0.41, 0.44, 12) });
    tb.position.set(4.7, 0.22, -18.75);
    tb.surface = { kind: 'junk' };
    world.addBody(tb);
    const lean = add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 6, 18), tyre));
    lean.position.set(5.45, 0.4, -19.2);
    lean.rotation.x = -0.25;
    const lb = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(0.41, 0.41, 0.11)) });
    lb.position.set(5.45, 0.4, -19.2);
    lb.quaternion.setFromEuler(-0.25, 0, 0);
    lb.surface = { kind: 'junk' };
    world.addBody(lb);
  }

  // ------------------------------------------------------------ the bushes along the left-hand fence
  const greens = [0x3b7d3a, 0x2f6b34, 0x4f9a3c, 0x46893a].map((c) => std({ color: c, flatShading: true }));
  let seed = 23;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const [zc, half, r] of [[-6.6, 1.0, 0.75], [-9.6, 1.1, 0.8], [-13.2, 1.6, 0.9], [-17.1, 1.6, 0.75]]) {
    for (let z = zc - half; z <= zc + half + 0.01; z += 0.55) {
      const rr = r * (0.75 + rnd() * 0.35);
      const blob = add(new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), greens[Math.floor(rnd() * greens.length)]));
      blob.scale.set(0.9, 1.1, 1);
      blob.position.set(-4.95 + (rnd() - 0.5) * 0.3, rr * 0.95, z);
      const top = add(new THREE.Mesh(new THREE.IcosahedronGeometry(rr * 0.7, 1), greens[Math.floor(rnd() * greens.length)]));
      top.position.set(-4.95 + (rnd() - 0.5) * 0.3, rr * 1.75, z + (rnd() - 0.5) * 0.3);
    }
    const b = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Box(new CANNON.Vec3(0.6, r * 1.1, half + r * 0.6)) });
    b.position.set(-4.95, r * 1.1, zc);
    b.surface = { kind: 'leaves' };
    world.addBody(b);
  }
}
