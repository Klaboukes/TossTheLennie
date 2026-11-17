// Chrome's own breakdown of its memory, per process (the game's tab is the
// "Renderer", the graphics chip's side the "GPU Process"), for the game that's
// open on the tablet right now: where Android's totals (memory.mjs) go.
//
//   node scripts/tablet/breakdown.mjs [process] [prefix] [depth] [min MB]
//
// e.g.  breakdown.mjs                     every process, top level
//       breakdown.mjs Renderer v8 4       the JavaScript heap of the tab
//       breakdown.mjs GPU gpu 3           the graphics process's own count
//       breakdown.mjs GPU images          the graphics process's pictures by what they're for
//                                         (a canvas is a "CanvasResourceRaster")
//
// What WebGL itself holds on the chip (the game's textures and meshes) isn't
// in Chrome's count on Android; it's in Android's `GL mtrack` all the same.
const [who = '', prefix = '', depthArg = '1', minArg = '3'] = process.argv.slice(2);
const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const waiting = new Map();
const events = [];
let done;
const finished = new Promise((r) => { done = r; });
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); }
  if (d.method === 'Tracing.dataCollected') events.push(...d.params.value);
  if (d.method === 'Tracing.tracingComplete') done();
};
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; waiting.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], excludedCategories: ['*'], memoryDumpConfig: { triggers: [] } } });
await new Promise((r) => setTimeout(r, 1000));
await send('Tracing.requestMemoryDump', { levelOfDetail: 'detailed' });
await send('Tracing.end');
await finished;
ws.close();

const names = {};
for (const e of events) if (e.ph === 'M' && e.name === 'process_name') names[e.pid] = e.args.name;
const MB = (n) => +(n / 1048576).toFixed(1);
const size = (a) => (a.attrs?.size ? parseInt(a.attrs.size.value, 16) : 0);
for (const e of events) {
  const all = e.ph === 'v' && e.args.dumps?.allocators;
  if (!all || !(names[e.pid] ?? '').startsWith(who)) continue;
  console.log(`\n== ${names[e.pid]} (pid ${e.pid})`);
  const sums = {};
  if (prefix === 'images') {
    for (const [name, a] of Object.entries(all)) {
      const label = a.attrs?.['debug label']?.value;
      if (!name.startsWith('gpu/shared_images/') || !label) continue;
      const key = label.replace(/_?Pid:\d+/, '');
      (sums[key] ??= { size: 0, n: 0 }).size += size(a);
      sums[key].n++;
    }
  } else {
    // only the leaves count: a parent's size is its children's again
    const parents = new Set();
    for (const n of Object.keys(all)) { const p = n.split('/'); for (let i = 1; i < p.length; i++) parents.add(p.slice(0, i).join('/')); }
    for (const [name, a] of Object.entries(all)) {
      if (!name.startsWith(prefix) || parents.has(name) || name.startsWith('global/')) continue;
      const key = name.split('/').slice(0, +depthArg).join('/').replace(/0x[0-9a-fA-F]+/g, '*').replace(/\d{2,}/g, '#');
      (sums[key] ??= { size: 0, n: 0 }).size += size(a);
      sums[key].n++;
    }
  }
  let total = 0;
  for (const [k, v] of Object.entries(sums).sort((a, b) => b[1].size - a[1].size)) {
    if (v.size > 1e13) continue; // (a database's address space, not memory)
    total += v.size;
    if (MB(v.size) >= +minArg) console.log(`${String(MB(v.size)).padStart(9)} MB  ${k}  (${v.n})`);
  }
  console.log(`${String(MB(total)).padStart(9)} MB  in all`);
}
process.exit(0);
