# Memory: what the game keeps, and what to do about it

Notes for whoever picks this up (November 2026). Nothing here has been fixed
yet, apart from the blank screen described below. The speed work is in
[tablet-testing.md](tablet-testing.md); this page is about memory only.

## Why it matters

The game has to run on a budget tablet or an older iPad (see *Low-end devices*
in CLAUDE.md). On the owner's Lenovo Tab M11 (4 GB) memory already bites:

- **The tab crashed** ("Aw, Snap!", out of memory) when a test script loaded
  the game a second time while the first was still open. A kid pressing reload
  does the same thing. An older iPad has 2–3 GB and Safari closes a tab sooner.
- **The tablet takes the graphics memory away mid-game** now and then (a lost
  graphics context) and gives it back a few seconds later: seen 19 s after
  loading, and in several measuring runs in one afternoon. The game survives
  that now (it stayed blank before, see *Second round* in tablet-testing.md),
  but each time is a freeze of several seconds while everything is sent to the
  chip again. Less memory should make it rarer. Whether memory pressure is
  really what triggers it isn't proven: it's the usual cause, and it happened
  at the moment the game asked for a new drawing surface.

## What it keeps (measured)

In Chrome on the PC, after loading and a few throws in the living room
(`scripts/tablet/memory.mjs` prints all of this):

| What | How much | Notes |
|---|---|---|
| Pictures, all drawn on canvases | 174 canvases, 29.7 megapixels: about 120 MB | Every texture in the game is a `CanvasTexture`, drawn once while the game is built. Only the TV's (`tv.js`) is ever drawn on again. The canvases stay in memory after the chip has its copy. On Android a canvas may itself live in graphics memory. |
| The same pictures on the graphics chip | 103 of them after a few throws, 24.4 megapixels: about 130 MB | Four bytes a pixel, plus a third for the smaller copies (mipmaps; every picture has them). The other 71 (5.3 megapixels) go to the chip when first seen, so this grows while playing. |
| ...of which products and clutter | 21 megapixels of the 29.7 | The baked pages (`packPages()` in `products.js`, up to 2048 px a side) and each kind's own picture. A kind's own picture is still there for items that get knocked out of the baked mesh; it looks like most pictures exist twice this way. Check that first. |
| Mesh data in JavaScript | 42.5 MB in 1,773 geometries (1,932 meshes) | Again on the chip for what has been drawn (464 geometries). The unbaked product shapes and the combined scenery's (`batching.js`) are in here. |
| JavaScript heap | 100–125 MB | Includes the mesh data above. On localhost the flicker check keeps a copy of the scenery for its first 15 s or so; players don't have that. |
| Shader programs | 56–59 | Small. With simple shading switched on mid-visit both sets are kept. |
| Physics bodies | 545 | Small. |

Together roughly 250 MB of pictures (canvases plus the chip's copies), 85 MB of
mesh data (both sides), and the rest of the heap: in the order of 400 MB for
one tab, before the browser's own share.

On the tablet itself, Android's own count for Chrome with one game loaded and
five throws done (`adb shell dumpsys meminfo --package com.android.chrome`,
Chrome freshly started):

| Process | Memory (PSS) | |
|---|---|---|
| Chrome's graphics process (`privileged_process`) | 644 MB | of which 518 MB graphics memory (`GL mtrack`) |
| The game's tab (`sandboxed_process`) | 624 MB | |
| Chrome itself | 180 MB | |
| **Together** | **about 1.45 GB** | of the tablet's 3.9 GB; 0.6 GB was still available, 1.1 GB of other things was swapped out |

So the graphics memory is the biggest piece, and it's about 350 MB more than
the pictures (129 MB) and meshes (42 MB) the game put on the chip. The likely
reason, not proven: on Android the 174 canvases live in graphics memory too,
possibly with a second copy from when they were handed to WebGL. That makes
idea 1 below the one to try first, and the first thing to measure. (The count
was on localhost, where the flicker check also runs; see *How to measure*.)

**What a crash looks like in the tablet's log** (`adb logcat -d -b all`): the
game tab's process shows tens of thousands of "major faults" per report (it's
swapping), frame rates in a measurement drop by a third, then
`PrivilegedProcessService` (graphics) and `SandboxedProcessService` (the tab)
die within a second of each other, with `crash or killed by oom` and
`mem-pressure-event`. That's the "Aw, Snap!". It happened twice in one evening
after 3–5 loads of the game in the same tab without restarting Chrome: each
load leaves memory behind in the tab's process (713 MB after the second load).
A player who reloads a few times, or comes back to an old tab, is in the same
spot. The scripts now restart Chrome before each load (`restartChrome()` in
`cdp.mjs`); what's left behind by a load was not looked into.

