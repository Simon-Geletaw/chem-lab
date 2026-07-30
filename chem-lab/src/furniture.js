// furniture.js — everything that stands IN the room: lab benches,
// glassware, and the downloaded GLB models (table, burner, beaker, extinguisher).
//
// Key idea: THREE.Group. We build furniture out of simple boxes/cylinders
// positioned in LOCAL coordinates (as if the bench stood at 0,0,0), add them
// to a Group, then place/rotate the WHOLE group once. Children follow along.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// ---------- shared materials (create once, reuse everywhere) ----------
const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x3a4750, roughness: 0.8 });
const worktopMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.3, metalness: 0.1 });
const woodMat    = new THREE.MeshStandardMaterial({ color: 0x9c7b4f, roughness: 0.8 });
// "Glass": see-through by lowering opacity. (Real refraction glass exists —
// MeshPhysicalMaterial.transmission — but this is cheaper and looks fine here.)
const glassMat = new THREE.MeshStandardMaterial({
  color: 0xdfefff,
  transparent: true,
  opacity: 0.35,
  roughness: 0.1
});

// ---------- GLB loader (moved from main.js) ----------
// desiredHeight = how tall the object should be IN METERS.
// GLB files use random unit sizes, so we measure with Box3 and
// compute scale = desiredHeight / naturalHeight -> exact real-world size.
export function loadModel(scene, interactableObjects, url, position, desiredHeight, name, description, onLoad) {
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;

      let box = new THREE.Box3().setFromObject(model);
      let size = box.getSize(new THREE.Vector3());

      const scale = desiredHeight / size.y;
      model.scale.set(scale, scale, scale);

      // Re-measure AFTER scaling, then lift so its FEET sit exactly at position.y
      box = new THREE.Box3().setFromObject(model);
      model.position.set(position.x, position.y - box.min.y, position.z);

      size = box.getSize(new THREE.Vector3());
      console.log(name, '→', size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2), 'meters');

      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      model.userData = { name, description };
      scene.add(model);
      interactableObjects.push(model);

      if (onLoad) onLoad(model, new THREE.Box3().setFromObject(model));
    },
    undefined,
    (error) => console.error('FAILED to load', url, error)
  );
}

// ---------- procedural furniture pieces ----------

// A lab bench: storage cabinet + thin black "epoxy resin" worktop.
// Worktop surface ends up at y = 0.9 m (real lab bench height).
function createBench(x, z, rotationY) {
  const bench = new THREE.Group();

  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 0.6), cabinetMat);
  cabinet.position.y = 0.425;               // half its height -> sits on floor
  bench.add(cabinet);

  const worktop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, 0.7), worktopMat);
  worktop.position.y = 0.875;               // 0.85 cabinet + half of 0.05
  bench.add(worktop);

  bench.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });

  bench.position.set(x, 0, z);
  bench.rotation.y = rotationY;
  return bench;
}

// An Erlenmeyer-ish flask: squashed glass sphere + neck + colored liquid inside.
function createFlask(liquidColor) {
  const flask = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), glassMat);
  body.scale.y = 0.9;                       // slightly squashed = flask-like
  body.position.y = 0.055;
  flask.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 16), glassMat);
  neck.position.y = 0.13;
  flask.add(neck);

  // The liquid: a smaller OPAQUE sphere inside the glass one
  const liquid = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 24, 16),
    new THREE.MeshStandardMaterial({ color: liquidColor, roughness: 0.4 })
  );
  liquid.scale.y = 0.55;                    // half-full
  liquid.position.y = 0.035;
  flask.add(liquid);

  return flask;
}

