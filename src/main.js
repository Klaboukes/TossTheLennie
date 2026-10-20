import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHouse, HOUSE } from './house.js';
import { buildYard, YARD } from './yard.js';
import { Ragdoll } from './ragdoll.js';
import { measureContortion, evaluateToss, chainMultiplier } from './scoring.js';
import { Sfx } from './audio.js';
import { StuckGuard } from './guard.js';

const FIXED_DT = 1 / 120;
const GRAB_FORCE = 3000;
const MAX_HAND_SPEED = 20;
const THROW_BOOST = 0.4; // fraction of the flick velocity added to the whole body on release
const MAX_PART_SPEED = 20; // capped so Lennie can't tunnel through walls
const FAST_SUBSTEP_SPEED = 5; // above this, physics takes two half steps per tick
const SETTLE_SPEED = 0.3;
const SETTLE_TIME = 0.8;
const MAX_TOSS_TIME = 14;
const MIN_TOSS_SPEED = 3.5;
const BOUNCE_IMPACT = 4;
const GLASS_BREAK_SPEED = 4.5;
// Doors are a bit tougher: a hard hit breaks one at once, a window-breaking
// hit only cracks it, and the next such knock (a moment later) finishes it.
const DOOR_BREAK_SPEED = 7;
const DOOR_CRACK_SPEED = GLASS_BREAK_SPEED;
const SLOWMO_SCALE = 0.25;
const CAMERA_SPEED = 6;
const SOFT = new Set(['cushion', 'leaves', 'trampoline']);

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------- renderer
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe3f2ff);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 400);
camera.position.set(2.5, 2.2, 14.5);

// ---------------------------------------------------------------- physics
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.solver.iterations = 20;
// The house is ~230 static boxes and only Lennie moves, so only test pairs
// that involve a moving body. (SAP sorting breaks on the infinite planes.)
class MovingBodiesBroadphase extends CANNON.NaiveBroadphase {
  collisionPairs(w, pairs1, pairs2) {
    const all = w.bodies;
    for (const bi of all) {
      if (bi.type === CANNON.Body.STATIC) continue;
      for (const bj of all) {
        if (bj === bi || (bj.type !== CANNON.Body.STATIC && bj.id < bi.id)) continue;
        if (this.needBroadphaseCollision(bi, bj)) this.intersectionTest(bi, bj, pairs1, pairs2);
      }
    }
  }
}
world.broadphase = new MovingBodiesBroadphase();

const lennieMat = new CANNON.Material('lennie');
const physMats = {
  hard: new CANNON.Material('hard'),
  soft: new CANNON.Material('soft'),
  glass: new CANNON.Material('glass'),
  trampoline: new CANNON.Material('trampoline'),
  ground: new CANNON.Material('ground'),
};
const contact = (m, friction, restitution) => world.addContactMaterial(new CANNON.ContactMaterial(m, lennieMat, { friction, restitution }));
contact(physMats.hard, 0.55, 0.3);
contact(physMats.soft, 0.5, 0.75);
contact(physMats.glass, 0.3, 0.15);
contact(physMats.trampoline, 0.5, 0.97);
contact(physMats.ground, 0.8, 0.2);
contact(lennieMat, 0.4, 0.05);

buildYard(scene, world, physMats);
const house = buildHouse(scene, world, physMats);
const lennie = new Ragdoll(world, scene, lennieMat);
// A little shove so he flops over instead of landing on his feet.
function nudge() {
  const chest = lennie.parts.chest.body;
  chest.velocity.x += (Math.random() - 0.5) * 2;
  chest.velocity.z += (Math.random() - 0.5) * 2;
}
{
  const p = house.spawnPoint(0);
  lennie.reset({ x: p.x, z: p.z, height: p.height + 0.3, yaw: 0.4 });
  nudge();
}

const guard = new StuckGuard(world, lennie);
guard.collectScenery();

const handBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0 });
world.addBody(handBody);

const sfx = new Sfx();

// ---------------------------------------------------------------- UI
const ui = {
  total: $('stat-total'),
  last: $('stat-last'),
  best: $('stat-best'),
  tosses: $('stat-tosses'),
  meterFill: $('meter-fill'),
  meterValue: $('meter-value'),
  status: $('toss-status'),
  result: $('result'),
  rTitle: $('r-title'),
  rRating: $('r-rating'),
  rTotal: $('r-total'),
  rLines: $('r-lines'),
  rFoot: $('r-foot'),
  toast: $('toast'),
  pops: $('pops'),
  help: $('help'),
  helpClose: $('help-close'),
  dropMenu: $('drop-menu'),
};

