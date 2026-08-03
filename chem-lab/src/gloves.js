// gloves.js — F5 upgraded: REAL first-person hands.
//
// The hands are no longer boxes: they are the WebXR "generic-hand" skinned
// meshes (MIT, the same models three.js uses for VR hand tracking), downloaded
// to /Models/hand_left.glb + hand_right.glb. Each has a full 25-joint skeleton
// (wrist + 4 segments per finger) — so fingers can actually CURL around a
// bottle instead of hovering near it.
//
// Three ideas carry this module:
//   1. SKINNED MESH POSING — we never touch vertices. Rotating a bone
//      (bone.quaternion) bends every vertex skinned to it. A "pose" is just
//      {jointName: curlRadians}; update() slerps each bone toward its target,
//      so pose changes ease naturally instead of snapping.
//   2. MATERIAL SWAP AS COSTUME — bare skin vs. blue nitrile is ONE material
//      assignment on the same mesh (plus a cuff cylinder at the wrist).
//      The hands are always visible now, like any first-person game.
//   3. SWAY GROUP — a parent group between camera and hands carries a subtle
//      breathing bob, so "idle" never means "frozen statue".
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const NITRILE = 0x3f6db3;               // the same accent blue as the UI theme

// ---- rig placement (camera space: x right, y up, -z forward) --------------
// The right hand rests low-right like every FPS; the left low-left.
export const RIGHT_REST = new THREE.Vector3(0.30, -0.34, -0.52);
export const LEFT_REST  = new THREE.Vector3(-0.30, -0.36, -0.52);
// Where the right hand REACHES while pouring: up and toward screen center,
// so the tilt reads as a deliberate arm gesture, not a corner wrist-flick.
export const RIGHT_POUR = new THREE.Vector3(0.16, -0.20, -0.55);
// The left hand rises a little too — the instinctive "support the pour" move.
export const LEFT_SUPPORT = new THREE.Vector3(-0.20, -0.28, -0.50);

// Bottle-in-grip transform (RIG-local). The model is rolled so the palm faces
// screen-center (-x); the bottle body (radius 0.045, origin at its base)
// stands against the palm with the fingers curled around it.
export const GRIP_POS = new THREE.Vector3(-0.075, -0.10, -0.075);
export const GRIP_ROT = new THREE.Euler(0, 0, 0);

// ---- finger poses ---------------------------------------------------------
// Per-joint FLEXION in radians. In the WebXR skeleton -z runs toward the
// fingertip and +y is the back of the hand, so curling toward the palm is a
// NEGATIVE rotation about the joint's local x-axis (applied in applyPose).
// [proximal, intermediate, distal] per finger; thumb has no intermediate.
const POSES = {
  relaxed: {
    finger: [0.30, 0.35, 0.15],
    thumb:  [0.10, 0.20],
    spread: 0.04                        // slight natural finger splay
  },
  grip: {
    finger: [1.15, 1.25, 0.45],         // wrapped around the 4.5 cm bottle
    thumb:  [0.45, 0.35],
    spread: 0.0
  }
};

const FINGERS = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];

