// Drives the game in Chrome on an Android tablet over USB, through Chrome's
// DevTools protocol. See docs/tablet-testing.md for the one-time setup (adb
// reverse/forward). Needs Node 22+ (built-in WebSocket and fetch).
//
// Shared by the other scripts here: connect to the game's tab, load the page
// fresh, press keys, click, take screenshots, and run code in the page.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ADB = [process.env.ADB, `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`].find((p) => p && existsSync(p)) ?? 'adb';

// One script at a time. Several Claude sessions may share the one tablet, and
// a second script restarting Chrome ends the first one's measurement halfway
// (it happened: both got odd numbers and a lost connection). The script that
// has the tablet leaves its process id in a file in the temp folder; the next
// one waits here until that process has ended.
const TURN = join(tmpdir(), 'toss-the-lennie-tablet.turn');
let myTurn = false;
async function waitForTurn() {
  if (myTurn) return;
  const holder = () => {
    try {
      return Number(readFileSync(TURN, 'utf8'));
    } catch {
      return 0; // nobody has it
    }
  };
  for (let said = false; ; said = true) {
    const pid = holder();
    if (!pid || pid === process.pid) break;
    try {
      process.kill(pid, 0); // (signal 0 only asks whether the process is there)
    } catch {
      break; // that script has ended
    }
    if (!said) console.error(`waiting for another tablet script to finish (process ${pid})`);
    await sleep(3000);
  }
  writeFileSync(TURN, String(process.pid));
  myTurn = true;
  process.on('exit', () => {
    if (holder() === process.pid) rmSync(TURN, { force: true });
  });
}

/**
 * Closes Chrome on the tablet and starts it again with one light tab, so the
 * next load of the game gets a fresh process. Every load in the same tab
 * leaves memory behind: after a handful the tablet was swapping (which showed
 * as a much lower frame rate in the measurement) and then closed the tab
 * ("Aw, Snap!"). Does nothing, and returns false, when no tablet is plugged
 * in (a headless Chrome on the PC).
 */
export async function restartChrome() {
  const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    if (!/\tdevice/.test(adb('devices'))) return false;
  } catch {
    return false;
  }
  await waitForTurn();
  adb('shell', 'am', 'force-stop', 'com.android.chrome');
  await sleep(2000);
  // (a folder's listing from the game's server: nearly nothing, and on the address connect() looks for)
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'http://localhost:5173/docs/', 'com.android.chrome');
  await sleep(5000);
  // Chrome brings its old tabs back too (the game, at least): close them.
  // (Chrome isn't always listening yet: "fetch failed" now and then, so try a few times)
  let list = null;
  for (let i = 0; i < 8 && !list; i++) {
    try { list = await (await fetch('http://127.0.0.1:9222/json')).json(); } catch { await sleep(1500); }
  }
  if (!list) throw new Error("Chrome on the tablet doesn't answer on port 9222 (adb forward done? Chrome's first-run screens clicked through?)");
  const pages = list.filter((p) => p.type === 'page');
  const keep = pages.find((p) => p.url.endsWith('/docs/')) ?? pages[0];
  for (const p of pages) if (p !== keep) await fetch(`http://127.0.0.1:9222/json/close/${p.id}`);
  await sleep(1000);
  return true;
}

/**
 * What Android itself counts for Chrome on the tablet, in MB: each process's
 * memory (PSS) and, of that, graphics memory (`GL mtrack`), plus what the
 * tablet has left. `graphics` is Chrome's graphics process (where the game's
 * pictures, meshes and canvases on the chip are counted), `tab` the game's
 * tab, `chrome` the browser itself. Null without a tablet. See docs/memory.md.
 */
export function androidMemory() {
  const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 1e8, stdio: ['ignore', 'pipe', 'ignore'] });
  let out;
  try {
    if (!/\tdevice/.test(adb('devices'))) return null;
    out = adb('shell', 'dumpsys', 'meminfo', '--package', 'com.android.chrome');
  } catch {
    return null;
  }
  const NAMES = { privileged: 'graphics', sandboxed: 'tab', '': 'chrome' };
  const res = { graphics: 0, graphicsGL: 0, tab: 0, chrome: 0 };
  let cur = null;
  for (const line of out.split('\n')) {
    const m = line.match(/MEMINFO in pid \d+ \[com\.android\.chrome:?([a-z]*)/);
    if (m) cur = NAMES[m[1]] ?? null;
    if (!cur) continue;
    const gl = line.match(/^\s+GL mtrack\s+(\d+)/);
    if (gl && cur === 'graphics') res.graphicsGL += Math.round(gl[1] / 1024);
    const total = line.match(/TOTAL PSS:\s+(\d+)/);
    if (total) res[cur] += Math.round(total[1] / 1024); // (several tabs' processes are added up: keep one tab open)
  }
  res.together = res.graphics + res.tab + res.chrome;
  const info = adb('shell', 'cat', '/proc/meminfo');
  res.available = Math.round(+info.match(/MemAvailable:\s+(\d+)/)[1] / 1024);
  res.swapFree = Math.round(+info.match(/SwapFree:\s+(\d+)/)[1] / 1024);
  return res;
}

