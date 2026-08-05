// furniture.js — everything that stands IN the room: lab benches,
// glassware, and the downloaded GLB models (table, burner, beaker, extinguisher).
//
// Key idea: THREE.Group. We build furniture out of simple boxes/cylinders
// positioned in LOCAL coordinates (as if the bench stood at 0,0,0), add them
// to a Group, then place/rotate the WHOLE group once. Children follow along.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ZONES } from './zones.js';

const loader = new GLTFLoader();

// ---------- shared materials (create once, reuse everywhere) ----------
const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x6b7a87, roughness: 0.8 });
const worktopMat = new THREE.MeshStandardMaterial({ color: 0x5f6870, roughness: 0.4, metalness: 0.1 });
const woodMat    = new THREE.MeshStandardMaterial({ color: 0x9c7b4f, roughness: 0.8 });
// "Glass": MeshPhysicalMaterial.transmission is REAL refraction — it renders
// the scene behind the glass through the material (IOR 1.5 = borosilicate).
// The old opacity-only MeshStandardMaterial looked like frosted plastic.
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xe8f4ff,
  metalness: 0,
  roughness: 0.05,
  transmission: 1,
  thickness: 0.04,
  ior: 1.5,
  clearcoat: 1,
  transparent: true,
  opacity: 1,
  side: THREE.DoubleSide,
  depthWrite: false
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

  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.95, 0.6), cabinetMat);
  cabinet.position.y = 0.475;               // half its height -> sits on floor
  bench.add(cabinet);

  const worktop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, 0.7), worktopMat);
  worktop.position.y = 0.975;               // 0.95 cabinet + half of 0.05 = 1.0 m worktop
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
// as the periodic table tiles, just smaller. Dark navy + white text so the
// formula stays readable from across the room (and matches the poster board).
function createLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';                // high-contrast white background
  ctx.fillRect(0, 0, 256, 192);
  ctx.strokeStyle = '#000000';              // bold black border
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 182);

  ctx.fillStyle = '#000000';                // solid black text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 72px Arial';
  ctx.fillText(text, 128, 96, 230);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

// A hanging station sign: dark board + white text, hung above each workflow
// station so the three-step lab flow is readable from across the room.
function createStationSign(scene, text, position, rotationY) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#22303c';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#9fc5e8';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 48, 500);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.3),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas) })
  );
  sign.position.set(position.x, position.y, position.z);
  sign.rotation.y = rotationY;
  scene.add(sign);
}

// A grainy canvas texture for powder chemicals: base color + speckles of
// slightly lighter/darker shade, so the bottle reads "crystals", not liquid.
function makePowderTexture(baseColor) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 128);
  const col = new THREE.Color(baseColor);
  for (let i = 0; i < 2000; i++) {
    const k = 0.75 + Math.random() * 0.5;          // ±25% lightness per grain
    g.fillStyle = `rgb(${Math.min(255, col.r * 255 * k) | 0},${Math.min(255, col.g * 255 * k) | 0},${Math.min(255, col.b * 255 * k) | 0})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random(), 1 + Math.random());
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

// A reagent bottle: cylinder body + neck + cap + paper label.
// chem = the full chemical object (color, state); labelAngle = label facing.
// Powder chemicals (state 'powder') get a matte granular body — salts are
// crystals in a jar, not glossy liquid.
function createBottle(chem, labelText, labelAngle) {
  const bottle = new THREE.Group();
  const liquidColor = chem.color;
  const isPowder = chem.state === 'powder';

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.16, 20),
    isPowder
      ? new THREE.MeshStandardMaterial({ map: makePowderTexture(liquidColor), roughness: 0.95 })
      : new THREE.MeshStandardMaterial({ color: liquidColor, roughness: 0.35 })
  );
  body.position.y = 0.08;
  bottle.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.03, 0.04, 20),
    new THREE.MeshStandardMaterial({ color: liquidColor, roughness: isPowder ? 0.95 : 0.35 })
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
//
// PHASE 1 REFACTOR: the chemical list used to be hard-coded right here. Now it
// arrives as data (from server/data/chemicals.json via chemistry/registry.js).
// Same visuals, different SOURCE — that one change is what lets a teacher add a
// chemical without a programmer (book Ch 4).
function createShelves(scene, interactableObjects, chemicals) {
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

  const labelAngle = Math.PI / 2;           // face +x = into the room
  const PER_BOARD = 5;                      // wraps to the upper board after 5

  chemicals.forEach((chem, i) => {
    const shelfY = i < PER_BOARD ? 1.415 : 1.765;
    const zPos = -1.9 + (i % PER_BOARD) * 0.5;

    // The label shows the short formula; the full name lives in userData.
    const bottle = createBottle(chem, chem.formula, labelAngle);
    bottle.position.set(-6.85, shelfY, zPos);

    // The identity card the hand system reads (book Ch 2.1 pattern #2).
    // homePosition is where Q sends the bottle back to.
    bottle.userData = {
      chemicalId: chem.id,
      isBottle: true,
      name: chem.name,
      description: chem.description,
      homePosition: bottle.position.clone()
    };

    shelves.add(bottle);
    interactableObjects.push(bottle);       // so the crosshair can find it
  });

  shelves.userData = {
    name: 'Chemical Shelf',
    description: 'Reagent bottles used in experiments: acids like HCl and H₂SO₄, bases like NaOH, and salts like CuSO₄ (blue) and KMnO₄ (purple). Always read the label before use!'
  };
  scene.add(shelves);
  interactableObjects.push(shelves);
}

// ---------- put it all together ----------
export function createFurniture(scene, interactableObjects, colliders, shelfChemicals) {
  const TOP = 1.0;   // bench worktop height in meters

  createShelves(scene, interactableObjects, shelfChemicals);

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

  // PPE station by the door: gloves + mask boxes live on this table, and the
  // 'ppe' zone gates where they can be put on/taken off.
  const ppeBench = createBench(ZONES.ppe.x, ZONES.ppe.z, 0);
  ppeBench.userData = {
    name: 'PPE Station',
    description: 'Personal protective equipment: nitrile gloves and face masks. Put both on HERE before handling hazardous chemicals, and take them off here before leaving.'
  };
  scene.add(ppeBench);
  interactableObjects.push(ppeBench);
  colliders.push(new THREE.Box3().setFromObject(ppeBench));

  // Station signs — the workflow is readable from anywhere in the room.
  createStationSign(scene, 'PPE STATION', new THREE.Vector3(ZONES.ppe.x, 2.3, ZONES.ppe.z), Math.PI);
  createStationSign(scene, 'CHEMICAL STORAGE', new THREE.Vector3(-6.85, 2.35, -1), Math.PI / 2);
  createStationSign(scene, 'REACTION BENCH', new THREE.Vector3(0, 2.3, -1.5), 0);

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
      },
      {
        position: new THREE.Vector3(ZONES.ppe.x, 1.7, ZONES.ppe.z),
        title: 'PPE Station',
        description: 'Personal protective equipment: nitrile gloves and face masks. Put both on here before handling hazardous chemicals.',
        radius: 2.2
      }
    ]
  };
}
