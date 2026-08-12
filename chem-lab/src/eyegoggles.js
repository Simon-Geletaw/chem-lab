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

function roundedRectShape(width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const r = Math.min(radius, halfWidth, halfHeight);
  const shape = new THREE.Shape();

  shape.moveTo(-halfWidth + r, -halfHeight);
  shape.lineTo(halfWidth - r, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + r);
  shape.lineTo(halfWidth, halfHeight - r);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - r, halfHeight);
  shape.lineTo(-halfWidth + r, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - r);
  shape.lineTo(-halfWidth, -halfHeight + r);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + r, -halfHeight);
  return shape;
}

function roundedFrameShape(width, height, radius, thickness) {
  const shape = roundedRectShape(width, height, radius);
  shape.holes.push(roundedRectShape(
    width - thickness * 2,
    height - thickness * 2,
    Math.max(radius - thickness, 0.002),
  ));
  return shape;
}

function createPhysicalGoggles() {
  const goggles = new THREE.Group();
  goggles.name = 'Clear indirect-vent chemical splash goggles';

  // The reference form is a single, wide clear lens with a flexible blue body,
  // shaped nose bridge, upper indirect vents, and a separate elastic headband.
  const flexibleFrameMat = new THREE.MeshPhysicalMaterial({
    // Industrial clear polycarbonate: nearly colourless body, cool edge tint,
    // crisp clearcoat and low roughness rather than an opaque blue rubber look.
    color: 0xb8d8e6,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 0.86,
    clearcoatRoughness: 0.07,
    ior: 1.49,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const gasketMat = new THREE.MeshStandardMaterial({
    // The face-contact shroud remains soft and matte, contrasting with the
    // clear polycarbonate structure without looking like a heavy dark frame.
    color: 0x465963,
    roughness: 0.78,
    metalness: 0,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5fcff,
    roughness: 0.025,
    metalness: 0,
    clearcoat: 0.92,
    clearcoatRoughness: 0.03,
    ior: 1.49,
    transparent: true,
    opacity: 0.10,
    depthWrite: false,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x171b1e,
    roughness: 0.92,
    metalness: 0,
  });
  const accentMat = new THREE.MeshBasicMaterial({
    color: 0xf5fdff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  // One wide frame is more recognisable as chemical-splash PPE than two round
  // eye cups. The modest curve/segment counts preserve performance.
  const gasketGeometry = new THREE.ExtrudeGeometry(
    roundedFrameShape(0.226, 0.112, 0.028, 0.012),
    { depth: 0.008, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1, curveSegments: 8 },
  );
  const frameGeometry = new THREE.ExtrudeGeometry(
    roundedFrameShape(0.238, 0.124, 0.032, 0.010),
    { depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 8 },
  );
  const lensGeometry = new THREE.ShapeGeometry(roundedRectShape(0.210, 0.096, 0.023), 8);
  const ventGeometry = new THREE.BoxGeometry(0.011, 0.003, 0.005);
  const adjusterGeometry = new THREE.BoxGeometry(0.018, 0.022, 0.024);

  const gasket = setShadow(new THREE.Mesh(gasketGeometry, gasketMat));
  gasket.position.set(0, 0, 0.002);
  goggles.add(gasket);

  const frame = setShadow(new THREE.Mesh(frameGeometry, flexibleFrameMat));
  frame.position.z = 0.009;
  goggles.add(frame);

  const lens = new THREE.Mesh(lensGeometry, lensMat);
  lens.position.z = 0.022;
  goggles.add(lens);

  // A restrained top row communicates indirect ventilation without creating
  // expensive micro-geometry or breaking the sealed-goggle silhouette.
  for (const x of [-0.074, -0.037, 0, 0.037, 0.074]) {
    const vent = setShadow(new THREE.Mesh(ventGeometry, gasketMat));
    vent.position.set(x, 0.054, 0.022);
    goggles.add(vent);
  }

  for (const side of [-1, 1]) {
    const adjuster = setShadow(new THREE.Mesh(adjusterGeometry, strapMat));
    adjuster.position.set(side * 0.131, 0, 0.004);
    goggles.add(adjuster);

    const reflection = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.004), accentMat);
    reflection.position.set(side * 0.065, 0.026, 0.024);
    reflection.rotation.z = side * 0.28;
    goggles.add(reflection);
  }

  const noseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.032, -0.036, 0.023),
    new THREE.Vector3(-0.014, -0.050, 0.023),
    new THREE.Vector3(0, -0.054, 0.023),
    new THREE.Vector3(0.014, -0.050, 0.023),
    new THREE.Vector3(0.032, -0.036, 0.023),
  ]);
  goggles.add(setShadow(new THREE.Mesh(
    new THREE.TubeGeometry(noseCurve, 10, 0.0038, 4, false),
    gasketMat,
  )));

  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.139, 0, 0.002),
    new THREE.Vector3(-0.145, 0.032, -0.052),
    new THREE.Vector3(0, 0.048, -0.082),
    new THREE.Vector3(0.145, 0.032, -0.052),
    new THREE.Vector3(0.139, 0, 0.002),
  ]);
  goggles.add(setShadow(new THREE.Mesh(
    new THREE.TubeGeometry(strapCurve, 18, 0.0055, 6, false),
    strapMat,
  )));

  return goggles;
}

