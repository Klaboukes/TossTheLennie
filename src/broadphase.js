// The physics' bookkeeping, done the cheap way. Nothing here changes what
// happens in the game: the same things touch at the same moments. It only
// stops cannon-es from doing work that can't lead to anything, which was more
// than half of what each physics step cost. On a low-end tablet the physics is
// the biggest part of a frame while Lennie flies, so this is what keeps a
// toss smooth there.
//
// A few things, all set up by tunePhysics(world):
//
// - Which bodies are worth a closer look (NearbyBroadphase). The world is
//   some 500 boxes that never move and Lennie's dozen parts. cannon's own
//   rough test puts a ball around each body, and the ball around a long wall or
//   a floor is as big as the house: Lennie "might touch" well over a hundred
//   things at any moment, and each of those went on to the exact, slow test.
//   Here the rough test is a box around each body instead, and only the
//   scenery near Lennie is looked at at all. Two bodies whose boxes don't
//   overlap can't touch, so nothing is missed. (Checked by running both ways
//   side by side over a few dozen tosses: every contact the old way found, the
//   new way had as a pair too, in the same order.)
//
// - Remembering who touched whom in the last step (PairSet), which is how
//   cannon knows a bump is new (the "collide" event the sounds, the scoring and
//   the breaking glass all hang on). cannon keeps a table with a cell for every
//   two bodies, some 137,000 cells here, and wiped all of it every step. Only a
//   handful of pairs touch at any time, so a short list of those does the same.
//
// - Not going through all the scenery over and over (Lists, MoversSolver, and
//   the rest of NearbyBroadphase). cannon walks every body in the world some
//   ten times a step, and all but a few dozen are scenery for which there's
//   nothing to do. So the solver and the wiping of forces only go through the
//   bodies that can move, the scenery around Lennie is picked out once and
//   kept while he stays near it, and rays find the scenery in their way from
//   a row of plain numbers.
//
// Change anything here and check it with scripts/tablet/same.mjs: it plays
// twenty tosses with the dice fixed, in the old version and the new, and
// they must end the same to the last digit. (It caught a window that went on
// being bumped into for a moment after it broke.)
import * as CANNON from 'cannon-es';

const { STATIC, DYNAMIC, SLEEPING } = CANNON.Body;
// Boxes this close count as overlapping. Something standing exactly on the
// ground has its box end a rounding error above it (1.7e-17 m, for the clothes
// rack), while cannon's exact test, with its own rounding, says they touch.
// Without this that contact came and went.
const SLOP = 0.001;
// The scenery around the awake bodies is picked out for a region this much
// wider than they are (metres), and again once they're within EDGE of its
// side: more than the fastest limb goes in a step (20 m/s, 17 cm), so
// they're still inside it when the step is done.
const PAD = 1.2;
const EDGE = 0.3;
const REFRESH = 30; // steps (a quarter of a second) after which it's picked out again regardless

/** Do the boxes around bodies a and b overlap (or as good as touch)? */
function boxesOverlap(a, b) {
  const al = a.aabb.lowerBound;
  const au = a.aabb.upperBound;
  const bl = b.aabb.lowerBound;
  const bu = b.aabb.upperBound;
  return al.x <= bu.x + SLOP && bl.x <= au.x + SLOP && al.y <= bu.y + SLOP && bl.y <= au.y + SLOP && al.z <= bu.z + SLOP && bl.z <= au.z + SLOP;
}

/**
 * Finds the pairs of bodies that might be touching, in the same order as
 * cannon's NaiveBroadphase would (the order matters a little to how the
 * contacts are solved), but far fewer of them.
 *
 * Only pairs with a moving body in them are looked at: the scenery can't bump
 * into itself. (cannon's sort-and-sweep broadphase would do that too, but it
 * breaks on the endless planes around the play area.)
 */
export class NearbyBroadphase extends CANNON.NaiveBroadphase {
  #near = []; // this step's bodies worth testing against: everything that moves, and the scenery near what's awake
  #placed = new WeakMap(); // scenery body -> where it was when its box was last worked out
  // Going through all ~520 pieces of scenery every step was a good part of
  // what a step cost. So the scenery around the awake bodies is picked out
  // once (#close, everything within PAD of them) and used for as long as they
  // stay inside that region: a handful of steps in flight, for ever at rest.
  #lists; // the world's bodies, split into the ones that can move and the scenery (Lists)
  #close = []; // the scenery in #region, in the world's order
  #region = null; // { x0, y0, z0, x1, y1, z1 }: the box #close was picked for
  #age = 0; // steps since then
  #closeOf = -1; // which making of the lists #close was picked from (a body coming or going makes them again)
  #boxes = null; // the boxes of all the scenery as plain numbers, six each (aabbQuery)
  #boxesOf = -1; // which making of the lists they're from

