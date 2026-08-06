// effects/index.js — the registry + runner (book Ch 7).
//
// REGISTRY: maps the `type` string a teacher writes in chemicals.json to the
// factory that builds that effect. "Add a new effect" = one file + one line
// here. The teacher's whole vocabulary is literally Object.keys(registry).
//
// RUNNER: owns the list of LIVE effects. Every effect follows one contract:
//     factory(params, position, scene, extras) -> { update(dt)->bool, dispose() }
// update returning false means "I'm finished" — each effect owns its own
// lifetime, the runner does zero duration bookkeeping (book Ch 7.2).
import { createSmoke, initSmokePool, setPoolVisible as setSmokeVisible } from './smoke.js';
import { createBubbles, initBubblesPool, setPoolVisible as setBubblesVisible } from './bubbles.js';
import { createColorChange } from './colorChange.js';
import { createFire, initFirePool, setPoolVisible as setFireVisible } from './fire.js';
import { createFumes, initFumesPool, setPoolVisible as setFumesVisible } from './fumes.js';
import { createFlash } from './flash.js';
import { createShake } from './shake.js';

const registry = {
  smoke: createSmoke,
  bubbles: createBubbles,
  colorChange: createColorChange,
  fire: createFire,
  fumes: createFumes,
  flash: createFlash,
  shake: createShake
};

// PHASE 3 (PERF): build every pooled particle system ONCE at startup. Each pool
// pre-creates its fixed-size buffers, geometry, and PointsMaterial, so firing a
// reaction never allocates or compiles — see the pool notes in each effect file.
export function initEffectPools(scene) {
  initBubblesPool(scene);
  initSmokePool(scene);
  initFumesPool(scene);
  initFirePool(scene);
}

// PHASE 4 (PERF): kill the remaining FIRST-reaction stall. renderer.compile()
// bakes every material's shader against the (now stable, Phase 2) light state,
// and one render() uploads the sprite canvas textures that compile() alone
// skips. Runs once behind the welcome card, so the one-time cost is invisible.
export function prewarmEffects(renderer, scene, camera) {
  setBubblesVisible(true);
  setSmokeVisible(true);
  setFumesVisible(true);
  setFireVisible(true);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  setBubblesVisible(false);
  setSmokeVisible(false);
  setFumesVisible(false);
  setFireVisible(false);
}

// getExtras is the ONE deliberate hole in the abstraction (book Ch 7.4):
// most effects build their own meshes, but colorChange must mutate the
// beaker's liquid material and shake must nudge the camera — things they
// don't own. main.js supplies them here instead of polluting every factory.
export function createEffectRunner(scene, getExtras) {
  const live = [];

  return {
    play(descriptors, position) {
      for (const d of descriptors) {
        const factory = registry[d.type];
        if (!factory) {
          // A teacher typo ('smok') must degrade gracefully mid-class, not crash.
          console.warn('Unknown effect type:', d.type);
          continue;
        }
        live.push(factory(d, position, scene, getExtras()));
      }
    },

    update(delta) {
      // Backwards, because splice() while walking forwards skips elements —
      // the classic remove-while-iterating bug (book Phase 6a).
      for (let i = live.length - 1; i >= 0; i--) {
        if (!live[i].update(delta)) {
          live[i].dispose();
          live.splice(i, 1);
        }
      }
    },

    // The beaker leaves REACTING when this goes false (replaces the P5 timer).
    get busy() {
      return live.length > 0;
    }
  };
}
