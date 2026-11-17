// A/B experiments on the tablet: for each variant, load the game fresh, warm
// up with three throws (so watchSpeed settles the sharpness), tidy up, apply
// the variant's change in the page, and measure three aimed throws in the
// house: frames per second, physics time per frame and the stuck check's.
//
//   node scripts/tablet/ab.mjs <url> base base noDiscard ...
//
// Run `base` twice: the tablet's numbers vary by a frame or two per second
// from run to run. A variant that gains clearly more than that is real.
import { connect, restartChrome, sleep, FRAME_RECORDER, TARGETS } from './cdp.mjs';

const ROOT = 'let o = lennie.aimRing; while (o.parent) o = o.parent;';
/** In-page changes to try. Each returns something to print (how many things it changed). */
const VARIANTS = {
  base: '',
  // all products and clutter hidden
  noClutter: `(() => { ${ROOT} let n = 0; o.traverse((m) => { if (m.userData.products) { m.visible = false; n++; } }); return n; })()`,
  // walls and roofs drawn solid while they aren't fading (now the game's own behaviour, see setFade in batching.js)
  opaqueWalls: `(() => { ${ROOT} const seen = new Set(); o.traverse((m) => { if (!m.isMesh) return; for (const x of [].concat(m.material)) if (x.transparent && x.opacity >= 0.999 && !seen.has(x)) { seen.add(x); x.transparent = false; x.needsUpdate = true; } }); return seen.size; })()`,
  // every see-through thing hidden
  noTransparent: `(() => { ${ROOT} let n = 0; o.traverse((m) => { if (m.isMesh && [].concat(m.material).some((x) => x.transparent) && !m.userData.products) { m.visible = false; n++; } }); return n; })()`,
  // every other mesh hidden: roughly half the draw calls
  halfDraws: `(() => { ${ROOT} let n = 0, i = 0; o.traverse((m) => { if (m.isMesh && !m.isInstancedMesh && i++ % 2 && !m.userData.part) { m.visible = false; n++; } }); return n; })()`,
  // the see-through cut (seethrough.js) taken out of every material's shader
  noDiscard: `(() => { ${ROOT} const seen = new Set(); o.traverse((m) => { if (!m.isMesh) return; for (const x of [].concat(m.material)) { if (seen.has(x) || x.onBeforeCompile?.name !== 'patchShader') continue; seen.add(x); x.onBeforeCompile = () => {}; x.customProgramCacheKey = () => 'nosee'; x.needsUpdate = true; } }); return seen.size; })()`,
  // far fewer pixels (very blurry): shows how much the graphics chip's pixel work costs
  lowRes: `(() => { lennie.renderer.setPixelRatio(0.4); lennie.renderer.setSize(innerWidth, innerHeight); return lennie.renderer.getPixelRatio(); })()`,
  // MeshLambertMaterial (no shine) instead of MeshStandardMaterial everywhere (fading walls stop fading in this test)
  lambert: `(async () => { const THREE = await import('three'); ${ROOT} const swap = new Map();
    const conv = (x) => { if (!x || !x.isMeshStandardMaterial) return x; let l = swap.get(x); if (!l) { l = new THREE.MeshLambertMaterial();
      for (const k of ['color', 'map', 'emissive', 'emissiveMap', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'flatShading', 'vertexColors', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'depthWrite', 'depthTest', 'alphaTest', 'fog', 'visible', 'toneMapped', 'name']) { const v = x[k]; if (v && v.isColor) l[k].copy(v); else if (v !== undefined) l[k] = v; }
      l.onBeforeCompile = x.onBeforeCompile; l.userData = x.userData; swap.set(x, l); } return l; };
    o.traverse((m) => { if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material); }); return swap.size; })()`,
};

// The shock's lamp (zap.js) taken out of every shader: it's lit at 0 all the time.
VARIANTS.noPoint = '(() => { lennie.zap.light.visible = false; return 1; })()';
// Solid scenery drawn nearest first (by the near side of each mesh's bounding ball), so hidden pixels fail the depth
// test, instead of in the order of its shader programs (the game's own order, see setOpaqueSort in main.js).
VARIANTS.sortNear = `(() => { const r = lennie.renderer, cam = lennie.camera; const v = cam.position.clone();
  const depth = (it) => { const o = it.object, f = r.info.render.frame; if (o.__sf !== f) { o.__sf = f; const s = o.boundingSphere ?? it.geometry.boundingSphere ?? (it.geometry.computeBoundingSphere(), it.geometry.boundingSphere);
    v.copy(s.center).applyMatrix4(o.matrixWorld); const sc = o.matrixWorld.getMaxScaleOnAxis(); o.__sd = v.distanceTo(cam.position) - s.radius * sc; } return o.__sd; };
  r.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || depth(a) - depth(b) || a.id - b.id); return 1; })()`;
