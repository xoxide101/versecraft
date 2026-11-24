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
        // ---- the reading lectern outside the library: an oak stand, slanted top, an open book with writing, a small shingled roof over it
        lectern(lines) {
          const g = new T.Group(), oakM = woodM('#8a6440', 0.6, 0.6), dark = woodM('#5a3c24', 0.5, 0.5);
          g.add(mesh(new T.BoxGeometry(0.5, 0.06, 0.4), dark, 0, 0.03, 0));
          g.add(mesh(new T.CylinderGeometry(0.06, 0.08, 1.0, 8), oakM, 0, 0.55, 0));
          const top = new T.Group(); top.position.set(0, 1.08, 0); top.rotation.x = 0.45; g.add(top);   // (sloping down toward the reader, who stands in front)
          top.add(mesh(new T.BoxGeometry(0.62, 0.04, 0.46), oakM));
          top.add(mesh(new T.BoxGeometry(0.62, 0.05, 0.04), dark, 0, 0.03, 0.23));   // the lip that holds the book
          // the book: two pages, slightly curved, with the chronicle's words on them
          const c = document.createElement('canvas'); c.width = 512; c.height = 360; const x = c.getContext('2d'); x.fillStyle = '#efe4c8'; x.fillRect(0, 0, 512, 360);
          x.fillStyle = 'rgba(120,90,50,0.18)'; x.fillRect(250, 0, 12, 360); x.fillStyle = '#3a2a1a'; x.font = "18px Georgia, serif"; x.textBaseline = 'top';
          const words = (lines || []).join(' ').split(/\s+/); let px = 18, py = 20, page = 0;
          for (const w of words) { const ww = x.measureText(w + ' ').width; if (px + ww > (page ? 494 : 236)) { px = page ? 270 : 18; py += 24; if (py > 330) { if (page) break; page = 1; px = 270; py = 20; } } x.fillText(w, px, py); px += ww; }
          x.fillStyle = '#8a2a1a'; x.font = "bold 34px Georgia, serif"; x.fillText(words[0] ? words[0][0] : 'A', 18, 14);
          const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
          const pg = new T.PlaneGeometry(0.56, 0.4, 16, 1), pp = pg.attributes.position; for (let i = 0; i < pp.count; i++) { const u = pp.getX(i) / 0.28; pp.setZ(i, (1 - u * u) * 0.0 + Math.abs(u) * 0.025 * (1 - Math.abs(u))); } pg.computeVertexNormals();
          const book = new T.Mesh(pg, new T.MeshStandardMaterial({ map: tex, roughness: 0.9 })); book.rotation.x = -Math.PI / 2; book.position.set(0, 0.035, -0.01); top.add(book);
          top.add(mesh(new T.BoxGeometry(0.58, 0.025, 0.42), M('#5a1e14'), 0, 0.015, -0.01));   // the leather cover under the pages
          // a little roof on two posts behind
          const sh = RC.Signs ? RC.Signs.shingles(T) : null;
          for (const s of [-1, 1]) g.add(mesh(new T.BoxGeometry(0.08, 1.9, 0.08), dark, s * 0.42, 0.95, -0.3));
          for (const s of [-1, 1]) { const sl = mesh(new T.BoxGeometry(1.0, 0.04, 0.55), new T.MeshStandardMaterial({ map: sh, roughness: 0.9 }), 0, 1.98, -0.3 + s * 0.22); sl.rotation.x = s * 0.55; g.add(sl); }
          return g;
        },
        // ---- the craftworks ledger: a sloped clerk's desk with the open ledger, ink pot and quill, a stool, crates stacked by it
        ledger(lines) {
          const g = new T.Group(), oakM = woodM('#7a5a3a', 0.6, 0.6);
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(new T.BoxGeometry(0.06, 0.95, 0.06), oakM, sx * 0.45, 0.47, sz * 0.25));
          const top = mesh(new T.BoxGeometry(1.0, 0.05, 0.6), oakM, 0, 0.98, 0); top.rotation.x = -0.18; g.add(top);
          const lg = P.lectern(lines).children.find((m) => m.isGroup); if (lg) { const bk = lg.children.find((m) => m.material && m.material.map); if (bk) { const b2 = bk.clone(); b2.position.set(0, 1.03, 0); b2.rotation.set(-Math.PI / 2 - 0.18, 0, 0); g.add(b2); } }
          g.add(mesh(new T.CylinderGeometry(0.03, 0.035, 0.05, 10), M('#1a1a22', { roughness: 0.3 }), 0.38, 1.04, -0.12));
          const quill = mesh(new T.ConeGeometry(0.012, 0.24, 5), M('#f2ede4'), 0.38, 1.13, -0.12); quill.rotation.z = 0.4; g.add(quill);
          g.add(mesh(new T.CylinderGeometry(0.16, 0.18, 0.6, 10), oakM, 0, 0.3, 0.55));
          const c1 = P.crate(0.5); c1.position.set(0.9, 0, 0.2); g.add(c1); const c2 = P.crate(0.42); c2.position.set(0.86, 0.5, 0.18); c2.rotation.y = 0.3; g.add(c2);
          return g;
        },
        // ---- the chess and dice table: a trestle table, a chequered board with pieces mid-game, dice, mugs, two benches
        gameTable() {
          const g = new T.Group(), oakM = woodM('#8a6440', 1, 0.6), dark = woodM('#5a3c24', 0.8, 0.6);
          g.add(mesh(new T.BoxGeometry(1.6, 0.06, 0.9), oakM, 0, 0.76, 0));
          for (const s of [-1, 1]) { g.add(mesh(new T.BoxGeometry(0.08, 0.74, 0.7), dark, s * 0.62, 0.37, 0)); g.add(mesh(new T.BoxGeometry(1.4, 0.05, 0.3), oakM, 0, 0.44, s * 0.85)); for (const bx of [-0.55, 0.55]) g.add(mesh(new T.BoxGeometry(0.06, 0.42, 0.26), dark, bx, 0.21, s * 0.85)); }
          const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#3a2a1c' : '#e8d8b0'; x.fillRect(i * 32, j * 32, 32, 32); }
          const bt = new T.CanvasTexture(c); bt.colorSpace = T.SRGBColorSpace; g.add(mesh(new T.BoxGeometry(0.5, 0.03, 0.5), new T.MeshStandardMaterial({ map: bt, roughness: 0.5 }), -0.35, 0.805, 0));
          const piece = (h) => { const pts = [[0, 0], [0.022, 0], [0.022, 0.008], [0.012, 0.02], [0.01, h * 0.7], [0.016, h * 0.75], [0.008, h], [0, h + 0.004]].map(([a, b]) => new T.Vector2(a, b)); return new T.LatheGeometry(pts, 10); };
          const wM = M('#f2ead8', { roughness: 0.4 }), bM = M('#2a1e16', { roughness: 0.4 }), r2 = RC.rng(0.77);
          for (let k = 0; k < 14; k++) { const i = Math.floor(r2() * 8), j = k < 7 ? Math.floor(r2() * 3) : 5 + Math.floor(r2() * 3); g.add(mesh(piece(0.035 + r2() * 0.035), k < 7 ? wM : bM, -0.35 - 0.25 + 0.031 + i * 0.0625, 0.82, -0.25 + 0.031 + j * 0.0625)); }
          for (let k = 0; k < 3; k++) { const d = mesh(new T.BoxGeometry(0.04, 0.04, 0.04), M('#f4f0e6'), 0.25 + k * 0.07, 0.81, 0.1 + (k % 2) * 0.05); d.rotation.y = k; g.add(d); }
          for (const [mx, mz] of [[0.55, -0.25], [0.35, 0.3]]) { g.add(mesh(new T.CylinderGeometry(0.05, 0.045, 0.12, 12), woodM('#9a7048', 0.3, 0.3), mx, 0.85, mz)); g.add(mesh(new T.TorusGeometry(0.035, 0.01, 5, 10, Math.PI), dark, mx + 0.05, 0.85, mz)); }
          return g;
        },
        // ---- the spyglass on the pier: a brass telescope on a turned pedestal, pointed out to sea
        spyglass() {
          const g = new T.Group(), brass = M('#c8a048', { metalness: 0.85, roughness: 0.3 }), iron = M('#2e3238', { metalness: 0.6, roughness: 0.5 });
          g.add(mesh(new T.CylinderGeometry(0.22, 0.28, 0.12, 14), GRANM, 0, 0.06, 0));
          g.add(mesh(new T.CylinderGeometry(0.05, 0.07, 1.05, 10), iron, 0, 0.6, 0));
          const tube = new T.Group(); tube.position.set(0, 1.2, 0); tube.rotation.set(-0.12, 0.3, 0); g.add(tube);
          for (const [r1, r2, len, z] of [[0.065, 0.06, 0.55, 0.0], [0.055, 0.05, 0.4, 0.42], [0.045, 0.04, 0.3, 0.74]]) { const s = mesh(new T.CylinderGeometry(r2, r1, len, 14).rotateX(Math.PI / 2), brass, 0, 0, z); tube.add(s); tube.add(mesh(new T.TorusGeometry(r1 + 0.004, 0.008, 5, 16), brass, 0, 0, z - len / 2)); }
          tube.add(mesh(new T.CylinderGeometry(0.07, 0.07, 0.02, 14).rotateX(Math.PI / 2), M('#1a2a3a', { metalness: 0.2, roughness: 0.05 }), 0, 0, -0.28));
          return g;
        },
        // ---- the warning bell: a timber belfry on four posts with braces, a little roof, a bronze bell with a flared lip, its rope
        belfry() {
          const g = new T.Group(), oakM = woodM('#6a4a2c', 0.4, 1), bronze = M('#a8783a', { metalness: 0.8, roughness: 0.35 });
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.add(mesh(new T.BoxGeometry(0.14, 2.4, 0.14), oakM, sx * 0.55, 1.2, sz * 0.45)); const br = mesh(new T.BoxGeometry(0.07, 0.6, 0.07), oakM, sx * 0.4, 1.95, sz * 0.45); br.rotation.z = sx * 0.6; g.add(br); }
          for (const sz of [-1, 1]) g.add(mesh(new T.BoxGeometry(1.3, 0.14, 0.14), oakM, 0, 2.35, sz * 0.45));
          g.add(mesh(new T.BoxGeometry(0.14, 0.14, 1.04), oakM, 0, 2.28, 0));
          const sh = RC.Signs ? RC.Signs.shingles(T) : null; for (const s of [-1, 1]) { const sl = mesh(new T.BoxGeometry(1.5, 0.05, 0.75), new T.MeshStandardMaterial({ map: sh, roughness: 0.9 }), 0, 2.72, s * 0.3); sl.rotation.x = s * 0.62; g.add(sl); }
          const pts = [[0, 0.42], [0.06, 0.42], [0.11, 0.4], [0.14, 0.33], [0.16, 0.2], [0.2, 0.08], [0.27, 0.0], [0.27, -0.02], [0.24, 0.0], [0.17, 0.08], [0.13, 0.2], [0.11, 0.33], [0, 0.37]].map(([a, b]) => new T.Vector2(a, b));
          const bell = mesh(new T.LatheGeometry(pts, 24), bronze, 0, 1.78, 0); g.add(bell);
          g.add(mesh(new T.SphereGeometry(0.05, 10, 8), iron, 0, 1.8, 0)); g.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.25, 5), iron, 0, 1.92, 0));
          g.add(mesh(new T.CylinderGeometry(0.012, 0.012, 1.6, 5), M('#c8b088'), 0.12, 0.98, 0));
          return g;
        },
        // ---- fountain water: a still pool surface that ripples (rings spreading from where the water falls), and falling veils
        poolWater(ringR) {
          const m = new T.MeshStandardMaterial({ color: '#5a7a74', transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5, depthWrite: false });
          m.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.uTime; sh.uniforms.uRing = { value: ringR };
            sh.vertexShader = 'varying vec3 vPw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPw = position;');
            sh.fragmentShader = 'uniform float uTime; uniform float uRing; varying vec3 vPw;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
              { float r = length(vPw.xz); float d = abs(r - uRing);
                float w = sin(d * 60.0 - uTime * 7.0) * exp(-d * 5.0) * 0.5 + sin(vPw.x * 23.0 + uTime * 1.3) * sin(vPw.z * 19.0 - uTime * 1.1) * 0.15;
                vec2 gd = normalize(vPw.xz + 1e-4) * w; normal = normalize(normal + (viewMatrix * vec4(gd.x * 0.35, 0.0, gd.y * 0.35, 0.0)).xyz);
                float foam = smoothstep(0.06, 0.0, d) * (0.5 + 0.5 * sin(atan(vPw.z, vPw.x) * 9.0 + uTime * 5.0));
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.96), foam * 0.6); diffuseColor.a = max(diffuseColor.a, foam * 0.7); }`); };
          m.customProgramCacheKey = () => 'fountain-pool'; m.userData.noWeather = true; return m;
        },
        // a sheet of water falling from one lip to the pool below: a curtain shaped like the fall, streaks running down it
        veil(r0, y0, r1, y1) {
          const pts = []; for (let i = 0; i <= 10; i++) { const f = i / 10; pts.push(new T.Vector2(r0 + (r1 - r0) * Math.pow(f, 0.6), y0 + (y1 - y0) * f * f)); }
          const ge = new T.LatheGeometry(pts, 40);
          const m = new T.MeshStandardMaterial({ color: '#d8e8ec', transparent: true, roughness: 0.1, metalness: 0.1, side: T.DoubleSide, depthWrite: false, envMapIntensity: 1.5 });
          m.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.uTime;
            sh.vertexShader = 'varying vec2 vVu;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vVu = uv;');
            sh.fragmentShader = 'uniform float uTime; varying vec2 vVu;\n float vh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
              { float col = floor(vVu.x * 160.0), sp = 0.8 + vh(vec2(col, 1.0)) * 0.6, s = fract(vVu.y * 3.0 + uTime * sp * 1.4 + vh(vec2(col, 2.0)));
                float streak = smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(0.5, 1.0, s));
                diffuseColor.a = (0.05 + streak * 0.32) * (0.5 + 0.5 * vh(vec2(col, 3.0))) * smoothstep(0.0, 0.12, 1.0 - vVu.y); }`); };
          m.customProgramCacheKey = () => 'fountain-veil'; m.userData.noWeather = true;
          const v = new T.Mesh(ge, m); v.renderOrder = 2; return v;
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
