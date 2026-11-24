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
          else { tx = wp.x; tz = wp.z; if (Math.hypot(tx - p.x, tz - p.z) < 0.12) { p.wait = wp.wait != null ? wp.wait : 1.5; tx = null; } }
        } else { p.working = d.job !== 'stand' && d.job !== 'stroll'; if (Math.random() < dt * 0.15) p.angle += (Math.random() - 0.5) * 1.2; }
        if (p.mode === 'wave') { p.angle = RC.dampAngle(p.angle, Math.atan2(pl.z - p.z, pl.x - p.x), 6, dt); tx = null; }
      }
      if (tx != null) {
        const a = Math.atan2(tz - p.z, tx - p.x), dist = Math.hypot(tx - p.x, tz - p.z), v = Math.min(speed * dt, dist);
        p.x += Math.cos(a) * v; p.z += Math.sin(a) * v; p.angle = RC.dampAngle(p.angle, a, 7, dt); p.moving = RC.damp(p.moving, 1, 8, dt); p.working = false;
      } else p.moving = RC.damp(p.moving, 0, 8, dt);
      p.phase += dt * (3 + speed * 4) * p.moving;
    },
    nearestDoor(p, doors) { let best = null, bd = 1e9; for (const d of doors) { const k = Math.hypot(d.x - p.x, d.z - p.z); if (k < bd) { bd = k; best = d; } } return best; },

    // ---------------------------------------------------------------- the drawing: a jointed body
    rig(THREE, look, ageName, opt = {}) {
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
