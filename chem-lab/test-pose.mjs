// test-pose.mjs — apply the CURRENT gloves.js poses (X-flexion) against the
// CORRECTED grip, world-space measurement. Shows what the runtime actually looks like.
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
orient.rotation.set(-0.08, -Math.PI / 2, 0);
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
const gripCorrect = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE).multiplyScalar(HAND_SCALE);
gripCorrect.applyQuaternion(orient.quaternion);
const axis = new THREE.Vector3(rig.position.x + gripCorrect.x, 0, rig.position.z + gripCorrect.z);
const baseY = rig.position.y + gripCorrect.y;

const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const seed = new THREE.Quaternion(), f = new THREE.Quaternion();
const v = new THREE.Vector3();
const jw = (name) => bones[name].bone.getWorldPosition(v).clone();
const giz = (pt) => {
  const rel = new THREE.Vector3(pt.x - axis.x, 0, pt.z - axis.z);
  return { r: rel.length() * 100, az: Math.atan2(rel.x, rel.z) * 180 / Math.PI, h: (pt.y - baseY) * 100 };
};
function apply(flex, thumb, axisName) {
  FINGERS.forEach((name, fi) => {
    FINGER_JOINTS.forEach((joint, ji) => {
      const j = bones[`${name}_${joint}`];
      f.setFromAxisAngle(axisName, flex[ji]);
      seed.copy(j.baseQuat).multiply(f);
      j.bone.quaternion.copy(seed);
    });
  });
  THUMB_JOINTS.forEach((joint, ji) => {
    const j = bones[`thumb_${joint}`];
    f.setFromAxisAngle(axisName, thumb[ji]);
    seed.copy(j.baseQuat).multiply(f);
    j.bone.quaternion.copy(seed);
  });
  model.updateMatrixWorld(true);
}

console.log(`corrected GRIP = (${gripCorrect.x.toFixed(4)}, ${gripCorrect.y.toFixed(4)}, ${gripCorrect.z.toFixed(4)})`);
for (const [pname, pose] of [['relaxed', { finger: [0.04, 0.22, 0.28, 0.12], thumb: [0.02, 0.14, 0.24, 0.16] }], ['grip-X', { finger: [0.10, 0.55, 0.70, 0.20], thumb: [0.05, 0.30, 0.40, 0.22] }]]) {
  apply(pose.finger, pose.thumb, X);
  console.log(`\n== ${pname} (X-flexion, current runtime) ==`);
  for (const fg of FINGERS) {
    const m = giz(jw(`${fg}_meta`)), d = giz(jw(`${fg}_dist`));
    const deep = Math.min(giz(jw(`${fg}_prox`)).r, giz(jw(`${fg}_midd`)).r, d.r, m.r);
    console.log(`${fg}: meta az=${m.az.toFixed(0)} r=${m.r.toFixed(1)} | tip az=${d.az.toFixed(0)} r=${d.r.toFixed(1)} h=${d.h.toFixed(0)}cm | minSeg=${deep.toFixed(1)}cm${deep < 4.3 ? '  <<< IN BOTTLE' : ''}`);
  }
  const t = giz(jw('thumb_dist'));
  console.log(`thumb tip: az=${t.az.toFixed(0)} r=${t.r.toFixed(1)} h=${t.h.toFixed(0)}cm`);
}
console.log('\n== what the CORRECTED grip needs: fingers ON the 4.5cm surface, az front (-120..40) ==');