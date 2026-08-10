import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFile } from 'node:fs/promises';
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
const loader = new GLTFLoader();
loader.setRequestHeader = () => {};
loader.load = (url, onLoad, onProgress, onError) => {
  readFile(new URL(url).pathname.slice(1))
    .then((buf) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', onLoad, onError))
    .catch(onError);
};
const url = 'file:///C:/Users/Hp/Desktop/AIT-Threejs/chem-lab/public/Models/window.glb';
const gltf = await loader.loadAsync(url);
const m = gltf.scene;
m.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(m);
const size = box.getSize(new THREE.Vector3());
const cen = box.getCenter(new THREE.Vector3());
console.log('SIZE  x=%s y=%s z=%s', size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3));
console.log('CENTER x=%s y=%s z=%s', cen.x.toFixed(3), cen.y.toFixed(3), cen.z.toFixed(3));
console.log('-- nodes --');
m.traverse((o) => console.log('  ', o.type, o.name || '(unnamed)'));
