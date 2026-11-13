import * as THREE from 'three';

// Keeps Lennie in view. Everything between the camera and him, inside a
// circle around him on screen, is cut away: shelves, freezers, furniture,
// trees, fallen groceries, anything. The circle's edge is a fine dither, so
// it reads as a soft see-through window rather than a hard hole. Scenery
// right in front of the lens is cut the same way, so a cramped spot never
// fills the screen with a close-up of a box.
//
// Nothing below Lennie's middle is cut: the floor, bed or shelf he lies on
// stays, and with the camera never lower than what it looks at, things below
// him can't block the view of him anyway.
//
// It works by adding a few lines to the shaders of all scenery materials, so
// it costs nothing per object. Lennie's own materials are left alone.

const REACH = 1.25; // metres around Lennie's middle that must stay visible (he's 1.90 m)
const IN_FRONT = 0.3; // only cut what's at least this much closer to the camera than his middle
const BELOW = 0.05; // nothing lower than this under his middle is cut
const LENS = 0.45; // anything closer to the camera than this is cut
const LENS_SOFT = 0.3; // ...fading in over this much further

const uniforms = {
  seeCenter: { value: new THREE.Vector2() }, // Lennie on screen, in drawing-buffer pixels
  seeRadius: { value: 0 }, // pixels
  seeDist: { value: 0 }, // camera to Lennie's middle
  seeFloor: { value: -1e3 }, // world height below which nothing is cut
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
uniform float seeDist;
uniform float seeFloor;
uniform float seeOn;
varying vec3 vSeeWorld;
float seeNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;
const FRAGMENT_BODY = `
  if (vSeeWorld.y > seeFloor) {
    float seeD = distance(vSeeWorld, cameraPosition);
    float seeCut = 1.0 - smoothstep(${LENS.toFixed(3)}, ${(LENS + LENS_SOFT).toFixed(3)}, seeD);
    if (seeOn > 0.5) {
      float seeR = length(gl_FragCoord.xy - seeCenter);
      float seeRing = 1.0 - smoothstep(seeRadius * 0.65, seeRadius, seeR);
      float seeNear = 1.0 - smoothstep(seeDist - ${(IN_FRONT + 0.35).toFixed(3)}, seeDist - ${IN_FRONT.toFixed(3)}, seeD);
      seeCut = max(seeCut, seeRing * seeNear);
    }
    if (seeCut > 0.0 && seeNoise(gl_FragCoord.xy) < seeCut) discard;
  }
`;

// One shared function, so three.js compiles one program per material type.
function patchShader(shader) {
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
  const state = { center: new THREE.Vector3(), cx: 0, cy: 0, radius: 0, dist: 0, floor: -1e3, on: false };

  function patch(mat) {
    if (patched.has(mat) || kept.has(mat)) return;
    if (!PATCHABLE.some((k) => mat[k]) || mat.depthTest === false || mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
      kept.add(mat);
      return;
    }
    patched.add(mat);
    mat.onBeforeCompile = patchShader;
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

  /** Points the cut-away at `center` (Lennie's middle) for this frame. */
  function update(camera, center, dt) {
    sweepIn -= dt;
    if (sweepIn <= 0) {
      sweep();
      sweepIn = 0.5;
    }
    renderer.getDrawingBufferSize(_size);
    state.center.copy(center);
    state.dist = camera.position.distanceTo(center);
    const v = _v.copy(center).project(camera);
    state.on = v.z < 1 && state.dist > 1e-3;
    state.cx = (v.x * 0.5 + 0.5) * _size.x;
    state.cy = (v.y * 0.5 + 0.5) * _size.y;
    const pxPerM = _size.y / 2 / (Math.max(state.dist, 0.3) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    state.radius = THREE.MathUtils.clamp(REACH * pxPerM, 0.08 * _size.y, 0.6 * _size.y);
    state.floor = center.y - BELOW;
    uniforms.seeCenter.value.set(state.cx, state.cy);
    uniforms.seeRadius.value = state.radius;
    uniforms.seeDist.value = state.dist;
    uniforms.seeFloor.value = state.floor;
    uniforms.seeOn.value = state.on ? 1 : 0;
  }

  /**
   * Whether a point on the scenery is cut away right now (mostly), so aiming
   * looks past it like it looks past faded walls.
   */
  function hides(point, camera) {
    if (point.y <= state.floor) return false;
    const d = camera.position.distanceTo(point);
    if (d < LENS + LENS_SOFT / 2) return true;
    if (!state.on || d > state.dist - IN_FRONT - 0.15) return false;
    const v = _v.copy(point).project(camera);
    const x = (v.x * 0.5 + 0.5) * _size.x - state.cx;
    const y = (v.y * 0.5 + 0.5) * _size.y - state.cy;
    return Math.hypot(x, y) < state.radius * 0.8;
  }

  sweep();
  return { update, hides, sweep };
}
