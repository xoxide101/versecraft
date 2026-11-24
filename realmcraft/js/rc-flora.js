// Flora: trees, bushes, ferns, reeds, grass and rocks, grown by code from a species and a seed.
// Trees have real trunks and branches (some species grow several trunks), and leaves made of many small
// leaf cards with rounded lighting, so a canopy reads as foliage, not a ball. Leaves sway in the wind and
// change with the seasons (deciduous trees go bare in winter; pines stay green).
(function () {
  const RC = window.RC;
  // species: shape, bark, leaf card, colours by season [spring, summer, autumn, winter or null = bare]
  const SPECIES = {
    oak: { bark: 'oak', leaf: 'oak', h: [1.7, 2.4], trunks: [1, 1, 2], branches: [4, 6], spread: 1.5, clusters: 15, card: 1.05, seasons: ['#93d16b', '#4d8b37', '#c9802f', null] },
    maple: { bark: 'maple', leaf: 'maple', h: [1.9, 2.6], trunks: [1, 2], branches: [5, 7], spread: 1.25, clusters: 17, card: 1.0, round: true, seasons: ['#9bd56f', '#4a8834', '#d4462b', null] },
    birch: { bark: 'birch', leaf: 'birch', h: [2.8, 3.8], trunks: [1, 2, 3, 3], branches: [3, 5], spread: 0.8, clusters: 10, card: 0.85, slim: true, seasons: ['#b9e27c', '#7fbe4a', '#e9c43e', null] },
    pine: { bark: 'pine', leaf: 'needle', h: [3.6, 4.8], trunks: [1], conifer: true, seasons: ['#3f6f45', '#355f3b', '#365c3a', '#2f513a'] },
  };
  const BUSHES = {
    bush: { leaf: 'oak', r: 0.55, cards: 14, color: '#4c8a36' }, berry: { leaf: 'berry', r: 0.5, cards: 12, color: '#3f7d32' }, blossom: { leaf: 'blossom', r: 0.55, cards: 14, color: '#5a9a45' },
    frost_bush: { leaf: 'birch', r: 0.5, cards: 12, color: '#86b5aa' }, fern: { fern: true, color: '#4f9a35' }, ember_fern: { fern: true, color: '#9a5a2a' }, sapling: { leaf: 'birch', r: 0.35, cards: 7, color: '#7fbe4a', stem: 0.8 },
  };
  RC.Flora = { SPECIES, BUSHES };
  const V3 = (x, y, z) => ({ x, y, z });

  // a tapered branch piece from a to b
  function limb(T, a, b, r1, r2, seg) {
    const dir = new T.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), len = dir.length();
    const ge = new T.CylinderGeometry(r2, r1, len, seg, 1, true); ge.translate(0, len / 2, 0);
    ge.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize())); ge.translate(a.x, a.y, a.z);
    const uv = ge.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len * 0.8);
    return ge;
  }
  // a cluster of leaf cards around a point; normals point outward from the canopy middle (rounded light)
  function cluster(T, c, rad, n, size, mid, r, out, tint) {
    for (let i = 0; i < n; i++) {
      const p = new T.PlaneGeometry(size, size);
      p.applyQuaternion(new T.Quaternion().setFromEuler(new T.Euler(r() * 6.28, r() * 6.28, r() * 6.28)));
      const ox = (r() - 0.5) * 2 * rad, oy = (r() - 0.5) * 1.4 * rad, oz = (r() - 0.5) * 2 * rad; p.translate(c.x + ox, c.y + oy, c.z + oz);
      const pos = p.attributes.position, nor = p.attributes.normal, col = new Float32Array(pos.count * 3), k = 0.82 + r() * 0.3 * tint;
      for (let j = 0; j < pos.count; j++) {
        const nx = pos.getX(j) - mid.x + (pos.getX(j) - c.x) * 0.6, ny = (pos.getY(j) - mid.y) * 0.8 + (pos.getY(j) - c.y) * 0.6 + 0.25, nz = pos.getZ(j) - mid.z + (pos.getZ(j) - c.z) * 0.6, l = Math.hypot(nx, ny, nz) || 1;
        nor.setXYZ(j, nx / l, ny / l, nz / l);
        const inner = RC.clamp(Math.hypot(pos.getX(j) - mid.x, pos.getZ(j) - mid.z) / 2, 0.72, 1);   // darker inside the crown
        col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k * inner;
      }
      p.setAttribute('color', new T.BufferAttribute(col, 3)); out.push(p);
    }
  }

  RC.Flora.tree = function (T, kind, seed, detail = 1) {
    const sp = SPECIES[kind], r = RC.rng(seed * 7919 + kind.length), bark = [], leaves = [];
    const pick = (a) => a[Math.floor(r() * a.length)], range = (a) => a[0] + r() * (a[1] - a[0]);
    const H = range(sp.h);
    if (sp.conifer) {   // straight trunk, tiers of needle cards, short branches
      bark.push(limb(T, V3(0, -0.1, 0), V3(0, H, 0), 0.2, 0.04, 7));
      const tiers = 7 + Math.floor(r() * 3);
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers, y = 0.9 + t * (H - 0.6), rad = (1 - t) * 1.35 + 0.25, n = Math.round((5 + (1 - t) * 8) * detail);
        for (let j = 0; j < n; j++) {
          const a = (j / n) * 6.28 + r(), p = new T.PlaneGeometry(rad * 1.25, rad * 0.9); p.rotateX(-Math.PI / 2 + 0.35); p.translate(0, 0, rad * 0.55); p.rotateY(a); p.translate(0, y, 0);
          const pos = p.attributes.position, nor = p.attributes.normal, col = new Float32Array(pos.count * 3), k = 0.8 + r() * 0.25;
          for (let q = 0; q < pos.count; q++) { const nx = pos.getX(q), nz = pos.getZ(q), l = Math.hypot(nx, 0.7, nz); nor.setXYZ(q, nx / l, 0.7 / l, nz / l); col[q * 3] = col[q * 3 + 1] = col[q * 3 + 2] = k * (0.75 + t * 0.35); }
          p.setAttribute('color', new T.BufferAttribute(col, 3)); leaves.push(p);
          if (j % 2 === 0 && t < 0.8) bark.push(limb(T, V3(0, y - 0.1, 0), V3(Math.sin(a) * rad * 0.8, y - 0.25, Math.cos(a) * rad * 0.8), 0.035, 0.012, 4));
        }
      }
    } else {
      const trunks = pick(sp.trunks), mid = V3(0, H + (sp.slim ? 0.2 : 0.6), 0);
      for (let k = 0; k < trunks; k++) {
        const lean = trunks > 1 ? 0.22 + r() * 0.2 : (r() - 0.5) * 0.12, ang = (k / trunks) * 6.28 + r(), th = H * (trunks > 1 ? 0.85 + r() * 0.25 : 1);
        const base = V3(Math.cos(ang) * 0.08 * (trunks - 1), -0.1, Math.sin(ang) * 0.08 * (trunks - 1));
        const r0 = (sp.slim ? 0.11 : 0.2) / Math.sqrt(trunks) * 1.2;
        let prev = base, rad = r0; const pts = [base];
        for (let s = 1; s <= 3; s++) { const t = s / 3, p = V3(base.x + Math.cos(ang) * lean * th * t + (r() - 0.5) * 0.12, base.y + th * t, base.z + Math.sin(ang) * lean * th * t + (r() - 0.5) * 0.12); bark.push(limb(T, prev, p, rad, rad * 0.78, 8)); prev = p; rad *= 0.78; pts.push(p); }
        // branches from the upper trunk, each with a leaf cluster at its end and one partway
        const nb = Math.round(range(sp.branches) / Math.sqrt(trunks));
        for (let b = 0; b < nb; b++) {
          const t = 0.45 + r() * 0.55, from = pts[1 + Math.min(2, Math.floor(t * 3))], a = r() * 6.28, len = sp.spread * (0.6 + r() * 0.6) * (sp.slim ? 0.8 : 1);
          const elbow = V3(from.x + Math.cos(a) * len * 0.55, from.y + len * (sp.slim ? 0.55 : 0.3), from.z + Math.sin(a) * len * 0.55), tip = V3(from.x + Math.cos(a) * len, from.y + len * (sp.slim ? 0.85 : 0.55) + (r() - 0.3) * 0.3, from.z + Math.sin(a) * len);
          bark.push(limb(T, from, elbow, r0 * 0.45, r0 * 0.3, 5), limb(T, elbow, tip, r0 * 0.3, r0 * 0.12, 5));
          cluster(T, tip, sp.round ? 0.55 : 0.48, Math.round(sp.clusters / nb * 2.2 * detail), sp.card, mid, r, leaves, 1);
          cluster(T, elbow, 0.38, Math.round(3 * detail), sp.card * 0.9, mid, r, leaves, 1);
        }
        cluster(T, V3(prev.x, prev.y + 0.25, prev.z), sp.round ? 0.75 : 0.55, Math.round(sp.clusters * 0.6 * detail), sp.card * 1.05, mid, r, leaves, 1);   // the crown top
      }
    }
    return { bark: T.BufferGeometryUtils.mergeGeometries(bark), leaves: T.BufferGeometryUtils.mergeGeometries(leaves) };
  };
  RC.Flora.bush = function (T, kind, seed, detail = 1) {
    const b = BUSHES[kind] || BUSHES.bush, r = RC.rng(seed * 131 + kind.length), out = [], stems = [];
    if (b.fern) {   // fronds arching out from the middle
      const n = Math.round((9 + r() * 5) * Math.max(0.6, detail));
      for (let i = 0; i < n; i++) { const p = new T.PlaneGeometry(0.42, 0.95); p.translate(0, 0.47, 0); p.rotateX(0.55 + r() * 0.5); p.rotateY((i / n) * 6.28 + r() * 0.4); const pos = p.attributes.position, nor = p.attributes.normal, col = new Float32Array(pos.count * 3), k = 0.8 + r() * 0.3; for (let j = 0; j < pos.count; j++) { const l = Math.hypot(pos.getX(j), 1, pos.getZ(j)); nor.setXYZ(j, pos.getX(j) / l, 1 / l, pos.getZ(j) / l); col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k; } p.setAttribute('color', new T.BufferAttribute(col, 3)); out.push(p); }
      return { leaves: T.BufferGeometryUtils.mergeGeometries(out), leaf: 'fern', color: b.color };
    }
    const mid = V3(0, b.r * 0.9 + (b.stem || 0), 0);
    if (b.stem) stems.push(limb(T, V3(0, -0.05, 0), V3(0, b.stem + 0.2, 0), 0.04, 0.02, 5));
    for (let i = 0; i < 4; i++) cluster(T, V3((r() - 0.5) * b.r, b.r * 0.75 + (b.stem || 0) + r() * 0.2, (r() - 0.5) * b.r), b.r * 0.7, Math.round(b.cards / 4 * Math.max(0.6, detail)), 0.62, mid, r, out, 1);
    return { leaves: T.BufferGeometryUtils.mergeGeometries(out), bark: stems.length ? T.BufferGeometryUtils.mergeGeometries(stems) : null, leaf: b.leaf, color: b.color };
  };
  RC.Flora.rock = function (T, seed) {
    const r = RC.rng(seed * 61 + 5), ge = new T.IcosahedronGeometry(0.5, 2), p = ge.attributes.position;
    const sx = 0.8 + r() * 0.8, sy = 0.45 + r() * 0.35, sz = 0.7 + r() * 0.6;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (RC.hash(Math.round(x * 9), Math.round(y * 9) + Math.round(z * 9) * 7, seed) - 0.5) * 0.35; p.setXYZ(i, x * sx * n, Math.max(-0.1, y * sy * n), z * sz * n); }
    ge.computeVertexNormals();
    const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const up = ge.attributes.normal.getY(i), moss = RC.clamp((up - 0.55) * 2.5, 0, 1); col[i * 3] = RC.lerp(0.62, 0.42, moss); col[i * 3 + 1] = RC.lerp(0.6, 0.6, moss); col[i * 3 + 2] = RC.lerp(0.57, 0.3, moss); }
    ge.setAttribute('color', new T.BufferAttribute(col, 3)); return ge;
  };

  // ---------------------------------------------------------------- materials (shared, swaying)
  RC.Flora.materials = function (T, shared) {
    const sway = (mat, strength) => {
      mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind; sh.uniforms.uCam = shared.uCam; sh.uniforms.uPlayer = shared.uPlayer;
        // walk-behind: leaves between the camera and the player dissolve (a dither, so it stays soft)
        sh.fragmentShader = 'uniform vec3 uCam; uniform vec3 uPlayer; varying vec3 vFadeW;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          vec3 ab = uPlayer - uCam; float tt = clamp(dot(vFadeW - uCam, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0);
          float dd = length(vFadeW - (uCam + ab * tt));
          if (tt < 0.96 && dd < 2.6) { float nz = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); if (nz > (dd - 1.4) / 1.2) discard; }`);
        sh.vertexShader = 'uniform float uTime; uniform vec3 uWind; varying vec3 vFadeW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
          #else
          vec2 ip = vec2(0.0);
          #endif
          float hgt = max(position.y - 0.4, 0.0);
          float sw = hgt * ${strength.toFixed(3)} * (0.5 + uWind.z);
          float flutter = sin(uTime * 7.0 + position.x * 9.0 + position.z * 7.0 + ip.x) * 0.012 * (0.4 + uWind.z);
          transformed.x += (sin(uTime * 1.4 + ip.x * 0.7 + ip.y * 0.3) * 0.5 + uWind.x * 0.7) * sw + flutter;
          transformed.z += (cos(uTime * 1.1 + ip.y * 0.6) * 0.35 + uWind.y * 0.7) * sw + flutter;
          transformed.y += flutter * 0.6;
          #ifdef USE_INSTANCING
          vFadeW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
          vFadeW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`); };
      mat.customProgramCacheKey = () => 'sway' + strength; return mat;
    };
    const leafMat = (kind, strength) => { const map = RC.Tex.leaves(T, kind); const m = sway(new T.MeshStandardMaterial({ map, alphaTest: 0.42, side: T.DoubleSide, vertexColors: true, roughness: 0.72, metalness: 0 }), strength); m.userData.depth = new T.MeshDepthMaterial({ map, alphaTest: 0.42, depthPacking: T.RGBADepthPacking }); return m; };
    const barkMat = (kind) => { const b = RC.Tex.bark(T, kind); const m = sway(new T.MeshStandardMaterial({ map: b.map, normalMap: b.normalMap, roughness: 0.95 }), 0.004); m.map.repeat.set(2, 1); m.normalMap.repeat.set(2, 1); return m; };   // (barely sways; shares the walk-behind)
    return { leafMat, barkMat, sway };
  };

  // ---------------------------------------------------------------- planting a realm: forest cells, edges, meadows, waterside
  RC.Flora.plant = function (T, realm, terrain, shared) {
    const g = new T.Group(), tickers = [], q = RC.quality, detail = { low: 0.55, mid: 0.8, high: 1 }[q.tier];
    const mats = RC.Flora.materials(T, shared), W = realm.w, H = realm.h, P = terrain.paint, Y = (x, z) => terrain.groundY(x, z);
    const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W ? 'T' : P[r][c]);
    const noise = (c, r, s) => (RC.hash(Math.floor(c / s), Math.floor(r / s), 77) + RC.hash(Math.floor(c / (s * 2)), Math.floor(r / (s * 2)), 78)) / 2;
    // where each species grows: pines toward the north edge, birch in clumps, oak and maple elsewhere
    const trees = { oak: [], maple: [], birch: [], pine: [] };
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (P[r][c] === 'T') {
      const n = noise(c, r, 6), northness = 1 - r / H, h = RC.hash(c, r, 79);
      const kind = h < northness * 0.55 && n > 0.35 ? 'pine' : n < 0.3 ? 'birch' : n < 0.62 ? 'oak' : 'maple';
      trees[kind].push([c + 0.5 + (RC.hash(c, r, 5) - 0.5) * 0.7, r + 0.5 + (RC.hash(r, c, 6) - 0.5) * 0.7, h]);
    }
    const tm = new T.Matrix4(), qu = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), up = new T.Vector3(0, 1, 0), col = new T.Color();
    const seasonal = [];   // leaf meshes and their species, recoloured when the season turns
    for (const [kind, list] of Object.entries(trees)) {
      if (!list.length) continue;
      const sp = SPECIES[kind], variants = [0, 1, 2].map((v) => RC.Flora.tree(T, kind, v + 1, detail));
      const barkM = mats.barkMat(sp.bark), leafM = mats.leafMat(sp.leaf, sp.conifer ? 0.03 : 0.05);
      variants.forEach((vg, vi) => {
        const mine = list.filter((t) => Math.floor(t[2] * 3) === vi); if (!mine.length) return;
        const bm = new T.InstancedMesh(vg.bark, barkM, mine.length), lm = new T.InstancedMesh(vg.leaves, leafM, mine.length);
        lm.customDepthMaterial = leafM.userData.depth; bm.castShadow = lm.castShadow = true; bm.receiveShadow = lm.receiveShadow = true;
        mine.forEach(([x, z, h], i) => { const s = 0.8 + RC.hash(i, vi, 9) * 0.45; tm.compose(ps.set(x, Y(x, z), z), qu.setFromAxisAngle(up, h * 40), sc.set(s, s * (0.92 + RC.hash(vi, i, 3) * 0.2), s)); bm.setMatrixAt(i, tm); lm.setMatrixAt(i, tm); lm.setColorAt(i, col.set('#ffffff')); });
        g.add(bm, lm); seasonal.push({ mesh: lm, sp, count: mine.length });
      });
    }
    // brush: forest edges, meadow scatter, reeds by the water, rocks
    const brush = { bush: [], berry: [], blossom: [], fern: [], sapling: [], reed: [], rock: [], grass: [] };
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const k = P[r][c]; if (k !== '.' && k !== ',') continue;
      const h = RC.hash(c, r, 91), h2 = RC.hash(r, c, 92), edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => at(c + dc, r + dr) === 'T'), wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => at(c + dc, r + dr) === '~');
      const x = c + 0.2 + h2 * 0.6, z = r + 0.2 + RC.hash(c * 3, r, 93) * 0.6;
      if (wet && h < 0.55) brush.reed.push([x, z, h]);
      else if (edge && h < 0.6) brush[h < 0.22 ? 'fern' : h < 0.36 ? 'bush' : h < 0.44 ? 'sapling' : h < 0.52 ? 'berry' : 'rock'].push([x, z, h2]);
      else if (k === '.' && h < 0.075) brush[h < 0.025 ? 'bush' : h < 0.045 ? 'fern' : h < 0.06 ? 'rock' : 'blossom'].push([x, z, h2]);
      if (h2 < 0.5 * q.grass * (k === ',' ? 0.6 : 1) && !wet) brush.grass.push([c + RC.hash(c, r, 94), r + RC.hash(c, r, 95), h]);
      if (h2 < 0.3 * q.grass && k === '.') brush.grass.push([c + RC.hash(c, r, 96), r + RC.hash(c, r, 97), h2]);
    }
    const plantSet = (list, geo, mat, scale, tint, castShadow = true) => {
      if (!list.length) return null; const m = new T.InstancedMesh(geo, mat, list.length); if (mat.userData.depth) m.customDepthMaterial = mat.userData.depth;
      list.forEach(([x, z, h], i) => { const s = scale[0] + h * (scale[1] - scale[0]); m.setMatrixAt(i, tm.compose(ps.set(x, Y(x, z), z), qu.setFromAxisAngle(up, h * 50), sc.set(s, s, s))); if (tint) m.setColorAt(i, col.set(tint).offsetHSL((h - 0.5) * 0.04, 0, (h - 0.5) * 0.12)); });
      m.castShadow = castShadow; m.receiveShadow = true; g.add(m); return m;
    };
    for (const kind of ['bush', 'berry', 'blossom', 'fern', 'sapling']) { const b = RC.Flora.bush(T, kind, 3, detail); plantSet(brush[kind], b.leaves, mats.leafMat(b.leaf, kind === 'fern' ? 0.12 : 0.06), [0.75, 1.25], b.color); if (b.bark) plantSet(brush[kind], b.bark, mats.barkMat('birch'), [0.75, 1.25]); }
    // reeds and grass: crossed cards
    const crossed = (w, h, n) => { const parts = []; for (let i = 0; i < n; i++) { const p = new T.PlaneGeometry(w, h).translate(0, h / 2, 0); p.rotateY((i / n) * Math.PI); const nor = p.attributes.normal; for (let j = 0; j < nor.count; j++) nor.setXYZ(j, 0, 1, 0); parts.push(p); } return T.BufferGeometryUtils.mergeGeometries(parts); };
    const grassMat = mats.sway(new T.MeshStandardMaterial({ map: RC.Tex.leaves(T, 'grass'), alphaTest: 0.4, side: T.DoubleSide, roughness: 0.9 }), 0.35);
    plantSet(brush.grass, crossed(0.85, 0.48, 3), grassMat, [0.7, 1.25], '#9bd06a', false);
    const reedMat = mats.sway(new T.MeshStandardMaterial({ map: RC.Tex.leaves(T, 'reed'), alphaTest: 0.4, side: T.DoubleSide, roughness: 0.9 }), 0.2);
    plantSet(brush.reed, crossed(0.7, 1.2, 3), reedMat, [0.8, 1.3], '#ffffff');
    const stone = RC.Tex.surface(T, 'stone'); const rockMat = new T.MeshStandardMaterial({ vertexColors: true, map: stone.map, normalMap: stone.normalMap, roughness: 0.95 });
    plantSet(brush.rock, RC.Flora.rock(T, 4), rockMat, [0.45, 1.1], '#ffffff');
    // seasons: recolour leaves when the season turns; bare branches in winter
    let lastSeason = -1;
    tickers.push((t, s) => {
      const si = s.season == null ? 1 : s.season; if (si === lastSeason) return; lastSeason = si;
      const idx = Math.min(3, Math.max(0, si));
      for (const it of seasonal) { const c = it.sp.seasons[idx]; it.mesh.visible = !!c; if (!c) continue; for (let i = 0; i < it.count; i++) it.mesh.setColorAt(i, col.set(c).offsetHSL((RC.hash(i, 1, 2) - 0.5) * 0.05, (RC.hash(i, 2, 3) - 0.5) * 0.1, (RC.hash(i, 3, 4) - 0.5) * 0.1)); it.mesh.instanceColor.needsUpdate = true; }
    });
    return { group: g, tickers };
  };
})();
