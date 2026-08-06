// effects/flash.js — fire's degenerate cousin (book Ch 13): a bare PointLight
// whose intensity spikes and decays. No mesh at all — the flash IS the light
// it throws on the bench, the walls, the student's "hands".
//
// PERF: the light now comes from the shared pool (effects/lightPool.js)
// instead of being allocated per reaction. On LOW quality (or if the pool is
// exhausted) the flash is skipped — it's a garnish, not the meal.
import { quality } from '../quality.js';
import { acquireLight, releaseLight } from './lightPool.js';

export function createFlash(params, position, scene) {
  const duration = params.duration ?? 0.4;
  const light = quality.effectLights ? acquireLight(params.color ?? '#ffffff', 6) : null;
  if (light) {
    light.position.set(position.x, position.y + 0.2, position.z);
  }

  let elapsed = 0;

  return {
    update(delta) {
      elapsed += delta;
      if (light) light.intensity = 8 * Math.max(0, 1 - elapsed / duration);   // linear decay to 0
      return light !== null && elapsed < duration;
    },
    dispose() {
      releaseLight(light);
    }
  };
}
