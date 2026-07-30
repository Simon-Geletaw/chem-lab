import * as THREE from 'three';
import { createRoom } from './room.js';
import { createPeriodicWall } from './periodicWall.js';
import { createPlayer } from './player.js';
import { createFurniture } from './furniture.js';
import { createInteractions } from './interactions.js';

// 1. Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfdde6);

// 2. Camera
// SCALE RULE: 1 unit = 1 METER. Eye height of a standing person ≈ 1.6 m.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 4);

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
const furniture = createFurniture(scene, interactableObjects, player.colliders);

// Clicking: element tiles pop out with a 3D card; other objects use the HTML panel
const interactions = createInteractions(camera, player.controls, scene, interactableObjects);

// Walk-up info cards: fade in when the player comes within ~2.5 m
furniture.proximitySpots.forEach((spot) => interactions.addProximityPanel(spot));

// 6. Animation Loop
const clock = new THREE.Clock();      // measures real time between frames

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();     // seconds since last frame (~0.016 at 60fps)
  player.update(delta);
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
