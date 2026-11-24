// The view: renderer, sky and sun through the day, weather, the camera, name labels.
// The camera is ArcadeEvo's: turns all the way round, four distances (close, Evo 2.5D, wide, whole map) plus zoom,
// smooth follow, and the talk zoom (down to eye level, framing you and the person you talk to).
(function () {
  const RC = window.RC;
  const VIEWS = { close: { dist: 14.2, elev: 0.54, label: 'CLOSE' }, evo: { dist: 26.5, elev: 0.64, label: 'EVO 2.5D' }, wide: { dist: 42, elev: 0.69, label: 'WIDE' }, map: { dist: 0, elev: 0.74, label: 'WHOLE MAP' } };
  RC.VIEWS = VIEWS;
  const SKY = [   // [fraction of the day, sky colour, sun light, ambient]
    [0.0, '#0b1230', 0.05, 0.35], [0.2, '#1c2547', 0.08, 0.4], [0.25, '#f2a65a', 0.6, 0.55], [0.33, '#9fd0ff', 1.6, 0.85],
    [0.6, '#8ec5ff', 1.8, 0.9], [0.78, '#f59e6b', 0.9, 0.6], [0.86, '#2a2f5c', 0.15, 0.42], [1.0, '#0b1230', 0.05, 0.35]];

  RC.View = class {
    constructor(THREE, host, realm, sim) {
      this.T = THREE; this.realm = realm; this.sim = sim;
      const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
      r.setPixelRatio(Math.min(devicePixelRatio, RC.quality.pixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
      host.append(r.domElement); this.canvas = r.domElement;
      this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog('#9fd0ff', 60, 150);
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.4, 600);
      this.hemi = new THREE.HemisphereLight('#dbeafe', '#4d7c3a', 0.8); this.scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight('#fff4e0', 1.6); this.sun.castShadow = true; const sc = this.sun.shadow;
      sc.mapSize.set(RC.quality.shadowMap, RC.quality.shadowMap); sc.camera.left = sc.camera.bottom = -26; sc.camera.right = sc.camera.top = 26; sc.camera.near = 1; sc.camera.far = 120; sc.bias = -0.0004; sc.normalBias = 0.03;
      this.scene.add(this.sun, this.sun.target);
      this.shared = { uTime: { value: 0 }, uWind: { value: new THREE.Vector3(0.3, 0.1, 0.4) } };
      // the land and what's on it
      this.scene.add(sim.terrain.build(THREE));
      const map = RC.MapCraft.build(THREE, realm, sim.terrain, this.shared);
      this.scene.add(map.group); this.labels = map.labels; this.tickers = map.tickers; this.buildings = map.buildings;
      // the cast
      this.rigs = new Map();
      for (const p of [...sim.people, ...sim.players]) {
        const rg = RC.Cast.rig(THREE, p.def.look || {}, p.def.age || 'adult', { job: p.def.job, player: !!p.isPlayer, carries: p.def.carries });
        this.scene.add(rg.root); this.rigs.set(p, rg);
      }
      this.initWeather();
      this.cam = { x: sim.players[0].x, y: 0, z: sim.players[0].z, dist: 26.5, elev: 0.64, look: 0.35, init: false };
      this.ray = new THREE.Raycaster(); this.faded = new Set();
      this.resize(); addEventListener('resize', () => this.resize());
    }
    resize() { const w = this.canvas.parentElement.clientWidth, h = this.canvas.parentElement.clientHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

    initWeather() {
      const T = this.T, N = 2600, pos = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 25, z = (Math.random() - 0.5) * 60; pos.set([x, y, z, x + 0.05, y - 0.5, z], i * 6); }
      const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.BufferAttribute(pos, 3));
      this.rain = new T.LineSegments(ge, new T.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.45 })); this.rain.visible = false; this.rain.frustumCulled = false; this.scene.add(this.rain);
      const sp = new Float32Array(N * 3); for (let i = 0; i < N; i++) sp.set([(Math.random() - 0.5) * 60, Math.random() * 25, (Math.random() - 0.5) * 60], i * 3);
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
      this.snow = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.9 })); this.snow.visible = false; this.snow.frustumCulled = false; this.scene.add(this.snow);
    }

    draw(dt, t) {
      const T = this.T, sim = this.sim, now = sim.calendar.now(), pl = sim.players[0];
      this.shared.uTime.value = t;
      const wind = sim.wind; this.shared.uWind.value.set(Math.cos(wind.dir) * wind.speed * 0.04, Math.sin(wind.dir) * wind.speed * 0.04, { storm: 1.4, breezy: 0.9, rain: 0.7, snow: 0.5, clear: 0.3 }[sim.weather] || 0.3);
      // ---- sky and sun through the day (and the weather's greys)
      const f = now.dayFraction; let i = 0; while (i < SKY.length - 2 && f > SKY[i + 1][0]) i++;
      const a = SKY[i], b = SKY[i + 1], k = (f - a[0]) / (b[0] - a[0]);
      const sky = new T.Color(a[1]).lerp(new T.Color(b[1]), k), grey = { rain: 0.45, storm: 0.65, snow: 0.3, breezy: 0.05, clear: 0 }[sim.weather] || 0;
      sky.lerp(new T.Color('#7b8794'), grey);
      let sunI = RC.lerp(a[2], b[2], k) * (1 - grey * 0.6), amb = RC.lerp(a[3], b[3], k);
      if (sim.flash > 0) { sky.lerp(new T.Color('#ffffff'), sim.flash * 0.7); amb += sim.flash * 2; }
      this.scene.background = sky; this.scene.fog.color.copy(sky);
      this.night = RC.clamp(1 - (sunI - 0.1) / 0.8, 0, 1);
      const sa = (f - 0.25) * Math.PI * 2;   // sun's path: rises in the east at dawn
      this.sun.intensity = sunI; this.hemi.intensity = amb; this.sun.color.set(f < 0.3 || f > 0.75 ? '#ffc58a' : '#fff4e0');
      // ---- camera
      const v = VIEWS[sim.viewMode] || VIEWS.evo, talk = sim.dialogue && sim.dialogue.who;
      let tx = pl.x, tz = pl.z, dist = v.dist, elev = v.elev, lookY = 0.35;
      if (talk) { tx = RC.lerp(pl.x, talk.x, 0.56); tz = RC.lerp(pl.z, talk.z, 0.56); dist = 6.9; elev = 0.28; lookY = 1.24; }
      else {
        if (sim.viewMode === 'map') { dist = Math.max(this.realm.w, this.realm.h) * 1.18 + 10; tx = RC.lerp(this.realm.w / 2, pl.x, 0.22); tz = RC.lerp(this.realm.h / 2, pl.z, 0.22); }
        dist *= sim.zoom;
      }
      const c = this.cam, ty = sim.terrain.groundY(tx, tz);
      if (!c.init) Object.assign(c, { x: tx, y: ty, z: tz, dist, elev, look: lookY, init: true });
      const fr = talk ? 7.2 : 9.5;
      c.x = RC.damp(c.x, tx, fr, dt); c.z = RC.damp(c.z, tz, fr, dt); c.y = RC.damp(c.y, ty, 8.5, dt); c.dist = RC.damp(c.dist, dist, 6.8, dt); c.elev = RC.damp(c.elev, elev, 6.8, dt); c.look = RC.damp(c.look, lookY, 7.2, dt);
      const horiz = c.dist * Math.cos(c.elev), sh = sim.shake > 0 ? sim.shake : 0;
      // talking: the camera swings to the side of the pair, so both faces show (the side nearer where it was)
      let yaw = sim.yaw;
      if (talk) { const line = Math.atan2(talk.x - pl.x, talk.z - pl.z), a1 = line + Math.PI / 2 - 0.35, a2 = line - Math.PI / 2 + 0.35; this.talkYaw = this.talkYaw != null ? this.talkYaw : Math.abs(RC.wrapAngle(a1 - sim.yaw)) < Math.abs(RC.wrapAngle(a2 - sim.yaw)) ? a1 : a2; }
      else this.talkYaw = null;
      c.yaw = RC.dampAngle(c.yaw != null ? c.yaw : yaw, this.talkYaw != null ? this.talkYaw : yaw, talk ? 4 : 12, dt); yaw = c.yaw;
      this.camera.position.set(c.x + Math.sin(yaw) * horiz + (Math.random() - 0.5) * 0.28 * sh, c.y + c.dist * Math.sin(c.elev) + (Math.random() - 0.5) * 0.18 * sh, c.z + Math.cos(yaw) * horiz);
      this.camera.lookAt(c.x, c.y + c.look, c.z);
      this.camera.far = Math.max(200, c.dist * 3); this.scene.fog.near = Math.max(50, c.dist * 1.4); this.scene.fog.far = Math.max(140, c.dist * 3.2); this.camera.updateProjectionMatrix();
      // the sun's shadow box follows what you look at
      this.sun.position.set(c.x + Math.cos(sa) * 30, Math.max(8, Math.sin(sa) * 45 + 10), c.z + 18); this.sun.target.position.set(c.x, c.y, c.z);
      const box = RC.clamp(c.dist * 0.9, 18, 70), scam = this.sun.shadow.camera; if (scam.right !== box) { scam.left = scam.bottom = -box; scam.right = scam.top = box; scam.updateProjectionMatrix(); }
      // ---- weather
      const wv = sim.weather; this.rain.visible = (wv === 'rain' || wv === 'storm'); this.snow.visible = wv === 'snow';
      if (this.rain.visible) { this.rain.position.set(c.x, c.y, c.z); const p = this.rain.geometry.attributes.position; for (let j = 0; j < p.count; j += 2) { let y = p.getY(j) - dt * 22; if (y < 0) y += 25; p.setY(j, y); p.setY(j + 1, y - 0.5); p.setX(j + 1, p.getX(j) + this.shared.uWind.value.x * 4); } p.needsUpdate = true; }
      if (this.snow.visible) { this.snow.position.set(c.x, c.y, c.z); const p = this.snow.geometry.attributes.position; for (let j = 0; j < p.count; j++) { let y = p.getY(j) - dt * 1.6; if (y < 0) y += 25; p.setY(j, y); p.setX(j, p.getX(j) + Math.sin(t + j) * dt * 0.3); } p.needsUpdate = true; }
      sim.terrain.waterTex.offset.set(t * 0.012, t * 0.02);
      // ---- the cast
      for (const [p, rg] of this.rigs) {
        rg.root.visible = !p.hidden;
        rg.root.position.set(p.x, sim.terrain.groundY(p.x, p.z), p.z); rg.root.rotation.y = Math.PI / 2 - p.angle;
        if (p.ring !== 'far' || (this.frameN = (this.frameN || 0) + 1) % 4 === 0) rg.update(p, t);   // detail rings: far bodies animate less often
      }
      for (const fn of this.tickers) fn(t, { night: this.night, cam: this.cam });
      this.fadeBlockers(pl);
      this.renderer.render(this.scene, this.camera);
    }
    // buildings between the camera and you turn see-through (walk behind them and still see yourself)
    fadeBlockers(pl) {
      const T = this.T, from = this.camera.position, to = new T.Vector3(pl.x, this.sim.terrain.groundY(pl.x, pl.z) + 0.8, pl.z);
      this.ray.set(from, to.clone().sub(from).normalize()); this.ray.far = from.distanceTo(to) - 0.5;
      const hits = new Set(); for (const b of this.buildings) if (this.ray.intersectObject(b.group, true).length) hits.add(b);
      for (const b of this.buildings) { const want = hits.has(b) ? 0.28 : 1; for (const m of b.mats) { const o = RC.damp(m.opacity, want, 10, 1 / 60); m.opacity = o; const tr = o < 0.99; if (tr !== m.transparent) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; } } }
    }
    // where a point in the world is on screen
    project(x, y, z) { const v = new this.T.Vector3(x, y, z).project(this.camera); const r = this.canvas.getBoundingClientRect(); return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, front: v.z < 1 }; }
  };
})();
