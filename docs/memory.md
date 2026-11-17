# Memory: what the game keeps, and what was done about it

The game has to run on a budget tablet or an older iPad (see *Low-end devices*
in CLAUDE.md), and on those memory runs out before speed does. This page says
what the game keeps, what was changed (November 2026), how to measure, and
what's left to try. The speed work is in [tablet-testing.md](tablet-testing.md).

## Why it matters

On the owner's Lenovo Tab M11 (4 GB, of which Android leaves Chrome 1–1.5 GB):

- **The tab crashed** ("Aw, Snap!", out of memory) after the game was loaded a
  few times in the same tab during the speed tests (on localhost, which is
  much heavier than what players get, see below). A kid pressing reload does
  the same thing. An older iPad has 2–3 GB and Safari closes a tab sooner.
- **The tablet takes the graphics memory away mid-game** now and then (a lost
  graphics context) and gives it back a few seconds later. The game survives
  that, but it's a freeze of a few seconds while everything is sent to the
  chip again. Whether memory pressure is what triggers it isn't proven: it's
  the usual cause.

## Where the memory went (measured on the tablet)

Android's own count for Chrome with one game loaded and five throws done, on
localhost, before any of the changes below: **about 1.45 GB**. 650 MB in
Chrome's graphics process (520 MB of it graphics memory, `GL mtrack`), 610 MB
in the game's tab, 190 MB in Chrome itself. Two questions were open: the game
had only put about 130 MB of pictures and 40 MB of meshes on the chip itself,
so what was the other 350 MB of graphics memory; and what filled the tab?

**The canvases live in graphics memory.** Every picture in the game is drawn
on a canvas. On Android a canvas is a texture on the graphics chip
(`breakdown.mjs GPU images` lists each as a `CanvasResourceRaster`), and it
stayed there after WebGL had its own copy. Proof: with the game running,
giving the 103 canvases that were already on the chip a size of 0 (24.4
megapixels, 98 MB) made `GL mtrack` drop from 511 to 413 MB within three
seconds, and the game went on drawing as before.

**There were far more canvases than pictures in use.** The page counted 174
pictures in the scene (29.7 megapixels), but Chrome held about 470 canvases
(some 42 megapixels, 170 MB). Product and clutter pictures existed three
times over: every label on its own canvas, every kind of product's labels
painted together on a second one, and all of those painted onto the baked
pages (`packPages()` in `products.js`). The first two were only stepping
stones, but a canvas nobody uses any more keeps its memory until the
browser's garbage collector happens to come by, and it rarely does: it has no
idea how big a canvas is.

**The baked pages were mostly empty.** Every page was 2048 px wide whatever
was on it; 35 of the 57 pages held a few plain colours on a strip 2048 × 24.
The pages together were 20.6 megapixels, of which 13.3 were used.

**A few pictures were on the chip twice**: a kind made of several materials
(a can: its label and its metal) kept its own pictures for the ones that get
knocked off the shelf, next to the copy on the baked page. Only 13 small
pictures: nearly all kinds already drew their knocked ones from the page.

**Most of the tab's 600 MB was the flicker check's rubbish.** On localhost
the game runs the flicker check (`flickercheck.js`), which leaves some 320 MB
of garbage in the JavaScript heap (`breakdown.mjs Renderer v8`: 377 MB before
a forced clean-up, 53 MB after). The browser clears it in its own time, which
on the tablet is not soon. Players never have this: on the live page the tab
is about 270 MB. It's also why the tab crashed after "3–5 loads" during the
speed tests: each load on localhost left another 300 MB behind. **Measure as
a player gets it** (see *How to measure*), or the numbers are 300 MB too high.

