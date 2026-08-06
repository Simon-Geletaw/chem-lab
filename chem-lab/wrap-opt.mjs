// wrap-opt.mjs — optimize Z-flexion grip: all finger segments ride the bottle
// surface (r 4.3..5.6cm), fingertips wrap the FRONT/LOWER az pan, taper
// index-high -> pinky-low, thumb pinching across the front at mid height.
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

const rig = new THREE.Group();
rig.position.set(0.30, -0.34, -0.52);
const orient = new THREE.Group();
rig.add(orient);
const mirror = new THREE.Group();
mirror.scale.x = -1;
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

const Z = new THREE.Vector3(0, 0, 1);
const seed = new THREE.Quaternion(), q = new THREE.Quaternion();
const v = new THREE.Vector3();
const jw = (name) => bones[name].bone.getWorldPosition(v).clone();
const gizmo = (pt, axis, baseY) => {
  const rel = new THREE.Vector3(pt.x - axis.x, 0, pt.z - axis.z);
  return { r: rel.length() * 100, az: Math.atan2(rel.x, rel.z) * 180 / Math.PI, h: (pt.y - baseY) * 100 };
};
let axis, baseY;
function apply(finger, thumb, roll) {
  orient.rotation.set(-0.08, -Math.PI / 2, roll);
  orient.updateMatrixWorld(true);
  const grip = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE).multiplyScalar(HAND_SCALE);
  grip.applyQuaternion(orient.quaternion);
  axis = new THREE.Vector3(rig.position.x + grip.x, 0, rig.position.z + grip.z);
  baseY = rig.position.y + grip.y;
  FINGERS.forEach((name) => {
    FINGER_JOINTS.forEach((joint, ji) => {
      const j = bones[`${name}_${joint}`];
      q.setFromAxisAngle(Z, finger[ji]);
      seed.copy(j.baseQuat).multiply(q);
      j.bone.quaternion.copy(seed);
    });
  });
  THUMB_JOINTS.forEach((joint, ji) => {
    const j = bones[`thumb_${joint}`];
    q.setFromAxisAngle(Z, thumb[ji]);
    seed.copy(j.baseQuat).multiply(q);
    j.bone.quaternion.copy(seed);
  });
  model.updateMatrixWorld(true);
}

// Objective: all segments r in [4.3,5.6] riding the surface; fingertips az
// around front (-120..40), height taper index high -> pinky low; thumb pinch.
const tipAzt = { index: -45, midd: -55, ring: -65, pinky: -75 };
const tipHt = { index: 9, midd: 8, ring: 6, pinky: 4 };
function score(finger, thumb, roll) {
  apply(finger, thumb, roll);
  let cost = 0;
  for (const fg of FINGERS) {
    for (const joint of FINGER_JOINTS) {
      const r = gizmo(jw(`${fg}_${joint}`), axis, baseY).r;
      if (r < 4.3) cost += (4.3 - r) * 40;
      else if (r > 5.8) cost += (r - 5.8) * 15;
    }
    const t = gizmo(jw(`${fg}_dist`), axis, baseY);
    let da = Math.abs(t.az - tipAzt[fg]) % 360; if (da > 180) da = 360 - da;
    cost += da * 0.2;
    cost += Math.abs(t.h - tipHt[fg]) * 1.2;
  }
  const th = gizmo(jw('thumb_dist'), axis, baseY);
  cost += (th.r < 4.3 ? (4.3 - th.r) * 40 : 0) + (th.r > 5.8 ? (th.r - 5.8) * 15 : 0);
  let da = Math.abs(th.az - 25) % 360; if (da > 180) da = 360 - da;
  cost += da * 0.3 + Math.abs(th.h - 5) * 1.0;
  return cost;
}

// anneal from a good seed, also optimizing roll
let best = null;
let cur = { finger: [0.18, 0.7, 0.5, 0.15], thumb: [0.25, 0.15, 0.5, 0.25], roll: 0, score: Infinity };
best = { ...cur, score: cur.score };
let T = 0.3;
for (let it = 0; it < 20000; it++) {
  const nf = cur.finger.map((x, i) => x + (Math.random() - 0.5) * T * (i === 0 ? 0.08 : i === 3 ? 0.1 : 0.16));
  const nt = cur.thumb.map((x) => x + (Math.random() - 0.5) * T * 0.12);
  const nr = 0;
  const c = score(nf, nt, nr);
  if (c < cur.score || Math.random() < Math.exp((cur.score - c) / T)) {
    cur = { finger: nf, thumb: nt, roll: nr, score: c };
    if (c < best.score) { best = { finger: nf.slice(), thumb: nt.slice(), roll: nr, score: c }; console.log(`it=${it} score=${c.toFixed(1)} roll=${nr.toFixed(2)} ${JSON.stringify(nf)} / ${JSON.stringify(nt)}`); }
  }
  T *= 0.9999;
}
console.log('\nBEST:', JSON.stringify(best, null, 2));
apply(best.finger, best.thumb, best.roll);
console.log(`\norient yaw=${(-Math.PI / 2).toFixed(3)} roll=${best.roll.toFixed(3)}`);
const grip = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE).multiplyScalar(HAND_SCALE);
grip.applyQuaternion(orient.quaternion);
console.log(`GRIP_POS = (${grip.x.toFixed(4)}, ${grip.y.toFixed(4)}, ${grip.z.toFixed(4)})`);
for (const fg of FINGERS) {
  let row = [], min = 99, max = -1;
  for (const joint of FINGER_JOINTS) {
    const r = gizmo(jw(`${fg}_${joint}`), axis, baseY).r;
    min = Math.min(min, r); max = Math.max(max, r);
    row.push(`${joint[0]}${r.toFixed(1)}`);
  }
  const t = gizmo(jw(`${fg}_dist`), axis, baseY);
  console.log(`${fg}: [${row.join(' ')}] -> tip az=${t.az.toFixed(0)} r=${t.r.toFixed(1)} h=${t.h.toFixed(0)} cm (min ${min.toFixed(1)} max ${max.toFixed(1)})`);
}
for (const joint of THUMB_JOINTS) {
  const t = gizmo(jw(`thumb_${joint}`), axis, baseY);
  console.log(`thumb ${joint}: az=${t.az.toFixed(0)} r=${t.r.toFixed(1)} h=${t.h.toFixed(0)}cm`);
}