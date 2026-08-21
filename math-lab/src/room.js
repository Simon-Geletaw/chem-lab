// room.js — the physical room: floor, walls, ceiling, window, exit, signs.
// Delegates to modular builders (lights.js, textures.js, signs.js) so all
// visual parameters come from room.json. Keeps only geometry assembly here.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getRoom, getGeometry, getWallPaint, getSky, getExit, getHazard } from './registry.js';
import { createLights, rebuildFixtureLights } from './lights.js';
import { createExitSign, createStationSigns } from './signs.js';
import {
  createFloorTexture,
  createWallTexture,
  makeWallTexture,
  paintBandMat,
  createTrimMaterial,
  createSkyTexture,
  createHazardStripeMaterial,
  createGlassMaterial
} from './textures.js';

export function createRoom(scene, interactableObjects) {
  const room = getRoom() || {};
  const geometry = getGeometry();
  const paint = getWallPaint() || {
    upper: '#d3d4d3', dado: '#82a1b4', break: '#7d8f9b', ceiling: '#d3d4d3', trim: '#f4f6f8'
  };

  // ---- Lighting (delegated) ----
  const lights = createLights(scene);

  // ---- Geometry: floor ----
  const halfW = geometry.width / 2;
  const halfD = geometry.depth / 2;
  const wallH = geometry.height;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(geometry.width, geometry.depth),
    new THREE.MeshStandardMaterial({
      map: createFloorTexture(),
      roughness: 0.5,
      metalness: 0.05
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- Walls: shared painted texture ----
  const wallCanvas = createWallTexture();
  const wallTex = makeWallTexture(wallCanvas);
  wallTex.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.9,
    metalness: 0.0
  });

  // Back wall
  const backwall = new THREE.Mesh(new THREE.PlaneGeometry(geometry.width, wallH), wallMat);
  backwall.position.set(0, wallH / 2, -halfD);
  backwall.receiveShadow = true;
  scene.add(backwall);

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(geometry.depth, wallH), wallMat);
  leftWall.position.set(-halfW, wallH / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall — window opening (sill 0.8, top 2.3, centered at z=0, width 1.7)
  const windowWidth = 1.7;
  const windowSill = 0.8;
  const windowTop = 2.3;
  const sidePanelZ = (geometry.depth - windowWidth) / 2; // distance from corner to window edge

  // Panel 1: below window opening (z: -halfD .. -windowWidth/2)
  const rightWallPanel1 = new THREE.Mesh(new THREE.PlaneGeometry(geometry.depth - windowWidth, wallH), wallMat);
  rightWallPanel1.position.set(halfW, wallH / 2, -sidePanelZ / 2);
  rightWallPanel1.rotation.y = -Math.PI / 2;
  rightWallPanel1.receiveShadow = true;
  scene.add(rightWallPanel1);

  // Panel 2: above window opening (z: windowWidth/2 .. halfD)
  const rightWallPanel2 = new THREE.Mesh(new THREE.PlaneGeometry(geometry.depth - windowWidth, wallH), wallMat);
  rightWallPanel2.position.set(halfW, wallH / 2, sidePanelZ / 2);
  rightWallPanel2.rotation.y = -Math.PI / 2;
  rightWallPanel2.receiveShadow = true;
  scene.add(rightWallPanel2);

  // Paint band helper for top/bottom window bands
  const makeBand = (y0, y1, width) => {
    const mat = paintBandMat(y0, y1, wallCanvas);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, y1 - y0), mat);
    mesh.position.set(halfW, (y0 + y1) / 2, 0);
    mesh.rotation.y = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  // Top band (lintel)
  makeBand(windowTop, wallH, windowWidth);

  // Bottom band (sill wall)
  makeBand(0, windowSill, windowWidth);

  // Front wall
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(geometry.width, wallH), wallMat);
  frontWall.position.set(0, wallH / 2, halfD);
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(geometry.width, geometry.depth),
    new THREE.MeshStandardMaterial({ color: hexToColor(paint.ceiling), roughness: 0.9 })
  );
  ceiling.position.set(0, wallH, 0);
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  // Ceiling cornice (trim)
  const trimMat = createTrimMaterial();
  const corniceRun = (len, px, py, pz, rx, ry, rz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.04), trimMat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    scene.add(m);
  };
  const trimOverhang = 0.15;
  corniceRun(geometry.width + trimOverhang * 2, 0, wallH - 0.03, -halfD + 0.01, 0, 0, 0);   // back
  corniceRun(geometry.width + trimOverhang * 2, 0, wallH - 0.03, halfD - 0.01, 0, 0, 0);    // front
  corniceRun(geometry.depth + trimOverhang * 2, -halfW + 0.01, wallH - 0.03, 0, 0, Math.PI / 2, 0);  // left
  corniceRun(geometry.depth + trimOverhang * 2, halfW - 0.01, wallH - 0.03, 0, 0, -Math.PI / 2, 0);  // right

  // Exit door (from JSON)
  const exit = getExit();
  const exitDoor = new THREE.Group();
  exitDoor.userData.exitDoor = true;
  exitDoor.userData.exitPos = new THREE.Vector3(...exit.doorPos);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.1, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.6, metalness: 0.3 })
  );
  door.position.set(exit.doorPos[0], 1.05, exit.doorPos[1]);
  door.castShadow = true;
  exitDoor.add(door);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.3, metalness: 0.9 })
  );
  handle.position.set(exit.doorPos[0] - 0.35, 1.05, exit.doorPos[1] - 0.05);
  exitDoor.add(handle);

  scene.add(exitDoor);
  interactableObjects.push(exitDoor);

  // Exit sign (delegated)
  createExitSign(scene);

  // Hazard stripes (from JSON)
  const hazard = getHazard();
  const stripeH = hazard.height;

  // Back stripe
  const backStripe = new THREE.Mesh(
    new THREE.PlaneGeometry(geometry.width, stripeH),
    createHazardStripeMaterial(geometry.width)
  );
  backStripe.position.set(0, stripeH / 2, -halfD + 0.01);
  scene.add(backStripe);

  // Left stripe (full depth)
  const leftStripe = new THREE.Mesh(
    new THREE.PlaneGeometry(geometry.depth, stripeH),
    createHazardStripeMaterial(geometry.depth)
  );
  leftStripe.position.set(-halfW + 0.01, stripeH / 2, 0);
  leftStripe.rotation.y = Math.PI / 2;
  scene.add(leftStripe);

  // Right stripes — split around window
  const rightStripe1 = new THREE.Mesh(
    new THREE.PlaneGeometry(sidePanelZ, stripeH),
    createHazardStripeMaterial(sidePanelZ)
  );
  rightStripe1.position.set(halfW - 0.01, stripeH / 2, -halfD + sidePanelZ / 2);
  rightStripe1.rotation.y = -Math.PI / 2;
  scene.add(rightStripe1);

  const rightStripe0 = new THREE.Mesh(
    new THREE.PlaneGeometry(windowWidth, stripeH),
    createHazardStripeMaterial(windowWidth)
  );
  rightStripe0.position.set(halfW - 0.01, stripeH / 2, 0);
  rightStripe0.rotation.y = -Math.PI / 2;
  scene.add(rightStripe0);

  const rightStripe2 = new THREE.Mesh(
    new THREE.PlaneGeometry(sidePanelZ, stripeH),
    createHazardStripeMaterial(sidePanelZ)
  );
  rightStripe2.position.set(halfW - 0.01, stripeH / 2, halfD - sidePanelZ / 2);
  rightStripe2.rotation.y = -Math.PI / 2;
  scene.add(rightStripe2);

  // Window (GLB model + glass panes + sky)
  const skyConfig = getSky();
  const windowGltf = new GLTFLoader();
  const windowUrl = `${import.meta.env.BASE_URL}Models/window.glb`;
  let resolveWindowReady;
  const windowReady = new Promise((resolve) => { resolveWindowReady = resolve; });

  const glassMat = createGlassMaterial();
  const addGlassPanes = () => {
    for (const [zx, zw] of [[-0.345, 0.69], [0.39, 0.68]]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(zw, windowTop - windowSill), glassMat);
      pane.position.set(halfW - 0.015, (windowSill + windowTop) / 2, zx);
      pane.rotation.y = Math.PI / 2;
      scene.add(pane);
    }
  };

  windowGltf.load(
    windowUrl,
    (gltf) => {
      const win = gltf.scene;
      const box0 = new THREE.Box3().setFromObject(win);
      const s0 = box0.getSize(new THREE.Vector3());
      win.scale.set(windowWidth / s0.x, (windowTop - windowSill) / s0.y, 0.15 / s0.z);
      win.rotation.y = Math.PI / 2;
      const box = new THREE.Box3().setFromObject(win);
      win.position.set(
        halfW - 0.04 - box.min.x,
        windowSill - box.min.y,
        -box.getCenter(new THREE.Vector3()).z
      );
      win.traverse((n) => {
        if (!n.isMesh) return;
        n.castShadow = true;
        n.receiveShadow = true;
        if (n.material.name === 'metal_blanco') n.material.color.set(0x9aa5ad);
        else if (n.material.name === 'Glass_Crystal') n.visible = false;
      });
      addGlassPanes();
      scene.add(win);
      resolveWindowReady();
    },
    undefined,
    (err) => {
      console.error('FAILED to load window.glb — using fallback frame', err);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x9aa5ad, roughness: 0.5, metalness: 0.4 });
      const jamb = (z, y, h) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.14), frameMat);
        m.position.set(halfW - 0.035, y, z);
        m.castShadow = true;
        scene.add(m);
      };
      jamb(-windowWidth / 2, (windowSill + windowTop) / 2, windowTop - windowSill);
      jamb(windowWidth / 2, (windowSill + windowTop) / 2, windowTop - windowSill);
      const rail = (y, h) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, windowWidth + 0.18), frameMat);
        m.position.set(halfW - 0.035, y, 0);
        m.castShadow = true;
        scene.add(m);
      };
      rail(windowTop, 0.06);
      rail(windowSill, 0.06);
      addGlassPanes();
      resolveWindowReady();
    }
  );

  // Sky plane (outside the wall)
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(...skyConfig.size),
    new THREE.MeshBasicMaterial({ map: createSkyTexture(), color: 0xffffff, transparent: true, opacity: skyConfig.opacity })
  );
  sky.position.set(...skyConfig.position);
  sky.rotation.y = -Math.PI / 2;
  scene.add(sky);

  // AIT logo (fixed position on right wall, z = -2.5)
  const logoTex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}Logo/AIT%20logo%20.png`);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.96), logoMat);
  logo.position.set(halfW - 0.06, 1.7, -2.5);
  logo.rotation.y = -Math.PI / 2;
  scene.add(logo);

  // Station signs (delegated)
  createStationSigns(scene);

  return { ...lights, windowReady, dirLight: lights.dir, fixtureLights: lights.fixtureLights };
}

function hexToColor(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.startsWith('#')) return parseInt(v.slice(1), 16);
  return 0xffffff;
}