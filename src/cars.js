import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STREET } from './streetscape.js';

// Now and then a car drives by on the road in front of the house, keeping to
// the right like in the Netherlands. Throw Lennie in front of one and it sends
// him flying (main.js scores it); while he lies in its lane, it stops in front
// of him and honks until he's out of the way.
//
// Cheap on purpose: a small pool of cars is built once and reused, each drawn
// with one mesh per colour (about seven), and parked far out of sight while
// it isn't driving. A driving car is a kinematic physics body that only ever
// collides with Lennie (collision groups), never with the scenery, so it adds
// next to nothing to the physics.

const GROUP = 4; // the cars' collision group: Lennie (group 2) only, so the scenery (1) and the raycasts (mask 1) ignore them
const LANES = { [1]: 23.25, [-1]: 20.35 }; // z of the lane for cars driving towards +x and towards -x (keep right)
const ENDS = 62; // cars appear at one end of the street and vanish at the other (the fog hides both)
const LOOK = 15; // metres ahead a car looks for Lennie or another car
const STOP_GAP = 2.4; // ...and stops this far short of it
const BRAKE = 5; // m/s², how hard a car brakes
const SPEED_UP = 2.5; // m/s², how quickly it pulls away again
const LANE_HALF = 1.3; // a part of Lennie this close to a lane's middle is in that lane
const GAP = [5, 14]; // seconds between cars
const PAINT = [0xc8322b, 0x2f5fa8, 0xeeeeea, 0xa9adb3, 0x2a2c30, 0x3d6b45, 0xe0a526, 0x7a2f5a, 0x5f8fbf];

const rand = (a, b) => a + Math.random() * (b - a);

// The models, built along +x (the front), standing on y = 0. `box` parts are
// [material, x0, y0, z0, x1, y1, z1]; wheels are [x, radius].
// Neighbouring parts overlap a little rather than sharing a face, so nothing flickers.
function hatchback(L = 3.9, W = 1.72) {
  const x = L / 2;
  const z = W / 2;
  return {
    length: L,
    wheels: [[x - 0.68, 0.31], [-x + 0.7, 0.31]],
    track: z - 0.09,
    boxes: [
      ['paint', -x, 0.3, -z, x, 1.0, z], // the body
      ['glass', -x + 0.18, 0.97, -z + 0.09, x - 1.3, 1.44, z - 0.09], // the windows all round
      ['paint', -x + 0.14, 1.42, -z + 0.06, x - 1.42, 1.5, z - 0.06], // the roof
      ['dark', x - 0.04, 0.3, -z + 0.03, x + 0.07, 0.52, z - 0.03], // bumpers
      ['dark', -x - 0.07, 0.3, -z + 0.03, -x + 0.04, 0.52, z - 0.03],
      ['head', x - 0.05, 0.74, z - 0.34, x + 0.02, 0.88, z - 0.08], // headlights
      ['head', x - 0.05, 0.74, -z + 0.08, x + 0.02, 0.88, -z + 0.34],
      ['tail', -x - 0.02, 0.76, z - 0.3, -x + 0.05, 0.94, z - 0.06], // rear lights
      ['tail', -x - 0.02, 0.76, -z + 0.06, -x + 0.05, 0.94, -z + 0.3],
      ['plate', x + 0.05, 0.36, -0.26, x + 0.085, 0.47, 0.26], // yellow Dutch number plates
      ['plate', -x - 0.035, 0.6, -0.26, -x + 0.01, 0.71, 0.26],
    ],
  };
}

function estate() {
  const car = hatchback(4.6, 1.78);
  const x = 2.3;
  const z = 0.89;
  // a longer cabin, with the windows running right to the back
  car.boxes[1] = ['glass', -x + 0.12, 0.97, -z + 0.09, x - 1.45, 1.46, z - 0.09];
  car.boxes[2] = ['paint', -x + 0.08, 1.44, -z + 0.06, x - 1.55, 1.52, z - 0.06];
  car.wheels = [[x - 0.8, 0.32], [-x + 0.85, 0.32]];
  return car;
}

