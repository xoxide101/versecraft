// Ground cover in the realm: the cover recipes (rc-covers.js) painted over the land in 8 × 8 chunks.
// Which cover grows where comes from the map: grass → meadow with lawn and wildflower patches; meadow → wildflowers;
// forest → forest floor and ferns; the water's edge → reed marsh; at the foot of buildings, walls, posts and road edges
// the grass thickens and grows taller (packed tiny spinifex right against them). Detail rings: chunks near you are
// full, further ones light, far ones only the ground picture. Chunks are made when you come near (a couple a frame).
(function () {
  const RC = window.RC;
  // distance (in cells) from every cell to the nearest seed cell: a two-pass chamfer
  function distanceField(W, H, isSeed) {
    const D = new Float32Array(W * H), BIG = 1e6, d1 = 1, d2 = Math.SQRT2;
    for (let i = 0; i < W * H; i++) D[i] = isSeed(i % W, Math.floor(i / W)) ? 0 : BIG;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const i = r * W + c; let v = D[i];
      if (c > 0) v = Math.min(v, D[i - 1] + d1); if (r > 0) { v = Math.min(v, D[i - W] + d1); if (c > 0) v = Math.min(v, D[i - W - 1] + d2); if (c < W - 1) v = Math.min(v, D[i - W + 1] + d2); } D[i] = v; }
    for (let r = H - 1; r >= 0; r--) for (let c = W - 1; c >= 0; c--) { const i = r * W + c; let v = D[i];
      if (c < W - 1) v = Math.min(v, D[i + 1] + d1); if (r < H - 1) { v = Math.min(v, D[i + W] + d1); if (c < W - 1) v = Math.min(v, D[i + W + 1] + d2); if (c > 0) v = Math.min(v, D[i + W - 1] + d2); } D[i] = v; }
    return D;
  }

  RC.GroundCover = class {
    constructor(T, realm, terrain, plan, shared) {
      this.T = T; this.realm = realm; this.terrain = terrain; this.shared = shared; this.group = new T.Group();
      const W = (this.W = realm.w), H = (this.H = realm.h), P = terrain.paint, q = RC.quality;
      this.CH = 8; this.chunks = new Map(); this.mats = {};
      this.rings = { low: { near: 12, mid: 26, dense: 0.12, light: 0.025 }, mid: { near: 16, mid: 34, dense: 0.25, light: 0.04 }, high: { near: 20, mid: 42, dense: 0.38, light: 0.06 } }[q.tier];
      const dq = new URLSearchParams(location.search).get('grass'); if (dq) this.rings.dense = +dq;   // (?grass=0.6 for more, to try)
      // what the grass grows up against: buildings and solid things, road edges, tree trunks
      const solid = new Uint8Array(W * H);
      for (const t of realm.things) if (t.kind === 'building') { for (let r = Math.floor(t.z + 0.5); r < t.z + t.d - 0.3; r++) for (let c = t.x; c < t.x + t.w; c++) if (r >= 0 && r < H && c >= 0 && c < W) solid[r * W + c] = 1; }
      for (const k of plan.circles) { const c = Math.floor(k.x), r = Math.floor(k.z); if (r >= 0 && r < H && c >= 0 && c < W) solid[r * W + c] = 1; }
      const cell = (c, r) => P[r][c];
      this.dThing = distanceField(W, H, (c, r) => solid[r * W + c] || cell(c, r) === '-' || cell(c, r) === 'T');
      this.dWater = distanceField(W, H, (c, r) => cell(c, r) === '~' || cell(c, r) === '=');
      this.dLand = distanceField(W, H, (c, r) => cell(c, r) !== '~' && cell(c, r) !== '=');
      this.solid = solid;
      // tended ground: near buildings and road junctions in the town, fading out; never everywhere (a few spots let go)
      const dBuild = distanceField(W, H, (c, r) => { for (const t of realm.things) if (t.kind === 'building' && c >= t.x - 1 && c < t.x + t.w + 1 && r >= t.z && r < t.z + t.d + 1) return true; return false; });
      const dRoad = distanceField(W, H, (c, r) => cell(c, r) === '-');
      this.dBuild = dBuild; this.dRoad = dRoad;
      this.kept = (x, z) => (1 - RC.smooth01((this.field(dBuild, x, z) - 1.5) / 4)) * RC.smooth01((RC.fbm(x + 7, z + 3, 6, 3, 61) - 0.3) / 0.2);
      this.worn = (x, z) => 1 - RC.smooth01((this.field(dRoad, x, z) - 0.3) / 1.6);
      terrain.kept = this.kept; terrain.worn = this.worn;
    }
    at(x, z) { const c = Math.floor(x), r = Math.floor(z); return r < 0 || r >= this.H || c < 0 || c >= this.W ? 'T' : this.terrain.paint[r][c]; }
    // a distance field read smoothly between cell centres
    field(D, x, z) { const W = this.W, H = this.H, X = RC.clamp(x - 0.5, 0, W - 1.001), Z = RC.clamp(z - 0.5, 0, H - 1.001), c = Math.floor(X), r = Math.floor(Z), fx = X - c, fz = Z - r, g = (cc, rr) => D[Math.min(H - 1, rr) * W + Math.min(W - 1, cc)];
      return RC.lerp(RC.lerp(g(c, r), g(c + 1, r), fx), RC.lerp(g(c, r + 1), g(c + 1, r + 1), fx), fz); }
    // each cover's share at a point in the world
    masks() {
      const vn = RC.Covers.vnoise, grass = (k) => k === '.' || k === ',';   // (kept / natural: this.kept)
      const free = (x, z) => !this.solid[Math.floor(z) * this.W + Math.floor(x)] && this.at(x, z) !== '-';
      const gaps = (x, z) => RC.smooth01((vn(x + 40, z + 40, 2.6, 11) - 0.22) / 0.25);   // bare earth here and there
      return {
        meadow: (x, z) => { const k = this.at(x, z); return grass(k) && free(x, z) ? (0.8 - this.terrain.soft(',', x, z) * 0.35) * gaps(x, z) * (1 - this.kept(x, z) * 0.8) : 0; },
        lawn: (x, z) => { const k = this.at(x, z); return k === '.' && free(x, z) ? 0.15 + this.kept(x, z) * 0.85 : 0; },
        summer_wild: (x, z) => { const k = this.at(x, z); return grass(k) && free(x, z) ? RC.smooth01((RC.fbm(x, z, 5, 3, 71) - 0.55) / 0.12) * (1 - this.kept(x, z)) : 0; },
        wildflower_meadow: (x, z) => { const k = this.at(x, z); if (!grass(k) || !free(x, z)) return 0; return Math.max(this.terrain.soft(',', x, z) * 0.8, RC.smooth01((vn(x, z, 3.5, 21) - 0.68) / 0.12) * 0.8); },
        summer_tall: (x, z) => { const k = this.at(x, z); if (!grass(k) || !free(x, z)) return 0; const d = this.field(this.dThing, x, z), untended = RC.smooth01((RC.vnoise(x, z, 3, 81) - 0.35) / 0.3) * (1 - this.kept(x, z) * 0.85); return (1 - RC.smooth01((d - 0.3) / 1.6)) * 0.95 * untended; },
        tiny_spinifex: (x, z) => { const k = this.at(x, z); if (!grass(k) || !free(x, z)) return 0; const d = this.field(this.dThing, x, z); return 1 - RC.smooth01((d - 0.2) / 0.9); },
        reed_marsh: (x, z) => { const k = this.at(x, z); if (k === '~') return 1 - RC.smooth01(this.field(this.dLand, x, z) / 1.1); if (!grass(k)) return 0; return 1 - RC.smooth01((this.field(this.dWater, x, z) - 0.4) / 1.2); },
        forest_floor: (x, z) => (free(x, z) ? this.terrain.soft('T', x, z) * 0.7 : 0),
        forest_ferns: (x, z) => (free(x, z) ? this.terrain.soft('T', x, z) * 0.45 : 0),
      };
    }
    material(k) { const R = RC.Covers.RECIPES[k]; return this.mats[k] || (this.mats[k] = RC.Covers.material(this.T, this.shared, R.rigid, true)); }
    makeChunk(cx, cz, level) {   // cx, cz: chunk corner in cells
      const T = this.T, CH = this.CH, g = new T.Group(), M = this.M || (this.M = this.masks()), ox = cx + CH / 2, oz = cz + CH / 2;
      const density = level === 'near' ? this.rings.dense : this.rings.light;
      const boost = { reed_marsh: 2.6, wildflower_meadow: 1.5 };   // (reeds and flowers stay full even where the grass is thinned for speed)
      for (const [k, mask] of Object.entries(M)) {
        if (level === 'mid' && (k === 'tiny_spinifex' || k === 'lawn')) continue;   // (far off, the fine stuff is just the ground picture)
        const local = (x, z) => mask(ox + x, oz + z);
        let any = false; for (let i = 0; i < 9 && !any; i++) if (local(((i % 3) - 1) * CH * 0.4, (Math.floor(i / 3) - 1) * CH * 0.4) > 0.02) any = true;
        if (!any) continue;
        const ge = RC.Covers.build(T, RC.Covers.RECIPES[k], CH, CH, cx * 131 + cz * 7 + k.length, local, { density: Math.min(1, density * (boost[k] || 1)), height: (x, z) => this.terrain.groundY(ox + x, oz + z) });
        if (!ge.attributes.position.count) continue;
        const m = new T.Mesh(ge, this.material(k)); m.position.set(ox, 0, oz); m.receiveShadow = true; m.castShadow = level === 'near'; m.frustumCulled = true;
        ge.computeBoundingSphere(); g.add(m);
      }
      return g;
    }
    // each frame: which chunks to show, at what level; make at most two new ones a frame
    update(px, pz) {
      const CH = this.CH, R = this.rings, cols = Math.ceil(this.W / CH), rows = Math.ceil(this.H / CH); let made = 0;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const cx = i * CH, cz = j * CH, d = Math.hypot(cx + CH / 2 - px, cz + CH / 2 - pz) - CH * 0.7;
        const level = d < R.near ? 'near' : d < R.mid ? 'mid' : null, key = i + ',' + j, have = this.chunks.get(key) || {};
        for (const lv of ['near', 'mid']) if (have[lv]) have[lv].visible = lv === level;
        if (level && !have[level] && made < 2) { have[level] = this.makeChunk(cx, cz, level); this.group.add(have[level]); this.chunks.set(key, have); made++; }
        if (level === 'near' && !have.near && have.mid) have.mid.visible = true;   // (until the full one is made)
      }
    }
  };
})();
