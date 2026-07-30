import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {elementsData} from './periodicTable.js'; // Importing elements data
// 1. Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfdde6); // Applied background directly to scene

// 2. Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15); // Moved camera up and back so we can see the whole room

// 3. Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // ENABLED SHADOWS HERE
document.body.appendChild(renderer.domElement);

// lab floor
function createFloorTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  context.fillStyle = '#d9d9d2'; // Gray color for the floor
  context.fillRect(0,0,512,512)
  context.fillStyle = '#bdbdb4';               // darker tile color
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) {         // every other square, like a chessboard
        context.fillRect(col * 64, row * 64, 64, 64);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;    // allow tiling horizontally
  texture.wrapT = THREE.RepeatWrapping;    // allow tiling vertically
  texture.repeat.set(5, 4);                // repeat the 8x8 board 5x4 times
  return texture;
}

// 4. Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.maxPolarAngle = Math.PI / 2; // Applied limits directly to controls
controls.minDistance = 5;
controls.maxDistance = 30;

// 5. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
scene.add(ambientLight);
const fillLight = new THREE.HemisphereLight(0xffffff, 0x777788, 0.6);
const dirLight = new THREE.DirectionalLight(0xffffff, 1); 
dirLight.position.set(10, 20, 10); 
dirLight.castShadow = true; 
dirLight.shadow.camera.left = -10; 
dirLight.shadow.camera.right = 10; 
dirLight.shadow.camera.top = 10; 
dirLight.shadow.camera.bottom = -10; 
scene.add(dirLight);
scene.add(fillLight);

// 6. Room Geometry
// 6. Room Geometry
// Room dimensions: 40 wide (x), 30 deep (z: -15 to +15), 15 tall (y)
const floorGeometry = new THREE.PlaneGeometry(40, 30);
const floorMaterial = new THREE.MeshStandardMaterial({
  map: createFloorTexture(),   // 'map' = the color texture the material wears
  roughness: 0.7,
  metalness: 0.1
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.9, metalness: 0.0 });

// Back wall (you already had this one)
const backwall = new THREE.Mesh(new THREE.PlaneGeometry(40, 15), wallMaterial);
backwall.position.set(0, 7.5, -15);
backwall.receiveShadow = true;
scene.add(backwall);

// Left wall — rotated +90° so its visible face points INTO the room
const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), wallMaterial);
leftWall.position.set(-20, 7.5, 0);
leftWall.rotation.y = Math.PI / 2;
leftWall.receiveShadow = true;
scene.add(leftWall);

// Right wall — rotated −90°, same reason
const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), wallMaterial);
rightWall.position.set(20, 7.5, 0);
rightWall.rotation.y = -Math.PI / 2;
rightWall.receiveShadow = true;
scene.add(rightWall);

// Ceiling — rotated +90° around X so it faces DOWN into the room
const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 30),
  new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9 })
);
ceiling.position.set(0, 15, 0);
ceiling.rotation.x = Math.PI / 2;
scene.add(ceiling);
 

// 7. 3D Models
const loader = new GLTFLoader(); // Fixed typo here
const interactableObjects = []; 

function loadModel(url, position, scale, name, description, onLoad) {
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.scale.set(scale, scale, scale);
      model.position.set(position.x, position.y, position.z);

      // Measure the model, then lift it so its FEET sit exactly at position.y
      const box = new THREE.Box3().setFromObject(model);
      model.position.y += position.y - box.min.y;

      // Print the size so YOU can judge if the scale looks right
      const size = box.getSize(new THREE.Vector3());
      console.log(name, '→ width:', size.x.toFixed(2), 'height:', size.y.toFixed(2), 'depth:', size.z.toFixed(2));

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

const elementsGroup = new THREE.Group();

// Returns the real periodic-table cell for atomic number z:
// col 1..18 (left to right), row 1..7 (top to bottom),
// rows 8.5/9.5 = the detached lanthanide/actinide strips.
function getGridPosition(z) {
  if (z === 1)   return { col: 1,       row: 1 };     // H
  if (z === 2)   return { col: 18,      row: 1 };     // He
  if (z <= 4)    return { col: z - 2,   row: 2 };     // Li, Be
  if (z <= 10)   return { col: z + 8,   row: 2 };     // B..Ne
  if (z <= 12)   return { col: z - 10,  row: 3 };     // Na, Mg
  if (z <= 18)   return { col: z,       row: 3 };     // Al..Ar
  if (z <= 36)   return { col: z - 18,  row: 4 };     // K..Kr
  if (z <= 54)   return { col: z - 36,  row: 5 };     // Rb..Xe
  if (z <= 56)   return { col: z - 54,  row: 6 };     // Cs, Ba
  if (z <= 71)   return { col: z - 54,  row: 8.5 };   // La..Lu (detached)
  if (z <= 86)   return { col: z - 68,  row: 6 };     // Hf..Rn
  if (z <= 88)   return { col: z - 86,  row: 7 };     // Fr, Ra
  if (z <= 103)  return { col: z - 86,  row: 9.5 };   // Ac..Lr (detached)
  return { col: z - 100, row: 7 };                    // Rf..Og
}

// Chemical family for atomic number z (drives the tile color)
function getCategory(z) {
  if ([1, 6, 7, 8, 15, 16, 34].includes(z))         return 'nonmetal';
  if ([2, 10, 18, 36, 54, 86, 118].includes(z))     return 'noble-gas';
  if ([9, 17, 35, 53, 85, 117].includes(z))         return 'halogen';
  if ([3, 11, 19, 37, 55, 87].includes(z))          return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(z))          return 'alkaline';
  if ([5, 14, 32, 33, 51, 52].includes(z))          return 'metalloid';
  if (z >= 57 && z <= 71)                           return 'lanthanide';
  if (z >= 89 && z <= 103)                          return 'actinide';
  if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(z)) return 'post-transition';
  return 'transition';                              // everything else
}

