// What a frame costs with Lennie sitting still in the start view, and what
// limits it: the same view measured at other sharpnesses, with nothing drawn,
// and with everything drawn into a corner of 8 pixels (all the work of
// drawing except filling the pixels). If the sharpness makes no difference,
// the graphics chip isn't what's slow.
//
//   node scripts/tablet/still.mjs [url]
import { connect, sleep, GAME, FRAME_RECORDER } from './cdp.mjs';

const url = process.argv[2] ?? GAME;
const t = await connect();
await t.open(url, 22000); // (past the flicker check, which runs in the first ~15 s on localhost)
await t.key('Escape');
await t.eval(FRAME_RECORDER);
await t.eval(`(() => {
  const M = window.__m = { render: 0, phys: 0 };
  const r = lennie.renderer; const render = r.render.bind(r);
  r.render = (...a) => { const t0 = performance.now(); render(...a); M.render += performance.now() - t0; };
  const w = lennie.world; const step = w.step.bind(w);
  w.step = (...a) => { const t0 = performance.now(); step(...a); M.phys += performance.now() - t0; };
  window.__root = lennie.aimRing; while (__root.parent) __root = __root.parent;
})()`);
const sharp = (p) => `(() => { lennie.renderer.setPixelRatio(${p}); lennie.renderer.setSize(innerWidth, innerHeight); return ${p}; })()`;
const base = await t.eval('lennie.renderer.getPixelRatio()');
/** [name, change in the page, how to undo it] */
const VARIANTS = [
  [`as it is (${base})`, '1', ''],
  ['sharpness 0.4', sharp(0.4), sharp(base)],
  ['sharpness 0.75', sharp(0.75), sharp(base)],
  ['sharpness 1', sharp(1), sharp(base)],
  ['sharpness 1.5', sharp(1.5), sharp(base)],
  ['nothing drawn', 'lennie.camera.layers.set(1), 1', 'lennie.camera.layers.set(0), 1'],
  ['drawn into 8 px', '(() => { const r = lennie.renderer; r.setScissorTest(true); r.setScissor(0, 0, 8, 8); return 1; })()', 'lennie.renderer.setScissorTest(false), 1'],
  ['no products/clutter', '(() => { let n = 0; __root.traverse((m) => { if (m.userData.products && m.visible) { m.visible = false; m.__hid = 1; n++; } }); return n; })()',
    '(() => { __root.traverse((m) => { if (m.__hid) { m.visible = true; delete m.__hid; } }); return 1; })()'],
  ['as it is, again', '1', ''],
];
for (const [name, on, off] of VARIANTS) {
  await t.eval(on);
  await sleep(2500);
  await t.eval('__frames.length = 0, __m.render = __m.phys = 0, true');
  await sleep(4000);
  const r = await t.eval(`(() => { const f = __frames.filter((x) => x < 500); const ms = f.reduce((a, b) => a + b, 0);
    return { fps: +(1000 * f.length / ms).toFixed(1), frameMs: +(ms / f.length).toFixed(1), drawingOnMainThreadMs: +(__m.render / f.length).toFixed(1), physicsMs: +(__m.phys / f.length).toFixed(1),
      draws: lennie.renderer.info.render.calls, triangles: lennie.renderer.info.render.triangles, camera: lennie.camera.position.toArray().map((x) => +x.toFixed(1)) }; })()`);
  console.log(name.padEnd(20), JSON.stringify(r));
  if (off) await t.eval(off);
}
console.log(t.errors.length ? t.errors.slice(0, 3).join('\n') : 'no errors');
t.close();
process.exit(0);
