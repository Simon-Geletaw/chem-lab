// quality.js — performance settings, FPS meter, and auto-degrade.
//
// One plain object drives every performance knob in the app. High is the
// default; LOW is entered two ways:
//   1. explicitly: open the app with ?quality=low (client demo laptops)
//   2. automatically: the monitor watches real FPS and drops ONCE if the
//      machine can't hold 45 fps for 3 consecutive seconds.
// Pure DOM + numbers — no Three.js import, so effects can import this without
// creating a dependency cycle.

export const quality = {
  level: 'high',        // 'high' | 'low'
  particleScale: 1,     // multiplies every effect's particle count
  effectLights: true,   // fire/flash may add real light to the room
  pixelRatioCap: 1.5    // never render more pixels than this × screen
};

function applyLowPreset() {
  quality.level = 'low';
  quality.particleScale = 0.5;
  quality.effectLights = false;
  quality.pixelRatioCap = 1;
}

if (new URLSearchParams(location.search).get('quality') === 'low') {
  applyLowPreset();
}

// Small always-on FPS readout (top-left). Cheap: one DOM write per second.
export function createFpsMeter() {
  const el = document.createElement('div');
  el.id = 'fps-meter';
  el.style.cssText =
    'position:fixed;top:10px;left:10px;z-index:30;font:12px monospace;' +
    'color:#9fe89f;background:rgba(10,16,24,0.6);padding:3px 8px;' +
    'border-radius:6px;pointer-events:none;';
  document.body.appendChild(el);

  let frames = 0;
  let acc = 0;
  return {
    tick(delta) {
      frames++;
      acc += delta;
      if (acc >= 1) {
        el.textContent = `${Math.round(frames / acc)} fps · ${quality.level}`;
        frames = 0;
        acc = 0;
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
        // Materials cache their shadow shader variant — poke them to rebuild.
        scene.traverse((n) => { if (n.material) n.material.needsUpdate = true; });
        console.info('quality: dropped to LOW (fps < 45 for 3 s)');
      }
    }
  };
}
