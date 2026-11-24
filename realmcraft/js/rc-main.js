// RealmCraft: start a realm. Loads the realm's data, makes the sim, the view and the HUD, and runs.
(function () {
  const RC = window.RC;
  // Detail rings and quality, sized to the device (a phone gets smaller rings and less grass than a gaming PC),
  // and shrunk while the frame rate is low. near = full life every step; mid = every 3rd; far = every 8th.
  const phone = matchMedia('(pointer: coarse)').matches, cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
  const tier = phone || cores <= 4 || mem <= 4 ? 'low' : cores >= 12 ? 'high' : 'mid';
  RC.quality = {
    tier,
    rings: { low: { near: 16, mid: 32 }, mid: { near: 24, mid: 48 }, high: { near: 32, mid: 64 } }[tier],
    pixelRatio: { low: 1, mid: 1.5, high: 2 }[tier], shadowMap: { low: 1024, mid: 2048, high: 2048 }[tier], grass: { low: 0.35, mid: 0.7, high: 1 }[tier],
  };
  RC.settings = { seeThrough: 'silhouette' };   // how you show behind things: 'silhouette' (you, dimmed through them) or 'fade' (they fade)
  const urlQ = new URLSearchParams(location.search).get('quality'); if (urlQ === 'low' || urlQ === 'high') RC.quality.tier = urlQ;

  RC.boot = (realmId) => {
    const realm = (window.RC_REALMS || {})[realmId];
    if (!realm) { document.body.textContent = 'No realm called ' + realmId; return; }
    const sim = new RC.Sim(realm);
    const view = new RC.View(window.THREE, document.getElementById('stage'), realm, sim);
    RC.bindPointer(view.canvas);
    const hud = new RC.Hud(document.getElementById('ui'), sim, view);
    RC.sim = sim; RC.view = view; RC.hud = hud;   // (for the command layer and tests)
    let frames = 0, last = performance.now(), slow = 0;
    const base = Object.assign({}, RC.quality.rings);
    RC.start((dt) => sim.step(dt), (dt, t) => {
      view.draw(dt, t); hud.draw(); frames++;
      const n = performance.now();
      if (n - last > 1000) {   // under 40 frames a second for a while: smaller rings; back up when it's smooth again
        RC.fps = frames; frames = 0; last = n; slow = RC.fps < 40 ? slow + 1 : Math.max(0, slow - 1);
        const k = slow >= 3 ? 0.6 : 1; RC.quality.rings.near = base.near * k; RC.quality.rings.mid = base.mid * k;
      }
    });
  };
})();