function createWornOverlay(camera) {
  const overlay = new THREE.Group();
  overlay.name = 'Worn clear splash goggles — natural peripheral view';
  overlay.visible = false;
  camera.add(overlay);

  // A clear industrial goggle lens is effectively invisible in normal use. The
  // remaining cue is a soft near-face seal at the extreme outer field of view,
  // not a coloured visor, a rectangular HUD, or a prominent central bridge.
  const outerSealMat = new THREE.MeshBasicMaterial({
    color: 0x9dc9dc,
    transparent: true,
    opacity: 0.15,
    depthTest: false,
    depthWrite: false,
  });
  const noseSealMat = new THREE.MeshBasicMaterial({
    color: 0x617982,
    transparent: true,
    opacity: 0.15,
    depthTest: false,
    depthWrite: false,
  });

  function addSeal(points, radius, material, order) {
    const curve = new THREE.CatmullRomCurve3(points);
    const seal = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 10, radius, 4, false),
      material,
    );
    seal.renderOrder = order;
    overlay.add(seal);
  }

  // Only the inner tips of these outer-corner segments enter the visible frame.
  // Their distant placement makes the seals feel attached to the face instead
  // of hovering in front of the player.
  addSeal([
    new THREE.Vector3(-0.73, 0.27, -0.78),
    new THREE.Vector3(-0.66, 0.31, -0.78),
    new THREE.Vector3(-0.58, 0.335, -0.78),
    new THREE.Vector3(-0.49, 0.338, -0.78),
  ], 0.0039, outerSealMat, 20);
  addSeal([
    new THREE.Vector3(0.73, 0.27, -0.78),
    new THREE.Vector3(0.66, 0.31, -0.78),
    new THREE.Vector3(0.58, 0.335, -0.78),
    new THREE.Vector3(0.49, 0.338, -0.78),
  ], 0.0039, outerSealMat, 20);

  // One fine curve per side replaces the former doubled dark edge. The lower
  // endpoint remains beyond the active work area and stays visually quiet.
  for (const side of [-1, 1]) {
    addSeal([
      new THREE.Vector3(side * 0.73, 0.27, -0.78),
      new THREE.Vector3(side * 0.755, 0.10, -0.78),
      new THREE.Vector3(side * 0.754, -0.10, -0.78),
      new THREE.Vector3(side * 0.700, -0.265, -0.78),
    ], 0.0042, outerSealMat, 20);
  }

  // The nose contact is lower, shorter, thinner and more transparent than the
  // previous bridge; it acts as a natural near-focus silhouette only on glance.
  addSeal([
    new THREE.Vector3(-0.045, -0.337, -0.78),
    new THREE.Vector3(-0.022, -0.357, -0.78),
    new THREE.Vector3(0, -0.363, -0.78),
    new THREE.Vector3(0.022, -0.357, -0.78),
    new THREE.Vector3(0.045, -0.337, -0.78),
  ], 0.0033, noseSealMat, 21);

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
    // The dispenser remains at the PPE station; only the displayed pair is
    // removed while the player is wearing it, then restored when returned.
    physicalGoggles.visible = !on;
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
