// Mushrooms: clusters on the forest floor and at tree roots, a few at meadow edges, shelf fungus up tree trunks.
// Each kind has a shape (cap profile, stem), colours and a use (food, medicine, poison, ink, alchemy); they're
// gathered like herbs (forage) and go in the bag for the cauldron later. Glowcaps glow softly at night.
(function () {
  const RC = window.RC;
  const KINDS = {
    field_cap: { name: 'Field Cap', use: 'food', cap: 'parasol', capC: '#f2efe6', gill: '#e6d8c8', stem: '#efe8dc', size: [0.06, 0.1], n: [3, 6], where: 'meadow' },
    brown_bolete: { name: 'Brown Bolete', use: 'food', cap: 'bun', capC: '#7a4a28', gill: '#c8b060', stem: '#d8c8a0', size: [0.07, 0.12], n: [2, 4], thick: true, where: 'forest' },
    black_trumpet: { name: 'Black Trumpet', use: 'medicine: eases fever', cap: 'trumpet', capC: '#2a2420', gill: '#4a4038', stem: '#2a2420', size: [0.05, 0.08], n: [4, 8], where: 'forest' },
    ember_toadstool: { name: 'Ember Toadstool', use: 'poison (alchemy)', cap: 'dome', capC: '#c8281e', gill: '#f4ecd8', stem: '#f2ead8', spots: '#f6f0e0', size: [0.08, 0.13], n: [1, 3], where: 'forest' },
    honey_caps: { name: 'Honey Caps', use: 'food', cap: 'dome', capC: '#c8902a', gill: '#e8d0a0', stem: '#d8b880', size: [0.03, 0.05], n: [8, 14], tight: true, where: 'roots' },
    ink_cap: { name: 'Ink Cap', use: 'makes ink', cap: 'bell', capC: '#5a5450', gill: '#1a1816', stem: '#e8e4dc', size: [0.05, 0.08], n: [3, 6], tall: true, where: 'forest' },
    glowcap: { name: 'Glowcap', use: 'medicine: night sight', cap: 'dome', capC: '#9fd8ff', gill: '#c8ecff', stem: '#d8eef8', size: [0.035, 0.06], n: [5, 9], glow: '#6ac8ff', where: 'forest' },
    shelf_fungus: { name: 'Shelf Fungus', use: 'medicine: closes wounds', shelf: true, capC: '#b07a3a', gill: '#e8d8b8', size: [0.1, 0.18], n: [2, 4], where: 'trunk' },
  };
  // cap shapes as half-profiles (radius, height) for a lathe, top to edge
  const PROFILE = {
    parasol: [[0, 0.32], [0.35, 0.3], [0.7, 0.2], [0.95, 0.06], [1, 0]],
    bun: [[0, 0.62], [0.45, 0.58], [0.8, 0.42], [0.98, 0.18], [1, 0]],
    dome: [[0, 0.55], [0.5, 0.48], [0.85, 0.28], [1, 0.04], [0.97, 0]],
    bell: [[0, 1.1], [0.35, 1.02], [0.62, 0.75], [0.8, 0.35], [0.86, 0]],
    trumpet: [[0.2, 0.05], [0.5, 0.22], [0.85, 0.42], [1, 0.5], [0.96, 0.42]],
  };
  const surf = {};
  function mushTex(T, kind, part) {
    const key = kind + part; if (surf[key]) return surf[key];
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), r = RC.rng(kind.length * 31 + part.length);
    if (part === 'cap') {   // lathe uv: u round the cap, v from the top (0) to the rim (1)
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 900; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(70,50,35,${r() * 0.14})` : `rgba(255,250,240,${r() * 0.16})`; g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 10, 1 + r() * 4, 0, 0, 7); g.fill(); }
      for (let i = 0; i < 160; i++) { const x = r() * S; g.strokeStyle = `rgba(60,40,30,${0.05 + r() * 0.1})`; g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(x, S * 0.15); g.lineTo(x + (r() - 0.5) * 6, S); g.stroke(); }   // streaks toward the rim
      const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(40,25,15,.28)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(0.92, 'rgba(255,245,225,.18)'); gr.addColorStop(1, 'rgba(60,40,25,.25)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    } else if (part === 'gill') {   // circle uv: fine lines out from the middle
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 220; i++) { const a = (i / 220) * 6.283, len = i % 2 ? 0.48 : 0.3 + r() * 0.1; g.strokeStyle = 'rgba(60,45,35,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * S * 0.08, S / 2 + Math.sin(a) * S * 0.08); g.lineTo(S / 2 + Math.cos(a) * S * len, S / 2 + Math.sin(a) * S * len); g.stroke(); }
      g.fillStyle = 'rgba(40,30,20,.35)'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.08, 0, 7); g.fill();
    } else {   // stem: fibres up the length, a darker foot
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 300; i++) { const x = r() * S; g.strokeStyle = `rgba(${r() < 0.5 ? '90,70,50' : '255,250,240'},${0.06 + r() * 0.12})`; g.lineWidth = 0.5 + r() * 1.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 4, S); g.stroke(); }
      const gr = g.createLinearGradient(0, S, 0, 0); gr.addColorStop(0, 'rgba(60,45,30,.45)'); gr.addColorStop(0.3, 'rgba(60,45,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; return (surf[key] = tx);
  }
  RC.Mushrooms = {
    KINDS,
    // where clusters grow in a realm: forest floor by noise, tree roots, meadow edges; shelves on some trunks
    spots(realm, terrain) {
      const out = [], W = realm.w, H = realm.h, P = terrain.paint, at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W ? 'T' : P[r][c]);
      const pick = (list, h) => list[Math.floor(h * list.length) % list.length];
      const placed = realm.things.filter((x) => x.kind !== 'building' && x.kind !== 'boat' && x.kind !== 'lamp' && x.node !== 'mushroom').map((x) => [x.x, x.z]);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const k = P[r][c], h = RC.hash(c, r, 301), n = RC.fbm(c, r, 6, 3, 302);
        const edge = (k === '.' || k === ',') && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(c + a, r + b) === 'T');
        let kind = null;
        if (k === 'T' && h < 0.05 + n * 0.08) kind = pick(['brown_bolete', 'black_trumpet', 'ember_toadstool', 'ink_cap', 'glowcap', 'honey_caps', 'brown_bolete', 'black_trumpet'], RC.hash(c, r, 303));
        else if (edge && h < 0.06) kind = pick(['field_cap', 'honey_caps', 'ember_toadstool', 'field_cap'], RC.hash(c, r, 304));
        else if (k === '.' && h < 0.004) kind = 'field_cap';
        if (kind) out.push({ kind: 'forage', node: 'mushroom', mush: kind, id: `mush_${c}_${r}`, x: c + 0.2 + RC.hash(c, r, 305) * 0.6, z: r + 0.2 + RC.hash(c, r, 306) * 0.6, item: kind, name: KINDS[kind].name, use: KINDS[kind].use, amount: 1 + Math.floor(RC.hash(c, r, 307) * 3) });
        // shelf fungus on a tree trunk (the tree in this forest cell; trees stand near the cell middle)
        // (the same tree rules as rc-flora.js: which species stands here, and no tree near a placed thing)
        const sn = (RC.hash(Math.floor(c / 6), Math.floor(r / 6), 77) + RC.hash(Math.floor(c / 12), Math.floor(r / 12), 78)) / 2, sh = RC.hash(c, r, 79);
        const species = sh < (1 - r / H) * 0.55 && sn > 0.35 ? 'pine' : sn < 0.3 ? 'birch' : sn < 0.62 ? 'oak' : 'maple';
        const ttx = c + 0.5 + (RC.hash(c, r, 5) - 0.5) * 0.7, ttz = r + 0.5 + (RC.hash(r, c, 6) - 0.5) * 0.7;
        const treeHere = !placed.some(([px, pz]) => Math.abs(px - ttx) < 1.3 && Math.abs(pz - ttz) < 1.3);
        if (k === 'T' && treeHere && (species === 'pine' || species === 'oak') && RC.hash(c, r, 308) < 0.1) { const tx = ttx, tz = ttz, a = RC.hash(c, r, 309) * 6.28;
          out.push({ kind: 'forage', node: 'mushroom', mush: 'shelf_fungus', id: `shelf_${c}_${r}`, x: tx + Math.cos(a) * 0.17, z: tz + Math.sin(a) * 0.17, face: a, item: 'shelf_fungus', name: 'Shelf Fungus', use: KINDS.shelf_fungus.use, amount: 1, onTrunk: true }); }
      }
      return out;
    },
    // one cluster as a group of meshes (made once per kind and seed)
    cluster(T, kindName, seed, mats) {
      const K = KINDS[kindName], r = RC.rng(seed), g = new T.Group(), n = K.n[0] + Math.floor(r() * (K.n[1] - K.n[0] + 1));
      const M = (c, o) => mats[c + (o ? JSON.stringify(o) : '')] || (mats[c + (o ? JSON.stringify(o) : '')] = new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o || {})));
      const capM = K.glow ? M(K.capC, { emissive: K.glow, emissiveIntensity: 0.0 }) : M(K.capC), gillM = M(K.gill, { map: mushTex(T, kindName, 'gill') }), stemM = M(K.stem || K.gill);
      if (K.glow) g.userData.glowMat = capM;
      // cap shading by vertex colour: darker in the middle, lighter toward the rim (and a pale band at the edge)
      const shade = (ge, base, rimLight, centreDark, bands) => {
        const p2 = ge.attributes.position, col = new Float32Array(p2.count * 3), c0 = new T.Color(base), c = new T.Color();
        let maxR = 0; for (let j = 0; j < p2.count; j++) maxR = Math.max(maxR, Math.hypot(p2.getX(j), p2.getZ(j)));
        for (let j = 0; j < p2.count; j++) {
          const rr = Math.hypot(p2.getX(j), p2.getZ(j)) / (maxR || 1);
          c.copy(c0).multiplyScalar(1 - centreDark * (1 - rr)).lerp(new T.Color('#f2e8d4'), Math.max(0, rr - 0.86) / 0.14 * rimLight);
          if (bands) { const band = Math.sin(rr * bands * 3.14) * 0.5 + 0.5; c.multiplyScalar(0.72 + band * 0.36); }
          col.set([c.r, c.g, c.b], j * 3);
        }
        ge.setAttribute('color', new T.BufferAttribute(col, 3)); return ge;
      };
      const VC = (key) => mats['vc' + kindName + key] || (mats['vc' + kindName + key] = new T.MeshStandardMaterial({ vertexColors: true, map: mushTex(T, kindName, key === 'stem' ? 'stem' : 'cap'), roughness: kindName === 'ember_toadstool' || kindName === 'ink_cap' ? 0.38 : 0.72, emissive: K.glow || '#000000', emissiveIntensity: 0 }));   // (slimy caps catch the light)
      if (K.shelf) {   // brackets up the trunk: each its own size and colour, some banded like turkey-tail, now and then two side by side
        const SHELF = [['#b07a3a', 0.6, 0], ['#d0782a', 0.5, 0], ['#e8dcc4', 0.3, 0], ['#5a3a24', 0.4, 0], ['#8a6a4a', 0.4, 5], ['#6a5a50', 0.3, 6]];
        const pickC = SHELF[Math.floor(r() * SHELF.length)];
        for (let i = 0; i < n; i++) {
          const s = (K.size[0] + r() * (K.size[1] - K.size[0])) * (1.25 - i * 0.12), side = r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0;
          for (const off of side ? [0, side] : [0]) {
            const piece = new T.Group(), ss = s * (off ? 0.7 : 1);
            piece.position.set(0, 0.4 + i * 0.2 + r() * 0.07 + (off ? -0.05 : 0), 0); piece.rotation.y = (r() - 0.5) * 0.4 + off * 0.75; piece.scale.set(1, 0.9 + r() * 0.3, 0.7 + r() * 0.15); g.add(piece);
            const top = shade(new T.CylinderGeometry(ss, ss * 0.88, ss * 0.26, 18, 1, false, -Math.PI / 2, Math.PI), pickC[0], 0.9, pickC[1], pickC[2]);
            const sh = new T.Mesh(top, VC('shelf')); sh.castShadow = true; piece.add(sh);
            const under = new T.Mesh(new T.CircleGeometry(ss * 0.88, 18, 0, Math.PI).rotateX(Math.PI / 2), gillM); under.position.y = -ss * 0.131; piece.add(under);
            const rim = new T.Mesh(new T.TorusGeometry(ss * 0.95, ss * 0.04, 4, 18, Math.PI), M('#efe2c8')); rim.rotation.x = Math.PI / 2; rim.position.y = ss * 0.02; piece.add(rim);
          }
        }
        return g;
      }
      const prof = PROFILE[K.cap], GROW = 1.6;   // (one and a half times bigger than first made: easy to spot in the grass)
      for (let i = 0; i < n; i++) {
        const s = (K.size[0] + r() * (K.size[1] - K.size[0])) * GROW * (i === 0 ? 1.15 : 0.6 + r() * 0.5), a = r() * 6.28, d = ((K.tight ? 0.03 : 0.06) + r() * (K.tight ? 0.05 : 0.12) * (i ? 1 : 0.2)) * GROW;
        const stemH = s * (K.tall ? 2.6 : K.cap === 'trumpet' ? 0.9 : 1.5) * (0.8 + r() * 0.4), lean = (r() - 0.5) * 0.35 + (i ? 0.15 : 0), m = new T.Group();
        const stem = new T.Mesh(shade(new T.CylinderGeometry(s * (K.thick ? 0.32 : 0.16), s * (K.thick ? 0.42 : 0.2), stemH, 8), K.stem || K.gill, 0, -0.15, 0), VC('stem')); stem.position.y = stemH / 2; stem.castShadow = true; m.add(stem);
        const pts = prof.map(([px, py]) => new T.Vector2(px * s, py * s)).reverse(), cap = new T.Mesh(shade(new T.LatheGeometry(pts, 16), K.capC, K.cap === 'parasol' ? 0.2 : 0.6, 0.35, 0), VC('cap')); cap.position.y = stemH - s * 0.05; cap.castShadow = true; m.add(cap);
        if (K.glow) g.userData.glowMat = VC('cap');
        if (K.cap !== 'trumpet') { const gill = new T.Mesh(new T.CircleGeometry(s * (K.cap === 'bell' ? 0.84 : 0.96), 16).rotateX(Math.PI / 2), gillM); gill.position.y = stemH - s * 0.04; m.add(gill); }
        if (K.spots) for (let k = 0; k < 9; k++) { const sa = r() * 6.28, sr = 0.15 + r() * 0.6, sp = new T.Mesh(new T.SphereGeometry(s * 0.08, 5, 3), M(K.spots)); const py = prof.reduce((acc, [px, py2], j) => (j && px >= sr && acc == null ? py2 : acc), null) || prof[0][1]; sp.position.set(Math.cos(sa) * sr * s, stemH + py * s * 1.0, Math.sin(sa) * sr * s); sp.scale.y = 0.45; m.add(sp); }
        m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); m.rotation.set(Math.sin(a) * lean, r() * 6.28, -Math.cos(a) * lean); g.add(m);
      }
      return g;
    },
  };
})();
