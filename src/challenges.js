// Challenges: one goal at a time, roughly from easy to hard. Progress is kept
// in the browser, so it carries over to the next visit on the same device.
//
// Each test gets what happened in a scored toss:
//   { total, ids: Set of trick, feat and landing-spot ids, chain: { bounces, juggles, smashed, doors, trampoline } }

const KEY = 'toss-the-lennie:challenges';

export const CHALLENGES = [
  { id: 'score500', text: 'Score 500 points in one toss', test: (r) => r.total >= 500 },
  { id: 'window', text: 'Smash a window', test: (r) => r.chain.smashed >= 1 },
  { id: 'door', text: 'Crash through a door', test: (r) => r.chain.doors >= 1 },
  { id: 'upside', text: 'Leave Lennie upside down', test: (r) => r.ids.has('upside') },
  { id: 'couch', text: 'Make Lennie a couch potato', test: (r) => r.ids.has('couch') },
  { id: 'tv', text: 'Throw Lennie into the TV', test: (r) => r.ids.has('tv') },
  { id: 'out', text: 'Throw Lennie out of the house', test: (r) => r.ids.has('defenestrated') || r.ids.has('hanging') },
  { id: 'stairs', text: 'Tumble Lennie down the stairs', test: (r) => r.ids.has('stairs') || r.ids.has('fullflight') },
  { id: 'bed', text: 'Put Lennie to bed', test: (r) => r.ids.has('bed') },
  { id: 'games', text: 'Knock the board games out of the closet', test: (r) => r.ids.has('games') },
  { id: 'trampoline', text: 'Bounce Lennie on the trampoline', test: (r) => r.chain.trampoline >= 1 },
  { id: 'bath', text: 'Land Lennie in the bath', test: (r) => r.ids.has('bath') },
  { id: 'juggle', text: 'Catch Lennie in mid-air twice in one toss', test: (r) => r.chain.juggles >= 2 },
  { id: 'roof', text: 'Leave Lennie stranded on the roof', test: (r) => r.ids.has('roof') },
  { id: 'loo', text: 'Sit Lennie on the loo', test: (r) => r.ids.has('loo') },
  { id: 'twowindows', text: 'Smash two windows in one toss', test: (r) => r.chain.smashed >= 2 },
  { id: 'shopping', text: 'Take Lennie shopping', test: (r) => r.ids.has('shopping') },
  { id: 'checkout', text: 'Scan Lennie at the checkout', test: (r) => r.ids.has('checkout') },
  { id: 'pindakaas', text: 'Drop Lennie in the pindakaas', test: (r) => r.ids.has('pindakaas') },
  { id: 'butcher', text: 'Send Lennie behind the butcher counter', test: (r) => r.ids.has('butcher') },
  { id: 'mess', text: 'Knock products off the supermarket shelves', test: (r) => r.ids.has('mess') },
  { id: 'freezer', text: 'Put Lennie in the freezer', test: (r) => r.ids.has('freezer') },
  { id: 'pastry', text: 'Crash Lennie into the pastry case', test: (r) => r.ids.has('pastry') },
  { id: 'shopout', text: 'Get Lennie kicked out of the supermarket', test: (r) => r.ids.has('shopout') },
  { id: 'tree', text: 'Get Lennie stuck in a tree', test: (r) => r.ids.has('tree') },
  { id: 'knot', text: 'Tie Lennie in a human knot', test: (r) => r.ids.has('knot') },
  { id: 'score2500', text: 'Score 2,500 points in one toss', test: (r) => r.total >= 2500 },
];

export const CHALLENGE_BONUS = 300;

export class Challenges {
  constructor() {
    this.done = new Set();
    this.skipped = [];
    this.chosen = null; // a challenge picked from the list, which goes before the usual order
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      for (const id of saved.done ?? []) this.done.add(id);
      this.skipped = (saved.skipped ?? []).filter((id) => !this.done.has(id));
      if (CHALLENGES.some((c) => c.id === saved.chosen)) this.chosen = saved.chosen;
    } catch { /* storage unavailable */ }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ done: [...this.done], skipped: this.skipped, chosen: this.chosen }));
    } catch { /* ignore */ }
  }

  /**
   * The challenge to show now: the one picked from the list (done ones can be
   * picked again), else the first not done and not skipped, then the skipped ones again.
   */
  get current() {
    if (this.chosen) return CHALLENGES.find((c) => c.id === this.chosen);
    const open = CHALLENGES.filter((c) => !this.done.has(c.id));
    const fresh = open.find((c) => !this.skipped.includes(c.id));
    if (fresh) return fresh;
    // only skipped ones left: the one skipped longest ago
    return open.find((c) => c.id === this.skipped[0]) ?? open[0] ?? null;
  }

  /** The current challenge's place in the list, from 1. */
  get number() {
    const c = this.current;
    return c ? CHALLENGES.indexOf(c) + 1 : CHALLENGES.length;
  }

  get count() {
    return CHALLENGES.length;
  }

  get doneCount() {
    return this.done.size;
  }

  isDone(id) {
    return this.done.has(id);
  }

  /** Makes this challenge the current one, whatever the order. */
  select(id) {
    if (!CHALLENGES.some((c) => c.id === id)) return;
    this.chosen = id;
    this.skipped = this.skipped.filter((s) => s !== id);
    this.#save();
  }

  /** Checks a scored toss against the current challenge; returns it if it was just completed. */
  check(result) {
    const c = this.current;
    if (!c || !c.test(result)) return null;
    this.done.add(c.id);
    this.skipped = this.skipped.filter((id) => id !== c.id);
    this.chosen = null;
    this.#save();
    return c;
  }

  skip() {
    const c = this.current;
    if (!c) return;
    this.chosen = null;
    if (!this.done.has(c.id)) this.skipped = [...this.skipped.filter((id) => id !== c.id), c.id];
    this.#save();
  }

  restart() {
    this.done.clear();
    this.skipped = [];
    this.chosen = null;
    this.#save();
  }
}
