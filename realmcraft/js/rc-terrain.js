// TerrainCraft: the ground. A realm's terrain is
//   paint: one letter per cell (what the ground is: grass, paving, cobble, water, pier, forest…)
//   shape: steps that raise and lower it (terraces, slopes, the sea floor), applied in order.
// Heights are worked out from those, so the land can be reshaped by editing data, not code.
(function () {
  const RC = window.RC;
  const WATERISH = new Set(['~', '=']);   // the sea basin (a pier stands over water)

  RC.Terrain = class {
    constructor(def, w, h) {
      this.w = w; this.h = h; this.paint = def.paint; this.legend = def.legend || {}; this.shape = def.shape || [];
      this.sea = this.shape.find((s) => s.op === 'sea') || { floor: -0.6 };
      this.waterY = -0.05; this.pierY = 0.16;
      this.kept = null; this.worn = null;   // set by the realm (rc-groundcover.js): how tended the ground is, how worn
    }
    cell(x, z) { const c = Math.floor(x), r = Math.floor(z); if (r < 0 || r >= this.h || c < 0 || c >= this.w) return 'T'; return this.paint[r][c]; }
    isWater(x, z) { return WATERISH.has(this.cell(x, z)); }
    // how much of a ground kind is here, 0..1, with soft ragged borders (no cell squares): for colours and covers
    soft(kind, x, z) {
      const key = 'soft' + kind; if (!this[key]) { const a = new Float32Array(this.w * this.h); for (let r = 0; r < this.h; r++) for (let c = 0; c < this.w; c++) a[r * this.w + c] = this.paint[r][c] === kind ? 1 : 0; this[key] = a; }
      const A = this[key], wx = x + (RC.fbm(x, z, 2.5, 3, 91) - 0.5) * 1.6, wz = z + (RC.fbm(x + 50, z, 2.5, 3, 92) - 0.5) * 1.6;
      const X = RC.clamp(wx - 0.5, 0, this.w - 1.001), Z = RC.clamp(wz - 0.5, 0, this.h - 1.001), c = Math.floor(X), r = Math.floor(Z), fx = RC.smooth01(X - c), fz = RC.smooth01(Z - r), g = (cc, rr) => A[Math.min(this.h - 1, rr) * this.w + Math.min(this.w - 1, cc)];
      return RC.lerp(RC.lerp(g(c, r), g(c + 1, r), fx), RC.lerp(g(c, r + 1), g(c + 1, r + 1), fx), fz);
    }
    // the land's own height (no water): the shaping steps
    land(x, z) {
      let y = 0;
      for (const s of this.shape) {
        if (s.op === 'terrace') y += RC.smooth01((s.z - z) / s.soft) * s.rise;   // higher on the north side of the line
        else if (s.op === 'slope') y += RC.smooth01((s.z0 - z) / (s.z0 - s.z1)) * s.rise;
        else if (s.op === 'roll') y += Math.max(0, Math.sin(x * s.fx) * Math.cos(z * s.fz)) * s.amp;
      }
      if (this.cell(x, z) === '-') y += 0.04;   // roads sit a touch proud
      return y;
    }
    // the ground surface for the mesh: the sea bed under water, a bank where land meets water
    surface(x, z) {
      const e = 0.14; let wet = 0;
      for (const [dx, dz] of [[-e, -e], [e, -e], [-e, e], [e, e]]) if (this.isWater(x + dx, z + dz)) wet++;
      const s = this.sea;
      if (wet === 4) { const deep = s.deepFrom != null ? RC.smooth01((z - s.deepFrom) / s.deepRange) * s.deep : 0; return s.floor - deep + Math.sin(x * 0.85) * Math.cos(z * 0.85) * 0.05; }
      const y = this.land(x, z);
      return wet ? y * (1 - wet / 4) - 0.14 * (wet / 4) : y;
    }
    // where feet go
    groundY(x, z) {
      for (const d of this.decks || []) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.heightAt(z);   // on a pier (and its ramp)
      const c = this.cell(x, z); return c === '=' ? this.pierY : c === '~' ? this.waterY : this.land(x, z);
    }

    // ---------------------------------------------------------------- drawing: one mesh with a painted ground picture, and the water
    build(THREE) {
      const g = new THREE.Group(), W = this.w, H = this.h, R = 2;   // two mesh squares per cell
      const geo = new THREE.PlaneGeometry(W, H, W * R, H * R); geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, H / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, this.surface(p.getX(i), p.getZ(i)));
      geo.computeVertexNormals();
      this.groundTex = this.paintTexture(THREE);
      const ground = new THREE.Mesh(geo, this.groundMaterial(THREE));
      ground.receiveShadow = true; ground.name = 'ground'; g.add(ground);
      // water: one sheet over the sea, ripples drawn on it and drifting
      const wtex = this.rippleTexture(THREE); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(W / 6, H / 6);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, H + 40).rotateX(-Math.PI / 2).translate(W / 2, this.waterY, H / 2 + 20),
        new THREE.MeshStandardMaterial({ color: '#2f7fd1', map: wtex, transparent: true, opacity: 0.86, roughness: 0.25, metalness: 0.05 }));
      water.receiveShadow = true; water.name = 'water'; g.add(water); this.waterTex = wtex;
      return g;
    }
    // the ground's material: the painted grass picture, with real textures blended over it where the ground isn't grass
    // (cobbles on roads, dirt where worn, forest floor under trees, sand and pebbles at the water), each with its own relief.
    // A small "splat" picture says how much of each layer is where; its edges are ragged fractal, never cell squares.
    groundMaterial(THREE) {
      const base = new THREE.MeshStandardMaterial({ map: this.groundTex, normalMap: this.groundNormal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.93 });
      const L = ['cobble_road', 'dirt_path', 'forest_ground', 'sand'].map((n) => RC.Tex.real(THREE, n));
      if (L.some((x) => !x)) return base;   // (textures not packed: the painted ground alone)
      const splat = this.splatTexture(THREE), U = 1.1;   // (one world unit is about 1.1 m)
      base.onBeforeCompile = (sh) => {
        sh.uniforms.tSplat = { value: splat }; sh.uniforms.uSize = { value: new THREE.Vector2(this.w, this.h) };
        L.forEach((x, i) => { sh.uniforms['tC' + i] = { value: x.map }; sh.uniforms['tN' + i] = { value: x.normalMap }; });
        sh.uniforms.uScale = { value: new THREE.Vector4(...L.map((x) => U / x.meters[0])) };
        sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vWp; uniform sampler2D tSplat, tC0, tC1, tC2, tC3, tN0, tN1, tN2, tN3; uniform vec2 uSize; uniform vec4 uScale;\n' +
          'vec2 luv(float s) { return vec2(vWp.x, -vWp.z) * s; }\n' +
          sh.fragmentShader
            .replace('#include <map_fragment>', `
              vec4 sp = texture2D(tSplat, vWp.xz / uSize);
              // sharpen where a layer's stones stand proud (a little height-based blending)
              float h0 = dot(texture2D(tC0, luv(uScale.x)).rgb, vec3(0.33));
              sp.r = clamp(sp.r * (0.75 + h0 * 0.8), 0.0, 1.0);
              float wg = clamp(1.0 - sp.r - sp.g - sp.b - sp.a, 0.0, 1.0);
              vec3 col = texture2D(map, vMapUv).rgb * wg + texture2D(tC0, luv(uScale.x)).rgb * sp.r + texture2D(tC1, luv(uScale.y)).rgb * sp.g + texture2D(tC2, luv(uScale.z)).rgb * sp.b + texture2D(tC3, luv(uScale.w)).rgb * sp.a;
              diffuseColor.rgb *= col;`)
            .replace('#include <normal_fragment_maps>', `
              #ifdef USE_NORMALMAP_TANGENTSPACE
              vec3 mapN = (texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0) * wg + (texture2D(tN0, luv(uScale.x)).xyz * 2.0 - 1.0) * sp.r * 1.4 + (texture2D(tN1, luv(uScale.y)).xyz * 2.0 - 1.0) * sp.g + (texture2D(tN2, luv(uScale.z)).xyz * 2.0 - 1.0) * sp.b + (texture2D(tN3, luv(uScale.w)).xyz * 2.0 - 1.0) * sp.a;
              mapN.z = max(mapN.z, 0.2); mapN.xy *= normalScale;
              normal = normalize(tbn * mapN);
              #endif`);
      };
      base.customProgramCacheKey = () => 'ground-splat';
      return base;
    }
    // the splat picture: R cobbles, G dirt, B forest floor, A sand and shore
    splatTexture(THREE) {
      const S = 8, W = this.w, H = this.h, cv = RC.Tex.cv(W * S, H * S), g = cv.getContext('2d'), img = g.createImageData(W * S, H * S), d = img.data;
      for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
        const wx = (x + 0.5) / S, wz = (y + 0.5) / S, i = (y * W * S + x) * 4;
        const road = this.soft('-', wx, wz), under = this.soft('T', wx, wz), water = Math.max(this.soft('~', wx, wz), this.soft('=', wx, wz));
        const cob = RC.smooth01((road - 0.42 + (RC.fbm(wx, wz, 0.8, 3, 33) - 0.5) * 0.3) / 0.12);
        const kept = this.kept ? this.kept(wx, wz) : 0, worn = this.worn ? this.worn(wx, wz) : 0;
        let dirt = RC.smooth01((RC.fbm(wx + 31, wz + 17, 3.2, 5, 5) - 0.6 + worn * 0.35 - kept * 0.12) / 0.08) * (1 - cob);
        const forest = RC.smooth01((under - 0.3) / 0.4) * (1 - cob) * 0.85, sand = RC.smooth01((water - 0.2) / 0.35) * (1 - cob);
        dirt *= 1 - forest; const sum = cob + dirt + forest + sand, k = sum > 1 ? 1 / sum : 1;
        d[i] = cob * k * 255; d[i + 1] = dirt * k * 255; d[i + 2] = forest * k * 255; d[i + 3] = sand * k * 255;
      }
      g.putImageData(img, 0, 0);
      const tx = new THREE.CanvasTexture(cv); tx.premultiplyAlpha = false; tx.colorSpace = THREE.NoColorSpace; tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false; return tx;
    }
    // the ground picture: P pixels per cell, each letter painted its own way, plus a height picture for relief
    paintTexture(THREE) {
      const P = RC.quality.tier === 'low' ? 16 : 24, W = this.w, H = this.h, cv = RC.Tex.cv(W * P, H * P), hc = RC.Tex.cv(W * P, H * P);
      const g = cv.getContext('2d'), gh = hc.getContext('2d'); gh.fillStyle = '#7a7a7a'; gh.fillRect(0, 0, W * P, H * P);
      const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W ? 'T' : this.paint[r][c]);
      const big = (c, r, s, k) => RC.hash(Math.floor(c / s), Math.floor(r / s), k);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const k = this.paint[r][c], x = c * P, y = r * P;
        if (k === '-') {   // cobbles: rounded stones in offset rows, mortar between, each stone its own shade; relief from each stone's dome
          g.fillStyle = '#5b5f66'; g.fillRect(x, y, P, P); gh.fillStyle = '#404040'; gh.fillRect(x, y, P, P);
          const n = 4, s = P / n;
          for (let j = 0; j < n; j++) for (let i = -1; i < n; i++) {
            const t = RC.hash(c * 4 + i, r * 4 + j, 7), sx = x + i * s + (j % 2) * s / 2 + s / 2, sy = y + j * s + s / 2;
            g.fillStyle = `hsl(${205 + t * 30}, ${6 + t * 6}%, ${44 + t * 20}%)`; g.beginPath(); g.ellipse(sx, sy, s * 0.44, s * 0.4, t, 0, 7); g.fill();
            g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(sx - s * 0.1, sy - s * 0.1, s * 0.2, s * 0.15, 0, 0, 7); g.fill();
            const gr = gh.createRadialGradient(sx, sy, 0, sx, sy, s * 0.45); gr.addColorStop(0, '#e8e8e8'); gr.addColorStop(1, '#707070'); gh.fillStyle = gr; gh.beginPath(); gh.ellipse(sx, sy, s * 0.44, s * 0.4, t, 0, 7); gh.fill();
          }
          // worn edges where the road meets grass: dirt and stray grass
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = at(c + dc, r + dr); if (nk === '.' || nk === ',') { g.fillStyle = 'rgba(110,90,60,.35)'; for (let i = 0; i < 6; i++) { const ex = dc ? (dc > 0 ? x + P - 2 - RC.hash(c, r, i) * P * 0.25 : x + RC.hash(c, r, i) * P * 0.25) : x + RC.hash(c, r, i + 9) * P, ey = dr ? (dr > 0 ? y + P - 2 - RC.hash(r, c, i) * P * 0.25 : y + RC.hash(r, c, i) * P * 0.25) : y + RC.hash(r, c, i + 9) * P; g.beginPath(); g.arc(ex, ey, 1.5 + RC.hash(c, r, i + 20) * 2.5, 0, 7); g.fill(); } } }
        } else if (k === '=') { g.fillStyle = '#8b5a2b'; g.fillRect(x, y, P, P); }
        else if (k === '~') { g.fillStyle = `hsl(42, 35%, ${58 + big(c, r, 3, 5) * 10}%)`; g.fillRect(x, y, P, P); }   // sand under the water
        else {   // grass and meadow: painted per small block from fractal noise (no cell squares), fractal dirt where it's worn
          const B = 4;
          for (let by = 0; by < P; by += B) for (let bx = 0; bx < P; bx += B) {
            const wx = c + (bx + B / 2) / P, wz = r + (by + B / 2) / P;
            const patch = RC.fbm(wx, wz, 7, 4, 3), tone = RC.fbm(wx, wz, 1.6, 3, 9);
            const kept = this.kept ? this.kept(wx, wz) : 0, meadow = this.soft(',', wx, wz), under = this.soft('T', wx, wz);
            let hh = 92 + patch * 16 - meadow * 4, ss = 38 + patch * 14 + meadow * 6 - kept * 4, ll = 32 + patch * 12 + tone * 6 + meadow * 8 + kept * 3;
            // dirt: a fractal mask, more of it near roads (worn) and in the wild, less on kept lawns
            const worn = this.worn ? this.worn(wx, wz) : 0, dirt = RC.smooth01((RC.fbm(wx + 31, wz + 17, 3.2, 5, 5) - 0.6 + worn * 0.35 - kept * 0.12) / 0.08);
            if (dirt > 0) { hh = RC.lerp(hh, 30 + tone * 8, dirt); ss = RC.lerp(ss, 26 + tone * 8, dirt); ll = RC.lerp(ll, 26 + tone * 10, dirt); }
            hh -= under * 6; ll -= under * 8; ss -= under * 6;   // under the trees: darker, leaf litter (fading out at the edge)
            g.fillStyle = `hsl(${hh}, ${ss}%, ${ll}%)`; g.fillRect(x + bx, y + by, B, B);
            gh.fillStyle = dirt > 0.5 ? '#6c6c6c' : '#7a7a7a'; gh.fillRect(x + bx, y + by, B, B);
          }
          for (let i = 0; i < P * 0.7; i++) { const h = RC.hash(c * 31 + i, r, 13); g.fillStyle = h < 0.5 ? 'rgba(30,70,20,.22)' : 'rgba(190,230,140,.16)'; const sx = x + RC.hash(c, r * 31 + i, 14) * P, sy = y + RC.hash(c + i, r, 15) * P; g.fillRect(sx, sy, 1, 2 + h * 2); gh.fillStyle = h < 0.5 ? '#606060' : '#949494'; gh.fillRect(sx, sy, 1, 2); }
          for (let i = 0; i < 3; i++) { const sx = x + RC.hash(c * 5 + i, r, 41) * P, sy = y + RC.hash(c, r * 5 + i, 42) * P; if (RC.hash(c + i, r, 43) < 0.35) { g.fillStyle = `rgba(${90 + i * 10},${80 + i * 8},${70},.5)`; g.beginPath(); g.arc(sx, sy, 1 + RC.hash(c, r, 44 + i), 0, 7); g.fill(); gh.fillStyle = '#b0b0b0'; gh.beginPath(); gh.arc(sx, sy, 1.2, 0, 7); gh.fill(); } }   // pebbles
          if (k === ',') for (let i = 0; i < 4; i++) { const t2 = RC.hash(c * 3 + i, r, 11); if (t2 < 0.55) { g.fillStyle = ['#fff7d6', '#fda4af', '#fde047', '#c4b5fd', '#ffffff'][Math.floor(t2 * 11) % 5]; g.beginPath(); g.arc(x + RC.hash(c, r * 3 + i, 5) * P, y + RC.hash(c * 7, r + i, 9) * P, 1.6, 0, 7); g.fill(); } }
        }
      }
      g.filter = 'blur(0.8px)'; g.drawImage(cv, 0, 0); g.filter = 'none';
      const t = RC.Tex.tex(THREE, cv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      this.groundNormal = RC.Tex.normalFrom(THREE, hc, 3); this.groundNormal.wrapS = this.groundNormal.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    }
    rippleTexture(THREE) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(190,225,255,${0.35 + RC.hash(i, 1, 2) * 0.5})`; g.fillRect(RC.hash(i, 2, 3) * 128, RC.hash(i, 4, 5) * 128, 5 + RC.hash(i, 6, 7) * 8, 1.5); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    // the minimap picture: one pixel per cell
    mapPicture() {
      const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h; const g = cv.getContext('2d');
      const col = { '.': '#5fae46', ',': '#86c95f', '-': '#c79a4b', '~': '#2b6cb0', '=': '#8b5a2b', T: '#2f6b2a', L: '#e5e7eb' };
      for (let r = 0; r < this.h; r++) for (let c = 0; c < this.w; c++) { g.fillStyle = col[this.paint[r][c]] || '#5fae46'; g.fillRect(c, r, 1, 1); }
      return cv;
    }
  };
})();
