import * as CANNON from 'cannon-es';
import { HAND_OFFSET, FOOT_OFFSET } from './ragdoll.js';
import { t, fixed } from './i18n.js';

const POINTS_PER_JOINT = 120;
const DEAD_ZONE = 0.3; // a joint bent less than this fraction of its range is just "relaxed"
const MAX_STRAIN = 1.5;
const DOWN = new CANNON.Vec3(0, -1, 0);
const _q = new CANNON.Quaternion();
const _rel = new CANNON.Quaternion();

/** Angle (radians) between a joint's current relative rotation and its rest pose. */
export function jointAngle(joint) {
  joint.bodyA.quaternion.conjugate(_q);
  _q.mult(joint.bodyB.quaternion, _rel);
  return 2 * Math.acos(Math.min(1, Math.abs(_rel.w)));
}

export function measureContortion(ragdoll) {
  let weighted = 0;
  let weights = 0;
  let points = 0;
  const joints = ragdoll.joints.map((j) => {
    const theta = jointAngle(j);
    const norm = theta / j.range;
    const strain = Math.min(MAX_STRAIN, Math.max(0, (norm - DEAD_ZONE) / (1 - DEAD_ZONE)));
    weighted += Math.min(strain, 1) * j.weight;
    weights += j.weight;
    points += j.weight * strain ** 2 * POINTS_PER_JOINT;
    return { label: j.label, theta, norm };
  });
  return { percent: (weighted / weights) * 100, points, joints };
}

/** Recognisable silly poses, each worth a bonus. */
export function detectTricks(ragdoll) {
  const P = ragdoll.parts;
  const tricks = [];
  const head = P.head.body.position;
  const pelvis = P.pelvis.body;
  const chest = P.chest.body;
  const footL = P.lowerLegL.body.pointToWorldFrame(FOOT_OFFSET);
  const footR = P.lowerLegR.body.pointToWorldFrame(FOOT_OFFSET);
  const handL = P.lowerArmL.body.pointToWorldFrame(HAND_OFFSET);
  const handR = P.lowerArmR.body.pointToWorldFrame(HAND_OFFSET);

  if (head.y < pelvis.position.y - 0.2) tricks.push({ id: 'upside', label: 'Upside down!', value: 200 });

  const legL = P.upperLegL.body.quaternion.vmult(DOWN);
  const legR = P.upperLegR.body.quaternion.vmult(DOWN);
  if (Math.acos(Math.max(-1, Math.min(1, legL.dot(legR)))) > 1.7) tricks.push({ id: 'splits', label: 'The splits!', value: 150 });

  // A foot or hand counts as crossed over only when it's well past the middle,
  // so a slightly pigeon-toed landing doesn't score.
  const fl = pelvis.pointToLocalFrame(footL);
  const fr = pelvis.pointToLocalFrame(footR);
  const crossL = fl.x < -0.1;
  const crossR = fr.x > 0.1;
  if (crossL && crossR) tricks.push({ id: 'pretzel', label: 'Pretzel legs!', value: 200 });
  else if (crossL || crossR) tricks.push({ id: 'crossed', label: 'Crossed legs', value: 40, small: true });

  const hl = chest.pointToLocalFrame(handL);
  const hr = chest.pointToLocalFrame(handR);
  const tangledL = hl.x < -0.12 || hl.z < -0.22;
  const tangledR = hr.x > 0.12 || hr.z < -0.22;
  if (tangledL && tangledR) tricks.push({ id: 'straitjacket', label: 'Straitjacket!', value: 200 });
  else if (tangledL || tangledR) tricks.push({ id: 'tangled', label: 'Tangled arm', value: 40, small: true });

  if (Math.min(footL.distanceTo(head), footR.distanceTo(head)) < 0.42) tricks.push({ id: 'footface', label: 'Foot in face!', value: 200 });

  // Two of the big ones at once; the small crossed leg and tangled arm don't count.
  // (Three at once never happened in ~150 test tosses; two comes up about one toss in twenty.)
  if (tricks.filter((t) => !t.small).length >= 2) tricks.push({ id: 'knot', label: 'Human knot!', value: 400 });
  return tricks;
}

