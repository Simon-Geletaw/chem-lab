// experimentTable.js — the experiment-cards table in the front-left corner,
// between the Biology simulation door (front wall) and the chemical shelf
// (left wall).
//
// EVERYTHING is driven by server/data/experiments.json (loaded + validated by
// ./experiments/registry.js): how many cards there are (the table auto-
// lengthens), each card's image, title, subtitle, accent colour, safety text
// and the E-trigger geometry (trigger.radius = how close you must stand,
// trigger.reach = how far the crosshair can aim). Add a card by adding a JSON
// entry — no code changes.
//
// Each card is an UPRIGHT PLAQUE standing on the worktop: a dark backplate
// with a canvas-composited face (image + title + subtitle) and a pulsing LED
// strip at its base. Cards line up in JSON array order, leftmost = first
// entry, facing the room (+x).
//
// The E-handling lives in hand.js (it opens the experiment overlay); this
// module exposes:
//   aim(camera)        -> the experiment entry the crosshair is on, or null
//   open(entry, camera)-> 'ok' | 'far' | 'undep' (hand.js shows the overlay
//                          in the 'ok' case)
//   update(delta)      -> LED status strips: pulse idle, brighten on aim
import * as THREE from 'three';
import { getExperiments } from './experiments/registry.js';
import { createBench } from './furniture.js';

const TABLE_X = -6.45;        // corner table center (front-left corner)
const TABLE_Z = 2.55;
const TABLE_ROT = Math.PI / 2; // long side along the left wall (world z)
const WORKTOP = 1.0;          // bench worktop height — cards sit on it
const CARD_W = 0.30;          // plaque width
const CARD_H = 0.34;          // plaque height
const PITCH = 0.42;           // center-to-center card spacing (0.12 m gap)
const CENTER = new THREE.Vector2(0, 0);

// --- card face texture: image + title + subtitle on one canvas, composited
// once per card. The image loads async; until then (or if it 404s) the face
// shows a solid accent band so the card never reads as blank.
function createFaceTexture(entry) {
  const W = 512, H = 640;                 // 0.8 aspect = the plaque's 0.28 x 0.35
  const BAND = 360;                        // image band height
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const font = (weight, px) => `${weight} ${px}px Arial, sans-serif`;

  const draw = (img) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    if (img) {
      // cover-crop the image into the top band (no distortion)
      const s = Math.max(W / img.width, BAND / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (W - dw) / 2, (BAND - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = entry.accent;       // placeholder band until the image lands
      ctx.fillRect(0, 0, W, BAND);
    }

    ctx.fillStyle = entry.accent;         // accent rule under the image
    ctx.fillRect(0, BAND, W, 14);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0a2b4d';
    ctx.font = font('bold', 44);
    const words = entry.title.split(' '); // wrap the title across 2 lines max
    let line = '';
    let y = 400;
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (ctx.measureText(attempt).width > W - 40 && line) {
        ctx.fillText(line, W / 2, y);
        line = word;
        y += 52;
      } else {
        line = attempt;
      }
    }
    ctx.fillText(line, W / 2, y);

    ctx.fillStyle = entry.accent;         // subtitle under the title
    ctx.font = font('600', 28);
    ctx.fillText(entry.subtitle, W / 2, 596);

    tex.needsUpdate = true;
  };

  draw(null);                             // placeholder first, then the image
  const img = new Image();
  img.onload = () => draw(img);
  img.onerror = () => draw(null);
  img.src = entry.image;
  return tex;
}