  constructor(lists) {
    super();
    this.#lists = lists;
  }

  /**
   * The scenery that can reach into the box (x0, y0, z0)-(x1, y1, z1), and
   * maybe some more; null if that isn't known for this box right now (then
   * look through all the scenery). For the stuck check (guard.js).
   */
  sceneryAround(x0, y0, z0, x1, y1, z1) {
    const r = this.#region;
    if (!r || this.#lists.stale || this.#closeOf !== this.#lists.made || x0 < r.x0 || y0 < r.y0 || z0 < r.z0 || x1 > r.x1 || y1 > r.y1 || z1 > r.z1) return null;
    return this.#close;
  }

  /** Makes sure a scenery body's box is where the body is (it's worked out once, unless the body is moved). */
  #settle(b) {
    const p = b.position;
    const q = b.quaternion;
    let at = this.#placed.get(b);
    if (!at) this.#placed.set(b, (at = { x: NaN, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 0 }));
    else if (!b.aabbNeedsUpdate && at.x === p.x && at.y === p.y && at.z === p.z && at.qx === q.x && at.qy === q.y && at.qz === q.z && at.qw === q.w) return;
    b.updateAABB();
    at.x = p.x; at.y = p.y; at.z = p.z;
    at.qx = q.x; at.qy = q.y; at.qz = q.z; at.qw = q.w;
  }

  /**
   * The bodies whose box overlaps `aabb`, in the world's order, as cannon's
   * own does it: this is what every ray starts with (the spot under Lennie,
   * the cat looking for him, each dot of the aiming arc). cannon's asks all
   * ~520 pieces of scenery for their box, one object after another; here the
   * scenery's boxes sit in one row of plain numbers, which is many times
   * quicker to run through.
   */
  aabbQuery(world, aabb, result = []) {
    const fixed = this.#lists.fixed;
    const movers = this.#lists.movers;
    if (this.#boxesOf !== this.#lists.made) {
      this.#boxesOf = this.#lists.made;
      this.#boxes = new Float64Array(fixed.length * 6);
      for (let i = 0; i < fixed.length; i++) {
        this.#settle(fixed[i]);
        const l = fixed[i].aabb.lowerBound;
        const u = fixed[i].aabb.upperBound;
        this.#boxes.set([l.x, l.y, l.z, u.x, u.y, u.z], i * 6);
      }
    }
    const boxes = this.#boxes;
    const { x: lx, y: ly, z: lz } = aabb.lowerBound;
    const { x: ux, y: uy, z: uz } = aabb.upperBound;
    const start = result.length;
    for (let i = 0, k = 0; i < fixed.length; i++, k += 6) {
      if (boxes[k] <= ux && boxes[k + 3] >= lx && boxes[k + 1] <= uy && boxes[k + 4] >= ly && boxes[k + 2] <= uz && boxes[k + 5] >= lz) result.push(fixed[i]);
    }
    let mixed = false;
    for (let i = 0; i < movers.length; i++) {
      const b = movers[i];
      if (b.aabbNeedsUpdate) b.updateAABB();
      if (!b.aabb.overlaps(aabb)) continue;
      result.push(b);
      mixed = true;
    }
    // (back into the world's order: of two things a ray hits equally far off, the first one counts)
    if (mixed) {
      const found = result.splice(start).sort((a, b) => a.index - b.index);
      for (const b of found) result.push(b);
    }
    return result;
  }