// three.js's own order (by material), as the game had it.
VARIANTS.sortMaterial = '(() => { lennie.renderer.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || a.material.id - b.material.id || a.z - b.z || a.id - b.id); return 1; })()';
// Half the solver's work per physics step (changes how Lennie tumbles; only to see what it's worth).
VARIANTS.iter10 = '(() => { lennie.world.solver.iterations = 10; return 10; })()';

// The game held at one step of its own list of sharpness and shading (QUALITY in main.js: q2 is sharpness 1 with the
// full shading, q3 the same with the simple shading, q4 that at sharpness 0.75), so watchSpeed() can't change it mid-test.
for (let q = 0; q < 5; q++) VARIANTS[`q${q}`] = `JSON.stringify(lennie.holdQuality(${q}))`;
// Sharpness 0.75 with the full shading, which isn't a step of the list (it's where the game ended up before simple shading).
VARIANTS.full075 = '(() => { lennie.holdQuality(4); lennie.setSimpleShading(false); return "0.75 full"; })()';

// The house and the shop drawn in full from across the road too, as before their cheap copies (farview.js).
VARIANTS.nofar = '(() => { lennie.house.allowFar(false); lennie.shop.allowFar(false); return "no far copies"; })()';

const url = process.argv[2];
const names = process.argv.slice(3);
if (!url || !names.length || names.some((n) => !(n in VARIANTS))) {
  console.log(`usage: node scripts/tablet/ab.mjs <url> <variant...>\nvariants: ${Object.keys(VARIANTS).join(', ')}`);
  process.exit(1);
}

for (const name of names) {
  await restartChrome();
  const t = await connect();
  await t.open(url, 14000);
  await t.key('Escape');
  await t.key('KeyT');
  await sleep(500);
  for (const at of TARGETS.slice(0, 3)) {
    await t.click(...at);
    await sleep(4000);
  }
  await t.key('KeyT');
  await t.key('KeyR');
  await sleep(2500);
  const changed = VARIANTS[name] ? await t.eval(VARIANTS[name]) : '';
  await sleep(5000); // (a variant that makes the shaders compile again stalls for a few seconds first)
  await t.eval(FRAME_RECORDER);
  await t.eval(`(() => {
    const S = window.__ab = { phys: 0, guard: 0, steps: 0 };
    const w = lennie.world; const step = w.step.bind(w);
    w.step = (...a) => { const t0 = performance.now(); step(...a); S.phys += performance.now() - t0; S.steps++; };
    const g = lennie.guard; const check = g.check.bind(g);
    g.check = () => { const t0 = performance.now(); const r = check(); S.guard += performance.now() - t0; return r; };
    return true;
  })()`);
  await t.key('KeyT');
  await sleep(500);
  await t.eval('__frames.length = 0, __ab.phys = __ab.guard = __ab.steps = 0, true');
  for (const at of TARGETS.slice(0, 3)) {
    await t.click(...at);
    await sleep(5000);
  }
  const r = await t.eval(`(() => {
    const f = __frames; const ms = f.reduce((a, b) => a + b, 0); const s = [...f].sort((a, b) => a - b);
    return { fps: +(1000 * f.length / ms).toFixed(1), p95Ms: Math.round(s[Math.floor(s.length * 0.95)]),
      physicsMsPerFrame: +(__ab.phys / f.length).toFixed(1), physicsMsPerStep: +(__ab.phys / __ab.steps).toFixed(2), stuckCheckMsPerStep: +(__ab.guard / __ab.steps).toFixed(2),
      // how much of real time the physics got through: under 1 the game plays in slow motion
      gameSpeed: +(__ab.steps / 120 / (ms / 1000)).toFixed(2),
      sharpness: +(document.getElementById('scene').width / innerWidth).toFixed(2) };
  })()`);
  console.log(name.padEnd(14), JSON.stringify(r), changed !== '' ? `(changed ${changed})` : '', t.errors.length ? `ERRORS: ${t.errors[0]}` : '');
  t.close();
}
process.exit(0);
