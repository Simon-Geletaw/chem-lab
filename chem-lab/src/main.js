import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createRoom } from './room.js';
import { createPeriodicWall, createWallSticker } from './periodicWall.js';
import { createPlayer } from './player.js';
import { createFurniture } from './furniture.js';
import { createInteractions } from './interactions.js';
import { createTour } from './tour.js';
import { createAtomView } from './atomView.js';
import { createHand } from './hand.js';
import { createBeaker } from './beaker.js';
import { createEffectRunner, initEffectPools, prewarmEffects } from './effects/index.js';
import { createWelcomeCard } from './ui/welcomeCard.js';
import { createExitCard } from './ui/exitCard.js';
import { createWarningCard } from './ui/warningCard.js';
import { createBurnCard } from './ui/burnCard.js';
import { createPourDialog } from './ui/pourDialog.js';
import { createHUD } from './ui/hud.js';
import { loader } from './ui/loader.js';
import { createGloves } from './gloves.js';
import { createCoat } from './coat.js';
import { createMask } from './mask.js';
import { createEyegoggles } from './eyegoggles.js';
import { createTrashBin } from './trashBin.js';
import { createExperimentOverlay } from './ui/experimentOverlay.js';
import { createSimDoors } from './simDoors.js';
import { loadSimulations } from './simulations/registry.js';
import { createExperimentTable } from './experimentTable.js';
import { loadExperiments } from './experiments/registry.js';
import { loadChemistry, getShelfChemicals } from './chemistry/registry.js';
import { quality, effectivePixelRatio, createFpsMeter, createQualityMonitor } from './quality.js';
import { initLightPool } from './effects/lightPool.js';

// Startup: the loading screen (static markup in index.html) is already painted.
// main.js only reports real progress on it through the stage pipeline; a
// friendly error card replaces a hang if WebGL is missing or anything throws
// while the lab builds.

