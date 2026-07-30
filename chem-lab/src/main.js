import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
//scene
const scene = new THREE.Scene();
const background = new THREE.Color(0x22222);// this creates a dark background color for the scene
//camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1, 5);
//renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
//controls are used to allow the user to interact with the scene using mouse or touch input
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // this adds a smooth damping effect to the controls
//light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white light
const maxPolarAngle = Math.PI/2; // limit the vertical rotation to 90 degrees
const minDistance = 5;// minimum distance from the target
const maxDistance = 30; // maximum distance i can zoom in or out
// we will create lighting 
// ambinet light is a type of light that illuminates all objects in the scene equally, regardless of their position or orientation. It is often used to simulate indirect lighting or to provide a base level of illumination for the scene.
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white light
scene.add(ambientLight);
//Directional Acts like a sun casts a shadow in a specific direction. It is often used to simulate sunlight or other directional light sources.
const dirLight = new THREE.DirectionalLight(0xffffff, 1); // white light
dirLight.position.set(10, 20, 10); // set the position of the light
dirLight.shadow.camera.left = -10; // set the left boundary of the shadow camera
dirLight.shadow.camera.right = 10; // set the right boundary of the shadow camera
dirLight.shadow.camera.top = 10; // set the top boundary of the shadow camera
dirLight.shadow.camera.bottom = -10; // set the bottom boundary of the shadow camera
dirLight.castShadow = true; // enable shadow casting for the light
scene.add(dirLight);


//FLoor
const floorGeometry = new THREE.PlaneGeometry(100, 100); // create a large plane geometry for the floor
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8, metalness: 0.2 }); // create a standard material for the floor with some roughness and metalness
const floor = new THREE.Mesh(floorGeometry, floorMaterial); // create a mesh from the geometry and material
floor.rotation.x = -Math.PI / 2; // rotate the floor to be horizontal
scene.add(floor); // add the floor to the scene


//periodic table wall
const wallGeometry = new THREE.PlaneGeometry(40, 15); // create a large plane geometry for the wall
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xabcdef, roughness: 0.8, metalness: 0.2 }); // create a standard material for the wall with some roughness and metalness
const backwall = new THREE.Mesh(wallGeometry, wallMaterial); // create a mesh from the geometry and material
backwall.position.set(0, 7.5, -15); //  the scene is used to push a wall back and up
backwall.receiveShadow = true; // enable shadow receiving for the wall
scene.add(backwall); // add the wall to the scene



function animate() {
requestAnimationFrame(animate);// this tells the browser to call the animate function again before the next repaint
controls.update(); // update the controls

renderer.render(scene, camera);
}
animate()
window.addEventListener('resize',()=>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
})