const BEST_KEY = 'toss-the-lennie:house-best';
const OLD_BEST_KEY = 'bounce-the-lennie:house-best'; // from before the rename
const stats = { total: 0, last: null, best: 0, tosses: 0 };
try {
  stats.best = Number(localStorage.getItem(BEST_KEY) ?? localStorage.getItem(OLD_BEST_KEY)) || 0;
} catch { /* storage unavailable */ }

function renderStats() {
  ui.total.textContent = fmt(stats.total);
  ui.last.textContent = stats.last === null ? '–' : fmt(stats.last);
  ui.best.textContent = fmt(stats.best);
  ui.tosses.textContent = fmt(stats.tosses);
}
renderStats();

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

let toastTimer = 0;
function toast(message, ms = 2200) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

function popAt(position, text, cls = '') {
  const v = new THREE.Vector3().copy(position).project(camera);
  if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  el.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
  ui.pops.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

let resultTimer = 0;
let countUp = null;
function showResult(result, where) {
  ui.rTitle.textContent = `Toss #${stats.tosses}`;
  ui.rRating.textContent = result.rating;
  ui.rLines.innerHTML = '';
  result.lines.forEach((line, i) => {
    const li = document.createElement('li');
    if (line.trick) li.className = 'trick';
    if (line.mult) li.className = 'mult';
    li.style.animationDelay = `${0.15 + i * 0.12}s`;
    const a = document.createElement('span');
    a.textContent = line.label;
    const b = document.createElement('span');
    b.textContent = typeof line.value === 'number' ? `+${fmt(line.value)}` : line.value;
    li.append(a, b);
    ui.rLines.appendChild(li);
  });
  const deg = Math.round((result.worst.theta * 180) / Math.PI);
  ui.rFoot.textContent = `Landed ${where}. Most bent: ${result.worst.label.toLowerCase()} (${deg}°).`;
  countUp = { t: 0, dur: 0.9, to: result.total };
  ui.rTotal.textContent = '0';
  ui.result.classList.add('show');
  clearTimeout(resultTimer);
  resultTimer = setTimeout(hideResult, 9000);
}

function hideResult() {
  ui.result.classList.remove('show');
}

// ---------------------------------------------------------------- toss state
// idle → held → flying → (scored | idle). Re-grabbing an airborne Lennie
// while flying counts as a juggle and keeps the combo going.
const toss = {
  state: 'idle',
  time: 0,
  settle: 0,
  maxSpeed: 0,
  lastBounceAt: 0,
  // the combo chain, kept across juggles
  bounces: 0,
  juggles: 0,
  smashed: 0,
  doors: 0,
  trampoline: 0,
  stairs: new Set(),
  startLevel: null,
  startInside: false,
};

function resetChain() {
  toss.bounces = 0;
  toss.juggles = 0;
  toss.smashed = 0;
  toss.doors = 0;
  toss.trampoline = 0;
  toss.stairs = new Set();
  toss.startLevel = null;
  toss.startInside = false;
}

const _center = new THREE.Vector3();

function houseBonuses(center) {
  const bonuses = [];
  const endInside = house.isInside(center);
  const onRoof = house.isOnRoof(center);
  const endLevel = house.levelOf(center);
  const hanging = !endInside && !onRoof && center.y > 1.5 && house.nearHouse(center);
  if (toss.startInside && hanging) bonuses.push({ label: 'Hanging out the window!', value: 250 });
  else if (toss.startInside && !endInside && !onRoof) bonuses.push({ label: 'Defenestrated!', value: 300 });
  const fell = (toss.startLevel ?? 0) - endLevel;
  if (fell >= 1) bonuses.push({ label: `Fell ${fell} floor${fell === 1 ? '' : 's'}`, value: 150 * fell });
  if (onRoof && toss.startLevel < 3) bonuses.push({ label: 'Stranded on the roof!', value: 350 });
  const steps = toss.stairs.size;
  if (steps >= 10) bonuses.push({ label: `Full flight! (${steps} steps)`, value: 400 });
  else if (steps >= 3) bonuses.push({ label: `Stair tumble (${steps} steps)`, value: 200 });
  if (toss.trampoline) {
    const n = Math.min(toss.trampoline, 5);
    bonuses.push({ label: n > 1 ? `Trampoline ×${n}` : 'Trampoline!', value: 80 * n });
  }
  return bonuses;
}

function finishToss() {
  if (toss.maxSpeed < MIN_TOSS_SPEED && !toss.smashed && !toss.doors) {
    toss.state = 'idle';
    resetChain();
    toast('Too gentle! Give Lennie a proper fling.');
    sfx.fizzle();
    return;
  }
  const center = lennie.center(_center);
  const result = evaluateToss(lennie, {
    bounces: toss.bounces,
    juggles: toss.juggles,
    smashed: toss.smashed,
    doors: toss.doors,
    bonuses: houseBonuses(center),
  });
  stats.total += result.total;
  stats.last = result.total;
  stats.tosses += 1;
  const newBest = result.total > stats.best;
  if (newBest) {
    stats.best = result.total;
    try { localStorage.setItem(BEST_KEY, String(stats.best)); } catch { /* ignore */ }
  }
  renderStats();
  bump(ui.total);
  if (newBest && stats.tosses > 1) {
    bump(ui.best);
    toast(`New best toss: ${fmt(result.total)}!`);
  }
  showResult(result, house.locate(center));
  sfx.score(result.total > 1600 ? 3 : result.total > 900 ? 2 : result.total > 400 ? 1 : 0);
  lennie.setExpression(result.total > 900 || toss.bounces >= 5 ? 'dizzy' : 'ouch', result.total > 900 ? 0 : 2.5);
  const head = lennie.parts.head.body.position;
  popAt(new THREE.Vector3(head.x, head.y + 0.4, head.z), `+${fmt(result.total)}`, 'big');
  focusLennie(1.0);
  toss.state = 'scored';
  resetChain();
}

function updateToss(simDt) {
  if (toss.state !== 'flying') return;
  toss.time += simDt;
  toss.maxSpeed = Math.max(toss.maxSpeed, lennie.coreSpeed());
  if (lennie.maxSpeed() < SETTLE_SPEED) toss.settle += simDt;
  else toss.settle = 0;
  if ((toss.time > 0.6 && toss.settle > SETTLE_TIME) || toss.time > MAX_TOSS_TIME) finishToss();
}

// ---------------------------------------------------------------- collisions & breaking glass and doors
let lastSoundAt = 0;
const EXCLAIM = ['OOF!', 'BONK!', 'WHEE!', 'OUCH!', 'THUD!', 'OW!', 'YIKES!'];
const pendingBreaks = new Set();

function contactPoint(e) {
  const partBody = e.target;
  const r = e.contact.bi === partBody ? e.contact.ri : e.contact.rj;
  return new THREE.Vector3(partBody.position.x + r.x, partBody.position.y + r.y, partBody.position.z + r.z);
}

lennie.onCollide = (partName, e) => {
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  const now = performance.now();
  const surf = e.body.surface;

  if (!surf) {
    if (e.body !== handBody && v > 2 && now - lastSoundAt > 60) {
      lastSoundAt = now;
      sfx.flop(Math.min(1, v / 10));
    }
    return;
  }

  if (surf.kind === 'glass') {
    if (!surf.piece.broken && v > GLASS_BREAK_SPEED) pendingBreaks.add(surf.piece);
    else if (v > 1.5 && now - lastSoundAt > 60) {
      lastSoundAt = now;
      sfx.thud(Math.min(1, v / 16));
    }
    return;
  }
  if (surf.kind === 'door' && !surf.piece.broken && v > DOOR_CRACK_SPEED) {
    const door = surf.piece;
    // The cooldown stops one impact (several limbs at once) from counting twice.
    if (v > DOOR_BREAK_SPEED || (door.cracked && now - door.crackedAt > 300)) {
      pendingBreaks.add(door);
      return;
    }
    if (!door.cracked) {
      house.crackDoor(door, Math.sign(e.target.velocity.dot(door.normal)) || 1);
      door.crackedAt = now;
      lastSoundAt = now;
      sfx.crack();
      popAt(door.center, 'CRACK!');
    }
  }
  if (v < 1.2) return;

  const strength = Math.min(1, v / 14);
  const soft = SOFT.has(surf.kind);
  if (now - lastSoundAt > 45) {
    lastSoundAt = now;
    if (soft) sfx.boing(strength);
    else sfx.thud(strength);
  }

  const flying = toss.state === 'flying';
  if (flying && surf.kind === 'stair' && v > 1.5) toss.stairs.add(surf.id);
  if (flying && v > BOUNCE_IMPACT && now - toss.lastBounceAt > 250) {
    toss.bounces += 1;
    toss.lastBounceAt = now;
    const point = contactPoint(e);
    point.y += 0.5;
    if (surf.kind === 'trampoline') {
      toss.trampoline += 1;
      popAt(point, 'BOING!', 'good');
    } else if (v > 7) {
      popAt(point, EXCLAIM[Math.floor(Math.random() * EXCLAIM.length)]);
    }
  }
  if (v > 7 && !soft) lennie.setExpression('ouch', 0.7);
};

// Lennie's velocities before each physics step, so that smashing through a
// window or door doesn't also bounce him off it.
const preStep = lennie.bodies.map(() => new CANNON.Vec3());

const shards = [];
const shardGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-0.05, -0.04, 0), new THREE.Vector3(0.06, -0.03, 0), new THREE.Vector3(0, 0.07, 0),
]);
shardGeo.computeVertexNormals();
const shardMat = new THREE.MeshStandardMaterial({ color: 0xd8efff, transparent: true, opacity: 0.8, roughness: 0.05, side: THREE.DoubleSide });
const splinterGeo = new THREE.BoxGeometry(0.035, 0.035, 0.2);
const splinterMats = new Map();
const splinterMat = (color) => {
  if (!splinterMats.has(color)) splinterMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  return splinterMats.get(color);
};