What's left of the graphics memory after the changes (about 300 MB) is the
game's pictures (about 95 MB with their smaller copies) and meshes (about 20
MB) on the chip, the canvases of pictures not seen yet (20 MB), the screen's
own buffers (some 45 MB) and roughly 110 MB that neither Chrome nor the game
accounts for (the graphics driver's own).

## What was changed

All of it leaves the game looking and playing the same: every picture and
every baked page was compared pixel by pixel with the version before (and
every triangle of every kind of product for its place, colour and shading).

1. **A picture lets go of its canvas once the chip has it** (`src/pictures.js`).
   Every canvas texture is now made with `picture()` or `drawn()`, which keep
   the function that drew it instead of the canvas. When three.js asks for the
   picture again it's drawn again on the spot: after a lost context (three.js
   then asks for everything it draws), or when one picture is painted onto
   another. Nothing listens for lost contexts; whoever reads `texture.image`
   gets the picture. So a mistake costs a redraw, never a black picture. The
   drawing functions that used a seeded random generator now start it inside
   themselves, so a picture drawn again is the same picture. Only the TV's
   canvas stays (`tv.js`): it's drawn on all the time.
2. **Labels and kinds' pictures are only drawn when needed, and let go of
   right after** (`canvas()` and `oneMaterial()` in `products.js`). A baked
   page is painted when it goes to the chip (all of them with the first
   frame), from its kinds' pictures, which are drawn for it and dropped again:
   a page at a time, so the three layers are never in memory together. While
   the game loads there are now at most 12 megapixels of canvases at any
   moment (`lennie.pictures.mostPixels`) instead of 42.
3. **Pages are as wide as what's on them**: 13.3 megapixels instead of 20.6,
   on the chip as well.
4. **Every kind draws its knocked products from the baked pages**, kinds of
   several materials too (one draw call per material, as before, each from
   its page). No kind's own picture goes to the chip any more, and knocking
   things over no longer adds pictures to it.

## Before and after

On the tablet, the same evening, back to back, Chrome restarted before each,
two runs of each version (`memory.mjs`, `reloads.mjs`, `lostcontext.mjs`).
MB, as Android counts them. "Before" is the code this work started from.

**One game, as a player gets it** (no flicker check):

| | Before | After |
|---|---|---|
| After loading: graphics process | 610, 601 | 385, 385 |
| ...of which graphics memory (`GL mtrack`) | 503, 497 | 290, 291 |
| After loading: the game's tab | 271, 262 | 246, 241 |
| After loading: everything (with Chrome itself, 170–195) | **1076, 1036** | **824, 812** |
| After five throws: everything | 1072, 1044 | 843, 827 |
| ...of which graphics memory | 501, 490 | 286, 281 |
| After a forced clean-up: everything | 1007, 980 | 831, 765 |
| Memory the tablet still has available, after loading | 1004, 938 | 1135, 1168 |

So about **230 MB less** for one game, nearly all of it graphics memory (210
MB less: 500 → 290).

**What the page counts:**

| | Before | After |
|---|---|---|
| Pictures in the scene | 174, 29.7 megapixels | 161, 22.0 megapixels |
| Canvases in memory once the game runs | 174 in use, about 470 in all (some 42 megapixels) | 69 (5.5 megapixels) |
| Most canvases in memory at once while loading | about 42 megapixels | 11.9 megapixels |
| Pictures on the chip after five throws | 25 megapixels (about 133 MB) | 17 megapixels (about 91 MB) |
| ...of which the baked pages | 20.6 megapixels | 13.3 megapixels |
| JavaScript heap (PC) | 123–131 MB | 103 MB |

**On localhost** (with the flicker check, as the first count on this page
was taken), after five throws: 1453 and 1460 MB before, 1155 MB after; after
a forced clean-up 1074 and 1098 before, 814 after.

**Reloading in one tab** (`reloads.mjs`, six loads with two throws each, as a
player gets it):

| | Before | After |
|---|---|---|
| Graphics memory at each load | 455–516 | 304–346 |
| The game's tab: load 1 → 6 | 281 → 459 (second run: 550) | 294 → 636 (second run: 649) |
| Everything at load 6 | 1240, 1318 | 1250, 1258 |
| Everything after a forced clean-up | 991 | 824 |

