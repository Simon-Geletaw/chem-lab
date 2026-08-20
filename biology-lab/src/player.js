// player.js — first-person "walking" controls.
// PointerLockControls uses the browser's Pointer Lock API: the cursor is
// hidden + trapped, and we receive RAW mouse movement to turn the head.
// The browser ONLY allows locking inside a user click — hence the overlay.
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const WALK_SPEED = 3;                 // meters per second (a brisk walk)
const EYE_HEIGHT = 1.6;               // camera stays at standing eye level

export function createPlayer(camera) {
  const controls = new PointerLockControls(camera, document.body);

  // --- Mobile detection ---
  // 'pointer: coarse' = the PRIMARY input is a finger (phone/tablet).
  // Phones have NO Pointer Lock and NO keyboard, so they get:
  //   on-screen D-pad buttons -> walking, drag on the screen -> looking.
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  let mobileActive = false;            // "the player tapped Enter" (mobile's isLocked)

  const overlay = document.getElementById('start-overlay');
  const crosshair = document.getElementById('crosshair');
  const mobileControls = document.getElementById('mobile-controls');

  if (isTouchDevice) {
    document.getElementById('overlay-enter').textContent = 'Tap anywhere to enter';
    document.getElementById('overlay-keys').innerHTML =
      '<b>Buttons</b> walk &nbsp;•&nbsp; <b>Drag</b> look &nbsp;•&nbsp; <b>Tap</b> inspect';
  }

  overlay.addEventListener('click', () => {
    player.enter();
  });
  // The pause-menu "Enter Lab / Resume" button (all labs) —
  // stopPropagation so the overlay's click-anywhere handler doesn't double-fire.
  const enterBtn = document.getElementById('enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      player.enter();
    });
  }
  controls.addEventListener('lock', () => {
    overlay.style.display = 'none';
    crosshair.style.display = 'block';
  });
  controls.addEventListener('unlock', () => {
    // F4: while a DOM dialog (pour amount, experiment menu…) owns the screen,
    // the unlock it triggered must NOT flip the pause menu up behind it.
    if (modal) { crosshair.style.display = 'none'; return; }
    overlay.style.display = 'flex';
    crosshair.style.display = 'none';
    // Esc = pause: flip the start screen into a pause screen.
    document.getElementById('start-title').textContent = 'Paused';
    if (enterBtn) enterBtn.textContent = 'Resume';
    unlockTime = performance.now();   // ignore the Esc that JUST paused
  });

  // Esc toggles pause/resume: while locked, the BROWSER exits pointer lock
  // (that's the pause). While the pause menu is up, Esc resumes by re-locking
  // — keydown counts as a user gesture, so the lock request is allowed.
  // (Browsers impose a short cooldown after an Esc-exit; the guard below
  // swallows the same keypress that caused the unlock, and the error listener
  // catches the rare "too fast" case.)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (e.target.closest('input, textarea')) return;
    if (modal) return;                                    // an open dialog owns Esc
    if (controls.isLocked || mobileActive) return;        // locked: pause is native
    const welcome = document.getElementById('welcome-card');
    if (welcome && welcome.style.display === 'flex') return;   // card is open: no resume
    if (performance.now() - unlockTime < 400) return;     // same press that paused
    player.enter();
  });

  document.addEventListener('pointerlockerror', () => {
    // Cooldown after Esc too short — a second Esc press will work.
    document.getElementById('overlay-enter').textContent =
      'Too fast — press Esc again to resume';
  });

  // Keyboard state: we DON'T move inside the event (keydown only repeats
  // stutteringly). We just record which keys are held, and move every frame.
  const keys = {};
  let unlockTime = 0;                   // when pointer lock was last released
  let modal = false;                    // F4: a DOM dialog is on screen right now
  window.addEventListener('keydown', (e) => { keys[e.code] = true;  });
  window.addEventListener('keyup',   (e) => { keys[e.code] = false; });

  // --- D-pad buttons write into the SAME keys object ---
  // The movement code below doesn't know or care whether 'KeyW' was set
  // by a real keyboard or by a thumb on a button. That's the whole trick.
  const dpad = { 'btn-up': 'KeyW', 'btn-down': 'KeyS', 'btn-left': 'KeyA', 'btn-right': 'KeyD' };
  for (const [id, code] of Object.entries(dpad)) {
    const btn = document.getElementById(id);
    const press   = (e) => { e.preventDefault(); keys[code] = true;  };
    const release = (e) => { e.preventDefault(); keys[code] = false; };
    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown',   press);    // so it also works in
    btn.addEventListener('mouseup',     release);  // desktop DevTools testing
  }

  // --- Drag-to-look (mobile) ---
  // Same math PointerLockControls uses internally: a YXZ Euler where
  // y = turning left/right (yaw) and x = looking up/down (pitch).
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const LOOK_SPEED = 0.005;            // radians per pixel of finger movement
  let lastTouch = null;

  window.addEventListener('touchstart', (e) => {
    if (!mobileActive || e.target.closest('#mobile-controls')) return;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!mobileActive || !lastTouch || e.target.closest('#mobile-controls')) return;
    e.preventDefault();                // stop the page from scrolling under us
    const dx = e.touches[0].clientX - lastTouch.x;
    const dy = e.touches[0].clientY - lastTouch.y;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    euler.setFromQuaternion(camera.quaternion);
    euler.y -= dx * LOOK_SPEED;        // drag right -> turn right
    euler.x -= dy * LOOK_SPEED;        // drag down  -> look down
    euler.x = THREE.MathUtils.clamp(euler.x, -Math.PI / 2, Math.PI / 2); // no backflips
    camera.quaternion.setFromEuler(euler);
  }, { passive: false });

  window.addEventListener('touchend', () => { lastTouch = null; });

  // Furniture bounding boxes (filled by furniture.js in a later phase).
  // If a step would land inside one of these, we undo the step.
  const colliders = [];

  // Scratch vectors, allocated ONCE and reused every frame — update() is the
  // hot path, and a per-frame clone/`new THREE.Vector3` would churn the GC.
  const _prevPos = new THREE.Vector3();   // where the player was, in case we collide
  const _feet = new THREE.Vector3();      // feet-height point for furniture collision

  const player = {
    controls,
    colliders,
    enabled: true,                    // the tour will set this to false later
    get isActive() { return controls.isLocked || mobileActive; },

    // The ONE entry point into "playing": pointer lock on desktop, the
    // mobile flag on touch devices. Called by the start overlay AND the
    // welcome card's Start button (which must lock from its own gesture).
    enter() {
      if (isTouchDevice) {
        mobileActive = true;                    // no lock on phones — just a flag
        overlay.style.display = 'none';
        mobileControls.style.display = 'grid';
        return;
      }
      try {
        controls.lock();
      } catch (err) {
        // Browsers block re-locking for ~1.25 s after an Esc-exit and throw
        // synchronously. Don't crash — tell the player the key again works.
        document.getElementById('overlay-enter').textContent =
          'Too fast — press Esc again to resume';
      }
    },

    // F4 modal protocol: a dialog opens -> beginModal() frees the mouse WITHOUT
    // raising the pause menu; the dialog closes -> endModal() re-locks from the
    // user's click/keypress gesture. If the browser's relock cooldown bites,
    // the pause menu surfaces after a beat so the player is never stranded.
    get isModal() { return modal; },
    beginModal() {
      modal = true;
      if (controls.isLocked) controls.unlock();
    },
    endModal() {
      modal = false;
      player.enter();
      if (!isTouchDevice) setTimeout(() => {
        if (!controls.isLocked && !modal) overlay.style.display = 'flex';
      }, 350);
    },

    update(delta) {
      if (!player.enabled || !player.isActive || modal) return;

      _prevPos.copy(camera.position);     // remember, in case we collide

      const step = WALK_SPEED * delta;    // meters to move THIS frame
      if (keys['KeyW']) controls.moveForward(step);
      if (keys['KeyS']) controls.moveForward(-step);
      if (keys['KeyA']) controls.moveRight(-step);
      if (keys['KeyD']) controls.moveRight(step);

      // Poor-man's collision: clamp inside the room (walls at ±7 and ±5,
      // minus 0.3 m so your "shoulders" don't clip through the plaster).
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -6.7, 6.7);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -4.7, 4.7);
      camera.position.y = EYE_HEIGHT;     // no flying, no crouching

      // Furniture collision: check feet position against each box.
      _feet.set(camera.position.x, 0.5, camera.position.z);
      for (const box of colliders) {
        if (box.containsPoint(_feet)) {
          camera.position.copy(_prevPos);  // step back — simpler than sliding
          break;
        }
      }
    }
  };

  return player;
}
