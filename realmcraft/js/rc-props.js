// Things about the town, made properly: coopered barrels with iron hoops, nailed crates with battens, sacks, an iron-bound
// chest whose lid swings up on its hinges (coins inside), a stone well with a winch, rope and bucket, the alchemist's
// cauldron bubbling over a fire, the cooking kettle on its tripod, a campfire of split logs with flames and embers, an anvil
// on a stump. Fires flicker and smoke a little; the cauldron bubbles and steams.
(function () {
  const RC = window.RC;
  RC.Props = {
    // ctx: { T, M, woodM, mats, GRANM, beamM, shared, tickers }
    make(ctx) {
      const { T, M, woodM, mats, GRANM, shared, tickers } = ctx, r0 = RC.rng(0.37);
      const iron = M('#2e3238', { metalness: 0.6, roughness: 0.55 }), rust = M('#5a3a2a', { metalness: 0.3, roughness: 0.8 });
      const oak = woodM('#9a6a3e', 1.2, 0.5), oakDark = woodM('#6a4628', 0.8, 0.6), stave = woodM('#8a5a32', 3, 0.5);
      const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
      const boxG = (w, h, d) => new T.BoxGeometry(w, h, d);
      const flameMat = () => { const m = new T.MeshStandardMaterial({ color: '#ffb040', emissive: '#ff7a1a', emissiveIntensity: 2.2, transparent: true, opacity: 0.85, depthWrite: false }); m.userData.noWeather = true; return m; };
      // flames: a few tongues that flicker and sway; embers glowing under them; a little smoke
      const fire = (g, size, x = 0, y = 0, z = 0) => {
        const f = new T.Group(); f.position.set(x, y, z); g.add(f); const fm = flameMat(), tongues = [];
        for (let i = 0; i < 6; i++) { const t = new T.Mesh(new T.ConeGeometry(0.07 * size, 0.38 * size, 6, 1, true), fm); t.position.set(Math.cos(i * 1.1) * 0.08 * size, 0.17 * size, Math.sin(i * 1.1) * 0.08 * size); f.add(t); tongues.push([t, Math.random() * 6]); }
        const core = new T.Mesh(new T.SphereGeometry(0.12 * size, 8, 6), new T.MeshStandardMaterial({ color: '#ffd080', emissive: '#ffa040', emissiveIntensity: 3 })); core.scale.y = 0.6; core.position.y = 0.06 * size; f.add(core);
        const embers = new T.Mesh(new T.CylinderGeometry(0.2 * size, 0.24 * size, 0.05, 12), new T.MeshStandardMaterial({ color: '#3a1a0a', emissive: '#c03a10', emissiveIntensity: 1.2, roughness: 1 })); embers.position.y = 0.02; f.add(embers);
        tickers.push((t) => { for (const [tg, ph] of tongues) { const k = 0.75 + 0.35 * Math.sin(t * 11 + ph) * Math.sin(t * 7.3 + ph * 2); tg.scale.set(1, k, 1); tg.position.y = 0.17 * size * k; tg.rotation.z = Math.sin(t * 5 + ph) * 0.15; }
          embers.material.emissiveIntensity = 1 + Math.sin(t * 3.1) * 0.25; core.material.emissiveIntensity = 2.6 + Math.sin(t * 13) * 0.5; });
        return f;
      };
      const logs = (g, n, len, rad, y = 0) => { for (let i = 0; i < n; i++) { const l = mesh(new T.CylinderGeometry(rad, rad * 1.1, len, 7), oakDark); l.rotation.z = Math.PI / 2 - 0.25; l.rotation.y = (i / n) * Math.PI * 2; l.position.set(Math.cos(l.rotation.y) * 0.12, y + rad + 0.03, -Math.sin(l.rotation.y) * 0.12); g.add(l); } };
      const stones = (g, n, R) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, s = mesh(RC.roughBox(T, 0.2, 0.14, 0.16, 0.05, r0), GRANM); s.position.set(Math.cos(a) * R, 0.05, Math.sin(a) * R); s.rotation.y = -a; g.add(s); } };
      const P = {
        // a coopered barrel: bulging staves, four iron hoops, a lid sunk in the top
        barrel(h = 0.9, rad = 0.3) {
          const g = new T.Group(), pts = []; for (let i = 0; i <= 10; i++) { const f = i / 10; pts.push(new T.Vector2(rad * (0.84 + 0.16 * Math.sin(f * Math.PI)), f * h)); }
          g.add(mesh(new T.LatheGeometry(pts, 18), stave));
          for (const f of [0.07, 0.3, 0.7, 0.93]) { const hr = mesh(new T.TorusGeometry(rad * (0.85 + 0.16 * Math.sin(f * Math.PI)) + 0.004, 0.012, 4, 24), iron); hr.rotation.x = Math.PI / 2; hr.position.y = f * h; hr.scale.z = 2.2; g.add(hr); }
          const lid = mesh(new T.CircleGeometry(rad * 0.82, 18).rotateX(-Math.PI / 2), oakDark); lid.position.y = h - 0.02; g.add(lid);
          return g;
        },
        // a nailed crate: plank sides, a batten frame round every edge, a brace across each side
        crate(s = 0.6) {
          const g = new T.Group(), b = s / 2; g.add(mesh(boxG(s * 0.96, s * 0.96, s * 0.96), woodM('#a8784a', 1, 1), 0, b, 0));
          for (const [w, h, d, x, y, z] of [[s, 0.06, 0.06, 0, 0.03, b - 0.03], [s, 0.06, 0.06, 0, 0.03, -b + 0.03], [s, 0.06, 0.06, 0, s - 0.03, b - 0.03], [s, 0.06, 0.06, 0, s - 0.03, -b + 0.03],
            [0.06, s, 0.06, b - 0.03, b, b - 0.03], [0.06, s, 0.06, -b + 0.03, b, b - 0.03], [0.06, s, 0.06, b - 0.03, b, -b + 0.03], [0.06, s, 0.06, -b + 0.03, b, -b + 0.03],
            [0.06, 0.06, s, b - 0.03, 0.03, 0], [0.06, 0.06, s, -b + 0.03, 0.03, 0], [0.06, 0.06, s, b - 0.03, s - 0.03, 0], [0.06, 0.06, s, -b + 0.03, s - 0.03, 0]]) g.add(mesh(boxG(w, h, d), oakDark, x, y, z));
          for (const [rx, ry, x, z] of [[0, 0, 0, b + 0.005], [0, 0, 0, -b - 0.005], [0, Math.PI / 2, b + 0.005, 0], [0, Math.PI / 2, -b - 0.005, 0]]) { const br = mesh(boxG(0.06, s * 1.25, 0.02), oakDark, x, b, z); br.rotation.set(0, ry, Math.PI / 4); g.add(br); }
          return g;
        },
        // a sack of grain: lumpy, slumped, tied at the neck
        sack(s = 1) {
          const ge = new T.SphereGeometry(0.28 * s, 14, 10), p = ge.attributes.position;
          for (let i = 0; i < p.count; i++) { const y = p.getY(i), n = 1 + (RC.vnoise(p.getX(i) * 9, p.getZ(i) * 9 + y * 5, 1, 77) - 0.5) * 0.25; p.setXYZ(i, p.getX(i) * n * (1.1 - y * 0.8), Math.max(-0.2 * s, y * 1.25) + 0.25 * s, p.getZ(i) * n * (1.1 - y * 0.8)); }
          ge.computeVertexNormals(); const g = new T.Group(), burlap = M('#b09a72', { roughness: 1 }); g.add(mesh(ge, burlap)); g.add(mesh(new T.CylinderGeometry(0.05 * s, 0.07 * s, 0.12 * s, 8), burlap, 0, 0.62 * s, 0)); g.add(mesh(new T.TorusGeometry(0.055 * s, 0.012, 4, 12).rotateX(Math.PI / 2), M('#6a5a3a'), 0, 0.58 * s, 0));
          return g;
        },
        // the chest: planked and iron-bound, a rounded lid on hinges at the back (named 'lid' for the game to swing open), a lock plate, coins inside
        chest() {
          const g = new T.Group(), W = 0.78, H = 0.42, D = 0.5;
          g.add(mesh(boxG(W, H, D), woodM('#7a4a26', 1.2, 0.6), 0, H / 2, 0));
          for (const x of [-W / 2 + 0.08, 0, W / 2 - 0.08]) { g.add(mesh(boxG(0.06, H + 0.01, D + 0.02), iron, x, H / 2, 0)); }
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(boxG(0.1, 0.1, 0.1), iron, sx * (W / 2 - 0.02), 0.05, sz * (D / 2 - 0.02)));
          const coins = mesh(new T.CylinderGeometry(W * 0.4, W * 0.45, 0.06, 12), M('#e8b830', { metalness: 0.9, roughness: 0.3 }), 0, H - 0.05, 0); coins.scale.z = 0.6; g.add(coins);
          const lid = new T.Group(); lid.name = 'lid'; lid.userData.hinge = true; lid.position.set(0, H, -D / 2); g.add(lid);
          const arc = mesh(new T.CylinderGeometry(D / 2, D / 2, W, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), woodM('#6a3e20', 1, 0.6), 0, 0, D / 2); arc.rotation.x = 0; arc.scale.y = 0.7; lid.add(arc);
          for (const x of [-W / 2 + 0.08, 0, W / 2 - 0.08]) { const band = mesh(new T.CylinderGeometry(D / 2 + 0.012, D / 2 + 0.012, 0.06, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), iron, x, 0, D / 2); band.scale.y = 0.7; lid.add(band); }
          lid.add(mesh(boxG(0.14, 0.16, 0.03), M('#c8a040', { metalness: 0.8, roughness: 0.35 }), 0, -0.02, D + 0.01));
          for (const s of [-1, 1]) { const h = mesh(new T.TorusGeometry(0.05, 0.01, 4, 10, Math.PI), iron, s * (W / 2 + 0.01), H * 0.7, 0); h.rotation.y = Math.PI / 2; g.add(h); }
          return g;
        },
        // the well: a ring of dressed stone with a coping, dark water deep down, two posts, a winch with a crank, rope and bucket, a little shingled roof
        well() {
          const g = new T.Group(), R = 0.75, H = 0.8, n = 14;
          for (let row = 0, y = 0; row < 4; row++) { const bh = H / 4; for (let i = 0; i < n; i++) { const a = ((i + (row % 2) * 0.5) / n) * Math.PI * 2, s = mesh(RC.roughBox(T, (2 * Math.PI * R) / n - 0.02, bh - 0.02, 0.22, 0.03, r0), GRANM); s.position.set(Math.cos(a) * R, y + bh / 2, Math.sin(a) * R); s.rotation.y = -a + Math.PI / 2; g.add(s); } y += bh; }
          g.add(mesh(new T.TorusGeometry(R, 0.13, 6, 24).rotateX(Math.PI / 2), GRANM, 0, H + 0.04, 0));
          const water = mesh(new T.CircleGeometry(R - 0.1, 20).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: '#0a1418', roughness: 0.05, metalness: 0.2 }), 0, H - 0.5, 0); g.add(water);
          g.add(mesh(new T.CylinderGeometry(R - 0.1, R - 0.1, 0.5, 20, 1, true), M('#1a1c1e', { side: T.BackSide }), 0, H - 0.25, 0));   // the shaft's inside, dark
          for (const s of [-1, 1]) g.add(mesh(boxG(0.14, 1.9, 0.14), oakDark, s * (R + 0.05), 0.95, 0));
          const axle = mesh(new T.CylinderGeometry(0.07, 0.07, 2 * R + 0.3, 10).rotateZ(Math.PI / 2), oak, 0, 1.55, 0); g.add(axle);
          g.add(mesh(new T.CylinderGeometry(0.09, 0.09, 0.4, 10).rotateZ(Math.PI / 2), M('#a89070', { roughness: 1 }), 0, 1.55, 0));   // rope wound round
          g.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.75, 4), M('#a89070'), 0.1, 1.17, 0.08));   // rope down
          g.add(P.barrel(0.24, 0.12).translateX(0.1).translateY(0.55).translateZ(0.08));   // the bucket
          const crank = new T.Group(); crank.position.set(R + 0.2, 1.55, 0); crank.add(mesh(boxG(0.04, 0.3, 0.04), iron, 0, -0.13, 0)); crank.add(mesh(new T.CylinderGeometry(0.02, 0.02, 0.16, 6).rotateZ(Math.PI / 2), oak, 0.08, -0.27, 0)); g.add(crank);
          const sh = RC.Signs ? RC.Signs.shingles(T) : null;
          for (const s of [-1, 1]) { const sl = mesh(boxG(2 * R + 0.6, 0.05, 0.85), new T.MeshStandardMaterial({ map: sh, color: '#ffffff', roughness: 0.9 }), 0, 2.05, s * 0.33); sl.rotation.x = s * 0.6; g.add(sl); }
          g.add(mesh(boxG(2 * R + 0.65, 0.08, 0.1), oakDark, 0, 2.3, 0));
          return g;
        },
        // the alchemist's cauldron: a pot-bellied iron cauldron on three stubby legs over a small fire, its brew glowing and bubbling, steam rising
        cauldron(color = '#7cff6a') {
          const g = new T.Group(), pts = []; for (let i = 0; i <= 12; i++) { const f = i / 12; pts.push(new T.Vector2(0.12 + Math.sin(f * Math.PI * 0.95) * 0.42 + (f > 0.9 ? (f - 0.9) * 0.6 : 0), 0.22 + f * 0.6)); }
          const pot = mesh(new T.LatheGeometry(pts, 24), M('#24272b', { metalness: 0.55, roughness: 0.6, side: T.DoubleSide })); g.add(pot);
          g.add(mesh(new T.TorusGeometry(0.42, 0.035, 6, 24).rotateX(Math.PI / 2), iron, 0, 0.82, 0));
          for (let i = 0; i < 3; i++) { const a = i * 2.09, l = mesh(new T.CylinderGeometry(0.035, 0.05, 0.3, 6), iron, Math.cos(a) * 0.3, 0.13, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(l); }
          for (const s of [-1, 1]) { const ear = mesh(new T.TorusGeometry(0.07, 0.015, 4, 10), iron, s * 0.47, 0.72, 0); ear.rotation.y = Math.PI / 2; g.add(ear); }
          const brew = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2 }); brew.userData.noWeather = true;
          g.add(mesh(new T.CircleGeometry(0.4, 24).rotateX(-Math.PI / 2), brew, 0, 0.76, 0));
          const bub = []; for (let i = 0; i < 7; i++) { const b = mesh(new T.SphereGeometry(0.04, 8, 6), brew); b.userData.ph = Math.random(); b.userData.x = (Math.random() - 0.5) * 0.5; b.userData.z = (Math.random() - 0.5) * 0.5; g.add(b); bub.push(b); }
          tickers.push((t) => { for (const b of bub) { const k = (t * 0.6 + b.userData.ph) % 1; b.position.set(b.userData.x, 0.76, b.userData.z); b.scale.setScalar(k < 0.85 ? 0.3 + k : 0.01); } brew.emissiveIntensity = 0.8 + Math.sin(t * 2.3) * 0.2; });
          fire(g, 0.8); stones(g, 9, 0.48);
          return g;
        },
        // the cooking kettle: three iron legs lashed at the top, a chain, a black kettle, a fire of split logs under it
        kettle() {
          const g = new T.Group(), top = 1.6;
          for (let i = 0; i < 3; i++) { const a = i * 2.09 + 0.3, len = Math.hypot(0.6, top), l = mesh(new T.CylinderGeometry(0.025, 0.03, len, 6), iron); l.position.set(Math.cos(a) * 0.3, top / 2, Math.sin(a) * 0.3); l.lookAt(0, top, 0); l.rotateX(Math.PI / 2); g.add(l); }
          g.add(mesh(new T.CylinderGeometry(0.008, 0.008, 0.6, 4), iron, 0, top - 0.3, 0));
          const k = mesh(new T.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M('#1e2124', { metalness: 0.5, roughness: 0.6 }), 0, 0.98, 0); k.rotation.x = Math.PI; g.add(k);
          g.add(mesh(new T.TorusGeometry(0.22, 0.02, 4, 16).rotateX(Math.PI / 2), iron, 0, 1.0, 0));
          const handle = mesh(new T.TorusGeometry(0.24, 0.01, 4, 16, Math.PI), iron, 0, 1.0, 0); g.add(handle);
          logs(g, 5, 0.6, 0.05); fire(g, 1, 0, 0.05, 0); stones(g, 10, 0.55);
          return g;
        },
        campfire() { const g = new T.Group(); logs(g, 6, 0.7, 0.06); fire(g, 1.3, 0, 0.05, 0); stones(g, 11, 0.6); return g; },
        // the anvil: a proper horned anvil on an oak stump, a hammer resting on it
        anvil() {
          const g = new T.Group(); g.add(mesh(new T.CylinderGeometry(0.28, 0.32, 0.55, 12), woodM('#7a5a3a', 0.6, 0.6), 0, 0.275, 0));
          const body = new T.Shape(); body.moveTo(-0.3, 0); body.lineTo(0.22, 0); body.lineTo(0.22, 0.1); body.quadraticCurveTo(0.45, 0.14, 0.5, 0.2); body.lineTo(0.22, 0.22); body.lineTo(-0.3, 0.22); body.lineTo(-0.34, 0.16); body.lineTo(-0.3, 0.12); body.lineTo(-0.3, 0);
          const ag = new T.ExtrudeGeometry(body, { depth: 0.16, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }); ag.translate(0, 0, -0.08);
          g.add(mesh(ag, M('#3a3e44', { metalness: 0.75, roughness: 0.4 }), 0, 0.55, 0));
          g.add(mesh(boxG(0.3, 0.12, 0.2), M('#3a3e44', { metalness: 0.7, roughness: 0.45 }), -0.05, 0.5, 0));
          const hm = new T.Group(); hm.position.set(-0.1, 0.8, 0.02); hm.rotation.y = 0.5; hm.add(mesh(new T.CylinderGeometry(0.015, 0.018, 0.35, 6).rotateZ(Math.PI / 2), oak, 0.12, 0, 0)); hm.add(mesh(boxG(0.06, 0.06, 0.12), iron, -0.06, 0.01, 0)); g.add(hm);
          return g;
        },
      };
      return P;
    },
  };
})();
