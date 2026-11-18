import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHouse, HOUSE } from './house.js';
import { buildYard, YARD } from './yard.js';
import { STREET } from './streetscape.js';
import { Ragdoll, FEEL } from './ragdoll.js';
import { measureContortion, evaluateToss, chainMultiplier } from './scoring.js';
import { Sfx } from './audio.js';
import { StuckGuard } from './guard.js';
import { Replay } from './replay.js';
import { Zap } from './zap.js';
import { Effects } from './effects.js';
import { createTrolley } from './trolley.js';
import { createCars } from './cars.js';
import { createCat } from './cat.js';
import { Challenges, CHALLENGES, CHALLENGE_BONUS } from './challenges.js';
import { createSeeThrough } from './seethrough.js';
import { setSimpleShading, simpleShading } from './shading.js';
import { combineScenery, prewarmFades } from './batching.js';
import { bakeStocks } from './products.js';
import { pictureCount, sizeOf } from './pictures.js';
import { sceneryParts, reportFlicker } from './flickercheck.js';
import { createBlobShadow } from './blobshadow.js';
import { tunePhysics } from './broadphase.js';
import { CURSORS } from './cursors.js';
import { t, fmt, fixed, lang, setLang, onLangChange } from './i18n.js';

const FIXED_DT = 1 / 120;
// Physics may take this long per frame (ms). A slow device that can't keep up
// then plays a bit slower instead of catching up with ever more steps, which
// made each frame slower still until the game ran at a few frames a second.
const PHYSICS_BUDGET = 16;
// Scales with Lennie's weight (100 kg), so he swings the same however heavy he is.
const GRAB_FORCE = 7300;
const MAX_HAND_SPEED = 20;
const THROW_BOOST = 0.4; // fraction of the flick velocity added to the whole body on release
const MAX_PART_SPEED = 20; // capped so Lennie can't tunnel through walls
const FAST_SUBSTEP_SPEED = 5; // above this, physics takes two half steps per tick
// He has come to rest when his body is still and his arms and legs at most
// drift a little, for SETTLE_TIME. (Waiting for every limb to be dead still
// left him lying there for seconds, twitching, before the score came.)
const SETTLE_CORE_SPEED = 0.15;
const SETTLE_LIMB_SPEED = 0.6;
const SETTLE_TIME = 0.5;
const MAX_TOSS_TIME = 14;
const MIN_TOSS_SPEED = 3.5;
const FLING_SHARE = 0.85; // how much of the top speed he reaches in flight counts as "thrown this hard"
const BOUNCE_IMPACT = 4;
const GLASS_BREAK_SPEED = 4.5;
// Doors are a bit tougher: a hard hit breaks one at once, a window-breaking
// hit only cracks it, and the next such knock (a moment later) finishes it.
const DOOR_BREAK_SPEED = 7;
const DOOR_CRACK_SPEED = GLASS_BREAK_SPEED;
// Hitting the TV this hard cracks its screen and gives Lennie a shock; once
// it's cracked, bumping into it at least ZAP_SPEED shocks him again. A real
// bump, not his own twitching against it, and only a few shocks per toss,
// or a Lennie lying against the TV would never stop being zapped.
const TV_CRACK_SPEED = GLASS_BREAK_SPEED;
const ZAP_SPEED = 3;
const ZAP_COOLDOWN = 1800; // ms after a shock ends before the next one
const MAX_ZAPS = 3;
// Hitting a supermarket shelf at least this hard knocks products off it.
const SHELF_KNOCK_SPEED = 3.5;
// Landing at least this hard among the mess in the house (dishes, toys,
// clothes) sends it flying.
const CLUTTER_KNOCK_SPEED = 2.5;
const SLOWMO_SCALE = 0.25;
const CAMERA_SPEED = 6;
const GRAVITY = 9.82;
const AIM_MAX_SPEED = MAX_PART_SPEED - 2; // leaves room for the somersault spin
const AIM_MIN_SPEED = 6; // short throws become line drives rather than limp lobs
const AIM_MIN_IMPACT = DOOR_BREAK_SPEED + 1.5; // aimed at a wall, he hits it at least this hard
// Aimed at a door or window that's still whole, he goes through it and on for
// a few metres, rather than dropping in the doorway: he's thrown at it this
// hard (so it smashes whichever limb hits first), and crashing through it
// leaves him this much of his speed (a door or window in his way by chance
// slows him more, see subStep).
const THROUGH_IMPACT = DOOR_BREAK_SPEED + 6;
const THROUGH_KEEP = 0.9;
const DOOR_AIM_LOW = 0.8; // aimed at a door, he goes for no lower than this above its foot
// For this long after an aimed launch the "hand" keeps his centre on the arc,
// while he peels off the floor (his limbs and joints tugging against it would
// knock him off course); then he's on his own and starts his somersault.
const AIM_GUIDE_TIME = 0.12;
const AIM_LOFT = { start: 0.9, min: 0.1, max: 8, step: 0.3 }; // arc top, metres above the higher end
const AIM_CLICK_PX = 6; // a press that moves further than this orbits the camera instead of throwing
const SOFT = new Set(['cushion', 'leaves', 'trampoline', 'trash']);
const AIM_TAP_PX = 44; // on a touch screen, a second tap this close to the first one throws
// The slingshot: grab Lennie and pull back, away from where he should go.
const SLING = {
  dead: 18, // px: a shorter pull than this (or letting go back on Lennie) throws nothing
  reach: 0.33, // a pull this long, as a share of the screen's shorter side, is full power
  minDistance: 2, // m he goes (on level ground) at the shortest pull
  maxDistance: 30, // and at full power, as long as the arc isn't too flat or steep for it
  minSpeed: 4.5, // m/s at the gentlest throw (still enough to score)
  maxSpeed: AIM_MAX_SPEED,
  stretch: 0.35, // m: how far the held limb gives towards the pointer while pulling
  arcTime: 4, // s of flight shown in the preview
};
const SLING_ANGLE = { start: 35, min: 5, max: 80, step: 5 }; // launch angle above level, degrees
// From this score a toss gets confetti and a "Big toss!" sticker. About one toss in six gets there
// (in 60 test tosses from all over the map); at 1,500 it was nearly one in three, and no longer special.
const BIG_TOSS = 2000;
const TOSS_CHOICES = [5, 10, 15, 20]; // tosses each in a game of turns
const PLAYER_COLORS = ['#ff6b4a', '#3f5fd6', '#22a06b', '#b04ad6'];

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- renderer
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Sharpness: phones and tablets have 2-3 screen pixels per CSS pixel. 1.5
// looks nearly as sharp and is far less work. If the game still runs slowly,
// watchSpeed() goes down this list a step at a time: less sharp first, then
// the scenery without its shine (shading.js), then less sharp again. (The
// shine goes before the last bit of sharpness: at 0.75 everything is blurry,
// which shows much more.)
const QUALITY = [
  { sharpness: 1.5, simple: false },
  { sharpness: 1.25, simple: false },
  { sharpness: 1, simple: false },
  { sharpness: 1, simple: true },
  { sharpness: 0.75, simple: true },
];
const FIRST_SIMPLE = QUALITY.findIndex((q) => q.simple);
// A device that had to step down last time starts one step above where it
// ended up, rather than at the top again: at full sharpness a budget tablet
// managed 11 frames a second, and spent the first twenty seconds or so of
// every visit stepping down from it. (One step above, so a device that was only slow for a moment
// last time, with something else running, gets back up over a few visits.
// Not from simple shading to full, though: switching shading while the game
// runs stalls it for a moment, and a device that needs the simple one would
// get that stall on every visit. It only gets the shine back after running
// really fast without it.)
const QUALITY_KEY = 'toss-the-lennie:quality';
function rememberQuality(level) {
  try { localStorage.setItem(QUALITY_KEY, String(level)); } catch { /* storage unavailable */ }
}
let quality = 0;
try {
  const was = Number(localStorage.getItem(QUALITY_KEY));
  if (Number.isInteger(was) && was > 0 && was < QUALITY.length) quality = was === FIRST_SIMPLE ? was : was - 1;
} catch { /* storage unavailable */ }
const sharpnessOf = (q) => Math.min(window.devicePixelRatio, q.sharpness);
setSimpleShading(QUALITY[quality].simple);
renderer.setPixelRatio(sharpnessOf(QUALITY[quality]));
renderer.setSize(innerWidth, innerHeight);
const SLOW_FRAME = 1 / 28; // seconds: slower than about 28 frames a second on average is too slow
const CRAWL_FRAME = 1 / 16; // slower than this, it goes down two steps at once
const FAST_FRAME = 1 / 50; // this fast with simple shading, and the next visit gets the full shading again
const speed = { wait: 3, frames: 0, time: 0, good: 0, fast: 0 }; // wait: seconds before measuring (the first frames are slow anyway)

/** On a device that can't keep up, draws the picture a bit less sharp or less shiny (it never goes back up during a visit). */
function watchSpeed(seconds) {
  if (document.hidden || seconds > 0.25) return; // a tab switch or a hiccup, not the game being slow
  if (speed.wait > 0) {
    speed.wait -= seconds;
    return;
  }
  speed.frames++;
  speed.time += seconds;
  // (90 frames, or 2 seconds' worth on a device so slow that 90 frames take much longer)
  if (speed.frames < 90 && (speed.time < 2 || speed.frames < 20)) return;
  const frame = speed.time / speed.frames;
  speed.frames = speed.time = 0;
  if (frame <= SLOW_FRAME) {
    // Keeping up for a good while like this: that's where the next visit may start from.
    if (frame <= FAST_FRAME) speed.fast++;
    if (++speed.good === 10) rememberQuality(QUALITY[quality].simple && speed.fast === 10 ? FIRST_SIMPLE - 1 : quality);
    return;
  }
  speed.good = speed.fast = 0;
  if (quality === QUALITY.length - 1) return;
  const was = QUALITY[quality];
  for (let steps = frame > CRAWL_FRAME ? 2 : 1; steps > 0 && quality < QUALITY.length - 1; steps--) {
    // (on a screen with one pixel per CSS pixel the first steps change nothing: skip those)
    const from = QUALITY[quality];
    do quality++; while (quality < QUALITY.length - 1 && QUALITY[quality].simple === from.simple && sharpnessOf(QUALITY[quality]) === sharpnessOf(from));
  }
  const now = QUALITY[quality];
  if (sharpnessOf(now) < sharpnessOf(was)) {
    renderer.setPixelRatio(sharpnessOf(now));
    renderer.setSize(innerWidth, innerHeight);
  }
  setSimpleShading(now.simple, scene);
  rememberQuality(quality);
  speed.wait = now.simple !== was.simple ? 4 : 1; // (the new shading's programs are built in the first frames after the switch)
}

/** For measuring (scripts/tablet): puts the game at one step of QUALITY and keeps it there for the rest of the visit. */
function holdQuality(level) {
  quality = clamp(level, 0, QUALITY.length - 1);
  renderer.setPixelRatio(sharpnessOf(QUALITY[quality]));
  renderer.setSize(innerWidth, innerHeight);
  setSimpleShading(QUALITY[quality].simple, scene);
  speed.wait = Infinity;
  return QUALITY[quality];
}
// Solid scenery is drawn in the order of its shader programs (then its
// materials, as three.js does by itself): a few dozen programs are shared by
// hundreds of materials, and each switch from one to the next has the graphics
// driver set up the camera and the lights again. In material order alone that
// was 175 switches a frame; this way it's one per program.
const programOf = (material) => {
  if (material.programFrame !== renderer.info.render.frame) {
    material.programFrame = renderer.info.render.frame;
    material.programId = renderer.properties.get(material).currentProgram?.id ?? 0;
  }
  return material.programId;
};
renderer.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder
  || programOf(a.material) - programOf(b.material) || a.material.id - b.material.id || a.z - b.z || a.id - b.id);
// No real shadows: they made every frame several times more work, too much
// for low-end tablets. Lennie gets a soft spot under him instead (blobshadow.js).
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe3f2ff);

// Near: how close to the lens anything is drawn. Keep it as far out as
// possible: the graphics chip tells what's in front by depth, and its
// precision everywhere scales with this number, so 20 cm tells surfaces apart
// 4x better than 5 cm did (fewer flickering spots, see flickercheck.js).
// Nothing is lost: the see-through effect already cuts away scenery within
// 45 cm of the lens (seethrough.js), and the camera stays 80 cm from Lennie.
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.2, 400);
// The home view: from the front of the living room, high up, over the whole
// room to Lennie sitting in the comfy chair with the garden window behind him,
// so a pull straight down sends him out into the garden. The game starts here,
// and R and each new turn come back to it, so every player starts the same way.
const HOME_CAM = new THREE.Vector3(0.7, 2.4, 0.9);
const HOME_TARGET = new THREE.Vector3(0.25, 0.69, -3.98); // Lennie's middle as he sits (house.homeSeat)
camera.position.copy(HOME_CAM);

// ---------------------------------------------------------------- physics
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
world.solver.iterations = 20;
// The world is some 500 boxes that never move and only Lennie (and what he
// knocks over) does, so the physics only looks at the scenery near him (broadphase.js).
tunePhysics(world);

const lennieMat = new CANNON.Material('lennie');
const physMats = {
  hard: new CANNON.Material('hard'),
  soft: new CANNON.Material('soft'),
  glass: new CANNON.Material('glass'),
  trampoline: new CANNON.Material('trampoline'),
  ground: new CANNON.Material('ground'),
  loose: new CANNON.Material('loose'), // furniture Lennie knocks over (loose.js)
  car: new CANNON.Material('car'), // the cars driving by (cars.js)
  branches: new CANNON.Material('branches'), // the garden tree's crown, which catches him (garden.js)
  roof: new CANNON.Material('roof'), // the row's sloping roof tiles and gutters: rough, so he can stay up there
};
const contact = (m, friction, restitution) => world.addContactMaterial(new CANNON.ContactMaterial(m, lennieMat, { friction, restitution }));
contact(physMats.hard, 0.55, 0.3);
contact(physMats.soft, 0.5, 0.75);
contact(physMats.glass, 0.3, 0.15);
contact(physMats.trampoline, 0.5, 0.97);
contact(physMats.ground, 0.8, 0.2);
contact(lennieMat, 0.4, 0.05);
contact(physMats.loose, 0.55, 0.3);
contact(physMats.car, 0.3, 0.35);
contact(physMats.branches, 1.2, 0.02);
contact(physMats.roof, 0.9, 0.15);
// The knocked-over chairs on the floor, the walls and each other: grippy and
// not bouncy, so they tip over and stay put rather than skating about.
for (const m of Object.values(physMats)) {
  world.addContactMaterial(new CANNON.ContactMaterial(physMats.loose, m, { friction: 0.6, restitution: 0.1 }));
}

const { shop } = buildYard(scene, world, physMats);
const house = buildHouse(scene, world, physMats);
const cars = createCars(scene, world, physMats.car);
const trolley = createTrolley(scene, world, physMats.hard);
const lennie = new Ragdoll(world, scene, lennieMat);
// A little shove so he flops over instead of landing on his feet.
function nudge() {
  const chest = lennie.parts.chest.body;
  chest.velocity.x += (Math.random() - 0.5) * 2;
  chest.velocity.z += (Math.random() - 0.5) * 2;
}
lennie.sit(house.homeSeat);

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
  rBadge: $('r-badge'),
  rLines: $('r-lines'),
  rFoot: $('r-foot'),
  toast: $('toast'),
  pops: $('pops'),
  help: $('help'),
  helpClose: $('help-close'),
  dropMenu: $('drop-menu'),
  replayBtn: $('r-replay'),
  rClose: $('r-close'),
  replayBadge: $('replay-badge'),
  aimPad: $('aim-pad'),
  slingPower: $('sling-power'),
  slingFill: $('sling-fill'),
  hint: $('grab-hint'),
  hintText: $('grab-hint-text'),
  pull: $('pull-hint'),
  challenge: $('challenge'),
  chNum: $('ch-num'),
  chCount: $('ch-count'),
  chText: $('ch-text'),
  chSkip: $('ch-skip'),
  chOpen: $('ch-open'),
  chMenu: $('ch-menu'),
  chList: $('ch-list'),
  chDone: $('ch-done'),
  chProgress: $('ch-progress-fill'),
  board: $('board'),
  boardRound: $('board-round'),
  boardList: $('board-list'),
  boardEnd: $('board-end'),
  turnCard: $('turn-card'),
  turnKicker: $('turn-kicker'),
  turnTitle: $('turn-title'),
  turnSub: $('turn-sub'),
  turnRanking: $('turn-ranking'),
  turnGo: $('turn-go'),
  turnAlt: $('turn-alt'),
  setup: $('match-setup'),
  setupNames: $('setup-names'),
  setupStart: $('setup-start'),
  setupCancel: $('setup-cancel'),
};

// Touch screens get touch help and tap-to-aim; whichever was used last wins
// (some laptops have both).
document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches);
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' || e.pointerType === 'mouse') document.body.classList.toggle('touch', e.pointerType === 'touch');
}, { capture: true });

const replay = new Replay(lennie, [...house.loose.items, ...cars.items, trolley]);
const zap = new Zap(scene, lennie);
// The other special effects (effects.js): frozen in the freezer, a bath,
// hagelslag, the spin cycle, the hot hob, the brambles and the rest.
const effects = new Effects({
  scene, world, ragdoll: lennie, zap, sfx, trolley,
  spots: [...house.spots, ...shop.spots],
  places: shop.places,
  hooks: {
    pop: (position, text, cls) => popAt(position, text, cls),
    // counts towards this toss's bonus (houseBonuses)
    feat: (id) => { if (toss.state === 'flying' || toss.state === 'held') toss.fx.add(id); },
    free: () => !grab && !sling && !replay.playing,
    enabled: () => !replay.playing,
  },
});
// The family's cat (cat.js), wandering about the house and the back garden:
// toss Lennie near it and it attacks him.
const catRay = { from: new CANNON.Vec3(), to: new CANNON.Vec3(), hit: new CANNON.RaycastResult() };
const cat = createCat({
  scene, house, ragdoll: lennie, effects, sfx,
  hooks: {
    pop: (position, text, cls) => popAt(position, text, cls),
    feat: (id) => { if (toss.state === 'flying' || toss.state === 'held') toss.fx.add(id); },
    free: () => !grab && !sling && !replay.playing,
    enabled: () => !replay.playing,
    flying: () => toss.state === 'flying' && !grab && !sling,
    inside: (p) => house.isInside(p),
    cameraDistance: (p) => camera.position.distanceTo(p),
    /** True when no wall, door or furniture is between a and b. */
    clear(a, b) {
      catRay.from.set(a.x, a.y, a.z);
      catRay.to.set(b.x, b.y, b.z);
      catRay.hit.reset();
      return !world.raycastClosest(catRay.from, catRay.to, SCENERY_ONLY, catRay.hit);
    },
    /** The height of whatever is under p (the ground if nothing is). */
    ground(p) {
      catRay.from.set(p.x, p.y + 0.2, p.z);
      catRay.to.set(p.x, p.y - 30, p.z);
      catRay.hit.reset();
      return world.raycastClosest(catRay.from, catRay.to, SCENERY_ONLY, catRay.hit) ? catRay.hit.hitPointWorld.y : 0;
    },
  },
});
const challenges = new Challenges();
const hint = { on: true }; // the "Grab me!" bubble over Lennie, until he's first grabbed (and at each turn)
// On the first visit a hand over Lennie shows the pull (press, pull back, let
// go), over and over until his first toss. It's there in place of the help,
// which used to open at once: a page of text a child doesn't read. The help is
// still under the ? button.
const HELP_SEEN_KEY = 'toss-the-lennie:help-seen'; // (named for the help, which is what it used to remember)
const coach = { on: true };
try { coach.on = localStorage.getItem(HELP_SEEN_KEY) !== '1'; } catch { /* storage unavailable */ }

