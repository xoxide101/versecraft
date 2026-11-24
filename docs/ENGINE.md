# RealmCraft engine: how it works (save point, 2026-11-24)

RealmCraft is the world layer of VerseCraft: one realm (Wrenhaven Town & Harbor) you walk around in the browser.
It is plain JavaScript files loaded by `realmcraft/index.html` in order, all hanging off one object, `window.RC`.
No build step and no server. It opens straight from the folder (`file://`), so pictures, skies, models and fonts are
packed into `.js` files as data URLs; nothing is fetched at run time.

Graphics: three.js 0.186, bundled with esbuild into `realmcraft/lib/realm-libs.js` (THREE plus GLTFLoader,
EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, Sky, HDRLoader, BufferGeometryUtils).

---

## 1. Running it

- Open `realmcraft/index.html` in Chrome or Edge (double-click works).
- Keys:
  - **Moving:** WASD to move, Shift to run, Space to talk or use.
  - **Camera:** Q/E turn 90°, drag to turn and tilt (or PgUp/PgDn), mouse wheel or `[` `]` to zoom, V for the view, R to face north.
  - **Time and weather:** T moves time on 3 hours, G changes the weather.
- URL options:
  - **Detail tier:** `?quality=low|mid|high`.
  - **Grass density:** `?grass=0.6`.
  - **Old figures:** `?folk=0` brings back the old jointed figures instead of the new people, to compare.
- Labs, to look closely at one part (open them the same way):
  - `lab/flora.html`: trees.
  - `lab/shrubs.html`: shrubs and mushrooms.
  - `lab/covers.html`: the 36 ground covers.
  - `lab/paths.html`: HD path textures.
  - `lab/folk.html`: the people (Walk / Idle / Close / Far; `FOLK.face(i)` in the console).

## 2. The loop

`rc-main.js` boots:
1. It picks a **quality tier** (rings, pixel ratio, shadows, grass), from the device or `?quality`.
2. It makes the **sim** (`RC.Sim`, rc-play.js) and the **view** (`RC.View`, rc-view.js).
3. It runs a fixed-step loop: the sim at 1/60 s, the view once per frame, dt capped at 0.25 s.
4. While the frame rate stays under 40, it shrinks the detail rings.

The sim never touches three.js. The view reads the sim and draws it.

### The sim (rc-play.js)
- **People:** players and townsfolk, stepped with `RC.Cast.step`.
- **Calendar:** `RC.Calendar`, the clock and seasons.
- **Weather:**
  - It is never just on or off. `cloud` gathers first, then `precipBase` builds slowly.
  - `precip` rides on top of that in waves (slow swells plus quick bursts).
  - Snow works the same way with `snowfall`.
  - The next weather grows out of the current one (clear → breezy → rain → storm and back).
  - `weatherWord()` names it for the clock box: drizzle, light rain, rain, heavy rain, downpour.
- **Lying water and snow:** `lying.wet` and `lying.snow` build by how hard it is coming down and fade afterwards (rc-weathering.js).
- **Wind:** direction and speed, with gusts that follow the same waves.
- **Using things:** Space finds the nearest usable thing within reach and runs its action.
  - **Read:** signs and noticeboards.
  - **Search:** shrubs.
  - **Open:** chests (the lid swings up on its hinges).
  - **Gather:**
    - takes the fruit and leaves the plant: berries, flowers, mushrooms and crystals disappear;
    - they grow back after 4 minutes, ore after 10.
  - **Ring:** the bell.
  - **Talk:** people.
- **Regrowth:** a list of picked things and the time each comes back.

### The view (rc-view.js)
- **Renderer and effects:**
  - **Render:** ACES tone mapping.
  - **Sky:** a Sky shader with stars, five Poly Haven HDRI skies for light and reflections, chosen by time and weather, their strength following the sun.
  - **Post-processing:** ambient occlusion (GTAO) that skips see-through leaf cards, and bloom by night.
