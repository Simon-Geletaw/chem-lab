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
import { loader } from './ui/loader.js';

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

  // Boot watchdog: if the start screen has not been handed off within 20 s,
  // something is stuck (blocked font fetch, hung network, crashed build).
  // Fail loudly with a Reload button instead of leaving the bar frozen.
  const watchdog = setTimeout(
    () => loader.fail('Taking too long — check your connection and reload.'),
    20000
  );

  try {
    // Shared boot scope: stages run sequentially, but later stages read the
    // objects built by earlier ones, so their bindings live here.
    let scene, camera, renderer, composer, interactableObjects;
    let player, exitDoor, room, animate;

    loader.register([
      // Room data first — the whole app labels itself from server/data/room.json.
      // The brand font (Space Grotesk) loads here too, raced against a ~2.5 s
      // timeout so a slow or blocked font fetch can never hang the boot; on
      // timeout the app falls back to the system fonts.
      { name: 'Loading the room\u2026', weight: 20, run: async () => {
          await loadRoom();
          room = getRoom();
          document.title = room.name;
          const titleEls = document.querySelectorAll('#loading-title, #start-title');
          titleEls.forEach((el) => { if (el) el.textContent = room.name; });
          loader.progress(0.6);
          if (document.fonts) {
            await Promise.race([
              document.fonts.load('700 108px "Space Grotesk"'),
              new Promise((resolve) => setTimeout(resolve, 2500))
            ]);
          }
          loader.progress(1);
      }},

      { name: 'Building the room\u2026', weight: 45, run: async () => {
          scene = new THREE.Scene();
          scene.background = new THREE.Color(0x9fbdd6);

          camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
          // Spawn at the entrance facing into the room (yaw 0 = facing -z). Customise
          // per app via room.json "spawn": { x, z, yaw }. Must be set BEFORE
          // createPlayer() — PointerLockControls snapshots the camera orientation.
          const spawn = room.spawn || { x: 0, z: 4, yaw: 0 };
          camera.position.set(spawn.x, 1.6, spawn.z);
          camera.rotation.set(0, spawn.yaw ?? 0, 0);
          scene.add(camera);

          renderer = new THREE.WebGLRenderer({ antialias: true });
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.setPixelRatio(effectivePixelRatio());
          renderer.shadowMap.enabled = quality.level !== 'low';
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 0.9;
          document.body.appendChild(renderer.domElement);

          composer = null;
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

          interactableObjects = [];
          createRoom(scene, interactableObjects);
          player = createPlayer(camera);
          await loader.yieldToPaint();
          loader.progress(1);
      }},

      { name: 'Setting up the furniture\u2026', weight: 20, run: async () => {
          createFurniture(scene, interactableObjects, player.colliders);
          exitDoor = createExitDoor(scene, camera, interactableObjects);

          const clock = new THREE.Clock();
          const fpsMeter = createFpsMeter();
          const qualityMonitor = createQualityMonitor(renderer, scene);
          let lastLevel = quality.level;

          animate = () => {
            requestAnimationFrame(animate);
            // PERF (Phase 2a): cap the world clock at 50 ms. A tab switch or
            // compositor stall can make getDelta() spike to whole seconds, which
            // teleports the camera in one step; 0.05 s only cuts those spikes —
            // normal ~0.016 s frames pass through.
            const delta = Math.min(clock.getDelta(), 0.05);  // seconds since last frame (~0.016 at 60fps)
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
          };
          loader.progress(1);
      }},

      { name: 'Compiling the first frame\u2026', weight: 13, run: async () => {
          renderer.compile(scene, camera);
          renderer.render(scene, camera);
          animate();

          window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (composer) composer.setSize(window.innerWidth, window.innerHeight);
          });
          loader.progress(1);
      }},

      // The start page is shown only after all scene construction, compilation,
      // and the initial render have completed behind the loader.
      { name: 'Ready\u2026', weight: 2, run: async () => {
          await loader.yieldToPaint();
          loader.done();
      }},
    ]);

    await loader.run();
  } finally {
    clearTimeout(watchdog);
  }
}

boot().catch((err) => {
  console.error('startup failed:', err);
  loader.fail('Something went wrong while loading the room. Reload the page to try again.');
});