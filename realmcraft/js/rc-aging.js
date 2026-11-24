// Age on the buildings: nothing in an old town is new or perfectly straight. Walls get a height map of their own
// (the texture's light and dark as relief, plus cracks and fallen plaster), grime and damp rising from the ground, rain
// streaks under the eaves, moss low down; foundations of small stone blocks; boarded shutters; window boxes with plants
// spilling over; ivy and climbing roses; weeds at the foot of walls; a wisp of smoke from some chimneys now and then;
// and water dripping off the eaves while it rains. Everything here is drawn by code (no picture files).
(function () {
  const RC = window.RC;

  // ---------------------------------------------------------------- the wall shader
  // kind: 0 stucco or plaster (cracks, fallen patches showing the brick under it), 1 stone or brick (worn, darker joints),
  // 2 painted wood (paint worn off to grey wood at the edges and low down)
  const HEAD = `varying vec3 vAgW; varying vec3 vAgN; uniform float uAgBase, uAgTop, uAgKind, uAgSeed; uniform sampler2D tAgBrick; uniform float uAgBrickM, uAgHasBrick;
    float agH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float agN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(agH(i), agH(i + vec2(1, 0)), f.x), mix(agH(i + vec2(0, 1)), agH(i + vec2(1, 1)), f.x), f.y); }
    float agF(vec2 p) { return agN(p) * 0.5 + agN(p * 2.1 + 3.1) * 0.27 + agN(p * 4.3 + 7.7) * 0.15 + agN(p * 9.1 + 1.3) * 0.08; }
    float agRidge(vec2 p) { return 1.0 - abs(agN(p) * 2.0 - 1.0); }
    vec3 agBump(vec3 surf_pos, vec3 surf_norm, float h, float faceDir) {   // bump from a height worked out here (as three.js does a bump map)
      vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos), R1 = cross(sy, surf_norm), R2 = cross(surf_norm, sx); float det = dot(sx, R1) * faceDir;
      vec3 grad = sign(det) * (dFdx(h) * R1 + dFdy(h) * R2); return normalize(abs(det) * surf_norm - grad); }\n`;
  const BODY = `
    {
      vec3 wn = normalize(vAgN); float side = 1.0 - smoothstep(0.55, 0.85, abs(wn.y));   // walls, not tops
      vec2 tng = normalize(vec2(-wn.z, wn.x) + 1e-5); float u = dot(vAgW.xz, tng) + uAgSeed * 13.0, y = vAgW.y - uAgBase, top = uAgTop - y;
      vec2 P = vec2(u, y);
      float lum = dot(diffuseColor.rgb, vec3(0.33));
      float h = lum * (uAgKind > 0.5 ? 0.9 : 0.35);   // the picture's own light and dark as height (stones and grain stand out)
      if (uAgKind > 2.5) {   // a roof: moss cushions in the laps of the tiles, yellow-grey lichen spots, darker and greener toward the eaves
        float eave = 1.0 - smoothstep(0.0, 1.4, y), cush = smoothstep(0.64, 0.8, agF(vAgW.xz * 1.6 + uAgSeed)) * (0.25 + eave * 0.6) * smoothstep(0.25, 0.45, 1.0 - lum);
        float lich = smoothstep(0.88, 0.93, agN(vAgW.xz * 11.0 + 5.0)) * smoothstep(0.55, 0.7, agF(vAgW.xz * 0.5 + 9.0));
        diffuseColor.rgb *= 0.88 + agF(vAgW.xz * 0.4 + uAgSeed) * 0.24;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.26, 0.1) * (0.8 + lum * 0.4), clamp(cush, 0.0, 0.7));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 1.1, 0.8) + vec3(0.05, 0.05, 0.0), lich * 0.5);
        diffuseColor.rgb *= 1.0 - eave * 0.12; h += cush * 0.6 + lich * 0.2;
        normal = agBump(-vViewPosition, normal, h * 0.012, faceDirection);
      } else {
      float blot = agF(P * 0.35 + uAgSeed);
      diffuseColor.rgb *= 0.9 + blot * 0.2;   // uneven colour: patches of sun-fade and old repairs
      // cracks: thin and branching, only in some stretches, more round the corners of openings and low down
      float zone = smoothstep(0.6, 0.8, agF(P * 0.22 + 31.0 + uAgSeed));
      float cr = smoothstep(0.955, 0.99, agRidge(P * vec2(2.2, 1.4) + agF(P * 1.3) * 1.5)) * zone;
      cr = max(cr, smoothstep(0.97, 0.995, agRidge(P * vec2(4.5, 6.0) + 9.0)) * zone * 0.6);
      // fallen plaster: patches showing the brick or stone under it, mostly low and by the corners
      float loss = 0.0;
      if (uAgKind < 0.5) {
        float fl = agF(P * vec2(0.55, 0.8) + 17.0 + uAgSeed) + (1.0 - smoothstep(0.0, 1.6, y)) * 0.12;
        loss = smoothstep(0.71, 0.735, fl) * side;
        float rim = smoothstep(0.69, 0.71, fl) * (1.0 - loss);
        vec3 under = uAgHasBrick > 0.5 ? texture2D(tAgBrick, P / uAgBrickM).rgb : vec3(0.55, 0.32, 0.24);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82, rim);   // the broken edge, a little shaded
        diffuseColor.rgb = mix(diffuseColor.rgb, under * 0.92, loss);
        h = mix(h, -0.6 + dot(under, vec3(0.33)) * 0.8, loss); h += rim * 0.15;
      } else if (uAgKind > 1.5) {   // painted wood: worn back to grey wood at the edges and the foot
        float wear = smoothstep(0.62, 0.7, agF(P * vec2(3.0, 1.2) + 5.0) + (1.0 - smoothstep(0.0, 0.5, y)) * 0.25);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.39, 0.35) * (0.7 + lum * 0.6), wear); h -= wear * 0.25;
      }
      diffuseColor.rgb *= 1.0 - cr * 0.42; h -= cr * 0.8;
      // grime and damp rising from the ground, ragged; green with moss right at the foot
      float rise = 0.35 + agF(vec2(u * 0.7, 3.0)) * 0.7, damp = (1.0 - smoothstep(0.0, rise, y)) * side;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.66, 0.64, 0.56), damp * 0.5);
      float moss = (1.0 - smoothstep(0.0, 0.22 + agN(vec2(u * 2.0, 1.0)) * 0.2, y)) * smoothstep(0.35, 0.6, agF(P * 1.7 + 2.0));
      float mossW = smoothstep(0.42, 0.7, agF(P * vec2(0.9, 0.7) + 40.0 + uAgSeed)) * smoothstep(0.5, 0.75, agF(P * 2.6 + 3.0)) * (0.55 + 0.45 * smoothstep(0.0, 1.2, y)) * (uAgKind > 0.5 && uAgKind < 1.5 ? 1.0 : 0.35);   // patches creeping up stone and the shaded side walls
      moss = max(moss * side, smoothstep(0.6, 0.9, wn.y) * smoothstep(0.55, 0.75, agF(vAgW.xz * 2.0)) * 0.8);   // and on what faces up (sills, plinths)
      moss = max(moss, mossW * side * 0.8);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.27, 0.11) * (0.7 + lum * 0.5), moss * 0.85); h += moss * 0.25;
      // rain streaks: thin dark runs down from under the eaves and sills, fading lower down
      float st = agN(vec2(u * 7.0, y * 0.18 + uAgSeed)) * agN(vec2(u * 2.3 + 4.0, y * 0.1));
      float streak = smoothstep(0.32, 0.6, st) * (1.0 - smoothstep(0.0, 1.5 + agN(vec2(u * 3.0, 0.0)) * 1.5, top)) * side;
      diffuseColor.rgb *= 1.0 - streak * 0.28;
      roughnessFactor = mix(roughnessFactor, 1.0, loss * 0.5 + cr * 0.5);
      normal = agBump(-vViewPosition, normal, h * 0.012, faceDirection);
      }
    }`;
  const tex = {};
  // age a material in place. opt: { kind, base (world y of the wall's foot), top (where the eaves are), seed, brick (texture under the plaster, metres) }
  RC.age = (T, m, opt) => {
    const u = { uAgBase: { value: opt.base || 0 }, uAgTop: { value: opt.top || 3 }, uAgKind: { value: opt.kind || 0 }, uAgSeed: { value: opt.seed || 0 },
      tAgBrick: { value: (opt.brick && opt.brick.map) || null }, uAgBrickM: { value: (opt.brick && opt.brick.m) || 2 }, uAgHasBrick: { value: opt.brick && opt.brick.map ? 1 : 0 } };
    const before = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      if (before) before.call(m, sh, r);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec3 vAgW; varying vec3 vAgN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
        vAgW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vAgN = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
        #else
        vAgW = (modelMatrix * vec4(transformed, 1.0)).xyz; vAgN = mat3(modelMatrix) * objectNormal;
        #endif`);
      sh.fragmentShader = HEAD + sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + BODY);
    };
    const key = m.customProgramCacheKey && m.customProgramCacheKey !== Object.getPrototypeOf(m).customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
    m.customProgramCacheKey = () => (key ? key() : m.type) + '|age';
    m.userData.age = u; m.needsUpdate = true; return m;
  };

  // ---------------------------------------------------------------- merging many small pieces into one mesh
  // parts: { geo, mat4, color } → one geometry with colours; uv: 'world' gives each face texture by where it is (so blocks
  // cut from the same stone don't all show the same picture), scaled by metres
  RC.mergeParts = (T, parts, uv) => {
    let n = 0; const gs = parts.map((p) => { const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); g.applyMatrix4(p.mat4); n += g.attributes.position.count; return g; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uvs = new Float32Array(n * 2), c = new T.Color(); let o = 0;
    gs.forEach((g, i) => {
      const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv; c.set(parts[i].color || '#ffffff');
      for (let j = 0; j < P.count; j++, o++) {
        pos[o * 3] = P.getX(j); pos[o * 3 + 1] = P.getY(j); pos[o * 3 + 2] = P.getZ(j);
        const nx = N.getX(j), ny = N.getY(j), nz = N.getZ(j); nor[o * 3] = nx; nor[o * 3 + 1] = ny; nor[o * 3 + 2] = nz;
        col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
        if (uv) { const ax = Math.abs(nx), ay = Math.abs(ny); const a = ay > 0.6 ? P.getX(j) : ax > 0.6 ? P.getZ(j) : P.getX(j), b = ay > 0.6 ? P.getZ(j) : P.getY(j); uvs[o * 2] = a / uv; uvs[o * 2 + 1] = b / uv; }
        else if (UV) { uvs[o * 2] = UV.getX(j); uvs[o * 2 + 1] = UV.getY(j); }
      }
      g.dispose();
    });
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3)); out.setAttribute('uv', new T.BufferAttribute(uvs, 2));
    out.computeBoundingSphere(); return out;
  };
  // a box with its corners knocked about a little (old stone is never square)
  const roughBox = (T, w, h, d, rough, rnd) => {
    const g = new T.BoxGeometry(w, h, d, 2, 2, 2), p = g.attributes.position, seen = new Map();
    for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3); let o = seen.get(k); if (!o) { o = [(rnd() - 0.5) * rough, (rnd() - 0.5) * rough, (rnd() - 0.5) * rough]; seen.set(k, o); }
      const corner = (Math.abs(p.getX(i)) > w * 0.49 ? 1 : 0) + (Math.abs(p.getY(i)) > h * 0.49 ? 1 : 0) + (Math.abs(p.getZ(i)) > d * 0.49 ? 1 : 0);
      const s = corner === 3 ? 1 : 0.4; p.setXYZ(i, p.getX(i) * (corner === 3 ? 0.94 : 1) + o[0] * s, p.getY(i) * (corner === 3 ? 0.94 : 1) + o[1] * s, p.getZ(i) + o[2] * s); }
    g.computeVertexNormals(); return g;
  };
  RC.roughBox = roughBox;
  const rng = (seed) => { let s = (Math.floor(seed * 1e6) ^ 0x9e3779b9) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  RC.rng = rng;

  // ---------------------------------------------------------------- the pieces
  RC.Aging = {
    // stone foundation all round: two or three courses of small granite-ish blocks, each its own size and shade, going down into the ground
    foundation(T, W, D, h, stone, seed) {
      const r = rng(seed), parts = [], m4 = new T.Matrix4(), tints = ['#e8e4dc', '#d8d4cc', '#f0eadf', '#ccc8be', '#e0d8c8', '#c0bcb4'];
      const courses = [[-0.45, 0.42], [-0.03, 0.26], [0.23, h - 0.23]];
      const run = (len, place) => {
        for (const [y0, ch] of courses) { if (ch < 0.08) continue; let x = -len / 2 - r() * 0.2;
          while (x < len / 2) { const bw = Math.min(0.3 + r() * 0.45, len / 2 - x + 0.05); if (bw < 0.12) break; const bh = ch * (0.92 + r() * 0.1);
            const g = roughBox(T, bw - 0.025, bh - 0.02, 0.32 + r() * 0.06, 0.05, r); place(m4, x + bw / 2, y0 + bh / 2, (r() - 0.5) * 0.03); parts.push({ geo: g, mat4: m4.clone(), color: tints[Math.floor(r() * tints.length)] }); x += bw; } }
      };
      run(W + 0.32, (m, x, y, o) => m.makeTranslation(x, y, D / 2 + 0.02 + o));
      run(W + 0.32, (m, x, y, o) => m.makeTranslation(x, y, -D / 2 - 0.02 + o));
      run(D, (m, x, y, o) => m.makeRotationY(Math.PI / 2).setPosition(W / 2 + 0.02 + o, y, x));
      run(D, (m, x, y, o) => m.makeRotationY(Math.PI / 2).setPosition(-W / 2 - 0.02 + o, y, x));
      const mat = new T.MeshStandardMaterial({ map: stone && stone.map, normalMap: stone && stone.normalMap, vertexColors: true, roughness: 0.95 });
      const mesh = new T.Mesh(RC.mergeParts(T, parts, stone ? stone.m * 0.5 : 1), mat); mesh.castShadow = mesh.receiveShadow = true; return mesh;
    },
    // a shutter made of boards with a Z brace, hung on its hinge (group pivots at the hinge)
    shutter(T, w, h, mat, braceMat, side, open, seed) {
      const r = rng(seed), g = new T.Group(), board = new T.Group(); g.add(board); const n = 3, bw = w / n;
      for (let i = 0; i < n; i++) { const b = new T.Mesh(new T.BoxGeometry(bw - 0.012, h - r() * 0.02, 0.035), mat); b.position.set(side * (-(i + 0.5) * bw), h / 2, 0); board.add(b); }
      for (const yy of [0.14, h - 0.14]) { const ra = new T.Mesh(new T.BoxGeometry(w - 0.04, 0.08, 0.025), braceMat); ra.position.set(-side * w / 2, yy, 0.03); board.add(ra); }
      const L = Math.hypot(w - 0.1, h - 0.36), br = new T.Mesh(new T.BoxGeometry(0.07, L, 0.022), braceMat); br.position.set(-side * w / 2, h / 2, 0.03); br.rotation.z = side * Math.atan2(w - 0.1, h - 0.36); board.add(br);
      g.rotation.y = side * open; g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
    },
    // a window box: boards, soil, a mound of leaves, flowers, and trails hanging over the front and sides
    planter(T, w, wood, seed, flowers) {
      const r = rng(seed), g = new T.Group(), parts = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1);
      for (const [bw, bh, bd, x, y, z] of [[w, 0.17, 0.025, 0, 0.085, 0.09], [w, 0.17, 0.025, 0, 0.085, -0.09], [0.025, 0.17, 0.2, -w / 2, 0.085, 0], [0.025, 0.17, 0.2, w / 2, 0.085, 0], [w, 0.02, 0.2, 0, 0.01, 0]]) { const b = new T.Mesh(new T.BoxGeometry(bw, bh, bd), wood); b.position.set(x, y, z); b.castShadow = true; g.add(b); }
      const leafG = new T.BufferGeometry(); leafG.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0.5, 0.5, 0, 0, 1, 0, -0.5, 0.5, 0, 0, 0, 0, 0, 1, 0], 3)); leafG.computeVertexNormals();
      const greens = ['#3f6a2a', '#4a7a30', '#355a24', '#5a8a3a', '#2f5020'];
      const leaf = (x, y, z, size, rx, ry, col) => { e.set(rx, ry, (r() - 0.5) * 0.8); q.setFromEuler(e); s.set(size * 0.7, size, 1); m4.compose(new T.Vector3(x, y, z), q, s); parts.push({ geo: leafG, mat4: m4.clone(), color: col }); };
      for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * (w - 0.05), z = (r() - 0.5) * 0.16, y = 0.16 + r() * 0.12 * (1 - Math.abs(x) / w); leaf(x, y, z, 0.05 + r() * 0.04, -0.6 - r() * 0.9, r() * 6.28, greens[Math.floor(r() * 5)]); }
      // trailing stems over the front (and a few over the ends), longer here and there
      const trails = 6 + Math.floor(r() * 5);
      for (let t = 0; t < trails; t++) {
        const end = r() < 0.2, x0 = end ? (r() < 0.5 ? -1 : 1) * w / 2 : (r() - 0.5) * (w - 0.1), z0 = end ? (r() - 0.5) * 0.14 : 0.1, len = 0.15 + r() * 0.4;
        for (let k = 0, n = Math.round(len / 0.04); k < n; k++) { const f = k / n, yy = 0.17 - f * len, out = 0.03 + Math.sin(f * 1.6) * 0.05; leaf(end ? x0 + Math.sign(x0) * out : x0 + Math.sin(f * 5 + t) * 0.03, yy, end ? z0 : z0 + out, 0.035 + r() * 0.025 * (1 - f * 0.5), 0.6 + r() * 0.8, (r() - 0.5) * 2.5, greens[Math.floor(r() * 5)]);
          if (flowers && r() < 0.18) leaf(end ? x0 + Math.sign(x0) * (out + 0.01) : x0, yy, end ? z0 : z0 + out + 0.012, 0.03, r() * 6.28, r() * 6.28, flowers[Math.floor(r() * flowers.length)]); }
      }
      if (flowers) for (let i = 0; i < 26; i++) { const x = (r() - 0.5) * (w - 0.08), z = (r() - 0.5) * 0.15, y = 0.24 + r() * 0.12, c = flowers[Math.floor(r() * flowers.length)];
        for (let p = 0; p < 5; p++) leaf(x + Math.cos(p * 1.26) * 0.012, y, z + Math.sin(p * 1.26) * 0.012, 0.028, -1.2, p * 1.26, c); }
      const mesh = new T.Mesh(RC.mergeParts(T, parts), RC.Aging.leafMat(T)); mesh.castShadow = true; g.add(mesh); return g;
    },
    leafMat(T) { return tex.leaf || (tex.leaf = RC.Aging.stir(new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.6 }), 'y')); },
    // leaves flutter: each moves on its own (the phase comes from where it is), more with the wind; stems close to the wall hardly move
    stir(m, axis) {
      const S = RC.Aging.shared; if (!S) return m;
      m.onBeforeCompile = (sh) => { sh.uniforms.uTime = S.uTime; sh.uniforms.uWind = S.uWind;
        sh.vertexShader = 'uniform float uTime; uniform vec3 uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz; float gust = 0.5 + 0.5 * sin(uTime * 0.7 + wp0.x * 0.3 + wp0.z * 0.2);
          float free0 = ${axis === 'z' ? 'smoothstep(0.02, 0.05, position.z)' : '(1.0 - smoothstep(0.0, 0.1, position.y)) * 0.6 + 0.4'};
          float a = free0 * (0.004 + 0.012 * uWind.z * (0.4 + gust));
          transformed += vec3(sin(uTime * 3.1 + wp0.x * 9.0 + wp0.y * 7.0), sin(uTime * 2.3 + wp0.y * 8.0 + wp0.z * 6.0) * 0.6, cos(uTime * 2.7 + wp0.z * 9.0 + wp0.x * 5.0)) * a;`); };
      m.customProgramCacheKey = () => 'stir' + axis; return m;
    },
    // ivy up a wall face (local: the face is the plane z = 0, x across, y up), avoiding openings [x0, y0, x1, y1]
    ivy(T, span, height, holes, seed, roses) {
      const r = rng(seed), parts = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), stems = [];
      const leafG = RC.Aging.ivyLeaf(T), stemG = new T.CylinderGeometry(0.008, 0.012, 1, 4, 1, true); stemG.translate(0, 0.5, 0);
      const greens = roses ? ['#2f5a24', '#3a6a2a', '#28501f'] : ['#1f4a1c', '#2a5a22', '#24461a', '#355f26', '#1a3c16'];
      const blocked = (x, y) => holes.some(([a, b, c, d]) => x > a - 0.06 && x < c + 0.06 && y > b - 0.06 && y < d + 0.06);
      const roots = roses ? 2 : 2 + Math.floor(r() * 3), x0 = (r() - 0.5) * span * 0.6;
      for (let k = 0; k < roots; k++) {
        const walk = (x, y, dir, life, depth) => {
          for (let i = 0; i < life; i++) {
            const step = 0.07 + r() * 0.05, nx = x + Math.sin(dir) * step, ny = y + Math.cos(dir) * step;
            if (ny > height || Math.abs(nx) > span / 2 - 0.05 || blocked(nx, ny)) { dir += (r() < 0.5 ? -1 : 1) * 0.9; continue; }
            const L = Math.hypot(nx - x, ny - y); e.set(0, 0, -Math.atan2(nx - x, ny - y)); q.setFromEuler(e); s.set(1, L, 1); m4.compose(new T.Vector3(x, y, 0.015), q, s); parts.push({ geo: stemG, mat4: m4.clone(), color: '#4a3a28' });
            x = nx; y = ny; dir += (r() - 0.5) * 0.6; dir *= 0.92;
            const nL = roses ? 2 : 3; for (let j = 0; j < nL; j++) { const sz = (roses ? 0.05 : 0.06) + r() * 0.04 - y * 0.004; e.set((r() - 0.5) * 0.7, (r() - 0.5) * 0.7, r() * 6.28); q.setFromEuler(e); s.set(sz, sz, sz); m4.compose(new T.Vector3(x + (r() - 0.5) * 0.12, y + (r() - 0.5) * 0.1, 0.03 + r() * 0.05), q, s); parts.push({ geo: leafG, mat4: m4.clone(), color: greens[Math.floor(r() * greens.length)] }); }
            if (roses && r() < 0.16) { const rc = roses[Math.floor(r() * roses.length)], fx = x + (r() - 0.5) * 0.1, fy = y + (r() - 0.5) * 0.1; for (let p = 0; p < 6; p++) { e.set(0.3, 0, p * 1.05); q.setFromEuler(e); s.set(0.035, 0.035, 0.035); m4.compose(new T.Vector3(fx, fy, 0.08), q, s); parts.push({ geo: leafG, mat4: m4.clone(), color: rc }); } }
            if (depth < 3 && r() < 0.13) walk(x, y, dir + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.6), Math.floor(life * (0.4 + r() * 0.4)), depth + 1);
          }
        };
        walk(x0 + (k - roots / 2) * (0.3 + r() * 0.5), 0, (r() - 0.5) * 0.5, Math.floor(height / 0.09 * (0.6 + r() * 0.6)), 0);
      }
      const mesh = new T.Mesh(RC.mergeParts(T, parts), RC.Aging.ivyMat(T)); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
    },
    ivyLeaf(T) {   // a three-lobed leaf, flat, centred
      if (tex.ivyG) return tex.ivyG;
      const sh = new T.Shape(); sh.moveTo(0, -0.5); sh.quadraticCurveTo(0.55, -0.35, 0.5, 0.05); sh.quadraticCurveTo(0.3, 0.05, 0.25, 0.15); sh.quadraticCurveTo(0.2, 0.5, 0, 0.6); sh.quadraticCurveTo(-0.2, 0.5, -0.25, 0.15); sh.quadraticCurveTo(-0.3, 0.05, -0.5, 0.05); sh.quadraticCurveTo(-0.55, -0.35, 0, -0.5);
      return (tex.ivyG = new T.ShapeGeometry(sh, 3));
    },
    ivyMat(T) { return tex.ivy || (tex.ivy = RC.Aging.stir(new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.45 }), 'z')); },
    // a trellis: thin laths crossing diagonally on a frame
    trellis(T, w, h, mat) {   // laths crossing at 45 degrees, each cut to the frame
      const g = new T.Group(), gap = 0.2;
      for (const sgn of [-1, 1]) for (let c = -h; c < w + h; c += gap) {
        // the line x = c + sgn * y (from the frame's left foot), kept inside 0..w, 0..h
        let y0 = 0, y1 = h; const xa = (y) => c + sgn * y;
        if (sgn > 0) { y0 = Math.max(0, -c); y1 = Math.min(h, w - c); } else { y0 = Math.max(0, c - w); y1 = Math.min(h, c); }
        if (y1 - y0 < 0.05) continue;
        const L = (y1 - y0) * Math.SQRT2, b = new T.Mesh(new T.BoxGeometry(0.025, L, 0.012), mat);
        b.position.set((xa(y0) + xa(y1)) / 2 - w / 2, (y0 + y1) / 2, sgn > 0 ? 0.012 : 0.026); b.rotation.z = -sgn * Math.PI / 4; g.add(b);
      }
      for (const [bw, bh, x, y] of [[w, 0.04, 0, 0], [w, 0.04, 0, h], [0.04, h, -w / 2, h / 2], [0.04, h, w / 2, h / 2]]) { const f = new T.Mesh(new T.BoxGeometry(bw, bh, 0.03), mat); f.position.set(x, y, 0.02); g.add(f); }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
    },
    // weeds and grass at the foot of a wall, along a line (local x across, z out from the wall)
    weeds(T, span, seed, gap) {   // gap: [x0, x1] left bare (the doorstep)
      const r = rng(seed), pos = [], col = [], c = new T.Color(), greens = ['#4a6a2a', '#5a7a32', '#6a8a3a', '#7a8a4a', '#3a5a22', '#8a8a5a'];
      for (let x = -span / 2; x < span / 2; x += 0.04 + r() * 0.08) {
        if (gap && x > gap[0] && x < gap[1]) continue;
        const clump = RC.vnoise(x + seed * 30, 0, 0.6, 5); if (clump < 0.35) continue;
        const n = Math.floor(clump * 9);
        for (let i = 0; i < n; i++) { const bx = x + (r() - 0.5) * 0.08, bz = r() * 0.12 + 0.02, hh = 0.05 + r() * 0.22 * clump, a = r() * 6.28, lean = 0.15 + r() * 0.3, wd = 0.006 + r() * 0.008;
          const tx = bx + Math.cos(a) * lean * hh, tz = bz + Math.abs(Math.sin(a)) * lean * hh; c.set(greens[Math.floor(r() * greens.length)]);
          pos.push(bx - wd, 0, bz, bx + wd, 0, bz, tx, hh, tz); for (let k = 0; k < 3; k++) col.push(c.r * (k === 2 ? 1.2 : 0.7), c.g * (k === 2 ? 1.2 : 0.7), c.b * (k === 2 ? 1.1 : 0.7)); }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      const n = []; for (let i = 0; i < pos.length / 3; i++) n.push(0, 1, 0); g.setAttribute('normal', new T.Float32BufferAttribute(n, 3));
      return new T.Mesh(g, tex.weed || (tex.weed = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.9 })));
    },
  };

  // ---------------------------------------------------------------- mounds: molehills in the lawns (in lines and clusters),
  // low sandy heaps and ant hills by the paths, lumps of earth in the rough grass. Lumpy little domes of real dirt and sand.
  RC.Mounds = (T, realm, terrain, avoid) => {
    const g = new T.Group(), Tx = (n) => RC.Tex.real(T, n);
    const kinds = [
      { tex: Tx('dirt') || Tx('dirt_path'), tint: '#e0d0b8', r: [0.12, 0.2], h: [0.05, 0.1], lump: 0.45, where: (k, kept, worn, x, z) => (k === '.' || k === ',') ? RC.smooth01((RC.vnoise(x, z, 3, 501) - 0.82) / 0.08) * 0.08 * (1 - kept * 0.7) : 0 },   // a few low gopher / mole mounds, in little groups
      { tex: Tx('sand'), tint: '#d8c8a8', r: [0.3, 0.6], h: [0.03, 0.06], lump: 0.15, where: (k, kept, worn) => (k === '.' || k === ',') ? worn * 0.02 * (1 - kept) : 0 },   // the odd sandy heap by the tracks
    ];
    kinds.forEach((K, ki) => {
      const ge = new T.SphereGeometry(1, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2), p = ge.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = RC.vnoise(x * 3 + ki * 9, z * 3, 1, 510 + ki) - 0.5, rim = 1 - y; p.setXYZ(i, x * (1 + n * K.lump * rim), Math.max(0, y * (1 + n * K.lump * 1.5) - 0.04), z * (1 + n * K.lump * rim)); }
      ge.computeVertexNormals(); const uv = ge.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 0.5, p.getZ(i) * 0.5);
      const mat = new T.MeshStandardMaterial({ color: K.tint, map: K.tex && K.tex.map, normalMap: K.tex && K.tex.normalMap, roughness: 1 });
      const spots = [];
      for (let z = 0.5; z < realm.h; z += 0.9) for (let x = 0.5; x < realm.w; x += 0.9) {
        const jx = x + (RC.hash(x, z, 520 + ki) - 0.5) * 0.8, jz = z + (RC.hash(z, x, 521 + ki) - 0.5) * 0.8, k = terrain.cell(jx, jz);
        if (avoid(jx, jz)) continue;
        const pr = K.where(k, terrain.kept ? terrain.kept(jx, jz) : 0, terrain.worn ? terrain.worn(jx, jz) : 0, jx, jz);
        if (pr > 0 && RC.hash(jx * 3, jz * 3, 530 + ki) < pr) spots.push([jx, jz]);
      }
      if (!spots.length) return;
      const im = new T.InstancedMesh(ge, mat, spots.length), m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), v = new T.Vector3(), e = new T.Euler();
      spots.forEach(([x, z], i) => { const rr = RC.lerp(K.r[0], K.r[1], RC.hash(x, z, 540)), hh = RC.lerp(K.h[0], K.h[1], RC.hash(z, x, 541));
        e.set(0, RC.hash(x, z, 542) * 6.28, 0); q.setFromEuler(e); s.set(rr * (0.8 + RC.hash(x, z, 543) * 0.5), hh, rr); v.set(x, terrain.groundY(x, z) - 0.015, z); m4.compose(v, q, s); im.setMatrixAt(i, m4); });
      im.receiveShadow = true; im.castShadow = true; g.add(im);
    });
    // a few hedgehogs in the rough grass and at the edge of the woods: a spiny brown back, a pale pointed snout
    { const spots = [];
      for (let z = 0.5; z < realm.h; z += 0.9) for (let x = 0.5; x < realm.w; x += 0.9) {
        const jx = x + (RC.hash(x, z, 560) - 0.5) * 0.8, jz = z + (RC.hash(z, x, 561) - 0.5) * 0.8, k = terrain.cell(jx, jz);
        if ((k === ',' || k === 'T') && !avoid(jx, jz) && RC.hash(jx * 5, jz * 5, 562) < 0.006) spots.push([jx, jz]);
      }
      if (spots.length) {
        const bg = new T.SphereGeometry(1, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.62), bp = bg.attributes.position;
        for (let i = 0; i < bp.count; i++) { const sp = 1 + (RC.vnoise(bp.getX(i) * 9, bp.getZ(i) * 9 + bp.getY(i) * 5, 1, 570) - 0.5) * 0.35; bp.setXYZ(i, bp.getX(i) * sp, bp.getY(i) * sp, bp.getZ(i) * sp); }
        bg.computeVertexNormals();
        const bm = new T.InstancedMesh(bg, new T.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1 }), spots.length), sg = new T.ConeGeometry(0.4, 1, 8).rotateZ(-Math.PI / 2),
          sm = new T.InstancedMesh(sg, new T.MeshStandardMaterial({ color: '#c8aa88', roughness: 0.9 }), spots.length), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), v = new T.Vector3();
        spots.forEach(([x, z], i) => { const yaw = RC.hash(x, z, 563) * 6.28, y = terrain.groundY(x, z), c = Math.cos(yaw), sn = Math.sin(yaw);
          e.set(0, yaw, 0); q.setFromEuler(e); bm.setMatrixAt(i, m4.compose(v.set(x, y + 0.01, z), q, s.set(0.16, 0.12, 0.11)));
          sm.setMatrixAt(i, m4.compose(v.set(x + c * 0.17, y + 0.045, z - sn * 0.17), q, s.set(0.13, 0.09, 0.09))); });
        bm.castShadow = sm.castShadow = true; g.add(bm); g.add(sm);
      } }
    return g;
  };

  // ---------------------------------------------------------------- smoke: soft puffs rising from some chimneys, now and then
  // chimneys: [{ x, y, z, big }]. All moved on the graphics card; each chimney has its own times on and off.
  RC.ChimneySmoke = (T, chimneys, shared) => {
    const N = 26, n = chimneys.length * N, base = new Float32Array(n * 3), seed = new Float32Array(n), chim = new Float32Array(n), big = new Float32Array(n);
    chimneys.forEach((c, i) => { for (let k = 0; k < N; k++) { const j = i * N + k; base.set([c.x, c.y, c.z], j * 3); seed[j] = k / N + Math.random() * 0.02; chim[j] = c.seed != null ? c.seed : Math.random(); big[j] = c.big ? 1 : 0; } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(base, 3)); g.setAttribute('aSeed', new T.BufferAttribute(seed, 1)); g.setAttribute('aChim', new T.BufferAttribute(chim, 1)); g.setAttribute('aBig', new T.BufferAttribute(big, 1));
    const u = { uTime: shared.uTime, uWind: shared.uWind, uViewH: { value: 800 }, uLight: { value: 1 }, uNight: shared.night || { value: 0 } };
    const mat = new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `attribute float aSeed, aChim, aBig; uniform float uTime, uViewH; uniform vec3 uWind; varying float vA; varying float vL; varying float vRot;
        void main() {
          float rate = mix(0.09, 0.13, aBig), life = fract(uTime * rate + aSeed);
          // on for a while, off for a while (the fire lit for cooking or warmth); the forge always going
          float ph = fract(uTime / (140.0 + aChim * 160.0) + aChim * 7.0), on = max(aBig, smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.42, 0.5, ph)));
          vec3 p = position; float rise = life * (2.6 + aBig * 2.0);
          p.y += rise; p.xz += uWind.xy * 5.0 * pow(life, 1.3) + vec2(sin(life * 6.0 + aSeed * 40.0), cos(life * 5.0 + aChim * 30.0)) * 0.12 * life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float size = (0.18 + life * (0.9 + aBig * 0.8));
          gl_PointSize = size * projectionMatrix[1][1] * uViewH * 0.5 / max(0.1, -mv.z);
          vA = smoothstep(0.0, 0.1, life) * pow(1.0 - life, 1.5) * on * mix(0.32, 0.5, aBig); vL = life; vRot = aSeed * 30.0; }`,
      fragmentShader: `uniform float uLight; varying float vA; varying float vL; varying float vRot;
        void main() { vec2 q = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); q = mat2(c, -s, s, c) * q;
          float d = length(q) * 2.0, lump = 0.8 + 0.2 * sin(q.x * 9.0 + vRot) * sin(q.y * 7.0 - vRot);
          float a = (1.0 - smoothstep(0.2, 1.0, d * (1.1 - lump * 0.2))) * vA; if (a < 0.004) discard;
          vec3 col = mix(vec3(0.5, 0.5, 0.52), vec3(0.8, 0.8, 0.82), vL) * uLight; gl_FragColor = vec4(col, a); }` });
    const pts = new T.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; const v = new T.Vector2();
    pts.onBeforeRender = (r) => { r.getDrawingBufferSize(v); u.uViewH.value = v.y; };
    pts.userData.noWeather = true; return { object: pts, light: u.uLight };
  };

  // ---------------------------------------------------------------- drips off the eaves while it rains
  // eaves: [{ x0, x1, z, y, ground(x) }] along x (or {along:'z'}). Each drip falls from the eave to the ground and starts again;
  // how many are falling follows how hard it rains (uRain).
  RC.EaveDrips = (T, eaves, shared) => {
    const st = [], gy = [], sd = [], end = [];
    for (const e of eaves) { const L = Math.abs(e.x1 - e.x0); for (let k = 0, n = Math.floor(L / 0.08); k < n; k++) {
      const f = (k + Math.random() * 0.8) / n, a = e.x0 + (e.x1 - e.x0) * f, x = e.along === 'z' ? e.c : a, z = e.along === 'z' ? a : e.c, g = e.ground(x, z), s = Math.random();
      for (const en of [0, 1]) { st.push(x, e.y, z); gy.push(g); sd.push(s); end.push(en); } } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(st, 3)); g.setAttribute('aGround', new T.Float32BufferAttribute(gy, 1)); g.setAttribute('aSeed', new T.Float32BufferAttribute(sd, 1)); g.setAttribute('aEnd', new T.Float32BufferAttribute(end, 1));
    const u = { uTime: shared.uTime, uRain: shared.uRain, uWind: shared.uWind };
    const mat = new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `attribute float aGround, aSeed, aEnd; uniform float uTime, uRain; uniform vec3 uWind; varying float vA;
        void main() {
          float fall = max(0.3, position.y - aGround), dur = sqrt(2.0 * fall / 9.8), t = fract(uTime / (dur * (1.0 + aSeed * 0.8)) + aSeed * 17.0);
          float drop = 0.5 * 9.8 * pow(t * dur, 2.0);
          vec3 p = position; p.y -= min(drop, fall) - aEnd * (0.08 + t * 0.3); p.xz += uWind.xy * 3.0 * t;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          float on = step(aSeed, uRain * 1.15 - 0.05); vA = on * (1.0 - smoothstep(0.9, 1.0, t)) * (aEnd > 0.5 ? 0.15 : 0.85); }`,
      fragmentShader: `varying float vA; void main() { if (vA < 0.01) discard; gl_FragColor = vec4(0.8, 0.86, 0.95, vA); }` });
    const lines = new T.LineSegments(g, mat); lines.frustumCulled = false; lines.userData.noWeather = true; return lines;
  };
})();
