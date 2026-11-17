// What the game keeps in memory. Counted in the page: pictures, how many of
// them still hold a canvas, how many are on the graphics chip, the meshes'
// data. And, on the tablet, what Android itself counts for Chrome's processes
// (graphics memory included): after loading, after five throws, and after a
// forced garbage collection. See docs/memory.md.
//
//   node scripts/tablet/memory.mjs [url] [dev]
//
// The game is loaded as a player gets it (see asPlayer in cdp.mjs); with `dev`
// as on localhost, with the flicker check, which leaves some 300 MB of
// garbage in the tab until the browser cleans up.
import { connect, restartChrome, androidMemory, asPlayer, sleep, GAME, TARGETS } from './cdp.mjs';

const url = process.argv[3] === 'dev' ? (process.argv[2] ?? GAME) : asPlayer(process.argv[2] ?? GAME);
await restartChrome();
const t = await connect();
await t.open(url, 22000); // (past the flicker check, and past the game finding its sharpness)

const COUNT = `(() => {
  let root = lennie.aimRing; while (root.parent) root = root.parent;
  const P = lennie.renderer.properties;
  const textures = new Map(); const geometries = new Set(); let meshes = 0;
  root.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    meshes++;
    if (o.geometry) geometries.add(o.geometry);
    const products = !!(o.userData.products || o.isInstancedMesh);
    for (const m of [].concat(o.material)) for (const k of ['map', 'emissiveMap', 'alphaMap', 'normalMap']) {
      const x = m?.[k]; if (!x) continue;
      const e = textures.get(x) ?? { products: true }; e.products &&= products; textures.set(x, e);
    }
  });
  const mpx = (n) => +(n / 1e6).toFixed(1);
  let all = 0, onChip = 0, onChipCount = 0, products = 0; const sizes = {};
  // (a picture's size from sizeOf: asking for its canvas would draw it again, see src/pictures.js)
  const sizeOf = lennie.sizeOf ?? ((x) => x.image);
  for (const [x, e] of textures) {
    const size = sizeOf(x) ?? { width: 0, height: 0 };
    const px = size.width * size.height;
    all += px;
    if (P.get(x).__webglTexture) { onChip += px; onChipCount++; }
    if (e.products) products += px;
    const s = size.width + 'x' + size.height; sizes[s] = (sizes[s] ?? 0) + px;
  }
  // the canvases still in memory: every picture's before pictures.js, now only those not sent to the chip yet (and the TV's)
  const held = lennie.pictures ? { n: lennie.pictures.held + 1, px: lennie.pictures.heldPixels + 256 * 144 } : { n: textures.size, px: all };
  let bytes = 0;
  for (const g of geometries) for (const a of [...Object.values(g.attributes), g.index]) if (a?.array) bytes += a.array.byteLength;
  return {
    pictures: textures.size, megapixels: mpx(all),
    // 4 bytes a pixel; on the chip a third more for the smaller copies (mipmaps)
    canvases: held.n, canvasMegapixels: mpx(held.px), canvasesMB: Math.round(held.px * 4 / 1e6),
    mostCanvasMegapixelsAtOnce: lennie.pictures ? mpx(lennie.pictures.mostPixels) : undefined, drawnOnDemand: lennie.pictures?.drawnOnDemand,
    onChip: onChipCount, onChipMegapixels: mpx(onChip), onChipMB: Math.round(onChip * 4 * 4 / 3 / 1e6),
    productAndClutterMegapixels: mpx(products),
    biggest: Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, px]) => s + ': ' + mpx(px) + ' Mpx').join(', '),
    meshes, geometries: geometries.size, geometryMB: mpx(bytes),
    programs: lennie.renderer.info.programs.length, physicsBodies: lennie.world.bodies.length,
    quality: lennie.quality?.(),
    // (Chrome on Android reports a fixed number here: Android's own count below is the one to read there)
    jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
  };
})()`;
const android = () => {
  const a = androidMemory();
  return a ? `Android: graphics process ${a.graphics} MB (of which graphics memory ${a.graphicsGL}), the game's tab ${a.tab}, Chrome itself ${a.chrome}: together ${a.together} MB; ${a.available} MB still available` : '';
};

console.log(url);
console.log('after loading      ', JSON.stringify(await t.eval(COUNT)));
console.log('                   ', android());
await t.key('Escape');
await t.key('KeyT');
await sleep(500);
for (const at of TARGETS.slice(0, 5)) {
  await t.click(...at);
  await sleep(4000);
}
console.log('after five throws  ', JSON.stringify(await t.eval(COUNT)));
console.log('                   ', android());
// What's garbage and what's really kept: the tab's memory after a clean-up the browser would otherwise do in its own time.
await t.send('HeapProfiler.collectGarbage');
await sleep(6000);
console.log('after a clean-up   ', android());
console.log(t.errors.length ? t.errors.slice(0, 3).join('\n') : 'no errors');
t.close();
process.exit(0);
