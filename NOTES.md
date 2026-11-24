# VerseCraft

A way to tell any story by letting people walk into it: fairy tales, books, board games, history, games from any year (text or not).
Runs in the browser on phones, tablets, computers and consoles. Local git only for now (no GitHub until the owner says so).

## The layers
| Layer | What it holds |
|---|---|
| **Craft Workbench** | The whole: the Craft apps make the materials (3DCraft models, ImageCraft textures and sprites, LogoCraft crests and signs, ClipArtCraft library, fonts, PressCraft books and maps, music later). |
| **StoryCraft** | The words: stories, storylines, characters, books, lore. |
| **TaleCraft** | The story made playable: quests, scenes, conversations, battles. |
| **RealmCraft** | A world: terrain, places, people with lives, time, weather, music, the look. |
| **VerseCraft** | Realms joined: worlds within worlds, shared servers, many players. |

Each layer needs the one before it; each is its own module with its own data format.

## What the engine must do
- **Views** that flow into each other: top-down, angled 2.5D, over the shoulder, first person, side-scrolling sections; rotate and zoom; talk zoom.
- **Realm basics:** a cast (players 1/2/4, important people, townsfolk; infants, children, adults, elderly; ageing), a calendar per world (hours per day, weeks, seasons 1/2/4/8/12, years), TerrainCraft (flat, slopes, cliffs, coasts, caves) and MapCraft (things placed, engine-made or custom).
- **Living worlds:** jobs and routines by time, weather and wind, birds and plants.
- **Systems you switch on:** gear (swords, shields, armour, magic) as data, gathering, Minecraft-like crafting and building, loot and collectables, growth, quests, economy (M.U.L.E.).
- **Battles:** in the world or cut away to a battle scene (Archon); real time or turns; Gauntlet dungeons (darkness, spawners, swarms, doors and keys); a pacing director against boredom.
- **Layers of scale:** what you do as one person decides what you command (RTS: town, colony, fleet; Armada later).
- **Players:** solo like the classics, 2 or 4 on one screen or online, later a server world.
- **Looks:** switchable drawing styles (painterly, ink and paper, watercolour, cut-out, sprites in 3D, hatching); hand-drawn maps.
- **Music:** real recordings in layers that follow place, time and tension (piano in town).
- **An editor** with a command layer, so people (and AI) build without code.

References (styles and ideas only): Ys (TurboGrafx-16 CD), Gauntlet 1/2/Dark Legacy, Sierra AGI/SCI, Ultima, Archon 1/2, M.U.L.E., Ori, Kena, The Last Campfire, Zelda, Xenoblade, Armada 1/2. Not liked: Pokémon's look.

## Start point
ArcadeEvo's town (see [docs/arcadeevo-map.md](docs/arcadeevo-map.md)): first match it side by side in RealmCraft, then grow.
