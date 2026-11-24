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
    }
    cell(x, z) { const c = Math.floor(x), r = Math.floor(z); if (r < 0 || r >= this.h || c < 0 || c >= this.w) return 'T'; return this.paint[r][c]; }
    isWater(x, z) { return WATERISH.has(this.cell(x, z)); }
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
    groundY(x, z) { const c = this.cell(x, z); return c === '=' ? this.pierY : c === '~' ? this.waterY : this.land(x, z); }

    // ---------------------------------------------------------------- drawing: one mesh with a painted ground picture, and the water
    build(THREE) {
      const g = new THREE.Group(), W = this.w, H = this.h, R = 2;   // two mesh squares per cell
      const geo = new THREE.PlaneGeometry(W, H, W * R, H * R); geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, H / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, this.surface(p.getX(i), p.getZ(i)));
      geo.computeVertexNormals();
      this.groundTex = this.paintTexture(THREE);
      const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.groundTex, normalMap: this.groundNormal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.93 }));
      ground.receiveShadow = true; ground.name = 'ground'; g.add(ground);
      // water: one sheet over the sea, ripples drawn on it and drifting
      const wtex = this.rippleTexture(THREE); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(W / 6, H / 6);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, H + 40).rotateX(-Math.PI / 2).translate(W / 2, this.waterY, H / 2 + 20),
        new THREE.MeshStandardMaterial({ color: '#2f7fd1', map: wtex, transparent: true, opacity: 0.86, roughness: 0.25, metalness: 0.05 }));
      water.receiveShadow = true; water.name = 'water'; g.add(water); this.waterTex = wtex;
      return g;
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
        else {   // grass and meadow: mottled in big soft patches, blades and specks, flowers on meadow
          const patch = big(c, r, 5, 11) * 0.6 + big(c, r, 2, 12) * 0.4, meadow = k === ',';
          g.fillStyle = `hsl(${meadow ? 92 : 98 + patch * 10}, ${meadow ? 46 : 42 + patch * 10}%, ${(meadow ? 50 : 38) + patch * 10}%)`; g.fillRect(x, y, P, P);
          for (let i = 0; i < P * 0.7; i++) { const h = RC.hash(c * 31 + i, r, 13); g.fillStyle = h < 0.5 ? 'rgba(30,70,20,.28)' : 'rgba(190,230,140,.22)'; g.fillRect(x + RC.hash(c, r * 31 + i, 14) * P, y + RC.hash(c + i, r, 15) * P, 1, 2 + h * 2); gh.fillStyle = h < 0.5 ? '#6a6a6a' : '#8a8a8a'; gh.fillRect(x + RC.hash(c, r * 31 + i, 14) * P, y + RC.hash(c + i, r, 15) * P, 1, 2); }
          if (meadow) for (let i = 0; i < 4; i++) { const t = RC.hash(c * 3 + i, r, 11); if (t < 0.55) { g.fillStyle = ['#fff7d6', '#fda4af', '#fde047', '#c4b5fd', '#ffffff'][Math.floor(t * 11) % 5]; g.beginPath(); g.arc(x + RC.hash(c, r * 3 + i, 5) * P, y + RC.hash(c * 7, r + i, 9) * P, 1.6, 0, 7); g.fill(); } }
          if (k === 'T') { g.fillStyle = 'rgba(50,40,20,.35)'; g.fillRect(x, y, P, P); }   // leaf litter under the trees
          if (big(c, r, 9, 16) > 0.86 && !meadow && k !== 'T') { g.fillStyle = 'rgba(120,100,60,.18)'; g.beginPath(); g.arc(x + P / 2, y + P / 2, P * 0.6, 0, 7); g.fill(); }   // a worn patch now and then
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
