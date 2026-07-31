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
import { createSmoke } from './smoke.js';
import { createBubbles } from './bubbles.js';
import { createColorChange } from './colorChange.js';
import { createFire } from './fire.js';
import { createFlash } from './flash.js';
import { createShake } from './shake.js';

const registry = {
  smoke: createSmoke,
  bubbles: createBubbles,
  colorChange: createColorChange,
  fire: createFire,
  flash: createFlash,
  shake: createShake
};

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
