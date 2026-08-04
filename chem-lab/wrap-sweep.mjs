// wrap-sweep.mjs — sweep flexion sign/magnitude, watch fingertip azimuth+radius
// in WORLD space around the corrected bottle axis. Goal: fingertips land
// ON the bottle surface (rad ~4.5-5cm) on the FRONT-LEFT side (az 0..-120),
// i.e. the fingers visibly wrap the bottle from the camera side.
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
const axisModel = new THREE.Vector3(k.x, k.y - 4.0, palmZ + BOTTLE_R / HAND_SCALE);
const gripCorrect = axisModel.clone().multiplyScalar(HAND_SCALE);
gripCorrect.applyQuaternion(orient.quaternion);
const axis = new THREE.Vector3(rig.position.x + gripCorrect.x, 0, rig.position.z + gripCorrect.z);
const baseY = rig.position.y + gripCorrect.y;

const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
const seed = new THREE.Quaternion(), f = new THREE.Quaternion();
const v = new THREE.Vector3();
const jw = (name) => bones[name].bone.getWorldPosition(v).clone();
function apply(flex, thumb) {
  FINGERS.forEach((name, fi) => {
    FINGER_JOINTS.forEach((joint, ji) => {
      const j = bones[`${name}_${joint}`];
      f.setFromAxisAngle(Z, flex[ji]);
      seed.copy(j.baseQuat).multiply(f);
      j.bone.quaternion.copy(seed);
    });
  });
  THUMB_JOINTS.forEach((joint, ji) => {
    const j = bones[`thumb_${joint}`];
    f.setFromAxisAngle(Z, thumb[ji]);
    seed.copy(j.baseQuat).multiply(f);
    j.bone.quaternion.copy(seed);
  });
  model.updateMatrixWorld(true);
}
const relStat = (pt) => {
  const rel = new THREE.Vector3(pt.x - axis.x, 0, pt.z - axis.z);
  return { r: rel.length() * 100, az: Math.atan2(rel.x, rel.z) * 180 / Math.PI };
};

console.log(`bottle axis (${axis.x.toFixed(3)}, ${axis.z.toFixed(3)}), base y ${baseY.toFixed(3)}`);

let best = null;
for (let m = 0.05; m <= 0.4; m += 0.05) {
  for (let p = 0.3; p <= 1.3; p += 0.1) {
    for (let md = 0.3; md <= 1.4; md += 0.1) {
      for (let d = 0.1; d <= 0.7; d += 0.1) {
        apply([m, p, md, d], [0.3, 0.5, 0.6, 0.35]);
        let min = 99, azErr = 0;
        for (const fg of FINGERS) {
          for (const joint of FINGER_JOINTS) {
            const pt = jw(`${fg}_${joint}`);
            min = Math.min(min, relStat(pt).r);
          }
          const t = relStat(jw(`${fg}_dist`));
          const target = fg === 'index' ? -40 : fg === 'midd' ? -50 : fg === 'ring' ? -60 : -70;
          azErr += Math.abs(t.az - target);
        }
        const thumbTip = relStat(jw('thumb_dist'));
        const score = min * 10 + azErr + (min < 4.3 ? 1000 : 0) + Math.abs(thumbTip.az - 10) * 0.3;
        if (!best || score < best.score) best = { m, p, md, d, min, azErr, thumbTip, score };
      }
    }
  }
}