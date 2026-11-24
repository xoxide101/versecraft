// MapCraft: things placed on the land. Each thing is data ({kind, x, z, …}); the engine makes it ("engine-made")
// unless it names a model ("custom", later: models from 3DCraft). Forest cells grow trees; grass and flowers are scattered.
(function () {
  const RC = window.RC;
  const ROOF = { crimson: '#b4232a', cobalt: '#2649b5', terracotta: '#c0562a', emerald: '#1f8a4c' };
  // what blocks walking (cells and circles), and what can be used with Space
  const SOLID = { fountain: 1.6, well: 0.7, statue: 0.6, anvil: 0.5, telescope: 0.4, bell: 0.6, crates: 0.7, dock_cargo: 0.8, campfire: 0.5, station: 0.8, tablet: 0.5, noticeboard: 0.5, sign: 0.3, lamp: 0.2, chest: 0.45, bookshelf: 0.5 };
  const USE = { sign: 'Read', noticeboard: 'Read', tablet: 'Read', statue: 'Look', fountain: 'Look', well: 'Look', crates: 'Search', dock_cargo: 'Search', anvil: 'Look', telescope: 'Look through', bell: 'Ring', campfire: 'Warm up', bookshelf: 'Read', shrub: 'Search', chest: 'Open', forage: 'Gather', station: 'Use' };

  RC.MapCraft = {
    SOLID, USE,
    // the sim's view of the map: blocked cells, solid circles, things you can use
    plan(realm, terrain) {
      const W = realm.w, H = realm.h, blocked = new Uint8Array(W * H), circles = [], usable = [];
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
        glow: new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 0.4 }), glass: new THREE.MeshStandardMaterial({ color: '#9cc7e6', emissive: '#ffcf7a', emissiveIntensity: 0.05, roughness: 0.2 }) };
      shared.night = shared.night || { value: 0 };
      tickers.push((t, s) => { mats.glow.emissiveIntensity = 0.35 + s.night * 2.2; mats.glass.emissiveIntensity = 0.05 + s.night * 1.1; });
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
      const OAK = real('planks_oak', null), PAINT = ['#f4ecdc', '#efe0b8', '#ead2aa', '#dfe7ea', '#f2dcd2', '#e7e2c8', '#d9e4cf'];
      const woodM = (tint, sx = 1, sy = 1) => { if (!OAK) return M(tint); const r2 = (tx) => { const c = tx.clone(); c.needsUpdate = true; c.repeat.set(sx, sy); return c; }; return M(tint, { map: r2(OAK.map), normalMap: r2(OAK.normalMap), roughness: 0.85 }); };
      const beamM = woodM('#6b4a30', 0.3, 1), doorM = woodM('#8a5a34', 0.6, 0.9), frameM = woodM('#5a3c26', 0.4, 0.4);
      const ROOFT = { crimson: real('roof_clay', RT), terracotta: real('roof_clay', RT), cobalt: real('roof_slate', RT), emerald: real('roof_slate', RT) };
      const ROOFTINT = { crimson: '#ffffff', terracotta: '#f0b090', cobalt: '#9fb4e6', emerald: '#9fd4b0' };

      const STYLE = {
        one_story_cottage: { wall: 'timber', h: 2.4, roof: 1.6 }, two_story_timber: { wall: 'timber', h: 3.8, roof: 1.8 }, smithery_foundry: { wall: 'darkstone', h: 2.8, roof: 1.4, bigChimney: true },
        observatory_parlor: { wall: 'plaster', h: 2.8, roof: 1.5, tower: true }, grand_guildhall: { wall: 'stone', h: 4.0, roof: 1.9, columns: true }, l_wing_inn: { wall: 'timber', h: 3.4, roof: 1.7, wing: true },
        apothecary_conservatory: { wall: 'plaster', h: 2.6, roof: 1.5, glasshouse: true }, longhouse_tavern: { wall: 'timber', h: 2.3, roof: 2.2, barrels: true },
      };
      const roof = (w, d, h, mat, wallMat, tex, tint) => {   // w along the ridge, d across, h tall
        const o = new THREE.Group(), half = d / 2, ov = 0.35, run = half + ov, Ls = Math.hypot(run, h * (run / half)), ang = Math.atan2(h, half), L = w + 0.5;
        for (const s of [-1, 1]) {
          const m = mat.clone(); if (m.map) { m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(L / tex.m, Ls / tex.m); } if (m.normalMap) { m.normalMap = mat.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(L / tex.m, Ls / tex.m); }
          const slope = new THREE.Mesh(new THREE.BoxGeometry(L, 0.09, Ls), m); slope.rotation.order = 'YXZ'; slope.rotation.x = s * ang;
          slope.position.set(0, h - (run / 2) * Math.tan(ang), s * run / 2); o.add(slope); o.userData.mats = (o.userData.mats || []).concat(m);   // (ridge down past the wall: the overhang)
          const fas = new THREE.Mesh(new THREE.BoxGeometry(L, 0.16, 0.06), beamM); fas.position.set(0, h - run * Math.tan(ang) - 0.06, s * run); o.add(fas);   // the eave board
        }
        const tri = new THREE.Shape(); tri.moveTo(-half, 0); tri.lineTo(half, 0); tri.lineTo(0, h); tri.lineTo(-half, 0);
        for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ShapeGeometry(tri), wallMat); e.rotation.y = s * Math.PI / 2; e.position.x = s * w / 2; o.add(e); }   // the gable ends
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
        grp.add(box(W, st.h, D, wallM));
        const ridgeTint = { crimson: '#8a3a2a', terracotta: '#b0603a', cobalt: '#3a4a6a', emerald: '#3a5a46' }[b.roof] || '#6a4a3a';
        const rf = roof(W + 0.2, D + 0.2, st.roof, roofM, wallM, rt, ridgeTint); rf.position.y = st.h; grp.add(rf); fadeMats.push(...rf.userData.mats);
        const stoneM = (w2, h2) => { const lt = WT.stone; return M('#ffffff', { map: rep(lt.map, w2 / lt.m, h2 / lt.m), normalMap: rep(lt.normalMap, w2 / lt.m, h2 / lt.m), roughness: 0.92 }); };
        if (lowerKind) { const lt = WT[lowerKind], lm = M('#ffffff', { map: rep(lt.map, W / lt.m, lowH / lt.m), normalMap: rep(lt.normalMap, W / lt.m, lowH / lt.m), roughness: 0.92 }); grp.add(box(W + 0.06, lowH, D + 0.06, lm, 0, 0, 0)); fadeMats.push(lm); }   // a stone or brick ground floor
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
        grp.add(box(W + 0.2, 0.25, D + 0.2, mats.darkStone, 0, -0.05, 0));   // plinth
        if (b.chimney) { const cw = st.bigChimney ? 1 : 0.6, chH = st.roof + 1.2, cm = stoneM(cw, chH); grp.add(box(cw, chH, cw, cm, W * 0.28, st.h, -D * 0.15)); grp.add(box(cw + 0.16, 0.12, cw + 0.16, cm, W * 0.28, st.h + chH, -D * 0.15)); grp.add(cyl(0.1, 0.12, 0.28, M('#9a5a3a'), 8, W * 0.28, st.h + chH + 0.12, -D * 0.15)); if (st.bigChimney) grp.add(box(0.6, 0.15, 0.6, mats.glow, W * 0.28, st.h + st.roof + 1.2, -D * 0.15)); }
        // front: door and windows (glowing at night)
        const front = D / 2 + 0.01, dx = b.door ? b.door.x - cx : 0;
        grp.add(box(1.0, 1.75, 0.1, doorM, dx, 0, front + 0.02)); grp.add(box(1.22, 0.16, 0.18, frameM, dx, 1.75, front)); grp.add(box(0.11, 1.8, 0.16, frameM, dx - 0.56, 0, front)); grp.add(box(0.11, 1.8, 0.16, frameM, dx + 0.56, 0, front));
        for (const sy of [0.35, 1.35]) grp.add(box(0.85, 0.06, 0.03, mats.iron, dx + 0.02, sy, front + 0.075));
        { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), mats.iron); ring.position.set(dx + 0.32, 0.95, front + 0.09); grp.add(ring); }
        const shutters = st.wall === 'timber' || st.wall === 'plaster', shutM = M(['#3f5f7a', '#5a7a4a', '#7a3a2a', '#4a4a5a'][Math.floor(RC.hash(b.x, b.z, 29) * 4)]);
        const sill = stoneM(1.1, 0.12), flowersM = [M('#d94a6a'), M('#f2c94c'), M('#ffffff'), M('#9b59d0')];
        const win = (wx, wy) => {   // set into the wall: dark glass a little behind the face, oak frame and bars, stone sill and lintel, shutters, sometimes a flower box
          grp.add(box(0.78, 0.8, 0.04, mats.glass, wx, wy, front - 0.06));
          for (const [w2, h2, x2, y2] of [[0.9, 0.07, 0, -0.02], [0.9, 0.07, 0, 0.78], [0.07, 0.84, -0.42, -0.02], [0.07, 0.84, 0.42, -0.02], [0.04, 0.8, 0, 0], [0.8, 0.04, 0, 0.38]]) grp.add(box(w2, h2, 0.07, frameM, wx + x2, wy + y2, front - 0.02));
          grp.add(box(1.05, 0.08, 0.2, sill, wx, wy - 0.1, front + 0.03)); grp.add(box(1.05, 0.14, 0.12, upperKind === 'timber' ? beamM : sill, wx, wy + 0.83, front + 0.01));
          if (shutters) for (const s of [-1, 1]) { const sh = box(0.38, 0.84, 0.04, shutM, wx + s * 0.64, wy - 0.02, front + 0.02); grp.add(sh); for (const yy of [0.15, 0.6]) grp.add(box(0.36, 0.03, 0.05, frameM, wx + s * 0.64, wy + yy, front + 0.03)); }
          if (RC.hash(wx * 7, wy + b.x, 51) < 0.4 && wy < 1.5) { grp.add(box(0.9, 0.16, 0.2, beamM, wx, wy - 0.24, front + 0.12)); for (let k = 0; k < 7; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), flowersM[(k + Math.floor(wx * 3)) % 4]); fl.position.set(wx - 0.36 + k * 0.12, wy - 0.06 + RC.hash(k, wx, 52) * 0.05, front + 0.12); grp.add(fl); } }
        };
        for (let i = 0; i < Math.floor(W / 2.2); i++) { const wx = -W / 2 + 1.1 + i * 2.2; if (Math.abs(wx - dx) < 1.2) continue; win(wx, 0.9); if (st.h > 3.2) win(wx, 2.4); }
        if (st.tower) { const tw = cyl(1.1, 1.1, st.h + 2.2, wallM, 14, W / 2 - 0.6, 0, -D / 2 + 0.8); grp.add(tw); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.8, 14), roofM); cone.position.set(W / 2 - 0.6, st.h + 3.1, -D / 2 + 0.8); grp.add(cone); grp.add(box(0.5, 0.5, 0.1, mats.glass, W / 2 - 0.6, st.h + 1.2, -D / 2 + 1.91)); }
        if (st.columns) { const sm = WT.darkstone.map ? M('#efe8dc', { map: rep(WT.darkstone.map, 0.6, st.h / 2.4), normalMap: rep(WT.darkstone.normalMap, 0.6, st.h / 2.4), roughness: 0.9 }) : M('#e8e2d4');
          for (let i = 0; i < 4; i++) { const px = -W / 2 + 1 + i * ((W - 2) / 3); grp.add(box(0.62, 0.22, 0.62, sm, px, 0, front + 0.55)); grp.add(cyl(0.22, 0.26, st.h - 0.5, sm, 14, px, 0.22, front + 0.55)); grp.add(box(0.6, 0.28, 0.6, sm, px, st.h - 0.28, front + 0.55)); } }
        if (st.wing) { const wg = box(3.2, st.h - 0.8, D * 0.6, wallM, W / 2 + 1.4, 0, -D * 0.15); grp.add(wg); const wr = roof(D * 0.6, 3.2, 1.3, roofM, wallM, rt, ridgeTint); wr.rotation.y = Math.PI / 2; wr.position.set(W / 2 + 1.4, st.h - 0.8, -D * 0.15); grp.add(wr); fadeMats.push(...wr.userData.mats); }
        if (st.glasshouse) { const gm = new THREE.MeshStandardMaterial({ color: '#bfe8d0', transparent: true, opacity: 0.45, roughness: 0.1 }); grp.add(box(2.6, 2.0, D * 0.7, gm, -W / 2 - 1.3, 0, 0)); }
        if (st.barrels) for (let i = 0; i < 3; i++) grp.add(cyl(0.3, 0.3, 0.7, M('#7a4a22'), 10, dx + 1.4 + i * 0.65, 0, front + 0.5));
        // hanging sign over the door
        grp.add(box(0.08, 0.08, 0.7, mats.iron, dx + 0.9, 2.1, front + 0.35)); grp.add(box(0.7, 0.45, 0.06, M('#e9d8a6'), dx + 0.9, 1.6, front + 0.7));
        add(grp, cx, cz); grp.position.y = Y(cx, z1 + 0.3);
        buildings.push({ group: grp, mats: fadeMats, thing: b });
        label(b.name, cx, grp.position.y + st.h + st.roof + 0.6, cz, 'building');
      }

      // ---- the smaller things
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
        fountain: () => { const o = new THREE.Group(); o.add(cyl(1.6, 1.7, 0.45, mats.white, 24)); o.add(cyl(1.35, 1.35, 0.06, new THREE.MeshStandardMaterial({ color: '#4aa3e8', roughness: 0.15 }), 24, 0, 0.36)); o.add(cyl(0.25, 0.3, 1.1, mats.white, 12)); o.add(cyl(0.75, 0.55, 0.22, mats.white, 16, 0, 1.0)); o.add(cyl(0.12, 0.15, 0.6, mats.white, 8, 0, 1.2)); return o; },
        well: () => { const o = new THREE.Group(); o.add(cyl(0.6, 0.65, 0.7, mats.stone, 14)); o.add(box(0.08, 1.4, 0.08, mats.wood, -0.55, 0.5, 0)); o.add(box(0.08, 1.4, 0.08, mats.wood, 0.55, 0.5, 0)); const r = gable(1.4, 1.1, 0.5, M('#8b4a2b')); r.position.y = 1.9; o.add(r); return o; },
        statue: () => { const o = new THREE.Group(); o.add(box(1, 0.6, 1, mats.stone)); o.add(cyl(0.22, 0.28, 1.1, M('#d9d6cf'), 8, 0, 0.6)); const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M('#d9d6cf')); h.position.y = 1.95; o.add(h); return o; },
        sign: () => { const o = new THREE.Group(); o.add(box(0.08, 1.1, 0.08, mats.wood)); o.add(box(0.8, 0.45, 0.07, M('#c9a46a'), 0, 0.8, 0)); return o; },
        noticeboard: () => { const o = new THREE.Group(); o.add(box(0.08, 1.6, 0.08, mats.wood, -0.6)); o.add(box(0.08, 1.6, 0.08, mats.wood, 0.6)); o.add(box(1.3, 0.85, 0.06, M('#a0703f'), 0, 0.7, 0)); for (let i = 0; i < 4; i++) o.add(box(0.25, 0.3, 0.02, M('#f5ecd5'), -0.4 + i * 0.27, 0.95 + (i % 2) * 0.1, 0.04)); return o; },
        tablet: () => box(0.9, 1.2, 0.25, mats.stone),
        crates: () => { const o = new THREE.Group(); o.add(box(0.6, 0.6, 0.6, M('#a2703f'))); o.add(box(0.55, 0.55, 0.55, M('#8d5f33'), 0.6, 0, 0.1)); o.add(box(0.5, 0.5, 0.5, M('#a2703f'), 0.25, 0.6, 0)); return o; },
        dock_cargo: () => { const o = new THREE.Group(); for (let i = 0; i < 3; i++) o.add(cyl(0.3, 0.3, 0.7, M('#7a4a22'), 10, i * 0.65 - 0.65)); o.add(box(0.6, 0.6, 0.6, M('#a2703f'), 0, 0, 0.7)); return o; },
        anvil: () => { const o = new THREE.Group(); o.add(box(0.35, 0.5, 0.35, mats.darkWood)); o.add(box(0.7, 0.25, 0.3, mats.iron, 0, 0.5, 0)); return o; },
        telescope: () => { const o = new THREE.Group(); o.add(cyl(0.03, 0.03, 1.1, mats.iron, 6)); const t = cyl(0.08, 0.11, 0.9, mats.brass, 10); t.rotation.z = 1.1; t.position.set(0.2, 1.2, 0); o.add(t); return o; },
        bell: () => { const o = new THREE.Group(); o.add(box(0.1, 2, 0.1, mats.wood, -0.5)); o.add(box(0.1, 2, 0.1, mats.wood, 0.5)); o.add(box(1.2, 0.12, 0.14, mats.wood, 0, 2, 0)); const b = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 12, 1, true), mats.brass); b.position.y = 1.7; o.add(b); return o; },
        campfire: () => { const o = new THREE.Group(); for (let i = 0; i < 4; i++) { const l = cyl(0.06, 0.06, 0.7, mats.darkWood, 6); l.rotation.z = 1.4; l.rotation.y = i * 0.8; l.position.y = 0.1; o.add(l); } const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), mats.glow); fl.position.y = 0.3; o.add(fl); return o; },
        bookshelf: () => box(1.2, 1.8, 0.4, M('#6b4226')),
        shrub: (t) => { const kind = { berry: 'berry', fern: 'fern', blossom: 'blossom', frost_bush: 'frost_bush', ember_fern: 'ember_fern' }[t.variant] || 'bush', fb = RC.Flora.bush(THREE, kind, Math.floor(t.x * 7 + t.z), 1);
          const tint0 = new THREE.Color(fb.color), lm = floraMats.leafMat(fb.leaf, 0.06), o = new THREE.Group(), m = new THREE.Mesh(fb.leaves, lm); m.customDepthMaterial = lm.userData.depth; o.add(m); if (fb.bark) { const bk = new THREE.Mesh(fb.bark, floraMats.barkMat('oak')); bk.castShadow = true; o.add(bk); } if (fb.fill) { const fm = new THREE.Mesh(fb.fill, floraMats.fillMat(fb.leaf)); fm.castShadow = true; o.add(fm); const fc = fb.fill.attributes.color; for (let i = 0; i < fc.count; i++) fc.setXYZ(i, fc.getX(i) * tint0.r, fc.getY(i) * tint0.g, fc.getZ(i) * tint0.b); }
          const tint = new THREE.Color(fb.color), c = fb.leaves.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * tint.r, c.getY(i) * tint.g, c.getZ(i) * tint.b); o.scale.setScalar(1.15); return o; },
        chest: () => { const o = new THREE.Group(); o.add(box(0.7, 0.4, 0.45, M('#8b5a2b'))); const lid = box(0.72, 0.16, 0.47, M('#6b4226'), 0, 0.4, 0); lid.name = 'lid'; o.add(lid); o.add(box(0.12, 0.14, 0.05, mats.brass, 0, 0.32, 0.24)); return o; },
        forage: (t) => { if (t.node === 'mushroom') { const o = RC.Mushrooms.cluster(THREE, t.mush, Math.floor(t.x * 13 + t.z * 7), mushMats); if (t.onTrunk) o.rotation.y = Math.atan2(Math.cos(t.face), Math.sin(t.face)); if (o.userData.glowMat) glowMats.add(o.userData.glowMat); return o; }
          const o = new THREE.Group(); const n = t.node;
          if (/vein/.test(n)) { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), M('#7b7f86', { flatShading: true })); rock.position.y = 0.25; o.add(rock); for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), M(n.startsWith('silver') ? '#e5e7eb' : n.startsWith('obsidian') ? '#1f1530' : '#b4693a', { metalness: 0.6, roughness: 0.3 })); s.position.set((RC.hash(i, 1, 9) - 0.5) * 0.6, 0.3 + RC.hash(i, 2, 9) * 0.3, 0.3); o.add(s); } }
          else if (n === 'timber_pile') for (let i = 0; i < 3; i++) { const l = cyl(0.12, 0.12, 0.9, M('#8b5a2b'), 8); l.rotation.z = Math.PI / 2; l.position.set(0, 0.12 + (i === 2 ? 0.22 : 0) - 0.45, (i - 1) * 0.25 * (i === 2 ? 0 : 1)); o.add(l); }
          else if (n === 'fruit_tree') { o.add(cyl(0.08, 0.12, 1.2, M('#6b4226'), 6)); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), M('#4ca04a', { flatShading: true })); c.position.y = 1.5; o.add(c); for (let i = 0; i < 5; i++) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), M('#dc2626')); a.position.set((RC.hash(i, 7, 7) - 0.5) * 0.9, 1.3 + RC.hash(i, 8, 8) * 0.5, (RC.hash(i, 9, 9) - 0.5) * 0.9); o.add(a); } }
          else { const c = { herb_patch: '#5fbf5a', berry_bush: '#2f7d32', mushroom_ring: '#d9b38c', beehive_log: '#b7791f', relic_scrap: '#8c8f99' }[n] || '#5fbf5a'; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(n === 'mushroom_ring' ? new THREE.ConeGeometry(0.09, 0.12, 7) : new THREE.SphereGeometry(0.09, 6, 4), M(c)); const a = i * 1.26; s.position.set(Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25); o.add(s); } }
          return o; },
        station: (t) => { const o = new THREE.Group();
          if (t.station === 'forge') { o.add(box(1.4, 0.9, 1, mats.darkStone)); o.add(box(0.9, 0.12, 0.6, mats.glow, 0, 0.9, 0)); o.add(box(0.5, 1.4, 0.5, mats.darkStone, 0, 0.9, -0.3)); }
          else if (t.station === 'alchemy') { o.add(cyl(0.55, 0.42, 0.7, mats.iron, 14)); o.add(cyl(0.48, 0.48, 0.05, new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#ea580c', emissiveIntensity: 0.8 }), 14, 0, 0.66)); }
          else { for (let i = 0; i < 3; i++) { const l = cyl(0.03, 0.03, 1.5, mats.iron, 5); l.position.set(Math.cos(i * 2.1) * 0.45, 0.65, Math.sin(i * 2.1) * 0.45); l.rotation.set(Math.sin(i * 2.1) * 0.3, 0, -Math.cos(i * 2.1) * 0.3); o.add(l); } const k = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, 6.3, 0, 2.2), mats.iron); k.position.y = 0.6; o.add(k); o.add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 6), mats.glow)); }
          return o; },
        boat: (t) => { const o = new THREE.Group(); const hm = M(t.hull || '#7c4a1e'); o.add(box(2.2, 0.45, 0.95, hm, -0.2, 0.05, 0)); const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.45, 3, 1), hm); bow.rotation.y = Math.PI / 6; bow.scale.set(1.3, 1, 1); bow.position.set(1.0, 0.28, 0); o.add(bow); o.add(box(2.0, 0.06, 0.8, M('#a0703f'), -0.2, 0.42, 0)); o.add(cyl(0.05, 0.05, 2.6, mats.darkWood, 6, 0, 0.3)); const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), M(t.sail || '#f5f0e1', { side: THREE.DoubleSide })); sail.position.set(0.05, 1.7, 0); sail.rotation.y = Math.PI / 2; o.add(sail); if (t.facing === 'left') o.rotation.y = Math.PI; return o; },
      };
      for (const t of realm.things) {
        if (t.kind === 'building' || !make[t.kind]) continue;
        const o = make[t.kind](t); o.userData.thing = t;
        if (t.kind === 'boat') { o.position.set(t.x, terrain.waterY, t.z); o.traverse((m) => { if (m.isMesh) m.castShadow = true; }); g.add(o); const ph = RC.hash(t.x, t.z, 1) * 6; tickers.push((tm2) => { o.position.y = terrain.waterY - 0.05 + Math.sin(tm2 * 1.3 + ph) * 0.06; o.rotation.z = Math.sin(tm2 * 1.1 + ph) * 0.04; }); continue; }
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
