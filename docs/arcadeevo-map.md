# ArcadeEvo's town: what's there, and where it goes

The starting point for VerseCraft is the Ys-style town in **ArcadeEvo** (GitHub `xoxide101/MS_PacMan_xC`, made with AI Studio).
This page maps how it works, what we keep, and what we rebuild. Nothing here is final: "we may rip it apart".

## The files

| File | Lines | What it does |
|---|---:|---|
| `lib/game/ysWorldBuilder.ts` | 4,005 | The world as data: zones (town, plains, shrine, tower, interiors…) built from tile grids, plus lists of buildings, people, chests, shrubs, signs, forage spots, crafting stations, boats, doorways. The towns themselves are written as code (one function is 2,200 lines). |
| `lib/game/ysThreeWorldRenderer.ts` | 9,357 | Turns a zone into 3D with Three.js: ground and terraces, water, buildings, trees, grass, lamps, birds, market stalls, people at tables, clouds and cloud shadows, sun and night, weather, the camera. One function (building a zone) is 1,900 lines; drawing a frame is 1,100. |
| `lib/game/ysBookRpgGame.ts` | 5,826 | The game: player movement, people's routines, talking, searching shrubs, chests, shops, crafting, enemies, time and weather, music choice, the HUD and map drawn on top in 2D. |
| `lib/game/ysThreeCharacterRig.ts` | 1,229 | People and monsters built from shapes: heads with painted faces, hair, capes, armour, jointed arms and legs. |
| `lib/game/musicEngine.ts` | 3,470 | Music made live with Web Audio oscillators (no recordings), a track per place and time. |
| `lib/game/ysPixelAtlas.ts`, `rpgJsSpriteAtlas.ts` | 947, 2,818 | The 2D portraits and sprites, and the age-group helper. |
| `lib/game/ysAcousticSfx.ts` | 294 | Sound effects. |
| `lib/game/ysMuleGame.ts`, `muleGame.ts`, `muleEvoGame.ts` | 919, 1.5k, 2.4k | The M.U.L.E. games and the Ys × M.U.L.E. mix: the economy / colony reference. |
| `lib/game/gauntlet3d/*`, `gauntletDarkLegacyGame.ts`, `gauntletGame.ts` | ~6k | The Gauntlet builds: their own separate engine, the dungeon reference. |

Built on: Next.js + React, **Three.js r187 (WebGL)**, everything made in code (no model files, no recorded music).

## How it fits together

1. **World builder** makes each zone: a grid of 10 tile codes (ground, wall, tree, water, bridge, roof, road, torch, flowers, landmark) and lists of things placed on tiles.
2. **The game** runs every frame: moves the player and the people, ticks time and weather, handles talking and searching, picks the music, draws the HUD.
3. **The renderer** builds the 3D scene when you enter a zone, then each frame moves the camera, the sun, the people's rigs and the weather.

## Part by part: keep, change, rebuild

### Camera: KEEP (this is much of the feel)
- Rotates around the player (yaw), tilted about 37°, four distances: close-up, "Evo 2.5D", wide vista, full map, plus a zoom scale.
- Smooth, damped follow; screen shake.
- **The talk zoom:** when you talk to someone, the camera drops to eye level (about 7 units away) and frames both of you, between the player and the speaker. Exactly the touch to keep.

### Time and weather: KEEP, then widen
- Now: 24-hour day, 7-day week, 1 game hour = 45 seconds, dawn/morning/afternoon/evening/night, market days (Sun, Wed, Sat).
- Weather: clear, breezy, rain, storm (lightning, thunder, shake), snow; a wind compass that drifts.
- Missing (from our list): **months, a year, seasons (1/2/4/8/12 per world), hours per day per world**. Becomes the **Calendar** part.

### Terrain: REBUILD (TerrainCraft)
- Now: heights are formulas per zone type. Towns get three terraces (waterfront, plaza, upper) at fixed fractions; plains get a slope and gentle rolls; the coast depth is fixed to one town's position.
- Can't be painted, can't hold caves under towns, tower floors, cliffs.
- **New:** a real height map you shape (flat, slopes, hills, cliffs, terraces, coasts), with ground materials painted on, and layers for under and over.

