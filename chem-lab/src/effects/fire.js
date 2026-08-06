// effects/fire.js — a small flame jetting out of the flask mouth (book Ch 13).
//
// Rebuilt from the old "two solid cones + flicker" trick into the house
// particle pattern (see smoke.js): ONE THREE.Points, one draw call, soft
// camera-facing sprites. Why this reads as FIRE and the cones didn't:
//   1. soft-edged additive sprites — a real flame has no hard surface
//   2. a bright core + darker body per particle, fading as they rise
//   3. fast short-lived particles spurting OUT of the mouth (a jet, not a
//      glow stick standing on the rim)
//   4. the flickering pooled PointLight stays — the eye believes LIGHTING.
//
// Per-reaction control (chemicals.json):
//   { "type": "fire", "height": 0.3, "intensity": 1, "color": "#ff6a2f", "duration": 3 }
//   height    = flame height in world units
//   intensity = strength multiplier: emission rate + light + sprite size
//   color     = body color hex; the core is auto-derived (pale version).
//               Blue for solvent flames (acetone/ethanol burn pale blue),
//               orange for heat/exothermic reactions.
// Quality: LOW machines run half the particles via quality.particleScale and
// lose the light via quality.effectLights — the flame stays readable.
//
// POOLED (perf): geometry, buffers, material, and sprite are built ONCE in
// initFirePool(). The mid-frame PointsMaterial creation used to force a shader
// compile at reaction time — the stutter. Now igniting a fire is just waking a
// pre-built slot; dispose() hides it and hands it back.
import * as THREE from 'three';
import { quality } from '../quality.js';
import { acquireLight, releaseLight } from './lightPool.js';

const MAX = 240;         // biggest possible count: 150 × intensity 1.5 (chemicals.json)
const POOL_SIZE = 2;
let pool = null;

// One shared radial-gradient sprite for every flame: white core fading to
// transparent. PointsMaterial multiplies the sprite with the per-vertex color,
// so one texture serves every flame color. Created at init, not reaction time.
let sprite = null;
function flameSprite() {
  if (sprite) return sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  sprite = new THREE.CanvasTexture(c);
  return sprite;
}

// "#ff6a2f" -> [255, 106, 47]
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function initFirePool(scene) {
  pool = [];
  for (let s = 0; s < POOL_SIZE; s++) {
    const positions = new Float32Array(MAX * 3);
    const colors = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.05,          // real size set per reaction (height/intensity)
      map: flameSprite(),
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending    // overlapping sprites ADD light, no seams
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;          // particles fly above the mouth
    scene.add(points);
    pool.push({
      used: false,
      positions,
      colors,
      geo,
      mat,
      points,
      // Parallel per-particle arrays, preallocated at MAX (book Ch 12.3).
      baseR: new Float32Array(MAX),    // base color before fade
      baseG: new Float32Array(MAX),
      baseB: new Float32Array(MAX),
      speeds: new Float32Array(MAX),   // upward m/s
      driftX: new Float32Array(MAX),   // sideways wander
      driftZ: new Float32Array(MAX),
      ages: new Float32Array(MAX),     // seconds alive
      lives: new Float32Array(MAX)     // seconds until recycled
    });
  }
}

