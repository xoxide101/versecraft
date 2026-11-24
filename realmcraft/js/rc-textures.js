// Textures, drawn by code: bark, leaf clusters, grass, cobbles, plaster, timber, stone, roof tiles.
// Each can come with a relief (normal) map worked out from a height picture, so light catches the bumps.
// (Later: pictures made in ImageCraft can replace any of these by name.)
(function () {
  const RC = window.RC;
  const cache = {};
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rnd = (seed) => RC.rng(seed);

  RC.Tex = {
    cv,
    // a relief map from a height picture (brighter = higher), by comparing each pixel with its neighbours
    normalFrom(T, hc, strength = 2.5, repeat) {
      const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data, out = cv(w, h), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
      const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
        d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0); const t = new T.CanvasTexture(out); t.wrapS = t.wrapT = T.RepeatWrapping; if (repeat) t.repeat.copy(repeat); return t;
    },
    tex(T, c, srgb = true) { const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t; },

    // ---------------------------------------------------------------- bark: colour + relief
    bark(T, kind) {
      if (cache['bark' + kind]) return cache['bark' + kind];
      const W = 128, H = 256, c = cv(W, H), hc = cv(W, H), g = c.getContext('2d'), gh = hc.getContext('2d'), r = rnd(kind.length * 31 + 7);
      const base = { oak: '#5a4130', maple: '#6a4b38', pine: '#6b3f2a', birch: '#e8e4da', fruit: '#5e4433' }[kind] || '#5a4130';
      g.fillStyle = base; g.fillRect(0, 0, W, H); gh.fillStyle = '#808080'; gh.fillRect(0, 0, W, H);
      if (kind === 'birch') {   // white bark with dark marks across
        for (let i = 0; i < 46; i++) { const y = r() * H, x = r() * W, w = 6 + r() * 26; g.fillStyle = `rgba(30,28,26,${0.5 + r() * 0.4})`; g.fillRect(x, y, w, 1.5 + r() * 3); gh.fillStyle = '#505050'; gh.fillRect(x, y, w, 2); }
        for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(160,150,140,${r() * 0.25})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1); }
      } else if (kind === 'pine') {   // plates
        for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 * 8; x < W; x += 16) { const s = 70 + r() * 60; g.fillStyle = `rgba(${s + 40},${s * 0.6},${s * 0.4},.55)`; g.fillRect(x + 1, y + 1, 13, 8); gh.fillStyle = `rgb(${150 + r() * 60},0,0)`; gh.fillRect(x + 1, y + 1, 13, 8); }
      } else {   // furrows running up the trunk
        for (let i = 0; i < 70; i++) { const x = r() * W, w = 2 + r() * 4; let y = 0; g.strokeStyle = `rgba(20,12,6,${0.35 + r() * 0.4})`; gh.strokeStyle = '#303030'; g.lineWidth = gh.lineWidth = w; g.beginPath(); gh.beginPath(); g.moveTo(x, 0); gh.moveTo(x, 0); let xx = x; while (y < H) { y += 8 + r() * 20; xx += (r() - 0.5) * 6; g.lineTo(xx, y); gh.lineTo(xx, y); } g.stroke(); gh.stroke(); }
        for (let i = 0; i < 400; i++) { const v = r(); g.fillStyle = v < 0.5 ? 'rgba(255,240,220,.06)' : 'rgba(0,0,0,.08)'; g.fillRect(r() * W, r() * H, 2, 3); }
        if (kind !== 'fruit') for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(90,120,50,.28)'; g.beginPath(); g.ellipse(r() * W, H - r() * 60, 10 + r() * 14, 6 + r() * 10, 0, 0, 7); g.fill(); }   // moss low down
      }
      return (cache['bark' + kind] = { map: this.tex(T, c), normalMap: this.normalFrom(T, hc, 3) });
    },

    // ---------------------------------------------------------------- leaf cards: many small leaves on a see-through card (white-ish, tinted per tree)
    leaves(T, kind) {
      if (cache['leaf' + kind]) return cache['leaf' + kind];
      const S = 256, c = cv(S, S), g = c.getContext('2d'), r = rnd(kind.length * 97 + 3);
      const leaf = (x, y, len, wid, ang, col) => { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(wid, len * 0.45, 0, len); g.quadraticCurveTo(-wid, len * 0.45, 0, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, len * 0.9); g.stroke(); g.restore(); };
      const shade = (k) => { const v = 165 + r() * 90 * k; return `rgb(${v * 0.96 | 0},${v | 0},${v * 0.9 | 0})`; };   // near-grey: each tree's colour (and season) tints it
      if (kind === 'needle') {   // pine tufts
        for (let i = 0; i < 70; i++) { const cx = 20 + r() * (S - 40), cy = 20 + r() * (S - 40); for (let j = 0; j < 18; j++) { const a = r() * 6.28, l = 10 + r() * 18; g.strokeStyle = shade(1); g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke(); } }
      } else if (kind === 'fern') {   // one frond, bottom to top
        g.strokeStyle = shade(0.6); g.lineWidth = 3; g.beginPath(); g.moveTo(S / 2, S); g.quadraticCurveTo(S / 2 + 18, S / 2, S / 2, 6); g.stroke();
        for (let i = 0; i < 26; i++) { const t = i / 26, y = S - t * (S - 10), w = (1 - t) * 70 + 10; for (const sd of [-1, 1]) leaf(S / 2 + Math.sin(t * 2) * 10, y, w, 7, sd * (1.25 - t * 0.4), shade(1)); }
      } else if (kind === 'grass') {   // blades from the bottom
        for (let i = 0; i < 70; i++) { const x = 8 + r() * (S - 16), h = S * (0.4 + r() * 0.6), bend = (r() - 0.5) * 70, w = 5 + r() * 4; const grd = g.createLinearGradient(0, S, 0, S - h); grd.addColorStop(0, 'rgb(150,160,140)'); grd.addColorStop(1, `rgb(${235 + r() * 20},${245 + r() * 10},${225 + r() * 20})`); g.fillStyle = grd; g.beginPath(); g.moveTo(x - w, S); g.quadraticCurveTo(x + bend * 0.4, S - h * 0.5, x + bend, S - h); g.quadraticCurveTo(x + bend * 0.4 + 2, S - h * 0.5, x + w, S); g.fill(); }
      } else if (kind === 'reed') {
        for (let i = 0; i < 24; i++) { const x = 20 + r() * (S - 40), h = S * (0.6 + r() * 0.4); g.strokeStyle = `rgb(${120 + r() * 40},${140 + r() * 40},${70 + r() * 20})`; g.lineWidth = 3; g.beginPath(); g.moveTo(x, S); g.lineTo(x + (r() - 0.5) * 20, S - h); g.stroke(); if (r() < 0.4) { g.fillStyle = '#6b4a2b'; g.fillRect(x - 3 + (r() - 0.5) * 10, S - h + 4, 6, 22); } }
      } else {   // broad leaves (oak, maple, birch, bush), some with blossoms or berries
        const n = kind === 'birch' ? 260 : 180, L = kind === 'birch' ? 16 : kind === 'maple' ? 24 : 22, Wd = kind === 'birch' ? 6 : kind === 'maple' ? 11 : 9;
        for (let i = 0; i < n; i++) { const a = r() * 6.28, rad = Math.sqrt(r()) * (S * 0.44); leaf(S / 2 + Math.cos(a) * rad, S / 2 + Math.sin(a) * rad, L * (0.7 + r() * 0.5), Wd, r() * 6.28, shade(1)); }
        if (kind === 'blossom') for (let i = 0; i < 70; i++) { const x = 20 + r() * (S - 40), y = 20 + r() * (S - 40); g.fillStyle = r() < 0.5 ? '#ffd1e8' : '#ffffff'; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 4, y + Math.sin(p * 1.26) * 4, 3.2, 0, 7); g.fill(); } g.fillStyle = '#fbbf24'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
        if (kind === 'berry') for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.7 ? '#b3123a' : '#5b1a6b'; g.beginPath(); g.arc(20 + r() * (S - 40), 20 + r() * (S - 40), 4, 0, 7); g.fill(); }
      }
      const t = this.tex(T, c); t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
      return (cache['leaf' + kind] = t);
    },

    // ---------------------------------------------------------------- walls and roofs (colour + relief)
    surface(T, kind) {
      if (cache['s' + kind]) return cache['s' + kind];
      const S = 256, c = cv(S, S), hc = cv(S, S), g = c.getContext('2d'), gh = hc.getContext('2d'), r = rnd(kind.length * 13 + 5);
      gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
      const mottle = (n, a, light) => { for (let i = 0; i < n; i++) { g.fillStyle = (r() < 0.5) === light ? `rgba(255,250,240,${r() * a})` : `rgba(60,45,30,${r() * a})`; g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 14, 0, 7); g.fill(); } };
      if (kind === 'plaster' || kind === 'timber') {
        g.fillStyle = '#efe6d4'; g.fillRect(0, 0, S, S); mottle(260, 0.07, true);
        const grd = g.createLinearGradient(0, S * 0.7, 0, S); grd.addColorStop(0, 'rgba(80,60,40,0)'); grd.addColorStop(1, 'rgba(80,60,40,.25)'); g.fillStyle = grd; g.fillRect(0, 0, S, S);   // weathering low down
        for (let i = 0; i < 200; i++) { gh.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},0,0,.1)`; gh.fillRect(r() * S, r() * S, 3, 3); }
        if (kind === 'timber') {
          const beam = (x, y, w, h) => { g.fillStyle = '#4a2e18'; g.fillRect(x, y, w, h); for (let i = 0; i < (w > h ? w : h) / 3; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,80,45' : '25,14,6'},.35)`; if (w > h) g.fillRect(x + r() * w, y + r() * h, 6 + r() * 12, 1); else g.fillRect(x + r() * w, y + r() * h, 1, 6 + r() * 12); } gh.fillStyle = '#b0b0b0'; gh.fillRect(x, y, w, h); };
          beam(0, 0, S, 14); beam(0, S - 14, S, 14); beam(0, 0, 14, S); beam(S / 2 - 7, 0, 14, S);
          for (const [x0, x1] of [[14, S / 2 - 7], [S / 2 + 7, S]]) { g.save(); gh.save(); for (const ctx of [g, gh]) { ctx.beginPath(); ctx.rect(x0, 14, x1 - x0, S - 28); ctx.clip(); } g.strokeStyle = '#4a2e18'; gh.strokeStyle = '#b0b0b0'; g.lineWidth = gh.lineWidth = 12; for (const ctx of [g, gh]) { ctx.beginPath(); ctx.moveTo(x0, S - 14); ctx.lineTo(x1, 14); ctx.stroke(); } g.restore(); gh.restore(); }
        }
      } else if (kind === 'stone' || kind === 'darkstone') {
        const light = kind === 'stone'; g.fillStyle = light ? '#8d877c' : '#3d4048'; g.fillRect(0, 0, S, S); gh.fillStyle = '#404040'; gh.fillRect(0, 0, S, S);
        for (let row = 0; row < 8; row++) for (let i = 0; i < 5; i++) {
          const w = S / 4, x = i * w - (row % 2) * w / 2 + 2, y = row * 32 + 2, l = (light ? 62 : 30) + r() * 14;
          g.fillStyle = `hsl(${30 + r() * 14}, ${light ? 10 : 6}%, ${l}%)`; g.beginPath(); g.roundRect(x, y, w - 4, 28, 5); g.fill(); mottle(4, 0.08, true);
          const gr = gh.createRadialGradient(x + w / 2, y + 14, 2, x + w / 2, y + 14, w / 2); gr.addColorStop(0, '#e0e0e0'); gr.addColorStop(1, '#909090'); gh.fillStyle = gr; gh.beginPath(); gh.roundRect(x, y, w - 4, 28, 5); gh.fill();
        }
      } else if (kind === 'roof') {   // overlapping tiles: white, tinted per building
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); gh.fillStyle = '#000'; gh.fillRect(0, 0, S, S);
        for (let row = 0; row < 10; row++) for (let i = 0; i < 9; i++) {
          const w = S / 8, x = i * w - (row % 2) * w / 2, y = row * (S / 10), v = 0.78 + r() * 0.22;
          const gr = g.createLinearGradient(0, y, 0, y + S / 10); gr.addColorStop(0, `rgba(0,0,0,${0.32 * (1 - v + 0.2)})`); gr.addColorStop(0.25, `rgba(255,255,255,${v - 0.78})`); gr.addColorStop(1, 'rgba(0,0,0,.05)');
          g.fillStyle = `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`; g.beginPath(); g.roundRect(x + 1, y, w - 2, S / 10 + 2, [0, 0, 7, 7]); g.fill(); g.fillStyle = gr; g.fill();
          const hg = gh.createLinearGradient(0, y, 0, y + S / 10); hg.addColorStop(0, '#202020'); hg.addColorStop(1, '#e0e0e0'); gh.fillStyle = hg; gh.beginPath(); gh.roundRect(x + 1, y, w - 2, S / 10 + 2, [0, 0, 7, 7]); gh.fill();
        }
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,90,40,${r() * 0.18})`; g.beginPath(); g.arc(r() * S, r() * S, 3 + r() * 10, 0, 7); g.fill(); }   // a little moss
      }
      return (cache['s' + kind] = { map: this.tex(T, c), normalMap: this.normalFrom(T, hc, kind === 'roof' ? 4 : 2.5) });
    },
  };
})();
