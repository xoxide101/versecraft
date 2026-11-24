// Weather that stays: rain wets everything (darker, glossier) and pools into puddles on the ground; snow settles on
// whatever faces up (ground, roofs, leaves, walls' tops), patchy at first, then covering; both fade after the weather
// passes. Done by adding a little to every material's shader once the scene is built: two shared amounts, uWet and uSnow.
(function () {
  const RC = window.RC;
  const VERT = `
    #ifdef USE_INSTANCING
    vWxW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
    vWxW = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif`;
  const FRAG_HEAD = `uniform float uWet; uniform float uSnow; varying vec3 vWxW;
    float wxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float wxNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(wxHash(i), wxHash(i + vec2(1, 0)), f.x), mix(wxHash(i + vec2(0, 1)), wxHash(i + vec2(1, 1)), f.x), f.y); }
    float wxFbm(vec2 p) { return wxNoise(p) * 0.55 + wxNoise(p * 2.3) * 0.3 + wxNoise(p * 5.1) * 0.15; }
    float wxPuddle = 0.0;\n`;
  const FRAG_BODY = (puddles) => `
    {
      vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      float facing = clamp(dot(normal, upV), -1.0, 1.0);
      // wet: darker and glossier, most on what faces the sky
      float wet = uWet * (0.55 + 0.45 * max(facing, 0.0));
      diffuseColor.rgb *= 1.0 - 0.32 * wet; roughnessFactor = mix(roughnessFactor, 0.32, wet * 0.75);
      ${puddles ? `
      // puddles: where the ground is lowest-lying in the noise, growing with the rain
      float pd = wxFbm(vWxW.xz * 0.45 + 17.0);
      float puddle = smoothstep(1.0 - uWet * 0.42, 1.0 - uWet * 0.42 + 0.05, pd) * step(0.7, facing);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.35 + vec3(0.03, 0.04, 0.05), puddle);
      roughnessFactor = mix(roughnessFactor, 0.1, puddle); wxPuddle = puddle; normal = normalize(mix(normal, upV, puddle * 0.9));` : ''}
      // snow: settles in patches first (the noise), then everywhere that faces up
      float sn = wxFbm(vWxW.xz * 0.7) * 0.55 + max(facing, 0.0) * 0.45;
      float snow = smoothstep(1.02 - uSnow * 1.1, 1.1 - uSnow * 1.1, sn) * smoothstep(0.15, 0.45, facing);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), snow); roughnessFactor = mix(roughnessFactor, 0.85, snow);
    }`;
  RC.weatherize = (scene, shared) => {
    shared.uWet = shared.uWet || { value: 0 }; shared.uSnow = shared.uSnow || { value: 0 };
    const done = new Set();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || done.has(m) || !(m.isMeshStandardMaterial) || m.userData.noWeather || m.userData.wx) continue; done.add(m); m.userData.wx = true;   // (once per material)
        const before = m.onBeforeCompile, key = m.customProgramCacheKey && m.customProgramCacheKey !== Object.getPrototypeOf(m).customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null, puddles = !!m.userData.puddles;
        m.onBeforeCompile = (sh, r) => {
          if (before) before.call(m, sh, r);
          sh.uniforms.uWet = shared.uWet; sh.uniforms.uSnow = shared.uSnow;
          sh.vertexShader = 'varying vec3 vWxW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + VERT);
          sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + FRAG_BODY(puddles))
            .replace('#include <opaque_fragment>', puddles ? '  outgoingLight = mix(outgoingLight, vec3(dot(outgoingLight, vec3(0.3, 0.5, 0.2))) * vec3(0.92, 0.96, 1.0), wxPuddle * 0.85);\n#include <opaque_fragment>' : '#include <opaque_fragment>');   // (puddles mirror a grey sky, not a blue one)
        };
        m.customProgramCacheKey = () => (key ? key() : m.type + (before ? String(before) : '')) + '|wx' + (puddles ? 'p' : '');   // (a material's own shader changes stay part of its name: two different ones must never share a program)
        m.needsUpdate = true;
      }
    });
  };
  // how much is lying about: builds while it rains or snows, fades after (melting faster than it settles)
  RC.weatherStep = (state, sim, dt) => {   // (by how hard it is coming down right now: a drizzle barely wets, a downpour soaks)
    const p = sim.precip || 0, s = sim.snowfall || 0;
    state.wet = RC.clamp(state.wet + dt * (p > 0.03 ? p / 26 : s > 0.03 ? -1 / 400 : -1 / 160), 0, 1);
    state.snow = RC.clamp(state.snow + dt * (s > 0.03 ? s / 70 : -1 / (p > 0.03 ? 60 : 220)), 0, 1);
  };
})();
