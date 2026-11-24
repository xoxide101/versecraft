// The view: renderer, sky and sun through the day, weather, the camera, name labels.
// The camera is ArcadeEvo's: turns all the way round, four distances (close, Evo 2.5D, wide, whole map) plus zoom,
// smooth follow, and the talk zoom (down to eye level, framing you and the person you talk to).
(function () {
  const RC = window.RC;
  const VIEWS = { close: { dist: 14.2, elev: 0.54, label: 'CLOSE' }, evo: { dist: 26.5, elev: 0.64, label: 'EVO 2.5D' }, wide: { dist: 42, elev: 0.69, label: 'WIDE' }, map: { dist: 0, elev: 0.74, label: 'WHOLE MAP' } };
  RC.VIEWS = VIEWS;
  const SKY = [   // [fraction of the day, sky colour, sun light, ambient]: dawn and dusk each take a good while, passing through several colours
    [0.0, '#0b1230', 0.05, 0.35], [0.17, '#0f1636', 0.06, 0.37], [0.22, '#3a3a66', 0.2, 0.45], [0.26, '#f2a65a', 0.6, 0.55], [0.34, '#9fd0ff', 1.6, 0.85],
    [0.6, '#8ec5ff', 1.8, 0.9], [0.7, '#d7b894', 1.3, 0.75], [0.78, '#f59e6b', 0.9, 0.6], [0.84, '#8a5a78', 0.45, 0.5], [0.9, '#2a2f5c', 0.15, 0.42], [0.96, '#121838', 0.07, 0.37], [1.0, '#0b1230', 0.05, 0.35]];

  RC.View = class {
    constructor(THREE, host, realm, sim) {
      this.T = THREE; this.realm = realm; this.sim = sim;
      const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
      r.setPixelRatio(Math.min(devicePixelRatio, RC.quality.pixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95; r.outputColorSpace = THREE.SRGBColorSpace;
      host.append(r.domElement); this.canvas = r.domElement;
      this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog('#9fd0ff', 60, 150);
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);
      // the sky: scattering by the sun's height (blue day, orange dusk), stars at night
      this.sky = new THREE.Sky(); this.sky.scale.setScalar(380); this.scene.add(this.sky);
      const su = this.sky.material.uniforms; su.turbidity.value = 5; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
      const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const a = Math.random() * 6.28, e = Math.acos(Math.random() * 0.95), r = 360; sp.set([Math.cos(a) * Math.sin(e) * r, Math.cos(e) * r, Math.sin(a) * Math.sin(e) * r], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.scene.add(this.stars);
      this.hemi = new THREE.HemisphereLight('#dbeafe', '#4d7c3a', 0.8); this.scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight('#fff4e0', 1.6); this.sun.castShadow = true; const sc = this.sun.shadow;
      sc.mapSize.set(RC.quality.shadowMap, RC.quality.shadowMap); sc.camera.left = sc.camera.bottom = -26; sc.camera.right = sc.camera.top = 26; sc.camera.near = 1; sc.camera.far = 120; sc.bias = -0.0004; sc.normalBias = 0.03;
      this.scene.add(this.sun, this.sun.target);
      this.shared = { uTime: { value: 0 }, uWind: { value: new THREE.Vector3(0.3, 0.1, 0.4) }, uCam: { value: new THREE.Vector3() }, uPlayer: { value: new THREE.Vector3() }, uRain: { value: 0 } };
      // the land and what's on it (the ground cover first: it tells the ground picture what's tended and what's worn)
      this.cover = new RC.GroundCover(THREE, realm, sim.terrain, sim.plan, this.shared);
      this.scene.add(sim.terrain.build(THREE));
      { const wm = this.scene.getObjectByName('water'); if (wm) wm.material = RC.Water.material(THREE, sim.terrain, this.shared, realm); this.water = RC.Water.life(THREE, realm, sim.terrain, this.shared); this.scene.add(this.water.group); }   // (rc-water.js)
      const map = RC.MapCraft.build(THREE, realm, sim.terrain, this.shared);
      this.scene.add(map.group); this.labels = map.labels; this.tickers = map.tickers; this.buildings = map.buildings;
      this.scene.add(this.cover.group);   // grasses, reeds, wildflowers (rc-groundcover.js)
      this.horizon = new RC.Horizon(THREE, realm, sim.terrain); this.scene.add(this.horizon.group);   // forest, hills, mountains, the tower, the sea (rc-horizon.js)
      // the cast
      this.rigs = new Map();
      for (const p of [...sim.people, ...sim.players]) {
        const rg = RC.Cast.rig(THREE, p.def.look || {}, p.def.age || 'adult', { job: p.def.job, player: !!p.isPlayer, carries: p.def.carries });
        this.scene.add(rg.root); this.rigs.set(p, rg);
        if (p.isPlayer) {   // seen through whatever hides you: a dim glowing outline of your figure, drawn only where something is in front
          const xm = new THREE.MeshBasicMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.42, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
          const meshes = []; rg.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
          for (const o of meshes) { const s = new THREE.Mesh(o.geometry, xm); s.renderOrder = 998; s.castShadow = false; o.add(s); }
          for (const o of meshes) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 1; o.material.depthWrite = true; o.renderOrder = 999; }   // (your figure is drawn after the outline)
        }
      }
      this.initWeather();
      // real photographed skies light the scene and show in reflections; one per mood (day, sunset, dusk, overcast, night)
      this.envs = {}; this.envMood = null;
      if (window.RC_SKY) { const pm = new THREE.PMREMGenerator(r), L = new THREE.HDRLoader();
        for (const [mood, d] of Object.entries(window.RC_SKY)) L.load('data:application/octet-stream;base64,' + d.hdr, (tx) => { tx.mapping = THREE.EquirectangularReflectionMapping; this.envs[mood] = pm.fromEquirectangular(tx).texture; tx.dispose(); this.envMood = null; }); }
      RC.weatherize(this.scene, this.shared);   // rain and snow lie on things (rc-weathering.js)
      this.cam = { x: sim.players[0].x, y: 0, z: sim.players[0].z, dist: 26.5, elev: 0.64, look: 0.35, init: false };
      this.ray = new THREE.Raycaster(); this.faded = new Set();
      // after-effects (not on low-power devices): soft shading where things meet, a glow on lights
      if (RC.quality.tier !== 'low') {
        try {
          const c = (this.composer = new THREE.EffectComposer(r)); c.addPass(new THREE.RenderPass(this.scene, this.camera));
          this.ao = RC.aoSkipCutouts(new THREE.GTAOPass(this.scene, this.camera, 800, 600)); this.ao.blendIntensity = 0.85;
          this.ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.2, thickness: 1.2, scale: 1, samples: RC.quality.tier === 'high' ? 16 : 10 }); c.addPass(this.ao);
          this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(800, 600), 0.05, 0.45, 1.15);   // (only really bright things glow: lamp flames, lit windows) c.addPass(this.bloom);
          c.addPass(new THREE.OutputPass());
        } catch (e) { console.warn('after-effects off:', e); this.composer = null; }
      }
      this.resize(); addEventListener('resize', () => this.resize());
    }
    resize() { const w = this.canvas.parentElement.clientWidth, h = this.canvas.parentElement.clientHeight; this.renderer.setSize(w, h); if (this.composer) this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

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
      const wind = sim.wind; this.shared.uWind.value.set(Math.cos(wind.dir) * wind.speed * 0.04, Math.sin(wind.dir) * wind.speed * 0.04, ({ storm: 1.4, breezy: 0.9, rain: 0.7, snow: 0.5, clear: 0.3 }[sim.weather] || 0.3) * (sim.gust || 1));
      // ---- sky and sun through the day (and the weather's greys)
      const f = now.dayFraction; let i = 0; while (i < SKY.length - 2 && f > SKY[i + 1][0]) i++;
      const a = SKY[i], b = SKY[i + 1], k = (f - a[0]) / (b[0] - a[0]);
      const sky = new T.Color(a[1]).lerp(new T.Color(b[1]), k), grey = sim.cloud != null ? sim.cloud + (sim.precip || 0) * 0.15 : { rain: 0.45, storm: 0.65, snow: 0.3, breezy: 0.05, clear: 0 }[sim.weather] || 0;   // (darker as it comes down harder)
      sky.lerp(new T.Color('#7b8794'), grey);
      let sunI = RC.lerp(a[2], b[2], k) * (1 - grey * 0.6), amb = RC.lerp(a[3], b[3], k);
      if (sim.flash > 0) { sky.lerp(new T.Color('#ffffff'), sim.flash * 0.7); amb += sim.flash * 2; }
      this.scene.background = sky; this.scene.fog.color.copy(sky);
      const su = this.sky.material.uniforms, sunUp = Math.sin((f - 0.25) * Math.PI * 2);
      su.sunPosition.value.set(Math.cos((f - 0.25) * Math.PI * 2) * 100, sunUp * 100, 30);
      su.turbidity.value = 4 + grey * 14; su.rayleigh.value = 1.6 - grey * 1.2 + (sunUp < 0.2 ? 0.8 : 0);
      this.sky.visible = grey < 0.6; if (this.sky.visible) this.scene.background = null;
      this.stars.material.opacity = RC.clamp((0.05 - sunUp) * 4, 0, 1) * (1 - grey);
      this.night = RC.clamp(1 - (sunI - 0.1) / 0.8, 0, 1);
      const sa = (f - 0.25) * Math.PI * 2;   // sun's path: rises in the east at dawn
      // which real sky lights the scene: weather first, then the time of day
      const mood = grey > 0.25 ? 'overcast' : this.night > 0.75 ? 'night' : f < 0.3 ? 'sunset' : f > 0.8 ? 'dusk' : f > 0.73 ? 'sunset' : 'day';
      // (a new sky light fades the old one out, swaps, and fades back in: no pop)
      if (this.envMood == null && this.envs[mood]) { this.envMood = mood; this.scene.environment = this.envs[mood]; this.envFade = 1; }
      else if (mood !== this.envMood && this.envs[mood]) { this.envFade = RC.damp(this.envFade == null ? 1 : this.envFade, 0, 3, dt); if (this.envFade < 0.04) { this.envMood = mood; this.scene.environment = this.envs[mood]; } }
      else this.envFade = RC.damp(this.envFade == null ? 1 : this.envFade, 1, 3, dt);
      const hasEnv = !!this.scene.environment; this.scene.environmentIntensity = hasEnv ? RC.lerp(0.12, 0.5, RC.clamp(sunI / 1.8, 0, 1)) * (1 - grey * 0.55) * (this.envFade == null ? 1 : this.envFade) : 0;   // (the sky's light follows the sun's strength: warm and low at sunset, faint at night)
      this.sun.intensity = sunI; this.hemi.intensity = hasEnv ? amb * 0.35 : amb; this.sun.color.set(f < 0.3 || f > 0.75 ? '#ffc58a' : '#fff4e0');
      // ---- camera
      const v = VIEWS[sim.viewMode] || VIEWS.evo, talk = sim.dialogue && sim.dialogue.who;
      let tx = pl.x, tz = pl.z, dist = v.dist, elev = v.elev, lookY = 0.35;
      if (talk) { tx = RC.lerp(pl.x, talk.x, 0.56); tz = RC.lerp(pl.z, talk.z, 0.56); dist = 6.9; elev = 0.28; lookY = 1.24; }
      else {
        if (sim.viewMode === 'map') { dist = Math.max(this.realm.w, this.realm.h) * 1.18 + 10; tx = RC.lerp(this.realm.w / 2, pl.x, 0.22); tz = RC.lerp(this.realm.h / 2, pl.z, 0.22); }
        dist *= sim.zoom; if (sim.zoom < 0.4) { const k = (0.4 - sim.zoom) / 0.3; elev = RC.lerp(elev, 0.3, k); lookY = RC.lerp(0.35, 0.9, k); }
        elev = RC.clamp(elev + (sim.tilt || 0), 0.03, 1.5);   // your tilt on top of the view's own angle
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
      this.shared.uCam.value.copy(this.camera.position); this.shared.uPlayer.value.set(pl.x, sim.terrain.groundY(pl.x, pl.z) + 0.9, pl.z);
      this.camera.far = Math.max(900, c.dist * 3); this.sky.position.set(c.x, 0, c.z); this.stars.position.set(c.x, 0, c.z); this.scene.fog.near = Math.max(50, c.dist * 1.4); this.scene.fog.far = Math.max(140, c.dist * 3.2); this.camera.updateProjectionMatrix();
      // the sun's shadow box follows what you look at
      this.sun.position.set(c.x + Math.cos(sa) * 30, Math.max(8, Math.sin(sa) * 45 + 10), c.z + 18); this.sun.target.position.set(c.x, c.y, c.z);
      const box = RC.clamp(c.dist * 0.9, 18, 70), scam = this.sun.shadow.camera; if (scam.right !== box) { scam.left = scam.bottom = -box; scam.right = scam.top = box; scam.updateProjectionMatrix(); }
      // ---- weather
      // how much falls follows the sim's amounts: from a few drops to sheets of it, in waves
      const pr = sim.precip || 0, sf = sim.snowfall || 0, nR = this.rain.geometry.attributes.position.count / 2, nS = this.snow.geometry.attributes.position.count;
      this.rain.visible = pr > 0.01; this.snow.visible = sf > 0.01; this.rain.geometry.setDrawRange(0, Math.floor(nR * Math.min(1, pr * 1.1)) * 2); this.snow.geometry.setDrawRange(0, Math.floor(nS * sf));
      this.rain.material.opacity = 0.25 + pr * 0.3;
      if (this.rain.visible) { this.rain.position.set(c.x, c.y, c.z); const p = this.rain.geometry.attributes.position; for (let j = 0; j < p.count; j += 2) { let y = p.getY(j) - dt * (17 + pr * 9); if (y < 0) y += 25; p.setY(j, y); p.setY(j + 1, y - 0.5); p.setX(j + 1, p.getX(j) + this.shared.uWind.value.x * 0.35); p.setZ(j + 1, p.getZ(j) + this.shared.uWind.value.y * 0.35); } p.needsUpdate = true; }
      if (this.snow.visible) { this.snow.position.set(c.x, c.y, c.z); const p = this.snow.geometry.attributes.position; for (let j = 0; j < p.count; j++) { let y = p.getY(j) - dt * 1.6; if (y < 0) y += 25; p.setY(j, y); p.setX(j, p.getX(j) + Math.sin(t + j) * dt * 0.3); } p.needsUpdate = true; }
      sim.terrain.waterTex.offset.set(Math.sin(t * 0.07) * 0.01, t * 0.016);   // the sea drifts steadily one way (toward the shore) with a slight sway
      // ---- the cast
      for (const [p, rg] of this.rigs) {
        rg.root.visible = !p.hidden;
        rg.root.position.set(p.x, sim.terrain.groundY(p.x, p.z), p.z); rg.root.rotation.y = Math.PI / 2 - p.angle;
        if (p.ring !== 'far' || (this.frameN = (this.frameN || 0) + 1) % 4 === 0) rg.update(p, t);   // detail rings: far bodies animate less often
      }
      this.cover.update(pl.x, pl.z); if (this.water) this.water.update(dt, t, pl.x, pl.z); this.horizon.update(this.scene.fog.color, this.night);
      if (this.coverWx !== this.cover.group.children.length) { this.coverWx = this.cover.group.children.length; RC.weatherize(this.cover.group, this.shared); }   // (new grass chunks too)
      this.shared.uWet.value = sim.lying.wet; this.shared.uSnow.value = sim.lying.snow;
      this.shared.uRain.value = RC.damp(this.shared.uRain.value, sim.precip != null ? sim.precip : sim.weather === 'storm' ? 1 : sim.weather === 'rain' ? 0.7 : 0, 0.5, dt);
      for (const fn of this.tickers) fn(t, { night: this.night, cam: this.cam, season: now.seasonIndex });
      if (this.bloom) { this.bloom.strength = 0.02 + this.night * 0.55; this.bloom.threshold = RC.lerp(1.6, 0.9, this.night); }   // (by day the sky must not glow)
      if (RC.settings.seeThrough === 'fade') this.fadeBlockers(pl);
      if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
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
