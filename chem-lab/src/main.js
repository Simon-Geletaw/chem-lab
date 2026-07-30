import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
//scene
const scene = new THREE.Scene();
const background = new THREE.Color(0x222222);// this creates a dark background color for the scene
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
//animation loop is a function that is called repeatedly to update the scene and render it to the screen
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