function smash(piece) {
  house.breakPiece(piece);
  const door = piece.kind === 'door';
  if (door) sfx.splinter();
  else sfx.crash();
  // Most of the debris flies the way Lennie was going.
  const travel = Math.sign(lennie.parts.chest.body.velocity.dot(piece.normal)) || 1;
  const along = new THREE.Vector3().crossVectors(piece.normal, new THREE.Vector3(0, 1, 0));
  for (let i = 0; i < (door ? 22 : 26); i++) {
    const m = door ? new THREE.Mesh(splinterGeo, splinterMat(piece.color)) : new THREE.Mesh(shardGeo, shardMat);
    m.position.copy(piece.center)
      .addScaledVector(along, (Math.random() - 0.5) * piece.width)
      .add(new THREE.Vector3(0, (Math.random() - 0.5) * piece.height, 0));
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    if (door) m.scale.set(1 + Math.random(), 1, 0.5 + Math.random() * 2.5);
    else m.scale.setScalar(0.6 + Math.random() * 1.2);
    m.castShadow = door;
    scene.add(m);
    const dir = Math.random() < 0.75 ? travel : -travel;
    const vel = piece.normal.clone().multiplyScalar(dir * (1 + Math.random() * 3))
      .addScaledVector(along, (Math.random() - 0.5) * 2)
      .add(new THREE.Vector3(0, Math.random() * 2, 0));
    shards.push({ m, vel, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0), t: 0, floor: piece.story * HOUSE.H });
  }
  if (toss.state === 'flying' || toss.state === 'held') {
    if (door) toss.doors += 1;
    else toss.smashed += 1;
  }
  popAt(piece.center.clone().addScaledVector(piece.normal, 0.6 * travel), door ? 'CRASH!' : 'SMASH!', 'big');
  lennie.setExpression('ouch', 1);
}

