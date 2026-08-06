
// probe.mjs — headless geometry check for the hand rig + grip pose.
// Mirrors src/gloves.js EXACTLY (as of the Z-flexion grip fix):
//   left  = plain model, orient Rx(-0.08).Ry(+90 deg)
//   right = mirrored clone, orient Rx(-0.08).Ry(-90 deg)
//   GRIP_POS = (knuckle line, -4.0 units down, palm-surface + bottle radius)
//   grip pose flexes about Z (wraps the vertical bottle), relaxed about X.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
const __dirname = dirname(fileURLToPath(import.meta.url));

const HAND_SCALE = 0.0085;
const BOTTLE_R = 0.045;
const FINGERS = ['index', 'midd', 'ring', 'pinky'];
const FINGER_JOINTS = ['meta', 'prox', 'midd', 'dist'];
const THUMB_JOINTS = ['trapez', 'meta', 'prox', 'dist'];

const POSES = {
  relaxed: { axis: 'x', finger: [0.04, 0.22, 0.28, 0.12], thumb: [0.02, 0.14, 0.24, 0.16], spread: 0.05 },
  grip: JSON.parse(process.env.POSE_GRIP || '{"axis":"z","finger":[0.36,0.78,0.65,0.21],"thumb":[0.06,0.88,0.90,0.34],"spread":0}')
};
const PALM_Y_OFFSET = Number(process.env.PALM_OFFSET || 4.0);

const loader = new GLTFLoader();
loader.setRequestHeader = () => {};
loader.load = (url, onLoad, onProgress, onError) => {
  readFile(new URL(url).pathname.slice(1))
    .then((buf) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', onLoad, onError))
    .catch(onError);
};

const gltf = await loader.loadAsync(pathToFileURL(join(__dirname, 'public/Models/hand_model.glb')).href);
const base = gltf.scene;
base.scale.setScalar(HAND_SCALE);

function indexBones(root) {
  const m = {};
  root.traverse((n) => { if (n.isBone) m[n.name] = { bone: n, baseQuat: n.quaternion.clone() }; });
  return m;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
function applyPose(bones, pose) {
  const _target = new THREE.Quaternion();
  const _flex = new THREE.Quaternion();
  const flexAxis = pose.axis === 'z' ? Z_AXIS : X_AXIS;
  FINGERS.forEach((finger, fi) => {
    FINGER_JOINTS.forEach((joint, ji) => {
      const j = bones[`${finger}_${joint}`];
      if (!j) return;
      _flex.setFromAxisAngle(flexAxis, pose.finger[ji]);
      _target.copy(j.baseQuat).multiply(_flex);
      if (ji === 0 && pose.spread && pose.axis !== 'z') {
        _flex.setFromAxisAngle(Z_AXIS, (1.5 - fi) * pose.spread);
        _target.multiply(_flex);
      }
      j.bone.quaternion.copy(_target);
    });
  });
  THUMB_JOINTS.forEach((joint, ji) => {
    const j = bones[`thumb_${joint}`];
    if (!j) return;
    _flex.setFromAxisAngle(flexAxis, pose.thumb[ji]);
    _target.copy(j.baseQuat).multiply(_flex);
    j.bone.quaternion.copy(_target);
  });
}

// ---- rigs exactly as gloves.js ----
const leftModel = base;
const leftOrient = new THREE.Group();
leftOrient.rotation.set(-0.08, Math.PI / 2, 0);
leftOrient.add(leftModel);

const rightMirror = new THREE.Group();
rightMirror.scale.x = -1;
const rightOrient = new THREE.Group();
rightOrient.rotation.set(-0.08, -Math.PI / 2, 0);
rightOrient.add(rightMirror);
const rightModel = SkeletonUtils.clone(base);
rightMirror.add(rightModel);

const leftBones = indexBones(leftModel);
const rightBones = indexBones(rightModel);
applyPose(leftBones, POSES.relaxed);
applyPose(rightBones, POSES.relaxed);

leftOrient.updateMatrixWorld(true);
rightOrient.updateMatrixWorld(true);

// ---- GRIP_POS: knuckle line, palm bowl below it, palm SURFACE + bottle
//      radius out to +z (exactly like gloves.js now) ----
const k = new THREE.Vector3();
for (const f of FINGERS) {
  const meta = rightBones[`${f}_meta`].bone;
  const prox = rightBones[`${f}_prox`].bone;
  k.x += meta.position.x + prox.position.x;
  k.y += meta.position.y + prox.position.y;
}
k.multiplyScalar(1 / FINGERS.length);

let palmZ = -Infinity;
rightModel.traverse((n) => {
  if (!n.isSkinnedMesh) return;
  if (n.material && n.material.name && /nail/i.test(n.material.name)) return;
  const pos = n.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > k.y - 6 && y < k.y + 2 && pos.getZ(i) > palmZ) palmZ = pos.getZ(i);
  }
});
const palm = new THREE.Vector3(k.x, k.y - PALM_Y_OFFSET, palmZ + BOTTLE_R / HAND_SCALE);
palm.multiplyScalar(HAND_SCALE);
palm.applyQuaternion(rightOrient.quaternion);
const GRIP = palm;
console.log('GRIP_POS =', GRIP.toArray().map((v) => v.toFixed(4)).join(', '), '(bottle base, rig space)');

