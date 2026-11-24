// The HUD, in HTML over the 3D: character card, minimap, view and clock panels, compass with wind,
// name labels (the nearest few only, never stacked on top of each other), the prompt, the dialogue box.
(function () {
  const RC = window.RC, el = RC.el;
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dirOf = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

  RC.Hud = class {
    constructor(host, sim, view) {
      this.sim = sim; this.view = view; const pl = sim.player;
      this.root = el('div', { class: 'hud' });
      this.card = el('div', { class: 'panel card' }, el('div', { class: 'avatar' }, pl.def.name[0]), el('div', { class: 'who' }, el('b', null, pl.def.name), el('small', null, pl.def.title || ''), this.cardLine = el('div', { class: 'line' })));
      this.mapCv = el('canvas', { width: sim.realm.w * 2, height: sim.realm.h * 2, class: 'minimap' });
      this.viewP = el('div', { class: 'panel small' }); this.clockP = el('div', { class: 'panel small' });
      this.compass = el('canvas', { width: 180, height: 180, class: 'compass' }); this.compassText = el('div', { class: 'ctext' });
      this.right = el('div', { class: 'right' }, el('div', { class: 'panel mapbox' }, el('div', { class: 'title' }, sim.realm.name), this.mapCv), this.viewP, this.clockP, el('div', { class: 'panel cbox' }, this.compass, this.compassText));
      this.labelBox = el('div', { class: 'labels' }); this.prompt = el('div', { class: 'prompt' }); this.toast = el('div', { class: 'toast' });
      this.dlg = el('div', { class: 'dialogue' }, this.dlgName = el('div', { class: 'name' }), this.dlgText = el('div', { class: 'text' }), el('div', { class: 'more' }, '[SPACE] CONTINUE ▼'));
      this.help = el('div', { class: 'help' }, 'WASD move · Shift run · Space talk / use · Q E turn 90° · drag to turn and tilt (PgUp PgDn) · wheel or [ ] zoom · V view · R north · T +3 hours · G sky');
      this.root.append(this.labelBox, this.card, this.right, this.prompt, this.toast, this.dlg, this.help); host.append(this.root);
      this.labelPool = []; this.mapBase = this.makeMapBase();
    }
    makeMapBase() {
      const s = this.sim, cv = document.createElement('canvas'); cv.width = s.realm.w * 2; cv.height = s.realm.h * 2; const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false; g.drawImage(s.terrain.mapPicture(), 0, 0, cv.width, cv.height);
      const roof = { crimson: '#e04848', cobalt: '#4f7be0', terracotta: '#e07a48', emerald: '#3fbf7a' };
      for (const b of s.realm.things) if (b.kind === 'building') { g.fillStyle = roof[b.roof] || '#ddd'; g.fillRect(b.x * 2, (b.z + 0.5) * 2, b.w * 2, (b.d - 0.8) * 2); }
      return cv;
    }
    draw() {
      const s = this.sim, v = this.view, pl = s.player, now = s.calendar.now();
      // card
      const bagN = Object.values(pl.bag).reduce((a, b) => a + b, 0);
      this.cardLine.textContent = `${pl.gold} G · bag ${bagN}`;
      // minimap
      const g = this.mapCv.getContext('2d'); g.drawImage(this.mapBase, 0, 0);
      for (const p of s.people) if (!p.hidden) { g.fillStyle = p.def.role === 'important' ? '#fde047' : '#ffffff'; g.fillRect(p.x * 2 - 1, p.z * 2 - 1, 3, 3); }
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(pl.x * 2, pl.z * 2, 3.5, 0, 7); g.fill();
      const look = -s.yaw; g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(pl.x * 2, pl.z * 2); g.lineTo(pl.x * 2 + Math.sin(look) * 14, pl.z * 2 - Math.cos(look) * 14); g.stroke();
      // view and clock panels
      const deg = Math.round(((((-s.yaw) * 180) / Math.PI) % 360 + 360) % 360) % 360;
      this.viewP.innerHTML = `<b>LOOK ${dirOf(deg)} · ${RC.VIEWS[s.viewMode].label}${s.zoom !== 1 ? ' ' + Math.round(s.zoom * 100) + '%' : ''}</b><small>[Q/E] ↺90° · drag turn/tilt · [V] VIEW · [R] RESET</small>`;
      this.clockP.innerHTML = `<b>${now.weekdayName.slice(0, 3).toUpperCase()} · DAY ${now.dayNumber}<span>${s.calendar.clock()}</span></b><small>${now.season.toUpperCase()} · ${now.day} ${now.monthName} · YR ${now.year}${now.market ? ' · MARKET' : ''}</small><small>${(s.weatherWord ? s.weatherWord() : s.weather).toUpperCase()} · [T]+3H · [G] SKY</small>`;
      // compass: gold = where you look, blue = the wind
      const c = this.compass.getContext('2d'), R = 70; c.clearRect(0, 0, 180, 180); c.save(); c.translate(90, 90);
      c.strokeStyle = 'rgba(148,197,255,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke();
      c.fillStyle = '#cfe3ff'; c.font = 'bold 15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => { const r = (a * Math.PI) / 180; c.fillText(t, Math.sin(r) * (R - 14), -Math.cos(r) * (R - 14)); });
      const arrow = (a, len, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * len, -Math.cos(a) * len); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(Math.sin(a) * len, -Math.cos(a) * len, w, 0, 7); c.fill(); };
      arrow((deg * Math.PI) / 180, R - 26, '#facc15', 4);
      const windTo = Math.atan2(Math.cos(s.wind.dir), -Math.sin(s.wind.dir)); arrow(windTo, R - 34, '#60a5fa', 3);
      c.restore();
      const windFrom = Math.round(((((windTo * 180) / Math.PI) + 180) % 360 + 360) % 360);
      this.compassText.innerHTML = `<small>LOOKING</small><b>${dirOf(deg)} ${deg}°</b><small>WIND</small><b>${dirOf(windFrom)} ${Math.round(s.wind.speed)}KT</b>`;
      // labels: the nearest few, no overlaps
      const items = [];
      const near = s.viewMode === 'map' ? 999 : 16 * s.zoom * (s.viewMode === 'wide' ? 1.6 : s.viewMode === 'close' ? 0.7 : 1);
      for (const L of v.labels) { const d = Math.hypot(L.x - pl.x, L.z - pl.z); if (d < near * 1.6) items.push({ text: L.text, x: L.x, y: L.y, z: L.z, d: d * 0.8, kind: L.kind }); }
      if (s.viewMode !== 'map') for (const p of s.people) { if (p.hidden) continue; const d = Math.hypot(p.x - pl.x, p.z - pl.z); if (d < near) items.push({ text: p.def.name, sub: p.doing || (p.working ? '' : ''), x: p.x, y: s.terrain.groundY(p.x, p.z) + 1.95 * (RC.Cast.AGE[p.def.age] || RC.Cast.AGE.adult).s + 0.2, z: p.z, d, kind: p.def.role === 'important' ? 'important' : 'person' }); }
      items.sort((a, b) => a.d - b.d);
      const placed = [], max = s.dialogue ? 0 : 12; let n = 0;
      for (const it of items) {
        if (n >= max) break; if (s.target && s.target.name === it.text) continue;
        const p = v.project(it.x, it.y, it.z); if (!p.front) continue;
        const w = it.text.length * 7.2 + 18, h = it.sub ? 34 : 20, r = { x: p.x - w / 2, y: p.y - h, w, h };
        if (placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y)) continue;
        placed.push(r);
        const e = this.labelPool[n] || (this.labelPool[n] = this.labelBox.appendChild(el('div', { class: 'label' })));
        e.className = 'label ' + it.kind; e.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`; e.style.display = '';
        const html = it.text + (it.sub ? `<i>${it.sub}</i>` : ''); if (e._h !== html) { e.innerHTML = html; e._h = html; }
        n++;
      }
      for (let i = n; i < this.labelPool.length; i++) this.labelPool[i].style.display = 'none';
      // prompt over what's in reach
      const t = s.target;
      if (t && !s.dialogue) { const p = v.project(t.x, s.terrain.groundY(t.x, t.z) + 2.3, t.z); this.prompt.style.display = ''; this.prompt.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`; this.prompt.textContent = `[SPACE] ${t.verb.toUpperCase()} · ${t.name}`; }
      else this.prompt.style.display = 'none';
      // dialogue
      if (s.dialogue) { this.dlg.style.display = ''; this.dlgName.textContent = s.dialogue.name; this.dlgText.textContent = s.dialogue.lines[s.dialogue.i] || ''; }
      else this.dlg.style.display = 'none';
      // toast
      if (s.toast) { this.toast.style.display = ''; this.toast.textContent = s.toast.text; this.toast.style.opacity = Math.min(1, s.toast.t * 2); } else this.toast.style.display = 'none';
    }
  };
})();
