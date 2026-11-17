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
| `tosses.mjs [url]` | The standard test: 5 throws in the house, 5 in the supermarket, 5 after R. Frames per second and hitches per throw, and any errors. |
| `ab.mjs <url> base base <variant>…` | A/B experiments: change one thing in the page (hide the clutter, cheaper shading, lower resolution…) and measure 3 house throws, with physics time per frame. |
| `profile.mjs [url]` | A CPU profile of 3 house throws: where the main thread's time goes. |
| `draws.mjs [url]` | How many separate things are drawn per frame, by kind, from the start view and turned round. |

## Measuring without fooling yourself

- **Load fresh.** Python's server sends no cache headers, so Chrome may run old
  copies of the modules after a plain reload. The scripts reload with the cache
  bypassed; do the same by hand. Some early numbers here were wrong because of it.
- **One game tab.** The game uses about 550 MB of JavaScript memory. With two
  copies open, Android's low-memory cleaner closed Chrome mid-test.
- **Compare back to back.** The same code varies by 1–3 frames a second between
  runs. Run `base` twice, and the version to compare against right before or after.
- **A suspiciously perfect result means a crash.** 90 frames a second with
  identical numbers every run meant the game loop had stopped (the screen runs
  at 90 Hz, so the empty page did too). The scripts print errors; read them.
- **The first seconds are slow anyway**: `watchSpeed()` lowers the sharpness in
  steps (1.5 → 0.75 on this tablet, each step a short stall), and on localhost
  the flicker check runs for about 15 s. Measure after that.
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

## Next ideas (not done)

- On weak devices only: cheaper shading (Lambert), and a see-through effect
  without `discard` in every material (for instance only on the meshes between
  the camera and Lennie). Each would change the look a little on the tablet.
- Memory: about 550 MB of JavaScript heap even before these changes, plus the
  product pictures. An older iPad with less memory may close the tab. The
  baked clutter adds about a million corners (packed small, ~20 bytes each).
- Physics: fewer solver iterations or steps, only with care, as it changes how
  Lennie tumbles.
