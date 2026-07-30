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

// A paper label texture for a chemical bottle — same canvas-texture trick
// as the periodic table tiles, just smaller.
function createLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f0e6';                // paper
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#8a2020';              // red border, like real reagent labels
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 120, 88);

  ctx.fillStyle = '#222222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px Arial';
  ctx.fillText(text, 64, 48, 110);          // maxWidth squeezes long names

  return new THREE.CanvasTexture(canvas);
}

// A reagent bottle: cylinder body + neck + cap + paper label.
// labelAngle = which way the label faces (radians around Y).
function createBottle(liquidColor, labelText, labelAngle) {
  const bottle = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.16, 20),
    new THREE.MeshStandardMaterial({ color: liquidColor, roughness: 0.35 })
  );
  body.position.y = 0.08;
  bottle.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.03, 0.04, 20),
    new THREE.MeshStandardMaterial({ color: liquidColor, roughness: 0.35 })
  );
  neck.position.y = 0.18;
  bottle.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.025, 20),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 })
  );
  cap.position.y = 0.21;
  bottle.add(cap);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.05),
    new THREE.MeshStandardMaterial({ map: createLabelTexture(labelText) })
  );
  // 1 mm off the body surface so it doesn't "z-fight" (flicker) with it
  label.position.set(Math.sin(labelAngle) * 0.046, 0.09, Math.cos(labelAngle) * 0.046);
  label.rotation.y = labelAngle;
  bottle.add(label);

  return bottle;
}

// Two wall shelves with a row of labeled chemical bottles each.
function createShelves(scene, interactableObjects) {
  const shelves = new THREE.Group();
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xb0a58f, roughness: 0.8 });

  // Shelf boards: 2.4 m long ALONG the left wall (so long side is z)
  for (const yPos of [1.4, 1.75]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 2.4), boardMat);
    board.position.set(-6.85, yPos, -1);
    board.castShadow = true;
    board.receiveShadow = true;
    shelves.add(board);
  }

  // Bottles: name + liquid color. Labels face +x (into the room).
  const chemicals = [
    ['HCl',     0xf0e68c], ['NaOH',    0xf5f5f5], ['H₂SO₄', 0xf7e8b0], ['CuSO₄', 0x2e86c1],
    ['KMnO₄', 0x6c3483], ['Ethanol', 0xd5f5e3], ['NaCl',    0xffffff], ['Acetone', 0xd6eaf8]
  ];
  const labelAngle = Math.PI / 2;           // face +x = into the room

  chemicals.forEach(([name, color], i) => {
    const shelfY = i < 4 ? 1.415 : 1.765;   // first 4 on lower board, rest on top
    const zPos = -1.9 + (i % 4) * 0.6;
    const bottle = createBottle(color, name, labelAngle);
    bottle.position.set(-6.85, shelfY, zPos);
    shelves.add(bottle);
  });

  shelves.userData = {
    name: 'Chemical Shelf',
    description: 'Reagent bottles used in experiments: acids like HCl and H₂SO₄, bases like NaOH, and salts like CuSO₄ (blue) and KMnO₄ (purple). Always read the label before use!'
  };
  scene.add(shelves);
  interactableObjects.push(shelves);
}

// ---------- put it all together ----------
export function createFurniture(scene, interactableObjects, colliders) {
  const TOP = 0.9;   // bench worktop height in meters

  createShelves(scene, interactableObjects);

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

  // "Walk-up spots": where a proximity info card should float, and what it
  // says. main.js hands these to interactions.addProximityPanel().
  // Anchors sit ~0.5 m above/beside their object, at comfortable reading height.
  return {
    proximitySpots: [
      {
        position: new THREE.Vector3(0, 1.7, -1.5),
        title: 'Lab Bench',
        description: islandBench.userData.description,
        radius: 2.5
      },
      {
        position: new THREE.Vector3(6.3, 1.7, 2),
        title: 'Fire Extinguisher',
        description: 'A fire extinguisher puts out small fires by spraying a pressurized agent. In a chemistry lab it hangs near the door, ready for burner or chemical fires.',
        radius: 2.5
      },
      {
        position: new THREE.Vector3(-6.2, 1.9, -1),
        title: 'Chemical Shelf',
        description: 'Reagent bottles used in experiments: acids like HCl and H2SO4, bases like NaOH, and colorful salts like CuSO4 and KMnO4. Always read the label before use!',
        radius: 2.5
      }
    ]
  };
}
