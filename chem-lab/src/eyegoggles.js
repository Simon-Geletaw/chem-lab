// eyegoggles.js — chemical-splash goggles for the PPE station.
//
// The physical prop uses a small set of shared, low-segment geometries to read
// as real laboratory splash goggles: sealed clear cups, a dark silicone gasket,
// vent details, an elastic strap and strap adjusters. The camera overlay mirrors
// the same silhouette without obscuring the crosshair or interaction area.
import * as THREE from 'three';
import { ZONES } from './zones.js';

const HAND_LAYER = 1;

function setLayer(group, layer = HAND_LAYER) {
  group.traverse((node) => {
    if (node.isMesh) node.layers.set(layer);
  });
}

function setShadow(mesh, receive = false) {
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  return mesh;
}

function createLabelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#eaf2f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#173447';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = '#173447';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 50px Arial';
  ctx.fillText('CHEMICAL SPLASH', 256, 66);
  ctx.font = '700 42px Arial';
  ctx.fillText('GOGGLES', 256, 126);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function createPhysicalGoggles() {
  const goggles = new THREE.Group();
  goggles.name = 'Chemical splash goggles';

  const gasketMat = new THREE.MeshStandardMaterial({
    color: 0x162832,
    roughness: 0.48,
    metalness: 0.05,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0xbde7f4,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x274353,
    roughness: 0.72,
    metalness: 0,
  });
  const ventMat = new THREE.MeshStandardMaterial({
    color: 0x0d1b23,
    roughness: 0.62,
  });
  const highlightMat = new THREE.MeshBasicMaterial({
    color: 0xe9fbff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  // Deliberately modest segment counts: this prop is interactive decoration,
  // not a hero asset. Sharing each geometry keeps its memory cost low.
  const ringGeometry = new THREE.TorusGeometry(0.046, 0.0065, 6, 20);
  const lensGeometry = new THREE.SphereGeometry(0.046, 14, 8);
  const bridgeGeometry = new THREE.BoxGeometry(0.03, 0.013, 0.017);
  const ventGeometry = new THREE.CylinderGeometry(0.0032, 0.0032, 0.008, 6);
  const adjusterGeometry = new THREE.BoxGeometry(0.018, 0.02, 0.024);
  const highlightGeometry = new THREE.TorusGeometry(0.036, 0.0018, 4, 14, Math.PI * 0.56);

  for (const side of [-1, 1]) {
    const cup = new THREE.Group();
    cup.position.x = side * 0.052;

    const gasket = setShadow(new THREE.Mesh(ringGeometry, gasketMat));
    gasket.scale.set(1.22, 0.9, 1);
    gasket.position.z = 0.012;
    cup.add(gasket);

    const lens = setShadow(new THREE.Mesh(lensGeometry, lensMat));
    lens.scale.set(1.17, 0.87, 0.42);
    lens.position.z = 0.008;
    cup.add(lens);

    const reflection = new THREE.Mesh(highlightGeometry, highlightMat);
    reflection.scale.set(1.14, 0.84, 1);
    reflection.rotation.z = side * 0.34;
    reflection.position.set(side * 0.003, 0.009, 0.028);
    cup.add(reflection);

    // Two small upper and lower vents give the sealed cup a recognisable
    // chemical-splash-goggle construction without expensive micro-detail.
    for (const y of [-0.027, 0.027]) {
      const vent = setShadow(new THREE.Mesh(ventGeometry, ventMat));
      vent.rotation.x = Math.PI / 2;
      vent.position.set(side * 0.044, y, 0.014);
      cup.add(vent);
    }

    const adjuster = setShadow(new THREE.Mesh(adjusterGeometry, strapMat));
    adjuster.position.set(side * 0.064, 0, -0.004);
    cup.add(adjuster);
    goggles.add(cup);
  }

  const bridge = setShadow(new THREE.Mesh(bridgeGeometry, gasketMat));
  bridge.position.set(0, -0.005, 0.012);
  goggles.add(bridge);

  // The back strap is a single curved tube, making the object legible from both
  // sides while adding only one mesh.
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.116, 0, -0.005),
    new THREE.Vector3(-0.122, 0.022, -0.052),
    new THREE.Vector3(0, 0.034, -0.076),
    new THREE.Vector3(0.122, 0.022, -0.052),
    new THREE.Vector3(0.116, 0, -0.005),
  ]);
  const strap = setShadow(new THREE.Mesh(
    new THREE.TubeGeometry(strapCurve, 18, 0.0048, 6, false),
    strapMat,
  ));
  goggles.add(strap);

  return goggles;
}

