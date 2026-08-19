// room.js — the physical room: floor, walls, ceiling, lights.
// Pattern: an "init function" that receives what it needs (the scene),
// builds its part of the world, and returns anything others might need.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { quality } from './quality.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


function createFloorTexture() {
  const SIZE = 1024;   // higher-res canvas: tighter, crisper details
  const TILE = 128;    // px per tile  → 8×8 tiles per canvas, 0.5 m each
  const GRID = SIZE / TILE;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // 1. Grout bed — the whole canvas starts as the seam color, then each tile is
  //    drawn inset on top, so the grout lines are crisp and uniform width.
  ctx.fillStyle = '#a6a398';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const HALF_GROUT = 5;  // px inset per tile edge → 10 px seams (real ~1 cm grout)

  // 2. Individual ceramic tiles. No two tiles are the same shade: each gets a
  //    random base-tone variation, then a soft diagonal bevel gradient (lighter
  //    top-left → darker bottom-right) so every tile catches light like real
  //    glazed ceramic, plus a faint internal speckle to break glassy flatness.
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const v = 0.96 + Math.random() * 0.08;              // per-tile tone lottery
      const r = Math.round(0xd9 * v);
      const g = Math.round(0xd6 * v);
      const b = Math.round(0xcc * v);
      const x = col * TILE + HALF_GROUT;
      const y = row * TILE + HALF_GROUT;
      const w = TILE - HALF_GROUT * 2;

      const bevel = ctx.createLinearGradient(x, y, x + w, y + w);
      bevel.addColorStop(0,    `rgb(${r},${g},${b})`);
      bevel.addColorStop(0.5,  `rgb(${Math.round(r * 0.98)},${Math.round(g * 0.98)},${Math.round(b * 0.98)})`);
      bevel.addColorStop(1,    `rgb(${Math.round(r * 0.93)},${Math.round(g * 0.93)},${Math.round(b * 0.93)})`);
      ctx.fillStyle = bevel;
      ctx.fillRect(x, y, w, w);

      for (let i = 0; i < 90; i++) {                      // faint speckle inside the tile
        ctx.fillStyle = Math.random() > 0.5
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(90, 90, 85, 0.06)';
        ctx.fillRect(x + Math.random() * w, y + Math.random() * w, 2, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;    // allow tiling horizontally
  texture.wrapT = THREE.RepeatWrapping;    // allow tiling vertically
  // One canvas = 8×8 tiles. One tile = 0.5 m, so one canvas covers 4 m.
  // Floor is 14 m x 10 m  ->  repeat 14/4 x 10/4
  texture.repeat.set(3.5, 2.5);
  return texture;
}

// createWallTexture() — a REAL painted wall, not a flat color fill.
// Classic painted laboratory treatment: a warm off-white upper paint with a
// deeper blue-gray DADO / wainscot band from the floor up to ~1.05 m, a crisp
// painted break line between the two, and a very subtle roller-grain mottle so
// the surface never reads as a flat, artificial solid.
//
// UV contract: a PlaneGeometry maps v=0 (mesh bottom edge, at the floor here)
// to the BOTTOM row of the canvas, so the wainscot band is drawn at the bottom
// of the canvas. vertical repeat is clamped so the band lives at the floor no
// matter how tall the wall is.
function createWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dado height ratio: 1.05 m wainscot over a 3.5 m wall.
  const bandRatio = 1.05 / 3.5;
  const bandPx = Math.round(512 * bandRatio);   // ~154 px from the bottom

  const UPPER = '#e9ece9';      // warm off-white upper paint
  const DADO  = '#9fb2bd';      // soft blue-gray lower band
  const BREAK = '#7d8f9b';      // painted break line between the two

  // Upper paint covers the whole canvas first...
  ctx.fillStyle = UPPER;
  ctx.fillRect(0, 0, 512, 512);
  // ...then the dado band over the bottom slice (v=0 side).
  ctx.fillStyle = DADO;
  ctx.fillRect(0, 512 - bandPx, 512, bandPx);
  // Crisp break line just above the band.
  ctx.fillStyle = BREAK;
  ctx.fillRect(0, 512 - bandPx - 3, 512, 3);

  // Subtle roller-grain / mottle sprinkled over the whole wall — kills the
  // flat-solid look of a solid fill (real paint is never perfectly uniform).
  for (let i = 0; i < 1400; i++) {
    ctx.globalAlpha = Math.random() * 0.06;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#222222';
    const r = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;   // grain can tile slightly horizontally
  texture.wrapT = THREE.ClampToEdgeWrapping;  // band stays pinned to the floor
  texture.repeat.set(2, 1);
  return texture;
}

// createTrimMaterial() — the crisp white painted trim used for the ceiling
// cornice. Slightly glossy so it catches light like fresh-painted molding.
function createTrimMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5 });
}