/** The words in the bubble over Lennie. */
function hintLabel() {
  const p = match && !matchOver() ? match.players[match.turn] : null;
  if (p) return t('{name}, grab me!', { name: p.name });
  return coach.on ? t('Pull me back, then let go!') : t('Grab me!');
}

/** The first toss is on its way: no more showing how. */
function endCoach() {
  coach.on = false;
  try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch { /* ignore */ }
  ui.hintText.textContent = hintLabel();
}

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

/** Replays a one-off CSS animation class on an element. */
function flash(el, cls) {
  el.classList.remove('done', 'picked');
  void el.offsetWidth;
  el.classList.add(cls);
}

let toastTimer = 0;
function toast(message, ms = 2200) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

// At most this many popup lines on screen at once: more piled up on top of each
// other and none of them could be read.
const MAX_POPS = 2;
// The score, the landing line, big crashes and price tags matter more than the chatter of a bump.
const popRank = (cls) => (cls === 'big' || cls === 'price' ? 2 : 1);
const shownPops = [];

function dropPop(pop, fade) {
  const i = shownPops.indexOf(pop);
  if (i < 0) return;
  shownPops.splice(i, 1);
  clearTimeout(pop.timer);
  if (!fade) return pop.el.remove();
  // A quick fade on top of the rising animation, so it doesn't just blink away.
  pop.el.animate({ opacity: [getComputedStyle(pop.el).opacity, 0] }, { duration: 180, fill: 'forwards' });
  setTimeout(() => pop.el.remove(), 200);
}

/** `rank` overrides how important the line is (see popRank). */
function popAt(position, text, cls = '', rank = popRank(cls)) {
  const v = new THREE.Vector3().copy(position).project(camera);
  if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
  // Screen full: a line that's no more important than the ones up there is skipped,
  // a more important one makes room by fading out the oldest less important line.
  if (shownPops.length >= MAX_POPS) {
    const weaker = shownPops.find((p) => p.rank < rank);
    if (!weaker) return;
    dropPop(weaker, true);
  }
  text = t(text);
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.textContent = text;
  el.style.setProperty('--rot', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
  // Short shouts ("BOING!") flash by; longer lines ("Crunchy or smooth?") stay up long enough to read.
  const ms = Math.min(4000, 1400 + 120 * Math.max(0, text.length - 6));
  el.style.setProperty('--dur', `${ms}ms`);
  ui.pops.appendChild(el);
  // Keep it on screen: near the edge, or on a phone, a long line ran off the side.
  // (Room for the 1.15× pop and the tilt.)
  const room = innerWidth / 1.15 - 24;
  let w = el.offsetWidth;
  if (w > room) {
    el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * room) / w}px`;
    w = room;
  }
  const h = el.offsetHeight;
  const x = clamp((v.x * 0.5 + 0.5) * innerWidth, 12 + w * 0.6, innerWidth - 12 - w * 0.6);
  let y = (-v.y * 0.5 + 0.5) * innerHeight;
  // Landing on top of a line that's still up: go just below it (that one floats up and away).
  for (const p of shownPops) {
    if (Math.abs(p.x - x) < (p.w + w) * 0.55 && Math.abs(p.y - y) < (p.h + h) * 0.7) y = p.y + (p.h + h) * 0.7;
  }
  // Not on top of the score card, where it lies across the screen (a phone held upright): just below it.
  if (ui.result.classList.contains('show') && resultOverMiddle()) y = Math.max(y, ui.result.offsetTop + ui.result.offsetHeight + h * 0.7);
  y = Math.min(y, innerHeight - h);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const pop = { el, rank, x, y, w, h };
  pop.timer = setTimeout(() => dropPop(pop, false), ms + 100);
  shownPops.push(pop);
}

const CONFETTI = ['#ff6b4a', '#3f5fd6', '#22a06b', '#ffd166', '#d63384', '#4cc9f0'];
/** A short burst of confetti from a point in the scene; `gold` adds gold and makes it bigger. */
function confettiAt(position, gold = false) {
  const v = new THREE.Vector3().copy(position).project(camera);
  if (v.z > 1) return;
  const x = THREE.MathUtils.clamp((v.x * 0.5 + 0.5) * innerWidth, 0, innerWidth);
  const y = THREE.MathUtils.clamp((-v.y * 0.5 + 0.5) * innerHeight, 0, innerHeight);
  confettiFrom(x, y, gold ? [...CONFETTI, '#f5b301', '#f5b301', '#ffe08a'] : CONFETTI, gold ? 56 : 30, gold);
}

/** A burst of `n` bits of confetti in `colors` from a point on the screen; `big` throws them further. */
function confettiFrom(x, y, colors, n, big = false) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2; // mostly upwards
    const power = (big ? 170 : 130) * (0.5 + Math.random());
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.background = colors[i % colors.length];
    el.style.setProperty('--dx', `${(Math.cos(angle) * power).toFixed(0)}px`);
    el.style.setProperty('--dy', `${(Math.sin(angle) * power).toFixed(0)}px`);
    el.style.setProperty('--fall', `${(120 + Math.random() * 140).toFixed(0)}px`);
    el.style.setProperty('--spin', `${(Math.random() * 1440 - 720).toFixed(0)}deg`);
    el.style.animationDelay = `${(Math.random() * 0.12).toFixed(2)}s`;
    if (i % 3 === 0) el.style.borderRadius = '50%';
    ui.pops.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }
}

let resultTimer = 0;
let countUp = null;
/** `cheer` is 'best' (a new best), 'big' (a big toss) or null. */
function showResult(result, where, cheer = null) {
  ui.rBadge.hidden = !cheer;
  ui.rBadge.textContent = t(cheer === 'best' ? 'New best!' : 'Big toss!');
  ui.rBadge.classList.toggle('best', cheer === 'best');
  // A good one invites a replay (it never plays by itself).
  ui.replayBtn.classList.toggle('invite', !!cheer);
  for (const el of [ui.rBadge, ui.replayBtn]) {
    // start the sticker and the glow over when two good tosses come in a row
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }
  ui.rTitle.textContent = t(`Toss #${stats.tosses}`);
  ui.rRating.textContent = result.rating;
  ui.rLines.innerHTML = '';
  result.lines.forEach((line, i) => {
    const li = document.createElement('li');
    if (line.trick) li.className = 'trick';
    if (line.mult) li.className = line.gentle ? 'mult gentle' : 'mult';
    li.style.animationDelay = `${0.15 + i * 0.12}s`;
    const a = document.createElement('span');
    a.textContent = line.label;
    const b = document.createElement('span');
    b.textContent = typeof line.value === 'number' ? `+${fmt(line.value)}` : line.value;
    li.append(a, b);
    ui.rLines.appendChild(li);
  });
  const deg = Math.round((result.worst.theta * 180) / Math.PI);
  ui.rFoot.textContent = t('Landed {where}. Most bent: {part} ({deg}°).', { where, part: t(result.worst.label).toLowerCase(), deg });
  ui.replayBtn.hidden = !replay.canPlay;
  countUp = { t: 0, dur: 0.9, to: result.total };
  ui.rTotal.textContent = '0';
  resultClosed = false;
  ui.result.classList.add('show');
  placeResult();
  clearTimeout(resultTimer);
  resultTimer = setTimeout(hideResult, 9000);
}

function hideResult() {
  ui.result.classList.remove('show');
  view.to = 0;
}

// The x on the card puts it away for this toss: it doesn't come back after a
// replay either (the next toss shows its own card again).
let resultClosed = false;
ui.rClose.addEventListener('click', () => {
  ui.rClose.blur();
  resultClosed = true;
  clearTimeout(resultTimer);
  hideResult();
});

// On a phone held upright the score card lies right across the screen, over the
// middle, which is where Lennie is: the card hid the pose it was scoring. So the
// card goes straight under the score and the challenge (or the players' board,
// which is taller), and the whole picture slides down until Lennie lies in the
// middle of the free space below the card (updateViewShift). When the card
// goes, the picture slides back.
// Where the card is comes from the page itself, not from the screen's size:
// style.css decides which layout a screen gets.
const view = { shift: 0, to: 0, set: 0 }; // px the picture is moved down: now, where it's heading, and as last given to the camera
const hudLeft = $('hud-left');
const meterBox = $('meter');

/** Is the score card lying over the middle of the screen (not beside it, as on a computer)? */
function resultOverMiddle() {
  const mid = innerWidth / 2;
  return ui.result.offsetLeft < mid && ui.result.offsetLeft + ui.result.offsetWidth > mid;
}

function placeResult() {
  view.to = 0;
  if (!ui.result.classList.contains('show')) return;
  ui.result.style.setProperty('--result-top', `${hudLeft.offsetTop + hudLeft.offsetHeight + 6}px`);
  if (!resultOverMiddle()) return;
  const top = ui.result.offsetTop + ui.result.offsetHeight;
  const bottom = Math.min(ui.aimPad.offsetTop, meterBox.offsetTop);
  view.to = clamp((top + bottom) / 2 - innerHeight / 2, 0, innerHeight * 0.3);
}

function updateViewShift(dt) {
  // (not while Lennie is held: the picture mustn't slide away under the finger that's pulling him)
  if (view.shift !== view.to && !grab && !sling) {
    view.shift += (view.to - view.shift) * (1 - Math.exp(-dt * 7));
    if (Math.abs(view.to - view.shift) < 0.5) view.shift = view.to;
  }
  const px = Math.round(view.shift);
  if (px === view.set) return;
  view.set = px;
  if (px) camera.setViewOffset(innerWidth, innerHeight, 0, -px, innerWidth, innerHeight);
  else camera.clearViewOffset();
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
  fling: 0, // how hard he was thrown, as a speed (m/s): a toss that never got going scores less (scoring.js)
  bounces: 0,
  juggles: 0,
  smashed: 0,
  doors: 0,
  tv: 0, // cracked the TV
  zaps: 0, // electric shocks from the cracked TV
  trampoline: 0,
  products: 0, // knocked off the supermarket's shelves
  mess: 0, // dishes, toys and clothes in the house sent flying
  games: 0, // board games knocked out of the closet
  toys: 0, // toys knocked out of the TV cabinet
  dishes: 0, // plates, mugs and glasses smashed
  cars: 0, // times a passing car sent him flying
  fx: new Set(), // special effects (effects.js): 'frozen', 'splash', 'trolley'...
  stairs: new Set(),
  startLevel: null,
  startInside: false,
};

function resetChain() {
  toss.fling = 0;
  toss.bounces = 0;
  toss.juggles = 0;
  toss.smashed = 0;
  toss.doors = 0;
  toss.tv = 0;
  toss.zaps = 0;
  toss.trampoline = 0;
  toss.products = 0;
  toss.mess = 0;
  toss.games = 0;
  toss.toys = 0;
  toss.dishes = 0;
  toss.cars = 0;
  toss.fx = new Set();
  toss.stairs = new Set();
  toss.startLevel = null;
  toss.startInside = false;
}

const _center = new THREE.Vector3();

const spots = [...house.spots, ...shop.spots];

// The landing spots found so far (kept in the browser): the first time Lennie
// comes to rest in one, the score card says so, so there's always a new one to hunt for.
// (Both beds are one spot, and so on: it's the ids that count.)
const SPOTS_KEY = 'toss-the-lennie:spots';
const ALL_SPOTS = new Set([...spots.map((s) => s.id), 'tree', 'bush', 'brambles', 'trampnap']);
const spotsFound = new Set();
try {
  for (const id of JSON.parse(localStorage.getItem(SPOTS_KEY) ?? '[]')) if (ALL_SPOTS.has(id)) spotsFound.add(id);
} catch { /* storage unavailable */ }

/** If this toss ended in a spot Lennie never landed in before: remembers it and returns the score card line. */
function newSpotLine(tricks) {
  const id = tricks.find((t) => ALL_SPOTS.has(t.id))?.id;
  if (!id || spotsFound.has(id)) return null;
  spotsFound.add(id);
  try { localStorage.setItem(SPOTS_KEY, JSON.stringify([...spotsFound])); } catch { /* ignore */ }
  return { label: t(`New spot found! ${spotsFound.size} of ${ALL_SPOTS.size}`), value: '★', trick: true };
}
// (a spot with a `when` only counts while that holds, like a freezer whose glass door is smashed)
const inBox = (p, s) => p.x > s.min[0] && p.x < s.max[0] && p.y > s.min[1] && p.y < s.max[1] && p.z > s.min[2] && p.z < s.max[2] && (!s.when || s.when());
/** The named spot (bath, bed, freezer...) Lennie's hips or chest ended up in, if any. */
function landingSpot() {
  const hips = lennie.parts.pelvis.body.position;
  const chest = lennie.parts.chest.body.position;
  return spots.find((s) => inBox(hips, s) || inBox(chest, s)) ?? null;
}

const lennieBodies = new Set(lennie.bodies);
/** The kinds of scenery Lennie is touching right now (from the last physics step). */
function touching() {
  const kinds = new Set();
  for (const c of world.contacts) {
    const other = lennieBodies.has(c.bi) ? c.bj : lennieBodies.has(c.bj) ? c.bi : null;
    if (other?.surface) kinds.add(other.surface.kind);
  }
  return kinds;
}

// A knocked-over chair or stool clattering onto the floor or into the table
// (Lennie bumping into one makes its sound in lennie.onCollide).
let lastChairKnockAt = 0;
house.loose.watch(lennie.parts.pelvis.body.position);
for (const { body } of house.loose.items) {
  body.addEventListener('collide', (e) => {
    if (lennieBodies.has(e.body)) return;
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    const now = performance.now();
    if (v < 1.5 || now - lastChairKnockAt < 70) return;
    lastChairKnockAt = now;
    sfx.impact('furniture', Math.min(1, v / 8));
  });
}

/**
 * Whether Lennie (his middle at `center`) is hanging out of a window: his middle
 * just outside the house, high up, or lower down (over a living room
 * windowsill) with part of him still indoors.
 */
function isHanging(center) {
  if (house.isInside(center) || house.isOnRoof(center) || !house.nearHouse(center)) return false;
  return center.y > 1.5 || (center.y > 0.5 && lennie.bodies.some((b) => house.isInside(b.position)));
}

// The special effects' bonuses (effects.js), each once a toss.
const FX_BONUSES = [
  ['frozen', 'Frozen solid!', 400],
  ['splash', 'Splash!', 150],
  ['hagelslag', 'Hagelslag shower!', 300],
  ['spin', 'Spin cycle!', 350],
  ['hotplate', 'Hot seat!', 300],
  ['piano', 'Piano crash!', 200],
  ['pillow', 'Pillow burst!', 250],
  ['stink', 'Stinky Lennie!', 200],
  ['paint', 'Paint job!', 300],
  ['sticky', 'Sticky Lennie!', 250],
  ['stuck', 'Stuck to the wall!', 300],
  ['sint', 'Sinterklaas hat!', 300],
  ['lamp', 'Bonked a lamp post!', 300],
  ['trolley', 'Trolley ride!', 500],
  ['scratched', 'Scratched by brambles!', 200],
  ['cat', 'Cat attack!', 350],
];

/** The feats of a toss, each with an id that challenges can look for. */
function houseBonuses(center) {
  const bonuses = [];
  const add = (id, label, value, say) => bonuses.push({ id, label, value, say });
  const endInside = house.isInside(center);
  const onRoof = house.isOnRoof(center);
  const endLevel = house.levelOf(center);
  const hanging = isHanging(center);
  if (toss.startInside && hanging) add('hanging', 'Hanging out the window!', 400);
  else if (toss.startInside && !endInside && !onRoof) add('defenestrated', 'Defenestrated!', 400);
  const fell = (toss.startLevel ?? 0) - endLevel;
  if (fell >= 1) add('fell', `Fell ${fell} floor${fell === 1 ? '' : 's'}`, 80 * fell);
  if (onRoof && toss.startLevel < 3) add('roof', 'Stranded on the roof!', 400);
  if (shop.isInside(center) && !toss.startInShop) add('shopping', 'Went shopping!', 500);
  else if (toss.startInShop && !shop.isInside(center) && !shop.isOnRoof(center)) add('shopout', 'Kicked out of the shop!', 400);
  if (shop.isOnRoof(center) && !toss.startOnShopRoof) add('shoproof', 'On the supermarket roof!', 600);
  if (toss.products >= 5) add('mess', `Knocked ${toss.products} products off the shelves`, Math.min(400, 10 * toss.products));
  if (toss.games >= 3) add('games', `Board game avalanche! (${toss.games} games)`, Math.min(500, 20 * toss.games));
  if (toss.toys >= 5) add('toys', `Toy avalanche! (${toss.toys} toys)`, Math.min(500, 8 * toss.toys));
  if (toss.mess >= 5) add('housemess', `Made the mess even worse (${toss.mess} things)`, Math.min(300, 6 * toss.mess));
  if (toss.dishes >= 3) add('dishes', `Smashed the dishes! (${toss.dishes} pieces)`, Math.min(400, 12 * toss.dishes));
  const steps = toss.stairs.size;
  if (steps >= 10) add('fullflight', `Full flight! (${steps} steps)`, 400);
  else if (steps >= 3) add('stairs', `Stair tumble (${steps} steps)`, 200);
  if (toss.tv) add('tv', 'Broke the TV!', 300);
  if (toss.zaps) {
    const n = Math.min(toss.zaps, 3);
    add('zapped', n > 1 ? `Electrocuted ×${n}` : 'Electrocuted!', 250 * n);
  }
  if (toss.cars) {
    const n = Math.min(toss.cars, 3);
    add('car', n > 1 ? `Hit by a car ×${n}` : 'Hit by a car!', 500 * n);
  }
  if (toss.trampoline) {
    const n = Math.min(toss.trampoline, 5);
    add('trampoline', n > 1 ? `Trampoline ×${n}` : 'Trampoline!', 80 * n);
  }
  for (const [id, label, value] of FX_BONUSES) if (toss.fx.has(id)) add(id, label, value);
  // Where he came to rest: a piece of furniture, a tree, a bush...
  const spot = landingSpot();
  const touched = touching();
  if (spot) add(spot.id, spot.label, spot.value, spot.say);
  else if (touched.has('bramble')) add('brambles', 'In the brambles!', 350, 'AUW!');
  else if (touched.has('leaves') && center.y > 2.2) add('tree', 'Stuck in a tree!', 500, 'HELP!');
  else if (touched.has('leaves')) add('bush', 'In the bushes', 150, 'RUSTLE!');
  else if (touched.has('trampoline')) add('trampnap', 'Napping on the trampoline', 200, 'ZZZ');
  return bonuses;
}

