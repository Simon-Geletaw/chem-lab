// effects/smoke.js — rising, spreading, fading smoke above the beaker.
//
// THE particle lesson (book Ch 12): instead of 150 meshes (= 150 draw calls),
// ONE THREE.Points object whose geometry holds 150 vertices, each drawn as a
// small camera-facing sprite. We build the BufferGeometry by hand — raw typed
// arrays — and animate by mutating the numbers + raising needsUpdate.
import * as THREE from 'three';
import { quality } from '../quality.js';

export function createSmoke(params, position, scene) {
  // particleScale (quality.js): LOW machines run half the particles — the
  // column stays readable, the per-frame buffer upload halves.
  const COUNT = Math.max(12, Math.round(60 * (params.density ?? 1) * quality.particleScale));
  const duration = params.duration ?? 4;

  // The GPU-side buffer: xyzxyzxyz...
  const positions = new Float32Array(COUNT * 3);

  // Parallel arrays (book Ch 12.3): per-particle data lives in plain JS
  // arrays sharing the same index i as the buffer.
  const speeds = [];   // upward m/s
  const drift = [];    // sideways wander {x, z}
  const ages = [];     // seconds alive
  const lives = [];    // seconds until recycled

  // Spawn = a 3 cm disc at the beaker mouth. Angle+radius, not x/y random,
  // so particles fill a circle rather than a square.
  function spawn(i) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.03;
    positions[i * 3] = position.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = position.y + Math.random() * 0.02;
    positions[i * 3 + 2] = position.z + Math.sin(angle) * r;
    speeds[i] = 0.15 + Math.random() * 0.25;
    drift[i] = { x: (Math.random() - 0.5) * 0.1, z: (Math.random() - 0.5) * 0.1 };
    ages[i] = 0;
    lives[i] = 1.2 + Math.random() * 1.3;
  }
  // Stagger initial ages so the column doesn't start as a flat puck.
  for (let i = 0; i < COUNT; i++) {
    spawn(i);
    ages[i] = Math.random() * lives[i];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: params.color ?? '#ffffff',
    size: 0.05,
    transparent: true,
    opacity: 0.8,
    depthWrite: false      // soft overlap instead of harsh occlusion (book Ch 12.2)
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let elapsed = 0;

  return {
    update(delta) {
      elapsed += delta;

      for (let i = 0; i < COUNT; i++) {
        ages[i] += delta;
        if (ages[i] > lives[i]) {
          // RECYCLE (book Ch 12.3): never allocate mid-effect — dead particles
          // respawn at the mouth. Except in the wind-down: park them at the
          // source so the column thins out naturally instead of blinking off.
          if (elapsed < duration) spawn(i);
          else { positions[i * 3 + 1] = position.y; speeds[i] = 0; }
          continue;
        }
        positions[i * 3] += drift[i].x * delta;
        positions[i * 3 + 1] += speeds[i] * delta;
        positions[i * 3 + 2] += drift[i].z * delta;
        // widen as they rise: drift grows with age
        drift[i].x *= 1 + delta * 0.5;
        drift[i].z *= 1 + delta * 0.5;
      }
      geo.attributes.position.needsUpdate = true;   // forgetting this = frozen smoke

      // Lifetime envelope (book Ch 12.4): full opacity for 70% of the duration,
      // fade over the last 30%, then linger until the last particles die.
      const fadeStart = duration * 0.7;
      if (elapsed > fadeStart) {
        mat.opacity = Math.max(0, 0.8 * (1 - (elapsed - fadeStart) / (duration * 0.3)));
      }
      return elapsed < duration + 1.5;    // outlive `duration` while stragglers rise
    },

    dispose() {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    }
  };
}