// WebGL check — a clear message beats the silent "no context" console spam.
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
    let scene, camera, renderer, composer, bloomPass, interactableObjects;
    let player, furniture, expTable, simDoors, beaker, hand, interactions;
    let tour, gloves, trashBin, atomView, effectRunner, animate;

    loader.register([
      // PHASE 1: chemistry data loads BEFORE the world is built, because the
      // shelf bottles are generated from it. (Phase 10 swaps the data source
      // to the backend API — this stage stays.)
      { name: 'Loading the lab data\u2026', weight: 15, run: async () => {
          await loadChemistry();
          loader.progress(0.35);
          await loadSimulations();
          loader.progress(0.7);
          await loadExperiments();
          loader.progress(1);
      }},

      // The door sign textures draw with the brand font (Space Grotesk) — wait
      // for it so canvas text doesn't fall back to Arial mid-boot. Raced
      // against a ~2.5 s timeout so a slow or blocked font fetch can never
      // hang the boot; on timeout the app falls back to the system fonts.
      { name: 'Loading the fonts\u2026', weight: 5, run: async () => {
          if (document.fonts) {
            await Promise.race([
              document.fonts.load('700 108px "Space Grotesk"'),
              new Promise((resolve) => setTimeout(resolve, 2500))
            ]);
          }
          loader.progress(1);
      }},

      { name: 'Building the lab\u2026', weight: 40, run: async () => {
          // 1. Scene
          scene = new THREE.Scene();
          scene.background = new THREE.Color(0x9fbdd6);   // late-afternoon day sky — dimmer than full noon

          // 2. Camera
          // SCALE RULE: 1 unit = 1 METER. Eye height of a standing person ≈ 1.6 m.
          camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
          camera.position.set(0, 1.6, 4);
          // Ch 10.3: the camera itself renders fine outside the scene graph, but its
          // CHILDREN (the held bottle!) are only drawn if the camera is IN the scene.
          scene.add(camera);

          // 3. Renderer
          renderer = new THREE.WebGLRenderer({ antialias: true });
          renderer.setSize(window.innerWidth, window.innerHeight);
          // PERF: cap the render resolution. Without this call Three renders at the
          // screen's FULL devicePixelRatio (2-3× on laptops) — the single biggest
          // hidden cost in the app. We also clamp to a fixed pixel budget
          // (maxRenderPixels) so huge / high-DPI screens can't balloon memory.
          renderer.setPixelRatio(effectivePixelRatio());
          renderer.shadowMap.enabled = quality.level !== 'low';   // LOW preset skips shadows entirely
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;       // soft penumbra = lights sit in the floor
          // ACES filmic tone mapping: without it, bright primaries clip to ugly flat
          // colors. One line gives the whole room a natural, photographic response.
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 0.9;
          // PERF (Phase 5a): glass transmission forces a hidden second scene pass per
          // frame. Rendering that pass at half resolution = a quarter of the fill cost,
          // visually near-identical for thin glass.
          renderer.transmissionResolutionScale = 0.5;
          document.body.appendChild(renderer.domElement);
          await loader.yieldToPaint();
          loader.progress(0.3);

          // 4. Build the world (each module adds its own part to the scene)
          interactableObjects = [];
          createRoom(scene, interactableObjects);
          // Simulation doors (Biology / Mathematics / Physics) on the front wall —
          // position, labels, accent colors and E-triggers all come from
          // server/data/simulations.json. Pressing E at a door routes to its sim.
          simDoors = createSimDoors(scene);
          // PERF: effect lights (fire/flash) come from a fixed 2-light pool created
          // once — reactions never allocate lights or trigger shader recompiles.
          initLightPool(scene);
          // PERF (Phase 3): particle effects come from pre-built pools, and prewarmEffects
          // below compiles their shaders so even the first reaction never stalls.
          initEffectPools(scene);
          createPeriodicWall(scene, interactableObjects);
          // Atomic-structure stickers on the open wall space around the lab: two on
          // the back wall flanking the periodic table, one on the front wall between
          // the Physics sim door and the exit door (decorative canvases, load with
          // the other wall art). Note: the PNG filenames contain spaces — encoded as
          // %20 in the URLs, same pattern as the AIT logo (/Logo/AIT%20logo%20.png).
          createWallSticker(scene, `${import.meta.env.BASE_URL}sticker/sticker-1-atomic-structure-1.png`, -4.55, -4.98, 0, interactableObjects);
          createWallSticker(scene, `${import.meta.env.BASE_URL}sticker/sticker-2%20c2h205%20.png`, 4.55, -4.98);
          createWallSticker(scene, `${import.meta.env.BASE_URL}sticker/sticker3%20chemistry%20.png`, 0.425, 4.97, Math.PI);
          player = createPlayer(camera);
          // Experiment-cards table in the front-left corner (between the Biology door
          // and the chemical shelf) — cards, images, safety text and destination URLs
          // all come from server/data/experiments.json; the table auto-lengthens with
          // the card count. Pressing E at a card opens its overlay (hand.js, Phase 2).
          expTable = createExperimentTable(scene, interactableObjects, player.colliders);
          // Furniture registers its bounding boxes in player.colliders so you bump into it
          furniture = createFurniture(scene, interactableObjects, player.colliders, getShelfChemicals());
          await loader.yieldToPaint();
          loader.progress(1);
      }},

      { name: 'Setting up the equipment\u2026', weight: 20, run: async () => {
          // F2: welcome/help card on load; its Start button reuses player.enter() so the
          // pointer-lock request happens inside the user's real click gesture.
          const welcomeCard = createWelcomeCard(() => player.enter());

          // E at the steel exit door on the front wall leaves the lab. hand.js opens
          // it in modal mode (mouse freed, no pause menu); "Return to Lab" starts a
          // fresh session (resetLab below) and re-locks the pointer.
          const exitCard = createExitCard(() => {
              resetLab();
              player.endModal();
          });

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
          interactions = createInteractions(camera, player.controls, scene, interactableObjects);

          // Effects: descriptors from the teacher's JSON become particles/lights/shakes.
          // getExtras supplies the two things effects can't build themselves (Ch 7.4):
          // the beaker's liquid material (colorChange) and the camera (shake). It's a
          // function because the beaker doesn't exist yet on this line — lazy lookup.
          effectRunner = createEffectRunner(scene, () => ({
            liquidMaterial: beaker.liquidMaterial,
            camera
          }));

          // The reaction vessel on the island bench (Phase 3 + 5 + 6 + F3). The warning
          // card serves double duty: reaction safety pedagogy AND the "flask is full" notice.
          const warningCard = createWarningCard(player);
          beaker = createBeaker(scene, interactableObjects, camera, effectRunner, warningCard);
          loader.progress(0.3);

          // The hand: E picks up an aimed bottle / pours it into the beaker, Q sends it
          // home. The F4 dialog asks "how much?" before each pour; the hand drives it
          // through the player's modal mode so the pause menu stays out of the way.
          // F5: gloves — the box on the bench toggles them, the HUD shows the state,
          // and the hand refuses hazardous bottles bare-handed.
          const pourDialog = createPourDialog();
          const hud = createHUD();
          const experimentOverlay = createExperimentOverlay(player);
          gloves = createGloves(scene, camera, interactableObjects);
          const mask = createMask(scene, camera, interactableObjects);
          // The safety goggles: a dispenser on the PPE table; E toggles them on/off
          // (coat-style). Purely cosmetic: on-view FPS overlay + HUD chip only.
          const goggles = createEyegoggles(scene, camera, interactableObjects, hud);
          // The lab coat: hangs on the rack beside the exit door, sleeves appear on
          // the wrists when worn (needs the gloves' roll anchors, so it comes after).
          const coat = createCoat(scene, camera, interactableObjects, hud, gloves);
          // The biohazard bin: the ONLY way used PPE comes off (dispensers only put ON).
          trashBin = createTrashBin(scene, interactableObjects);
          // The atomic-structure picture (sticker 1 beside the periodic table):
          // clicking it pops the animated 3D atom out on a pedestal with the demo
          // showcase (key/rim lights + boosted bloom) — and you keep walking freely
          // around it. E (hand.js) is the ONLY way back; the atom retracts into the
          // picture and the room's normal glow returns.
          atomView = createAtomView(scene, camera, player, renderer, (strength, threshold) => {
            if (bloomPass) {
              bloomPass.strength = strength;
              bloomPass.threshold = threshold;
            }
          });
          hand = createHand(camera, scene, interactableObjects, beaker, player, pourDialog, gloves, warningCard, hud, mask, trashBin, effectRunner, simDoors, coat, goggles, expTable, experimentOverlay, exitCard, atomView);
          interactions.setAtomHandler((sticker) => {
            // Only opens when the view is closed AND the player is empty-handed;
            // while the atom is out a click on the picture is a no-op (E exits).
            if (sticker && !atomView.active && hand.state === 'EMPTY') {
              atomView.focus(sticker);
            }
          });
          // Headless smoke-test hook (precedent: window.beaker above).
          window.__atomView = atomView;
          window.__interactions = interactions;
          loader.progress(0.6);

          // resetLab() — a "fresh session": every lab module back to its start state,
          // the camera home at the entrance. Shared by the exit card's "Return to Lab"
          // (E at the exit door) and the T6 burn-game-over "Restart Experiment" card,
          // so one function defines what "starting over" means.
          function resetLab() {
              if (atomView.active) atomView.exit();         // retract the 3D atom if it's out
              hand.resolveBurn();                    // gripped/fallen bottle -> shelf, hand cleared
              player.enabled = true;                 // re-enable walking (was off during the reveal)
              interactions.setPicking(true);         // re-enable clicks (tiles, panels)
              if (gloves.on) hud.setGloves(gloves.toggle());   // strip PPE + HUD
              if (mask.on) hud.setMask(mask.toggle());
              if (coat.on) coat.remove();                      // chip + sleeves handled inside
              if (goggles.on) goggles.remove();                 // chip + overlay handled inside
              beaker.reset();                        // empty the flask
              effectRunner.clear();                  // kill leftover fire/smoke/flash
              camera.position.set(0, 1.6, 4);        // fresh entrance
              camera.quaternion.identity();          // facing into the room
          }

          // T6 burn game-over: the FIRST bare-handed hazardous contact triggers a
          // dramatic burn reveal (slow-mo + charring in real time), then a blocking
          // "Restart Experiment" card. Clicking it resets the whole lab and resumes fresh
          // at the entrance. hand.onBurn fires the reveal; the card's onRestart runs the reset.
          const burnCard = createBurnCard(player, hand, () => {
              resetLab();                            // fresh session (shared with the exit door)
              player.endModal();                     // modal=false + re-enter (pointer lock)
          });
          hand.onBurn = (chem) => {
              interactions.setPicking(false);        // no clicks while viewing the reveal
              // burnCard runs the whole 5-beat sequence on real-time clocks:
              // char-while-held (2s) → bottle tumbles forward (0.8s) → burned hand
              // visible (3s) → Restart card. It calls hand.dropBottle/applyDropProgress.
              burnCard.start(chem);
          };

          // Temporary Phase 3 test hook — call beaker.receive('h2so4') in the console.
          window.beaker = beaker;

          // Walk-up info cards: fade in when the player comes within ~2.5 m
          furniture.proximitySpots.forEach((spot) => interactions.addProximityPanel(spot));
          expTable.proximitySpots.forEach((spot) => interactions.addProximityPanel(spot));

          // Guided tour: camera visits 4 stations, then hands control back
          tour = createTour(camera, player, interactions);
          loader.progress(1);
      }},

      { name: 'Warming up the effects\u2026', weight: 10, run: async () => {
          // Bloom: real lights glow (fixtures, EXIT sign, reaction fire). Post FX cost
          // is only paid on the HIGH preset — LOW renders straight to the screen.
          composer = null;
          bloomPass = null;                    // reused by atomView's showcase ramp
          if (quality.level === 'high') {
            composer = new EffectComposer(renderer);
            composer.addPass(new RenderPass(scene, camera));
            const bloom = new UnrealBloomPass(
              // Bloom is a blur — it never needs full render resolution. Cap the target
              // width (preserving aspect) so a big screen doesn't allocate oversized
              // bloom buffers alongside the already-capped main framebuffer.
              new THREE.Vector2(
                Math.min(window.innerWidth, quality.maxBloomWidth) / 2,
                (Math.min(window.innerWidth, quality.maxBloomWidth) * (window.innerHeight / window.innerWidth)) / 2
              ),
              0.12, 0.5, 0.95      // strength, radius, threshold — only true lights glow, text stays sharp
            );
            composer.addPass(bloom);
            composer.addPass(new OutputPass());   // tone mapping + color space, after bloom
            bloomPass = bloom;
          }

          // 6. Animation Loop
          const clock = new THREE.Clock();      // measures real time between frames

          // PERF instrumentation: live FPS readout + the auto-degrade monitor (drops
          // to the LOW preset once if this machine can't hold 45 fps — see quality.js).
          const fpsMeter = createFpsMeter();
          const qualityMonitor = createQualityMonitor(renderer, scene);

          // If the auto-degrade monitor drops us to LOW at runtime, retire the bloom
          // composer so the GPU cost actually goes away (not just the pretty glow).
          let lastLevel = quality.level;

          animate = () => {
            requestAnimationFrame(animate);
            // PERF (Phase 2a): cap the world clock at 50 ms. A tab switch or
            // compositor stall can make getDelta() spike to whole seconds, which
            // teleports the pooled particle systems and the camera in one step;
            // 0.05 s only cuts those spikes — normal ~0.016 s frames pass through.
            const delta = Math.min(clock.getDelta(), 0.05);  // seconds since last frame (~0.016 at 60fps)
            // T6 burn reveal: the whole world runs in slow-motion (hand.timeScale) while
            // the player watches the hand char — the charring itself uses its own
            // wall-clock in burnCard, so it still completes in ~3 real seconds.
            const ts = hand.timeScale;
            const worldDelta = delta * ts;
            if (quality.level !== lastLevel) {
              lastLevel = quality.level;
              if (composer) {
                composer.dispose();
                composer = null;
                bloomPass = null;                  // the atom showcase ramps a real pass only
              }
            }
            player.update(worldDelta);               // walking (does nothing while the tour runs)
            hand.update(worldDelta);                 // carry/return animation + hover hints
            simDoors.update(worldDelta, camera);     // LED status strips (pulse / flare on aim)
            expTable.update(worldDelta, camera);     // experiment-card LED strips
            gloves.update(worldDelta);               // hands easing in/out of view (F5)
            beaker.update(worldDelta);               // billboard the content label
            effectRunner.update(worldDelta);         // animate live effects, dispose finished ones
            tour.update(worldDelta);                 // tour camera (does nothing while idle)
            atomView.update(worldDelta);             // atom orbit view (does nothing while closed)
            interactions.update(worldDelta);
            trashBin.update(worldDelta);             // lid swing + flying PPE props
            if (composer) composer.render();
            else renderer.render(scene, camera);
            fpsMeter.tick(delta);
            qualityMonitor.tick(delta);
          };

          // Final GPU preparation remains behind the loading screen. Compile the room
          // and pooled effects, then submit a first complete lab frame before the game
          // loop and start page are allowed to appear.
          prewarmEffects(renderer, scene, camera);
          loader.progress(1);
      }},

      { name: 'Compiling the first frame\u2026', weight: 8, run: async () => {
          renderer.compile(scene, camera);
          renderer.render(scene, camera);
          animate();

          // 7. Window Resize
          window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (composer) composer.setSize(window.innerWidth, window.innerHeight);
          });
          loader.progress(1);
      }},

      // The start page is shown only after all scene construction, shader warm-up,
      // compilation, and the initial render have completed behind the loader.
      { name: 'Lab ready\u2026', weight: 2, run: async () => {
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
  loader.fail('Something went wrong while loading the lab. Reload the page to try again.');
});