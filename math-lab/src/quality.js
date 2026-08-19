// quality.js â€” performance settings, FPS meter, and auto-degrade.
//
// One plain object drives every performance knob in the app. High is the
// default; LOW is entered two ways:
//   1. explicitly: open the app with ?quality=low (client demo laptops)
//   2. automatically: the monitor watches real FPS and drops ONCE if the
//      machine can't hold 45 fps for 3 consecutive seconds.
// Pure DOM + numbers â€” no Three.js import, so effects can import this without
// creating a dependency cycle.

export const quality = {
  level: 'high',        // 'high' | 'low'
  particleScale: 1,     // multiplies every effect's particle count
  effectLights: true,   // fire/flash may add real light to the room
  pixelRatioCap: 1.5,   // never render more pixels than this Ã— screen

  // --- render budget (memory/perf): the single biggest hidden cost is the
  // framebuffer, which scales with WINDOW SIZE Ã— PIXEL RATIO, not with the
  // number of objects. On a big or high-DPI screen that one buffer can dwarf
  // everything else in the scene. We cap it explicitly so a 4K monitor does
  // not balloon memory, while a normal screen looks unchanged.
  maxRenderPixels: 2073600,   // â‰ˆ 1920Ã—1080 (a 1440p screen â†’ ~1.0 ratio, 4K â†’ below it)
  maxBloomWidth: 1280         // bloom is blur â€” it never needs more than this wide
};

// effectivePixelRatio() â€” the pixel ratio the renderer should run at so that
//   (widthÂ·ratio) Ã— (heightÂ·ratio) â‰¤ maxRenderPixels,
// while never exceeding the device DPR or the quality pixelRatioCap.
// Used by main.js before the WebGLRenderer is created.
export function effectivePixelRatio() {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  const byArea = Math.sqrt(quality.maxRenderPixels / (w * h));
  return Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap, byArea);
}

function applyLowPreset() {
  quality.level = 'low';
  quality.particleScale = 0.5;
  quality.effectLights = false;
  quality.pixelRatioCap = 1;
}

if (new URLSearchParams(location.search).get('quality') === 'low') {
  applyLowPreset();
}

// Small FPS/frame-time readout (top-left). Hidden by default; press P to show/hide.
// "worst" is the LONGEST frame in the window â€” a smooth 60 fps average can
// still hide a single 80 ms hitch (e.g. a shader compile), and worst-ms is
// exactly the number that exposes it.
export function createFpsMeter() {
  const el = document.createElement('div');
  el.id = 'fps-meter';
  el.style.cssText =
    'position:fixed;top:10px;left:10px;z-index:30;font:12px monospace;' +
    'color:#9fe89f;background:rgba(10,16,24,0.6);padding:3px 8px;' +
    'border-radius:6px;pointer-events:none;';
  document.body.appendChild(el);

  // Keep diagnostic UI out of the player experience. It is available on demand
  // through P for developers, teachers, and troubleshooting sessions.
  let visible = false;
  el.style.display = 'none';
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP') return;
    if (e.target.closest('input, textarea')) return;   // typing, not toggling
    visible = !visible;
    el.style.display = visible ? '' : 'none';
  });

  let frames = 0;
  let acc = 0;       // seconds elapsed in this window
  let worst = 0;     // longest single frame in this window
  return {
    tick(delta) {
      if (!visible) return;                 // hidden = zero cost
      frames++;
      acc += delta;
      if (delta > worst) worst = delta;
      if (acc >= 0.5) {                     // refresh twice a second
        const fps = Math.round(frames / acc);
        const avgMs = ((acc / frames) * 1000).toFixed(1);
        const worstMs = Math.round(worst * 1000);
        el.textContent =
          `${fps} fps Â· ${avgMs} ms Â· worst ${worstMs} ms Â· ${quality.level}`;
        frames = 0;
        acc = 0;
        worst = 0;
      }
    }
  };
}

// Watches average FPS. After a 5 s grace period (asset loading jank), if FPS
// stays under 45 for 3 consecutive seconds the app drops to LOW exactly once:
// smaller render target, no shadows, half particles, unlit effects.
export function createQualityMonitor(renderer, scene) {
  let elapsed = 0;
  let acc = 0;
  let frames = 0;
  let badSeconds = 0;
  let done = quality.level === 'low';   // already low = nothing to do

  return {
    tick(delta) {
      if (done) return;
      elapsed += delta;
      if (elapsed < 5) return;          // ignore the loading dip

      acc += delta;
      frames++;
      if (acc < 1) return;
      const fps = frames / acc;
      acc = 0;
      frames = 0;

      badSeconds = fps < 45 ? badSeconds + 1 : 0;
      if (badSeconds >= 3) {
        done = true;
        applyLowPreset();
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        // Materials cache their shadow shader variant â€” poke them to rebuild.
        scene.traverse((n) => { if (n.material) n.material.needsUpdate = true; });
        console.info('quality: dropped to LOW (fps < 45 for 3 s)');
      }
    }
  };
}

