// effects/colorChange.js — the easiest effect: lerp the liquid's color.
//
// The one IMPURE effect (book Ch 7.4): it owns no mesh — it mutates the
// beaker's liquid material, which arrives via the runner's `extras` hook.
import * as THREE from 'three';

export function createColorChange(params, position, scene, extras) {
  const target = new THREE.Color(params.to);
  const duration = params.duration ?? 2;
  const mat = extras.liquidMaterial;
  let elapsed = 0;

  return {
    update(delta) {
      elapsed += delta;
      mat.color.lerp(target, Math.min(1, delta * (3 / duration)));
      if (elapsed >= duration) mat.color.copy(target);   // land exactly
      return elapsed < duration;
    },
    dispose() {}    // owns nothing
  };
}
