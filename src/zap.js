// Lennie getting electrocuted, cartoon style: for a second or so he flashes
// between glowing blue and an X-ray of his skeleton, lightning crackles over
// him (and from the TV that zapped him), the room lights up blue and his limbs
// jerk about. Afterwards he's black with soot, which slowly wears off, and a
// few puffs of smoke rise from his head.
import * as THREE from 'three';
import { HAND_OFFSET, FOOT_OFFSET } from './ragdoll.js';

const DURATION = 1.4;
const SOOT_TIME = 6; // seconds for the soot to wear off again
const FLICKER = 0.07; // seconds per flash
const BOLTS = 6;
const BOLT_SEGMENTS = 7;
const _y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _side = new THREE.Vector3();
const _glow = new THREE.Color();

/** A cartoon skeleton for each body part, in that part's own frame. */
function buildBones(name) {
  const g = new THREE.Group();
  const bone = new THREE.MeshBasicMaterial({ color: 0xf4fbff });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0b1a2a });
  const add = (geo, mat, pos, rot, scale) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    if (scale) m.scale.set(...scale);
    m.userData.noAim = true;
    g.add(m);
    return m;
  };
  // a long bone with a knobbly end at each joint
  const long = (length, r = 0.022, y = 0) => {
    add(new THREE.CylinderGeometry(r, r, length, 8), bone, [0, y, 0]);
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(r * 1.7, 10, 8), bone, [0, y + (s * length) / 2, 0]);
  };
  const base = name.replace(/[LR]$/, '');
  switch (base) {
    case 'head':
      add(new THREE.SphereGeometry(0.12, 20, 16), bone, [0, 0.015, 0], null, [0.9, 1, 0.95]);
      for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.032, 12, 10), dark, [0.045 * s, 0.03, 0.095]);
      add(new THREE.ConeGeometry(0.016, 0.03, 3), dark, [0, -0.015, 0.115], [Math.PI, 0, 0]);
      add(new THREE.BoxGeometry(0.11, 0.045, 0.07), bone, [0, -0.085, 0.055]);
      for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.004, 0.035, 0.004), dark, [i * 0.02, -0.075, 0.091]);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.11, 8), bone, [0, -0.13, -0.02]);
      break;
    case 'chest':
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 8), bone, [0, 0, -0.07]);
      for (const [y, r] of [[0.12, 0.15], [0.05, 0.16], [-0.02, 0.155], [-0.09, 0.14]]) {
        add(new THREE.TorusGeometry(r, 0.014, 6, 24), bone, [0, y, -0.01], [Math.PI / 2, 0, 0], [1, 0.62, 1]);
      }
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8), bone, [0, 0.19, 0], [0, 0, Math.PI / 2]);
      break;
    case 'pelvis':
      add(new THREE.TorusGeometry(0.11, 0.03, 8, 20), bone, [0, 0, 0], [Math.PI / 2 - 0.3, 0, 0], [1.2, 1, 0.8]);
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), bone, [0, 0.06, -0.07]);
      break;
    case 'upperArm': long(0.32); break;
    case 'upperLeg': long(0.44, 0.028); break;
    case 'lowerArm':
      long(0.26, 0.018);
      add(new THREE.SphereGeometry(0.038, 10, 8), bone, [HAND_OFFSET.x, HAND_OFFSET.y, HAND_OFFSET.z]);
      for (let i = -1; i <= 1; i++) {
        add(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), bone, [HAND_OFFSET.x + i * 0.02, HAND_OFFSET.y - 0.05, HAND_OFFSET.z]);
      }
      break;
    case 'lowerLeg':
      long(0.38, 0.022);
      add(new THREE.BoxGeometry(0.07, 0.035, 0.22), bone, [FOOT_OFFSET.x, FOOT_OFFSET.y, FOOT_OFFSET.z]);
      break;
  }
  g.visible = false;
  return g;
}