### Placing things: KEEP the idea, generalise (MapCraft)
- Now: buildings (8 building styles, 4 roof colours, signs), people, chests, searchable shrubs, signs/statues/wells and 16 kinds of things to inspect, forage spots (herbs, berries, ore, timber, relics), crafting stations (forge, alchemy, cooking), boats, doorways with flags and locked messages.
- **New:** one general "thing placed in the realm" with a kind, either **engine-made** (generated: trees, grass, simple buildings) or **custom** (a model from 3DCraft). Same lists, as data files, not code.

### People: KEEP the behaviour, widen (the Cast)
- Now: roles (quest, shops, inn, villager), ages (adult, child, elder), 13 jobs (sweep, carry water, garden, hammer, carry crates, patrol, fish, play, serve, read, stroll, bake, craft), routes with stops and activity labels, moods (wave, chat in pairs, stretch, look around, hop, shelter from rain), heads turning to follow you, a bounce when they hop, shelter at night and in rain.
- Missing (from our list): **main characters 1/2/4, infants, ageing, routines by hour and day** (now routes loop the same all day).
- Rigs are built from shapes (where the "cute" look comes from); keep as the engine-made option, add custom models.

### Buildings and interiors: KEEP
- Each building can have an interior zone you walk into through its door (shop, inn, library, guild, tavern…).
- Later option: interiors in the same space (roof lifts away) as well as separate rooms.

### Living details: KEEP
- Birds, grass tufts that move, foliage and water and cloth shaders, cloud shadows, market stalls, wagons, street lamps, people eating and playing games at tables.

### Gathering and crafting: KEEP, grow into the sandbox
- Forage spots that respawn, a bag, recipes at forge / alchemy / cooking stations, shops.
- Grows into: more resources, more stations, building in the world.

### Music: CHANGE
- Now: synthesized tracks by place and time (town, night nocturne, plains, tower, shrine).
- **New:** real recordings in layers (piano alone, strings at dusk, tension, battle), crossfaded on the beat. Keep the rule "choose by place and time".

### HUD and map: KEEP the layout, rebuild as HTML
- Character card, minimap, view panel, clock, compass with wind, quest line, quick bar, dialogue box with portrait.
- Fix: labels piling up, portrait over the panels.

### Economy and colony (M.U.L.E.): ADD as a layer
- Land plots, production, trading, auctions: the town's economy and the colony layer (help the town → it helps you win).

## What's tied to the old game (gets renamed or dropped)
Character names, places, the books story and its flags, portraits, the zone list. The characters come across renamed, keeping their jobs and routines.

## Why it's hard to grow
- Giant functions (1,900 and 1,100 lines): a change in one place breaks another.
- Only 10 tile kinds; heights by formula; towns written as code.
- Every model made from shapes in code; no post-processing (no drawing styles).
- Each game has its own engine (the Gauntlet 3D engine shares nothing with the town).

## The start point

`realmcraft/` in this folder, small files, one job each:

| Part | Brings from ArcadeEvo |
|---|---|
| `core`: loop, game logic apart from drawing (for co-op and servers later) | the step / render split |
| `calendar`: hours per day, days, weeks, months, seasons, years | time, periods, market days |
| `terrain` (TerrainCraft) | the town's terraces, coast and water as a first height map |
| `map` (MapCraft): things placed, engine-made or custom | the town layout, as a data file |
| `cast`: players, people, ages, jobs, routines by time | jobs, routes, moods, head tracking, sheltering |
| `view`: renderer, camera, sky, weather, foliage and water | camera and talk zoom, sky, shaders |
| `play`: walking, talking, searching, gathering | interactions and dialogue |
| `hud` | the HUD layout |

Order: **camera + terrain + the town as data** → people and routines → talking and the talk zoom → time, weather, music. After each step, compare side by side with ArcadeEvo.
