// simDoors.js — the three simulation doors on the front wall (Biology,
// Mathematics, Physics). Press E on a door to leave the lab and open its sim.
//
// EVERYTHING is driven by server/data/simulations.json (loaded + validated by
// ./simulations/registry.js): door positions, labels, accent colors, the
// destination href and the E-trigger geometry (trigger.radius = how close you
// must stand, trigger.reach = how far the crosshair can aim). Add a door by
// adding a JSON entry — no code changes.
//
// The E-handling lives in hand.js; this module exposes:
//   aim(camera)      -> the sim entry the crosshair is on, or null
//   enter(sim, cam)  -> 'ok' | 'far' | 'undep' (routes in the 'ok' case)
//   update(delta, camera) -> LED status strips: pulse idle, brighten on aim
import * as THREE from 'three';
import { getSimulations } from './simulations/registry.js';

const WALL_Z = 5.0;          // front wall plane
const DOOR_HEIGHT = 2.1;     // same height as the exit door
const HOVER_REACH = 6.0;     // how far away the aim hint still shows
const CENTER = new THREE.Vector2(0, 0);

// --- sign texture: a lit lightbox in the EXACT style of the EXIT sign in
// room.js — solid accent background, white border, big white bold text (plus
// a smaller subtitle line and a badge number). Same canvas-texture +
// emissive lightbox recipe, so the label reads like the exit's and blooms
// on the HIGH preset.
function createSignTexture(entry, index) {
  const W = 1024, H = 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (weight, px) => `${weight} ${px}px "Space Grotesk", Arial, sans-serif`;

  ctx.fillStyle = entry.accent;                // solid accent plaque, like the EXIT green
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ffffff';                  // white picture-frame border
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  ctx.fillStyle = '#ffffff';                    // badge, top-right corner
  ctx.font = font('700', 52);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('0' + (index + 1), W - 56, 52);

  ctx.textAlign = 'center';                     // big bold label
  ctx.font = font('700', 112);
  ctx.fillText(entry.label.toUpperCase(), W / 2, 168);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';  // subtitle
  ctx.font = font('500', 46);
  ctx.fillText(entry.subtitle, W / 2, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- shared materials, created once for all the doors ---
const leafMat = new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.6, metalness: 0.3 });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0xbfd8ea, roughness: 0.05, metalness: 0.1,
  transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false
});
const trimMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5 });

