// MapCraft: things placed on the land. Each thing is data ({kind, x, z, …}); the engine makes it ("engine-made")
// unless it names a model ("custom", later: models from 3DCraft). Forest cells grow trees; grass and flowers are scattered.
(function () {
  const RC = window.RC;
  const ROOF = { crimson: '#b4232a', cobalt: '#2649b5', terracotta: '#c0562a', emerald: '#1f8a4c' };
  // what blocks walking (cells and circles), and what can be used with Space
  const SOLID = { fountain: 1.95, well: 0.7, statue: 0.6, anvil: 0.5, telescope: 0.4, bell: 0.6, crates: 0.7, dock_cargo: 0.8, campfire: 0.5, station: 0.8, tablet: 0.5, noticeboard: 1.3, sign: 0.5, lamp: 0.2, chest: 0.45, bookshelf: 0.5 };
  const USE = { sign: 'Read', noticeboard: 'Read', tablet: 'Read', statue: 'Look', fountain: 'Look', well: 'Look', crates: 'Search', dock_cargo: 'Search', anvil: 'Look', telescope: 'Look through', bell: 'Ring', campfire: 'Warm up', bookshelf: 'Read', shrub: 'Search', chest: 'Open', forage: 'Gather', station: 'Use' };

  RC.MapCraft = {
    SOLID, USE,
    // the sim's view of the map: blocked cells, solid circles, things you can use
    plan(realm, terrain) {
      const W = realm.w, H = realm.h, blocked = new Uint8Array(W * H), circles = [], usable = [];
      // nothing grows or stands on a bridge or in the brook: shrubs, forage and the like step aside to the nearest dry ground
      const st = terrain.stream, onDeck = (x, z, p) => st.decks.some((d) => x > d.x0 - p && x < d.x1 + p && z > d.z0 - p && z < d.z1 + p);
      if (st) for (const t of realm.things) if ((t.kind === 'shrub' || t.kind === 'forage' || t.kind === 'crates' || t.kind === 'sign') && (st.wet(t.x, t.z, 0.35) || onDeck(t.x, t.z, 0.5))) {
        let best = null; for (let r = 0.6; r < 5 && !best; r += 0.3) for (let a = 0; a < 6.28 && !best; a += 0.4) { const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; if (!st.wet(x, z, 0.4) && !onDeck(x, z, 0.6)) best = [x, z]; }
        if (best) { t.x = best[0]; t.z = best[1]; }
      }
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const k = terrain.paint[r][c]; if (k === '~' || k === 'T' || k === 'L') blocked[r * W + c] = 1; }
      for (const t of realm.things) {
        if (t.kind === 'building') { for (let r = Math.floor(t.z + 0.5); r < t.z + t.d - 0.3; r++) for (let c = t.x; c < t.x + t.w; c++) if (r >= 0 && r < H && c >= 0 && c < W) blocked[r * W + c] = 1; if (t.door) usable.push({ kind: 'door', thing: t, x: t.door.x, z: t.door.z + 0.6, verb: 'Enter', name: t.name }); continue; }
        if (t.kind === 'boat') continue;
        if (SOLID[t.kind]) circles.push({ x: t.x, z: t.z, r: SOLID[t.kind] });
        if (USE[t.kind]) usable.push({ kind: t.kind, thing: t, x: t.x, z: t.z, verb: USE[t.kind], name: t.title || t.name || (t.kind === 'shrub' ? 'Shrub' : t.kind === 'chest' ? 'Chest' : t.kind) });
      }
      for (const d of realm.doors || []) usable.push({ kind: 'gate', thing: d, x: d.x, z: d.z + 1, verb: 'Go', name: d.label });
      return { blocked, circles, usable };
    },

    // ---------------------------------------------------------------- drawing
    build(THREE, realm, terrain, shared) {
      const g = new THREE.Group(), labels = [], tickers = [], buildings = [];
      const Y = (x, z) => terrain.groundY(x, z);
      const M = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o || {}));
      const mats = { wood: M('#8b5a2b'), darkWood: M('#4a2c14'), stone: M('#9aa3ad'), darkStone: M('#5b6470'), iron: M('#3b4350', { metalness: 0.7, roughness: 0.4 }), brass: M('#d69e2e', { metalness: 0.8, roughness: 0.3 }), white: M('#f3efe6'), leaf: M('#3f8f3a', { flatShading: true }),
        glow: new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 0.4 }), glass: new THREE.MeshStandardMaterial({ color: '#1e2328', emissive: '#ffcf7a', emissiveIntensity: 0.05, roughness: 0.9 }),
        pane: new THREE.MeshStandardMaterial({ color: '#b8ccd6', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.8, depthWrite: false }) };
      const curtainMats = ['#e8dcc0', '#b8483a', '#5a6a8a', '#d8c890', '#7a8a5a', '#f0ece4'].map((c) => M(c, { emissive: c, emissiveIntensity: 0, roughness: 0.95, side: THREE.DoubleSide }));
      const chimneys = [], eaves = [], aged = [], afterPlace = []; RC.Aging.shared = shared;
      shared.night = shared.night || { value: 0 };
      tickers.push((t, s) => { mats.glow.emissiveIntensity = 0.35 + s.night * 2.2; mats.glass.emissiveIntensity = 0.05 + s.night * 1.1; for (const c of curtainMats) c.emissiveIntensity = s.night * 0.28; });
      const add = (obj, x, z, rot) => { obj.position.set(x, Y(x, z), z); if (rot) obj.rotation.y = rot; obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(obj); return obj; };
      const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o; };
      const cyl = (r1, r2, h, m, seg = 12, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y + h / 2, z); return o; };
      const sway = (mat, strength) => {   // wind: tops move, trunks stay (instanced)
        mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind;
          sh.vertexShader = 'uniform float uTime; uniform vec3 uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
            vec2 ip = instanceMatrix[3].xz;
            #else
            vec2 ip = vec2(0.0);
            #endif
            float sw = max(position.y, 0.0) * ${strength.toFixed(3)} * (0.6 + uWind.z);
            transformed.x += (sin(uTime * 1.6 + ip.x * 0.7 + ip.y * 0.3) * 0.5 + uWind.x * 0.6) * sw;
            transformed.z += (cos(uTime * 1.3 + ip.y * 0.6) * 0.35 + uWind.y * 0.6) * sw;`); };
        return mat;
      };
      const label = (text, x, y, z, kind) => labels.push({ text, x, y, z, kind: kind || 'place' });

      // ---- trees, brush, grass, reeds, rocks (rc-flora.js)
      const flora = RC.Flora.plant(THREE, realm, terrain, shared); g.add(flora.group); tickers.push(...flora.tickers);
      const tm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();

      // ---- piers: real decks with boards, a ramp from the land, posts and braces (rc-pier.js)
      g.add(RC.Piers.build(THREE, terrain, shared));

      // ---- buildings
      const surf = (k) => RC.Tex.surface(THREE, k);
      const real = (n, fb) => { const x = RC.Tex.real(THREE, n); return x ? { map: x.map, normalMap: x.normalMap, arm: x.arm, m: x.meters[0] } : Object.assign({ m: 2.4 }, fb); };
      const WT = { plaster: real('plaster', surf('plaster')), plasterWorn: real('plaster_worn', surf('plaster')), timber: real('plaster', surf('timber')), stone: real('stone_wall', surf('stone')), darkstone: real('castle_wall', surf('darkstone')), brick: real('red_brick', surf('stone')) }, RT = Object.assign({ m: 2.2 }, surf('roof'));
      const GRAN = real('rock_lichen', surf('stone')), GRANM = M('#f2eee6', { map: GRAN.map, normalMap: GRAN.normalMap, roughness: 0.95 });
      const OAK = real('planks_oak', null), PAINT = ['#f4ecdc', '#efe0b8', '#ead2aa', '#dfe7ea', '#f2dcd2', '#e7e2c8', '#d9e4cf'];
      const woodM = (tint, sx = 1, sy = 1) => { if (!OAK) return M(tint); const r2 = (tx) => { const c = tx.clone(); c.needsUpdate = true; c.repeat.set(sx, sy); return c; }; return M(tint, { map: r2(OAK.map), normalMap: r2(OAK.normalMap), roughness: 0.85 }); };
      const beamM = woodM('#6b4a30', 0.3, 1), doorM = woodM('#8a5a34', 0.6, 0.9), frameM = woodM('#5a3c26', 0.4, 0.4);
      const ROOFT = { crimson: real('roof_clay', RT), terracotta: real('roof_clay', RT), cobalt: real('roof_slate', RT), emerald: real('roof_slate', RT) };
      const ROOFTINT = { crimson: '#ffffff', terracotta: '#f0b090', cobalt: '#9fb4e6', emerald: '#9fd4b0' };

      const STYLE = {
        one_story_cottage: { wall: 'timber', h: 2.9, roof: 1.7 }, two_story_timber: { wall: 'timber', h: 3.8, roof: 1.8 }, smithery_foundry: { wall: 'darkstone', h: 3.2, roof: 1.5, bigChimney: true },
        observatory_parlor: { wall: 'plaster', h: 3.2, roof: 1.6, tower: true }, grand_guildhall: { wall: 'stone', h: 4.0, roof: 1.9, columns: true }, l_wing_inn: { wall: 'timber', h: 3.4, roof: 1.7, wing: true },
        apothecary_conservatory: { wall: 'plaster', h: 3.1, roof: 1.6, glasshouse: true }, longhouse_tavern: { wall: 'timber', h: 2.9, roof: 2.3, barrels: true },
      };
      const roof = (w, d, h, mat, wallMat, tex, tint) => {   // w along the ridge, d across, h tall
        const o = new THREE.Group(), half = d / 2, ov = 0.35, run = half + ov, Ls = Math.hypot(run, h * (run / half)), ang = Math.atan2(h, half), L = w + 0.5;
        for (const s of [-1, 1]) {
          const m = mat.clone(); if (m.map) { m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(L / tex.m, Ls / tex.m); } if (m.normalMap) { m.normalMap = mat.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(L / tex.m, Ls / tex.m); }
          const sg = new THREE.BoxGeometry(L, 0.09, Ls, 12, 1, 4), sp = sg.attributes.position;
          for (let i = 0; i < sp.count; i++) { const fx = sp.getX(i) / (L / 2), fz = sp.getZ(i) / (Ls / 2); sp.setY(i, sp.getY(i) - 0.06 * (1 - fx * fx) * (1 - Math.abs(fz) * 0.3) + Math.sin(sp.getX(i) * 3.1 + s) * 0.008); }
          sg.computeVertexNormals(); const slope = new THREE.Mesh(sg, m); slope.rotation.order = 'YXZ'; slope.rotation.x = s * ang;
          slope.position.set(0, h - (run / 2) * Math.tan(ang), s * run / 2); o.add(slope); o.userData.mats = (o.userData.mats || []).concat(m);   // (ridge down past the wall: the overhang)
          const fas = new THREE.Mesh(new THREE.BoxGeometry(L, 0.16, 0.06), beamM); fas.position.set(0, h - run * Math.tan(ang) - 0.06, s * run); o.add(fas);   // the eave board
        }
        const tri = new THREE.Shape(); tri.moveTo(-half + 0.1, -0.08); tri.lineTo(half - 0.1, -0.08); tri.lineTo(half - 0.1, 0.1 * h / half); tri.lineTo(0, h); tri.lineTo(-half + 0.1, 0.1 * h / half); tri.lineTo(-half + 0.1, -0.08);
        for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ShapeGeometry(tri), wallMat); e.rotation.y = s * Math.PI / 2; e.position.x = s * (w / 2 - 0.1 + 0.004); o.add(e); }   // (the gable ends in the wall's own plane, reaching down over its top: no seam)
        for (const s of [-1, 1]) {   // trim: a board across the gable's foot where it meets the wall, and barge boards up both sloped edges
          const gx = s * (w / 2 - 0.1 + 0.035), foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, d - 0.1), beamM); foot.position.set(gx, -0.02, 0); o.add(foot);
          // the gable's timber frame: a king post, a collar across, braces down to the foot (stucco between)
          const beam = (z0, y0, z1, y1, wd = 0.12) => { const L = Math.hypot(z1 - z0, y1 - y0), bm2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, L, wd), beamM); bm2.rotation.x = Math.atan2(z1 - z0, y1 - y0); bm2.position.set(gx, (y0 + y1) / 2, (z0 + z1) / 2); o.add(bm2); };
          const hw2 = half - 0.1, cy = h * 0.42, cz = hw2 * (1 - cy / h) - 0.04;
          beam(0, 0, 0, h - 0.08, 0.14); beam(-cz, cy, cz, cy); beam(-hw2 * 0.62, 0.04, -0.07, cy * 0.92); beam(hw2 * 0.62, 0.04, 0.07, cy * 0.92);
          for (const k of [-1, 1]) { const bb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, Ls), beamM); bb.rotation.x = k * ang; bb.position.set(s * (L / 2 - 0.03), h - (run / 2) * Math.tan(ang) - 0.1, k * run / 2); o.add(bb); }   // barge boards: under the roof's edge, the same slope and length as the roof
        }   // the gable ends
        const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, L, 10, 1, false, 0, Math.PI), M(tint, { roughness: 0.7 })); ridge.rotation.z = Math.PI / 2; ridge.rotation.y = 0; ridge.position.y = h + 0.03; o.add(ridge);
        o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
        return o;
      };
      const gable = (w, d, h, mat) => { const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.lineTo(-d / 2, 0); const ge = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); ge.rotateY(Math.PI / 2); ge.translate(-w / 2, 0, 0); return new THREE.Mesh(ge, mat); };
      for (const b of realm.things.filter((t) => t.kind === 'building')) {
        const st = STYLE[b.style] || STYLE.one_story_cottage, grp = new THREE.Group(), fadeMats = [];
        const z0 = b.z + 0.5, z1 = b.z + b.d - 0.25, D = z1 - z0, cx = b.x + b.w / 2, cz = (z0 + z1) / 2, W = b.w - 0.3;
        const rep = (tx, x, y) => { const c = tx.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; };
        // each house its own wall plan: stucco, timbered, brick, or layered (stone or brick below, timber or stucco above)
        const soft = st.wall === 'plaster' || st.wall === 'timber', plans = ['stucco', 'timber', 'brick', 'stone_timber', 'brick_stucco', 'stone_stucco', 'timber'], plan = soft ? plans[Math.floor(RC.hash(b.x, b.z, 41) * plans.length)] : st.wall;
        const upperKind = plan === 'brick' ? 'brick' : plan === 'stucco' || plan.endsWith('_stucco') ? 'plaster' : soft ? 'timber' : st.wall, lowerKind = plan.startsWith('stone_') ? 'stone' : plan.startsWith('brick_') ? 'brick' : null;
        const lowH = st.h > 3.2 ? st.h * 0.5 : Math.min(1.25, st.h * 0.48);
        const worn = RC.hash(b.x, b.z, 17) < 0.35, wt = upperKind === 'brick' ? WT.brick : (upperKind === 'plaster' || upperKind === 'timber') && worn ? WT.plasterWorn : WT[upperKind], rt = ROOFT[b.roof] || RT, realRoof = rt !== RT;
        const paint = upperKind === 'plaster' || upperKind === 'timber' ? PAINT[Math.floor(RC.hash(b.x, b.z, 23) * PAINT.length)] : '#ffffff';
        const wallM = M(paint, { map: rep(wt.map, W / wt.m, st.h / wt.m), normalMap: rep(wt.normalMap, W / wt.m, st.h / wt.m), roughness: 0.92 });
        if (wt.arm) { wallM.roughnessMap = rep(wt.arm, W / 2.6, st.h / 2.6); wallM.roughness = 1; }
        const roofM = M(realRoof ? ROOFTINT[b.roof] : ROOF[b.roof] || '#b4232a', { map: rt.map, normalMap: rt.normalMap, roughness: 0.75 }); fadeMats.push(wallM);
        const seedB = RC.hash(b.x, b.z, 77), rB = RC.rng(seedB), lean = (rB() - 0.5) * 0.03;
        { const wg = new THREE.BoxGeometry(W, st.h, D, Math.ceil(W / 0.5), Math.ceil(st.h / 0.5), Math.ceil(D / 0.5)), wp = wg.attributes.position;   // bellied a touch between the corners, leaning a hair
          for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), y = wp.getY(i) + st.h / 2, z = wp.getZ(i), ex = 1 - Math.pow(Math.abs(x) / (W / 2), 4), ez = 1 - Math.pow(Math.abs(z) / (D / 2), 4), ey = Math.sin(Math.PI * y / st.h);
            const bz = Math.abs(z) > D / 2 - 0.001 ? Math.sign(z) * ex * ey * (0.01 + RC.vnoise(x + b.x, y, 1.3, 9) * 0.012) : 0, bx = Math.abs(x) > W / 2 - 0.001 ? Math.sign(x) * ez * ey * (0.01 + RC.vnoise(z + b.z, y, 1.3, 8) * 0.012) : 0;
            wp.setXYZ(i, x + bx + y * lean, wp.getY(i), z + bz); }
          wg.computeVertexNormals(); const wm = new THREE.Mesh(wg, wallM); wm.position.y = st.h / 2; grp.add(wm); }
        aged.push([RC.age(THREE, wallM, { kind: upperKind === 'brick' || upperKind === 'stone' || upperKind === 'darkstone' ? 1 : 0, top: st.h, seed: seedB * 10, brick: WT.brick }), 0.3]);
        const ridgeTint = { crimson: '#8a3a2a', terracotta: '#b0603a', cobalt: '#3a4a6a', emerald: '#3a5a46' }[b.roof] || '#6a4a3a';
        const GP = WT.plaster, gableM = M(upperKind === 'plaster' || upperKind === 'timber' ? paint : PAINT[Math.floor(RC.hash(b.x, b.z, 24) * PAINT.length)], { map: rep(GP.map, 1 / GP.m, 1 / GP.m), normalMap: rep(GP.normalMap, 1 / GP.m, 1 / GP.m), roughness: 0.92 });
        aged.push([RC.age(THREE, gableM, { kind: 0, top: st.h + st.roof, seed: seedB * 10 + 7, brick: WT.brick }), st.h - 0.5]); fadeMats.push(gableM);
        const rf = roof(W + 0.2, D + 0.2, st.roof, roofM, gableM, rt, ridgeTint); rf.position.y = st.h; grp.add(rf); fadeMats.push(...rf.userData.mats);
        for (const m of rf.userData.mats) aged.push([RC.age(THREE, m, { kind: 3, top: st.h + st.roof, seed: seedB * 5 }), st.h]);   // moss and lichen on the tiles, more toward the eaves
        const stoneM = (w2, h2) => { const lt = WT.stone; return M('#ffffff', { map: rep(lt.map, w2 / lt.m, h2 / lt.m), normalMap: rep(lt.normalMap, w2 / lt.m, h2 / lt.m), roughness: 0.92 }); };
        if (lowerKind) { const lt = WT[lowerKind], lm = M('#ffffff', { map: rep(lt.map, W / lt.m, lowH / lt.m), normalMap: rep(lt.normalMap, W / lt.m, lowH / lt.m), roughness: 0.92 }); grp.add(box(W + 0.06, lowH, D + 0.06, lm, 0, 0, 0)); fadeMats.push(lm); aged.push([RC.age(THREE, lm, { kind: 1, top: st.h, seed: seedB * 10 + 3 }), 0.3]); }   // a stone or brick ground floor
        if (upperKind === 'plaster') { const qm = stoneM(0.4, st.h); for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = lowerKind ? lowH : 0, k = 0; y < st.h - 0.2; y += 0.42, k++) grp.add(box(k % 2 ? 0.34 : 0.48, 0.38, k % 2 ? 0.48 : 0.34, qm, qx * (W / 2 - 0.1), y, qz * (D / 2 - 0.1))); }   // corner stones on the stucco
        if (upperKind === 'timber') {   // half-timbering: posts, rails and braces (some single, some an X) standing proud of the stucco
          const T2 = 0.13, faces = [[0, D / 2 + 0.03, W, 0], [0, -D / 2 - 0.03, W, 0], [W / 2 + 0.03, 0, D, Math.PI / 2], [-W / 2 - 0.03, 0, D, Math.PI / 2]];
          for (const [fx, fz, span, rot] of faces) {
            const f = new THREE.Group(); f.position.set(fx, 0, fz); f.rotation.y = rot; grp.add(f);
            const n = Math.max(2, Math.round(span / 1.25)), rails = st.h > 3.2 ? [0.05, st.h * 0.5, st.h - 0.08] : [0.05, st.h - 0.08];
            for (let i = 0; i <= n; i++) f.add(box(T2, st.h, 0.06, beamM, -span / 2 + (i / n) * span, 0, 0));
            for (const y of rails) f.add(box(span + 0.1, T2, 0.07, beamM, 0, y - T2 / 2, 0));
            for (let i = 0; i < n; i++) { const pick = RC.hash(i, b.x + fx, 31); if (pick > 0.6) continue; const pw = span / n, lo = Math.max(lowerKind ? lowH : 0, rails[rails.length - 2]), hi = rails[rails.length - 1], len = Math.hypot(pw, hi - lo);
              for (const sgn of pick < 0.25 ? [1, -1] : [RC.hash(i, 3, 37) < 0.5 ? 1 : -1]) { const br = box(0.1, len, 0.05, beamM, -span / 2 + (i + 0.5) * pw, lo + (hi - lo) / 2 - len / 2, 0); br.rotation.z = sgn * Math.atan2(pw, hi - lo); f.add(br); } }
          }
        }
        { const fnd = RC.Aging.foundation(THREE, W, D, 0.45, GRAN, seedB * 100, [(b.door ? b.door.x - cx : 0) - 0.75, (b.door ? b.door.x - cx : 0) + 0.75]); grp.add(fnd); aged.push([RC.age(THREE, fnd.material, { kind: 1, top: 0.45, seed: seedB }), -0.1]); }   // a foundation of small stone blocks
        if (b.chimney) { const cw = st.bigChimney ? 1 : 0.6, chH = st.roof + 1.2, cm = stoneM(cw, chH); aged.push([RC.age(THREE, cm, { kind: 1, top: st.h + chH, seed: seedB * 7 }), st.h + 0.2]); chimneys.push({ lx: W * 0.28, ly: st.h + chH + 0.35, lz: -D * 0.15, big: !!st.bigChimney, seed: seedB }); grp.add(box(cw, chH, cw, cm, W * 0.28, st.h, -D * 0.15)); grp.add(box(cw + 0.16, 0.12, cw + 0.16, cm, W * 0.28, st.h + chH, -D * 0.15)); grp.add(cyl(0.1, 0.12, 0.28, M('#9a5a3a'), 8, W * 0.28, st.h + chH + 0.12, -D * 0.15)); if (st.bigChimney) grp.add(box(0.6, 0.15, 0.6, mats.glow, W * 0.28, st.h + st.roof + 1.2, -D * 0.15)); }
        // front: door and windows (glowing at night)
        const front = D / 2 + 0.01, dx = b.door ? b.door.x - cx : 0;
        // the doorway: the floor inside is the top of the foundation (FT), so the door starts there; stone steps lead up to it
        const FT = 0.32, DH = Math.min(2.0, st.h - FT - 0.5), holes = [[dx - 0.85, -0.2, dx + 0.85, FT + DH + 0.4]], stoneWall = upperKind !== 'timber' || lowerKind, REV = 0.24;   // (REV: how far the frame stands out: the door sits back in it)
        for (let k = 0; k < 5; k++) grp.add(box(0.188, DH - 0.01 - rB() * 0.02, 0.05, doorM, dx - 0.4 + k * 0.2, FT + 0.01, front + 0.03));   // boards, a hair apart
        grp.add(box(1.0, DH + FT, 0.02, mats.glass, dx, 0, front + 0.012));   // (dark behind the gaps)
        for (const y2 of [0.18, DH * 0.5, DH - 0.3]) grp.add(box(0.9, 0.1, 0.035, doorM, dx, FT + y2, front + 0.07));   // ledges across the boards
        if (stoneWall) {   // jambs of dressed stone blocks, long and short in turn, and a lintel with a keystone
          for (const s of [-1, 1]) for (let y = FT, k = 0; y < FT + DH - 0.05; k++) { const bh = Math.min(0.32 + rB() * 0.1, FT + DH - y), bw = k % 2 ? 0.24 : 0.36, jb = new THREE.Mesh(RC.roughBox(THREE, bw, bh - 0.015, REV + 0.06, 0.025, rB), GRANM); jb.position.set(dx + s * (0.5 + bw / 2), y + bh / 2, front + REV / 2 - 0.02); grp.add(jb); y += bh; }
          const ln = new THREE.Mesh(RC.roughBox(THREE, 1.75, 0.32, REV + 0.08, 0.03, rB), GRANM); ln.position.set(dx, FT + DH + 0.16, front + REV / 2 - 0.01); grp.add(ln);
          const ks = new THREE.Mesh(RC.roughBox(THREE, 0.24, 0.38, REV + 0.12, 0.02, rB), GRANM); ks.position.set(dx, FT + DH + 0.18, front + REV / 2); grp.add(ks);
        } else {   // heavy oak posts and a lintel beam, pegged
          for (const s of [-1, 1]) grp.add(box(0.18, DH, REV, beamM, dx + s * 0.59, FT, front + REV / 2 - 0.02));
          grp.add(box(1.6, 0.24, REV + 0.04, beamM, dx, FT + DH, front + REV / 2 - 0.02));
          for (const s of [-1, 1]) { const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8).rotateX(Math.PI / 2), mats.darkWood); peg.position.set(dx + s * 0.59, FT + DH + 0.12, front + REV + 0.02); grp.add(peg); }
        }
        // the steps: two treads of rough stone, each a normal step (about 16 cm up, 35 cm deep), the top one level with the threshold,
        // both a little wider than the doorway and running down into the ground; worn smooth and dipped in the middle where feet go
        const stepT = (w, top, z0, z1) => { const g2 = RC.roughBox(THREE, w, top + 0.5, z1 - z0, 0.03, rB), sp = g2.attributes.position, hh = (top + 0.5) / 2;
          for (let i = 0; i < sp.count; i++) if (sp.getY(i) > hh - 0.01) sp.setY(i, sp.getY(i) - 0.018 * Math.exp(-(sp.getX(i) * sp.getX(i)) / 0.12));
          g2.computeVertexNormals(); const m = new THREE.Mesh(g2, GRANM); m.position.set(dx, top - hh, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; grp.add(m); };
        stepT(1.5, FT, front - 0.02, front + REV + 0.36);   // the top step, under the door and out past the frame
        stepT(1.85, FT / 2, front + REV + 0.36, front + REV + 0.72);
        const hood = !st.columns && rB() < 0.55;   // (a porch has its own roof)
        if (hood) {   // a small pent hood over the door: boards sloping away from the wall, an edge board, and two straight struts back to the wall
          const hm = roofM.clone(); if (hm.map) { hm.map = roofM.map.clone(); hm.map.needsUpdate = true; hm.map.repeat.set(1.9 / rt.m, 0.9 / rt.m); } if (hm.normalMap) { hm.normalMap = roofM.normalMap.clone(); hm.normalMap.needsUpdate = true; hm.normalMap.repeat.set(1.9 / rt.m, 0.9 / rt.m); }
          const hw = 1.9, hd = 0.95, hy = FT + DH + 0.44, hr = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.07, hd), hm), tilt = 0.32;
          hr.rotation.x = tilt; hr.position.set(dx, hy - Math.sin(tilt) * hd / 2, front + Math.cos(tilt) * hd / 2 + 0.03); hr.castShadow = true; grp.add(hr); fadeMats.push(hm);
          const edge = box(hw + 0.06, 0.1, 0.05, beamM, dx, hy - Math.sin(tilt) * hd - 0.1, front + Math.cos(tilt) * hd + 0.03); grp.add(edge);   // the edge board
          const back = box(hw + 0.06, 0.14, 0.06, beamM, dx, hy - 0.04, front + 0.04); grp.add(back);   // a rail where it meets the wall
          for (const sx of [-0.8, 0.8]) { const len = Math.hypot(0.8, 0.55), st3 = box(0.07, len, 0.07, beamM), ang2 = Math.atan2(0.8, 0.55); st3.rotation.x = ang2; st3.position.set(dx + sx, hy - 0.55 - 0.04, front + 0.5); st3.position.y = hy - 0.5 - len / 2 + 0.3; grp.add(st3); }
        }
        for (const sy of [FT + 0.42, FT + DH - 0.42]) { grp.add(box(0.78, 0.055, 0.02, mats.iron, dx - 0.08, sy, front + 0.09)); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mats.iron); knob.position.set(dx - 0.47, sy + 0.027, front + 0.1); grp.add(knob); }   // strap hinges
        { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 6, 14), mats.iron); ring.position.set(dx + 0.3, FT + 1.0, front + 0.11); grp.add(ring); const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 10).rotateX(Math.PI / 2), mats.iron); plate.position.set(dx + 0.3, FT + 1.07, front + 0.1); grp.add(plate); }
        const shutters = st.wall === 'timber' || st.wall === 'plaster', shutM = RC.age(THREE, woodM(['#6a8aa8', '#7a9a6a', '#a85a44', '#7a7a8a', '#5a7a6a'][Math.floor(RC.hash(b.x, b.z, 29) * 5)], 0.3, 0.6), { kind: 2, seed: seedB * 3 }); aged.push([shutM, 0]);
        const curt = rB() < 0.75 ? [curtainMats[Math.floor(rB() * curtainMats.length)]] : null;
        const sill = stoneM(1.1, 0.12), flowersM = [M('#d94a6a'), M('#f2c94c'), M('#ffffff'), M('#9b59d0')];
        const win = (wx, wy) => {   // set into the wall: dark glass a little behind the face, oak frame and bars, stone sill and lintel, shutters, sometimes a flower box
          holes.push([wx - 0.5, wy - 0.4, wx + 0.5, wy + 1.0]);
          // the room behind (dark by day, lit at night), curtains drawn to the sides, then the glass with the sky in it, in a deep box frame
          grp.add(box(0.78, 0.8, 0.01, mats.glass, wx, wy, front + 0.026));
          if (curt) for (const s of [-1, 1]) { const cw = 0.16 + rB() * 0.14, cu = new THREE.Mesh(new THREE.PlaneGeometry(cw, 0.78, 3, 1), curt[0]); const cp = cu.geometry.attributes.position; for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 40) * 0.006); cu.geometry.computeVertexNormals(); cu.position.set(wx + s * (0.39 - cw / 2), wy + 0.4, front + 0.04); grp.add(cu); }
          { const pn = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.8), mats.pane); pn.position.set(wx, wy + 0.4, front + 0.058); grp.add(pn); }
          for (const [w2, h2, x2, y2, dz] of [[0.96, 0.08, 0, -0.06, 0.12], [0.96, 0.09, 0, 0.79, 0.12], [0.09, 0.94, -0.435, -0.06, 0.12], [0.09, 0.94, 0.435, -0.06, 0.12], [0.03, 0.8, 0, 0, 0.03], [0.78, 0.025, 0, 0.26, 0.03], [0.78, 0.025, 0, 0.53, 0.03]]) grp.add(box(w2, h2, dz, frameM, wx + x2, wy + y2, front + (dz > 0.05 ? 0.05 : 0.066)));
          { const sl = new THREE.Mesh(RC.roughBox(THREE, 1.12, 0.08, 0.24, 0.02, rB), sill); sl.position.set(wx, wy - 0.1, front + 0.1); sl.rotation.x = 0.05; grp.add(sl); }
          if (upperKind === 'timber') grp.add(box(1.1, 0.14, 0.12, beamM, wx, wy + 0.86, front + 0.04)); else { const ln = new THREE.Mesh(RC.roughBox(THREE, 1.16, 0.18, 0.16, 0.02, rB), sill); ln.position.set(wx, wy + 0.95, front + 0.06); grp.add(ln); }
          if (shutters) for (const s of [-1, 1]) { const open = rB() < 0.75 ? 0.04 + rB() * 0.12 : 0.5 + rB() * 0.9, sh = RC.Aging.shutter(THREE, 0.4, 0.86, shutM, shutM, -s, open, seedB + wx + s); sh.position.set(wx + s * 0.48, wy - 0.06, front + 0.07); grp.add(sh); }
          if (RC.hash(wx * 7, wy + b.x, 51) < 0.45 && wy < 1.5) { const pl = RC.Aging.planter(THREE, 0.92, beamM, seedB * 50 + wx * 3, rB() < 0.85 ? [['#d94a6a', '#f2a0b0'], ['#f2c94c', '#f0a030'], ['#ffffff', '#e8e0f0'], ['#9b59d0', '#c090e0'], ['#e04030', '#ff7050']][Math.floor(rB() * 5)] : null); pl.position.set(wx, wy - 0.32, front + 0.2); grp.add(pl); }
        };
        for (let i = 0; i < Math.floor(W / 2.2); i++) { const wx = -W / 2 + 1.1 + i * 2.2; if (Math.abs(wx - dx) < 1.2) continue; win(wx, 0.9); if (st.h > 3.2) win(wx, 2.4); }
        if (st.tower) { const tw = cyl(1.1, 1.1, st.h + 2.2, wallM, 14, W / 2 - 0.6, 0, -D / 2 + 0.8); grp.add(tw); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.8, 14), roofM); cone.position.set(W / 2 - 0.6, st.h + 3.1, -D / 2 + 0.8); grp.add(cone); grp.add(box(0.5, 0.5, 0.1, mats.glass, W / 2 - 0.6, st.h + 1.2, -D / 2 + 1.91)); }
        let porchBeam = null;
        if (st.columns) {   // a porch: columns between the door and the windows (never in front of them), a beam on their heads, a tiled lean-to roof back to the wall
          const sm = WT.darkstone.map ? M('#efe8dc', { map: rep(WT.darkstone.map, 0.6, 1.2), normalMap: rep(WT.darkstone.normalMap, 0.6, 1.2), roughness: 0.9 }) : M('#e8e2d4');
          const opens = [dx]; for (let i = 0; i < Math.floor(W / 2.2); i++) { const wx = -W / 2 + 1.1 + i * 2.2; if (Math.abs(wx - dx) >= 1.2) opens.push(wx); } opens.sort((a, b) => a - b);
          const cols = [-W / 2 + 0.35]; for (let i = 0; i < opens.length - 1; i++) cols.push((opens[i] + opens[i + 1]) / 2); cols.push(W / 2 - 0.35);
          const CH = Math.min(st.h - 0.9, 2.75), PD = 1.7, cz = front + PD - 0.25;
          for (const px of cols) { grp.add(box(0.5, 0.2, 0.5, sm, px, 0, cz)); grp.add(cyl(0.17, 0.2, CH - 0.42, sm, 14, px, 0.2, cz)); grp.add(box(0.46, 0.22, 0.46, sm, px, CH - 0.22, cz)); }
          grp.add(box(W + 0.3, 0.26, 0.34, beamM, 0, CH, cz));   // the beam across the column heads
          porchBeam = { y: CH, z: cz };
          const rise = 0.55, run = PD + 0.15, ang = Math.atan2(rise, run), Lr = Math.hypot(rise, run) + 0.25;
          const pm = roofM.clone(); if (pm.map) { pm.map = roofM.map.clone(); pm.map.needsUpdate = true; pm.map.repeat.set((W + 0.6) / rt.m, Lr / rt.m); } if (pm.normalMap) { pm.normalMap = roofM.normalMap.clone(); pm.normalMap.needsUpdate = true; pm.normalMap.repeat.set((W + 0.6) / rt.m, Lr / rt.m); }
          const pr = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.08, Lr), pm); pr.rotation.x = ang; pr.position.set(0, CH + 0.26 + rise / 2 - 0.05, front + run / 2 + 0.08); pr.castShadow = true; grp.add(pr); fadeMats.push(pm);
          grp.add(box(W + 0.6, 0.14, 0.08, beamM, 0, CH + 0.26 + rise - 0.06, front + 0.04));   // where it meets the wall: a ledger board
          for (const px of cols) { const rf = box(0.08, 0.12, run + 0.2, beamM, px, CH + 0.26, front + run / 2); rf.rotation.x = ang; grp.add(rf); }   // rafters over each column
        }
        if (st.wing) { const wg = box(3.2, st.h - 0.8, D * 0.6, wallM, W / 2 + 1.4, 0, -D * 0.15); grp.add(wg); const wr = roof(D * 0.6, 3.2, 1.3, roofM, gableM, rt, ridgeTint); wr.rotation.y = Math.PI / 2; wr.position.set(W / 2 + 1.4, st.h - 0.8, -D * 0.15); grp.add(wr); fadeMats.push(...wr.userData.mats); }
        if (st.glasshouse) {   // a glasshouse on the side: a low brick wall, white-painted glazing bars, small panes, a glass roof with a ridge, plants inside on staging and in pots
          const GW = 2.6, GD = D * 0.72, GH = 2.0, RH = 0.9, gx = -W / 2 - GW / 2 - 0.02, base = 0.5, bars = M('#eeeae0', { roughness: 0.6 });
          const glass = new THREE.MeshStandardMaterial({ color: '#d8ece4', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
          const bm = WT.brick && WT.brick.map ? M('#ffffff', { map: rep(WT.brick.map, 3, 0.25), normalMap: rep(WT.brick.normalMap, 3, 0.25) }) : M('#9a5a44');
          // on whichever side is clear (the herbalist's cauldron and the like stand beside it, not in it)
          const inWay = (x0) => realm.things.some((o) => o !== b && o.kind !== 'forage' && o.kind !== 'building' && Math.abs(o.x - (cx + x0)) < GW / 2 + 0.9 && Math.abs(o.z - cz) < GD / 2 + 0.9), side = inWay(gx) && !inWay(-gx) ? -1 : 1;
          const gh = new THREE.Group(); gh.position.set(gx * side, 0, 0); gh.scale.x = side; grp.add(gh);
          for (const [w2, d2, x2, z2] of [[GW, 0.22, 0, GD / 2], [GW, 0.22, 0, -GD / 2], [0.22, GD, -GW / 2, 0]]) gh.add(box(w2, base, d2, bm, x2, 0, z2));   // the low wall
          { const cm = M('#d8d0c0'); for (const [w2, d2, x2, z2] of [[GW + 0.06, 0.28, 0, GD / 2], [GW + 0.06, 0.28, 0, -GD / 2], [0.28, GD, -GW / 2, 0]]) gh.add(box(w2, 0.06, d2, cm, x2, base, z2)); }   // its coping
          gh.add(box(GW - 0.2, 0.03, GD - 0.2, bm, 0, 0.01, 0));   // a brick floor
          const pane = (w2, h2, x2, y2, z2, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), glass); p.position.set(x2, y2, z2); p.rotation.y = ry; gh.add(p); };
          const wallH = GH - base;
          for (const [span, fx, fz, ry] of [[GW, 0, GD / 2, 0], [GW, 0, -GD / 2, 0], [GD, -GW / 2, 0, Math.PI / 2]]) {   // three glazed sides (the fourth is the house)
            const n = Math.round(span / 0.45); pane(span, wallH, fx, base + wallH / 2, fz, ry);
            for (let i = 0; i <= n; i++) { const o = -span / 2 + (i / n) * span, b2 = box(0.05, wallH, 0.05, bars, ry ? fx : fx + o, base, ry ? fz + o : fz); gh.add(b2); }
            for (const yy of [base + wallH * 0.5, GH - 0.03]) gh.add(box(ry ? 0.05 : span, 0.05, ry ? span : 0.05, bars, fx, yy, fz));
          }
          // the roof: two glass slopes from the eaves up to a ridge, with rafters
          const half = GD / 2, ang = Math.atan2(RH, half), Ls = Math.hypot(half, RH);
          for (const s of [-1, 1]) { const rp = new THREE.Mesh(new THREE.BoxGeometry(GW, 0.01, Ls), glass); rp.rotation.x = s * ang; rp.position.set(0, GH + RH / 2, s * half / 2); gh.add(rp);
            for (let i = 0, n = Math.round(GW / 0.45); i <= n; i++) { const rf2 = box(0.045, 0.05, Ls, bars); rf2.rotation.x = s * ang; rf2.position.set(-GW / 2 + (i / n) * GW, GH + RH / 2 - 0.02, s * half / 2); gh.add(rf2); } }
          gh.add(box(GW + 0.1, 0.08, 0.08, bars, 0, GH + RH - 0.04, 0));   // the ridge
          { const tri = new THREE.Shape(); tri.moveTo(-half, 0); tri.lineTo(half, 0); tri.lineTo(0, RH); const gt = new THREE.Mesh(new THREE.ShapeGeometry(tri), glass); gt.rotation.y = Math.PI / 2; gt.position.set(-GW / 2, GH, 0); gh.add(gt); }   // the glazed gable end
          // inside: slatted staging along the back with trays of seedlings, and big pots on the floor
          gh.add(box(GW - 0.4, 0.05, 0.5, beamM, 0.05, 0.85, -GD / 2 + 0.4)); for (const lx of [-GW / 2 + 0.35, GW / 2 - 0.3]) gh.add(box(0.05, 0.85, 0.45, beamM, lx, 0, -GD / 2 + 0.4));
          for (let i = 0; i < 3; i++) { const pl = RC.Aging.planter(THREE, 0.62, beamM, seedB * 70 + i, [['#f0f0f0', '#e8d0f0'], ['#f2c94c'], ['#e04060']][i]); pl.position.set(-0.7 + i * 0.72, 0.9, -GD / 2 + 0.4); gh.add(pl); }
          const potM = M('#b0603a', { roughness: 0.9 });
          for (let i = 0; i < 4; i++) { const px = -GW / 2 + 0.5 + i * 0.6, pz = GD / 2 - 0.45 - (i % 2) * 0.25, pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.32, 12), potM); pot.position.set(px, 0.16, pz); gh.add(pot);
            const pl = RC.Aging.planter(THREE, 0.3, potM, seedB * 90 + i, i % 2 ? null : [['#ff8040', '#f0d040']][0]); pl.position.set(px, 0.15, pz); pl.scale.set(1.3, 2.2, 1.3); pl.children.slice(0, 5).forEach((c) => (c.visible = false)); gh.add(pl); }
          gh.traverse((o) => { if (o.isMesh && o.material !== glass) { o.castShadow = true; o.receiveShadow = true; } });
        }
        if (st.barrels) {   // real barrels: bulging oak staves, iron hoops, a lid; different sizes, one tipped on its side, set against the wall
          const sd = RC.rng(seedB * 13 + 7), prof = (h2, r0, r1) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, bulge = Math.sin(t * Math.PI); pts.push(new THREE.Vector2(r0 + (r1 - r0) * bulge * 1.0 + 0.0, t * h2)); } return pts; };
          [[0, 0.62, 0.27, 0.34, false], [0.72, 0.5, 0.25, 0.31, false], [1.38, 0.32, 0.23, 0.29, true]].forEach(([ox, h2, r0, r1, side], bi) => {
            const bg = new THREE.Group(), staves = new THREE.Mesh(new THREE.LatheGeometry(prof(h2, r0, r1 - 0.01), 16), M('#7a4a22', { map: OAK && OAK.map, roughness: 0.85, side: THREE.DoubleSide })); staves.castShadow = true; bg.add(staves);
            bg.add(cyl(r0 - 0.01, r0 - 0.01, 0.03, M('#6a4020'), 16, 0, h2 - 0.02)); bg.add(cyl(r0 - 0.01, r0 - 0.01, 0.03, M('#6a4020'), 16, 0, 0.0));
            for (const t of [0.12, 0.3, 0.7, 0.88]) { const rr = r0 + (r1 - r0) * Math.sin(t * Math.PI) + 0.004, hp = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.014, 6, 18), mats.iron); hp.rotation.x = Math.PI / 2; hp.position.y = t * h2; bg.add(hp); }   // iron hoops
            if (side) { bg.rotation.order = 'YXZ'; bg.rotation.z = Math.PI / 2; bg.rotation.y = 0.4 + sd() * 0.4; bg.position.set(dx + 1.4 + ox * 0.9, r1, front + 0.55 + sd() * 0.15); }
            else bg.position.set(dx + 1.35 + ox * 0.95 + (sd() - 0.5) * 0.1, 0, front + 0.5 + (bi === 1 ? 0.2 : 0) + sd() * 0.1);
            grp.add(bg);
          });
        }
        if (porchBeam) {   // on a porch: the board hangs from the beam on two chains, beside the door
          const sx = dx + (dx > 0 ? -1.15 : 1.15), BW = 0.78, BH = 0.5; for (const o of [-BW / 2 + 0.08, BW / 2 - 0.08]) grp.add(box(0.012, 0.22, 0.012, mats.iron, sx + o, porchBeam.y - 0.22, porchBeam.z));
          const sb = RC.Signs.board(THREE, RC.Signs.shopTexture(THREE, b.name, b.style, seedB), BW, BH, 0.05, frameM); sb.rotation.y = Math.PI / 2; sb.position.set(sx, porchBeam.y - 0.22 - BH / 2, porchBeam.z); grp.add(sb);
        } else
        // hanging sign: an iron arm out from the front wall towards the street, a diagonal brace under it, the board on two chains and turned to face along the path so it reads from either side
        { const sd2 = dx > 0 ? -1 : 1, lim = W / 2 - 0.5, sx = Math.max(-lim, Math.min(lim, dx + sd2 * 2.3)), ay = st.h - 0.55, ln = 1.15, az0 = front + 0.02;
          // the bracket: a plate on the wall, the arm straight out from it, a diagonal brace from lower on the wall up to the arm's middle, a curl of iron between them
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, ln), mats.iron); arm.position.set(sx, ay, az0 + ln / 2); grp.add(arm);
          grp.add(box(0.08, 0.7, 0.03, mats.iron, sx, ay - 0.6, az0 + 0.015));   // the wall plate
          for (const yy of [ay - 0.05, ay - 0.5]) { const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), mats.iron); bolt.position.set(sx, yy, az0 + 0.035); grp.add(bolt); }
          { const z1 = 0.62, y0 = 0.55, L = Math.hypot(z1, y0), brc = new THREE.Mesh(new THREE.BoxGeometry(0.035, L, 0.035), mats.iron); brc.rotation.x = Math.atan2(z1, y0); brc.position.set(sx, ay - y0 / 2, az0 + z1 / 2); grp.add(brc); }
          { const curl = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.013, 5, 16, Math.PI * 1.5), mats.iron); curl.rotation.y = Math.PI / 2; curl.position.set(sx, ay - 0.15, az0 + 0.2); grp.add(curl); }
          { const fin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mats.iron); fin.position.set(sx, ay, az0 + ln + 0.02); grp.add(fin); }
          // the board hangs under the arm, clear of the wall, on two short chains of links
          const BW = 0.78, BH = 0.52, bz = az0 + 0.24 + BW / 2, top = ay - 0.24;
          for (const o of [-BW / 2 + 0.07, BW / 2 - 0.07]) for (let k = 0; k < 4; k++) { const lk = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8), mats.iron); lk.scale.y = 1.6; lk.rotation.y = k % 2 ? Math.PI / 2 : 0; lk.position.set(sx, ay - 0.04 - k * 0.055, bz + o); grp.add(lk); }
          const sb = RC.Signs.board(THREE, RC.Signs.shopTexture(THREE, b.name, b.style, seedB), BW, BH, 0.05, frameM); sb.position.set(sx, top - BH / 2, bz); grp.add(sb); }
        // climbers: ivy over a side or the back (sometimes the front, round the windows); or roses up a trellis by the door
        const climb = rB();
        const ivyOn = (face) => { const span = face < 2 ? W : D, iv = RC.Aging.ivy(THREE, span, st.h * (0.45 + rB() * 0.5), face === 0 ? holes.map(([a, b2, c, d]) => [a, b2, c, d]) : [], seedB * 31 + face, null);
          if (face === 0) iv.position.set(0, 0.2, front + 0.06); else if (face === 1) { iv.position.set(0, 0.2, -D / 2 - 0.06); iv.rotation.y = Math.PI; } else { iv.position.set((face === 2 ? 1 : -1) * (W / 2 + 0.06), 0.2, 0); iv.rotation.y = (face === 2 ? 1 : -1) * Math.PI / 2; } grp.add(iv); };
        if (climb < 0.45) ivyOn(Math.floor(rB() * 4));
        else if (climb < 0.75) { let tx = dx + (rB() < 0.5 ? -1.25 : 1.25); const free = (x) => !holes.slice(1).some(([a, , c]) => x + 0.5 > a && x - 0.5 < c) && Math.abs(x) < W / 2 - 0.5;
          if (!free(tx)) tx = dx - (tx - dx); if (free(tx)) { const tr = RC.Aging.trellis(THREE, 0.9, 1.9, woodM('#d8d0c0', 0.2, 0.5)); tr.position.set(tx, 0.25, front + 0.04); grp.add(tr); const ro = RC.Aging.ivy(THREE, 0.9, 1.95, [], seedB * 41, [['#c8203a'], ['#f0b8c8'], ['#fff4e8'], ['#e8a040']][Math.floor(rB() * 4)]); ro.position.set(tx, 0.25, front + 0.08); grp.add(ro); } }
        for (const face of [1, 2, 3]) if (rB() < (upperKind === 'stone' || upperKind === 'darkstone' || upperKind === 'brick' ? 0.45 : 0.25)) ivyOn(face);   // (blank side and back walls often grown over)
        add(grp, cx, cz); grp.position.y = Y(cx, z1 + 0.3);
        { const gy = grp.position.y; grp.updateMatrixWorld(true);   // (placed first: the weeds below read the ground where they really stand)
          for (const [m, off] of aged) { m.userData.age.uAgBase.value = gy + off; m.userData.age.uAgTop.value += gy; }
          aged.length = 0;
          for (const c of chimneys) if (c.lx != null) { c.x = cx + c.lx; c.y = gy + c.ly; c.z = cz + c.lz; delete c.lx; }
          const half = (D + 0.2) / 2, run = half + 0.35, ey = gy + st.h - 0.35 * st.roof / half - 0.08, L2 = (W + 0.7) / 2;
          for (const s of [-1, 1]) eaves.push({ x0: cx - L2, x1: cx + L2, c: cz + s * run, y: ey, ground: (x, z) => Y(x, z) });
          // weeds and grass along the foot of every wall, standing on the real ground
          for (const [fx, fz, span, rot] of [[0, D / 2 + 0.2, W + 0.3, 0], [0, -D / 2 - 0.2, W + 0.3, Math.PI], [W / 2 + 0.2, 0, D + 0.3, Math.PI / 2], [-W / 2 - 0.2, 0, D + 0.3, -Math.PI / 2]]) {
            const wd = RC.Aging.weeds(THREE, span, seedB * 9 + fx + fz, rot === 0 ? [dx - 1.6, dx + 1.6] : null); wd.position.set(fx, 0, fz); wd.rotation.y = rot; grp.add(wd); wd.updateMatrixWorld(true);
            const pp = wd.geometry.attributes.position, v = new THREE.Vector3();
            for (let i = 0; i < pp.count; i += 3) { v.set(pp.getX(i), 0, pp.getZ(i)).applyMatrix4(wd.matrixWorld); const dy = Y(v.x, v.z) - gy - 0.02; for (let k = 0; k < 3; k++) pp.setY(i + k, pp.getY(i + k) + dy); }
            pp.needsUpdate = true; wd.geometry.computeBoundingSphere();
          }
        }
        buildings.push({ group: grp, mats: fadeMats, thing: b });
        label(b.name, cx, grp.position.y + st.h + st.roof + 0.6, cz, 'building');
      }

      // ---- smoke from some chimneys now and then, and drips off the eaves while it rains (rc-aging.js)
      if (chimneys.length) { const sm = RC.ChimneySmoke(THREE, chimneys, shared); g.add(sm.object); tickers.push((t, s) => { sm.light.value = 1 - s.night * 0.8; }); }
      if (eaves.length) g.add(RC.EaveDrips(THREE, eaves, shared));
      { const solid = realm.things.filter((x) => x.kind !== 'forage'), near = (x, z) => solid.some((o) => o.kind === 'building' ? x > o.x - 1 && x < o.x + o.w + 1 && z > o.z && z < o.z + o.d + 1.5 : Math.abs(o.x - x) < 1.2 && Math.abs(o.z - z) < 1.2);
        g.add(RC.Mounds(THREE, realm, terrain, near)); }   // molehills, sandy heaps, lumps of earth
      RC.Boats.place(THREE, realm, terrain, g, tickers);   // the boats, moored along the piers (rc-boats.js)
      // ---- the smaller things
      const PR = RC.Props.make({ T: THREE, M, woodM, mats, GRANM, beamM, shared, tickers });   // (rc-props.js)
      let LP = null;
      const lampParts = () => LP || (LP = (() => {
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 2.0, 0), new THREE.Vector3(0.3, 2.22, 0), new THREE.Vector3(0.5, 2.06, 0));
        const halo = RC.Tex.cv(64, 64), hg = halo.getContext('2d'), gr = hg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.25, 'rgba(255,170,80,.45)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); hg.fillStyle = gr; hg.fillRect(0, 0, 64, 64);
        const flameGeo = new THREE.SphereGeometry(0.022, 10, 8); flameGeo.scale(1, 2.6, 1); flameGeo.translate(0, 0.02, 0);
        return {
          ring: new THREE.TorusGeometry(0.05, 0.014, 6, 14), arm: new THREE.TubeGeometry(curve, 16, 0.018, 6, false), scroll: new THREE.TorusGeometry(0.07, 0.01, 5, 14, Math.PI * 1.5),
          cap: new THREE.ConeGeometry(0.19, 0.12, 4), pane: new THREE.PlaneGeometry(0.19, 0.28), candle: new THREE.CylinderGeometry(0.022, 0.024, 0.1, 10).translate(0, 0.05, 0),
          flame: flameGeo, core: new THREE.SphereGeometry(0.011, 8, 6),
          glass: new THREE.MeshStandardMaterial({ color: '#fff6e0', transparent: true, opacity: 0.22, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false }),
          wax: new THREE.MeshStandardMaterial({ color: '#f1e7d2', roughness: 0.55, emissive: '#5a3a10', emissiveIntensity: 0.25 }),
          flameMat: new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }), coreMat: new THREE.MeshBasicMaterial({ color: '#fff4d6', toneMapped: false }),
          haloMat: new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), color: '#ffffff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }),
        };
      })());
      const floraMats = RC.Flora.materials(THREE, shared), mushMats = {}, glowMats = new Set();
      tickers.push((t2, s) => { for (const m of glowMats) m.emissiveIntensity = s.night * (1.1 + Math.sin(t2 * 1.3) * 0.2); });   // glowcaps glow at night
      const make = {
        lamp: (th) => {   // a cast-iron street lamp: stone plinth, fluted post with rings, a scrolled arm, a glazed lantern with a candle inside
          const o = new THREE.Group(), L = lampParts();
          o.add(cyl(0.17, 0.19, 0.16, mats.stone, 10)); o.add(cyl(0.1, 0.13, 0.22, mats.iron, 10, 0, 0.16));
          o.add(cyl(0.032, 0.045, 1.85, mats.iron, 8, 0, 0.36));
          for (const y of [0.42, 1.0, 2.12]) { const ring = new THREE.Mesh(L.ring, mats.iron); ring.position.y = y; ring.rotation.x = Math.PI / 2; o.add(ring); }
          const top = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.iron); top.position.y = 2.24; o.add(top);
          const arm = new THREE.Mesh(L.arm, mats.iron); o.add(arm); const scroll = new THREE.Mesh(L.scroll, mats.iron); scroll.position.set(0.12, 1.98, 0); o.add(scroll);
          const lan = new THREE.Group(); lan.position.set(0.5, 1.66, 0); o.add(lan);
          lan.add(box(0.012, 0.16, 0.012, mats.iron, 0, 0.36, 0));   // the hook
          const cap = new THREE.Mesh(L.cap, mats.iron); cap.position.y = 0.36; cap.rotation.y = Math.PI / 4; lan.add(cap);
          const fin = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mats.brass); fin.position.y = 0.48; lan.add(fin);
          lan.add(box(0.25, 0.03, 0.25, mats.iron, 0, 0.32, 0), box(0.22, 0.035, 0.22, mats.iron, 0, 0, 0), box(0.12, 0.05, 0.12, mats.iron, 0, -0.05, 0));
          for (const [x, z] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) lan.add(box(0.018, 0.3, 0.018, mats.iron, x, 0.02, z));
          for (let i = 0; i < 4; i++) { const g2 = new THREE.Mesh(L.pane, L.glass); g2.position.set(Math.sin(i * Math.PI / 2) * 0.105, 0.17, Math.cos(i * Math.PI / 2) * 0.105); g2.rotation.y = i * Math.PI / 2; lan.add(g2); }
          const dish = cyl(0.045, 0.04, 0.015, mats.brass, 10, 0, 0.035); lan.add(dish);
          const candle = new THREE.Mesh(L.candle, L.wax); candle.position.y = 0.05; lan.add(candle);
          const flame = new THREE.Mesh(L.flame, L.flameMat); flame.position.y = 0.165; lan.add(flame);
          const core = new THREE.Mesh(L.core, L.coreMat); core.position.y = 0.152; lan.add(core);
          const halo = new THREE.Sprite(L.haloMat.clone()); halo.scale.setScalar(0.9); halo.position.y = 0.17; lan.add(halo);
          const ph = RC.hash(th.x * 10, th.z * 10, 3) * 20;
          tickers.push((t2, s) => {
            const on = RC.clamp((s.night - 0.15) / 0.3, 0, 1), fl = 1 + Math.sin(t2 * 13 + ph) * 0.12 + Math.sin(t2 * 23.7 + ph * 2) * 0.08;
            flame.visible = core.visible = on > 0.02; flame.scale.set(1 + (fl - 1) * 0.4, fl, 1 + (fl - 1) * 0.4); flame.rotation.z = Math.sin(t2 * 3.1 + ph) * 0.08;
            halo.material.opacity = on * 0.75 * (0.9 + (fl - 1) * 0.8); halo.visible = on > 0.02;
          });
          return o;
        },
        fountain: () => {   // a three-tier stone fountain: carved basin, fluted column, bowls, and water that jets, spills and ripples
          const o = new THREE.Group(), lt = WT.stone, rp = (tx, x, y) => { if (!tx) return tx; const c = tx.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); return c; };
          const sm = (rx, ry) => M('#e4ddd0', { map: rp(lt.map, rx, ry), normalMap: rp(lt.normalMap, rx, ry), roughness: 0.78 }), stone = sm(3, 1), dark = M('#8d887e', { roughness: 0.9 }), moss = M('#59703a', { roughness: 1 });
          const lathe = (pts, seg, mat, y = 0) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg), mat); m.position.y = y; m.castShadow = m.receiveShadow = true; mat.side = THREE.DoubleSide; return m; };
          o.add(lathe([[0, 0], [1.9, 0], [1.9, 0.06], [1.78, 0.1], [1.8, 0.5], [1.86, 0.56], [1.86, 0.62], [1.62, 0.62], [1.6, 0.52], [1.56, 0.16], [0, 0.16]], 40, stone));   // outer basin with a stepped plinth and flat coping
          for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);   // carved panels round the basin, with a dark inset
            const p = box(0.5, 0.3, 0.06, dark, c * 1.795, 0.2, s * 1.795); p.rotation.y = -a + Math.PI / 2; o.add(p);
            const pil = cyl(0.045, 0.05, 0.42, stone, 8, Math.cos(a + 0.157) * 1.8, 0.12, Math.sin(a + 0.157) * 1.8); o.add(pil); }
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; o.add(cyl(0.1, 0.12, 0.1, stone, 10, Math.cos(a) * 1.74, 0.62, Math.sin(a) * 1.74)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), stone); b.position.set(Math.cos(a) * 1.74, 0.82, Math.sin(a) * 1.74); b.castShadow = true; o.add(b); }
          for (let i = 0; i < 14; i++) { const a = RC.hash(i, 3, 61) * 6.28, m2 = new THREE.Mesh(new THREE.SphereGeometry(0.1 + RC.hash(i, 4, 61) * 0.08, 8, 5, 0, 6.3, 0, 1.6), moss); m2.scale.y = 0.45; m2.position.set(Math.cos(a) * 1.86, 0.1 + RC.hash(i, 5, 61) * 0.45, Math.sin(a) * 1.86); o.add(m2); }   // moss where the water runs down the stone
          const water = new THREE.MeshStandardMaterial({ color: '#e8f2f4', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55 });   // (spray)
          const w1 = new THREE.Mesh(new THREE.CircleGeometry(1.58, 48).rotateX(-Math.PI / 2), PR.poolWater(1.22)); w1.position.y = 0.47; const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.84, 40).rotateX(-Math.PI / 2), PR.poolWater(0.45)); w2.position.y = 1.43; o.add(w1, w2);
          o.add(PR.veil(1.0, 1.62, 1.24, 0.48)); o.add(PR.veil(0.5, 2.08, 0.62, 1.44));   // water falling from each bowl's lip into the one below
          for (const [r, h] of [[0.34, 0.16], [0.3, 0.6], [0.26, 1.0]]) o.add(cyl(r, r - 0.03, h, stone, 14, 0, r === 0.34 ? 0.16 : r === 0.3 ? 0.32 : 0.92));
          for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; o.add(cyl(0.028, 0.028, 0.95, stone, 6, Math.cos(a) * 0.255, 0.4, Math.sin(a) * 0.255)); }   // the fluted column
          for (const y of [0.34, 0.9]) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.045, 8, 20), stone); tr.rotation.x = Math.PI / 2; tr.position.y = y; o.add(tr); }
          o.add(lathe([[0, 0], [0.6, 0], [0.62, 0.12], [0.98, 0.36], [1.0, 0.44], [0.92, 0.44], [0.9, 0.38], [0.56, 0.18], [0, 0.18]], 36, stone, 1.2 - 0.0));   // the second, wider bowl on a scalloped lip
          o.add(cyl(0.2, 0.26, 0.5, stone, 12, 0, 1.38)); o.add(lathe([[0, 0], [0.3, 0], [0.5, 0.2], [0.46, 0.22], [0.28, 0.08], [0, 0.08]], 24, stone, 1.9));
          const urn = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), stone); urn.position.y = 2.18; urn.scale.y = 1.25; urn.castShadow = true; o.add(urn); o.add(cyl(0.03, 0.05, 0.22, stone, 8, 0, 2.3));
          const N = 60, dm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 5, 4), water, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
          tickers.push((tm) => { for (let i = 0; i < N; i++) { const grp = i % 3, ph = (tm * (0.55 + grp * 0.08) + i * 0.137) % 1, a = i * 2.399;
              let r, y;   // 0: jets arching from the top into the upper bowl; 1: spill off the bowl's lip into the basin; 2: a thin veil off the lowest bowl
              if (grp === 0) { r = ph * 0.62; y = 2.5 + 0.9 * ph - 3.4 * ph * ph + 0.0; y = Math.max(y, 1.44); } else if (grp === 1) { r = 0.95 + ph * 0.3; y = 1.6 - ph * ph * 1.15; } else { r = 0.45 + ph * 0.22; y = 1.95 - ph * ph * 0.9; y = Math.max(y, 1.44); }
              if (y < 0.47 && grp === 1) y = 0.47;
              m4.compose(v.set(Math.cos(a) * r, y, Math.sin(a) * r), q, sc); dm.setMatrixAt(i, m4); }
            dm.instanceMatrix.needsUpdate = true; w1.scale.setScalar(1 + Math.sin(tm * 2.3) * 0.004); w1.position.y = 0.46 + Math.sin(tm * 1.7) * 0.004; });
          o.add(dm); return o; },
        well: () => PR.well(),
        statue: () => {   // a grand monument: tiered marble plinth with gold inlay, a robed crowned figure with outspread gilded wings, a halo, and gems that glow softly
          const o = new THREE.Group(), marble = M('#ece8df', { roughness: 0.35, metalness: 0.02 }), dkm = M('#6b6a72', { roughness: 0.5, metalness: 0.2 }), gold = M('#d9a93a', { metalness: 0.95, roughness: 0.22 }), bronze = M('#8a5a2e', { metalness: 0.85, roughness: 0.38 });
          const gem = (c) => M(c, { roughness: 0.05, metalness: 0.1, emissive: c, emissiveIntensity: 0.55 }), ruby = gem('#d41f3a'), sapph = gem('#2a56e0'), emer = gem('#1fb36a'), amethyst = gem('#8a3fd4');
          const sh = (g2, m, x, y, z) => { const e = new THREE.Mesh(g2, m); e.position.set(x, y, z); e.castShadow = e.receiveShadow = true; o.add(e); return e; };
          sh(new THREE.CylinderGeometry(1.5, 1.6, 0.18, 8), dkm, 0, 0.09, 0); sh(new THREE.CylinderGeometry(1.25, 1.35, 0.22, 8), marble, 0, 0.29, 0); sh(new THREE.CylinderGeometry(1.0, 1.1, 0.3, 8), marble, 0, 0.55, 0);   // stepped octagonal base
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; sh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8).rotateX(Math.PI / 2), i % 2 ? gold : bronze, Math.cos(a) * 1.3, 0.3, Math.sin(a) * 1.3).rotation.y = -a; sh(new THREE.OctahedronGeometry(0.07), [ruby, sapph, emer, amethyst][i % 4], Math.cos(a) * 1.36, 0.32, Math.sin(a) * 1.36); }   // gems set round the second step
          const ring = sh(new THREE.TorusGeometry(1.03, 0.025, 6, 40), gold, 0, 0.71, 0); ring.rotation.x = Math.PI / 2;   // gold band
          sh(new THREE.CylinderGeometry(0.62, 0.8, 0.8, 8), marble, 0, 1.1, 0); sh(new THREE.BoxGeometry(0.9, 0.3, 0.06), gold, 0, 1.12, 0.64);   // pedestal with a gilded plaque
          for (const [x, c] of [[-0.3, ruby], [0, sapph], [0.3, emer]]) sh(new THREE.OctahedronGeometry(0.05), c, x, 1.12, 0.69);
          sh(new THREE.CylinderGeometry(0.2, 0.46, 1.15, 14), marble, 0, 2.1, 0);   // the robed figure
          const sk = sh(new THREE.ConeGeometry(0.5, 0.4, 14, 1, true), marble, 0, 1.62, 0); sk.material = marble.clone(); sk.material.side = THREE.DoubleSide;
          sh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 14), gold, 0, 1.78, 0);   // gold sash
          sh(new THREE.SphereGeometry(0.15, 16, 12), marble, 0, 2.86, 0); sh(new THREE.CylinderGeometry(0.11, 0.17, 0.2, 10), marble, 0, 2.72, 0);
          for (const s of [-1, 1]) { const arm = sh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8), marble, s * 0.3, 2.45, 0.12); arm.rotation.z = s * 0.45; arm.rotation.x = -0.4; }
          sh(new THREE.SphereGeometry(0.11, 12, 10), sapph, 0, 2.46, 0.4);   // a great gem held before her
          for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.5; const cr = sh(new THREE.ConeGeometry(0.035, 0.18, 6), gold, Math.sin(a) * 0.15, 3.03 + Math.cos(a) * 0.02, Math.cos(a) * 0.04); cr.rotation.z = -a * 0.6; sh(new THREE.SphereGeometry(0.03, 8, 6), [ruby, emer, sapph, emer, ruby][i], Math.sin(a) * 0.16, 3.17, 0.0); }   // crown
          const halo = sh(new THREE.TorusGeometry(0.34, 0.018, 8, 36), gold, 0, 2.95, -0.18); halo.rotation.x = 0.15;
          for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const len = 0.9 - k * 0.09, f = sh(new THREE.BoxGeometry(len, 0.09, 0.018), k % 2 ? gold : bronze, s * (0.26 + len / 2 * 0.85), 2.62 + k * 0.1 - 0.1, -0.22); f.rotation.z = s * (0.28 + k * 0.1); f.position.x = s * (0.28 + Math.cos(0.28 + k * 0.1) * len / 2); f.position.y = 2.5 + k * 0.12 + Math.sin(0.28 + k * 0.1) * len / 2 * 0.6; }   // layered gilded wing feathers
          for (const s of [-1, 1]) sh(new THREE.OctahedronGeometry(0.06), amethyst, s * 0.34, 2.55, -0.22);
          return o; },
        sign: (t) => RC.Signs.post(THREE, t, M),   // (its words on the board, both faces: rc-signs.js)
        noticeboard: (t) => {   // a roofed stand, notes on both sides: this board's own on the front, the town's other news on the back
          const others = realm.things.filter((o) => o.kind === 'noticeboard' && o !== t).flatMap((o) => o.lines || []);
          const back = { title: 'WORK · LOST & FOUND · NEWS', lines: others.slice(0, 4).concat(['LOST: a grey cat, answers to Pip. Bring her to the Herbalist for a reward.', 'MARKET every Saturday on the plaza, from first light.']).slice(0, 6) };
          return RC.Signs.kiosk(THREE, t, back, M); },
        tablet: (t) => (/CHESS|DICE|TABLE/i.test(t.title || '') ? PR.gameTable() : box(0.9, 1.2, 0.25, mats.stone)),
        crates: () => { const o = new THREE.Group(), a = PR.crate(0.62), b2 = PR.crate(0.52), c = PR.crate(0.46), s1 = PR.sack(), s2 = PR.sack(0.85); b2.position.set(0.62, 0, 0.12); b2.rotation.y = 0.3; c.position.set(0.25, 0.62, 0.02); c.rotation.y = -0.2; s1.position.set(-0.55, 0, 0.25); s2.position.set(-0.45, 0, -0.35); s2.rotation.z = 0.3; o.add(a, b2, c, s1, s2); return o; },
        dock_cargo: () => { const o = new THREE.Group(); [[-0.65, 0], [0, 0.05], [0.65, -0.05]].forEach(([x, z], i) => { const b2 = PR.barrel(0.85, 0.29); b2.position.set(x, 0, z); b2.rotation.y = i; o.add(b2); }); const c = PR.crate(0.6); c.position.set(0, 0, 0.75); o.add(c); const s = PR.sack(); s.position.set(0.7, 0, 0.7); o.add(s); return o; },
        anvil: () => PR.anvil(),
        telescope: () => PR.spyglass(),
        bell: () => PR.belfry(),
        campfire: () => PR.campfire(),
        bookshelf: (t) => (/LECTERN/i.test(t.title || '') ? PR.lectern(t.lines) : /LEDGER/i.test(t.title || '') ? PR.ledger(t.lines) : box(1.2, 1.8, 0.4, M('#6b4226'))),
        shrub: (t) => { const kind = { berry: 'berry', fern: 'fern', blossom: 'blossom', frost_bush: 'frost_bush', ember_fern: 'ember_fern' }[t.variant] || 'bush', fb = RC.Flora.bush(THREE, kind, Math.floor(t.x * 7 + t.z), 1);
          const tint0 = new THREE.Color(fb.color), lm = floraMats.leafMat(fb.leaf, 0.06), o = new THREE.Group(), m = new THREE.Mesh(fb.leaves, lm); m.customDepthMaterial = lm.userData.depth; o.add(m); if (fb.bark) { const bk = new THREE.Mesh(fb.bark, floraMats.barkMat('oak')); bk.castShadow = true; o.add(bk); } if (fb.fill) { const fm = new THREE.Mesh(fb.fill, floraMats.fillMat(fb.leaf)); fm.castShadow = true; o.add(fm); const fc = fb.fill.attributes.color; for (let i = 0; i < fc.count; i++) fc.setXYZ(i, fc.getX(i) * tint0.r, fc.getY(i) * tint0.g, fc.getZ(i) * tint0.b); }
          const tint = new THREE.Color(fb.color), c = fb.leaves.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * tint.r, c.getY(i) * tint.g, c.getZ(i) * tint.b); o.scale.setScalar(1.15); return o; },
        chest: () => PR.chest(),
        forage: (t) => { if (t.node === 'mushroom') { const o = RC.Mushrooms.cluster(THREE, t.mush, Math.floor(t.x * 13 + t.z * 7), mushMats); if (t.onTrunk) o.rotation.y = Math.atan2(Math.cos(t.face), Math.sin(t.face)); if (o.userData.glowMat) glowMats.add(o.userData.glowMat); return o; }
          const o = new THREE.Group(); const n = t.node;
          if (/vein/.test(n)) {   // a rock to break with a pick: lumpy grey stone with metal showing through in seams, flecks and crystals; each metal its own colour
            const metal = n.replace(/_vein.*/, ''), ORE = { iron: ['#8a6a58', 0.7, 0.45], nickel: ['#b9bfc2', 0.85, 0.35], copper: ['#c8703c', 0.9, 0.3], silver: ['#e3e7ee', 0.95, 0.2], gold: ['#f0c23a', 1, 0.2], titanium: ['#7e8da0', 0.9, 0.3], extensium: ['#6df0ff', 0.4, 0.15], obsidian: ['#1f1530', 0.3, 0.15] }[metal] || ['#b4693a', 0.8, 0.3];
            const sd = Math.floor(t.x * 31 + t.z * 17), rr = RC.rng(sd + 5), geo = new THREE.IcosahedronGeometry(0.5, 2), gp = geo.attributes.position;
            for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i), k = 1 + (RC.vnoise(x * 4 + sd, z * 4, 1, 90 + sd % 7) - 0.5) * 0.55 + (RC.vnoise(x * 9, y * 9 + sd, 1, 95) - 0.5) * 0.15; gp.setXYZ(i, x * k * 1.15, Math.max(-0.08, y * k * 0.85), z * k); }
            geo.computeVertexNormals();
            const rkT = RC.Tex.real(THREE, 'rock_face') || GRAN, rk = new THREE.Mesh(geo, M('#c4c6c8', { map: rkT.map, normalMap: rkT.normalMap, roughness: 0.9, flatShading: false })); rk.position.y = 0.04; rk.castShadow = rk.receiveShadow = true; o.add(rk);
            const oreM = M(ORE[0], { metalness: ORE[1], roughness: ORE[2], emissive: metal === 'extensium' ? ORE[0] : ORE[0], emissiveIntensity: metal === 'extensium' ? 0.9 : 0.12 });
            const glow = metal === 'extensium' ? oreM : null; if (glow) glowMats.add(glow);
            for (let i = 0; i < 10; i++) { const a = rr() * 6.28, hgt = 0.1 + rr() * 0.38, rad = 0.36 + rr() * 0.1, big = i < 6, c2 = new THREE.Mesh(big ? new THREE.OctahedronGeometry(0.09 + rr() * 0.07) : new THREE.BoxGeometry(0.07, 0.04, 0.07), oreM);
              c2.scale.y = big ? 1.5 + rr() : 1; c2.position.set(Math.cos(a) * rad, hgt, Math.sin(a) * rad); c2.rotation.set(rr() * 3, rr() * 3, rr() * 3); c2.castShadow = true; o.add(c2); }
            for (let i = 0; i < 4; i++) { const sm = new THREE.Mesh(new THREE.BoxGeometry(0.34 + rr() * 0.14, 0.045, 0.04), oreM); const a = rr() * 6.28; sm.position.set(Math.cos(a) * 0.31, 0.18 + rr() * 0.22, Math.sin(a) * 0.31); sm.rotation.y = -a + Math.PI / 2; sm.rotation.z = (rr() - 0.5) * 0.9; o.add(sm); }   // seams
          }
          else if (n === 'timber_pile') for (let i = 0; i < 3; i++) { const l = cyl(0.12, 0.12, 0.9, M('#8b5a2b'), 8); l.rotation.z = Math.PI / 2; l.position.set(0, 0.12 + (i === 2 ? 0.22 : 0) - 0.45, (i - 1) * 0.25 * (i === 2 ? 0 : 1)); o.add(l); }
          else if (n === 'fruit_tree') {   // a real grown tree (same maker as the woods) with apples hanging in it
            const sd = Math.floor(t.x * 11 + t.z * 5) + 3, ft = RC.Flora.tree(THREE, 'oak', sd, 1), sp = RC.Flora.SPECIES.oak, tint = new THREE.Color('#62a043');
            const bk = new THREE.Mesh(ft.bark, floraMats.barkMat(sp.bark)); bk.castShadow = true; o.add(bk);
            const lm = floraMats.leafMat(sp.leaf, 0.05), lf = new THREE.Mesh(ft.leaves, lm); lf.customDepthMaterial = lm.userData.depth; lf.castShadow = true; o.add(lf);
            for (const geo of [ft.leaves, ft.fill]) { if (!geo) continue; const c = geo.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * tint.r, c.getY(i) * tint.g, c.getZ(i) * tint.b); }
            if (ft.fill) { const fm = new THREE.Mesh(ft.fill, floraMats.fillMat(sp.leaf)); fm.castShadow = true; o.add(fm); }
            const ap = M('#c8321e', { roughness: 0.45 });
            for (let i = 0; i < 9; i++) { const a = RC.hash(i, 7, 7) * 6.28, rr = 0.45 + RC.hash(i, 8, 8) * 0.55, s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), ap); s.position.set(Math.cos(a) * rr, 1.2 + RC.hash(i, 9, 9) * 0.8, Math.sin(a) * rr); o.add(s); } }
          else if (n === 'berry_bush') {   // a real leafy bush (same maker as the shrubs) with berries clustered in the foliage
            const fb = RC.Flora.bush(THREE, 'berry', Math.floor(t.x * 7 + t.z) + 11, 1), tint = new THREE.Color(fb.color), lm = floraMats.leafMat(fb.leaf, 0.06), lf = new THREE.Mesh(fb.leaves, lm); lf.customDepthMaterial = lm.userData.depth;
            for (const geo of [fb.leaves, fb.fill]) { if (!geo) continue; const c = geo.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * tint.r, c.getY(i) * tint.g, c.getZ(i) * tint.b); }
            o.add(lf); if (fb.fill) { const fm = new THREE.Mesh(fb.fill, floraMats.fillMat(fb.leaf)); fm.castShadow = true; o.add(fm); } if (fb.bark) { const bk = new THREE.Mesh(fb.bark, floraMats.barkMat('oak')); bk.castShadow = true; o.add(bk); }
            const bm = M(['#6a2a7a', '#b0203a'][Math.floor(RC.hash(t.x, t.z, 3) * 2)], { roughness: 0.35 });
            for (let i = 0; i < 16; i++) { const a = RC.hash(i, 1, 71) * 6.28, rr = 0.22 + RC.hash(i, 2, 71) * 0.3, b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bm); b.position.set(Math.cos(a) * rr, 0.18 + RC.hash(i, 3, 71) * 0.4, Math.sin(a) * rr); o.add(b); }
            o.scale.setScalar(1.15); }
          else if (n === 'herb_patch') {   // a tuft of real fern and herb plants with a few small flowers
            const kinds = ['fern', 'sapling', 'fern'], fl = ['#f2c94c', '#ffffff', '#c4b5fd'];
            kinds.forEach((kd, k) => { const fb = RC.Flora.bush(THREE, kd, Math.floor(t.x * 5 + t.z * 3) + k * 4 + 2, 1), tint = new THREE.Color(fb.color), lm = floraMats.leafMat(fb.leaf, 0.12), lf = new THREE.Mesh(fb.leaves, lm); lf.customDepthMaterial = lm.userData.depth;
              for (const geo of [fb.leaves, fb.fill]) { if (!geo) continue; const c = geo.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * tint.r, c.getY(i) * tint.g, c.getZ(i) * tint.b); }
              const g2 = new THREE.Group(); g2.add(lf); if (fb.fill) { const fm = new THREE.Mesh(fb.fill, floraMats.fillMat(fb.leaf)); g2.add(fm); } g2.position.set(Math.cos(k * 2.1) * 0.28, 0, Math.sin(k * 2.1) * 0.28); g2.scale.setScalar(0.55); o.add(g2); });
            for (let i = 0; i < 9; i++) { const a = RC.hash(i, 1, 81) * 6.28, rr = 0.12 + RC.hash(i, 2, 81) * 0.4, sm = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), M(fl[i % 3])); sm.position.set(Math.cos(a) * rr, 0.22 + RC.hash(i, 3, 81) * 0.2, Math.sin(a) * rr); o.add(sm); } }
          else if (n === 'mushroom_ring') {   // a fairy ring: real mushrooms in a circle
            const kd = ['field_cap', 'honey_caps'][Math.floor(RC.hash(t.x, t.z, 4) * 2)];
            for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28 + (RC.hash(i, 3, 82) - 0.5) * 0.3, cl = RC.Mushrooms.cluster(THREE, kd, Math.floor(t.x * 13 + t.z * 7) + i, mushMats); cl.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62); cl.rotation.y = RC.hash(i, 4, 82) * 6.28; cl.scale.setScalar(0.75 + RC.hash(i, 5, 82) * 0.35); o.add(cl); } }
          else if (n === 'beehive_log') {   // a hollow log on its side with a hive in the end, bees going in and out
            const oak = typeof OAK !== 'undefined' && OAK ? woodM('#7a5a3a', 1, 1) : M('#7a5a3a');
            const lg = cyl(0.26, 0.28, 1.1, oak, 14); lg.rotation.z = Math.PI / 2; lg.position.set(0, 0.28, 0); lg.castShadow = true; o.add(lg);
            const cut = new THREE.Mesh(new THREE.CircleGeometry(0.26, 14), M('#d8b98a')); cut.rotation.y = Math.PI / 2; cut.position.set(0.553, 0.28, 0); o.add(cut);
            const hole = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), M('#1b120a')); hole.rotation.y = Math.PI / 2; hole.position.set(0.556, 0.3, 0); o.add(hole);
            for (let i = 0; i < 3; i++) { const r = cyl(0.27, 0.27, 0.025, M('#4a3a2a'), 14); r.rotation.z = Math.PI / 2; r.position.set(-0.4 + i * 0.4, 0.28, 0); o.add(r); }
            for (const sx of [-0.4, 0.4]) o.add(box(0.12, 0.1, 0.5, M('#6a4e34'), sx, 0, 0));
            const bees = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), M('#e0b020', { emissive: '#604000', emissiveIntensity: 0.2 })); o.add(b); bees.push(b); }
            tickers.push((tm) => { bees.forEach((b, i) => { const ph = tm * (1.4 + i * 0.13) + i * 1.7; b.position.set(0.6 + Math.sin(ph) * 0.22, 0.38 + Math.sin(ph * 1.7 + i) * 0.14, Math.cos(ph * 1.3) * 0.22); }); }); }
          else if (n === 'relic_scrap') {   // half-buried ancient pieces: a cracked stone slab, a bent bronze plate and a broken pillar stub with green patina
            const slab = new THREE.Mesh(RC.roughBox(THREE, 0.7, 0.14, 0.5, 0.06, RC.rng(Math.floor(t.x * 9 + t.z))), GRANM); slab.position.set(0, 0.06, 0); slab.rotation.y = 0.5; slab.rotation.z = 0.08; slab.castShadow = true; o.add(slab);
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.24), M('#6a8f72', { metalness: 0.7, roughness: 0.45 })); plate.position.set(0.18, 0.15, 0.12); plate.rotation.set(0.25, 0.8, 0.15); o.add(plate);
            const stub = cyl(0.14, 0.17, 0.32, GRANM, 10, -0.28, 0, -0.1); stub.rotation.z = 0.35; o.add(stub);
            const rune = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 18), M('#d9a93a', { metalness: 0.95, roughness: 0.25 })); rune.rotation.x = Math.PI / 2 - 0.1; rune.position.set(-0.05, 0.14, 0.02); o.add(rune); }
          else { const c = { herb_patch: '#5fbf5a', berry_bush: '#2f7d32', mushroom_ring: '#d9b38c', beehive_log: '#b7791f', relic_scrap: '#8c8f99' }[n] || '#5fbf5a'; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(n === 'mushroom_ring' ? new THREE.ConeGeometry(0.09, 0.12, 7) : new THREE.SphereGeometry(0.09, 6, 4), M(c)); const a = i * 1.26; s.position.set(Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25); o.add(s); } }
          return o; },
        station: (t) => { const o = new THREE.Group();
          if (t.station === 'forge') { o.add(box(1.4, 0.9, 1, mats.darkStone)); o.add(box(0.9, 0.12, 0.6, mats.glow, 0, 0.9, 0)); o.add(box(0.5, 1.4, 0.5, mats.darkStone, 0, 0.9, -0.3)); }
          else if (t.station === 'alchemy') { o.add(PR.cauldron()); return o; }
          else if (t.station === 'alchemy_old') { o.add(cyl(0.55, 0.42, 0.7, mats.iron, 14)); o.add(cyl(0.48, 0.48, 0.05, new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#ea580c', emissiveIntensity: 0.8 }), 14, 0, 0.66)); }
          else if (t.station === 'cooking' || !t.station) { o.add(PR.kettle()); return o; }
          else { for (let i = 0; i < 3; i++) { const l = cyl(0.03, 0.03, 1.5, mats.iron, 5); l.position.set(Math.cos(i * 2.1) * 0.45, 0.65, Math.sin(i * 2.1) * 0.45); l.rotation.set(Math.sin(i * 2.1) * 0.3, 0, -Math.cos(i * 2.1) * 0.3); o.add(l); } const k = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, 6.3, 0, 2.2), mats.iron); k.position.y = 0.6; o.add(k); o.add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 6), mats.glow)); }
          return o; },
        boat: (t) => { const o = new THREE.Group(); const hm = M(t.hull || '#7c4a1e'); o.add(box(2.2, 0.45, 0.95, hm, -0.2, 0.05, 0)); const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.45, 3, 1), hm); bow.rotation.y = Math.PI / 6; bow.scale.set(1.3, 1, 1); bow.position.set(1.0, 0.28, 0); o.add(bow); o.add(box(2.0, 0.06, 0.8, M('#a0703f'), -0.2, 0.42, 0)); o.add(cyl(0.05, 0.05, 2.6, mats.darkWood, 6, 0, 0.3)); const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), M(t.sail || '#f5f0e1', { side: THREE.DoubleSide })); sail.position.set(0.05, 1.7, 0); sail.rotation.y = Math.PI / 2; o.add(sail); if (t.facing === 'left') o.rotation.y = Math.PI; return o; },
      };
      for (const t of realm.things) {
        if (t.kind === 'building' || !make[t.kind]) continue;
        const st = terrain.stream;
        // a chest in the water sits on a flat rock, with stepping stones out to it from the nearest bank
        if (st && t.kind === 'chest' && st.wet(t.x, t.z, 0.1)) {
          const d0 = st.find(t.x, t.z), i0 = st._i, wl = st.WL[i0], top = wl + 0.12, rockM = M('#8a8a80', { map: GRAN.map, normalMap: GRAN.normalMap, roughness: 0.8 });
          const rk = new THREE.Mesh(RC.roughBox(THREE, 1.1, 0.5, 0.9, 0.08, RC.rng(t.x * 3)), rockM); rk.position.set(t.x, top - 0.25, t.z); rk.castShadow = rk.receiveShadow = true; g.add(rk);
          st.addStep(t.x, t.z, 0.5, top);
          // the way out: from the rock toward the closest dry ground, a stone every 0.6 m or so
          let bx = null, bz = null; for (let r = 0.6; r < 8 && bx == null; r += 0.2) for (let a = 0; a < 6.28; a += 0.2) { const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; if (!st.wet(x, z, 0.15)) { bx = x; bz = z; break; } }
          if (bx != null) { const L = Math.hypot(bx - t.x, bz - t.z), n = Math.max(2, Math.round((L - 0.3) / 0.4));   // (close together, so they read as a path)
            for (let k = 1; k <= n; k++) { const f = (k / (n + 0.35)), x = t.x + (bx - t.x) * f + (RC.hash(k, t.x, 3) - 0.5) * 0.1, z = t.z + (bz - t.z) * f + (RC.hash(k, t.z, 4) - 0.5) * 0.1, sy = wl + 0.07;
              const s = new THREE.Mesh(RC.roughBox(THREE, 0.5, 0.3, 0.46, 0.06, RC.rng(k * 7 + t.x)), rockM); s.position.set(x, sy - 0.15, z); s.rotation.y = RC.hash(k, 9, 1) * 3; s.castShadow = s.receiveShadow = true; g.add(s); st.addStep(x, z, 0.26, sy); } }
        }
        if (t.kind === 'boat') continue;
        const o = make[t.kind](t); o.userData.thing = t;
        if (t.kind === 'boat') continue;   // (boats are tied up at the piers: rc-boats.js, below)
        add(o, t.x, t.z, t.kind === 'sign' || t.kind === 'noticeboard' ? 0 : 0);
        t._obj = o;
        if (t.kind === 'station') label(t.title, t.x, Y(t.x, t.z) + 1.9, t.z, 'station');
      }
      // lamps light the street at night: a few real lights, moved to the lamps nearest the camera
      const lampSpots = realm.things.filter((t) => t.kind === 'lamp').map((t) => ({ x: t.x + 0.5, y: Y(t.x, t.z) + 1.85, z: t.z }));
      const pool = [0, 1, 2, 3, 4, 5].map(() => { const l = new THREE.PointLight('#ffb35c', 0, 9, 1.6); g.add(l); return l; });
      tickers.push((t2, s) => { if (!s.cam) return; const near = lampSpots.map((p) => [p, (p.x - s.cam.x) ** 2 + (p.z - s.cam.z) ** 2]).sort((a, b) => a[1] - b[1]); pool.forEach((l, i) => { const p = near[i] && near[i][0]; if (!p) { l.intensity = 0; return; } l.position.set(p.x, p.y, p.z); l.intensity = s.night * 6 * (0.92 + Math.sin(t2 * 7 + i) * 0.08); }); });
      return { group: g, labels, tickers, buildings, mats };
    },
  };
})();