function updateShards(dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.t += dt;
    s.vel.y -= 9.8 * dt;
    s.m.position.addScaledVector(s.vel, dt);
    // Debris that stays indoors lands on its own floor, the rest in the yard.
    const floor = (house.isInside(s.m.position) ? s.floor : 0) + 0.02;
    if (s.m.position.y < floor) {
      s.m.position.y = floor;
      s.vel.set(0, 0, 0);
      s.spin.set(0, 0, 0);
    }
    s.m.rotation.x += s.spin.x * dt;
    s.m.rotation.y += s.spin.y * dt;
    if (s.t > 4) {
      scene.remove(s.m);
      shards.splice(i, 1);
    }
  }
}

function clearShards() {
  for (const s of shards) scene.remove(s.m);
  shards.length = 0;
}

// ---------------------------------------------------------------- grabbing
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let grab = null;
let hoverPart = null;

const grabLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.9, depthTest: false }),
);
grabLine.renderOrder = 10;
grabLine.visible = false;
grabLine.frustumCulled = false;
scene.add(grabLine);
const grabDot = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xff6b4a, depthTest: false }),
);
grabDot.renderOrder = 11;
grabDot.visible = false;
scene.add(grabDot);

function setPointer(e) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}

function pickPart() {
  const hit = raycaster.intersectObjects(lennie.pickables, false)[0];
  return hit ? { hit, name: hit.object.userData.part } : null;
}

