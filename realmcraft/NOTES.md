
## Age and weather (2026-11-24)
- js/rc-aging.js: RC.age(material, {kind, base, top, seed, brick}) gives a wall its own height map (picture light/dark as relief, cracks, fallen plaster showing brick), grime and damp from the ground, moss, rain streaks. Foundations of small stone blocks, boarded shutters (worn paint), window boxes with trailing plants, ivy, rose trellises, weeds at the wall foot, chimney smoke (GPU puffs, on and off; the forge always), drips off the eaves (by uRain), mounds (molehills, sandy heaps, earth).
- Walls belly and lean a little; roofs sag; windows: dark room, curtains, glass pane with sky in it, deep frame; doors of boards, stone steps, sometimes a hood.
- Ground: terrain.rough() bumps (cm on roads, more in the wild; never below the sea level), mesh 3 squares per cell; cobbles with sunk/missing stones and sand in the joints; bare sandy patches; grass in tufts, broader blades.
- Weather: sim.cloud, sim.precip (waves on top of a slowly built base), sim.snowfall; next weather grows from the last; HUD says drizzle … downpour.

## Townsfolk (2026-11-24)
- Bodies: tools/folk/make_folk.js writes human specs (man, man_stout, woman, woman_long, elder_m, elder_f, boy, girl) and compiles them with the anyCreature engine (MIT, vendor/anyCreature, not committed here) into one smooth skinned mesh each, with idle and walk clips; packed as assets/folk/*.js (GLB data URLs, file:// safe). ~2-3k vertices, ~200-250 KB each.
- js/rc-folk.js: loads a body per person, recolours skin/hair/clothes (steady per person), adds belt + buckle, buttons, collar, cuffs, or sash + lacing for dresses (measured on the body's trunk). js/rc-folkhead.js: heads in code (shaped skull, nose, lips, ears, eyes with lids that blink, brows, hair styles with smooth hairlines, beards, hats: straw, cap, helmet, coif).
- rc-cast.js folkRig: mixer weights idle/move by speed, job poses laid on the bones, props in the right hand, player cape and sword, baby in arms. RC.settings.folk = false falls back to the old figures. lab/folk.html shows all bodies (Walk, Idle, Close, Far; FOLK.face(i)).
- People step round solid circles (fountain, well) and stop at the rim if a route point is inside one.
