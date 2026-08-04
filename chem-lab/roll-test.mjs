// roll-test.mjs — find the orient roll that turns the fingers from vertical
// (parallel to the bottle) to HORIZONTAL (wrapping across it), then check
// whether natural X-flexion rides the bottle surface.
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

const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const seed = new THREE.Quaternion(), q = new THREE.Quaternion();
const v = new THREE.Vector3();
const jw = (name) => bones[name].bone.getWorldPosition(v).clone();

function setup(roll) {
  orient.rotation.set(-0.08, -Math.PI / 2, roll);
  orient.updateMatrixWorld(true);
  const grip = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE).multiplyScalar(HAND_SCALE);
  grip.applyQuaternion(orient.quaternion);
  return new THREE.Vector3(rig.position.x + grip.x, 0, rig.position.z + grip.z);
}
function apply(flex, thumb) {
  FINGERS.forEach((name) => {
    FINGER_JOINTS.forEach((joint, ji) => {
      const j = bones[`${name}_${joint}`];
      q.setFromAxisAngle(X, flex[ji]);
      seed.copy(j.baseQuat).multiply(q);
      j.bone.quaternion.copy(seed);
    });
  });
  THUMB_JOINTS.forEach((joint, ji) => {
    const j = bones[`thumb_${joint}`];
    q.setFromAxisAngle(X, thumb[ji]);
    seed.copy(j.baseQuat).multiply(q);
    j.bone.quaternion.copy(seed);
  });
  model.updateMatrixWorld(true);
}
const giz = (pt, axis, baseY) => {
  const rel = new THREE.Vector3(pt.x - axis.x, 0, pt.z - axis.z);
  return { r: rel.length() * 100, az: Math.atan2(rel.x, rel.z) * 180 / Math.PI, h: (pt.y - baseY) * 100 };
};

console.log('Roll sweep: direction of the index metacarpal (model +y after orient) — want ~horizontal (|y| small):');
for (const roll of [0, 0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0]) {
  orient.rotation.set(-0.08, -Math.PI / 2, roll);
  orient.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const meta = jw('index_meta'), prox = jw('index_prox');
  const dir = prox.clone().sub(meta);
  console.log(`roll=${roll.toFixed(2)}  metacarpal dir = (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)})  |y|=${Math.abs(dir.y).toFixed(2)}`);
}

// Now: with roll ≈ ±1.57 (fingers horizontal), flex about X and measure on the bottle
for (const roll of [1.57, -1.57]) {
  const axis = setup(roll);
  const baseY = rig.position.y + (new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE).multiplyScalar(HAND_SCALE)).applyQuaternion(orient.quaternion).y;
  apply([0.15, 0.55, 0.70, 0.20], [0.05, 0.30, 0.40, 0.22]);
  console.log(`\n=== roll=${roll.toFixed(2)} (fingers horizontal), X-flexion grip ===`);
  for (const fg of FINGERS) {
    let row = [], min = 99;
    for (const joint of FINGER_JOINTS) {
      const r = giz(jw(`${fg}_${joint}`), axis, baseY).r;
      min = Math.min(min, r);
      row.push(`${joint[0]}${r.toFixed(1)}`);
    }
    const t = giz(jw(`${fg}_dist`), axis, baseY);
    console.log(`${fg}: [${row.join(' ')}] tip az=${t.az.toFixed(0)} r=${t.r.toFixed(1)} h=${t.h.toFixed(0)}cm min=${min.toFixed(1)}${min < 4.3 ? '  <<< DEEP' : ''}`);
  }
  for (const joint of THUMB_JOINTS) {
    const t = giz(jw(`thumb_${joint}`), axis, baseY);
    console.log(`thumb ${joint}: az=${t.az.toFixed(0)} r=${t.r.toFixed(1)} h=${t.h.toFixed(0)}cm`);
  }
}