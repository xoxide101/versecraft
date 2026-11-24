// The horizon: what you see beyond the edge of the realm, in layers that fade into the sky's colour with distance
// (aerial perspective), so they follow the time of day and the weather:
//   a forest just past the edge, forested hills, far blue mountains, a landmark tower on a far hill, the open sea and islands.
// Drawn unlit and without fog (they set their own haze), around the realm's middle. Data: realm.horizon (optional).
(function () {
  const RC = window.RC;
  RC.Horizon = class {
    constructor(T, realm, terrain) {
      this.T = T; this.group = new T.Group(); this.layers = [];
      const H = Object.assign({ sea: 'south', tower: { angle: 0.15, dist: 210, height: 64 }, seed: 5 }, realm.horizon || {});
      const cx = realm.w / 2, cz = realm.h / 2; this.center = new T.Vector3(cx, 0, cz);
      // sea side: the arc (radians, 0 = north, clockwise) where the land gives way to open water
      const seaMid = { south: Math.PI, north: 0, east: Math.PI / 2, west: -Math.PI / 2 }[H.sea] ?? Math.PI, seaHalf = 1.15;
      const seaness = (a) => { const d = Math.abs(RC.wrapAngle(a - seaMid)); return 1 - RC.smooth01((d - seaHalf + 0.25) / 0.5); };
      // a ring of silhouette: heights from fractal noise round the circle, lower where the sea is
      const ring = (radius, base, amp, freq, rough, color, haze, seed, sink = 1) => {
        const N = 360, pos = [], idx = [];
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2, s = seaness(a);
          let h = base + amp * Math.pow(RC.fbm(Math.cos(a) * freq + 100, Math.sin(a) * freq + 100, 1, 5, seed), 1.6) * 2.2;
          if (rough) h += (RC.vnoise(i * 3.1, seed, 1, seed + 3) - 0.5) * rough;   // treetops along the ridge
          h *= 1 - s * sink;
          const x = cx + Math.sin(a) * radius, z = cz - Math.cos(a) * radius;
          pos.push(x, -12, z, x, Math.max(-0.5, h), z);
        }
        for (let i = 0; i < N; i++) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
        const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ge.setIndex(idx);
        const m = new T.Mesh(ge, new T.MeshBasicMaterial({ color, fog: false, side: T.DoubleSide })); m.renderOrder = -5; this.group.add(m);
        this.layers.push({ mesh: m, base: new T.Color(color), haze });
      };
      ring(330, 8, 70, 2.2, 0, '#7d93b4', 0.55, H.seed, 0.92);          // far mountains
      ring(250, 4, 34, 3.4, 0, '#5f7f86', 0.45, H.seed + 1, 1);          // a nearer range
      ring(170, 3, 14, 5.5, 2.2, '#2f5a3a', 0.34, H.seed + 2, 1);       // forested hills
      ring(118, 2, 6, 8, 2.6, '#2a4d2c', 0.2, H.seed + 3, 1);           // the forest just beyond the edge
      // the landmark: a tall old tower on a far hill (round, tapering, crenellated, a lit window)
      const tw = H.tower, ta = tw.angle * Math.PI * 2, tx = cx + Math.sin(ta) * tw.dist, tz = cz - Math.cos(ta) * tw.dist;
      const tower = new T.Group(), tc = '#6a7088', mat = new T.MeshBasicMaterial({ color: tc, fog: false });
      const add = (ge, y) => { const m = new T.Mesh(ge, mat); m.position.y = y; tower.add(m); };
      add(new T.CylinderGeometry(9, 12, 24, 10), 10); add(new T.CylinderGeometry(6.5, 8.5, tw.height, 12), 22 + tw.height / 2);
      add(new T.CylinderGeometry(8, 7, 4, 12), 22 + tw.height + 2);
      for (let i = 0; i < 10; i++) { const m = new T.Mesh(new T.BoxGeometry(2, 3, 2), mat); const a = (i / 10) * Math.PI * 2; m.position.set(Math.cos(a) * 7.4, 22 + tw.height + 5.5, Math.sin(a) * 7.4); tower.add(m); }
      const win = new T.Mesh(new T.PlaneGeometry(1.6, 3), new T.MeshBasicMaterial({ color: '#ffcf7a', fog: false })); win.position.set(0, 22 + tw.height - 10, 6.6); tower.add(win); this.towerWindow = win;
      tower.position.set(tx, 0, tz); tower.lookAt(cx, 0, cz); this.group.add(tower);
      this.layers.push({ mesh: tower, base: new T.Color(tc), haze: 0.45, mat });
      // the open sea out to the horizon, and a few low islands on it
      const sea = new T.Mesh(new T.CircleGeometry(420, 64).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#2f6ea8', fog: false }));
      sea.position.set(cx, terrain.waterY - 0.08, cz); sea.renderOrder = -6; this.group.add(sea); this.layers.push({ mesh: sea, base: new T.Color('#2f6ea8'), haze: 0.4 });
      for (let i = 0; i < 4; i++) {
        const a = seaMid + (i - 1.5) * 0.35 + (RC.hash(i, 1, H.seed) - 0.5) * 0.2, d = 190 + RC.hash(i, 2, H.seed) * 110, w = 14 + RC.hash(i, 3, H.seed) * 26;
        const isl = new T.Mesh(new T.SphereGeometry(w, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: '#3f5f4a', fog: false }));
        isl.scale.set(1, 0.22 + RC.hash(i, 4, H.seed) * 0.25, 0.6); isl.position.set(cx + Math.sin(a) * d, terrain.waterY - 0.5, cz - Math.cos(a) * d); this.group.add(isl);
        this.layers.push({ mesh: isl, base: new T.Color('#3f5f4a'), haze: 0.22 + d / 1500 });
      }
    }
    // each frame: blend every layer toward the sky's horizon colour (more for further layers), dim at night
    update(skyColor, night) {
      const c = new this.T.Color();
      for (const L of this.layers) { c.copy(L.base).multiplyScalar(1 - night * 0.75).lerp(skyColor, L.haze * (1 - night * 0.3)); (L.mat || L.mesh.material).color.copy(c); }
      this.towerWindow.visible = night > 0.3;
    }
  };
})();
