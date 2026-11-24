// Boats: small wooden sailing boats, built like the real thing and tied up along the piers.
// The hull is lofted from sections (round in the middle, a fine bow, a flat transom at the stern) and planked along its
// length; a gunwale rail, a stem post, a keel, floorboards and two thwarts inside; a mast with the sail furled on its
// boom, stays to bow and stern; oars across the thwarts; a rudder. Each boat lies alongside the nearest pier with
// mooring lines from bow and stern to the pier posts and fenders hanging between, and rides the swell a little.
(function () {
  const RC = window.RC;
  RC.Boats = {
    // one boat. Local: keel at y = 0 amidships, the bow toward +z, the waterline about 0.3 up
    build(T, o) {
      const g = new T.Group(), LEN = o.len || 4.4, BEAM = o.beam || 1.55, DEP = o.depth || 0.78, r = RC.rng(o.seed || 0.3);
      const real = RC.Tex.real(T, 'planks_weathered'), M = (c, x) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, x || {}));
      const hullM = M(o.hull || '#7c4a2a', { map: real && real.map, normalMap: real && real.normalMap, side: T.DoubleSide });
      const trim = M('#4a3220'), wood = M('#9a7650', { map: real && real.map, normalMap: real && real.normalMap }), rope = M('#c8b088', { roughness: 1 });
      const half = (u) => (BEAM / 2) * (u < 0.12 ? 0.78 + (u / 0.12) * 0.22 : u < 0.55 ? 1 : Math.max(0.02, 1 - Math.pow((u - 0.55) / 0.45, 1.7)));
      const sheer = (u) => DEP + 0.18 * Math.pow(Math.abs(u - 0.45) / 0.55, 2) + (u > 0.9 ? (u - 0.9) * 0.9 : 0);
      const keel = (u) => (u > 0.72 ? Math.pow((u - 0.72) / 0.28, 1.6) * DEP * 0.75 : u < 0.08 ? (0.08 - u) * 1.4 : 0);
      const zAt = (u) => (u - 0.5) * LEN;
      // the hull skin: stations along the length × points round each section (port gunwale, keel, starboard gunwale)
      const NU = 28, NV = 16, pos = [], uv = [], idx = [];
      const pt = (u, v) => { const th = (v - 0.5) * Math.PI, b = half(u), kk = keel(u), sh = sheer(u), s = Math.sin(th); return [Math.sign(s) * Math.pow(Math.abs(s), 0.75) * b, kk + (sh - kk) * (1 - Math.cos(th)), zAt(u)]; };
      for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { const u = i / NU, v = j / NV, p = pt(u, v); pos.push(...p); uv.push(u * LEN / 1.6, v * 2.2); }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const hg = new T.BufferGeometry(); hg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); hg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); hg.setIndex(idx); hg.computeVertexNormals();
      const hull = new T.Mesh(hg, hullM); hull.castShadow = hull.receiveShadow = true; g.add(hull);
      // the transom: the flat board across the stern
      { const sh = new T.Shape(); for (let j = 0; j <= NV; j++) { const p = pt(0, j / NV); if (j) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); } const tg = new T.ShapeGeometry(sh); tg.translate(0, 0, zAt(0)); const tr = new T.Mesh(tg, M(o.hull || '#7c4a2a', { side: T.DoubleSide, map: real && real.map })); tr.castShadow = true; g.add(tr); }
      // the gunwale rail along both top edges, the stem post at the bow, the keel strip
      for (const sd of [-1, 1]) { const pts = []; for (let i = 0; i <= NU; i++) { const u = i / NU; pts.push(new T.Vector3(sd * half(u), sheer(u) + 0.02, zAt(u))); } const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.035, 5, false), trim); tube.castShadow = true; g.add(tube); }
      { const pts = []; for (let i = 0; i <= NU; i++) { const u = i / NU; pts.push(new T.Vector3(0, keel(u) - 0.03, zAt(u))); } pts.push(new T.Vector3(0, sheer(1) + 0.12, zAt(1) + 0.04)); g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.04, 5, false), trim)); }
      // inside: floorboards, two thwarts (seats), a few ribs
      { const fb = new T.Mesh(new T.BoxGeometry(BEAM * 0.55, 0.03, LEN * 0.6), wood); fb.position.set(0, 0.12, -LEN * 0.03); g.add(fb); }
      for (const u of [0.34, 0.62]) { const w = half(u) * 2 - 0.08, th = new T.Mesh(new T.BoxGeometry(w, 0.05, 0.26), wood); th.position.set(0, sheer(u) - 0.22, zAt(u)); th.castShadow = true; g.add(th); }
      for (let k = 1; k < 9; k++) { const u = 0.08 + k * 0.08; if (u > 0.85) break; const pts = []; for (let j = 1; j < NV; j++) { const p = pt(u, j / NV); pts.push(new T.Vector3(p[0] * 0.96, p[1] + 0.01, p[2])); } g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 0.018, 4, false), trim)); }
      // the mast, its boom with the sail furled on it, stays fore and aft
      const mz = zAt(0.64), mh = 3.3, mast = new T.Mesh(new T.CylinderGeometry(0.04, 0.055, mh, 8), wood); mast.position.set(0, mh / 2 + 0.1, mz); mast.castShadow = true; g.add(mast);
      const boomL = LEN * 0.5, boom = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, boomL, 6).rotateX(Math.PI / 2), wood); boom.position.set(0, 1.25, mz - boomL / 2); g.add(boom);
      { const sg = new T.CylinderGeometry(0.09, 0.07, boomL * 0.95, 10, 8).rotateX(Math.PI / 2), sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const k = 1 + 0.25 * Math.sin(sp.getZ(i) * 9 + sp.getX(i) * 20); sp.setX(i, sp.getX(i) * k); sp.setY(i, sp.getY(i) * k + 0.03); } sg.computeVertexNormals();
        const sail = new T.Mesh(sg, M(o.sail || '#f5f0e1', { roughness: 0.95 })); sail.position.set(0, 1.33, mz - boomL / 2); sail.castShadow = true; g.add(sail);
        for (let k = 0; k < 4; k++) { const tie = new T.Mesh(new T.TorusGeometry(0.1, 0.012, 4, 10), rope); tie.position.set(0, 1.33, mz - boomL * (0.15 + k * 0.22)); g.add(tie); } }
      const stay = (a, b) => { const d = new T.Vector3().subVectors(b, a), c = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, d.length(), 4), rope); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); g.add(c); };
      const top = new T.Vector3(0, mh + 0.05, mz); stay(top, new T.Vector3(0, sheer(1) + 0.1, zAt(0.99))); stay(top, new T.Vector3(0, sheer(0), zAt(0.02))); for (const sd of [-1, 1]) stay(top, new T.Vector3(sd * half(0.62), sheer(0.62), mz - 0.1));
      // oars laid across the thwarts, the rudder at the stern
      for (const sd of [-1, 1]) { const oar = new T.Group(); oar.add(new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 2.3, 6).rotateX(Math.PI / 2), wood)); const bl = new T.Mesh(new T.BoxGeometry(0.14, 0.02, 0.5), wood); bl.position.z = 1.15; oar.add(bl); oar.position.set(sd * 0.22, sheer(0.5) - 0.12, zAt(0.48)); oar.rotation.y = sd * 0.08; g.add(oar); }
      { const rd = new T.Mesh(new T.BoxGeometry(0.04, 0.75, 0.32), trim); rd.position.set(0, 0.35, zAt(0) - 0.16); g.add(rd); const tl = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 0.6), wood); tl.position.set(0, sheer(0) + 0.05, zAt(0) + 0.25); g.add(tl); }
      g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      // keep the sea out of the boat: an invisible cover across the hull just above the waterline, cut to the hull's own
      // width at that height; drawn after the boat's insides and before the water, it hides the water inside the hull only
      { const WY = 0.36, left = [], right = [];
        for (let i = 0; i <= 40; i++) { const u = i / 40, kk = keel(u), sh = sheer(u); if (WY <= kk + 0.005 || WY >= sh) continue; const th = Math.acos(1 - (WY - kk) / (sh - kk)), x = Math.pow(Math.sin(th), 0.75) * half(u) * 0.97; left.push([-x, zAt(u)]); right.push([x, zAt(u)]); }
        if (left.length > 2) { const s = new T.Shape(); left.forEach(([x, z], k) => (k ? s.lineTo(x, -z) : s.moveTo(x, -z))); right.reverse().forEach(([x, z]) => s.lineTo(x, -z));
          const mg = new T.ShapeGeometry(s); mg.rotateX(-Math.PI / 2); const mask = new T.Mesh(mg, new T.MeshBasicMaterial({ colorWrite: false, side: T.DoubleSide })); mask.position.y = WY; mask.renderOrder = 10; mask.userData.noWeather = true; mask.material.userData.noWeather = true; g.add(mask); g.userData.mask = mask; } }
      if (g.userData.mask) { g.userData.mask.castShadow = false; g.userData.mask.receiveShadow = false; }
      g.userData.dims = { LEN, BEAM, half, sheer, zAt };
      return g;
    },
    // tie each boat up along the nearest pier: parallel to it, a hand's width off, lines to the posts, fenders between
    place(T, realm, terrain, group, tickers) {
      const piers = RC.Piers.find(terrain), used = new Map(), rope = new T.MeshStandardMaterial({ color: '#c8b088', roughness: 1 }), fenderM = new T.MeshStandardMaterial({ color: '#3a3430', roughness: 0.7 });
      const line = (a, b, sag) => { const mid = a.clone().lerp(b, 0.5); mid.y -= sag; const tube = new T.Mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(a, mid, b), 12, 0.014, 4, false), rope); tube.castShadow = true; group.add(tube); };
      for (const t of realm.things.filter((x) => x.kind === 'boat')) {
        let best = null, bd = 1e9; for (const p of piers) { const d = Math.abs((p.x0 + p.x1) / 2 - t.x); if (d < bd) { bd = d; best = p; } }
        const boat = RC.Boats.build(T, { hull: t.hull, sail: t.sail, seed: RC.hash(t.x, t.z, 3) }), D = boat.userData.dims;
        let x = t.x, z = t.z, side = 1;
        if (best && bd < 40) {   // which side of the pier: the side the boat was nearer; the next boat at the same pier takes the other side
          const prev = used.get(best), n = prev ? prev.n : 0; side = prev ? -prev.side : t.x < (best.x0 + best.x1) / 2 ? -1 : 1; used.set(best, { n: n + 1, side });   // (a second boat ties up on the other side)
          x = side < 0 ? best.x0 - D.BEAM / 2 - 0.28 : best.x1 + D.BEAM / 2 + 0.28;
          z = Math.min(best.zEnd - D.LEN / 2 - 0.4, best.zSea + D.LEN / 2 + 1.2 + n * 0.6);
        }
        boat.position.set(x, terrain.waterY - 0.32, z); boat.rotation.y = (t.facing === 'left' ? Math.PI : 0); group.add(boat); t._obj = boat;
        const bow = t.facing === 'left' ? -1 : 1;
        if (best && bd < 40) {
          // lines from bow and stern to the pier's edge, a little slack; fenders between
          const edgeX = side < 0 ? best.x0 : best.x1, deckY = 0.42;
          for (const end of [0.97, 0.03]) { const lz = z + bow * D.zAt(end), hullX = x - side * D.half(end) * 0.9; line(new T.Vector3(hullX, terrain.waterY - 0.32 + D.sheer(end) + 0.05, lz), new T.Vector3(edgeX, deckY + 0.12, lz + bow * (end > 0.5 ? 0.9 : -0.9)), 0.18); }
          for (const fz of [-0.8, 0.5]) { const f = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.36, 10), fenderM); f.position.set(edgeX + side * 0.12, deckY - 0.3, z + fz); f.castShadow = true; group.add(f); line(new T.Vector3(edgeX + side * 0.12, deckY - 0.12, z + fz), new T.Vector3(edgeX, deckY + 0.05, z + fz), 0.02); }
        }
        const ph = RC.hash(t.x, t.z, 1) * 6, y0 = boat.position.y;
        tickers.push((tm) => { boat.position.y = y0 + Math.sin(tm * 1.1 + ph) * 0.03; boat.rotation.z = Math.sin(tm * 0.9 + ph) * 0.025; boat.rotation.x = Math.sin(tm * 0.7 + ph * 2) * 0.012; });
      }
    },
  };
})();
