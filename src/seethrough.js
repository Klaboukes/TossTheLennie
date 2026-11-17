import * as THREE from 'three';
import { simplify, shadingKey } from './shading.js';

// Keeps Lennie in view. Everything between the camera and him, inside a
// circle around him on screen, is cut away: shelves, freezers, furniture,
// trees, fallen groceries, anything. The circle's edge is a fine dither, so
// it reads as a soft see-through window rather than a hard hole. Scenery
// right in front of the lens is cut the same way, so a cramped spot never
// fills the screen with a close-up of a box.
//
// The circle is always centred on Lennie, but it's only big for scenery
// close in front of him (the shelf or counter he's lying behind). Scenery
// much nearer the camera, like a wall the camera is next to, is only cut in
// a smaller circle that still clears all of him: a big hole there would sit
// at the edge of the screen, away from him, and look like a window to
// nowhere.
//
// Nothing below Lennie's middle is cut: the floor, bed or shelf he lies on
// stays, and with the camera never lower than what it looks at, things below
// him can't block the view of him anyway.
//
// Nothing at or above the ceiling over Lennie is cut either, while the camera
// is under that ceiling too: a hole in it would show the floor above, which
// the house's cutaway only hides once the camera rises past the ceiling.
//
// It works by adding a few lines to the shaders of all scenery materials, so
// it costs nothing per object. Lennie's own materials are left alone.

const REACH = 2.5; // metres around Lennie's middle that must stay visible (he's 1.90 m)
const MIN_SHARE = 0.35; // the circle's radius is at least this share of the screen's longer side (so it's 70% of the screen across)
const NEAR_SHARE = 0.45; // scenery near the camera gets a circle at least this share of the big one...
const NEAR_REACH = 1.3; // ...and at least this many metres around his middle, so all of him (1.90 m) stays clear
const FULL_GAP = 0.8; // scenery up to this far in front of his middle gets the big circle
const NEAR_GAP = 1.6; // scenery this far or further in front of him gets the smaller one (in between it shrinks)
const IN_FRONT = 0.3; // only cut what's at least this much closer to the camera than his middle
const BELOW = 0.05; // nothing lower than this under his middle is cut
const LENS = 0.45; // anything closer to the camera than this is cut
const LENS_SOFT = 0.3; // ...fading in over this much further
const HOLD = { px: 1.5, m: 0.01 }; // the cut-away stays put until Lennie or the camera moves more than this (pixels on screen, metres)

const uniforms = {
  seeCenter: { value: new THREE.Vector2() }, // Lennie on screen, in drawing-buffer pixels
  seeRadius: { value: 0 }, // pixels, for scenery close in front of him
  seeRadiusNear: { value: 0 }, // pixels, for scenery near the camera
  seeDist: { value: 0 }, // camera to Lennie's middle
  seeFloor: { value: -1e3 }, // world height below which nothing is cut
  seeCeil: { value: 1e6 }, // world height from which up nothing is cut
  seeOn: { value: 0 }, // 0 while Lennie is behind the camera
};

const VERTEX_HEAD = 'varying vec3 vSeeWorld;\n';
const VERTEX_BODY = `
  vec4 seeP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    seeP = instanceMatrix * seeP;
  #endif
  vSeeWorld = (modelMatrix * seeP).xyz;
`;
const FRAGMENT_HEAD = `
uniform vec2 seeCenter;
uniform float seeRadius;
uniform float seeRadiusNear;
uniform float seeDist;
uniform float seeFloor;
uniform float seeCeil;
uniform float seeOn;
varying vec3 vSeeWorld;
float seeNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;
const FRAGMENT_BODY = `
  if (vSeeWorld.y > seeFloor && vSeeWorld.y < seeCeil) {
    float seeD = distance(vSeeWorld, cameraPosition);
    float seeCut = 1.0 - smoothstep(${LENS.toFixed(3)}, ${(LENS + LENS_SOFT).toFixed(3)}, seeD);
    if (seeOn > 0.5) {
      float seeR = length(gl_FragCoord.xy - seeCenter);
      float seeRad = mix(seeRadius, seeRadiusNear, smoothstep(${FULL_GAP.toFixed(3)}, ${NEAR_GAP.toFixed(3)}, seeDist - seeD));
      float seeRing = 1.0 - smoothstep(seeRad * 0.75, seeRad, seeR);
      float seeNear = 1.0 - smoothstep(seeDist - ${(IN_FRONT + 0.35).toFixed(3)}, seeDist - ${IN_FRONT.toFixed(3)}, seeD);
      seeCut = max(seeCut, seeRing * seeNear);
    }
    if (seeCut > 0.0 && seeNoise(gl_FragCoord.xy) < seeCut) discard;
  }