function finishToss() {
  if (toss.maxSpeed < MIN_TOSS_SPEED && !toss.smashed && !toss.doors && !toss.tv && !toss.zaps && !toss.cars && !toss.fx.size) {
    toss.state = 'idle';
    replay.stop(false);
    resetChain();
    toast(t('Too gentle! Give Lennie a proper fling.'));
    sfx.fizzle();
    return;
  }
  replay.stop(true);
  const center = lennie.center(_center);
  const chain = { bounces: toss.bounces, juggles: toss.juggles, smashed: toss.smashed, doors: toss.doors, trampoline: toss.trampoline, fling: toss.fling };
  const result = evaluateToss(lennie, { ...chain, bonuses: houseBonuses(center) });
  const found = newSpotLine(result.tricks);
  if (found) result.lines.push(found);

  // The challenge (free play only): a bonus on top when it's done. Other
  // challenges this toss happened to do are ticked off as well.
  const { done, also } = match ? { done: null, also: [] } : challenges.check({ total: result.total, ids: new Set(result.tricks.map((t) => t.id)), chain });
  if (done) {
    result.lines.push({ label: t('Challenge done!'), value: CHALLENGE_BONUS, trick: true });
    result.total += CHALLENGE_BONUS;
  }

  stats.total += result.total;
  stats.last = result.total;
  stats.tosses += 1;
  const newBest = result.total > stats.best;
  // (the very first toss ever beats a best of 0, which isn't worth a party)
  const beatBest = newBest && stats.best > 0;
  if (newBest) {
    stats.best = result.total;
    try { localStorage.setItem(BEST_KEY, String(stats.best)); } catch { /* ignore */ }
  }
  renderStats();
  bump(ui.total);
  if (beatBest) bump(ui.best);
  const cheer = beatBest ? 'best' : result.total >= BIG_TOSS ? 'big' : null;
  showResult(result, sayWhere(center), cheer);
  sfx.score(result.total >= BIG_TOSS ? 3 : result.total > 1000 ? 2 : result.total > 500 ? 1 : 0);
  sfx.voice(result.total >= 900 ? 'land' : 'grunt');
  // A good toss leaves him seeing stars until he's picked up again.
  if (result.total >= 400 || toss.bounces >= 5) lennie.setExpression('dizzy');
  else lennie.setExpression('ouch', 4);
  const head = lennie.parts.head.body.position;
  popAt(new THREE.Vector3(head.x, head.y + 0.4, head.z), `+${fmt(result.total)}`, 'big');
  if (cheer) {
    confettiAt(lennie.center(new THREE.Vector3()), cheer === 'best');
    if (cheer === 'best') setTimeout(() => sfx.chime(), 550);
  }
  const said = result.tricks.find((t) => t.say);
  if (said) setTimeout(() => popAt(new THREE.Vector3(head.x, head.y + 0.9, head.z), said.say, 'good', 2), 450);
  focusLennie(1.0);
  toss.state = 'scored';
  resetChain();

  if (done || also.length) challengeDone(done, also);
  if (match) {
    recordTurn(result.total);
    turnPending = true;
    clearTimeout(turnTimer);
    turnTimer = setTimeout(showTurnCard, 2400);
  }
}
let turnTimer = 0;
let turnPending = false; // a match turn has ended and the next player hasn't pressed Go yet

function updateToss(simDt) {
  if (toss.state !== 'flying') return;
  toss.time += simDt;
  toss.maxSpeed = Math.max(toss.maxSpeed, lennie.coreSpeed());
  // (a long fall, a car or a flick in mid-air count as a fling too; the bit of
  // speed he picks up toppling over after the gentlest throw doesn't)
  toss.fling = Math.max(toss.fling, FLING_SHARE * toss.maxSpeed);
  if (lennie.coreSpeed() < SETTLE_CORE_SPEED && lennie.maxSpeed() < SETTLE_LIMB_SPEED) toss.settle += simDt;
  else toss.settle = 0;
  if ((toss.time > 0.6 && toss.settle > SETTLE_TIME) || toss.time > MAX_TOSS_TIME) finishToss();
}

// ---------------------------------------------------------------- collisions & breaking glass and doors
let lastSoundAt = 0;
// What pops up at a hard bump: these shouts, mixed with lines for what he hit
// and for his head when that's what took the hit (bumpLine).
const EXCLAIM = ['OOF!', 'BONK!', 'WHEE!', 'OUCH!', 'THUD!', 'OW!', 'YIKES!'];
const HEAD_BUMP = ['Ow, my head!', 'Seeing stars!', 'Headbutt!', 'Coconut!', 'There goes a brain cell!', 'Helmet next time!'];
const BUMP = {
  wall: ['Hello, wall!', 'Wall wins!', 'Splat!', 'Pancake!', 'Who put that wall there?'],
  floor: ['Floor kiss!', 'Belly flop!', 'Faceplant!', 'Flat as a pannenkoek!'],
  ground: ['Grass stains!', 'Faceplant!', 'Lawn dart!', 'Mud pie!'],
  street: ['Road rash!', 'Hello, pavement!', 'Mind the traffic!', 'Faceplant!'],
  stair: ['Mind the step!', 'Step by step!', 'Ba-dum-tss!', 'Stair-ific!'],
  furniture: ['Not the furniture!', 'Stubbed toe!', 'Sit down, Lennie!', 'Table manners!'],
  roof: ['Up on the roof!', 'Hello, pigeons!', 'Tile trouble!'],
  block: ['Sorry, neighbours!', 'Knock knock!', 'Ding dong!'],
  shed: ['Garage sale!', 'Full up!', 'Nobody parks in there!'],
  tree: ['Tree hugger!', 'Timber!', 'Branch manager!'],
  fence: ['De-fence-less!', 'Over the fence!'],
  window: ['Window shopping!', 'Nice view!'],
  door: ['Knock knock!', "Who's there?"],
  tv: ['Not the TV!', 'Channel surfing!', 'Off the air!', 'Screen time!'],
  // soft things don't hurt, so they get only their own lines
  cushion: ['Comfy!', 'Soft landing!', 'Pillow fight!', 'Ahh, cosy!'],
  leaves: ['Hedgehog!', 'Rustle rustle!', 'Leaf me alone!'],
  bike: ['Ring ring!', 'Flat tyre!', 'Bike pile-up!', 'Off his bike!'],
  moped: ['Vroom vroom!', 'Beep beep!', 'Helmet on!', 'Mind the paintwork!'],
  junk: ['Junk corner!', 'Out with the rubbish!', 'Bin day!', 'Recycled!'],
  trash: ['Bin bag!', 'Pee-yew!', 'Smells like Lennie!'],
  bramble: ['Thorny!', 'Prickly!', 'Into the brambles!'],
};
// The lawn (yard.js) runs on under the supermarket's and the house's floors and the street, so a
// hit on it sounds and says what's really there instead of grass.
function groundKind(point) {
  const where = locate(point);
  if (where === 'in the supermarket' || where.endsWith(')')) return 'floor'; // "in the kitchen (floor 1)"
  // the cycle path and the road (the verges along them are grass)
  const on = ([z0, z1]) => point.z >= z0 && point.z <= z1;
  if (on(STREET.cycle) || on(STREET.road)) return 'street';
  return 'ground';
}
function bumpLine(partName, kind, soft) {
  if (soft && BUMP[kind]) return pickLine(BUMP[kind]);
  return pickLine([...EXCLAIM, ...(partName === 'head' && !soft ? HEAD_BUMP : []), ...(BUMP[kind] ?? [])]);
}
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
  // Bumping into anything but a floor ends an aimed launch's steering, so it can't shove him through a wall.
  if (aim.guide && surf && Math.abs(e.contact.ni.y) < 0.7) aim.guide = null;

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
      sfx.impact('glass', Math.min(1, v / 16));
    }
    return;
  }
  if (surf.kind === 'car') {
    hitCar(surf.car, v, now);
    return;
  }
  if (surf.kind === 'tv') hitTV(surf.piece, e, v, now);
  if (v > 1) effects.onHit(partName, e.target, contactPoint(e), v, surf, e.contact.ni.y);
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
  // A shelf or fridge in the supermarket: the products near the impact tumble off.
  if (surf.onHit && v > SHELF_KNOCK_SPEED) knockProducts(surf, e, v);
  // The mess in the house around where he hits goes flying.
  if (v > CLUTTER_KNOCK_SPEED) knockClutter(e, v);
  if (v < 1.2) return;

  const strength = Math.min(1, v / 14);
  const soft = SOFT.has(surf.kind);
  const kind = surf.kind === 'ground' ? groundKind(contactPoint(e)) : surf.kind;
  if (now - lastSoundAt > 45) {
    lastSoundAt = now;
    sfx.impact(surf.sound ?? kind, strength);
  }

  const flying = toss.state === 'flying';
  if (flying && surf.kind === 'trampoline' && v > TRAMP_MIN_SPEED && Math.abs(e.contact.ni.y) > 0.7) trampHit = Math.max(trampHit, v);
  if (flying && surf.kind === 'stair' && v > 1.5 && !aim.lift) toss.stairs.add(surf.id); // (tumbling down, not carried up)
  if (flying && v > BOUNCE_IMPACT && now - toss.lastBounceAt > 250) {
    toss.bounces += 1;
    toss.lastBounceAt = now;
    const point = contactPoint(e);
    point.y += 0.5;
    if (surf.kind === 'trampoline') {
      toss.trampoline += 1;
      popAt(point, 'BOING!', 'good');
    } else if (v > 7) {
      popAt(point, bumpLine(partName, kind, soft));
    }
  }
  if (v > 7 && !soft) {
    lennie.setExpression('ouch', 0.7);
    if (flying && now - lastVoiceAt > 700) {
      lastVoiceAt = now;
      sfx.voice('hit');
    }
  } else if (flying && surf.kind === 'trampoline' && v > BOUNCE_IMPACT && now - lastVoiceAt > 700) {
    lastVoiceAt = now;
    sfx.voice('fly');
    lennie.setExpression('whee', 0.8);
  }
};
let lastVoiceAt = 0;

// The TV: a hard hit cracks the screen and electrocutes him; once it's
// broken, touching it shocks him again (zap.js does the fireworks).
const ZAP_LINES = ['BZZZZT!', 'Shocking!', 'Watt was that?!', 'Hair-raising!', 'Electrifying!', 'What a jolt!', 'Lights out!', 'Positively charged!'];
let zapEndedAt = -Infinity;
function hitTV(tv, e, v, now) {
  if (!tv.cracked) {
    if (v < TV_CRACK_SPEED) return;
    tv.crack(contactPoint(e));
    sfx.crash();
    popAt(tv.hole, 'CRACK!', 'big');
    if (toss.state === 'flying' || toss.state === 'held') toss.tv += 1;
  } else if (v < ZAP_SPEED || zap.active || now - zapEndedAt < ZAP_COOLDOWN || toss.zaps >= MAX_ZAPS) {
    return;
  }
  zap.start(tv.hole);
  zapEndedAt = now + 1400;
  sfx.zap(1.4);
  sfx.voice('zap');
  lastVoiceAt = now + 1000; // no ouches over the scream
  toss.zaps += 1;
  const head = lennie.parts.head.group.position;
  setTimeout(() => popAt(head.clone().setY(head.y + 0.5), pickLine(ZAP_LINES), 'good'), 250);
}

// A car driving by (cars.js): one that's moving sends him flying, up and
// along the road. The launch itself happens after the physics step (subStep).
const CAR_LINES = ['Look both ways!', 'Beep beep!', 'Speed bump!', 'Hitchhiker!', 'Use the zebra crossing!', 'Mind the car!', 'Vroom vroom!'];
const HONK_LINES = ['TOOT TOOT!', 'Move it, Lennie!', 'Out of the road!', 'TOOT!'];
let carHit = null;
function hitCar(car, v, now) {
  if (car.speed < 2 || now - car.hitAt < 800 || grab || sling) {
    // a car that's standing still is just something to bump into
    if (v > 1.5 && now - lastSoundAt > 60) {
      lastSoundAt = now;
      sfx.impact('metal', Math.min(1, v / 14));
    }
    return;
  }
  car.hitAt = now;
  carHit = car;
}

function launchByCar(car) {
  const c = lennie.center(_center);
  const side = Math.sign(c.z - car.z) || (Math.random() < 0.5 ? -1 : 1);
  const vx = car.dir * (car.speed * 1.3 + 2);
  const vy = 5 + Math.random() * 2;
  const vz = side * (1 + Math.random() * 1.5);
  const r = (a) => (Math.random() - 0.5) * 2 * a;
  for (const b of bodies) {
    b.velocity.set(vx + r(0.8), vy + r(0.8), vz + r(0.8));
    b.angularVelocity.set(r(9), r(9), r(9));
  }
  cars.hit(car);
  if (toss.state === 'flying') toss.cars += 1;
  sfx.impact('metal', 1);
  sfx.honk();
  sfx.voice('hit');
  lastVoiceAt = performance.now();
  lennie.setExpression('ouch', 1);
  popAt(c.setY(c.y + 0.8), pickLine(CAR_LINES), 'big');
}

// The trampoline: the springy contact alone only bounces the limb that lands
// on it while the rest of the floppy body drags it back down, so the whole of
// Lennie gets sent back up (after the physics step, subStep), nearly as fast
// as he came down. Each bounce is a bit lower, so he still comes to rest.
const TRAMP_MIN_SPEED = 3; // a slower landing just sinks in
const TRAMP_KEEP = 0.7; // share of the landing speed he goes back up with
const TRAMP_KICK = 0.5; // plus this, so a short drop still gets a real bounce
const TRAMP_MAX_UP = 12;
let trampHit = 0;
let trampLaunchAt = 0;

function launchByTrampoline(v) {
  const now = performance.now();
  if (now - trampLaunchAt < 200) return; // one launch per landing, not one per limb
  trampLaunchAt = now;
  const up = Math.min(TRAMP_MAX_UP, v * TRAMP_KEEP + TRAMP_KICK);
  for (const b of bodies) {
    if (b.velocity.y < up) b.velocity.y = up;
    // a little less sideways drift, so he tends to stay above the mat
    b.velocity.x *= 0.85;
    b.velocity.z *= 0.85;
  }
  lennie.fling(_flingUp.set(0, up, 0), 0.6);
}
const _flingUp = new THREE.Vector3();

let lastMessAt = 0;
let lastClatterAt = 0;
function knockProducts(surf, e, v) {
  const point = contactPoint(e);
  const n = surf.onHit(point, v, e.target.velocity);
  if (!n) return;
  if (toss.state === 'flying' || toss.state === 'held') toss[surf.tally ?? 'products'] += n;
  const now = performance.now();
  if (now - lastClatterAt > 150) {
    lastClatterAt = now;
    sfx.clatter(n);
  }
  if (n >= 4 && now - lastMessAt > 1500) {
    lastMessAt = now;
    popAt(point.setY(point.y + 0.4), pickLine(surf.mess), 'good');
  }
}

// A popup line, or one at random from a list; never the same one twice in a row.
let lastLine = '';
function pickLine(mess) {
  if (!Array.isArray(mess)) return mess ?? 'CLATTER!';
  const options = mess.length > 1 ? mess.filter((line) => line !== lastLine) : mess;
  lastLine = options[Math.floor(Math.random() * options.length)];
  return lastLine;
}

let lastScatterAt = 0;
function knockClutter(e, v) {
  const point = contactPoint(e);
  const { n, mess } = house.scatter(point, v, e.target.velocity);
  if (!n) return;
  if (toss.state === 'flying' || toss.state === 'held') toss.mess += n;
  const now = performance.now();
  if (now - lastClatterAt > 150) {
    lastClatterAt = now;
    sfx.clatter(Math.min(n, 6));
  }
  if (n >= 6 && now - lastScatterAt > 1500) {
    lastScatterAt = now;
    popAt(point.setY(point.y + 0.4), pickLine([...MESS_WORDS, ...(mess ?? [])]), 'good');
  }
}
// said anywhere in the house, mixed in with the lines for the room he's in (clutter.js)
const MESS_WORDS = ['CRASH!', 'WHAT A MESS!', 'OOPS!', 'KABOOM!'];

// Plates, mugs and glasses smashing on the counter or the floor (products.js).
const SMASH_LINES = ['SMASH!', 'Not the good plates!', "Who's doing the dishes now?", 'Smashing!', 'Plate-tectonics!', 'Break time!'];
let lastSmashAt = 0;
let lastSmashLineAt = 0;
function smashedDishes() {
  const { n, point } = house.takeSmashes();
  if (!n) return;
  if (toss.state === 'flying' || toss.state === 'held') toss.dishes += n;
  const now = performance.now();
  if (now - lastSmashAt > 60) {
    lastSmashAt = now;
    sfx.smash(n);
  }
  if (toss.dishes >= 4 && now - lastSmashLineAt > 2500) {
    lastSmashLineAt = now;
    popAt(point.clone().setY(point.y + 0.5), pickLine(SMASH_LINES), 'good');
  }
}

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
  // what was behind it, if it all came pouring out (the storage cupboard)
  const spilled = (piece.owner ?? house).breakPiece(piece);
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
    m.userData.noAim = true;
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
  if (spilled?.n) {
    if (toss.state === 'flying' || toss.state === 'held') toss.mess += spilled.n;
    sfx.clatter(Math.min(spilled.n, 6));
    lastMessAt = performance.now();
    popAt(piece.center.clone().setY(piece.center.y + 0.7).addScaledVector(piece.normal, 0.6 * travel), pickLine(spilled.mess), 'good');
  }
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
grabLine.userData.noAim = grabDot.userData.noAim = true;
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