export class Zap {
  constructor(scene, ragdoll) {
    this.ragdoll = ragdoll;
    this.t = Infinity; // time since the zap started
    this.soot = 0;
    this.source = null; // where the shock came from (the TV's hole), or null
    this.flick = 0;
    this.xray = false;

    this.parts = Object.values(ragdoll.parts).map((part) => {
      const bones = buildBones(part.name);
      part.group.add(bones);
      const meshes = [];
      part.group.traverse((o) => { if (o.isMesh && o.userData.part) meshes.push(o); });
      return { part, bones, meshes };
    });
    this.materials = [...new Set(this.parts.flatMap((p) => p.part.materials))].filter((m) => m.color);
    for (const m of this.materials) {
      m.userData.zapBase = m.color.clone();
      if (m.emissive) m.userData.zapGlow = m.emissive.clone();
    }

    // Lightning: thin cylinders laid end to end, with a fatter see-through glow round each.
    const seg = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    const core = new THREE.MeshBasicMaterial({ color: 0xeefaff });
    const glow = new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    this.segments = [];
    for (let i = 0; i < BOLTS * BOLT_SEGMENTS; i++) {
      const c = new THREE.Mesh(seg, core);
      const h = new THREE.Mesh(seg, glow);
      for (const m of [c, h]) {
        m.visible = false;
        m.userData.noAim = true;
        m.frustumCulled = false;
        scene.add(m);
      }
      this.segments.push({ c, h });
    }

    // The flash lights up the room. It's always there (at 0 when not zapping),
    // so switching it on doesn't make every material recompile.
    this.light = new THREE.PointLight(0x7fd4ff, 0, 6, 2);
    scene.add(this.light);

    // Smoke puffs from his head afterwards.
    const puffGeo = new THREE.SphereGeometry(0.07, 10, 8);
    this.puffs = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.userData.noAim = true;
      scene.add(m);
      this.puffs.push({ m, t: Infinity, delay: 0, drift: new THREE.Vector3() });
    }
  }

  get active() {
    return this.t < DURATION;
  }

  /** Starts a shock; `source` is where it came from (a THREE.Vector3), if anywhere. */
  start(source = null) {
    this.t = 0;
    this.flick = 0;
    this.source = source ? source.clone() : null;
    this.ragdoll.setExpression('ouch', DURATION);
  }

  /** Puts Lennie back to normal at once (fresh drop, fix everything). */
  clear() {
    this.t = Infinity;
    this.soot = 0;
    this.#show(false);
    this.#paint(0, 0);
    this.light.intensity = 0;
    for (const s of this.segments) s.c.visible = s.h.visible = false;
    for (const p of this.puffs) { p.t = Infinity; p.m.visible = false; }
  }

  /**
   * Paints him again after his own colours changed: effects.js tints him
   * (frozen, painted, wet) by changing each material's userData.zapBase and
   * zapGlow, and the soot goes on top of that.
   */
  repaint() {
    if (!this.active) this.#paint(0, this.soot);
  }

  /** Normal body or the X-ray skeleton. */
  #show(xray) {
    if (xray === this.xray) return;
    this.xray = xray;
    for (const p of this.parts) {
      p.bones.visible = xray;
      for (const m of p.meshes) m.visible = !xray;
    }
  }

  /** Soot (black, 0..1) on his clothes and skin, and a blue glow (0..1; null leaves it as it is). */
  #paint(glow, soot) {
    for (const m of this.materials) {
      m.color.copy(m.userData.zapBase).multiplyScalar(1 - 0.75 * soot);
      if (glow !== null && m.emissive) m.emissive.copy(m.userData.zapGlow).add(_glow.setRGB(0.25 * glow, 0.6 * glow, 1.0 * glow));
    }
  }

  #bolt(k, from, to) {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 0.01) return;
    _side.crossVectors(_d, _y);
    if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
    _side.normalize();
    const up = new THREE.Vector3().crossVectors(_side, _d).normalize();
    _a.copy(from);
    for (let i = 1; i <= BOLT_SEGMENTS; i++) {
      const f = i / BOLT_SEGMENTS;
      _b.copy(from).addScaledVector(_d, f);
      if (i < BOLT_SEGMENTS) {
        const j = len * 0.18;
        _b.addScaledVector(_side, (Math.random() - 0.5) * j).addScaledVector(up, (Math.random() - 0.5) * j);
      }
      const s = this.segments[k * BOLT_SEGMENTS + i - 1];
      const piece = _b.clone().sub(_a);
      const l = piece.length();
      for (const [m, r] of [[s.c, 0.006], [s.h, 0.022]]) {
        m.visible = true;
        m.position.copy(_a).addScaledVector(piece, 0.5);
        m.quaternion.setFromUnitVectors(_y, piece.normalize());
        piece.multiplyScalar(l);
        m.scale.set(r, l, r);
      }
      _a.copy(_b);
    }
  }

  #bolts() {
    for (const s of this.segments) s.c.visible = s.h.visible = false;
    const centres = this.parts.map((p) => p.part.group.position);
    let k = 0;
    // from the TV to him, for the first part of the shock
    if (this.source && this.t < DURATION * 0.6) {
      let near = centres[0];
      for (const c of centres) if (c.distanceToSquared(this.source) < near.distanceToSquared(this.source)) near = c;
      this.#bolt(k++, this.source, near);
      this.#bolt(k++, this.source, centres[Math.floor(Math.random() * centres.length)]);
    }
    // and crackling all over him
    while (k < BOLTS) {
      const a = centres[Math.floor(Math.random() * centres.length)];
      const b = centres[Math.floor(Math.random() * centres.length)];
      if (a === b) continue;
      this.#bolt(k++, a, b);
    }
  }

  /** Jerks his limbs about: called once a frame while the physics runs. */
  #spasm() {
    for (const { part } of this.parts) {
      const v = part.body.velocity;
      const w = part.body.angularVelocity;
      const kick = part.name === 'chest' || part.name === 'pelvis' ? 0.6 : 1.6;
      v.x += (Math.random() - 0.5) * kick;
      v.y += (Math.random() - 0.5) * kick;
      v.z += (Math.random() - 0.5) * kick;
      w.x += (Math.random() - 0.5) * 8;
      w.y += (Math.random() - 0.5) * 8;
      w.z += (Math.random() - 0.5) * 8;
      part.body.wakeUp();
    }
  }

  /** dt in game time; `physics` is false while a replay has the physics paused. */
  update(dt, physics = true) {
    const was = this.active;
    this.t += dt;
    if (this.active) {
      this.flick -= dt;
      if (this.flick <= 0) {
        this.flick = FLICKER * (0.6 + Math.random() * 0.8);
        const xray = !this.xray && Math.random() < 0.7;
        this.#show(xray);
        this.#paint(xray ? 0 : 0.6 + Math.random() * 0.4, this.soot);
        this.#bolts();
        this.light.intensity = 4 + Math.random() * 10;
        if (physics) this.#spasm();
      }
      this.soot = Math.min(1, this.t / DURATION);
      this.light.position.copy(this.ragdoll.center(_a));
      return;
    }
    if (was) {
      // the shock is over: sooty, dazed and smoking
      this.#show(false);
      for (const s of this.segments) s.c.visible = s.h.visible = false;
      this.light.intensity = 0;
      this.soot = 1;
      this.#paint(0, this.soot);
      this.ragdoll.setExpression('dizzy', 2.5);
      this.puffs.forEach((p, i) => {
        p.t = 0;
        p.delay = i * 0.25;
        p.drift.set((Math.random() - 0.5) * 0.25, 0.5 + Math.random() * 0.2, (Math.random() - 0.5) * 0.25);
      });
    }
    if (this.soot > 0) {
      this.soot = Math.max(0, this.soot - dt / SOOT_TIME);
      this.#paint(null, this.soot);
    }
    const head = this.ragdoll.parts.head.group.position;
    for (const p of this.puffs) {
      if (p.t === Infinity) continue;
      p.t += dt;
      const age = p.t - p.delay;
      if (age < 0) continue;
      if (age > 1.6) {
        p.t = Infinity;
        p.m.visible = false;
        continue;
      }
      if (!p.m.visible) p.m.position.set(head.x, head.y + 0.15, head.z);
      p.m.visible = true;
      p.m.position.addScaledVector(p.drift, dt);
      p.m.scale.setScalar(1 + age * 1.5);
      p.m.material.opacity = 0.55 * (1 - age / 1.6);
    }
  }
}
