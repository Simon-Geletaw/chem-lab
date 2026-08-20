// atomView.js — clicking the atomic-structure picture (sticker 1 beside the
// periodic table, back wall) pops the animated 3D atom out of the picture on
// a small pedestal. While it's out you keep FULL first-person movement —
// walk up to it, walk around it — and the showcase treatment is applied:
// the atom's own internal lights (nucleus glow, orbit colors, dark
// hemisphere), and a boosted bloom so the gold nucleus and coloured
// electrons glow. Pressing E puts the
// atom back into the picture and the room returns to its normal glow.
//
// States:
//   'closed'  -> nothing shown
//   'opening' -> the display glides out of the picture and grows, bloom ramps up
//   'open'    -> the atom sits on its pedestal, animating, free to walk around
//   'closing' -> the display retracts into the picture, bloom ramps down
// E is handled by hand.js (it owns the keyboard); clicking the picture again
// does nothing while it's out — E is the ONLY exit.
import * as THREE from 'three';
import { AtomicStructure } from './ui/atomicStructure.js';

const EMERGE_DIST = 1.43;      // the atom glides this far off the wall (m)
const ATOM_Y = 1.7;            // nucleus center — same eye height as the poster
const ATOM_SCALE = 0.085;      // orbits span ~1.1 m; nucleus reads palm-sized
const BLOOM_SHOW = { strength: 0.6, threshold: 0.75 };  // showcase glow — keeps the room GPU-friendly
const BLOOM_HOME = { strength: 0.12, threshold: 0.95 }; // lab's normal setting
const PEDESTAL_FOOT = 0.42;    // collider half-size around the pedestal (m)

const ZERO3 = new THREE.Vector3(0.001, 0.001, 0.001);
const ONE3 = new THREE.Vector3(1, 1, 1);

export function createAtomView(scene, camera, player, renderer, setBloom, sticker) {
  const hint = document.getElementById('action-hint');

  let state = 'closed';                   // 'opening' | 'open' | 'closing'
  let group = null;                       // pedestal + atom + lights (display)
  let atom = null;                        // the AtomicStructure instance
  let collider = null;                    // feet-collision box around the pedestal
  const bloomCur = { strength: BLOOM_HOME.strength, threshold: BLOOM_HOME.threshold };

  // Ease the bloom toward a target; setBloom is main.js's hook into the
  // real UnrealBloomPass (no-op on the LOW preset, which has no composer).
  function rampBloom(target, delta) {
    const k = Math.min(1, delta * 6);
    bloomCur.strength += (target.strength - bloomCur.strength) * k;
    bloomCur.threshold += (target.threshold - bloomCur.threshold) * k;
    if (setBloom) setBloom(bloomCur.strength, bloomCur.threshold);
  }

  function buildDisplay(sticker) {
    const home = sticker.userData.homePosition;
    // Group origin sits on the FLOOR under the picture: the pedestal stands
    // on it, the atom floats at eye height, and the whole display glides
    // forward (EMERGE_DIST) while scaling up from the picture plane.
    group = new THREE.Group();
    group.userData = {
      home: new THREE.Vector3(home.x, 0, home.z),
      out: new THREE.Vector3(home.x, 0, home.z + EMERGE_DIST)
    };
    group.position.copy(group.userData.home);
    group.scale.copy(ZERO3);

    // Museum pedestal, matching the room's dark trim (0x22303c, like the
    // periodic-table board).
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 1.15, 28),
      new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.65 })
    );
    pedestal.position.y = 1.15 / 2;      // top at 1.15 — the atom sits on it
    group.add(pedestal);

    // The animated atom: gold nucleus + 3 orbit rings + 3 colored electrons.
    // Its own update() (electron orbits, nucleus pulse) runs every frame.
    atom = new AtomicStructure();
    atom.scale.setScalar(ATOM_SCALE);
    atom.position.set(0, ATOM_Y, 0);
    group.add(atom);

    // The atom brings its OWN internal lighting (nucleus glow, orbit colors,
    // dark hemisphere) — no showcase lights here. DirectionalLights would
    // flood the whole room (they ignore the group's scale/position), which
    // showed up as glare on the benches and a wash over the lab.

    // The display is built ONCE at boot (scale ~0, invisible) so its shaders
    // compile behind the loading screen — clicking the picture is then an
    // instant show, never a multi-second shader-compile freeze. It stays in
    // the scene for the whole session; opening/closing only animates scale.
    scene.add(group);
  }

  // Prebuild the display ONCE at boot (scale ~0, invisible) so its materials
  // and shaders compile behind the loading screen — clicking the picture is
  // then an instant show, never a multi-second shader-compile freeze. It
  // stays in the scene for the whole session; opening/closing only animates
  // scale and the collider.
  if (sticker) buildDisplay(sticker);

  function focus(sticker) {
    if (state !== 'closed') return;
    if (!group) buildDisplay(sticker);   // defensive: no sticker at boot
    // The pedestal is solid: you bump into it instead of walking through —
    // but ONLY while the display is out (scale 0 must not block the wall).
    const out = group.userData.out;
    collider = new THREE.Box3(
      new THREE.Vector3(out.x - PEDESTAL_FOOT, 0, out.z - PEDESTAL_FOOT),
      new THREE.Vector3(out.x + PEDESTAL_FOOT, 1.3, out.z + PEDESTAL_FOOT)
    );
    player.colliders.push(collider);
    state = 'opening';
  }

  // E is the ONLY exit (hand.js calls this from its keydown guard).
  function exit() {
    if (state === 'closed' || state === 'closing') return;
    state = 'closing';
  }

  const atomView = {
    get active() { return state !== 'closed'; },
    get state() { return state; },

    focus,
    exit,

    update(delta) {
      if (state === 'closed') return;
      const e = Math.min(1, delta * 8);   // the lab's easing idiom

      if (state === 'opening') {
        group.position.lerp(group.userData.out, e);
        group.scale.lerp(ONE3, e);
        rampBloom(BLOOM_SHOW, delta);
        if (group.scale.x > 0.99) {
          group.scale.copy(ONE3);
          state = 'open';
        }
      } else if (state === 'open') {
        group.scale.lerp(ONE3, e);        // settle any last mm
        rampBloom(BLOOM_SHOW, delta);
      } else if (state === 'closing') {
        group.position.lerp(group.userData.home, e);
        group.scale.lerp(ZERO3, e);
        rampBloom(BLOOM_HOME, delta);
        if (group.scale.x < 0.02) {
          group.scale.copy(ZERO3);        // invisible again — stays in the scene
          const i = player.colliders.indexOf(collider);
          if (i >= 0) player.colliders.splice(i, 1);
          collider = null;
          state = 'closed';
        }
      }

      if (atom) atom.update();            // electrons keep orbiting the whole time
    }
  };

  return atomView;
}