export function createSimDoors(scene) {
  const groups = [];        // one Group per door; children are the raycast targets
  const ledMats = [];       // one pulsing LED material per door
  const entries = new Map();// id -> sim entry, for aim() lookups
  const raycaster = new THREE.Raycaster();
  let aimedId = null;

  getSimulations().forEach((entry, index) => {
    const group = new THREE.Group();
    group.position.set(entry.door.x, 0, 0);
    group.userData.simId = entry.id;
    entries.set(entry.id, entry);

    const w = entry.door.width;
    // White painted frame strips (cornice material) around the leaf.
    const frame = (fw, fh, fd, fx, fy) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), trimMat);
      m.position.set(fx, fy, WALL_Z - 0.03);
      m.castShadow = true;
      group.add(m);
    };
    frame(w + 0.14, 0.06, 0.10, 0, DOOR_HEIGHT + 0.03);            // header
    frame(0.06, DOOR_HEIGHT + 0.12, 0.10, -(w / 2) - 0.04, DOOR_HEIGHT / 2);
    frame(0.06, DOOR_HEIGHT + 0.12, 0.10, +(w / 2) + 0.04, DOOR_HEIGHT / 2);

    // Steel leaf, flush-mounted like the exit door (front face at z≈4.99).
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, DOOR_HEIGHT, 0.06), leafMat);
    leaf.position.set(0, DOOR_HEIGHT / 2, WALL_Z - 0.035);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    group.add(leaf);

    // Small glazed vision window near the top of the leaf (same glass recipe
    // as the big wall window in room.js).
    const vision = new THREE.Mesh(new THREE.BoxGeometry(w - 0.32, 0.5, 0.02), glassMat);
    vision.position.set(0, 1.62, WALL_Z - 0.018);
    group.add(vision);

    // Accent-colored handle, mirroring the exit door's knob position.
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 14),
      new THREE.MeshStandardMaterial({ color: entry.accent, roughness: 0.35, metalness: 0.85 }));
    handle.position.set(-(w / 2) + 0.1, 1.05, WALL_Z - 0.07);      // pull side: x- toward the room centre
    group.add(handle);

    // LED status strip at the hinge edge — pulses when idle, flares on aim.
    const ledMat = new THREE.MeshStandardMaterial({
      color: entry.accent, emissive: entry.accent, emissiveIntensity: 0.65
    });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.6, 0.02), ledMat);
    led.position.set(w / 2 + 0.05, 1.05, WALL_Z - 0.03);
    group.add(led);
    ledMats.push(ledMat);

    // Lightbox sign above the door — a flat emissive plaque, flush on the
    // wall exactly like the EXIT sign (room.js), but accent-colored.
    const signTex = createSignTexture(entry, index);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.04, 0.30),
      new THREE.MeshStandardMaterial({
        map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.15
      }));
    face.position.set(0, 2.52, WALL_Z - 0.028);
    face.rotation.y = Math.PI;                       // faces INTO the room
    group.add(face);

    // Accent threshold strip on the floor at the door base — anchors each
    // door and repeats the subject color across the wall.
    const thr = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.015, 0.16),
      new THREE.MeshStandardMaterial({ color: entry.accent, roughness: 0.6 }));
    thr.position.set(0, 0.008, WALL_Z - 0.11);
    thr.receiveShadow = true;
    group.add(thr);

    scene.add(group);
    groups.push(group);
  });

  // Crosshair raycast: same center-screen aim as the hand's aimAt().
  function raycastDoor(camera, maxDistance) {
    raycaster.setFromCamera(CENTER, camera);
    const hits = raycaster.intersectObjects(groups, true);
    for (const hit of hits) {
      if (hit.distance > maxDistance) return null;
      let obj = hit.object;
      while (obj && !obj.userData.simId) obj = obj.parent;
      return obj ? obj.userData.simId : null;   // groups contain only door meshes
    }
    return null;
  }

  function travelOverlay(label) {
    document.getElementById('travel-text').textContent = `Opening ${label} simulation\u2026`;
    const overlay = document.getElementById('travel-overlay');
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  return {
    // The sim entry the crosshair is on (within HOVER_REACH), or null.
    aim(camera) {
      const id = raycastDoor(camera, HOVER_REACH);
      aimedId = id;
      return id ? entries.get(id) : null;
    },

    // Press-E. Returns:
    //   'ok'    — overlay shown, page routes to href after a beat
    //   'far'   — crosshair on the door but the player isn't close enough
    //   'undep' — no href set yet (placeholder door)
    //   'none'  — not aiming at any door
    enter(entry, camera) {
      if (!entry) return 'none';
      const dx = camera.position.x - entry.door.x;
      const dz = camera.position.z - entry.door.z;
      const r = entry.trigger.radius;
      if (dx * dx + dz * dz > r * r) return 'far';
      if (!entry.href) return 'undep';
      travelOverlay(entry.label);
      setTimeout(() => {
        if (entry.target === '_blank') window.open(entry.href, '_blank', 'noopener,noreferrer');
        else window.location.assign(entry.href);
      }, 420);
      return 'ok';
    },

    update(delta, camera) {
      const t = performance.now() / 1000;
      for (let i = 0; i < ledMats.length; i++) {
        const entry = entries.get(groups[i].userData.simId);
        const aimed = aimedId === entry.id;
        const base = aimed ? 1.9 : 0.65 + 0.2 * Math.sin(t * 2.2 + i * 2.1);
        ledMats[i].emissiveIntensity += (base - ledMats[i].emissiveIntensity) * Math.min(1, delta * 8);
      }
      aimedId = null;   // stale every frame; hand.js re-aims on hover
    }
  };
}