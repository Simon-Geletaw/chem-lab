// gloves.js — F5 upgraded: REAL first-person hands.
//
// The hands are no longer boxes (and no longer the blocky WebXR "generic-hand"
// meshes): they are an ANATOMICALLY ACCURATE rigged hand — 3,148 verts, 21
// bones (radius_ulna + 4 joints × 4 fingers + 4 thumb bones), real dual-scale
// skin texture with bump/normal/roughness maps and a separate nail mesh —
// downloaded from https://github.com/emmalieker/anatomical-hand-model
// (CC BY-NC 4.0, free for personal/academic use) into /Models/hand_model.glb.
//
// Three ideas carry this module:
//   1. SKINNED MESH POSING — we never touch vertices. Rotating a bone
//      (bone.quaternion) bends every vertex skinned to it. A "pose" is just
//      {jointName: curlRadians}; update() slerps each bone toward its target,
//      so pose changes ease naturally instead of snapping.
//   2. MATERIAL SWAP AS COSTUME — bare skin vs. blue nitrile is ONE material
//      assignment on the same mesh (plus a cuff cylinder at the wrist and the
//      nail mesh hidden under the glove). The hands are always visible now.
//   3. MIRROR BY TRANSFORM, NOT BY GEOMETRY — the model is ONE hand (a right
//      hand, palm facing away, fingers along +y). The left hand is the same
//      loaded model cloned (SkeletonUtils) and wrapped in a group with
//      scale.x = -1: the whole skeleton mirrors, skinning still works, and we
//      pose both hands with the SAME code. (Three.js shaders flip normals on
//      backfaces for DoubleSide materials, so lighting stays correct.)
//   4. GRIP AUTO-CALIBRATION — GRIP_POS (where the bottle's base lands in the
//      palm) is computed from the model's own knuckle bones at load time, so
//      the bottle always sits in the anatomically correct place — no hand
//      model ever needs its grip offset hand-tuned again.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fitGrip } from './gripFit.js';

const NITRILE = 0xf4f6f8;               // white nitrile (soft white, not pure — ACES tone mapping would blow out 0xffffff)
const BOX_BLUE = 0x3f6db3;              // the dispenser box keeps the brand blue

// ---- rig placement (camera space: x right, y up, -z forward) --------------
// The right hand rests low-right like every FPS; the left low-left.
export const RIGHT_REST = new THREE.Vector3(0.30, -0.34, -0.52);
export const LEFT_REST  = new THREE.Vector3(-0.30, -0.36, -0.52);
// Where the right hand REACHES while pouring: up and toward screen center,
// so the tilt reads as a deliberate arm gesture, not a corner wrist-flick.
export const RIGHT_POUR = new THREE.Vector3(0.16, -0.20, -0.55);
// The left hand rises a little too — the instinctive "support the pour" move.
export const LEFT_SUPPORT = new THREE.Vector3(-0.20, -0.28, -0.50);

// Bottle-in-grip transform (RIG-local space). This is a mutable export:
// gloves.js recomputes it from the hand's knuckle bones once the model loads,
// so hand.js always lerps the bottle into the REAL palm center.
export const GRIP_POS = new THREE.Vector3(-0.075, -0.10, -0.075);
export const GRIP_ROT = new THREE.Euler(0, 0, 0);

const HAND_SCALE = 0.0085;              // model is ~23 units long (~cm) -> meters
const BOTTLE_R = 0.045;                 // reagent bottle body radius (furniture.js)

