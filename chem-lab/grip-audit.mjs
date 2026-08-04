// grip-audit.mjs — ground-truth audit of the RIGHT-hand bottle grip.
// Builds the EXACT gloves.js rig (mirror scale.x=-1, orient pitch/yaw),
// applies the exact applyPose math, attaches a real bottle (r=0.045, h=0.22)
// at GRIP_POS as hand.js does, then measures in WORLD space:
//   - azimuth around the bottle axis (0 = toward camera, +90 = right, -90 = left)
//   - radial distance from the axis (4.5cm = on the bottle surface)
//   - height above the bottle base
// This tells us whether the fingers WRAP around the bottle or just touch it.
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
const POSE = JSON.parse(process.env.POSE_GRIP || '{"finger":[0.5,1.1,1.2,0.9],"thumb":[0.6,1.0,1.1,0.8],"spread":0,"roll":[0,0,0,0]}');
const PALM_Y = parseFloat(process.env.PALM_Y || '4.0');

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

// ---- exact gloves.js rig (right hand) -------------------------------------
const rig = new THREE.Group();
rig.position.set(0.30, -0.34, -0.52);            // RIGHT_REST
const orient = new THREE.Group();
orient.rotation.set(-0.08, -Math.PI / 2, 0);     // pitch, yaw
rig.add(orient);
const mirror = new THREE.Group();
mirror.scale.x = -1;
orient.add(mirror);
const model = SkeletonUtils.clone(base);
mirror.add(model);
const bones = {};
model.traverse((n) => { if (n.isBone) bones[n.name] = { bone: n, baseQuat: n.quaternion.clone() }; });

// ---- GRIP_POS exactly as gloves.js computes it ----------------------------
const FINGERS = ['index', 'midd', 'ring', 'pinky'];
const FINGER_JOINTS = ['meta', 'prox', 'midd', 'dist'];
const THUMB_JOINTS = ['trapez', 'meta', 'prox', 'dist'];
const k = new THREE.Vector3();
for (const f of FINGERS) {
  k.x += bones[`${f}_meta`].bone.position.x + bones[`${f}_prox`].bone.position.x;
  k.y += bones[`${f}_meta`].bone.position.y + bones[`${f}_prox`].bone.position.y;
}
k.multiplyScalar(1 / FINGERS.length);

// TRUE palm surface: max +z vertex of the Hand mesh in the palm band.
// (The model's palm faces +z; fingers run along +y.)
let palmZ = -Infinity;
model.traverse((n) => {
  if (!n.isSkinnedMesh) return;
  const geo = n.geometry;
  if (n.material && n.material.name && /nail/i.test(n.material.name)) return;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > k.y - 6 && y < k.y + 2 && pos.getZ(i) > palmZ) palmZ = pos.getZ(i);
  }
});
console.log(`knuckle line k = (${k.x.toFixed(2)}, ${k.y.toFixed(2)}), palm surface z = ${palmZ.toFixed(2)} model units`);

const palm = new THREE.Vector3(k.x, k.y - PALM_Y, -0.2).multiplyScalar(HAND_SCALE);
palm.applyQuaternion(orient.quaternion);

// CORRECT GRIP: bottle axis must sit BOTTLE_R outside the palm surface.
const axisModel = new THREE.Vector3(k.x, k.y - PALM_Y, palmZ + BOTTLE_R / HAND_SCALE);
const gripCorrect = axisModel.clone().multiplyScalar(HAND_SCALE);
gripCorrect.applyQuaternion(orient.quaternion);
console.log(`GRIP_POS current = (${palm.x.toFixed(4)}, ${palm.y.toFixed(4)}, ${palm.z.toFixed(4)})`);
console.log(`GRIP_POS correct = (${gripCorrect.x.toFixed(4)}, ${gripCorrect.y.toFixed(4)}, ${gripCorrect.z.toFixed(4)})`);
const GRIP = gripCorrect;   // validate the CORRECTED grip

