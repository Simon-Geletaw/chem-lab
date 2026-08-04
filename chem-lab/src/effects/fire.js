// effects/fire.js — three cheap tricks stacked (book Ch 13):
//   1. an emissive cone (the shape)
//   2. per-frame irregular flicker (irregularity = what reads as "fire")
//   3. a flickering PointLight (the seller — surroundings glow orange,
//      and the eye believes the LIGHTING, not the mesh)
import * as THREE from 'three';
import { quality } from '../quality.js';
import { acquireLight, releaseLight } from './lightPool.js';

export function createFire(params, position, scene) {
  const height = params.height ?? 0.3;
  const duration = params.duration ?? 3;

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(height * 0.35, height, 12),
    new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff6600,       // glows from within, ignores room lighting (Ch 11.2)
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    })
  );
  flame.position.set(position.x, position.y + height / 2 + 0.1, position.z);
  scene.add(flame);

  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(height * 0.18, height * 0.6, 10),
    new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.9 })
  );
  inner.position.copy(flame.position);
  inner.position.y -= height * 0.15;
  scene.add(inner);

  // Pooled light (perf): no allocation, no shader recompile. On LOW quality
  // (or if both pool lights are busy) the fire runs unlit — the emissive
  // cones still read as flame.
  const light = quality.effectLights ? acquireLight(0xff7700, 4) : null;
  if (light) {
    light.position.set(position.x, position.y + height * 0.6, position.z);
  }

  let elapsed = 0;

  return {
    update(delta) {
      elapsed += delta;

      // Flicker: a sine wobble PLUS noise — pure sine looks mechanical.
      const flicker = 1 + Math.sin(elapsed * 30) * 0.15 + (Math.random() - 0.5) * 0.15;
      flame.scale.set(flicker, 1 + Math.sin(elapsed * 24) * 0.2 + Math.random() * 0.1, flicker);
      inner.scale.copy(flame.scale);
      if (light) light.intensity = 3 * flicker;

      // die down over the last 25%
      const fadeStart = duration * 0.75;
      if (elapsed > fadeStart) {
        const k = Math.max(0, 1 - (elapsed - fadeStart) / (duration * 0.25));
        flame.material.opacity = 0.85 * k;
        inner.material.opacity = 0.9 * k;
        if (light) light.intensity *= k;
        flame.scale.multiplyScalar(0.5 + 0.5 * k);
      }
      return elapsed < duration;
    },

    dispose() {
      scene.remove(flame, inner);
      flame.geometry.dispose();
      flame.material.dispose();
      inner.geometry.dispose();
      inner.material.dispose();
      releaseLight(light);   // back to the pool, ready for the next reaction
    }
  };
}
