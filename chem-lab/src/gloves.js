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
import { ZONES } from './zones.js';
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
    perJoint: null,                     // filled by fitGrip() once the model loads
    roll: 0                             // hand roll (rad) fitted with the pose
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

  // On the PPE table by the door (its zone gates where gloving is allowed).
  box.position.set(ZONES.ppe.x, 1.0, ZONES.ppe.z);
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

  // --- HAND LIGHTING LAYER (room-independent) ------------------------------
  // The hands live on their OWN render layer. The room lights (layer 0) are
  // told nothing about this layer, so however bright or dim the room gets, the
  // hands never change. Two lights parented to the camera light them the same
  // way from every angle: a hemisphere for even fill + a soft key from above-
  // front for shape. Tune HAND_FILL / HAND_KEY if the gloves look too flat or
  // too bright — nothing else in the room is affected.
  const HAND_LAYER = 1;
  const HAND_FILL = 1.15;   // even ambient wrap on the hands
  const HAND_KEY = 1.35;    // front-above highlight that gives the fingers form
  camera.layers.enable(HAND_LAYER);   // so the camera actually DRAWS layer-1 meshes

  const handFill = new THREE.HemisphereLight(0xffffff, 0xbfc6cf, HAND_FILL);
  handFill.layers.set(HAND_LAYER);
  camera.add(handFill);

  const handKey = new THREE.PointLight(0xfff6ec, HAND_KEY, 3, 1.5);
  handKey.position.set(0.15, 0.35, -0.15);   // just above & in front of the lens
  handKey.layers.set(HAND_LAYER);
  camera.add(handKey);

  // A rig = outer Group (what hand.js moves) -> orient fix -> roll -> [mirror?] model.
  //
  // CRITICAL (measured, not assumed): hand_model.glb is a LEFT hand — palm
  // faces +z (the camera at bind), thumb on the -x side, fingers along +y.
  // So the RIGHT hand is the MIRRORED clone and the LEFT hand is the plain
  // model. Rotating the model +90° about y points the left palm at screen
  // center (+x from the left side); the mirrored right hand gets -90°. The
  // pitch (-0.08) tips the knuckles up; both hands share it because the
  // mirror commutes with the x-rotation (true reflection of the same person).
  //
  // The ROLL group (T5) rotates the whole hand about the palm normal: fingers
  // swing from vertical (bind) toward horizontal — the orientation that can
  // actually wrap a vertical bottle. fitGrip() finds the angle; update()
  // eases roll in/out with the grip pose.
  function makeRig(restPos, yaw, pitch, mirror) {
    const rig = new THREE.Group();
    rig.position.copy(restPos);
    const orient = new THREE.Group();
    orient.rotation.set(pitch, yaw, 0);
    rig.add(orient);
    const roll = new THREE.Group();
    orient.add(roll);
    sway.add(rig);
    return { rig, orient, roll, bones: null, pose: 'relaxed', cuff: null, mirror };
  }

  const right = makeRig(RIGHT_REST, -Math.PI / 2, -0.08, new THREE.Group());
  right.mirror.scale.x = -1;            // mirrored hand lives INSIDE the roll group
  right.roll.add(right.mirror);
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

  // A subtle procedural nitrile skin: matte white with fine dimpled speckle.
  // Canvas textures beat a flat color — flat plastic reads "toy", not "glove".
  // 256² + 4000 dots keeps the grain visible while staying a 4× smaller GPU
  // upload than the old 512² / 9000-dot canvas (part of the toggle hitch fix).
  function makeNitrileTexture() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    const rnd = () => (Math.random() - 0.5);
    g.fillStyle = '#eef1f4';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) {
      const v = 30 + rnd() * 70;
      g.fillStyle = `rgba(${Math.round(228 + rnd() * 22)}, ${Math.round(232 + rnd() * 20)}, ${Math.round(237 + rnd() * 16)}, 0.5)`;
      g.fillRect((rnd() + 0.5) * S, (rnd() + 0.5) * S, v, v);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ----------------------------------------------------------- load the hand
  const loader = new GLTFLoader();
  let loadedEntries = 0;
  let warmupRenderer = null;
  let warmed = false;

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

      // The RIGHT hand is a cloned skeleton under the -1 x mirror (one network
      // load, textures shared). Mirroring flips the winding, so every mesh in
      // the clone gets its OWN materials with DoubleSide — normals are
      // re-flipped per-face by the shader, keeping the lighting correct.
      //
      // BUG FIX (T5): entry.bones must point at the DISPLAYED skeleton. The
      // clone has its own bones — posing the original (never added to the
      // scene) left the visible right hand frozen in bind pose, which is a
      // large part of why the grip never looked right.
      let shown = model;                    // the object that actually renders
      if (entry.mirror) {
        shown = SkeletonUtils.clone(model);
        shown.traverse((n) => {
          if (n.isMesh) {
            n.material = n.material.clone();
            n.material.side = THREE.DoubleSide;
            n.userData.skinMat = n.material;   // un-gloving restores THIS one
          }
        });
        const cloneBones = {};
        shown.traverse((n) => {
          if (n.isBone) cloneBones[n.name] = { bone: n, baseQuat: n.quaternion.clone() };
        });
        entry.bones = cloneBones;
        entry.mirror.add(shown);
      } else {
        entry.roll.add(model);
      }

      // Cache the mesh lists for instant per-toggle swaps (no traverse).
      const skinMeshes = [];
      const nailMeshes = [];
      shown.traverse((n) => {
        if (n.isSkinnedMesh) skinMeshes.push(n);
        else if (n.isMesh && /^Nails/.test(n.name)) nailMeshes.push(n);
      });
      entry.skinMeshes = skinMeshes;
      entry.nailMeshes = nailMeshes;

      // T7: put every hand mesh onto the dedicated lighting layer. The room
      // lights (layer 0) never see them, so dimming the room has zero effect
      // on hand visibility — they stay clear and readable in any environment.
      shown.traverse((n) => {
        if (n.isMesh || n.isSkinnedMesh) n.layers.set(HAND_LAYER);
      });

      // Calibrate the grip (T5): compute the palm ANCHOR (model units) — the
      // bottle base sits below the knuckle line, one bottle radius outside
      // the palm surface — then let fitGrip() search the hand roll, the
      // palm-normal offset and every joint's curl angle by MEASURING the
      // displayed skeleton. GRIP_POS and the grip pose both come out of the
      // fit; nothing about the grip is hand-tuned anymore.
      // Only the RIGHT hand calibrates (it owns GRIP_POS and the grip pose).
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

        const anchorPoint = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE);
        const fit = fitGrip({
          bones: entry.bones,       // the DISPLAYED (mirrored) skeleton
          rig: entry.rig,
          rollGroup: entry.roll,
          anchorObject: shown,
          anchorPoint,
          bottleR: BOTTLE_R,
          handScale: HAND_SCALE
        });
        GRIP_POS.copy(fit.gripPos);
        if (fit.contacts >= 3 && fit.penetrations === 0) {
          POSES.grip.perJoint = fit.perJoint;
          POSES.grip.roll = fit.roll;
        } else {
          console.warn('grip fit rejected (contacts', fit.contacts, 'penetrations', fit.penetrations, ') — keeping fallback pose');
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
      entry.roll.add(cuff);                 // rolls with the hand during the grip
      entry.cuff = cuff;

      // When both hands have finished loading, run a one-time GPU warmup
      // behind the start overlay so the first toggle is instant.
      loadedEntries++;
      if (loadedEntries === 2 && warmupRenderer) doWarmup();
    }, undefined, (err) => console.error('FAILED to load hand model', url, err));
  }

  function setGloved(entry, gloved) {
    for (let i = 0; i < entry.skinMeshes.length; i++) {
      entry.skinMeshes[i].material = gloved ? nitrileMat : entry.skinMeshes[i].userData.skinMat;
    }
    for (let i = 0; i < entry.nailMeshes.length; i++) {
      entry.nailMeshes[i].visible = !gloved;
    }
    if (entry.cuff) entry.cuff.visible = gloved;
  }

  function doWarmup() {
    if (warmed) return;
    warmed = true;
    for (const entry of [right, left]) setGloved(entry, true);
    warmupRenderer.render(scene, camera);
    for (const entry of [right, left]) setGloved(entry, false);
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
    // perJoint = the measured contact pose from fitGrip (per digit, per
    // joint, curled about the anatomical X axis). Falls back to the flat
    // arrays (legacy z-sweep) when fitting hasn't run or was rejected.
    const pj = pose.perJoint || null;
    const flexAxis = pj ? X_AXIS : (pose.axis === 'z' ? Z_AXIS : X_AXIS);

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

  // ---- burn feedback (T6) --------------------------------------------------
  // Picking up corrosives bare-handed BURNS: hand.js drives a 0..1 level, we
  // tint the right hand's skin materials (color multiplies the skin texture —
  // no texture edits) and raise thin smoke wisps from the palm. The wisps are
  // a self-contained Points in RIG space (they ride the hand automatically) —
  // deliberately NOT an effects/-registry effect, so this file stays the only
  // owner of hand visuals.
  const WISP_N = 14;
  const wispPos = new Float32Array(WISP_N * 3);
  const wispAge = new Float32Array(WISP_N);
  const wispLife = new Float32Array(WISP_N);
  const wispGeo = new THREE.BufferGeometry();
  wispGeo.setAttribute('position', new THREE.BufferAttribute(wispPos, 3));
  const wisps = new THREE.Points(wispGeo, new THREE.PointsMaterial({
    color: 0x9a9a9a, size: 0.007, transparent: true, opacity: 0.6, depthWrite: false
  }));
  wisps.visible = false;
  wisps.frustumCulled = false;          // camera child at the frustum edge
  right.rig.add(wisps);
  function spawnWisp(i) {
    wispPos[i * 3] = GRIP_POS.x + (Math.random() - 0.5) * 0.05;
    wispPos[i * 3 + 1] = GRIP_POS.y + 0.04 + Math.random() * 0.04;
    wispPos[i * 3 + 2] = GRIP_POS.z + (Math.random() - 0.5) * 0.05;
    wispAge[i] = 0;
    wispLife[i] = 0.5 + Math.random() * 0.6;
  }
  for (let i = 0; i < WISP_N; i++) { spawnWisp(i); wispAge[i] = Math.random() * wispLife[i]; }

  // The right hand's ORIGINAL skin materials (userData.skinMat) — tinting
  // these leaves the shared nitrile material and the left hand untouched.
  let burnMats = null;
  function collectBurnMats() {
    if (burnMats && burnMats.length) return burnMats;
    burnMats = [];
    right.orient.traverse((n) => {
      if (n.isSkinnedMesh && n.userData.skinMat) burnMats.push(n.userData.skinMat);
    });
    return burnMats;
  }
  const _burnColor = new THREE.Color();
  const _burnMid = new THREE.Color();     // the chemical's own burn hue (per-frame set)
  const _burnDark = new THREE.Color();    // charred version for deep burns
  const SKIN_WHITE = new THREE.Color(1, 1, 1);
  const DEFAULT_BURN = '#ff5a3c';

  return {
    get on() { return on; },
    // hand.js animates these directly during pickup/pour choreography.
    rightRig: right.rig,
    leftRig: left.rig,

    // 'relaxed' | 'grip' — eased by update(), never snapped.
    setRightPose(name) { right.pose = name; },

    // T6: level 0 = healthy, 1 = deep chemical burn. `colorHex` is the burning
    // chemical's own burnColor (from chemicals.json) so acids redden, oxidisers
    // stain purple, etc. smoking=true raises smoke wisps while it is actively
    // eating skin. White skin → chemical hue → charred, as the level climbs.
    setBurn(level, smoking, colorHex) {
      _burnMid.set(colorHex || DEFAULT_BURN);
      _burnDark.copy(_burnMid).multiplyScalar(0.45);
      if (level < 0.5) _burnColor.copy(SKIN_WHITE).lerp(_burnMid, level * 2);
      else _burnColor.copy(_burnMid).lerp(_burnDark, (level - 0.5) * 2);
      for (const m of collectBurnMats()) m.color.copy(_burnColor);
      wisps.visible = smoking && level > 0.05;
    },

    toggle() {
      on = !on;
      for (const entry of [right, left]) setGloved(entry, on);
      return on;
    },

    // One-time GPU warmup: call from main.js with the renderer after creation.
    // Renders the hands gloved once behind the start overlay so the shader
    // compiles and the canvas texture uploads before the player can interact.
    warmup(renderer) {
      warmupRenderer = renderer;
      if (loadedEntries === 2) doWarmup();
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

      // Hand roll (T5): the wrist rolls the fingers toward horizontal as the
      // grip closes, back to vertical as it opens — same easing as the pose.
      for (const entry of [right, left]) {
        const targetRoll = entry.pose === 'grip' ? (POSES.grip.roll || 0) : 0;
        entry.roll.rotation.z += (targetRoll - entry.roll.rotation.z) * t;
      }

      // T6: burn smoke. Only while setBurn() has made the wisps visible — each
      // wisp rises off the palm, drifts a little, and respawns when its short
      // life ends, giving a continuous curl of smoke from the burning skin.
      if (wisps.visible) {
        for (let i = 0; i < WISP_N; i++) {
          wispAge[i] += delta;
          if (wispAge[i] >= wispLife[i]) { spawnWisp(i); continue; }
          wispPos[i * 3 + 1] += delta * 0.06;                       // rise
          wispPos[i * 3] += Math.sin((time + i) * 2.3) * delta * 0.008;  // curl
        }
        wispGeo.attributes.position.needsUpdate = true;
      }
    }
  };
}
