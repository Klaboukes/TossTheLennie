import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COLORS = {
  skin: 0xf3c6a0,
  shirt: 0xff6b4a,
  pants: 0x3f5fd6,
  belt: 0x2b2433,
  shoe: 0x2b2b36,
  sole: 0xf2efe9,
  hair: 0x7a4a2a,
  eye: 0xffffff,
  pupil: 0x1b1b22,
  mouth: 0x8e2c3a,
};

// Local offsets of the hand (on the forearm) and the foot (on the shin).
export const HAND_OFFSET = new CANNON.Vec3(0, -0.19, 0);
export const FOOT_OFFSET = new CANNON.Vec3(0, -0.245, 0.05);

// Rest pose: Lennie standing upright, facing +Z, arms hanging down. Every
// bone's local +Y axis runs along the bone, so the rest relative rotation of
// every joint is the identity (this is what the contortion score measures from).
const SIDES = [
  { s: 'L', sign: 1, word: 'left' },
  { s: 'R', sign: -1, word: 'right' },
];

const PARTS = [
  { name: 'pelvis', label: 'hips', mass: 6, pos: [0, 1.07, 0], shapes: [{ box: [0.17, 0.1, 0.11] }] },
  { name: 'chest', label: 'torso', mass: 8, pos: [0, 1.41, 0], shapes: [{ box: [0.21, 0.24, 0.12] }] },
  { name: 'head', label: 'head', mass: 3, pos: [0, 1.85, 0], shapes: [{ sphere: 0.15 }] },
  ...SIDES.flatMap(({ s, sign, word }) => [
    { name: 'upperArm' + s, label: `${word} arm`, mass: 2, pos: [0.29 * sign, 1.44, 0], shapes: [{ box: [0.06, 0.16, 0.06] }] },
    {
      name: 'lowerArm' + s, label: `${word} hand`, mass: 1.5, pos: [0.29 * sign, 1.13, 0],
      shapes: [{ box: [0.055, 0.15, 0.055] }, { sphere: 0.065, offset: HAND_OFFSET }],
    },
    { name: 'upperLeg' + s, label: `${word} thigh`, mass: 5, pos: [0.11 * sign, 0.745, 0], shapes: [{ box: [0.075, 0.225, 0.075] }] },
    {
      name: 'lowerLeg' + s, label: `${word} foot`, mass: 3.5, pos: [0.11 * sign, 0.3, 0],
      shapes: [{ box: [0.065, 0.22, 0.065] }, { box: [0.065, 0.035, 0.12], offset: FOOT_OFFSET }],
    },
  ]),
];

// range = how far (radians) the joint can comfortably bend; used to normalise
// the contortion score. angle/twist are the physical cone-twist limits.
const JOINTS = [
  { name: 'neck', label: 'Neck', a: 'head', b: 'chest', pa: [0, -0.175, 0], pb: [0, 0.265, 0], angle: Math.PI / 4, twist: Math.PI / 4, range: 1.2, weight: 1.2 },
  { name: 'spine', label: 'Spine', a: 'chest', b: 'pelvis', pa: [0, -0.24, 0], pb: [0, 0.1, 0], angle: Math.PI / 5, twist: Math.PI / 6, range: 0.9, weight: 1.5 },
  ...SIDES.flatMap(({ s, sign, word }) => {
    const W = word[0].toUpperCase() + word.slice(1);
    return [
      { name: 'shoulder' + s, label: `${W} shoulder`, a: 'chest', b: 'upperArm' + s, pa: [0.29 * sign, 0.19, 0], pb: [0, 0.16, 0], angle: 2.0, twist: Math.PI / 3, range: 2.4, weight: 0.8 },
      { name: 'elbow' + s, label: `${W} elbow`, a: 'upperArm' + s, b: 'lowerArm' + s, pa: [0, -0.16, 0], pb: [0, 0.15, 0], angle: 1.6, twist: 0.3, range: 1.8, weight: 1 },
      { name: 'hip' + s, label: `${W} hip`, a: 'pelvis', b: 'upperLeg' + s, pa: [0.11 * sign, -0.1, 0], pb: [0, 0.225, 0], angle: 1.4, twist: 0.5, range: 1.7, weight: 1.1 },
      { name: 'knee' + s, label: `${W} knee`, a: 'upperLeg' + s, b: 'lowerLeg' + s, pa: [0, -0.225, 0], pb: [0, 0.22, 0], angle: 1.6, twist: 0.2, range: 1.8, weight: 1 },
    ];
  }),
];

const vec = (a) => new CANNON.Vec3(a[0], a[1], a[2]);
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });

