
## Age and weather (2026-11-24)
- js/rc-aging.js: RC.age(material, {kind, base, top, seed, brick}) gives a wall its own height map (picture light/dark as relief, cracks, fallen plaster showing brick), grime and damp from the ground, moss, rain streaks. Foundations of small stone blocks, boarded shutters (worn paint), window boxes with trailing plants, ivy, rose trellises, weeds at the wall foot, chimney smoke (GPU puffs, on and off; the forge always), drips off the eaves (by uRain), mounds (molehills, sandy heaps, earth).
- Walls belly and lean a little; roofs sag; windows: dark room, curtains, glass pane with sky in it, deep frame; doors of boards, stone steps, sometimes a hood.
- Ground: terrain.rough() bumps (cm on roads, more in the wild; never below the sea level), mesh 3 squares per cell; cobbles with sunk/missing stones and sand in the joints; bare sandy patches; grass in tufts, broader blades.
- Weather: sim.cloud, sim.precip (waves on top of a slowly built base), sim.snowfall; next weather grows from the last; HUD says drizzle … downpour.
