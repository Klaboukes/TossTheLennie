# Toss the Lennie

Lennie lives in a typical Dutch rowhouse, with a supermarket across the street. Grab him, pull him back like a slingshot and let go to toss him around like a ragdoll: through the rooms, down the stairs, out of the windows, over the road and into the supermarket. Each toss scores points once he comes to rest, and the more contorted he ends up, the more it's worth.

Lennie's house and the supermarket are where the game happens. The neighbours' houses and the street are there for decoration, so the neighbourhood looks like the real one.

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

- **Floor 1**, after the owner's floor plan ([docs/house-design.md](docs/house-design.md)): at the front a toilet, the hallway with the coat rack and the stairs, and an open kitchen with a U of white cupboards under beige worktops, a cooker hood, plants on the window sill, a coffee machine under the hanging cupboard and a whiteboard with the family's week schedule on the wall to the hallway; under the stairs a storage cupboard, stuffed with shelves of boxes, paint, cleaning stuff and a secret stash of sweets, with more junk on the floor, which all comes pouring out into the living room when Lennie smashes its door; across the back the living room, white with the kids' drawings on the walls (and handprints and crayon scribbles right on them), a big black-and-white painting of a medieval town behind the dining table (dark grey corner couch with a small round side table in front of it, a comfy chair, the TV turned towards the couch in the corner on a low black cabinet with three painted horse doors, a tall closet full of board games, a dining table with six chairs, a piano with black and white keys and an open music book against the side wall, with its back to a wooden-topped bar as high as the piano (a wooden pole from the bar up to the ceiling at its left end, and a little wooden cabinet of six drawers at the wall end) in front of the kitchen counter, and a little toy cabinet full of toys beside it), with one big window onto the garden and a heating trench with a wooden grille in the floor under it; and built on at the back a utility room with the fridge (smash a door off and it flies across the room, and the milk, cheese, ice cream and pizzas come tumbling out), an open Kallax beside it crammed with the family's shoes and rubber boots (crash into it and they come flying out), the cat's big litter box with a coat rack full of coats on the wall above it, and shoes kicked off on the floor, and behind that the garage. The inside doors are white, and the ones to the hallway, the utility room and the garden have glass panes (the last two with a cat flap). The living room, kitchen, toilet, hallway, landing, utility room, bedrooms and attic have white walls, a bit grubby and lived-in like the light off-white ceilings
- **Floor 2**, after the owner's floor plan ([docs/floorplan-floor2.png](docs/floorplan-floor2.png)): a hallway at the top of the stairs, with four doors. The two back rooms are under the roof, which comes down low at the back, with sloping ceilings over a low knee wall and a wide dormer with a window for each. At the back left a kids room (bed, low cabinet, high clothes cabinet, toy box), at the back right the bedroom (a big bed, a bureau with a computer and a chair buried under clothes, a high clothes cabinet), at the front left the bathroom (a bath all along the wall with a shower and a glass shower screen that shatters, loo, sink cabinet with a mirror) and at the front right the other kids room (bed, bureau, high clothes cabinet, beanbag)
- **Floor 3, the attic**, after the owner's floor plan: a wall from the back to the front splits it in two under the sloping roof. At the back the roof comes down to the floor sooner than at the front. On the left the stairs come up into the junk attic, with the washing machine and the dryer side by side at the back (land on the washer for a spin); on the right the attic bedroom, with the bed along the right-hand wall and a low cabinet under the dormer window. Both rooms have stacks of cardboard boxes here and there (up to three high, lower where the roof comes down) and old junk (suitcases, sleeping bags, camping gear, Christmas stuff, toys): crash into them and the stacks topple and every box spills what's in it, clothes, Lego, books, baubles, baby toys, all bouncing off the sloping roof
- **It's a mess:** dirty dishes, pans and half-eaten breakfast on the kitchen counter and table, and plants, a vase of tulips and a fruit bowl on the bar between the kitchen and the living room (they smash when they fall); toys, crayons and drawings all over the living room and kids room floors; clothes everywhere in the bedrooms; and the usual household stuff (washing-up liquid, loo rolls, shampoo, a vacuum cleaner left out, trash bags, a thirsty plant on the TV cabinet). The loose things don't get in Lennie's way: land among them or crash into the table they're on and they go flying.
- **The board game closet** in the living room is stuffed with Dutch games: Mens erger je niet, Ganzenbord, Dammen, Schaken, Zeeslag, Vier op een rij, Kwartet, Domino, Memo, Mikado, jigsaw puzzles and more (plain names, no brands), plus the family's own big games by name: Catan, Risk, Axis & Allies, Dungeons & Dragons and Carcassonne, with a sjoelbak on top. Its two doors are shut, painted like a Mongolian chest (vermilion, a gold key-pattern border, cloud scrolls and an endless knot in a round medallion). A knock cracks a door and it swings ajar; a hard hit smashes it, and then crashing into the closet empties that side across the floor (the games on top fall off any time), and every box spills its pawns, dice, cards, puzzle pieces and play money, or its land hexes and little houses, armies, tanks and planes, twenty-sided dice and miniatures, or land tiles and meeples.
- **The TV cabinet** is black with three colourful doors, each painted with a horse, and crammed with the kids' toys. Crash Lennie into a door and it flies off and lands on the floor, horse up, and the toys behind it come tumbling out; a really hard hit takes the doors next to it too.
- The stairs go up from the hallway along the left wall and make a quarter turn at the top into floor 2's hallway. The stairs to the attic sit right above them and make two quarter turns: from the hallway towards the left wall, back along it, and round over the top of the first stairs. The stairwell is open to fall down. Throw Lennie up a flight (from the hallway at its foot, or from floor 2's hallway up to the attic) and a helping hand carries him up the stairwell and lets him go at the top, since a free throw up such a steep, narrow stairwell nearly always ends with him tumbling back down. A gentle throw only gets him part of the way up. In aim mode, point at anything upstairs (even in the attic) or at a step.
- **The washing-up:** towers of dirty plates with bowls, mugs and glasses on top are heaped on the kitchen counter either side of the sink, and in it. Land Lennie in them and they smash: the crockery right under him breaks on the spot, whole towers come down in pieces, and any plate, mug or glass that falls off a counter or a table breaks when it hits the floor (the plates on the dining table too). The shards stay where they land until R.
- **The hanging cupboard** on the kitchen's side wall reaches up to the ceiling and has four white doors with glass panes, with the clean plates, bowls, mugs and glasses and the breakfast things behind them on three levels. Crash Lennie into a door (or into it from below) and the door flies off into the kitchen and lands on the floor, and what's behind it comes tumbling down onto the counter and smashes; a really hard hit takes the doors next to it too, and once a door is off the next knock brings down more.
- Every window has glass that shatters when Lennie hits it hard enough, including the dormer window up in the attic and the back dormer's two.
- The TV in the living room is on, with the kids' blocky building game on it. Throw Lennie into it hard and the screen cracks where he hit it, flickers and spits sparks, and he gets electrocuted: he flashes between glowing blue and an X-ray of his skeleton while lightning crackles over him, then lies there sooty and smoking. Bump him into the cracked TV again and he gets another shock. R fixes the TV.
- **The cat:** a fluffy grey-black and white tuxedo cat wanders about the living room, the kitchen, the utility room and the back garden, in and out through the cat flaps. It naps on the couch and the lounge set, eats from its bowls in the kitchen, uses its litter box, sits on the trampoline, grooms itself, watches the garden through the window and miaows now and then. Toss Lennie near it and it attacks (see *Special effects*).
- **More special effects** (see *Special effects* below): the bath, the washing machine, the hot cooker, the piano, the beds' pillows, the cat litter and bins, the garage's paint tins and the brambles all do something to him.
- Every doorway has a closed door. Doors are a bit tougher than windows: a hard hit smashes one straight away, a lighter one only cracks it, and the next knock breaks it.
- **The toy cabinet** beside the piano is crammed with toys: crash Lennie into it and they come tumbling out into the living room.
- The six dining chairs, the piano stool, the two small round tables (in front of the couch and at the lounge set in the garden) and the bikes and moped in the back garden aren't fixed in place: Lennie shoves them aside or knocks them over (so he doesn't get stuck between them), and they stay where they fell until R puts them back. The replay shows them falling too.
- **Outside:** two brick storeys with a tall window column and dark panels, small high windows, the toilet sticking out of the front beside the front door (its window two square concrete breeze blocks, like the real house), the house number on a little white plaque beside the door, a flat canopy over both, and a steep dark tiled roof with a chimney and the dormer. At the back, after the photo of the real house, the roof slopes all the way down to just above the ground floor, with a wide white dormer with a dark edge and two windows for the back rooms of floor 2, rows of black solar panels above it and the attic's roof window off to one side. Lennie can land on the canopy, the roof, the dormers and the solar panels, and slide down the roof into the front or back garden (or go out through a back dormer window and slide down that way).
- **The garage:** behind the utility room, with its green door shut: throw Lennie at it and it cracks, then smashes, and he's in. Inside: shelves full of camping stuff, a table piled high with boxes of junk, tool shelves with paint tins and a pegboard of tools, and a bike. All that stuff is loose, like the supermarket's: crash into a shelf, the table or the pegboard and it comes down.
- **The gardens:** an open front garden with low bushes down one side, a big dark bush out by the low hedge along the cycle path, and a small path to the front door; a fenced back garden after the floor plan, with bushes along one side and down the other the garage, a corner lounge set with a low round table under a flat plastic canopy (fixed to the garage and the fence, on one wooden post), a round trampoline with a thorny tangle of brambles behind it along the fence (they don't bounce him like the bushes: they grab him and scratch him), and a tree beside the three wheelie bins, and a stretch of lawn behind them to the gate in the back fence, where junk has piled up: old plywood boards leaning on the fence, black bin bags, cardboard boxes and old tyres (the bags are soft to land on). Along the bushes, parked any old how, stand the family's bikes: a black omafiets with a crate on the front, a blue city bike, a pink kid's bike and a little green one, and a dark blue moped with a windscreen and a top box.

## The supermarket

Across the road, after the real one: a row of pitched roofs whose tall gable ends (four dark slate, two glazed) come down to the ground, with orange blocks in front of them, their top corners cut off at 45°, so each pair of gables shows between two blocks as a grey Y with a drainpipe down the middle; the two dark Ys stand left of the entrance with a low orange point between them, the glazed one as far to its right, and past it the long block with the name runs to the far end; at the other end a closed back room beside the shop floor gives the first block room for posters too. With posters, grey service doors, parked bikes and a brick-and-glass entrance under a big green PLUS-style logo (hand-drawn, not the official artwork). A green carpet runs from the road to the open sliding doors, so Lennie can be flung straight inside: checkouts, a sloping fruit and veg stand round the front corner, five aisles of shelves, glass-door freezers along the back wall with the butcher's counter in the corner, and drinks fridges along the side. Its back wall is the far end of the play area, and he can land on its roof too. The roof and walls fade when you look inside.

- **The shelves** are stocked with products that belong in each aisle, in cartoon packaging with plain Dutch names (no real brands): milk, karnemelk, chocomelk, yoghurt, vla, kwark, slagroom, koffiemelk, butter and eggs; coffee, coffee pads and tea; chips, drop, sweets, chocolate, stroopwafels, speculaas and pepernoten; cola, sinas, water, juice and cans; spaghetti, macaroni, rice, soup, appelmoes, pasta sauce, pindasaus, sambal, mustard, mayo and fritessaus. The freezers hold ice cream, pizza, fries, peas and fish sticks, and the fridges drinks.
- **The bakery** in the front corner: a wooden bread rack (tijgerbrood, volkoren, witbrood, suikerbrood, stokbrood, krentenbollen, croissants), a table of rolls in baskets, the bread slicer, and a glass case of tompouces, appeltaart, gevulde koeken and cinnamon rolls. The case's glass shatters and the pastries fly out.
- **The pindakaas and hagelslag pyramids** where the first aisle stood, by the cheese: pallets stacked with jars or boxes in steps under a giant one, with an ACTIE offer each. Knock out enough of a layer and everything above it comes down.
- **The sloping fruit and veg stand** along the side wall and round the corner along the front, up to the bottle return machine: rows of black crates tilted towards the shop, piled with apples, pears, oranges, paprika, cucumbers, leeks, broccoli, tomatoes, onions and more, with price screens on poles.
- **The cheese cooler** along the other wall: an open fridge with sloping shelves of cheese packs (jong, oud, komijn, geit, slices), big Gouda wheels stacked on top, and a Hollandse kaas sign with a cow.
- **The butcher's counter** (slagerij) in the back corner: a glass counter of rookworst, gehaktballen, slavinken, biefstuk, kipfilet, speklappen, karbonade, runderlappen, filet americain and saucijzen on trays with parsley between them, a "now serving" number above it, and a narrow aisle behind it for the butcher, under a tiled wall with a pig and a rail of hanging rookworsten. The glass smashes and sends the meat flying; a hit on the rail brings the rookworsten down.
- **More Dutch things:** an open snack freezer with kroketten, frikandellen, bitterballen and kaassoufflés; three Sinterklaas stands against the ends of the three middle aisles, facing the entrance (the middle one straight across from the doors): marsepein pigs, pepernoten, and chocolate letters; buckets of tulips inside the window (crash into them and they tip over, tulips everywhere); and the bottle return machine for the deposit.
- **A lone shopping trolley** stands just inside the sliding doors, apart from the row of trolleys. Land Lennie in its basket and it rolls off with him (see *Special effects*).
- **Crash into any of it** and the products near the impact tumble out onto the floor: the harder the hit, the bigger the mess. The fruit and veg and the bread rolls on the tables go the same way: land in them or bump a table and they roll off across the floor.
- **The shop window** by the entrance, **every freezer and fridge door**, **the pastry case** and **the butcher's counter** are glass that shatters like the house's windows. Smash a freezer or fridge door and the products behind it spill out; land Lennie in that doorway and he's in the freezer.
- R puts the glass back and restocks everything, the pyramid too (and puts the mess in the house back where it was).

## The neighbourhood (decoration)

The rest of the neighbourhood is scenery, modelled on the real street so it's recognizable. You can't go inside any of it, but Lennie bounces off it and can land on it.

- **The row:** a block of five houses under one long roof, like the real one ([docs/house-design.md](docs/house-design.md)), with Lennie's house second from the left. The neighbours are mirrored in pairs, each with its own colour of panels, and their windows are boarded up with plywood to show you can't go in. Lennie can land on their roofs and canopies. Because they share its side walls, Lennie's house has windows only at the front and back.
- **The street:** a red cycle path, a grass verge with tall trees and street lamps, and a two-lane road with room to play.
- **Cars:** now and then a car drives by (a hatchback, an estate or a van, in a random colour), keeping to the right. Throw Lennie in front of a moving one and it sends him flying up and along the road. While he lies in a lane (or is being picked up there), the cars stop short of him and honk until he's out of the way, and the ones behind queue up.

The play area runs from the back garden, across the street, to the supermarket's back wall. At the back, Lennie's own garden fence is the end of the map: the neighbours' back gardens are out of bounds, and the same dark wooden fence closes them off at the far left end of the row. If Lennie ever gets out of it, he's stood back on open ground just inside the edge, near where he left.

Couches, beds, the beanbag, bushes, the hedge, the shrubs, tree tops and the trampoline are bouncy.

## Special effects

Besides the TV's electric shock, these things happen to Lennie. Each earns a bonus once a toss, and R (or dropping him somewhere) puts everything back to normal.

- **Frozen solid:** in a smashed freezer or the open snack freezer he turns icy blue, frost all over him, and goes stiff as a plank in whatever pose he's in. After five seconds he thaws, shivering with chattering teeth, and the frost falls off.
- **Bath time:** into the bath with a splash, bubbles and a rubber duck on his head. It washes him clean (soot, paint, pindakaas, sprinkles, stink), though he's wet for a while.
- **Spin cycle:** land him on the washing machine and it starts spinning, rattling and shaking him about, then flings him off, clean and dizzy.
- **Hot seat:** on the cooker's hob, smoke rises from his trousers, he yelps and jumps off it by himself.
- **Piano crash:** landing on the piano plays a jumble of keys, louder the harder he lands.
- **Pillow burst:** a hard landing on a bed bursts the pillow; feathers float down and some stick to him.
- **Stinky Lennie:** the cat litter, the wheelie bins or the bin bags leave him stinking for a while, with a green cloud and flies buzzing round his head.
- **Paint job:** crash into the paint tins in the garage and his hoodie comes out blue, green or white, with splotches all over him.
- **Brambles:** behind the trampoline, the thorns catch him and leave red scratches.
- **Cat attack:** toss Lennie close to the cat and it puffs up, hisses and pounces on him. It clings to him for a couple of seconds, claws going, leaving red scratches and tufts of fur while he squirms, then leaps off and runs for it. It needs a few seconds to calm down before it attacks again.
- **Hagelslag shower:** crash into the hagelslag pyramid and a box bursts, covering him in sprinkles.
- **Sticky pindakaas:** after the pindakaas pyramid he's sticky for ten seconds, and sticks to the next wall or shelf he hits for a moment.
- **Sinterklaas:** crash into the Sinterklaas stand and a mitre lands on his head while pepernoten rain down.
- **Scanned:** at a checkout, beep beep, and a price tag pops up.
- **Lamp post bonk:** a street lamp bonks him dizzy straight away, and the lamps flicker.
- **Trolley ride:** in the lone trolley by the doors, he rolls off along the shop window, and when it stops dead he's tipped out towards the tulips.

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
| Fix the windows, doors and TV, restock the shop, put the mess and the chairs back and Lennie downstairs | R |
| Watch the last toss again in slow motion | P (or the button on the score card) |
| Take turns with 2–4 players | The people button |
| Focus camera on Lennie | F |
| Camera follows Lennie (on at the start) | G |
| Cutaway (hide upper floors when looking down) | C |
| Slow motion | Z |
| Sound on/off | M |
| Full screen on/off (no browser bar sliding in at the top) | B (or the corners button); Esc also leaves it |
| How to play | H |
| Dutch or English | L (or the NL/EN button) |
| Close the help, a menu or a replay | Esc |

**Nederlands / English:** every text in the game (buttons, help, score card, challenges, the shouts that pop up) comes in Dutch and English. It starts in Dutch when the browser has Dutch among its languages, otherwise in English; the NL/EN button switches, and the choice is remembered in the browser. The shop signs and product labels in the supermarket are Dutch in both.

**First visit:** a hand over Lennie shows the pull (press on him, pull back, let go) over and over until the first toss. The full help is under the ? button (or H).

**On a tablet or phone:** pull Lennie back and let go to fling him (▲ ▼ for a higher or lower arc), drag empty space to turn the camera, and pinch or slide two fingers to zoom and move. In aim mode, tap a spot to see the flight path and tap it again to throw. The help screen shows the touch controls on a touch screen and the mouse and keyboard ones on a computer. On a phone held upright the score card comes in under the score, and the picture slides down so Lennie lies in view below it (it slides back when the card goes); on a phone on its side the card goes down the right-hand side, and the meter and the arc buttons move to the bottom edge, so the middle of the screen stays free.

The slingshot works like this: grab Lennie anywhere while he's lying down and pull back, away from where he should go. While you pull, a dotted arc shows exactly where he'll fly and a power bar fills: the further you pull, the further he goes. Pulling down (towards you) throws him into the picture, pulling left throws him right. The scroll wheel or the ▲ ▼ buttons make the arc higher or flatter without changing how far he lands, and the setting is kept for the next throw. A very flat or very steep arc can't reach as far; the power bar turns dark red when pulling further won't take him any further. A pull that's too short throws nothing. Grabbed in mid-air, Lennie isn't in the slingshot: he swings from your hand and a flick throws him again, for juggles.

In aim mode a dotted arc runs from Lennie to whatever you point at: a window, a doorway, a corner, the trampoline. It stops at the first thing in the way and the ring turns white when it won't reach, so you can see where he'll really hit. A click throws him along it with a little somersault. Aimed at a window or door that's still whole, he smashes straight through it and flies on: the arc carries on past it, with the ring where he'll end up and a small white ring on the window or door itself. Dragging still orbits the camera, and grabbing a limb still works as usual.

Walls, floors and the roof between the camera and the point it's looking at fade out automatically, so you can see Lennie anywhere in the house. Anything else between the camera and Lennie (a shelf, a freezer, the couch, a tree, a pile of fallen groceries) turns see-through in a soft circle around him (at least 70% of the screen across), and so does anything right in front of the lens, so he's never hidden. Nothing stops the camera itself: it can go inside furniture, trees, the garage and the neighbours' houses, and past the edge of the play area. Turning the camera goes no lower than eye level, so it can't dip under the floor.

The camera follows Lennie from the start, gliding along wherever he goes; G (or the camera button) turns that off. With it off, the camera stays put during a toss while Lennie is in view; once he's about to fly out of the picture (on a phone that's almost straight away), it chases him until he lands.