export function createExperimentTable(scene, interactableObjects, colliders) {
  const entries = getExperiments();
  const group = new THREE.Group();
  const targets = [];                     // raycast meshes (card backplates + faces)
  const ledMats = [];                     // one pulsing LED material per card
  const cards = [];                       // one Group per card (world-position lookup)
  const cardWorld = new Map();            // experimentId -> { entry, worldPos }
  const raycaster = new THREE.Raycaster();
  let aimedId = null;

  // Table auto-lengthens with the card count: N cards at PITCH + end margins.
  const N = entries.length;
  const length = N * PITCH + 0.5;
  const bench = createBench(0, 0, 0, length);
  group.add(bench);

  entries.forEach((entry, i) => {
    const card = new THREE.Group();
    card.position.set((i - (N - 1) / 2) * PITCH, WORKTOP, 0);
    card.userData = {
      isExperimentCard: true,
      experimentId: entry.id,
      name: entry.title,                  // clickable via the info panel too
      description: entry.description
    };

    // Dark backplate — the plaque's body.
    const backplate = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, CARD_H, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.85 })
    );
    backplate.position.y = CARD_H / 2;
    card.add(backplate);
    targets.push(backplate);

    // Canvas-composited face (image + title + subtitle). MeshBasicMaterial =
    // readable in any lighting, same PERF rule as the periodic-table tiles.
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.35),
      new THREE.MeshBasicMaterial({ map: createFaceTexture(entry) })
    );
    face.position.set(0, CARD_H / 2, 0.016);   // 1 mm off the backplate face
    card.add(face);
    targets.push(face);

    // Accent LED status strip at the plaque base — pulses idle, flares on aim.
    const ledMat = new THREE.MeshStandardMaterial({
      color: entry.accent, emissive: entry.accent, emissiveIntensity: 0.65
    });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.012), ledMat);
    led.position.set(0, 0.02, 0.017);
    card.add(led);
    ledMats.push(ledMat);

    group.add(card);
    cards.push(card);
    interactableObjects.push(card);
  });

  group.position.set(TABLE_X, 0, TABLE_Z);
  group.rotation.y = TABLE_ROT;           // cards face +x into the room
  group.userData = {
    name: 'Experiment Station',
    description: 'A display table of hands-on experiment cards. Aim at a card and press E to read what it involves - including the safety gear you need - then open the 2D experiment.'
  };
  scene.add(group);
  interactableObjects.push(group);
  group.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(bench));

  // Precompute each card's WORLD position once (local x runs along world z
  // after the group's rotation) so open() can do a plain 2D distance check.
  entries.forEach((entry, i) => {
    const worldPos = new THREE.Vector3();
    cards[i].getWorldPosition(worldPos);
    cardWorld.set(entry.id, { entry, worldPos });
  });

  // Crosshair raycast: same center-screen aim as the sim doors and hand's
  // aimAt(). The cards stand physically nearer than the front wall, so this
  // is checked BEFORE simDoors.aim() in hand.js.
  function aim(camera) {
    raycaster.setFromCamera(CENTER, camera);
    const hits = raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData.experimentId) obj = obj.parent;
      const data = obj ? cardWorld.get(obj.userData.experimentId) : null;
      if (!data) return null;
      if (hit.distance > data.entry.trigger.reach) return null;  // nearest out of reach
      aimedId = data.entry.id;
      return data.entry;
    }
    return null;
  }

  // Press-E. Returns:
  //   'ok'    — hand.js opens the experiment overlay (which routes to href)
  //   'far'   — crosshair on a card but the player isn't close enough
  //   'undep' — no href set yet (placeholder card)
  //   'none'  — not aiming at any card
  function open(entry, camera) {
    if (!entry) return 'none';
    const p = cardWorld.get(entry.id).worldPos;
    const dx = camera.position.x - p.x;
    const dz = camera.position.z - p.z;
    const r = entry.trigger.radius;
    if (dx * dx + dz * dz > r * r) return 'far';
    if (!entry.href) return 'undep';
    return 'ok';
  }

  function update(delta) {
    const t = performance.now() / 1000;
    for (let i = 0; i < ledMats.length; i++) {
      const entry = entries[i];
      const aimed = aimedId === entry.id;
      const base = aimed ? 1.9 : 0.65 + 0.2 * Math.sin(t * 2.2 + i * 2.1);
      ledMats[i].emissiveIntensity += (base - ledMats[i].emissiveIntensity) * Math.min(1, delta * 8);
    }
    aimedId = null;   // stale every frame; hand.js re-aims on hover
  }

  return {
    aim,
    open,
    update,
    // Walk-up info card spot, registered by main.js like the furniture ones.
    proximitySpots: [
      {
        position: new THREE.Vector3(TABLE_X, 1.7, TABLE_Z),
        title: 'Experiment Station',
        description: group.userData.description,
        radius: 2.2
      }
    ]
  };
}