function van() {
  const L = 5.0;
  const x = L / 2;
  const z = 0.98;
  return {
    length: L,
    wheels: [[x - 0.75, 0.36], [-x + 0.9, 0.36]],
    track: z - 0.1,
    boxes: [
      ['paint', -x, 0.35, -z, x, 1.1, z], // the body
      ['paint', -x, 1.08, -z + 0.01, x - 1.45, 2.35, z - 0.01], // the cargo box
      ['glass', x - 1.47, 1.07, -z + 0.06, x - 0.45, 1.86, z - 0.06], // the cab's windows
      ['paint', x - 1.49, 1.84, -z + 0.04, x - 0.5, 1.95, z - 0.04], // the cab's roof
      ['accent', -x + 0.1, 1.45, -z - 0.005, x - 1.55, 1.7, z + 0.005], // a stripe along the sides
      ['dark', x - 0.04, 0.35, -z + 0.03, x + 0.08, 0.6, z - 0.03],
      ['dark', -x - 0.08, 0.35, -z + 0.03, -x + 0.04, 0.6, z - 0.03],
      ['head', x - 0.05, 0.82, z - 0.36, x + 0.02, 0.98, z - 0.1],
      ['head', x - 0.05, 0.82, -z + 0.1, x + 0.02, 0.98, -z + 0.36],
      ['tail', -x - 0.02, 0.8, z - 0.2, -x + 0.05, 1.2, z - 0.05],
      ['tail', -x - 0.02, 0.8, -z + 0.05, -x + 0.05, 1.2, -z + 0.2],
      ['plate', x + 0.06, 0.42, -0.26, x + 0.095, 0.53, 0.26],
      ['plate', -x - 0.035, 0.66, -0.26, -x + 0.01, 0.77, 0.26],
    ],
  };
}

