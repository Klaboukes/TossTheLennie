# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project
**Toss the Lennie** is a browser game. Lennie lives in a typical Dutch rowhouse (two floors and an attic) with a supermarket across the street; you toss him around like a ragdoll in his house and in the supermarket, and score points for how contorted he lands. The neighbours' houses (a block of five, Lennie's second from the left) and the street are decoration, there to make the real neighbourhood recognizable: solid scenery Lennie bounces off, never places to go inside.

It's a just-for-laughs-and-giggles game for a friend and his kids to play, not for a broad online public. Keep it fun and simple: no accounts, analytics, ads, leaderboards or other features for strangers. A public GitHub Pages link is just the easy way to share it.

The game is in Dutch and English. Code and texts are written in English and every text a player can see goes through `t()`; any new or changed text needs its Dutch version in `src/i18n.js` too, or Dutch players see English. With Dutch on, `i18nMissing` in the browser console lists texts that came up without one.

Plain JavaScript modules with [three.js](https://threejs.org/) and [cannon-es](https://github.com/pmndrs/cannon-es), both loaded from a CDN through the import map in `index.html`. There is no build step and there are no dependencies. [README.md](README.md) describes the house, controls, scoring and what each file in `src/` does.

The project owner doesn't write code. Talk to them in plain language about outcomes and the actions they need to take.

## Low-end devices
The game must play smoothly on low-end devices: a budget Android tablet or phone a few years old, an older iPad, a cheap laptop with built-in graphics. That's what kids often get to use. Smoothly means about 30 frames a second or better while Lennie is flying, and no long pauses when he lands or things break.

- Every change keeps this in mind. More detail is fine as long as it stays cheap; when something nice-looking costs a lot, a cheaper version on weak devices (or leaving it out) beats a slow game.
- The big costs in this game are shadows, the number of separate things drawn per frame, screen resolution (the pixel ratio), and physics bodies near Lennie. So: real shadows stay off (`blobshadow.js` gives Lennie a soft spot instead); scenery that never moves gets combined automatically (`batching.js`), as long as it doesn't need `userData` or its own moving or hiding parent group; lots of copies of one thing go in one `InstancedMesh` with one material (see `products.js`); the pixel ratio stays capped at 1.5, and `watchSpeed()` in `main.js` lowers it on a device that can't keep up, then gives the scenery a simple shading without shine (`shading.js`; new scenery materials should stay plain MeshStandardMaterials so they get it too); the physics only tests the scenery near Lennie and only solves for what can move (`broadphase.js`: keep `tunePhysics(world)` in place, cannon-es's own bookkeeping cost most of every step; after a change there, `scripts/tablet/same.mjs` shows whether tosses still end exactly the same); and the HUD panels' frosted-glass blur (`backdrop-filter`) is only for devices with a mouse, because over a canvas that's redrawn every frame it's redone every frame.
- On a weak graphics chip (a Mali in a budget tablet), the cost per pixel counts as much as the number of draw calls: see-through materials are drawn last and blended, so fading walls are only see-through while they fade (`setFade` in `batching.js`); and the see-through cut's `discard` in every material keeps the chip from skipping hidden pixels. Products and clutter in their places are baked into a few meshes (`bake()` in `products.js`).
- A weak device now and then takes the game's graphics memory away and gives it back a few seconds later (a lost graphics context). three.js then sends every mesh and picture to the chip again, so nothing may be thrown away after it has been sent the first time (no `onUpload` that empties an array): that once left the game blank until a reload. Memory is tight on such a device altogether (one game is about 1.45 GB on the test tablet): [docs/memory.md](docs/memory.md) has what's known and what to try.
- Check it as part of the merge gate when a change adds a lot to the scene or the per-frame work: in Chrome's DevTools, *Performance* tab, set CPU to *4× slowdown* and play a few tosses in the house and the supermarket. It should still feel smooth. Compare with `main` if unsure.
- The owner's Lenovo Tab M11 is the real test device, driven from the PC over USB: [docs/tablet-testing.md](docs/tablet-testing.md) has the setup, the scripts in `scripts/tablet/`, the pitfalls of measuring on it, and what it has shown so far.

## Flickering surfaces
Two surfaces facing the same way in (almost) the same place flicker as the camera moves: the graphics chip can't tell which is in front (z-fighting). Two things keep this away:

- The camera's near plane stays at 20 cm (`main.js`). The depth precision everywhere scales with it, and the see-through effect already cuts away anything closer to the lens than 45 cm. Don't lower it.
- `src/flickercheck.js` scans the built scene when the game runs on localhost and prints a `Flicker check:` warning in the browser console listing every visible spot, with the parts' sizes, colours and positions; the file says how to fix them. Build parts so they fit between each other instead of into each other.

The check only lists spots that can be seen as built. A clean check isn't the goal by itself: hidden overlaps show up once a wall fades, the cutaway lifts a floor, or the camera goes inside something (the garden door's jamb was one). So build every part so that no face of it lies in one plane with a face of another part, hidden or not:

- **Ends and seams:** where two parts meet, their ends don't line up with the ends of a third. Stagger them by a centimetre (the roof stops 1 cm short of the party walls, where the walls, attic floor, fascia and ridge end), or tuck one end inside the next part.
- **Glass:** a pane stops 2 mm inside its frame or beads, and glazing bars start in front of the glass, not level with its back.
- **Things on a surface:** a sill sits above the worktop it reaches over, a panel sits just in front of the brick, not sunk into it with its ends level with the wall's. Lay flat decals with `polygonOffset` (see `flickercheck.js`).
- **A box's faces** go +x, −x, +y, −y, +z, −z, so the far end of a run comes first. Getting that backwards put brick where white trim belonged.
- **The near plane** means anything closer than 20 cm to the lens isn't drawn. A surface the camera can get that close to (a ceiling, a wall) gets a hole, so either the see-through cut or the cutaway must already handle it (see `underCeiling()` in `house.js`).

## Commands
```bash
python -m http.server 5173   # serve the game, then open http://localhost:5173 (.claude/launch.json does the same)
node tests/check.mjs         # quick code check: modules parse, imports resolve, index.html links exist (needs Node 20+)
```

## Hosting
GitHub Pages serves `main` as it is at https://klaboukes.github.io/TossTheLennie/, a minute or so after each push (GitHub's own *pages build and deployment* run, free for a public repo and separate from `ci.yml`). `.nojekyll` stops GitHub from processing the files first. Every path in the game must stay relative (`src/main.js`, not `/src/main.js`), because the game lives in the `/TossTheLennie/` subfolder there.

## Before merging
The local run is the merge gate: run `node tests/check.mjs` (when Node is installed) and play the change in the browser, with no errors in the console and no `Flicker check:` warning (see *Flickering surfaces*; it appears a few seconds after loading), and it still plays smoothly (see *Low-end devices*). Nothing on GitHub checks a pull request.

## One worktree per session
Every Claude Code session works in its own git worktree on its own branch, never directly in the main checkout, so several sessions can run at once without editing the same files or overwriting each other's work. If a session finds itself in the main checkout, it moves into a fresh worktree (branched from the latest `origin/main`) before changing any file.

## "Land"
When the owner says **land**, put the session's work live:
1. Commit everything on the session's branch.
2. Fetch and rebase onto the latest `origin/main`. Other sessions may have landed meanwhile: on a conflict, keep both sides' changes.
3. Run the merge gate above (check script plus playing it in the browser, no console errors) on the rebased code. After another session's update, hard-refresh the browser (Ctrl+Shift+R) so it doesn't run stale cached files.
4. Push the result to `main` (`git push origin HEAD:main`). GitHub Pages then updates the live page within a minute or so.
5. Tell the owner in plain words what went live, and anything that didn't.
6. Give the owner the command that brings their own folder (the main checkout, `C:\source\Toss the Lennie`) up to date, in its own `bash` code block so the app shows a Run button, and say in a line that their folder only shows the new work once they've run it:
   ```bash
   git -C "C:/source/Toss the Lennie" pull --ff-only
   ```
   Sessions can't run it themselves: they're kept out of the main checkout. If the owner says it failed (their folder isn't on `main`, or has changes of its own), help them sort it out without losing those changes.

If the push is refused because `main` moved again, repeat from step 2. Never force-push `main`.

## CI
`.github/workflows/ci.yml` runs `tests/check.mjs` **once a night** at 03:00 UTC on `main`, plus by hand through *Run workflow* on the Actions tab, **never per push or pull request**. The repo is public, so GitHub's standard runners cost no minutes, but the owner's private repos share the free plan's 2,000 minutes a month: on another project a run per push and PR used them up in one week, after which GitHub ran nothing at all. Nightly stays the policy, also if this repo goes private again. Don't add `push` or `pull_request` triggers back. GitHub pauses scheduled runs in a public repo after 60 days without commits; *Enable workflow* on the Actions tab turns them back on.

- The nightly run covers everything merged since the last successful run, and skips itself when only `*.md`, `docs/`, `.claude/` or `scripts/` changed. A run started by hand always checks.
- It uploads nothing when it passes, and only the check report (kept 3 days) when it fails.
- A run GitHub refused to start (spending limit, minutes used up, storage quota) is a billing problem, not a code failure. Don't change code over it.
- A real nightly failure gets fixed before anything else.