/** Where a point is, in words: a room of the house, the supermarket, the street... */
function locate(p) {
  if (shop.isInside(p)) return 'in the supermarket';
  if (shop.isOnRoof(p)) return 'on the supermarket roof';
  if (isHanging(p)) return 'hanging out of a window';
  const where = house.locate(p);
  if (where === 'in the yard' && p.z > STREET.cycle[0] - 0.6) return p.z > STREET.road[0] && p.z < STREET.road[1] ? 'in the road' : 'in the street';
  return where;
}

/** locate(p) in the current language ("in the kitchen (floor 1)" is a room and a floor). */
function sayWhere(p) {
  const where = locate(p);
  const room = where.match(/^(.*) (\(floor \d\))$/);
  return room ? `${t(room[1])} ${t(room[2])}` : t(where);
}

function clampInWorld(v, margin) {
  const h = YARD.half - margin;
  v.x = clamp(v.x, -h, h);
  v.y = clamp(v.y, margin, 30);
  v.z = clamp(v.z, -h, YARD.front - margin);
  // Out of the blocked-off ground behind the row (yard.js): onto its nearest
  // open side. The block behind the garden comes last, so a corner ends up
  // pushed out of both.
  for (const r of YARD.out) {
    if (v.x <= r.x0 - margin || v.x >= r.x1 + margin || v.z <= r.z0 - margin || v.z >= r.z1 + margin) continue;
    const toLeft = r.x0 > -YARD.half ? v.x - (r.x0 - margin) : Infinity;
    const toRight = r.x1 < YARD.half ? r.x1 + margin - v.x : Infinity;
    const toFront = r.z1 + margin - v.z;
    const least = Math.min(toLeft, toRight, toFront);
    if (least === toFront) v.z = r.z1 + margin;
    else if (least === toLeft) v.x = r.x0 - margin;
    else v.x = r.x1 + margin;
  }
  return v;
}

function isAirborne() {
  return lennie.coreSpeed() > 2.5;
}

function startGrab(pick, pointerId, pointerType = 'mouse') {
  effects.grabbed();
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
    pointerType,
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p),
    target: p.clone(),
    samples: [{ t: performance.now(), p: p.clone() }],
  };

  if (toss.state === 'flying' && isAirborne()) {
    toss.juggles = Math.min(5, toss.juggles + 1);
    popAt(p, `JUGGLE ×${toss.juggles}`, 'good');
  } else {
    resetChain();
    markStart();
    replay.start();
  }
  toss.state = 'held';
  hint.on = false;
  hideResult();
  if (lennie.expression !== 'normal') lennie.setExpression('normal');
  sfx.grab();
  canvas.style.cursor = CURSORS.grabbing;
  grabLine.visible = grabDot.visible = true;
  hideAim();
  aim.guide = aim.through = aim.lift = null;
  camAnim = null;
}

const _from = new CANNON.Vec3();
const _to = new CANNON.Vec3();
const _rayHit = new CANNON.RaycastResult();
const SCENERY_ONLY = { collisionFilterMask: 1, skipBackfaces: true };

/**
 * The hand can't pass through walls, floors or ceilings: stops `hit` just short
 * of the first one between the held point and it. Otherwise the hand drags a
 * limb into the scenery and tears Lennie apart.
 */
function keepHandOut(hold, hit) {
  hold.part.body.pointToWorldFrame(hold.local, _from);
  _to.set(hit.x, hit.y, hit.z);
  _rayHit.reset();
  if (world.raycastClosest(_from, _to, SCENERY_ONLY, _rayHit)) {
    const p = _rayHit.hitPointWorld;
    const back = new THREE.Vector3(_from.x - p.x, _from.y - p.y, _from.z - p.z);
    const len = back.length();
    hit.set(p.x, p.y, p.z).addScaledVector(back.normalize(), Math.min(0.25, len));
  }
  return hit;
}

function moveGrab() {
  const hit = raycaster.ray.intersectPlane(grab.plane, new THREE.Vector3());
  if (!hit) return;
  clampInWorld(hit, 0.3);
  keepHandOut(grab, hit);
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
  if (speed > 9) {
    sfx.voice('fly');
    lennie.setExpression('whee', 1.2);
  }
  if (canvas.hasPointerCapture?.(grab.pointerId)) canvas.releasePointerCapture(grab.pointerId);
  // A finger doesn't hover: once it lets go it's no longer over Lennie.
  const lifted = grab.pointerType !== 'mouse';
  grab = null;
  if (lifted) setHover(null);
  beginFlight();
  grabLine.visible = grabDot.visible = false;
  canvas.style.cursor = idleCursor();
  controls.enabled = true;
}

// ---------------------------------------------------------------- slingshot
// Grab Lennie while he's down and pull back, away from where he should go: a
// dotted arc shows his flight while you pull, a longer pull throws further, and
// letting go sends him along the arc. Pulling down (towards you) throws him
// into the picture, pulling left throws him right. The scroll wheel or the Arc
// buttons make him fly higher or flatter without changing how far he goes.
let sling = null;
let slingAngle = SLING_ANGLE.start;

function startSling(pick, e) {
  // Still rolling from the last toss: that one ends here.
  if (toss.state === 'flying') finishToss();
  effects.grabbed();
  const part = lennie.parts[pick.name];
  const p = pick.hit.point;
  const local = part.body.pointToLocalFrame(new CANNON.Vec3(p.x, p.y, p.z));
  handBody.position.set(p.x, p.y, p.z);
  handBody.velocity.setZero();
  const constraint = new CANNON.PointToPointConstraint(part.body, local, handBody, new CANNON.Vec3(), GRAB_FORCE);
  world.addConstraint(constraint);
  sling = {
    part,
    local,
    constraint,
    pointerId: e.pointerId,
    pointerType: e.pointerType,
    x0: e.clientX,
    y0: e.clientY,
    x: e.clientX,
    y: e.clientY,
    anchor: p.clone(),
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), p),
    band: p.clone(), // the end of the rubber band, under the pointer
    target: p.clone(), // where the hand holds the limb
  };
  hint.on = false;
  hideResult();
  if (lennie.expression !== 'normal') lennie.setExpression('normal');
  sfx.grab();
  canvas.style.cursor = CURSORS.grabbing;
  grabLine.visible = grabDot.visible = true;
  hideAim();
  aim.pin = null;
  aim.guide = aim.through = aim.lift = null;
  camAnim = null;
}

function moveSling(e) {
  sling.x = e.clientX;
  sling.y = e.clientY;
  const hit = raycaster.ray.intersectPlane(sling.plane, new THREE.Vector3());
  if (!hit) return;
  sling.band.copy(hit);
  // The limb gives a little towards the pointer, so he leans into the pull.
  const pull = hit.sub(sling.anchor);
  if (pull.length() > SLING.stretch) pull.setLength(SLING.stretch);
  sling.target.copy(keepHandOut(sling, clampInWorld(pull.add(sling.anchor), 0.3)));
}

const _slFwd = new THREE.Vector3();
const _slUp = new THREE.Vector3();
const _slRight = new THREE.Vector3();

/** The launch the current pull gives: { v, power }, or null for a pull too short to throw. */
function slingShot(s = sling) {
  const dx = s.x - s.x0;
  const dy = s.y - s.y0;
  const len = Math.hypot(dx, dy);
  if (len < SLING.dead) return null;
  const full = SLING.reach * Math.min(innerWidth, innerHeight);
  const power = clamp((len - SLING.dead) / Math.max(1, full - SLING.dead), 0, 1);
  // "Into the screen" along the ground. Looking straight ahead that's where the
  // camera looks; looking down it's the top of the screen. Adding both, flattened,
  // works for every angle in between.
  camera.getWorldDirection(_slFwd).setY(0);
  _slUp.set(0, 1, 0).applyQuaternion(camera.quaternion).setY(0);
  _slFwd.add(_slUp).normalize();
  _slRight.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
  // Throw the opposite way to the pull.
  const dir = new THREE.Vector3().addScaledVector(_slFwd, dy / len).addScaledVector(_slRight, -dx / len).normalize();
  // The pull sets how far he goes (measured on level ground) and the Arc only
  // how high he goes on the way, so a higher arc lands him just as far away.
  // (Squared, so short pulls give fine control indoors.)
  const distance = THREE.MathUtils.lerp(SLING.minDistance, SLING.maxDistance, power * power);
  const a = THREE.MathUtils.degToRad(slingAngle);
  const v = launchAtAngle(dir, distance, a);
  // Very flat or very steep arcs can't reach as far: then it's his fastest throw at that angle.
  const speed = v.length();
  const maxed = speed > SLING.maxSpeed;
  if (maxed) v.setLength(SLING.maxSpeed);
  else if (speed < SLING.minSpeed) v.setLength(SLING.minSpeed);
  return { v, power, maxed };
}

/** The launch at `angle` above level, heading along `dir`, that comes down to the same height `distance` away. */
function launchAtAngle(dir, distance, angle) {
  const from = _aimA.set(0, 0, 0);
  const to = _aimB.copy(dir).multiplyScalar(distance);
  const v = new THREE.Vector3();
  // The longer the flight, the steeper the launch: find the flight time that gives this angle.
  let lo = 0.01;
  let hi = 20;
  for (let i = 0; i < 40; i++) {
    const t = (lo + hi) / 2;
    launchVelocity(from, to, t, v);
    if (Math.atan2(v.y, Math.hypot(v.x, v.z)) < angle) lo = t;
    else hi = t;
  }
  return launchVelocity(from, to, (lo + hi) / 2, v);
}

/** Draws the arc and the power bar for the current pull. */
function updateSling() {
  const shot = slingShot();
  if (!shot) {
    hideAim();
    ui.slingPower.hidden = true;
    return;
  }
  const from = centerOfMass(_aimFrom);
  // Up the stairs: the dots go up the stairwell, then off where he's let go.
  const lift = slingLift(from, shot.v);
  const end = lift
    ? traceArc(liftPoint(lift, lift.end, new THREE.Vector3()), lift.exit, lift.exitTime, null, dotLift(lift))
    : traceArc(from, shot.v, SLING.arcTime);
  placeRing(aimRing, end.point, end.normal);
  aimRing.material.color.setHex(0xff6b4a);
  aimMark.visible = false;
  ui.slingPower.hidden = false;
  ui.slingPower.style.left = `${sling.x}px`;
  ui.slingPower.style.top = `${sling.y}px`;
  ui.slingFill.style.width = `${Math.round(shot.power * 100)}%`;
  ui.slingPower.classList.toggle('maxed', shot.maxed);
}

/** Lets go of the slingshot: throws him along the arc, or (`throwIt` false) just puts him down. */
function endSling(throwIt = true) {
  const s = sling;
  if (!s) return;
  sling = null;
  world.removeConstraint(s.constraint);
  handBody.velocity.setZero();
  if (canvas.hasPointerCapture?.(s.pointerId)) canvas.releasePointerCapture(s.pointerId);
  if (s.pointerType !== 'mouse') setHover(null);
  grabLine.visible = grabDot.visible = false;
  ui.slingPower.hidden = true;
  hideAim();
  canvas.style.cursor = idleCursor();
  controls.enabled = true;
  if (!throwIt) return;
  const shot = slingShot(s);
  const lift = shot && slingLift(centerOfMass(_aimFrom), shot.v);
  if (lift) launchLift(lift);
  else if (shot) launch(shot.v);
  else toast(t('Pull Lennie back, then let go to throw him'), 1800);
}

function changeSlingAngle(steps) {
  const before = slingAngle;
  slingAngle = clamp(slingAngle + steps * SLING_ANGLE.step, SLING_ANGLE.min, SLING_ANGLE.max);
  drawArcPicture();
  // Nothing in the scene shows it yet, so say so.
  if (!sling) sayArc(steps, slingAngle !== before);
}

function sayArc(steps, changed) {
  if (!changed) toast(t(steps > 0 ? 'That\'s the highest arc' : 'That\'s the lowest arc'), 1000);
  else toast(t(steps > 0 ? 'Higher arc' : 'Lower arc'), 800);
}

/**
 * The little picture on the Arc panel: a dotted flight as steep as the arc is
 * set now (the slingshot's launch angle, or in aim mode the aimed arc's height,
 * as the angle of a throw of about 4 m). A steep one is drawn narrower to fit.
 */
const arcPic = { path: document.getElementById('arc-path'), from: document.getElementById('arc-from'), angle: NaN };
function drawArcPicture() {
  const deg = aim.on ? THREE.MathUtils.radToDeg(Math.atan(aim.loft)) : slingAngle;
  if (deg === arcPic.angle) return;
  arcPic.angle = deg;
  const ground = 21.5;
  const tan = Math.tan(THREE.MathUtils.degToRad(deg));
  // A throw `w` wide that leaves at this angle tops out w·tan/4 high.
  const w = Math.min(28, (4 * 17) / tan);
  const x0 = 18 - w / 2;
  const x1 = 18 + w / 2;
  const top = (w * tan) / 4;
  // A quadratic curve tops out halfway to its control point.
  arcPic.path.setAttribute('d', `M${x0.toFixed(1)} ${ground}Q18 ${(ground - 2 * top).toFixed(1)} ${x1.toFixed(1)} ${ground}`);
  arcPic.from.setAttribute('cx', x0.toFixed(1));
  arcPic.from.setAttribute('cy', ground);
}

/**
 * Where the toss starts from: where Lennie was when he was picked up (not
 * where he was let go, or lifting him up to the ceiling and dropping him
 * would count as falling a floor).
 */
function markStart() {
  const c = lennie.center(_center);
  toss.startLevel = house.levelOf(c);
  toss.startInside = house.isInside(c);
  toss.startInShop = shop.isInside(c);
  toss.startOnShopRoof = shop.isOnRoof(c);
}

function beginFlight() {
  if (toss.startLevel === null) markStart();
  replay.launched();
  toss.state = 'flying';
  toss.time = 0;
  toss.settle = 0;
  toss.maxSpeed = 0;
  if (coach.on) endCoach();
}

function idleCursor() {
  if (hoverPart) return CURSORS.grab;
  return aim.on ? CURSORS.aim : '';
}

function setHover(name) {
  if (name === hoverPart) return;
  if (hoverPart) lennie.highlight(hoverPart, false);
  hoverPart = name;
  if (hoverPart) lennie.highlight(hoverPart, true);
  if (!grab && !sling) canvas.style.cursor = idleCursor();
}

// Registered before OrbitControls so a grab can disable orbiting in time.
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (replay.playing) {
    stopReplay();
    return;
  }
  if (e.button !== 0 || grab || sling) return;
  setPointer(e);
  // Between turns, Lennie waits for the next player to press Go.
  const pick = ui.turnCard.hidden && ui.setup.hidden && !turnPending ? pickPart() : null;
  if (!pick) {
    if (aim.on) aim.press = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch' };
    return;
  }
  // Grabbed while still rolling from the last toss: that toss scores now. In a
  // game of turns that was this player's go, so the next one waits for Go.
  if (toss.state === 'flying' && !isAirborne()) {
    finishToss();
    if (turnPending) return;
  }
  controls.enabled = false;
  // (it can refuse a pointer that's already gone; the grab still works without it)
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  setHover(pick.name);
  // Caught in mid-air he swings from your hand (a juggle); lying down, he goes in the slingshot.
  if (toss.state === 'flying' && isAirborne()) startGrab(pick, e.pointerId, e.pointerType);
  else startSling(pick, e);
});

canvas.addEventListener('pointermove', (e) => {
  setPointer(e);
  // A finger moving over the screen is orbiting the camera, not pointing.
  aim.hover = e.pointerType !== 'touch';
  if (grab) {
    if (e.pointerId === grab.pointerId) moveGrab();
    return;
  }
  if (sling) {
    if (e.pointerId === sling.pointerId) moveSling(e);
    return;
  }
  if (e.pointerType === 'mouse' && e.buttons === 0) setHover(pickPart()?.name ?? null);
});

const release = (e) => {
  if (grab && e.pointerId === grab.pointerId) endGrab();
  if (sling && e.pointerId === sling.pointerId) endSling(e.type === 'pointerup');
  const press = aim.press;
  aim.press = null;
  // A click (not a drag, which orbits the camera) in aim mode throws Lennie there.
  // On a touch screen there's no pointing before the tap, so the first tap
  // shows the flight path and a second tap on the same spot throws.
  if (press && e.type === 'pointerup' && e.pointerId === press.id
    && Math.hypot(e.clientX - press.x, e.clientY - press.y) < (press.touch ? AIM_TAP_PX / 3 : AIM_CLICK_PX)) {
    setPointer(e);
    if (!press.touch) aimThrow();
    else if (aim.pin && nearPin(e)) aimThrow();
    else pinAim(e);
  }
};

/** Whether a tap is on the pinned target, where it is on screen now (the camera may have turned). */
function nearPin(e) {
  const v = aim.pin.point.clone().project(camera);
  const rect = canvas.getBoundingClientRect();
  const x = rect.left + (v.x * 0.5 + 0.5) * rect.width;
  const y = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
  return v.z < 1 && Math.hypot(e.clientX - x, e.clientY - y) < AIM_TAP_PX;
}

