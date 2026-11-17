// Drives the game in Chrome on an Android tablet over USB, through Chrome's
// DevTools protocol. See docs/tablet-testing.md for the one-time setup (adb
// reverse/forward). Needs Node 22+ (built-in WebSocket and fetch).
//
// Shared by the other scripts here: connect to the game's tab, load the page
// fresh, press keys, click, take screenshots, and run code in the page.

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Where the tablet's Chrome finds the game: the PC's server through `adb reverse`. */
export const GAME = 'http://localhost:5173/index.html';

/**
 * Connects to the tab showing the game (the first tab on localhost:5173). Keep
 * only one game tab open on the tablet: two copies of the game ran it out of
 * memory and Android closed Chrome.
 */
export async function connect({ match = 'localhost:5173' } = {}) {
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
      await send('Page.navigate', { url });
      await sleep(1500);
      await send('Page.reload', { ignoreCache: true });
      await sleep(wait);
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
