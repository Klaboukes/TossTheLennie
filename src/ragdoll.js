import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Lennie: 50, 1.90 m tall, 100 kg with a bit of a belly, a scruffy greying
// beard, a receding hairline and glasses, in a worn hoodie and old joggers.
const COLORS = {
  skin: 0xeab694,
  hoodie: '#b14a3e', // a faded brick-red, still easy to spot against the house
  hoodieRib: '#963d33',
  joggers: '#6c6f77', // grey marl, worn pale at the knees
  joggersRib: '#55585f',
  shoe: 0x30343f,
  sole: 0xe4ddd0,
  hair: '#4b3527',
  beard: '#5b4535',
  frames: 0x3e434b,
  eye: 0xffffff,
  pupil: 0x1b1b22,
  lip: 0x9a4a46,
  mouth: 0x3a1018,
  teeth: 0xfbf7ee,
};

// Local offsets of the hand (on the forearm) and the foot (on the shin).
export const HAND_OFFSET = new CANNON.Vec3(0, -0.2, 0);
export const FOOT_OFFSET = new CANNON.Vec3(0, -0.255, 0.055);

// Rest pose: Lennie standing upright, facing +Z, arms hanging down, soles at
// 2 cm and the top of his head at 1.90 m. Every bone's local +Y axis runs
// along the bone, so the rest relative rotation of every joint is the
// identity (this is what the contortion score measures from).
const SIDES = [
  { s: 'L', sign: 1, word: 'left' },
  { s: 'R', sign: -1, word: 'right' },
];

// The masses add up to his 100 kg, in roughly a real body's proportions.
const PARTS = [
  { name: 'pelvis', label: 'hips', mass: 15, pos: [0, 1.11, 0], shapes: [{ box: [0.19, 0.09, 0.13] }] },
  {
    // the belly is its own round shape, so he rolls over it when he lands face down
    name: 'chest', label: 'torso', mass: 22, pos: [0, 1.41, 0],
    shapes: [{ box: [0.22, 0.21, 0.13] }, { sphere: 0.15, offset: new CANNON.Vec3(0, -0.07, 0.065) }],
  },
  { name: 'head', label: 'head', mass: 6.5, pos: [0, 1.76, 0], shapes: [{ sphere: 0.13 }] },
  ...SIDES.flatMap(({ s, sign, word }) => [
    { name: 'upperArm' + s, label: `${word} arm`, mass: 4.5, pos: [0.315 * sign, 1.41, 0], shapes: [{ box: [0.065, 0.17, 0.065] }] },
    {
      name: 'lowerArm' + s, label: `${word} hand`, mass: 3.5, pos: [0.315 * sign, 1.085, 0],
      shapes: [{ box: [0.06, 0.155, 0.06] }, { sphere: 0.07, offset: HAND_OFFSET }],
    },
    { name: 'upperLeg' + s, label: `${word} thigh`, mass: 12, pos: [0.115 * sign, 0.78, 0], shapes: [{ box: [0.085, 0.24, 0.085] }] },
    {
      name: 'lowerLeg' + s, label: `${word} foot`, mass: 8.25, pos: [0.115 * sign, 0.31, 0],
      shapes: [{ box: [0.07, 0.23, 0.07] }, { box: [0.07, 0.035, 0.13], offset: FOOT_OFFSET }],
    },
  ]),
];