function createWornOverlay(camera) {
  const overlay = new THREE.Group();
  overlay.name = 'Worn chemical splash goggles';
  overlay.visible = false;
  camera.add(overlay);

  const frameMat = new THREE.MeshBasicMaterial({
    color: 0x12232d,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
    depthWrite: false,
  });
  const lensMat = new THREE.MeshBasicMaterial({
    color: 0xbfeafa,
    transparent: true,
    opacity: 0.035,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const sheenMat = new THREE.MeshBasicMaterial({
    color: 0xe9fbff,
    transparent: true,
    opacity: 0.22,
    depthTest: false,
    depthWrite: false,
  });

  const frameGeometry = new THREE.TorusGeometry(0.125, 0.009, 6, 22);
  const lensGeometry = new THREE.CircleGeometry(0.123, 22);
  const bridgeGeometry = new THREE.BoxGeometry(0.054, 0.018, 0.012);
  const sheenGeometry = new THREE.TorusGeometry(0.101, 0.0024, 4, 16, Math.PI * 0.55);

  for (const side of [-1, 1]) {
    const lensGroup = new THREE.Group();
    lensGroup.position.set(side * 0.148, 0.056, -0.36);

    const frame = new THREE.Mesh(frameGeometry, frameMat);
    frame.scale.set(1.12, 0.82, 1);
    frame.renderOrder = 20;
    lensGroup.add(frame);

    const lens = new THREE.Mesh(lensGeometry, lensMat);
    lens.scale.set(1.08, 0.78, 1);
    lens.position.z = 0.002;
    lens.renderOrder = 19;
    lensGroup.add(lens);

    const sheen = new THREE.Mesh(sheenGeometry, sheenMat);
    sheen.scale.set(1.08, 0.78, 1);
    sheen.rotation.z = side * 0.36;
    sheen.position.set(side * 0.008, 0.018, 0.004);
    sheen.renderOrder = 21;
    lensGroup.add(sheen);

    overlay.add(lensGroup);
  }

  const bridge = new THREE.Mesh(bridgeGeometry, frameMat);
  bridge.position.set(0, 0.046, -0.355);
  bridge.renderOrder = 21;
  overlay.add(bridge);

  setLayer(overlay);
  return overlay;
}

export function createEyegoggles(scene, camera, interactableObjects, hud) {
  const box = new THREE.Group();
  box.name = 'Goggles dispenser';
  box.position.set(ZONES.ppe.x + 0.5, 1.0, ZONES.ppe.z);
  box.rotation.y = 0.25;
  box.userData = {
    goggleBox: true,
    name: 'Safety goggles',
    description: 'Clear chemical splash goggles protect your eyes from liquid splashes and flying glass.',
  };

  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x376b86,
    roughness: 0.74,
    metalness: 0.03,
  });
  const lidMat = new THREE.MeshStandardMaterial({
    color: 0xeaf2f6,
    roughness: 0.82,
  });
  const slotMat = new THREE.MeshStandardMaterial({
    color: 0x12232d,
    roughness: 0.92,
  });

  const base = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.17), boxMat), true);
  base.position.y = 0.06;
  box.add(base);

  const lid = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.286, 0.012, 0.176), lidMat));
  lid.position.y = 0.126;
  box.add(lid);

  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.004, 0.038), slotMat);
  slot.position.set(0, 0.133, 0.006);
  box.add(slot);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.218, 0.078),
    new THREE.MeshStandardMaterial({ map: createLabelTexture(), roughness: 0.72 }),
  );
  label.position.set(0, 0.066, 0.0865);
  box.add(label);

  const physicalGoggles = createPhysicalGoggles();
  physicalGoggles.position.set(0, 0.18, -0.008);
  physicalGoggles.rotation.x = -0.08;
  box.add(physicalGoggles);

  scene.add(box);
  interactableObjects.push(box);

  const overlay = createWornOverlay(camera);
  let on = false;

  function setOn(value) {
    on = Boolean(value);
    box.visible = !on;
    overlay.visible = on;
    hud.setGoggles(on);
  }

  return {
    get on() {
      return on;
    },
    wear() {
      setOn(true);
    },
    remove() {
      setOn(false);
    },
  };
}
