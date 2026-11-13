// Instant replay: records Lennie's pose every frame of a toss, then plays it
// back in slow motion by moving his visible parts (the physics stays paused).
import * as THREE from 'three';

const MAX_FRAMES = 60 * 16; // a little longer than the longest toss
const EXPRESSIONS = ['normal', 'ouch', 'whee', 'dizzy'];

export class Replay {
  constructor(ragdoll) {
    this.ragdoll = ragdoll;
    this.parts = Object.values(ragdoll.parts);
    this.frames = [];
    this.recording = false;
    this.clip = null; // the last finished toss
    this.playing = null; // { t, i, speed }
    this.center = new THREE.Vector3();
  }

  start() {
    this.frames = [];
    this.recording = true;
    this.time = 0;
  }

  /** Called once per rendered frame while recording; dt is game time. */
  capture(dt) {
    if (!this.recording) return;
    this.time += dt;
    if (this.frames.length >= MAX_FRAMES) return;
    const pose = new Float32Array(this.parts.length * 7);
    this.parts.forEach((part, k) => {
      const p = part.body.position;
      const q = part.body.quaternion;
      pose.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w], k * 7);
    });
    this.frames.push({ t: this.time, pose, face: EXPRESSIONS.indexOf(this.ragdoll.expression) });
  }

  /** Ends the recording; keeps it as the clip to replay if it's long enough. */
  stop(keep = true) {
    if (!this.recording) return;
    this.recording = false;
    if (keep && this.frames.length > 20) this.clip = { frames: this.frames, face: this.ragdoll.expression };
  }

  get canPlay() {
    return !!this.clip;
  }

  play(speed = 0.4) {
    if (!this.clip) return false;
    this.playing = { t: 0, i: 0, speed };
    return true;
  }

  /** Stops playing and puts Lennie's visible parts back where his body really is. */
  cancel() {
    if (!this.playing) return;
    this.playing = null;
    this.ragdoll.sync();
    this.ragdoll.setExpression(this.clip.face);
  }

  /**
   * Advances the replay by dt (real time). Returns Lennie's centre in the
   * replayed frame, or null when it has finished.
   */
  update(dt) {
    const pl = this.playing;
    if (!pl) return null;
    const { frames } = this.clip;
    pl.t += dt * pl.speed;
    while (pl.i < frames.length - 1 && frames[pl.i + 1].t <= pl.t) pl.i++;
    if (pl.i >= frames.length - 1 && pl.t > frames[frames.length - 1].t + 0.6) {
      this.cancel();
      return null;
    }
    const a = frames[pl.i];
    const b = frames[Math.min(pl.i + 1, frames.length - 1)];
    const k = b.t > a.t ? THREE.MathUtils.clamp((pl.t - a.t) / (b.t - a.t), 0, 1) : 0;
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    this.parts.forEach((part, n) => {
      const o = n * 7;
      part.group.position.set(
        a.pose[o] + (b.pose[o] - a.pose[o]) * k,
        a.pose[o + 1] + (b.pose[o + 1] - a.pose[o + 1]) * k,
        a.pose[o + 2] + (b.pose[o + 2] - a.pose[o + 2]) * k,
      );
      qa.set(a.pose[o + 3], a.pose[o + 4], a.pose[o + 5], a.pose[o + 6]);
      qb.set(b.pose[o + 3], b.pose[o + 4], b.pose[o + 5], b.pose[o + 6]);
      part.group.quaternion.slerpQuaternions(qa, qb, k);
    });
    const face = EXPRESSIONS[a.face] ?? 'normal';
    if (face !== this.ragdoll.expression) this.ragdoll.setExpression(face);
    const { chest, pelvis } = this.ragdoll.parts;
    return this.center.addVectors(chest.group.position, pelvis.group.position).multiplyScalar(0.5);
  }
}
