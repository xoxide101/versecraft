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
    bush: { leaf: 'oak', r: 0.55, cards: 14, size: 0.42, color: '#4c8a36' }, berry: { leaf: 'berry', r: 0.5, cards: 13, size: 0.4, color: '#3f7d32' }, blossom: { leaf: 'blossom', r: 0.55, cards: 14, size: 0.44, color: '#5a9a45' },
    frost_bush: { leaf: 'frost', r: 0.5, cards: 15, size: 0.4, color: '#9cc4bd' }, box: { leaf: 'box', r: 0.42, cards: 20, size: 0.3, color: '#3f7a34', squash: 0.92 }, fern: { fern: true, color: '#4f9a35' }, ember_fern: { fern: true, color: '#9a5a2a' }, sapling: { leaf: 'birch', r: 0.35, cards: 7, color: '#7fbe4a', stem: 0.8 },
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
  // a lumpy rounded shell (the filled core of a leaf mass): normals from the crown's middle, so the whole crown shades as one round form
  function blob(T, c, rad, mid, r, out, squash = 0.8, shade = 0.62) {
    const ge = new T.IcosahedronGeometry(rad, 1), pos = ge.attributes.position, s = r() * 100;
    for (let j = 0; j < pos.count; j++) { const x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j), n = 0.8 + RC.hash(Math.round(x * 13 + s), Math.round(y * 13), Math.round(z * 13)) * 0.4; pos.setXYZ(j, c.x + x * n, c.y + y * n * squash, c.z + z * n); }
    const nor = ge.attributes.normal, uv = ge.attributes.uv, col = new Float32Array(pos.count * 3);
    for (let j = 0; j < pos.count; j++) {
      const lx = pos.getX(j) - c.x, ly = pos.getY(j) - c.y, lz = pos.getZ(j) - c.z, gx = pos.getX(j) - mid.x, gy = pos.getY(j) - mid.y + 0.3, gz = pos.getZ(j) - mid.z;
      const nx = gx + lx * 0.8, ny = gy + ly * 0.8, nz = gz + lz * 0.8, l = Math.hypot(nx, ny, nz) || 1; nor.setXYZ(j, nx / l, ny / l, nz / l);
      uv.setXY(j, (Math.atan2(lz, lx) / 6.28 + 0.5) * 3, (ly / rad * 0.5 + 0.5) * 2);
      const k = shade * (0.85 + RC.clamp(ny / l, -0.3, 1) * 0.2); col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k;
    }
    ge.setAttribute('color', new T.BufferAttribute(col, 3)); out.push(ge.toNonIndexed ? ge.index ? ge.toNonIndexed() : ge : ge);
  }
  // leaf cards around a point: gently curved, mostly facing out from the crown (a round silhouette), the rest at random
  function cluster(T, c, rad, n, size, mid, r, out, tint, fill) {
    if (fill) blob(T, c, rad * 0.95, mid, r, fill);
    const Z = new T.Vector3(0, 0, 1);
    for (let i = 0; i < n; i++) {
      const p = new T.PlaneGeometry(size, size, 2, 2), pp = p.attributes.position;
      for (let j = 0; j < pp.count; j++) { const x = pp.getX(j), y = pp.getY(j); pp.setZ(j, -((x * x + y * y) / (size * size)) * size * 0.45); }   // cupped
      const ox = (r() - 0.5) * 2 * rad, oy = (r() - 0.5) * 1.4 * rad, oz = (r() - 0.5) * 2 * rad, at = new T.Vector3(c.x + ox, c.y + oy, c.z + oz);
      const out1 = at.clone().sub(new T.Vector3(mid.x, mid.y - 0.3, mid.z)).normalize().add(new T.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(i % 3 === 0 ? 2.4 : 0.7)).normalize();
      p.applyQuaternion(new T.Quaternion().setFromAxisAngle(Z, r() * 6.28)); p.applyQuaternion(new T.Quaternion().setFromUnitVectors(Z, out1));
      p.translate(at.x + out1.x * rad * 0.35, at.y + out1.y * rad * 0.35, at.z + out1.z * rad * 0.35);
      const pos = p.attributes.position, nor = p.attributes.normal, col = new Float32Array(pos.count * 3), k = 0.86 + r() * 0.26 * tint;
      for (let j = 0; j < pos.count; j++) {
        const nx = pos.getX(j) - mid.x + (pos.getX(j) - c.x) * 0.6, ny = (pos.getY(j) - mid.y) * 0.8 + (pos.getY(j) - c.y) * 0.6 + 0.25, nz = pos.getZ(j) - mid.z + (pos.getZ(j) - c.z) * 0.6, l = Math.hypot(nx, ny, nz) || 1;
        nor.setXYZ(j, nx / l, ny / l, nz / l);
        const inner = RC.clamp(Math.hypot(pos.getX(j) - mid.x, pos.getZ(j) - mid.z) / 2, 0.74, 1);   // darker inside the crown
        col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k * inner;
      }
      p.setAttribute('color', new T.BufferAttribute(col, 3)); out.push(p.index ? p.toNonIndexed() : p);
    }
  }

  RC.Flora.tree = function (T, kind, seed, detail = 1) {
    const sp = SPECIES[kind], r = RC.rng(seed * 7919 + kind.length), bark = [], leaves = [], fill = [];
    const pick = (a) => a[Math.floor(r() * a.length)], range = (a) => a[0] + r() * (a[1] - a[0]);
    const H = range(sp.h);
    if (sp.conifer) {   // straight trunk, tiers of needle cards, short branches
      bark.push(limb(T, V3(0, -0.1, 0), V3(0, H, 0), 0.2, 0.04, 7));
      bark.push(limb(T, V3(0, -0.15, 0), V3(0, 0.45, 0), 0.34, 0.2, 9));   // the trunk flares into its roots
      for (let k = 0; k < 4; k++) { const a = r() * 6.28, y0 = 0.35 + r() * 0.35; bark.push(limb(T, V3(0, y0, 0), V3(Math.sin(a) * 0.45, y0 - 0.12, Math.cos(a) * 0.45), 0.03, 0.008, 4)); }   // dead twigs low on the trunk, where the light doesn't reach
      const tiers = 7 + Math.floor(r() * 3);
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers, y = 0.75 + t * (H - 0.45), rad = (1 - t) * 1.38 + 0.25, n = Math.round((5 + (1 - t) * 8) * detail);
        for (let j = 0; j < n; j++) {
          const a = (j / n) * 6.28 + r(), p = new T.PlaneGeometry(rad * 1.25, rad * 0.9); p.rotateX(-Math.PI / 2 + 0.35 + (1 - t) * (1 - t) * 0.2); p.translate(0, 0, rad * 0.55);   // (the lowest boughs sweep down toward the ground) p.rotateY(a); p.translate(0, y, 0);
          const pos = p.attributes.position, nor = p.attributes.normal, col = new Float32Array(pos.count * 3), k = 0.8 + r() * 0.25;
          for (let q = 0; q < pos.count; q++) { const nx = pos.getX(q), nz = pos.getZ(q), l = Math.hypot(nx, 0.7, nz); nor.setXYZ(q, nx / l, 0.7 / l, nz / l); col[q * 3] = col[q * 3 + 1] = col[q * 3 + 2] = k * (0.75 + t * 0.35); }
          p.setAttribute('color', new T.BufferAttribute(col, 3)); leaves.push(p);
          if (j % 2 === 0 && t < 0.8) bark.push(limb(T, V3(0, y - 0.1, 0), V3(Math.sin(a) * rad * 0.8, y - 0.25, Math.cos(a) * rad * 0.8), 0.035, 0.012, 4));
        }
        const cone = new T.ConeGeometry(rad * 0.82, (H - 0.6) / tiers * 2.4, 10, 2, false), cp = cone.attributes.position, cn = cone.attributes.normal, cc = new Float32Array(cp.count * 3);
        for (let q = 0; q < cp.count; q++) { const x = cp.getX(q), z = cp.getZ(q), w = 0.85 + RC.hash(q, i, seed) * 0.3; const cap = cn.getY(q) < -0.9; cp.setXYZ(q, x * w, cp.getY(q) + y + 0.1, z * w); const l = Math.hypot(x, 0.6, z) || 1; if (cap) cn.setXYZ(q, 0, -1, 0); else cn.setXYZ(q, x / l, 0.6 / l, z / l); cc[q * 3] = cc[q * 3 + 1] = cc[q * 3 + 2] = cap ? 0.42 : 0.66 + t * 0.2; }   // (closed underneath, dark in its own shade: no hollow showing)
        cone.setAttribute('color', new T.BufferAttribute(cc, 3)); fill.push(cone.index ? cone.toNonIndexed() : cone);
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
          cluster(T, tip, sp.round ? 0.55 : 0.48, Math.round(sp.clusters / nb * 2.2 * detail), sp.card, mid, r, leaves, 1, fill);
          cluster(T, elbow, 0.38, Math.round(3 * detail), sp.card * 0.9, mid, r, leaves, 1, fill);
        }
        cluster(T, V3(prev.x, prev.y + 0.25, prev.z), sp.round ? 0.75 : 0.55, Math.round(sp.clusters * 0.6 * detail), sp.card * 1.05, mid, r, leaves, 1, fill);   // the crown top
      }
    }
    const M = (a) => T.BufferGeometryUtils.mergeGeometries(a.map((g) => (g.index ? g.toNonIndexed() : g)));
    return { bark: M(bark), leaves: M(leaves), fill: fill.length ? M(fill) : null };
  };
  RC.Flora.bush = function (T, kind, seed, detail = 1) {
    const b = BUSHES[kind] || BUSHES.bush, r = RC.rng(seed * 131 + kind.length), out = [], stems = [], fill = [];
    if (b.fern) {   // fronds arching out from the middle
      const n = Math.round((9 + r() * 5) * Math.max(0.6, detail));
      for (let i = 0; i < n; i++) { const p = new T.PlaneGeometry(0.42, 0.95); p.translate(0, 0.47, 0); p.rotateX(0.55 + r() * 0.5); p.rotateY((i / n) * 6.28 + r() * 0.4); const pos = p.attributes.position, nor = p.attributes.normal, col = new Float32Array(pos.count * 3), k = 0.8 + r() * 0.3; for (let j = 0; j < pos.count; j++) { const l = Math.hypot(pos.getX(j), 1, pos.getZ(j)); nor.setXYZ(j, pos.getX(j) / l, 1 / l, pos.getZ(j) / l); col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k; } p.setAttribute('color', new T.BufferAttribute(col, 3)); out.push(p); }
      return { leaves: T.BufferGeometryUtils.mergeGeometries(out), leaf: 'fern', color: b.color };
    }
    if (kind !== 'box' && kind !== 'sapling') {   // built like a little tree: woody stems fanning up from the ground, forking, leaf clusters at the tips
      const R0 = b.r, size = b.size || 0.42, mid = V3(0, R0 * 0.85, 0), n = 4 + Math.floor(r() * 3), per = Math.max(4, Math.round(b.cards * 5.4 * Math.max(0.6, detail) / (n * 2.2)));   // (no solid cores in a shrub: more leaves instead)
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.28 + r() * 0.8, lean = 0.3 + r() * 0.45, len = R0 * (1.05 + r() * 0.55), base = V3(Math.cos(a) * 0.04, -0.02, Math.sin(a) * 0.04);
        const midP = V3(base.x + Math.cos(a) * lean * len * 0.45, len * 0.5, base.z + Math.sin(a) * lean * len * 0.45);
        const tip = V3(base.x + Math.cos(a) * lean * len * (0.95 + r() * 0.3), len * (0.85 + r() * 0.3), base.z + Math.sin(a) * lean * len * (0.95 + r() * 0.3));
        stems.push(limb(T, base, midP, 0.032, 0.024, 5), limb(T, midP, tip, 0.024, 0.01, 5));
        const fa = a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), fl = len * (0.35 + r() * 0.25), fork = V3(midP.x + Math.cos(fa) * fl, midP.y + fl * (0.4 + r() * 0.4), midP.z + Math.sin(fa) * fl);
        stems.push(limb(T, midP, fork, 0.018, 0.008, 4));
        cluster(T, tip, R0 * (0.38 + r() * 0.14), per + 2, size * 1.05, mid, r, out, 1, null);
        cluster(T, fork, R0 * (0.28 + r() * 0.1), per, size * 0.95, mid, r, out, 1, null);
        if (r() < 0.6) cluster(T, V3((midP.x + tip.x) / 2, (midP.y + tip.y) / 2, (midP.z + tip.z) / 2), R0 * 0.25, Math.max(2, per - 2), size * 0.9, mid, r, out, 1, null);
      }
      const M = (a) => T.BufferGeometryUtils.mergeGeometries(a.map((g) => (g.index ? g.toNonIndexed() : g)));
      return { leaves: M(out), fill: fill.length ? M(fill) : null, bark: stems.length ? M(stems) : null, leaf: b.leaf, color: b.color };
    }
    const R0 = b.r, st = b.stem || 0, mid = V3(0, R0 * 0.72 + st, 0), Z = new T.Vector3(0, 0, 1), size = b.size || 0.42;
    if (st) stems.push(limb(T, V3(0, -0.05, 0), V3(0, st + 0.2, 0), 0.04, 0.02, 5));
    // a real shrub is lumpy: a main mass and 2-4 smaller lobes, uneven in size and height (a box stays tidier)
    const tidy = kind === 'box' ? 0.45 : 1, lobes = [{ c: V3((r() - 0.5) * 0.1, mid.y, (r() - 0.5) * 0.1), R: R0 }];
    for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) {
      const a = (k / n) * 6.28 + r() * 1.2, off = R0 * (0.45 + r() * 0.35) * tidy, rr = R0 * (0.5 + r() * 0.3);
      lobes.push({ c: V3(Math.cos(a) * off, Math.max(rr * 0.55 + st, mid.y + (r() - 0.6) * R0 * 0.5 * tidy), Math.sin(a) * off), R: rr });
    }
    const inOther = (p, me) => lobes.some((L) => L !== me && Math.hypot(p.x - L.c.x, (p.y - L.c.y) / 0.82, p.z - L.c.z) < L.R * 0.8);
    for (const L of lobes) {
      blob(T, V3(L.c.x, L.c.y - L.R * 0.05, L.c.z), L.R * 0.64, mid, r, fill, 0.76, 0.58);   // each lobe's core, kept inside its leaves
      const n = Math.round(b.cards * 3.4 * Math.max(0.6, detail) * (L.R / R0) * (L.R / R0) * 1.15);
      for (let i = 0; i < n; i++) {
        const tt = (i + 0.5) / n, y = 1 - tt * 1.32, ring = Math.sqrt(Math.max(0, 1 - y * y)) * (y < 0 ? 1 + y * 0.6 : 1), phi = i * 2.39996 + r() * 0.3;
        const dir = new T.Vector3(Math.cos(phi) * ring, y, Math.sin(phi) * ring), lump = 0.84 + r() * 0.3;
        const at = new T.Vector3(L.c.x + dir.x * L.R * lump, L.c.y + dir.y * L.R * 0.82 * lump, L.c.z + dir.z * L.R * lump);
        if (at.y < 0.1 || inOther(at, L)) continue;   // nothing on the ground; nothing buried inside another lobe
        const sz = size * (0.5 + 0.5 * RC.smooth01((y + 0.35) / 0.65)) * (0.85 + r() * 0.3);
        const p = new T.PlaneGeometry(sz, sz, 2, 2), pp = p.attributes.position;
        for (let j = 0; j < pp.count; j++) { const x = pp.getX(j), yy = pp.getY(j); pp.setZ(j, -((x * x + yy * yy) / (sz * sz)) * sz * 0.5); }
        const face = dir.clone().setY(Math.max(dir.y, y < 0 ? 0.45 : 0.15)).add(new T.Vector3(r() - 0.5, r() - 0.2, r() - 0.5).multiplyScalar(0.9)).normalize();
        p.applyQuaternion(new T.Quaternion().setFromAxisAngle(Z, r() * 6.28)); p.applyQuaternion(new T.Quaternion().setFromUnitVectors(Z, face)); p.translate(at.x, at.y, at.z);
        const pos = p.attributes.position, nor = p.attributes.normal, col = new Float32Array(pos.count * 3);
        for (let j = 0; j < pos.count; j++) {   // light from the lobe and the whole bush together: each lobe rounds, the bush still reads as one
          const nx = (pos.getX(j) - L.c.x) + (pos.getX(j) - mid.x) * 0.5, ny = (pos.getY(j) - L.c.y) * 1.2 + (pos.getY(j) - mid.y) * 0.4 + 0.15, nz = (pos.getZ(j) - L.c.z) + (pos.getZ(j) - mid.z) * 0.5, l = Math.hypot(nx, ny, nz) || 1; nor.setXYZ(j, nx / l, ny / l, nz / l);
          const k = (0.6 + 0.4 * RC.clamp(ny / l + 0.2, 0, 1)) * (0.9 + r() * 0.2);
          col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k;
        }
        p.setAttribute('color', new T.BufferAttribute(col, 3)); out.push(p.index ? p.toNonIndexed() : p);
      }
    }
    // sprigs: a few stems poking out past the outline with a small tuft at the end (not on a clipped box)
    for (let k = 0, n = kind === 'box' ? 0 : 2 + Math.floor(r() * 4); k < n; k++) {
      const a = r() * 6.28, from = V3(Math.cos(a) * R0 * 0.3, mid.y * (0.5 + r() * 0.5), Math.sin(a) * R0 * 0.3), len = R0 * (1.05 + r() * 0.45);
      const tip = V3(Math.cos(a) * len, from.y + R0 * (0.15 + r() * 0.55), Math.sin(a) * len);
      stems.push(limb(T, from, tip, 0.014, 0.006, 4));
      cluster(T, tip, 0.1, 3 + Math.floor(r() * 3), size * 0.6, tip, r, out, 1);
    }
    const M = (a) => T.BufferGeometryUtils.mergeGeometries(a.map((g) => (g.index ? g.toNonIndexed() : g)));
    return { leaves: M(out), fill: fill.length ? M(fill) : null, bark: stems.length ? M(stems) : null, leaf: b.leaf, color: b.color };
  };
  RC.Flora.rock = function (T, seed) {
    const r = RC.rng(seed * 61 + 5), ge = T.BufferGeometryUtils.mergeVertices(new T.IcosahedronGeometry(0.5, 5)), p = ge.attributes.position;   // (smooth, then lumped by two scales of noise below)
    const sx = 0.8 + r() * 0.8, sy = 0.45 + r() * 0.35, sz = 0.7 + r() * 0.6;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (RC.hash(Math.round(x * 4), Math.round(y * 4) + Math.round(z * 4) * 7, seed) - 0.5) * 0.3 + (RC.hash(Math.round(x * 14), Math.round(y * 14) + Math.round(z * 14) * 5, seed + 1) - 0.5) * 0.08; p.setXYZ(i, x * sx * n, Math.max(-0.1, y * sy * n), z * sz * n); }
    ge.computeVertexNormals();
    const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const up = ge.attributes.normal.getY(i), moss = RC.clamp((up - 0.55) * 2.5, 0, 1); col[i * 3] = RC.lerp(0.62, 0.42, moss); col[i * 3 + 1] = RC.lerp(0.6, 0.6, moss); col[i * 3 + 2] = RC.lerp(0.57, 0.3, moss); }
    ge.setAttribute('color', new T.BufferAttribute(col, 3)); return ge;
  };

  // ---------------------------------------------------------------- materials (shared, swaying)
  RC.Flora.materials = function (T, shared) {
    // wind: whole plants lean and sway with height; leaves also flutter (bark never moves)
    const sway = (mat, strength, flutter = true, base = 0.4) => {   // base: the height where swaying starts (0 for grass and ferns)
      mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind;
        sh.vertexShader = 'uniform float uTime; uniform vec3 uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
          #else
          vec2 ip = vec2(0.0);
          #endif
          float hgt = max(position.y - ${base.toFixed(2)}, 0.0);
          float sw = hgt * ${strength.toFixed(3)} * (0.5 + uWind.z);
          float flutter = ${flutter ? '1.0' : '0.0'} * sin(uTime * 7.0 + position.x * 9.0 + position.z * 7.0 + ip.x) * 0.012 * (0.4 + uWind.z);
          transformed.x += (sin(uTime * 1.4 + ip.x * 0.7 + ip.y * 0.3) * 0.5 + uWind.x * 0.7) * sw + flutter;
          transformed.z += (cos(uTime * 1.1 + ip.y * 0.6) * 0.35 + uWind.y * 0.7) * sw + flutter;
          transformed.y += flutter * 0.6;`); };
      mat.customProgramCacheKey = () => 'sway' + strength + flutter + base; return mat;
    };
    const leafMat = (kind, strength) => { const map = RC.Tex.leaves(T, kind); const m = sway(new T.MeshStandardMaterial({ map, alphaTest: 0.42, side: T.DoubleSide, vertexColors: true, roughness: 0.72, metalness: 0 }), strength); m.userData.depth = new T.MeshDepthMaterial({ map, alphaTest: 0.42, depthPacking: T.RGBADepthPacking }); return m; };
    const barkMat = (kind) => {   // real bark where packed (oak, maple, fruit: brown bark; pine: pine bark); birch keeps its drawn white bark
      const realName = { oak: 'bark_brown', maple: 'bark_brown', fruit: 'bark_brown', pine: 'bark_pine' }[kind], rb = realName && RC.Tex.real(T, realName);
      const b = rb ? { map: rb.map.clone(), normalMap: rb.normalMap.clone() } : RC.Tex.bark(T, kind); b.map.needsUpdate = b.normalMap.needsUpdate = true;
      const m = new T.MeshStandardMaterial({ map: b.map, normalMap: b.normalMap, normalScale: new T.Vector2(1.4, 1.4), roughness: 0.95 }); m.map.repeat.set(rb ? 1 : 2, rb ? 0.5 : 1); m.normalMap.repeat.copy(m.map.repeat); return m; };
    const fillMat = (kind, strength = 0.04) => { const map = RC.Tex.leaves(T, kind, true); return sway(new T.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.85 }), strength, false); };
    return { leafMat, barkMat, fillMat, sway };
  };

  // ---------------------------------------------------------------- planting a realm: forest cells, edges, meadows, waterside
  RC.Flora.plant = function (T, realm, terrain, shared) {
    const g = new T.Group(), tickers = [], q = RC.quality, detail = { low: 0.55, mid: 0.8, high: 1 }[q.tier];
    const mats = RC.Flora.materials(T, shared), W = realm.w, H = realm.h, P = terrain.paint, Y = (x, z) => terrain.groundY(x, z);
    const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W ? 'T' : P[r][c]);
    const noise = (c, r, s) => (RC.hash(Math.floor(c / s), Math.floor(r / s), 77) + RC.hash(Math.floor(c / (s * 2)), Math.floor(r / (s * 2)), 78)) / 2;
    // where each species grows: pines toward the north edge, birch in clumps, oak and maple elsewhere
    const spots = realm.things.filter((t) => t.kind !== 'building' && t.kind !== 'boat' && t.kind !== 'lamp' && t.node !== 'mushroom').map((t) => [t.x, t.z]);   // (mushrooms grow among trees, they don't push them away)
    const clear = (x, z) => !spots.some(([sx, sz]) => Math.abs(sx - x) < 1.3 && Math.abs(sz - z) < 1.3);
    const trees = { oak: [], maple: [], birch: [], pine: [] };
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (P[r][c] === 'T') {
      const n = noise(c, r, 6), northness = 1 - r / H, h = RC.hash(c, r, 79);
      const kind = h < northness * 0.55 && n > 0.35 ? 'pine' : n < 0.3 ? 'birch' : n < 0.62 ? 'oak' : 'maple';
      const tx = c + 0.5 + (RC.hash(c, r, 5) - 0.5) * 0.7, tz = r + 0.5 + (RC.hash(r, c, 6) - 0.5) * 0.7; if (clear(tx, tz) && !(terrain.stream && terrain.stream.clear(tx, tz, 0.9))) trees[kind].push([tx, tz, h]);
    }
    const tm = new T.Matrix4(), qu = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), up = new T.Vector3(0, 1, 0), col = new T.Color();
    const seasonal = [];   // leaf meshes and their species, recoloured when the season turns
    for (const [kind, list] of Object.entries(trees)) {
      if (!list.length) continue;
      const sp = SPECIES[kind], variants = [0, 1, 2].map((v) => RC.Flora.tree(T, kind, v + 1, detail));
      const barkM = mats.barkMat(sp.bark), leafM = mats.leafMat(sp.leaf, sp.conifer ? 0.03 : 0.05), fillM = mats.fillMat(sp.leaf);
      variants.forEach((vg, vi) => {
        const mine = list.filter((t) => Math.floor(t[2] * 3) === vi); if (!mine.length) return;
        const bm = new T.InstancedMesh(vg.bark, barkM, mine.length), lm = new T.InstancedMesh(vg.leaves, leafM, mine.length), fm = vg.fill ? new T.InstancedMesh(vg.fill, fillM, mine.length) : null;
        if (fm) { fm.castShadow = fm.receiveShadow = true; }
        lm.customDepthMaterial = leafM.userData.depth; bm.castShadow = lm.castShadow = true; bm.receiveShadow = lm.receiveShadow = true;
        mine.forEach(([x, z, h], i) => { const s = 0.8 + RC.hash(i, vi, 9) * 0.45; tm.compose(ps.set(x, Y(x, z), z), qu.setFromAxisAngle(up, h * 40), sc.set(s, s * (0.92 + RC.hash(vi, i, 3) * 0.2), s)); bm.setMatrixAt(i, tm); lm.setMatrixAt(i, tm); lm.setColorAt(i, col.set('#ffffff')); if (fm) { fm.setMatrixAt(i, tm); fm.setColorAt(i, col); } });
        g.add(bm, lm); seasonal.push({ mesh: lm, sp, count: mine.length }); if (fm) { g.add(fm); seasonal.push({ mesh: fm, sp, count: mine.length }); }
      });
    }
    // brush: forest edges, meadow scatter, reeds by the water, rocks
    const brush = { bush: [], berry: [], blossom: [], fern: [], sapling: [], reed: [], rock: [], grass: [] };
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const k = P[r][c]; if (k !== '.' && k !== ',') continue;
      const h = RC.hash(c, r, 91), h2 = RC.hash(r, c, 92), edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => at(c + dc, r + dr) === 'T'), wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => at(c + dc, r + dr) === '~');
      const x = c + 0.2 + h2 * 0.6, z = r + 0.2 + RC.hash(c * 3, r, 93) * 0.6;
      if (terrain.stream && terrain.stream.clear(x, z, 0.4)) continue;
      if (wet && h < 0.55) brush.reed.push([x, z, h]);
      else if (edge && h < 0.6) brush[h < 0.22 ? 'fern' : h < 0.36 ? 'bush' : h < 0.44 ? 'sapling' : h < 0.52 ? 'berry' : 'rock'].push([x, z, h2]);
      else if (k === '.' && h < 0.075) brush[h < 0.025 ? 'bush' : h < 0.045 ? 'fern' : h < 0.06 ? 'rock' : 'blossom'].push([x, z, h2]);
      if (!wet) for (let i = 0; i < Math.round((k === ',' ? 1.2 : 2.4) * q.grass + RC.hash(c, r, 98)); i++) brush.grass.push([c + RC.hash(c * 5 + i, r, 94), r + RC.hash(c, r * 5 + i, 95), RC.hash(c + i, r, 99)]);
    }
    const plantSet = (list, geo, mat, scale, tint, castShadow = true) => {
      if (!list.length) return null; const m = new T.InstancedMesh(geo, mat, list.length); if (mat.userData.depth) m.customDepthMaterial = mat.userData.depth;
      list.forEach(([x, z, h], i) => { const s = scale[0] + h * (scale[1] - scale[0]); m.setMatrixAt(i, tm.compose(ps.set(x, Y(x, z), z), qu.setFromAxisAngle(up, h * 50), sc.set(s, s, s))); if (tint) m.setColorAt(i, col.set(tint).offsetHSL((h - 0.5) * 0.04, 0, (h - 0.5) * 0.12)); });
      m.castShadow = castShadow; m.receiveShadow = true; g.add(m); return m;
    };
    for (const kind of ['bush', 'berry', 'blossom', 'fern', 'sapling']) { const b = RC.Flora.bush(T, kind, 3, detail); plantSet(brush[kind], b.leaves, mats.leafMat(b.leaf, kind === 'fern' ? 0.12 : 0.06), [0.75, 1.25], b.color); if (b.fill) plantSet(brush[kind], b.fill, mats.fillMat(b.leaf), [0.75, 1.25], b.color); if (b.bark) plantSet(brush[kind], b.bark, mats.barkMat(kind === 'sapling' ? 'birch' : 'oak'), [0.75, 1.25]); }
    // reeds and grass: crossed cards
    const clump = (w, h, n) => { const parts = []; for (let i = 0; i < n; i++) { const p = new T.PlaneGeometry(w, h, 1, 3).translate(0, h / 2, 0), pp = p.attributes.position, col = new Float32Array(pp.count * 3); for (let j = 0; j < pp.count; j++) { const t = pp.getY(j) / h; pp.setZ(j, t * t * h * 0.28); col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = 0.72 + t * 0.4; } p.rotateY((i / n) * Math.PI * 2 + 0.3); p.setAttribute('color', new T.BufferAttribute(col, 3)); const nor = p.attributes.normal; for (let j = 0; j < nor.count; j++) nor.setXYZ(j, 0, 1, 0); parts.push(p); } return T.BufferGeometryUtils.mergeGeometries(parts); };
    const crossed = (w, h, n) => { const parts = []; for (let i = 0; i < n; i++) { const p = new T.PlaneGeometry(w, h).translate(0, h / 2, 0); p.rotateY((i / n) * Math.PI); const nor = p.attributes.normal; for (let j = 0; j < nor.count; j++) nor.setXYZ(j, 0, 1, 0); parts.push(p); } return T.BufferGeometryUtils.mergeGeometries(parts); };
    const grassMat = mats.sway(new T.MeshStandardMaterial({ map: RC.Tex.leaves(T, 'grass'), alphaTest: 0.4, side: T.DoubleSide, roughness: 0.9, vertexColors: true }), 0.35, true, 0);
    const gm = RC.GroundCover ? null : plantSet(brush.grass, clump(0.5, 0.3, 5), grassMat, [0.75, 1.3], '#ffffff', false);
    if (gm) brush.grass.forEach(([x, z], i) => { const c = Math.floor(x), r = Math.floor(z), patch = noise(c, r, 5) * 0.6 + noise(c, r, 2) * 0.4, meadow = at(c, r) === ','; gm.setColorAt(i, col.setHSL((meadow ? 92 : 98 + patch * 10) / 360, (meadow ? 46 : 44 + patch * 10) / 100, ((meadow ? 50 : 40) + patch * 10) / 100 + 0.1)); });
    const reedMat = mats.sway(new T.MeshStandardMaterial({ map: RC.Tex.leaves(T, 'reed'), alphaTest: 0.4, side: T.DoubleSide, roughness: 0.9 }), 0.2, true, 0);
    if (!RC.GroundCover) plantSet(brush.reed, crossed(0.7, 1.2, 3), reedMat, [0.8, 1.3], '#ffffff');
    const stone = RC.Tex.real(T, 'rock_mossy') || RC.Tex.surface(T, 'rock'); const rockMat = new T.MeshStandardMaterial({ vertexColors: true, map: stone.map, normalMap: stone.normalMap, normalScale: new T.Vector2(1.5, 1.5), roughness: 0.95 });
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