/** Touch aiming: fixes the target under the finger until it's thrown or moved. */
function pinAim(e) {
  const target = aimTarget();
  aim.pin = target ? { point: target.point.clone(), normal: target.normal, body: target.body } : null;
  if (target) sfx.squeak();
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', (e) => {
  if (!grab && !sling && e.pointerType === 'mouse') setHover(null);
  if (e.pointerType === 'mouse') aim.hover = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Scroll while holding Lennie pushes him away from / towards the camera.
// In the slingshot and in aim mode, scrolling raises or lowers the arc instead of zooming.
canvas.addEventListener('wheel', (e) => {
  if (!grab && !sling && !aim.on) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (sling) {
    changeSlingAngle(-Math.sign(e.deltaY));
  } else if (grab) {
    grab.plane.constant += Math.sign(e.deltaY) * 0.25;
    moveGrab();
  } else {
    aim.loft = clamp(aim.loft - Math.sign(e.deltaY) * AIM_LOFT.step, AIM_LOFT.min, AIM_LOFT.max);
    drawArcPicture();
  }
}, { passive: false, capture: true });

function updateGrabVisual() {
  const hold = grab ?? sling;
  if (!hold) return;
  // In the slingshot the line is the rubber band, out to the pointer.
  const end = grab ? grab.target : sling.band;
  const p = hold.part.body.pointToWorldFrame(hold.local);
  const pos = grabLine.geometry.attributes.position;
  pos.setXYZ(0, p.x, p.y, p.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  grabDot.position.copy(end);
}

// ---------------------------------------------------------------- aiming
// Aim mode: point anywhere and a dotted arc shows the flight from Lennie to
// there; a click sends him along it. The arc stops at the first thing in the
// way, so it shows where he will really hit.
const aim = {
  on: false,
  hover: false,
  press: null,
  loft: AIM_LOFT.start,
  shot: null, // { v, blocked, tooFar, through } for the current pointer target
  pin: null, // touch screens: the tapped target, { point, normal, body, x, y }
  guide: null, // the launch still being steered, { v, t0, spin }
  lift: null, // the throw being carried up the stairs (see guideLift)
  through: null, // the door or window the flying Lennie was aimed through, until he smashes it
};

const AIM_DOTS = 150;
const AIM_DOT_GAP = 0.3;
const aimDots = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.045, 10, 8),
  new THREE.MeshBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.9, depthTest: false }),
  AIM_DOTS,
);
const aimRing = new THREE.Mesh(
  new THREE.RingGeometry(0.15, 0.24, 32),
  new THREE.MeshBasicMaterial({ color: 0xff6b4a, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }),
);
const aimMark = new THREE.Mesh(
  new THREE.RingGeometry(0.05, 0.09, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }),
);
for (const m of [aimDots, aimRing, aimMark]) {
  m.renderOrder = 12;
  m.frustumCulled = false;
  m.visible = false;
  m.userData.noAim = true;
  scene.add(m);
}

function hideAim() {
  aimDots.visible = aimRing.visible = aimMark.visible = false;
  aim.shot = null;
}

// Lennie's linear damping, as a drag rate per second, so the arc allows for it.
const DRAG = -Math.log(1 - lennie.parts.chest.body.linearDamping);
const reach = (t) => (1 - Math.exp(-DRAG * t)) / DRAG; // how far 1 m/s carries in t seconds

/** Launch velocity that carries `from` to `to` in `t` seconds. */
function launchVelocity(from, to, t, out = new THREE.Vector3()) {
  const r = reach(t);
  return out.set(
    (to.x - from.x) / r,
    (to.y - from.y + (GRAVITY * t) / DRAG) / r - GRAVITY / DRAG,
    (to.z - from.z) / r,
  );
}

/** Where a launch from `from` at velocity `v` is after `t` seconds. */
function flightPoint(from, v, t, out) {
  const r = reach(t);
  return out.set(
    from.x + v.x * r,
    from.y + (v.y + GRAVITY / DRAG) * r - (GRAVITY / DRAG) * t,
    from.z + v.z * r,
  );
}

/** How hard a launch at `v` hits a surface facing `normal` after `t` seconds. */
function impactSpeed(v, t, normal) {
  const decay = Math.exp(-DRAG * t);
  return -(v.x * decay * normal.x + ((v.y + GRAVITY / DRAG) * decay - GRAVITY / DRAG) * normal.y + v.z * decay * normal.z);
}

/**
 * The throw to `to` whose arc tops out `aim.loft` above the higher end. If
 * that one won't do, the nearest one that will: not too slow or too fast, and
 * for a wall, door or window (`normal` facing sideways) hard enough to smash
 * through. If none is hard enough, the hardest; if all are too fast, it's out of reach.
 */
function solveShot(from, to, normal, minImpact = AIM_MIN_IMPACT) {
  const top = Math.max(from.y, to.y) + aim.loft;
  const want = Math.sqrt((2 * (top - from.y)) / GRAVITY) + Math.sqrt((2 * (top - to.y)) / GRAVITY);
  const wall = Math.abs(normal.y) < 0.5;
  const tv = new THREE.Vector3();
  const rate = (t) => {
    const speed = launchVelocity(from, to, t, tv).length();
    const impact = wall ? impactSpeed(tv, t, normal) : Infinity;
    return { speed, impact, ok: speed >= AIM_MIN_SPEED && speed <= AIM_MAX_SPEED && impact >= minImpact };
  };
  let best = rate(want).ok ? want : null;
  let hardest = null;
  let slowest = null;
  if (best === null) {
    for (let t = 0.05; t < 5; t += 0.01) {
      const r = rate(t);
      if (r.ok && (best === null || Math.abs(t - want) < Math.abs(best - want))) best = t;
      if (r.speed <= AIM_MAX_SPEED && (!hardest || r.impact > hardest.impact)) hardest = { t, impact: r.impact };
      if (!slowest || r.speed < slowest.speed) slowest = { t, speed: r.speed };
    }
    best ??= hardest?.t ?? null;
  }
  if (best !== null) return { v: launchVelocity(from, to, best), time: best, tooFar: false };
  return { v: launchVelocity(from, to, slowest.t).setLength(AIM_MAX_SPEED), time: slowest.t, tooFar: true };
}

/** Lennie's centre of mass. */
function centerOfMass(out = new THREE.Vector3()) {
  out.set(0, 0, 0);
  let mass = 0;
  for (const b of lennie.bodies) {
    out.x += b.position.x * b.mass;
    out.y += b.position.y * b.mass;
    out.z += b.position.z * b.mass;
    mass += b.mass;
  }
  return out.divideScalar(mass);
}

/** The visible scenery under the pointer, looking past faded walls, hidden floors and Lennie. */
function aimTarget() {
  raycaster.setFromCamera(ndc, camera);
  for (const hit of raycaster.intersectObjects(scene.children, true)) {
    const o = hit.object;
    if (hit.distance > 100) break; // the sky
    if (!o.isMesh || o.userData.part || o.userData.noAim || house.isFaded(o) || shop.isFaded(o) || seeThrough.hides(hit.point, camera)) continue;
    const normal = hit.face ? hit.face.normal.clone().transformDirection(o.matrixWorld) : new THREE.Vector3(0, 1, 0);
    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
    // The physics body behind what's under the pointer. Window and door bodies
    // are thicker than they look, so the arc meets them a little early.
    const d = raycaster.ray.direction;
    _from.set(hit.point.x - d.x, hit.point.y - d.y, hit.point.z - d.z);
    _to.set(hit.point.x + d.x * 0.3, hit.point.y + d.y * 0.3, hit.point.z + d.z * 0.3);
    _rayHit.reset();
    const body = world.raycastClosest(_from, _to, SCENERY_ONLY, _rayHit) ? _rayHit.body : null;
    return { point: hit.point, normal, body };
  }
  return null;
}

const _aimFrom = new THREE.Vector3();
const _aimTo = new THREE.Vector3();
const _aimA = new THREE.Vector3();
const _aimB = new THREE.Vector3();
const _aimM = new THREE.Matrix4();
const _aimO = new THREE.Vector3();
const _aimV = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);

function placeRing(ring, point, normal) {
  ring.position.copy(point).addScaledVector(normal, 0.02);
  ring.quaternion.setFromUnitVectors(_zAxis, normal);
  ring.visible = true;
}

/**
 * Draws the dotted arc of a launch from `from` at `v`, for up to `maxTime`
 * seconds, through the scenery until it hits something. It goes on through
 * `pass` (the body of a door or window he'll crash through), a bit slower
 * after it. Its dots come after the first `dots0` (a lift's, up the stairs).
 * Returns where it ends: { point, normal, impact, passed }, with
 * `impact` (point, normal, body) if it hit something, and `passed` if it went through `pass`.
 */
function traceArc(from, v, maxTime, pass = null, dots0 = 0) {
  let dots = dots0;
  let carry = 0;
  let impact = null;
  let passed = false;
  const passGroup = pass?.collisionFilterGroup;
  const o = _aimO.copy(from);
  const vel = _aimV.copy(v);
  let t0 = 0;
  _aimA.copy(from);
  for (let t = 1 / 30; t < maxTime; t += 1 / 30) {
    flightPoint(o, vel, t - t0, _aimB);
    _from.set(_aimA.x, _aimA.y, _aimA.z);
    _to.set(_aimB.x, _aimB.y, _aimB.z);
    _rayHit.reset();
    if (world.raycastClosest(_from, _to, SCENERY_ONLY, _rayHit)) {
      const p = _rayHit.hitPointWorld;
      const n = _rayHit.hitNormalWorld;
      if (!passed && _rayHit.body === pass) {
        // Through it: the arc starts again from there, at the speed he keeps.
        const decay = Math.exp(-DRAG * (t - t0));
        vel.set(vel.x * decay, (vel.y + GRAVITY / DRAG) * decay - GRAVITY / DRAG, vel.z * decay).multiplyScalar(THROUGH_KEEP);
        o.set(p.x, p.y, p.z);
        t0 = t;
        passed = true;
        pass.collisionFilterGroup = 0; // the rays look past it from now on
        _aimB.copy(o);
      } else {
        impact = { point: new THREE.Vector3(p.x, p.y, p.z), normal: new THREE.Vector3(n.x, n.y, n.z), body: _rayHit.body };
        _aimB.copy(impact.point);
      }
    }
    const seg = _aimA.distanceTo(_aimB);
    for (let d = AIM_DOT_GAP - carry; d <= seg && dots < AIM_DOTS; d += AIM_DOT_GAP) {
      const k = d / seg;
      _aimM.makeTranslation(_aimA.x + (_aimB.x - _aimA.x) * k, _aimA.y + (_aimB.y - _aimA.y) * k, _aimA.z + (_aimB.z - _aimA.z) * k);
      aimDots.setMatrixAt(dots++, _aimM);
    }
    carry = (carry + seg) % AIM_DOT_GAP;
    _aimA.copy(_aimB);
    if (impact || _aimB.y < -1) break;
  }
  if (passed) pass.collisionFilterGroup = passGroup;
  aimDots.count = dots;
  aimDots.instanceMatrix.needsUpdate = true;
  aimDots.visible = dots > 0;
  const point = _aimB.clone();
  return { point, normal: impact?.normal ?? new THREE.Vector3(0, 1, 0), impact, passed };
}

// Working out the aim (a ray through the whole scene to find what's under the
// pointer, then the arc through the physics) was the heaviest thing in a frame
// while Lennie lies waiting: about a tenth of it on a budget tablet. So as long
// as the pointer, the camera and Lennie stay where they were, the aim on screen
// is kept, and only looked at again a few times a second (a wall may have
// faded, a chair may have rolled into the arc).
const AIM_KEEP = 150; // ms
const aimSeen = { at: -Infinity, x: NaN, y: NaN, loft: NaN, pin: null, camera: new THREE.Vector3(), turn: new THREE.Quaternion(), from: new THREE.Vector3() };
function aimUnchanged(from) {
  const s = aimSeen;
  const now = performance.now();
  if (now - s.at < AIM_KEEP && s.x === ndc.x && s.y === ndc.y && s.loft === aim.loft && s.pin === aim.pin
    && s.camera.distanceToSquared(camera.position) < 1e-6 && Math.abs(s.turn.dot(camera.quaternion)) > 1 - 1e-9
    && s.from.distanceToSquared(from) < 4e-4) return true;
  s.at = now;
  s.x = ndc.x;
  s.y = ndc.y;
  s.loft = aim.loft;
  s.pin = aim.pin;
  s.camera.copy(camera.position);
  s.turn.copy(camera.quaternion);
  s.from.copy(from);
  return false;
}

function updateAim() {
  if (sling) return updateSling();
  if (!aim.on || (!aim.hover && !aim.pin) || grab || hoverPart || isAirborne()) return hideAim();
  const from = centerOfMass(_aimFrom);
  if (aim.shot && aimUnchanged(from)) return;
  const target = aim.pin ?? aimTarget();
  if (!target) return hideAim();
  // Lennie hits the side facing him, which may not be the side facing the camera.
  const facing = target.normal.clone();
  if (facing.dot(_aimA.subVectors(from, target.point)) < 0) facing.negate();
  // A door is aimed at no lower than its lower panel (aimed at its foot he
  // skids into it along the floor), and thrown at harder than a window: the
  // somersault means the limb that hits it may be going slower than his middle.
  const surf = target.body?.surface;
  const through = (surf?.kind === 'door' || surf?.kind === 'glass') && !surf.piece.broken ? surf.piece : null;
  let to = target.point;
  if (surf?.kind === 'door' && through) {
    const low = through.center.y - through.height / 2 + DOOR_AIM_LOW;
    if (to.y < low) to = _aimTo.copy(to).setY(low);
  }
  const minImpact = through ? THROUGH_IMPACT : AIM_MIN_IMPACT;
  // Up the stairs: the dots go up the stairwell, then on from where he's let go.
  const lift = aimLift(from, target, to, minImpact);
  const shot = lift ? { v: lift.exit, time: lift.exitTime, tooFar: lift.tooFar } : solveShot(from, to, facing, minImpact);
  const { impact, point, passed } = lift
    ? traceArc(liftPoint(lift, lift.end, new THREE.Vector3()), shot.v, shot.time + 1.5, through ? target.body : null, dotLift(lift))
    : traceArc(from, shot.v, shot.time + 1.5, through ? target.body : null);

  // Falling short of the pointer means something is in the way (or it's out
  // of reach). Through a door or window, the ring shows where he ends up.
  const end = impact ?? { point, normal: target.normal };
  const blocked = !shot.tooFar && !passed && end.point.distanceTo(target.point) > 0.5 && !(impact && impact.body === target.body);
  placeRing(aimRing, end.point, end.normal);
  aimRing.material.color.setHex(shot.tooFar || blocked ? 0xffffff : 0xff6b4a);
  if (shot.tooFar || blocked || passed) placeRing(aimMark, target.point, target.normal);
  else aimMark.visible = false;
  aim.shot = { v: shot.v, tooFar: shot.tooFar, blocked, through: passed ? through : null, lift };
}

function aimThrow() {
  if (grab || sling || turnPending || !ui.setup.hidden) return;
  if (isAirborne()) {
    toast(t('Wait for Lennie to land, then aim again'), 1400);
    return;
  }
  // Still rolling from the last toss: that one scores first (and in a game of
  // turns ends this player's go), rather than being thrown away.
  if (toss.state === 'flying') {
    finishToss();
    if (turnPending) return;
  }
  const touch = document.body.classList.contains('touch');
  if (!touch) aim.hover = true;
  updateAim();
  const shot = aim.shot;
  aim.pin = null;
  if (!shot) return;
  sfx.squeak();
  if (shot.lift) launchLift(shot.lift, shot.through);
  else launch(shot.v, shot.through);
}

/**
 * Sends all of Lennie off at `v` (an aimed throw or the slingshot): his centre
 * follows the planned arc, and once he's clear he somersaults the way he's going.
 */
function launch(v, through = null) {
  replay.start();
  aim.through = through;
  hint.on = false;
  resetChain();
  hideResult();
  if (lennie.expression !== 'normal') lennie.setExpression('normal');
  for (const b of lennie.bodies) {
    b.velocity.set(v.x, v.y, v.z);
    b.angularVelocity.setZero();
  }
  // A somersault the way he's going, for once he's let go.
  const ahead = new THREE.Vector3(v.x, 0, v.z);
  if (ahead.lengthSq() < 1e-6) ahead.set(1, 0, 0);
  const spin = new THREE.Vector3(0, 1, 0).cross(ahead.normalize()).multiplyScalar(1 + Math.random() * 2);
  spin.y = (Math.random() - 0.5) * 2;
  aim.guide = { v: v.clone(), t0: world.time, spin };
  const speed = v.length();
  toss.fling = speed;
  sfx.whoosh(Math.min(1, speed / 20));
  if (speed > 7) {
    sfx.voice('fly');
    lennie.setExpression('whee', 1.2);
  }
  beginFlight();
  hideAim();
  camAnim = null;
}

/**
 * Right after an aimed launch: nudges all of Lennie by the same amount so his
 * centre of mass moves as planned (his limbs keep flailing among themselves).
 */
function guideLaunch() {
  const g = aim.guide;
  const t = world.time - g.t0;
  if (t >= AIM_GUIDE_TIME || toss.state !== 'flying') {
    aim.guide = null;
    if (toss.state === 'flying') {
      applySpin(g.spin);
      lennie.fling(g.v);
    }
    return;
  }
  const decay = Math.exp(-DRAG * t);
  let mass = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const b of lennie.bodies) {
    x += b.velocity.x * b.mass;
    y += b.velocity.y * b.mass;
    z += b.velocity.z * b.mass;
    mass += b.mass;
  }
  const dx = g.v.x * decay - x / mass;
  const dy = (g.v.y + GRAVITY / DRAG) * decay - GRAVITY / DRAG - y / mass;
  const dz = g.v.z * decay - z / mass;
  for (const b of lennie.bodies) {
    b.velocity.x += dx;
    b.velocity.y += dy;
    b.velocity.z += dz;
  }
}

// ---------------------------------------------------------------- the helping hand up the stairs
// Thrown up a flight of stairs (from the hallway at its foot, or from on it),
// Lennie's centre is carried up the stairwell along the flight's path
// (house.stairRuns) and let go at the top, rather than flying free: up that
// steep, narrow stairwell a free throw nearly always caught on the floor over
// the bottom steps or the flight overhead, and he tumbled straight back down.
// His limbs still flail and bump along the steps on the way.
const LIFT = {
  minAngle: THREE.MathUtils.degToRad(15), // a flatter slingshot throw is a line drive, not up the stairs
  look: 4, // m: how far ahead a slingshot throw may cross the foot of the flight
  speed: [4.5, 6], // m/s along the path, gentle to hard throws
  pull: 8, // 1/s: how hard his centre is drawn back onto the path when something knocks him off it
  full: 6, // m/s: a slingshot throw this fast goes all the way up, a gentler one only part of the way...
  minShare: 0.3, // ...but at least this share of it
  exit: [2.5, 6], // m/s off the top, for slingshot throws
  letGo: 1, // m/s: let go short of the top (a gentle slingshot throw, or aimed at a step), he's just let go there
};
const _liftP = new THREE.Vector3();
const _liftD = new THREE.Vector3();
const _liftC = new THREE.Vector3();
const _liftW = new THREE.Vector3();

const inRange = (v, [lo, hi]) => v >= lo && v <= hi;