// ---- finger poses ---------------------------------------------------------
// Per-joint FLEXION in radians, [meta, prox, midd, dist] for fingers and
// [trapez, meta, prox, dist] for the thumb.
//
// TWO flexion axes, one per pose:
//   relaxed (axis 'x') — the fingers point along +y at bind, so an x-rotation
//     curls them toward the palm (+z). That is the natural open-hand rest.
//   grip (axis 'z')    — the bottle stands VERTICAL in the hand (along +y),
//     so a z-rotation sweeps the fingertips AROUND the cylinder: the only
//     flexion that makes the fingers actually wrap the bottle. (An x-flexion
//     grip slides the pads up the near side and never touches the glass —
//     measured with a world-space probe.)
// The grip pose values come from a numeric fit: every finger segment rides
// the bottle surface (4.3–5.4 cm from the axis, surface = 4.5 cm), index and
// middle tips wrap the FRONT-RIGHT of the bottle, ring and pinky the BACK-
// RIGHT, thumb crosses the front at mid height — a real first-person hold.
// The grip pose used to be numeric-fit constants. Now gripFit.js MEASURES the
// loaded skeleton and computes per-joint contact angles at load time (idea #4
// taken to its conclusion: nothing about the grip is hand-tuned anymore).
// The flat arrays below remain as the FALLBACK if fitting fails.
const POSES = {
  relaxed: {
    axis: 'x',
    finger: [0.04, 0.22, 0.28, 0.12],
    thumb:  [0.02, 0.14, 0.24, 0.16],
    spread: 0.05                        // slight natural finger splay
  },
  grip: {
    axis: 'z',
    finger: [0.36, 0.78, 0.65, 0.21],   // fallback: wrapped around the 4.5 cm bottle
    thumb:  [0.06, 0.88, 0.90, 0.34],
    spread: 0.0,
    perJoint: null                      // filled by fitGrip() once the model loads
  }
};

const FINGERS = ['index', 'midd', 'ring', 'pinky'];
const FINGER_JOINTS = ['meta', 'prox', 'midd', 'dist'];
const THUMB_JOINTS = ['trapez', 'meta', 'prox', 'dist'];

