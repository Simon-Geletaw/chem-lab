// trashBin.js — the biohazard waste bin at the PPE station (primitives only).
//
// Real lab discipline: fresh PPE comes from the dispenser, USED PPE goes into
// the biohazard waste — never back in the box. So the dispensers only put
// gear ON, and this bin is the only way to take it OFF: aim, press E, the
// hinged lid swings open and the used item (crumpled glove wad, then the
// mask) arcs off your body into the bin. One item per press, gloves first.
//
// The module owns only the LOOK and the ANIMATION (lid + flying props).
// hand.js owns the E-key rules, exactly like the glove/mask boxes.
import * as THREE from 'three';
import { ZONES } from './zones.js';

const LID_OPEN = -1.85;         // radians the lid swings back
const FLIGHT_TIME = 0.55;       // seconds a prop arcs through the air
const LID_LINGER = 0.5;         // lid stays open this long after the last prop

export function createTrashBin(scene, interactableObjects) {
  const group = new THREE.Group();

  // ---- body: tapered yellow drum + darker base ring ----
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd9b410, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.42, 20), yellowMat);
  body.position.y = 0.21;
  body.castShadow = true;
  group.add(body);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 20), yellowMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.42;
  group.add(rim);

  // Dark interior disc just below the rim — reads "open container".
  const interior = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 20),
    new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 1 })
  );
  interior.rotation.x = -Math.PI / 2;
  interior.position.y = 0.40;
  group.add(interior);

  // ---- biohazard label (canvas): trefoil approximation + text ----
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9b410';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 10;
  // trefoil: three fat arcs around a small core
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * (2 * Math.PI / 3);
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * 42, 108 + Math.sin(a) * 42, 34, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(128, 108, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('BIOHAZARD', 128, 218);
  const labelTex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshStandardMaterial({ map: labelTex })
  );
  label.position.set(0, 0.24, 0.152);      // on the front face of the drum
  group.add(label);

  // ---- hinged lid: pivot group at the BACK edge of the rim, so rotating
  // the pivot about x swings the disc up and away like a real flip lid.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.435, -0.16);
  group.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.02, 20), yellowMat);
  lid.position.z = 0.16;                   // disc sits forward of the hinge
  lid.castShadow = true;
  lidPivot.add(lid);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), yellowMat);
  handle.position.set(0, 0.02, 0.30);
  lidPivot.add(handle);

  // ---- placement: on the floor at the end of the PPE bench ----
  group.position.set(ZONES.ppe.x - 1.85, 0, ZONES.ppe.z);
  group.userData = {
    trashBin: true,
    name: 'Biohazard Waste Bin',
    description: 'Used gloves, masks and lab coats go HERE, never back on the rack or in the boxes. Press E to throw away what you are wearing — gloves first, then the mask, then the coat.'
  };
  scene.add(group);
  interactableObjects.push(group);

  // ---- disposal props: cheap one-shot meshes that arc into the bin ----
  // glove wad = three crumpled white spheres; mask = squashed shell + strap.
  function makeGloveWad() {
    const wad = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf4f6f8, roughness: 0.6, transparent: true
    });
    for (const [x, y, z, r] of [[0, 0, 0, 0.028], [0.02, 0.012, 0.01, 0.02], [-0.018, 0.008, -0.012, 0.022]]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      s.position.set(x, y, z);
      wad.add(s);
    }
    return wad;
  }
  function makeMaskProp() {
    const m = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xecf0f2, roughness: 0.75, transparent: true
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), mat);
    shell.scale.set(1.4, 1, 0.65);
    m.add(shell);
    return m;
  }
  function makeCoatProp() {
    const c = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6, roughness: 0.8, transparent: true
    });
    // A bundled white lab coat: three squashed fabric blobs tumbling together.
    for (const [x, y, z, s] of [[0, 0, 0, 1], [0.03, 0.01, 0.02, 0.8], [-0.03, -0.01, -0.02, 0.7]]) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 9), mat);
      blob.scale.set(s, s * 1.35, s);
      blob.position.set(x, y, z);
      c.add(blob);
    }
    return c;
  }

  const mouthWorld = new THREE.Vector3();  // filled per-dispose (group may not move, but stay correct)
  const flights = [];                      // { obj, mats, start, peak, end, t }
  let lidTarget = 0;                       // 0 closed, LID_OPEN open
  let lidCloseAt = 0;                      // clock time when the lid may close
  let clock = 0;

  return {
    group,

    // Throw one used item into the bin. kind: 'gloves' | 'mask' | 'coat'.
    // fromWorld: where the prop appears (the hand / the face / the chest).
    dispose(kind, fromWorld) {
      const obj = kind === 'gloves' ? makeGloveWad()
        : kind === 'coat' ? makeCoatProp() : makeMaskProp();
      obj.position.copy(fromWorld);
      scene.add(obj);

      group.getWorldPosition(mouthWorld);
      mouthWorld.y += 0.44;                // the open mouth of the drum

      const mats = [];
      obj.traverse((n) => { if (n.isMesh) mats.push(n.material); });
      const peak = fromWorld.clone().lerp(mouthWorld, 0.5);
      peak.y = Math.max(fromWorld.y, mouthWorld.y) + 0.25;   // arc over the rim
      flights.push({ obj, mats, start: fromWorld.clone(), peak, end: mouthWorld.clone(), t: 0 });

      lidTarget = LID_OPEN;
      lidCloseAt = Infinity;               // recomputed when the last prop lands
    },

    update(delta) {
      clock += delta;

      // Fly the props along a quadratic bezier: start -> peak -> bin mouth,
      // fading and shrinking over the last stretch so they vanish inside.
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        f.t += delta / FLIGHT_TIME;
        const t = Math.min(1, f.t);
        const u = 1 - t;
        f.obj.position.set(
          u * u * f.start.x + 2 * u * t * f.peak.x + t * t * f.end.x,
          u * u * f.start.y + 2 * u * t * f.peak.y + t * t * f.end.y,
          u * u * f.start.z + 2 * u * t * f.peak.z + t * t * f.end.z
        );
        f.obj.rotation.x += delta * 6;     // tumble as it flies
        if (t > 0.75) {
          const k = 1 - (t - 0.75) / 0.25;
          f.obj.scale.setScalar(0.4 + 0.6 * k);
          for (const m of f.mats) m.opacity = k;
        }
        if (t >= 1) {
          scene.remove(f.obj);
          f.obj.traverse((n) => {
            if (n.isMesh) { n.geometry.dispose(); n.material.dispose(); }
          });
          flights.splice(i, 1);
          if (flights.length === 0) lidCloseAt = clock + LID_LINGER;
        }
      }
      if (flights.length === 0 && clock >= lidCloseAt) lidTarget = 0;

      // Ease the lid toward its target — same idiom as every other animation.
      lidPivot.rotation.x += (lidTarget - lidPivot.rotation.x) * Math.min(1, delta * 8);
    }
  };
}
