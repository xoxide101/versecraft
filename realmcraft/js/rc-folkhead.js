// Heads for the townsfolk, built in code (the body comes from the anyCreature engine; a tube can't make a face).
// A skull shaped from a sphere (brow, eye sockets, cheekbones, jaw, chin, the back of the head), a nose with a tip and
// nostril wings, lips, ears, eyes with whites, a coloured iris and a pupil, upper lids that blink, eyebrows, a little
// colour in the cheeks and lips; hair in styles (short, long, bun, a bald fringe), beards and moustaches; hats.
// Coordinates: the Head bone (ear level) is the origin, +y up, +z the way the face looks, +x the person's left.
(function () {
  const RC = window.RC;
  const g = (x, s) => Math.exp(-(x * x) / (2 * s * s));
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let STRANDS = null;
  const strands = (T) => {   // a picture of hair strands, running down
    if (STRANDS) return STRANDS;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const px = Math.random() * 256, w = 0.6 + Math.random() * 1.6, v = 130 + Math.random() * 125 | 0; x.strokeStyle = `rgba(${v},${v},${v},${0.35 + Math.random() * 0.5})`; x.lineWidth = w; x.beginPath(); x.moveTo(px, -10); x.bezierCurveTo(px + (Math.random() - 0.5) * 12, 80, px + (Math.random() - 0.5) * 12, 170, px + (Math.random() - 0.5) * 16, 266); x.stroke(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return (STRANDS = t);
  };
  // a sphere shell shaped by f(n, p) → p, keeping only the triangles where keep(p, n) holds for all three corners
  const shell = (T, ws, hs, f, keep) => {
    const ge = new T.SphereGeometry(1, ws, hs), P = ge.attributes.position, N = [];
    for (let i = 0; i < P.count; i++) { const n = new T.Vector3(P.getX(i), P.getY(i), P.getZ(i)); N.push(n); const p = f(n.clone(), n); P.setXYZ(i, p.x, p.y, p.z); }
    if (keep) { const idx = ge.index.array, out = []; for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; const ok = (k) => keep(new T.Vector3(P.getX(k), P.getY(k), P.getZ(k)), N[k]); if (ok(a) && ok(b) && ok(c)) out.push(a, b, c); } ge.setIndex(out); }
    ge.computeVertexNormals(); return ge;
  };
  // a cap from the crown down to an edge: for each way round (u), the rows go from the top to where edge(n) says stop,
  // so the bottom edge is a smooth line (a hairline), not stair steps. place(n) → the point for a direction.
  const capGrid = (T, place, stopAt, U = 72, V = 22, from = 0) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= U; i++) { const u = (i / U) * Math.PI * 2, dir = (ph) => new T.Vector3(Math.sin(ph) * Math.sin(u), Math.cos(ph), Math.sin(ph) * Math.cos(u));
      let lo = 0.05, hi = Math.PI * 0.98; for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (stopAt(dir(mid))) hi = mid; else lo = mid; }   // (the first angle down from the crown where the cap stops)
      const ph0 = from ? Math.min(from(u), lo) : 0;
      for (let j = 0; j <= V; j++) { const ph = ph0 + (lo - ph0) * (j / V), p = place(dir(Math.max(ph, 0.001))); pos.push(p.x, p.y, p.z); uv.push((i / U) * 4, 1 - j / V); } }
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) { const a2 = i * (V + 1) + j, b2 = (i + 1) * (V + 1) + j; idx.push(a2, a2 + 1, b2, b2, a2 + 1, b2 + 1); }
    const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); ge.setIndex(idx); ge.computeVertexNormals(); return ge;
  };
  RC.FolkHead = {
    // o: { skin, hair, lips, iris (colours), style: 'short'|'long'|'bun'|'bald'|'crop', beard: 0|1|2, sex, child, elder, hat: null|'straw'|'cap'|'helmet'|'coif', seed }
    build(T, o) {
      const grp = new T.Group(), r = RC.rng(o.seed || 0.5), k = o.child ? 0.92 : 1;
      const RX = 0.076 * k * (o.sex === 'f' ? 0.96 : 1), RY = 0.11 * k, RZ = 0.096 * k, CY = 0.012 * k;
      const skinM = new T.MeshStandardMaterial({ color: o.skin, roughness: 0.55, vertexColors: true });
      const skinFlat = new T.MeshStandardMaterial({ color: o.skin, roughness: 0.55 });
      // the skull and face, shaped
      const face = (n) => {
        let x = n.x * RX, y = n.y * (n.y > 0 ? RY : RY * 0.92) + CY, z = n.z * RZ;
        const front = sm(0.1, 0.7, n.z), low = sm(0.0, -0.9, n.y);
        x *= 1 - 0.2 * low * low * (o.sex === 'f' || o.child ? 1.15 : 1);        // the jaw narrows to a rounded chin
        z *= 1 - 0.12 * front * sm(-0.2, 0.5, n.y);                               // a flatter face
        z += 0.012 * front * g(n.y + 0.75, 0.16) * (o.sex === 'f' ? 0.6 : 1);     // the chin forward
        z += 0.006 * front * g(n.y - 0.3, 0.08);                                  // the brow ridge
        z -= 0.009 * front * (g(x - 0.03 * k, 0.012) + g(x + 0.03 * k, 0.012)) * g(y - 0.02 * k, 0.012);   // eye sockets
        x += Math.sign(x) * 0.005 * front * g(y + 0.01, 0.018) * sm(0.02, 0.05, Math.abs(x));             // cheekbones
        if (n.z < -0.2 && n.y > -0.2) z -= 0.008 * g(n.y - 0.1, 0.4);             // the back of the skull rounds out
        y -= 0.008 * low * sm(-0.3, -0.9, n.z);                                     // under the jaw to the neck
        return new T.Vector3(x, y, z);
      };
      const skull = shell(T, 56, 42, (p, n) => face(n));
      { // colour in the skin: cheeks and the ears warmer, a little shade round the eyes
        const P = skull.attributes.position, col = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), fr = sm(0.02, 0.07, z);
          const blush = fr * (g(Math.abs(x) - 0.042 * k, 0.014) * g(y + 0.012, 0.016)) * (o.sex === 'f' || o.child ? 0.5 : 0.3), shade = fr * (g(Math.abs(x) - 0.03 * k, 0.012) * g(y - 0.016 * k, 0.01)) * 0.25;
          col[i * 3] = 1 - shade * 0.8; col[i * 3 + 1] = 1 - blush * 0.35 - shade; col[i * 3 + 2] = 1 - blush * 0.4 - shade; }
        skull.setAttribute('color', new T.BufferAttribute(col, 3));
      }
      grp.add(new T.Mesh(skull, skinM));
      // where the face surface is at (x, y): from the shaped sphere
      const P = skull.attributes.position, frontZ = (x, y) => { let best = 1e9, z = RZ; for (let i = 0; i < P.count; i++) { const pz = P.getZ(i); if (pz < 0.02) continue; const d = (P.getX(i) - x) ** 2 + (P.getY(i) - y) ** 2; if (d < best) { best = d; z = pz; } } return z; };
      const add = (ge, m, x, y, z) => { const me = new T.Mesh(ge, m); me.position.set(x, y, z); grp.add(me); return me; };
      // eyes: white, iris, pupil, a glint; upper lids that close to blink
      const ey = 0.018 * k, ex = 0.03 * k, er = 0.011 * k, lids = [];
      const white = new T.MeshStandardMaterial({ color: '#f2ede4', roughness: 0.25 }), iris = new T.MeshStandardMaterial({ color: o.iris || '#5a4028', roughness: 0.3 }), pupil = new T.MeshStandardMaterial({ color: '#0a0806', roughness: 0.2 });
      for (const s of [-1, 1]) {
        const ez = frontZ(s * ex, ey) - er * 0.62, e = new T.Group(); e.position.set(s * ex, ey, ez); grp.add(e);
        e.add(new T.Mesh(new T.SphereGeometry(er, 16, 12), white));
        const ir = new T.Mesh(new T.CircleGeometry(er * 0.46, 18), iris); ir.position.z = er * 0.99; e.add(ir);
        const pu = new T.Mesh(new T.CircleGeometry(er * 0.2, 12), pupil); pu.position.z = er * 0.995; e.add(pu);
        const lid = new T.Mesh(new T.SphereGeometry(er * 1.08, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), skinFlat); lid.rotation.x = -1.15; e.add(lid); lids.push(lid);   // (open: rolled up and back; a blink rolls it down over the eye)   // (half a shell over the top of the eye)
        const low = new T.Mesh(new T.SphereGeometry(er * 1.06, 16, 6, 0, Math.PI * 2, Math.PI * 0.8, Math.PI * 0.2), skinFlat); e.add(low);
        // the eyebrow: a soft arch of hair above
        const brow = new T.CatmullRomCurve3([new T.Vector3(s * (ex - 0.016 * k), ey + 0.016 * k, 0), new T.Vector3(s * ex, ey + 0.021 * k, 0.003), new T.Vector3(s * (ex + 0.016 * k), ey + 0.017 * k, -0.004)]);
        const bge = new T.TubeGeometry(brow, 8, (o.sex === 'f' ? 0.0022 : 0.003) * k, 5, false), bp = bge.attributes.position;
        for (let i = 0; i < bp.count; i++) bp.setZ(i, bp.getZ(i) + frontZ(bp.getX(i), bp.getY(i)) + 0.001);
        bge.computeVertexNormals(); grp.add(new T.Mesh(bge, new T.MeshStandardMaterial({ color: o.hair, roughness: 0.8 })));
      }
      // the nose: one sculpted piece, narrow at the bridge, broadening to a rounded tip, nostril wings flaring either side
      { const top = ey + 0.004 * k, bot = -0.034 * k, cy = (top + bot) / 2, hh = (top - bot) / 2, ng = new T.SphereGeometry(1, 28, 24), np = ng.attributes.position, sx = o.sex === 'f' || o.child ? 0.9 : 1;
        for (let i = 0; i < np.count; i++) { const nx = np.getX(i), ny = np.getY(i), nz = np.getZ(i), lowp = sm(0.9, -0.55, ny);
          let w = (0.0055 + 0.0068 * lowp) * k * sx, d = (0.004 + 0.0125 * lowp) * k * sx;
          if (ny < -0.55) d *= 1 - 0.55 * sm(-0.55, -1, ny);                                  // tucked under at the base
          let x = nx * w * (1 + (ny < -0.2 ? 0.45 * sm(0.4, 0.95, Math.abs(nx)) * sm(-0.2, -0.75, ny) : 0)), y = cy + ny * hh, z = nz > 0 ? nz * d : nz * 0.004;
          np.setXYZ(i, x, y, z + frontZ(x * 0.6, y) - 0.0035); }
        ng.computeVertexNormals(); const nose = new T.Mesh(ng, skinFlat); grp.add(nose);
        for (const s of [-1, 1]) { const ns = new T.Mesh(new T.SphereGeometry(0.0022 * k, 8, 6), new T.MeshStandardMaterial({ color: '#2a1410', roughness: 0.9 })); ns.position.set(s * 0.0062 * k, bot + 0.0035, frontZ(0, bot) + 0.006 * k); ns.scale.set(1.4, 0.7, 1); grp.add(ns); } }
      // lips: a fuller lower lip, a thin upper, a dark line between
      { const lz = frontZ(0, -0.052 * k), lipM = new T.MeshStandardMaterial({ color: new T.Color(o.lips || o.skin).lerp(new T.Color('#a04a40'), o.sex === 'f' ? 0.32 : 0.16), roughness: 0.45 });
        const ul = add(new T.SphereGeometry(1, 18, 8), lipM, 0, -0.0495 * k, lz - 0.0025); ul.scale.set(0.0175 * k, 0.0034 * k, 0.0045 * k);
        const ll = add(new T.SphereGeometry(1, 18, 8), lipM, 0, -0.0565 * k, lz - 0.003); ll.scale.set(0.0158 * k, 0.0044 * k, 0.005 * k);
        const line = add(new T.BoxGeometry(0.024 * k, 0.0008, 0.003), new T.MeshStandardMaterial({ color: '#3a1e18', roughness: 0.8 }), 0, -0.0528 * k, lz + 0.0035); }
      // ears: an outer rim and a hollow
      { const sh = new T.Shape(); sh.moveTo(0, -0.026); sh.bezierCurveTo(0.014, -0.03, 0.02, -0.012, 0.019, 0.006); sh.bezierCurveTo(0.018, 0.026, 0.004, 0.032, -0.004, 0.024); sh.bezierCurveTo(-0.006, 0.01, -0.004, -0.012, 0, -0.026);
        const eg = new T.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 10 }); eg.scale(k, k, k);
        for (const s of [-1, 1]) { const ear = add(eg, skinFlat, s * (RX - 0.004), -0.002 * k, -0.004 * k); ear.rotation.y = s * (Math.PI / 2 - 0.35); ear.scale.x = s; } }
      // hair
      const hairM = new T.MeshStandardMaterial({ color: o.hair, roughness: 0.62, map: strands(T) });
      const style = o.style || 'short', H = 1.07 + (o.sex === 'f' ? 0.04 : 0.02);
      const lineAt = (n, front) => {   // the height the hair starts at, by the angle round the head (0 = the middle of the forehead)
        const th = Math.abs(Math.atan2(n.x, n.z)), back = style === 'long' ? -0.2 : o.sex === 'f' ? -0.07 : -0.055;
        const pts = [[0, front], [0.75, front - 0.012], [1.25, 0.03], [1.65, o.sex === 'f' ? 0.0 : 0.022], [2.1, -0.01], [Math.PI, back]];
        for (let i = 1; i < pts.length; i++) if (th <= pts[i][0]) { const [a, ya] = pts[i - 1], [b2, yb] = pts[i], u = (th - a) / (b2 - a); return (ya + (yb - ya) * (u * u * (3 - 2 * u))) * k; }
        return back * k; };
      const FRONT = { short: 0.072, crop: 0.078, bun: 0.084, long: 0.068, bald: 0.06 }[style] || 0.072;
      const hairline = (p, n) => p.y > lineAt(n, FRONT);
      if (style !== 'bald') {
        const thick = (n) => 1 + (0.06 + 0.04 * Math.max(0, n.y)) * (style === 'crop' ? 0.4 : 1);
        const cap = capGrid(T, (n) => face(n).multiplyScalar(thick(n)).add(new T.Vector3(0, 0.004, -0.003)), (n) => face(n).y < lineAt(n, FRONT));
        grp.add(new T.Mesh(cap, hairM));
        if (style === 'long') {   // falling down the back to the shoulders, a lock either side
          const fall = new T.CylinderGeometry(RX * 1.12, RX * 1.35, 0.22 * k, 20, 6, true, Math.PI * 0.55, Math.PI * 0.9), fp = fall.attributes.position;
          for (let i = 0; i < fp.count; i++) { const yy = fp.getY(i); fp.setX(i, fp.getX(i) * (1 + 0.03 * Math.sin(fp.getZ(i) * 90))); fp.setZ(i, fp.getZ(i) - 0.01); fp.setY(i, yy - 0.08 * k); }
          fall.computeVertexNormals(); const fm = new T.Mesh(fall, hairM.clone()); fm.material.side = T.DoubleSide; fm.position.z = -0.012; grp.add(fm);
        }
        if (style === 'bun') { const bn = add(new T.SphereGeometry(0.036 * k, 16, 12), hairM, 0, 0.07 * k, -0.095 * k); bn.scale.set(1, 0.85, 0.9); }
      } else {   // bald on top, a fringe of hair round the back and over the ears
        const ring = capGrid(T, (n) => face(n).multiplyScalar(1.05), (n) => face(n).y < lineAt(n, 0.06), 72, 10, (u) => { const a = Math.abs(Math.atan2(Math.sin(u), Math.cos(u))); return a < 1.25 ? 9 : 1.15 + Math.max(0, 1.6 - a) * 0.8; });   // (a band: from below the bald crown down to the hairline, round the back)
        grp.add(new T.Mesh(ring, hairM));
      }
      if (o.beard) {   // a beard round the jaw and chin (1: short, 2: full), and a moustache
        const bd = shell(T, 40, 26, (p, n) => face(n).multiplyScalar(1.03 + 0.03 * o.beard), (p, n) => n.z > -0.35 && p.y < (o.beard > 1 ? -0.025 : -0.04) * k && !(n.z > 0.5 && (p.x / (0.021 * k)) ** 2 + ((p.y + 0.053 * k) / (0.013 * k)) ** 2 < 1));
        grp.add(new T.Mesh(bd, hairM));
        const mz = frontZ(0, -0.042 * k), mo = new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-0.02 * k, -0.05 * k, mz - 0.008), new T.Vector3(0, -0.041 * k, mz + 0.004), new T.Vector3(0.02 * k, -0.05 * k, mz - 0.008)]), 10, 0.0042 * k, 6, false);
        grp.add(new T.Mesh(mo, hairM));
      }
      // hats
      if (o.hat === 'straw') { const st = new T.MeshStandardMaterial({ color: '#d8b870', roughness: 0.9, map: strands(T) }); add(new T.CylinderGeometry(RX * 1.05, RX * 1.2, 0.07, 20), st, 0, 0.1 * k, -0.005); add(new T.CylinderGeometry(0.17 * k, 0.17 * k, 0.008, 28), st, 0, 0.068 * k, -0.005); add(new T.CylinderGeometry(RX * 1.21, RX * 1.21, 0.018, 20, 1, true), new T.MeshStandardMaterial({ color: '#7a3a2a', side: T.DoubleSide }), 0, 0.078 * k, -0.005); }
      if (o.hat === 'cap') { const cm = new T.MeshStandardMaterial({ color: o.hatColor || '#4a4440', roughness: 0.9 }); const c2 = add(new T.SphereGeometry(RX * 1.12, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), cm, 0, 0.045 * k, -0.006); c2.scale.set(1.05, 0.9, 1.12); const pk = add(new T.CylinderGeometry(0.05 * k, 0.05 * k, 0.006, 16, 1, false, -Math.PI / 2, Math.PI), cm, 0, 0.068 * k, 0.07 * k); pk.rotation.x = 0.15; }
      if (o.hat === 'helmet') { const im = new T.MeshStandardMaterial({ color: '#8a9098', metalness: 0.75, roughness: 0.35 }); add(new T.SphereGeometry(RX * 1.18, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), im, 0, 0.03 * k, -0.004).scale.set(1, 1.05, 1.1); add(new T.TorusGeometry(RX * 1.2, 0.006, 6, 24).rotateX(Math.PI / 2), im, 0, 0.032 * k, -0.004).scale.set(1, 1, 1.12); add(new T.BoxGeometry(0.01, 0.05, 0.012), im, 0, 0.0, frontZ(0, 0) + 0.012); }
      if (o.hat === 'coif') { const cm = new T.MeshStandardMaterial({ color: '#f2ede2', roughness: 0.95, side: T.DoubleSide }); const cf = capGrid(T, (n) => face(n).multiplyScalar(1.13), (n) => face(n).y < lineAt(n, 0.075) - 0.012 * k); grp.add(new T.Mesh(cf, cm)); }
      grp.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.userData.face = true; } });
      // blinking: every few seconds, the lids drop and lift again
      let nextBlink = 1 + r() * 4;
      return { group: grp, update(t) { const ph = t - nextBlink; let c = 0; if (ph > 0) { c = ph < 0.08 ? ph / 0.08 : ph < 0.16 ? 1 - (ph - 0.08) / 0.08 : 0; if (ph > 0.16) nextBlink = t + 2 + r() * 5; } for (const l of lids) l.rotation.x = -1.15 + c * 1.35; } };
    },
  };
})();
