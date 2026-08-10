// coat.js — the lab coat on the coat rack beside the exit door.
//
// The coat hanger and white coat are downloaded GLB models (/Models/coat_hanger.glb,
// /Models/white_coat.glb) — the coat is DRACO-compressed, so this module wires
// in the DRACOLoader (decoder files vendored into /draco/) that the rest of
// the app never needed. Both models are sized by MEASURING their bounds at
// load time (same technique as the wall window in room.js): the hanger is
// scaled to 1.8 m and the coat hangs from its hook, so no hand-tuned offsets.
//
// The coat is third-person PPE: press E at the hanging coat (near the rack,
// in the 'coat' zone) to put it on — the coat vanishes from the hanger, the
// HUD chip goes green, and WHITE SLEEVES appear on the first-person wrists
// (children of the hand rigs' roll groups in gloves.js, on the hand light
// layer), so you can actually SEE that you are wearing it. Nitrile gloves
// render over the sleeves. The ONLY way to take it off is the biohazard bin
// (hand.js, order: gloves -> mask -> coat); a fresh coat reappears on the rack.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { ZONES } from './zones.js';

const RACK_POS = new THREE.Vector3(ZONES.coat.x, 0, ZONES.coat.z);   // beside the exit door
const RACK_HEIGHT = 1.8;         // meters the rack stands
const HAND_LAYER = 1;            // same layer as the hands (gloves.js)
const COAT_WHITE = 0xf3f4f6;     // soft white fabric (ACES-safe, not pure)

// Subtle woven-fabric speckle so the sleeves read as cloth, not plastic.
// Same canvas-texture idiom as the nitrile skin in gloves.js.
function makeFabricTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#eef0f2';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${220 + Math.round(Math.random() * 20)}, ${223 + Math.round(Math.random() * 18)}, ${227 + Math.round(Math.random() * 14)}, 0.55)`;
    g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  return new THREE.CanvasTexture(c);
}

export function createCoat(scene, camera, interactableObjects, hud, gloves) {
  // ------------------------------------------------------------ the coat rack
  const rackGroup = new THREE.Group();
  rackGroup.position.copy(RACK_POS);
  scene.add(rackGroup);

  let rackScale = 1;            // filled when the hanger model arrives
  let coatGroup = null;         // the hanging coat (E target)

  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  let hangerBox = null;

  // Both models are measured at load time; the coat is positioned the moment
  // BOTH are ready (whichever arrives second does the placement).
  function tryHangCoat() {
    if (!hangerBox || !coatGroup) return;
    coatGroup.scale.setScalar(rackScale);
    coatGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(coatGroup);
    // Shoulders to the hook: top of the coat meets the hook point, centered
    // on the rack's top (the hook) in x/z.
    coatGroup.position.set(
      hangerBox.getCenter(new THREE.Vector3()).x - box.getCenter(new THREE.Vector3()).x,
      hangerBox.max.y - box.max.y,
      hangerBox.getCenter(new THREE.Vector3()).z - box.getCenter(new THREE.Vector3()).z
    );
  }

  loader.load('/Models/coat_hanger.glb', (gltf) => {
    const rack = gltf.scene;
    rack.traverse((n) => {
      if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
    });
    const size = new THREE.Box3().setFromObject(rack).getSize(new THREE.Vector3());
    rackScale = RACK_HEIGHT / size.y;
    rack.scale.setScalar(rackScale);
    rack.updateMatrixWorld(true);
    hangerBox = new THREE.Box3().setFromObject(rack);
    rackGroup.add(rack);
    tryHangCoat();
  }, undefined, (err) => console.error('FAILED to load /Models/coat_hanger.glb', err));

  loader.load('/Models/white_coat.glb', (gltf) => {
    coatGroup = gltf.scene;
    coatGroup.traverse((n) => {
      if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
    });
    // The Sketchfab coat material may be near-black or scene-tinted; repaint
    // to the lab's soft white so the coat reads as a clean lab coat.
    coatGroup.traverse((n) => {
      if (n.isMesh && n.material) {
        if (Array.isArray(n.material)) {
          n.material = n.material.map((m) => { m.color.set(COAT_WHITE); return m; });
        } else {
          n.material.color.set(COAT_WHITE);
        }
      }
    });
    rackGroup.add(coatGroup);
    coatGroup.userData = {
      coat: true,
      name: 'Lab Coat',
      description: 'The white lab coat shields your arms and clothes from chemical splashes. Press E to put it on — handle hazardous chemicals only once it is on.'
    };
    interactableObjects.push(coatGroup);
    tryHangCoat();
  }, undefined, (err) => console.error('FAILED to load /Models/white_coat.glb', err));

  rackGroup.userData = {
    name: 'Coat Rack',
    description: 'The white lab coat hangs here, ready for the experiment. Put it on (E) before handling hazardous chemicals — it protects your arms and clothes from splashes.'
  };
  interactableObjects.push(rackGroup);

  // ---------------------------------------------------- first-person sleeves
  // White coat sleeves hug the forearms just below the glove cuff. They live
  // in the gloves' roll groups (same anchor as the gloves' own cuffs), on the
  // hand render layer so the hand lights keep them bright in the dim room.
  const sleeveMat = new THREE.MeshStandardMaterial({
    map: makeFabricTexture(),
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide
  });
  const sleeves = [];
  for (const roll of [gloves.rightRoll, gloves.leftRoll]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.16, 20, 1, true), sleeveMat);
    sleeve.position.set(0, -0.11, 0.012);      // below the wrist, toward the elbow
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
    if (coatGroup) coatGroup.visible = !on;    // worn coat leaves the hanger
  }

  return {
    get on() { return on; },

    wear() { setOn(true); },

    // The biohazard bin takes the coat off; a fresh one appears on the rack.
    remove() { setOn(false); }
  };
}