  collisionPairs(world, pairs1, pairs2) {
    const movers = this.#lists.movers;
    const changed = this.#closeOf !== this.#lists.made; // a body came or went since #close was picked
    const n = movers.length;
    const near = this.#near;
    near.length = 0;

    // The box around everything that's awake and can be pushed about (Lennie,
    // and a chair or bike he has just knocked over). Scenery outside it can't
    // be touching any of them. A body that's awake gets its box worked out
    // afresh every step, also right after it was put somewhere else by hand.
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const b = movers[i];
      if (!b.shapes.length) continue;
      const awake = b.sleepState !== SLEEPING;
      if (awake || b.aabbNeedsUpdate) b.updateAABB();
      if (!awake || b.type !== DYNAMIC) continue;
      const l = b.aabb.lowerBound;
      const u = b.aabb.upperBound;
      if (l.x < x0) x0 = l.x;
      if (l.y < y0) y0 = l.y;
      if (l.z < z0) z0 = l.z;
      if (u.x > x1) x1 = u.x;
      if (u.y > y1) y1 = u.y;
      if (u.z > z1) z1 = u.z;
    }
    x0 -= SLOP; y0 -= SLOP; z0 -= SLOP;
    x1 += SLOP; y1 += SLOP; z1 += SLOP;

    // The scenery around them: picked out afresh when they've left the region
    // it was picked for (or got within EDGE of its side, so that they're still
    // inside it after this step, for the stuck check), when a body came or
    // went, and every so often anyway, in case a piece of scenery was moved.
    const r = this.#region;
    const nothing = x0 > x1; // (nothing awake)
    if (!r || changed || ++this.#age > REFRESH
      || (!nothing && (x0 < r.x0 + EDGE || y0 < r.y0 + EDGE || z0 < r.z0 + EDGE || x1 > r.x1 - EDGE || y1 > r.y1 - EDGE || z1 > r.z1 - EDGE))) {
      const fixed = this.#lists.fixed; // (also makes the lists again if they're stale)
      const region = (this.#region = { x0: x0 - PAD, y0: y0 - PAD, z0: z0 - PAD, x1: x1 + PAD, y1: y1 + PAD, z1: z1 + PAD });
      const close = this.#close;
      close.length = 0;
      this.#age = 0;
      this.#closeOf = this.#lists.made;
      for (let i = 0; i < fixed.length; i++) {
        const b = fixed[i];
        this.#settle(b);
        const l = b.aabb.lowerBound;
        const u = b.aabb.upperBound;
        if (l.x <= region.x1 && u.x >= region.x0 && l.y <= region.y1 && u.y >= region.y0 && l.z <= region.z1 && u.z >= region.z0) close.push(b);
      }
    }

    // Everything that moves and the scenery in the box, in the world's order
    // (both lists are in that order already).
    const close = this.#close;
    let k = 0;
    for (let i = 0; i < close.length; i++) {
      const b = close[i];
      const l = b.aabb.lowerBound;
      const u = b.aabb.upperBound;
      if (!(l.x <= x1 && u.x >= x0 && l.y <= y1 && u.y >= y0 && l.z <= z1 && u.z >= z0)) continue;
      for (; k < n && movers[k].index < b.index; k++) if (movers[k].shapes.length) near.push(movers[k]);
      near.push(b);
    }
    for (; k < n; k++) if (movers[k].shapes.length) near.push(movers[k]); // (not the "hand" that holds Lennie: nothing to bump into)

    const m = near.length;
    for (let i = 0; i < m; i++) {
      const bi = near[i];
      if (bi.type === STATIC) continue;
      for (let j = 0; j < m; j++) {
        const bj = near[j];
        // (two moving bodies are a pair once, from the one with the lower id)
        if (bj === bi || (bj.type !== STATIC && bj.id < bi.id)) continue;
        if (!this.needBroadphaseCollision(bi, bj) || !boxesOverlap(bi, bj)) continue;
        pairs1.push(bi);
        pairs2.push(bj);
      }
    }
  }
}

/** The pairs of bodies in contact, as a short list. Stands in for cannon's ArrayCollisionMatrix. */
class PairSet {
  #pairs = new Set();

  // (by id, which a body keeps for life; ids stay far below ten million)
  #key(bi, bj) {
    return bi.id < bj.id ? bi.id * 1e7 + bj.id : bj.id * 1e7 + bi.id;
  }

  get(bi, bj) {
    return this.#pairs.has(this.#key(bi, bj)) ? 1 : 0;
  }

  set(bi, bj, value) {
    if (value) this.#pairs.add(this.#key(bi, bj));
    else this.#pairs.delete(this.#key(bi, bj));
  }

  reset() {
    this.#pairs.clear();
  }

  setNumObjects() { /* nothing to size */ }
}

/**
 * The world's bodies as two lists, both in the world's order: the ones that
 * can move (Lennie, loose furniture, cars, the hand) and the scenery that has
 * a shape. Made again when a body came or went.
 */
