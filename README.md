# Toss the Lennie

Grab Lennie, a ragdoll, by any limb and fling him around a Dutch terraced house with two floors and an attic: through the rooms, down the stairs and out of the windows into the yard. Each toss scores points once he comes to rest, and the more contorted he ends up, the more it's worth.

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
- **Floor 3, the attic:** study (desk, bookshelf, armchair) and bathroom under the sloping roof, with a bathtub Lennie can land in tucked into the dormer
- A switchback staircase in the back hallway connects the floors, with open stairwells to fall down.
- Every window has glass that shatters when Lennie hits it hard enough, including the dormer window up in the attic.
- Every doorway has a closed door. Doors are a bit tougher than windows: a hard hit smashes one straight away, a lighter one only cracks it, and the next knock breaks it.
- **Outside:** a brick house in a 1970s Dutch terrace: two brick storeys with a tall window column and dark panels, small high windows, a flat canopy over the front door beside a little brick screen with breeze blocks, and a steep dark tiled roof with a chimney and the dormer. Lennie can land on the canopy, the roof and the dormer, and slide down the roof into the front garden.
- **The row:** neighbour houses continue the terrace on both sides under one long roof, mirrored in pairs and each with its own colour of panels. You can't go into them, but Lennie bounces off them and can land on their roofs and canopies. Because they share its side walls, Lennie's house has windows only at the front and back.
- **The gardens:** an open front garden with a big dark shrub in front of the window column and a low hedge along the cycle path; a fenced back garden with trees and a trampoline.
- **The street**, modelled on the real one: a red cycle path, a grass verge with tall trees and street lamps, and a two-lane road with room to play. Past the end of the row stand newer gabled townhouses (scenery only).
- **The supermarket** across the road, also after the real one: an orange building under a zigzag of grey gables, with posters, parked bikes and a brick-and-glass entrance under a big green PLUS-style logo (hand-drawn, not the official artwork). A green carpet runs from the road to the open sliding doors, so Lennie can be flung straight inside: checkouts, fruit and veg crates with red ACTIE offer cards, six aisles of shelves (bread, dairy, cheese, sweets, drinks, pasta and soup), freezers and drinks fridges. Its back wall is the far end of the play area, and he can land on its roof too. The roof and walls fade when you look inside.

Couches, beds, the beanbag, bushes, the hedge, the shrubs, tree tops and the trampoline are bouncy.

## Controls

| Action | Input |
| --- | --- |
| Grab and fling | Drag any limb, then flick and release |
| Push/pull while holding | Scroll wheel |
| Aim mode on/off | T (or the arc button) |
| Aimed toss (in aim mode) | Point where Lennie should go, click |
| Higher/lower arc (in aim mode) | Scroll wheel |
| Orbit camera | Drag empty space |
| Pan / zoom | Right-drag / scroll |
| Fly the camera | WASD, Q/E down/up |
| Drop Lennie on floor 1 / 2 / 3 / the roof | 1 / 2 / 3 / 4 |
| Fix the windows and doors and put Lennie back downstairs | R |
| Focus camera on Lennie | F |
| Camera follows Lennie | G |
| Cutaway (hide upper floors when looking down) | C |
| Slow motion | Z |
| Sound on/off | M |
| How to play | H |

In aim mode a dotted arc runs from Lennie to whatever you point at: a window, a doorway, a corner, the trampoline. It stops at the first thing in the way and the ring turns white when it won't reach, so you can see where he'll really hit. A click throws him along it with a little somersault. Dragging still orbits the camera, and grabbing a limb still works as usual.

Walls, floors and the roof between the camera and the point it's looking at fade out automatically, so you can see Lennie anywhere in the house.

## Scoring

- **Contortion**: every joint (neck, spine, shoulders, elbows, hips, knees) is measured against its relaxed pose. A bit of bend counts as relaxed and is free; past that, points grow with the square of the bend.
- **Pose tricks**: Upside down, The splits, Crossed/Pretzel legs, Tangled arm/Straitjacket, Foot in face, and Human knot (any three of those at once).
- **House feats**: Defenestrated! (thrown out of the house), Hanging out the window!, Fell N floors, Stair tumble/Full flight, Stranded on the roof!, Went shopping! (landed in the supermarket), On the supermarket roof!, Trampoline bounces.
- **Multiplier**: +0.1 per hard bounce, +0.25 per mid-air juggle (re-grabbing him while he's airborne), +0.3 per smashed window, +0.4 per smashed door, up to ×4.
- A toss that's too gentle doesn't score.

## Files

- `src/main.js`: scene, input, camera, toss state machine, breaking glass and doors, HUD
- `src/house.js`: the house (walls with windows and breakable doors, floors, stairs, the row's roof, furniture), plus cutaway and wall fading
- `src/street.js`: the neighbour houses, and the details every house in the row shares (porch, chimney, dormer, skylight, vents, downpipe)
- `src/yard.js`: sky, lighting, lawn, back-garden fence, the play area's edges, garden trees, bushes, the hedge and the trampoline
- `src/streetscape.js`: the street in front: cycle path, verge trees and lamps, road and the townhouses
- `src/supermarket.js`: the supermarket across the road, inside and out, with its own fading walls and roof
- `src/textures.js`: procedural textures (brick, roof tiles, window panels, cartoon glass, breeze blocks, wallpaper, wood, floor tiles, grass)
- `src/ragdoll.js`: Lennie's bodies, joints and look
- `src/scoring.js`: contortion measurement, trick detection and the multiplier
- `src/guard.js`: safety net that puts Lennie back in one piece if a limb ever ends up inside a wall or floor
- `src/audio.js`: synthesized sound effects

## License

Copyright (C) 2026 Klaboukes

Toss the Lennie is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License](LICENSE) as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; see the license for details.

three.js and cannon-es are separate projects under the MIT License.