- **Camera:** angled 2.5D, follows you, turns, tilts and zooms; it zooms in from the side when you talk to someone.
- **See-through:** your own figure shows as a glowing outline through anything in front of it (`RC.settings.seeThrough`).
- **Weather drawing:** rain streaks and snow, as many as the sim's amounts say.
- **People:**
  - each is placed every frame;
  - near people (within 14 m of the camera) get full animation, face details and cloth textures;
  - far people animate every 4th frame, without face details, in plain colours.

## 3. The map (data/wrenhaven.js)

One realm is one data object in `window.RC_REALMS`:

| Key | What it holds |
|---|---|
| `id`, `name`, `subtitle` | names |
| `w`, `h` | size in cells (1 cell = 1 m; Wrenhaven is 104 × ~75) |
| `calendar` | `hoursPerDay`, `hourSeconds` (real seconds per game hour), `days`, `marketDays`, `months`, `seasons`, `start` |
| `terrain.paint` | one string per row, one letter per cell: `.` grass (kept), `,` wild grass, `-` road, `T` forest, `~` sea, `=` pier |
| `terrain.legend` | what the letters mean |
| `terrain.shape` | height steps: `terrace` (higher north of a line, soft edge), `sea` (sea floor, deepening) |
| `terrain.stream` | the brook: `path` [[x, z]…] downstream, `reach` [[z, half-width, stone 0..1]…] (stone 1 = a dressed-stone channel, 0 = natural banks; a wide reach is a pond), `bridges` [{z, width, kind: 'arch' or 'plank'}] |
| `things` | everything placed: `{kind, x, z, …}` (below) |
| `doors` | ways out of the map: `{x, z, w, to, label}` |
| `people` | the cast: `{id, name, role, age: infant/child/adult/elder, job, at: {x, z}, route: [{x, z, wait, work, doing}…], look: {tunic, cloak, hair, skin}, says: […], speed (m/s), carries}` |
| `players` | 1, 2 or 4: `{id, name, title, at, look}` |

### Kinds of thing (rc-map.js makes each)
- **building:**
  - **Fields:** `{x, z, w, d, style, roof, name, door: {x, z}, chimney}`.
  - **Styles:** `one_story_cottage`, `two_story_timber`, `smithery_foundry`, `observatory_parlor` (tower), `grand_guildhall` (columned porch), `l_wing_inn` (wing), `apothecary_conservatory` (glasshouse), `longhouse_tavern` (barrels).
  - **Roof colours:** `roof` is `crimson`, `terracotta`, `cobalt` or `emerald`.
- **lamp:** cast-iron street lamp with a glazed lantern and a candle, lit at night.
- **fountain, well, statue, bell, telescope, anvil, campfire, tablet, bookshelf**
- **sign, noticeboard:** `title` and `lines` are the words drawn on them, readable from both sides.
- **crates, dock_cargo**
- **chest:** `reward` and `amount`. In the water, it sits on a rock with stepping stones out to it.
- **shrub:** `variant` (berry, fern, blossom, frost_bush, ember_fern), `hidden` (gold, herb, seed, clue, slime, quest_item).
- **forage:** `node`: herb_patch, berry_bush, iron_vein, silver_vein, timber_pile, fruit_tree, mushroom_ring, beehive_log, relic_scrap, or mushroom (with `mush`). `name`, `amount` and `use` say what you get.
- **station:** `station` is forge, alchemy (bubbling cauldron) or cooking (kettle on a tripod).
- **boat:** `{x, z, hull, sail, facing}`; it ties up along the nearest pier.

Shrubs and forage that fall in the brook or on a bridge are moved to dry ground when the map is read (`MapCraft.plan`).

### What blocks walking (`RC.MapCraft.plan`)
- **Solid cells:** building cells, water, forest and lake letters.
- **Solid circles:** things in `SOLID` (fountain 1.95 m, well, statue, noticeboard…).
- **Water:** the brook blocks, except on bridges and stepping stones.
- **People's routes:** they bend round solid circles. If a stop on a route is inside one, they stop at its rim.

## 4. The land (rc-terrain.js and friends)