The game opens close up on Lennie with a "Grab me!" bubble over him, which stays until he's first picked up.

## Scoring

- **Contortion**: every joint (neck, spine, shoulders, elbows, hips, knees) is measured against standing up straight. A bit of bend counts as relaxed and is free; past that, points grow with the square of the bend.
- **Pose tricks**: Upside down, The splits, Pretzel legs, Straitjacket, Foot in face, and Human knot (any two of those at once). One crossed leg or one tangled arm is a small extra that doesn't count towards the knot.
- **House feats**: Defenestrated! (thrown out of the house), Hanging out the window! (high up, or draped over a living room windowsill), Kicked out of the shop! (thrown out of the supermarket), Fell N floors (a modest bonus, so rolling him off the roof isn't the easy way to a big score), Stair tumble/Full flight, Stranded on the roof! (the tiles are rough and the gutter along the edge catches him), Went shopping! (landed in the supermarket), On the supermarket roof!, Knocked products off the shelves (5 or more, 10 points each, up to 400), Board game avalanche! (3 or more games out of the closet, 20 points each, up to 500), Toy avalanche! (5 or more toys out of the TV cabinet, 8 points each, up to 500), Made the mess even worse (5 or more things in the house sent flying, 6 points each, up to 300), Smashed the dishes! (3 or more plates, bowls, mugs or glasses broken, 12 points each, up to 400), Broke the TV! (300), Electrocuted! (250 a shock, up to 3), Hit by a car! (500 a car, up to 3), Trampoline bounces.
- **Special effects** (once a toss each): Frozen solid! (400), Splash! (150), Spin cycle! (350), Hot seat! (300), Piano crash! (200), Pillow burst! (250), Stinky Lennie! (200), Paint job! (300), Scratched by brambles! (200), Hagelslag shower! (300), Sticky Lennie! (250), Stuck to the wall! (300), Sinterklaas hat! (300), Bonked a lamp post! (300), Trolley ride! (500), Cat attack! (350).
- **Landing spots**: where he comes to rest can earn a bonus, with Lennie saying something about it: in the bath, on either loo, on the desk, in the armchair, in the wash (on the washing machine), in either bed, on the beanbag or the toy box, on the dinner table, the kitchen counter, the bar or the piano, on the couch, in the cat litter, on the garage's junk pile or up on its camping shelf; in the supermarket in a freezer or a drinks fridge (through a smashed door, half in counts), on top of the freezers, the drinks fridges, the shelves, the bread rack or the cheese cooler, in the trolleys, in the fruit and veg, in the bread baskets, in the smashed pastry case or meat counter, behind the butcher counter, in the pindakaas, in the snack freezer, in the tulips, or scanned at a checkout; outside stuck in a tree, in the bushes, in the brambles, chilling on the lounge set, or napping on the trampoline.
- **Multiplier**: +0.1 per hard bounce, +0.25 per mid-air juggle (re-grabbing him while he's airborne), +0.3 per smashed window (the shop window and the freezer and fridge doors count too), +0.4 per smashed door, up to ×4.
- **Gentle toss**: a toss has to be a proper fling to score in full. When Lennie never got up to speed (letting him flop over after the tiniest pull), the score card says *Gentle toss* and only part of the score counts, down to a quarter. A pull of about a quarter of full power, or a good fall, is enough for all of it.
- A toss that's too gentle to count at all doesn't score.
- **Spots found**: the first time Lennie comes to rest in a landing spot, the score card says *New spot found!* with how many of them have been found so far, and the challenge list shows the count at the bottom. Remembered in the browser.
- The best score is remembered in the browser, so it survives a reload on the same computer.

## Challenges

Under the score there's always one challenge to go for, from easy ("Smash a window") to hard ("Put Lennie in the freezer", "Score 4,000 points in one toss"): 39 in all, including getting him attacked by the cat, sending him behind the butcher counter, getting him kicked out of the supermarket, throwing him in front of a car, knocking the board games out of the closet, smashing the TV cabinet's doors, freezing him solid, a trolley ride and sticking him to a wall with pindakaas. Doing one adds 300 points to that toss and brings up the next. A toss that happens to do other challenges that aren't up yet ticks those off too (without the bonus). *Skip* moves on and comes back to it later. Tap the challenge to see the whole list, with the ones already done ticked off, and pick any of them to go for next, done ones too. Progress is remembered in the browser. Challenges pause during a game of turns.

## Taking turns

The people button starts a game for 2–4 players, with their names (remembered for next time). Pick how many tosses everyone gets: 5, 10, 15 or 20 (5 at first, and after that whatever was picked last time); they go one after the other. Before each turn the house is fixed and Lennie goes back to sitting in the comfy chair in the living room, where the game starts, with the camera back looking over the room, so everyone starts the same way, and a card says whose turn it is, so the tablet can be passed on. A toss counts once Lennie has landed: grabbing him while he's still rolling ends that turn, and R and the drop keys wait until he's down, so a bad throw can't be undone. A board under the score shows everyone's total. After the last toss the winner is announced, with confetti in their colour, and *Play again* or *Back to free play*.

## Replay and reactions

Every toss is recorded. *Watch the replay* on the score card (or P) plays it back in slow motion with the camera following Lennie, from just before he's let go to where he lands, however long he was held first. A tap or a key stops it. A replay only plays when someone asks for it. The score card goes away by itself after a few seconds; the × in its corner puts it away at once, and then it stays away until the next toss.

A big toss (2,000 or more, about one toss in six) gets a burst of confetti where Lennie lands and a blue *Big toss!* sticker on the score card. A new best gets more confetti with gold in it, a gold *New best!* sticker and a little chime. Both make *Watch the replay* glow a few times.

Lennie reacts: a grin and a "wheee!" or "wa-hoo!" when he's flung, "ow!", "oof", "eek!" or "ouch" when he hits something hard, a groan when he lands, and after a good toss he lies there with crossed-out eyes, his tongue out and stars circling his head until he's picked up again. The stars come in a few styles (the classic yellow ring, a bobbing rainbow, two crossing rings like an atom, and a pink-and-gold ring that breathes in and out), and a good toss never shows the same one twice in a row. All sounds are synthesized; there are no audio files. To keep them from getting old, each surface sounds like what it's made of (wooden furniture knocks, the shop's shelves clang, hedges rustle, cushions puff), every sound has a few variations that never come twice in a row, and a sound that keeps repeating gets quieter.

## Low-end devices

The game is made to run smoothly on cheap tablets and older phones too. That's why there are no real shadows (Lennie has a soft spot under him instead, which grows and fades as he flies higher), why the shelves hold one row of products, and why the picture is drawn a little less sharp than a phone's screen could show. If a device still can't keep up, the game makes the picture a bit less sharp by itself, a step at a time. The panels are frosted glass only where there's a mouse (a computer): on a tablet or phone they're plain, because blurring what's behind them has to be redone every frame. And the physics only looks at the scenery near Lennie (`broadphase.js`), which more than halves its work.

The game opens on a title screen in pixel art (`src/splash.js`): a pixel Lennie flung out of his smashed bedroom window, tumbling along the aiming dots across the street and crash-landing at the supermarket for +850. It shows while the game loads (*Lennie is on his way…*), so a slow tablet doesn't sit there with an empty screen, and the pause while the game gets its first picture ready happens behind it too. Then a **Play!** button pops up, and a tap anywhere starts the game. Until then the game draws nothing behind it. The animation only moves and fades things, which the browser does without redrawing, so it keeps going while the game is being built. If the game can't start (no internet for three.js, or no WebGL) it says so. The tablet scripts (`scripts/tablet/`) skip the Play button: the title screen goes away by itself as soon as the game is ready.

## How it fits together

What you see of Lennie through all the walls and furniture comes from a few parts working together. A change to one of them can undo another (a hole in a ceiling, a flickering frame), so check the others when you touch one:

- **Floors (`house.js`):** each storey is its own group, and the roof is a fourth. The cutaway hides every storey above the one the camera looks at once the camera rises to that storey's ceiling, or comes within the near plane's 20 cm of it. The supermarket has no storeys.
- **Fading walls (`house.js`, `supermarket.js`):** every wall, floor slab and roof slope belongs to a *line*. A line fades when the sight line from the camera's target to the camera crosses it. From further than 5 m it stays as a faint ghost; with the camera closer it fades away completely (within 1.5 m), so it never lies over the picture like a grey haze.
- **The see-through circle (`seethrough.js`):** a few lines added to every scenery material's shader cut away what lies between the camera and Lennie, inside a circle around him on screen, plus anything within 45 cm of the lens. It never cuts below Lennie's middle, nor the ceiling over him while the camera is under it (`ceilingOver()`); otherwise you'd see the floor above.
- **The camera (`main.js`):** it draws nothing closer than 20 cm (its near plane), which keeps depth sharp enough that surfaces don't flicker. The see-through circle and the cutaway make sure nothing that close is ever needed.
- **Gluing (`batching.js`):** once everything is built, scenery that never moves is glued into a few big meshes, but only with its siblings in the same group, so hiding, fading and breaking keep working. Anything with `userData` stays separate. `flickercheck.js` notes every part down before the gluing.
- **From across the road (`house.js`, `supermarket.js`, `farview.js`):** while the camera's target is across the road (in the supermarket, mostly) and the camera is in front of the house too, the house is drawn as a cheap copy of its fixed parts: about thirty meshes in place of several hundred. The clutter and the loose furniture indoors aren't drawn then; the front's windows and doors stay themselves, so a broken one stays broken. Each storey is two groups for this: an outer one that the cutaway hides, and inside it the one everything is built in, which is switched off while the copy stands in. The supermarket does the same while Lennie is at home: a copy of its fixed parts, with the shop window's panes and the products as they are.
- **Aiming (`main.js`)** looks past whatever is hidden, faded or cut away, so you can aim at what you see.
- **Physics (cannon-es)** is built alongside the visuals but isn't the same shape: outside walls and the roof are thicker in physics, so a fast throw can't slip through them. Never work out one from the other.

Each frame, `main.js` moves the camera first, then lets the house and the shop decide what to hide and fade, then points the see-through circle at Lennie, then draws.

## Files

- `index.html`, `style.css`: the page, toolbar, score panel, challenge, players board, turn card and help, with the layouts for a computer, an upright phone and a phone on its side; the loading message; the import map that loads three.js and cannon-es
- `src/main.js`: scene, input (mouse and touch), camera, toss state machine, breaking glass and doors, landing spots, putting Lennie back when he leaves the play area, HUD, challenges, taking turns and the replay controls
- `src/house.js`: the house (walls with windows and breakable doors, floors, stairs, the row's roof, furniture), plus cutaway and wall fading
- `src/drawings.js`: the kids' drawings and paintings on the living room walls and the framed photos of friends in the toilet, all drawn on one canvas, the medieval town painting behind the dining table, and the kitchen whiteboard's week schedule (always in Dutch, like the supermarket's signs)
- `src/tv.js`: the living room TV in its corner, its screen cracking where Lennie hits it, flickering and sparking
- `src/zap.js`: Lennie getting electrocuted: the X-ray skeleton, lightning, the blue flash, the spasms, soot and smoke
- `src/effects.js`: the other special effects (frozen, bath, spin cycle, hot hob, piano, pillow, stink, paint, brambles, hagelslag, pindakaas, Sinterklaas, checkout, lamp post, trolley ride): where each one goes off, the little bits and puffs (one InstancedMesh each, so they cost two draw calls at most), the rubber duck and the mitre, and tinting Lennie's colours
- `src/trolley.js`: the lone shopping trolley by the supermarket's doors, which rolls off with Lennie in it
- `src/loose.js`: furniture Lennie can knock over (the dining chairs, the piano stool, the small round tables, the bikes and the moped), which rests ("sleeps") when it stands still so it costs nothing
- `src/clutter.js`: the mess in the house (dishes, toys, clothes, household stuff), the board game closet, the TV cabinet with its breakable doors and toys, the toy cabinet beside the piano, the kitchen's hanging cupboard with its breakable glass doors and crockery, the utility room's fridge with its doors that fly off and its food, the Kallax full of shoes, the coats on the two coat racks (just decoration), the plants and the coffee machine on the counters, the storage cupboard stuffed with junk that pours out when its door is smashed, the stuff in the garage, and sending it flying when Lennie lands in it
- `src/street.js`: the neighbour houses, and the details every house in the row shares (porch, chimney, dormers, skylight, roof window, vents, solar panels, downpipe)
- `src/yard.js`: sky, lighting, lawn, the play area's (invisible) edges, the neighbours' garden trees, the front gardens' path, bushes and hedge
- `src/garden.js`: Lennie's back garden: fences and gate (the end of the map at the back, with the fence closing off the row's far left end), lounge set and its canopy, trampoline, the brambles behind it, tree, wheelie bins, the junk by the back fence and bushes (the garage is a room of the house, in `house.js`)
- `src/bikes.js`: the bikes and the moped parked along the back garden's bushes, which Lennie knocks over (as loose pieces, `loose.js`)
- `src/streetscape.js`: the street in front: cycle path, verge trees and lamps, and the road
- `src/cars.js`: the cars driving by: a few low-poly cars built once and reused, on physics bodies that only ever touch Lennie, braking and honking for him when he's in the road
- `src/cat.js`: the family's cat: built from a few merged, vertex-coloured meshes, walking a little network of paths through the house and garden (and the cat flaps), resting, and attacking Lennie when he's tossed near it
- `src/supermarket.js`: the supermarket across the road, inside and out (the breakable shop window, aisles, freezers and fridges, the bakery, the sloping veg stand, the cheese cooler, the pindakaas and hagelslag pyramids, the butcher's counter and the other displays), with its own fading walls and roof
- `src/seethrough.js`: the see-through circle that keeps Lennie in view through whatever is between him and the camera
- `src/shading.js`: the simple shading (no shine) the scenery gets on a device that can't keep up
- `src/batching.js`: once everything is built, glues the scenery that never moves into a few big meshes, so there's far less to draw
- `src/farview.js`: makes the cheap copies of the house and the supermarket that are drawn while they're seen from across the road: the parts' colours go into their corners, so everything without a picture is one mesh
- `src/broadphase.js`: the physics' bookkeeping done the cheap way: only the scenery near Lennie is tested for bumps, only the pairs that touch are remembered, and only the bodies that can move are solved for, which changes nothing in the game and takes away most of what a physics step costs
- `src/blobshadow.js`: the soft dark spot under Lennie (the game has no real shadows, so it stays smooth on low-end tablets)
- `src/flickercheck.js`: when the game runs on your own computer (localhost), lists any spots where two surfaces lie in the same place and would flicker, in the browser console
- `src/products.js`: the groceries: every product's shape and packaging, what goes on which shelf, and knocking them off and restocking (the house's mess uses the same tumbling, and its plates, mugs and glasses smash into shards there)
- `src/pictures.js`: keeps every picture the game draws in memory only once: its canvas is let go of as soon as the graphics chip has the picture, and it's drawn again when it's needed again (a weak tablet now and then asks for everything anew)
- `src/textures.js`: procedural textures (brick, roof tiles, window panels, cartoon glass, wallpaper, grubby white paint with the kids' handprints and crayon, wood, floor tiles, grass)
- `src/ragdoll.js`: Lennie's bodies, joints, muscle tone (joints that ease into their limits instead of slamming into them, a loose floating pose while he flies, and arms and legs flung about at a launch) and look (1.90 m and 100 kg, with a bit of a belly, in a worn hoodie, joggers and trainers; shaped arms and legs that stay closed at the elbows, knees, shoulders and hips however he's bent, and hands with fingers; his face after the photo in docs: thinning dark hair receding at the temples, rectangular glasses and a short salt-and-pepper beard)
- `src/scoring.js`: contortion measurement, trick detection and the multiplier, and how much of the score a gentle toss keeps
- `src/challenges.js`: the list of challenges and the progress kept in the browser
- `src/splash.js`: the opening screen's pixel art (Lennie, his street and the supermarket, drawn from little maps of letters, one a pixel) and its texts in both languages; a plain script rather than a module, so it's on screen before the game has loaded
- `src/i18n.js`: Dutch and English: the Dutch version of every text (the game's code is written in English; a new text needs its Dutch version added here), switching between them, and putting `index.html`'s own texts in the chosen language
- `src/replay.js`: records each toss (and the chairs he knocks over) and plays it back in slow motion
- `src/guard.js`: safety net that puts Lennie back in one piece if a limb ever ends up inside a wall or floor
- `src/audio.js`: synthesized sound effects and Lennie's voice
- `src/cursors.js`: the cartoon mouse pointers: a glove that opens over Lennie and closes into a fist while you hold him, and a target in aim mode
- `tests/check.mjs`: quick code check (modules parse, imports resolve, files linked from `index.html` exist), run nightly by `.github/workflows/ci.yml`

## License

Copyright (C) 2026 Klaboukes

Toss the Lennie is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License](LICENSE) as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; see the license for details.

three.js and cannon-es are separate projects under the MIT License.
