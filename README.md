# Toss the Lennie

Lennie lives in a typical Dutch rowhouse, with a supermarket across the street. Grab him, pull him back like a slingshot and let go to toss him around like a ragdoll: through the rooms, down the stairs, out of the windows, over the road and into the supermarket. Each toss scores points once he comes to rest, and the more contorted he ends up, the more it's worth.

Lennie's house and the supermarket are where the game happens. The neighbours' houses, the street and the townhouses further along are there for decoration, so the neighbourhood looks like the real one.

It's a just-for-laughs-and-giggles game, made for a friend and his kids to play, not for a broad online public.

Built with [three.js](https://threejs.org/) (rendering) and [cannon-es](https://github.com/pmndrs/cannon-es) (ragdoll physics). Both load from a CDN, so there's no build step.

**Play it:** https://klaboukes.github.io/TossTheLennie/

## Run it

Any static file server works. With Python:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## The house

Lennie's house is a brick rowhouse in a 1970s Dutch terrace, with two floors and an attic.

- **Floor 1:** living room (couch, coffee table, TV) and kitchen (counter, fridge, dining table)
- **Floor 2:** bedroom (bed, wardrobe) and kids room (bed, toy box, beanbag)
- **Floor 3, the attic:** study (desk, bookshelf, armchair) and bathroom under the sloping roof, with a bathtub Lennie can land in tucked into the dormer
- A switchback staircase in the back hallway connects the floors, with open stairwells to fall down.
- Every window has glass that shatters when Lennie hits it hard enough, including the dormer window up in the attic.
- Every doorway has a closed door. Doors are a bit tougher than windows: a hard hit smashes one straight away, a lighter one only cracks it, and the next knock breaks it.
- **Outside:** two brick storeys with a tall window column and dark panels, small high windows, a flat canopy over the front door beside a little brick screen with breeze blocks, and a steep dark tiled roof with a chimney and the dormer. Lennie can land on the canopy, the roof and the dormer, and slide down the roof into the front garden.
- **The gardens:** an open front garden with a big dark shrub in front of the window column and a low hedge along the cycle path; a fenced back garden with trees and a trampoline.

## The supermarket

Across the road, after the real one: an orange building under a zigzag of grey gables, with posters, parked bikes and a brick-and-glass entrance under a big green PLUS-style logo (hand-drawn, not the official artwork). A green carpet runs from the road to the open sliding doors, so Lennie can be flung straight inside: checkouts, fruit and veg crates with red ACTIE offer cards, six aisles of shelves, glass-door freezers along the back wall and drinks fridges along the side. Its back wall is the far end of the play area, and he can land on its roof too. The roof and walls fade when you look inside.

- **The shelves** are stocked with products that belong in each aisle, in cartoon packaging with plain Dutch names (no real brands): beschuit, ontbijtkoek, hagelslag, vlokken, muisjes, three kinds of pindakaas, chocopasta, jam, appelstroop and honey; milk, karnemelk, chocomelk, yoghurt, vla, kwark, slagroom, koffiemelk, butter and eggs; coffee, coffee pads and tea; chips, drop, sweets, chocolate, stroopwafels, speculaas and pepernoten; cola, sinas, water, juice and cans; spaghetti, macaroni, rice, soup, appelmoes, pasta sauce, pindasaus, sambal, mustard, mayo and fritessaus. The freezers hold ice cream, pizza, fries, peas and fish sticks, and the fridges drinks.
- **The bakery** in the front corner: a wooden bread rack (tijgerbrood, volkoren, witbrood, suikerbrood, stokbrood, krentenbollen, croissants), a table of rolls in baskets, the bread slicer, and a glass case of tompouces, appeltaart, gevulde koeken and cinnamon rolls. The case's glass shatters and the pastries fly out.
- **The pindakaas pyramid** by the entrance: a pallet stacked with jars in steps under a giant jar, with a 1+1 offer. Knock out enough of a layer and everything above it comes down.
- **The sloping veg stand** along the side wall: rows of black crates tilted towards the shop, piled with paprika, cucumbers, leeks, broccoli, tomatoes, onions and more, with price screens on poles.
- **The cheese cooler** along the other wall: an open fridge with sloping shelves of cheese packs (jong, oud, komijn, geit, slices), big Gouda wheels stacked on top, and a Hollandse kaas sign with a cow.
- **More Dutch things:** an open snack freezer with kroketten, frikandellen, bitterballen and kaassoufflés; a Sinterklaas stand with pepernoten and chocolate letters; buckets of tulips inside the window; and the bottle return machine for the deposit.
- **Crash into any of it** and the products near the impact tumble out onto the floor: the harder the hit, the bigger the mess. The fruit and veg and the bread rolls on the tables go the same way: land in them or bump a table and they roll off across the floor.
- **The shop window** by the entrance, **every freezer and fridge door** and **the pastry case** are glass that shatters like the house's windows. Smash a freezer or fridge door and the products behind it spill out; land Lennie in that doorway and he's in the freezer.
- R puts the glass back and restocks everything, the pyramid too.

## The neighbourhood (decoration)

The rest of the neighbourhood is scenery, modelled on the real street so it's recognizable. You can't go inside any of it, but Lennie bounces off it and can land on it.

- **The row:** neighbour houses continue the terrace on both sides of Lennie's house under one long roof, mirrored in pairs and each with its own colour of panels. Lennie can land on their roofs and canopies. Because they share its side walls, Lennie's house has windows only at the front and back.
- **The street:** a red cycle path, a grass verge with tall trees and street lamps, and a two-lane road with room to play.
- **The townhouses:** newer gabled townhouses past the end of the row.

The play area runs from the back garden, across the street, to the supermarket's back wall. If Lennie ever gets out of it, he's stood back on open ground just inside the edge, near where he left.

Couches, beds, the beanbag, bushes, the hedge, the shrubs, tree tops and the trampoline are bouncy.

## Controls

| Action | Input |
| --- | --- |
| Slingshot throw | Drag Lennie back, away from where he should go, and let go |
| Higher/lower arc | Scroll wheel while pulling, or the ▲ ▼ buttons |
| Cancel a throw | Let go back on Lennie, or Esc |
| Catch him in mid-air (juggle) | Grab him while he's flying, flick and let go |
| Push/pull while juggling | Scroll wheel |
| Aim mode on/off | T (or the arc button) |
| Aimed toss (in aim mode) | Point where Lennie should go, click |
| Higher/lower arc (in aim mode) | Scroll wheel, or the ▲ ▼ buttons |
| Orbit camera | Drag empty space |
| Pan / zoom | Right-drag / scroll |
| Fly the camera | WASD, Q/E down/up |
| Drop Lennie on floor 1 / 2 / 3 / the roof / in the supermarket | 1 / 2 / 3 / 4 / 5 |
| Fix the windows and doors, restock the shop and put Lennie back downstairs | R |
| Watch the last toss again in slow motion | P (or the button on the score card) |
| Take turns with 2–4 players | The people button |
| Focus camera on Lennie | F |
| Camera follows Lennie | G |
| Cutaway (hide upper floors when looking down) | C |
| Slow motion | Z |
| Sound on/off | M |
| How to play | H |
| Close the help, a menu or a replay | Esc |

**On a tablet or phone:** pull Lennie back and let go to fling him (▲ ▼ for a higher or lower arc), drag empty space to turn the camera, and pinch or slide two fingers to zoom and move. In aim mode, tap a spot to see the flight path and tap it again to throw. The help screen shows the touch controls on a touch screen and the mouse and keyboard ones on a computer.

The slingshot works like this: grab Lennie anywhere while he's lying down and pull back, away from where he should go. While you pull, a dotted arc shows exactly where he'll fly and a power bar fills: the further you pull, the further he goes. Pulling down (towards you) throws him into the picture, pulling left throws him right. The scroll wheel or the ▲ ▼ buttons make the arc higher or flatter without changing how far he lands, and the setting is kept for the next throw. A very flat or very steep arc can't reach as far; the power bar turns dark red when pulling further won't take him any further. A pull that's too short throws nothing. Grabbed in mid-air, Lennie isn't in the slingshot: he swings from your hand and a flick throws him again, for juggles.

In aim mode a dotted arc runs from Lennie to whatever you point at: a window, a doorway, a corner, the trampoline. It stops at the first thing in the way and the ring turns white when it won't reach, so you can see where he'll really hit. A click throws him along it with a little somersault, hard enough to smash through a window or door he's aimed at. Dragging still orbits the camera, and grabbing a limb still works as usual.

Walls, floors and the roof between the camera and the point it's looking at fade out automatically, so you can see Lennie anywhere in the house. Anything else between the camera and Lennie (a shelf, a freezer, the couch, a tree, a pile of fallen groceries) turns see-through in a soft circle around him, and so does anything right in front of the lens, so he's never hidden. The camera only moves in when it would otherwise end up inside furniture, a bush, a tree or a neighbour's house, and glides there and back instead of hopping. Turning the camera goes no lower than eye level, so it can't dip under the floor.

During a toss the camera stays put while Lennie is in view; once he's about to fly out of the picture (on a phone that's almost straight away), it chases him until he lands.