Reloading is **not** better yet where it counts, see *What a reload leaves
behind*: the graphics memory is 170 MB lower at every load, but the tab piles
up more of the earlier loads' garbage, so the total after a handful of
reloads is the same until the browser cleans up. Neither version crashed in
six loads this way; the crashes "after 3–5 loads" were on localhost.

**A lost context** (`lostcontext.mjs`, forced twice): both versions come back
by themselves, no errors, the same room on screen. The game stands still for
1.1 s before and 2.7 s after: the pictures in view are drawn again (278 of
them) before they can be sent. That's the price of not keeping them.

**Speed** is unchanged: six throws in the supermarket held at the lowest
quality step, 26.0 and 24.8 frames a second before, 26.1 and 28.5 after; the
first picture appears about 7 s after the load starts in both. The standard
test (`tosses.mjs`) ran three times without errors (house 27–31, supermarket
25–35, house after R 31–35 frames a second).

**Together with the far view** (the cheap copies of what's across the road,
`farview.js`, which landed just before this): one run on the tablet as a
player gets it, 816 MB after loading (graphics memory 288); a lost context
comes back in 2.7 s, also with a copy in view (the copies use the same
pictures as the real parts); `tosses.mjs` house 34.5, supermarket 39.8,
house after R 31.2 frames a second, no errors.

**Pitfall while measuring this:** the "before" was first taken from another
session's worktree, which was still being worked on. Halfway through it had
got faster in the supermarket, which looked like a slowdown here. Compare
against a frozen copy: `git checkout-index -a --prefix=.baseline/` puts the
staged code in a folder the game server serves
(`…/worktrees/<name>/.baseline/index.html`); delete it afterwards.

## How to measure

- `node scripts/tablet/memory.mjs <url>` loads the game as a player gets it
  and prints what the page counts (pictures, canvases still held, what's on
  the chip, mesh data) and Android's count for Chrome's three processes after
  loading, after five throws and after a forced garbage collection. With
  `dev` as a second argument it loads on plain localhost, flicker check and all.
- **As a player gets it**: the game takes `localhost` for a developer's
  computer and runs the flicker check. `http://localhost.:5173/…` (with a dot
  after localhost) is the same server, and the game doesn't recognise it, so
  it behaves as on the live page. `asPlayer()` in `cdp.mjs` does that.