// range = how far (radians) the joint can comfortably bend; used to normalise
// the contortion score. angle/twist are the physical cone-twist limits.
const JOINTS = [
  { name: 'neck', label: 'Neck', a: 'head', b: 'chest', pa: [0, -0.14, 0], pb: [0, 0.21, 0], angle: Math.PI / 4, twist: Math.PI / 4, range: 1.2, weight: 1.2 },
  { name: 'spine', label: 'Spine', a: 'chest', b: 'pelvis', pa: [0, -0.21, 0], pb: [0, 0.09, 0], angle: Math.PI / 5, twist: Math.PI / 6, range: 0.9, weight: 1.5 },
  ...SIDES.flatMap(({ s, sign, word }) => {
    const W = word[0].toUpperCase() + word.slice(1);
    return [
      { name: 'shoulder' + s, label: `${W} shoulder`, a: 'chest', b: 'upperArm' + s, pa: [0.315 * sign, 0.17, 0], pb: [0, 0.17, 0], angle: 2.0, twist: Math.PI / 3, range: 2.4, weight: 0.8 },
      { name: 'elbow' + s, label: `${W} elbow`, a: 'upperArm' + s, b: 'lowerArm' + s, pa: [0, -0.17, 0], pb: [0, 0.155, 0], angle: 1.6, twist: 0.3, range: 1.8, weight: 1 },
      { name: 'hip' + s, label: `${W} hip`, a: 'pelvis', b: 'upperLeg' + s, pa: [0.115 * sign, -0.09, 0], pb: [0, 0.24, 0], angle: 1.4, twist: 0.5, range: 1.7, weight: 1.1 },
      { name: 'knee' + s, label: `${W} knee`, a: 'upperLeg' + s, b: 'lowerLeg' + s, pa: [0, -0.24, 0], pb: [0, 0.23, 0], angle: 1.6, twist: 0.2, range: 1.8, weight: 1 },
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

// Deterministic pseudo-random, so Lennie looks the same every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Marl fabric: flecks of lighter and darker thread, bobbles, and faded patches. */
function fabricTexture(base, seed, { worn = 6, repeat = 2 } = {}) {
  const r = rng(seed);
  const t = canvasTexture(256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    // faded, washed-out patches
    for (let i = 0; i < worn; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 20 + r() * 50;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.16)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // marl flecks
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.05 + r() * 0.12})`;
      g.fillRect(r() * s, r() * s, 1 + r() * 2, 1);
    }
    // bobbles
    for (let i = 0; i < 160; i++) {
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.arc(r() * s, r() * s, 0.8 + r() * 1.2, 0, Math.PI * 2);
      g.fill();
    }
  });
  t.repeat.set(repeat, repeat);
  return t;
}

/** Ribbed cuffs and hems. */
function ribTexture(base) {
  const t = canvasTexture(64, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < s; x += 8) g.fillRect(x, 0, 3, s);
  });
  t.repeat.set(6, 1);
  return t;
}

/** Short hair or a scruffy beard: dark strands with flecks of grey. */
function hairTexture(base, seed, grey) {
  const r = rng(seed);
  return canvasTexture(128, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = r();
      g.fillStyle = v < grey ? `rgba(215,210,200,${0.35 + r() * 0.4})` : v < 0.6 ? 'rgba(20,12,8,0.35)' : 'rgba(140,100,70,0.3)';
      g.fillRect(r() * s, r() * s, 1, 2 + r() * 3);
    }
  });
}

function logoTexture() {
  // a cracked, washed-out print of his "L" logo
  const r = rng(7);
  return canvasTexture(128, (g) => {
    g.fillStyle = '#efe3d0';
    g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a6fae';
    g.font = 'bold 92px Fredoka, Arial Rounded MT Bold, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('L', 66, 70);
    g.strokeStyle = 'rgba(177,74,62,0.75)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      let x = 10 + r() * 108;
      let y = 10 + r() * 108;
      g.moveTo(x, y);
      for (let k = 0; k < 3; k++) g.lineTo((x += (r() - 0.5) * 30), (y += (r() - 0.5) * 30));
      g.stroke();
    }
  });
}

/** A rounded-rectangle glasses frame, facing +Z. */
function frameGeometry(w, h, rim, radius) {
  const rect = (path, hw, hh, rr) => {
    path.moveTo(-hw + rr, -hh);
    path.lineTo(hw - rr, -hh);
    path.quadraticCurveTo(hw, -hh, hw, -hh + rr);
    path.lineTo(hw, hh - rr);
    path.quadraticCurveTo(hw, hh, hw - rr, hh);
    path.lineTo(-hw + rr, hh);
    path.quadraticCurveTo(-hw, hh, -hw, hh - rr);
    path.lineTo(-hw, -hh + rr);
    path.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
    return path;
  };
  const shape = rect(new THREE.Shape(), w / 2, h / 2, radius);
  shape.holes.push(rect(new THREE.Path(), w / 2 - rim, h / 2 - rim, radius * 0.6));
  return new THREE.ExtrudeGeometry(shape, { depth: 0.007, bevelEnabled: false, curveSegments: 6 });
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
    this.tex = {
      hoodie: fabricTexture(COLORS.hoodie, 11),
      hoodieRib: ribTexture(COLORS.hoodieRib),
      joggers: fabricTexture(COLORS.joggers, 23, { worn: 9 }),
      joggersRib: ribTexture(COLORS.joggersRib),
      hair: hairTexture(COLORS.hair, 31, 0.12),
      beard: hairTexture(COLORS.beard, 37, 0.24),
    };

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

  // Every part gets its own materials (sharing only textures), so the hover
  // highlight lights up just the part under the pointer.
  #cloth(key, extra = {}) {
    return material(0xffffff, { map: this.tex[key], roughness: 0.95, ...extra });
  }

  #buildVisual(name) {
    const g = new THREE.Group();
    const base = name.replace(/[LR]$/, '');
    const sign = name.endsWith('R') ? -1 : 1;
    switch (base) {
      case 'pelvis': {
        const joggers = this.#cloth('joggers');
        g.add(mesh(new RoundedBoxGeometry(0.39, 0.2, 0.27, 4, 0.08), joggers, [0, -0.005, 0]));
        // the elastic waistband, mostly hidden under the hoodie and the belly
        const band = mesh(new THREE.CylinderGeometry(1, 1, 0.045, 28), this.#cloth('joggersRib'), [0, 0.075, 0]);
        band.scale.set(0.198, 1, 0.14);
        g.add(band);
        break;
      }
      case 'chest':
        this.#buildChest(g);
        break;
      case 'head':
        this.#buildHead(g);
        break;
      case 'upperArm':
        g.add(capsule(0.072, 0.36, this.#cloth('hoodie')));
        break;
      case 'lowerArm': {
        g.add(capsule(0.064, 0.3, this.#cloth('hoodie')).translateY(0.01));
        g.add(mesh(new THREE.CylinderGeometry(0.056, 0.058, 0.045, 18), this.#cloth('hoodieRib'), [0, -0.14, 0]));
        const skin = material(COLORS.skin);
        const hand = mesh(new THREE.SphereGeometry(0.07, 20, 14), skin, HAND_OFFSET);
        hand.scale.set(0.8, 1.15, 0.95);
        g.add(hand);
        // the thumb, pointing forward
        const thumb = mesh(new THREE.CapsuleGeometry(0.02, 0.035, 4, 10), skin, [-0.02 * sign, HAND_OFFSET.y + 0.015, 0.06]);
        thumb.rotation.x = 0.6;
        g.add(thumb);
        break;
      }
      case 'upperLeg':
        g.add(capsule(0.093, 0.5, this.#cloth('joggers')));
        break;
      case 'lowerLeg': {
        g.add(capsule(0.08, 0.42, this.#cloth('joggers')).translateY(0.02));
        // baggy, worn-out knees
        const knee = mesh(new THREE.SphereGeometry(0.084, 18, 12), this.#cloth('joggers', { color: 0xe4e4e4 }), [0, 0.205, 0.01]);
        knee.scale.set(0.96, 0.8, 1.06);
        g.add(knee);
        g.add(mesh(new THREE.CylinderGeometry(0.061, 0.064, 0.05, 18), this.#cloth('joggersRib'), [0, -0.2, 0]));
        g.add(mesh(new RoundedBoxGeometry(0.15, 0.08, 0.28, 3, 0.03), material(COLORS.shoe, { roughness: 0.7 }), FOOT_OFFSET));
        g.add(mesh(new THREE.BoxGeometry(0.152, 0.024, 0.282), material(COLORS.sole), [FOOT_OFFSET.x, FOOT_OFFSET.y - 0.03, FOOT_OFFSET.z]));
        break;
      }
    }
    return g;
  }

  #buildChest(g) {
    const hoodie = this.#cloth('hoodie');
    g.add(mesh(new RoundedBoxGeometry(0.46, 0.44, 0.27, 4, 0.1), hoodie));

    // the belly, with the hoodie's front pocket stretched over it
    const bellyAt = [0, -0.07, 0.06];
    const bellyScale = [1.05, 0.88, 0.82];
    const belly = mesh(new THREE.SphereGeometry(0.19, 28, 20), hoodie, bellyAt);
    belly.scale.set(...bellyScale);
    g.add(belly);
    const pocket = mesh(
      new THREE.SphereGeometry(0.192, 20, 10, Math.PI / 2 - 0.6, 1.2, Math.PI * 0.53, Math.PI * 0.25),
      this.#cloth('hoodie', { color: 0xd8d0cc }),
      bellyAt,
    );
    pocket.scale.set(...bellyScale);
    g.add(pocket);

    // ribbed hem, stretched round the belly
    const hem = mesh(new THREE.CylinderGeometry(1, 1, 0.055, 32, 1, true), this.#cloth('hoodieRib', { side: THREE.DoubleSide }), [0, -0.2, 0.02]);
    hem.scale.set(0.24, 1, 0.162);
    g.add(hem);

    // the hood, bunched up behind his neck, and the neckline
    const hood = mesh(new THREE.SphereGeometry(0.12, 20, 14), this.#cloth('hoodie', { color: 0xe8e2df }), [0, 0.17, -0.12]);
    hood.scale.set(1.4, 0.6, 0.75);
    g.add(hood);
    const collar = mesh(new THREE.TorusGeometry(0.085, 0.032, 10, 28), this.#cloth('hoodie'), [0, 0.215, -0.005]);
    collar.rotation.x = Math.PI / 2;
    g.add(collar);

    // drawstrings, lying on the belly
    const stringMat = material(0xeee6d8, { roughness: 0.8 });
    const tipMat = material(0x8b8f96, { roughness: 0.4, metalness: 0.4 });
    for (const s of [-1, 1]) {
      const cord = new THREE.Group();
      cord.position.set(0.042 * s, 0.195, 0.14);
      cord.rotation.set(-0.27, 0, 0.06 * s);
      cord.add(mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.14, 6), stringMat, [0, -0.07, 0]));
      cord.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.025, 6), tipMat, [0, -0.15, 0]));
      g.add(cord);
    }

    // a faded, cracked print of his logo
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.045, 32), new THREE.MeshStandardMaterial({ map: logoTexture(), roughness: 0.9 }));
    logo.position.set(0.11, 0.08, 0.1365);
    g.add(logo);
  }

  #buildHead(g) {
    const skin = material(COLORS.skin);

    // a neck under the beard, so no gap shows when his head lolls
    g.add(mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.11, 16), skin, [0, -0.11, -0.01]));

    // The face is laid out on a 0.15 m ball and squeezed into the shape of his
    // head: a bit narrower than tall, top of the head at 1.90 m.
    const f = new THREE.Group();
    f.scale.set(0.833, 0.933, 0.867);
    g.add(f);

    f.add(mesh(new THREE.SphereGeometry(0.15, 32, 24), skin));
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.035, 12, 10), skin, [0.148 * s, 0, 0]);
      ear.scale.set(0.55, 1, 0.85);
      f.add(ear);
    }
    const nose = mesh(new THREE.SphereGeometry(0.031, 16, 12), skin, [0, -0.008, 0.148]);
    nose.scale.set(0.9, 1.1, 1);
    f.add(nose);

    // Receding hair: a short crop over the back and sides, a narrower patch
    // on top that leaves the temples bare, and a little tuft in the middle of
    // the forehead.
    const hairMat = material(0xffffff, { map: this.tex.hair, roughness: 1 });
    const hair = mesh(new THREE.SphereGeometry(0.155, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), hairMat);
    hair.rotation.x = -0.75;
    f.add(hair);
    const crown = mesh(new THREE.SphereGeometry(0.158, 28, 8, 0, Math.PI * 2, 0, Math.PI * 0.24), hairMat);
    crown.rotation.x = 0.12;
    f.add(crown);
    const tuft = mesh(new THREE.SphereGeometry(0.035, 14, 8), hairMat, [0, 0.116, 0.097]);
    tuft.rotation.x = 0.7;
    tuft.scale.set(1.3, 0.3, 1.1);
    f.add(tuft);

    // Scruffy beard: a shell over the jaw from ear to ear, cut on a slant
    // from the sideburns down to the corners of his mouth, plus a moustache.
    const beardMat = material(0xffffff, { map: this.tex.beard, roughness: 1 });
    const beard = mesh(new THREE.SphereGeometry(0.157, 32, 12, 0, Math.PI, Math.PI * 0.56, Math.PI * 0.44), beardMat);
    beard.rotation.x = 0.25;
    f.add(beard);
    const chin = mesh(new THREE.SphereGeometry(0.055, 16, 12), beardMat, [0, -0.108, 0.082]);
    chin.scale.set(1.25, 0.7, 0.9);
    f.add(chin);
    const tache = mesh(new THREE.TorusGeometry(0.044, 0.013, 8, 20, Math.PI), beardMat, [0, -0.052, 0.146]);
    tache.scale.set(1, 0.45, 1);
    f.add(tache);

    // eyes, eyebrows and glasses
    const eyeMat = material(COLORS.eye, { roughness: 0.3 });
    const pupilMat = material(COLORS.pupil, { roughness: 0.2 });
    const browMat = material(0xffffff, { map: this.tex.hair, roughness: 1 });
    const frameMat = material(COLORS.frames, { roughness: 0.35, metalness: 0.4 });
    this.face = { pupils: [], xEyes: [], brows: [] };
    for (const s of [-1, 1]) {
      f.add(mesh(new THREE.SphereGeometry(0.03, 16, 12), eyeMat, [0.055 * s, 0.03, 0.124]));
      const pupil = mesh(new THREE.SphereGeometry(0.015, 12, 10), pupilMat, [0.055 * s, 0.03, 0.151]);
      f.add(pupil);
      this.face.pupils.push(pupil);

      const x = new THREE.Group();
      for (const r of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.01, 0.01), pupilMat);
        bar.rotation.z = r;
        x.add(bar);
      }
      x.position.set(0.055 * s, 0.03, 0.157);
      x.visible = false;
      f.add(x);
      this.face.xEyes.push(x);

      const brow = mesh(new RoundedBoxGeometry(0.052, 0.014, 0.014, 2, 0.005), browMat, [0.058 * s, 0.079, 0.128]);
      brow.rotation.x = -0.4;
      brow.userData.side = s;
      f.add(brow);
      this.face.brows.push(brow);

      const frame = mesh(frameGeometry(0.086, 0.06, 0.008, 0.014), frameMat, [0.058 * s, 0.032, 0.17]);
      f.add(frame);
      // the arm of the glasses, running back over the ear
      const front = [0.1 * s, 0.04, 0.17];
      const back = [0.158 * s, 0.035, 0.0];
      const len = Math.hypot(front[0] - back[0], front[2] - back[2]);
      const arm = mesh(new THREE.BoxGeometry(0.007, 0.008, len), frameMat, [(front[0] + back[0]) / 2, 0.038, (front[2] + back[2]) / 2]);
      arm.rotation.y = Math.atan2(front[0] - back[0], front[2] - back[2]);
      f.add(arm);
    }
    f.add(mesh(new THREE.BoxGeometry(0.032, 0.007, 0.007), frameMat, [0, 0.045, 0.174]));

    // The mouth sits in the beard, tilted to follow the chin.
    const mouth = new THREE.Group();
    mouth.position.set(0, -0.06, 0.148);
    mouth.rotation.x = 0.35;
    f.add(mouth);
    const mouthMat = material(COLORS.mouth, { roughness: 0.5 });
    const teethMat = material(COLORS.teeth, { roughness: 0.3, emissive: 0x3a3a3a });
    const lipMat = material(COLORS.lip, { roughness: 0.5 });

    // his everyday big toothy smile
    const smile = new THREE.Group();
    smile.add(new THREE.Mesh(new THREE.CircleGeometry(0.036, 20, Math.PI, Math.PI), teethMat));
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.007, 6, 20, Math.PI), lipMat);
    lip.rotation.z = Math.PI;
    smile.add(lip);
    smile.scale.set(1.25, 0.75, 1);
    mouth.add(smile);

    const ouch = new THREE.Group();
    ouch.add(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 8, 20), lipMat));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.022, 20), mouthMat);
    hole.position.z = -0.002;
    ouch.add(hole);
    ouch.position.set(0, -0.026, 0.002);
    ouch.visible = false;
    mouth.add(ouch);

    // a wide open grin for when he's flying
    const grin = new THREE.Group();
    grin.add(new THREE.Mesh(new THREE.CircleGeometry(0.048, 24, Math.PI, Math.PI), mouthMat));
    grin.add(mesh(new THREE.BoxGeometry(0.07, 0.013, 0.004), teethMat, [0, -0.008, 0.002]));
    grin.visible = false;
    mouth.add(grin);

    // and his tongue sticking out when he's dizzy
    const tongue = mesh(new THREE.SphereGeometry(0.024, 14, 10), material(0xe86f86, { roughness: 0.4 }), [0.012, -0.05, 0.01]);
    tongue.scale.set(1, 1.3, 0.5);
    tongue.visible = false;
    mouth.add(tongue);

    this.face.smile = smile;
    this.face.ouch = ouch;
    this.face.grin = grin;
    this.face.tongue = tongue;

    // Cartoon stars circling his head when he's dizzy. They live in the scene
    // rather than on the head, so they stay above him whichever way up he is.
    this.stars = new THREE.Group();
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    for (let i = 0; i < 4; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), starMat);
      const a = (i / 4) * Math.PI * 2;
      star.position.set(Math.cos(a) * 0.26, Math.sin(a * 2) * 0.04, Math.sin(a) * 0.26);
      star.scale.set(1, 1, 0.45);
      this.stars.add(star);
    }
    this.stars.visible = false;
    this.scene.add(this.stars);
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
    if (this.stars.visible) {
      const h = this.parts.head.group.position;
      this.stars.position.set(h.x, h.y + 0.26, h.z);
      this.stars.rotation.y += dt * 4;
      for (const s of this.stars.children) s.rotation.y += dt * 6;
    }
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) this.setExpression('normal');
    }
  }

  /** 'normal' | 'ouch' | 'whee' | 'dizzy'. A duration of 0 keeps it until changed. */
  setExpression(kind, duration = 0) {
    // A brief 'ouch' never overrides a lasting dizzy face.
    if (kind === 'ouch' && this.expression === 'dizzy' && this.expressionTimer <= 0) return;
    this.expression = kind;
    this.expressionTimer = duration;
    const dizzy = kind === 'dizzy';
    this.face.pupils.forEach((p) => (p.visible = !dizzy));
    this.face.xEyes.forEach((x) => (x.visible = dizzy));
    this.face.smile.visible = kind === 'normal';
    this.face.grin.visible = kind === 'whee';
    this.face.ouch.visible = kind === 'ouch' || dizzy;
    this.face.tongue.visible = dizzy;
    this.stars.visible = dizzy;
    // eyebrows: raised when flying, pinched together for ouch, all over the place when dizzy
    for (const b of this.face.brows) {
      const s = b.userData.side;
      const tilt = { whee: 0, ouch: -0.35, dizzy: 0.3 * s }[kind] ?? 0;
      b.position.y = kind === 'whee' ? 0.091 : 0.079;
      b.rotation.z = tilt * s;
    }
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
