// What a kid does: load the game, then press reload a few times in the same
// tab, with a couple of throws each time. Prints Android's count after each
// load, and says so when the tab stops answering (it crashed: "Aw, Snap!").
// Loaded as a player gets it (see asPlayer in cdp.mjs). See docs/memory.md.
//
//   node scripts/tablet/reloads.mjs [url] [reloads] [throws per load]
import { connect, restartChrome, androidMemory, asPlayer, sleep, GAME, TARGETS } from './cdp.mjs';

const url = asPlayer(process.argv[2] ?? GAME);
const reloads = Number(process.argv[3] ?? 5);
const throws = Number(process.argv[4] ?? 2);
const android = () => {
  const a = androidMemory();
  return a ? `graphics process ${a.graphics} MB (graphics memory ${a.graphicsGL}), tab ${a.tab}, Chrome ${a.chrome}: together ${a.together} MB; ${a.available} MB available, ${a.swapFree} MB of swap free` : '';
};
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r('NO ANSWER'), ms))]);

await restartChrome();
await sleep(2000);
const t = await connect();
await t.send('Network.enable');
await t.send('Network.setCacheDisabled', { cacheDisabled: true });
console.log(url);
for (let i = 0; i <= reloads; i++) {
  const sent = await within(i === 0 ? t.send('Page.navigate', { url }) : t.send('Page.reload', { ignoreCache: true }), 20000);
  await sleep(16000);
  const running = sent === 'NO ANSWER' ? sent : await within(t.eval("!!window.lennie && !document.getElementById('loading')").catch((e) => e.message), 8000);
  if (running !== true) {
    console.log(`load ${i + 1}: the game isn't running (${running}).`, android());
    if (running === 'NO ANSWER') break; // the tab is gone
    continue;
  }
  await t.key('Escape');
  await t.key('KeyT');
  await sleep(400);
  for (const at of TARGETS.slice(0, throws)) {
    await t.click(...at);
    await sleep(3500);
  }
  const lost = await within(t.eval('lennie.renderer.getContext().isContextLost()'), 5000);
  console.log(`load ${i + 1}:`, android(), lost === true ? '- THE GRAPHICS CONTEXT IS LOST' : '', t.errors.length ? '- errors: ' + t.errors.splice(0).slice(0, 2).join(' | ').slice(0, 300) : '');
}
// How much of that is the earlier loads' garbage, which the browser clears in its own time (or when memory runs short)?
if (await within(t.send('HeapProfiler.collectGarbage'), 20000) !== 'NO ANSWER') {
  await sleep(6000);
  console.log('after a clean-up:', android());
}
t.close();
process.exit(0);
