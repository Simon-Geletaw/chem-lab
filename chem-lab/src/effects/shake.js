// effects/shake.js — camera trembles (book Ch 15.2).
//
// The trick: each frame REMOVE last frame's offset, then add a fresh random
// one. The camera's true position is never corrupted — PointerLockControls
// keeps moving the player normally underneath our jitter — and when the
// effect dies (or disposes mid-shake) we subtract the final offset and the
// view is exactly where it should be.
import * as THREE from 'three';

export function createShake(params, position, scene, extras) {
  const strength = params.strength ?? 0.5;
  const duration = params.duration ?? 1;
  const camera = extras.camera;

  const lastOffset = new THREE.Vector3();
  let elapsed = 0;

  return {
    update(delta) {
      elapsed += delta;
      camera.position.sub(lastOffset);        // undo previous frame

      const k = strength * 0.03 * Math.max(0, 1 - elapsed / duration);  // decay
      lastOffset.set(
        (Math.random() - 0.5) * k,
        (Math.random() - 0.5) * k,
        (Math.random() - 0.5) * k
      );
      camera.position.add(lastOffset);
      return elapsed < duration;
    },

    dispose() {
      camera.position.sub(lastOffset);        // leave the camera clean
      lastOffset.set(0, 0, 0);
    }
  };
}
