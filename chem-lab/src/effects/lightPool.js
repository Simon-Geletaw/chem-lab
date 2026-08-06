// effects/lightPool.js — shared PointLights for effects (perf).
//
// WHY: every PointLight in view adds per-pixel shading cost, and fire + flash
// used to create a NEW light per reaction on top of the 4 static room lights.
// Creating/removing lights also recompiles shaders (hitching). This pool
// pre-creates 2 lights ONCE at startup; effects acquire one and release it in
// dispose(). Zero allocation per reaction, zero shader recompiles, and a hard
// cap on simultaneous effect lights. If both are busy, an effect simply runs
// unlit — the emissive meshes still carry it.
import * as THREE from 'three';

const POOL_SIZE = 2;
let pool = null;

export function initLightPool(scene) {
  pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 5, 1.8);
    // PERF: keep pool lights ALWAYS visible (idle = intensity 0). Toggling
    // visible changes the scene's light count, and Three.js bakes that count
    // into every material's shader — so one flicked light used to force the
    // WHOLE room to recompile mid-reaction (the stutter). Intensity 0 costs
    // the same tiny per-pixel add but never touches the shaders.
    scene.add(light);
    pool.push({ light, used: false });
  }
}

export function acquireLight(color, distance) {
  if (!pool) return null;
  const slot = pool.find((s) => !s.used);
  if (!slot) return null;
  slot.used = true;
  slot.light.color.set(color);
  slot.light.distance = distance;
  slot.light.intensity = 0;   // caller drives intensity every frame
  return slot.light;
}

export function releaseLight(light) {
  if (!pool || !light) return;
  const slot = pool.find((s) => s.light === light);
  if (slot) {
    slot.used = false;
    light.intensity = 0;    // stays in the scene, just dark
  }
}