function clampInWorld(v, margin) {
  const h = YARD.half - margin;
  v.x = clamp(v.x, -h, h);
  v.y = clamp(v.y, margin, 30);
  v.z = clamp(v.z, -h, h);
  return v;
}

function isAirborne() {
  return lennie.coreSpeed() > 2.5;
}

function startGrab(pick, pointerId) {
  const part = lennie.parts[pick.name];
  const p = pick.hit.point;
  const local = part.body.pointToLocalFrame(new CANNON.Vec3(p.x, p.y, p.z));
  handBody.position.set(p.x, p.y, p.z);
  handBody.velocity.setZero();
  const constraint = new CANNON.PointToPointConstraint(part.body, local, handBody, new CANNON.Vec3(), GRAB_FORCE);
  world.addConstraint(constraint);

  const normal = camera.getWorldDirection(new THREE.Vector3());
  grab = {
    part,
    local,
    constraint,
    pointerId,
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p),
    target: p.clone(),
    samples: [{ t: performance.now(), p: p.clone() }],
  };

  if (toss.state === 'flying' && isAirborne()) {
    toss.juggles = Math.min(5, toss.juggles + 1);
    popAt(p, `JUGGLE ×${toss.juggles}`, 'good');
  } else {
    resetChain();
  }
  toss.state = 'held';
  hideResult();
  if (lennie.expression !== 'normal') lennie.setExpression('normal');
  sfx.squeak();
  canvas.style.cursor = 'grabbing';
  grabLine.visible = grabDot.visible = true;
  camAnim = null;
}

const _from = new CANNON.Vec3();
const _to = new CANNON.Vec3();
const _rayHit = new CANNON.RaycastResult();
const SCENERY_ONLY = { collisionFilterMask: 1, skipBackfaces: true };

function moveGrab() {
  const hit = raycaster.ray.intersectPlane(grab.plane, new THREE.Vector3());
  if (!hit) return;
  clampInWorld(hit, 0.3);
  // The hand can't pass through walls, floors or ceilings: stop it just short
  // of the first one between the held point and the pointer. Otherwise it
  // drags a limb into the scenery and tears Lennie apart.
  grab.part.body.pointToWorldFrame(grab.local, _from);
  _to.set(hit.x, hit.y, hit.z);
  _rayHit.reset();
  if (world.raycastClosest(_from, _to, SCENERY_ONLY, _rayHit)) {
    const p = _rayHit.hitPointWorld;
    const back = new THREE.Vector3(_from.x - p.x, _from.y - p.y, _from.z - p.z);
    const len = back.length();
    hit.set(p.x, p.y, p.z).addScaledVector(back.normalize(), Math.min(0.25, len));
  }
  grab.target.copy(hit);
  const now = performance.now();
  grab.samples.push({ t: now, p: hit.clone() });
  while (grab.samples.length > 2 && now - grab.samples[0].t > 100) grab.samples.shift();
}

function flickVelocity() {
  const s = grab.samples;
  const now = performance.now();
  const first = s.find((x) => now - x.t <= 100) ?? s[s.length - 1];
  const last = s[s.length - 1];
  // A pointer that has stopped moving before release means a gentle drop.
  if (now - last.t > 60) return new THREE.Vector3();
  const dt = Math.max((last.t - first.t) / 1000, 1 / 120);
  const v = last.p.clone().sub(first.p).divideScalar(dt);
  if (v.length() > MAX_HAND_SPEED) v.setLength(MAX_HAND_SPEED);
  return v;
}

function endGrab() {
  if (!grab) return;
  const v = flickVelocity();
  world.removeConstraint(grab.constraint);
  handBody.velocity.setZero();
  for (const body of lennie.bodies) {
    body.velocity.x += v.x * THROW_BOOST;
    body.velocity.y += v.y * THROW_BOOST;
    body.velocity.z += v.z * THROW_BOOST;
    const sp = body.velocity.length();
    if (sp > MAX_PART_SPEED) body.velocity.scale(MAX_PART_SPEED / sp, body.velocity);
  }
  const speed = v.length();
  if (speed > 5) sfx.whoosh(Math.min(1, speed / 20));
  if (canvas.hasPointerCapture?.(grab.pointerId)) canvas.releasePointerCapture(grab.pointerId);
  grab = null;
  if (toss.startLevel === null) {
    const c = lennie.center(_center);
    toss.startLevel = house.levelOf(c);
    toss.startInside = house.isInside(c);
  }
  toss.state = 'flying';
  toss.time = 0;
  toss.settle = 0;
  toss.maxSpeed = 0;
  grabLine.visible = grabDot.visible = false;
  canvas.style.cursor = hoverPart ? 'grab' : '';
  controls.enabled = true;
}

