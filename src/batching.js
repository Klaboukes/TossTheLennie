import * as THREE from 'three';

// Keeps the game smooth on low-end tablets and phones. The scenery is built
// from a couple of thousand little boxes and shapes, and every separate mesh
// costs the graphics chip a draw call each frame. Once everything is built,
// combineScenery() glues the meshes that never move on their own into a few
// big ones: the meshes that share a parent, a material and a patch of ground
// become one mesh. It looks exactly the same.
//
// What stays separate: anything `keep(mesh)` names (Lennie, markers),
// InstancedMeshes (the groceries), invisible meshes, meshes with children or
// userData, and meshes whose material is transparent but not shared (glass
// panes). Groups that move, hide or fade as a whole (doors, windows, the
// house's storeys) keep working, because their meshes are only combined with
// their own siblings, inside the same group.

const CELL = 14; // metres: a combined mesh covers at most one patch this size, so off-screen patches are still skipped

// Material properties that decide whether two materials look the same.
const LOOKS = [
  'type', 'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity', 'transparent', 'side',
  'vertexColors', 'flatShading', 'alphaTest', 'depthWrite', 'depthTest', 'colorWrite', 'blending', 'fog', 'toneMapped',
  'wireframe', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'map', 'emissiveMap', 'normalMap',
  'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap', 'envMap', 'lightMap', 'specular', 'shininess',
];

function lookKey(mat) {
  return LOOKS.map((k) => {
    const v = mat[k];
    if (v === undefined || v === null) return '';
    if (v.isColor) return v.getHexString();
    if (v.isTexture) return v.uuid;
    return String(v);
  }).join('|');
}

const plainCompile = THREE.Material.prototype.onBeforeCompile;

/** Splits a mesh with one material per face group into [geometry, material] pairs, all without an index. */
function pieces(mesh) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  if (!Array.isArray(mesh.material)) return [[geo, mesh.material]];
  const out = [];
  for (const g of geo.groups) {
    const mat = mesh.material[g.materialIndex];
    if (!mat || !mat.visible) continue;
    const part = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const n = attr.itemSize;
      const end = Math.min(g.start + g.count, attr.count);
      part.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(g.start * n, end * n), n, attr.normalized));
    }
    out.push([part, mat]);
  }
  return out;
}

/** Turns triangles inside out, for a mirrored mesh whose mirroring is baked into the vertices. */
function flipWinding(geo) {
  for (const attr of Object.values(geo.attributes)) {
    const n = attr.itemSize;
    const a = attr.array;
    for (let t = 0; t < attr.count; t += 3) {
      for (let i = 0; i < n; i++) {
        const j = (t + 1) * n + i;
        const k = (t + 2) * n + i;
        const tmp = a[j];
        a[j] = a[k];
        a[k] = tmp;
      }
    }
  }
}

function concat(geos) {
  const out = new THREE.BufferGeometry();
  for (const [name, first] of Object.entries(geos[0].attributes)) {
    const total = geos.reduce((s, g) => s + g.attributes[name].array.length, 0);
    const array = new first.array.constructor(total);
    let at = 0;
    for (const g of geos) {
      array.set(g.attributes[name].array, at);
      at += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, first.itemSize, first.normalized));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

const signature = (geo) => Object.entries(geo.attributes)
  .map(([k, a]) => `${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join(',');

/**
 * Combines the scenery under `scene` that never moves by itself into as few
 * meshes as possible. Returns how many meshes there were and are now.
 */
export function combineScenery(scene, keep) {
  const kept = (o) => {
    for (let p = o; p; p = p.parent) if (keep(p)) return true;
    return false;
  };
  const eligible = (o) => o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && o.children.length === 0
    && Object.keys(o.userData).length === 0 && o.frustumCulled && o.renderOrder === 0 && !o.onBeforeRender.length
    && Object.keys(o.geometry.morphAttributes).length === 0 && o.geometry.attributes.position && !o.geometry.isInstancedBufferGeometry
    && [].concat(o.material).every((m) => m && m.onBeforeCompile === plainCompile) && !kept(o);

  // Materials that look the same become one material, so their meshes can be
  // combined too. Transparent ones stay apart: the house and the shop fade
  // their walls by changing those materials' opacity.
  const sameLook = new Map();
  const shared = (mat) => {
    if (mat.transparent) return mat;
    const key = lookKey(mat);
    if (!sameLook.has(key)) sameLook.set(key, mat);
    return sameLook.get(key);
  };

  let before = 0;
  let after = 0;
  const containers = [];
  scene.traverse((o) => {
    if (!o.isMesh) containers.push(o);
  });
  for (const parent of containers) {
    const meshes = parent.children.filter(eligible);
    if (!meshes.length) continue;
    const buckets = new Map();
    for (const mesh of meshes) {
      if (mesh.matrixAutoUpdate) mesh.updateMatrix();
      const mirrored = mesh.matrix.determinant() < 0;
      const c = new THREE.Vector3().setFromMatrixPosition(mesh.matrix);
      if (mesh.geometry.boundingSphere === null) mesh.geometry.computeBoundingSphere();
      c.copy(mesh.geometry.boundingSphere.center).applyMatrix4(mesh.matrix);
      const cell = `${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}`;
      for (const [geo, mat] of pieces(mesh)) {
        const material = shared(mat);
        const key = `${material.uuid}/${cell}/${signature(geo)}`;
        if (!buckets.has(key)) buckets.set(key, { material, geos: [] });
        const placed = geo === mesh.geometry ? geo.clone() : geo;
        placed.applyMatrix4(mesh.matrix);
        if (mirrored) flipWinding(placed);
        buckets.get(key).geos.push(placed);
      }
      parent.remove(mesh);
      before++;
    }
    for (const { material, geos } of buckets.values()) {
      const mesh = new THREE.Mesh(concat(geos), material);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      after++;
    }
  }
  return { before, after };
}