The game opens close up on Lennie with a "Grab me!" bubble over him, which stays until he's first picked up.

## Scoring

- **Contortion**: every joint (neck, spine, shoulders, elbows, hips, knees) is measured against its relaxed pose. A bit of bend counts as relaxed and is free; past that, points grow with the square of the bend.
- **Pose tricks**: Upside down, The splits, Pretzel legs, Straitjacket, Foot in face, and Human knot (any three of those at once). One crossed leg or one tangled arm is a small extra that doesn't count towards the knot.
- **House feats**: Defenestrated! (thrown out of the house), Hanging out the window!, Fell N floors (a modest bonus, so rolling him off the roof isn't the easy way to a big score), Stair tumble/Full flight, Stranded on the roof!, Went shopping! (landed in the supermarket), On the supermarket roof!, Knocked products off the shelves (5 or more, 10 points each, up to 400), Trampoline bounces.
- **Landing spots**: where he comes to rest can earn a bonus, with Lennie saying something about it: in the bath, on the loo, on the desk, in the armchair, on top of the wardrobe, in either bed, on the beanbag or the toy box, on top of the fridge, on the dinner table or kitchen counter, on the couch; in the supermarket in a freezer or a drinks fridge (through a smashed door, half in counts), on top of the freezers, the drinks fridges, the shelves, the bread rack or the cheese cooler, in the trolleys, in the fruit and veg, in the bread baskets, in the smashed pastry case, in the pindakaas, in the snack freezer, in the tulips, or scanned at a checkout; outside stuck in a tree, in the bushes, or napping on the trampoline.
- **Multiplier**: +0.1 per hard bounce, +0.25 per mid-air juggle (re-grabbing him while he's airborne), +0.3 per smashed window (the shop window and the freezer and fridge doors count too), +0.4 per smashed door, up to ×4.
- A toss that's too gentle doesn't score.
- The best score is remembered in the browser, so it survives a reload on the same computer.

## Challenges

Under the score there's always one challenge to go for, from easy ("Smash a window") to hard ("Put Lennie in the freezer", "Score 2,500 points in one toss"): 23 in all. Doing one adds 300 points to that toss and brings up the next. *Skip* moves on and comes back to it later. Progress is remembered in the browser. Challenges pause during a game of turns.

## Taking turns

The people button starts a game for 2–4 players, with their names (remembered for next time). Everyone gets 5 tosses, one after the other. Before each turn the house is fixed and Lennie goes back downstairs, so everyone starts the same way, and a card says whose turn it is, so the tablet can be passed on. A board under the score shows everyone's total. After the last toss the winner is announced, with *Play again* or *Back to free play*.

## Replay and reactions

Every toss is recorded. *Watch the replay* on the score card (or P) plays it back in slow motion with the camera following Lennie, from just before he's let go to where he lands, however long he was held first. A tap or a key stops it. A replay only plays when someone asks for it.

A big toss (1,500 or more) gets a burst of confetti where Lennie lands and a blue *Big toss!* sticker on the score card. A new best gets more confetti with gold in it, a gold *New best!* sticker and a little chime. Both make *Watch the replay* glow a few times.

Lennie reacts: a grin and a "wheee!" when he's flung, "ow!" and "oof" when he hits something hard, and after a good toss he lies there with crossed-out eyes, his tongue out and stars circling his head until he's picked up again. All sounds are synthesized; there are no audio files.

## Files

- `index.html`, `style.css`: the page, toolbar, score panel, challenge, players board, turn card and help; the import map that loads three.js and cannon-es
- `src/main.js`: scene, input (mouse and touch), camera, toss state machine, breaking glass and doors, landing spots, putting Lennie back when he leaves the play area, HUD, challenges, taking turns and the replay controls
- `src/house.js`: the house (walls with windows and breakable doors, floors, stairs, the row's roof, furniture), plus cutaway and wall fading
- `src/street.js`: the neighbour houses, and the details every house in the row shares (porch, chimney, dormer, skylight, vents, downpipe)
- `src/yard.js`: sky, lighting, lawn, back-garden fence, the play area's edges, garden trees, bushes, the hedge and the trampoline
- `src/streetscape.js`: the street in front: cycle path, verge trees and lamps, road and the townhouses
- `src/supermarket.js`: the supermarket across the road, inside and out (the breakable shop window, aisles, freezers and fridges, the bakery, the sloping veg stand, the cheese cooler, the pindakaas pyramid and the other displays), with its own fading walls and roof
- `src/seethrough.js`: the see-through circle that keeps Lennie in view through whatever is between him and the camera
- `src/products.js`: the groceries: every product's shape and packaging, what goes on which shelf, and knocking them off and restocking
- `src/textures.js`: procedural textures (brick, roof tiles, window panels, cartoon glass, breeze blocks, wallpaper, wood, floor tiles, grass)
- `src/ragdoll.js`: Lennie's bodies, joints and look (1.90 m and 100 kg, with a bit of a belly, a scruffy greying beard, a receding hairline and glasses, in a worn hoodie and joggers)
- `src/scoring.js`: contortion measurement, trick detection and the multiplier
- `src/challenges.js`: the list of challenges and the progress kept in the browser
- `src/replay.js`: records each toss and plays it back in slow motion
- `src/guard.js`: safety net that puts Lennie back in one piece if a limb ever ends up inside a wall or floor
- `src/audio.js`: synthesized sound effects and Lennie's voice
- `tests/check.mjs`: quick code check (modules parse, imports resolve, files linked from `index.html` exist), run nightly by `.github/workflows/ci.yml`

## License

Copyright (C) 2026 Klaboukes

Toss the Lennie is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License](LICENSE) as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; see the license for details.

three.js and cannon-es are separate projects under the MIT License.
