// room.js — the physical room: floor, walls, ceiling, lights.
// Pattern: an "init function" that receives what it needs (the scene),
// builds its part of the world, and returns anything others might need.
import * as THREE from 'three';

function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  // Soft vinyl lab tile: warm light gray with a SUBTLE checker (real lab
  // linoleum, not a chessboard), thin grout lines and faint speckle.
  context.fillStyle = '#d8d6cd';
  context.fillRect(0, 0, 512, 512);
  context.fillStyle = '#cfccc2';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) {         // every other square, very low contrast
        context.fillRect(col * 64, row * 64, 64, 64);
      }
    }
  }

  context.strokeStyle = 'rgba(130, 128, 118, 0.4)';   // grout lines
  context.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    context.beginPath(); context.moveTo(i * 64, 0); context.lineTo(i * 64, 512); context.stroke();
    context.beginPath(); context.moveTo(0, i * 64); context.lineTo(512, i * 64); context.stroke();
  }

  // Speckle: kills the flatness of a solid fill (real vinyl is never uniform).
  for (let i = 0; i < 900; i++) {
    context.fillStyle = Math.random() > 0.5
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(90, 90, 85, 0.06)';
    context.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;    // allow tiling horizontally
  texture.wrapT = THREE.RepeatWrapping;    // allow tiling vertically
  // One canvas = 8x8 squares. One square = 0.5 m, so one canvas covers 4 m.
  // Floor is 14 m x 10 m  ->  repeat 14/4 x 10/4
  texture.repeat.set(3.5, 2.5);
  return texture;
}

export function createRoom(scene) {
  // --- Lighting ---
  // Warm daylight through the right-wall windows + warm fluorescent ceiling
  // fixtures. The tints matter: pure white light on pale walls reads flat.
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const fillLight = new THREE.HemisphereLight(0xfff4e6, 0x8d9299, 0.5);
  scene.add(fillLight);

  const dirLight = new THREE.DirectionalLight(0xfff2dc, 1.2);
  dirLight.position.set(10, 5, 0);  // "sun" outside the RIGHT wall = light through the windows
  dirLight.castShadow = true;
  // Explicit shadow map size (default is only 512² and blocky; 1024² is the
  // sweet spot — sharper contact shadows for one extra ~4 MB texture).
  dirLight.shadow.mapSize.set(1024, 1024);
  // Shadow camera = the invisible box shadows are computed inside.
  // Smaller box over the same shadow map = SHARPER shadows.
  dirLight.shadow.camera.left = -8;
  dirLight.shadow.camera.right = 8;
  dirLight.shadow.camera.top = 8;
  dirLight.shadow.camera.bottom = -8;
  scene.add(dirLight);

  // --- Geometry ---
  // REAL-WORLD SCALE: 14 m wide (x: -7..+7), 10 m deep (z: -5..+5), 3.5 m ceiling.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshStandardMaterial({
      map: createFloorTexture(),
      roughness: 0.7,
      metalness: 0.1
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe7eae8, roughness: 0.9, metalness: 0.0 });

  // Back wall
  const backwall = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), wallMaterial);
  backwall.position.set(0, 1.75, -5);
  backwall.receiveShadow = true;
  scene.add(backwall);

  // Left wall — rotated +90° so its visible face points INTO the room
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.5), wallMaterial);
  leftWall.position.set(-7, 1.75, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall — rotated −90°, same reason
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.5), wallMaterial);
  rightWall.position.set(7, 1.75, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Front wall — rotated 180° so its face points back INTO the room
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), wallMaterial);
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

  // --- Door (on the front wall, steel lab door) ---
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.1, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.6, metalness: 0.3 })
  );
  door.position.set(3, 1.05, 4.97);
  scene.add(door);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.3, metalness: 0.9 })
  );
  handle.position.set(2.65, 1.05, 4.92);
  scene.add(handle);

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
      emissive: 0x1f7a3c,
      emissiveIntensity: 0.35
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

  // --- Windows (on the right wall) ---
  // Trick: MeshBasicMaterial IGNORES lighting — it is always full-bright.
  // A light-blue always-bright plane reads as "daylight outside".
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff });

  for (const zPos of [-2.5, 0]) {
    // glass pane: 1.5 m wide (along z), 1.2 m tall, centered at y=1.7
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), skyMat);
    pane.position.set(6.98, 1.7, zPos);
    pane.rotation.y = -Math.PI / 2;
    scene.add(pane);

    // frame: 2 horizontal + 2 vertical white bars around the pane
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.62), frameMat);
    top.position.set(6.96, 2.34, zPos);
    const bottom = top.clone();
    bottom.position.y = 1.06;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.36, 0.08), frameMat);
    left.position.set(6.96, 1.7, zPos - 0.77);
    const right = left.clone();
    right.position.z = zPos + 0.77;
    scene.add(top, bottom, left, right);
  }

  // --- Ceiling light fixtures ---
  // 'emissive' makes the panel GLOW, but glowing materials cast NO light in
  // three.js — so each fixture also carries a real PointLight.
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.5
  });
  for (const zPos of [-2.5, 0, 2.5]) {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.3), fixtureMat);
    fixture.position.set(0, 3.47, zPos);
    scene.add(fixture);

    // (color, intensity, distance it reaches, decay) — physical units in r185,
    // so tune the intensity number by eye in the browser.
    const bulb = new THREE.PointLight(0xfff3e2, 11, 8, 1.8);   // warm fluorescent
    bulb.position.set(0, 3.3, zPos);
    bulb.castShadow = false;   // only dirLight casts shadows = fast + sufficient
    scene.add(bulb);
  }

  return { dirLight, ambientLight };
}
