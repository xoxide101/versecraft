// Folk: real townspeople built with the anyCreature engine (MIT, vendor/anyCreature) — a people version of its creature specs.
//
//   node tools/folk/make_folk.js            → builds every body in BODIES, writes assets/folk/<name>.js (GLB as a data URL)
//   node tools/folk/make_folk.js man        → just one (and keeps the .glb in tools/folk/out/ to look at)
//
// One spec per body: a skeleton (hips, spine, chest, collar, neck, head; shoulders, elbows, wrists; hips, knees, ankles, toes),
// smooth volumes along it (torso, neck, head, hair, arms, legs, feet, a skirt for dresses), parts (hands with thumbs, eyes,
// nose, ears), and two clips: idle (breathing, a little sway) and move (a walk). Every piece of clothing is its own material
// (skin, hair, shirt, trousers, dress, apron, boots, belt), so the game can recolour each person from one body.
'use strict';
const fs = require('fs'), path = require('path');
const E = path.join(__dirname, '..', '..', '..', 'vendor', 'anyCreature', 'engine', 'core') + path.sep;
const { compile, drainInfo, useStack } = require(E + 'compile.js');
const { buildSkeleton, inverseBindMatrices, exportNames } = require(E + 'skeleton.js');
const { compileAnims } = require(E + 'anim.js');
const { runChecks } = require(E + 'checks.js');
const { writeGLB } = require(E + 'glb.js');

const mat = (color, rough = 0.85) => ({ color, rough });

