import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// The game draws no real shadows: they made every frame several times more
// work, far too much for low-end tablets and phones. Instead Lennie gets a
// soft dark spot on whatever is under him, so you can still see how high he
// flies and where he'll come down. It grows and fades as he goes up.

const SIZE = 0.6; // radius in metres when he's lying on something
const GROW = 0.05; // extra radius per metre of height
const FADE_TOP = 10; // metres up at which the spot has faded away
const DARK = 0.45;

function spotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** `rayOptions` picks the bodies the spot can fall on (the scenery, not Lennie). */
export function createBlobShadow(scene, world, rayOptions) {
  const material = new THREE.MeshBasicMaterial({
    map: spotTexture(), color: 0x000000, transparent: true, opacity: DARK, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), material);
  spot.userData.noAim = true; // not scenery: aiming and the see-through circle ignore it
  spot.visible = false;
  scene.add(spot);

  const from = new CANNON.Vec3();
  const to = new CANNON.Vec3();
  const hit = new CANNON.RaycastResult();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();

  /** Puts the spot under `center` (Lennie's middle as drawn). */
  function update(center) {
    from.set(center.x, center.y, center.z);
    to.set(center.x, center.y - FADE_TOP - 2, center.z);
    hit.reset();
    if (!world.raycastClosest(from, to, rayOptions, hit)) {
      spot.visible = false;
      return;
    }
    const height = Math.max(0, center.y - hit.hitPointWorld.y - 0.15);
    const strength = 1 - Math.min(1, height / FADE_TOP);
    spot.visible = strength > 0.02;
    if (!spot.visible) return;
    normal.set(hit.hitNormalWorld.x, hit.hitNormalWorld.y, hit.hitNormalWorld.z);
    if (normal.y < 0.3) normal.copy(up); // a wall: lie flat anyway
    spot.position.set(hit.hitPointWorld.x, hit.hitPointWorld.y, hit.hitPointWorld.z).addScaledVector(normal, 0.015);
    spot.quaternion.setFromUnitVectors(up, normal);
    spot.scale.setScalar(SIZE + GROW * height);
    material.opacity = DARK * strength;
  }

  return { update, mesh: spot };
}