export function createGloves(scene, camera, interactableObjects) {
  // ---------------------------------------------------------- the glove box
  const box = new THREE.Group();

  const cardboardMat = new THREE.MeshStandardMaterial({ color: NITRILE, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.15), cardboardMat);
  base.position.y = 0.04;
  base.castShadow = true;
  box.add(base);

  // White top face with a dark dispensing slot — reads "tissue-box dispenser".
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.006, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.6 })
  );
  top.position.y = 0.083;
  box.add(top);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.004, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.9 })
  );
  slot.position.y = 0.087;
  box.add(slot);

  // Front label, canvas-texture (same trick as the bottle labels).
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f5f8';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#22303c';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = '#22303c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('NITRILE', 128, 32);
  ctx.fillText('GLOVES', 128, 66);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.06),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  label.position.set(0, 0.04, 0.076);       // 1 mm off the front face
  box.add(label);

  box.position.set(-1.15, 0.9, -1.4);
  box.rotation.y = 0.25;
  box.userData = {
    gloveBox: true,
    name: 'Glove Box',
    description: 'Disposable nitrile gloves. Put a pair on before handling corrosive, toxic, flammable or oxidising chemicals.'
  };
  scene.add(box);
  interactableObjects.push(box);

  // ------------------------------------------------------ first-person hands
  // Materials shared by both hands. Physical material gives nitrile its
  // slight rubbery sheen (clearcoat); skin stays matte.
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9926b, roughness: 0.65 });
  const nitrileMat = new THREE.MeshPhysicalMaterial({
    color: NITRILE, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.6
  });

  // Sway group: camera -> sway -> [left rig, right rig]. The breathing bob
  // lives HERE so hand.js can animate the rigs without fighting it.
  const sway = new THREE.Group();
  camera.add(sway);

  // A rig = outer Group (what hand.js moves) -> orient fix -> skinned gltf.
  // The GLB bind pose is palm-down / fingers-forward; rolling it 90° makes the
  // palm face screen center — the natural "about to hold something" attitude.
  function makeRig(restPos, rollFix) {
    const rig = new THREE.Group();
    rig.position.copy(restPos);
    const orient = new THREE.Group();
    orient.rotation.set(-0.15, 0, rollFix);   // slight pitch: knuckles up
    rig.add(orient);
    sway.add(rig);
    return { rig, orient, bones: null, pose: 'relaxed', cuff: null };
  }

  const right = makeRig(RIGHT_REST, -Math.PI / 2);  // palm faces -x (center)
  const left  = makeRig(LEFT_REST, Math.PI / 2);    // mirrored

  const loader = new GLTFLoader();
  function loadHand(entry, url) {
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      const bones = {};
      model.traverse((node) => {
        if (node.isBone) bones[node.name] = { bone: node, baseQuat: node.quaternion.clone() };
        if (node.isSkinnedMesh) {
          node.material = skinMat;
          node.frustumCulled = false;   // camera children sit at the frustum edge
          node.castShadow = true;
        }
      });
      entry.bones = bones;
      entry.orient.add(model);

      // Glove cuff: an open cylinder hugging the wrist, only visible gloved.
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.05, 0.06, 16, 1, true),
        nitrileMat
      );
      cuff.rotation.x = Math.PI / 2;    // axis along the forearm (-z)
      cuff.position.set(0, 0, 0.045);   // just behind the wrist, toward the player
      cuff.visible = false;
      entry.orient.add(cuff);
      entry.cuff = cuff;
    }, undefined, (err) => console.error('FAILED to load hand model', url, err));
  }
  loadHand(right, '/Models/hand_right.glb');
  loadHand(left, '/Models/hand_left.glb');

  // Slerp every finger joint toward its pose target. Called each frame; cheap
  // (20 joints x 2 hands). The -x flexion axis is the WebXR convention.
  const _target = new THREE.Quaternion();
  const _flex = new THREE.Quaternion();
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);

  function applyPose(entry, t) {
    if (!entry.bones) return;
    const pose = POSES[entry.pose];
    const segs = ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal'];

    FINGERS.forEach((finger, fi) => {
      segs.forEach((seg, si) => {
        const j = entry.bones[`${finger}-${seg}`];
        if (!j) return;
        _flex.setFromAxisAngle(X_AXIS, -pose.finger[si]);
        _target.copy(j.baseQuat).multiply(_flex);
        // proximal joints also splay: spread fans fingers outward a touch
        if (si === 0 && pose.spread) {
          _flex.setFromAxisAngle(Y_AXIS, (fi - 1.5) * pose.spread);
          _target.multiply(_flex);
        }
        j.bone.quaternion.slerp(_target, t);
      });
    });

    [['thumb-phalanx-proximal', 0], ['thumb-phalanx-distal', 1]].forEach(([name, i]) => {
      const j = entry.bones[name];
      if (!j) return;
      _flex.setFromAxisAngle(X_AXIS, -pose.thumb[i]);
      _target.copy(j.baseQuat).multiply(_flex);
      j.bone.quaternion.slerp(_target, t);
    });
  }

  let on = false;
  let time = 0;

  return {
    get on() { return on; },
    // hand.js animates these directly during pickup/pour choreography.
    rightRig: right.rig,
    leftRig: left.rig,

    // 'relaxed' | 'grip' — eased by update(), never snapped.
    setRightPose(name) { right.pose = name; },

    toggle() {
      on = !on;
      const mat = on ? nitrileMat : skinMat;
      for (const entry of [right, left]) {
        entry.orient.traverse((n) => { if (n.isSkinnedMesh) n.material = mat; });
        if (entry.cuff) entry.cuff.visible = on;
      }
      return on;
    },

    update(delta) {
      time += delta;
      // Breathing bob: 3.5 mm at ~0.55 Hz + a whisper of roll. Subtle enough
      // to never distract, alive enough that the hands don't feel mounted.
      sway.position.y = Math.sin(time * 3.5) * 0.0035;
      sway.rotation.z = Math.sin(time * 2.1) * 0.004;

      const t = Math.min(1, delta * 10);  // pose easing speed
      applyPose(right, t);
      applyPose(left, t);
    }
  };
}