// ---------------------------------------------------------------- the human spec
// o: { name, sex: 'm'|'f', height, build (0 slim .. 1 stout), dress, apron, hair: 'short'|'long'|'bun'|'bald', stoop, child }
function human(o) {
  const H = o.height, k = H / 1.75, f = o.sex === 'f', b = o.build ?? 0.4, ch = !!o.child;
  const S = (v) => +(v * k).toFixed(4);                  // scale a length from the 1.75 m adult
  const W = (v) => +(v * k * (0.9 + b * 0.25)).toFixed(4);   // a girth: grows with build
  const headK = ch ? 1.22 : 1;                            // children: bigger heads for their size
  const HD = (v) => +(v * k * headK).toFixed(4);
  const legK = ch ? 0.92 : 1;
  const j = {
    Hips: [0, S(0.97 * legK), 0],
    Spine: { from: 'Hips', up: S(0.14) },
    Chest: { from: 'Spine', up: S(0.21), fwd: S(o.stoop ? -0.03 : 0.005) },
    Collar: { from: 'Chest', up: S(0.15), fwd: S(o.stoop ? 0.05 : 0) },
    Neck: { from: 'Collar', up: S(0.055), fwd: S(o.stoop ? 0.04 : 0.01) },
    Head: { from: 'Neck', up: HD(0.1), fwd: HD(0.018) },
    Crown: { from: 'Head', up: HD(0.06), fwd: HD(-0.01) },
    HairB: { from: 'Head', up: HD(o.hair === 'long' ? -0.13 : 0.0), fwd: HD(-0.002) },
    HairT: { from: 'Head', up: HD(0.165), fwd: HD(-0.008) },
    Waist: { from: 'Hips', up: S(0.07) },
    Hem: { from: 'Hips', up: S(o.dress === 'long' ? -0.86 : -0.55), fwd: S(0.0) },
    LSh: { from: 'Collar', side: S(f ? 0.095 : 0.105), up: S(-0.06) },
    LElbow: { from: 'LSh', side: S(0.09), up: S(-0.28) },
    LWrist: { from: 'LElbow', side: S(0.005), up: S(-0.25), fwd: S(0.03) },
    LHip: { from: 'Hips', side: S(0.108), up: S(0.02) },
    LKnee: { from: 'LHip', up: S(-0.47 * legK), fwd: S(0.015) },
    LAnkle: { from: 'LKnee', up: S(-0.43 * legK), fwd: S(-0.02) },
    LHeel: { from: 'LAnkle', fwd: S(-0.055), ground: 0.03 },
    LToe: { from: 'LAnkle', fwd: S(0.16), ground: 0.03 },
  };
  if (!o.dress) { delete j.Waist; delete j.Hem; }
  delete j.HairB; delete j.HairT;   // (hair is put on in the game)
  const chains = { torso: ['Hips', 'Spine', 'Chest', 'Collar'], neck: ['Collar', 'Neck'], head: ['Neck', 'Head', 'Crown'], LArm: ['LSh', 'LElbow', 'LWrist'], LLeg: ['LHip', 'LKnee', 'LAnkle'], LFoot: ['LHeel', 'LToe'] };
  const attach = { neck: 'Collar', head: 'Neck', LArm: 'Collar', LLeg: 'Hips', LFoot: 'LAnkle' };
  if (o.dress) { chains.skirt = ['Waist', 'Hem']; attach.skirt = 'Hips'; }
  if (o.coat) { j.CoatW = { from: 'Hips', up: S(0.06) }; j.CoatHem = { from: 'Hips', up: S(-0.36) }; chains.coat = ['CoatW', 'CoatHem']; attach.coat = 'Hips'; }
  const top = o.dress ? 'dress' : o.coat ? 'coat' : 'shirt';
  const hipW = f ? 0.175 : 0.16, chestW = f ? 0.155 : 0.172, shW = f ? 0.15 : 0.168;
  const vols = [
    { chain: 'torso', material: top, frame: 'up', sides: 24, caps: ['dome', 'dome'], smooth_angle: 40,
      profile: [[0, W(hipW), W(0.11)], [0.2, W(hipW - 0.01), W(0.105)], [0.42, W(f ? 0.13 : 0.145), W(0.095)], [0.66, W(chestW), W(f ? 0.115 : 0.11)], [0.84, W(shW), W(0.112)], [0.95, W(shW * 0.62), W(0.09)], [1, S(0.07), S(0.065)]] },
    { chain: 'neck', material: 'skin', sides: 12, caps: ['dome', 'dome'], profile: [[0, S(0.062), S(0.062)], [1, S(0.054), S(0.056)]] },
    { chain: 'head', material: 'skin', sides: 10, caps: ['none', 'dome'], soft: true, profile: [[0, S(0.05), S(0.052)], [0.4, S(0.052), S(0.055)], [1, S(0.04), S(0.04)]] },   // (a core under the head the game puts on)
    { chain: 'LArm', material: top, sides: 12, caps: ['none', 'none'], smooth_angle: 45,
      profile: [[0, W(0.04), W(0.045)], [0.12, W(0.052), W(0.056)], [0.25, W(0.049), W(0.051)], [0.5, W(0.04), W(0.042)], [0.62, W(0.042), W(0.045)], [1, S(0.03), S(0.028)]] },
    { chain: 'LLeg', material: o.dress ? 'skin' : 'trousers', sides: 12, caps: ['dome', 'none'], smooth_angle: 45,
      profile: [[0, W(0.072), W(0.08)], [0.25, W(0.068), W(0.075)], [0.5, W(0.05), W(0.052)], [0.66, W(0.055), W(0.058)], [1, S(0.038), S(0.04)]] },
    { chain: 'LFoot', material: 'boots', frame: 'ground', sides: 10, caps: ['dome', 'dome'],
      profile: [[0, S(0.04), S(0.045)], [0.22, S(0.047), S(0.06)], [0.5, S(0.046), S(0.04)], [0.85, S(0.044), S(0.03)], [1, S(0.036), S(0.024)]] },   // (heel, the instep high over the ankle, down to the toe: a flat shoe)
  ];
  if (o.coat) vols.push({ chain: 'coat', material: 'coat', frame: 'up', sides: 22, caps: ['none', 'none'], smooth_angle: 40, soft: true,
    profile: [[0, W(0.168), W(0.118)], [0.3, W(0.19), W(0.14)], [1, W(0.235), W(0.19)]] });
  if (o.dress) vols.push({ chain: 'skirt', material: 'dress', frame: 'up', sides: 20, caps: ['none', 'none'], smooth_angle: 40, soft: true,
    profile: [[0, W(0.15), W(0.11)], [0.2, W(0.2), W(0.16)], [0.6, W(0.27), W(0.24)], [1, W(0.33), W(0.3)]] });
  const parts = [
    { name: 'hand', type: 'hand', host: 'LWrist', material: 'skin', mirrored: true, size: S(0.085), dir: [0.05, -1, 0.1], up: [1, 0, 0], curl: 0.3, spread: 0.25, join: 'extrude' },
  ];
  if (o.apron) parts.push({ name: 'apron', type: 'fin', host: 'Hips', material: 'apron', thickness: S(0.012), conform: false, anchor: { chain: 'torso', t: 0.25, around: 180 },
    udir: [1, 0, 0], vdir: [0, -1, 0.06], points: [[-W(0.15), -S(0.25)], [W(0.15), -S(0.25)], [W(0.19), S(0.42)], [-W(0.19), S(0.42)]] });
  // the walk: legs swing from the hip, knees bend on the forward swing, arms swing against the legs, a little bob and twist
  const stride = o.dress === 'long' ? 12 : o.dress ? 16 : ch ? 30 : 28, arm = o.stoop ? 10 : 16;
  const anims = {
    idle: { duration: 4, loop: true, tracks: { Chest: { rx: [[0, 0], [0.5, -1.5], [1, 0]] }, Head: { ry: [[0, 0], [0.3, 6], [0.7, -5], [1, 0]] }, LSh: { rx: [[0, 2], [0.5, 4], [1, 2]] }, LElbow: { rx: [[0, -8], [1, -8]] } } },
    move: { duration: 1.05, loop: true, mirror_phase: 0.5, tracks: {
      LHip: { rx: [[0, -stride], [0.5, stride], [1, -stride]] },   // (negative = forward: the heel strikes at 0, the foot sweeps back on the ground to 0.5, swings through the air back to the front)
      LKnee: { rx: [[0, 5], [0.2, 8], [0.62, 45], [0.82, 25], [1, 5]] },
      LAnkle: { rx: [[0, -8], [0.45, 12], [0.58, 16], [0.8, 0], [1, -8]] },   // (toes up at the heel strike, pushing off behind, level through the swing)
      LSh: { rx: [[0, arm], [0.5, -arm], [1, arm]] },
      LElbow: { rx: [[0, -10], [0.5, -22], [1, -10]] },
      Hips: { ty: [[0, 0], [0.25, S(0.025)], [0.5, 0], [0.75, S(0.025)], [1, 0]] },
      Spine: { ry: [[0, 4], [0.5, -4], [1, 4]] },
    } },
  };
  const range = { Hips: { ry: [-20, 20], rz: [-10, 10] }, Spine: { rx: [-20, 30], ry: [-30, 30] }, Chest: { rx: [-20, 30], ry: [-20, 20] }, Head: { rx: [-30, 30], ry: [-70, 70] },
    LSh: { rx: [-160, 60], ry: [-40, 40], rz: [-30, 160] }, LElbow: { rx: [-150, 0] }, LHip: { rx: [-90, 40], rz: [-10, 40] }, LKnee: { rx: [0, 140] }, LAnkle: { rx: [-40, 40] } };
  const palette = { skin: mat('#e0b090', 0.6), hair: mat('#5a3a22', 0.75), shirt: mat('#d8d0c0'), coat: mat('#5a3a28'), trousers: mat('#5a5048'), dress: mat('#7a8aa0'), apron: mat('#e8e0d0'), boots: mat('#4a3424', 0.7), eye: mat('#2a1e18', 0.2) };
  // shading: the plain ramp and a little grain, not the creature stack (that pushes colour for monsters: blue shadows, hot skin)
  const shading = { stack: false, gradient: { top: 0.05, bottom: -0.12 }, noise: { size: 0.008, amount: 0.06 } };
  return { name: o.name, height: H, palette, shading, smooth_angle: 45, joints: j, chains, attach, mirror: ['LArm', 'LLeg', 'LFoot'], volumes: vols, parts, animations: anims, joint_range: range,
    function: { torso: 'axis', LLeg: 'locomotion', LArm: 'ornament', head: 'ornament' } };
}

