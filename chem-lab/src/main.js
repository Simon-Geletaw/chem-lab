import * as THREE from 'three';
import { createRoom } from './room.js';
import { createPeriodicWall } from './periodicWall.js';
import { createPlayer } from './player.js';
import { createFurniture } from './furniture.js';
import { createInteractions } from './interactions.js';
import { createTour } from './tour.js';
import { createHand } from './hand.js';
import { createBeaker } from './beaker.js';
import { createEffectRunner } from './effects/index.js';
import { createWelcomeCard } from './ui/welcomeCard.js';
import { createWarningCard } from './ui/warningCard.js';
import { createPourDialog } from './ui/pourDialog.js';
import { createHUD } from './ui/hud.js';
import { createGloves } from './gloves.js';
import { createMask } from './mask.js';
import { createTrashBin } from './trashBin.js';
import { loadChemistry, getShelfChemicals } from './chemistry/registry.js';
import { quality, createFpsMeter, createQualityMonitor } from './quality.js';
import { initLightPool } from './effects/lightPool.js';

// PHASE 1: chemistry data loads BEFORE the world is built, because the shelf
// bottles are generated from it. Top-level await works in Vite ES modules.
// (Phase 10 swaps the data source to the backend API — this line stays.)
await loadChemistry();

// 1. Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaecbe4);   // soft day sky, matches the windows

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
// PERF: cap the render resolution. Without this call Three renders at the
// screen's FULL devicePixelRatio (2-3× on laptops) — the single biggest
// hidden cost in the app. 1.5× is visually identical at this art style.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap));
renderer.shadowMap.enabled = quality.level !== 'low';   // LOW preset skips shadows entirely
// ACES filmic tone mapping: without it, bright primaries clip to ugly flat
// colors. One line gives the whole room a natural, photographic response.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

// 4. Build the world (each module adds its own part to the scene)
const interactableObjects = [];
createRoom(scene);
// PERF: effect lights (fire/flash) come from a fixed 2-light pool created
// once — reactions never allocate lights or trigger shader recompiles.
initLightPool(scene);
createPeriodicWall(scene, interactableObjects);
const player = createPlayer(camera);
// Furniture registers its bounding boxes in player.colliders so you bump into it
const furniture = createFurniture(scene, interactableObjects, player.colliders, getShelfChemicals());

// F2: welcome/help card on load; its Start button reuses player.enter() so the
// pointer-lock request happens inside the user's real click gesture.
const welcomeCard = createWelcomeCard(() => player.enter());

// Pause-menu actions (the start overlay doubles as a pause screen):
// "Reset Flask" empties the flask so any reaction can be re-run from scratch;
// "Controls & Safety" reopens the welcome/help card without entering.
document.getElementById('reset-flask-btn').addEventListener('click', (e) => {
  e.stopPropagation();          // don't bubble up to the overlay's enter handler
  beaker.reset();
  document.getElementById('overlay-status').textContent =
    'Flask emptied — pour again to redo the reaction.';
});
document.getElementById('controls-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  welcomeCard.show();
});

// Clicking: element tiles pop out with a 3D card; other objects use the HTML panel
const interactions = createInteractions(camera, player.controls, scene, interactableObjects);

// Effects: descriptors from the teacher's JSON become particles/lights/shakes.
// getExtras supplies the two things effects can't build themselves (Ch 7.4):
// the beaker's liquid material (colorChange) and the camera (shake). It's a
// function because the beaker doesn't exist yet on this line — lazy lookup.
const effectRunner = createEffectRunner(scene, () => ({
  liquidMaterial: beaker.liquidMaterial,
  camera
}));

// The reaction vessel on the island bench (Phase 3 + 5 + 6 + F3). The warning
// card serves double duty: reaction safety pedagogy AND the "flask is full" notice.
const warningCard = createWarningCard(player);
const beaker = createBeaker(scene, interactableObjects, camera, effectRunner, warningCard);

// The hand: E picks up an aimed bottle / pours it into the beaker, Q sends it
// home. The F4 dialog asks "how much?" before each pour; the hand drives it
// through the player's modal mode so the pause menu stays out of the way.
// F5: gloves — the box on the bench toggles them, the HUD shows the state,
// and the hand refuses hazardous bottles bare-handed.
const pourDialog = createPourDialog();
const hud = createHUD();
const gloves = createGloves(scene, camera, interactableObjects);
const mask = createMask(scene, camera, interactableObjects);
// The biohazard bin: the ONLY way used PPE comes off (dispensers only put ON).
const trashBin = createTrashBin(scene, interactableObjects);
const hand = createHand(camera, scene, interactableObjects, beaker, player, pourDialog, gloves, warningCard, hud, mask, trashBin);

// Temporary Phase 3 test hook — call beaker.receive('h2so4') in the console.
window.beaker = beaker;

// Walk-up info cards: fade in when the player comes within ~2.5 m
furniture.proximitySpots.forEach((spot) => interactions.addProximityPanel(spot));

// Guided tour: camera visits 4 stations, then hands control back
const tour = createTour(camera, player, interactions);

// 6. Animation Loop
const clock = new THREE.Clock();      // measures real time between frames

// PERF instrumentation: live FPS readout + the auto-degrade monitor (drops
// to the LOW preset once if this machine can't hold 45 fps — see quality.js).
const fpsMeter = createFpsMeter();
const qualityMonitor = createQualityMonitor(renderer, scene);

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();     // seconds since last frame (~0.016 at 60fps)
  player.update(delta);               // walking (does nothing while the tour runs)
  hand.update(delta);                 // carry/return animation + hover hints
  gloves.update(delta);               // hands easing in/out of view (F5)
  beaker.update(delta);               // billboard the content label
  effectRunner.update(delta);         // animate live effects, dispose finished ones
  tour.update(delta);                 // tour camera (does nothing while idle)
  interactions.update(delta);
  trashBin.update(delta);             // lid swing + flying PPE props
  renderer.render(scene, camera);
  fpsMeter.tick(delta);
  qualityMonitor.tick(delta);
}
animate();

// 7. Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
