import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {elementsData} from './periodicTable.js'; // Importing elements data
// 1. Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222); // Applied background directly to scene

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

  ctx.fillStyle = '#d9d9d2'; // Gray color for the floor
  ctx.fillRect(0,0,512,512)
  ctx.fillStyle = '#bdbdb4';               // darker tile color
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) {         // every other square, like a chessboard
        ctx.fillRect(col * 64, row * 64, 64, 64);
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

const dirLight = new THREE.DirectionalLight(0xffffff, 1); 
dirLight.position.set(10, 20, 10); 
dirLight.castShadow = true; 
dirLight.shadow.camera.left = -10; 
dirLight.shadow.camera.right = 10; 
dirLight.shadow.camera.top = 10; 
dirLight.shadow.camera.bottom = -10; 
scene.add(dirLight);

// 6. Room Geometry
const floorGeometry = new THREE.PlaneGeometry(100, 100); 
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8, metalness: 0.2 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial); 
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true; // FLOOR CAN NOW RECEIVE SHADOWS
scene.add(floor); 

const wallGeometry = new THREE.PlaneGeometry(40, 15); 
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xabcdef, roughness: 0.8, metalness: 0.2 }); 
const backwall = new THREE.Mesh(wallGeometry, wallMaterial); 
backwall.position.set(0, 7.5, -15); 
backwall.receiveShadow = true; 
scene.add(backwall); 

// 7. 3D Models
const loader = new GLTFLoader(); // Fixed typo here
const interactableObjects = []; 

function loadModel(url, position, scale, name, description){
  loader.load(url, (gltf) => {
    const model = gltf.scene;
    model.position.set(position.x, position.y, position.z);
    model.scale.set(scale, scale, scale);
    
    // Traverse to apply shadows to all child meshes
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    
    model.userData = { name: name, description: description };
    scene.add(model);
    interactableObjects.push(model); // Only pushing once now
  });
}
const elementsGroup = new THREE.Group();
const tilesize = 1.1;
const gap = 0.1;

function createElementTexture(symbol){
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  //Background Color
  context.fillStyle = '#2a9d8f'; // Fixed color code
  context.fillRect(0, 0, canvas.width, canvas.height);
  //border

  context.strokeStyle = '#c9af6d';
  context.lineWidth = 8;
  context.strokeRect(4, 4, 120, 120);
  //Text
  context.fillStyle = '#ffffff';
  context.font = 'bold 64px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(symbol, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

elementsData.forEach((element, index) => {
  const column = index % 18; 
  const row = Math.floor(index / 18); 
  
  const texture = createElementTexture(element.symbol); // Fixed typo: texutre -> texture
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const geometry = new THREE.BoxGeometry(tilesize, tilesize, 0.1);
  
  // WE MUST CREATE THE MESH HERE!
  const tile = new THREE.Mesh(geometry, material);
  
  const xPos = (column - 8.5) * (tilesize + gap); 
  const yPos = (3 - row) * (tilesize + gap);
  
  // Now we can set the position on the tile
  tile.position.set(xPos, yPos, -14.9);

  // 
  tile.userData = {
    name: element.name,
    description: element.fact + " " + element.use,
    isElement: true
  };
  
  interactableObjects.push(tile);
  elementsGroup.add(tile);
});

scene.add(elementsGroup);
// Note: Make sure your folder is lowercase 'models' if that's how you named it in VS Code!
loadModel('/Models/beaker.glb', {x:-2, y:0, z:0}, 1, 'Beaker', 'A beaker is a simple container for stirring, mixing and heating liquids commonly used in many laboratories.');
loadModel('/Models/bunsen_burner.glb', {x:0, y:0, z:2}, 1, 'Bunsen Burner', 'A Bunsen burner is a common piece of laboratory equipment that produces a single open gas flame, which is used for heating, sterilization, and combustion.');
loadModel('/Models/FireEx.glb', {x:0, y:0, z:-2}, 1, 'Fire Extinguisher', 'A fire extinguisher is a device that is used to put out small fires. It typically contains a pressurized agent that can be sprayed onto the fire to extinguish it.');
loadModel('/Models/folding_table.glb', {x:2, y:0, z:0}, 1, 'Folding Table', 'A folding table is a type of table that can be collapsed and stored away when not in use. It is often used in laboratories for temporary workspaces.');
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