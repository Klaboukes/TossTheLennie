// A/B experiments on the tablet: for each variant, load the game fresh, warm
// up with three throws (so watchSpeed settles the sharpness), tidy up, apply
// the variant's change in the page, and measure three aimed throws in the
// house: frames per second, physics time per frame and the stuck check's.
//
//   node scripts/tablet/ab.mjs <url> base base noDiscard ...
//
// Run `base` twice: the tablet's numbers vary by a frame or two per second
// from run to run. A variant that gains clearly more than that is real.
import { connect, sleep, FRAME_RECORDER, TARGETS } from './cdp.mjs';

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

const url = process.argv[2];
const names = process.argv.slice(3);
if (!url || !names.length || names.some((n) => !(n in VARIANTS))) {
  console.log(`usage: node scripts/tablet/ab.mjs <url> <variant...>\nvariants: ${Object.keys(VARIANTS).join(', ')}`);
  process.exit(1);
}

for (const name of names) {
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
  await t.eval(FRAME_RECORDER);
  await t.eval(`(() => {
    const S = window.__ab = { phys: 0, guard: 0 };
    const w = lennie.world; const step = w.step.bind(w);
    w.step = (...a) => { const t0 = performance.now(); step(...a); S.phys += performance.now() - t0; };
    const g = lennie.guard; const check = g.check.bind(g);
    g.check = () => { const t0 = performance.now(); const r = check(); S.guard += performance.now() - t0; return r; };
    return true;
  })()`);
  await t.key('KeyT');
  await sleep(500);
  await t.eval('__frames.length = 0, __ab.phys = __ab.guard = 0, true');
  for (const at of TARGETS.slice(0, 3)) {
    await t.click(...at);
    await sleep(5000);
  }
  const r = await t.eval(`(() => {
    const f = __frames; const ms = f.reduce((a, b) => a + b, 0); const s = [...f].sort((a, b) => a - b);
    return { fps: +(1000 * f.length / ms).toFixed(1), p95Ms: Math.round(s[Math.floor(s.length * 0.95)]),
      physicsMsPerFrame: +(__ab.phys / f.length).toFixed(1), stuckCheckMsPerFrame: +(__ab.guard / f.length).toFixed(2),
      sharpness: +(document.getElementById('scene').width / innerWidth).toFixed(2) };
  })()`);
  console.log(name.padEnd(14), JSON.stringify(r), changed !== '' ? `(changed ${changed})` : '', t.errors.length ? `ERRORS: ${t.errors[0]}` : '');
  t.close();
}
process.exit(0);
