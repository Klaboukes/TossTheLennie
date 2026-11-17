# Testing speed on a real tablet

The game has to play smoothly on cheap tablets (see *Low-end devices* in
CLAUDE.md). Chrome's CPU slowdown on a PC is a rough stand-in; the owner's
**Lenovo Tab M11** is the real thing, and it can be driven from the PC over USB.
This page says how, and what testing on it taught us (November 2026).

## The tablet

Lenovo Tab M11 (TB330FU): MediaTek Helio G88, **Mali-G52 MC2** graphics, 4 GB
memory, Android 15, a 1920×1200 screen at 90 Hz (devicePixelRatio 1.5, so the
page is 1280×605 in landscape with Chrome's bars). Chrome 157.

## Setting it up

Once, on the tablet: *Settings → About tablet*, tap *Build number* 7 times;
then *System → Developer options → USB debugging* on. Plug it in with a cable
that carries data (the first one tried only charged: Windows saw nothing),
unlock it, and allow *USB debugging* for this PC. Chrome's own first-run
screens have to be clicked through by hand.

On the PC, `adb` is in the Android SDK and not on the PATH:
`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.

```bash
adb devices                                                # the tablet should be listed as "device"
adb reverse tcp:5173 tcp:5173                              # the tablet's localhost:5173 is the PC's game server
adb forward tcp:9222 localabstract:chrome_devtools_remote  # the PC's port 9222 is the tablet's Chrome
```

Serve the game on the PC as usual (`python -m http.server 5173`, or the
preview server), and open `http://localhost:5173/index.html` in Chrome on the
tablet (`adb shell am start -a android.intent.action.VIEW -d <url> com.android.chrome`).
Because it's *localhost*, the game runs its flicker check there too. A
worktree's version is at `http://localhost:5173/.claude/worktrees/<name>/index.html`.

## The scripts

In `scripts/tablet/` (Node 22+; `cdp.mjs` is the shared part). They throw
Lennie in aim mode (T, then a click), which repeats well from run to run.

| Script | What it tells you |
|---|---|
| `tosses.mjs [url] [throws] [first] [nofar]` | The standard test: 5 throws in the house, 5 in the supermarket, 5 after R. Frames per second and hitches per throw, and any errors. The game picks its own sharpness and shading, as for a player; with `first` it forgets what it remembered, as on a first visit. With `nofar` the house and the shop are drawn in full from across the road too (see *Fourth round*). |
| `ab.mjs <url> base base <variant>…` | A/B experiments: change one thing in the page (hide the clutter, cheaper shading, lower resolution…) and measure 3 house throws, with physics time per frame. `q0`…`q4` hold the game at one step of its own sharpness-and-shading list; `nofar` switches the far copies off. |
| `memory.mjs [url]` | What the game keeps in memory, counted in the page. See [memory.md](memory.md). |
| `profile.mjs [url]` | A CPU profile of 3 house throws: where the main thread's time goes, by file, by function, and by function with everything it calls. |
| `draws.mjs [url]` | How many separate things are drawn per frame, by kind, from the start view and turned round. |
| `still.mjs [url]` | Lennie sitting still in the start view: frames per second, and what limits them (other sharpnesses, nothing drawn, everything drawn into 8 pixels). |
| `same.mjs <url A> <url B>` | Is the physics still exactly the same? Twenty tosses with the dice fixed in two versions, compared to the last digit. For changes to `broadphase.js` and `guard.js`. Runs fine in a headless Chrome on the PC too (`chrome --headless=new --remote-debugging-port=9222`, with the tablet unplugged). |

## Measuring without fooling yourself

- **Load fresh.** Python's server sends no cache headers, so Chrome may run old
  copies of the modules after a plain reload. The scripts load with the cache
  switched off; do the same by hand. Some early numbers here were wrong because of it.
- **One game at a time.** With two copies open, Android's low-memory cleaner
  closed Chrome mid-test; loading the game straight over a running one (as the
  scripts first did: open, then reload) crashed the tab the same way ("Aw,
  Snap!"). The scripts now go by way of an empty page. A script that hangs
  without printing anything usually means the tab has crashed, or the tablet
  has dropped off USB (`adb devices` shows nothing): look at the tablet
  (`adb exec-out screencap -p > shot.png` shows its screen).
- **A fresh Chrome for every load.** Each load in the same tab leaves memory
  behind. After three to five the tablet was swapping, which showed as a
  frame rate a third lower than it should be, and then the tab crashed.
  `ab.mjs`, `tosses.mjs`, `still.mjs` and `memory.mjs` now close Chrome and
  start it again first (`restartChrome()` in `cdp.mjs`); `same.mjs`,
  `profile.mjs` and `draws.mjs` don't yet.
- **One script at a time, across sessions too.** Two Claude sessions shared
  the tablet one evening, and each script restarting Chrome ended the other's
  measurement halfway: a lost connection (Node says "unsettled top-level
  await") or odd numbers. In the tablet's log (`adb logcat -d -b all`) it shows
  as two `am force-stop com.android.chrome` lines seconds apart. `cdp.mjs` now
  leaves the running script's process id in a file in the temp folder
  (`toss-the-lennie-tablet.turn`), and the next script waits until that process
  has ended. That only works between sessions whose scripts have it.
- **Aim mode costs something by itself.** The throws are aimed (T), and with
  aim mode on the game works out the aim every frame while Lennie lies waiting.
  In flight it doesn't.
- **On localhost the game is heavier than for players**: the flicker check runs
  for about 15 s after loading and keeps a copy of the scenery in memory.
- **Compare back to back.** The same code varies by 1–3 frames a second between
  runs. Run `base` twice, and the version to compare against right before or after.
- **A suspiciously perfect result means a crash.** 90 frames a second with
  identical numbers every run meant the game loop had stopped (the screen runs
  at 90 Hz, so the empty page did too). The scripts print errors; read them.
  70 frames a second with an error from three.js meant the tablet had dropped
  the graphics context and the game drew nothing after it (fixed, see below).
- **The first seconds are slow anyway**: `watchSpeed()` lowers the sharpness
  and the shading in steps (each a short stall; the game remembers where it
  ended up and starts near there next time), and on localhost the flicker
  check runs for about 15 s. Measure after that.
- Heat wasn't a factor: after an hour of tests the chip was at 41 °C, full speed.

## What we found

Starting point (main at `91cddd3`), throwing in the house: **about 11–16 frames
a second**, the supermarket about 25. Sharpness fell to 0.75 (the lowest step)
without helping.

Fixed on the branch `worktree-tablet-speed`, all looking the same as before:

- **The stuck check** (`guard.js`) tested every part of Lennie against all 517
  pieces of scenery after every physics step: 4–5 ms a frame. It now picks the
  few near him first: about 1.5 ms.
- **Products and clutter** (`products.js`): a kind is only drawn when its items
  are in view (tight bounding spheres), and everything in its place is *baked*
  into a few big meshes with shared atlas pictures. The ground floor's ~190 kinds
  of clutter were one draw call each; now the whole house's clutter is about 25.
  A knocked item is cut out of its baked mesh and drawn by its kind's
  InstancedMesh; R puts it back.
- **Fading walls** (`house.js`, `supermarket.js`, `setFade` in `batching.js`)
  were see-through materials all the time; now only while they fade.
  See-through surfaces are drawn last and blended, which costs a weak chip far more.

Together: the supermarket is around 30, the house only went from about 14 to 16
frames a second (back to back), even with a third fewer draw calls.

**Why so little:** after those fixes the house is limited by the *graphics
chip*, not the main processor: the main thread sits idle about 30% of each
frame, waiting. Experiments (`ab.mjs`), house throws, all against ~16–17:

| Change | Frames/s | What it says |
|---|---|---|
| Sharpness 0.4 instead of 0.75 | ~22 | Pixel work is the limit. Too blurry to ship. |
| No see-through cut (`seethrough.js`) | ~21 | Its `discard` is in every material's shader, which stops a Mali chip from skipping hidden pixels: every overlapping surface gets fully shaded. |
| MeshLambertMaterial instead of MeshStandardMaterial | ~20.5 | Lambert is much cheaper per pixel; the difference is mainly the shine. |
| Hide all clutter (after baking) | ~18 | Clutter now costs almost nothing. |

**Physics** is the other big piece: about 15 ms a frame in the house (4–6
steps of 1/120 s, 20 solver iterations), close to `PHYSICS_BUDGET`. It shrinks
by itself as the frame rate rises (fewer steps per frame).

## Second round: it's the main processor

A second look (branch `worktree-low-end-speed`) found the first round's
conclusion, "limited by the graphics chip", only half true. `still.mjs`, with
Lennie sitting in the start view at sharpness 0.75:

| | Frames/s | Frame | Drawing, main thread | Physics |
|---|---|---|---|---|
| As it is | 26.6 | 37.6 ms | 11.8 ms | 14.2 ms |
| Sharpness 0.4 | 30.4 | 32.9 ms | | |
| Sharpness 1 | 24 | 41.6 ms | | |
| Sharpness 1.5 (where every visit started) | 10.9 | 91 ms | | |
| Everything drawn into 8 pixels | 32.3 | 30.9 ms | 11.6 ms | 11.9 ms |
| Nothing drawn | 86 | 11.6 ms | 2.2 ms | 4.5 ms |

With no pixels to fill at all, the tablet still only reaches 32 frames a
second: about 31 ms of each frame is the main processor, and filling the
pixels adds 7 ms at 0.75. (The first round's experiments all ended up near 21
frames a second, whatever they took away from the graphics chip: that was this
ceiling.) Two things fill those 31 ms:

- **Physics**, 12–16 ms: a step cost about 3 ms, so even with Lennie sitting
  still the physics used up its whole allowance (`PHYSICS_BUDGET`) every frame.
  In flight it couldn't keep up at all: the game played at about half speed.
  Raising the frame rate needs the same steps in less time per frame, so this
  is what holds everything else back.
- **Drawing on the main thread**, about 12 ms for 360 draw calls (33 µs each):
  three.js's own work per mesh and per material, before the graphics chip
  sees anything.

And one plain bug: **the first frame's time step was negative** on a slow
device. The browser stamps the first frame while the game is still being
built (seconds, on the tablet), which is before the game's own clock starts.
The camera's "follow Lennie" turned that into a jump of millions of metres,
after which it came to rest 32 m behind the house, looking at the whole
neighbourhood: 1,300 draw calls and 790,000 triangles instead of 360 and
225,000, 15–18 frames a second with nothing happening, until the first toss
or R brought the camera back. (The scripts press R first, so the first round
measured past it.)

Done in this round, all leaving the game exactly as it plays:

- The negative step is gone (`frame()` in `main.js`).
- The physics no longer walks all ~520 pieces of scenery ten times a step
  (`broadphase.js`): the solver and the wiping of forces only go through what
  can move, the scenery around Lennie is picked out once and kept while he's
  near it, the stuck check uses that pick too, and rays run through the
  scenery's boxes as plain numbers. On the PC a step went from about 0.52 ms to
  0.30 ms; `same.mjs` shows twenty tosses ending the same to the last digit.
- Solid scenery is drawn in the order of its shader programs: 24 program
  switches a frame instead of 175. (Tried on the tablet before the rest: 19.5
  to 21 frames a second in flight.)
- The aim isn't worked out again every frame while nothing moves (it was 6% of
  all the time in the profile, a tenth of a frame while Lennie lies waiting).
- The sharpness a device ends up at is remembered, and the next visit starts
  one step above it; a device that crawls goes down two steps at once. At
  full sharpness the tablet did 11 frames a second, and spent the first twenty
  seconds or so of every visit stepping down from it (worked out from the
  step-down rule, not timed).

On the tablet, main (`d9bfedf`) against the branch, back to back:

| | main | branch |
|---|---|---|
| Sitting still after loading (`still.mjs`) | 19 frames/s (the camera behind the house: 1,300 draw calls) | 36 frames/s |
| Physics per frame, sitting still | 16 ms | 6.5 ms |
| Three house throws (`ab.mjs base`, 2 and 4 runs) | 20.4–21.4 frames/s | 21.9–24.9 frames/s |
| A physics step, in flight | 3.0–3.6 ms | 1.6–1.9 ms |
| The stuck check, per step | 0.3 ms | 0.06 ms |
| Steps done, of what real time asks for (`gameSpeed`) | 0.64–0.85: slow motion | 0.97–1.1: all of them |
| Twenty tosses with fixed dice (`same.mjs`) | | end exactly the same |
| `tosses.mjs`: the first 5 house throws after loading | 14.6 frames/s, 35 frames over 100 ms | 19.8 frames/s, 13 over 100 ms |
| `tosses.mjs`: 5 supermarket throws | 23.3 frames/s | 22.9 frames/s |
| `tosses.mjs`: 5 house throws after R | 20.4 frames/s | 23.9 frames/s |

(`gameSpeed` goes a little over 1 because a fast flight takes half steps.) So
sitting still is past 30 now. In flight the frame rate only went up by two or
three, but the game no longer plays in slow motion there: main showed its 21
frames a second of a toss at two thirds of its speed. What's left of a frame
in flight is about 9 ms of physics and 35 ms of drawing: more is in view while
the camera follows him (400–550 draw calls instead of 360), and walls fade.
The supermarket didn't change (and was nearer 23 than the first round's 30
that afternoon, on main as well).

**A lost graphics context left the game blank** (on main too). Now and then
the tablet takes the game's graphics memory away and gives it back a few
seconds later (caught at 19 s after loading, while the sharpness stepped down
from 1.5 with the whole neighbourhood in view; several of the measuring runs
that afternoon had it). three.js then sends everything to
the chip again, but the baked product meshes had thrown their normals, picture
positions and indices away once they were on the chip, to save about 8 MB:
every frame after that failed (`Cannot read properties of null (reading
'byteLength')`) and nothing was drawn until the page was reloaded. In the
scripts that showed as an error and an impossibly high frame rate. The arrays
are kept now (`bakeMesh` in `products.js`); with the context lost and restored
on purpose (`WEBGL_lose_context`) the game comes back by itself on the tablet
and the PC.

Tried and not worth it:

- Taking the shock's lamp (`zap.js`, a PointLight that's always on at 0) out
  of the shaders: 19.6 against 18.5–19.5 frames a second, within the noise.
