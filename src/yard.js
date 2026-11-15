import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { textures, floorGeometry } from './textures.js';
import { buildStreet, STREET } from './streetscape.js';
import { SHOP } from './supermarket.js';
import { buildGarden } from './garden.js';
import { ROW } from './house.js';

// The play area: x and the back garden reach ±half; at the front it runs
// across the street and through the supermarket to its back wall (see
// streetscape.js and supermarket.js).
export const YARD = { half: 22, front: SHOP.z1 - SHOP.t };

// Deterministic pseudo-random, so the hedge looks the same every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildYard(scene, world, physMats) {
  const tex = textures();
  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...opts });

  // ------------------------------------------------------------ sky + light
  const skyGeo = new THREE.SphereGeometry(180, 32, 16);
  const colors = [];
  const top = new THREE.Color(0x5fa8e8);
  const horizon = new THREE.Color(0xe3f2ff);
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 180);
    const c = horizon.clone().lerp(top, Math.pow(t, 0.6));
    colors.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  scene.fog = new THREE.Fog(0xe3f2ff, 70, 170);

  scene.add(new THREE.HemisphereLight(0xe2f0ff, 0x7a9a5a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(14, 26, 12);
  sun.target.position.set(0, 2, 0);
  scene.add(sun, sun.target); // no shadows (too slow on low-end tablets, see main.js)

  // ------------------------------------------------------------ ground
  // The grass is nudged back in the depth test, so anything lying exactly at
  // ground level always draws over it instead of flickering against it. (The
  // buildings stand on concrete bases a few mm above it, which show under a
  // faded wall: house.js FOUND_TOP and the supermarket's base.)
  const grass = new THREE.Mesh(floorGeometry(-90, -90, 90, 90), std({ map: tex.grass, roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 }));
  grass.receiveShadow = true;
  scene.add(grass);
  const ground = new CANNON.Body({ mass: 0, material: physMats.ground, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.surface = { kind: 'ground' };
  world.addBody(ground);

  // a small garden path from the front door (house.js FRONT_DOOR is x −1.57 … −0.57) to the cycle path
  const PATH = [-1.52, -0.62];
  const path = new THREE.Mesh(floorGeometry(PATH[0], 5.15, PATH[1], STREET.cycle[0]), std({ map: tex.stone }));
  path.position.y = 0.006;
  path.receiveShadow = true;
  scene.add(path);

  // ------------------------------------------------------------ back-garden fence (visual) + invisible boundary planes
  // Like the real street, the front gardens are open to the street; only the
  // back gardens are fenced. The invisible sides run all the way to the front.
  const h = YARD.half;
  const spacing = 0.28;
  const perSide = Math.floor((2 * h) / spacing);
  const rowGap = 5.3; // the side fences stop short of the row's back walls (z −5.125), where the row reaches them
  const pickets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.0, 0.04), std({ color: 0xffffff, roughness: 0.7 }), perSide * 3);
  const m = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < perSide; i++) {
    const a = -h + (i + 0.5) * spacing;
    m.makeTranslation(a, 0.5, -h); pickets.setMatrixAt(n++, m);
    if (a > -rowGap) continue;
    m.makeRotationY(Math.PI / 2).setPosition(h, 0.5, a); pickets.setMatrixAt(n++, m);
    m.makeRotationY(Math.PI / 2).setPosition(-h, 0.5, a); pickets.setMatrixAt(n++, m);
  }
  pickets.count = n;
  pickets.castShadow = true;
  scene.add(pickets);
  const railMat = std({ color: 0xf2f0ea });
  for (const y of [0.3, 0.75]) {
    const rx = new THREE.Mesh(new THREE.BoxGeometry(2 * h, 0.08, 0.05), railMat);
    rx.position.set(0, y, -(h - 0.05));
    scene.add(rx);
    for (const s of [1, -1]) {
      const rz = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, h - rowGap), railMat);
      rz.position.set(s * (h - 0.05), y, -(h + rowGap) / 2);
      scene.add(rz);
    }
  }
  for (const [axis, sign, at] of [['x', 1, h], ['x', -1, h], ['z', 1, YARD.front], ['z', -1, h]]) {
    const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Plane() });
    // Plane normal is local +z; point it back into the yard.
    if (axis === 'x') b.quaternion.setFromEuler(0, sign > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    else b.quaternion.setFromEuler(0, sign > 0 ? Math.PI : 0, 0);
    b.position[axis] = sign * (at + 0.1);
    b.surface = { kind: 'fence' };
    world.addBody(b);
  }

  // ------------------------------------------------------------ the street in front
  const shop = buildStreet(scene, world, physMats, { std, tex });

  // ------------------------------------------------------------ trees and bushes
  const trunkMat = std({ color: 0x7a5232 });
  const leafMats = [0x4f9a3c, 0x5fae47, 0x46893a].map((c) => std({ color: c, flatShading: true }));
  function tree(x, z, s) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 3 * s, 10), trunkMat);
    trunk.position.set(x, 1.5 * s, z);
    trunk.castShadow = true;
    scene.add(trunk);
    for (const [dx, dy, dz, r, mi] of [[0, 3.9, 0, 1.8, 0], [0.9, 3.4, 0.4, 1.2, 1], [-0.8, 3.5, -0.5, 1.3, 2], [0.2, 4.8, -0.2, 1.1, 1]]) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), leafMats[mi]);
      leaf.position.set(x + dx * s, dy * s, z + dz * s);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      scene.add(leaf);
    }
    const tb = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(0.28 * s, 1.5 * s, 0.28 * s)) });
    tb.position.set(x, 1.5 * s, z);
    tb.surface = { kind: 'tree' };
    world.addBody(tb);
    const cb = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(1.9 * s) });
    cb.position.set(x, 4.0 * s, z);
    cb.surface = { kind: 'leaves' };
    world.addBody(cb);
  }
  tree(-13, -9, 1.2);
  tree(14, -12, 1.0);

  const leaves = (x, y, z, r) => {
    const b = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(r) });
    b.position.set(x, y, z);
    b.surface = { kind: 'leaves' };
    world.addBody(b);
  };
  const bushMats = new Map();
  const bushMat = (color) => {
    if (!bushMats.has(color)) bushMats.set(color, std({ color, flatShading: true }));
    return bushMats.get(color);
  };
  const blob = (x, y, z, r, color, squash = 0.8) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bushMat(color));
    mesh.scale.set(1, squash, 1);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  };

  // Lennie's front garden, after the sketch: the big dark lumpy bush on the
  // right, out by the hedge in front of the kitchen's window column (house.js
  // COLUMN, x 0.8 … 3.0), a cluster of blobs in a few greens, bouncy all over,
  // clear of the path and of the neighbours' garden (x 4.125); and low bushes
  // all along the left, beside the neighbours' garden.
  const SHRUB = { x: 1.9, z: 10.0 };
  for (const [dx, dy, dz, r, c] of [
    [-1.35, 0.55, 0.15, 0.8, 0x2f6b34], [-0.65, 0.8, -0.1, 1.05, 0x3b7d3a], [0.2, 0.9, 0.2, 1.1, 0x2f6b34],
    [1.05, 0.75, -0.05, 0.95, 0x285e2e], [1.6, 0.5, 0.25, 0.65, 0x3b7d3a], [-0.3, 1.6, 0.05, 0.75, 0x46893a],
    [0.65, 1.55, -0.15, 0.7, 0x3b7d3a], [-1.0, 1.25, 0.35, 0.55, 0x285e2e], [0.05, 0.45, 0.75, 0.6, 0x46893a],
  ]) blob(SHRUB.x + dx, dy, SHRUB.z + dz, r, c, 0.85);
  for (const [dx, y, r] of [[-1.05, 0.6, 0.8], [0, 0.85, 1.0], [1.1, 0.6, 0.8]]) leaves(SHRUB.x + dx, y, SHRUB.z, r);

  const lowR = rng(29);
  for (let z = 6.65; z < 11.5; z += 0.5) {
    const r = 0.42 + lowR() * 0.14;
    blob(-3.45 + (lowR() - 0.5) * 0.2, r * 0.5, z, r, [0x2f6b34, 0x3b7d3a, 0x46893a][Math.floor(lowR() * 3)], 0.75);
  }
  const lowB = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Box(new CANNON.Vec3(0.45, 0.4, 2.6)) });
  lowB.position.set(-3.45, 0.4, 9.05);
  lowB.surface = { kind: 'leaves' };
  world.addBody(lowB);

  // smaller shrubs in the neighbours' front gardens (yellow-green ones on the right, like the photo)
  for (const [x, z, r, c] of [
    [6.35, 6.9, 0.9, 0x8db843], [11.4, 7.4, 0.65, 0x8db843], [12.95, 7.8, 0.5, 0x3f8a3a],
    [-10.1, 6.9, 1.0, 0x2f6b34], [-8.5, 7.7, 0.6, 0x3f8a3a], [-13.85, 6.9, 0.85, 0x3f8a3a],
  ]) {
    blob(x, r * 0.6, z, r, c);
    leaves(x, r * 0.45, z, r * 0.85);
  }

  // A low yellow-green hedge along the front of all the gardens, by the cycle
  // path, with a gap for the garden path.
  const HEDGE = { z: STREET.cycle[0] - 0.55, depth: 0.8, height: 0.75 };
  const hedgeR = rng(17);
  for (const [x0, x1] of [[-h - 12, PATH[0] - 0.45], [PATH[1] + 0.45, ROW.x1 + 3]]) {
    for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.55) {
      const r = 0.42 + hedgeR() * 0.12;
      blob(x, HEDGE.height - r * 0.55, HEDGE.z + (hedgeR() - 0.5) * 0.12, r, hedgeR() < 0.5 ? 0x9cba4a : 0x8db843, 0.95);
    }
    const hb = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Box(new CANNON.Vec3((x1 - x0) / 2, HEDGE.height / 2, HEDGE.depth / 2)) });
    hb.position.set((x0 + x1) / 2, HEDGE.height / 2, HEDGE.z);
    hb.surface = { kind: 'leaves' };
    world.addBody(hb);
  }

  // ------------------------------------------------------------ Lennie's own back garden (garden.js)
  buildGarden(scene, world, physMats, { std, tex });
  return { shop };
}
