import * as CANNON from 'cannon-es';
import { HAND_OFFSET, FOOT_OFFSET } from './ragdoll.js';

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

  if (head.y < pelvis.position.y - 0.2) tricks.push({ label: 'Upside down!', value: 200 });

  const legL = P.upperLegL.body.quaternion.vmult(DOWN);
  const legR = P.upperLegR.body.quaternion.vmult(DOWN);
  if (Math.acos(Math.max(-1, Math.min(1, legL.dot(legR)))) > 1.7) tricks.push({ label: 'The splits!', value: 150 });

  const fl = pelvis.pointToLocalFrame(footL);
  const fr = pelvis.pointToLocalFrame(footR);
  const crossL = fl.x < -0.02;
  const crossR = fr.x > 0.02;
  if (crossL && crossR) tricks.push({ label: 'Pretzel legs!', value: 160 });
  else if (crossL || crossR) tricks.push({ label: 'Crossed legs', value: 70 });

  const hl = chest.pointToLocalFrame(handL);
  const hr = chest.pointToLocalFrame(handR);
  const tangledL = hl.x < -0.04 || hl.z < -0.17;
  const tangledR = hr.x > 0.04 || hr.z < -0.17;
  if (tangledL && tangledR) tricks.push({ label: 'Straitjacket!', value: 180 });
  else if (tangledL || tangledR) tricks.push({ label: 'Tangled arm', value: 70 });

  if (Math.min(footL.distanceTo(head), footR.distanceTo(head)) < 0.42) tricks.push({ label: 'Foot in face!', value: 200 });

  if (tricks.length >= 3) tricks.push({ label: 'Human knot!', value: 250 });
  return tricks;
}

const RATINGS = [
  [150, 'Barely bent'],
  [400, 'Mildly crumpled'],
  [800, 'Properly pretzeled'],
  [1400, 'Gloriously gnarled'],
  [2200, 'Spaghetti supreme'],
  [Infinity, 'Lennie legend'],
];

/** Multiplier earned during a toss; shared by the live HUD and the final score. */
export function chainMultiplier(chain) {
  return Math.min(4, 1 + 0.1 * chain.bounces + 0.25 * chain.juggles + 0.3 * chain.smashed + 0.4 * chain.doors);
}

/**
 * Scores a finished toss. `chain` holds what happened during the flight:
 * { bounces, juggles, smashed, doors, bonuses: [{ label, value }] }, where bonuses
 * are the house-specific feats (falling floors, stairs, defenestration...).
 */
export function evaluateToss(ragdoll, chain) {
  const c = measureContortion(ragdoll);
  const tricks = [...detectTricks(ragdoll), ...chain.bonuses];
  const lines = [{ label: `Contortion ${Math.round(c.percent)}%`, value: Math.round(c.points) }];
  for (const t of tricks) lines.push({ ...t, trick: true });

  const base = c.points + tricks.reduce((sum, t) => sum + t.value, 0);
  const mult = chainMultiplier(chain);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const multParts = [];
  if (chain.bounces) multParts.push(plural(chain.bounces, 'bounce'));
  if (chain.juggles) multParts.push(plural(chain.juggles, 'juggle'));
  if (chain.smashed) multParts.push(plural(chain.smashed, 'window'));
  if (chain.doors) multParts.push(plural(chain.doors, 'door'));
  if (mult > 1) lines.push({ label: multParts.join(' · '), value: `×${mult.toFixed(2)}`, mult: true });

  const total = Math.round(base * mult);
  const worst = c.joints.reduce((a, b) => (b.norm > a.norm ? b : a));
  const rating = RATINGS.find(([max]) => total < max)[1];
  return { total, base, mult, percent: c.percent, lines, tricks, worst, rating };
}
