import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Furniture Lennie can knock over: the six dining chairs and the piano stool.
// As fixed blocks they left only narrow gaps around the dining table, and
// Lennie kept getting wedged in them. Now they're light physics bodies: he
// shoves them aside or sends them tumbling, and they stay where they fall
// until everything is put back (repairAll).
//
// Each piece is one body made of boxes, drawn by a group of matching boxes
// that follows it. The instant replay records them along with Lennie (they
// have the same { body, group } shape as his parts).

// A piece that has stood still this long, with Lennie not close by, goes to
// sleep: the physics leaves it alone (and the game runs as fast as without
// it) until something moving bumps into it. Lennie is never put to sleep.
const REST_SPEED = 0.1; // m/s (and rad/s)
const REST_TIME = 0.5; // seconds
const NEAR = 1.8; // metres from Lennie's hips: closer than this, pieces stay awake

export function createLoose(world, material) {
  const items = [];
  let lennieAt = null; // Lennie's hips, a CANNON.Vec3, once known (watch)

  world.addEventListener('postStep', () => {
    for (const item of items) {
      const { body } = item;
      if (body.sleepState === CANNON.Body.SLEEPING) continue;
      const still = body.velocity.lengthSquared() + body.angularVelocity.lengthSquared() < REST_SPEED ** 2;
      const near = lennieAt && lennieAt.distanceTo(body.position) < NEAR;
      item.rest = still && !near ? item.rest + world.dt : 0;
      if (item.rest > REST_TIME) body.sleep();
    }
  });

  /**
   * Adds a piece. `parts` are [min, max, meshMaterial] boxes in world space;
   * `parent` is the storey group it's drawn in.
   */
  function add(parent, parts, { mass, surface }) {
    // The body's origin is its centre of mass (by volume), as cannon expects.
    const centre = new THREE.Vector3();
    let volume = 0;
    for (const [min, max] of parts) {
      const v = (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]);
      centre.x += ((min[0] + max[0]) / 2) * v;
      centre.y += ((min[1] + max[1]) / 2) * v;
      centre.z += ((min[2] + max[2]) / 2) * v;
      volume += v;
    }
    centre.divideScalar(volume);

    const body = new CANNON.Body({ mass, material, linearDamping: 0.05, angularDamping: 0.1 });
    const group = new THREE.Group();
    for (const [min, max, mat] of parts) {
      const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
      const at = [(min[0] + max[0]) / 2 - centre.x, (min[1] + max[1]) / 2 - centre.y, (min[2] + max[2]) / 2 - centre.z];
      body.addShape(new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), new CANNON.Vec3(...at));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
      mesh.position.set(...at);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    body.position.set(centre.x, centre.y, centre.z);
    body.surface = surface;
    world.addBody(body);
    group.position.copy(centre);
    parent.add(group);
    items.push({ body, group, home: centre.clone(), rest: 0 });
  }

  /** Puts every piece back where it stood. */
  function reset() {
    for (const item of items) {
      const { body, home } = item;
      body.position.set(home.x, home.y, home.z);
      body.quaternion.set(0, 0, 0, 1);
      body.velocity.setZero();
      body.angularVelocity.setZero();
      body.force.setZero();
      body.torque.setZero();
      body.aabbNeedsUpdate = true;
      body.wakeUp();
      item.rest = 0;
    }
    update();
  }

  /** Moves the drawn pieces to where their bodies are. */
  function update() {
    for (const { body, group } of items) {
      group.position.copy(body.position);
      group.quaternion.copy(body.quaternion);
    }
  }

  /** Pieces near this point (Lennie's hips, a CANNON.Vec3 that moves with him) never fall asleep. */
  function watch(point) {
    lennieAt = point;
  }

  return { items, add, reset, update, watch };
}
