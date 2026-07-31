// effects/flash.js — fire's degenerate cousin (book Ch 13): a bare PointLight
// whose intensity spikes and decays. No mesh at all — the flash IS the light
// it throws on the bench, the walls, the student's "hands".
import * as THREE from 'three';

export function createFlash(params, position, scene) {
  const duration = params.duration ?? 0.4;
  const light = new THREE.PointLight(params.color ?? '#ffffff', 8, 6);
  light.position.set(position.x, position.y + 0.2, position.z);
  scene.add(light);

  let elapsed = 0;

  return {
    update(delta) {
      elapsed += delta;
      light.intensity = 8 * Math.max(0, 1 - elapsed / duration);   // linear decay to 0
      return elapsed < duration;
    },
    dispose() {
      scene.remove(light);
    }
  };
}
