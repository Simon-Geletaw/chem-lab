// furniture.js — the Mathematics room's furniture: lab benches only.
// Station signs and toggle signs are now handled by signs.js.
// Bench geometry matches chem-lab; everything user-facing comes from
// server/data/room.json via registry.js.
import * as THREE from 'three';
import { getRoom } from './registry.js';

const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x6b7a87, roughness: 0.8 });
const worktopMat = new THREE.MeshStandardMaterial({ color: 0x5f6870, roughness: 0.85, metalness: 0 });

// Same bench recipe as chem-lab: storage cabinet + thin worktop at y = 0.9 m.
export function createBench(x, z, rotationY, length = 2.8) {
  const bench = new THREE.Group();

  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(length, 0.95, 0.6), cabinetMat);
  cabinet.position.y = 0.475;
  bench.add(cabinet);

  const worktop = new THREE.Mesh(new THREE.BoxGeometry(length + 0.2, 0.05, 0.7), worktopMat);
  worktop.position.y = 0.975;
  bench.add(worktop);

  bench.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });

  bench.position.set(x, 0, z);
  bench.rotation.y = rotationY || 0;
  return bench;
}

// A 2.8 m island bench in the middle of the room (the main workstation) + a
// wall bench along the left — same layout vibe as chem-lab, minus the gear.
export function createFurniture(scene, interactableObjects, colliders) {
  const islandBench = createBench(0, -1.5, 0);
  islandBench.userData = {
    name: `${getRoom().name} Workstation`,
    description: `${getRoom().name} — ${getRoom().tagline}. This is the room's main workbench.`
  };
  scene.add(islandBench);
  interactableObjects.push(islandBench);
  colliders.push(new THREE.Box3(
    new THREE.Vector3(-1.4, 0, -1.8),
    new THREE.Vector3(1.4, 0.95, -1.2)
  ));

  const wallBench = createBench(-6.55, -1, Math.PI / 2);
  wallBench.userData = {
    name: 'Side Bench',
    description: 'A wall-side bench for preparing samples.'
  };
  scene.add(wallBench);
  interactableObjects.push(wallBench);
  colliders.push(new THREE.Box3().setFromObject(wallBench));

  // Station signs and toggle sign are created by signs.js (data-driven from room.json)
}