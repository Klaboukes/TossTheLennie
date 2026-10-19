import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { textures, floorGeometry } from './textures.js';

export const YARD = { half: 22 };

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
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 70;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ------------------------------------------------------------ ground
  const grass = new THREE.Mesh(floorGeometry(-90, -90, 90, 90), std({ map: tex.grass, roughness: 1 }));
  grass.receiveShadow = true;
  scene.add(grass);
  const ground = new CANNON.Body({ mass: 0, material: physMats.ground, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.surface = { kind: 'ground' };
  world.addBody(ground);

  const path = new THREE.Mesh(floorGeometry(-1.3, 5.15, 0, YARD.half), std({ map: tex.stone }));
  path.position.y = 0.006;
  path.receiveShadow = true;
  scene.add(path);
  const drive = new THREE.Mesh(floorGeometry(7, 1, 10.2, YARD.half), std({ color: 0x8d8f93, roughness: 0.95 }));
  drive.position.y = 0.005;
  drive.receiveShadow = true;
  scene.add(drive);

  // ------------------------------------------------------------ fence (visual) + invisible boundary planes
  const h = YARD.half;
  const spacing = 0.28;
  const perSide = Math.floor((2 * h) / spacing);
  const pickets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.0, 0.04), std({ color: 0xffffff, roughness: 0.7 }), perSide * 4);
  const m = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < perSide; i++) {
    const a = -h + (i + 0.5) * spacing;
    m.makeTranslation(a, 0.5, h); pickets.setMatrixAt(n++, m);
    m.makeTranslation(a, 0.5, -h); pickets.setMatrixAt(n++, m);
    m.makeRotationY(Math.PI / 2).setPosition(h, 0.5, a); pickets.setMatrixAt(n++, m);
    m.makeRotationY(Math.PI / 2).setPosition(-h, 0.5, a); pickets.setMatrixAt(n++, m);
  }
  pickets.castShadow = true;
  scene.add(pickets);
  const railMat = std({ color: 0xf2f0ea });
  for (const y of [0.3, 0.75]) {
    for (const s of [1, -1]) {
      const rx = new THREE.Mesh(new THREE.BoxGeometry(2 * h, 0.08, 0.05), railMat);
      rx.position.set(0, y, s * (h - 0.05));
      scene.add(rx);
      const rz = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2 * h), railMat);
      rz.position.set(s * (h - 0.05), y, 0);
      scene.add(rz);
    }
  }
  for (const [axis, sign] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
    const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Plane() });
    // Plane normal is local +z; point it back into the yard.
    if (axis === 'x') b.quaternion.setFromEuler(0, sign > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    else b.quaternion.setFromEuler(0, sign > 0 ? Math.PI : 0, 0);
    b.position[axis] = sign * (h + 0.1);
    b.surface = { kind: 'fence' };
    world.addBody(b);
  }

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
  tree(-15, 12, 1.1);
  tree(16, 15, 0.9);

  const bushMat = std({ color: 0x3f8a3a, flatShading: true });
  for (const [x, z, r] of [[-5.2, 6.2, 0.8], [-3.4, 6.3, 0.7], [2.0, 6.2, 0.75], [3.8, 6.3, 0.8], [5.4, 6.1, 0.65]]) {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bushMat);
    bush.scale.set(1, 0.8, 1);
    bush.position.set(x, r * 0.6, z);
    bush.castShadow = true;
    scene.add(bush);
    const b = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(r * 0.85) });
    b.position.set(x, r * 0.45, z);
    b.surface = { kind: 'leaves' };
    world.addBody(b);
  }

  // ------------------------------------------------------------ trampoline
  const T = { x: 11, z: 10, half: 1.6, y: 0.85 };
  const mat = new THREE.Mesh(new THREE.BoxGeometry(T.half * 2, 0.04, T.half * 2), std({ color: 0x1d1d22, roughness: 0.6 }));
  mat.position.set(T.x, T.y, T.z);
  mat.receiveShadow = true;
  scene.add(mat);
  const tramp = new CANNON.Body({ mass: 0, material: physMats.trampoline, shape: new CANNON.Box(new CANNON.Vec3(T.half, 0.08, T.half)) });
  tramp.position.set(T.x, T.y - 0.06, T.z);
  tramp.surface = { kind: 'trampoline' };
  world.addBody(tramp);
  const padMat = std({ color: 0x2f7de1, roughness: 0.6 });
  const pw = 0.32;
  for (const [cx, cz, sx, sz] of [
    [0, T.half + pw / 2, T.half * 2 + pw * 2, pw],
    [0, -T.half - pw / 2, T.half * 2 + pw * 2, pw],
    [T.half + pw / 2, 0, pw, T.half * 2],
    [-T.half - pw / 2, 0, pw, T.half * 2],
  ]) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sz), padMat);
    pad.position.set(T.x + cx, T.y + 0.02, T.z + cz);
    pad.castShadow = true;
    scene.add(pad);
    const pb = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Box(new CANNON.Vec3(sx / 2, 0.06, sz / 2)) });
    pb.position.set(T.x + cx, T.y + 0.02, T.z + cz);
    pb.surface = { kind: 'cushion' };
    world.addBody(pb);
  }
  const legMat = std({ color: 0x8a9099, metalness: 0.6, roughness: 0.4 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, T.y, 8), legMat);
    leg.position.set(T.x + sx * (T.half + 0.15), T.y / 2, T.z + sz * (T.half + 0.15));
    leg.castShadow = true;
    scene.add(leg);
  }
}