- **Height:** `land(x, z)` is the shape steps, plus `rough()` (a few cm on roads, more on grass, most in the woods; never below sea level), minus the brook's channel. `groundY` also follows pier and bridge decks and stepping stones.
- **Ground picture:**
  - **Base:** a painted grass texture.
  - **Splat shader:** blends four real textures by a data map: cobbles (HD, with parallax depth), dirt, forest floor, sand.
  - **Cobbles:**
    - town roads are cobbled, a dirt track beyond the town;
    - some stones are missing or sunk, with sand in the joints;
    - edges are ragged, with grass in the gaps.
  - **Bare ground:** sandy bare patches in the rough grass.
- **Ground cover** (rc-covers.js recipes, rc-groundcover.js placement):
  - **Placement:** 8 × 8 m chunks in near and mid rings.
  - **Types:**
    - lawn and meadow in tufts;
    - wild grass and wildflowers;
    - tall grass against walls and posts;
    - reeds at the water, forest floor and ferns.
  - **Movement:** wind gusts roll across, and rain weighs the tips down.
- **Trees and shrubs** (rc-flora.js):
  - **Species:** oak, maple, birch and pine, instanced, with leaf cards and solid cores.
  - **Life:** they sway in the wind and change with the seasons.
  - **Shrubs:** branchy, plus rocks.
- **Mushrooms** (rc-mushrooms.js): eight kinds in clusters, shelf fungus on pine and oak trunks.
- **Water** (rc-water.js):
  - **Surface:** waves by the wind, sky reflections.
  - **Depth:** clear shallows, dark deep water, foam at the shore.
  - **Rain and life:** rings where raindrops land, water lilies, a fish jumping now and then.
- **The brook** (rc-stream.js):
  - **Channel:** a smoothed path; the land is cut to fit.
  - **Water:** flows downstream, clear at the edges, foam in flecks; stones break the surface with white water and wakes.
  - **Bridges:** stone arches with parapets; humped plank footbridges with rails.
  - **Banks:** a pond in the woods, rocks and ferns along the banks.
- **Piers** (rc-pier.js): plank decks with a ramp from the land, stringers, posts, braces, bollards.
- **Boats** (rc-boats.js):
  - **Hull:** lofted and planked, with a gunwale, stem and keel.
  - **Inside:** floorboards, thwarts, ribs, oars and a rudder.
  - **Rigging:** a mast with the sail furled on its boom, and stays.
  - **Moored:** tied up along the piers with lines and fenders; they ride the swell.
- **Horizon** (rc-horizon.js): rings of forest, hills and mountains, a landmark tower, the sea and islands, hazed toward the sky colour.

## 5. Buildings (rc-map.js, rc-aging.js, rc-signs.js, rc-props.js)

- **Walls:** stucco, timber-framed, brick, stone, or layered (stone or brick below, timber or stucco above); bellied and leaning a little.
- **Ageing** (`RC.age`, a shader):
  - **Relief:** the texture's own height.
  - **Damage:** cracks, fallen plaster showing the brick under it.
  - **Dirt:** grime and damp rising from the ground, moss, rain streaks under the eaves.
  - **Roofs:** moss and a little lichen.
- **Roofs:** real tile textures, sagging slopes, ridge caps, eave boards.
- **Gables:** stucco with an oak frame, a trim board at the foot and barge boards along the edges.
- **Stone parts:** stone-block foundations, and stone chimneys with smoke now and then (the forge always).
- **Doors and windows:**
  - **Doors:** on the floor level, with two stone steps up; plank doors in deep stone or oak frames, strap hinges, sometimes a hood.
  - **Windows:** a dark room, curtains and glass in a deep frame; board shutters with worn paint.
  - **Window boxes:** trailing plants.
- **Growth:** ivy, climbing roses on trellises, weeds at the foot of the walls.
- **Shop signs:**
  - **Board:** painted on both faces, the shop's name and a picture.
  - **Hanging:** an iron bracket, or on columned buildings the porch beam.
- **Columned buildings:** a porch: columns between the openings, a beam, a tiled lean-to roof.
- **Glasshouse** (herbalist): brick base, glazing bars, glass roof, staging and pots; on whichever side is clear.
- **Things about town** (rc-props.js):
  - **Containers:** barrels, crates, sacks, an iron-bound chest.
  - **Fire and cooking:** the alchemist's bubbling cauldron, the kettle on its tripod, a campfire with flames.
  - **Other:** a stone well with winch and roof, an anvil on a stump.
