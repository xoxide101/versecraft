// Ground covers: recipes for grasses, reeds and wild plants that cover a patch of ground.
// A cover says what the ground is, how the blades grow (height, width, lean, droop, stiffness, twist, wave,
// colour from root to tip), how they gather (clumps, an even sward, rows, with bare patches), and what tops them
// (cattails, plumes, ears, seed heads, cotton, blooms, lavender spikes, clover leaflets).
// RC.Covers.build(T, recipe, w, d, seed, mask) makes one patch as one mesh; mask(x, z) → 0..1 thins it
// (blending into other covers, leaving gaps, thickening near things). RC.Covers.material(T, shared) moves it:
// gusts roll across in waves, each blade moves by its own height (tall stems swing, tufts barely stir), rain weighs tips down.
(function () {
  const RC = window.RC;
  const C = (hex) => { const c = new (window.THREE.Color)(hex); return [c.r, c.g, c.b]; };
  const vnoise = (x, z, s, seed) => { const X = x / s, Z = z / s, x0 = Math.floor(X), z0 = Math.floor(Z), fx = RC.smooth01(X - x0), fz = RC.smooth01(Z - z0), h = (a, b) => RC.hash(a, b, seed);
    return RC.lerp(RC.lerp(h(x0, z0), h(x0 + 1, z0), fx), RC.lerp(h(x0, z0 + 1), h(x0 + 1, z0 + 1), fx), fz); };
  RC.Covers = { vnoise };
  // counts are for a 4 × 4 patch
  RC.Covers.RECIPES = {
    // ---- grasslands
    meadow: { name: 'Meadow', ground: '#4a4030', layout: 'even', count: 1800, h: [0.18, 0.34], w: 0.008, lean: 0.25, droop: 0.12, root: '#2f4a1f', tip: '#7cc24a', tipMix: '#a8d86a' },
    tall_prairie: { name: 'Tall prairie', ground: '#4a4030', layout: 'even', count: 1500, h: [0.45, 0.8], w: 0.007, lean: 0.25, droop: 0.2, root: '#5a5a30', tip: '#c9b878', tipMix: '#8a9a50' },
    wheat: { name: 'Wheat', ground: '#5a4428', layout: 'even', count: 2200, h: [0.55, 0.7], w: 0.006, lean: 0.06, droop: 0.04, stiff: true, root: '#b8892a', tip: '#e7b84a', heads: { kind: 'ear', chance: 0.7, color: '#e2b04a' } },
    dry_savanna: { name: 'Dry savanna', ground: '#c08a5a', layout: 'even', count: 520, h: [0.3, 0.6], w: 0.005, lean: 0.25, droop: 0.15, root: '#4a3a22', tip: '#d8c08a' },
    lawn: { name: 'Lawn', ground: '#2e4a22', layout: 'even', count: 5200, h: [0.05, 0.09], w: 0.006, lean: 0.15, droop: 0.02, root: '#2a4a1e', tip: '#4f8a34' },
    stylized: { name: 'Stylized', ground: '#3f7a35', layout: 'even', count: 1100, h: [0.18, 0.32], w: 0.03, lean: 0.12, droop: 0.04, root: '#2f6a28', tip: '#7fdc55' },
    summer_tall: { name: 'Summer tall', ground: '#3a3426', layout: 'even', count: 1700, h: [0.45, 0.75], w: 0.012, lean: 0.2, droop: 0.15, root: '#2a5a1e', tip: '#6cc23e' },
    autumn_tall: { name: 'Autumn tall', ground: '#3a2e22', layout: 'even', count: 1700, h: [0.45, 0.75], w: 0.011, lean: 0.3, droop: 0.3, root: '#5a3a1a', tip: '#b07038' },
    summer_wild: { name: 'Summer wild', ground: '#4a3e2c', layout: 'even', count: 1100, patchy: 0.35, h: [0.25, 0.6], w: 0.01, lean: 0.3, droop: 0.2, root: '#2a5a1e', tip: '#76c84a', flowers: { chance: 0.05, colors: ['#ffffff', '#f5d02a'], h: [0.25, 0.45] } },
    autumn_wild: { name: 'Autumn wild', ground: '#3e3024', layout: 'even', count: 1300, patchy: 0.25, h: [0.3, 0.6], w: 0.009, lean: 0.4, droop: 0.35, root: '#4a3218', tip: '#a8743a' },
    wildflower_meadow: { name: 'Wildflower meadow', ground: '#4a3e2c', layout: 'even', count: 1000, h: [0.2, 0.42], w: 0.009, lean: 0.2, droop: 0.12, root: '#2f5a22', tip: '#7cc24a', flowers: { chance: 0.22, colors: ['#ffffff', '#f5c518', '#f0a81a', '#fbfbf0'], h: [0.2, 0.4] } },
    seed_heads: { name: 'Seed heads', ground: '#3e3a2a', layout: 'even', count: 1700, h: [0.45, 0.65], w: 0.006, lean: 0.12, droop: 0.06, root: '#4a6a2a', tip: '#c9c08a', heads: { kind: 'seed', chance: 0.75, color: '#e2d6a0' } },
    white_flowers: { name: 'White flowers', ground: '#3a3424', layout: 'even', count: 900, h: [0.15, 0.25], w: 0.008, lean: 0.1, droop: 0.05, root: '#2f5022', tip: '#5a8a3a', flowers: { chance: 0.9, colors: ['#f4f4ee', '#ffffff', '#e8e8e0'], h: [0.18, 0.3], big: true } },
    yellow_flowers: { name: 'Yellow flowers', ground: '#3a3424', layout: 'even', count: 900, h: [0.15, 0.25], w: 0.008, lean: 0.1, droop: 0.05, root: '#2f5022', tip: '#5a8a3a', flowers: { chance: 0.9, colors: ['#f5c518', '#f0b010', '#ffd83a'], h: [0.18, 0.3], big: true } },
    tiny_spinifex: { name: 'Tiny spinifex (filler)', ground: '#5d7a3a', layout: 'clumps', clumps: 900, perClump: [6, 10], spread: 0.025, h: [0.05, 0.11], w: 0.004, lean: 1.2, droop: 0.04, stiff: true, root: '#3f6a2a', tip: '#a6c86a' },
    // ---- wet, dry, cold
    reed_marsh: { name: 'Reed marsh', ground: '#2f5a55', layout: 'clumps', clumps: 26, perClump: [5, 9], spread: 0.3, h: [0.9, 1.5], w: 0.02, lean: 0.12, droop: 0.05, root: '#3c5a2a', tip: '#9cbf68',
      heads: { kind: 'cattail', chance: 0.35, color: '#5a3620' }, extra: { chance: 0.5, h: [0.5, 0.9], tip: '#b8c98a' } },
    pampas: { name: 'Pampas', ground: '#8a7560', layout: 'clumps', clumps: 4, perClump: [40, 60], spread: 0.22, h: [0.55, 0.9], w: 0.012, lean: 0.9, droop: 0.5, root: '#6f7a58', tip: '#cfd6b4', heads: { kind: 'plume', perClump: [3, 6], h: [1.3, 1.8], color: '#efe6cf' } },
    elephant_grass: { name: 'Elephant grass', ground: '#3b3a2c', layout: 'even', count: 650, h: [1.0, 1.9], w: 0.028, lean: 0.55, droop: 0.45, root: '#1f4a1a', tip: '#6dbb3c' },
    rye_cornflowers: { name: 'Rye and cornflowers', ground: '#6e5232', layout: 'even', count: 1300, h: [0.7, 0.9], w: 0.007, lean: 0.06, droop: 0.02, stiff: true, root: '#8a7a3a', tip: '#e0c46a', heads: { kind: 'ear', chance: 0.9, color: '#d9b75a' }, flowers: { chance: 0.07, colors: ['#2f55d4', '#3b6ae8', '#c8281e'], h: [0.5, 0.8] } },
    cotton_bog: { name: 'Cotton bog', ground: '#3a2a20', layout: 'clumps', clumps: 50, perClump: [3, 6], spread: 0.12, h: [0.22, 0.4], w: 0.01, lean: 0.4, droop: 0.2, root: '#5a4a2a', tip: '#b49a5a', heads: { kind: 'cotton', chance: 0.35, color: '#f5f5f0' }, flowers: { chance: 0.2, colors: ['#c2410c', '#9a3412', '#d4573a'], h: [0.06, 0.15] } },
    dune_marram: { name: 'Dune marram', ground: '#e6d8b0', layout: 'clumps', clumps: 22, perClump: [8, 14], spread: 0.08, h: [0.3, 0.6], w: 0.007, lean: 0.55, droop: 0.15, root: '#8a9a6a', tip: '#c9d6a8' },
    spinifex: { name: 'Spinifex', ground: '#c8653a', layout: 'clumps', clumps: 26, perClump: [14, 22], spread: 0.05, h: [0.22, 0.36], w: 0.006, lean: 1.4, droop: 0.05, stiff: true, root: '#9a8a52', tip: '#d8c88a' },
    frosted_meadow: { name: 'Frosted meadow', ground: '#e4e9ee', layout: 'even', count: 1200, h: [0.16, 0.4], w: 0.009, lean: 0.25, droop: 0.1, root: '#4a5a4a', tip: '#f2f6f8', frost: true },
    // ---- forest floors
    forest_moss: { name: 'Forest moss', ground: '#3a3a2e', layout: 'even', count: 4200, h: [0.02, 0.05], w: 0.012, lean: 0.5, droop: 0.02, root: '#2a3a20', tip: '#5a7a3a' },
    forest_ferns: { name: 'Forest ferns', ground: '#4a4440', layout: 'clumps', clumps: 34, patchy: 0.3, perClump: [4, 7], spread: 0.08, h: [0.22, 0.4], w: 0.03, lean: 0.8, droop: 0.4, root: '#2a5a22', tip: '#5ab845' },
    forest_floor: { name: 'Forest floor', ground: '#3e3a34', layout: 'clumps', clumps: 60, patchy: 0.45, perClump: [3, 6], spread: 0.1, h: [0.12, 0.35], w: 0.012, lean: 0.5, droop: 0.3, root: '#2a4a20', tip: '#5aa040' },
    forest_bracken: { name: 'Forest bracken', ground: '#4a4440', layout: 'clumps', clumps: 40, patchy: 0.3, perClump: [5, 8], spread: 0.08, h: [0.2, 0.38], w: 0.02, lean: 0.7, droop: 0.45, root: '#5a3218', tip: '#c0703a' },
    clover: { name: 'Clover', ground: '#4a4034', layout: 'even', count: 2600, h: [0.03, 0.06], w: 0.01, lean: 0.3, droop: 0.01, root: '#3a5a28', tip: '#5a8a3a', heads: { kind: 'leaflets', chance: 0.6, color: '#4c8a36' } },
    broad_leaf: { name: 'Broad leaf', ground: '#4a4034', layout: 'even', count: 1500, h: [0.06, 0.12], w: 0.018, lean: 0.3, droop: 0.04, root: '#2a3a20', tip: '#5aa040' },
    // ---- other worlds
    kelp_bed: { name: 'Kelp bed', ground: '#5a7080', layout: 'clumps', clumps: 22, perClump: [2, 4], spread: 0.12, h: [1.0, 1.9], w: 0.04, lean: 0.05, droop: 0, wave: 0.12, root: '#5a4a18', tip: '#b89a3a' },
    corkscrew_alien: { name: 'Corkscrew alien', ground: '#3a2a4a', layout: 'even', count: 1300, h: [0.3, 0.55], w: 0.012, lean: 0.08, droop: 0.02, twist: 3.5, root: '#1f6a6a', tip: '#5ae0d0', flowers: { chance: 0.04, colors: ['#ff6ab0', '#ff9ad0'], h: [0.3, 0.5] } },
    crystal_spires: { name: 'Crystal spires', ground: '#2a2e40', layout: 'clumps', clumps: 26, perClump: [3, 7], spread: 0.06, h: [0.3, 0.6], w: 0.03, lean: 0.15, droop: 0, stiff: true, root: '#3a7ab8', tip: '#bfe6ff', glow: 0.35, rigid: true },
    blighted: { name: 'Blighted', ground: '#3a3240', layout: 'even', count: 1300, patchy: 0.2, h: [0.2, 0.5], w: 0.008, lean: 0.3, droop: 0.3, root: '#1a1520', tip: '#5a4a6a', heads: { kind: 'seed', chance: 0.12, color: '#e8e0c0' } },
    burnt_regrowth: { name: 'Burnt regrowth', ground: '#2a2826', layout: 'even', count: 1700, h: [0.1, 0.3], w: 0.006, lean: 0.1, droop: 0.05, stiff: true, root: '#0e0d0c', tip: '#3a3634', regrow: { chance: 0.18, root: '#2a5a22', tip: '#6ac84a' } },
    lavender: { name: 'Lavender', ground: '#c9a06a', layout: 'rows', rows: 5, perRow: 12, perClump: [8, 12], spread: 0.1, h: [0.22, 0.38], w: 0.006, lean: 0.35, droop: 0.05, stiff: true, root: '#3a5a3a', tip: '#6a8a6a', heads: { kind: 'spike', chance: 0.7, color: '#7a5ae0' } },
    cel_field: { name: 'Cel field', ground: '#5aa03a', layout: 'clumps', clumps: 120, perClump: [3, 5], spread: 0.08, h: [0.15, 0.3], w: 0.03, lean: 0.4, droop: 0.15, root: '#3f8a2a', tip: '#a6e07a', flowers: { chance: 0.04, colors: ['#e83a2a', '#ffffff'], h: [0.35, 0.5], big: true } },
    cozy_pastel: { name: 'Cozy pastel', ground: '#a8d8b0', layout: 'even', count: 1700, h: [0.06, 0.14], w: 0.012, lean: 0.25, droop: 0.05, root: '#7ab890', tip: '#c8f0d0', flowers: { chance: 0.12, colors: ['#f4a6c8', '#c8a6f4', '#f8d88a', '#a6d0f4'], h: [0.08, 0.16] } },
  };

  // one patch w × d, as one mesh (blades are both-faced and lit from above, so there are no dark backs)
  RC.Covers.build = function (T, R, w, d, seed = 1, mask = null) {
    const r = RC.rng(seed * 977 + R.name.length), pos = [], col = [], idx = [], area = (w * d) / 16;
    const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const range = (a) => a[0] + r() * (a[1] - a[0]);
    const blade = (x, z, h, wd, ang, lean, droop, c0, c1, stiff, seg = 5, twist = 0, wave = 0, y0 = 0) => {   // (y0: where it starts, for parts high on a stem)
      const base = pos.length / 3; let tx = x, ty = 0, tz = z;
      for (let s = 0; s <= seg; s++) {
        const t = s / seg, out = lean * (stiff ? t : t * t) * h, down = droop * Math.pow(t, 3) * h, ww = wd * (1 - t * (wave ? 0.5 : 0.92)), a2 = ang + twist * t * 6.28;
        const sx = twist ? Math.cos(a2) * 0.025 * t : 0, sz = twist ? Math.sin(a2) * 0.025 * t : 0, wv = wave ? Math.sin(t * 7 + x * 3) * wave * t : 0;
        const px = x + Math.cos(ang) * out + sx + Math.sin(ang) * wv, py = y0 + h * t - down, pz = z + Math.sin(ang) * out + sz - Math.cos(ang) * wv, k = lerp3(c0, c1, Math.pow(t, 0.8)), wa = twist ? a2 : ang;
        for (const side of [-1, 1]) { pos.push(px + Math.sin(wa) * side * ww, py, pz - Math.cos(wa) * side * ww); col.push(...k); }
        tx = px; ty = py; tz = pz;
      }
      for (let s = 0; s < seg; s++) { const q = base + s * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2, q, q + 2, q + 1, q + 1, q + 2, q + 3); }
      return [tx, ty, tz];
    };
    const blob = (x, y, z, rx, ry, c, n = 6) => {   // a small closed lump (cattail, ear, cotton, bloom, leaflet)
      const base = pos.length / 3; pos.push(x, y + ry, z); col.push(...c); pos.push(x, y - ry, z); col.push(...c.map((v) => v * 0.7));
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.28; pos.push(x + Math.cos(a) * rx, y, z + Math.sin(a) * rx); col.push(...c.map((v) => v * 0.85)); }
      for (let i = 0; i < n; i++) { const a = base + 2 + i, b = base + 2 + ((i + 1) % n); idx.push(base, b, a, base + 1, a, b); }
    };
    const c0 = C(R.root), c1 = C(R.tip), cm = R.tipMix ? C(R.tipMix) : null, head = R.heads, fl = R.flowers;
    const holes = (x, z) => !R.patchy || vnoise(x + 50, z + 50, 0.9, 7) > R.patchy;   // bare patches inside the cover
    const keep = (x, z) => holes(x, z) && (!mask || r() < mask(x, z));
    const plant = (x, z) => {   // one stem or blade, maybe with its head
      if (!keep(x, z)) return;
      const h = range(R.h), ang = r() * 6.28;
      let a = c0, b = cm && r() < 0.4 ? cm : c1;
      b = R.frost ? lerp3(c1, [1, 1, 1], r() * 0.6) : lerp3(b, c0, r() * 0.2);
      if (R.regrow && r() < R.regrow.chance) { a = C(R.regrow.root); b = C(R.regrow.tip); }
      if (R.glow) { a = a.map((v) => v + R.glow * 0.3); b = b.map((v) => Math.min(1.3, v + R.glow)); }
      const tip = blade(x, z, h, R.w * (0.7 + r() * 0.6), ang, R.lean * (0.5 + r()), R.droop * (0.5 + r()), a, b, R.stiff, R.wave ? 8 : 5, R.twist ? R.twist * (0.7 + r() * 0.6) : 0, R.wave || 0);
      if (head && head.chance && r() < head.chance) {
        const hc = C(head.color);
        if (head.kind === 'cattail') blob(tip[0], tip[1] - 0.12, tip[2], 0.028, 0.11, hc);
        else if (head.kind === 'ear') { blob(tip[0], tip[1] - 0.03, tip[2], 0.016, 0.055, hc, 5); for (let k = 0; k < 3; k++) blade(tip[0], tip[2], 0.08, 0.002, r() * 6.28, 0.5, 0, hc, hc, true, 1, 0, 0, tip[1] - 0.06 + k * 0.03); }
        else if (head.kind === 'seed') { for (let k = 0; k < 4; k++) blob(tip[0] + (r() - 0.5) * 0.02, tip[1] - k * 0.025, tip[2] + (r() - 0.5) * 0.02, 0.008, 0.016, hc, 4); }
        else if (head.kind === 'cotton') blob(tip[0], tip[1] + 0.02, tip[2], 0.035, 0.035, hc, 7);
        else if (head.kind === 'spike') { for (let k = 0; k < 6; k++) blob(tip[0], tip[1] - k * 0.022, tip[2], 0.014 - k * 0.001, 0.012, hc.map((v) => v * (1 - k * 0.04)), 5); }
        else if (head.kind === 'leaflets') { for (let k = 0; k < 3; k++) { const la = k * 2.09 + ang; blob(tip[0] + Math.cos(la) * 0.012, tip[1], tip[2] + Math.sin(la) * 0.012, 0.012, 0.004, hc.map((v) => v * (0.9 + r() * 0.2)), 6); } }
      }
    };
    const flower = (x, z) => { if (!keep(x, z)) return; const h = range(fl.h), c = C(fl.colors[Math.floor(r() * fl.colors.length)]); const tip = blade(x, z, h, 0.004, r() * 6.28, 0.05, 0, C('#4a6a2a'), C('#5a7a3a'), true, 3);
      if (fl.big) { for (let k = 0; k < 5; k++) { const pa = k * 1.256; blob(tip[0] + Math.cos(pa) * 0.022, tip[1], tip[2] + Math.sin(pa) * 0.022, 0.018, 0.006, c, 5); } blob(tip[0], tip[1] + 0.004, tip[2], 0.01, 0.008, C('#f0a020'), 5); }
      else blob(tip[0], tip[1], tip[2], 0.03, 0.016, c, 6); };
    const plume = (x, z) => { const ph = range(head.h), ang = r() * 6.28, lean = 0.08 + r() * 0.12; const tip = blade(x, z, ph, 0.006, ang, lean, 0, C('#bfb79a'), C('#d8cfb4'), true, 4);
      for (let k = 0; k < 14; k++) blade(tip[0] - Math.cos(ang) * 0.02, tip[2] - Math.sin(ang) * 0.02, 0.32 + r() * 0.12, 0.012, ang + (r() - 0.5) * 1.4, 0.25 + r() * 0.3, 0.1, C(head.color), C('#fffaf0'), false, 3, 0, 0, tip[1] - 0.42 + k * 0.025); };
    const clumpAt = (cx, cz) => { const n = Math.round(range(R.perClump)); for (let i = 0; i < n; i++) plant(cx + (r() - 0.5) * R.spread, cz + (r() - 0.5) * R.spread); if (head && head.kind === 'plume') for (let i = 0, m = Math.round(range(head.perClump)); i < m; i++) plume(cx + (r() - 0.5) * 0.1, cz + (r() - 0.5) * 0.1); };
    if (R.layout === 'even') for (let i = 0, n = Math.round(R.count * area); i < n; i++) plant((r() - 0.5) * w, (r() - 0.5) * d);
    else if (R.layout === 'rows') for (let j = 0; j < R.rows; j++) for (let i = 0; i < R.perRow; i++) clumpAt(-w / 2 + (i + 0.5) * (w / R.perRow) + (r() - 0.5) * 0.08, -d / 2 + (j + 0.5) * (d / R.rows) + (r() - 0.5) * 0.08);
    else for (let k = 0, n = Math.round(R.clumps * area); k < n; k++) { const cx = (r() - 0.5) * w * 0.94, cz = (r() - 0.5) * d * 0.94; if (mask && r() > mask(cx, cz) * 1.3) continue; clumpAt(cx, cz); }
    if (R.extra) { const e = R.extra; for (let i = 0, n = Math.round(60 * area); i < n; i++) if (r() < e.chance) { const ex = (r() - 0.5) * w, ez = (r() - 0.5) * d; if (keep(ex, ez)) blade(ex, ez, range(e.h), 0.03, r() * 6.28, 0.35, 0.3, c0, C(e.tip), false); } }
    if (fl) for (let i = 0, n = Math.round((R.count || 300) * area); i < n; i++) if (r() < fl.chance) flower((r() - 0.5) * w, (r() - 0.5) * d);
    const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ge.setAttribute('color', new T.Float32BufferAttribute(col, 3)); ge.setIndex(idx);
    const nor = new Float32Array(pos.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1; ge.setAttribute('normal', new T.BufferAttribute(nor, 3));
    return ge;
  };

  // how covers move: gusts roll across in waves; a blade's sway grows with the square of its height
  // (so tall stems swing and short tufts barely stir); rain bends the tips down and out; rigid ones (crystals) don't move
  RC.Covers.material = function (T, shared, rigid) {
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
    if (rigid) return m;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind; sh.uniforms.uRain = shared.uRain || { value: 0 };
      sh.vertexShader = 'uniform float uTime; uniform vec3 uWind; uniform float uRain;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp0 = modelMatrix * vec4(position, 1.0);
        vec2 dir = normalize(vec2(uWind.x, uWind.y) + vec2(0.0001, 0.0));
        float h = max(position.y, 0.0);
        float gust = sin(dot(wp0.xz, dir) * 0.55 - uTime * 2.2) * 0.5 + 0.5;           // a wave rolling across the field
        gust = gust * gust * (0.6 + 0.4 * sin(dot(wp0.xz, vec2(-dir.y, dir.x)) * 0.31 + uTime * 0.7));
        float flick = sin(uTime * 4.0 + wp0.x * 7.0 + wp0.z * 5.0) * 0.15;              // small quick stirring
        float ang = (0.06 + uWind.z * 0.32) * (gust + flick);                              // stems bend by an angle, so the tip moves with the plant's height
        float bend = h * min(h * 3.0, 1.0);                                                   // (the lowest bit near the root barely moves)
        transformed.x += dir.x * sin(ang) * bend; transformed.z += dir.y * sin(ang) * bend;
        transformed.y -= (1.0 - cos(ang)) * bend;                                             // bending lowers the tip
        float wet = uRain * 0.35; transformed.y -= (1.0 - cos(wet)) * bend * 1.6; transformed.x += dir.x * sin(wet) * bend * 0.5; transformed.z += dir.y * sin(wet) * bend * 0.5;`);
    };
    m.customProgramCacheKey = () => 'cover';
    return m;
  };
})();