// ---- the real bottle as hand.js attaches it --------------------------------
const bottle = new THREE.Group();
const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfd8ef, transparent: true, opacity: 0.85 });
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 20), glassMat);
body.position.y = 0.08;
bottle.add(body);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.04, 20), glassMat);
neck.position.y = 0.18;
bottle.add(neck);
const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 20), new THREE.MeshStandardMaterial({ color: 0x22303c }));
cap.position.y = 0.21;
bottle.add(cap);
bottle.position.copy(GRIP);   // rig-space; rig has no rotation while HOLDING
rig.add(bottle);
rig.updateMatrixWorld(true);

// ---- apply the pose exactly like applyPose --------------------------------
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
const seed = new THREE.Quaternion(), f = new THREE.Quaternion();
FINGERS.forEach((finger, fi) => {
  FINGER_JOINTS.forEach((joint, ji) => {
    const j = bones[`${finger}_${joint}`];
    if (!j) return;
    f.setFromAxisAngle(X, POSE.finger[ji]);
    seed.copy(j.baseQuat).multiply(f);
    if (ji === 0 && POSE.spread) {
      f.setFromAxisAngle(Z, (1.5 - fi) * POSE.spread);
      seed.multiply(f);
    }
    j.bone.quaternion.copy(seed);
  });
});
THUMB_JOINTS.forEach((joint, ji) => {
  const j = bones[`thumb_${joint}`];
  if (!j) return;
  f.setFromAxisAngle(X, POSE.thumb[ji]);
  seed.copy(j.baseQuat).multiply(f);
  j.bone.quaternion.copy(seed);
});
model.updateMatrixWorld(true);

// ---- world-space measurement ----------------------------------------------
// bottle axis: rig has zero rotation while HOLDING, so bottle world = rig + GRIP
const axis = new THREE.Vector3(rig.position.x + GRIP.x, 0, rig.position.z + GRIP.z);
const baseY = rig.position.y + GRIP.y;
const v = new THREE.Vector3();
const jw = (name) => bones[name].bone.getWorldPosition(v).clone();
function report(name, label) {
  const p = jw(name);
  const rel = new THREE.Vector3(p.x - axis.x, 0, p.z - axis.z);
  const r = rel.length();
  const az = Math.atan2(rel.x, rel.z) * 180 / Math.PI;   // 0=camera, +90=right, -90=left
  const h = (p.y - baseY) * 100;                         // cm above bottle base
  const flag = r < BOTTLE_R ? '  <<<< PENETRATES' : '';
  console.log(`${label.padEnd(13)} az=${az.toFixed(0).padStart(4)} rad=${(r * 100).toFixed(1)}cm h=${h.toFixed(0).padStart(3)}cm${flag}`);
}
console.log(`GRIP_POS = (${GRIP.x.toFixed(4)}, ${GRIP.y.toFixed(4)}, ${GRIP.z.toFixed(4)}) rig space`);
console.log('azimuth key: 0 = facing camera, +90 = screen-right, -90 = screen-left, 180 = away');
console.log('--- fingers ---');
for (const fg of FINGERS) {
  report(`${fg}_meta`, `${fg} meta`);
  report(`${fg}_dist`, `${fg} dist`);
}
console.log('--- thumb ---');
for (const j of THUMB_JOINTS) report(`thumb_${j}`, `thumb ${j}`);

// how much each finger wraps: knuckle azimuth -> tip azimuth
console.log('--- wrap ---');
for (const fg of FINGERS) {
  const m = jw(`${fg}_meta`), d = jw(`${fg}_dist`);
  const azM = Math.atan2(m.x - axis.x, m.z - axis.z) * 180 / Math.PI;
  const azD = Math.atan2(d.x - axis.x, d.z - axis.z) * 180 / Math.PI;
  let w = azD - azM; while (w > 180) w -= 360; while (w < -180) w += 360;
  console.log(`${fg}: knuckle az ${azM.toFixed(0)} -> tip az ${azD.toFixed(0)}  (wrap ${w.toFixed(0)} deg around the bottle)`);
}