// CPU profile of three aimed throws in the house (or the supermarket) on the
// tablet: where the main thread's time goes, by file and by function. A big
// "(idle)" share means the main thread is waiting for the graphics chip.
//
//   node scripts/tablet/profile.mjs [url] [house|supermarket]
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect, sleep, GAME, TARGETS } from './cdp.mjs';

const url = process.argv[2] ?? GAME;
const place = process.argv[3] ?? 'house';
const t = await connect();
await t.open(url, 20000); // (past the flicker check, which runs in the first ~15 s on localhost)
await t.key('Escape');
await t.key(place === 'house' ? 'KeyR' : 'Digit5');
await sleep(4000);
await t.key('KeyT');
await sleep(800);
await t.send('Profiler.enable');
await t.send('Profiler.setSamplingInterval', { interval: 500 });
await t.send('Profiler.start');
for (const at of TARGETS.slice(0, 3)) {
  await t.click(...at);
  await sleep(5500);
}
const { result } = await t.send('Profiler.stop');
await t.key('KeyT');
const prof = result.profile;
mkdirSync('reports', { recursive: true }); // (git ignores reports/)
writeFileSync(`reports/tablet-${place}.cpuprofile`, JSON.stringify(prof)); // (opens in Chrome DevTools' Performance tab)

const self = new Map();
for (let i = 0; i < prof.samples.length; i++) self.set(prof.samples[i], (self.get(prof.samples[i]) ?? 0) + (prof.timeDeltas[i + 1] ?? 0));
const byFile = new Map();
const byFn = new Map();
let total = 0;
for (const n of prof.nodes) {
  const us = self.get(n.id) ?? 0;
  total += us;
  const f = n.callFrame;
  const file = f.url.split('/').pop() || '(native)';
  byFile.set(file, (byFile.get(file) ?? 0) + us);
  const fn = `${f.functionName || '(anonymous)'}  ${file}:${f.lineNumber + 1}`;
  byFn.set(fn, (byFn.get(fn) ?? 0) + us);
}
// The same by function, with everything it calls counted in: shows which part
// of a frame the time belongs to (the physics, the drawing, the aiming...).
const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const whole = new Map();
for (const [id, us] of self) {
  const seen = new Set();
  for (let at = id; at !== undefined; at = parent.get(at)) {
    const f = byId.get(at).callFrame;
    const fn = `${f.functionName || '(anonymous)'}  ${f.url.split('/').pop() || '(native)'}:${f.lineNumber + 1}`;
    if (seen.has(fn)) continue;
    seen.add(fn);
    whole.set(fn, (whole.get(fn) ?? 0) + us);
  }
}
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([k, v]) => `${(v / 1000).toFixed(0).padStart(6)} ms ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`).join('\n');
console.log(`--- by file\n${top(byFile, 15)}\n--- by function\n${top(byFn, 30)}\n--- by function, with what it calls\n${top(whole, 40)}`);
console.log(t.errors.length ? t.errors.join('\n') : 'no errors');
t.close();
process.exit(0);
