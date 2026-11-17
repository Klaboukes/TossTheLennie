import * as THREE from 'three';
import { pieces, flipWinding } from './batching.js';

// A building seen from across the road, drawn as cheaply as it goes. Lennie's
// house is several hundred separate things to draw (every wall and floor fades
// by itself, every colour of furniture is its own mesh), and from the
// supermarket all of that was drawn in full, for a house that fills a corner
// of the picture. On a budget tablet that was about half of each frame there.
//
// farCopy() makes one copy of all the fixed parts in a handful of meshes: the
// parts' own colours go into their corners (vertex colours), so everything
// without a picture is one mesh, and everything with the same picture another.
// The copy doesn't fade, break or hide a storey, so it's only for a view from
// outside and afar; the owner (house.js, supermarket.js) swaps it in and the
// real parts out.

const METAL_DARK = 0.7; // a metal part's own colour hardly shows: this much darker (as in shading.js)
const MAPS_KEPT_APART = ['normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap', 'envMap', 'lightMap'];

const _c = new THREE.Color();
const BLACK = new THREE.Color(0);

/**
 * Whether a material can share a mesh with others that differ only in colour.
 * (A wall that can fade is solid as built; glass, in it or not, keeps its own material.)
 */
const foldable = (m) => m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.transparent && !m.userData.seeThrough
  && MAPS_KEPT_APART.every((k) => !m[k]);

/** What's left of a foldable material's look once its colour has gone into the corners. */
function lookKey(m) {
  const glow = m.emissive.equals(BLACK) || m.emissiveIntensity === 0 ? '' : `${m.emissive.getHexString()}*${m.emissiveIntensity}*${m.emissiveMap?.uuid ?? ''}`;
  const offset = m.polygonOffset ? `${m.polygonOffsetFactor},${m.polygonOffsetUnits}` : '';
  return [m.map?.uuid ?? '', m.roughness < 0.5 ? 'shiny' : 'matte', m.side, m.flatShading, m.alphaTest, offset, glow, m.fog].join('|');
}

/**
 * A group with a cheap copy of `meshes` (fixed scenery, wherever it hangs), in
 * world space. What can't be folded into the others (glass, mostly) becomes
 * one mesh per material, with that material.
 */
export function farCopy(meshes) {
  const buckets = new Map();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const mirrored = mesh.matrixWorld.determinant() < 0;
    for (const [geo, mat] of pieces(mesh)) {
      if (!mat.visible) continue;
      const placed = geo === mesh.geometry ? geo.clone() : geo;
      placed.applyMatrix4(mesh.matrixWorld);
      if (mirrored) flipWinding(placed);
      if (!placed.attributes.normal) placed.computeVertexNormals();
      const fold = foldable(mat);
      const key = fold ? lookKey(mat) : `own|${mat.uuid}`;
      if (!buckets.has(key)) buckets.set(key, { fold, mat, parts: [], count: 0 });
      const bucket = buckets.get(key);
      bucket.parts.push({ geo: placed, mat });
      bucket.count += placed.attributes.position.count;
    }
  }

  const group = new THREE.Group();
  for (const { fold, mat, parts, count } of buckets.values()) {
    const withUv = !!(mat.map || mat.emissiveMap) || !fold;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const uv = withUv ? new Float32Array(count * 2) : null;
    const color = fold ? new Uint8Array(count * 3) : null;
    let at = 0;
    for (const part of parts) {
      const a = part.geo.attributes;
      const n = a.position.count;
      for (let i = 0; i < n; i++) {
        const v = at + i;
        position[v * 3] = a.position.getX(i);
        position[v * 3 + 1] = a.position.getY(i);
        position[v * 3 + 2] = a.position.getZ(i);
        normal[v * 3] = a.normal.getX(i);
        normal[v * 3 + 1] = a.normal.getY(i);
        normal[v * 3 + 2] = a.normal.getZ(i);
        if (uv && a.uv) {
          uv[v * 2] = a.uv.getX(i);
          uv[v * 2 + 1] = a.uv.getY(i);
        }
        if (!color) continue;
        _c.copy(part.mat.color).multiplyScalar(1 - METAL_DARK * part.mat.metalness);
        if (part.mat.vertexColors && a.color) _c.setRGB(_c.r * a.color.getX(i), _c.g * a.color.getY(i), _c.b * a.color.getZ(i));
        color[v * 3] = Math.round(Math.min(_c.r, 1) * 255);
        color[v * 3 + 1] = Math.round(Math.min(_c.g, 1) * 255);
        color[v * 3 + 2] = Math.round(Math.min(_c.b, 1) * 255);
      }
      at += n;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    if (uv) geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (color) geometry.setAttribute('color', new THREE.BufferAttribute(color, 3, true));
    geometry.computeBoundingSphere();
    const material = !fold ? mat : new THREE.MeshStandardMaterial({
      map: mat.map, vertexColors: true, roughness: mat.roughness < 0.5 ? 0.35 : 0.8, metalness: 0, side: mat.side, flatShading: mat.flatShading,
      alphaTest: mat.alphaTest, polygonOffset: mat.polygonOffset, polygonOffsetFactor: mat.polygonOffsetFactor, polygonOffsetUnits: mat.polygonOffsetUnits,
      emissive: mat.emissive, emissiveIntensity: mat.emissiveIntensity, emissiveMap: mat.emissiveMap, fog: mat.fog,
    });
    const out = new THREE.Mesh(geometry, material);
    out.matrixAutoUpdate = false;
    // Aiming (main.js) asks what's under the pointer: that stays the real parts' job.
    out.raycast = () => {};
    group.add(out);
  }
  return group;
}
