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
      const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.groundTex, roughness: 0.93 }));
      ground.receiveShadow = true; ground.name = 'ground'; g.add(ground);
      // water: one sheet over the sea, ripples drawn on it and drifting
      const wtex = this.rippleTexture(THREE); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(W / 6, H / 6);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, H + 40).rotateX(-Math.PI / 2).translate(W / 2, this.waterY, H / 2 + 20),
        new THREE.MeshStandardMaterial({ color: '#2f7fd1', map: wtex, transparent: true, opacity: 0.86, roughness: 0.25, metalness: 0.05 }));
      water.receiveShadow = true; water.name = 'water'; g.add(water); this.waterTex = wtex;
      return g;
    }
    // the ground picture: 16 pixels per cell, each letter painted its own way (grass, flowers, cobbles…)
    paintTexture(THREE) {
      const P = 16, W = this.w, H = this.h, cv = document.createElement('canvas'); cv.width = W * P; cv.height = H * P;
      const g = cv.getContext('2d');
      const grass = ['#6dbb4c', '#73c252', '#68b347', '#79c657'], meadow = ['#8fd068', '#97d671', '#88c962'];
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const k = this.paint[r][c], x = c * P, y = r * P, h = RC.hash(c, r, 3);
        if (k === '-') {   // cobbles: rounded stones in rows
          g.fillStyle = '#6b7280'; g.fillRect(x, y, P, P);
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
            const t = RC.hash(c * 4 + i, r * 4 + j, 7), sx = x + i * 4 + (j % 2) * 2, sy = y + j * 4;
            g.fillStyle = `hsl(215, 8%, ${48 + t * 22}%)`; g.beginPath(); g.ellipse(sx + 2, sy + 2, 1.7, 1.5, 0, 0, 7); g.fill();
          }
        } else if (k === ',') {   // meadow and flowers
          g.fillStyle = meadow[Math.floor(h * 3)]; g.fillRect(x, y, P, P);
          for (let i = 0; i < 3; i++) { const t = RC.hash(c * 3 + i, r, 11); if (t < 0.45) { g.fillStyle = ['#fef3c7', '#fda4af', '#fde047', '#c4b5fd', '#ffffff'][Math.floor(t * 11) % 5]; g.fillRect(x + RC.hash(c, r * 3 + i, 5) * 14, y + RC.hash(c * 7, r + i, 9) * 14, 2, 2); } }
        } else if (k === '=' ) { g.fillStyle = '#8b5a2b'; g.fillRect(x, y, P, P); }
        else if (k === '~') { g.fillStyle = '#c8b48a'; g.fillRect(x, y, P, P); }   // sand under the water
        else if (k === 'T') { g.fillStyle = '#4e8f37'; g.fillRect(x, y, P, P); }
        else { g.fillStyle = grass[Math.floor(h * 4)]; g.fillRect(x, y, P, P); for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,90,30,.25)'; g.fillRect(x + RC.hash(c, r, 20 + i) * 15, y + RC.hash(r, c, 30 + i) * 15, 1, 2); } }
      }
      // soft edges between ground kinds
      g.filter = 'blur(1.2px)'; g.drawImage(cv, 0, 0); g.filter = 'none';
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
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
