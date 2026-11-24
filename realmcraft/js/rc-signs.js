// Signs you can read: shop signs painted with the shop's name and a picture, on both faces; the town noticeboard as a
// small roofed stand with notes pinned on both sides (different on each side); signposts with their words on the board.
// All the lettering is drawn on canvases here.
(function () {
  const RC = window.RC;
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const texOf = (T, c) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; };
  const wrap = (g, text, maxW) => { const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (g.measureText(tryL).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryL; } if (cur) lines.push(cur); return lines; };
  const fit = (g, text, maxW, size, font) => { let s = size; do { g.font = `${s}px ${font}`; s -= 2; } while (g.measureText(text).width > maxW && s > 10); return s + 2; };
  const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive", SERIF = "Georgia, 'Times New Roman', serif";
  const ICON = { smithery_foundry: '⚒', grand_guildhall: '🛡', observatory_parlor: '🔮', two_story_timber: '⚔', l_wing_inn: '🛏', one_story_cottage: '📦', longhouse_tavern: '🍺', apothecary_conservatory: '🌿' };
  const ICONBYNAME = [[/LIBRARY/i, '📖'], [/HARBOR|HARBOUR/i, '⚓'], [/FORTUNE|PARLOR/i, '🔮'], [/INN/i, '🛏'], [/ANCHOR|TAVERN/i, '🍺'], [/HERB/i, '🌿'], [/ARMOR|ARMOUR/i, '⚔'], [/SMITH/i, '⚒'], [/GUILD/i, '🛡'], [/WAREHOUSE/i, '📦']];
  const nice = (s) => String(s).toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/’S\b/g, '’s');

  // wood grain behind painted letters
  const woodBack = (g, w, h, base, seed) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) { const y = r() * h; g.strokeStyle = `rgba(${r() < 0.5 ? '40,24,10' : '255,230,190'},${0.05 + r() * 0.08})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 40) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 4 * r()); g.stroke(); }
    const gr = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,10,0,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  };

  RC.Signs = {
    // the shop's board: its name in gilt serif letters with a picture, a painted border, weathered
    shopTexture(T, name, style, seed) {
      const W = 768, H = 512, c = cv(W, H), g = c.getContext('2d');
      const bases = ['#2a3f5a', '#5a2a24', '#2f4a32', '#3a2e4a', '#4a3a22'], base = bases[Math.floor(RC.hash(seed, 1, 3) * bases.length)];
      woodBack(g, W, H, base, Math.floor(seed * 1e5) + 7);
      g.strokeStyle = '#d8b458'; g.lineWidth = 10; g.strokeRect(22, 22, W - 44, H - 44); g.lineWidth = 3; g.strokeRect(40, 40, W - 80, H - 80);
      const icon = (ICONBYNAME.find(([re]) => re.test(name)) || [0, ICON[style] || '✦'])[1];
      g.save(); g.filter = 'sepia(1) saturate(2.2) brightness(1.05)'; g.font = `150px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, W / 2, H * 0.36); g.restore();
      const words = nice(name).replace(/^The /, 'The ').split(' '), half = Math.ceil(words.length / 2), lines = words.length > 2 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [words.join(' ')];
      g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((ln, i) => { const s = fit(g, ln, W - 120, lines.length > 1 ? 70 : 84, `bold ${SERIF}`); g.font = `bold ${s}px ${SERIF}`; const y = H * (lines.length > 1 ? 0.66 + i * 0.16 : 0.74);
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(ln, W / 2 + 3, y + 3); g.fillStyle = '#e8c868'; g.fillText(ln, W / 2, y); });
      // weathering: paint flaked here and there
      for (let i = 0; i < 160; i++) { const x = RC.hash(i, seed, 5) * W, y = RC.hash(seed, i, 6) * H; g.fillStyle = `rgba(30,20,10,${0.1 + RC.hash(i, i, 7) * 0.25})`; g.fillRect(x, y, 2 + RC.hash(i, 3, 8) * 10, 1 + RC.hash(i, 4, 9) * 4); }
      return texOf(T, c);
    },
    // a board w × h (metres) with the same picture on both broad faces (each reads the right way round), plain edges
    board(T, tex, w, h, thick, edgeMat) {
      const face = new T.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      const m = new T.Mesh(new T.BoxGeometry(thick, h, w), [face, face, edgeMat, edgeMat, edgeMat, edgeMat]); m.castShadow = true; return m;
    },
    // notes pinned on cork: a title on a painted header, then each line as its own slip of paper, slightly crooked
    notesTexture(T, title, notes, seed) {
      const W = 1280, H = 800, c = cv(W, H), g = c.getContext('2d');
      g.fillStyle = '#8a6440'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${RC.hash(i, seed, 1) < 0.5 ? '60,36,16' : '200,160,110'},0.25)`; g.fillRect(RC.hash(i, 2, seed) * W, RC.hash(seed, i, 3) * H, 3, 3); }   // cork
      g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, W, 110); g.fillStyle = '#e8d8a8'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const ts = fit(g, title, W - 80, 64, `bold ${SERIF}`); g.font = `bold ${ts}px ${SERIF}`; g.fillText(title, W / 2, 58);
      const n = notes.length, cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), cw = (W - 60) / cols, ch = (H - 150) / rows;
      notes.forEach((text, i) => {
        const col = i % cols, row = Math.floor(i / cols), x = 30 + col * cw + 14, y = 130 + row * ch + 10, w = cw - 28, h = ch - 22, a = (RC.hash(i, seed, 11) - 0.5) * 0.06;
        g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(a);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
        g.fillStyle = ['#f4ecd6', '#efe4c4', '#f6f0e2', '#e9dcc0'][i % 4]; g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle = '#b03030'; g.beginPath(); g.arc(0, -h / 2 + 14, 9, 0, 6.28); g.fill();   // the pin
        g.fillStyle = '#2a2018'; g.textAlign = 'left'; g.textBaseline = 'top';
        let fs = 34, lines; do { g.font = `${fs}px ${HAND}`; lines = wrap(g, text, w - 36); fs -= 2; } while (lines.length * fs * 1.25 > h - 44 && fs > 14);
        lines.forEach((ln, k) => g.fillText(ln, -w / 2 + 18, -h / 2 + 30 + k * (fs + 2) * 1.25));
        g.restore();
      });
      return texOf(T, c);
    },
    // the noticeboard stand: two stout posts, a double-sided board (notes on each side), a little shingled roof over it
    kiosk(T, t, other, M) {
      const g = new T.Group(), wood = M('#6a4a2c'), dark = M('#4a3220'), BW = 2.1, BH = 1.3, Y0 = 0.75;
      const front = RC.Signs.notesTexture(T, t.title || 'NOTICES', t.lines || [], RC.hash(t.x, t.z, 1)), back = RC.Signs.notesTexture(T, other.title, other.lines, RC.hash(t.z, t.x, 2));
      const fm = new T.MeshStandardMaterial({ map: front, roughness: 0.9 }), bm = new T.MeshStandardMaterial({ map: back, roughness: 0.9 });
      const brd = new T.Mesh(new T.BoxGeometry(BW, BH, 0.08), [wood, wood, wood, wood, fm, bm]); brd.position.y = Y0 + BH / 2; g.add(brd);
      const frame = (w, h, x, y) => { const f = new T.Mesh(new T.BoxGeometry(w, h, 0.14), dark); f.position.set(x, y, 0); g.add(f); };
      frame(BW + 0.16, 0.1, 0, Y0 - 0.02); frame(BW + 0.16, 0.1, 0, Y0 + BH + 0.05);
      for (const s of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(0.14, 2.7, 0.14), dark); p.position.set(s * (BW / 2 + 0.12), 1.35, 0); g.add(p); }
      // roof: two shingled slopes, eaves well out over both faces so readers stand in the dry
      const shingle = RC.Signs.shingles(T), rw = BW + 0.7;
      for (const s of [-1, 1]) { const sl = new T.Mesh(new T.BoxGeometry(rw, 0.05, 0.95), new T.MeshStandardMaterial({ map: shingle, roughness: 0.9 })); sl.rotation.x = s * 0.55; sl.position.set(0, 2.82, s * 0.4); sl.castShadow = true; g.add(sl); }
      const ridge = new T.Mesh(new T.BoxGeometry(rw + 0.04, 0.08, 0.12), dark); ridge.position.y = 3.06; g.add(ridge);
      for (const s of [-1, 1]) { const kn = new T.Mesh(new T.BoxGeometry(0.08, 0.08, 0.7), dark); kn.position.set(s * (BW / 2 + 0.12), 2.6, 0); g.add(kn); }
      const step = new T.Mesh(RC.roughBox ? RC.roughBox(T, BW + 1, 0.1, 2.2, 0.03, Math.random) : new T.BoxGeometry(BW + 1, 0.1, 2.2), M('#8a8478')); step.position.y = 0.0; g.add(step);   // a flagstone to stand on
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g;
    },
    shingles(T) {
      if (RC.Signs._sh) return RC.Signs._sh;
      const c = cv(256, 256), g = c.getContext('2d'); g.fillStyle = '#5a4a3a'; g.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 8; r++) for (let k = 0; k < 6; k++) { const x = k * 44 + (r % 2) * 22 - 10, y = r * 32, v = 70 + Math.floor(Math.random() * 40); g.fillStyle = `rgb(${v + 20},${v + 8},${v - 10})`; g.fillRect(x + 2, y + 2, 40, 30); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 2, y + 28, 40, 4); }
      const t = texOf(T, c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 1.2); return (RC.Signs._sh = t);
    },
    // a signpost: a stout post, the board with its title and lines (both faces), a little cap
    post(T, t, M) {
      const g = new T.Group(), dark = M('#5a3e26');
      const W = 1024, H = 560, c = cv(W, H), x = c.getContext('2d'); woodBack(x, W, H, '#b08a5a', Math.floor(RC.hash(t.x, t.z, 4) * 1e5) + 3);
      x.fillStyle = '#2a1a0c'; x.textAlign = 'center'; x.textBaseline = 'top'; const ts = fit(x, nice(t.title || ''), W - 60, 58, `bold ${SERIF}`); x.font = `bold ${ts}px ${SERIF}`; x.fillText(nice(t.title || ''), W / 2, 26);
      x.textAlign = 'left'; let y = 110; for (const line of t.lines || []) { let fs = 34, ls; do { x.font = `${fs}px ${SERIF}`; ls = wrap(x, line, W - 80); fs -= 2; } while (y + ls.length * fs * 1.3 > H - 20 && fs > 16); for (const l of ls) { x.fillText(l, 40, y); y += (fs + 2) * 1.3; } y += 10; }
      const tex = texOf(T, c), fm = new T.MeshStandardMaterial({ map: tex, roughness: 0.85 });
      const b = new T.Mesh(new T.BoxGeometry(1.5, 0.82, 0.06), [dark, dark, dark, dark, fm, fm]); b.position.y = 1.35; g.add(b);
      const cap = new T.Mesh(new T.BoxGeometry(1.66, 0.06, 0.24), dark); cap.position.y = 1.8; g.add(cap);
      for (const s of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(0.1, 1.85, 0.1), dark); p.position.set(s * 0.72, 0.92, 0); g.add(p); }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g;
    },
  };
})();
