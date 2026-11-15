import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { meterBoxUVs } from './textures.js';
import { canvasTexture } from './supermarket.js';
import { UTILITY } from './house.js';

// Lennie's back garden, after the owner's sketch (docs/floorplan-floor1.png):
// bushes all along the left fence, and down the right-hand side, behind the
// utility room, the garage (very, very stuffed), the lounge set under a
// striped awning, the round trampoline, and a tree beside the three wheelie
// bins by the gate in the back fence. A wooden fence runs round it, with the alley behind.
// Lennie bounces off all of it; the bushes, the lounge set, the awning and the
// trampoline are bouncy.
export const GARDEN = { x0: -6, x1: 6, back: -17.5 };
const GARAGE = { x0: UTILITY.x0 - 0.125, x1: 6.125, z0: -9.8, z1: UTILITY.z0 - 0.125, top: 2.6 };

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
  const gate = [2.0, 3.4];
  fence(gx0, -5.125, gx0, back);
  fence(gx1, GARAGE.z0, gx1, back);
  fence(gx0, back, gate[0], back);
  fence(gate[1], back, gx1, back);
  // the gate: a lighter door in the back fence, with a latch
  both([gate[0], 0.05, back - 0.04], [gate[1], FH - 0.05, back + 0.04], gateMat, 'fence');
  boxMesh([gate[1] - 0.25, 1.0, back + 0.04], [gate[1] - 0.1, 1.05, back + 0.08], std({ color: 0x222222, roughness: 0.4, metalness: 0.6 }));

  // ------------------------------------------------------------ the garage, behind the utility room
  // Brick, flat-roofed and solid, its side door ajar on boxes stacked to the ceiling.
  const G = GARAGE;
  const brick = std({ map: tex.brick });
  boxMesh([G.x0, 0, G.z0], [G.x1, G.top, G.z1], brick);
  boxMesh([G.x0 - 0.1, G.top, G.z0 - 0.1], [G.x1, G.top + 0.2, G.z1], [std({ color: 0xfbfaf6 }), std({ color: 0xfbfaf6 }), std({ color: 0x35302e, roughness: 0.8 }), std({ color: 0xfbfaf6 }), std({ color: 0xfbfaf6 }), std({ color: 0xfbfaf6 })]);
  solid([G.x0 - 0.1, 0, G.z0 - 0.1], [G.x1, G.top + 0.2, G.z1], 'shed');
  const door = [-8.75, -7.85];
  const trim = std({ color: 0xfbfaf6, roughness: 0.6 });
  boxMesh([G.x0 - 0.04, 0, door[0] - 0.07], [G.x0 + 0.01, 2.15, door[0]], trim);
  boxMesh([G.x0 - 0.04, 0, door[1]], [G.x0 + 0.01, 2.15, door[1] + 0.07], trim);
  boxMesh([G.x0 - 0.04, 2.08, door[0] - 0.07], [G.x0 + 0.01, 2.15, door[1] + 0.07], trim);
  // what you see through the gap: cardboard boxes, a bike wheel, a deflated paddling pool
  const cardboard = [0xb8895a, 0xa47a4d, 0xc99d6b].map((c) => std({ color: c, roughness: 0.9 }));
  let i = 0;
  for (let y = 0; y < 2.0; y += 0.42) {
    for (let z = door[0]; z < door[1] - 0.05; z += 0.45) {
      const w = Math.min(0.45, door[1] - z);
      boxMesh([G.x0 - 0.02, y, z + 0.01], [G.x0 + 0.005, y + 0.41, z + w - 0.01], cardboard[i++ % 3], false);
    }
  }
  const wheel = add(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 24), std({ color: 0x222222, roughness: 0.6 })));
  wheel.rotation.y = Math.PI / 2 + 0.3;
  wheel.position.set(G.x0 - 0.12, 0.6, door[0] + 0.3);
  const pool = add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), std({ color: 0x3fa7e0, roughness: 0.5 })));
  pool.scale.set(0.5, 0.35, 1);
  pool.position.set(G.x0 - 0.1, 1.55, door[1] - 0.25);
  // the door itself, swung open a little
  const leaf = boxMesh([-0.02, 0, 0], [0.02, 2.08, door[1] - door[0]], std({ color: 0x2f5d4a, roughness: 0.6 }));
  leaf.position.set(G.x0 - 0.02, 1.04, door[0]);
  leaf.geometry.translate(0, 0, (door[1] - door[0]) / 2);
  leaf.rotation.y = -0.5;

  // ------------------------------------------------------------ the lounge set under a striped awning against the garage
  const awningTex = canvasTexture(128, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16) % 2 ? '#f4f1e8' : '#2f8a5b';
      g.fillRect(x, 0, 16, h);
    }
  });
  awningTex.wrapS = THREE.RepeatWrapping;
  awningTex.repeat.set(3, 1);
  const A = { x0: 1.55, x1: 4.65, zIn: G.z0, zOut: -11.4, yIn: 2.5, yOut: 2.2 };
  const depth = A.zIn - A.zOut;
  const tilt = Math.atan2(A.yIn - A.yOut, depth);
  const len = Math.hypot(depth, A.yIn - A.yOut);
  const cloth = add(new THREE.Mesh(new THREE.BoxGeometry(A.x1 - A.x0, 0.04, len), std({ map: awningTex, roughness: 0.9 })));
  cloth.position.set((A.x0 + A.x1) / 2, (A.yIn + A.yOut) / 2, (A.zIn + A.zOut) / 2);
  cloth.rotation.x = -tilt;
  // a scalloped valance along the front
  boxMesh([A.x0, A.yOut - 0.25, A.zOut - 0.03], [A.x1, A.yOut, A.zOut + 0.01], std({ map: awningTex, roughness: 0.9 }));
  const awning = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Box(new CANNON.Vec3((A.x1 - A.x0) / 2, 0.1, len / 2)) });
  awning.position.set(cloth.position.x, cloth.position.y, cloth.position.z);
  awning.quaternion.setFromEuler(-tilt, 0, 0);
  awning.surface = { kind: 'cushion' };
  world.addBody(awning);
  const pole = std({ color: 0x8a9099, metalness: 0.6, roughness: 0.4 });
  for (const x of [A.x0 + 0.1, A.x1 - 0.1]) {
    const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, A.yOut, 8), pole));
    p.position.set(x, A.yOut / 2, A.zOut + 0.08);
    solid([x - 0.05, 0, A.zOut + 0.03], [x + 0.05, A.yOut, A.zOut + 0.13], 'tree');
  }
  // the lounge sofa (grey rattan, cream cushions) with its back to the garage, and a round table
  const rattan = std({ color: 0x7d7368, roughness: 0.9 });
  const cushion = std({ color: 0xece4d2, roughness: 1 });
  both([1.9, 0, -10.45], [5.5, 0.35, G.z0], rattan, 'cushion', physMats.soft);
  both([1.9, 0.35, -10.0], [5.5, 0.8, G.z0], rattan, 'cushion', physMats.soft);
  for (const [a, b] of [[2.0, 3.15], [3.2, 4.3], [4.35, 5.4]]) boxMesh([a, 0.35, -10.4], [b, 0.47, -10.02], cushion);
  const top = add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 28), std({ color: 0xd8d2c4, roughness: 0.5 })));
  top.position.set(2.9, 0.7, -10.85);
  const stem = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 0.68, 12), rattan));
  stem.position.set(2.9, 0.34, -10.85);
  solid([2.5, 0, -11.25], [3.3, 0.72, -10.45], 'furniture');

  // ------------------------------------------------------------ the trampoline (round, behind the lounge set)
  const T = { x: 2.9, z: -12.95, r: 1.45, y: 0.85 };
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
    const z0 = -15.75;
    const z1 = -15.05;
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
    const crown = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(1.9 * s) });
    crown.position.set(x, 4.0 * s, z);
    crown.surface = { kind: 'leaves' }; // landing up here is "Stuck in a tree!"
    world.addBody(crown);
  }

  // ------------------------------------------------------------ the bushes along the left-hand fence
  const greens = [0x3b7d3a, 0x2f6b34, 0x4f9a3c, 0x46893a].map((c) => std({ color: c, flatShading: true }));
  let seed = 23;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const [zc, half, r] of [[-6.6, 1.0, 0.75], [-9.6, 1.1, 0.8], [-13.2, 1.6, 0.9], [-16.3, 0.6, 0.7]]) {
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