export function createCars(scene, world, material) {
  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...opts });
  const shared = {
    glass: std({ color: 0x2b3a48, roughness: 0.15, metalness: 0.4 }),
    dark: std({ color: 0x2a2b2e, roughness: 0.85 }),
    tyre: std({ color: 0x1c1c1e, roughness: 0.9 }),
    hub: std({ color: 0xb8bcc2, roughness: 0.35, metalness: 0.5 }),
    head: std({ color: 0xfff7dc, emissive: 0x8a8360, roughness: 0.3 }),
    tail: std({ color: 0xc0201a, emissive: 0x5a0a08, roughness: 0.4 }),
    plate: std({ color: 0xf2c418, roughness: 0.5 }),
  };

  const cars = [];
  const items = []; // { body, group } for the replay
  [hatchback(), hatchback(), estate(), van()].forEach((model, i) => {
    const paint = std({ color: PAINT[i], roughness: 0.4, metalness: 0.15 });
    const accent = std({ color: 0xe0a526, roughness: 0.5 });
    const mats = { ...shared, paint, accent };
    const byMat = new Map();
    const put = (key, geo) => {
      if (!byMat.has(key)) byMat.set(key, []);
      byMat.get(key).push(geo);
    };
    for (const [key, x0, y0, z0, x1, y1, z1] of model.boxes) {
      put(key, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    }
    for (const [wx, r] of model.wheels) {
      for (const side of [1, -1]) {
        const wz = side * model.track;
        put('tyre', new THREE.CylinderGeometry(r, r, 0.22, 16).rotateX(Math.PI / 2).translate(wx, r, wz));
        put('hub', new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.03, 12).rotateX(Math.PI / 2).translate(wx, r, wz + side * 0.115));
      }
    }
    const group = new THREE.Group();
    for (const [key, geos] of byMat) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mats[key]);
      mesh.userData.car = true; // keeps it out of the scenery that gets glued together (batching.js)
      group.add(mesh);
    }
    scene.add(group);

    // The body: the bottom half (reaching down between the wheels), plus the
    // windows and the van's cargo box.
    const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0, material, collisionFilterGroup: GROUP, collisionFilterMask: 2 });
    model.boxes.forEach(([key, x0, y0, z0, x1, y1, z1], k) => {
      if (k > 0 && key !== 'glass' && !(key === 'paint' && y1 - y0 > 0.5)) return;
      if (k === 0) y0 -= 0.15;
      body.addShape(new CANNON.Box(new CANNON.Vec3((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)), new CANNON.Vec3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    });
    body.allowSleep = false;
    const car = { i, body, group, paint, length: model.length, active: false, dir: 1, speed: 0, cruise: 0, x: 0, z: 0, waiting: false, honks: 0, honkAt: 0, passed: false, slowUntil: 0, hitAt: -Infinity };
    body.surface = { kind: 'car', sound: 'metal', car };
    cars.push(car);
    items.push({ body, group });
    body.position.set(400 + i * 20, -50, 0);
    park(car);
  });

  let clock = 0;
  let nextAt = rand(2, 5); // the first one comes along soon
  const _v = new THREE.Vector3();

  /** Out of sight and out of the physics, until it's needed again. */
  function park(car) {
    car.active = false;
    if (car.body.world) world.removeBody(car.body);
    car.body.velocity.setZero();
    // Under the street where it drove off (at first each its own spot far
    // away): the replay glides a car between where it was and where it is,
    // and this way that's always out of sight.
    if (car.body.position.y > -1) car.body.position.y = -30;
  }

  function spawn() {
    const free = cars.filter((c) => !c.active);
    if (!free.length) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const startX = -dir * ENDS;
    // not on top of a car that has only just set off the same way
    if (cars.some((c) => c.active && c.dir === dir && Math.abs(c.x - startX) < 14)) return;
    const car = free[Math.floor(Math.random() * free.length)];
    car.paint.color.setHex(PAINT[Math.floor(Math.random() * PAINT.length)]);
    car.active = true;
    car.dir = dir;
    car.z = LANES[dir];
    car.x = startX;
    car.cruise = rand(7, 9.5); // 25 to 35 km/h: it's a 30 zone
    car.speed = car.cruise;
    car.waiting = false;
    car.honks = 0;
    car.passed = false;
    car.slowUntil = 0;
    car.body.position.set(car.x, 0, car.z);
    car.body.quaternion.setFromEuler(0, dir > 0 ? 0 : Math.PI, 0);
    world.addBody(car.body);
  }

  /** How far ahead of `car`'s front bumper the nearest part of Lennie in its lane is (Infinity if none). */
  function lennieAhead(car, bodies) {
    let gap = Infinity;
    for (const b of bodies) {
      const p = b.position;
      if (Math.abs(p.z - car.z) > LANE_HALF || p.y > 2.4) continue;
      const d = (p.x - car.x) * car.dir - car.length / 2 - 0.25;
      if (d > -0.5 && d < gap) gap = Math.max(0, d);
    }
    return gap;
  }

  /**
   * Moves the traffic on by dt (game time). `lennie`: { bodies, flying, held },
   * `listener`: the camera's position, for the sound of a car going by.
   * `on`: { honk(car, at), pass(car, strength) } for the sounds and shouts.
   */
  function update(dt, lennie, listener, on) {
    clock += dt;
    if (clock > nextAt) {
      spawn();
      // now and then one follows close behind
      nextAt = clock + (Math.random() < 0.2 ? rand(1.5, 3) : rand(...GAP));
    }
    for (const car of cars) {
      if (!car.active) continue;
      car.x = car.body.position.x;
      // What's ahead: Lennie lying (or being held) in the lane, or another car.
      // Once a car has stopped for him it waits until he's out of the lane,
      // even while he's being thrown; a car that's already driving doesn't
      // brake for a flying Lennie (that's the fun).
      let gap = Infinity;
      const lennieGap = lennieAhead(car, lennie.bodies);
      const forLennie = lennieGap < LOOK && (!lennie.flying || car.waiting);
      if (forLennie) gap = lennieGap;
      for (const other of cars) {
        if (other === car || !other.active || other.dir !== car.dir) continue;
        const d = (other.x - car.x) * car.dir - (car.length + other.length) / 2;
        if (d > -1 && d < LOOK) gap = Math.min(gap, Math.max(0, d));
      }
      let target = clock < car.slowUntil ? car.cruise * 0.3 : car.cruise;
      if (gap < Infinity) target = Math.min(target, Math.sqrt(2 * BRAKE * Math.max(0, gap - STOP_GAP)));
      car.speed = target < car.speed ? target : Math.min(target, car.speed + SPEED_UP * dt);

      if (forLennie && car.speed < 0.3) {
        if (!car.waiting || (clock > car.honkAt && car.honks < 4)) {
          car.honks += 1;
          car.honkAt = clock + 3.5;
          on.honk?.(car, _v.set(car.x + car.dir * car.length * 0.3, 2.2, car.z));
        }
        car.waiting = true;
      } else if (!forLennie) {
        car.waiting = false;
        car.honks = 0;
      }

      car.body.velocity.set(car.dir * car.speed, 0, 0);

      // a whoosh as it goes past the camera
      if (!car.passed && (listener.x - car.x) * car.dir < 4) {
        car.passed = true;
        const d = Math.hypot(listener.z - car.z, listener.y);
        if (d < 30) on.pass?.(car, 1 - d / 30);
      }
      if (car.x * car.dir > ENDS) park(car);
    }
    sync();
  }

  /** Lennie was hit by `car`: the driver brakes for a moment, then drives on. */
  function hit(car) {
    car.slowUntil = clock + 1.5;
  }

  /** Puts every car's drawing where its body is (after a replay moved them, too). */
  function sync() {
    for (const car of cars) {
      car.group.position.copy(car.body.position);
      car.group.quaternion.copy(car.body.quaternion);
    }
  }

  sync();
  return { cars, items, update, hit, sync };
}
