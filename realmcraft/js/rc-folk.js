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
  // ---- what the clothes and skin are made of: drawn textures (woven linen, wool, leather, skin), laid on the body from three
  // sides by where each point sits on the body at rest (so the cloth moves with the person), plus folds that hang down
  const TEX = {};
  const canvas = (S, draw) => { const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S); return c; };
  const clothTex = (kind) => {
    if (TEX[kind]) return TEX[kind];
    const S = 256, rnd = RC.rng(kind.length * 0.13);
    const c = canvas(S, (g) => {
      if (kind === 'linen' || kind === 'wool') {   // threads over and under, slubs, a little fuzz
        g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S); const step = kind === 'wool' ? 6 : 4;
        for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) { const over = ((x + y) / step) % 2 < 1, v = 190 + (rnd() * 50 | 0); g.fillStyle = `rgb(${v},${v},${v})`; if (over) g.fillRect(x, y + 1, step, step - 2); else g.fillRect(x + 1, y, step - 2, step); }
        for (let i = 0; i < (kind === 'wool' ? 900 : 260); i++) { const v = 150 + (rnd() * 100 | 0); g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = kind === 'wool' ? 1.5 : 1; g.beginPath(); const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, l = kind === 'wool' ? 6 : 14; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      } else if (kind === 'leather') {   // pebbled grain, a few creases
        g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 2600; i++) { const v = 150 + (rnd() * 90 | 0); g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1 + rnd() * 2.2, 0, 6.28); g.fill(); }
        for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(90,90,90,0.35)'; g.lineWidth = 1; g.beginPath(); let x = rnd() * S, y = rnd() * S; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 12; g.lineTo(x, y); } g.stroke(); }
      } else {   // skin: very soft mottling and pores
        g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 300; i++) { const v = 205 + (rnd() * 40 | 0); g.fillStyle = `rgba(${v},${v - 6},${v - 8},0.25)`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 4 + rnd() * 14, 0, 6.28); g.fill(); }
        for (let i = 0; i < 3000; i++) { g.fillStyle = 'rgba(150,120,110,0.18)'; g.fillRect(rnd() * S, rnd() * S, 1, 1); }
      }
    });
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (TEX[kind] = t);
  };
  const KIND = { shirt: 'linen', dress: 'linen', apron: 'linen', coat: 'wool', trousers: 'wool', boots: 'leather', skin: 'skin' };
  const SCALE = { linen: 7, wool: 5, leather: 9, skin: 4 };
  // add the cloth to a body material: colour from the weave, relief from it (bump), and folds hanging down the cloth
  const clothe = (m, name) => {
    const kind = KIND[name]; if (!kind) return m;
    const tex = clothTex(kind), sc = SCALE[kind], folds = kind === 'skin' || kind === 'leather' ? 0 : kind === 'wool' ? 0.8 : 1;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tCloth = { value: tex };
      sh.vertexShader = 'varying vec3 vFoP; varying vec3 vFoN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFoP = position; vFoN = normal;');
      sh.fragmentShader = 'uniform sampler2D tCloth; varying vec3 vFoP; varying vec3 vFoN;\n' +
        'float foN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5); float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5); float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5); float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }\n' +
        sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec3 fw = abs(normalize(vFoN)); fw = pow(fw, vec3(4.0)); fw /= (fw.x + fw.y + fw.z);
          vec3 tp = vFoP * ${sc.toFixed(1)};
          float wv = dot(vec3(texture2D(tCloth, tp.zy).r, texture2D(tCloth, tp.xz).r, texture2D(tCloth, tp.xy).r), fw);
          vec3 wc = texture2D(tCloth, tp.zy).rgb * fw.x + texture2D(tCloth, tp.xz).rgb * fw.y + texture2D(tCloth, tp.xy).rgb * fw.z;
          diffuseColor.rgb *= mix(vec3(1.0), wc * 1.12, ${kind === 'skin' ? '0.35' : '0.55'});
          // folds: soft vertical drapes, more toward the hem, broken by noise
          float around = atan(vFoP.x, vFoP.z + 0.0001) * 3.0;
          float fold = ${folds.toFixed(2)} * (sin(around * 2.6 + foN(vec2(around, vFoP.y * 6.0)) * 3.0) * 0.5 + 0.5) * (0.55 + 0.45 * foN(vec2(around * 0.7, vFoP.y * 3.0)));
          diffuseColor.rgb *= 1.0 - fold * 0.26;
          // wear: blotches of fading and soil, dirtier toward the hems and the ground, a little sun-faded over the shoulders
          float blot = foN(vFoP.xy * 9.0 + vFoP.z * 5.0) * 0.6 + foN(vFoP.zy * 23.0) * 0.4;
          diffuseColor.rgb *= ${kind === 'skin' ? '1.0' : '(0.9 + blot * 0.2)'} * (1.0 - ${kind === 'skin' ? '0.0' : '0.22'} * (1.0 - smoothstep(0.05, 0.55, vFoP.y)));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.06, 1.0) + 0.02, ${kind === 'skin' ? '0.0' : '0.5'} * smoothstep(1.2, 1.5, vFoP.y));
          float foH = wv * ${kind === 'skin' ? '0.15' : '0.6'} + fold * 1.4;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1) * faceDirection;
            vec3 grad = sign(det) * (dFdx(foH * 0.004) * R1 + dFdy(foH * 0.004) * R2); normal = normalize(abs(det) * normal - grad); }`);
    };
    m.customProgramCacheKey = () => 'folkcloth' + kind; return m;
  };
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
      if (isPlayer) return 'hero';
      if (age === 'child' || age === 'infant') return sex === 'f' ? 'girl' : 'boy';
      if (age === 'elder') return sex === 'f' ? 'elder_f' : 'elder_m';
      if (sex === 'f') return def.job === 'serve' || def.job === 'baker' || def.job === 'garden' ? 'woman' : (h * 7) % 1 < 0.5 ? 'woman_long' : 'woman';
      return def.job === 'hammer' || def.job === 'baker' || def.job === 'carry crates' || (h * 13) % 1 < 0.3 ? 'man_stout' : 'man';
    },
    // a person's body: returns { root, bones, mixer, actions, ready } — the root can be placed at once; the body arrives when loaded
    make(def, look, isPlayer) {
      const root = new THREE.Group(), name = RC.Folk.bodyFor(def, isPlayer), seed = RC.hash((def.id || 'p').length * 3.1, (def.id || 'p').charCodeAt(1) || 7, 11);
      const out = { root, name, bones: {}, mixer: null, actions: {}, ready: false, small: [] };
      RC.Folk.load(name).then((gltf) => {
        const body = skinnedClone(gltf.scene); body.rotation.y = 0; root.add(body);
        const pick = (a, k) => a[Math.floor(RC.hash(seed * 100, k, 3) * a.length) % a.length];
        const elder = /elder/.test(name);
        const C = { skin: new THREE.Color(look.skin || pick(SKIN, 1)), hair: new THREE.Color(elder ? pick(GREY, 2) : look.hair && !/^#e2e8f0$/i.test(look.hair) ? cloth(look.hair, 0.2) : pick(HAIR, 2)),
          shirt: look.tunic ? cloth(look.tunic, 0.45) : new THREE.Color('#d8cfbe'), coat: isPlayer ? cloth(look.tunic || '#2a3a5a', 0.35).multiplyScalar(0.9) : new THREE.Color('#5a3a28'), dress: look.tunic ? cloth(look.tunic, 0.4) : new THREE.Color('#6a7a8c'),
          trousers: new THREE.Color(pick(['#4a4038', '#3e3a36', '#5a5040', '#38404a', '#5a4a3a'], 4)), apron: new THREE.Color(pick(['#e8e0d0', '#d8ccb4', '#c8b8a0'], 5)), boots: new THREE.Color(pick(['#3a2818', '#2a1e16', '#4a3422'], 6)) };
        if (/stout/.test(name) && (def.job === 'hammer')) C.apron = new THREE.Color('#5a3a22');   // the smith's leather apron
        body.traverse((o) => {
          if (o.isBone) out.bones[o.name] = o;
          if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.3); o.frustumCulled = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const nm = mats.map((m) => { const c = m.clone(); if (C[m.name]) c.color.copy(C[m.name]); c.roughness = m.name === 'skin' ? 0.55 : m.name === 'eye' ? 0.15 : m.name === 'boots' ? 0.6 : 0.88; c.vertexColors = true; return clothe(c, m.name); });
          o.material = Array.isArray(o.material) ? nm : nm[0];
        });
        // ---- the head (rc-folkhead.js) on the Head bone, and the clothes' details on the body
        const T = THREE, B = out.bones, man = /^man|elder_m|boy|hero/.test(name), fem = !man, kid = /boy|girl/.test(name), job = def.job || '';
        const styles = { hero: ['short'], man: ['short', 'crop', 'short'], man_stout: ['short', 'crop'], woman: ['bun'], woman_long: ['long'], elder_m: ['bald', 'short', 'bald'], elder_f: ['bun'], boy: ['short', 'crop'], girl: ['long'] }[name] || ['short'];
        const beard = isPlayer ? 0 : man && !kid ? (elder ? (RC.hash(seed, 9, 1) < 0.7 ? 2 : 0) : RC.hash(seed, 9, 2) < 0.38 ? 1 + (RC.hash(seed, 9, 3) < 0.4 ? 1 : 0) : 0) : 0;
        const hat = job === 'patrol' ? 'helmet' : job === 'garden' || job === 'fish' ? 'straw' : man && !kid && RC.hash(seed, 9, 4) < 0.25 ? 'cap' : fem && !kid && RC.hash(seed, 9, 5) < (elder ? 0.6 : 0.25) ? 'coif' : null;
        const head = RC.FolkHead.build(T, { skin: C.skin, hair: C.hair, iris: pick(['#5a4028', '#3a5a7a', '#4a6a4a', '#6a5a3a', '#2a2018', '#7a8a9a'], 7), style: isPlayer ? 'short' : pick(styles, 8), beard, sex: fem ? 'f' : 'm', child: kid, hat, hatColor: pick(['#4a4440', '#5a4a3a', '#3a4a5a'], 10), seed });
        if (B.Head) B.Head.add(head.group); out.head = head;
        // measure the body where a piece goes: how wide and how deep it is at a height (in the bind pose)
        body.updateMatrixWorld(true);
        const geo = [], bp = (n) => { const v = new T.Vector3(); B[n].getWorldPosition(v); return body.worldToLocal(v); };
        body.traverse((m) => { if (m.isSkinnedMesh) { const trunk = new Set(m.skeleton.bones.map((b2, i) => (/^(Hips|Spine|Chest|Collar|Waist|Hem|CoatW|CoatHem)$/.test(b2.name) ? i : -1)).filter((i) => i >= 0)); geo.push({ ge: m.geometry, trunk }); } });
        const at = (y, band = 0.012) => { let rx = 0, zf = -1, zb = 1; for (const { ge, trunk } of geo) { const P = ge.attributes.position, SI = ge.attributes.skinIndex, SW = ge.attributes.skinWeight; for (let i = 0; i < P.count; i++) { const py = P.getY(i); if (Math.abs(py - y) > band) continue; const x = P.getX(i), z = P.getZ(i);
            if (SI) { let bi = SI.getX(i), bw = SW.getX(i); for (const [c, w] of [[SI.getY(i), SW.getY(i)], [SI.getZ(i), SW.getZ(i)], [SI.getW(i), SW.getW(i)]]) if (w > bw) { bw = w; bi = c; } if (!trunk.has(bi)) continue; }   /* (the body's trunk only: not the arms hanging beside it) */ rx = Math.max(rx, Math.abs(x)); zf = Math.max(zf, z); zb = Math.min(zb, z); } } return { rx, zf, zb, cz: (zf + zb) / 2, rz: (zf - zb) / 2 }; };
        const on = (bone, mesh, wp) => { const b0 = bp(bone); mesh.position.set(wp.x - b0.x, wp.y - b0.y, wp.z - b0.z); B[bone].add(mesh); mesh.castShadow = false; if (mesh.geometry && mesh.geometry.type === 'SphereGeometry' || mesh.geometry && mesh.geometry.parameters && mesh.geometry.parameters.width < 0.06) out.small.push(mesh); return mesh; };   // (small things, the buttons and buckle, go when far away)
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
        if (isPlayer && B.Chest && B.Hips) {
          const s = at(chestY + 0.02, 0.03), str = new T.Mesh(new T.TorusGeometry(1, 0.018, 4, 40), leather); str.scale.set(s.rx * 1.25, (collarY - hipY) * 0.62, s.rz * 1.05 + 0.02); str.rotation.set(0, Math.PI / 2, 0); str.rotateX(0); const holder = new T.Group(); holder.add(str); holder.rotation.z = -0.62; holder.rotation.y = 0;   // (over the right shoulder, down to the left hip, round the back)
          str.rotation.set(0, 0, 0); str.scale.set(s.rx * 1.18, (collarY - hipY) * 0.55, s.rz * 1.05 + 0.018); holder.rotation.set(0, 0, -0.62); on('Chest', holder, new T.Vector3(0.0, (chestY + hipY) / 2 + 0.06, s.cz));
          const sw = new T.Group(), steel = new T.MeshStandardMaterial({ color: '#c8ccd4', metalness: 0.85, roughness: 0.3 });
          const sc = new T.Mesh(new T.CylinderGeometry(0.024, 0.016, 0.64, 10), leather); sc.scale.z = 0.45; sc.position.y = -0.32; sw.add(sc);
          const tip = new T.Mesh(new T.ConeGeometry(0.02, 0.05, 10), brass); tip.rotation.x = Math.PI; tip.position.y = -0.66; tip.scale.z = 0.45; sw.add(tip);
          const guard = new T.Mesh(new T.BoxGeometry(0.16, 0.022, 0.03), brass); guard.position.y = 0.012; sw.add(guard);
          const grip = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.11, 8), new T.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.8 })); grip.position.y = 0.08; sw.add(grip);
          const pom = new T.Mesh(new T.SphereGeometry(0.022, 10, 8), brass); pom.position.y = 0.145; sw.add(pom);
          const hs = at(hipY + 0.02); sw.rotation.set(0.35, 0, 0.12); on('Hips', sw, new T.Vector3(hs.rx + 0.03, hipY + 0.05, hs.cz - 0.02)); sw.traverse((m) => (m.castShadow = true));
        }
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
