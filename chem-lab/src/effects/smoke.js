// effects/smoke.js — rising, spreading, fading smoke above the beaker.
//
// THE particle lesson (book Ch 12): instead of 150 meshes (= 150 draw calls),
// ONE THREE.Points object whose geometry holds 150 vertices, each drawn as a
// small camera-facing sprite. We build the BufferGeometry by hand — raw typed
// arrays — and animate by mutating the numbers + raising needsUpdate.
//
// POOLED (perf): the geometry, buffers, and material are built ONCE at startup
// in initSmokePool(). Creating a new PointsMaterial at reaction time made the
// GPU compile a shader mid-frame — the stutter. createSmoke() now just wakes a
// pre-built slot; dispose() hides it and hands it back.
import * as THREE from 'three';
import { quality } from '../quality.js';

const MAX = 160;         // biggest possible count: 60 × density 2.5 (chemicals.json)
const POOL_SIZE = 2;
let pool = null;

export function initSmokePool(scene) {
  pool = [];
  for (let s = 0; s < POOL_SIZE; s++) {
    const positions = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.05,
      transparent: true,
      opacity: 0.8,
      depthWrite: false      // soft overlap instead of harsh occlusion (book Ch 12.2)
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;   // buffer mutates every frame — skip stale culling
    scene.add(points);
    pool.push({
      used: false,
      positions,
      geo,
      mat,
      points,
      // Parallel arrays (book Ch 12.3): per-particle data shares index i with
      // the position buffer. Preallocated at MAX — zero allocation per reaction.
      speeds: new Float32Array(MAX),   // upward m/s
      driftX: new Float32Array(MAX),   // sideways wander
      driftZ: new Float32Array(MAX),
      ages: new Float32Array(MAX),     // seconds alive
      lives: new Float32Array(MAX)     // seconds until recycled
    });
  }
}

export function createSmoke(params, position) {
  const slot = pool?.find((s) => !s.used);
  if (!slot) {
    console.warn('smoke: pool exhausted, skipping effect');
    return { update: () => false, dispose() {} };
  }
  slot.used = true;

  // particleScale (quality.js): LOW machines run half the particles — the
  // column stays readable, the per-frame buffer upload halves.
  const COUNT = Math.min(
    MAX,
    Math.max(12, Math.round(60 * (params.density ?? 1) * quality.particleScale))
  );
  const duration = params.duration ?? 4;

  const { positions, geo, mat, points, speeds, driftX, driftZ, ages, lives } = slot;

  // Spawn = a 3 cm disc at the beaker mouth. Angle+radius, not x/y random,
  // so particles fill a circle rather than a square.
  function spawn(i) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.03;
    positions[i * 3] = position.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = position.y + Math.random() * 0.02;
    positions[i * 3 + 2] = position.z + Math.sin(angle) * r;
    speeds[i] = 0.15 + Math.random() * 0.25;
    driftX[i] = (Math.random() - 0.5) * 0.1;
    driftZ[i] = (Math.random() - 0.5) * 0.1;
    ages[i] = 0;
    lives[i] = 1.2 + Math.random() * 1.3;
  }
  // Stagger initial ages so the column doesn't start as a flat puck.
  for (let i = 0; i < COUNT; i++) {
    spawn(i);
    ages[i] = Math.random() * lives[i];
  }

  // Reset what the previous run dirtied (fade leaves opacity at 0).
  mat.color.set(params.color ?? '#ffffff');
  mat.opacity = 0.8;
  geo.setDrawRange(0, COUNT);   // fixed buffer, variable count
  geo.attributes.position.needsUpdate = true;
  points.visible = true;

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
        positions[i * 3] += driftX[i] * delta;
        positions[i * 3 + 1] += speeds[i] * delta;
        positions[i * 3 + 2] += driftZ[i] * delta;
        // widen as they rise: drift grows with age
        driftX[i] *= 1 + delta * 0.5;
        driftZ[i] *= 1 + delta * 0.5;
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
      points.visible = false;   // back to the pool, ready for the next reaction
      slot.used = false;
    }
  };
}

// Used by prewarmEffects() in index.js: make every pooled Points visible so
// renderer.compile() bakes the PointsMaterial shader at startup instead of at
// the first reaction — the one-time GPU stall moves behind the welcome card.
export function setPoolVisible(visible) {
  if (pool) for (const s of pool) s.points.visible = visible;
}