// A wooden rack holding 5 test tubes with alternating liquid colors.
function createTestTubeRack() {
  const rack = new THREE.Group();

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.08), woodMat);
  bar.position.y = 0.09;
  rack.add(bar);

  for (const side of [-0.14, 0.14]) {       // two end supports
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.08), woodMat);
    leg.position.set(side, 0.045, 0);
    rack.add(leg);
  }

  const tubeColors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6];
  tubeColors.forEach((color, i) => {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 12), glassMat);
    tube.position.set(-0.1 + i * 0.05, 0.1, 0);
    rack.add(tube);

    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.04, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
    );
    liquid.position.set(-0.1 + i * 0.05, 0.075, 0);
    rack.add(liquid);
  });

  return rack;
}

// ---------- put it all together ----------
export function createFurniture(scene, interactableObjects, colliders) {
  const TOP = 0.9;   // bench worktop height in meters

  // Island bench in the middle of the room — the main workstation
  const islandBench = createBench(0, -1.5, 0);
  islandBench.userData = {
    name: 'Lab Bench',
    description: 'The main laboratory workbench. Its black epoxy resin worktop resists chemicals, heat and scratches. Experiments with the Bunsen burner and glassware happen here.'
  };
  scene.add(islandBench);
  interactableObjects.push(islandBench);
  colliders.push(new THREE.Box3().setFromObject(islandBench));

  // Second bench along the left wall
  const wallBench = createBench(-6.55, -1, Math.PI / 2);
  wallBench.userData = {
    name: 'Side Bench',
    description: 'A wall-side bench used for preparing samples and storing glassware during experiments.'
  };
  scene.add(wallBench);
  interactableObjects.push(wallBench);
  colliders.push(new THREE.Box3().setFromObject(wallBench));

  // Glassware ON the island bench (positions in world coords, y = worktop)
  const flask1 = createFlask(0x2ecc71);           // green liquid
  flask1.position.set(0.8, TOP, -1.35);
  scene.add(flask1);

  const flask2 = createFlask(0x3498db);           // blue liquid
  flask2.position.set(-0.75, TOP, -1.65);
  scene.add(flask2);

  const rack = createTestTubeRack();
  rack.position.set(1.15, TOP, -1.65);
  scene.add(rack);

  // Glassware on the wall bench
  const flask3 = createFlask(0xe67e22);           // orange liquid
  flask3.position.set(-6.55, TOP, -0.3);
  scene.add(flask3);

  const rack2 = createTestTubeRack();
  rack2.rotation.y = Math.PI / 2;
  rack2.position.set(-6.55, TOP, -1.6);
  scene.add(rack2);

  // --- Downloaded GLB models ---
  // Burner + beaker now live on the ISLAND BENCH worktop.
  loadModel(scene, interactableObjects, '/Models/bunsen_burner.glb', { x: 0.3, y: TOP, z: -1.5 }, 0.15, 'Bunsen Burner',
    'A Bunsen burner is a common piece of laboratory equipment that produces a single open gas flame, used for heating, sterilization, and combustion.');

  loadModel(scene, interactableObjects, '/Models/beaker.glb', { x: -0.3, y: TOP, z: -1.5 }, 0.12, 'Beaker',
    'A beaker is a simple container for stirring, mixing and heating liquids commonly used in many laboratories.');

  // The folding table becomes a storage table in the back-right corner.
  loadModel(scene, interactableObjects, '/Models/folding_table.glb', { x: 5, y: 0, z: -4 }, 0.74, 'Folding Table',
    'A folding table used as extra storage space. It can be collapsed and stored away when not in use.',
    (tableModel) => {
      colliders.push(new THREE.Box3().setFromObject(tableModel));
    });

  loadModel(scene, interactableObjects, '/Models/FireEx.glb', { x: 6.85, y: 1.0, z: 2 }, 0.55, 'Fire Extinguisher',
    'A fire extinguisher is a device used to put out small fires. It contains a pressurized agent that is sprayed onto the fire to extinguish it.',
    (model) => {
      model.rotation.y = -Math.PI / 2;   // turn it to face into the room
    });

  // Red mounting backplate so the extinguisher reads as "wall-mounted"
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.7, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.5 })
  );
  bracket.position.set(6.97, 1.3, 2);
  scene.add(bracket);
}
