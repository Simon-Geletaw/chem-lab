// effects/bubbles.js — fizzing inside the liquid (book Ch 12.5).
//
// Same THREE.Points machinery as smoke, different constraints: particles are
// born at the liquid's BOTTOM, stay inside its radius, rise ~6 cm, and POP at
// the surface (respawn, no fade) — popping is what reads as "fizz".
import * as THREE from 'three';
import { quality } from '../quality.js';

export function createBubbles(params, position, scene) {
  const COUNT = Math.max(8, Math.round(40 * (params.intensity ?? 1) * quality.particleScale));
  const duration = params.duration ?? 3;

  const R = 0.035;          // stay inside the liquid cylinder (r=0.043)
  const BOTTOM = 0.005;     // just above the beaker floor (local to position)
  const TOP = 0.062;        // the liquid surface

  const positions = new Float32Array(COUNT * 3);
  const speeds = [];
  const wobblePhase = [];

  function spawn(i) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * R;
    positions[i * 3] = position.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = position.y + BOTTOM + Math.random() * 0.01;
    positions[i * 3 + 2] = position.z + Math.sin(angle) * r;
    speeds[i] = 0.03 + Math.random() * 0.05;
    wobblePhase[i] = Math.random() * Math.PI * 2;
  }
  for (let i = 0; i < COUNT; i++) spawn(i);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.012,
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let elapsed = 0;

  return {
    update(delta) {
      elapsed += delta;
      const winding_down = elapsed >= duration;

      for (let i = 0; i < COUNT; i++) {
        const y = positions[i * 3 + 1] + speeds[i] * delta;
        if (y > position.y + TOP) {
          // POP at the surface. During wind-down, sink dead bubbles out of
          // sight instead of respawning — the fizz dies down naturally.
          if (!winding_down) spawn(i);
          else positions[i * 3 + 1] = -10;
          continue;
        }
        positions[i * 3 + 1] = y;
        // slight sideways wobble — bubbles never rise straight
        positions[i * 3] += Math.sin(elapsed * 20 + wobblePhase[i]) * 0.002 * delta * 60;
      }
      geo.attributes.position.needsUpdate = true;

      return elapsed < duration + 1;   // grace period for the last bubbles to top out
    },

    dispose() {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    }
  };
}