function setHover(name) {
  if (name === hoverPart) return;
  if (hoverPart) lennie.highlight(hoverPart, false);
  hoverPart = name;
  if (hoverPart) lennie.highlight(hoverPart, true);
  if (!grab) canvas.style.cursor = hoverPart ? 'grab' : '';
}

// Registered before OrbitControls so a grab can disable orbiting in time.
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (e.button !== 0 || grab) return;
  setPointer(e);
  const pick = pickPart();
  if (!pick) return;
  controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  setHover(pick.name);
  startGrab(pick, e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  setPointer(e);
  if (grab) {
    if (e.pointerId === grab.pointerId) moveGrab();
    return;
  }
  if (e.pointerType === 'mouse' && e.buttons === 0) setHover(pickPart()?.name ?? null);
});

const release = (e) => {
  if (grab && e.pointerId === grab.pointerId) endGrab();
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', (e) => {
  if (!grab && e.pointerType === 'mouse') setHover(null);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Scroll while holding Lennie pushes him away from / towards the camera.
canvas.addEventListener('wheel', (e) => {
  if (!grab) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  grab.plane.constant += Math.sign(e.deltaY) * 0.25;
  moveGrab();
}, { passive: false, capture: true });

function updateGrabVisual() {
  if (!grab) return;
  const p = grab.part.body.pointToWorldFrame(grab.local);
  const pos = grabLine.geometry.attributes.position;
  pos.setXYZ(0, p.x, p.y, p.z);
  pos.setXYZ(1, grab.target.x, grab.target.y, grab.target.z);
  pos.needsUpdate = true;
  grabDot.position.copy(grab.target);
}

// ---------------------------------------------------------------- camera
const controls = new OrbitControls(camera, canvas);
controls.target.set(-2.2, 0.8, 1.6);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 32;
controls.update();

let camAnim = null;
let follow = false;
let cutaway = true;
controls.addEventListener('start', () => { camAnim = null; });

function focusLennie(dur = 0.7) {
  const to = lennie.center();
  const dir = camera.position.clone().sub(controls.target);
  const dist = clamp(dir.length(), 2.5, 6);
  dir.normalize();
  if (dir.y < 0.25) dir.y = 0.25;
  dir.normalize();
  const toCam = clampInWorld(to.clone().addScaledVector(dir, dist), 0.3);
  camAnim = { t: 0, dur, fromT: controls.target.clone(), toT: to, fromC: camera.position.clone(), toC: toCam };
}

const keys = new Set();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

function updateCamera(dt) {
  if (camAnim) {
    camAnim.t += dt;
    const k = Math.min(1, camAnim.t / camAnim.dur);
    const e = k * k * (3 - 2 * k);
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
    camera.position.lerpVectors(camAnim.fromC, camAnim.toC, e);
    if (k >= 1) camAnim = null;
  } else if (follow && !grab) {
    const d = lennie.center(_center).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 4));
    controls.target.add(d);
    camera.position.add(d);
  }

  _move.set(0, 0, 0);
  if (keys.size) {
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, camera.up).normalize();
    if (keys.has('KeyW') || keys.has('ArrowUp')) _move.add(_fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) _move.sub(_fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) _move.add(_right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) _move.sub(_right);
    if (keys.has('KeyE')) _move.y += 1;
    if (keys.has('KeyQ')) _move.y -= 1;
    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(CAMERA_SPEED * dt);
      camera.position.add(_move);
      controls.target.add(_move);
      camAnim = null;
    }
  }

  controls.update();
  clampInWorld(camera.position, 0.2);
  clampInWorld(controls.target, 0.05);
}

// ---------------------------------------------------------------- buttons & keys
let timeScale = 1;
const btn = {
  reset: $('btn-reset'),
  focus: $('btn-focus'),
  follow: $('btn-follow'),
  cutaway: $('btn-cutaway'),
  slowmo: $('btn-slowmo'),
  sound: $('btn-sound'),
  drop: $('btn-drop'),
  help: $('btn-help'),
};

