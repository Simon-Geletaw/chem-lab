import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRoom } from './room.js';
import { createPeriodicWall } from './periodicWall.js';
import { createPlayer } from './player.js';

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

// 5. 3D Models
const loader = new GLTFLoader();

// desiredHeight = how tall the object should be IN METERS.
// Downloaded GLB files use random unit sizes (one artist's "1" is a meter,
// another's is a millimeter). So instead of guessing a scale number, we:
//   1) measure the model's natural height with Box3
//   2) compute scale = desiredHeight / naturalHeight
//   3) apply it -> the model is now EXACTLY desiredHeight meters tall.
function loadModel(url, position, desiredHeight, name, description, onLoad) {
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;

      // Measure the model at its natural size
      let box = new THREE.Box3().setFromObject(model);
      let size = box.getSize(new THREE.Vector3());

      // Scale so its height becomes desiredHeight meters
      const scale = desiredHeight / size.y;
      model.scale.set(scale, scale, scale);

      // Re-measure AFTER scaling, then lift so its FEET sit exactly at position.y
      // (box.min.y = lowest point of the model; subtracting it plants the feet)
      box = new THREE.Box3().setFromObject(model);
      model.position.set(position.x, position.y - box.min.y, position.z);

      size = box.getSize(new THREE.Vector3());
      console.log(name, '→ width:', size.x.toFixed(2), 'height:', size.y.toFixed(2), 'depth:', size.z.toFixed(2), '(meters)');

      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      model.userData = { name: name, description: description };
      scene.add(model);
      interactableObjects.push(model);

      // Tell whoever asked: "the model is ready" (and hand over its final box)
      if (onLoad) onLoad(model, new THREE.Box3().setFromObject(model));
    },
    undefined,                                            // (progress - not needed)
    (error) => console.error('FAILED to load', url, error) // loud errors instead of silence
  );
}

// Load the TABLE first. Only when it's loaded do we know how tall it is -
// then we load the items that sit on top of it.
// 3rd argument = REAL HEIGHT IN METERS (loadModel auto-scales to match).
loadModel('/Models/folding_table.glb', { x: 0, y: 0, z: -3.2 }, 0.74, 'Folding Table',
  'A folding table is a type of table that can be collapsed and stored away when not in use. It is often used in laboratories for temporary workspaces.',
  (tableModel, tableBox) => {
    const tableTopY = tableBox.max.y;   // world height of the tabletop
    console.log('Table top is at y =', tableTopY.toFixed(2), 'm');

    loadModel('/Models/bunsen_burner.glb', { x: 0.25, y: tableTopY, z: -3.2 }, 0.15, 'Bunsen Burner',
      'A Bunsen burner is a common piece of laboratory equipment that produces a single open gas flame, used for heating, sterilization, and combustion.');

    loadModel('/Models/beaker.glb', { x: -0.25, y: tableTopY, z: -3.2 }, 0.12, 'Beaker',
      'A beaker is a simple container for stirring, mixing and heating liquids commonly used in many laboratories.');
  }
);

loadModel('/Models/FireEx.glb', { x: 6.85, y: 1.0, z: 2 }, 0.55, 'Fire Extinguisher',
  'A fire extinguisher is a device used to put out small fires. It contains a pressurized agent that is sprayed onto the fire to extinguish it.',
  (model) => {
    model.rotation.y = -Math.PI / 2;   // turn it to face into the room
  }
);

// Red mounting backplate so it reads as "wall-mounted", not "floating"
const bracket = new THREE.Mesh(
  new THREE.BoxGeometry(0.04, 0.7, 0.35),
  new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.5 })
);
bracket.position.set(6.97, 1.3, 2);
scene.add(bracket);

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
