// Folk: the townspeople's bodies (assets/folk/*.js, built by tools/folk/make_folk.js with the anyCreature engine).
// Each body is one smooth skinned mesh with a skeleton and two clips (idle, move). Every person gets their own copy,
// their own colours (skin, hair, clothes, picked steadily from who they are), and their own animation mixer.
(function () {
  const RC = window.RC;
  const cache = {};   // body name → Promise<gltf>
  const b64 = (u) => { const s = atob(u.slice(u.indexOf(',') + 1)), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a.buffer; };
  // a copy of a skinned model that has its own skeleton (what SkeletonUtils.clone does)
  const skinnedClone = (src) => {
    const map = new Map(), clone = src.clone(true);
    const walk = (a, b) => { map.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); }; walk(src, clone);
    clone.traverse((o) => { if (!o.isSkinnedMesh) return; let s0 = null; for (const [a, b] of map) if (b === o) s0 = a;
      const sk = s0.skeleton, bones = sk.bones.map((bn) => map.get(bn)); o.bind(new THREE.Skeleton(bones, sk.boneInverses), s0.bindMatrix); });
    return clone;
  };
  const SKIN = ['#f8dcc8', '#f2d0b6', '#eac2a4', '#e2b696', '#d8a884', '#c99474', '#b07a5c', '#8a5a40'];   // (most of the town fair to olive, some darker)
  const HAIR = ['#2a1c14', '#3e2a1a', '#5a3a22', '#7a5230', '#a07040', '#c8a060', '#8a3a1c', '#1c1612'];
  const GREY = ['#b8b4ac', '#d8d6d0', '#9a968e'];
  // web colours in the data (bright blues and greens) toned into dyed cloth: a little greyer and darker
  const cloth = (c, k = 0.4) => { const x = new THREE.Color(c), g = (x.r + x.g + x.b) / 3; x.lerp(new THREE.Color(g, g, g), k).multiplyScalar(0.82); return x; };
  RC.Folk = {
    has: () => !!window.RC_FOLK && Object.keys(window.RC_FOLK).length > 0,
    load(name) {
      if (cache[name]) return cache[name];
      const url = (window.RC_FOLK || {})[name]; if (!url) return Promise.reject(new Error('no folk body ' + name));
      return (cache[name] = new Promise((ok, no) => new THREE.GLTFLoader().parse(b64(url), '', ok, no)));
    },
    // which body for a person: by age, sex (from the data, or steadily from their id), and job
    bodyFor(def, isPlayer) {
      const h = RC.hash(String(def.id || def.name || '').length * 7.3, (def.id || 'x').charCodeAt(0), 5), sex = def.sex || (h < 0.5 ? 'f' : 'm'), age = def.age || 'adult';
      if (isPlayer) return 'man';
      if (age === 'child' || age === 'infant') return sex === 'f' ? 'girl' : 'boy';
      if (age === 'elder') return sex === 'f' ? 'elder_f' : 'elder_m';
      if (sex === 'f') return def.job === 'serve' || def.job === 'baker' || def.job === 'garden' ? 'woman' : (h * 7) % 1 < 0.5 ? 'woman_long' : 'woman';
      return def.job === 'hammer' || def.job === 'baker' || def.job === 'carry crates' || (h * 13) % 1 < 0.3 ? 'man_stout' : 'man';
    },
    // a person's body: returns { root, bones, mixer, actions, ready } — the root can be placed at once; the body arrives when loaded
    make(def, look, isPlayer) {
      const root = new THREE.Group(), name = RC.Folk.bodyFor(def, isPlayer), seed = RC.hash((def.id || 'p').length * 3.1, (def.id || 'p').charCodeAt(1) || 7, 11);
      const out = { root, name, bones: {}, mixer: null, actions: {}, ready: false };
      RC.Folk.load(name).then((gltf) => {
        const body = skinnedClone(gltf.scene); body.rotation.y = 0; root.add(body);
        const pick = (a, k) => a[Math.floor(RC.hash(seed * 100, k, 3) * a.length) % a.length];
        const elder = /elder/.test(name);
        const C = { skin: new THREE.Color(look.skin || pick(SKIN, 1)), hair: new THREE.Color(elder ? pick(GREY, 2) : look.hair && !/^#e2e8f0$/i.test(look.hair) ? cloth(look.hair, 0.2) : pick(HAIR, 2)),
          shirt: look.tunic ? cloth(look.tunic, 0.45) : new THREE.Color('#d8cfbe'), dress: look.tunic ? cloth(look.tunic, 0.4) : new THREE.Color('#6a7a8c'),
          trousers: new THREE.Color(pick(['#4a4038', '#3e3a36', '#5a5040', '#38404a', '#5a4a3a'], 4)), apron: new THREE.Color(pick(['#e8e0d0', '#d8ccb4', '#c8b8a0'], 5)), boots: new THREE.Color(pick(['#3a2818', '#2a1e16', '#4a3422'], 6)) };
        if (/stout/.test(name) && (def.job === 'hammer')) C.apron = new THREE.Color('#5a3a22');   // the smith's leather apron
        body.traverse((o) => {
          if (o.isBone) out.bones[o.name] = o;
          if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const nm = mats.map((m) => { const c = m.clone(); if (C[m.name]) c.color.copy(C[m.name]); c.roughness = m.name === 'skin' ? 0.55 : m.name === 'eye' ? 0.15 : 0.85; c.vertexColors = true; return c; });
          o.material = Array.isArray(o.material) ? nm : nm[0];
        });
        // ---- the head (rc-folkhead.js) on the Head bone, and the clothes' details on the body
        const T = THREE, B = out.bones, man = /^man|elder_m|boy/.test(name), fem = !man, kid = /boy|girl/.test(name), job = def.job || '';
        const styles = { man: ['short', 'crop', 'short'], man_stout: ['short', 'crop'], woman: ['bun'], woman_long: ['long'], elder_m: ['bald', 'short', 'bald'], elder_f: ['bun'], boy: ['short', 'crop'], girl: ['long'] }[name] || ['short'];
        const beard = man && !kid ? (elder ? (RC.hash(seed, 9, 1) < 0.7 ? 2 : 0) : RC.hash(seed, 9, 2) < 0.38 ? 1 + (RC.hash(seed, 9, 3) < 0.4 ? 1 : 0) : 0) : 0;
        const hat = job === 'patrol' ? 'helmet' : job === 'garden' || job === 'fish' ? 'straw' : man && !kid && RC.hash(seed, 9, 4) < 0.25 ? 'cap' : fem && !kid && RC.hash(seed, 9, 5) < (elder ? 0.6 : 0.25) ? 'coif' : null;
        const head = RC.FolkHead.build(T, { skin: C.skin, hair: C.hair, iris: pick(['#5a4028', '#3a5a7a', '#4a6a4a', '#6a5a3a', '#2a2018', '#7a8a9a'], 7), style: pick(styles, 8), beard, sex: fem ? 'f' : 'm', child: kid, hat, hatColor: pick(['#4a4440', '#5a4a3a', '#3a4a5a'], 10), seed });
        if (B.Head) B.Head.add(head.group); out.head = head;
        // measure the body where a piece goes: how wide and how deep it is at a height (in the bind pose)
        body.updateMatrixWorld(true);
        const geo = [], bp = (n) => { const v = new T.Vector3(); B[n].getWorldPosition(v); return body.worldToLocal(v); };
        body.traverse((m) => { if (m.isSkinnedMesh) { const trunk = new Set(m.skeleton.bones.map((b2, i) => (/^(Hips|Spine|Chest|Collar|Waist|Hem)$/.test(b2.name) ? i : -1)).filter((i) => i >= 0)); geo.push({ ge: m.geometry, trunk }); } });
        const at = (y, band = 0.012) => { let rx = 0, zf = -1, zb = 1; for (const { ge, trunk } of geo) { const P = ge.attributes.position, SI = ge.attributes.skinIndex, SW = ge.attributes.skinWeight; for (let i = 0; i < P.count; i++) { const py = P.getY(i); if (Math.abs(py - y) > band) continue; const x = P.getX(i), z = P.getZ(i);
            if (SI) { let bi = SI.getX(i), bw = SW.getX(i); for (const [c, w] of [[SI.getY(i), SW.getY(i)], [SI.getZ(i), SW.getZ(i)], [SI.getW(i), SW.getW(i)]]) if (w > bw) { bw = w; bi = c; } if (!trunk.has(bi)) continue; }   /* (the body's trunk only: not the arms hanging beside it) */ rx = Math.max(rx, Math.abs(x)); zf = Math.max(zf, z); zb = Math.min(zb, z); } } return { rx, zf, zb, cz: (zf + zb) / 2, rz: (zf - zb) / 2 }; };
        const on = (bone, mesh, wp) => { const b0 = bp(bone); mesh.position.set(wp.x - b0.x, wp.y - b0.y, wp.z - b0.z); B[bone].add(mesh); mesh.castShadow = true; return mesh; };
        const leather = new T.MeshStandardMaterial({ color: pick(['#3a2414', '#4a2e1a', '#2a1a10'], 11), roughness: 0.7 }), brass = new T.MeshStandardMaterial({ color: '#c8a048', metalness: 0.8, roughness: 0.35 });
        const ringAround = (y, m, tube, grow = 1.04, bone = 'Hips') => { const s = at(y); if (!s.rx) return null; const tor = new T.Mesh(new T.TorusGeometry(1, tube, 6, 32).rotateX(Math.PI / 2), m); tor.scale.set(s.rx * grow + tube, 1, s.rz * grow + tube); return on(bone, tor, new T.Vector3(0, y, s.cz)); };
        const hipY = bp('Hips').y, chestY = bp('Chest').y, collarY = bp('Collar').y;
        if (!/woman|elder_f|girl/.test(name)) {   // trousers: a leather belt with a brass buckle at the waist
          const by = hipY + 0.07 * (kid ? 0.7 : 1), belt = ringAround(by, leather, 0.014, 1.03);
          if (belt) { const s = at(by); on('Hips', new T.Mesh(new T.BoxGeometry(0.045, 0.04, 0.012), brass), new T.Vector3(0, by, s.zf + 0.012)); }
          // shirt buttons down the front, and a collar
          for (let i = 0; i < 4; i++) { const y = by + 0.08 + i * ((collarY - 0.06 - by - 0.08) / 3), s = at(y); if (!s.rx) continue; on(y > chestY ? 'Chest' : 'Spine', new T.Mesh(new T.SphereGeometry(0.0065, 8, 6), new T.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.5 })), new T.Vector3(0, y, s.zf + 0.002)); }
        } else {   // a dress: a sash at the waist, lacing up the bodice
          const wy = bp('Spine').y + 0.02, sash = new T.MeshStandardMaterial({ color: C.dress.clone().offsetHSL(0.5, 0, -0.12), roughness: 0.8 }); ringAround(wy, sash, 0.016, 1.03, 'Spine');
          const s0 = at(wy + 0.12); if (s0.rx) for (let i = 0; i < 4; i++) { const y = wy + 0.05 + i * 0.045, s = at(y); const lace = new T.Mesh(new T.BoxGeometry(0.04, 0.004, 0.004), leather); lace.rotation.z = i % 2 ? 0.5 : -0.5; on('Chest', lace, new T.Vector3(0, y, s.zf + 0.003)); }
        }
        { const cy = collarY - 0.005, s = at(cy, 0.02); if (s.rx) { const col = new T.Mesh(new T.TorusGeometry(1, 0.012, 6, 28).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: (fem ? C.dress : C.shirt).clone().multiplyScalar(1.12), roughness: 0.85 })); col.scale.set(Math.min(s.rx, 0.075), 1, Math.min(s.rz, 0.07)); on('Collar', col, new T.Vector3(0, cy, s.cz)); } }
        for (const w of ['LArm1Wr', 'RArm1Wr']) if (B[w]) { const cuff = new T.Mesh(new T.TorusGeometry(0.033 * (kid ? 0.75 : 1), 0.008, 6, 20).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: (fem ? C.dress : C.shirt).clone().multiplyScalar(0.9), roughness: 0.85 })); cuff.position.set(0, 0.035, 0); B[w].add(cuff); }
        out.mixer = new THREE.AnimationMixer(body);
        for (const clip of gltf.animations) { const a = out.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(clip.name === 'idle' ? 1 : 0); out.actions[clip.name] = a; }
        out.mixer.update(seed * 3);   // (everyone out of step)
        out.ready = true; if (out.onReady) out.onReady(out);
      }).catch((e) => console.warn('folk', name, e));
      return out;
    },
  };
})();
