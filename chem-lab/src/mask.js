// mask.js — the PPE face mask: a dispenser box on the PPE table + a simple
// respirator mesh attached to the camera.
//
// Same pattern as the glove cuff in gloves.js: the mask lives in CAMERA space
// (a child of the camera, which main.js adds to the scene), so it stays in the
// bottom of the player's view at all times. The box is the interactable: E on
// it toggles the mask on/off, gated to the PPE zone by hand.js.
import * as THREE from 'three';
import { ZONES } from './zones.js';

export function createMask(scene, camera, interactableObjects) {
  // ---- the dispenser box on the PPE table (beside the glove box) ----
  const box = new THREE.Group();

  const cardboardMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.12), cardboardMat);
  base.position.y = 0.035;
  base.castShadow = true;
  box.add(base);

  // White top with a slot, matching the glove box's tissue-box language.
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.006, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.6 })
  );
  top.position.y = 0.073;
  box.add(top);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.004, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.9 })
  );
  slot.position.y = 0.077;
  box.add(slot);

  // Front label (same canvas trick as the glove box / bottle labels).
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f5f8';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#22303c';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = '#22303c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('FACE', 128, 32);
  ctx.fillText('MASKS', 128, 66);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.05),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  label.position.set(0, 0.035, 0.061);       // 1 mm off the front face
  box.add(label);

  box.position.set(ZONES.ppe.x - 0.25, 1.0, ZONES.ppe.z);
  box.rotation.y = 0.25;
  box.userData = {
    maskBox: true,
    name: 'Mask Box',
    description: 'Disposable face masks. Put one on at the PPE station before handling powders, oxidisers or anything that fumes.'
  };
  scene.add(box);
  interactableObjects.push(box);

  // ---- the worn mask: a small respirator in the bottom-center of the view ----
  // A shell + two side filter canisters + a center vent, squatting below the
  // look direction so it never hides the crosshair or the pour stream.
  const mask = new THREE.Group();

  const shellMat = new THREE.MeshStandardMaterial({ color: 0xecf0f2, roughness: 0.75 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 16), shellMat);
  shell.scale.set(1.5, 1.05, 0.75);
  shell.position.z = 0.012;
  mask.add(shell);

  const canMat = new THREE.MeshStandardMaterial({ color: 0xd9dee2, roughness: 0.6, metalness: 0.1 });
  for (const side of [-1, 1]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.022, 12), canMat);
    can.rotation.x = Math.PI / 2;
    can.position.set(side * 0.055, 0, 0.02);
    mask.add(can);
  }

  const vent = new THREE.Mesh(
    new THREE.CircleGeometry(0.011, 12),
    new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.9 })
  );
  vent.position.set(0, 0, 0.048);
  mask.add(vent);

  mask.position.set(0, -0.24, -0.22);
  mask.visible = false;
  camera.add(mask);

  let on = false;

  return {
    get on() { return on; },
    toggle() {
      on = !on;
      mask.visible = on;
      return on;
    }
  };
}
