// The physics' bookkeeping, done the cheap way. Nothing here changes what
// happens in the game: the same things touch at the same moments. It only
// stops cannon-es from doing work that can't lead to anything, which was more
// than half of what each physics step cost. On a low-end tablet the physics is
// the biggest part of a frame while Lennie flies, so this is what keeps a
// toss smooth there.
//
// Two things, both set up by tunePhysics(world):
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
import * as CANNON from 'cannon-es';

const { STATIC, DYNAMIC, SLEEPING } = CANNON.Body;
// Boxes this close count as overlapping. Something standing exactly on the
// ground has its box end a rounding error above it (1.7e-17 m, for the clothes
// rack), while cannon's exact test, with its own rounding, says they touch.
// Without this that contact came and went.
const SLOP = 0.001;

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

  collisionPairs(world, pairs1, pairs2) {
    const all = world.bodies;
    const n = all.length;
    const near = this.#near;
    near.length = 0;

    // The box around everything that's awake and can be pushed about (Lennie,
    // and a chair or bike he has just knocked over). Scenery outside it can't
    // be touching any of them. A body that's awake gets its box worked out
    // afresh every step, also right after it was put somewhere else by hand.
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const b = all[i];
      if (b.type === STATIC || !b.shapes.length) continue;
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

    for (let i = 0; i < n; i++) {
      const b = all[i];
      if (!b.shapes.length) continue; // (the "hand" that holds Lennie: nothing to bump into)
      if (b.type !== STATIC) {
        near.push(b);
        continue;
      }
      this.#settle(b);
      const l = b.aabb.lowerBound;
      const u = b.aabb.upperBound;
      if (l.x <= x1 && u.x >= x0 && l.y <= y1 && u.y >= y0 && l.z <= z1 && u.z >= z0) near.push(b);
    }

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

/** Gives a (still empty) world the cheap bookkeeping above. */
export function tunePhysics(world) {
  world.broadphase = new NearbyBroadphase();
  world.collisionMatrix = new PairSet();
  world.collisionMatrixPrevious = new PairSet();
}