const categoryColors = {
  'alkali':          '#d95d39',
  'alkaline':        '#e8a94b',
  'transition':      '#3f6fa8',
  'post-transition': '#7d8ca3',
  'metalloid':       '#c9a227',
  'nonmetal':        '#2a9d5c',
  'halogen':         '#1f9e89',
  'noble-gas':       '#8d5bd4',
  'lanthanide':      '#c95f8e',
  'actinide':        '#a4636f'
};

function createElementTexture(element, atomicNumber, bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;                       // doubled resolution = crisp text
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;                  // category color
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 244);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';                   // atomic number, top-left corner
  ctx.textBaseline = 'top';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(String(atomicNumber), 16, 12);

  ctx.textAlign = 'center';                 // big symbol, center
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 110px Arial';
  ctx.fillText(element.symbol, 128, 128);

  ctx.font = '28px Arial';                  // name, bottom (maxWidth squeezes long names)
  ctx.fillText(element.name, 128, 226, 236);

  return new THREE.CanvasTexture(canvas);
}

const tileStep = 1.1;   // tile size 1.0 + gap 0.1

elementsData.forEach((element, index) => {
  const atomicNumber = index + 1;
  const cell = getGridPosition(atomicNumber);
  const color = categoryColors[getCategory(atomicNumber)];

  const texture = createElementTexture(element, atomicNumber, color);
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const tile = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.08), material);

  const xPos = (cell.col - 9.5) * tileStep;      // cols 1..18 centered on x=0
  const yPos = 13.2 - cell.row * tileStep;       // row 1 at top, lower rows descend
  tile.position.set(xPos, yPos, -14.8);

  tile.userData = {
    name: element.name + ' (' + element.symbol + ')',
    description: element.fact + ' ' + element.use,
    isElement: true
  };

  interactableObjects.push(tile);
  elementsGroup.add(tile);
});
scene.add(elementsGroup);

// Dark board behind the tiles ("poster frame")
const board = new THREE.Mesh(
  new THREE.BoxGeometry(21.5, 11.8, 0.15),
  new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.85 })
);
board.position.set(0, 7.1, -14.93);
scene.add(board);

// Title strip
function createTitleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#22303c';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PERIODIC TABLE OF THE ELEMENTS', 512, 64);
  return new THREE.CanvasTexture(canvas);
}
const title = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 1.5),
  new THREE.MeshStandardMaterial({ map: createTitleTexture() })
);
title.position.set(0, 13.6, -14.8);
scene.add(title);
// Note: Make sure your folder is lowercase 'models' if that's how you named it in VS Code!
// Load the TABLE first. Only when it's loaded do we know how tall it is -
// then we load the items that sit on top of it.
loadModel('/Models/folding_table.glb', { x: 0, y: 0, z: -8 }, 1, 'Folding Table',
  'A folding table is a type of table that can be collapsed and stored away when not in use. It is often used in laboratories for temporary workspaces.',
  (tableModel, tableBox) => {
    const tableTopY = tableBox.max.y;   // world height of the tabletop
    console.log('Table top is at y =', tableTopY.toFixed(2));

    loadModel('/Models/beaker.glb', { x: -0.8, y: tableTopY, z: -8 }, 1, 'Beaker',
      'A beaker is a simple container for stirring, mixing and heating liquids commonly used in many laboratories.');

    loadModel('/Models/bunsen_burner.glb', { x: 0.8, y: tableTopY, z: -8 }, 1, 'Bunsen Burner',
      'A Bunsen burner is a common piece of laboratory equipment that produces a single open gas flame, used for heating, sterilization, and combustion.');
  }
  
);
loadModel('/Models/FireEx.glb', { x: 19.3, y: 3.5, z: 8 }, 1, 'Fire Extinguisher',
  'A fire extinguisher is a device used to put out small fires. It contains a pressurized agent that is sprayed onto the fire to extinguish it.',
  (model) => {
    model.rotation.y = -Math.PI / 2;   // turn it to face into the room
  }
);

// Red mounting backplate so it reads as "wall-mounted", not "floating"
const bracket = new THREE.Mesh(
  new THREE.BoxGeometry(0.15, 2.2, 1.2),
  new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.5 })
);
bracket.position.set(19.85, 4.3, 8);
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

// 8. Animation Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update(); 
  renderer.render(scene, camera);
}
animate();

// 9. Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});