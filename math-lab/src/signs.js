// signs.js — Data-driven sign system for Mathematics Lab.
// Builds all hanging station signs from room.json "stations" and
// the E-toggled wall sign from "toggleSigns".
// Uses software-ui-ux-design patterns: consistent typography, WCAG AA contrast,
// and the existing #action-hint for E-key discovery.
import * as THREE from 'three';
import {
  getRoom, getStations, getToggleSigns, getGeometry, getExit
} from './registry.js';
import {
  createStationSignTexture,
  createToggleSignTexture,
  createExitTexture
} from './textures.js';

// ============================================================================
// Station signs (hanging from ceiling, driven by room.json "stations")
// ============================================================================
export function createStationSigns(scene) {
  const stations = getStations();
  for (const station of stations) {
    const texture = createStationSignTexture(station);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(station.width, station.height),
      new THREE.MeshStandardMaterial({ map: texture })
    );
    sign.position.set(station.x, station.y, station.z);
    sign.rotation.y = station.rotationY || 0;
    scene.add(sign);
  }
}

// ============================================================================
// Exit sign (green EXIT lightbox above door)
// ============================================================================
export function createExitSign(scene) {
  const exit = getExit();
  const texture = createExitTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.25),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissive: hexToColor(exit.color),
      emissiveIntensity: 1.6
    })
  );
  sign.position.set(...exit.signPos);
  sign.rotation.y = Math.PI;
  scene.add(sign);
}

function hexToColor(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.startsWith('#')) return parseInt(v.slice(1), 16);
  return 0xffffff;
}

// ============================================================================
// Toggle wall sign — E toggles between states (e.g., GEOMETRY ↔ ALGEBRA)
// ============================================================================
const HOVER_REACH = 4.0;
const CENTER = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const hint = document.getElementById('action-hint');

let toggleSignMesh = null;
let currentStateIndex = 0;
let toggleSignData = null;

export function createToggleWallSign(scene, camera, interactableObjects) {
  const signs = getToggleSigns();
  if (!signs.length) return null;

  const data = signs[0]; // single toggle sign for now
  toggleSignData = data;

  const initialState = data.states[0];
  const texture = createToggleSignTexture(initialState);

  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(data.width, data.height),
    new THREE.MeshStandardMaterial({ map: texture })
  );
  signMesh.position.set(data.x, data.y, data.z);
  signMesh.rotation.y = data.rotationY;
  signMesh.userData = { toggleSign: true, id: data.id };
  scene.add(signMesh);
  interactableObjects.push(signMesh);

  toggleSignMesh = signMesh;
  currentStateIndex = 0;

  return { update: updateToggleSignHint };
}

function updateToggleSignHint(camera) {
  if (!hint || !toggleSignMesh || !toggleSignData) {
    return;
  }

  raycaster.setFromCamera(CENTER, camera);
  const hits = raycaster.intersectObjects([toggleSignMesh], true);

  if (hits.length > 0 && hits[0].distance <= HOVER_REACH) {
    const state = toggleSignData.states[currentStateIndex];
    hint.textContent = `[E] Toggle ${state.label}`;
    hint.style.display = 'block';
  }
  // Note: we don't hide the hint here — exitDoor.update() handles its own hint
  // when the player aims at the door. When aiming at neither, the door's
  // update() will hide it.
}

export function handleToggleSignKeyDown(camera) {
  if (!toggleSignMesh || !toggleSignData) return false;

  raycaster.setFromCamera(CENTER, camera);
  const hits = raycaster.intersectObjects([toggleSignMesh], true);

  if (hits.length > 0 && hits[0].distance <= HOVER_REACH) {
    // Toggle to next state
    currentStateIndex = (currentStateIndex + 1) % toggleSignData.states.length;
    const newState = toggleSignData.states[currentStateIndex];
    const texture = createToggleSignTexture(newState);
    toggleSignMesh.material = new THREE.MeshStandardMaterial({ map: texture });
    return true;
  }
  return false;
}