// exitDoor.js — the Biology room's exit: press E at the steel door on the
// front wall to travel back to the Chemistry Lab hub. The destination comes
// from server/data/room.json (backHref/backLabel) — change the JSON to point
// this door somewhere else.
//
// Same aim + E + travel-overlay pattern as the chem-lab sim doors. Only works
// when standing close enough to the door (1.3 m radius around userData.exitPos).
import * as THREE from 'three';
import { getRoom } from './registry.js';

const HOVER_REACH = 4.0;
const CENTER = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const hint = document.getElementById('action-hint');

function raycastDoor(camera) {
  raycaster.setFromCamera(CENTER, camera);
  const hits = raycaster.intersectObjects([doorGroup], true);
  for (const hit of hits) {
    if (hit.distance > HOVER_REACH) return false;
    let obj = hit.object;
    while (obj && !obj.userData.exitDoor) obj = obj.parent;
    return !!obj;
  }
  return false;
}

function travelOverlay() {
  document.getElementById('travel-text').textContent = getRoom().backLabel + '\u2026';
  const overlay = document.getElementById('travel-overlay');
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('show'));
}

let doorGroup = null;
let locked = false;

export function createExitDoor(scene, camera, interactableObjects) {
  // Find the door group the room already built (it carries userData.exitDoor
  // and userData.exitPos). We register it for aiming and hook its E handling.
  doorGroup = scene.children.find((c) => c.userData && c.userData.exitDoor) || null;
  if (!doorGroup) {
    console.error('exitDoor: no exit-door group found in the scene');
    return null;
  }
  interactableObjects.push(doorGroup);

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || locked) return;
    if (!raycastDoor(camera)) return;
    const pos = doorGroup.userData.exitPos;
    const dx = camera.position.x - pos.x;
    const dz = camera.position.z - pos.z;
    if (dx * dx + dz * dz > 1.3 * 1.3) return;   // too far — hint covers this
    locked = true;
    travelOverlay();
    setTimeout(() => {
      const href = getRoom().backHref;
      window.open(href, '_blank', 'noopener,noreferrer');
      locked = false;
    }, 420);
  });

  return {
    // Crosshair hint: show "[E] <backLabel>" while aiming at the door.
    update() {
      if (!hint) return;
      const aimed = raycastDoor(camera);
      hint.style.display = aimed ? 'block' : 'none';
      if (aimed) hint.textContent = `[E] ${getRoom().backLabel}`;
    }
  };
}