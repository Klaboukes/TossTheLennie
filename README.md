# Toss the Lennie

Grab Lennie, a ragdoll, by any limb and fling him around a three-storey family house: through the rooms, down the stairs and out of the windows into the yard. Each toss scores points once he comes to rest, and the more contorted he ends up, the more it's worth.

Built with [three.js](https://threejs.org/) (rendering) and [cannon-es](https://github.com/pmndrs/cannon-es) (ragdoll physics). Both load from a CDN, so there's no build step.

**Play it:** https://klaboukes.github.io/TossTheLennie/

## Run it

Any static file server works. With Python:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## The house

- **Floor 1:** living room (couch, coffee table, TV) and kitchen (counter, fridge, dining table)
- **Floor 2:** bedroom (bed, wardrobe) and kids room (bed, toy box, beanbag)
- **Floor 3:** study (desk, bookshelf, armchair) and bathroom (a bathtub Lennie can land in)
- A switchback staircase in the back hallway connects the floors, with open stairwells to fall down.
- Every window has glass that shatters when Lennie hits it hard enough.
- **Outside:** a pitched roof with a chimney, plus a fenced yard with bushes, trees and a trampoline.

Couches, beds, the beanbag, bushes, tree tops and the trampoline are bouncy.

## Controls

| Action | Input |
| --- | --- |
| Grab and fling | Drag any limb, then flick and release |
| Push/pull while holding | Scroll wheel |
| Orbit camera | Drag empty space |
| Pan / zoom | Right-drag / scroll |
| Fly the camera | WASD, Q/E down/up |
| Drop Lennie on floor 1 / 2 / 3 / the roof | 1 / 2 / 3 / 4 |
| Fix the windows and put Lennie back downstairs | R |
| Focus camera on Lennie | F |
| Camera follows Lennie | G |
| Cutaway (hide upper floors when looking down) | C |
| Slow motion | Z |
| Sound on/off | M |
| How to play | H |

Walls and floors between the camera and the point it's looking at fade out automatically, so you can see Lennie anywhere in the house.

## Scoring

- **Contortion**: every joint (neck, spine, shoulders, elbows, hips, knees) is measured against its relaxed pose. A bit of bend counts as relaxed and is free; past that, points grow with the square of the bend.
- **Pose tricks**: Upside down, The splits, Crossed/Pretzel legs, Tangled arm/Straitjacket, Foot in face, and Human knot (any three of those at once).
- **House feats**: Defenestrated! (thrown out of the house), Hanging out the window!, Fell N floors, Stair tumble/Full flight, Stranded on the roof!, Trampoline bounces.
- **Multiplier**: +0.1 per hard bounce, +0.25 per mid-air juggle (re-grabbing him while he's airborne), +0.3 per smashed window, up to ×4.
- A toss that's too gentle doesn't score.

## Files

- `src/main.js`: scene, input, camera, toss state machine, breaking glass, HUD
- `src/house.js`: the house (walls with windows and doors, floors, stairs, roof, furniture), plus cutaway and wall fading
- `src/yard.js`: sky, lighting, lawn, fence, trees, bushes and the trampoline
- `src/textures.js`: procedural textures (siding, wallpaper, wood, tiles, shingles, grass)
- `src/ragdoll.js`: Lennie's bodies, joints and look
- `src/scoring.js`: contortion measurement, trick detection and the multiplier
- `src/guard.js`: safety net that puts Lennie back in one piece if a limb ever ends up inside a wall or floor
- `src/audio.js`: synthesized sound effects
