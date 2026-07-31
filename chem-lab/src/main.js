import * as THREE from 'three';
import { createRoom } from './room.js';
import { createPeriodicWall } from './periodicWall.js';
import { createPlayer } from './player.js';
import { createFurniture } from './furniture.js';
import { createInteractions } from './interactions.js';
import { createTour } from './tour.js';
import { createHand } from './hand.js';
import { createBeaker } from './beaker.js';
import { loadChemistry, getShelfChemicals } from './chemistry/registry.js';

// PHASE 1: chemistry data loads BEFORE the world is built, because the shelf
// bottles are generated from it. Top-level await works in Vite ES modules.
// (Phase 10 swaps the data source to the backend API — this line stays.)
await loadChemistry();

// 1. Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfdde6);

// 2. Camera
// SCALE RULE: 1 unit = 1 METER. Eye height of a standing person ≈ 1.6 m.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 4);
// Ch 10.3: the camera itself renders fine outside the scene graph, but its
// CHILDREN (the held bottle!) are only drawn if the camera is IN the scene.
scene.add(camera);

// 3. Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 4. Build the world (each module adds its own part to the scene)
const interactableObjects = [];
createRoom(scene);
createPeriodicWall(scene, interactableObjects);
const player = createPlayer(camera);
// Furniture registers its bounding boxes in player.colliders so you bump into it
const furniture = createFurniture(scene, interactableObjects, player.colliders, getShelfChemicals());

// Clicking: element tiles pop out with a 3D card; other objects use the HTML panel
const interactions = createInteractions(camera, player.controls, scene, interactableObjects);

// The reaction vessel on the island bench (Phase 3)
const beaker = createBeaker(scene, interactableObjects, camera);

// The hand: E picks up an aimed bottle / pours it into the beaker, Q sends it
// home. Created AFTER the beaker because it pours into it (Phase 2 + 4).
const hand = createHand(camera, scene, interactableObjects, beaker);

// Temporary Phase 3 test hook — call beaker.receive('h2so4') in the console.
window.beaker = beaker;

// Walk-up info cards: fade in when the player comes within ~2.5 m
furniture.proximitySpots.forEach((spot) => interactions.addProximityPanel(spot));

// Guided tour: camera visits 4 stations, then hands control back
const tour = createTour(camera, player, interactions);

// 6. Animation Loop
const clock = new THREE.Clock();      // measures real time between frames

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();     // seconds since last frame (~0.016 at 60fps)
  player.update(delta);               // walking (does nothing while the tour runs)
  hand.update(delta);                 // carry/return animation + hover hints
  beaker.update(delta);               // billboard the content label
  tour.update(delta);                 // tour camera (does nothing while idle)
  interactions.update(delta);
  renderer.render(scene, camera);
}
animate();

// 7. Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
