// coat.js — a clean, fully-procedural lab-coat wardrobe beside the exit door.
//
// Built entirely from Three.js primitives — no downloaded GLBs, no DRACO, no
// frame-time scaling quirks. A single deterministic unit: a wooden coat stand
// with a crossbar hanger, and a white lab coat hanging from that bar, placed
// exactly at WARDROBE_POS against the front wall, out of the room's centre.
//
// Flow:
//   aim at the coat  -> "[E] Put on lab coat"   (tells you to wear it)
//   E                -> the coat leaves the stand, white sleeves appear on the
//                       first-person wrists, the HUD chip turns green, then the
//                       experiment runs
//   E at the stand    -> the coat hangs again (putting it back after finishing)
//
// Wearing the coat never blocks the experiment: hand.js only reminds the player
// when a hazardous chemical is grabbed without it.
import * as THREE from 'three';
import { ZONES } from './zones.js';

// The wardrobe's place: flush against the front wall (z = 5), just right of
// the exit door (x = +3) — clearly a corner piece, not the middle of the lab.
const WARDROBE_POS = new THREE.Vector3(ZONES.coat.x, 0, ZONES.coat.z);
const HAND_LAYER = 1;            // same layer as the hands (gloves.js)
const COAT_WHITE = 0xf3f4f6;     // soft white fabric (ACES-safe, not pure)

// Subtle woven-fabric speckle so the coat reads as cloth, not plastic.
function makeFabricTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#eef0f2';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${220 + Math.random() * 20 | 0}, ${223 + Math.random() * 18 | 0}, ${227 + Math.random() * 14 | 0}, 0.55)`;
    g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return new THREE.CanvasTexture(c);
}

// The wooden coat stand: a floor base, a central pole, a crossbar hanger and a
// top knob. The coat hangs from the crossbar, so the pair reads as one wardrobe.
function buildStand() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.6 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.04, 20), wood);
  base.position.y = 0.02; base.castShadow = true; g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 1.5, 12), wood);
  pole.position.y = 0.75; pole.castShadow = true; g.add(pole);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.04), wood);
  bar.position.y = 1.5; bar.castShadow = true; g.add(bar);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), wood);
  knob.position.y = 1.63; g.add(knob);
  return g;
}

// The hanging lab coat: a hanger loop over the crossbar, a squared torso, two
// sleeves and a collar in soft white fabric. Absolute local positions so it
// sits on the stand deterministically (no runtime scaling).
function buildCoat() {
  const c = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({
    map: makeFabricTexture(), color: COAT_WHITE, roughness: 0.85, side: THREE.DoubleSide
  });
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 10, 20), fabric);
  loop.position.y = 1.53;
  c.add(loop);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.16), fabric);
  torso.position.y = 1.06;
  torso.castShadow = true;
  c.add(torso);
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.14), fabric);
    sleeve.position.set(side * 0.2, 0.95, 0);
    sleeve.rotation.z = -side * 0.14;
    sleeve.castShadow = true;
    c.add(sleeve);
  }
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.1), fabric);
  collar.position.set(0, 1.42, 0.04);
  c.add(collar);
  return c;
}

export function createCoat(scene, camera, interactableObjects, hud, gloves) {
  // The whole wardrobe (stand + coat) sits at WARDROBE_POS.
  const wardrobe = new THREE.Group();
  wardrobe.position.copy(WARDROBE_POS);
  scene.add(wardrobe);

  wardrobe.add(buildStand());

  // The hanging coat is the E target.
  const coatPart = buildCoat();
  coatPart.userData = {
    coat: true,
    name: 'Lab Coat',
    description: 'The white lab coat hangs on the stand by the door. Press E to put it on — it never blocks the experiment, but it shields your arms and clothes from splashes.'
  };
  wardrobe.add(coatPart);
  interactableObjects.push(coatPart);

  wardrobe.userData = {
    name: 'Coat Stand',
    description: 'The white lab coat hangs here beside the door. Press E to put it on or take it off — it does not stop the experiment, but it shields your arms and clothes from splashes.'
  };
  interactableObjects.push(wardrobe);

  // First-person coat sleeves hug the forearms, on the hands' roll groups.
  const sleeveMat = new THREE.MeshStandardMaterial({
    map: makeFabricTexture(),
    color: 0xffffff,
    roughness: 0.85,
    side: THREE.DoubleSide
  });
  const sleeves = [];
  for (const roll of [gloves.rightRoll, gloves.leftRoll]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.16, 20, 1, true), sleeveMat);
    sleeve.position.set(0, -0.11, 0.012);
    sleeve.visible = false;
    sleeve.layers.set(HAND_LAYER);
    roll.add(sleeve);
    sleeves.push(sleeve);
  }

  let on = false;

  function setOn(value) {
    on = value;
    hud.setCoat(on);
    for (const s of sleeves) s.visible = on;
    coatPart.visible = !on;      // worn coat leaves the stand
  }

  return {
    get on() { return on; },
    wear() { setOn(true); },
    // E at the stand takes the coat off; it hangs again.
    remove() { setOn(false); }
  };
}