- Drawing solid scenery nearest first: no gain (18.4). The combined meshes are
  too big to sort usefully, and it costs the program order.
- Putting colours in the vertices so that meshes differing only in colour
  become one: there are none left to merge, `combineScenery` already shares
  materials that look the same. What keeps the house at ~330 draw calls is
  the walls that fade one by one (139 meshes with a material each) and the
  storeys that hide one by one.

## Third round: simple shading

Once the main processor's share was down, the graphics chip's showed again
at sharpness 1. `shading.js` gives the scenery a simple shading for devices
that can't keep up: the same materials, colours, pictures, lights and fog, but
only how much light falls on a surface, as a MeshLambertMaterial works it out;
no shine. The materials stay MeshStandardMaterials (so fading walls, glowing
screens and the baked products go on working): only their shader program is
swapped, in the place where `seethrough.js` already adds its lines. Metal is
darkened by its `metalness`, a little less than the full shading does, to make
up for the lost glint. In the living room the difference is hard to find in
two screenshots side by side; polished floors and steel lose their glint.
Lennie and the window glass keep theirs.

`watchSpeed()` in `main.js` now goes down one list, `QUALITY`: sharpness 1.5,
1.25, 1, then simple shading at 1, then simple at 0.75. The shine goes before
the last bit of sharpness because blur shows more. The step is remembered; a
device that ended on simple shading starts with it (switching mid-visit means
building the other shader programs, a stall of a second or so), and only gets
the full shading back after running at 50 frames a second or better with the
simple one.

