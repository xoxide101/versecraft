// Piers: built like real ones. Each run of pier cells ('=') becomes a deck that starts on the land with a short ramp,
// then runs out over the water: boards laid across (each cut to its own width and length, small gaps, a little uneven,
// each showing its own patch of the wood grain), two long stringers under them, posts down into the water with
// cross-braces, bollards at the end. terrain.decks tells the sim where the deck is, so feet follow the ramp.
(function () {
  const RC = window.RC;
  RC.Piers = {
    // find the piers: groups of '=' columns running out to sea (north to south here), and where they meet the land
    find(terrain) {
      const W = terrain.w, H = terrain.h, P = terrain.paint, seen = new Uint8Array(W * H), out = [];
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (P[r][c] !== '=' || seen[r * W + c]) continue;
        let c1 = c; while (c1 + 1 < W && P[r][c1 + 1] === '=') c1++;
        let r1 = r; while (r1 + 1 < H && P[r1 + 1][c] === '=') r1++;
        for (let rr = r; rr <= r1; rr++) for (let cc = c; cc <= c1; cc++) seen[rr * W + cc] = 1;
        out.push({ x0: c + 0.15, x1: c1 + 0.85, zSea: r, zEnd: r1 + 1 });
      }
      return out;
    },
    build(T, terrain, shared) {
      const g = new T.Group(), decks = [], DECK = 0.42, RAMP = 1.4, ONLAND = 2.6;
      const real = RC.Tex.real(T, 'planks_weathered'), M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, o || {}));
      // boards: one shared box; each instance shows a different strip of the wood picture (offset by its number)
      const boardMat = real ? M('#ffffff', { map: real.map, normalMap: real.normalMap, normalScale: new T.Vector2(1.2, 1.2) }) : M('#8a6440');
      if (real) boardMat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
          #ifdef USE_INSTANCING
          vec2 off = vec2(fract(float(gl_InstanceID) * 0.371), fract(float(gl_InstanceID) * 0.617));
          #else
          vec2 off = vec2(0.0);
          #endif
          #ifdef USE_MAP
          vMapUv = vec2(uv.y * 0.15 + off.x, uv.x * 0.55 + off.y);
          #endif
          #ifdef USE_NORMALMAP
          vNormalMapUv = vec2(uv.y * 0.15 + off.x, uv.x * 0.55 + off.y);
          #endif`);
      };
      boardMat.customProgramCacheKey = () => 'boards';
      const beamMat = M('#5a3e26'), postMat = M('#3f2c1c');
      const boards = [], beams = [], posts = [];
      for (const p of this.find(terrain)) {
        const zLand = p.zSea - ONLAND, zRampEnd = zLand + RAMP, w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2, ground0 = terrain.land(cx, zLand);
        const heightAt = (z) => (z < zRampEnd ? RC.lerp(ground0 + 0.04, DECK, RC.smooth01((z - zLand) / RAMP)) : DECK);
        decks.push({ x0: p.x0, x1: p.x1, z0: zLand, z1: p.zEnd, heightAt });
        // boards across the walkway, front to back
        let z = zLand + 0.02, i = 0;
        while (z < p.zEnd - 0.05) {
          const bw = 0.16 + RC.hash(i, p.x0 * 7, 3) * 0.1, gap = 0.012 + RC.hash(i, 2, 4) * 0.012, over = (RC.hash(i, 5, 6) - 0.5) * 0.12;
          const zc = z + bw / 2, y = heightAt(zc) + (RC.hash(i, 9, 7) - 0.5) * 0.012, slope = (heightAt(zc + 0.05) - heightAt(zc - 0.05)) / 0.1;
          boards.push({ x: cx + over * 0.5, y, z: zc, len: w + 0.08 + Math.abs(over), wid: bw, yaw: (RC.hash(i, 11, 8) - 0.5) * 0.02, pitch: -Math.atan(slope), tint: 0.82 + RC.hash(i, 13, 9) * 0.3 });
          z += bw + gap; i++;
        }
        // stringers under the boards, the length of the deck
        for (const sx of [p.x0 + 0.25, p.x1 - 0.25]) beams.push({ x: sx, z0: zRampEnd - 0.2, z1: p.zEnd - 0.05 });
        // posts every ~1.4 along both sides, down into the water, plus bollards at the far end
        for (let pz = Math.max(zRampEnd, p.zSea - 0.6); pz <= p.zEnd - 0.1; pz += 1.4) for (const sx of [p.x0 + 0.08, p.x1 - 0.08]) posts.push({ x: sx, z: pz, top: DECK - 0.06, bottom: -1.4, r: 0.075 });
        for (const sx of [p.x0 + 0.15, p.x1 - 0.15]) posts.push({ x: sx, z: p.zEnd - 0.2, top: DECK + 0.45, bottom: DECK - 0.1, r: 0.09, bollard: true });
      }
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), v = new T.Vector3(), col = new T.Color();
      if (boards.length) {
        const im = new T.InstancedMesh(new T.BoxGeometry(1, 0.055, 1), boardMat, boards.length);
        boards.forEach((b, i) => { im.setMatrixAt(i, m4.compose(v.set(b.x, b.y, b.z), q.setFromEuler(e.set(b.pitch, b.yaw, 0)), s.set(b.len, 1, b.wid))); im.setColorAt(i, col.setScalar(b.tint)); });
        im.castShadow = im.receiveShadow = true; g.add(im);
      }
      if (beams.length) {
        const im = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.16, 1), beamMat, beams.length);
        beams.forEach((b, i) => im.setMatrixAt(i, m4.compose(v.set(b.x, DECK - 0.11, (b.z0 + b.z1) / 2), q.identity(), s.set(1, 1, b.z1 - b.z0))));
        im.castShadow = im.receiveShadow = true; g.add(im);
      }
      if (posts.length) {
        const im = new T.InstancedMesh(new T.CylinderGeometry(1, 1.08, 1, 8), postMat, posts.length);
        posts.forEach((p, i) => im.setMatrixAt(i, m4.compose(v.set(p.x, (p.top + p.bottom) / 2, p.z), q.identity(), s.set(p.r, p.top - p.bottom, p.r))));
        im.castShadow = im.receiveShadow = true; g.add(im);
        // cross-braces between post pairs (an X under the deck)
        const br = [], bm = new T.InstancedMesh(new T.BoxGeometry(0.05, 1, 0.05), beamMat, posts.length * 2); let n = 0;
        for (let i = 0; i + 1 < posts.length; i += 2) { const a = posts[i], b = posts[i + 1]; if (a.bollard || b.bollard) continue; const dx = b.x - a.x, len = Math.hypot(dx, 0.7);
          for (const sgn of [1, -1]) { bm.setMatrixAt(n++, m4.compose(v.set((a.x + b.x) / 2, DECK - 0.5, a.z), q.setFromEuler(e.set(0, 0, sgn * Math.atan2(dx, 0.7))), s.set(1, len, 1))); } }
        bm.count = n; bm.castShadow = true; g.add(bm); void br;
      }
      terrain.decks = decks;
      return g;
    },
  };
})();
