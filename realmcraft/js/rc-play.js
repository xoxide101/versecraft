// The sim: one realm's state and rules, stepped on a fixed clock. No drawing in here.
// Walking (relative to the camera), bumping into things, talking, searching, opening, gathering,
// time, weather and wind, the camera's settings (turn, view, zoom).
(function () {
  const RC = window.RC;
  const WEATHER = ['clear', 'breezy', 'rain', 'storm', 'snow'];
  const VIEW_ORDER = ['close', 'evo', 'wide', 'map'];

  RC.Sim = class {
    constructor(realm) {
      this.realm = realm;
      this.calendar = new RC.Calendar(realm.calendar);
      this.terrain = new RC.Terrain(realm.terrain, realm.w, realm.h);
      if (RC.Mushrooms && !realm._mushrooms) { realm._mushrooms = true; realm.things.push(...RC.Mushrooms.spots(realm, this.terrain)); }   // mushrooms grow where the land suits them
      this.plan = RC.MapCraft.plan(realm, this.terrain);
      this.people = realm.people.map((d) => RC.Cast.person(d));
      this.players = realm.players.slice(0, 4).map((d) => Object.assign(RC.Cast.person(Object.assign({ age: 'adult', job: 'hero' }, d)), { isPlayer: true, gold: 220, bag: {} }));
      this.doors = this.plan.usable.filter((u) => u.kind === 'door');
      this.weather = 'breezy'; this.weatherT = 90; this.wind = { dir: 0.8, target: 0.8, speed: 13, t: 30 }; this.flash = 0; this.flashT = 5; this.shake = 0;
      this.yaw = 0; this.yawTarget = 0; this.viewMode = 'evo'; this.zoom = 1;
      this.dialogue = null; this.target = null; this.toast = null; this.lying = { wet: 0, snow: 0 };   // rain and snow lying about
      // weather never just switches: clouds gather first, rain builds from a drizzle, comes and goes in waves (heavier, lighter), then eases off
      this.cloud = 0; this.precipBase = 0; this.precip = 0; this.snowfall = 0; this.wxClock = Math.random() * 500;
    }
    get player() { return this.players[0]; }
    say(text, secs = 3) { this.toast = { text, t: secs }; }

    step(dt) {
      const I = RC.input, pl = this.player;
      // ---- camera settings: Q/E turn 90°, drag turns freely, R back to north, V the four views, wheel zooms
      if (I.hit('q')) this.yawTarget += Math.PI / 2; if (I.hit('e')) this.yawTarget -= Math.PI / 2;
      if (I.dragYaw) { this.yaw -= I.dragYaw; this.yawTarget = this.yaw; }
      if (I.hit('r')) { this.yawTarget = Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2; this.tilt = 0; }
      // tilt: drag up and down, or Page Up / Page Down (down to ground level, up to looking straight down)
      this.tilt = RC.clamp((this.tilt || 0) + I.dragTilt + (I.down('PageUp') ? -0.9 * dt : 0) + (I.down('PageDown') ? 0.9 * dt : 0), -0.62, 0.8);
      this.yaw = RC.damp(this.yaw, this.yawTarget, 8, dt);
      if (I.hit('v')) { this.viewMode = VIEW_ORDER[(VIEW_ORDER.indexOf(this.viewMode) + 1) % VIEW_ORDER.length]; this.zoom = 1; this.say('View · ' + RC.VIEWS[this.viewMode].label, 1.6); }
      if (I.wheel) this.zoom = RC.clamp(this.zoom * (1 + I.wheel * 0.12), 0.1, 3);   // close enough to look at a leaf, far enough to see the town ([ ] keys too)
      if (I.hit('[')) this.zoom = RC.clamp(this.zoom * 0.8, 0.1, 3); if (I.hit(']')) this.zoom = RC.clamp(this.zoom * 1.25, 0.1, 3);
      // ---- time and weather keys: T moves time on 3 hours, G changes the sky
      if (I.hit('t')) { this.calendar.add(3); const n = this.calendar.now(); this.say(`${n.weekdayName} · ${this.calendar.clock()} (${n.period})`, 2); }
      if (I.hit('g')) { this.setWeather(WEATHER[(WEATHER.indexOf(this.weather) + 1) % WEATHER.length]); }
      this.calendar.step(dt); this.stepWeather(dt); RC.weatherStep(this.lying, this, dt);
      if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
      this.shake = Math.max(0, this.shake - dt * 2);
      // ---- talking: Space moves on, Esc stops
      if (this.dialogue) {
        if (I.hit(' ') || I.hit('Enter')) { this.dialogue.i++; if (this.dialogue.i >= this.dialogue.lines.length) this.endTalk(); }
        if (I.hit('Escape')) this.endTalk();
        pl.moving = RC.damp(pl.moving, 0, 10, dt);
      } else this.stepPlayer(dt, pl);
      const now = this.calendar.now(), ctx = { time: now, weather: this.weather, player: pl, doors: this.doors, talkingTo: this.dialogue && this.dialogue.who && this.dialogue.who.def ? this.dialogue.who : null };
      // detail rings: near people every step, further ones less often (with the time they missed)
      this.tick = (this.tick || 0) + 1; const R = RC.quality.rings;
      for (const p of this.people) {
        const d = Math.hypot(p.x - pl.x, p.z - pl.z), every = d < R.near ? 1 : d < R.mid ? 3 : 8;
        p.ring = every === 1 ? 'near' : every === 3 ? 'mid' : 'far';
        if ((this.tick + p.def.id.length) % every === 0) RC.Cast.step(p, dt * every, ctx);
      }
    }

    stepPlayer(dt, pl) {
      const I = RC.input; let fx = 0, fz = 0;
      const fwd = [-Math.sin(this.yaw), -Math.cos(this.yaw)], right = [Math.cos(this.yaw), -Math.sin(this.yaw)];
      if (I.down('w') || I.down('ArrowUp')) { fx += fwd[0]; fz += fwd[1]; } if (I.down('s') || I.down('ArrowDown')) { fx -= fwd[0]; fz -= fwd[1]; }
      if (I.down('d') || I.down('ArrowRight')) { fx += right[0]; fz += right[1]; } if (I.down('a') || I.down('ArrowLeft')) { fx -= right[0]; fz -= right[1]; }
      const len = Math.hypot(fx, fz);
      if (len > 0) {
        const sp = (I.down('Shift') ? 7.2 : 4.4) * dt; fx /= len; fz /= len;
        const nx = pl.x + fx * sp, nz = pl.z + fz * sp;
        if (this.free(nx, pl.z)) pl.x = nx; if (this.free(pl.x, nz)) pl.z = nz;
        pl.angle = RC.dampAngle(pl.angle, Math.atan2(fz, fx), 12, dt); pl.moving = RC.damp(pl.moving, I.down('Shift') ? 1.3 : 1, 10, dt);
      } else pl.moving = RC.damp(pl.moving, 0, 10, dt);
      pl.phase += dt * 9 * pl.moving;
      // what's in reach, and Space to use it
      this.target = this.nearest(pl);
      if (this.target && (I.hit(' ') || I.hit('Enter'))) this.use(this.target);
    }
    free(x, z) {
      const R = 0.28, W = this.realm.w, b = this.plan.blocked;
      for (const [dx, dz] of [[-R, -R], [R, -R], [-R, R], [R, R]]) { const c = Math.floor(x + dx), r = Math.floor(z + dz); if (c < 0 || r < 0 || c >= W || r >= this.realm.h || b[r * W + c]) return false; }
      for (const k of this.plan.circles) if (Math.hypot(k.x - x, k.z - z) < k.r + R) return false;
      return true;
    }
    nearest(pl) {
      let best = null, bd = 1e9;
      for (const p of this.people) { if (p.hidden) continue; const d = Math.hypot(p.x - pl.x, p.z - pl.z); if (d < 1.7 && d < bd) { bd = d; best = { kind: 'person', who: p, verb: 'Talk', name: p.def.name, x: p.x, z: p.z }; } }
      for (const u of this.plan.usable) { if (u.thing.done && (u.kind === 'shrub' || u.kind === 'chest' || u.kind === 'forage')) continue; const d = Math.hypot(u.x - pl.x, u.z - pl.z) - (RC.MapCraft.SOLID[u.kind] || 0); if (d < 1.4 && d < bd) { bd = d; best = u; } }
      return best;
    }
    use(u) {
      const pl = this.player, t = u.thing;
      if (u.kind === 'person') { const p = u.who; this.dialogue = { who: p, name: p.def.name, lines: p.def.says.slice(0, p.talkedOnce && p.def.says.length > 1 ? 2 : 1).slice(p.talkedOnce && p.def.says.length > 1 ? 1 : 0), i: 0 }; p.talkedOnce = true; return; }
      if (u.kind === 'door') { this.say(`${t.name}: the doors open in a later step (interiors).`, 3); return; }
      if (u.kind === 'gate') { this.say(`${t.label}: the land beyond comes in a later step.`, 3); return; }
      if (u.kind === 'shrub') {
        t.done = true; if (t._obj) t._obj.rotation.z = 0.15;
        const h = t.hidden;
        if (h === 'gold') { pl.gold += t.amount || 10; this.say(`Found ${t.amount || 10} gold in the shrub.`); }
        else if (h === 'herb' || h === 'seed' || h === 'quest_item') { const n = t.reward || (h === 'seed' ? 'Seeds' : 'Herb'); pl.bag[n] = (pl.bag[n] || 0) + (t.amount || 1); this.say(`Found ${n}.`); }
        else if (h === 'clue') this.dialogue = { who: { x: t.x, z: t.z }, name: 'A CLUE IN THE LEAVES', lines: [t.clue || 'Something was hidden here once.'], i: 0 };
        else if (h === 'slime') { this.shake = 0.6; this.say('A slime jumps out and wobbles away!'); }
        else this.say('Just leaves and a startled beetle.');
        return;
      }
      if (u.kind === 'chest') { t.done = true; if (t._obj) { const lid = t._obj.getObjectByName('lid'); if (lid) { lid.rotation.x = -1.2; lid.position.z -= 0.15; lid.position.y += 0.15; } } if (/gold/i.test(t.reward)) pl.gold += t.amount || 50; else pl.bag[t.reward] = (pl.bag[t.reward] || 0) + 1; this.say(`The chest holds: ${t.reward}${t.amount ? ' ×' + t.amount : ''}.`); return; }
      if (u.kind === 'forage') { t.done = true; if (t._obj) { if (t.node === 'mushroom') t._obj.visible = false; else t._obj.scale.setScalar(0.5); } pl.bag[t.name] = (pl.bag[t.name] || 0) + (t.amount || 1); this.say(`Gathered ${t.name} ×${t.amount || 1}${t.use ? ' (' + t.use + ')' : ''}.`); return; }
      if (u.kind === 'station') { this.dialogue = { who: { x: t.x, z: t.z }, name: t.title, lines: [t.subtitle, 'Crafting here comes in a later step: what you gather goes in your bag for now.'], i: 0 }; return; }
      if (u.kind === 'bell') { this.shake = 0.3; this.say('DONG… the bell rings out over the harbor.'); return; }
      this.dialogue = { who: { x: t.x, z: t.z }, name: t.title || u.name, lines: t.lines && t.lines.length ? t.lines : ['Nothing more to see.'], i: 0 };
    }
    endTalk() { this.dialogue = null; }

    setWeather(w) { this.weather = w; this.weatherT = 70 + Math.random() * 55; if (w === 'storm') { this.flash = 0.85; this.flashT = 4.5; } this.say('Weather · ' + w.toUpperCase(), 1.6); }
    // the weather in words, with how hard it is coming down (for the clock box)
    weatherWord() { const p = this.precip, s = this.snowfall;
      if (p > 0.03) return (p < 0.15 ? 'drizzle' : p < 0.35 ? 'light rain' : p < 0.6 ? 'rain' : p < 0.82 ? 'heavy rain' : 'downpour') + (this.weather === 'storm' ? ' · storm' : '');
      if (s > 0.03) return s < 0.35 ? 'light snow' : s < 0.7 ? 'snow' : 'heavy snow';
      return this.cloud > 0.35 ? (this.weather === 'clear' || this.weather === 'breezy' ? 'clearing' : 'clouding over') : this.weather; }
    stepWeather(dt) {
      if ((this.weatherT -= dt) <= 0) {   // the next weather grows out of this one (clear → breezy → rain → storm and back down), not a jump
        const NEXT = { clear: [['clear', 2], ['breezy', 3]], breezy: [['clear', 3], ['breezy', 1], ['rain', 2.2], ['snow', 0.4]], rain: [['rain', 1.4], ['breezy', 2], ['storm', 1]], storm: [['rain', 1]], snow: [['snow', 1], ['breezy', 1.5]] }[this.weather];
        let r = Math.random() * NEXT.reduce((s, x) => s + x[1], 0), w = NEXT[0][0]; for (const [k, p] of NEXT) { if ((r -= p) <= 0) { w = k; break; } }
        if (w === this.weather) this.weatherT = 60 + Math.random() * 60; else this.setWeather(w); this.wind.target += (Math.random() - 0.5) * 1.6; }
      // amounts: clouds come quickest, rain or snow follows them in and out (half a minute or so), and rides on slow waves and quicker bursts
      const c = (this.wxClock += dt), wv = this.weather, wave = RC.clamp(0.5 + Math.sin(c / 41) * 0.28 + Math.sin(c / 13.7 + 1.3) * 0.16 + Math.sin(c / 5.3 + 4.1) * 0.09 + Math.sin(c / 2.1) * 0.04, 0, 1);
      this.cloud = RC.damp(this.cloud, { clear: 0, breezy: 0.12, rain: 0.5, storm: 0.72, snow: 0.42 }[wv] || 0, 0.035, dt);
      this.precipBase = RC.damp(this.precipBase, { rain: 0.6, storm: 1 }[wv] || 0, 0.02, dt);
      this.precip = this.precipBase * (0.3 + wave * 0.85); this.snowfall = RC.damp(this.snowfall, wv === 'snow' ? 0.4 + wave * 0.6 : 0, 0.025, dt);
      this.gust = 0.75 + wave * 0.5;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.4);
      if (this.weather === 'storm' && this.precip > 0.55 && (this.flashT -= dt) <= 0) { this.flash = 0.92; this.flashT = 5.5 + Math.random() * 7.5; this.shake = 0.14; }
      const w = this.wind; if ((w.t -= dt) <= 0) { w.t = 28 + Math.random() * 24; w.target += (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.6); }
      w.dir = RC.dampAngle(w.dir, w.target, 0.6, dt);
      const want = { clear: 6, breezy: 14, rain: 12, storm: 26, snow: 9 }[this.weather]; w.speed = RC.damp(w.speed, want * (this.gust || 1), 0.3, dt);
    }
  };
})();