/** The flight Lennie's centre `from` is at the foot of (and, given the throw's heading `dir` in plan, thrown up), or null. */
function liftRun(from, dir = null) {
  for (const run of house.stairRuns) {
    const { zone, foot, up } = run;
    if (!inRange(from.x, zone.x) || !inRange(from.y, zone.y) || !inRange(from.z, zone.z)) continue;
    if (!dir) return run;
    // On the flight already: thrown up it. Otherwise: thrown across its foot.
    if (inRange(from.x, foot.x) && inRange(from.z, foot.z)) {
      if (dir.x * up[0] + dir.z * up[1] > 0.3) return run;
      continue;
    }
    let t0 = 0;
    let t1 = LIFT.look;
    for (const [o, d, [lo, hi]] of [[from.x, dir.x, foot.x], [from.z, dir.z, foot.z]]) {
      if (Math.abs(d) < 1e-6) {
        if (o < lo || o > hi) t1 = -1;
        continue;
      }
      const a = (lo - o) / d;
      const b = (hi - o) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 <= t1) return run;
  }
  return null;
}

/**
 * The way up `run` (and on up the flight above it, with `onUp`) from Lennie's
 * centre `from`: straight to the nearest point of its path, then along it.
 * Null if a wall or a door is in the way of getting onto it.
 * Returns { pts, cum (the distance along it to each point), total }.
 */
function liftPath(from, run, onUp = false) {
  const next = onUp ? house.stairRuns.find((r) => r.level === run.level + 1) : null;
  const path = next ? [...run.path, ...next.path] : run.path;
  let best = Infinity;
  let join = null;
  let at = 1;
  const q = new THREE.Vector3();
  const line = new THREE.Line3();
  for (let i = 1; i < path.length; i++) {
    line.set(path[i - 1], path[i]).closestPointToPoint(from, true, q);
    const d = q.distanceToSquared(from);
    if (d < best) {
      best = d;
      join = q.clone();
      at = i;
    }
  }
  _from.set(from.x, from.y, from.z);
  _to.set(join.x, join.y, join.z);
  _rayHit.reset();
  if (world.raycastClosest(_from, _to, SCENERY_ONLY, _rayHit)) return null;
  const pts = [];
  for (const p of [from.clone(), join, ...path.slice(at)]) {
    if (!pts.length || p.distanceTo(pts[pts.length - 1]) > 0.01) pts.push(p);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  return total > 0.5 ? { pts, cum, total } : null;
}

/** The point `s` metres along a lift's path (and in `dir`, which way it heads there). */
function liftPoint(lift, s, out, dir = null) {
  const { pts, cum } = lift;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const k = clamp((s - cum[i - 1]) / (cum[i] - cum[i - 1]), 0, 1);
  out.lerpVectors(pts[i - 1], pts[i], k);
  if (dir) dir.subVectors(pts[i], pts[i - 1]).normalize();
  return out;
}

/** How far along a lift's path its point nearest `p` is. */
function liftNearest(lift, p) {
  let best = Infinity;
  let at = 0;
  for (let s = 0; s <= lift.total; s += 0.05) {
    const d = liftPoint(lift, s, _liftP).distanceToSquared(p);
    if (d < best) {
      best = d;
      at = s;
    }
  }
  return at;
}

/** A slingshot throw at `v` from Lennie's centre `from`, up the stairs if it heads up a flight: the lift's plan, or null. */
function slingLift(from, v) {
  const flat = Math.hypot(v.x, v.z);
  if (flat < 1e-3 || Math.atan2(v.y, flat) < LIFT.minAngle) return null;
  const run = liftRun(from, { x: v.x / flat, z: v.z / flat });
  const lift = run && liftPath(from, run);
  if (!lift) return null;
  const speed = v.length();
  const share = clamp((speed - SLING.minSpeed) / (LIFT.full - SLING.minSpeed), LIFT.minShare, 1);
  lift.end = share * lift.total;
  lift.speed = clamp(speed * 0.6, ...LIFT.speed);
  // Off the top the way the path heads, harder for a harder throw; short of the top, he's just let go.
  liftPoint(lift, lift.end, _liftP, _liftD);
  lift.exit = _liftD.clone().multiplyScalar(share < 1 ? LIFT.letGo : clamp(speed * 0.5, ...LIFT.exit));
  lift.exitTime = 2;
  return lift;
}

/**
 * An aimed throw from Lennie's centre `from` at `target` (as aimTarget gives
 * it) up the stairs, if it's up a flight he's at the foot of: at a step of it
 * (he's let go above that step), or at anything on a floor above (he goes on
 * from the top, up the next flight too if need be). Its plan, or null.
 */
function aimLift(from, target, to, minImpact) {
  const run = liftRun(from);
  if (!run || to.y < from.y + 1) return null;
  const step = target.body?.surface?.kind === 'stair' && run.steps.has(target.body.surface.id);
  const level = house.isInside(to) ? house.levelOf(_liftC.copy(to).setY(to.y + 0.05)) : -1;
  if (!step && level <= run.level) return null;
  const lift = liftPath(from, run, level > run.level + 1);
  if (!lift) return null;
  lift.end = step ? liftNearest(lift, to) : lift.total;
  lift.speed = LIFT.speed[1];
  const start = liftPoint(lift, lift.end, new THREE.Vector3());
  if (step) {
    // let go just above it, rather than thrown at it (aimed at its side, he'd go off the side of the stairs)
    liftPoint(lift, lift.end, _liftP, _liftD);
    lift.exit = _liftD.clone().multiplyScalar(LIFT.letGo);
    lift.exitTime = 1;
    lift.tooFar = false;
  } else {
    // he hits the side facing where he's let go
    const facing = target.normal.clone();
    if (facing.dot(_liftW.subVectors(start, to)) < 0) facing.negate();
    const shot = solveShot(start, to, facing, minImpact);
    lift.exit = shot.v;
    lift.exitTime = shot.time;
    lift.tooFar = shot.tooFar;
  }
  return lift;
}

/** Lays the aim dots along a lift's path, up to where he's let go. Returns how many. */
function dotLift(lift) {
  let dots = 0;
  for (let s = AIM_DOT_GAP; s <= lift.end && dots < AIM_DOTS; s += AIM_DOT_GAP) {
    liftPoint(lift, s, _liftP);
    _aimM.makeTranslation(_liftP.x, _liftP.y, _liftP.z);
    aimDots.setMatrixAt(dots++, _aimM);
  }
  return dots;
}

/** Throws Lennie up the stairs as `lift` plans, through the door or window `through` at the end if given. */
function launchLift(lift, through = null) {
  liftPoint(lift, 0, _liftP, _liftD);
  launch(_liftD.clone().multiplyScalar(lift.speed), through);
  const { spin } = aim.guide;
  aim.guide = null;
  aim.lift = { ...lift, t0: world.time, spin };
  popAt(_liftP, 'UP THE STAIRS!', 'good');
}

/** While he's carried up the stairs: steers his centre along the path, and lets go at its end. */
function guideLift() {
  const lift = aim.lift;
  if (toss.state !== 'flying') {
    aim.lift = null;
    return;
  }
  const s = Math.min(lift.end, lift.speed * (world.time - lift.t0));
  const done = s >= lift.end;
  if (done) _liftW.copy(lift.exit);
  else {
    liftPoint(lift, s, _liftP, _liftD);
    _liftW.copy(_liftD).multiplyScalar(lift.speed).addScaledVector(_liftP.sub(centerOfMass(_liftC)), LIFT.pull);
  }
  let mass = 0;
  _liftC.set(0, 0, 0);
  for (const b of lennie.bodies) {
    _liftC.x += b.velocity.x * b.mass;
    _liftC.y += b.velocity.y * b.mass;
    _liftC.z += b.velocity.z * b.mass;
    mass += b.mass;
  }
  _liftW.addScaledVector(_liftC, -1 / mass);
  for (const b of lennie.bodies) {
    b.velocity.x += _liftW.x;
    b.velocity.y += _liftW.y;
    b.velocity.z += _liftW.z;
  }
  if (done) {
    aim.lift = null;
    applySpin(lift.spin);
    lennie.fling(lift.exit);
  }
}

/** Spins Lennie as a whole about his centre of mass, which leaves his centre on the arc. */
function applySpin(w) {
  const com = centerOfMass(_aimFrom);
  const r = new THREE.Vector3();
  for (const b of lennie.bodies) {
    r.set(b.position.x - com.x, b.position.y - com.y, b.position.z - com.z).crossVectors(w, r);
    b.velocity.x += r.x;
    b.velocity.y += r.y;
    b.velocity.z += r.z;
    b.angularVelocity.set(w.x, w.y, w.z);
  }
}

function toggleAim() {
  aim.on = !aim.on;
  btn.aim.setAttribute('aria-pressed', String(aim.on));
  if (!aim.on) hideAim();
  aim.pin = null;
  drawArcPicture();
  canvas.style.cursor = grab ? CURSORS.grabbing : idleCursor();
  const how = document.body.classList.contains('touch')
    ? 'tap where Lennie should go, then tap there again to throw'
    : 'point where Lennie should go and click. Scroll for a higher or lower arc';
  toast(aim.on ? t('Aim mode: {how}', { how: t(how) }) : t('Aim mode off'), aim.on ? 3200 : 1200);
}

// ---------------------------------------------------------------- camera
// Whatever is between the camera and Lennie turns see-through (not Lennie
// himself, his dizzy stars or the aiming and grabbing marks).
const notScenery = (o) => {
  if (o.userData.part || o.userData.noAim) return true;
  for (let p = o; p; p = p.parent) if (p === lennie.stars) return true;
  return false;
};
// On the developer's own computer, the flicker check (flickercheck.js) lists
// any spots where two surfaces lie in the same place, in the browser console.
// It notes down the parts before they're glued together below, and checks a
// little at a time once the game runs. The live game skips it.
const DEV = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const builtParts = DEV ? sceneryParts(scene, notScenery) : null;
// The products and clutter in their places go into a few baked meshes (products.js).
bakeStocks();
// Everything is built: glue the scenery that never moves into a few big
// meshes, so weak tablets and phones have far less to draw (batching.js).
combineScenery(scene, notScenery);
// (and from those, the cheap copies of the house and the shop for when they're seen from across the road)
house.finish();
shop.finish();
if (DEV) setTimeout(() => reportFlicker(builtParts), 1500);
const seeThrough = createSeeThrough(scene, renderer, notScenery);
const blobShadow = createBlobShadow(scene, world, SCENERY_ONLY);
const _blobCenter = new THREE.Vector3();
const _seeCenter = new THREE.Vector3();
/** Lennie's middle as drawn (during a replay that's not where his physics bodies are). */
function lennieOnScreen(out) {
  const a = lennie.parts.chest.group.position;
  const b = lennie.parts.pelvis.group.position;
  return out.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// The camera goes wherever it's turned or zoomed: inside furniture, trees,
// the garage, the neighbours' houses or past the edge of the play area.
// Whatever is between it and Lennie, or right in front of the lens, turns
// see-through instead (seethrough.js).
controls.minDistance = 0.8;
controls.maxDistance = 32;
// No further round than level: below that the camera would dip under the
// floor or ground and get squashed up against Lennie, looking up.
controls.maxPolarAngle = Math.PI / 2;
controls.update();

let camAnim = null;
let follow = true; // on from the start, so Lennie stays in the picture; G turns it off
let chase = false; // following Lennie for the rest of this toss, because he was leaving the picture
let replayCenter = null; // while a replay plays, the camera follows Lennie's replayed position
let cutaway = true;
controls.addEventListener('start', () => { camAnim = null; settleFocus = null; });

function focusLennie(dur = 0.7) {
  const to = lennie.center();
  const dir = camera.position.clone().sub(controls.target);
  const dist = clamp(dir.length(), 2.5, 6);
  dir.normalize();
  if (dir.y < 0.25) dir.y = 0.25;
  dir.normalize();
  const toCam = to.clone().addScaledVector(dir, dist);
  camAnim = { t: 0, dur, fromT: controls.target.clone(), toT: to, fromC: camera.position.clone(), toC: toCam };
}

const keys = new Set();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

const CAM_MIN_Y = 0.4; // the lowest the camera looks at (and, being no lower than level, looks from)

function updateCamera(dt) {
  // During a toss the camera starts chasing Lennie once he's about to fly out
  // of the picture (on a narrow phone screen that's almost at once), and keeps
  // at it until he lands.
  if (toss.state !== 'flying') chase = false;
  else if (!chase) {
    const v = lennie.center(_center).project(camera);
    chase = v.z > 1 || Math.abs(v.x) > 0.7 || Math.abs(v.y) > 0.7;
  }
  if (camAnim) {
    camAnim.t += dt;
    const k = Math.min(1, camAnim.t / camAnim.dur);
    const e = k * k * (3 - 2 * k);
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
    camera.position.lerpVectors(camAnim.fromC, camAnim.toC, e);
    if (k >= 1) camAnim = null;
  } else if (replayCenter || ((follow || chase) && !grab && !sling)) {
    // a chase keeps up more tightly, so a fast fall doesn't leave him behind
    const rate = chase && !replayCenter ? 10 : 4;
    const d = (replayCenter ? _center.copy(replayCenter) : lennie.center(_center)).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * rate));
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
  clampInWorld(controls.target, 0.05);
  // Flying down (Q) or panning stops with the camera still a bit above the
  // ground, not with its lens on the floor.
  if (controls.target.y < CAM_MIN_Y) {
    camera.position.y += CAM_MIN_Y - controls.target.y;
    controls.target.y = CAM_MIN_Y;
  }
}

// ---------------------------------------------------------------- buttons & keys
let timeScale = 1;
const btn = {
  lang: $('btn-lang'),
  reset: $('btn-reset'),
  focus: $('btn-focus'),
  follow: $('btn-follow'),
  cutaway: $('btn-cutaway'),
  slowmo: $('btn-slowmo'),
  sound: $('btn-sound'),
  fullscreen: $('btn-fullscreen'),
  drop: $('btn-drop'),
  help: $('btn-help'),
  aim: $('btn-aim'),
  players: $('btn-players'),
};

const LEVEL_NAMES = ['floor 1', 'floor 2', 'floor 3', 'the roof', 'the supermarket floor'];
const SHOP_DROP = 4; // 'level' 4 in the drop menu is the supermarket, across the street
/** Lennie back on a floor, or (`seated`) back in the comfy chair he starts in. */
function dropLennie(level, seated = false) {
  if (grab) endGrab();
  endSling(false);
  stopReplay();
  replay.stop(false);
  const p = level === SHOP_DROP ? shop.spawnPoint() : house.spawnPoint(level);
  effects.clear(); // (before he's moved: it lets go of anything holding him, frozen or stuck)
  cat.release(); // (and the cat lets go of him)
  if (seated) lennie.sit(house.homeSeat);
  else lennie.reset({ x: p.x, z: p.z, height: p.height, yaw: (Math.random() - 0.5) * 0.8 });
  zap.clear();
  guard.forget();
  aim.guide = aim.through = aim.lift = null;
  if (!seated) nudge();
  lennie.setExpression('normal');
  toss.state = 'idle';
  resetChain();
  hideResult();
  if (seated) {
    settleFocus = null; // (the caller brings the camera back to the home view)
    return;
  }
  focusLennie(0.8);
  settleFocus = { t: 0 };
}

// After a drop Lennie flops over and slides a bit: once he lies still, the
// camera re-centres on him (on a narrow phone screen he'd otherwise be off the edge).
// Not at the start, where he sits still in the chair in the home view.
let settleFocus = null;
function updateSettleFocus(dt) {
  if (!settleFocus) return;
  settleFocus.t += dt;
  if (grab || sling || toss.state !== 'idle' || settleFocus.t > 6) {
    settleFocus = null;
  } else if (settleFocus.t > 0.8 && !camAnim && lennie.maxSpeed() < 0.4) {
    settleFocus = null;
    focusLennie(0.6);
  }
}

function resetAll(say = true) {
  house.repairAll();
  shop.repairAll();
  clearShards();
  dropLennie(0, true);
  // back to the home view, wherever the last toss left the camera
  camAnim = { t: 0, dur: 0.9, fromT: controls.target.clone(), toT: HOME_TARGET.clone(), fromC: camera.position.clone(), toC: HOME_CAM.clone() };
  if (say) toast(t('Windows, doors and TV fixed, shelves stocked, the mess and the chairs back where they were, Lennie back downstairs'), 1900);
}

function toggleFollow() {
  follow = !follow;
  btn.follow.setAttribute('aria-pressed', String(follow));
  toast(t(follow ? 'Camera follows Lennie' : 'Camera follow off'), 1200);
}

function toggleCutaway() {
  cutaway = !cutaway;
  btn.cutaway.setAttribute('aria-pressed', String(cutaway));
  toast(t(cutaway ? 'Cutaway on: upper floors hide when you look down' : 'Cutaway off: whole house shown'), 1600);
}

function toggleSlowmo() {
  timeScale = timeScale === 1 ? SLOWMO_SCALE : 1;
  btn.slowmo.setAttribute('aria-pressed', String(timeScale !== 1));
  toast(t(timeScale !== 1 ? 'Slow motion on' : 'Slow motion off'), 1200);
}

function toggleSound() {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  btn.sound.setAttribute('aria-pressed', String(!sfx.muted));
  toast(t(sfx.muted ? 'Sound off' : 'Sound on'), 1000);
}

// Full screen through the page itself rather than the browser's F11: then the
// browser bar doesn't slide back in when the mouse touches the top of the screen.
// Esc leaves it (the browser handles that). The button stays hidden where the
// browser can't do it (an iPhone, for one).
const root = document.documentElement;
const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen) &&
  (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? false);
const fullscreenElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
function toggleFullscreen() {
  if (!canFullscreen) return;
  if (fullscreenElement()) {
    (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
    return;
  }
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
  Promise.resolve(request.call(root, { navigationUI: 'hide' }))
    .catch(() => toast(t('Full screen isn\'t allowed here'), 1600));
}
function syncFullscreen() {
  btn.fullscreen.setAttribute('aria-pressed', String(!!fullscreenElement()));
  btn.fullscreen.dataset.tip = t(fullscreenElement() ? 'Leave full screen (B or Esc)' : 'Full screen (B)');
}
btn.fullscreen.hidden = !canFullscreen;
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);

