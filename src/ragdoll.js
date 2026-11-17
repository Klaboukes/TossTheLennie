import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawn } from './pictures.js';

// Lennie: 50, 1.90 m tall, 100 kg with a bit of a belly, in a worn hoodie and
// old joggers. His face follows the real Lennie (docs/lennie-face.jpg): short
// dark brown hair receding at the temples, dark rectangular glasses, a short
// salt-and-pepper beard that's greyest on the chin, and a big toothy smile.
const COLORS = {
  skin: 0xf0bfa2,
  hoodie: '#b14a3e', // a faded brick-red, still easy to spot against the house
  hoodieRib: '#963d33',
  joggers: '#6c6f77', // grey marl, worn pale at the knees
  joggersRib: '#55585f',
  shoe: 0x30343f,
  sole: 0xe4ddd0,
  hair: '#3a281d',
  beard: '#4d3d33',
  frames: 0x30343a,
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

// Where his shoulder joints sit on his torso, measured from its middle: how
// high, and how far out. They're close enough in for his arms to hang against
// his sides rather than beside them.
const SHOULDER_Y = 0.11;
const SHOULDER_X = 0.28;

// The masses add up to his 100 kg, in roughly a real body's proportions.
const PARTS = [
  { name: 'pelvis', label: 'hips', mass: 15, pos: [0, 1.11, 0], shapes: [{ box: [0.19, 0.09, 0.13] }] },
  {
    // the belly is its own round shape, low on his torso, so he rolls over
    // it when he lands face down
    name: 'chest', label: 'torso', mass: 22, pos: [0, 1.41, 0],
    shapes: [{ box: [0.22, 0.21, 0.13] }, { sphere: 0.15, offset: new CANNON.Vec3(0, -0.12, 0.065) }],
  },
  { name: 'head', label: 'head', mass: 6.5, pos: [0, 1.76, 0], shapes: [{ sphere: 0.13 }] },
  // His shoulders are 10 cm under the top of his torso (SHOULDER_Y), which
  // leaves him a neck between them and his chin.
  ...SIDES.flatMap(({ s, sign, word }) => [
    { name: 'upperArm' + s, label: `${word} arm`, mass: 4.5, pos: [SHOULDER_X * sign, 1.35, 0], shapes: [{ box: [0.065, 0.17, 0.065] }] },
    {
      name: 'lowerArm' + s, label: `${word} hand`, mass: 3.5, pos: [SHOULDER_X * sign, 1.025, 0],
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
// relaxed = [pitch, roll]: where part b hangs from part a when every muscle is
// slack, the pose a floating astronaut drifts into (NASA's neutral body
// posture): knees and hips bent, arms out in front with bent elbows, head and
// back a little forward. Pitch turns about the part's x axis (negative swings
// a limb forward), roll about z (towards `sign` swings it out to the side).
const JOINTS = [
  { name: 'neck', label: 'Neck', a: 'head', b: 'chest', pa: [0, -0.14, 0], pb: [0, 0.21, 0], angle: Math.PI / 4, twist: Math.PI / 4, range: 1.2, weight: 1.2, relaxed: [-0.3, 0] },
  { name: 'spine', label: 'Spine', a: 'chest', b: 'pelvis', pa: [0, -0.21, 0], pb: [0, 0.09, 0], angle: Math.PI / 5, twist: Math.PI / 6, range: 0.9, weight: 1.5, relaxed: [-0.15, 0] },
  ...SIDES.flatMap(({ s, sign, word }) => {
    const W = word[0].toUpperCase() + word.slice(1);
    return [
      { name: 'shoulder' + s, label: `${W} shoulder`, a: 'chest', b: 'upperArm' + s, pa: [SHOULDER_X * sign, SHOULDER_Y, 0], pb: [0, 0.17, 0], angle: 2.0, twist: Math.PI / 3, range: 2.4, weight: 0.8, relaxed: [-0.65, 0.6 * sign] },
      { name: 'elbow' + s, label: `${W} elbow`, a: 'upperArm' + s, b: 'lowerArm' + s, pa: [0, -0.17, 0], pb: [0, 0.155, 0], angle: 1.6, twist: 0.3, range: 1.8, weight: 1, relaxed: [-1.0, 0] },
      { name: 'hip' + s, label: `${W} hip`, a: 'pelvis', b: 'upperLeg' + s, pa: [0.115 * sign, -0.09, 0], pb: [0, 0.24, 0], angle: 1.4, twist: 0.5, range: 1.7, weight: 1.1, relaxed: [-0.7, 0.2 * sign] },
      { name: 'knee' + s, label: `${W} knee`, a: 'upperLeg' + s, b: 'lowerLeg' + s, pa: [0, -0.24, 0], pb: [0, 0.23, 0], angle: 1.6, twist: 0.2, range: 1.8, weight: 1, relaxed: [0.8, 0] },
    ];
  }),
];

// A plain ragdoll's joints swing freely up to a hard stop, which looks limp
// and weightless. These three cheap touches (after Lincoln Margison's
// "Improving ragdolls forever") give Lennie some muscle tone; see tense() and
// fling(). Set one to 0 to switch that touch off (window.lennie.FEEL in the
// console, to compare).
export const FEEL = {
  // Soft limits: from this share of a joint's limit on, it brakes...
  softStart: 0.65,
  // ...shedding its speed towards the limit at up to this rate (1/s), so it
  // eases into the stop rather than slamming into it and bouncing back.
  softRate: 45,
  // The relaxed pose, only while he flies: how hard each joint is drawn to it
  // (1/s²), how much that calms his flailing (1/s), and the angle (radians)
  // beyond which it pulls no harder. Kept gentle: over 200 test tosses a
  // firmer pull (25, damping 3) landed him about a tenth less contorted.
  relaxPull: 18,
  relaxDamp: 1.5,
  relaxMax: 1.2,
  // How hard a launch flings his arms and legs about.
  kick: 1,
};
// Lennie lounging in a chair (sit()), facing +Z: how far each part is turned
// [forward, out to his side] in radians, as seen in the room. Forward is
// negative pitch, the way the joints' relaxed pose counts it: his back leans
// back against the chair's back, his thighs lie on the seat (the hips can't
// bend a full right angle), his shins hang down over the front edge and his
// forearms rest on the armrests. Every joint stays well inside its limits.
const SEATED = {
  pelvis: [-0.45, 0],
  chest: [-0.6, 0],
  head: [-0.2, 0],
  upperArm: [-0.9, 0.12],
  lowerArm: [-1.57, 0.05],
  upperLeg: [-1.45, 0.08],
  lowerLeg: [-0.25, 0.03],
};
// [part, the part it hangs from], each after its parent.
const SEATED_TREE = [
  ['chest', 'pelvis'], ['head', 'chest'],
  ...SIDES.flatMap(({ s }) => [
    ['upperArm' + s, 'chest'], ['lowerArm' + s, 'upperArm' + s],
    ['upperLeg' + s, 'pelvis'], ['lowerLeg' + s, 'upperLeg' + s],
  ]),
];
const FLUNG = [['upperArmL', 5], ['upperArmR', 5], ['upperLegL', 3.5], ['upperLegR', 3.5], ['head', 2]];
const UP = new CANNON.Vec3(0, 1, 0);
const X_AXIS = new CANNON.Vec3(1, 0, 0);
const Z_AXIS = new CANNON.Vec3(0, 0, 1);
const _ya = new CANNON.Vec3();
const _yb = new CANNON.Vec3();
const _n = new CANNON.Vec3();
const _t = new CANNON.Vec3();
const _qa = new CANNON.Quaternion();
const _qb = new CANNON.Quaternion();

const vec = (a) => new CANNON.Vec3(a[0], a[1], a[2]);
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });

/**
 * Hair and beard: textures laid on by a slanted flat projection instead of
 * the sphere's own UVs, which bunch up into a swirl where a shell closes.
 */
function hairUVs(geometry, scale = 8) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    uv.setXY(i, (x + 0.6 * z) * scale, (y + 0.8 * z) * scale);
  }
  uv.needsUpdate = true;
  return geometry;
}

function mesh(geometry, mat, position) {
  const m = new THREE.Mesh(geometry, mat);
  if (position) m.position.set(position.x ?? position[0], position.y ?? position[1], position.z ?? position[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * An arm or a leg bone, turned on a lathe. `rings` are [height, radius] pairs
 * from the bottom up; the shape runs smoothly through them and ends in a ball
 * centred on the first and on the last ring. Put those on the joints and a
 * bent elbow or knee stays closed, with no end poking out: the two bones turn
 * about the middle of the same ball. The child bone's ball is a few
 * millimetres smaller than its parent's, so the two never flicker. An end
 * that's hidden (in a cuff, under his hoodie) can be flat instead.
 */
function limb(rings, { ballBottom = true, ballTop = true, radial = 16 } = {}) {
  const CAP = 5;
  const [y0, r0] = rings[0];
  const [y1, r1] = rings[rings.length - 1];
  const pts = [];
  if (ballBottom) {
    for (let i = 0; i < CAP; i++) {
      const a = (i / CAP) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(a) * r0, y0 - Math.cos(a) * r0));
    }
  } else {
    pts.push(new THREE.Vector2(0, y0));
  }
  pts.push(...new THREE.SplineCurve(rings.map(([y, r]) => new THREE.Vector2(r, y))).getPoints((rings.length - 1) * 4));
  if (ballTop) {
    for (let i = 1; i <= CAP; i++) {
      const a = (i / CAP) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * r1, y1 + Math.sin(a) * r1));
    }
  } else {
    pts.push(new THREE.Vector2(0, y1));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/** Lays a texture `u` times as often round a shape and `v` times along it. */
function tile(geometry, u, v = 1) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  return geometry;
}

const _fuse = new THREE.Matrix4();
const FUSED = ['position', 'normal', 'uv'];

/**
 * Fewer things to draw: all the meshes in `root` that share one material
 * become one mesh. Anything that moves or hides by itself (his pupils,
 * eyebrows and mouths) is marked `userData.live` and left alone, like
 * everything that starts out hidden.
 */
function fuse(root) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const byMaterial = new Map();
  (function collect(o) {
    if (o.userData.live || !o.visible) return;
    if (o.isMesh) {
      if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
      byMaterial.get(o.material).push(o);
    }
    for (const child of o.children) collect(child);
  })(root);
  for (const [mat, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    const pieces = meshes.map((m) => {
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (!FUSED.includes(name)) geo.deleteAttribute(name);
      geo.clearGroups();
      return geo.applyMatrix4(_fuse.multiplyMatrices(toRoot, m.matrixWorld));
    });
    const one = mergeGeometries(pieces);
    if (!one) continue; // (the console says why)
    for (const m of meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    root.add(mesh(mergeVertices(one), mat));
  }
  return root;
}

// Deterministic pseudo-random, so Lennie looks the same every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// (`draw` runs again when the picture is needed again, see pictures.js: start its random numbers inside it)
function canvasTexture(size, draw) {
  const t = drawn(size, size, (g) => draw(g, size));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Marl fabric: flecks of lighter and darker thread, bobbles, and faded patches. */
function fabricTexture(base, seed, { worn = 6, repeat = 2 } = {}) {
  const t = canvasTexture(256, (g, s) => {
    const r = rng(seed);
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
  return canvasTexture(128, (g, s) => {
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = r();
      g.fillStyle = v < grey ? `rgba(215,212,206,${0.35 + r() * 0.4})` : v < 0.7 ? 'rgba(20,12,8,0.35)' : 'rgba(110,80,60,0.25)';
      g.fillRect(r() * s, r() * s, 1, 2 + r() * 3);
    }
  });
}

/**
 * Thinning hair: strands on a see-through background, so his scalp shows
 * between them. The material cuts the gaps out (alphaTest).
 */
function thinHairTexture(base, seed) {
  return canvasTexture(128, (g, s) => {
    const r = rng(seed);
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 3400; i++) {
      const v = r();
      g.fillStyle = v < 0.08 ? '#b9b3aa' : v < 0.6 ? base : '#24170f';
      g.save();
      g.translate(r() * s, r() * s);
      g.rotate(-0.35 + r() * 0.7);
      g.fillRect(0, 0, 1.2, 3 + r() * 3);
      g.restore();
    }
  });
}

function logoTexture() {
  // a cracked, washed-out print of his "L" logo
  return canvasTexture(128, (g) => {
    const r = rng(7);
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
      hair: hairTexture(COLORS.hair, 31, 0.05),
      thinHair: thinHairTexture(COLORS.hair, 33),
      beard: hairTexture(COLORS.beard, 37, 0.42),
      chin: hairTexture(COLORS.beard, 41, 0.62),
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
    // For tense(): the relaxed pose as a rotation of b seen from a, and how
    // heavy the two parts are to turn about this joint.
    const relaxed = new CANNON.Quaternion().setFromAxisAngle(Z_AXIS, def.relaxed[1])
      .mult(new CANNON.Quaternion().setFromAxisAngle(X_AXIS, def.relaxed[0]));
    const heft = (body, pivot) => (body.inertia.x + body.inertia.z) / 2 + body.mass * vec(pivot).lengthSquared();
    const ia = heft(bodyA, def.pa);
    const ib = heft(bodyB, def.pb);
    this.joints.push({ ...def, bodyA, bodyB, constraint, relaxed, inertia: (ia * ib) / (ia + ib) });
  }

  /**
   * Muscle tone, called before every physics step (it only adds torques, a
   * few sums per joint).
   *
   * Soft limits, always: a joint swinging towards its limit brakes over the
   * last stretch, like muscles and tendons reaching their full stretch.
   * Coming back from the limit it's free.
   *
   * The relaxed pose, as far as `relax` (0 to 1) says: each joint is drawn
   * gently towards its relaxed angle. That's for while he flies, where it
   * makes him a floppy person rather than a stiff plank; on the ground it
   * would untangle him, and tangled is what scores.
   */
  tense(dt, relax = 0) {
    const { softStart, softRate, relaxPull, relaxDamp, relaxMax } = FEEL;
    for (const j of this.joints) {
      const A = j.bodyA;
      const B = j.bodyB;
      const wa = A.angularVelocity;
      const wb = B.angularVelocity;
      const rx = wb.x - wa.x;
      const ry = wb.y - wa.y;
      const rz = wb.z - wa.z;

      if (softRate > 0) {
        // the swing is the angle between the two bones, as the cone limit measures it
        A.quaternion.vmult(UP, _ya);
        B.quaternion.vmult(UP, _yb);
        const cos = _ya.dot(_yb);
        const start = j.angle * softStart;
        if (cos < Math.cos(start)) {
          _ya.cross(_yb, _n); // turning b about this axis swings it further out
          const sin = _n.length();
          const rate = sin > 1e-4 ? (rx * _n.x + ry * _n.y + rz * _n.z) / sin : 0;
          if (rate > 0) {
            _n.scale(1 / sin, _n);
            const k = Math.min(1, (Math.atan2(sin, cos) - start) / (j.angle - start));
            // A share of the speed per step, never more than all of it, so it can't overshoot.
            const shed = 1 - Math.exp(-softRate * k * k * dt);
            let free = A.invInertiaWorld.vmult(_n, _t).dot(_n);
            free += B.invInertiaWorld.vmult(_n, _t).dot(_n);
            if (free > 1e-9) {
              const torque = (shed * rate) / (free * dt);
              B.torque.addScaledVector(-torque, _n, B.torque);
              A.torque.addScaledVector(torque, _n, A.torque);
            }
          }
        }
      }

      if (relax > 0 && relaxPull > 0) {
        // the turn that would take b from where it is to its relaxed place on a
        A.quaternion.mult(j.relaxed, _qa);
        B.quaternion.conjugate(_qb);
        _qa.mult(_qb, _qa);
        const s = Math.hypot(_qa.x, _qa.y, _qa.z);
        const angle = Math.min(relaxMax, 2 * Math.atan2(s, Math.abs(_qa.w)));
        const pull = s > 1e-6 ? (relax * relaxPull * j.inertia * angle * Math.sign(_qa.w || 1)) / s : 0;
        const damp = relax * relaxDamp * j.inertia;
        _t.set(_qa.x * pull - rx * damp, _qa.y * pull - ry * damp, _qa.z * pull - rz * damp);
        B.torque.vadd(_t, B.torque);
        A.torque.vsub(_t, A.torque);
      }
    }
  }

  /**
   * A launch flings his arms, legs and head about: they lag behind, swinging
   * back from the way `v` he's sent, each with a random twirl of its own, so
   * no two throws look alike. Turning the parts about their own middles
   * leaves his flight path alone.
   */
  fling(v, strength = 1) {
    const k = FEEL.kick * strength;
    if (!(k > 0)) return;
    const speed = Math.hypot(v.x, v.y, v.z);
    const lag = speed > 1e-3 ? (Math.min(1, speed / 12) * 4 * k) / speed : 0;
    const r = (a) => (Math.random() - 0.5) * 2 * a * k;
    for (const [name, twirl] of FLUNG) {
      const body = this.parts[name].body;
      const w = body.angularVelocity;
      // the limb hangs down its bone (-_ya): turn it towards pointing straight back
      body.quaternion.vmult(UP, _ya);
      _t.set(v.x, v.y, v.z).cross(_ya, _n).scale(-lag, _n);
      if (name === 'head') _n.setZero();
      w.set(w.x + _n.x + r(twirl), w.y + _n.y + r(twirl), w.z + _n.z + r(twirl));
    }
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
        // Hips: wide, narrowing between his legs, and less deep than wide.
        // Only the bottom shows, between his thighs: the rest is under his
        // hoodie.
        const hips = limb([[-0.12, 0.06], [-0.085, 0.14], [-0.03, 0.19], [0.03, 0.19]], { ballBottom: false, ballTop: false, radial: 28 });
        g.add(mesh(tile(hips, 2).scale(1, 1, 0.66), this.#cloth('joggers')));
        // The bottom of his hoodie hangs over his hips down to its ribbed hem,
        // so he bends at the waist inside it and his legs don't start at his
        // belly. It's part of his hips, not his chest, so the hem stays snug
        // round them however he's bent. Its top is a dome that sits inside
        // his chest and only shows where a bend opens his waist.
        const skirt = limb([[-0.05, 0.208], [0.02, 0.21], [0.11, 0.21], [0.16, 0.175], [0.19, 0.11]], { ballBottom: false, ballTop: false, radial: 28 });
        g.add(mesh(tile(skirt, 2).scale(1, 1, 0.69), this.#cloth('hoodie'), [0, 0, 0.01]));
        const hem = mesh(new THREE.CylinderGeometry(1, 1, 0.05, 32), this.#cloth('hoodieRib'), [0, -0.035, 0.01]);
        hem.scale.set(0.217, 1, 0.15);
        g.add(hem);
        break;
      }
      case 'chest':
        this.#buildChest(g);
        break;
      case 'head':
        this.#buildHead(g);
        break;
      case 'upperArm':
        // Thick below the shoulder, slimmer at the elbow. Its top is a smaller
        // ball that sits under the joint, tucked under the shoulder of his
        // hoodie (the yoke on his chest), so his shoulders slope down into
        // his arms instead of sticking out as two balls.
        g.add(mesh(limb([[-0.17, 0.062], [-0.06, 0.068], [0.05, 0.073], [0.125, 0.064]]), this.#cloth('hoodie')));
        break;
      case 'lowerArm':
        // the sleeve bunches up over a tighter cuff
        g.add(mesh(limb([[-0.125, 0.056], [-0.05, 0.06], [0.05, 0.061], [0.155, 0.058]], { ballBottom: false }), this.#cloth('hoodie')));
        g.add(mesh(new THREE.CylinderGeometry(0.046, 0.048, 0.05, 18), this.#cloth('hoodieRib'), [0, -0.145, 0]));
        this.#buildHand(g, sign);
        break;
      case 'upperLeg':
        g.add(mesh(limb([[-0.24, 0.08], [-0.1, 0.088], [0.08, 0.099], [0.24, 0.1]]), this.#cloth('joggers')));
        break;
      case 'lowerLeg': {
        // a bit of calf, and the leg bunched up over the ankle cuff
        g.add(mesh(limb([[-0.19, 0.06], [-0.1, 0.068], [0.07, 0.08], [0.23, 0.076]], { ballBottom: false }), this.#cloth('joggers')));
        // baggy, worn-out knees
        const knee = mesh(new THREE.SphereGeometry(0.078, 18, 12), this.#cloth('joggers', { color: 0xe4e4e4 }), [0, 0.2, 0.012]);
        knee.scale.set(0.95, 0.85, 1.05);
        g.add(knee);
        g.add(mesh(new THREE.CylinderGeometry(0.055, 0.057, 0.05, 18), this.#cloth('joggersRib'), [0, -0.2, 0]));
        this.#buildShoe(g);
        break;
      }
    }
    return fuse(g);
  }

  /**
   * A chunky cartoon hand hanging out of the sleeve: palm towards his body,
   * thumb forward, four fingers a little curled. It's all one material, so
   * fuse() makes it one mesh.
   */
  #buildHand(g, sign) {
    const skin = material(COLORS.skin);
    const y = HAND_OFFSET.y;
    g.add(mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.04, 12), skin, [0, y + 0.045, 0])); // wrist
    const palm = mesh(new THREE.SphereGeometry(1, 16, 12), skin, [0, y + 0.005, 0]);
    palm.scale.set(0.03, 0.05, 0.047);
    g.add(palm);
    const thumb = mesh(new THREE.CapsuleGeometry(0.015, 0.035, 3, 8), skin, [-0.008 * sign, y + 0.01, 0.052]);
    thumb.rotation.x = -0.8;
    g.add(thumb);
    // from the little finger at the back to the index finger at the front
    const curl = -0.3 * sign;
    [0.04, 0.05, 0.056, 0.05].forEach((length, i) => {
      const finger = mesh(new THREE.CapsuleGeometry(0.0135, length - 0.027, 3, 8), skin);
      finger.position.set((Math.sin(curl) * length) / 2, y - 0.03 - (Math.cos(curl) * length) / 2, -0.033 + i * 0.022);
      finger.rotation.z = curl;
      g.add(finger);
    });
  }

  /**
   * A trainer: a low dome over the toes, a higher one round the heel and
   * ankle and one between them, on a pale sole a touch wider than the shoe,
   * with three laces.
   * Nothing reaches below the sole, so it's flat to stand and land on.
   */
  #buildShoe(g) {
    const upper = material(COLORS.shoe, { roughness: 0.7 });
    const pale = material(COLORS.sole);
    const seam = FOOT_OFFSET.y - 0.013; // where the domes sink into the sole
    const dome = (rx, ry, rz, z) => {
      const m = mesh(new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), upper, [0, seam, z]);
      m.scale.set(rx, ry, rz);
      g.add(m);
    };
    dome(0.067, 0.05, 0.094, 0.092);
    dome(0.062, 0.058, 0.08, 0.035); // the instep, filling the dip between the two
    dome(0.062, 0.075, 0.068, -0.012);

    // the sole's outline seen from above (x across, the second number along the foot)
    const print = new THREE.Shape();
    print.moveTo(0, -0.08);
    print.bezierCurveTo(0.048, -0.08, 0.063, -0.06, 0.063, -0.01);
    print.bezierCurveTo(0.063, 0.03, 0.068, 0.06, 0.068, 0.1);
    print.bezierCurveTo(0.068, 0.16, 0.045, 0.187, 0, 0.187);
    print.bezierCurveTo(-0.045, 0.187, -0.068, 0.16, -0.068, 0.1);
    print.bezierCurveTo(-0.068, 0.06, -0.063, 0.03, -0.063, -0.01);
    print.bezierCurveTo(-0.063, -0.06, -0.048, -0.08, 0, -0.08);
    const sole = new THREE.ExtrudeGeometry(print, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 });
    g.add(mesh(sole.rotateX(Math.PI / 2), pale, [0, FOOT_OFFSET.y - 0.012, 0]));

    for (const [z, y] of [[0.05, 0.033], [0.072, 0.037], [0.094, 0.038]]) {
      g.add(mesh(new THREE.BoxGeometry(0.052, 0.006, 0.01), pale, [0, FOOT_OFFSET.y + y, z]));
    }
  }

  #buildChest(g) {
    const hoodie = this.#cloth('hoodie');
    // His torso is turned from an outline ([height, how far out]) and is less
    // deep than wide, like the bottom of the hoodie on his hips that it
    // slips over, so the two meet in a level fold and his arms lie against
    // its round sides. It stops at his shoulders, well under his chin (which
    // is level with the neck joint, 0.21 up), so there's a neck to see.
    const torsoRings = [[-0.225, 0.214], [-0.12, 0.216], [-0.02, 0.216], [0.06, 0.207], [0.11, 0.18], [0.145, 0.13], [0.16, 0.08]];
    const DEPTH = 0.66;
    g.add(mesh(tile(limb(torsoRings, { ballBottom: false, ballTop: false, radial: 32 }), 3).scale(1, 1, DEPTH), hoodie));
    // how far forward his chest comes at a spot on it, for what lies on it
    const side = new THREE.SplineCurve(torsoRings.map(([y, r]) => new THREE.Vector2(r, y))).getPoints((torsoRings.length - 1) * 4);
    const front = (x, y) => {
      const i = Math.max(1, side.findIndex((p) => p.y >= y));
      const a = side[i - 1];
      const b = side[i];
      const r = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
      return DEPTH * Math.sqrt(r * r - x * x);
    };
    // his shoulders: a rounded yoke that slopes down from his neck and out
    // over the top of each arm
    const yoke = mesh(new THREE.SphereGeometry(1, 28, 14), hoodie, [0, SHOULDER_Y - 0.025, -0.005]);
    yoke.scale.set(SHOULDER_X + 0.045, 0.09, 0.12); // its tips end inside the tops of his arms
    g.add(yoke);

    // His neck, up out of the collar to the neck joint, where it ends in a
    // ball just inside the one under his head: it stays closed however his
    // head lolls.
    const skin = material(COLORS.skin);
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.066, 0.085, 16, 1, true), skin, [0, 0.1675, -0.01]));
    g.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), skin, [0, 0.21, -0.01]));

    // The belly, with the hoodie's front pocket stretched over it. It hangs
    // low, over the top of his hips, and leaves his chest above it flat.
    // It's one shape turned from an outline ([height, how far out]) that
    // comes out of his chest level with it, swells to its fullest low down
    // and tucks back in under itself, so there's no crease along the top
    // like a ball stuck on him would have. Its back half is squashed flat:
    // that part is hidden inside him, and it must stay there when he bends.
    const bellyRings = [[-0.3, 0.1], [-0.275, 0.18], [-0.225, 0.218], [-0.17, 0.224], [-0.11, 0.212], [-0.05, 0.193], [0, 0.171], [0.04, 0.149], [0.075, 0.14]];
    const bellyAt = [0, 0, -0.02];
    const onBelly = (geometry) => {
      const p = geometry.scale(0.94, 1, 1.05).attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) p.setZ(i, p.getZ(i) * 0.3);
      return geometry;
    };
    g.add(mesh(onBelly(tile(limb(bellyRings, { ballBottom: false, ballTop: false, radial: 28 }), 2)), hoodie, bellyAt));
    // the pocket: a strip of the same outline, 3 mm further out
    const outline = new THREE.SplineCurve(bellyRings.map(([y, r]) => new THREE.Vector2(r + 0.003, y)));
    const strip = Array.from({ length: 9 }, (_, i) => outline.getPoint(0.2 + (i / 8) * 0.3));
    g.add(mesh(onBelly(new THREE.LatheGeometry(strip, 12, -0.5, 1)), this.#cloth('hoodie', { color: 0xd8d0cc }), bellyAt));

    // (the bottom of the hoodie and its hem are on his hips: see 'pelvis')

    // the hood, bunched up behind his neck, and the neckline, lower at the front
    const hood = mesh(new THREE.SphereGeometry(0.12, 20, 14), this.#cloth('hoodie', { color: 0xe8e2df }), [0, 0.125, -0.12]);
    hood.scale.set(1.4, 0.6, 0.75);
    g.add(hood);
    const collar = mesh(new THREE.TorusGeometry(0.078, 0.024, 10, 28), hoodie, [0, 0.165, -0.005]);
    collar.rotation.x = Math.PI / 2 + 0.2;
    g.add(collar);

    // drawstrings: out of the front of the collar, over the top of his chest
    // and down it, ending above his belly (one a little longer than the other)
    const stringMat = material(0xeee6d8, { roughness: 0.8 });
    const tipMat = material(0x8b8f96, { roughness: 0.4, metalness: 0.4 });
    for (const s of [-1, 1]) {
      const end = s > 0 ? 0.035 : 0.06;
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.035 * s, 0.15, 0.075),
        new THREE.Vector3(0.036 * s, 0.132, 0.116),
        new THREE.Vector3(0.04 * s, 0.09, front(0.04, 0.09) + 0.0075),
        new THREE.Vector3(0.043 * s, end, front(0.043, end) + 0.0075),
      ]);
      g.add(mesh(new THREE.TubeGeometry(path, 12, 0.0065, 6), stringMat));
      g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.025, 6), tipMat, [0.043 * s, end - 0.01, front(0.043, end) + 0.009]));
    }

    // a faded, cracked print of his logo, bent round his chest 3 mm off it
    // (rings of points, so it follows the curve all the way across)
    const print = new THREE.RingGeometry(0.0001, 0.045, 32, 4).translate(0.115, 0.035, 0);
    const at = print.attributes.position;
    for (let i = 0; i < at.count; i++) at.setZ(i, front(at.getX(i), at.getY(i)) + 0.003);
    print.computeVertexNormals();
    g.add(new THREE.Mesh(print, new THREE.MeshStandardMaterial({ map: logoTexture(), roughness: 0.9 })));
  }

  #buildHead(g) {
    const skin = material(COLORS.skin);

    // a neck under the beard, so no gap shows when his head lolls, ending in
    // a ball on the neck joint that stays inside his collar
    g.add(mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.085, 16), skin, [0, -0.0975, -0.01]));
    g.add(mesh(new THREE.SphereGeometry(0.062, 16, 12), skin, [0, -0.14, -0.01]));

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

    // Short dark hair, thinning and well receded: a sparse crop over the top
    // (his scalp shows between the strands), its front edge far back on his
    // head and the temples bare, a few wisps left in the middle at the front,
    // and fuller hair round the back down to his neck.
    const hairMat = material(0xffffff, { map: this.tex.hair, roughness: 1 });
    const thinMat = material(0xffffff, { map: this.tex.thinHair, roughness: 1, alphaTest: 0.5 });
    const hair = mesh(hairUVs(new THREE.SphereGeometry(0.153, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), 7), thinMat);
    hair.rotation.x = -0.75;
    hair.scale.set(1.0, 1.02, 1.0);
    f.add(hair);
    // the back, just inside the crop where they overlap
    const nape = mesh(hairUVs(new THREE.SphereGeometry(0.152, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.3)), hairMat);
    nape.rotation.x = -1.55;
    nape.scale.set(1.0, 1.02, 1.0);
    f.add(nape);
    // and the sides, over and round his ears down to the sideburns (the temples stay bare)
    for (const s of [-1, 1]) {
      const side = mesh(hairUVs(new THREE.SphereGeometry(0.151, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.3)), hairMat);
      side.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.89 * s, 0.22, -0.4).normalize());
      side.scale.set(1.0, 1.02, 1.0);
      f.add(side);
    }
    const wisps = mesh(hairUVs(new THREE.SphereGeometry(0.035, 16, 8), 7), thinMat, [0, 0.128, 0.088]);
    wisps.rotation.x = 0.95;
    wisps.scale.set(1.4, 0.22, 0.9);
    f.add(wisps);

    // Short salt-and-pepper beard: a close shell over the jaw from ear to ear,
    // cut on a slant from the sideburns to the corners of his mouth, a greyer
    // chin, and a neat moustache that runs into it.
    const beardMat = material(0xffffff, { map: this.tex.beard, roughness: 1 });
    const chinMat = material(0xffffff, { map: this.tex.chin, roughness: 1 });
    const beard = mesh(hairUVs(new THREE.SphereGeometry(0.155, 32, 12, 0, Math.PI, Math.PI * 0.56, Math.PI * 0.44)), beardMat);
    beard.rotation.x = 0.25;
    f.add(beard);
    const chin = mesh(hairUVs(new THREE.SphereGeometry(0.055, 16, 12)), chinMat, [0, -0.106, 0.08]);
    chin.scale.set(1.3, 0.72, 0.75);
    f.add(chin);
    // a gentle arch, its ends just reaching the corners of his mouth
    const tache = mesh(hairUVs(new THREE.TorusGeometry(0.06, 0.009, 8, 16, Math.PI / 2).rotateZ(Math.PI / 4)), beardMat, [0, -0.072, 0.142]);
    tache.scale.set(1, 0.5, 1);
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
      pupil.userData.live = true;
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

      // dark eyebrows (setExpression moves them up and down from here)
      const brow = mesh(new RoundedBoxGeometry(0.056, 0.011, 0.012, 2, 0.004), browMat, [0.058 * s, 0.079, 0.13]);
      brow.rotation.x = -0.4;
      brow.userData.side = s;
      brow.userData.live = true;
      f.add(brow);
      this.face.brows.push(brow);

      // rectangular frames, wider than they're tall
      const frame = mesh(frameGeometry(0.09, 0.054, 0.0065, 0.011), frameMat, [0.058 * s, 0.032, 0.17]);
      f.add(frame);
      // the arm of the glasses, running back over the ear
      const front = [0.102 * s, 0.045, 0.17];
      const back = [0.158 * s, 0.035, 0.0];
      const len = Math.hypot(front[0] - back[0], front[2] - back[2]);
      const arm = mesh(new THREE.BoxGeometry(0.006, 0.007, len), frameMat, [(front[0] + back[0]) / 2, 0.04, (front[2] + back[2]) / 2]);
      arm.rotation.y = Math.atan2(front[0] - back[0], front[2] - back[2]);
      f.add(arm);
    }
    f.add(mesh(new THREE.BoxGeometry(0.028, 0.006, 0.006), frameMat, [0, 0.042, 0.174]));

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
    // setExpression() shows and hides these, so fuse() must leave them be
    for (const o of [smile, ouch, grin, tongue, ...this.face.xEyes]) o.userData.live = true;

    // Cartoon stars circling his head when he's dizzy. They live in the scene
    // rather than on the head, so they stay above him whichever way up he is.
    // There are a few styles, and every good toss picks a different one.
    this.stars = new THREE.Group();
    this.stars.visible = false;
    this.scene.add(this.stars);
    this.starStyles = [];
    this.starStyle = null;
    this.starTime = 0;

    const rhombus = new THREE.OctahedronGeometry(0.065, 0);
    const starMats = {};
    const starMat = (color) => (starMats[color] ??= new THREE.MeshBasicMaterial({ color }));
    // n flattened rhombuses spread evenly round a ring of radius r
    const ring = (n, r, colors, size = 1) => {
      const g = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const star = new THREE.Mesh(rhombus, starMat(colors[i % colors.length]));
        const a = (i / n) * Math.PI * 2;
        star.userData.angle = a;
        star.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        star.scale.set(size, size, 0.45 * size);
        g.add(star);
      }
      return g;
    };
    const addStyle = (group, animate) => {
      group.visible = false;
      this.stars.add(group);
      this.starStyles.push({ group, animate });
    };
    const twirl = (g, dt, speed) => g.traverse((o) => o.isMesh && (o.rotation.y += dt * speed));

    // the classic: four yellow stars on a gently wavy ring
    const classic = ring(4, 0.26, [0xffd23f]);
    for (const s of classic.children) s.position.y = Math.sin(s.userData.angle * 2) * 0.04;
    addStyle(classic, (g, t, dt) => {
      g.rotation.y += dt * 4;
      twirl(g, dt, 6);
    });

    // rainbow: six smaller stars in every colour, going the other way and bobbing like a wave
    const rainbow = ring(6, 0.28, [0xff4d4d, 0xff9f1c, 0xffe14d, 0x4cd964, 0x3fa9ff, 0xb46bff], 0.75);
    addStyle(rainbow, (g, t, dt) => {
      g.rotation.y -= dt * 5;
      for (const s of g.children) s.position.y = Math.sin(t * 7 + s.userData.angle * 2) * 0.05;
      twirl(g, dt, 8);
    });

    // atom: two tilted rings crossing each other, spinning opposite ways
    const atom = new THREE.Group();
    const ringA = ring(3, 0.25, [0xffd23f]);
    const ringB = ring(3, 0.25, [0x8fe3ff]);
    const tiltA = new THREE.Group();
    const tiltB = new THREE.Group();
    tiltA.rotation.z = 0.5;
    tiltB.rotation.z = -0.5;
    tiltA.add(ringA);
    tiltB.add(ringB);
    atom.add(tiltA, tiltB);
    addStyle(atom, (g, t, dt) => {
      ringA.rotation.y += dt * 5;
      ringB.rotation.y -= dt * 5;
      g.rotation.y += dt * 1.5;
      twirl(g, dt, 6);
    });

    // pulse: pink and gold stars whose ring breathes in and out while they swell and shrink
    const pulse = ring(5, 0.26, [0xff7eb6, 0xffd23f]);
    addStyle(pulse, (g, t, dt) => {
      g.rotation.y += dt * 3;
      const r = 0.26 + Math.sin(t * 4) * 0.06;
      for (const s of g.children) {
        const a = s.userData.angle;
        const k = 1 + Math.sin(t * 8 + a * 3) * 0.3;
        s.position.set(Math.cos(a) * r, Math.cos(t * 4) * 0.03, Math.sin(a) * r);
        s.scale.set(k, k, 0.45 * k);
      }
      twirl(g, dt, 6);
    });
  }

  /** Show a different style of dizzy stars than last time. */
  pickStarStyle() {
    const others = this.starStyles.filter((s) => s !== this.starStyle);
    this.starStyle = others[Math.floor(Math.random() * others.length)];
    for (const s of this.starStyles) s.group.visible = s === this.starStyle;
    this.starTime = 0;
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

  /**
   * Sit Lennie back in a chair: his hips over (x, z), facing yaw, the bottom
   * of his hips and thighs 1 cm above the seat (`seat` is its height).
   */
  sit({ x = 0, z = 0, seat = 0, yaw = 0 } = {}) {
    const turn = (name) => {
      const [pitch, roll] = SEATED[name.replace(/[LR]$/, '')];
      const sign = name.endsWith('R') ? -1 : 1;
      return new CANNON.Quaternion().setFromAxisAngle(Z_AXIS, roll * sign)
        .mult(new CANNON.Quaternion().setFromAxisAngle(X_AXIS, pitch));
    };
    // Each part hangs from its parent's joint, starting from his hips.
    const at = { pelvis: { p: new CANNON.Vec3(), q: turn('pelvis') } };
    for (const [child, parent] of SEATED_TREE) {
      const j = this.joints.find((j) => (j.a === child && j.b === parent) || (j.a === parent && j.b === child));
      const q = turn(child);
      const p = at[parent].p.vadd(at[parent].q.vmult(vec(j.a === parent ? j.pa : j.pb))).vsub(q.vmult(vec(j.a === child ? j.pa : j.pb)));
      at[child] = { p, q };
    }
    const facing = new CANNON.Quaternion().setFromAxisAngle(UP, yaw);
    const place = (y) => {
      for (const part of Object.values(this.parts)) {
        const p = facing.vmult(at[part.name].p);
        part.body.position.set(x + p.x, y + p.y, z + p.z);
        part.body.quaternion.copy(facing.mult(at[part.name].q));
        part.body.velocity.setZero();
        part.body.angularVelocity.setZero();
        part.body.force.setZero();
        part.body.torque.setZero();
        part.body.wakeUp();
        part.body.updateAABB();
      }
    };
    place(0);
    const bottom = Math.min(...['pelvis', 'upperLegL', 'upperLegR'].map((n) => this.parts[n].body.aabb.lowerBound.y));
    place(seat + 0.01 - bottom);
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
      this.starTime += dt;
      this.starStyle?.animate(this.starStyle.group, this.starTime, dt);
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
    const dizzy = kind === 'dizzy';
    if (dizzy && this.expression !== 'dizzy') this.pickStarStyle();
    this.expression = kind;
    this.expressionTimer = duration;
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
