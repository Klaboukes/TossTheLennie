import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { floorGeometry } from './textures.js';
import { buildSupermarket, canvasTexture } from './supermarket.js';

// The street in front of the row, after the real one: past the front-garden
// hedge a red cycle path, a grass verge with tall trees and street lamps, a
// two-lane road, another verge, and across the road an orange supermarket with
// slate and glass gables (supermarket.js), which Lennie can be flung into.
// Distances are z (metres) from the middle of the house; its front is at 5.1.
export const STREET = {
  cycle: [12.6, 15.0], // red cycle path
  verge: [15.0, 18.5], // grass, trees, lamps
  road: [18.6, 25.0],
  farVerge: [25.1, 30],
  shopFront: 30, // the supermarket's front wall (SHOP.z0)
};
// the street lamps along the verge, 40 cm from the road (effects.js bonks Lennie on them)
export const LAMP_XS = [-14, 7, 28];
const REACH = 70; // how far the street runs left and right (fog hides the ends)

export function buildStreet(scene, world, physMats, { std, tex }) {
  const add = (mesh, cast = false) => {
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    scene.add(mesh);
    return mesh;
  };
  const flat = (x0, z0, x1, z1, mat, y) => {
    const m = add(new THREE.Mesh(floorGeometry(x0, z0, x1, z1), mat));
    m.position.y = y;
  };
  const boxAt = (min, max, mat, cast = false) => {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), mat), cast);
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    return m;
  };
  const solid = (min, max, kind, material = physMats.hard) => {
    const b = new CANNON.Body({ mass: 0, material, shape: new CANNON.Box(new CANNON.Vec3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2)) });
    b.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    b.surface = { kind };
    world.addBody(b);
  };
  // The road markings are pulled in front of the road in the depth test (like
  // the rugs in the house): only 2 mm above it, they flickered from afar.
  const white = std({ color: 0xf6f6f2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });

  // ------------------------------------------------------------ cycle path, kerbs, road and markings
  flat(-REACH, STREET.cycle[0], REACH, STREET.cycle[1], std({ color: 0xbf6152, roughness: 0.95 }), 0.007);
  const cycleMid = (STREET.cycle[0] + STREET.cycle[1]) / 2;
  for (let x = -REACH; x < REACH; x += 4) flat(x, cycleMid - 0.05, x + 0.6, cycleMid + 0.05, white, 0.009);

  const [r0, r1] = STREET.road;
  flat(-REACH, r0, REACH, r1, std({ color: 0x6e7074, roughness: 0.95 }), 0.007);
  const kerb = std({ color: 0xc9c6bf, roughness: 0.8 });
  boxAt([-REACH, 0, r0 - 0.15], [REACH, 0.1, r0], kerb);
  boxAt([-REACH, 0, r1], [REACH, 0.1, r1 + 0.15], kerb);
  const roadMid = (r0 + r1) / 2;
  for (let x = -REACH; x < REACH; x += 6) flat(x, roadMid - 0.06, x + 3, roadMid + 0.06, white, 0.009);
  for (const z of [r0 + 0.35, r1 - 0.35]) for (let x = -REACH; x < REACH; x += 2) flat(x, z - 0.05, x + 1, z + 0.05, white, 0.009);

  // ------------------------------------------------------------ verges: trees, lamps, shrubs, a cycle-path sign
  const trunkMat = std({ color: 0x6b4a32 });
  const springLeaves = [0x9cc65a, 0x86b84b, 0xb0d36b].map((c) => std({ color: c, flatShading: true }));
  function streetTree(x, z, s = 1) {
    // tall and slim with a high, airy crown, like the oaks along the real road
    const hTrunk = 6.2 * s;
    const trunk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.3 * s, hTrunk, 10), trunkMat), true);
    trunk.position.set(x, hTrunk / 2, z);
    for (const [dx, dy, dz, r, mi] of [[0, 7.2, 0, 2.0, 0], [1.4, 6.6, 0.3, 1.3, 1], [-1.3, 6.8, -0.3, 1.4, 2], [0.3, 8.4, 0.2, 1.3, 1], [-0.5, 6.2, 0.9, 1.0, 0]]) {
      const leaf = add(new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), springLeaves[mi]), true);
      leaf.position.set(x + dx * s, dy * s, z + dz * s);
    }
    solid([x - 0.25 * s, 0, z - 0.25 * s], [x + 0.25 * s, hTrunk, z + 0.25 * s], 'tree');
    const crown = new CANNON.Body({ mass: 0, material: physMats.soft, shape: new CANNON.Sphere(2.1 * s) });
    crown.position.set(x, 7.2 * s, z);
    crown.surface = { kind: 'leaves' };
    world.addBody(crown);
  }
  const treeZ = (STREET.verge[0] + STREET.verge[1]) / 2 - 0.2;
  // one in line with each wall between two houses (every 8.25 m: house.js ROW,
  // x −12.375 … 28.875) along the whole block of five, and one past its left
  // end, so they frame Lennie's house (x −4.125 … 4.125) instead of hiding it
  for (let i = 0, x = -20.625; x <= 29; i++, x += 8.25) streetTree(x, treeZ, 0.9 + (i % 3) * 0.06);
  // a couple across the road too
  for (const x of [-40, 18, 27]) streetTree(x, 27.2, 0.85);

  const lampMat = std({ color: 0x7d838a, roughness: 0.5, metalness: 0.3 });
  const lampHead = std({ color: 0xfff6d8, emissive: 0x6b6040, roughness: 0.4 });
  for (const x of LAMP_XS) {
    const z = STREET.verge[1] - 0.4;
    const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 7, 8), lampMat), true);
    pole.position.set(x, 3.5, z);
    const arm = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), lampMat), true);
    arm.position.set(x, 6.95, z + 0.5);
    const head = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.55), lampHead), true);
    head.position.set(x, 6.88, z + 1.05);
    head.userData.lampHead = true; // (kept apart from the glued scenery, so it can flicker when Lennie bonks the pole)
    solid([x - 0.1, 0, z - 0.1], [x + 0.1, 7, z + 0.1], 'tree');
  }

  // low ground-cover shrubs along the verges, bouncy like the bushes
  const shrubMats = [0x5e9a3f, 0x77a94a, 0x4f8a3a].map((c) => std({ color: c, flatShading: true }));
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const [z0, z1, step] of [[STREET.verge[0] + 0.4, STREET.verge[1] - 0.6, 2.2], [STREET.farVerge[0] + 0.5, STREET.farVerge[1] - 0.8, 1.6]]) {
    for (let x = -REACH + 2; x < REACH; x += step + rnd() * step) {
      const r = 0.45 + rnd() * 0.35;
      const z = z0 + rnd() * (z1 - z0);
      if (z > STREET.farVerge[0] && x > -5.4 && x < -2.6) continue; // keep the shop's green carpet clear
      const blob = add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), shrubMats[Math.floor(rnd() * 3)]), true);
      blob.scale.set(1.3, 0.55, 1);
      blob.position.set(x, r * 0.25, z);
    }
  }

  // round blue "cycle path" sign at the start of the cycle path
  const signTex = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1f5fbf';
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    for (const cx of [40, 88]) { g.beginPath(); g.arc(cx, 76, 16, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(40, 76); g.lineTo(58, 50); g.lineTo(80, 50); g.lineTo(88, 76); g.moveTo(58, 50); g.lineTo(66, 76); g.lineTo(80, 50); g.moveTo(54, 42); g.lineTo(64, 42); g.stroke();
  });
  const signX = 19;
  const signPole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), lampMat), true);
  signPole.position.set(signX, 1.15, STREET.verge[0] + 0.3);
  const sign = add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 32), [lampMat, std({ map: signTex }), lampMat]));
  sign.rotation.x = Math.PI / 2; // the disc's printed face looks out over the street (+z)
  sign.position.set(signX, 2.2, STREET.verge[0] + 0.33);

  // the blue Dutch street name sign on two low posts, readable from both sides
  const nameTex = canvasTexture(768, 192, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d4594';
    g.fillRect(10, 10, w - 20, h - 20);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.fillStyle = '#ffffff';
    g.font = 'bold 104px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Appellaan', w / 2, h / 2 + 4);
  });
  const nameX = -9.5;
  const nameZ = STREET.verge[0] + 0.5;
  const board = { x0: nameX - 0.65, x1: nameX + 0.65, y0: 0.85, y1: 1.175, z0: nameZ - 0.015, z1: nameZ + 0.015 };
  for (const x of [board.x0 + 0.12, board.x1 - 0.12]) {
    boxAt([x - 0.03, 0, nameZ - 0.065], [x + 0.03, board.y1 - 0.02, nameZ - 0.015], lampMat, true);
    solid([x - 0.03, 0, nameZ - 0.065], [x + 0.03, board.y1, nameZ - 0.015], 'tree');
  }
  const nameMat = std({ map: nameTex, roughness: 0.5 });
  boxAt([board.x0, board.y0, board.z0], [board.x1, board.y1, board.z1], [lampMat, lampMat, lampMat, lampMat, nameMat, nameMat], true);
  solid([board.x0, board.y0, board.z0], [board.x1, board.y1, board.z1], 'tree');

  // ------------------------------------------------------------ the supermarket across the road (supermarket.js)
  const shop = buildSupermarket(scene, world, physMats, { std, tex });

  return shop;
}
