// tour.js — the guided tour: the camera flies to 4 stations, gently arcs
// around each while its info card is pinned visible, then returns control.
//
// It's a tiny STATE MACHINE. state is one of:
//   'idle'   -> tour not running (player walks normally)
//   'travel' -> flying from wherever we are to the next stop (2.5 s)
//   'orbit'  -> swaying around the stop in a partial arc (8 s)
//   'return' -> flying back to where the player stood before the tour
//
// Every transition is driven by ONE clock variable t (seconds in this state).
import * as THREE from 'three';

const TRAVEL_TIME = 2.5;   // seconds to fly between stops
const ORBIT_TIME = 8;      // seconds spent at each stop
const EYE = 1.6;           // tour camera stays at eye height

// Ease: starts slow, ends slow (the classic "smoothstep" S-curve).
const smoothstep = (x) => x * x * (3 - 2 * x);

export function createTour(camera, player, interactions) {
  // Each stop: what to circle (center), from how far (radius), which way the
  // arc faces (baseAngle — pointing INTO the room so we never enter a wall),
  // how wide it sways (sweep), and which proximity panel to pin (-1 = none).
  const stops = [
    { center: new THREE.Vector3(2.0, 1.0, 1.2), radius: 1.8, baseAngle: Math.PI, sweep: Math.PI / 3, panelIndex: 3 },  // PPE station
    { center: new THREE.Vector3(-6.5, 1.6, -1), radius: 2.0, baseAngle: Math.PI / 2,  sweep: Math.PI / 3, panelIndex: 2 },  // shelves
    { center: new THREE.Vector3(0, 1.0, -1.5),  radius: 2.2, baseAngle: 0,            sweep: Math.PI / 2, panelIndex: 0 },  // lab bench
    { center: new THREE.Vector3(6.85, 1.2, 2),  radius: 2.0, baseAngle: -Math.PI / 2, sweep: Math.PI / 3, panelIndex: 1 },  // extinguisher
    { center: new THREE.Vector3(0, 1.7, -5),    radius: 3.5, baseAngle: 0,            sweep: Math.PI / 4, panelIndex: -1 }  // periodic table
  ];

  let state = 'idle';
  let stopIndex = 0;
  let t = 0;                                  // seconds spent in the current state
  const fromPos = new THREE.Vector3();        // where this travel started
  const fromLook = new THREE.Vector3();
  const savedPos = new THREE.Vector3();       // player position before the tour
  const savedLook = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  // Ping-pong arc: sin(t) sways the angle between -sweep..+sweep around
  // baseAngle, so the camera slowly goes around and comes back. No wall hits.
  const angleAt = (stop, time) => stop.baseAngle + stop.sweep * Math.sin(time * 0.5);

  // Parametric circle: a point 'radius' meters from center, at angle a.
  const posOnOrbit = (stop, a) => new THREE.Vector3(
    stop.center.x + Math.sin(a) * stop.radius,
    EYE,
    stop.center.z + Math.cos(a) * stop.radius
  );

  // The point 3 m in front of the camera — used to blend LOOK directions
  // smoothly (we lerp this point, not the rotation itself).
  function currentLookPoint() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir.multiplyScalar(3).add(camera.position);
  }

  function setForced(index, value) {
    if (index >= 0 && interactions.panels[index]) interactions.panels[index].forced = value;
  }

  function beginTravel() {
    state = 'travel';
    t = 0;
    fromPos.copy(camera.position);
    fromLook.copy(currentLookPoint());
  }

  // --- UI ---
  const overlay = document.getElementById('start-overlay');
  const skipBtn = document.getElementById('tour-skip');
  const tourBtn = document.getElementById('tour-btn');
  const mobileControls = document.getElementById('mobile-controls');

  function endTour() {
    state = 'idle';
    tour.active = false;
    player.enabled = true;
    interactions.setPicking(true);
    skipBtn.style.display = 'none';
    // Pointer lock can NEVER be re-engaged by code — only by a user click.
    // So we show the overlay again and let the player click back in.
    document.getElementById('overlay-enter').textContent = 'Tour finished — click to keep exploring';
    document.getElementById('start-title').textContent = 'Chemistry Lab';
    document.getElementById('enter-btn').textContent = 'Enter Lab';
    overlay.style.display = 'flex';
  }

  const tour = {
    active: false,

    start() {
      if (tour.active) return;
      tour.active = true;
      player.enabled = false;                 // WASD/D-pad must not fight the tour
      player.controls.unlock();               // release the mouse if it was locked
      interactions.setPicking(false);         // no clicking things mid-flight
      savedPos.copy(camera.position);
      savedLook.copy(currentLookPoint());
      stopIndex = 0;
      overlay.style.display = 'none';
      mobileControls.style.display = 'none';
      skipBtn.style.display = 'block';
      beginTravel();
    },

    update(delta) {
      if (!tour.active) return;
      t += delta;

      if (state === 'travel') {
        const stop = stops[stopIndex];
        const k = smoothstep(Math.min(1, t / TRAVEL_TIME));
        camera.position.lerpVectors(fromPos, posOnOrbit(stop, angleAt(stop, 0)), k);
        lookTarget.lerpVectors(fromLook, stop.center, k);
        camera.lookAt(lookTarget);
        if (t >= TRAVEL_TIME) {
          state = 'orbit';
          t = 0;
          setForced(stop.panelIndex, true);   // pin this stop's info card on
        }

      } else if (state === 'orbit') {
        const stop = stops[stopIndex];
        camera.position.copy(posOnOrbit(stop, angleAt(stop, t)));
        camera.lookAt(stop.center);
        if (t >= ORBIT_TIME) {
          setForced(stop.panelIndex, false);
          stopIndex++;
          if (stopIndex < stops.length) {
            beginTravel();                    // fly to the next station
          } else {
            state = 'return';                 // all stops done — fly home
            t = 0;
            fromPos.copy(camera.position);
            fromLook.copy(stop.center);
          }
        }

      } else if (state === 'return') {
        const k = smoothstep(Math.min(1, t / TRAVEL_TIME));
        camera.position.lerpVectors(fromPos, savedPos, k);
        lookTarget.lerpVectors(fromLook, savedLook, k);
        camera.lookAt(lookTarget);
        if (t >= TRAVEL_TIME) endTour();
      }
    }
  };

  // stopPropagation: the overlay behind this button also listens for clicks
  // (to engage pointer lock) — don't let this click bubble up to it.
  tourBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    tour.start();
  });

  skipBtn.addEventListener('click', () => {
    if (!tour.active || state === 'return') return;
    setForced(stops[stopIndex]?.panelIndex ?? -1, false);
    state = 'return';
    t = 0;
    fromPos.copy(camera.position);
    fromLook.copy(currentLookPoint());
  });

  return tour;
}