Three house throws on the tablet, held at one step (`ab.mjs q2 q3 q4
full075`, Chrome restarted before each):

| | Frames/s |
|---|---|
| Sharpness 1, full shading | 18.7, 20.5 |
| Sharpness 1, simple shading | 24.3, 28.1, 29.0 |
| Sharpness 0.75, full shading (where the tablet ended up before) | 25.2, 25.3 |
| Sharpness 0.75, simple shading (where it ends up now) | 27.0, 30.9, 31.9 |

The standard test with the game choosing for itself (`tosses.mjs`), against
the second round's numbers above:

| | Second round | First visit | Later visit |
|---|---|---|---|
| 5 house throws after loading | 19.8 | 31.4 | 31.9 |
| 5 supermarket throws | 22.9 | 26.1 | 23.9 |
| 5 house throws after R | 23.9 | 29.3 | 34.0 |

So the house is at 30 on the tablet now; the supermarket isn't (24–26). At
0.75 with simple shading the tablet is back at the main processor's limit:
even at sharpness 0.4 it did 30.7.

## Fourth round: what's across the road

With Lennie in the supermarket, about half of everything drawn was his own
house across the road: every wall and floor that fades by itself, every colour
of furniture, the clutter on three storeys, for a house that fills a corner of
the picture. The other way round the same: from the living room looking at the
street, the shop was 240 of 770 draw calls.

