// furniture.js — the Mathematics room's furniture: a few lab benches plus the
// station signs. NO chemistry equipment — this is the themed room shell.
//
// Everything user-facing comes from server/data/room.json via registry.js:
// the benches are the same geometry as chem-lab, and each station in
// room.json.stations[] gets a hanging sign (canvas texture) labelled with its
// JSON text, so the room relabels itself purely by editing the JSON.
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

// A hanging station sign: dark board + white text + accent rule, hung above a
// station so the workflow reads from across the room. Text comes from JSON.
function createStationSign(scene, station) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#22303c';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = getRoom().accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(station.label, 256, 42, 500);
  ctx.font = '22px Arial';
  ctx.fillStyle = '#b9cbe2';
  ctx.fillText(station.subtitle, 256, 78, 500);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.3),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  sign.position.set(station.x, 2.3, station.z);
  sign.rotation.y = station.rotationY || 0;
  scene.add(sign);
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

  // Station signs — all labels/subtitles come from room.json.
  getRoom().stations.forEach((station) => createStationSign(scene, station));
}