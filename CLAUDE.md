# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project
**Toss the Lennie** is a browser game: fling Lennie, a ragdoll, around a three-storey house and score points for how contorted he lands. Plain JavaScript modules with [three.js](https://threejs.org/) and [cannon-es](https://github.com/pmndrs/cannon-es), both loaded from a CDN through the import map in `index.html`. There is no build step and there are no dependencies. [README.md](README.md) describes the house, controls, scoring and what each file in `src/` does.

The project owner doesn't write code. Talk to them in plain language about outcomes and the actions they need to take.

## Commands
```bash
python -m http.server 5173   # serve the game, then open http://localhost:5173 (.claude/launch.json does the same)
node tests/check.mjs         # quick code check: modules parse, imports resolve, index.html links exist (needs Node 20+)
```

## Before merging
The local run is the merge gate: run `node tests/check.mjs` (when Node is installed) and play the change in the browser, with no errors in the console. Nothing on GitHub checks a pull request.

## CI
`.github/workflows/ci.yml` runs `tests/check.mjs` **once a night** at 03:00 UTC on `main`, plus by hand through *Run workflow* on the Actions tab, **never per push or pull request**. The repo is public, so GitHub's standard runners cost no minutes, but the owner's private repos share the free plan's 2,000 minutes a month: on another project a run per push and PR used them up in one week, after which GitHub ran nothing at all. Nightly stays the policy, also if this repo goes private again. Don't add `push` or `pull_request` triggers back. GitHub pauses scheduled runs in a public repo after 60 days without commits; *Enable workflow* on the Actions tab turns them back on.

- The nightly run covers everything merged since the last successful run, and skips itself when only `*.md`, `docs/`, `.claude/` or `scripts/` changed. A run started by hand always checks.
- It uploads nothing when it passes, and only the check report (kept 3 days) when it fails.
- A run GitHub refused to start (spending limit, minutes used up, storage quota) is a billing problem, not a code failure. Don't change code over it.
- A real nightly failure gets fixed before anything else.
