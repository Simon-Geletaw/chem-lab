// room.js — the physical room: floor, walls, ceiling, lights.
// Pattern: an "init function" that receives what it needs (the scene),
// builds its part of the world, and returns anything others might need.
import * as THREE from 'three';

function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  context.fillStyle = '#d9d9d2'; // Gray color for the floor
  context.fillRect(0, 0, 512, 512);
  context.fillStyle = '#bdbdb4';               // darker tile color
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) {         // every other square, like a chessboard
        context.fillRect(col * 64, row * 64, 64, 64);
      }
    }
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
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const fillLight = new THREE.HemisphereLight(0xffffff, 0x777788, 0.6);
  scene.add(fillLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 6, 3);   // "sun" just above the 3.5 m ceiling height
  dirLight.castShadow = true;
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

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.9, metalness: 0.0 });

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

  // Ceiling — rotated +90° around X so it faces DOWN into the room
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9 })
  );
  ceiling.position.set(0, 3.5, 0);
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  return { dirLight, ambientLight };
}