/** Where the tablet's Chrome finds the game: the PC's server through `adb reverse`. */
export const GAME = 'http://localhost:5173/index.html';

/**
 * The same address as a player gets the game: `localhost.` with a dot is still
 * this PC, but the game doesn't take it for a developer's computer, so it
 * skips the flicker check. That check alone leaves some 300 MB behind in the
 * tab for a while (see docs/memory.md), which no player ever has.
 */
export const asPlayer = (url) => url.replace('//localhost:', '//localhost.:');

/**
 * Connects to the tab showing the game (the first tab on localhost:5173). Keep
 * only one game tab open on the tablet: two copies of the game ran it out of
 * memory and Android closed Chrome.
 */
export async function connect({ match = ':5173' } = {}) {
  await waitForTurn();
  const list = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = list.find((p) => p.type === 'page' && p.url.includes(match)) ?? list.find((p) => p.type === 'page');
  if (!page) throw new Error('No Chrome tab found. Is the tablet plugged in, Chrome open, and `adb forward tcp:9222 localabstract:chrome_devtools_remote` done?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const waiting = new Map();
  const errors = []; // exceptions and console errors/warnings, as they come
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) {
      waiting.get(d.id)(d);
      waiting.delete(d.id);
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 800));
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
      errors.push(`${d.params.type}: ` + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const i = ++id;
    waiting.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  // The game's opening screen waits for a tap on Play: here it goes away by itself
  // as soon as the game is ready, so the scripts measure and throw as they always did.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.lennieSkipSplash = true;' });

  const t = {
    url: page.url,
    errors,
    send,
    close: () => ws.close(),
    /** Runs `expr` in the page (it may be an async function call) and returns its value. */
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
      return r.result?.result?.value;
    },
    /**
     * Loads `url` without the browser's cache. Python's http.server sends no
     * cache headers, so a plain reload can run old copies of the modules and
     * measure code that's no longer there.
     */
    async open(url, wait = 18000) {
      await send('Network.enable');
      await send('Network.setCacheDisabled', { cacheDisabled: true });
      // An empty page first, so the game that was running is let go of before
      // the next one loads: two at once ran the tablet out of memory, and the
      // tab crashed ("Aw, Snap!", after which nothing here gets an answer).
      await send('Page.navigate', { url: 'about:blank' });
      await sleep(4000); // (1.5 s wasn't always enough: after a few dozen loads in a row the tab crashed all the same)
      await send('Page.navigate', { url });
      await sleep(wait + 1500);
    },
    async key(code) {
      const [key, vk] = KEYS[code];
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk, text: key.length === 1 ? key : undefined });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk });
    },
    /** A mouse click at a fraction of the screen (in aim mode a click throws Lennie there). */
    async click(fx, fy) {
      const { w, h } = await t.eval('({ w: innerWidth, h: innerHeight })');
      const x = Math.round(w * fx);
      const y = Math.round(h * fy);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
      await sleep(150);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await sleep(60);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    },
    async screenshot(file) {
      const { writeFileSync } = await import('node:fs');
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
  };
  return t;
}

const KEYS = {
  KeyT: ['t', 84], KeyR: ['r', 82], KeyG: ['g', 71], Escape: ['Escape', 27],
  Digit1: ['1', 49], Digit2: ['2', 50], Digit3: ['3', 51], Digit5: ['5', 53],
};

/** Aimed throws: screen spots that land in the house from the start view, and keep landing somewhere after. */
export const TARGETS = [[0.5, 0.3], [0.25, 0.45], [0.75, 0.4], [0.5, 0.55], [0.35, 0.25], [0.65, 0.6], [0.2, 0.3], [0.8, 0.5]];

/** Records every frame's length (ms) in the page, in window.__frames. */
export const FRAME_RECORDER = `(() => {
  if (window.__frames) return true;
  window.__frames = [];
  (function loop(t0) { requestAnimationFrame((t) => { if (t0) __frames.push(t - t0); loop(t); }); })();
  return true;
})()`;

/** Frame-time summary of a list of frame lengths (ms). */
export function frameStats(d) {
  d = d.filter((x) => x < 1000);
  if (!d.length) return null;
  const sorted = [...d].sort((a, b) => a - b);
  const total = d.reduce((a, b) => a + b, 0);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    frames: d.length,
    fps: +((1000 * d.length) / total).toFixed(1),
    medianMs: +pct(0.5).toFixed(1),
    p95Ms: +pct(0.95).toFixed(1),
    worstMs: Math.round(sorted.at(-1)),
    over100ms: d.filter((x) => x > 100).length,
  };
}
