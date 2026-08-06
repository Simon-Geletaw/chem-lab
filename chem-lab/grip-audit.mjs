// grip-audit.mjs — ground-truth audit of the RIGHT-hand bottle grip.
// Builds the EXACT gloves.js rig (mirror scale.x=-1, orient pitch/yaw, roll
// group), runs the SAME fitGrip() the browser runs (src/gripFit.js), applies
// the fitted roll + per-joint pose, attaches a real bottle at the fitted
// grip position, then measures in WORLD space:
//   - azimuth around the bottle axis (0 = toward camera, +90 = right, -90 = left)
//   - radial distance from the axis (4.5cm = on the bottle surface)
//   - height above the bottle base
// Exit code 1 = FAIL (not enough contact, or fingers pierce the glass).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fitGrip } from './src/gripFit.js';

globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
const __dirname = dirname(fileURLToPath(import.meta.url));

const HAND_SCALE = 0.0085;
const BOTTLE_R = 0.045;

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

// ---- exact gloves.js rig (right hand): rig > orient > roll > mirror > model
const rig = new THREE.Group();
rig.position.set(0.30, -0.34, -0.52);            // RIGHT_REST
const orient = new THREE.Group();
orient.rotation.set(-0.08, -Math.PI / 2, 0);     // pitch, yaw
rig.add(orient);
const rollGroup = new THREE.Group();
orient.add(rollGroup);
const mirror = new THREE.Group();
mirror.scale.x = -1;
rollGroup.add(mirror);
const model = SkeletonUtils.clone(base);
mirror.add(model);
// bones from the DISPLAYED skeleton (the clone), exactly like gloves.js now
const bones = {};
model.traverse((n) => { if (n.isBone) bones[n.name] = { bone: n, baseQuat: n.quaternion.clone() }; });

// ---- palm anchor exactly as gloves.js computes it (model-local units) ------
const FINGERS = ['index', 'midd', 'ring', 'pinky'];
const FINGER_JOINTS = ['meta', 'prox', 'midd', 'dist'];
const THUMB_JOINTS = ['trapez', 'meta', 'prox', 'dist'];
const k = new THREE.Vector3();
for (const f of FINGERS) {
  k.x += bones[`${f}_meta`].bone.position.x + bones[`${f}_prox`].bone.position.x;
  k.y += bones[`${f}_meta`].bone.position.y + bones[`${f}_prox`].bone.position.y;
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
console.log(`knuckle line k = (${k.x.toFixed(2)}, ${k.y.toFixed(2)}), palm surface z = ${palmZ.toFixed(2)} model units`);
const anchorPoint = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE);
rig.updateMatrixWorld(true);

// ---- run the production fit -------------------------------------------------
const fit = fitGrip({ bones, rig, rollGroup, anchorObject: model, anchorPoint, bottleR: BOTTLE_R, handScale: HAND_SCALE });
console.log('--- fitGrip report ---');
console.log(fit.summary);
const GRIP = fit.gripPos;
console.log(`GRIP_POS = (${GRIP.x.toFixed(4)}, ${GRIP.y.toFixed(4)}, ${GRIP.z.toFixed(4)}) rig space`);

// ---- apply the fitted roll + pose, exactly like applyPose -------------------
rollGroup.rotation.z = fit.roll;
const X = new THREE.Vector3(1, 0, 0);
const seed = new THREE.Quaternion(), f = new THREE.Quaternion();
function applyDigit(names, angles) {
  names.forEach((n, ji) => {
    const j = bones[n];
    if (!j) return;
    f.setFromAxisAngle(X, angles[ji]);
    seed.copy(j.baseQuat).multiply(f);
    j.bone.quaternion.copy(seed);
  });
}
for (const fg of FINGERS) applyDigit(FINGER_JOINTS.map((j) => `${fg}_${j}`), fit.perJoint[fg]);
applyDigit(THUMB_JOINTS.map((j) => `thumb_${j}`), fit.perJoint.thumb);
rig.updateMatrixWorld(true);

// ---- the real bottle as hand.js attaches it --------------------------------
const bottle = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 20));
body.position.y = 0.08;
bottle.add(body);
bottle.position.copy(GRIP);   // rig-space; rig has no rotation while HOLDING
rig.add(bottle);
rig.updateMatrixWorld(true);

// ---- world-space measurement ----------------------------------------------
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
  const flag = r < BOTTLE_R - 0.002 ? '  <<<< PENETRATES' : '';
  console.log(`${label.padEnd(13)} az=${az.toFixed(0).padStart(4)} rad=${(r * 100).toFixed(1)}cm h=${h.toFixed(0).padStart(3)}cm${flag}`);
}
console.log('azimuth key: 0 = facing camera, +90 = screen-right, -90 = screen-left, 180 = away');
console.log('--- fingers ---');
for (const fg of FINGERS) {
  report(`${fg}_meta`, `${fg} meta`);
  report(`${fg}_prox`, `${fg} prox`);
  report(`${fg}_midd`, `${fg} midd`);
  report(`${fg}_dist`, `${fg} dist`);
}
console.log('--- thumb ---');
for (const j of THUMB_JOINTS) report(`thumb_${j}`, `thumb ${j}`);

// how much each finger wraps: knuckle azimuth -> tip azimuth
console.log('--- wrap ---');
for (const fg of FINGERS) {
  const m = jw(`${fg}_prox`), d = jw(`${fg}_dist`);
  const azM = Math.atan2(m.x - axis.x, m.z - axis.z) * 180 / Math.PI;
  const azD = Math.atan2(d.x - axis.x, d.z - axis.z) * 180 / Math.PI;
  let w = azD - azM; while (w > 180) w -= 360; while (w < -180) w += 360;
  console.log(`${fg}: prox az ${azM.toFixed(0)} -> dist az ${azD.toFixed(0)}  (wrap ${w.toFixed(0)} deg around the bottle)`);
}

// ---- verdict ----------------------------------------------------------------
let penetrations = 0;
const check = (name) => {
  const p = jw(name);
  const r = Math.hypot(p.x - axis.x, p.z - axis.z);
  if (r < BOTTLE_R - 0.002) penetrations++;
};
for (const fg of FINGERS) for (const j of FINGER_JOINTS) check(`${fg}_${j}`);
for (const j of THUMB_JOINTS) check(`thumb_${j}`);
console.log('--- verdict ---');
console.log(`digits in contact: ${fit.contacts}/5, joint penetrations: ${penetrations}`);
if (fit.contacts >= 3 && penetrations === 0) {
  console.log('GRIP AUDIT: PASS');
} else {
  console.log('GRIP AUDIT: FAIL');
  process.exitCode = 1;
}
