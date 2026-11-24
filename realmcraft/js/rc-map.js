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

      // ---- trees: one per forest cell, three shapes, instanced
      const treeCells = []; for (let r = 0; r < realm.h; r++) for (let c = 0; c < realm.w; c++) if (terrain.paint[r][c] === 'T') treeCells.push([c, r]);
      const trunkGeo = new THREE.CylinderGeometry(0.09, 0.16, 1.3, 6).translate(0, 0.65, 0);
      const canopies = [0, 1, 2].map((v) => { const parts = []; const n = 3 + v; for (let i = 0; i < n; i++) { const r = 0.55 + RC.hash(i, v, 4) * 0.35; const ge = new THREE.IcosahedronGeometry(r, 0); ge.translate((RC.hash(i, v, 1) - 0.5) * 0.7, 1.4 + i * 0.32 + RC.hash(i, v, 2) * 0.3, (RC.hash(v, i, 3) - 0.5) * 0.7); parts.push(ge); } return THREE.BufferGeometryUtils.mergeGeometries(parts); });
      const trunkMesh = new THREE.InstancedMesh(trunkGeo, M('#6b4226'), treeCells.length); trunkMesh.castShadow = true;
      const leafMat = sway(M('#ffffff', { flatShading: true, roughness: 0.8 }), 0.05);
      const leafMeshes = canopies.map((ge) => { const m = new THREE.InstancedMesh(ge, leafMat, treeCells.length); m.castShadow = true; m.receiveShadow = true; m.count = 0; return m; });
      const tm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
      const greens = ['#3f8f3a', '#4ca04a', '#5cb25a', '#357a36', '#6cbf4a'];
      treeCells.forEach(([c, r], i) => {
        const x = c + 0.5 + (RC.hash(c, r, 5) - 0.5) * 0.6, z = r + 0.5 + (RC.hash(r, c, 6) - 0.5) * 0.6, s = 0.85 + RC.hash(c, r, 7) * 0.6;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), RC.hash(c, r, 8) * 6.28); ps.set(x, Y(x, z), z); sc.set(s, s * (0.9 + RC.hash(c, r, 9) * 0.3), s); tm.compose(ps, q, sc);
        trunkMesh.setMatrixAt(i, tm);
        const lm = leafMeshes[Math.floor(RC.hash(c, r, 10) * 3)]; lm.setMatrixAt(lm.count, tm); lm.setColorAt(lm.count, col.set(greens[Math.floor(RC.hash(c, r, 12) * greens.length)])); lm.count++;
      });
      g.add(trunkMesh, ...leafMeshes);

      // ---- grass tufts on grass, little flowers on meadow (instanced, swaying)
      const tuftGeo = (() => { const parts = []; for (let i = 0; i < 3; i++) { const p = new THREE.PlaneGeometry(0.05, 0.2).translate(0, 0.1, 0); p.rotateY(i * 1.05); parts.push(p); } return THREE.BufferGeometryUtils.mergeGeometries(parts); })();
      const spots = []; for (let r = 0; r < realm.h; r++) for (let c = 0; c < realm.w; c++) { const k = terrain.paint[r][c]; if (k === '.' || k === ',') for (let i = 0; i < (k === '.' ? 3 : 1); i++) if (RC.hash(c * 9 + i, r, 25) < RC.quality.grass) spots.push([c + RC.hash(c * 5 + i, r, 21), r + RC.hash(c, r * 5 + i, 22), k]); }
      const tufts = new THREE.InstancedMesh(tuftGeo, sway(M('#ffffff', { side: THREE.DoubleSide, roughness: 1 }), 0.45), spots.length);
      spots.forEach(([x, z, k], i) => { const s = 0.6 + RC.hash(i, 1, 23) * 0.7; tm.compose(ps.set(x, Y(x, z), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), RC.hash(i, 2, 24) * 6.28), sc.set(s, s, s)); tufts.setMatrixAt(i, tm); tufts.setColorAt(i, col.set(k === ',' ? ['#a6dd78', '#c3e88d', '#f5d0fe', '#fde68a'][i % 4] : ['#4f9a3a', '#5fae46', '#76c25a'][i % 3])); });
      tufts.receiveShadow = true; g.add(tufts);

      // ---- piers: planks over '=' cells, posts at the corners
      const pierCells = []; for (let r = 0; r < realm.h; r++) for (let c = 0; c < realm.w; c++) if (terrain.paint[r][c] === '=') pierCells.push([c, r]);
      const plank = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 1), M('#9a6a3a'), pierCells.length), post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), mats.darkWood, pierCells.length);
      pierCells.forEach(([c, r], i) => { plank.setMatrixAt(i, tm.compose(ps.set(c + 0.5, terrain.pierY - 0.05, r + 0.5), q.identity(), sc.set(0.98, 1, 0.98))); post.setMatrixAt(i, tm.compose(ps.set(c + 0.05, terrain.pierY - 0.55, r + 0.05), q, sc.set(1, 1, 1))); });
      plank.receiveShadow = plank.castShadow = true; g.add(plank, post);

      // ---- buildings
      const wallTex = (kind) => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
        if (kind === 'stone' || kind === 'darkstone') { x.fillStyle = kind === 'stone' ? '#c9c3b6' : '#6b6f78'; x.fillRect(0, 0, 128, 128); for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { x.fillStyle = `hsl(35, 8%, ${(kind === 'stone' ? 66 : 38) + RC.hash(c, r, 40) * 12}%)`; x.fillRect(c * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14); } }
        else { x.fillStyle = '#f2eadb'; x.fillRect(0, 0, 128, 128); if (kind === 'timber') { x.fillStyle = '#5b3a1f'; x.fillRect(0, 0, 128, 8); x.fillRect(0, 120, 128, 8); x.fillRect(0, 0, 8, 128); x.fillRect(60, 0, 8, 128); x.save(); x.translate(64, 64); x.rotate(0.7); x.fillRect(-90, -4, 180, 7); x.restore(); } }
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
      const WT = { plaster: wallTex('plaster'), timber: wallTex('timber'), stone: wallTex('stone'), darkstone: wallTex('darkstone') };
      const roofTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(0,0,0,.22)'; for (let r = 0; r < 8; r++) { x.fillRect(0, r * 8 + 6, 64, 2); for (let c = 0; c < 4; c++) x.fillRect(c * 16 + (r % 2) * 8, r * 8, 1.5, 8); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
      const STYLE = {
        one_story_cottage: { wall: 'timber', h: 2.4, roof: 1.6 }, two_story_timber: { wall: 'timber', h: 3.8, roof: 1.8 }, smithery_foundry: { wall: 'darkstone', h: 2.8, roof: 1.4, bigChimney: true },
        observatory_parlor: { wall: 'plaster', h: 2.8, roof: 1.5, tower: true }, grand_guildhall: { wall: 'stone', h: 4.0, roof: 1.9, columns: true }, l_wing_inn: { wall: 'timber', h: 3.4, roof: 1.7, wing: true },
        apothecary_conservatory: { wall: 'plaster', h: 2.6, roof: 1.5, glasshouse: true }, longhouse_tavern: { wall: 'timber', h: 2.3, roof: 2.2, barrels: true },
      };
      const gable = (w, d, h, mat) => { const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.lineTo(-d / 2, 0); const ge = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); ge.rotateY(Math.PI / 2); ge.translate(-w / 2, 0, 0); return new THREE.Mesh(ge, mat); };
      for (const b of realm.things.filter((t) => t.kind === 'building')) {
        const st = STYLE[b.style] || STYLE.one_story_cottage, grp = new THREE.Group(), fadeMats = [];
        const z0 = b.z + 0.5, z1 = b.z + b.d - 0.25, D = z1 - z0, cx = b.x + b.w / 2, cz = (z0 + z1) / 2, W = b.w - 0.3;
        const wt = WT[st.wall].clone(); wt.needsUpdate = true; wt.repeat.set(W / 2.4, st.h / 2.4);
        const wallM = M('#ffffff', { map: wt }); const roofM = M(ROOF[b.roof] || '#b4232a', { map: roofTex, roughness: 0.7 }); roofTex.repeat.set(3, 2); fadeMats.push(wallM, roofM);
        grp.add(box(W, st.h, D, wallM));
        const rf = gable(W + 0.6, D + 0.8, st.roof, roofM); rf.position.y = st.h; grp.add(rf);
        grp.add(box(W + 0.2, 0.25, D + 0.2, mats.darkStone, 0, -0.05, 0));   // plinth
        if (b.chimney) { const ch = box(st.bigChimney ? 1 : 0.55, st.roof + 1.2, st.bigChimney ? 1 : 0.55, mats.darkStone, W * 0.28, st.h, -D * 0.15); grp.add(ch); if (st.bigChimney) grp.add(box(0.6, 0.15, 0.6, mats.glow, W * 0.28, st.h + st.roof + 1.2, -D * 0.15)); }
        // front: door and windows (glowing at night)
        const front = D / 2 + 0.01, dx = b.door ? b.door.x - cx : 0;
        grp.add(box(1.0, 1.7, 0.12, mats.darkWood, dx, 0, front)); grp.add(box(1.3, 0.18, 0.2, mats.darkWood, dx, 1.75, front));
        for (let i = 0; i < Math.floor(W / 2.2); i++) { const wx = -W / 2 + 1.1 + i * 2.2; if (Math.abs(wx - dx) < 1.2) continue; grp.add(box(0.8, 0.8, 0.08, mats.glass, wx, 0.9, front)); grp.add(box(0.95, 0.1, 0.14, mats.darkWood, wx, 0.85, front)); if (st.h > 3.2) grp.add(box(0.8, 0.8, 0.08, mats.glass, wx, 2.4, front)); }
        if (st.tower) { const tw = cyl(1.1, 1.1, st.h + 2.2, wallM, 14, W / 2 - 0.6, 0, -D / 2 + 0.8); grp.add(tw); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.8, 14), roofM); cone.position.set(W / 2 - 0.6, st.h + 3.1, -D / 2 + 0.8); grp.add(cone); grp.add(box(0.5, 0.5, 0.1, mats.glass, W / 2 - 0.6, st.h + 1.2, -D / 2 + 1.91)); }
        if (st.columns) for (let i = 0; i < 4; i++) grp.add(cyl(0.22, 0.25, st.h - 0.1, M('#e8e2d4'), 10, -W / 2 + 1 + i * ((W - 2) / 3), 0, front + 0.55));
        if (st.wing) { const wg = box(3.2, st.h - 0.8, D * 0.6, wallM, W / 2 + 1.4, 0, -D * 0.15); grp.add(wg); const wr = gable(3.6, D * 0.6 + 0.6, 1.3, roofM); wr.rotation.y = Math.PI / 2; wr.position.set(W / 2 + 1.4, st.h - 0.8, -D * 0.15); grp.add(wr); }
        if (st.glasshouse) { const gm = new THREE.MeshStandardMaterial({ color: '#bfe8d0', transparent: true, opacity: 0.45, roughness: 0.1 }); grp.add(box(2.6, 2.0, D * 0.7, gm, -W / 2 - 1.3, 0, 0)); }
        if (st.barrels) for (let i = 0; i < 3; i++) grp.add(cyl(0.3, 0.3, 0.7, M('#7a4a22'), 10, dx + 1.4 + i * 0.65, 0, front + 0.5));
        // hanging sign over the door
        grp.add(box(0.08, 0.08, 0.7, mats.iron, dx + 0.9, 2.1, front + 0.35)); grp.add(box(0.7, 0.45, 0.06, M('#e9d8a6'), dx + 0.9, 1.6, front + 0.7));
        add(grp, cx, cz); grp.position.y = Y(cx, z1 + 0.3);
        buildings.push({ group: grp, mats: fadeMats, thing: b });
        label(b.name, cx, grp.position.y + st.h + st.roof + 0.6, cz, 'building');
      }

      // ---- the smaller things
      const make = {
        lamp: () => { const o = new THREE.Group(); o.add(cyl(0.05, 0.07, 2.2, mats.iron, 8)); o.add(box(0.42, 0.06, 0.06, mats.iron, 0.18, 2.1, 0)); const l = box(0.22, 0.3, 0.22, mats.glow, 0.36, 1.82, 0); o.add(l); return o; },
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
        shrub: (t) => { const o = new THREE.Group(); const c = { berry: '#2f7d32', fern: '#4c9a2a', blossom: '#5aa647', frost_bush: '#7fb3a8', ember_fern: '#8a5a2b' }[t.variant] || '#3f8f3a'; for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + RC.hash(i, 3, 3) * 0.12, 0), M(c, { flatShading: true })); s.position.set((RC.hash(i, 1, 1) - 0.5) * 0.5, 0.3, (RC.hash(i, 2, 2) - 0.5) * 0.5); o.add(s); } if (t.variant === 'berry' || t.variant === 'blossom') for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M(t.variant === 'berry' ? '#c81e4a' : '#f9a8d4')); b.position.set((RC.hash(i, 4, 4) - 0.5) * 0.7, 0.35 + RC.hash(i, 5, 5) * 0.3, (RC.hash(i, 6, 6) - 0.5) * 0.7); o.add(b); } return o; },
        chest: () => { const o = new THREE.Group(); o.add(box(0.7, 0.4, 0.45, M('#8b5a2b'))); const lid = box(0.72, 0.16, 0.47, M('#6b4226'), 0, 0.4, 0); lid.name = 'lid'; o.add(lid); o.add(box(0.12, 0.14, 0.05, mats.brass, 0, 0.32, 0.24)); return o; },
        forage: (t) => { const o = new THREE.Group(); const n = t.node;
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
      const lampSpots = realm.things.filter((t) => t.kind === 'lamp').map((t) => ({ x: t.x + 0.36, y: Y(t.x, t.z) + 1.75, z: t.z }));
      const pool = [0, 1, 2, 3, 4, 5].map(() => { const l = new THREE.PointLight('#ffb35c', 0, 9, 1.6); g.add(l); return l; });
      tickers.push((t2, s) => { if (!s.cam) return; const near = lampSpots.map((p) => [p, (p.x - s.cam.x) ** 2 + (p.z - s.cam.z) ** 2]).sort((a, b) => a[1] - b[1]); pool.forEach((l, i) => { const p = near[i] && near[i][0]; if (!p) { l.intensity = 0; return; } l.position.set(p.x, p.y, p.z); l.intensity = s.night * 6 * (0.92 + Math.sin(t2 * 7 + i) * 0.08); }); });
      return { group: g, labels, tickers, buildings, mats };
    },
  };
})();