function mesh(geometry, mat, position) {
  const m = new THREE.Mesh(geometry, mat);
  if (position) m.position.set(position.x ?? position[0], position.y ?? position[1], position.z ?? position[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function capsule(radius, length, mat) {
  return mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - 2 * radius), 6, 16), mat);
}

function logoTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fffaf0';
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3f5fd6';
  g.font = 'bold 92px Fredoka, Arial Rounded MT Bold, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('L', 66, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ragdoll {
  constructor(world, scene, physicsMaterial) {
    this.world = world;
    this.scene = scene;
    this.parts = {};
    this.joints = [];
    this.pickables = [];
    this.expression = 'normal';
    this.expressionTimer = 0;
    this.onCollide = null;

    for (const def of PARTS) this.#buildPart(def, physicsMaterial);
    for (const def of JOINTS) this.#buildJoint(def);
  }

  #buildPart(def, physicsMaterial) {
    const body = new CANNON.Body({
      mass: def.mass,
      material: physicsMaterial,
      position: vec(def.pos),
      linearDamping: 0.02,
      angularDamping: 0.3,
      // Group 2 so grab raycasts (mask 1) only hit the scenery, never Lennie.
      collisionFilterGroup: 2,
    });
    for (const shape of def.shapes) {
      const s = shape.box ? new CANNON.Box(vec(shape.box)) : new CANNON.Sphere(shape.sphere);
      body.addShape(s, shape.offset);
    }
    body.addEventListener('collide', (e) => this.onCollide?.(def.name, e));
    this.world.addBody(body);

    const group = this.#buildVisual(def.name);
    this.scene.add(group);

    const mats = new Set();
    group.traverse((o) => {
      if (o.isMesh) {
        o.userData.part = def.name;
        this.pickables.push(o);
        mats.add(o.material);
      }
    });

    this.parts[def.name] = { name: def.name, label: def.label, def, body, group, materials: [...mats] };
  }

  #buildJoint(def) {
    const bodyA = this.parts[def.a].body;
    const bodyB = this.parts[def.b].body;
    const constraint = new CANNON.ConeTwistConstraint(bodyA, bodyB, {
      pivotA: vec(def.pa),
      pivotB: vec(def.pb),
      axisA: new CANNON.Vec3(0, 1, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: def.angle,
      twistAngle: def.twist,
      collideConnected: false,
    });
    constraint.collideConnected = false;
    this.world.addConstraint(constraint);
    this.joints.push({ ...def, bodyA, bodyB, constraint });
  }

  #buildVisual(name) {
    const g = new THREE.Group();
    const base = name.replace(/[LR]$/, '');
    switch (base) {
      case 'pelvis': {
        g.add(mesh(new RoundedBoxGeometry(0.34, 0.2, 0.22, 4, 0.07), material(COLORS.pants)));
        g.add(mesh(new THREE.BoxGeometry(0.35, 0.045, 0.228), material(COLORS.belt, { roughness: 0.4 }), [0, 0.065, 0]));
        break;
      }
      case 'chest': {
        g.add(mesh(new RoundedBoxGeometry(0.42, 0.48, 0.24, 4, 0.08), material(COLORS.shirt)));
        const logo = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), new THREE.MeshStandardMaterial({ map: logoTexture(), roughness: 0.7 }));
        logo.position.set(0, 0.06, 0.1215);
        g.add(logo);
        const collar = mesh(new THREE.TorusGeometry(0.065, 0.02, 8, 24), material(COLORS.shirt), [0, 0.235, 0]);
        collar.rotation.x = Math.PI / 2;
        g.add(collar);
        break;
      }
      case 'head':
        this.#buildHead(g);
        break;
      case 'upperArm':
        g.add(capsule(0.062, 0.34, material(COLORS.shirt)));
        break;
      case 'lowerArm': {
        const skin = material(COLORS.skin);
        g.add(capsule(0.055, 0.31, skin));
        const hand = mesh(new THREE.SphereGeometry(0.066, 20, 14), skin, HAND_OFFSET);
        hand.scale.set(1, 1.1, 0.8);
        g.add(hand);
        break;
      }
      case 'upperLeg':
        g.add(capsule(0.078, 0.47, material(COLORS.pants)));
        break;
      case 'lowerLeg': {
        g.add(capsule(0.066, 0.45, material(COLORS.pants)));
        g.add(mesh(new RoundedBoxGeometry(0.14, 0.075, 0.25, 3, 0.03), material(COLORS.shoe, { roughness: 0.45 }), FOOT_OFFSET));
        g.add(mesh(new THREE.BoxGeometry(0.142, 0.022, 0.252), material(COLORS.sole), [FOOT_OFFSET.x, FOOT_OFFSET.y - 0.03, FOOT_OFFSET.z]));
        break;
      }
    }
    return g;
  }

  #buildHead(g) {
    const skin = material(COLORS.skin);
    g.add(mesh(new THREE.SphereGeometry(0.15, 32, 24), skin));

    const hair = mesh(new THREE.SphereGeometry(0.157, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), material(COLORS.hair, { roughness: 0.9 }));
    hair.rotation.x = -0.4;
    g.add(hair);
    const tuft = mesh(new THREE.ConeGeometry(0.035, 0.09, 12), material(COLORS.hair, { roughness: 0.9 }), [0.02, 0.17, 0.02]);
    tuft.rotation.z = -0.5;
    g.add(tuft);

    for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.035, 12, 10), skin, [0.148 * s, 0, 0]));
    g.add(mesh(new THREE.SphereGeometry(0.026, 14, 10), skin, [0, -0.01, 0.152]));

    const eyeMat = material(COLORS.eye, { roughness: 0.3 });
    const pupilMat = material(COLORS.pupil, { roughness: 0.2 });
    this.face = { pupils: [], xEyes: [] };
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.SphereGeometry(0.034, 16, 12), eyeMat, [0.055 * s, 0.035, 0.124]));
      const pupil = mesh(new THREE.SphereGeometry(0.017, 12, 10), pupilMat, [0.055 * s, 0.035, 0.155]);
      g.add(pupil);
      this.face.pupils.push(pupil);

      const x = new THREE.Group();
      for (const r of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.011, 0.01), pupilMat);
        bar.rotation.z = r;
        x.add(bar);
      }
      x.position.set(0.055 * s, 0.035, 0.158);
      x.visible = false;
      g.add(x);
      this.face.xEyes.push(x);
    }

    const mouthMat = material(COLORS.mouth, { roughness: 0.5 });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 8, 20, Math.PI), mouthMat);
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.045, 0.128);
    g.add(smile);
    const ouch = new THREE.Group();
    ouch.add(new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.009, 8, 20), mouthMat));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.024, 20), material(0x3a1018));
    hole.position.z = -0.002;
    ouch.add(hole);
    ouch.position.set(0, -0.075, 0.13);
    ouch.visible = false;
    g.add(ouch);
    this.face.smile = smile;
    this.face.ouch = ouch;
  }

  /** Stand Lennie back up in the rest pose. */
  reset({ x = 0, z = 0, height = 0, yaw = 0 } = {}) {
    const q = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);
    for (const part of Object.values(this.parts)) {
      const p = q.vmult(vec(part.def.pos));
      part.body.position.set(x + p.x, height + p.y, z + p.z);
      part.body.quaternion.copy(q);
      part.body.velocity.setZero();
      part.body.angularVelocity.setZero();
      part.body.force.setZero();
      part.body.torque.setZero();
      part.body.wakeUp();
    }
    this.sync();
  }

  sync() {
    for (const part of Object.values(this.parts)) {
      part.group.position.copy(part.body.position);
      part.group.quaternion.copy(part.body.quaternion);
    }
  }

  update(dt) {
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) this.setExpression('normal');
    }
  }

  /** 'normal' | 'ouch' | 'dizzy'. A duration of 0 keeps it until changed. */
  setExpression(kind, duration = 0) {
    // A brief 'ouch' never overrides a lasting dizzy face.
    if (kind === 'ouch' && this.expression === 'dizzy' && this.expressionTimer <= 0) return;
    this.expression = kind;
    this.expressionTimer = duration;
    const dizzy = kind === 'dizzy';
    this.face.pupils.forEach((p) => (p.visible = !dizzy));
    this.face.xEyes.forEach((x) => (x.visible = dizzy));
    this.face.smile.visible = kind === 'normal';
    this.face.ouch.visible = kind !== 'normal';
  }

  highlight(name, on) {
    const part = this.parts[name];
    if (!part) return;
    for (const m of part.materials) {
      if (!m.emissive) continue;
      m.emissive.setHex(on ? 0x553322 : 0x000000);
    }
  }

  get bodies() {
    return Object.values(this.parts).map((p) => p.body);
  }

  /** Average of torso and hips, as a THREE.Vector3. */
  center(target = new THREE.Vector3()) {
    const a = this.parts.chest.body.position;
    const b = this.parts.pelvis.body.position;
    return target.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  }

  maxSpeed() {
    let max = 0;
    for (const b of this.bodies) max = Math.max(max, b.velocity.length());
    return max;
  }

  coreSpeed() {
    return Math.max(this.parts.chest.body.velocity.length(), this.parts.pelvis.body.velocity.length());
  }

  lowestPoint() {
    let min = Infinity;
    for (const b of this.bodies) min = Math.min(min, b.position.y);
    return min;
  }
}
