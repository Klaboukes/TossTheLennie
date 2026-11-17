import * as THREE from 'three';

// Simple shading, for devices that can't keep up (see watchSpeed() in
// main.js). The scenery's materials are MeshStandardMaterials: per pixel they
// work out how rough and how metallic the surface is and what shine each lamp
// leaves on it. On a budget tablet's graphics chip that's a big part of every
// frame. Simple shading keeps the same materials, colours, pictures, lights
// and fog, but only works out how much light falls on the surface (as a
// MeshLambertMaterial does): no shine. The game looks a little flatter;
// polished floors and steel lose their glint.
//
// The materials themselves stay what they are, so everything that changes
// them goes on working (fading walls, glowing screens, the baked products):
// only the shader program they're drawn with is swapped, where seethrough.js
// already adds its lines to it. Lennie himself and the window glass, which
// seethrough.js leaves alone, keep their shine.

let simple = false;

// Without anything to mirror, metal in the full shading is its colour
// darkened by how metallic it is, plus the lamps' glint. The glint is gone
// here, so it's darkened a little less than that.
const METAL_DARK = 0.7;
const LAMBERT = THREE.ShaderLib.lambert;
const VERTEX = LAMBERT.vertexShader;
const FRAGMENT = LAMBERT.fragmentShader
  .replace('uniform float opacity;', 'uniform float opacity;\nuniform float metalness;')
  .replace('#include <lights_lambert_fragment>', `diffuseColor.rgb *= 1.0 - ${METAL_DARK.toFixed(2)} * metalness;\n#include <lights_lambert_fragment>`);

/** Whether simple shading is on. */
export const simpleShading = () => simple;

/**
 * For a material's onBeforeCompile: swaps a MeshStandardMaterial's shaders
 * for the simple ones while simple shading is on. The material keeps handing
 * three.js its own values; the simple shaders just use fewer of them.
 */
export function simplify(shader) {
  if (!simple || shader.shaderType !== 'MeshStandardMaterial') return;
  shader.vertexShader = VERTEX;
  shader.fragmentShader = FRAGMENT;
}

/** For a material's customProgramCacheKey, next to simplify(): three.js keeps the two kinds of program apart by it. */
export function shadingKey() {
  return simple ? 'simple' : '';
}

/**
 * Switches simple shading on or off. Before the first frame that costs
 * nothing. Later, every material using simplify() in `scene` gets its other
 * program, which three.js has to build first: a stall of a second or so on a
 * slow device, once.
 */
export function setSimpleShading(on, scene) {
  if (simple === on) return;
  simple = on;
  const seen = new Set();
  scene?.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m || seen.has(m) || m.customProgramCacheKey !== shadingKey) continue;
      seen.add(m);
      m.needsUpdate = true;
    }
  });
}
