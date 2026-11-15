// A shopping trolley someone left standing in the supermarket, just inside the
// sliding doors. Land Lennie in its basket and it rolls off with him along the
// front window, past the doors, then stops dead and tips him out towards the
// tulips (effects.js starts the ride and does the tipping out). R puts it back.
//
// It's a kinematic body: it pushes Lennie along but nothing pushes it, and it
// costs nothing while it stands still.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const HOME = { x: -1.2, z: 31.65 }; // the middle of its basket, on the shop floor
const STOP_X = -5.4; // where it stops: past the doors, short of the tulips (x -6.3 and further)
const TOP_SPEED = 3.6;
const ACCEL = 5;
const B = { len: 0.9, wid: 0.56, y0: 0.45, y1: 1.0 }; // the basket, along x
const WALL = 0.03;

export function createTrolley(scene, world, physMat) {
  const group = new THREE.Group();
  group.name = 'trolley';
  const wire = new THREE.MeshStandardMaterial({ color: 0xb8bec4, metalness: 0.5, roughness: 0.35, transparent: true, opacity: 0.75 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x3fae3a, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6 });
  const box = (sx, sy, sz, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const { len, wid, y0, y1 } = B;
  const h = y1 - y0;
  const ym = (y0 + y1) / 2;
  // the basket: a floor and four see-through wire sides, fitted between each
  // other so no two faces lie in one plane
  box(len - 2 * WALL - 0.004, WALL, wid - 2 * WALL - 0.004, wire, 0, y0 + WALL / 2, 0);
  for (const s of [-1, 1]) box(len, h, WALL, wire, 0, ym, s * (wid / 2 - WALL / 2));
  for (const s of [-1, 1]) box(WALL, h - 0.002, wid - 2 * WALL - 0.002, wire, s * (len / 2 - WALL / 2), ym, 0);
  // the green handle behind it (at +x: it rolls towards -x)
  box(0.05, 0.05, wid + 0.04, handleMat, len / 2 + 0.06, y1 + 0.03, 0);
  for (const s of [-1, 1]) box(0.08, 0.025, 0.025, dark, len / 2 + 0.02, y1 + 0.03, s * (wid / 2 + 0.005));
  // legs and wheels
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const x = dx * (len / 2 - 0.06);
    const z = dz * (wid / 2 - 0.06);
    box(0.035, y0 - 0.085, 0.035, dark, x, 0.08 + (y0 - 0.085) / 2, z); // (stops 5 mm under the basket)
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 12).rotateX(Math.PI / 2), dark);
    wheel.position.set(x, 0.04, z + dz * 0.004);
    group.add(wheel);
  }
  scene.add(group);

  // In physics: the basket's floor and sides, slightly thicker, so he stays in.
  const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0, material: physMat });
  const half = (x, y, z) => new CANNON.Box(new CANNON.Vec3(x / 2, y / 2, z / 2));
  body.addShape(half(len, 0.06, wid), new CANNON.Vec3(0, y0, 0));
  for (const s of [-1, 1]) body.addShape(half(len, h, 0.06), new CANNON.Vec3(0, ym, s * (wid / 2)));
  for (const s of [-1, 1]) body.addShape(half(0.06, h, wid), new CANNON.Vec3(s * (len / 2), ym, 0));
  // the legs as one block under it, so he can't roll underneath
  body.addShape(half(len - 0.1, y0 - 0.1, wid - 0.1), new CANNON.Vec3(0, (y0 + 0.1) / 2, 0));
  body.surface = { kind: 'furniture', sound: 'metal' };
  world.addBody(body);

  const trolley = {
    body,
    group,
    state: 'home', // 'home' | 'rolling' | 'stopped'
    speed: 0,
    /** The box Lennie's hips or chest must be in to count as in the basket. */
    basket(out = { min: [0, 0, 0], max: [0, 0, 0] }) {
      const p = body.position;
      out.min[0] = p.x - len / 2 - 0.1; out.min[1] = y0 - 0.05; out.min[2] = p.z - wid / 2 - 0.1;
      out.max[0] = p.x + len / 2 + 0.1; out.max[1] = y1 + 0.75; out.max[2] = p.z + wid / 2 + 0.1;
      return out;
    },
    /** Off it goes. */
    ride() {
      if (trolley.state !== 'home') return false;
      trolley.state = 'rolling';
      trolley.speed = 0;
      return true;
    },
    /** Moves it along; returns true on the frame it stops dead. dt in game time. */
    update(dt) {
      if (trolley.state !== 'rolling') return false;
      trolley.speed = Math.min(TOP_SPEED, trolley.speed + ACCEL * dt);
      // a little wobble from side to side, like every trolley's one bad wheel
      const wobble = Math.sin(body.position.x * 4) * 0.25;
      if (body.position.x <= STOP_X) {
        body.velocity.setZero();
        body.angularVelocity.setZero();
        trolley.state = 'stopped';
        trolley.sync();
        return true;
      }
      body.velocity.set(-trolley.speed, 0, wobble);
      trolley.sync();
      return false;
    },
    /** How long a full ride takes, for the rattling sound. */
    get rideTime() {
      const dist = HOME.x - STOP_X;
      const ramp = TOP_SPEED / ACCEL;
      return ramp + Math.max(0, dist - (ACCEL * ramp * ramp) / 2) / TOP_SPEED;
    },
    sync() {
      group.position.copy(body.position);
    },
    /** Back where it was left (R, a fresh drop). */
    reset() {
      trolley.state = 'home';
      trolley.speed = 0;
      body.velocity.setZero();
      body.position.set(HOME.x, 0, HOME.z);
      body.previousPosition.copy(body.position);
      body.interpolatedPosition.copy(body.position);
      trolley.sync();
    },
  };
  trolley.reset();
  return trolley;
}