// What a toss is called, by its score. An ordinary toss scores about 1,000 and
// the best one in ten about 2,500 (60 test tosses from all over the map), so
// the top names stay rare: with the old, lower steps every fifth toss was a legend.
const RATINGS = [
  [300, 'Barely bent'],
  [700, 'Mildly crumpled'],
  [1200, 'Properly pretzeled'],
  [1800, 'Gloriously gnarled'],
  [2800, 'Spaghetti supreme'],
  [Infinity, 'Lennie legend'],
];

/** Multiplier earned during a toss; shared by the live HUD and the final score. */
export function chainMultiplier(chain) {
  return Math.min(4, 1 + 0.1 * chain.bounces + 0.25 * chain.juggles + 0.3 * chain.smashed + 0.4 * chain.doors);
}

// A toss has to be a proper fling to score in full. Lying in a heap already
// counts as some 45% contorted, and often as a trick or two, so letting Lennie
// flop over after the tiniest pull scored like any other toss: 500 to 1,000,
// now and then 1,600. `chain.fling` says how hard he was thrown, as a speed:
// the speed he was let go at, or most of the top speed he reached later (a
// long fall, a car). From `full` m/s on nothing changes; below it the score
// shrinks, down to `least` of it at the gentlest throw the slingshot gives.
// (The shortest pull there is throws him at 4.7 m/s, a pull of a quarter of
// full power at 6, and aim mode never throws slower than that.)
const GENTLE = { slow: 4.5, full: 6, least: 0.25 };

/** What's left of the score of a toss thrown at `speed` m/s: 1 for a proper fling, less for a gentle one. */
export function gentleFactor(speed) {
  const effort = Math.min(1, Math.max(0, (speed - GENTLE.slow) / (GENTLE.full - GENTLE.slow)));
  // (in steps of 0.05, so the score card's sum is the one shown)
  return Math.round((GENTLE.least + (1 - GENTLE.least) * effort) * 20) / 20;
}

/**
 * Scores a finished toss. `chain` holds what happened during the flight:
 * { bounces, juggles, smashed, doors, fling, bonuses: [{ label, value }] }, where
 * bonuses are the house-specific feats (falling floors, stairs, defenestration...).
 */
export function evaluateToss(ragdoll, chain) {
  const c = measureContortion(ragdoll);
  const tricks = [...detectTricks(ragdoll), ...chain.bonuses];
  // (the score card's lines in the current language; the tricks keep their English labels)
  const lines = [{ label: t(`Contortion ${Math.round(c.percent)}%`), value: Math.round(c.points) }];
  for (const trick of tricks) lines.push({ ...trick, label: t(trick.label), trick: true });

  const base = c.points + tricks.reduce((sum, trick) => sum + trick.value, 0);
  const mult = chainMultiplier(chain);
  const plural = (n, word) => t(`${n} ${word}${n === 1 ? '' : 's'}`);
  const multParts = [];
  if (chain.bounces) multParts.push(plural(chain.bounces, 'bounce'));
  if (chain.juggles) multParts.push(plural(chain.juggles, 'juggle'));
  if (chain.smashed) multParts.push(plural(chain.smashed, 'window'));
  if (chain.doors) multParts.push(plural(chain.doors, 'door'));
  if (mult > 1) lines.push({ label: multParts.join(' · '), value: `×${fixed(mult, 2)}`, mult: true });
  const gentle = gentleFactor(chain.fling ?? Infinity);
  if (gentle < 1) lines.push({ label: t('Gentle toss'), value: `×${fixed(gentle, 2)}`, mult: true, gentle: true });

  const total = Math.round(base * mult * gentle);
  const worst = c.joints.reduce((a, b) => (b.norm > a.norm ? b : a));
  const rating = t(RATINGS.find(([max]) => total < max)[1]);
  return { total, base, mult, gentle, percent: c.percent, lines, tricks, worst, rating };
}
