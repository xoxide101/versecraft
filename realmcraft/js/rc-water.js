// Water: the sea's surface as moving light, not a painted sheet. Waves from several directions (stronger with the wind),
// fine ripples on top, the sky mirrored more at a slant than looking straight down; clear and green-blue in the shallows
// (the sand shows through), dark blue where deep; foam lapping at the shore in bands; rings spreading from raindrops
// while it rains. Then what lives there: water lilies near the reeds, now and then a fish jumping with a splash.
(function () {
  const RC = window.RC;
  const HEAD = `uniform sampler2D tDepth; uniform vec2 uMapSize; uniform float uTime, uRain; uniform vec3 uWind; varying vec3 vWw;
    float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float wN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y); }
    // slope of the surface (d height / dx, dz) from a few travelling waves
    vec2 wave(vec2 p, vec2 d, float k, float a, float w) { float ph = dot(p, d) * k - uTime * w; return d * k * a * cos(ph); }
    // raindrop rings in one grid of cells
    vec2 rings(vec2 p, float cell, float seed) {
      vec2 c = floor(p / cell), l = fract(p / cell) - 0.5; float h = wHash(c + seed), h2 = wHash(c + seed + 7.3), h3 = wHash(c + seed + 3.1);
      l -= (vec2(h, h2) - 0.5) * 0.4; float ph = fract(uTime * (0.7 + h3 * 0.6) + h), r = length(l) * cell, R = ph * cell * 0.42, dr = r - R;
      float on = step(h3, uRain * 1.1), amp = on * (1.0 - ph) * (1.0 - ph) * exp(-dr * dr * 900.0) * sin(dr * 90.0);
      return normalize(l + 1e-4) * amp * 1.2; }\n`;
  const BODY = `
    {
      vec2 p = vWw.xz; float ws = 0.45 + uWind.z * 0.55;
      vec2 wd = normalize(uWind.xy + vec2(0.0001, 0.6));
      vec2 g = wave(p, wd, 0.9, 0.05 * ws, 1.3) + wave(p, normalize(wd + vec2(0.6, 0.2)), 1.7, 0.025 * ws, 1.9)
             + wave(p, normalize(vec2(-wd.y, wd.x) * 0.5 + wd), 3.1, 0.012 * ws, 2.7) + wave(p, normalize(vec2(0.3, -1.0)), 0.5, 0.06 * ws, 0.8);
      vec2 q = p * 2.2 + vec2(uTime * 0.25, uTime * 0.18); float e = 0.08;
      float n0 = wN(q) + wN(q * 2.3 - uTime * 0.3) * 0.5;
      g += vec2(wN(q + vec2(e, 0.0)) + wN((q + vec2(e, 0.0)) * 2.3 - uTime * 0.3) * 0.5 - n0, wN(q + vec2(0.0, e)) + wN((q + vec2(0.0, e)) * 2.3 - uTime * 0.3) * 0.5 - n0) / e * 0.012 * ws;
      if (uRain > 0.02) { g += rings(p, 0.55, 0.0) + rings(p + 0.27, 0.7, 11.0) * 0.8 + rings(p - 0.41, 0.45, 23.0) * 0.7; }
      // depth below the surface: shallow and clear at the shore, dark and deep out at sea (off the map: deep)
      vec2 uv = p / uMapSize; float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      float d = mix(3.0, texture2D(tDepth, uv).r * 2.55, inside);
      g *= 0.35 + 0.65 * smoothstep(0.0, 0.6, d);   // (calmer right in the shallows)
      vec3 nW = normalize(vec3(-g.x, 1.0, -g.y)); normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
      vec3 shallow = vec3(0.26, 0.5, 0.46), deep = vec3(0.03, 0.11, 0.17);
      diffuseColor.rgb = mix(shallow, deep, smoothstep(0.05, 1.6, d));
      diffuseColor.a = mix(0.25, 0.94, smoothstep(0.0, 1.1, d));
      // foam: a fringe at the edge and bands rolling in toward the shore, broken up by noise
      float fn = wN(p * 3.0 + uTime * 0.2) * 0.6 + wN(p * 9.0 - uTime * 0.4) * 0.4;
      float edge = (1.0 - smoothstep(0.0, 0.08 + fn * 0.06, d));
      float band = smoothstep(0.72, 0.95, sin(d * 26.0 + uTime * 1.7 + fn * 3.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.05, 0.4, d)) * smoothstep(0.35, 0.7, fn);
      float foam = clamp(edge * smoothstep(0.25, 0.6, fn) + band * 0.8, 0.0, 1.0) * inside;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.92), foam); diffuseColor.a = max(diffuseColor.a, foam * 0.9);
      roughnessFactor = mix(0.05, 0.6, foam);
    }`;
  RC.Water = {
    // the water's material (made once the map is known: it needs the depths)
    material(T, terrain, shared, realm) {
      const W = realm.w, H = realm.h, S = 4, data = new Uint8Array(W * S * H * S * 4);
      for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) { const wx = (x + 0.5) / S, wz = (y + 0.5) / S, dd = terrain.waterY - terrain.surface(wx, wz), i = (y * W * S + x) * 4; data[i] = RC.clamp(dd * 100, 0, 255); data[i + 3] = 255; }
      const depth = new T.DataTexture(data, W * S, H * S); depth.magFilter = depth.minFilter = T.LinearFilter; depth.flipY = false; depth.needsUpdate = true;
      const m = new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, roughness: 0.05, metalness: 0, envMapIntensity: 1.3, depthWrite: false });
      const u = { tDepth: { value: depth }, uMapSize: { value: new T.Vector2(W, H) }, uTime: shared.uTime, uRain: shared.uRain, uWind: shared.uWind };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = 'varying vec3 vWw;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = HEAD + sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + BODY);
      };
      m.customProgramCacheKey = () => 'rc-water'; m.userData.noWeather = true; return m;
    },

    // lilies near the reeds and shore, a fish jumping now and then
    life(T, realm, terrain, shared) {
      const g = new T.Group(), W = realm.w, H = realm.h, depthAt = (x, z) => (terrain.isWater(x, z) ? terrain.waterY - terrain.surface(x, z) : -1);
      const busy = realm.things.filter((t) => t.kind === 'boat' || t.kind === 'dock_cargo');
      const clear = (x, z) => { for (let dx = -1.5; dx <= 1.5; dx += 0.75) for (let dz = -1.5; dz <= 1.5; dz += 0.75) if (terrain.cell(x + dx, z + dz) === '=') return false; return !busy.some((b) => Math.hypot(b.x - x, b.z - z) < 3); };
      // ---- lily pads: in clusters in still water near the land, each pad round with its notch, some in flower
      const spots = [];
      for (let z = 0.5; z < H; z += 0.45) for (let x = 0.5; x < W; x += 0.45) {
        const jx = x + (RC.hash(x, z, 601) - 0.5) * 0.4, jz = z + (RC.hash(z, x, 602) - 0.5) * 0.4, d = depthAt(jx, jz);
        if (d < 0.08 || d > 0.9) continue;
        let near = 99; for (let r = 1; r <= 4 && near === 99; r++) for (let a = 0; a < 8; a++) if (!terrain.isWater(jx + Math.cos(a * 0.785) * r, jz + Math.sin(a * 0.785) * r)) { near = r; break; }
        const pr = (near <= 3 ? 1 : 0) * RC.smooth01((RC.vnoise(jx, jz, 3.5, 603) - 0.55) / 0.15) * 0.75;
        if (pr > 0 && RC.hash(jx * 5, jz * 5, 604) < pr && clear(jx, jz)) spots.push([jx, jz]);
      }
      if (spots.length) {
        const pad = new T.CircleGeometry(1, 20, 0.25, Math.PI * 2 - 0.25).rotateX(-Math.PI / 2), pp = pad.attributes.position;
        for (let i = 0; i < pp.count; i++) { const r = Math.hypot(pp.getX(i), pp.getZ(i)); pp.setY(i, r * r * 0.04); }   // (edges turned up a touch)
        pad.computeVertexNormals();
        const padM = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, side: T.DoubleSide }), im = new T.InstancedMesh(pad, padM, spots.length), m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), v = new T.Vector3(), e = new T.Euler(), c = new T.Color();
        const greens = ['#3e6e2a', '#4a7a30', '#56843a', '#3a5f28', '#6a7a3a', '#7a6a3a'];
        const flowers = [];
        spots.forEach(([x, z], i) => { const r = 0.1 + RC.hash(x, z, 610) * 0.22; e.set((RC.hash(x, z, 611) - 0.5) * 0.06, RC.hash(x, z, 612) * 6.28, 0); q.setFromEuler(e); s.set(r, 1, r); v.set(x, terrain.waterY + 0.012, z); m4.compose(v, q, s); im.setMatrixAt(i, m4);
          im.setColorAt(i, c.set(greens[Math.floor(RC.hash(z, x, 613) * greens.length)])); if (RC.hash(x, z, 614) < 0.12) flowers.push([x, z, r]); });
        im.receiveShadow = true; im.userData.bob = true; g.add(im);
        if (flowers.length) {   // the flower: two rings of pointed petals round a yellow middle
          const parts = [], petal = new T.ConeGeometry(0.018, 0.07, 4).rotateX(Math.PI / 2).translate(0, 0, 0.035), mid = new T.SphereGeometry(0.014, 6, 4), m5 = new T.Matrix4();
          flowers.forEach(([x, z, r], fi) => { const col = RC.hash(x, z, 620) < 0.6 ? '#f6f2ec' : '#f2b8c8', base = new T.Vector3(x + r * 0.3, terrain.waterY + 0.03, z);
            for (const [ring, n, up] of [[0, 8, 0.5], [1, 6, 0.95]]) for (let k = 0; k < n; k++) { e.set(-up, (k / n) * 6.28 + ring * 0.4 + fi, 0, 'YXZ'); q.setFromEuler(e); s.set(1 - ring * 0.2, 1, 1 - ring * 0.2); m5.compose(base, q, s); parts.push({ geo: petal, mat4: m5.clone(), color: col }); }
            m5.makeTranslation(base.x, base.y + 0.012, base.z); parts.push({ geo: mid, mat4: m5.clone(), color: '#f2c030' }); });
          const fm = new T.Mesh(RC.mergeParts(T, parts), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); g.add(fm);
        }
      }
      // ---- a fish jumping: a silver arc and a splash ring where it leaves and where it comes back down
      const body = new T.SphereGeometry(1, 10, 6); body.scale(0.035, 0.05, 0.16);
      const fish = new T.Group(), fm2 = new T.MeshStandardMaterial({ color: '#b8c4c8', metalness: 0.6, roughness: 0.3 }); fish.add(new T.Mesh(body, fm2));
      const tail = new T.Mesh(new T.ConeGeometry(0.05, 0.08, 4).rotateX(-Math.PI / 2), fm2); tail.position.z = -0.18; tail.scale.set(0.3, 1, 1); fish.add(tail);
      fish.visible = false; g.add(fish);
      const ringM = () => new T.MeshBasicMaterial({ color: '#e8f0f4', transparent: true, opacity: 0, depthWrite: false });
      const splashes = [0, 1, 2, 3].map(() => { const m = new T.Mesh(new T.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), ringM()); m.visible = false; m.userData.t = 9; g.add(m); return m; });
      const splash = (x, z) => { const s2 = splashes.reduce((a, b) => (a.userData.t > b.userData.t ? a : b)); s2.position.set(x, terrain.waterY + 0.02, z); s2.userData.t = 0; s2.visible = true; };
      let next = 4 + Math.random() * 6, jump = null;
      g.traverse((o) => { if (o.material) o.material.userData.noWeather = true; });
      return {
        group: g,
        update(dt, t, px, pz) {
          if (!jump && (next -= dt) <= 0) {   // somewhere in the water within sight, deep enough for fish
            next = 5 + Math.random() * 10;
            for (let k = 0; k < 12; k++) { const a = Math.random() * 6.28, r = 5 + Math.random() * 20, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
              if (depthAt(x, z) > 0.4 && clear(x, z)) { const dir = Math.random() * 6.28; jump = { x, z, dx: Math.cos(dir), dz: Math.sin(dir), t: 0, len: 0.6 + Math.random() * 0.6, h: 0.25 + Math.random() * 0.3 }; splash(x, z); break; } }
          }
          if (jump) {
            const j = jump; j.t += dt; const f = j.t / 0.75;
            if (f >= 1) { splash(j.x + j.dx * j.len, j.z + j.dz * j.len); fish.visible = false; jump = null; }
            else { fish.visible = true; fish.position.set(j.x + j.dx * j.len * f, terrain.waterY + 4 * j.h * f * (1 - f) - 0.02, j.z + j.dz * j.len * f); fish.rotation.set(0, Math.atan2(j.dx, j.dz), 0); fish.rotateX(-(1 - 2 * f) * 1.1); tail.rotation.y = Math.sin(t * 30) * 0.4; }
          }
          for (const s2 of splashes) { if (!s2.visible) continue; s2.userData.t += dt; const k = s2.userData.t / 1.4; if (k >= 1) { s2.visible = false; continue; } const r = 0.08 + k * 0.7; s2.scale.set(r, 1, r); s2.material.opacity = (1 - k) * 0.6; }
        },
      };
    },
  };
})();