export function createFire(params, position) {
  const slot = pool?.find((sl) => !sl.used);
  if (!slot) {
    console.warn('fire: pool exhausted, skipping effect');
    return { update: () => false, dispose() {} };
  }
  slot.used = true;

  const h = params.height ?? 0.3;         // flame height
  const s = params.intensity ?? 1;        // strength multiplier
  const duration = params.duration ?? 3;
  const body = hexToRgb(params.color ?? '#ff6a2f');
  // Core color: the body pushed toward white — the hottest part of the flame.
  const core = body.map((v) => v + (255 - v) * 0.55);

  const COUNT = Math.min(MAX, Math.max(32, Math.round(150 * s * quality.particleScale)));

  const {
    positions, colors, geo, mat, points,
    baseR, baseG, baseB, speeds, driftX, driftZ, ages, lives
  } = slot;

  const spawnR = 0.02 * (0.7 + 0.6 * h);            // mouth disc radius
  const speedBase = h * 2.0;                        // taller flame = faster jet

  // Spawn = a small disc at the flask mouth. Angle+radius, not x/y random,
  // so the jet fills a circle rather than a square (same trick as smoke).
  function spawn(i) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * spawnR;
    positions[i * 3] = position.x + Math.cos(angle) * r;
    positions[i * 3 + 1] = position.y + Math.random() * 0.012;
    positions[i * 3 + 2] = position.z + Math.sin(angle) * r;
    speeds[i] = (0.45 + Math.random() * 0.55) * speedBase;
    driftX[i] = (Math.random() - 0.5) * 0.06;
    driftZ[i] = (Math.random() - 0.5) * 0.06;
    ages[i] = 0;
    lives[i] = 0.35 + Math.random() * 0.35;   // short: a flame, not a smoke plume

    // 3 in 4 particles wear the body color, the rest the white-hot core.
    const b = Math.random() < 0.75 ? body : core;
    const bright = 0.85 + Math.random() * 0.3;
    baseR[i] = b[0] * bright;
    baseG[i] = b[1] * bright;
    baseB[i] = b[2] * bright;
  }
  // Stagger initial ages so the jet doesn't start as a flat disc of dots.
  for (let i = 0; i < COUNT; i++) {
    spawn(i);
    ages[i] = Math.random() * lives[i];
  }

  // Reset what the previous run dirtied (fade leaves opacity near 0).
  mat.size = 0.05 * (0.7 + 0.6 * h) * (0.7 + 0.3 * s);
  mat.opacity = 0.9;
  geo.setDrawRange(0, COUNT);   // fixed buffer, variable count
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  points.visible = true;

  // Pooled light, tinted to the flame color (perf: no allocation; on LOW or
  // when both pool lights are busy the flame runs unlit — sprites still glow).
  const light = quality.effectLights ? acquireLight(new THREE.Color(params.color ?? '#ff6a2f'), 2.5 * s) : null;
  if (light) {
    light.position.set(position.x, position.y + h * 0.35, position.z);
  }

  let elapsed = 0;
  let emitAcc = 0;
  const emitInterval = 1 / (90 * s * quality.particleScale);

  return {
    update(delta) {
      elapsed += delta;

      // Emission with flicker: bursts of 1-3 particles at a rate that wobbles
      // on a sine + noise — steady emission looks like a garden hose.
      const flickerT = 0.7 + 0.3 * Math.sin(elapsed * 25) + (Math.random() - 0.5) * 0.3;
      emitAcc += delta * flickerT;
      let burst = Math.floor(emitAcc / emitInterval) + (Math.random() < 0.3 ? 1 : 0);
      emitAcc %= emitInterval;

      for (let i = 0; i < COUNT; i++) {
        ages[i] += delta;
        if (ages[i] > lives[i]) {
          // RECYCLE (book Ch 12.3): never allocate mid-effect. Park stragglers
          // at the source during the wind-down so the jet thins out instead of
          // blinking off.
          if (elapsed < duration && burst > 0) {
            spawn(i);
            burst--;
          } else {
            positions[i * 3 + 1] = position.y;
            speeds[i] = 0;
          }
          continue;
        }
        positions[i * 3] += driftX[i] * delta;
        positions[i * 3 + 1] += speeds[i] * delta;
        positions[i * 3 + 2] += driftZ[i] * delta;
        driftX[i] *= 1 + delta * 0.2;   // gentle taper — flames stay narrow
        driftZ[i] *= 1 + delta * 0.2;

        // Fade toward black = invisible under additive blending: each particle
        // dims over its life, brightest at the mouth.
        const k = Math.max(0, 1 - ages[i] / lives[i]);
        colors[i * 3] = (baseR[i] * k) / 255;
        colors[i * 3 + 1] = (baseG[i] * k) / 255;
        colors[i * 3 + 2] = (baseB[i] * k) / 255;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;   // forgetting this = frozen fire

      if (light) {
        light.intensity = 2.5 * s * (0.75 + 0.25 * Math.sin(elapsed * 30) + (Math.random() - 0.5) * 0.15);
      }

      // Die down over the last 25%: opacity envelope + the light follows.
      const fadeStart = duration * 0.75;
      if (elapsed > fadeStart) {
        const k = Math.max(0, 1 - (elapsed - fadeStart) / (duration * 0.25));
        mat.opacity = 0.9 * k;
        if (light) light.intensity *= k;
      }
      return elapsed < duration + 1.0;    // outlive `duration` while stragglers burn
    },

    dispose() {
      points.visible = false;   // back to the pool, ready for the next reaction
      slot.used = false;
      releaseLight(light);
    }
  };
}

// Used by prewarmEffects() in index.js: make every pooled Points visible so
// renderer.compile() bakes the PointsMaterial shader at startup instead of at
// the first reaction — the one-time GPU stall moves behind the welcome card.
export function setPoolVisible(visible) {
  if (pool) for (const s of pool) s.points.visible = visible;
}
