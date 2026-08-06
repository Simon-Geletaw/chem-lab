// grip-sweep.mjs — find flexion values that actually WRAP the fingers around
// the bottle. Reports per-finger wrap span (deg around the bottle axis) and
// tip height, and flags any joint penetrating the 4.5cm radius.
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

const mirror = new THREE.Group();
mirror.scale.x = -1;
const orient = new THREE.Group();
orient.rotation.set(-0.08, -Math.PI / 2, 0);
orient.add(mirror);
const model = SkeletonUtils.clone(base);
mirror.add(model);
const bones = {};
model.traverse((n) => { if (n.isBone) bones[n.name] = { bone: n, baseQuat: n.quaternion.clone() }; });

const k = new THREE.Vector3();
for (const f of FINGERS) {
  k.x += bones[`${f}_meta`].bone.position.x + bones[`${f}_prox`].bone.position.x;
  k.y += bones[`${f}_meta`].bone.position.y + bones[`${f}_prox`].bone.position.y;
}
k.multiplyScalar(1 / FINGERS.length);
const palm = new THREE.Vector3(k.x, k.y - 4.0, -0.2).multiplyScalar(HAND_SCALE);
palm.applyQuaternion(orient.quaternion);
const GRIP = palm;
const axisModel = GRIP.clone().applyQuaternion(orient.quaternion.clone().invert()).multiplyScalar(1 / HAND_SCALE);
const axis = new THREE.Vector3(axisModel.x, 0, axisModel.z - BOTTLE_R / HAND_SCALE);
const baseY = GRIP.y;

const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
const seed = new THREE.Quaternion(), f = new THREE.Quaternion();
const v = new THREE.Vector3();
const ang = (p) => (Math.atan2(p.z - axis.z, p.x - axis.x) * 180 / Math.PI + 360) % 360;
const jw = (name) => bones[name].bone.getWorldPosition(v).clone();
function run(finger, thumb, rollBy) {
  FINGERS.forEach((name, fi) => {
    FINGER_JOINTS.forEach((joint, ji) => {
      const j = bones[`${name}_${joint}`];
      f.setFromAxisAngle(X, finger[ji]);
      seed.copy(j.baseQuat).multiply(f);
      // Meta joint also ROLLS the finger around its own axis so the tips
      // sweep around the bottle's circumference (the missing wrap axis).
      if (ji === 0 && rollBy) {
        f.setFromAxisAngle(Y, rollBy[fi]);
        seed.multiply(f);
      }
      j.bone.quaternion.copy(seed);
    });
  });
  THUMB.forEach((joint, ji) => {
    const j = bones[`thumb_${joint}`];
    f.setFromAxisAngle(X, thumb[ji]);
    seed.copy(j.baseQuat).multiply(f);
    j.bone.quaternion.copy(seed);
  });
  model.updateMatrixWorld(true);
}
const THUMB = ['trapez', 'meta', 'prox', 'dist'];

console.log('Sweeping index-finger total flexion (uniform across the 4 joints):');
for (let total of [1.5, 2.0, 2.5, 3.0, 3.5, 4.0]) {
  const each = total / 4;
  run([each, each, each, each], [0.05, 0.30, 0.40, 0.22]);
  const m = jw('index_meta'), d = jw('index_dist');
  const radM = Math.hypot(m.x - axis.x, m.z - axis.z) * HAND_SCALE;
  const radD = Math.hypot(d.x - axis.x, d.z - axis.z) * HAND_SCALE;
  const aM = ang(m), aD = ang(d);
  const w = (aD - aM + 720) % 360;
  const tH = (d.y - baseY) * 100, mH = (m.y - baseY) * 100;
  console.log(`total=${total.toFixed(1)}  rad_meta=${(radM*100).toFixed(1)}cm rad_tip=${(radD*100).toFixed(1)}cm  metaAng=${aM.toFixed(0)} tipAng=${aD.toFixed(0)} wrap=${w.toFixed(0)}  h_meta=${mH.toFixed(0)} h_tip=${tH.toFixed(0)}cm`);
}

console.log('\nAdding META ROLL (Y-axis pronation) — does it sweep the tips around the bottle?');
for (let roll of [0.3, 0.6, 0.9, 1.2]) {
  run([0.5, 1.1, 1.2, 0.9], [0.5, 0.8, 0.9, 0.6], [roll, roll, roll, roll]);
  const rows = [];
  for (const fg of FINGERS) {
    const mm = jw(`${fg}_meta`), dd = jw(`${fg}_dist`);
    const h = (dd.y - baseY) * 100;
    const w = (ang(dd) - ang(mm) + 720) % 360;
    rows.push(`${fg}: tipH=${h.toFixed(0)}cm wrap=${w.toFixed(0)} tipAng=${ang(dd).toFixed(0)}`);
  }
  console.log(`roll=${roll}: ` + rows.join(' | '));
}

console.log('\nCandidate full poses:');
const candidates = [
  { name: 'C1 strong', f: [0.9, 1.4, 1.5, 1.2], t: [0.6, 0.9, 1.0, 0.8] },
  { name: 'C2 med',    f: [0.7, 1.25, 1.4, 1.0], t: [0.5, 0.8, 0.9, 0.6] },
  { name: 'C3 soft',   f: [0.5, 1.0, 1.2, 0.9], t: [0.4, 0.7, 0.8, 0.5] },
  { name: 'C4 circ',   f: [0.8, 1.3, 1.4, 1.1], t: [0.55, 0.85, 0.95, 0.7] }
];
for (const c of candidates) {
  run(c.f, c.t, null);
  let pen = 0, worst = 0;
  const rows = [];
  for (const fg of FINGERS) {
    const line = [];
    let penF = 0;
    for (const joint of FINGER_JOINTS) {
      const p = jw(`${fg}_${joint}`);
      const r = Math.hypot(p.x - axis.x, p.z - axis.z) * HAND_SCALE;
      if (r < BOTTLE_R + 0.0005) { pen++; penF++; }
      worst = Math.max(worst, r);
      line.push(`${joint==='meta'?'m':joint[0]}=${(r*100).toFixed(1)}`);
    }
    const mm = jw(`${fg}_meta`), dd = jw(`${fg}_dist`);
    const h = (dd.y - baseY) * 100;
    rows.push(`${fg} tipH=${h.toFixed(0)} wrap=${((ang(dd)-ang(mm)+720)%360).toFixed(0)} [${line.join(',')}]${penF?' @@@PEN':''}`);
  }
  for (const j of THUMB) {
    const p = jw(`thumb_${j}`);
    const r = Math.hypot(p.x - axis.x, p.z - axis.z) * HAND_SCALE;
    if (r < BOTTLE_R) { pen++; }
  }
  const m = jw('thumb_dist');
  console.log(`${c.name}: PENETRATIONS=${pen}  maxRad=${(worst*100).toFixed(1)}cm  thumbTipH=${((m.y-baseY)*100).toFixed(0)}cm`);
  rows.forEach((r) => console.log('   ' + r));
}
function angY(p) { return p.y; }