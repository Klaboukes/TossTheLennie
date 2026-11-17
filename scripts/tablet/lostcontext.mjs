// Does the game come back by itself after a lost graphics context? A weak
// device takes the game's graphics memory away now and then and gives it back
// a few seconds later; three.js then asks for every mesh and picture again.
// This loads the game, forces that (twice), throws Lennie afterwards, and
// prints how long the game stood still, how many pictures were drawn again
// (src/pictures.js) and any errors. Two screenshots (before, after) land next
// to this script's working directory to compare by eye. See docs/memory.md.
//
//   node scripts/tablet/lostcontext.mjs [url]
//
// Works in a headless Chrome on the PC too (see docs/tablet-testing.md).
import { connect, restartChrome, sleep, GAME } from './cdp.mjs';

const url = process.argv[2] ?? GAME;
await restartChrome();
const t = await connect();
await t.open(url, 22000);
await t.key('Escape');
await sleep(1000);
const state = '({ picturesOnChip: lennie.renderer.info.memory.textures, canvasesHeld: lennie.pictures?.held, drawnOnDemand: lennie.pictures?.drawnOnDemand })';
console.log('before          ', JSON.stringify(await t.eval(state)));
await t.screenshot('lostcontext-before.jpg');
await t.eval('(() => { window.__ft = []; (function loop() { requestAnimationFrame(() => { __ft.push(performance.now()); loop(); }); })(); return true; })()');
for (let round = 1; round <= 2; round++) {
  await t.eval("(window.__lose = lennie.renderer.getContext().getExtension('WEBGL_lose_context'), __lose.loseContext(), true)");
  await sleep(2500);
  await t.eval('(window.__restoredAt = performance.now(), __lose.restoreContext(), true)');
  await sleep(10000);
  const r = await t.eval(`(() => {
    const after = __ft.filter((x) => x > __restoredAt);
    let prev = __restoredAt; let worst = 0;
    for (const x of after) { worst = Math.max(worst, x - prev); prev = x; }
    return { framesSince: after.length, stoodStillMs: Math.round(worst), lost: lennie.renderer.getContext().isContextLost(), ...${state} };
  })()`);
  console.log(`lost and back ${round} `, JSON.stringify(r));
}
await t.screenshot('lostcontext-after.jpg');
// and it still plays
await t.key('KeyT');
await sleep(500);
await t.click(0.5, 0.3);
await sleep(5000);
console.log('after a throw   ', JSON.stringify(await t.eval(state)));
console.log(t.errors.length ? t.errors.slice(0, 6).join('\n') : 'no errors');
console.log('Compare lostcontext-before.jpg and lostcontext-after.jpg: they should show the same room.');
t.close();
process.exit(0);