## How to measure

- `node scripts/tablet/memory.mjs [url]` counts the above in the page, on the
  tablet or in a headless Chrome on the PC (see tablet-testing.md for both).
- `performance.memory` says little on the tablet: Chrome on Android reported
  949 MB at every moment of every run in a long-lived tab, and 435 MB before
  and after five throws in a fresh one (125 MB on the PC for the same game).
  Ask Android instead:
  `adb shell dumpsys meminfo --package com.android.chrome` (the game's tab is
  the `sandboxed_process`; graphics memory is counted under the
  `privileged_process`, Chrome's graphics process; without `--package` only
  Chrome itself is listed). `adb shell cat /proc/meminfo` has the tablet's
  free memory and swap.
- On localhost the game also runs the flicker check, which holds a copy of the
  scenery for a while. For what players get, compare with the live page, or
  switch `DEV` off in `main.js` for the test.
- A lost context can be forced, to test that the game comes back:
  `e = lennie.renderer.getContext().getExtension('WEBGL_lose_context');
  e.loseContext()`, and a few seconds later `e.restoreContext()`. Anything
  thrown away after it was sent to the chip must be made again then.
- To see context losses happen by themselves, listen on the document in the
  capture phase before the game loads (`webglcontextlost`,
  `webglcontextrestored`), and count `error` events after them.

## Ideas, biggest first (none done)

1. **Let go of the canvases once the chip has the picture** (about 120 MB,
   maybe more on Android). The catch is the lost context: three.js sends every
   picture again from its canvas, so a picture without one comes back black.
   Throwing mesh arrays away after upload is exactly what left the game blank
   (`dropArray`, removed from `products.js`). So this needs a way to draw a
   picture again on demand: keep the function that drew each canvas instead of
   the canvas, and call it again on `webglcontextrestored`. Most are drawn by
   small functions in `textures.js`, `drawings.js`, `clutter.js`, `products.js`,
   `house.js`, `street.js` and `supermarket.js` (59 places make a canvas or a
   texture); the baked pages are composed from the kinds' pictures and would
   be recomposed. Test with the forced loss above, on the tablet too.
2. **One copy of each product picture.** If a knocked item were drawn from its
   baked page (same picture positions as in the baked mesh) instead of its
   kind's own picture, the kinds' own canvases and their copies on the chip
   could go, and the chip's share would stop growing as things get knocked
   over. Find out first how much of the 21 megapixels is really double.
3. **Smaller pictures on a weak device.** The baked pages are up to 2048 px;
   at sharpness 1 or lower nobody can see that. Half the size is a quarter of
   the memory, on both sides. It could follow the same remembered step as the
   sharpness and the simple shading (`QUALITY` in `main.js`), since it has to
   be decided while the game is built.
4. **No mipmaps where they don't show** (a third of the chip's share): not
   for most things, they keep far-off labels from sparkling. Only worth
   looking at for pictures that are always seen close.
5. **Mesh data** (42 MB): the unbaked shapes of products are needed for
   knocked items; the pieces that `batching.js` combined are not needed after
   combining unless something still points at them. Not looked into.
6. **Compressed textures** would be the real fix on the chip (a sixth of the
   memory), but the pictures are drawn in the browser, not loaded from files,
   so there's nothing to compress ahead of time. Not without a build step,
   which this project doesn't have.

## Pitfalls found on the way

- Don't free anything three.js may need again without a way to make it again
  (see 1). The CLAUDE.md bullet under *Low-end devices* says the same.
- One game at a time on the tablet, and load by way of an empty page: two
  games' worth of memory is what crashed the tab (the scripts do this).
- The graphics memory isn't in the JavaScript heap, so the heap number alone
  says little; and Chrome may count a canvas on either side.
