import * as THREE from 'three';
import { createRoom } from './room.js';
import { createPeriodicWall } from './periodicWall.js';
import { createPlayer } from './player.js';
import { createFurniture } from './furniture.js';

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
createFurniture(scene, interactableObjects, player.colliders);

// --- Click to inspect ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const panel = document.getElementById('info-panel');
const panelTitle = document.getElementById('info-title');
const panelText = document.getElementById('info-description');
document.getElementById('info-close').addEventListener('click', () => {
  panel.style.display = 'none';
});

window.addEventListener('click', (event) => {
  // 1) Convert pixel coords to "normalized" coords (-1..+1, center = 0,0)
  mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // 2) Aim the laser from the camera through that point
  raycaster.setFromCamera(mouse, camera);

  // 3) Ask what it hits ('true' = also check every child mesh inside models)
  const hits = raycaster.intersectObjects(interactableObjects, true);

  if (hits.length > 0) {
    // The ray hits a CHILD mesh (e.g. "glass" inside the beaker).
    // Climb up the parent chain until we find the object holding userData.name.
    let obj = hits[0].object;
    while (obj && !obj.userData.name) {
      obj = obj.parent;
    }
    if (obj) {
      panelTitle.textContent = obj.userData.name;
      panelText.textContent = obj.userData.description;
      panel.style.display = 'block';
    }
  }
});

// 6. Animation Loop
const clock = new THREE.Clock();      // measures real time between frames

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();     // seconds since last frame (~0.016 at 60fps)
  player.update(delta);
  renderer.render(scene, camera);
}
animate();

// 7. Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