`;

// One shared function, so three.js compiles one program per material type.
// (On a slow device the scenery's shading is swapped for a simpler one here too: see shading.js.)
function patchShader(shader) {
  simplify(shader);
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_BODY}`);
  shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FRAGMENT_BODY}`);
}

const PATCHABLE = ['isMeshStandardMaterial', 'isMeshLambertMaterial', 'isMeshPhongMaterial', 'isMeshBasicMaterial', 'isMeshToonMaterial'];

/**
 * `skip(object)` says which meshes keep their look no matter what (Lennie
 * himself, the aiming marks).
 */
export function createSeeThrough(scene, renderer, skip) {
  const patched = new WeakSet();
  const kept = new WeakSet();
  let sweepIn = 0;
  const _size = new THREE.Vector2();
  const _v = new THREE.Vector3();
  const state = { center: new THREE.Vector3(), cx: 0, cy: 0, radius: 0, radiusNear: 0, dist: 0, floor: -1e3, ceil: 1e6, on: false };

  function patch(mat) {
    if (patched.has(mat) || kept.has(mat)) return;
    if (!PATCHABLE.some((k) => mat[k]) || mat.depthTest === false || mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
      kept.add(mat);
      return;
    }
    patched.add(mat);
    mat.onBeforeCompile = patchShader;
    mat.customProgramCacheKey = shadingKey;
    mat.needsUpdate = true;
  }

  /** Gives every scenery material in the scene the cut-away (new ones too, a few times a second). */
  function sweep() {
    scene.traverse((o) => {
      if (!o.isMesh || skip(o)) return;
      if (Array.isArray(o.material)) o.material.forEach(patch);
      else if (o.material) patch(o.material);
    });
  }

  /**
   * Points the cut-away at `center` (Lennie's middle) for this frame; `ceil`
   * is the height from which up nothing is cut (the ceiling over him).
   */
  function update(camera, center, dt, ceil = Infinity) {
    sweepIn -= dt;
    if (sweepIn <= 0) {
      sweep();
      sweepIn = 0.5;
    }
    renderer.getDrawingBufferSize(_size);
    const dist = camera.position.distanceTo(center);
    const v = _v.copy(center).project(camera);
    const on = v.z < 1 && dist > 1e-3;
    const cx = (v.x * 0.5 + 0.5) * _size.x;
    const cy = (v.y * 0.5 + 0.5) * _size.y;
    const pxPerM = _size.y / 2 / (Math.max(dist, 0.3) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const minRadius = MIN_SHARE * Math.max(_size.x, _size.y);
    const radius = THREE.MathUtils.clamp(REACH * pxPerM, minRadius, Math.max(0.9 * _size.y, minRadius));
    const radiusNear = THREE.MathUtils.clamp(NEAR_REACH * pxPerM, NEAR_SHARE * radius, radius);
    const floor = center.y - BELOW;
    ceil = Math.min(ceil, 1e6);
    // Lennie lying still still trembles a tenth of a millimetre or so every
    // frame. Following that would shift the dithered edges of the cut-away a
    // hair each frame, and those speckles would flicker. So the cut-away only
    // moves once something has really moved; then it jumps all at once.
    const moved = on !== state.on || Math.hypot(cx - state.cx, cy - state.cy) > HOLD.px
      || Math.abs(radius - state.radius) > HOLD.px || Math.abs(radiusNear - state.radiusNear) > HOLD.px || Math.abs(dist - state.dist) > HOLD.m
      || Math.abs(floor - state.floor) > HOLD.m || ceil !== state.ceil;
    if (!moved) return;
    state.center.copy(center);
    Object.assign(state, { dist, on, cx, cy, radius, radiusNear, floor, ceil });
    uniforms.seeCenter.value.set(state.cx, state.cy);
    uniforms.seeRadius.value = state.radius;
    uniforms.seeRadiusNear.value = state.radiusNear;
    uniforms.seeDist.value = state.dist;
    uniforms.seeFloor.value = state.floor;
    uniforms.seeCeil.value = state.ceil;
    uniforms.seeOn.value = state.on ? 1 : 0;
  }

  /**
   * Whether a point on the scenery is cut away right now (mostly), so aiming
   * looks past it like it looks past faded walls.
   */
  function hides(point, camera) {
    if (point.y <= state.floor || point.y >= state.ceil) return false;
    const d = camera.position.distanceTo(point);
    if (d < LENS + LENS_SOFT / 2) return true;
    if (!state.on || d > state.dist - IN_FRONT - 0.15) return false;
    const v = _v.copy(point).project(camera);
    const x = (v.x * 0.5 + 0.5) * _size.x - state.cx;
    const y = (v.y * 0.5 + 0.5) * _size.y - state.cy;
    const t = THREE.MathUtils.smoothstep(state.dist - d, FULL_GAP, NEAR_GAP);
    return Math.hypot(x, y) < THREE.MathUtils.lerp(state.radius, state.radiusNear, t) * 0.8;
  }

  sweep();
  return { update, hides, sweep };
}