class Lists {
  stale = true;
  made = 0; // how many times the lists were made
  #world;
  #movers = [];
  #fixed = [];

  constructor(world) {
    this.#world = world;
    const changed = () => { this.stale = true; };
    world.addEventListener('addBody', changed);
    world.addEventListener('removeBody', changed);
  }

  #make() {
    this.stale = false;
    this.made++;
    this.#movers.length = 0;
    this.#fixed.length = 0;
    for (const b of this.#world.bodies) {
      if (b.type !== STATIC) this.#movers.push(b);
      else if (b.shapes.length) this.#fixed.push(b);
    }
  }

  get movers() {
    if (this.stale) this.#make();
    return this.#movers;
  }

  get fixed() {
    if (this.stale) this.#make();
    return this.#fixed;
  }
}

/**
 * cannon's own solver (GSSolver.solve, the same sums in the same order), but
 * only going through the bodies that can move. cannon's goes through every
 * body in the world three times a step, and all but a few dozen of them are
 * scenery, for which there's nothing to do: scenery has no mass to solve with
 * (its "inverse mass" is 0 from the moment it's made), so nothing is ever
 * added to its speed.
 */
class MoversSolver extends CANNON.GSSolver {
  #lists;
  #lambda = [];
  #invCs = [];
  #Bs = [];

  constructor(lists, like) {
    super();
    this.#lists = lists;
    this.iterations = like.iterations;
    this.tolerance = like.tolerance;
  }

  solve(dt, world) {
    const equations = this.equations;
    const Neq = equations.length;
    if (Neq === 0) return 0;
    const bodies = this.#lists.movers;
    const Nbodies = bodies.length;
    const maxIter = this.iterations;
    const tolSquared = this.tolerance * this.tolerance;
    const lambda = this.#lambda;
    const invCs = this.#invCs;
    const Bs = this.#Bs;
    lambda.length = invCs.length = Bs.length = Neq;

    for (let i = 0; i !== Nbodies; i++) bodies[i].updateSolveMassProperties();
    for (let i = 0; i !== Neq; i++) {
      const c = equations[i];
      lambda[i] = 0;
      Bs[i] = c.computeB(dt);
      invCs[i] = 1 / c.computeC();
    }
    for (let i = 0; i !== Nbodies; i++) {
      bodies[i].vlambda.set(0, 0, 0);
      bodies[i].wlambda.set(0, 0, 0);
    }

    let iter = 0;
    for (; iter !== maxIter; iter++) {
      let total = 0;
      for (let j = 0; j !== Neq; j++) {
        const c = equations[j];
        const lambdaj = lambda[j];
        let delta = invCs[j] * (Bs[j] - c.computeGWlambda() - c.eps * lambdaj);
        if (lambdaj + delta < c.minForce) delta = c.minForce - lambdaj;
        else if (lambdaj + delta > c.maxForce) delta = c.maxForce - lambdaj;
        lambda[j] += delta;
        total += delta > 0 ? delta : -delta;
        c.addToWlambda(delta);
      }
      if (total * total < tolSquared) break;
    }

    for (let i = 0; i !== Nbodies; i++) {
      const b = bodies[i];
      b.vlambda.vmul(b.linearFactor, b.vlambda);
      b.velocity.vadd(b.vlambda, b.velocity);
      b.wlambda.vmul(b.angularFactor, b.wlambda);
      b.angularVelocity.vadd(b.wlambda, b.angularVelocity);
    }
    const invDt = 1 / dt;
    for (let l = Neq; l--;) equations[l].multiplier = lambda[l] * invDt;
    return iter;
  }
}

/**
 * Gives a (still empty) world the cheap bookkeeping above. Call it after
 * setting the solver's iterations: the world gets a solver of its own here.
 */
export function tunePhysics(world) {
  const lists = new Lists(world);
  world.broadphase = new NearbyBroadphase(lists);
  world.collisionMatrix = new PairSet();
  world.collisionMatrixPrevious = new PairSet();
  world.solver = new MoversSolver(lists, world.solver);
  // Forces only ever build up on bodies that can move (cannon ignores a push
  // on scenery), so only those need wiping after a step.
  world.clearForces = () => {
    for (const b of lists.movers) {
      b.force.set(0, 0, 0);
      b.torque.set(0, 0, 0);
    }
  };
}
