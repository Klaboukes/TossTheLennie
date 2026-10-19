import * as CANNON from 'cannon-es';

const MAX_JOINT_GAP = 0.18; // metres a joint may stretch before Lennie counts as torn apart
const MAX_RESCUES = 30; // consecutive rescues before giving up and respawning him
const { BOX, SPHERE, PLANE, CONVEXPOLYHEDRON } = CANNON.Shape.types;
const _local = new CANNON.Vec3();
const _a = new CANNON.Vec3();
const _b = new CANNON.Vec3();

/**
 * A physics engine without continuous collision detection can let a fast,
 * thin limb end up deep inside a wall or floor, where contacts can't push it
 * back out and the joints get torn apart trying. The guard checks after every
 * physics step and, if that happened, puts Lennie back where he last was in
 * one piece, bouncing him away from what he hit.
 */
export class StuckGuard {
  constructor(world, ragdoll) {
    this.world = world;
    this.ragdoll = ragdoll;
    this.bodies = ragdoll.bodies;
    this.snapshot = this.bodies.map(() => ({
      p: new CANNON.Vec3(), q: new CANNON.Quaternion(), v: new CANNON.Vec3(), w: new CANNON.Vec3(),
    }));
    this.hasSnapshot = false;
    this.rescues = 0;
    this.totalRescues = 0; // for debugging
    this.scenery = [];
  }

  /** Call once the house and yard are built. */
  collectScenery() {
    this.scenery = this.world.bodies.filter((b) => b.type === CANNON.Body.STATIC && b.surface);
    for (const b of this.scenery) b.updateAABB();
  }

  /** Forget the saved pose, e.g. after Lennie was teleported. */
  forget() {
    this.hasSnapshot = false;
    this.rescues = 0;
  }

  isEmbedded(p) {
    for (const b of this.scenery) {
      if (!b.world) continue; // a smashed window
      const shape = b.shapes[0];
      if (shape.type !== PLANE) {
        const lo = b.aabb.lowerBound;
        const hi = b.aabb.upperBound;
        if (p.x < lo.x || p.x > hi.x || p.y < lo.y || p.y > hi.y || p.z < lo.z || p.z > hi.z) continue;
      }
      b.pointToLocalFrame(p, _local);
      switch (shape.type) {
        case BOX: {
          const h = shape.halfExtents;
          if (Math.abs(_local.x) < h.x - 0.01 && Math.abs(_local.y) < h.y - 0.01 && Math.abs(_local.z) < h.z - 0.01) return true;
          break;
        }
        case SPHERE:
          if (_local.length() < shape.radius * 0.7) return true;
          break;
        case PLANE:
          if (_local.z < -0.05) return true;
          break;
        case CONVEXPOLYHEDRON:
          // cannon returns false when outside, a number when inside
          if (shape.pointIsInside(_local) !== false) return true;
          break;
      }
    }
    return false;
  }

  isTornApart() {
    for (const j of this.ragdoll.joints) {
      j.bodyA.pointToWorldFrame(j.constraint.pivotA, _a);
      j.bodyB.pointToWorldFrame(j.constraint.pivotB, _b);
      if (_a.distanceTo(_b) > MAX_JOINT_GAP) return true;
    }
    return false;
  }

  /**
   * Call after each physics step. Returns 'ok', 'rescued' (pose restored) or
   * 'lost' (no good pose to go back to; the caller should respawn him).
   */
  check() {
    const bad = this.isTornApart() || this.bodies.some((b) => this.isEmbedded(b.position));
    if (!bad) {
      this.bodies.forEach((b, i) => {
        const s = this.snapshot[i];
        s.p.copy(b.position);
        s.q.copy(b.quaternion);
        s.v.copy(b.velocity);
        s.w.copy(b.angularVelocity);
      });
      this.hasSnapshot = true;
      this.rescues = 0;
      return 'ok';
    }
    this.rescues += 1;
    this.totalRescues += 1;
    if (!this.hasSnapshot || this.rescues > MAX_RESCUES) return 'lost';
    this.bodies.forEach((b, i) => {
      const s = this.snapshot[i];
      b.position.copy(s.p);
      b.quaternion.copy(s.q);
      s.v.scale(-0.4, b.velocity);
      s.w.scale(0.5, b.angularVelocity);
    });
    return 'rescued';
  }
}