const LEVEL_NAMES = ['floor 1', 'floor 2', 'floor 3', 'the roof'];
function dropLennie(level) {
  if (grab) endGrab();
  const p = house.spawnPoint(level);
  lennie.reset({ x: p.x, z: p.z, height: p.height, yaw: (Math.random() - 0.5) * 0.8 });
  guard.forget();
  nudge();
  lennie.setExpression('normal');
  toss.state = 'idle';
  resetChain();
  hideResult();
  focusLennie(0.8);
}

function resetAll() {
  house.repairAll();
  clearShards();
  dropLennie(0);
  toast('Windows and doors fixed, Lennie back downstairs', 1500);
}

function toggleFollow() {
  follow = !follow;
  btn.follow.setAttribute('aria-pressed', String(follow));
  toast(follow ? 'Camera follows Lennie' : 'Camera follow off', 1200);
}

function toggleCutaway() {
  cutaway = !cutaway;
  btn.cutaway.setAttribute('aria-pressed', String(cutaway));
  toast(cutaway ? 'Cutaway on: upper floors hide when you look down' : 'Cutaway off: whole house shown', 1600);
}

function toggleSlowmo() {
  timeScale = timeScale === 1 ? SLOWMO_SCALE : 1;
  btn.slowmo.setAttribute('aria-pressed', String(timeScale !== 1));
  toast(timeScale !== 1 ? 'Slow motion on' : 'Slow motion off', 1200);
}

function toggleSound() {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  btn.sound.setAttribute('aria-pressed', String(!sfx.muted));
}

btn.reset.addEventListener('click', resetAll);
btn.focus.addEventListener('click', () => focusLennie());
btn.follow.addEventListener('click', toggleFollow);
btn.cutaway.addEventListener('click', toggleCutaway);
btn.slowmo.addEventListener('click', toggleSlowmo);
btn.sound.addEventListener('click', toggleSound);
// Drop menu
function setDropMenu(open) {
  ui.dropMenu.hidden = !open;
  btn.drop.setAttribute('aria-expanded', String(open));
  if (open) ui.dropMenu.querySelector('button')?.focus({ preventScroll: true });
}
btn.drop.addEventListener('click', () => setDropMenu(ui.dropMenu.hidden));
ui.dropMenu.querySelectorAll('[data-drop]').forEach((b) => {
  b.addEventListener('click', () => {
    const level = Number(b.dataset.drop);
    setDropMenu(false);
    dropLennie(level);
    toast(`Lennie dropped on ${LEVEL_NAMES[level]}`, 1200);
  });
});
document.addEventListener('pointerdown', (e) => {
  if (!ui.dropMenu.hidden && !ui.dropMenu.contains(e.target) && !btn.drop.contains(e.target)) setDropMenu(false);
});

// Help: shown on the first visit, then on demand.
const HELP_SEEN_KEY = 'toss-the-lennie:help-seen';
function setHelp(open) {
  ui.help.hidden = !open;
  btn.help.setAttribute('aria-expanded', String(open));
  if (open) ui.helpClose.focus({ preventScroll: true });
  else {
    try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch { /* ignore */ }
  }
}
btn.help.addEventListener('click', () => setHelp(ui.help.hidden));
ui.helpClose.addEventListener('click', () => setHelp(false));
{
  let seen = false;
  try { seen = localStorage.getItem(HELP_SEEN_KEY) === '1'; } catch { /* ignore */ }
  if (!seen) setHelp(true);
}

// Toolbar buttons shouldn't keep keyboard focus after a click, so Space/keys
// keep driving the game rather than re-pressing the button.
document.querySelectorAll('#toolbar .icon-btn').forEach((b) => b.addEventListener('click', () => b.blur()));

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (MOVE_KEYS.has(e.code)) {
    keys.add(e.code);
    e.preventDefault();
    return;
  }
  if (e.repeat) return;
  if (e.code === 'Escape') {
    setDropMenu(false);
    if (!ui.help.hidden) setHelp(false);
    return;
  }
  switch (e.code) {
    case 'KeyR': resetAll(); break;
    case 'KeyF': focusLennie(); break;
    case 'KeyG': toggleFollow(); break;
    case 'KeyC': toggleCutaway(); break;
    case 'KeyZ': toggleSlowmo(); break;
    case 'KeyM': toggleSound(); break;
    case 'KeyH': setHelp(ui.help.hidden); break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': {
      const level = Number(e.code.slice(-1)) - 1;
      dropLennie(level);
      toast(`Lennie dropped on ${LEVEL_NAMES[level]}`, 1200);
      break;
    }
    default: return;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- HUD per frame