Now each of the two is drawn as a cheap copy while the camera's target is
across the road from it and the camera isn't near it either (`farview.js`;
`updateView()` in `house.js` and `supermarket.js` does the switching, with
some slack so it doesn't flap). The copy is made once the game is built, from
the combined scenery: each part's colour goes into its corners, so everything
without a picture is one mesh and everything with the same picture another.
The house's copy is 36 meshes (16,600 triangles, 1.4 MB), the shop's 66 (8,500
triangles, 0.7 MB).

- **The house from the shop:** the copy, plus the front's windows and doors
  as they are (a broken one stays broken). Its clutter, loose furniture and
  inner doors aren't drawn. Side by side the outside is the same; through the
  windows the rooms keep their walls and furniture and lose their mess.
- **The shop from the house:** the copy, plus the shop window's panes and all
  the products, which were a few meshes already. The glass fridge doors and
  counters inside aren't drawn. Side by side from the front garden no
  difference could be found.
- Aiming still looks at the real parts (the copy isn't hit by the pointer's
  ray), and nothing between the camera and Lennie can be part of a copy, so
  fading and the see-through circle go on as before.

Draw calls in Chrome on the PC, five thrown tosses each, the copies switched
off and on in the same build (`allowFar()` on `lennie.house` and
`lennie.shop`):

