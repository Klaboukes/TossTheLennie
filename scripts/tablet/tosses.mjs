// The standard tablet speed test: 5 aimed throws in the house, 5 in the
// supermarket, 5 more in the house after tidying up (R). Prints frames per
// second and hitches for each, and any errors.
//
//   node scripts/tablet/tosses.mjs [url] [throws per place] [first]
//
// url defaults to the main checkout's game; for a worktree use
// http://localhost:5173/.claude/worktrees/<name>/index.html
import { connect, restartChrome, sleep, GAME, TARGETS, FRAME_RECORDER, frameStats } from './cdp.mjs';

const url = process.argv[2] ?? GAME;
const throws = Number(process.argv[3] ?? 5);
await restartChrome();
const t = await connect();
// With `first` as the third argument the game forgets what it remembered about
// this device's speed, so it starts as on a first visit: full sharpness and
// shading, stepping down while the test runs.
if (process.argv[4] === 'first') await t.eval("localStorage.removeItem('toss-the-lennie:quality'), true");
await t.open(url, 1500);
await t.eval(FRAME_RECORDER);
await sleep(12000);
const info = await t.eval(`(() => {
  const c = document.getElementById('scene');
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return { css: [innerWidth, innerHeight], dpr: devicePixelRatio, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?' };
})()`);
console.log('page', url, JSON.stringify(info));
console.log('loading', JSON.stringify(frameStats(await t.eval('__frames.splice(0)'))));

async function place(name, setup) {
  await setup();
  await sleep(3000);
  await t.key('KeyT'); // aim mode on
  await sleep(800);
  const all = [];
  for (let i = 0; i < throws; i++) {
    await t.eval('__frames.length = 0, true');
    await t.click(...TARGETS[i % TARGETS.length]);
    await sleep(6000);
    const f = await t.eval('__frames.splice(0)');
    all.push(...f);
    console.log(`${name} throw ${i + 1}`, JSON.stringify(frameStats(f)));
  }
  await t.key('KeyT');
  console.log(`${name} OVERALL`, JSON.stringify(frameStats(all)));
}

await place('house', () => t.key('Escape'));
await place('supermarket', () => t.key('Digit5'));
await place('house after R', () => t.key('KeyR'));
const sharp = await t.eval(`(() => { const c = document.getElementById('scene'); return +(c.width / c.clientWidth).toFixed(2); })()`);
console.log('sharpness at the end (pixel ratio; watchSpeed lowers it on a slow device):', sharp, '- shading:', await t.eval("window.lennie.simpleShading?.() ? 'simple' : 'full'"));
console.log(t.errors.length ? t.errors.join('\n') : 'no errors');
t.close();
process.exit(0);
