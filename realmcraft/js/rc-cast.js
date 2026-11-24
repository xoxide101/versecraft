// The Cast: the players (1, 2 or 4), the important people and the townsfolk, at every age (infant, child, adult, elder).
// The sim part moves them through their day (routes, stops, jobs, reacting to you, going home at night,
// sheltering from rain); the drawing part gives each a jointed body sized by age, with props for their job.
(function () {
  const RC = window.RC;
  const AGE = { infant: { s: 0.32, head: 1.6, speed: 0 }, child: { s: 0.66, head: 1.25, speed: 1.25 }, adult: { s: 1, head: 1, speed: 1.0 }, elder: { s: 0.95, head: 1, speed: 0.6 } };

  RC.Cast = {
    AGE,
    // ---------------------------------------------------------------- the sim
    person(def) {
      return { def, id: def.id, x: def.at.x, z: def.at.z, angle: Math.PI / 2, moving: 0, phase: Math.random() * 6, idx: 0, wait: 1 + Math.random() * 2,
        working: false, doing: '', mode: 'routine', modeT: 0, cool: 2 + Math.random() * 4, head: 0, hop: 0, hopV: 0, hidden: false, talking: false, home: null };
    },
    step(p, dt, w) {   // w: { time (calendar now), weather, player, doors, talkingTo }
      const d = p.def, age = AGE[d.age] || AGE.adult, speed = (d.speed || 1.45) * (d.age === 'elder' ? 1 : 1);   // tiles a second
      const night = w.time.period === 'night' && d.job !== 'patrol', rain = (w.weather === 'rain' || w.weather === 'storm') && d.job !== 'patrol' && d.job !== 'fish';
      const pl = w.player, dpl = Math.hypot(pl.x - p.x, pl.z - p.z);
      p.talking = w.talkingTo === p;
      // a bounce for hops and greetings
      p.hopV += (-90 * p.hop - 10 * p.hopV) * dt; p.hop = Math.max(0, p.hop + p.hopV * dt); if (p.hop === 0 && p.hopV < 0) p.hopV = Math.abs(p.hopV) > 0.4 ? -p.hopV * 0.3 : 0;
      // head turns to follow you when you pass
      const look = dpl < 3.6 && !p.talking ? RC.clamp(RC.wrapAngle(Math.atan2(pl.z - p.z, pl.x - p.x) - p.angle), -0.7, 0.7) : 0;
      p.head += (look - p.head) * Math.min(1, dt * 6);
      p.cool = Math.max(0, p.cool - dt);
      let tx = null, tz = null;
      if (p.talking) { p.moving = RC.damp(p.moving, 0, 10, dt); p.angle = RC.dampAngle(p.angle, Math.atan2(pl.z - p.z, pl.x - p.x), 8, dt); p.working = false; return; }
      // going home: at night (and sheltering by a door in rain)
      if (night || rain) {
        if (!p.home) p.home = RC.Cast.nearestDoor(p, w.doors);
        if (p.home) { tx = p.home.x; tz = p.home.z + 0.4; if (Math.hypot(tx - p.x, tz - p.z) < 0.3) { p.moving = RC.damp(p.moving, 0, 8, dt); if (night) p.hidden = true; p.working = false; p.doing = night ? '' : 'Sheltering from the rain'; return; } }
      } else if (p.hidden || p.home) { p.hidden = false; p.home = null; }
      if (tx == null) {
        // little moments: a wave when you come near, children hopping
        if (p.mode !== 'routine') { p.modeT -= dt; if (p.modeT <= 0) { p.mode = 'routine'; p.cool = 5 + Math.random() * 6; } }
        else if (p.cool === 0 && dpl < 2.4 && !p.working) { p.mode = 'wave'; p.modeT = 1.4; p.hopV = 1.2; }
        else if (p.cool === 0 && d.age === 'child' && Math.random() < dt * 0.3) { p.mode = 'hop'; p.modeT = 0.8; p.hopV = 2.2; }
        const route = d.route;
        if (route && route.length) {
          const wp = route[p.idx % route.length];
          if (p.wait > 0) { p.wait -= dt; p.working = !!wp.work || (d.job !== 'stroll' && d.job !== 'patrol' && d.job !== 'play' && d.job !== 'stand' && p.wait > 0.3 && !!wp.wait); p.doing = wp.doing || ''; if (p.wait <= 0) { p.idx = (p.idx + 1) % route.length; p.working = false; } }
          else { tx = wp.x; tz = wp.z; const blocked = (w.circles || []).some((c) => Math.hypot(tx - c.x, tz - c.z) < c.r + 0.35 && Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.6); if (Math.hypot(tx - p.x, tz - p.z) < 0.12 || blocked) { p.wait = wp.wait != null ? wp.wait : 1.5; tx = null; } }   // (a stop inside the fountain: they stand at its rim)
        } else { p.working = d.job !== 'stand' && d.job !== 'stroll'; if (Math.random() < dt * 0.15) p.angle += (Math.random() - 0.5) * 1.2; }
        if (p.mode === 'wave') { p.angle = RC.dampAngle(p.angle, Math.atan2(pl.z - p.z, pl.x - p.x), 6, dt); tx = null; }
      }
      if (tx != null) {
        const a = Math.atan2(tz - p.z, tx - p.x), dist = Math.hypot(tx - p.x, tz - p.z), v = Math.min(speed * dt, dist);
        // round, not through: if a solid thing (the fountain, the well, a statue) stands in the way, bend the heading round its edge
        let ha = a; for (const c of w.circles || []) { const dx = c.x - p.x, dz = c.z - p.z, dc = Math.hypot(dx, dz), R2 = c.r + 0.45; if (dc > R2 + 2.2 || dc < 1e-3) continue;
          const toC = Math.atan2(dz, dx), off = RC.wrapAngle(ha - toC); if (Math.abs(off) < Math.asin(Math.min(1, R2 / dc)) + 0.05 && dc < dist + R2) ha = toC + (off >= 0 ? 1 : -1) * Math.min(Math.PI / 2, Math.asin(Math.min(1, R2 / dc)) + 0.12); }
        p.x += Math.cos(ha) * v; p.z += Math.sin(ha) * v;
        for (const c of w.circles || []) { const dx = p.x - c.x, dz = p.z - c.z, dc = Math.hypot(dx, dz), R2 = c.r + 0.35; if (dc < R2 && dc > 1e-4) { p.x = c.x + dx / dc * R2; p.z = c.z + dz / dc * R2; } }   // (never inside)
        p.angle = RC.dampAngle(p.angle, ha, 7, dt); p.moving = RC.damp(p.moving, 1, 8, dt); p.working = false;
      } else p.moving = RC.damp(p.moving, 0, 8, dt);
      p.phase += dt * (3 + speed * 4) * p.moving;
    },
    nearestDoor(p, doors) { let best = null, bd = 1e9; for (const d of doors) { const k = Math.hypot(d.x - p.x, d.z - p.z); if (k < bd) { bd = k; best = d; } } return best; },

    // ---------------------------------------------------------------- the drawing: a jointed body
    // the real people (rc-folk.js): a smooth skinned body with a face, walking and breathing from its clips, the job's poses laid on top
    folkRig(THREE, def, opt) {
      const look = def.look || {}, f = RC.Folk.make(def, look, opt.player), root = f.root, job = opt.job, M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o || {}));
      const mesh = (ge, m, x = 0, y = 0, z = 0, parent) => { const o = new THREE.Mesh(ge, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
      // what they carry, in the right hand
      const prop = new THREE.Group(); prop.position.set(0, -0.07, 0.02);
      const P = (ge, m, x = 0, y = 0, z = 0) => mesh(ge, m, x, y, z, prop);
      const wood = M('#8b5a2b'), iron = M('#6b7280', { metalness: 0.6, roughness: 0.4 });
      if (job === 'sweep') { P(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6), wood, 0, -0.1, 0.05); P(new THREE.ConeGeometry(0.12, 0.28, 8), M('#c8a85a'), 0, -0.75, 0.05); }
      else if (job === 'hammer') { P(new THREE.CylinderGeometry(0.014, 0.016, 0.38, 6), wood, 0, -0.05, 0.08).rotation.x = 1.4; P(new THREE.BoxGeometry(0.06, 0.06, 0.13), iron, 0, -0.03, 0.26); }
      else if (job === 'carry water') { P(new THREE.CylinderGeometry(0.11, 0.09, 0.22, 12), M('#8a5a32'), 0, -0.14, 0); }
      else if (job === 'carry crates') { P(new THREE.BoxGeometry(0.42, 0.3, 0.36), M('#a2703f'), -0.22, -0.02, 0.22); }
      else if (job === 'fish') { const r2 = P(new THREE.CylinderGeometry(0.008, 0.014, 1.8, 5), wood, 0, 0.35, 0.45); r2.rotation.x = 1.0; }
      else if (job === 'read') { P(new THREE.BoxGeometry(0.2, 0.035, 0.15), M('#6a2a14'), -0.08, 0.02, 0.06); }
      else if (job === 'serve' || job === 'baker') { P(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), M('#c8ccd0', { metalness: 0.5, roughness: 0.4 }), 0, 0.0, 0.12); P(new THREE.SphereGeometry(0.06, 10, 8), M('#c88a3a'), 0, 0.04, 0.12); }
      else if (job === 'patrol') { P(new THREE.CylinderGeometry(0.016, 0.016, 1.9, 6), wood, 0, 0.35, 0.02); P(new THREE.ConeGeometry(0.04, 0.2, 4), iron, 0, 1.38, 0.02); }
      else if (job === 'garden') { P(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 6), wood, 0, -0.15, 0.08); P(new THREE.BoxGeometry(0.12, 0.02, 0.1), iron, 0, -0.55, 0.1); }
      f.onReady = () => {
        const B = f.bones;
        if (B.RArm1Wr) B.RArm1Wr.add(prop);
        if (false && opt.player && B.Chest) {   // (the old cloak and back sword: the hero now wears a coat, a baldric and a sword at the hip, rc-folk.js)
          const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.0, 4, 8).translate(0, -0.5, 0), M(look.cloak || '#8a1c1c', { side: THREE.DoubleSide })); cape.position.set(0, 0.2, -0.13); cape.castShadow = true; B.Chest.add(cape); f.cape = cape;
          const sw = new THREE.Group(); sw.position.set(0.1, 0.1, -0.15); sw.rotation.z = 0.6; B.Chest.add(sw); mesh(new THREE.BoxGeometry(0.05, 0.75, 0.02), M('#cbd5e1', { metalness: 0.8, roughness: 0.25 }), 0, 0.2, 0, sw); mesh(new THREE.BoxGeometry(0.2, 0.04, 0.05), M('#b45309'), 0, -0.18, 0, sw);
        }
        if (opt.carries === 'infant' && B.Chest) { const baby = new THREE.Group(); baby.position.set(0, -0.02, 0.17); B.Chest.add(baby); mesh(new THREE.CapsuleGeometry(0.075, 0.15, 3, 8), M('#f2ead6'), 0, 0, 0, baby).rotation.z = Math.PI / 2; mesh(new THREE.SphereGeometry(0.07, 12, 10), M('#f0cdb0'), 0.14, 0.04, 0, baby); f.baby = baby; }
        if (opt.onReady) opt.onReady(f);
      };
      let lastT = null;
      return {
        root, parts: {}, folk: f,
        update(s, t) {
          const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
          if (!f.ready) return;
          const mv = RC.clamp(s.moving, 0, 1); f.actions.move.setEffectiveWeight(mv); f.actions.idle.setEffectiveWeight(1 - mv);
          f.actions.move.timeScale = ((def.speed || 1.45) / 1.45) * (def.age === 'child' ? 1.25 : def.age === 'elder' ? 0.8 : 1);
          f.mixer.update(dt);
          const B = f.bones, add = (n, x = 0, y = 0, z = 0) => { const b = B[n]; if (b) { b.rotation.x += x; b.rotation.y += y; b.rotation.z += z; } };
          add('Head', 0, s.head || 0);
          if (root.children[0]) root.children[0].position.y = s.hop || 0;
          const wk = t * 4;
          if (s.working) {
            if (job === 'sweep') { add('RArm1Sh', -0.6 + Math.sin(wk) * 0.4); add('LArm1Sh', -0.7 + Math.sin(wk) * 0.4); add('Spine', 0, Math.sin(wk) * 0.2); }
            else if (job === 'hammer' || job === 'craft') { add('RArm1Sh', -1.5 + Math.abs(Math.sin(wk * 1.2)) * 1.3); add('RArm1El', -0.6); }
            else if (job === 'garden') { add('Spine', 0.45); add('RArm1Sh', -0.8 + Math.sin(wk) * 0.3); add('LArm1Sh', -0.6); }
            else if (job === 'fish') { add('RArm1Sh', -0.9 + Math.sin(t * 0.8) * 0.05); add('LArm1Sh', -0.8); add('RArm1El', -0.4); }
            else if (job === 'read') { add('RArm1Sh', -0.7); add('LArm1Sh', -0.7); add('RArm1El', -1.0); add('LArm1El', -1.0); add('Head', 0.35); }
            else if (job === 'serve' || job === 'baker') { add('RArm1Sh', -0.3); add('RArm1El', -1.3); add('LArm1Sh', -0.3 + Math.sin(wk) * 0.3); }
            else if (job === 'carry water' || job === 'carry crates') add('LArm1Sh', -0.3);
          }
          if (job === 'carry crates' && s.moving > 0.2) { add('RArm1Sh', -0.8); add('LArm1Sh', -0.8); add('RArm1El', -0.7); add('LArm1El', -0.7); }
          if ((job === 'serve' || job === 'baker') && !s.working) { add('RArm1Sh', -0.2); add('RArm1El', -1.2); }
          if (job === 'patrol') add('RArm1Sh', -0.2);
          if (s.mode === 'wave') add('RArm1Sh', 0, 0, -2.5 + Math.sin(t * 10) * 0.3);
          if (s.talking) { add('Head', Math.sin(t * 5) * 0.05); add('RArm1Sh', -0.3 + Math.sin(t * 3) * 0.15); add('RArm1El', -0.5); }
          if (f.baby) { add('RArm1Sh', -0.6); add('LArm1Sh', -0.6); add('RArm1El', -1.1); add('LArm1El', -1.1); f.baby.rotation.z = Math.sin(t * 1.5) * 0.08; }
          if (f.cape) f.cape.rotation.x = 0.12 + s.moving * 0.35 + Math.sin(t * 2.3 + s.phase) * 0.04;
          if (f.head) { const near = s.ring !== 'far'; if (f.head.near !== near) { f.head.near = near; for (const d of [...(f.head.detail || []), ...(f.small || [])]) d.visible = near; } if (near) f.head.update(t); }
        },
      };
    },
    rig(THREE, look, ageName, opt = {}) {
      if (RC.Folk && RC.Folk.has() && opt.def && RC.settings.folk !== false) return RC.Cast.folkRig(THREE, opt.def, opt);   // (the real people when their bodies are packed; the old jointed figures otherwise)
      const age = AGE[ageName] || AGE.adult, M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o || {}));
      const skin = M(look.skin || '#f1c9a5'), tunic = M(look.tunic || '#93c5fd'), cloak = M(look.cloak || '#1d4ed8', { side: THREE.DoubleSide }), hair = M(look.hair || '#5b3a29'), dark = M('#3b2a1e'), legM = M(look.legs || '#4b5563');
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(age.s);
      const mesh = (ge, m, x = 0, y = 0, z = 0, parent = body) => { const o = new THREE.Mesh(ge, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
      const limb = (x, y, len, r, m, foot) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); body.add(piv); mesh(new THREE.CapsuleGeometry(r, len - r * 2, 3, 8), m, 0, -len / 2, 0, piv); if (foot) mesh(new THREE.BoxGeometry(r * 2.2, r * 1.4, r * 3.2), dark, 0, -len + 0.02, r * 0.6, piv); return piv; };
      const legL = limb(-0.1, 0.72, 0.7, 0.075, legM, true), legR = limb(0.1, 0.72, 0.7, 0.075, legM, true);
      const torso = new THREE.Group(); torso.position.y = 0.72; body.add(torso);
      mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.58, 10), tunic, 0, 0.29, 0, torso);
      mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 10), dark, 0, 0.04, 0, torso);
      const sh = 0.53, arm = (x) => { const piv = new THREE.Group(); piv.position.set(x, sh, 0); torso.add(piv); mesh(new THREE.CapsuleGeometry(0.06, 0.38, 3, 8), tunic, 0, -0.24, 0, piv); mesh(new THREE.SphereGeometry(0.065, 8, 6), skin, 0, -0.5, 0, piv); return piv; };
      const armL = arm(-0.27), armR = arm(0.27);
      const head = new THREE.Group(); head.position.y = 0.62; torso.add(head); head.scale.setScalar(age.head);
      mesh(new THREE.SphereGeometry(0.17, 16, 12), skin, 0, 0.17, 0, head);
      const hairCap = mesh(new THREE.SphereGeometry(0.182, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.19, -0.01, head);
      if (ageName === 'elder') hairCap.material = M('#e5e7eb');
      for (const ex of [-0.06, 0.06]) mesh(new THREE.SphereGeometry(0.022, 6, 4), M('#1f2937'), ex, 0.19, 0.155, head);
      // a cloak (longer, a cape, for players)
      const cape = new THREE.Group(); cape.position.set(0, 0.55, -0.2); torso.add(cape);
      mesh(new THREE.PlaneGeometry(0.46, opt.player ? 1.0 : 0.75).translate(0, opt.player ? -0.5 : -0.375, 0), cloak, 0, 0, 0, cape);
      if (ageName === 'elder') torso.rotation.x = 0.2;
      // props by job
      const prop = new THREE.Group(); armR.add(prop); prop.position.set(0, -0.52, 0.05);
      const P = (ge, m, x = 0, y = 0, z = 0) => mesh(ge, m, x, y, z, prop);
      const wood = M('#8b5a2b'), iron = M('#6b7280', { metalness: 0.6, roughness: 0.4 });
      const job = opt.job;
      if (job === 'sweep') { P(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), wood, 0, -0.2, 0.1); P(new THREE.ConeGeometry(0.12, 0.25, 6), M('#d6b86a'), 0, -0.8, 0.1); }
      else if (job === 'hammer') { P(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), wood, 0, -0.1, 0.1); P(new THREE.BoxGeometry(0.16, 0.08, 0.08), iron, 0, -0.3, 0.1); }
      else if (job === 'carry water') { P(new THREE.CylinderGeometry(0.11, 0.09, 0.2, 10), M('#9a6a3a'), 0, -0.1, 0.05); }
      else if (job === 'carry crates') { P(new THREE.BoxGeometry(0.4, 0.3, 0.35), M('#a2703f'), -0.25, 0.05, 0.25); }
      else if (job === 'fish') { const r = P(new THREE.CylinderGeometry(0.012, 0.015, 1.6, 5), wood, 0, 0.3, 0.4); r.rotation.x = 1.0; }
      else if (job === 'read') { P(new THREE.BoxGeometry(0.22, 0.04, 0.17), M('#7c2d12'), -0.1, 0.1, 0.2); }
      else if (job === 'serve' || job === 'baker') { P(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), M('#d1d5db'), 0, 0.05, 0.2); P(new THREE.SphereGeometry(0.07, 8, 6), M('#d97706'), 0, 0.1, 0.2); }
      else if (job === 'patrol') { P(new THREE.CylinderGeometry(0.018, 0.018, 1.8, 5), wood, 0, 0.3, 0.05); P(new THREE.ConeGeometry(0.05, 0.18, 4), iron, 0, 1.25, 0.05); }
      else if (job === 'garden') { P(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 5), wood, 0, -0.2, 0.15); }
      if (opt.player) { const sw = new THREE.Group(); sw.position.set(0.12, 0.45, -0.24); sw.rotation.z = 0.6; torso.add(sw); mesh(new THREE.BoxGeometry(0.05, 0.75, 0.02), M('#cbd5e1', { metalness: 0.8, roughness: 0.25 }), 0, 0.2, 0, sw); mesh(new THREE.BoxGeometry(0.2, 0.04, 0.05), M('#b45309'), 0, -0.18, 0, sw); }
      // a baby in arms
      let baby = null; if (opt.carries === 'infant') { baby = new THREE.Group(); baby.position.set(0, 0.32, 0.22); torso.add(baby); mesh(new THREE.CapsuleGeometry(0.08, 0.16, 3, 8), M('#f5ecd5'), 0, 0, 0, baby).rotation.z = Math.PI / 2; mesh(new THREE.SphereGeometry(0.075, 10, 8), skin, 0.15, 0.04, 0, baby); }
      const parts = { body, legL, legR, armL, armR, torso, head, cape, prop };
      return {
        root, parts,
        update(s, t) {   // s: the person's sim state
          const sw = Math.sin(s.phase) * 0.6 * s.moving;
          legL.rotation.x = sw; legR.rotation.x = -sw;
          armL.rotation.set(-sw * 0.8, 0, 0); armR.rotation.set(sw * 0.8, 0, 0);
          torso.rotation.y = 0; head.rotation.set(0, s.head || 0, 0);
          cape.rotation.x = 0.12 + s.moving * 0.35 + Math.sin(t * 2.3 + s.phase) * 0.04;
          body.position.y = (s.hop || 0) + Math.abs(Math.cos(s.phase)) * 0.03 * s.moving;
          const wk = s.working ? t * 4 : 0;
          if (s.working) {
            if (job === 'sweep') { armR.rotation.x = -0.6 + Math.sin(wk) * 0.4; armL.rotation.x = -0.7 + Math.sin(wk) * 0.4; torso.rotation.y = Math.sin(wk) * 0.2; }
            else if (job === 'hammer' || job === 'craft') { armR.rotation.x = -1.6 + Math.abs(Math.sin(wk * 1.2)) * 1.5; }
            else if (job === 'garden') { torso.rotation.x = 0.45; armR.rotation.x = -0.8 + Math.sin(wk) * 0.3; armL.rotation.x = -0.6; }
            else if (job === 'fish') { armR.rotation.x = -0.9 + Math.sin(t * 0.8) * 0.05; armL.rotation.x = -0.8; }
            else if (job === 'read') { armR.rotation.x = -1.1; armL.rotation.x = -1.1; head.rotation.x = 0.35; }
            else if (job === 'serve' || job === 'baker') { armR.rotation.x = -1.2; armL.rotation.x = -0.4 + Math.sin(wk) * 0.3; }
            else if (job === 'carry water' || job === 'carry crates') { armL.rotation.x = -0.3; }
          }
          if (job === 'carry crates' && s.moving > 0.2) { armR.rotation.x = -1.2; armL.rotation.x = -1.2; }
          if (job === 'patrol') armR.rotation.x = -0.25;
          if (s.mode === 'wave') { armR.rotation.set(0, 0, 2.6 + Math.sin(t * 10) * 0.35); }
          if (s.talking) { head.rotation.x = Math.sin(t * 5) * 0.05; armR.rotation.x = -0.3 + Math.sin(t * 3) * 0.15; }
          if (baby) { armL.rotation.x = -1.0; armR.rotation.x = -1.0; baby.rotation.z = Math.sin(t * 1.5) * 0.08; }
          if (ageName === 'elder') torso.rotation.x = 0.2;
          if (job === 'garden' && !s.working) torso.rotation.x = 0;
        },
      };
    },
  };
})();
