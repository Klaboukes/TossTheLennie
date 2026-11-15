import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Furniture Lennie can knock over: the six dining chairs, the piano stool,
// the small round tables (in front of the couch and at the lounge set), and the
// bikes and the moped in the back garden (bikes.js).
// As fixed blocks they left only narrow gaps around the dining table, and
// Lennie kept getting wedged in them. Now they're light physics bodies: he
// shoves them aside or sends them tumbling, and they stay where they fall
// until everything is put back (repairAll).
//
// Each piece is one body made of boxes (or upright cylinders, for round
// parts), drawn by a group of matching shapes that follows it, or by a more
// detailed look of its own (a bike's wheels and tubes). The instant replay records them along with Lennie (they
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
   * Adds a piece. `parts` are [min, max, meshMaterial, { round }] boxes in
   * world space; a `round` part is the upright cylinder that fits in its box.
   * `parent` is the storey group it's drawn in.
   * Optional: `look` is a group of meshes that draws the piece instead (the
   * parts then only shape its body), and `at` and `turn` (a Vector3 and a
   * Quaternion) place a piece built in a frame of its own, like a bike built
   * along x and leaning on its kickstand: parts and look are then in that frame.
   */
  function add(parent, parts, { mass, surface, look = null, at = null, turn = null }) {
    // The body's origin is its centre of mass (by volume), as cannon expects.
    const centre = new THREE.Vector3();
    let volume = 0;
    for (const [min, max, , opts] of parts) {
      const v = (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]) * (opts?.round ? Math.PI / 4 : 1);
      centre.x += ((min[0] + max[0]) / 2) * v;
      centre.y += ((min[1] + max[1]) / 2) * v;
      centre.z += ((min[2] + max[2]) / 2) * v;
      volume += v;
    }
    centre.divideScalar(volume);
    const q = turn ? turn.clone() : new THREE.Quaternion();
    const home = centre.clone().applyQuaternion(q);
    if (at) home.add(at);

    const body = new CANNON.Body({ mass, material, linearDamping: 0.05, angularDamping: 0.1 });
    const group = new THREE.Group();
    for (const [min, max, mat, opts] of parts) {
      const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
      const offset = [(min[0] + max[0]) / 2 - centre.x, (min[1] + max[1]) / 2 - centre.y, (min[2] + max[2]) / 2 - centre.z];
      const r = Math.min(size[0], size[2]) / 2;
      // (cannon's cylinders stand upright, like three's)
      body.addShape(opts?.round ? new CANNON.Cylinder(r, r, size[1], 12) : new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), new CANNON.Vec3(...offset));
      if (look) continue;
      const mesh = new THREE.Mesh(opts?.round ? new THREE.CylinderGeometry(r, r, size[1], r > 0.1 ? 28 : 8) : new THREE.BoxGeometry(...size), mat);
      mesh.position.set(...offset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (look) {
      for (const mesh of [...look.children]) {
        mesh.position.sub(centre);
        group.add(mesh);
      }
    }
    body.position.set(home.x, home.y, home.z);
    body.quaternion.set(q.x, q.y, q.z, q.w);
    body.surface = surface;
    world.addBody(body);
    group.position.copy(home);
    group.quaternion.copy(q);
    parent.add(group);
    items.push({ body, group, home, turn: q, rest: 0 });
  }

  /** Puts every piece back where it stood. */
  function reset() {
    for (const item of items) {
      const { body, home, turn } = item;
      body.position.set(home.x, home.y, home.z);
      body.quaternion.set(turn.x, turn.y, turn.z, turn.w);
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
