// interactions.js — clicking things in the lab.
//
// THE key pointer-lock lesson: while the pointer is locked there IS no mouse
// cursor, and event.clientX/Y are frozen at their last position. So:
//   - pointer LOCKED  -> raycast from Vector2(0, 0) = the EXACT screen center
//                        (that's what the crosshair dot marks)
//   - pointer FREE    -> raycast from the real mouse coordinates, as before
//
// Clicking a periodic-table tile makes it fly off the wall, grow, and show a
// 3D info card next to it. Clicking again (or elsewhere) sends it home.
// Non-element objects (bench, extinguisher...) still use the HTML panel.
import * as THREE from 'three';

// Draws text that wraps onto new lines when a line would exceed maxWidth.
// Canvas has no built-in word wrap, so we measure word by word.
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const attempt = line ? line + ' ' + word : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = attempt;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;                    // where the NEXT block may start
}

// The floating info card texture: dark rounded panel, title, atomic number,
// wrapped description. Same canvas-texture trick as the element tiles.
function createElementCardTexture(name, atomicNumber, description) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(20, 30, 40, 0.92)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 332, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(name, 28, 26, 380);

  ctx.textAlign = 'right';                  // atomic number badge, top-right
  ctx.fillStyle = '#9fc5e8';
  ctx.fillText('#' + atomicNumber, 484, 26);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8eef2';
  ctx.font = '26px Arial';
  wrapText(ctx, description, 28, 92, 456, 36);

  return new THREE.CanvasTexture(canvas);
}

export function createInteractions(camera, controls, scene, interactableObjects) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const CENTER = new THREE.Vector2(0, 0);   // screen center in normalized coords

  // HTML panel (still used for non-element objects like the bench)
  const panel = document.getElementById('info-panel');
  const panelTitle = document.getElementById('info-title');
  const panelText = document.getElementById('info-description');
  document.getElementById('info-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // --- tile pop-out state ---
  let selectedTile = null;                  // the tile currently popped out
  const returningTiles = new Set();         // tiles flying back home
  let card = null;                          // the floating info card mesh

  const POP_OFFSET = new THREE.Vector3(0, 0, 0.35);  // 35 cm off the wall
  const POP_SCALE = new THREE.Vector3(1.8, 1.8, 1.8);
  const HOME_SCALE = new THREE.Vector3(1, 1, 1);

  function select(tile) {
    deselect();
    selectedTile = tile;
    returningTiles.delete(tile);            // in case it was mid-flight home

    const { name, atomicNumber, description, homePosition } = tile.userData;

    card = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.6),
      new THREE.MeshBasicMaterial({        // Basic = readable in any lighting
        map: createElementCardTexture(name, atomicNumber, description),
        transparent: true,
        opacity: 0,                        // fades in inside update()
        depthWrite: false                  // avoids flicker with the glass/tiles
      })
    );
    // Card sits beside the tile: to the right normally, to the LEFT for tiles
    // near the right edge so the card never sticks past the poster.
    const side = homePosition.x > 2 ? -0.85 : 0.85;
    card.position.set(
      THREE.MathUtils.clamp(homePosition.x + side, -6.3, 6.3),
      THREE.MathUtils.clamp(homePosition.y, 0.6, 2.9),
      -4.4
    );
    scene.add(card);
  }

  function deselect() {
    if (selectedTile) {
      returningTiles.add(selectedTile);     // update() flies it home
      selectedTile = null;
    }
    if (card) {
      card.material.map.dispose();
      card.material.dispose();
      card.geometry.dispose();
      scene.remove(card);
      card = null;
    }
  }

  window.addEventListener('click', (event) => {
    // Ignore clicks on UI elements (start overlay, info panel, mobile D-pad...)
    if (event.target.closest('#start-overlay') ||
        event.target.closest('#info-panel') ||
        event.target.closest('#mobile-controls')) return;

    if (controls.isLocked) {
      raycaster.setFromCamera(CENTER, camera);          // crosshair aim
    } else {
      mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);           // mouse aim
    }

    const hits = raycaster.intersectObjects(interactableObjects, true);
    if (hits.length === 0) { deselect(); return; }

    // Climb the parent chain until we find the object holding userData.name
    let obj = hits[0].object;
    while (obj && !obj.userData.name) obj = obj.parent;
    if (!obj) { deselect(); return; }

    if (obj.userData.isElement) {
      // Clicking the popped tile again puts it back; a new tile swaps over
      if (obj === selectedTile) deselect();
      else select(obj);
    } else {
      panelTitle.textContent = obj.userData.name;
      panelText.textContent = obj.userData.description;
      panel.style.display = 'block';
    }
  });

  return {
    update(delta) {
      // The easing idiom: each frame move a FRACTION of the remaining distance.
      // Fast at first, slows near the target = smooth without a tween library.
      const t = Math.min(1, delta * 8);

      if (selectedTile) {
        const target = selectedTile.userData.homePosition.clone().add(POP_OFFSET);
        selectedTile.position.lerp(target, t);
        selectedTile.scale.lerp(POP_SCALE, t);
      }
      if (card) {
        card.material.opacity += (1 - card.material.opacity) * t;
      }

      for (const tile of returningTiles) {
        tile.position.lerp(tile.userData.homePosition, t);
        tile.scale.lerp(HOME_SCALE, t);
        if (tile.position.distanceTo(tile.userData.homePosition) < 0.005) {
          tile.position.copy(tile.userData.homePosition);   // snap the last mm
          tile.scale.copy(HOME_SCALE);
          returningTiles.delete(tile);
        }
      }
    }
  };
}