const BODIES = {
  man: { sex: 'm', height: 1.76, build: 0.45, hair: 'short' },
  hero: { sex: 'm', height: 1.78, build: 0.55, hair: 'short', coat: true },
  man_stout: { sex: 'm', height: 1.72, build: 0.95, hair: 'short', apron: true },
  woman: { sex: 'f', height: 1.64, build: 0.35, hair: 'bun', dress: 'long', apron: true },
  woman_long: { sex: 'f', height: 1.66, build: 0.3, hair: 'long', dress: 'mid' },
  elder_m: { sex: 'm', height: 1.68, build: 0.4, hair: 'bald', stoop: true },
  elder_f: { sex: 'f', height: 1.58, build: 0.5, hair: 'bun', dress: 'long', stoop: true },
  boy: { sex: 'm', height: 1.2, build: 0.3, hair: 'short', child: true },
  girl: { sex: 'f', height: 1.15, build: 0.3, hair: 'long', dress: 'mid', child: true },
};

function build(name, keep) {
  const spec = Object.assign(human(Object.assign({ name }, BODIES[name])), { embed_spec: false });
  require(E + 'relative.js').resolveJoints(spec);
  const sk = buildSkeleton(spec);
  // the engine hangs a mirrored chain on the same host as its left twin (fine on the body's centre line); a right foot must hang
  // on the right ankle, not the left one: move every R joint whose parent is an L joint onto that joint's R twin
  for (const jn of sk.joints) { if (!jn.name.startsWith('R') || jn.parent < 0) continue; const pn = sk.joints[jn.parent].name; if (pn.startsWith('L') && sk.index['R' + pn.slice(1)] != null) jn.parent = sk.index['R' + pn.slice(1)]; }
  const meshes = compile(spec);
  const info = drainInfo();
  const { fails, warns } = runChecks(spec, sk, meshes, null);
  for (const f of fails) console.log(`  [${name}] check: ${f}`);   // (creature rules: read, not obeyed blindly — people are not attack-ready beasts)
  if (process.env.FOLK_VERBOSE) { for (const w of warns) console.log(`  [${name}] warn: ${w}`); for (const l of info) console.log(`  [${name}] info: ${l}`); }
  const anims = compileAnims(spec, sk);
  const STACK = useStack(spec), aoCfg = STACK ? { multiply: false } : spec.ao;
  require(E + 'ao.js').bakeAO(meshes, aoCfg);
  if (STACK) require(E + 'shade.js').shadeStack(spec, meshes, []);
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  const glb = path.join(out, name + '.glb');
  writeGLB({ meshes, skeleton: sk, ibm: inverseBindMatrices(sk), anims }, glb, { asset: { generator: 'RealmCraft folk (anyCreature engine)' }, names: exportNames(spec, sk), boneNormals: STACK ? 0.9 : 0, spans: false });
  const bytes = fs.readFileSync(glb), dest = path.join(__dirname, '..', '..', 'assets', 'folk'); fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, name + '.js'), `// folk body '${name}' (built by tools/folk/make_folk.js with the anyCreature engine, MIT)\n(window.RC_FOLK = window.RC_FOLK || {})[${JSON.stringify(name)}] = 'data:model/gltf-binary;base64,${bytes.toString('base64')}';\n`);
  if (!keep) fs.unlinkSync(glb);
  const v = meshes.reduce((a, m) => a + m.V.length, 0), fc = meshes.reduce((a, m) => a + m.F.length, 0);
  console.log(`${name.padEnd(11)} ${String(v).padStart(6)} verts ${String(fc).padStart(6)} faces  ${sk.joints.length} joints  ${(bytes.length / 1024) | 0} KB  anims: ${anims.map((a) => a.name).join(', ')}`);
}

const want = process.argv[2];
for (const n of want ? [want] : Object.keys(BODIES)) build(n, !!want);
