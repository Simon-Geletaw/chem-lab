// player.js — first-person "walking" controls.
// PointerLockControls uses the browser's Pointer Lock API: the cursor is
// hidden + trapped, and we receive RAW mouse movement to turn the head.
// The browser ONLY allows locking inside a user click — hence the overlay.
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const WALK_SPEED = 3;                 // meters per second (a brisk walk)
const EYE_HEIGHT = 1.6;               // camera stays at standing eye level

export function createPlayer(camera) {
  const controls = new PointerLockControls(camera, document.body);

  const overlay = document.getElementById('start-overlay');
  const crosshair = document.getElementById('crosshair');
  overlay.addEventListener('click', () => controls.lock());
  controls.addEventListener('lock', () => {
    overlay.style.display = 'none';
    crosshair.style.display = 'block';
  });
  controls.addEventListener('unlock', () => {
    overlay.style.display = 'flex';
    crosshair.style.display = 'none';
  });

  // Keyboard state: we DON'T move inside the event (keydown only repeats
  // stutteringly). We just record which keys are held, and move every frame.
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.code] = true;  });
  window.addEventListener('keyup',   (e) => { keys[e.code] = false; });

  // Furniture bounding boxes (filled by furniture.js in a later phase).
  // If a step would land inside one of these, we undo the step.
  const colliders = [];

  const player = {
    controls,
    colliders,
    enabled: true,                    // the tour will set this to false later

    update(delta) {
      if (!player.enabled || !controls.isLocked) return;

      const prevPos = camera.position.clone();   // remember, in case we collide

      const step = WALK_SPEED * delta;    // meters to move THIS frame
      if (keys['KeyW']) controls.moveForward(step);
      if (keys['KeyS']) controls.moveForward(-step);
      if (keys['KeyA']) controls.moveRight(-step);
      if (keys['KeyD']) controls.moveRight(step);

      // Poor-man's collision: clamp inside the room (walls at ±7 and ±5,
      // minus 0.3 m so your "shoulders" don't clip through the plaster).
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -6.7, 6.7);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -4.7, 4.7);
      camera.position.y = EYE_HEIGHT;     // no flying, no crouching

      // Furniture collision: check feet position against each box.
      const feet = new THREE.Vector3(camera.position.x, 0.5, camera.position.z);
      for (const box of colliders) {
        if (box.containsPoint(feet)) {
          camera.position.copy(prevPos);  // step back — simpler than sliding
          break;
        }
      }
    }
  };

  return player;
}