/** In a game of turns, putting Lennie back mid-toss would undo a bad throw: wait for him to land. */
function tossLocked() {
  if (!match || toss.state !== 'flying') return false;
  toast(t('Wait for Lennie to land'), 1200);
  return true;
}
btn.reset.addEventListener('click', () => { if (!tossLocked()) resetAll(); });
btn.focus.addEventListener('click', () => focusLennie());
btn.follow.addEventListener('click', toggleFollow);
btn.cutaway.addEventListener('click', toggleCutaway);
btn.slowmo.addEventListener('click', toggleSlowmo);
btn.aim.addEventListener('click', toggleAim);
btn.sound.addEventListener('click', toggleSound);
btn.fullscreen.addEventListener('click', toggleFullscreen);
btn.lang.addEventListener('click', () => toggleLang());

// Dutch or English (i18n.js). The button shows the language it switches to.
function renderLangButton() {
  const other = lang === 'nl' ? 'English' : 'Nederlands';
  btn.lang.textContent = lang === 'nl' ? 'EN' : 'NL';
  btn.lang.dataset.tip = `${other} (L)`;
  btn.lang.setAttribute('aria-label', other);
}
renderLangButton();
function toggleLang() {
  setLang(lang === 'nl' ? 'en' : 'nl');
  toast(lang === 'nl' ? 'Taal: Nederlands' : 'Language: English', 1200);
}
// After a switch, redo the texts the game wrote itself (index.html's own texts i18n.js does).
onLangChange(() => {
  renderLangButton();
  renderStats();
  syncFullscreen();
  renderChallenge();
  renderBoard();
  if (!ui.setup.hidden) renderSetup();
  if (!ui.turnCard.hidden && match && !matchOver()) showTurnCard();
  ui.hintText.textContent = hintLabel();
});
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
    if (tossLocked()) return;
    setChallengeMenu(false);
    dropLennie(level);
    toast(t('Lennie dropped on {where}', { where: t(LEVEL_NAMES[level]) }), 1200);
  });
});
document.addEventListener('pointerdown', (e) => {
  if (!ui.dropMenu.hidden && !ui.dropMenu.contains(e.target) && !btn.drop.contains(e.target)) setDropMenu(false);
});

// Help: under the ? button. (A first visit gets the hand over Lennie instead, see `coach`.)
function setHelp(open) {
  ui.help.hidden = !open;
  btn.help.setAttribute('aria-expanded', String(open));
  if (open) ui.helpClose.focus({ preventScroll: true });
}
btn.help.addEventListener('click', () => setHelp(ui.help.hidden));
ui.helpClose.addEventListener('click', () => setHelp(false));

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
    endSling(false);
    setDropMenu(false);
    setChallengeMenu(false);
    if (!ui.help.hidden) setHelp(false);
    if (!ui.setup.hidden) setSetup(false);
    stopReplay();
    return;
  }
  if (replay.playing && e.code !== 'KeyM' && e.code !== 'KeyP') stopReplay();
  if ((e.code === 'KeyR' || /^Digit[1-5]$/.test(e.code)) && tossLocked()) return;
  switch (e.code) {
    case 'KeyP':
      if (replay.playing) stopReplay();
      else if (!ui.turnCard.hidden) {
        // Only where the card offers the last toss itself (or at the end): it comes back afterwards.
        if (replay.canPlay && (matchOver() || (!ui.turnAlt.hidden && ui.turnAlt.dataset.action === 'replay'))) {
          ui.turnCard.hidden = true;
          playReplay();
        }
      } else playReplay();
      break;
    case 'KeyR': resetAll(); break;
    case 'KeyF': focusLennie(); break;
    case 'KeyG': toggleFollow(); break;
    case 'KeyC': toggleCutaway(); break;
    case 'KeyZ': toggleSlowmo(); break;
    case 'KeyT': toggleAim(); break;
    case 'KeyM': toggleSound(); break;
    case 'KeyH': setHelp(ui.help.hidden); break;
    case 'KeyB': toggleFullscreen(); break;
    case 'KeyL': toggleLang(); break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': {
      const level = Number(e.code.slice(-1)) - 1;
      dropLennie(level);
      toast(t('Lennie dropped on {where}', { where: t(LEVEL_NAMES[level]) }), 1200);
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
  // the score card may lie somewhere else now (a phone turned on its side)
  placeResult();
  view.set = -1;
});

// ---------------------------------------------------------------- instant replay
function playReplay() {
  if (grab || sling || replay.playing || !replay.play(0.4)) return;
  camAnim = null;
  aim.guide = aim.through = aim.lift = null;
  hideAim();
  hideResult();
  ui.replayBadge.hidden = false;
}

/** Ends a replay early (or when it finishes) and brings the score card back. */
function stopReplay() {
  if (!replay.playing) return;
  replay.cancel();
  endReplay();
}

function endReplay() {
  replayCenter = null;
  ui.replayBadge.hidden = true;
  if (match && turnPending) {
    showTurnCard();
  } else if (toss.state === 'scored' && !resultClosed) {
    ui.result.classList.add('show');
    placeResult();
    clearTimeout(resultTimer);
    resultTimer = setTimeout(hideResult, 6000);
  }
  focusLennie(0.8);
}

ui.replayBtn.addEventListener('click', () => {
  ui.replayBtn.blur();
  playReplay();
});

// ---------------------------------------------------------------- "Grab me!" hint
const _hintPos = new THREE.Vector3();
/** Shows `el` at a point `lift` m above a part of Lennie, or hides it when `show` is false or that's off screen. */
function pinToLennie(el, show, part, lift) {
  if (show) {
    const p = lennie.parts[part].body.position;
    const v = _hintPos.set(p.x, p.y + lift, p.z).project(camera);
    if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) {
      el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      if (el.hidden) el.hidden = false;
      return;
    }
  }
  if (!el.hidden) el.hidden = true;
}

function updateHint() {
  const waiting = toss.state === 'idle' && !grab && !sling && !replay.playing
    && ui.help.hidden && ui.turnCard.hidden && ui.setup.hidden && ui.chMenu.hidden;
  pinToLennie(ui.hint, waiting && hint.on, 'head', 0.35);
  // The hand that shows the pull stays until the first toss, also after a grab that threw nothing.
  pinToLennie(ui.pull, waiting && coach.on, 'chest', 0);
}

// ---------------------------------------------------------------- challenges
function renderChallenge() {
  ui.challenge.hidden = !!match;
  if (match) setChallengeMenu(false);
  const c = challenges.current;
  ui.chCount.textContent = challenges.count;
  ui.chDone.textContent = challenges.doneCount;
  ui.chProgress.style.width = `${(100 * challenges.doneCount) / challenges.count}%`;
  if (c) {
    ui.chNum.textContent = challenges.number;
    ui.chText.textContent = t(c.text);
    ui.chSkip.textContent = t('Skip');
    ui.chSkip.title = ui.chSkip.ariaLabel = t('Skip this challenge');
  } else {
    ui.chNum.textContent = '★';
    ui.chText.textContent = t('All challenges done. Lennie legend!');
    ui.chSkip.textContent = t('Again');
    ui.chSkip.title = ui.chSkip.ariaLabel = t('Start the challenges over');
  }
  if (!ui.chMenu.hidden) renderChallengeList();
}

/** The list of all challenges to pick from: done ones ticked off, the current one marked. */
function renderChallengeList() {
  const current = challenges.current;
  $('ch-spots').textContent = spotsFound.size;
  $('ch-spots-all').textContent = ALL_SPOTS.size;
  ui.chList.innerHTML = '';
  CHALLENGES.forEach((c, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = c.id;
    const done = challenges.isDone(c.id);
    if (done) b.classList.add('done');
    if (c === current) {
      b.classList.add('now');
      b.setAttribute('aria-current', 'true');
    }
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = done ? '✓' : i + 1;
    const text = document.createElement('span');
    text.className = 't';
    text.textContent = t(c.text);
    b.append(n, text);
    if (c === current) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = t('Now');
      b.append(tag);
    }
    b.setAttribute('aria-label', `${i + 1}. ${t(c.text)}${done ? ` ${t('(done)')}` : ''}`);
    li.append(b);
    ui.chList.append(li);
  });
}

function setChallengeMenu(open) {
  if (open === !ui.chMenu.hidden) return;
  ui.chMenu.hidden = !open;
  ui.chOpen.setAttribute('aria-expanded', String(open));
  if (!open) return;
  setDropMenu(false);
  renderChallengeList();
  const now = ui.chList.querySelector('.now') ?? ui.chList.querySelector('button');
  now?.scrollIntoView({ block: 'center' });
  now?.focus({ preventScroll: true });
}

ui.chOpen.addEventListener('click', () => {
  ui.chOpen.blur();
  setChallengeMenu(ui.chMenu.hidden);
});
ui.chList.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  challenges.select(b.dataset.id);
  setChallengeMenu(false);
  renderChallenge();
  flash(ui.challenge, 'picked');
});
// Arrow keys move through the list instead of flying the camera.
ui.chMenu.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return;
  e.stopPropagation();
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const items = [...ui.chList.querySelectorAll('button')];
  const at = items.indexOf(document.activeElement);
  items[Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
});
document.addEventListener('pointerdown', (e) => {
  if (!ui.chMenu.hidden && !ui.chMenu.contains(e.target) && !ui.chOpen.contains(e.target)) setChallengeMenu(false);
});

/** Celebrates the challenge a toss did (`c`, if any), and says which others it ticked off along the way. */
let alsoTimer = 0;
function challengeDone(c, also = []) {
  sfx.chime();
  clearTimeout(alsoTimer);
  const sayAlso = () => {
    const text = t(also[0].text);
    toast(also.length > 1 ? t('Also done: {text} (and {n} more)', { text, n: also.length - 1 }) : t('Also done: {text}', { text }), 2600);
  };
  if (!c) {
    sayAlso();
    flash(ui.challenge, 'picked');
    renderChallenge();
    return;
  }
  sfx.voice('cheer');
  toast(t('Challenge done: {text}! +{n}', { text: t(c.text), n: CHALLENGE_BONUS }), 2600);
  ui.chText.textContent = `✔ ${t(c.text)}`;
  flash(ui.challenge, 'done');
  setTimeout(renderChallenge, 1600);
  // (one message at a time: the others wait for the first to go)
  if (also.length) alsoTimer = setTimeout(sayAlso, 2800);
}

ui.chSkip.addEventListener('click', () => {
  ui.chSkip.blur();
  setChallengeMenu(false);
  flash(ui.challenge, 'picked');
  if (challenges.current) challenges.skip();
  else challenges.restart();
  renderChallenge();
});

// ---------------------------------------------------------------- taking turns
// 2–4 players take turns, the same number of tosses each (picked at the
// start); before each turn the house is fixed and Lennie goes back
// downstairs, so everyone starts the same way.
const NAMES_KEY = 'toss-the-lennie:players';
const TOSSES_KEY = 'toss-the-lennie:tosses';
let match = null; // { players: [{ name, color, scores: [] }], turn, tosses }
let setupCount = 2;
let setupTosses = 5;
let savedNames = [];
try { savedNames = JSON.parse(localStorage.getItem(NAMES_KEY) ?? '[]'); } catch { /* ignore */ }
// Older versions saved a blank name as "Player 2" (or "Speler 2"): blank again.
savedNames = Array.isArray(savedNames) ? savedNames.map((n) => (typeof n !== 'string' || /^(Player|Speler) \d$/.test(n) ? '' : n)) : [];
try {
  const t = Number(localStorage.getItem(TOSSES_KEY));
  if (TOSS_CHOICES.includes(t)) setupTosses = t;
} catch { /* ignore */ }

const playerName = (i) => savedNames[i]?.trim() || t(`Player ${i + 1}`);
const matchOver = () => match.players.every((p) => p.scores.length >= match.tosses);
const playerTotal = (p) => p.scores.reduce((a, b) => a + b, 0);

function renderSetup() {
  ui.setup.querySelectorAll('[data-players]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.players) === setupCount)));
  ui.setup.querySelectorAll('[data-tosses]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.tosses) === setupTosses)));
  const values = [...ui.setupNames.querySelectorAll('input')].map((i) => i.value);
  ui.setupNames.innerHTML = '';
  for (let i = 0; i < setupCount; i++) {
    const label = document.createElement('label');
    label.style.setProperty('--player', PLAYER_COLORS[i]);
    const dot = document.createElement('i');
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 14;
    input.placeholder = t(`Player ${i + 1}`);
    input.value = values[i] ?? savedNames[i] ?? '';
    input.setAttribute('aria-label', t(`Name of player ${i + 1}`));
    input.addEventListener('keydown', (e) => {
      // Typing a name mustn't drive the game (Esc still closes the dialog).
      if (e.key !== 'Escape') e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault(); // or the same Enter also presses Go! on the turn card that opens
        ui.setupStart.click();
      }
    });
    label.append(dot, input);
    ui.setupNames.appendChild(label);
  }
}

function setSetup(open) {
  ui.setup.hidden = !open;
  btn.players.setAttribute('aria-expanded', String(open));
  if (open) {
    setHelp(false);
    setDropMenu(false);
    setChallengeMenu(false);
    hideResult();
    renderSetup();
    ui.setupNames.querySelector('input')?.focus({ preventScroll: true });
  }
}

function startMatch() {
  const typed = [...ui.setupNames.querySelectorAll('input')].map((i) => i.value.trim());
  const names = typed.map((name, n) => name || t(`Player ${n + 1}`));
  // (a name left blank stays blank for next time, rather than filling the box with "Player 1")
  savedNames = typed;
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(typed));
    localStorage.setItem(TOSSES_KEY, String(setupTosses));
  } catch { /* ignore */ }
  setSetup(false);
  newMatch(names, setupTosses);
}

function newMatch(names, tosses) {
  stopReplay();
  // A free-play toss still in the air mustn't land as player 1's first score.
  resetAll(false);
  turnPending = true;
  clearTimeout(turnTimer);
  match = { players: names.map((name, i) => ({ name, color: PLAYER_COLORS[i], scores: [] })), turn: 0, tosses };
  renderBoard();
  renderChallenge();
  showTurnCard();
}

function endMatch() {
  match = null;
  turnPending = false;
  ui.hintText.textContent = hintLabel();
  clearTimeout(turnTimer);
  ui.board.hidden = true;
  ui.turnCard.hidden = true;
  renderChallenge();
}

function recordTurn(total) {
  const p = match.players[match.turn];
  p.scores.push(total);
  match.turn = (match.turn + 1) % match.players.length;
  renderBoard();
}

function renderBoard() {
  ui.board.hidden = !match;
  if (!match) return;
  const cur = match.players[match.turn];
  ui.boardRound.textContent = matchOver() ? t('Game over') : t(`Toss ${cur.scores.length + 1} of ${match.tosses}`);
  ui.boardList.innerHTML = '';
  match.players.forEach((p, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--player', p.color);
    if (i === match.turn && !matchOver()) li.className = 'now';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = p.name;
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.textContent = '●'.repeat(p.scores.length) + '○'.repeat(match.tosses - p.scores.length);
    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = fmt(playerTotal(p));
    li.append(name, dots, pts);
    ui.boardList.appendChild(li);
  });
}

/** Between turns: whose turn it is next, or at the end who won. */
function showTurnCard() {
  if (!match || replay.playing) return; // after a replay, endReplay shows it
  // On a phone the score card sits right where the turn card goes; it had its 2.4 s.
  if (resultOverMiddle()) hideResult();
  ui.turnRanking.hidden = true;
  ui.turnAlt.hidden = true;
  if (matchOver()) {
    const ranked = [...match.players].sort((a, b) => playerTotal(b) - playerTotal(a));
    const top = playerTotal(ranked[0]);
    const winners = ranked.filter((p) => playerTotal(p) === top);
    ui.turnCard.style.setProperty('--player', winners[0].color);
    ui.turnKicker.textContent = t('Game over');
    ui.turnTitle.textContent = winners.length > 1 ? t("It's a tie!") : t('{name} wins!', { name: winners[0].name });
    ui.turnSub.textContent = winners.length > 1
      ? t(winners.length > 2 ? '{names} all scored {score}.' : '{names} both scored {score}.', {
        names: `${winners.slice(0, -1).map((p) => p.name).join(', ')} ${t('and')} ${winners.at(-1).name}`,
        score: fmt(top),
      })
      : t('With {score} points from {n} tosses.', { score: fmt(top), n: match.tosses });
    ui.turnRanking.innerHTML = '';
    ranked.forEach((p) => {
      const li = document.createElement('li');
      li.style.setProperty('--player', p.color);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.textContent = fmt(playerTotal(p));
      li.append(name, pts);
      ui.turnRanking.appendChild(li);
    });
    ui.turnRanking.hidden = false;
    ui.turnGo.textContent = t('Play again');
    ui.turnAlt.textContent = t('Back to free play');
    ui.turnAlt.hidden = false;
    ui.turnAlt.dataset.action = 'free';
    // The party once: the card comes back after watching the last toss again.
    if (!match.cheered) {
      match.cheered = true;
      sfx.score(3);
      sfx.voice('cheer');
      setTimeout(() => sfx.chime(), 450);
      // confetti in the winner's colour (and gold), from both sides of the card
      const party = [...winners.map((p) => p.color), ...winners.map((p) => p.color), '#ffc94a', '#ffe08a', '#ffffff'];
      for (const side of [0.3, 0.7]) setTimeout(() => confettiFrom(innerWidth * side, innerHeight * 0.42, party, 40, true), side > 0.5 ? 180 : 0);
    }
  } else {
    const p = match.players[match.turn];
    const first = match.players.every((q) => q.scores.length === 0);
    ui.turnCard.style.setProperty('--player', p.color);
    ui.turnKicker.textContent = first ? t('Game on!') : t(`Toss ${p.scores.length + 1} of ${match.tosses}`);
    ui.turnTitle.textContent = t("{name}'s turn!", { name: p.name });
    const device = t(document.body.classList.contains('touch') ? 'tablet' : 'mouse');
    ui.turnSub.textContent = first ? t('{name} goes first. Ready?', { name: p.name }) : t('Pass the {device} to {name}.', { device, name: p.name });
    ui.turnGo.textContent = t('Go!');
    if (replay.canPlay && !first) {
      ui.turnAlt.textContent = t('Watch the last toss again');
      ui.turnAlt.hidden = false;
      ui.turnAlt.dataset.action = 'replay';
    }
  }
  ui.turnCard.hidden = false;
  ui.turnGo.focus({ preventScroll: true });
}

function beginTurn() {
  ui.turnCard.hidden = true;
  turnPending = false;
  if (!match) return;
  if (matchOver()) {
    newMatch(match.players.map((p) => p.name), match.tosses);
    return;
  }
  resetAll(false);
  hint.on = true;
  const p = match.players[match.turn];
  ui.hintText.textContent = hintLabel();
  toast(t("{name}'s turn!", { name: p.name }), 1400);
}