let meter = 0;
let hudAt = 0;
function updateHud(dt, now) {
  const c = measureContortion(lennie);
  meter += (c.percent - meter) * (1 - Math.exp(-dt * 8));
  ui.meterFill.style.width = `${meter.toFixed(1)}%`;

  if (countUp) {
    countUp.t += dt;
    const k = Math.min(1, countUp.t / countUp.dur);
    ui.rTotal.textContent = fmt(countUp.to * (1 - (1 - k) ** 3));
    if (k >= 1) countUp = null;
  }

  if (now - hudAt < 100) return;
  hudAt = now;
  ui.meterValue.textContent = `${Math.round(meter)}%`;

  const mult = chainMultiplier(toss);
  const combo = mult > 1 ? ` · <b>×${mult.toFixed(2)}</b>` : '';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let status;
  if (toss.state === 'held') {
    status = `Holding Lennie's <b>${grab?.part.label ?? 'limb'}</b>. Flick and let go!${combo}`;
  } else if (toss.state === 'flying') {
    const bits = [plural(toss.bounces, 'bounce')];
    if (toss.juggles) bits.push(plural(toss.juggles, 'juggle'));
    if (toss.smashed) bits.push(plural(toss.smashed, 'window'));
    if (toss.doors) bits.push(plural(toss.doors, 'door'));
    if (toss.stairs.size) bits.push(plural(toss.stairs.size, 'step'));
    status = `Flying! ${bits.join(' · ')}${combo}`;
  } else {
    const where = house.locate(lennie.center(_center));
    const place = `<b>${where[0].toUpperCase()}${where.slice(1)}</b>`;
    status = toss.state === 'scored' ? `Scored! Landed ${where}.` : `${place} · grab a limb and fling!`;
  }
  if (ui.status.innerHTML !== status) ui.status.innerHTML = status;
}

// ---------------------------------------------------------------- main loop
let acc = 0;
let last = performance.now();
const bodies = lennie.bodies;

function stepPhysics(h) {
  // Fast-moving limbs get smaller steps so they don't sink deep into walls.
  const n = lennie.maxSpeed() > FAST_SUBSTEP_SPEED ? 2 : 1;
  for (let i = 0; i < n; i++) subStep(h / n);
}

function subStep(h) {
  if (grab) {
    const hp = handBody.position;
    const v = new CANNON.Vec3((grab.target.x - hp.x) / h, (grab.target.y - hp.y) / h, (grab.target.z - hp.z) / h);
    const sp = v.length();
    if (sp > MAX_HAND_SPEED) v.scale(MAX_HAND_SPEED / sp, v);
    handBody.velocity.copy(v);
  }
  bodies.forEach((b, i) => preStep[i].copy(b.velocity));
  world.step(h);
  if (pendingBreaks.size) {
    // Lennie crashes through: undo this step's bounce, minus a little drag
    // (more for a door).
    const keep = [...pendingBreaks].some((p) => p.kind === 'door') ? 0.65 : 0.8;
    bodies.forEach((b, i) => preStep[i].scale(keep, b.velocity));
    for (const piece of pendingBreaks) smash(piece);
    pendingBreaks.clear();
  }
  if (guard.check() === 'lost') rescueLost();
}

// Last resort when Lennie is stuck in the scenery with no good pose to go back to.
function rescueLost() {
  const level = Math.min(2, house.levelOf(lennie.center(_center)));
  dropLennie(level);
  toast(`Lennie got stuck, so he's back on floor ${level + 1}`, 1800);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  tick(dt, now);
}

function tick(dt, now) {
  acc += dt;
  let steps = 0;
  while (acc >= FIXED_DT && steps < 12) {
    stepPhysics(FIXED_DT * timeScale);
    acc -= FIXED_DT;
    steps++;
  }
  if (steps === 12) acc = 0;

  lennie.sync();
  lennie.update(dt);
  updateToss(dt * timeScale);
  updateGrabVisual();
  updateCamera(dt);
  house.updateView(camera, controls.target, dt, cutaway);
  updateShards(dt * timeScale);
  updateHud(dt, now);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Handy for debugging from the console. advance() runs the game loop by hand,
// e.g. when the tab is in the background and requestAnimationFrame is paused.
window.lennie = {
  lennie, world, camera, controls, toss, stats, house, guard,
  advance(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60, performance.now());
  },
};
