// Streams: a brook that rises from a spring in the woods, runs through the town in a dressed-stone channel, and ends in the sea.
// Data (realm.terrain.stream): path (x, z points, downstream = south), reach (z, half-width, stone 0..1: how much of a made channel it is),
// bridges (z, width, kind 'arch' or 'plank'). The land is cut to fit (terrain.land asks the stream), people can't wade in
// (terrain.stream.circles() are solid), bridges are decks the feet follow (terrain.stream.decks), and the water is a ribbon that runs downstream.
(function () {
  const RC = window.RC, lerp = RC.lerp, sm = RC.smooth01, clamp = RC.clamp;
  const WALL = 0.26, BANK_NATURAL = 1.1, BANK_STONE = 0.32;

  const keyAt = (keys, z, i) => {
    if (z <= keys[0][0]) return keys[0][i];
    for (let k = 0; k < keys.length - 1; k++) { const a = keys[k], b = keys[k + 1]; if (z <= b[0]) return lerp(a[i], b[i], sm((z - a[0]) / (b[0] - a[0]))); }
    return keys[keys.length - 1][i];
  };

  class Stream {
    constructor(def, terrain) {
      this.def = def; this.terrain = terrain;
      // the path, smoothed (Catmull-Rom) and cut into steps of about a quarter metre
      const P = def.path, pts = [];
      for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.25));
        for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
      }
      pts.push(P[P.length - 1].slice());
      const n = (this.n = pts.length);
      this.X = new Float32Array(n); this.Z = new Float32Array(n); this.S = new Float32Array(n); this.W = new Float32Array(n); this.U = new Float32Array(n);
      this.BED = new Float32Array(n); this.WL = new Float32Array(n); this.TX = new Float32Array(n); this.TZ = new Float32Array(n); this.SP = new Float32Array(n);
      let s = 0, lastWl = 1e9;
      for (let i = 0; i < n; i++) {
        const [x, z] = pts[i]; if (i) s += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
        this.X[i] = x; this.Z[i] = z; this.S[i] = s; this.W[i] = keyAt(def.reach, z, 1); this.U[i] = keyAt(def.reach, z, 2);
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; this.TX[i] = (b[0] - a[0]) / tl; this.TZ[i] = (b[1] - a[1]) / tl;
        // the water sits a little under the bank, only ever going down, and never below the sea it flows into
        lastWl = Math.min(lastWl, terrain.shapeY(x, z) - 0.26); const wl = Math.max(lastWl, terrain.waterY + 0.012); this.WL[i] = wl;
        this.BED[i] = wl - lerp(0.17, 0.32, this.U[i]);
      }
      for (let i = 0; i < n; i++) { const j = Math.min(n - 1, i + 6), k = Math.max(0, i - 6), slope = (this.WL[k] - this.WL[j]) / Math.max(0.1, this.S[j] - this.S[k]); this.SP[i] = clamp(0.55 + slope * 7, 0.5, 1.5); }
      this.length = s;
      // a lookup of which path pieces are near each metre square
      this.grid = new Map();
      for (let i = 0; i < n; i++) for (let cx = Math.floor(this.X[i] - 3); cx <= Math.floor(this.X[i] + 3); cx++) for (let cz = Math.floor(this.Z[i] - 3); cz <= Math.floor(this.Z[i] + 3); cz++) { const k = cx * 1000 + cz; let l = this.grid.get(k); if (!l) this.grid.set(k, (l = [])); l.push(i); }
      // bridges: decks for the feet (the arch rises a little in the middle)
      this.bridges = []; this.decks = [];
      for (const b of def.bridges || []) {
        let i = 0; while (i < n - 2 && this.Z[i + 1] < b.z) i++;
        const f = (b.z - this.Z[i]) / Math.max(1e-4, this.Z[i + 1] - this.Z[i]), cx = lerp(this.X[i], this.X[i + 1], f), w = lerp(this.W[i], this.W[i + 1], f), wl = lerp(this.WL[i], this.WL[i + 1], f), bed = lerp(this.BED[i], this.BED[i + 1], f);
        const L = b.length || 2 * (w + WALL + 1.0), x0 = cx - L / 2, x1 = cx + L / 2, y0 = (terrain.landRaw(x0, b.z) + terrain.landRaw(x1, b.z)) / 2 + 0.02, rise = b.kind === 'arch' ? 0.22 : 0.34;
        const br = { kind: b.kind, cx, zc: b.z, L, width: b.width, y0, rise, wl, bed, w, x0, x1 }; this.bridges.push(br);
        this.decks.push({ x0, x1, z0: b.z - b.width / 2, z1: b.z + b.width / 2, heightAt: (z, x) => { const t = (x - cx) / (L / 2); return y0 + rise * (1 - t * t); } });
      }
    }
    // the nearest bit of the path to a point: index, how far along that piece, and the distance
    find(x, z) {
      const l = this.grid.get(Math.floor(x) * 1000 + Math.floor(z)); if (!l) return null;
      const X = this.X, Z = this.Z, n = this.n; let bd = 1e9, bi = -1, bt = 0;
      for (let k = 0; k < l.length; k++) { const i = l[k]; if (i + 1 >= n) continue; const ax = X[i], az = Z[i], bx = X[i + 1] - ax, bz = Z[i + 1] - az, t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1), dx = x - ax - bx * t, dz = z - az - bz * t, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; bi = i; bt = t; } }
      if (bi < 0) return null; this._i = bi; this._t = bt; return Math.sqrt(bd);
    }
    // the land with the channel cut into it (soft banks for a brook, a sharp edge for a made channel)
    cut(x, z, y) {
      const d = this.find(x, z); if (d == null) return y;
      const i = this._i, t = this._t, w = lerp(this.W[i], this.W[i + 1], t), u = lerp(this.U[i], this.U[i + 1], t), outer = w + lerp(BANK_NATURAL, BANK_STONE, u);
      if (d >= outer) return y;
      const inner = w + 0.05, k = 1 - sm((d - inner) / (outer - inner)), bed = lerp(this.BED[i], this.BED[i + 1], t) - (1 - Math.min(1, d / w) ** 2) * 0.06 * (1 - u);
      return y + (bed - y) * k;
    }
    // for plants and things: near the water (d < reach + margin), and wet (the water and its edge)
    clear(x, z, margin = 0) { const d = this.find(x, z); if (d == null) return false; const i = this._i, t = this._t; return d < lerp(this.W[i], this.W[i + 1], t) + lerp(BANK_NATURAL, BANK_STONE, lerp(this.U[i], this.U[i + 1], t)) + margin; }
    wet(x, z, pad = 0.2) { const d = this.find(x, z); if (d == null) return false; const i = this._i, t = this._t; return d < lerp(this.W[i], this.W[i + 1], t) + 0.05 + pad; }
    // 0..1: gravel and sand on the bed and its banks
    bed(x, z) { const d = this.find(x, z); if (d == null) return 0; const i = this._i, t = this._t, w = lerp(this.W[i], this.W[i + 1], t); return 1 - sm((d - w - 0.05) / 0.7); }
    // stepping stones out to something in the water: each a small deck at its top, and a place you may stand
    addStep(x, z, r, y) { this.steps = this.steps || []; this.steps.push({ x, z, r, y }); this.decks.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, heightAt: () => y }); }
    onStep(x, z, pad = 0) { return (this.steps || []).some((s) => Math.hypot(x - s.x, z - s.z) < s.r + pad); }
    onBridge(z, pad = 0) { return this.bridges.some((b) => Math.abs(z - b.zc) < b.width / 2 + pad); }
    // can a person of radius R stand here? Not in the water or on its banks, except on a bridge
    blocks(x, z, R) {
      for (const b of this.bridges) if (Math.abs(z - b.zc) < b.width / 2 && Math.abs(x - b.cx) < b.L / 2) return false;
      if (this.onStep(x, z, 0.05)) return false;
      const d = this.find(x, z); if (d == null) return false; const i = this._i, t = this._t;
      return d < lerp(this.W[i], this.W[i + 1], t) + 0.1 + R;
    }
    atS(s) {
      const S = this.S; s = clamp(s, 0, this.length); let lo = 0, hi = this.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
      const f = (s - S[lo]) / Math.max(1e-5, S[hi] - S[lo]), g = (A) => lerp(A[lo], A[hi], f), tl = Math.hypot(g(this.TX), g(this.TZ)) || 1;
      return { x: g(this.X), z: g(this.Z), tx: g(this.TX) / tl, tz: g(this.TZ) / tl, w: g(this.W), u: g(this.U), bed: g(this.BED), wl: g(this.WL), i: lo };
    }
    drawMini(g) { g.strokeStyle = '#4aa3e8'; g.lineWidth = 1.3; g.beginPath(); for (let i = 0; i < this.n; i += 3) { if (i) g.lineTo(this.X[i], this.Z[i]); else g.moveTo(this.X[i], this.Z[i]); } g.stroke(); }

    // ---------------------------------------------------------------- drawing
    build(T, shared) {
      const terrain = this.terrain, g = new T.Group(), n = this.n, X = this.X, Z = this.Z;
      const rep = (tx, r) => { if (!tx) return tx; const c = tx.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = T.RepeatWrapping; c.repeat.set(r, r); return c; };
      const stoneT = RC.Tex.real(T, 'stone_wall'), cobT = RC.Tex.real(T, 'cobble_road'), plankT = RC.Tex.real(T, 'planks_weathered'), rockT = RC.Tex.real(T, 'rock_mossy');
      const stoneMat = new T.MeshStandardMaterial({ color: '#ffffff', map: stoneT && stoneT.map, normalMap: stoneT && stoneT.normalMap, vertexColors: true, roughness: 0.95 });
      const woodMat = new T.MeshStandardMaterial({ color: '#ffffff', map: plankT && plankT.map, normalMap: plankT && plankT.normalMap, vertexColors: true, roughness: 0.9 });
      const stoneUV = (stoneT ? stoneT.meters[0] : 2) * 0.6, woodUV = (plankT ? plankT.meters[0] : 2) * 0.7;
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(1, 1, 1), UP = new T.Vector3(0, 1, 0);
      const shadow = (m) => { m.castShadow = m.receiveShadow = true; return m; };

      // ---- stones in the stream: rocks on the bed breaking the surface; the water knows where each is (s along, across, size)
      const SN = 48, stones = [], srnd = RC.rng(9191);
      for (let s = 2.5; s < this.length - 3 && stones.length < SN; s += 0.7 + srnd() * 1.4) {
        const c = this.atS(s); if (this.bridges.some((b) => Math.abs(c.z - b.zc) < b.width / 2 + 0.6)) continue;
        const across = (srnd() - 0.5) * 1.5 * c.w, r = (0.1 + srnd() * 0.16) * Math.min(1.3, 0.7 + c.w);
        stones.push({ s, across, r, x: c.x - c.tz * across, z: c.z + c.tx * across, y: c.wl - r * (0.25 + srnd() * 0.45) });
        if (srnd() < 0.35 && stones.length < SN) { const a2 = across + (srnd() < 0.5 ? -1 : 1) * r * 1.8, r2 = r * (0.5 + srnd() * 0.3); stones.push({ s: s + (srnd() - 0.5) * 0.3, across: a2, r: r2, x: c.x - c.tz * a2, z: c.z + c.tx * a2, y: c.wl - r2 * 0.5 }); }   // (a smaller one beside it)
      }
      this.stones = stones;
      {
        const rockT2 = RC.Tex.real(T, 'rock_mossy'), sm2 = new T.MeshStandardMaterial({ vertexColors: true, map: rockT2 && rockT2.map, normalMap: rockT2 && rockT2.normalMap, roughness: 0.6 }), geo = RC.Flora.rock(T, 5);
        const im = new T.InstancedMesh(geo, sm2, Math.max(1, stones.length)), col = new T.Color();
        stones.forEach((st, i) => { m4.compose(v.set(st.x, st.y, st.z), q.setFromEuler(e.set(srnd() * 0.3, srnd() * 6.28, srnd() * 0.3)), sc.set(st.r * 2.2, st.r * 1.7, st.r * 2.0)); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(['#8a8a80', '#7a7a70', '#6a6e62', '#9a968a'][i % 4])); });
        sc.set(1, 1, 1); im.count = stones.length; im.castShadow = im.receiveShadow = true; im.userData.wetStones = true; g.add(im);
      }
      // ---- the water: a ribbon along the path that flows downstream (ripples travel with the current, foam along the edges)
      {
        const pos = [], fl = [], tg = [], us = [], en = [], idx = [];
        for (let i = 0; i < n; i++) {
          const u = this.U[i], half = this.W[i] + lerp(1.0, 0.1, u), nx = -this.TZ[i], nz = this.TX[i], fade = Math.min(sm(this.S[i] / 0.5) * 0.9 + 0.1, 1) * (1 - sm((this.S[i] - (this.length - 0.7)) / 0.7));
          for (const side of [-1, 1]) { pos.push(X[i] + nx * half * side, this.WL[i], Z[i] + nz * half * side); fl.push(this.S[i], half * side, half, this.SP[i]); tg.push(this.TX[i], this.TZ[i]); us.push(u); en.push(fade); }
          if (i + 1 < n) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
        }
        const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ge.setAttribute('aFl', new T.Float32BufferAttribute(fl, 4)); ge.setAttribute('aT', new T.Float32BufferAttribute(tg, 2));
        ge.setAttribute('aUs', new T.Float32BufferAttribute(us, 1)); ge.setAttribute('aEn', new T.Float32BufferAttribute(en, 1)); ge.setAttribute('normal', new T.Float32BufferAttribute(pos.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3)); ge.setIndex(idx);
        const mat = new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, roughness: 0.04, metalness: 0, envMapIntensity: 1.3, depthWrite: false });
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = shared.uTime; sh.uniforms.uStones = { value: Array.from({ length: SN }, (_, i) => stones[i] ? new T.Vector3(stones[i].s, stones[i].across, stones[i].r) : new T.Vector3(-99, 0, 0)) };
          sh.vertexShader = 'attribute vec4 aFl; attribute vec2 aT; attribute float aUs; attribute float aEn; varying vec4 vFl; varying vec2 vT; varying float vUs; varying float vEn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFl = aFl; vT = aT; vUs = aUs; vEn = aEn;');
          sh.fragmentShader = `uniform float uTime; uniform vec3 uStones[${SN}]; varying vec4 vFl; varying vec2 vT; varying float vUs; varying float vEn;
            float sH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float sN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sH(i), sH(i + vec2(1.0, 0.0)), f.x), mix(sH(i + vec2(0.0, 1.0)), sH(i + vec2(1.0, 1.0)), f.x), f.y); }\n` + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            {
              float ac = clamp(abs(vFl.y) / vFl.z, 0.0, 1.0);
              // round each stone the water heaps and breaks white, a wake of ripples trails downstream, a calm pool just behind it
              float churn = 0.0; vec2 sg = vec2(0.0);
              for (int k = 0; k < ${SN}; k++) { vec3 st = uStones[k]; float ds = vFl.x - st.x, da = vFl.y - st.y; if (abs(ds) > 2.2 || abs(da) > 0.8) continue;
                float d = length(vec2(ds, da)), ring = exp(-pow((d - st.z * 1.15) / (st.z * 0.35), 2.0)), wake = (ds > 0.0 ? exp(-ds / (st.z * 6.0)) : 0.0) * exp(-pow(da / (st.z * (1.0 + ds * 0.8)), 2.0));
                churn += ring * (0.35 + 0.35 * sN(vec2(atan(da, ds) * 3.0, uTime * 3.0))) + wake * 0.55 * sN(vec2(da * 18.0, ds * 9.0 - uTime * 6.0));
                sg += normalize(vec2(ds, da) + 1e-4) * ring * 0.5 + vec2(sin(ds * 30.0 - uTime * 9.0), 0.0) * wake * 0.25; }
              vec2 p = vec2(vFl.y, vFl.x - uTime * vFl.w);
              vec2 q1 = vec2(p.x * 2.6, p.y * 1.15), q2 = vec2(p.x * 5.5, p.y * 2.3 + 11.0); float e = 0.05;
              float a0 = sN(q1) + 0.5 * sN(q2);
              vec2 g = vec2(sN(q1 + vec2(e, 0.0)) + 0.5 * sN(q2 + vec2(e * 2.1, 0.0)) - a0, sN(q1 + vec2(0.0, e)) + 0.5 * sN(q2 + vec2(0.0, e * 2.1)) - a0) / e * 0.09;
              vec2 gw = g.x * vec2(-vT.y, vT.x) + g.y * vT;
              normal = normalize((viewMatrix * vec4(normalize(vec3(-gw.x, 1.0, -gw.y)), 0.0)).xyz);
              float mid = 1.0 - ac * ac;
              diffuseColor.rgb = mix(vec3(0.34, 0.40, 0.30), vec3(0.06, 0.13, 0.13), smoothstep(0.0, 0.9, mid) * mix(0.6, 1.0, vUs));
              diffuseColor.a = mix(0.72, 0.28, smoothstep(0.35, 1.0, ac)) * vEn;   // (see-through at the edges: the gravel bed shows)
              float fs = mix(0.55, 0.8, vUs);
              float foam = smoothstep(0.86, 0.97, ac) * smoothstep(0.55, 0.85, sN(p * vec2(5.0, 2.4))) * 0.5 + smoothstep(0.8, 0.95, sN(vec2(p.x * 7.0, p.y * 0.8 + 3.0))) * 0.1 * vUs;
              foam = clamp(foam, 0.0, 1.0);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.95), foam); diffuseColor.a = max(diffuseColor.a * 1.0, foam * 0.85 * vEn);
              float wf = clamp(churn, 0.0, 1.0) * smoothstep(0.35, 0.75, sN(vec2(vFl.y * 14.0, vFl.x * 7.0 - uTime * 5.0)) + 0.25);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 0.96), wf * 0.55); diffuseColor.a = max(diffuseColor.a, wf * 0.55 * vEn); foam = max(foam, wf);
              { vec2 gw2 = sg.x * vT + sg.y * vec2(-vT.y, vT.x); normal = normalize(normal + (viewMatrix * vec4(-gw2.x, 0.0, -gw2.y, 0.0)).xyz * 0.6); }
              roughnessFactor = mix(0.04, 0.5, foam);
            }`);
        };
        mat.customProgramCacheKey = () => 'rc-stream-water'; mat.userData.noWeather = true;
        const mesh = new T.Mesh(ge, mat); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.receiveShadow = true; mesh.name = 'stream'; g.add(mesh);
      }

      // ---- the made channel: courses of dressed stone either side, a coping slab on top; the lowest course greener where the water touches it
      {
        const parts = [], rnd = RC.rng(4242), tints = ['#e8e4dc', '#d8d4cc', '#f0eadf', '#ccc8be', '#e0d8c8', '#c4c0b6'];
        for (const side of [-1, 1]) {
          let s = 0;
          while (s < this.length) {
            const len = 0.36 + rnd() * 0.4, c = this.atS(s + len / 2); s += len;
            if (c.u < 0.3 || c.z > 65.0) continue;
            if (this.bridges.some((b) => b.kind === 'arch' && Math.abs(c.z - b.zc) < b.width / 2 + 0.05)) continue;
            const nx = -c.tz, nz = c.tx, off = c.w + WALL / 2, x = c.x + nx * side * off, z = c.z + nz * side * off, top = terrain.landRaw(x + nx * side * 0.3, z + nz * side * 0.3) + 0.1, yaw = Math.atan2(c.tx, c.tz);
            const reach = lerp(c.wl - 0.03, top, sm((c.u - 0.3) / 0.4));   // where the stone begins the walls are only a course or two, then they rise to the full channel
            let y = c.bed - 0.06, k = 0;
            while (y < reach - 0.09) {
              const h = Math.min(0.17 + rnd() * 0.07, reach - 0.07 - y); if (h < 0.05) break;
              const col = new T.Color(tints[Math.floor(rnd() * tints.length)]); if (k === 0 || y < c.wl + 0.02) col.lerp(new T.Color('#5d7a45'), 0.35);
              q.setFromAxisAngle(UP, yaw + (rnd() - 0.5) * 0.05); m4.compose(v.set(x + (rnd() - 0.5) * 0.02, y + h / 2, z), q, sc);
              parts.push({ geo: RC.roughBox(T, WALL, h - 0.012, len - 0.02, 0.03, rnd), mat4: m4.clone(), color: col.getStyle() }); y += h; k++;
            }
            q.setFromAxisAngle(UP, yaw); m4.compose(v.set(x + nx * side * 0.03, reach - 0.035, z + nz * side * 0.03), q, sc);
            if (reach > top - 0.2) parts.push({ geo: RC.roughBox(T, WALL + 0.12, 0.07, len + 0.03, 0.02, rnd), mat4: m4.clone(), color: tints[Math.floor(rnd() * tints.length)] });
          }
        }
        if (parts.length) g.add(shadow(new T.Mesh(RC.mergeParts(T, parts, stoneUV), stoneMat)));
      }

      // ---- rocks along the brook and stepping stones in it; the outcrop the spring comes out of; ferns and bushes on the banks
      {
        const rnd = RC.rng(777), geos = [RC.Flora.rock(T, 3), RC.Flora.rock(T, 9)], rockMat = new T.MeshStandardMaterial({ vertexColors: true, map: rockT && rockT.map, normalMap: rockT && rockT.normalMap, normalScale: new T.Vector2(1.5, 1.5), roughness: 0.95 });
        const lists = [[], []], put = (x, y, z, s, yaw) => lists[Math.floor(rnd() * 2)].push([x, y, z, s, yaw]);
        for (let i = 0; i < n; i += 3) {
          const w = this.W[i], u = this.U[i], nx = -this.TZ[i], nz = this.TX[i];
          if (u < 0.7 && rnd() < 0.55 * (1 - u)) { const sd = rnd() < 0.5 ? -1 : 1, d = w + 0.25 + rnd() * 0.9, x = X[i] + nx * sd * d, z = Z[i] + nz * sd * d; put(x, terrain.land(x, z) - 0.05, z, 0.3 + rnd() * 0.55, rnd() * 6.28); }
          if (u > 0.05 && u < 0.95 && i % 6 === 0) for (const sd of [-1, 1]) { const x = X[i] + nx * sd * (w + 0.2), z = Z[i] + nz * sd * (w + 0.2); put(x, terrain.land(x, z) - 0.02, z, 0.26 + rnd() * 0.14, rnd() * 6.28); }   // the fieldstone edging where the brook becomes a channel
          if (u < 0.3 && i % 24 === 0 && i > 10) { const x = X[i] + (rnd() - 0.5) * w, z = Z[i]; put(x, this.WL[i] - 0.14, z, 0.28 + rnd() * 0.2, rnd() * 6.28); }   // stepping stones
        }
        const s0 = this.atS(0), spring = [[-0.9, -1.1, 1.5], [0.5, -1.2, 1.3], [-0.2, -1.6, 1.7], [1.2, -0.7, 1.0], [-1.5, -0.4, 1.0], [0.0, -0.6, 0.9]];
        for (const [dx, dz, sz] of spring) { const x = s0.x + dx, z = s0.z + dz - 0.2; put(x, terrain.land(x, z) - 0.1, z, sz * 0.7, rnd() * 6.28); }
        lists.forEach((list, k) => { if (!list.length) return; const im = new T.InstancedMesh(geos[k], rockMat, list.length), c = new T.Color(); list.forEach(([x, y, z, s, yaw], i) => { im.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromAxisAngle(UP, yaw), sc.set(s * 1.4, s * 1.1, s * 1.2))); im.setColorAt(i, c.setScalar(0.85 + rnd() * 0.3)); }); sc.set(1, 1, 1); im.castShadow = im.receiveShadow = true; g.add(im); });
        // ferns and bushes
        const fm = RC.Flora.materials(T, shared), P = new T.Vector3(), C = new T.Color();
        for (const [kind, count, seed] of [['fern', 26, 3], ['bush', 9, 5]]) {
          const b = RC.Flora.bush(T, kind, seed, 1), list = [];
          for (let tries = 0; list.length < count && tries < 400; tries++) { const i = Math.floor(rnd() * n * 0.28), w = this.W[i], nx = -this.TZ[i], nz = this.TX[i], sd = rnd() < 0.5 ? -1 : 1, d = w + 0.5 + rnd() * 1.2, x = X[i] + nx * sd * d, z = Z[i] + nz * sd * d; if (this.U[i] < 0.35 && !this.clear(x, z, -0.15)) continue; if (this.U[i] >= 0.35) continue; list.push([x, z, rnd()]); }
          const place = (geo, mat, tint) => { const im = new T.InstancedMesh(geo, mat, list.length); if (mat.userData.depth) im.customDepthMaterial = mat.userData.depth; list.forEach(([x, z, h], i) => { const s = 0.75 + h * 0.5; im.setMatrixAt(i, m4.compose(P.set(x, terrain.land(x, z), z), q.setFromAxisAngle(UP, h * 50), sc.set(s, s, s))); if (tint) im.setColorAt(i, C.set(tint).offsetHSL((h - 0.5) * 0.04, 0, (h - 0.5) * 0.12)); }); sc.set(1, 1, 1); im.castShadow = true; im.receiveShadow = true; g.add(im); };
          place(b.leaves, fm.leafMat(b.leaf, kind === 'fern' ? 0.12 : 0.06), b.color); if (b.fill) place(b.fill, fm.fillMat(b.leaf), b.color); if (b.bark) place(b.bark, fm.barkMat('oak'));
        }
      }

      // ---- bridges
      for (const b of this.bridges) g.add(b.kind === 'arch' ? this.archBridge(T, b, stoneMat, stoneUV, cobT, rep) : this.plankBridge(T, b, woodMat, woodUV));
      return g;
    }

    // a little stone bridge: a solid arched body with the opening for the water, cobbles on top, parapet walls with capstones and corner posts
    archBridge(T, b, stoneMat, stoneUV, cobT, rep) {
      const g = new T.Group(), h = b.L / 2, W = b.width, top = (x) => b.y0 + b.rise * (1 - (x / h) ** 2), rnd = RC.rng(Math.floor(b.zc * 7) + 11);
      g.position.set(b.cx, 0, b.zc);
      const yb = b.bed - 0.3, sh = new T.Shape(); sh.moveTo(-h, yb); sh.lineTo(h, yb);
      for (let i = 0; i <= 14; i++) { const x = h - (2 * h * i) / 14; sh.lineTo(x, top(x) - 0.02); }
      const a = b.w + WALL - 0.02, peak = top(0) - 0.27, hole = new T.Path(); hole.moveTo(-a, b.bed);
      for (let i = 0; i <= 18; i++) { const th = Math.PI - (Math.PI * i) / 18; hole.lineTo(Math.cos(th) * a, b.bed + Math.sin(th) * (peak - b.bed)); }
      sh.holes.push(hole);
      const eg = new T.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 12 }); eg.translate(0, 0, -W / 2);
      const bm = stoneMat.clone(); bm.vertexColors = false; if (stoneMat.map) { bm.map = rep(stoneMat.map, 1 / stoneUV); bm.normalMap = rep(stoneMat.normalMap, 1 / stoneUV); } bm.color = new T.Color('#d8d2c6');
      const body = new T.Mesh(eg, bm); body.castShadow = body.receiveShadow = true; g.add(body);
      // cobbles on the roadway
      { const N = 20, pos = [], uv = [], idx = [], zz = W / 2 - 0.28, cm = cobT ? cobT.meters[0] : 2;
        for (let i = 0; i <= N; i++) { const x = -h + (2 * h * i) / N, y = top(x) + 0.012; pos.push(x, y, -zz, x, y, zz); uv.push(x / cm, -zz / cm, x / cm, zz / cm); if (i < N) { const p = i * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); } }
        const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); ge.setIndex(idx); ge.computeVertexNormals();
        const cmat = new T.MeshStandardMaterial({ color: '#ffffff', map: cobT && cobT.map, normalMap: cobT && cobT.normalMap, roughness: 0.92 }); const road = new T.Mesh(ge, cmat); road.receiveShadow = true; g.add(road); }
      // parapets
      const parts = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(1, 1, 1), tints = ['#e8e4dc', '#d8d4cc', '#f0eadf', '#ccc8be', '#e0d8c8'], M = 12, seg = b.L / M;
      for (const sd of [-1, 1]) for (let i = 0; i < M; i++) {
        const x = -h + (i + 0.5) * seg, ang = Math.atan2(top(x + 0.1) - top(x - 0.1), 0.2), zc = sd * (W / 2 - 0.15), col = tints[Math.floor(rnd() * tints.length)];
        q.setFromEuler(e.set(0, 0, ang)); m4.compose(v.set(x, top(x) + 0.2, zc), q, sc); parts.push({ geo: RC.roughBox(T, seg + 0.02, 0.4, 0.3, 0.03, rnd), mat4: m4.clone(), color: col });
        m4.compose(v.set(x, top(x) + 0.435, zc), q, sc); parts.push({ geo: RC.roughBox(T, seg + 0.05, 0.07, 0.38, 0.02, rnd), mat4: m4.clone(), color: col });
      }
      for (const sx of [-1, 1]) for (const sd of [-1, 1]) { q.identity(); m4.compose(v.set(sx * (h - 0.17), top(sx * h) + 0.32, sd * (W / 2 - 0.17)), q, sc); parts.push({ geo: RC.roughBox(T, 0.36, 0.66, 0.36, 0.03, rnd), mat4: m4.clone(), color: '#e0dacc' }); m4.compose(v.set(sx * (h - 0.17), top(sx * h) + 0.69, sd * (W / 2 - 0.17)), q, sc); parts.push({ geo: RC.roughBox(T, 0.44, 0.08, 0.44, 0.02, rnd), mat4: m4.clone(), color: '#e8e2d4' }); }
      const pm = new T.Mesh(RC.mergeParts(T, parts, stoneUV), stoneMat); pm.castShadow = pm.receiveShadow = true; g.add(pm);
      return g;
    }

    // a timber footbridge: boards across, two stringers, posts and two rails each side
    plankBridge(T, b, woodMat, woodUV) {
      const g = new T.Group(), h = b.L / 2, W = b.width, top = (x) => b.y0 + b.rise * (1 - (x / h) ** 2), rnd = RC.rng(Math.floor(b.zc * 9) + 3), parts = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(1, 1, 1);
      const woods = ['#8a6a48', '#7a5a3c', '#9a7a54', '#6e5236', '#826040'], put = (geo, x, y, z, rz, col) => { q.setFromEuler(e.set(0, 0, rz || 0)); m4.compose(v.set(x, y, z), q, sc); parts.push({ geo, mat4: m4.clone(), color: col }); };
      g.position.set(b.cx, 0, b.zc);
      const L = b.L + 0.5, nb = Math.round(L / 0.2);
      for (let i = 0; i < nb; i++) { const x = -L / 2 + (i + 0.5) * (L / nb), xx = clamp(x, -h, h), ang = Math.atan2(top(xx + 0.05) - top(xx - 0.05), 0.1); put(new T.BoxGeometry(L / nb - 0.015 - rnd() * 0.01, 0.06, W - 0.02 - rnd() * 0.05), x, top(xx) - 0.03, (rnd() - 0.5) * 0.03, ang, woods[Math.floor(rnd() * woods.length)]); }
      // stringers and rails follow the hump: short straight pieces, each turned to the curve
      const along = (yOff, thick, depth, zc, col, from = -L / 2, to = L / 2, N = 12) => { for (let i = 0; i < N; i++) { const xa = from + ((to - from) * i) / N, xb = from + ((to - from) * (i + 1)) / N, ya = top(clamp(xa, -h, h)) + yOff, yb = top(clamp(xb, -h, h)) + yOff;
        put(new T.BoxGeometry(Math.hypot(xb - xa, yb - ya) + 0.02, thick, depth), (xa + xb) / 2, (ya + yb) / 2, zc, Math.atan2(yb - ya, xb - xa), col); } };
      for (const sd of [-1, 1]) {
        along(-0.12, 0.14, 0.11, sd * (W / 2 - 0.2), '#5e4630');
        const posts = 5; for (let k = 0; k < posts; k++) { const x = -h + 0.12 + ((2 * h - 0.24) * k) / (posts - 1); put(new T.BoxGeometry(0.09, 0.95, 0.09), x, top(x) + 0.42, sd * (W / 2 - 0.05), 0, '#6a4e34'); }
        for (const yy of [0.5, 0.86]) along(yy, 0.06, 0.05, sd * (W / 2 - 0.05), '#7a5a3c', -h + 0.12, h - 0.12, 10);
      }
      // the abutments: a few stones each end where the beams rest on the bank
      for (const sx of [-1, 1]) put(new T.BoxGeometry(0.5, 0.3, W + 0.1), sx * (h + 0.1), b.y0 - 0.2, 0, 0, '#8a8478');
      const m = new T.Mesh(RC.mergeParts(T, parts, woodUV), woodMat); m.castShadow = m.receiveShadow = true; g.add(m);
      return g;
    }
  }

  RC.Stream = { compile: (def, terrain) => new Stream(def, terrain) };
})();