// createSkyTexture() — the late-afternoon sky seen through the window glass.
// A vertical gradient: deepest blue at the top, paling toward a bright misty
// horizon. Same mood as the old scene background (0x9fbdd6) but with depth,
// so the window reads as a real view outside rather than a flat fill.
function createSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#2f5c8f');    // deep zenith blue
  g.addColorStop(0.55, '#7fa8c9');   // mid sky
  g.addColorStop(1.0, '#d9e7f1');    // pale, misty horizon
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createRoom(scene, interactableObjects) {
  // --- Lighting ---
  // Pure room lighting — no sun. Real fluorescent tubes are RECTANGULAR area
  // lights, so each ceiling fixture is a RectAreaLight (soft, directional,
  // realistic) instead of a point bulb. Everything is turned DOWN: the room
  // reads dim, corners fall off into shadow, work surfaces sit in cool pools.
  const ambientLight = new THREE.AmbientLight(0xc8d4da, 0.10);   // cool fill, barely there
  scene.add(ambientLight);

  const fillLight = new THREE.HemisphereLight(0xdde6ea, 0x8f8a80, 0.22); // cool ceiling / warm floor bounce
  scene.add(fillLight);

  // Shadow-caster ONLY: the sunlight is gone. This light sits at the ceiling
  // at ~0.12 intensity — it contributes almost nothing to brightness and
  // exists solely to cast the soft contact shadows that keep furniture
  // grounded on the floor (RectAreaLights cannot cast shadows).
  const dirLight = new THREE.DirectionalLight(0xdfe8ec, 0.12);
  dirLight.position.set(0, 6, 0);    // overhead, not through the windows
  dirLight.castShadow = true;
  dirLight.shadow.radius = 6;           // PCFSoft penumbra — soft edges, real light
  // Explicit shadow map size (default is only 512² and blocky; 1024² is the
  // sweet spot — sharper contact shadows for one extra ~4 MB texture).
  dirLight.shadow.mapSize.set(1024, 1024);
  // Shadow camera = the invisible box shadows are computed inside.
  // Smaller box over the same shadow map = SHARPER shadows.
  dirLight.shadow.camera.left = -8;
  dirLight.shadow.camera.right = 8;
  dirLight.shadow.camera.top = 8;
  dirLight.shadow.camera.bottom = -8;
  dirLight.shadow.bias = -0.0001;       // kill shadow acne
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  // --- Geometry ---
  // REAL-WORLD SCALE: 14 m wide (x: -7..+7), 10 m deep (z: -5..+5), 3.5 m ceiling.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshStandardMaterial({
      map: createFloorTexture(),
      roughness: 0.5,       // glazed ceramic: a touch of sheen, but not slippery
      metalness: 0.05
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Painted walls: each wall gets the two-tone painted texture (warm off-white
  // upper, blue-gray dado band at the floor). A FRESH material + texture per wall
  // keeps the grain independent so repeat never aliases across walls.
  const paintMat = () => new THREE.MeshStandardMaterial({
    map: createWallTexture(),
    roughness: 0.9,
    metalness: 0.0
  });

  // Back wall
  const backwall = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), paintMat());
  backwall.position.set(0, 1.75, -5);
  backwall.receiveShadow = true;
  scene.add(backwall);

  // Left wall — rotated +90° so its visible face points INTO the room
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.5), paintMat());
  leftWall.position.set(-7, 1.75, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall — rotated −90°, same reason
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.5), paintMat());
  rightWall.position.set(7, 1.75, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Front wall — rotated 180° so its face points back INTO the room
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), paintMat());
  frontWall.position.set(0, 1.75, 5);
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  // Ceiling — rotated +90° around X so it faces DOWN into the room
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 })
  );
  ceiling.position.set(0, 3.5, 0);
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  // --- Ceiling cornice (trim) — crisp white molding all around where the walls
  // meet the ceiling, so the room reads framed like a real painted room. Four
  // runs: two long (front/back, along x) + two short (left/right, along z).
  const trimMat = createTrimMaterial();
  const corniceRun = (len, px, py, pz, rx, ry, rz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.04), trimMat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    scene.add(m);
  };
  corniceRun(14.3, 0, 3.47, -4.99, 0, 0, 0);   // back
  corniceRun(14.3, 0, 3.47, 4.99, 0, 0, 0);    // front
  corniceRun(10.3, -7.01, 3.47, 0, 0, Math.PI / 2, 0);  // left
  corniceRun(10.3, 7.01, 3.47, 0, 0, -Math.PI / 2, 0);  // right

  // --- Exit door (on the front wall, steel lab door) ---
  // Wrapped in a raycastable group so hand.js can aim at it (userData.exitDoor)
  // and press E to leave the lab. exitPos = the 2D point the distance gate uses.
  const exitDoor = new THREE.Group();
  exitDoor.userData.exitDoor = true;
  exitDoor.userData.exitPos = new THREE.Vector3(3, 0, 4.97);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.1, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.6, metalness: 0.3 })
  );
  door.position.set(3, 1.05, 4.97);
  door.castShadow = true;
  exitDoor.add(door);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.3, metalness: 0.9 })
  );
  handle.position.set(2.65, 1.05, 4.92);
  exitDoor.add(handle);

  scene.add(exitDoor);
  interactableObjects.push(exitDoor);

  // --- Safety accents: green EXIT sign + yellow/black hazard stripe at the
  // wall bases — the visual language of a real, properly run lab.
  function createExitTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1f7a3c';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 64, 32);
    return new THREE.CanvasTexture(canvas);
  }

  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.25),
    new THREE.MeshStandardMaterial({
      map: createExitTexture(),
      emissive: 0x2ea860,
      emissiveIntensity: 1.6       // a real EXIT sign is a lit lightbox — blooms at high quality
    })
  );
  exitSign.position.set(3, 2.55, 4.97);
  exitSign.rotation.y = Math.PI;            // front wall faces into the room
  scene.add(exitSign);

  // Diagonal yellow/black hazard stripes; 4 stripes per canvas, one canvas
  // covers 0.5 m, so repeat = 2x the wall width.
  function createHazardStripe(width) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e0b81f';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#1b1b1b';
    for (let x = 0; x < 128; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 32, 0);
      ctx.lineTo(x + 16, 32);
      ctx.closePath();
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(width * 2, 1);
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
  }

  const backStripe = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.14), createHazardStripe(14));
  backStripe.position.set(0, 0.07, -4.99);
  scene.add(backStripe);

  for (const [x, rotY] of [[-6.99, Math.PI / 2], [6.99, -Math.PI / 2]]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.14), createHazardStripe(10));
    stripe.position.set(x, 0.07, 0);
    stripe.rotation.y = rotY;
    scene.add(stripe);
  }

  // --- Window (on the right wall) ---
  // A real 3D window model (window.glb), flush-mounted into the wall: its inner
  // frame face sits at the wall plane and the deep frame body passes through
  // the zero-thickness wall to the outside. Waist-height — the sill rests at
  // ~0.8 m, the top at ~2.3 m. Placed at z = +2.5 so it mirrors the AIT logo
  // at z = -2.5: the two halves of the wall read balanced.
  const windowGltf = new GLTFLoader();
  const glbUrl = `${import.meta.env.BASE_URL}Models/window.glb`;
  windowGltf.load(
    glbUrl,
    (gltf) => {
      const win = gltf.scene;
      // 1.5 m tall (0.8..2.3 m). The model ships ~80 units tall, so the
      // uniform scale is dimensionless height ratio.
      const box0 = new THREE.Box3().setFromObject(win);
      const s0 = box0.getSize(new THREE.Vector3());
      win.scale.setScalar(1.5 / s0.y);
      // Rotate FIRST, then measure: the oriented bounds are what we pin to.
      // After +90° about Y the model's depth axis runs along room-x (through
      // the wall) and its width along room-z (along the wall).
      win.rotation.y = Math.PI / 2;
      const box = new THREE.Box3().setFromObject(win);
      win.position.set(
        6.96 - box.min.x,                             // inner face flush with the wall
        0.8 - box.min.y,                              // sill height
        2.5 - box.getCenter(new THREE.Vector3()).z    // centered on the wall's right half
      );
      win.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      scene.add(win);
    },
    undefined,
    (err) => console.error('FAILED to load window.glb', err)
  );

  // Sky visible through the glass: the room is fully enclosed (no holes in the
  // walls), so the blue scene background never shows. This gradient sky plane
  // lives OUTSIDE the wall behind the window — through the model's transparent
  // glass panes it reads as late-afternoon sky. Sized ~4x the opening so its
  // edges can never peek around the frame, and clear of the frame's outer end
  // (x=6.96 + 1.24 m depth = 8.2, plane sits at 9).
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.6),
    new THREE.MeshBasicMaterial({ map: createSkyTexture(), color: 0xffffff })
  );
  sky.position.set(9, 1.55, 2.5);
  sky.rotation.y = -Math.PI / 2;      // face INTO the room (-x)
  scene.add(sky);

  // AIT logo on the wall where the second window used to be (z = -2.5).
  // The PNG is TRANSPARENT (no background), so it is drawn straight onto the
  // wall - no frame behind it - and the wall paint shows through empty pixels.
  const logoTex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}Logo/AIT%20logo%20.png`);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.96), logoMat);
  logo.position.set(6.94, 1.7, -2.5);
  logo.rotation.y = -Math.PI / 2;        // face into the room
  scene.add(logo);

  // --- Ceiling light fixtures ---
  // 'emissive' makes the panel GLOW, but glowing materials cast NO light in
  // three.js — so each fixture also carries a real light.
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.5
  });
  // Real fluorescent tube = an area light the size of the fixture. Soft and
  // directional (downward), which is exactly how a tube lights a room.
  RectAreaLightUniformsLib.init();
  for (const zPos of [-2.5, 0, 2.5]) {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.3), fixtureMat);
    fixture.position.set(0, 3.47, zPos);
    scene.add(fixture);

    if (quality.level === 'high') {
      const tube = new THREE.RectAreaLight(0xe9f4f6, 3.2, 1.2, 0.3);  // cool 4000 K tube
      tube.position.set(0, 3.42, zPos);
      tube.lookAt(0, 0, zPos);          // faces straight down into the room
      scene.add(tube);
    } else {
      // LOW preset: area lights cost too much — a dim point bulb instead.
      const bulb = new THREE.PointLight(0xe9f4f6, 2.6, 9, 2.0);
      bulb.position.set(0, 3.25, zPos);
      bulb.castShadow = false;
      scene.add(bulb);
    }
  }

  return { dirLight, ambientLight };
}
