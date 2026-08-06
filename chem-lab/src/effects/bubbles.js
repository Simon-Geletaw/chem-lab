// effects/bubbles.js — fizzing inside the liquid (book Ch 12.5).
//
// Same THREE.Points machinery as smoke, different constraints: particles are
// born at the liquid's BOTTOM, stay inside its radius, rise ~6 cm, and POP at
// the surface (respawn, no fade) — popping is what reads as "fizz".
//
// POOLED (perf): geometry, buffers, and material are built ONCE at startup in
// initBubblesPool(). Building them at reaction time made the GPU compile a
// brand-new shader mid-frame — the visible stutter, worst on the first
// reaction. Now createBubbles() just wakes a pre-built slot: zero allocation,
// zero compilation. dispose() hides it and hands it back.
import * as THREE from 'three';
import { quality } from '../quality.js';

const MAX = 128;         // biggest possible count: 40 × intensity 3 (chemicals.json)
const POOL_SIZE = 2;     // reactions are serialized; 2 covers a dissolve overlap
let pool = null;

export function initBubblesPool(scene) {
  pool = [];
  for (let s = 0; s < POOL_SIZE; s++) {
    const positions = new Float32Array(MAX * 3);
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
    points.visible = false;
    // Particles move every frame but the bounding sphere is computed from the
    // ORIGINAL buffer — skip culling so bubbles never vanish at screen edges.
    points.frustumCulled = false;
    scene.add(points);
    pool.push({
      used: false,
      positions,
      geo,
      points,
      speeds: new Float32Array(MAX),
      wobblePhase: new Float32Array(MAX)
    });
  }
}

export function createBubbles(params, position) {
  const slot = pool?.find((s) => !s.used);
  if (!slot) {
    // Pool exhausted (or init never ran) — degrade gracefully, like the light
    // pool: the reaction still happens, just without this garnish.
    console.warn('bubbles: pool exhausted, skipping effect');
    return { update: () => false, dispose() {} };
  }
  slot.used = true;

  const COUNT = Math.min(
    MAX,
    Math.max(8, Math.round(40 * (params.intensity ?? 1) * quality.particleScale))
  );
  const duration = params.duration ?? 3;

  const R = 0.035;          // stay inside the liquid cylinder (r=0.043)
  const BOTTOM = 0.005;     // just above the beaker floor (local to position)
  const TOP = 0.062;        // the liquid surface

  const { positions, geo, points, speeds, wobblePhase } = slot;

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

  // Fixed-size buffer, variable count: only draw the first COUNT vertices.
  geo.setDrawRange(0, COUNT);
  geo.attributes.position.needsUpdate = true;
  points.visible = true;

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
      // Back to the pool — nothing is destroyed, just hidden for reuse.
      points.visible = false;
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
