// RealmCraft core: the namespace, small helpers, input, and the loop.
// The game's logic (the "sim") steps on its own clock; drawing reads it. Kept apart from day one,
// so co-op, online play and a server world can run the same logic later.
(function () {
  const RC = (window.RC = window.RC || {});
  RC.version = '0.1';

  // ---------------------------------------------------------------- helpers
  RC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RC.lerp = (a, b, t) => a + (b - a) * t;
  RC.smooth01 = (v) => { v = RC.clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  RC.damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
  RC.wrapAngle = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  RC.dampAngle = (a, b, rate, dt) => a + RC.wrapAngle(b - a) * (1 - Math.exp(-rate * dt));
  RC.hash = (x, y, seed = 1) => { let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  RC.rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), s | 1); s ^= s + Math.imul(s ^ (s >>> 7), s | 61); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; }; };
  // smooth value noise (0..1) and fractal noise: several octaves, each finer and fainter (natural-looking patches with ragged edges)
  RC.vnoise = (x, z, s, seed = 1) => { const X = x / s, Z = z / s, x0 = Math.floor(X), z0 = Math.floor(Z), fx = RC.smooth01(X - x0), fz = RC.smooth01(Z - z0), h = (a, b) => RC.hash(a, b, seed);
    return RC.lerp(RC.lerp(h(x0, z0), h(x0 + 1, z0), fx), RC.lerp(h(x0, z0 + 1), h(x0 + 1, z0 + 1), fx), fz); };
  RC.fbm = (x, z, s, oct = 4, seed = 1) => { let v = 0, a = 0.5, tot = 0; for (let i = 0; i < oct; i++) { v += RC.vnoise(x, z, s, seed + i * 17) * a; tot += a; s *= 0.5; a *= 0.5; } return v / tot; };
  RC.el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'style' && typeof v === 'object') Object.assign(e.style, v); else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v); }
    for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };

  // the ambient-occlusion pass draws everything as solid; leaf and grass cards are see-through, so leave them out of it
  RC.aoSkipCutouts = (pass) => {
    const base = pass._overrideVisibility.bind(pass);
    pass._overrideVisibility = function () { base(); const cache = this._visibilityCache; this.scene.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible && o.material && (o.material.alphaTest > 0 || o.material.transparent)) { o.visible = false; cache.push(o); } }); };
    return pass;
  };

  // ---------------------------------------------------------------- events
  const subs = {};
  RC.on = (name, fn) => (subs[name] = subs[name] || []).push(fn);
  RC.emit = (name, data) => (subs[name] || []).forEach((fn) => fn(data));

  // ---------------------------------------------------------------- input: keyboard, mouse drag to turn, wheel to zoom
  const keys = new Set(), pressed = new Set();
  RC.input = {
    down: (k) => keys.has(k),
    hit: (k) => pressed.has(k),   // pressed since the last step
    dragYaw: 0, dragTilt: 0, wheel: 0,
  };
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => keys.clear());
  RC.bindPointer = (canvas) => {
    let drag = null;
    let dragY = 0;
    canvas.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.button === 2) { drag = e.clientX; dragY = e.clientY; canvas.setPointerCapture(e.pointerId); } });
    canvas.addEventListener('pointermove', (e) => { if (drag != null) { RC.input.dragYaw += (e.clientX - drag) * 0.008; RC.input.dragTilt += (e.clientY - dragY) * 0.006; drag = e.clientX; dragY = e.clientY; } });   // left-right turns, up-down tilts
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { RC.input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  };

  // ---------------------------------------------------------------- the loop: the sim in fixed steps, then one drawing
  const STEP = 1 / 60;
  RC.start = (sim, draw) => {
    let acc = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now; acc += dt;
      while (acc >= STEP) { sim(STEP); pressed.clear(); RC.input.dragYaw = 0; RC.input.dragTilt = 0; RC.input.wheel = 0; acc -= STEP; }
      draw(dt, now / 1000);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
})();
