// What the game keeps in memory, counted in the page: pictures (all drawn on
// canvases), how many of them are on the graphics chip, the meshes' data, and
// the JavaScript heap where the browser tells it. See docs/memory.md.
//
//   node scripts/tablet/memory.mjs [url]
//
// What Android itself counts for Chrome, graphics memory included, comes from
// adb (the game's tab is the biggest "sandboxed_process", the chip's memory is
// under "privileged_process"):
//
//   adb shell dumpsys meminfo com.android.chrome
import { connect, restartChrome, sleep, GAME, TARGETS } from './cdp.mjs';

const url = process.argv[2] ?? GAME;
await restartChrome();
const t = await connect();
await t.open(url, 22000); // (past the flicker check, which keeps a copy of the scenery for its first ~15 s on localhost)

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
  for (const [x, e] of textures) {
    const px = (x.image?.width ?? 0) * (x.image?.height ?? 0);
    all += px;
    if (P.get(x).__webglTexture) { onChip += px; onChipCount++; }
    if (e.products) products += px;
    const s = x.image.width + 'x' + x.image.height; sizes[s] = (sizes[s] ?? 0) + px;
  }
  let bytes = 0, gone = 0;
  for (const g of geometries) for (const a of [...Object.values(g.attributes), g.index]) { if (!a) continue; if (a.array) bytes += a.array.byteLength; else gone++; }
  return {
    pictures: textures.size, megapixels: mpx(all),
    // 4 bytes a pixel; on the chip a third more for the smaller copies (mipmaps)
    canvasesMB: Math.round(all * 4 / 1e6), onChip: onChipCount, onChipMegapixels: mpx(onChip), onChipMB: Math.round(onChip * 4 * 4 / 3 / 1e6),
    productAndClutterMegapixels: mpx(products),
    biggest: Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, px]) => s + ': ' + mpx(px) + ' Mpx').join(', '),
    meshes, geometries: geometries.size, geometryMB: mpx(bytes), arraysThrownAway: gone,
    programs: lennie.renderer.info.programs.length, physicsBodies: lennie.world.bodies.length,
    // (Chrome on Android reports a fixed number here: use adb's dumpsys there)
    jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
  };
})()`;

console.log('after loading      ', JSON.stringify(await t.eval(COUNT)));
await t.key('Escape');
await t.key('KeyT');
await sleep(500);
for (const at of TARGETS.slice(0, 5)) {
  await t.click(...at);
  await sleep(4000);
}
console.log('after five throws  ', JSON.stringify(await t.eval(COUNT)));
console.log(t.errors.length ? t.errors.slice(0, 3).join('\n') : 'no errors');
t.close();
process.exit(0);