btn.players.addEventListener('click', () => setSetup(ui.setup.hidden));
ui.setup.querySelectorAll('[data-players]').forEach((b) => b.addEventListener('click', () => {
  setupCount = Number(b.dataset.players);
  renderSetup();
}));
ui.setup.querySelectorAll('[data-tosses]').forEach((b) => b.addEventListener('click', () => {
  setupTosses = Number(b.dataset.tosses);
  renderSetup();
}));
ui.setupStart.addEventListener('click', startMatch);
ui.setupCancel.addEventListener('click', () => setSetup(false));
ui.turnGo.addEventListener('click', beginTurn);
ui.turnAlt.addEventListener('click', () => {
  if (ui.turnAlt.dataset.action === 'free') {
    endMatch();
    toast(t('Free play'), 1200);
  } else {
    ui.turnCard.hidden = true;
    playReplay();
  }
});
ui.boardEnd.addEventListener('click', () => {
  ui.boardEnd.blur();
  endMatch();
  toast(t('Game ended: free play'), 1400);
});

// The Arc buttons: the arc of aimed throws in aim mode, the slingshot's launch angle otherwise.
function changeArc(steps) {
  if (!aim.on) return changeSlingAngle(steps);
  const before = aim.loft;
  aim.loft = clamp(aim.loft + steps * AIM_LOFT.step * 2, AIM_LOFT.min, AIM_LOFT.max);
  drawArcPicture();
  // With no target picked (or the pointer off the scene), no dotted arc shows it.
  if (!aim.pin && !aim.hover) sayArc(steps, aim.loft !== before);
}
drawArcPicture();
ui.aimPad.querySelector('#aim-higher').addEventListener('click', () => changeArc(1));
ui.aimPad.querySelector('#aim-lower').addEventListener('click', () => changeArc(-1));
renderChallenge();
ui.hintText.textContent = hintLabel();

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
  const combo = mult > 1 ? ` · <b>×${fixed(mult, 2)}</b>` : '';
  const plural = (n, w) => t(`${n} ${w}${n === 1 ? '' : 's'}`);
  let status;
  if (sling) {
    const arc = t(document.body.classList.contains('touch') ? '▲ ▼ arc' : 'scroll: arc');
    status = slingShot()
      ? t('<b>Let go</b> to throw · pull more to go further · {arc}', { arc })
      : t('Pull Lennie <b>back</b>, away from where he should go');
  } else if (toss.state === 'held') {
    status = t("Holding Lennie's <b>{part}</b>. Flick and let go!", { part: t(grab?.part.label ?? 'limb') }) + combo;
  } else if (toss.state === 'flying') {
    const bits = [plural(toss.bounces, 'bounce')];
    if (toss.juggles) bits.push(plural(toss.juggles, 'juggle'));
    if (toss.smashed) bits.push(plural(toss.smashed, 'window'));
    if (toss.doors) bits.push(plural(toss.doors, 'door'));
    if (toss.tv) bits.push(t('TV'));
    if (toss.zaps) bits.push(plural(toss.zaps, 'zap'));
    if (toss.cars) bits.push(plural(toss.cars, 'car'));
    if (toss.stairs.size) bits.push(plural(toss.stairs.size, 'step'));
    status = t('Flying! {bits}', { bits: bits.join(' · ') }) + combo;
  } else {
    const where = sayWhere(lennie.center(_center));
    const place = `<b>${where[0].toUpperCase()}${where.slice(1)}</b>`;
    status = toss.state === 'scored' ? t('Scored! Landed {where}.', { where }) : t('{place} · grab Lennie, pull back and let go!', { place });
    if (aim.on && !hoverPart) {
      const problem = aim.shot?.tooFar ? 'too far' : aim.shot?.blocked ? 'something is in the way' : '';
      const warn = problem ? ` · <b>${t(problem)}</b>` : '';
      status = document.body.classList.contains('touch')
        ? (aim.pin ? t('<b>Aim</b>: tap the ring again to throw · tap elsewhere to aim again') + warn : t('<b>Aim</b>: tap where Lennie should go'))
        : t('<b>Aim</b>: click where Lennie should go · scroll: arc') + warn;
    }
  }
  if (ui.status.innerHTML !== status) ui.status.innerHTML = status;
}

// ---------------------------------------------------------------- main loop
let acc = 0;
let last = performance.now();
const bodies = lennie.bodies;

let airTone = 0; // 0 to 1: how far his muscles relax into the floating pose (lennie.tense)
/** Did the last physics step have Lennie touching anything but himself? */
function touchingAnything() {
  for (const c of world.contacts) {
    if (lennieBodies.has(c.bi) !== lennieBodies.has(c.bj)) return true;
  }
  return false;
}

function stepPhysics(h) {
  // Fast-moving limbs get smaller steps so they don't sink deep into walls.
  const n = lennie.maxSpeed() > FAST_SUBSTEP_SPEED ? 2 : 1;
  for (let i = 0; i < n; i++) subStep(h / n);
}

function subStep(h) {
  const hold = grab ?? sling;
  if (hold) {
    const hp = handBody.position;
    const v = new CANNON.Vec3((hold.target.x - hp.x) / h, (hold.target.y - hp.y) / h, (hold.target.z - hp.z) / h);
    const sp = v.length();
    if (sp > MAX_HAND_SPEED) v.scale(MAX_HAND_SPEED / sp, v);
    handBody.velocity.copy(v);
  }
  bodies.forEach((b, i) => preStep[i].copy(b.velocity));
  lennie.tense(h, airTone);
  world.step(h);
  // In the air (touching nothing) his limbs drift to their relaxed pose; it
  // lets go quickly once he lands, so it never untangles him on the ground.
  const inAir = toss.state === 'flying' && !hold && !touchingAnything();
  airTone += ((inAir ? 1 : 0) - airTone) * (1 - Math.exp(-h / (inAir ? 0.2 : 0.06)));
  if (airTone < 0.01 && !inAir) airTone = 0;
  if (pendingBreaks.size) {
    // Lennie crashes through: undo this step's bounce, minus a little drag
    // (more for a door, less for the one he was aimed through).
    const aimed = aim.through && pendingBreaks.has(aim.through);
    const keep = aimed ? THROUGH_KEEP : [...pendingBreaks].some((p) => p.kind === 'door') ? 0.65 : 0.8;
    bodies.forEach((b, i) => preStep[i].scale(keep, b.velocity));
    for (const piece of pendingBreaks) smash(piece);
    pendingBreaks.clear();
    aim.guide = null;
    if (aimed) aim.through = null;
  }
  if (carHit) {
    launchByCar(carHit);
    carHit = null;
  }
  if (trampHit) {
    launchByTrampoline(trampHit);
    trampHit = 0;
  }
  effects.afterStep();
  if (aim.lift) guideLift();
  else if (aim.guide) guideLaunch();
  const guarded = guard.check();
  if (guarded === 'lost') rescueLost();
  else if (guarded === 'rescued' && hold) {
    // Put back in one piece while held: the hand starts again from the
    // limb, rather than going on tugging it apart from where it got to.
    hold.part.body.pointToWorldFrame(hold.local, handBody.position);
    handBody.velocity.setZero();
  } else if (bodies.some((b) => outsideArea(b.position, 0.3))) putBackNearEdge();
}

// The play area (yard.js): the invisible walls stand just outside these lines,
// and fill the blocked-off ground behind the row (YARD.out).
const AREA = { x0: -YARD.half, x1: YARD.half, z0: -YARD.half, z1: YARD.front };
/** How far p is from rectangle r (x/z ranges): negative inside it. */
function rectDistance(p, r) {
  const dx = Math.max(r.x0 - p.x, p.x - r.x1);
  const dz = Math.max(r.z0 - p.z, p.z - r.z1);
  if (dx <= 0 && dz <= 0) return Math.max(dx, dz);
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
}
/** Is p outside the play area by more than slack? (A negative slack: within that of its edge.) */
function outsideArea(p, slack = 0) {
  if (p.x < AREA.x0 - slack || p.x > AREA.x1 + slack || p.z < AREA.z0 - slack || p.z > AREA.z1 + slack) return true;
  return YARD.out.some((r) => rectDistance(p, r) < -slack);
}

/**
 * Lennie got out of the play area (a fast limb slipped through an invisible
 * wall): stand him on the ground just inside, as close as possible to where he
 * left. Returns false if there's no free spot nearby.
 */
const EDGE_INSET = 1.2;
function putBackNearEdge() {
  const c = lennie.center(_center);
  const inX = (x) => clamp(x, AREA.x0 + EDGE_INSET, AREA.x1 - EDGE_INSET);
  const inZ = (z) => clamp(z, AREA.z0 + EDGE_INSET, AREA.z1 - EDGE_INSET);
  const bx = inX(c.x);
  const bz = inZ(c.z);
  const tried = new Set();
  // the nearest spot first, then rings around it, keeping only open ground
  // (far enough to get from deep in a neighbour's garden back to Lennie's)
  for (let r = 0; r <= 20; r += 1) {
    const n = r === 0 ? 1 : 8 + r * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = inX(bx + Math.cos(a) * r);
      const z = inZ(bz + Math.sin(a) * r);
      const key = `${x.toFixed(1)},${z.toFixed(1)}`;
      if (tried.has(key)) continue;
      tried.add(key);
      if (outsideArea({ x, z }, -EDGE_INSET)) continue; // behind the row: out of bounds
      _from.set(x, 25, z);
      _to.set(x, -1, z);
      _rayHit.reset();
      if (!world.raycastClosest(_from, _to, SCENERY_ONLY, _rayHit)) continue;
      const ground = _rayHit.hitPointWorld.y;
      if (ground > 0.6) continue; // a roof, a car, a hedge: not the ground
      lennie.reset({ x, z, height: ground + 0.05, yaw: Math.atan2(bx - c.x, bz - c.z) });
      if (bodies.some((b) => guard.isEmbedded(b.position))) continue;
      placedBack("Lennie left the play area, so he's back by the edge");
      return true;
    }
  }
  return false;
}

/** After teleporting Lennie: the same tidy-up as dropping him in. */
function placedBack(message) {
  if (grab) endGrab();
  endSling(false);
  stopReplay();
  replay.stop(false);
  guard.forget();
  aim.guide = aim.through = aim.lift = null;
  nudge();
  lennie.setExpression('normal');
  toss.state = 'idle';
  resetChain();
  hideResult();
  focusLennie(0.8);
  toast(t(message), 1800);
}

// Last resort when Lennie is stuck in the scenery with no good pose to go back to.
function rescueLost() {
  if (bodies.some((b) => outsideArea(b.position, 0.05)) && putBackNearEdge()) return;
  if (putBackNearby()) return;
  // Nowhere free close by: back to where you'd drop him on this floor.
  const c = lennie.center(_center);
  const level = shop.isInside(c) ? SHOP_DROP : Math.min(2, house.levelOf(c));
  dropLennie(level);
  toast(t("Lennie got stuck, so he's back on {where}", { where: t(LEVEL_NAMES[level]) }), 1800);
}

/** Ray from (ax, ay, az) to (bx, by, bz): does it hit any scenery? */
function blocked(ax, ay, az, bx, by, bz) {
  _from.set(ax, ay, az);
  _to.set(bx, by, bz);
  _rayHit.reset();
  return world.raycastClosest(_from, _to, SCENERY_ONLY, _rayHit);
}

/**
 * Lennie got stuck: stand him up on the nearest free bit of floor (or table,
 * or bed...) around where he is, rather than sending him back to the start.
 * Spots he can be seen from, so not behind a wall, come first. Returns false
 * if there's no room for him anywhere nearby.
 */
const NEARBY_MAX = 5; // metres to look around him
const NEARBY_STEP = 0.4;
const BODY_R = 0.32; // half Lennie's width, arms included
const BODY_H = 1.9; // Lennie standing up
const _probe = new CANNON.Vec3();
function putBackNearby() {
  const c = lennie.center(_center).clone();
  const fits = (x, ground, z) => {
    // headroom straight up, then his width at knees, hips, chest and head
    if (blocked(x, ground + 0.05, z, x, ground + BODY_H + 0.05, z)) return false;
    for (const h of [0.35, 0.9, 1.4, 1.8]) {
      const y = ground + h;
      if (guard.isEmbedded(_probe.set(x, y, z))) return false;
      if (blocked(x, y, z, x + BODY_R, y, z) || blocked(x, y, z, x - BODY_R, y, z)) return false;
      if (blocked(x, y, z, x, y, z + BODY_R) || blocked(x, y, z, x, y, z - BODY_R)) return false;
    }
    return true;
  };
  // How far a spot is: a step up or down counts double, so stuck in a shelf
  // he goes on the floor beside it rather than on top of it.
  const feet = Math.min(...bodies.map((b) => b.position.y)) - 0.2;
  const found = [];
  let bestSeen = Infinity;
  for (let r = 0; r <= NEARBY_MAX && r <= bestSeen; r += NEARBY_STEP) {
    const n = r === 0 ? 1 : Math.ceil((Math.PI * 2 * r) / NEARBY_STEP);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (outsideArea({ x, z }, -EDGE_INSET)) continue;
      // the floor (or whatever he'd land on) below this spot, near his height
      if (!blocked(x, c.y + 0.6, z, x, c.y - 3, z)) continue;
      const ground = _rayHit.hitPointWorld.y;
      if (!fits(x, ground, z)) continue;
      const seen = !blocked(c.x, c.y, c.z, x, ground + 1.0, z);
      const far = Math.hypot(r, 2 * (ground - feet));
      if (seen) bestSeen = Math.min(bestSeen, far);
      found.push({ x, ground, z, far: seen ? far : far + 100 }); // behind a wall: only if nothing else
    }
  }
  found.sort((p, q) => p.far - q.far);
  return found.slice(0, 8).some((s) => standAt(s.x, s.ground, s.z, c));
}

function standAt(x, ground, z, from) {
  lennie.reset({ x, z, height: ground + 0.05, yaw: Math.atan2(x - from.x, z - from.z) });
  if (bodies.some((b) => guard.isEmbedded(b.position))) return false;
  placedBack("Lennie got stuck, so he's on a free spot nearby");
  return true;
}

// What the cars need to know about Lennie, and the sounds they make.
const carWatch = {
  bodies,
  get flying() {
    return toss.state === 'flying' && !grab && !sling;
  },
};
let lastHonkPopAt = 0;
const carSounds = {
  honk(car, at) {
    sfx.honk();
    const now = performance.now();
    if (now - lastHonkPopAt > 1500) {
      lastHonkPopAt = now;
      popAt(at, pickLine(HONK_LINES));
    }
  },
  pass(car, strength) {
    sfx.carPass(strength);
  },
};

function frame(now) {
  requestAnimationFrame(frame);
  // Never negative: the first frame's time can lie before `last` (the browser
  // stamped that frame while the game was still being built, which takes
  // seconds on a slow tablet). A negative step sent the camera flying off, to
  // end up 32 m behind the house, drawing the whole neighbourhood at once.
  const seconds = Math.max(0, (now - last) / 1000);
  const dt = Math.min(seconds, 0.1);
  last = now;
  watchSpeed(seconds);
  tick(dt, now);
  // The first picture is on screen: "Lennie is on his way…" (index.html) can go.
  if (loading) {
    loading.remove();
    loading = null;
    // (now, while the game is still starting, rather than the first time a wall fades)
    // (and with the far copies in the picture, so the first trip across the road doesn't stall either)
    house.farView.visible = shop.farView.visible = true;
    prewarmFades(renderer, scene, camera, [...house.fadeMaterials(), ...shop.fadeMaterials()]);
    house.farView.visible = house.far;
    shop.farView.visible = shop.far;
    // Products only drawn once knocked (products.js bakes them in place): their
    // pictures go to the graphics chip now, not all at once when a shelf comes down.
    scene.traverse((o) => {
      if (o.isInstancedMesh && o.userData.products) for (const m of [].concat(o.material)) if (m.map) renderer.initTexture(m.map);
    });
  }
}
let loading = $('loading');

function tick(dt, now) {
  if (replay.playing) {
    // The physics waits while the replay moves Lennie's visible parts.
    replayCenter = replay.update(dt);
    if (!replayCenter) endReplay();
  } else {
    acc += dt;
    const start = performance.now();
    let steps = 0;
    while (acc >= FIXED_DT && steps < 12) {
      stepPhysics(FIXED_DT * timeScale);
      acc -= FIXED_DT;
      steps++;
      if (performance.now() - start > PHYSICS_BUDGET) break;
    }
    // Behind: let the time go rather than catching up on the next frames.
    if (acc >= FIXED_DT) acc = 0;
    lennie.sync();
    updateToss(dt * timeScale);
    replay.capture(steps * FIXED_DT * timeScale); // the physics time, which falls behind on a slow device
  }
  lennie.update(dt);
  updateGrabVisual();
  updateSettleFocus(dt);
  updateViewShift(dt);
  updateCamera(dt);
  updateAim();
  updateHint();
  house.updateView(camera, controls.target, dt, cutaway);
  shop.updateView(camera, controls.target, dt);
  lennieOnScreen(_seeCenter);
  seeThrough.update(camera, _seeCenter, dt, house.ceilingOver(_seeCenter, camera));
  blobShadow.update(lennieOnScreen(_blobCenter));
  updateShards(dt * timeScale);
  zap.update(dt * timeScale, !replay.playing);
  effects.update(dt * timeScale, !replay.playing);
  cat.update(dt * timeScale);
  if (!replay.playing) {
    shop.update(dt * timeScale);
    house.update(dt * timeScale);
    smashedDishes();
    cars.update(dt * timeScale, carWatch, carSounds);
  }
  updateHud(dt, now);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Handy for debugging from the console. advance() runs the game loop by hand,
// e.g. when the tab is in the background and requestAnimationFrame is paused.
window.lennie = {
  lennie, world, camera, controls, toss, stats, house, shop, guard, aim, aimRing, zap, effects, trolley, cars, cat, replay, renderer,
  FEEL, launch, dropLennie, // (throw him at a THREE.Vector3 velocity, put him back on a floor)
  simpleShading, setSimpleShading: (on) => setSimpleShading(on, scene), // (the scenery without its shine, as on a slow device)
  holdQuality, quality: () => quality, // (the step of sharpness and shading the game is at; hold it at one for measuring)
  pictures: pictureCount, sizeOf, // (how many pictures still hold a canvas, and a texture's size without drawing it again: see pictures.js)
  slingLift, aimLift, launchLift, centerOfMass, // (the helping hand up the stairs: plan a throw, then throw him as planned)
  advance(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60, performance.now());
  },
};