// ---- palm facing (rig/world space; both rigs have no rotation so == camera space) ----
function palmNormal(orient) {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(orient.quaternion).normalize();
}
console.log('LEFT palm normal  =', palmNormal(leftOrient).toArray().map((v) => v.toFixed(2)).join(', '), '(want +1,0,0)');
console.log('RIGHT palm normal =', palmNormal(rightOrient).toArray().map((v) => v.toFixed(2)).join(', '), '(want -1,0,0)');

// ---- grip wrap check on the RIGHT hand (the bottle carrier), WORLD/WORLD ----
function gizmo(pt) {
  const rel = new THREE.Vector3(pt.x - axis.x, 0, pt.z - axis.z);
  return {
    r: rel.length() * 100,                // cm from the bottle axis
    az: Math.atan2(rel.x, rel.z) * 180 / Math.PI,
    h: (pt.y - baseY) * 100               // cm above the bottle base
  };
}
let axis, baseY;
for (const [name, pose] of Object.entries(POSES)) {
  applyPose(rightBones, pose);
  // axis/bottle base in probe world space (the rig rests at the origin, so
  // the bottle axis is exactly GRIP_POS; gloves.js applies it relative to the
  // rig the same way).
  axis = GRIP.clone();
  axis.y = 0;
  baseY = GRIP.y;
  rightModel.updateMatrixWorld(true);
  console.log(`--- pose: ${name} (right hand) ---`);
  const _v = new THREE.Vector3();
  const jw = (n) => rightBones[n].bone.getWorldPosition(_v).clone();
  let wrapping = true, minR = 99;
  for (const f of FINGERS) {
    let seg = '';
    let m = 99;
    for (const joint of FINGER_JOINTS) {
      const s = gizmo(jw(`${f}_${joint}`));
      if (s.r < m) m = s.r;
      seg += `${joint[0]}${s.r.toFixed(1)} `;
    }
    if (m < 4.3) wrapping = false;
    const t = gizmo(jw(`${f}_dist`));
    console.log(`${f.padEnd(6)} segments [${seg}] tip az=${t.az.toFixed(0).padStart(4)} r=${t.r.toFixed(1)}cm h=${t.h.toFixed(0)}cm ${t.r < 4.3 ? '<<< IN BOTTLE' : ''}`);
  }
  const th = gizmo(jw('thumb_dist'));
  console.log(`thumb dist: az=${th.az.toFixed(0).padStart(4)} r=${th.r.toFixed(1)}cm h=${th.h.toFixed(0)}cm`);
  console.log(`VERDICT: ${wrapping && th.r > 4.0 ? 'GRIP OK  (all segments outside the 4.5cm surface)' : 'GRIP REVIEW NEEDED (penetrates the bottle)'}`);
}

// ---- mirror sanity: left plain vs right mirrored across yz plane ----
applyPose(leftBones, POSES.relaxed);
applyPose(rightBones, POSES.relaxed);
leftModel.updateMatrixWorld(true);
rightModel.updateMatrixWorld(true);
let mir = true;
for (const f of [...FINGERS, 'thumb']) {
  for (const j of f === 'thumb' ? THUMB_JOINTS : FINGER_JOINTS) {
    const l = leftModel.getObjectByName(`${f}_${j}`);
    const r = rightModel.getObjectByName(`${f}_${j}`);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    l.getWorldPosition(a); r.getWorldPosition(b);
    const dx = a.x + b.x, dy = a.y - b.y, dz = a.z - b.z;
    if (Math.abs(dx) * HAND_SCALE + Math.abs(dy) + Math.abs(dz) > 0.05) {
      mir = false;
      console.log(`MISMATCH ${f}_${j}: dx=${dx.toFixed(3)} dy=${dy.toFixed(3)} dz=${dz.toFixed(3)}`);
    }
  }
}
console.log(mir ? 'MIRROR OK: right hand = true reflection of the left' : 'MIRROR FAILED');
const li = leftModel.getObjectByName('index_dist').getWorldPosition(new THREE.Vector3());
const lt = leftModel.getObjectByName('thumb_dist').getWorldPosition(new THREE.Vector3());
const ri = rightModel.getObjectByName('index_dist').getWorldPosition(new THREE.Vector3());
const rt = rightModel.getObjectByName('thumb_dist').getWorldPosition(new THREE.Vector3());
console.log(`left:  thumb.x=${lt.x.toFixed(3)} < index.x=${li.x.toFixed(3)} ? ${lt.x < li.x ? 'YES (left hand)' : 'NO'}`);
console.log(`right: thumb.x=${rt.x.toFixed(3)} > index.x=${ri.x.toFixed(3)} ? ${rt.x > ri.x ? 'YES (right hand)' : 'NO'}`);