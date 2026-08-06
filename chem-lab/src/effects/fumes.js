// effects/fumes.js — a soft cloud of chemical vapour over the flask mouth.
//
// Same house particle pattern as smoke.js: ONE THREE.Points, parallel arrays,
// recycled particles, zero mid-effect allocation. Where smoke is a dark column,
// fumes are fog: bigger, softer, more translucent sprites that rise slowly and
// drift outward — a toxic-looking haze that lingers a moment.
//
// Used for the MASK SAFETY mechanic: pouring a hazardous chemical without a
// mask releases a cloud tinted the chemical's own colour (purple for KMnO4,
// pale blue for CuSO4, white for the acids...).
//
//   { "type": "fumes", "color": "#9b59b6", "intensity": 1, "duration": 3 }
//
// POOLED (perf): slots built once in initFumesPool() — including the sprite
// texture — so triggering fumes never compiles a shader or uploads a texture.
import * as THREE from 'three';
import { quality } from '../quality.js';

const MAX = 128;         // base 90 × intensity headroom
const POOL_SIZE = 2;
let pool = null;

// One shared radial sprite — soft edges so overlapping particles melt into a
// continuous haze, never dots. Created at init time, not reaction time.
let sprite = null;
function fumeSprite() {
  if (sprite) return sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  sprite = new THREE.CanvasTexture(c);
  return sprite;
}

export function initFumesPool(scene) {
  pool = [];
  for (let s = 0; s < POOL_SIZE; s++) {
    const positions = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#e8edf0',
      map: fumeSprite(),
      size: 0.11,             // big soft blobs — reads as fog, not particles
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;
    scene.add(points);
    pool.push({
      used: false,
      positions,
      geo,
      mat,
      points,
      speeds: new Float32Array(MAX),   // upward m/s
      driftX: new Float32Array(MAX),   // sideways wander
      driftZ: new Float32Array(MAX),
      ages: new Float32Array(MAX),     // seconds alive
      lives: new Float32Array(MAX)     // seconds until recycled
    });
  }
}

export function createFumes(params, position) {
  const slot = pool?.find((s) => !s.used);
  if (!slot) {
    console.warn('fumes: pool exhausted, skipping effect');
    return { update: () => false, dispose() {} };
  }
  slot.used = true;

  const COUNT = Math.min(
    MAX,
    Math.max(16, Math.round(90 * (params.intensity ?? 1) * quality.particleScale))
  );
  const duration = params.duration ?? 3;

  const { positions, geo, mat, points, speeds, driftX, driftZ, ages, lives } = slot;

  function spawn(i) {
    // A wider disc than smoke (7 cm) — fumes billow off the whole mouth.
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.07;
    positions[i * 3] = position.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = position.y + Math.random() * 0.03;
    positions[i * 3 + 2] = position.z + Math.sin(angle) * r;
    speeds[i] = 0.08 + Math.random() * 0.14;    // slow: fog, not flame
    driftX[i] = (Math.random() - 0.5) * 0.12;
    driftZ[i] = (Math.random() - 0.5) * 0.12;
    ages[i] = 0;
    lives[i] = 1.6 + Math.random() * 1.4;
  }
  for (let i = 0; i < COUNT; i++) {
    spawn(i);
    ages[i] = Math.random() * lives[i];
  }

  // Reset what the previous run dirtied (fade leaves opacity at 0).
  mat.color.set(params.color ?? '#e8edf0');
  mat.opacity = 0.5;
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
          // Recycle at the source; park during wind-down so the haze thins.
          if (elapsed < duration) spawn(i);
          else { positions[i * 3 + 1] = position.y; speeds[i] = 0; }
          continue;
        }
        positions[i * 3] += driftX[i] * delta;
        positions[i * 3 + 1] += speeds[i] * delta;
        positions[i * 3 + 2] += driftZ[i] * delta;
        // Widen as they rise — a spreading cloud, not a column.
        driftX[i] *= 1 + delta * 0.9;
        driftZ[i] *= 1 + delta * 0.9;
      }
      geo.attributes.position.needsUpdate = true;

      // Lifetime envelope: hold, then fade out, then linger for stragglers.
      const fadeStart = duration * 0.7;
      if (elapsed > fadeStart) {
        mat.opacity = Math.max(0, 0.5 * (1 - (elapsed - fadeStart) / (duration * 0.3)));
      }
      return elapsed < duration + 2;
    },

    dispose() {
      points.visible = false;   // back to the pool
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
