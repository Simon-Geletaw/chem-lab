// main.js — the Biology Lab standalone app. Boots the room (same shell as the
// Chemistry Lab), walks the player around, and lets them exit back to the
// Chemistry Lab via the door.
//
// Everything user-facing (title, tagline, signs, back link) comes from
// server/data/room.json — loaded here before the world is built.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createRoom } from './room.js';
import { createPlayer } from './player.js';
import { createFurniture } from './furniture.js';
import { createExitDoor } from './exitDoor.js';
import { loadRoom, getRoom } from './registry.js';
import { quality, effectivePixelRatio, createFpsMeter, createQualityMonitor } from './quality.js';
import { createLoader, yieldToPaint } from './ui/loader.js';

const loader = createLoader();

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

async function boot() {
  if (!webglAvailable()) throw new Error('WebGL unavailable');

  // Room data first — the whole app labels itself from server/data/room.json.
  await loadRoom();
  const room = getRoom();
  document.title = room.name;
  const titleEls = document.querySelectorAll('#loading-title, #start-title');
  titleEls.forEach((el) => { if (el) el.textContent = room.name; });
  if (document.fonts) await document.fonts.load('700 108px "Space Grotesk"');
  loader.set(20, 'Building the room\u2026');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fbdd6);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  // Spawn at the entrance facing into the room (yaw 0 = facing -z). Customise
  // per app via room.json "spawn": { x, z, yaw }. Must be set BEFORE
  // createPlayer() — PointerLockControls snapshots the camera orientation.
  const spawn = room.spawn || { x: 0, z: 4, yaw: 0 };
  camera.position.set(spawn.x, 1.6, spawn.z);
  camera.rotation.set(0, spawn.yaw ?? 0, 0);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(effectivePixelRatio());
  renderer.shadowMap.enabled = quality.level !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  document.body.appendChild(renderer.domElement);

  let composer = null;
  if (quality.level === 'high') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(
        Math.min(window.innerWidth, quality.maxBloomWidth) / 2,
        (Math.min(window.innerWidth, quality.maxBloomWidth) * (window.innerHeight / window.innerWidth)) / 2
      ),
      0.12, 0.5, 0.95
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const interactableObjects = [];
  createRoom(scene, interactableObjects);
  const player = createPlayer(camera);
  createFurniture(scene, interactableObjects, player.colliders);
  const exitDoor = createExitDoor(scene, camera, interactableObjects);

  loader.set(60, 'Setting up the exit door\u2026');

  const clock = new THREE.Clock();
  const fpsMeter = createFpsMeter();
  const qualityMonitor = createQualityMonitor(renderer, scene);
  let lastLevel = quality.level;

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (quality.level !== lastLevel) {
      lastLevel = quality.level;
      if (composer) {
        composer.dispose();
        composer = null;
      }
    }
    player.update(delta);
    if (exitDoor) exitDoor.update();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    fpsMeter.tick(delta);
    qualityMonitor.tick(delta);
  }

  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });

  loader.set(95, 'Ready\u2026');
  await yieldToPaint();
  loader.done();
}

boot().catch((err) => {
  console.error('startup failed:', err);
  loader.fail('Something went wrong while loading the room. Reload the page to try again.');
});