- `node scripts/tablet/breakdown.mjs` asks Chrome for its own breakdown of
  the game that's open: what the tab (`Renderer`) and the graphics process
  (`GPU`) are made of. `breakdown.mjs GPU images` lists the graphics
  process's pictures by what they're for; a canvas is a `CanvasResourceRaster`.
  What WebGL itself holds isn't in Chrome's count on Android (it is in
  Android's `GL mtrack`).
- `node scripts/tablet/reloads.mjs <url>` reloads the game in one tab as a
  kid does, with Android's count after each load.
- `node scripts/tablet/lostcontext.mjs <url>` forces a lost context twice and
  says how long the game stood still and whether it threw errors. By hand:
  `e = lennie.renderer.getContext().getExtension('WEBGL_lose_context');
  e.loseContext()`, and a few seconds later `e.restoreContext()`.
- By hand, Android's count is `adb shell dumpsys meminfo --package
  com.android.chrome` (the game's tab is the `sandboxed_process`; graphics
  memory is under the `privileged_process`, Chrome's graphics process;
  without `--package` only Chrome itself is listed). `adb shell cat
  /proc/meminfo` has the tablet's free memory and swap.
- `performance.memory` says little on the tablet: Chrome on Android reports
  the same number at every moment.
- In the page, `lennie.pictures` counts the pictures made, how many hold a
  canvas right now, and how many were drawn on demand. That last number must
  stand still while playing: if it climbs every frame, something reads
  `texture.image` every frame and the picture is drawn again each time.
- To see context losses happen by themselves, listen on the document in the
  capture phase before the game loads (`webglcontextlost`,
  `webglcontextrestored`), and count `error` events after them.

**What a crash looks like in the tablet's log** (`adb logcat -d -b all`): the
game tab's process shows tens of thousands of "major faults" per report (it's
swapping), frame rates in a measurement drop by a third, then
`PrivilegedProcessService` (graphics) and `SandboxedProcessService` (the tab)
die within a second of each other, with `crash or killed by oom` and
`mem-pressure-event`.

## What a reload leaves behind

Reloading doesn't empty the tab's process: the page that was there is garbage
for the browser to collect, and until it does, the old game's JavaScript
objects and mesh data (about 130 MB as a player gets it) sit next to the new
one's. The graphics memory doesn't pile up: the old page's graphics context
is closed at once.

Before this work the tab levelled off around 460–550 MB after two or three
reloads (one or two old games waiting to be collected). After it, the tab
climbs further, to about 650 MB (three old games), although each game is
smaller. All of it is garbage: a forced clean-up brings the tab back to 250
MB in both. The likely reason, not proven: the browser's collector is nudged
by how much memory canvases take, and there are far fewer canvases now, so
it comes round later. Whether Android's low-memory warning makes Chrome
collect in time, before it closes the tab, wasn't tested.

Nothing was changed for this. The game can't make the browser collect, but
it could make what's left behind smaller: see the first idea below.

## Ideas left, biggest first

1. **What a reload leaves behind** (up to 400 MB in the tab after a handful
   of reloads, until the browser collects). When the page is left
   (`pagehide`), the game could hand back what can be handed back without the
   collector: the mesh data's arrays (`ArrayBuffer.prototype.transfer(0)`
   frees one at once, in browsers that have it), the canvases still held,
   the graphics context. That leaves the JavaScript objects themselves
   (about 100 MB a game). First find out with `reloads.mjs` and
   `breakdown.mjs Renderer` what the 130 MB per old game is made of, and
   whether the tablet's low-memory warning already clears it in time.
2. **Smaller pictures on a weak device.** The baked pages are 13 megapixels,
   about 70 MB on the chip with their smaller copies. Half the size on a
   device that ended up at a low step of `QUALITY` (`main.js`) would save
   about 50 MB there. It has to be decided while the game is built, so from
   the step remembered from the last visit. Not done, because it isn't
   invisible: at sharpness 0.75 a label looks the same from across the room,
   but blurrier when the camera ends up right next to a product.
3. **Mesh data** (43 MB in JavaScript, 20–40 MB on the chip): the pieces
   that `batching.js` combined aren't needed after combining unless
   something still points at them. Not looked into. Mesh arrays can't be
   dropped after upload the way canvases are, unless they can be made again.
4. **The pictures not seen yet** keep their canvases until they're first
   seen (about 5 megapixels, 20 MB): the supermarket's posters while he's in
   the house, the upstairs rooms. Letting go of them and drawing them at
   first sight would save that, at the price of a hitch when he first gets
   there.
5. **No mipmaps where they don't show** (a quarter of the chip's share of
   pictures): not for most things, they keep far-off labels from sparkling.
6. **Compressed textures** would be the real fix on the chip (a sixth of the
   memory), but the pictures are drawn in the browser, not loaded from files,
   so there's nothing to compress ahead of time. Not without a build step.

## Pitfalls found on the way

- Don't free anything three.js may need again without a way to make it again
  on the spot. Throwing mesh arrays away after upload once left the game
  blank after a lost context (`dropArray`, removed from `products.js`).
- Reading `texture.image` of a picture draws it again if it was let go of.
  Use `sizeOf()` for its size (`pictures.js`).
- A canvas nobody points at still holds its memory until the garbage
  collector comes by. Give it a size of 0 to hand it back at once.
- Localhost isn't what players get: the flicker check alone is 300 MB in the
  tab (see *Where the memory went*).
- One game at a time on the tablet, and a fresh Chrome for every
  measurement (`restartChrome()` in `cdp.mjs`).
- The graphics memory isn't in the JavaScript heap, and Chrome's own
  breakdown leaves out what WebGL holds: Android's `GL mtrack` is the number
  that has everything.
- The same game varies by some tens of MB from run to run, and the tab's
  number by hundreds depending on whether the collector has been round.
  Compare back to back, and read the tab's number after the forced clean-up.