export function createGloves(scene, camera, interactableObjects) {
  // ---------------------------------------------------------- the glove box
  const box = new THREE.Group();

  const cardboardMat = new THREE.MeshStandardMaterial({ color: BOX_BLUE, roughness: 0.85 });
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
  // Sway group: camera -> sway -> [left rig, right rig]. The breathing bob
  // lives HERE so hand.js can animate the rigs without fighting it.
  const sway = new THREE.Group();
  camera.add(sway);

  // A rig = outer Group (what hand.js moves) -> orient fix -> [mirror?] model.
  //
  // CRITICAL (measured, not assumed): hand_model.glb is a LEFT hand — palm
  // faces +z (the camera at bind), thumb on the -x side, fingers along +y.
  // So the RIGHT hand is the MIRRORED clone and the LEFT hand is the plain
  // model. Rotating the model +90° about y points the left palm at screen
  // center (+x from the left side); the mirrored right hand gets -90°. The
  // pitch (-0.08) tips the knuckles up; both hands share it because the
  // mirror commutes with the x-rotation (true reflection of the same person).
  function makeRig(restPos, yaw, pitch, mirror) {
    const rig = new THREE.Group();
    rig.position.copy(restPos);
    const orient = new THREE.Group();
    orient.rotation.set(pitch, yaw, 0);
    rig.add(orient);
    sway.add(rig);
    return { rig, orient, bones: null, pose: 'relaxed', cuff: null, mirror };
  }

  const right = makeRig(RIGHT_REST, -Math.PI / 2, -0.08, new THREE.Group());
  right.mirror.scale.x = -1;            // mirrored hand lives INSIDE the orient
  right.orient.add(right.mirror);
  const left  = makeRig(LEFT_REST, Math.PI / 2, -0.08, null);

  // ---- materials ----------------------------------------------------------
  // Bare skin: the model's own authored materials (SkinDual + Nails), kept.
  // Nitrile: a rubbery blue physical material. Its normal map is REUSED from
  // the hand's skin texture — the skin's wrinkles read as glove creases, which
  // is exactly how a nitrile glove looks under tension at the joints.
  let handNormalTex = null;
  let handRoughTex = null;
  const nitrileMat = new THREE.MeshPhysicalMaterial({
    color: NITRILE,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.35,
    normalScale: new THREE.Vector2(0.7, 0.7),
    map: makeNitrileTexture(),
    side: THREE.DoubleSide   // shared by both hands; the left is a mirrored clone
  });

  // A subtle procedural nitrile skin: matte blue with fine dimpled speckle.
  // Canvas textures beat a flat color — flat plastic reads "toy", not "glove".
  function makeNitrileTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    const rnd = () => (Math.random() - 0.5);
    g.fillStyle = '#eef1f4';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = 30 + rnd() * 70;
      g.fillStyle = `rgba(${Math.round(228 + rnd() * 22)}, ${Math.round(232 + rnd() * 20)}, ${Math.round(237 + rnd() * 16)}, 0.5)`;
      g.fillRect((rnd() + 0.5) * 512, (rnd() + 0.5) * 512, v, v);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ----------------------------------------------------------- load the hand
  const loader = new GLTFLoader();
  function loadHand(entry, url) {
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      const bones = {};
      model.traverse((node) => {
        if (node.isBone) bones[node.name] = { bone: node, baseQuat: node.quaternion.clone() };
        if (node.isSkinnedMesh) {
          if (!handNormalTex && node.material.normalMap) handNormalTex = node.material.normalMap;
          if (!handRoughTex && node.material.roughnessMap) handRoughTex = node.material.roughnessMap;
          node.userData.skinMat = node.material;    // restore on un-glove
          node.frustumCulled = false;               // camera children sit at the frustum edge
          node.castShadow = true;
        }
      });
      entry.bones = bones;
      model.scale.setScalar(HAND_SCALE);

      // The LEFT hand is a cloned skeleton under the -1 x mirror (one network
      // load, textures shared). Mirroring flips the winding, so every mesh in
      // the clone gets its OWN materials with DoubleSide — normals are
      // re-flipped per-face by the shader, keeping the lighting correct. The
      // result is a true left hand (x-mirrored bones, correct thumb side).
      if (entry.mirror) {
        const mirror = SkeletonUtils.clone(model);
        mirror.traverse((n) => {
          if (n.isMesh) {
            n.material = n.material.clone();
            n.material.side = THREE.DoubleSide;
            n.userData.skinMat = n.material;   // un-gloving restores THIS one
          }
        });
        entry.mirror.add(mirror);
      } else {
        entry.orient.add(model);
      }
      // Calibrate the grip: the bottle's AXIS must sit exactly one bottle
      // radius OUTSIDE the palm surface, so the glass rests against the palm
      // without burying into it. The palm surface is found from the model's
      // own mesh (max +z vertex in the knuckle band — the palm faces +z at
      // bind), and the bottle base rests BELOW the knuckle line (in the palm
      // bowl) — 4.0 model units down, like a hand cupping the bottle bottom.
      // (A previous version used z=-0.2, which sat the axis 7 cm INSIDE the
      // palm — the knuckles and thumb visibly pierced the glass.)
      // Only the RIGHT hand calibrates (it owns GRIP_POS — the left load would
      // overwrite it with a mirrored value).
      if (entry === right) {
        const k = new THREE.Vector3();
        for (const f of FINGERS) {
          const meta = bones[`${f}_meta`].bone;
          const prox = bones[`${f}_prox`].bone;
          k.x += meta.position.x + prox.position.x;
          k.y += meta.position.y + prox.position.y;
        }
        k.multiplyScalar(1 / FINGERS.length);

        let palmZ = -Infinity;
        model.traverse((n) => {
          if (!n.isSkinnedMesh) return;
          if (n.material && n.material.name && /nail/i.test(n.material.name)) return;
          const pos = n.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            if (y > k.y - 6 && y < k.y + 2 && pos.getZ(i) > palmZ) palmZ = pos.getZ(i);
          }
        });

        const palm = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE);
        palm.multiplyScalar(HAND_SCALE);
        palm.applyQuaternion(entry.orient.quaternion);
        GRIP_POS.copy(palm);

        // PROCEDURAL GRIP (T5): measure the actual skeleton and curl each
        // joint until it touches the bottle surface at GRIP_POS. If at least
        // 3 of 5 digits reach contact, the measured pose replaces the
        // fallback constants. Runs once; restores the bones afterwards.
        const fit = fitGrip(bones, entry.rig, GRIP_POS, BOTTLE_R);
        if (fit.contacts >= 3) {
          POSES.grip.perJoint = fit.perJoint;
        } else {
          console.warn('grip fit: only', fit.contacts, 'digits reached contact — keeping fallback pose');
        }
        console.info('grip fit report:\n' + fit.summary);
      }

      // Also keep the nitrile material fed with the hand's own skin texture
      // (wrinkle map) once it exists — the glove creases follow the hand.
      if (handNormalTex) nitrileMat.normalMap = handNormalTex;
      if (handRoughTex) nitrileMat.roughnessMap = handRoughTex;
      nitrileMat.needsUpdate = true;

      // Glove cuff: an open cylinder hugging the wrist, only visible gloved.
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.031, 0.027, 0.06, 24, 1, true),
        new THREE.MeshPhysicalMaterial({
          color: NITRILE, roughness: 0.5, metalness: 0,
          clearcoat: 0.6, clearcoatRoughness: 0.4,
          side: THREE.DoubleSide
        })
      );
      cuff.position.set(0, -0.03, 0.012);   // below the wrist, toward the player
      cuff.visible = false;
      entry.orient.add(cuff);
      entry.cuff = cuff;
    }, undefined, (err) => console.error('FAILED to load hand model', url, err));
  }
  loadHand(right, '/Models/hand_model.glb');
  loadHand(left, '/Models/hand_model.glb');

  // Slerp every finger joint toward its pose target. Called each frame; cheap
  // (21 joints x 2 hands). The flexion AXIS is per-pose: relaxed curls about
  // x (toward the palm); grip sweeps about z (around the vertical bottle).
  const _target = new THREE.Quaternion();
  const _flex = new THREE.Quaternion();
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const Z_AXIS = new THREE.Vector3(0, 0, 1);

  function applyPose(entry, t) {
    if (!entry.bones) return;
    const pose = POSES[entry.pose];
    const flexAxis = pose.axis === 'z' ? Z_AXIS : X_AXIS;
    // perJoint = the measured contact pose from fitGrip (per digit, per
    // joint). Falls back to the flat arrays when fitting hasn't run/failed.
    const pj = pose.perJoint || null;

    FINGERS.forEach((finger, fi) => {
      FINGER_JOINTS.forEach((joint, ji) => {
        const j = entry.bones[`${finger}_${joint}`];
        if (!j) return;
        _flex.setFromAxisAngle(flexAxis, pj ? pj[finger][ji] : pose.finger[ji]);
        _target.copy(j.baseQuat).multiply(_flex);
        // The meta joint also splays: fingers fan in the palm plane (about z,
        // because they point along +y). Index tilts toward the thumb (-x).
        if (ji === 0 && pose.spread && pose.axis !== 'z') {
          _flex.setFromAxisAngle(Z_AXIS, (1.5 - fi) * pose.spread);
          _target.multiply(_flex);
        }
        j.bone.quaternion.slerp(_target, t);
      });
    });

    THUMB_JOINTS.forEach((joint, ji) => {
      const j = entry.bones[`thumb_${joint}`];
      if (!j) return;
      _flex.setFromAxisAngle(flexAxis, pj ? pj.thumb[ji] : pose.thumb[ji]);
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
      for (const entry of [right, left]) {
        entry.orient.traverse((n) => {
          if (n.isSkinnedMesh) n.material = on ? nitrileMat : n.userData.skinMat;
          // Nails disappear under the glove, like real nitrile.
          if (n.isMesh && /^Nails/.test(n.name)) n.visible = !on;
        });
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