- **Rain from the roofs:** drips fall off the eaves while it rains.

## 6. People (tools/folk, rc-folk.js, rc-folkhead.js, rc-cast.js)

- **Bodies:**
  - **How they're made:** `tools/folk/make_folk.js` writes a human spec for each body and compiles it with the anyCreature engine (MIT) into one smooth skinned mesh, with an idle and a walk clip.
  - **Body types:** man, man_stout, hero (coat), woman, woman_long, elder_m, elder_f, boy, girl.
  - **Output:** `assets/folk/*.js`, about 2–3k vertices each.
  - **Rebuilding:** needs `vendor/anyCreature` next to `realmcraft` (`git clone https://github.com/Ariescar/anyCreature vendor/anyCreature`). The vendor folder is not committed.
- **Heads** (rc-folkhead.js), built in code:
  - **Face:** a shaped skull, a sculpted nose, lips and ears.
  - **Eyes:** white, iris and pupil, with lids that blink.
  - **Hair:** brows, hair styles with smooth hairlines, beards.
  - **Hats:** straw, cap, helmet, coif.
  - **Pieces:** each head is merged into a few meshes.
- **Clothes** (rc-folk.js):
  - **Colour:** each person's skin, hair and clothes are picked steadily from who they are, and their look colours are toned into dyed cloth.
  - **Textures:** woven cloth, wool, leather and skin, laid on from three sides by the body's rest pose, with folds and wear. Near people only.
  - **Details:** belt and buckle, buttons, collar and cuffs, or a sash and lacing on dresses.
  - **The hero:** a baldric and a sword at the hip.
- **Behaviour** (rc-cast.js):
  - **Daily life:** routes with waits and work.
  - **Weather and night:** they head home at night (hidden) and shelter by a door in the rain.
  - **Reacting to you:** they turn their heads to follow you, wave when you come near; children hop.
  - **Jobs:** poses laid on the bones (sweeping, hammering, gardening, fishing, reading, serving, carrying, patrolling), with tools in the right hand.
  - **Walking:** speed by age, and they walk round the fountain and the well.

## 7. Files

| File | What it is |
|---|---|
| `js/rc-core.js` | RC helpers (hash, noise, fbm, damp), input, AO skip for leaf cards |
| `js/rc-main.js` | quality tiers, settings, boot and loop |
| `js/rc-calendar.js` | the calendar |
| `js/rc-terrain.js` | land height, ground picture and splat shader, sea |
| `js/rc-stream.js` | the brook, pond, stones, bridges, stepping stones |
| `js/rc-textures.js` | `RC.Tex`: packed real textures plus drawn bark, leaves, surfaces |
| `js/rc-flora.js`, `rc-mushrooms.js`, `rc-covers.js`, `rc-groundcover.js` | plants |
| `js/rc-horizon.js`, `rc-water.js`, `rc-pier.js`, `rc-boats.js` | scenery and harbour |
| `js/rc-aging.js`, `rc-signs.js`, `rc-props.js`, `rc-map.js` | buildings and things (`RC.MapCraft`) |
| `js/rc-weathering.js` | wet, puddles and snow on every material |
| `js/rc-folkhead.js`, `rc-folk.js`, `rc-cast.js` | people |
| `js/rc-play.js`, `rc-view.js`, `rc-hud.js` | sim, view, on-screen panels |
| `assets/tex`, `assets/sky`, `assets/folk` | packed textures, HDRI skies, people bodies (see `assets/tex/CREDITS.md`) |
| `tools/` | `fetch_textures.py`, `fetch_skies.py` (Poly Haven, CC0), `from_arcadeevo.py` (map converter), `folk/make_folk.js` |

## 8. Notes for whoever works on it next

- **Shader names:** a material's shader changes must stay part of its program name (`customProgramCacheKey`). Otherwise two different materials share the wrong program, and trees drew wrong because of that once.
- **Check what changed:** look at `git status` before starting. A second coding tool (GitHub Copilot) has edited these files at the same time before.
- **Testing:** test the way it's used, opened from the folder (`file://`). Don't fetch bundled files.
