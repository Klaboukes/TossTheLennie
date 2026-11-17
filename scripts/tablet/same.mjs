// Does a change leave the physics exactly as it was? Plays the same twenty
// tosses in two versions of the game (say main and a worktree), with the dice
// and the clock fixed so nothing is left to chance, and compares where Lennie
// and the loose furniture end up, to the last digit. For changes that should
// only make the physics cheaper (broadphase.js, guard.js), not different.
//
//   node scripts/tablet/same.mjs <url A> <url B>
//
// Give the same url twice first, to see that it repeats at all. Works on the
// tablet or on any Chrome with remote debugging on port 9222.
import { connect, sleep } from './cdp.mjs';

// Before the game loads: dice that always roll the same, a clock that ticks
// once per look, and no frames or timers of the browser's own (the tosses
// below run the game loop by hand).
const FIXED = `(() => {
  let s = 12345;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let now = 0;
  performance.now = () => (now += 0.001);
  window.requestAnimationFrame = () => 0;
  window.setTimeout = () => 0;
  window.setInterval = () => 0;
})()`;

const TOSSES = `(async () => {
  const THREE = await import('three');
  const L = window.lennie;
  // (the score card's size decides how the picture is shifted, which decides
  // which popups are on screen, and each popup rolls a die: so a font that
  // arrives halfway would change the tosses after it)
  await document.fonts.ready;
  L.renderer.render = () => {};
  const bits = new DataView(new ArrayBuffer(8));
  const out = [];
  // (from the living room, the first floor, the attic, the supermarket, the living room again towards the garden, the shop's shelves, the roof)
  const shots = [[3, 6, -8], [-6, 5, 2], [0, 9, -3], [8, 4, 6], [-4, 7, -9], [2, 3, 12], [12, 6, 0], [-12, 8, -6], [0, 14, 0], [5, 2, -15], [-9, 3, 9], [1, 18, 4],
    [0, 8, -14], [-8, 6, -12], [6, 10, -16], [10, 5, 3], [-10, 5, -3], [0, 6, 8], [4, 2, 10], [-5, 3, -10]];
  shots.forEach(([x, y, z], i) => {
    if (i === 4) L.dropLennie(1);
    if (i === 7) L.dropLennie(2);
    if (i === 9 || i === 15) L.dropLennie(4);
    if (i === 12) L.dropLennie(0);
    if (i === 18) L.dropLennie(3);
    L.launch(new THREE.Vector3(x, y, z));
    L.advance(5);
    let h = 2166136261;
    const add = (v) => { bits.setFloat64(0, v); for (let k = 0; k < 8; k++) h = Math.imul(h ^ bits.getUint8(k), 16777619) >>> 0; };
    for (const b of [...L.lennie.bodies, ...L.house.loose.items.map((it) => it.body)]) {
      for (const v of [b.position, b.quaternion, b.velocity]) { add(v.x); add(v.y); add(v.z); }
    }
    const p = L.lennie.parts.pelvis.body.position;
    out.push(h.toString(16) + ' hips at ' + [p.x, p.y, p.z].map((v) => v.toFixed(3)).join(', ') + ', rescues ' + L.guard.totalRescues);
  });
  return out;
})()`;

async function play(url) {
  const t = await connect();
  const { result } = await t.send('Page.addScriptToEvaluateOnNewDocument', { source: FIXED });
  await t.open(url, 0);
  for (let i = 0; i < 60 && !(await t.eval('!!window.lennie').catch(() => false)); i++) await sleep(1000);
  await sleep(3000); // (anything still loading has a moment to finish, so it can't roll the dice mid-toss)
  const out = await t.eval(TOSSES);
  await t.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: result.identifier });
  if (t.errors.length) console.log(`errors at ${url}:\n${t.errors.slice(0, 3).join('\n')}`);
  t.close();
  return out;
}

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.log('usage: node scripts/tablet/same.mjs <url A> <url B>');
  process.exit(1);
}
const A = await play(a);
const B = await play(b);
let same = 0;
A.forEach((line, i) => {
  if (line === B[i]) same++;
  console.log(`toss ${String(i + 1).padStart(2)}  ${line === B[i] ? 'same     ' : 'DIFFERENT'}  ${line}${line === B[i] ? '' : `\n${' '.repeat(19)}${B[i]}`}`);
});
console.log(same === A.length ? `All ${same} tosses end exactly the same.` : `${A.length - same} of ${A.length} tosses end differently.`);
process.exit(0);