| | Copies off | Copies on |
|---|---|---|
| Supermarket throws: draw calls per frame (most) | 973 (1,017) | 315 (365) |
| Supermarket throws: triangles per frame | 786,000 | 595,000 |
| 56 fixed views in and round the house | 332 | 280 |
| ...of those, the living room looking at the street | 775 | 535 |

(The thrown tosses don't end the same from one page load to the next here, so
the house's own average isn't comparable between runs; the fixed views are.)

On the tablet, the standard test (`tosses.mjs`, a later visit: sharpness 0.75
with the simple shading), with the copies, without (`nofar`) and with again,
back to back:

| Frames/s | With | Without | With |
|---|---|---|---|
| 5 house throws after loading | 29.8 | 33.9 | 30.3 |
| 5 supermarket throws | 36.2 | 30.5 | 42.4 |
| 5 house throws after R | 31.5 | 32.2 | 29.3 |

So the supermarket went from about 30 that evening (24–26 in the third round)
to 36–42, with no frame over 100 ms in the last run. The house's numbers
looked a little lower with the copies, so that was measured by itself
(`ab.mjs base nofar base nofar`, three house throws each): 33.5 and 32.1 with,
28.4 and 31.7 without. No loss there; the house's 30 to 34 is the spread
between runs, with frames falling on either side of three screen refreshes.

What's left in the supermarket after this is its own products: about 400,000
triangles in seven meshes, drawn whole whenever the shop is in view (from the
house too). Whether that many triangles hold the tablet back hasn't been
measured; if they do, splitting the baked meshes by aisle, or fewer of the
same thing per shelf, would be the next step there.

## Next ideas (not done)

- Anything more is the main processor again: three.js's work per draw call
  (300–550 calls in flight) and the physics. Fewer calls would mean fewer
  separate fading walls or hiding storeys in view; `draws.mjs` and
  `profile.mjs` show where they are.
- The neighbours' houses and the street could get the same cheap copy as the
  house and the shop (*Fourth round*); they're about 60 draw calls.
- With simple shading, kinds of products that differ only in how rough or
  metallic they are could share a baked page (`DRAWN` in `products.js` keeps
  them apart): fewer draw calls, on weak devices only. Not looked into.
- Physics: what's left of a step is the solver itself (20 passes over ~75
  equations, half the step) and the exact tests between Lennie's parts and
  the scenery near them (a quarter). Fewer passes, or not halving the step
  while he's fast (`FAST_SUBSTEP_SPEED`), would be the next big gain, but
  both change how Lennie tumbles and how easily he gets stuck in a wall.
- Putting Lennie's physics to sleep while he lies still. Now that a step is
  cheaper it matters less, and a lot can wake him (cars, the cat, effects that
  let go of him later), so it's easy to get wrong.
- On weak devices only: a see-through effect without `discard` in every
  material (for instance only on the meshes between the camera and Lennie).
  Without any cut the tablet did 26.5 against 25.3 at sharpness 0.75 with the
  full shading: within the noise there. Not tried at sharpness 1.
- Anti-aliasing off on a device that ended up at a low sharpness (it can only
  be chosen when the page loads): not measured.
- Memory: one game takes about 1.45 GB of the tablet's 3.9 GB, and a few
  loads in one tab crash it. What's known, how to measure it and what to try
  is in [memory.md](memory.md).
