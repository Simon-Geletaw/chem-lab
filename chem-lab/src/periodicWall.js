// periodicWall.js — the giant periodic-table poster on the back wall:
// 118 canvas-textured tiles + dark board + title strip.
import * as THREE from 'three';
import { elementsData } from './periodicTable.js';

// Returns the real periodic-table cell for atomic number z:
// col 1..18 (left to right), row 1..7 (top to bottom),
// rows 8.5/9.5 = the detached lanthanide/actinide strips.
function getGridPosition(z) {
  if (z === 1)   return { col: 1,       row: 1 };     // H
  if (z === 2)   return { col: 18,      row: 1 };     // He
  if (z <= 4)    return { col: z - 2,   row: 2 };     // Li, Be
  if (z <= 10)   return { col: z + 8,   row: 2 };     // B..Ne
  if (z <= 12)   return { col: z - 10,  row: 3 };     // Na, Mg
  if (z <= 18)   return { col: z,       row: 3 };     // Al..Ar
  if (z <= 36)   return { col: z - 18,  row: 4 };     // K..Kr
  if (z <= 54)   return { col: z - 36,  row: 5 };     // Rb..Xe
  if (z <= 56)   return { col: z - 54,  row: 6 };     // Cs, Ba
  if (z <= 71)   return { col: z - 54,  row: 8.5 };   // La..Lu (detached)
  if (z <= 86)   return { col: z - 68,  row: 6 };     // Hf..Rn
  if (z <= 88)   return { col: z - 86,  row: 7 };     // Fr, Ra
  if (z <= 103)  return { col: z - 86,  row: 9.5 };   // Ac..Lr (detached)
  return { col: z - 100, row: 7 };                    // Rf..Og
}

// Chemical family for atomic number z (drives the tile color)
function getCategory(z) {
  if ([1, 6, 7, 8, 15, 16, 34].includes(z))         return 'nonmetal';
  if ([2, 10, 18, 36, 54, 86, 118].includes(z))     return 'noble-gas';
  if ([9, 17, 35, 53, 85, 117].includes(z))         return 'halogen';
  if ([3, 11, 19, 37, 55, 87].includes(z))          return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(z))          return 'alkaline';
  if ([5, 14, 32, 33, 51, 52].includes(z))          return 'metalloid';
  if (z >= 57 && z <= 71)                           return 'lanthanide';
  if (z >= 89 && z <= 103)                          return 'actinide';
  if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(z)) return 'post-transition';
  return 'transition';                              // everything else
}

const categoryColors = {
  'alkali':          '#d95d39',
  'alkaline':        '#e8a94b',
  'transition':      '#3f6fa8',
  'post-transition': '#7d8ca3',
  'metalloid':       '#c9a227',
  'nonmetal':        '#2a9d5c',
  'halogen':         '#1f9e89',
  'noble-gas':       '#8d5bd4',
  'lanthanide':      '#c95f8e',
  'actinide':        '#a4636f'
};

function createElementTexture(element, atomicNumber, bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;                       // doubled resolution = crisp text
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;                  // category color
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 244);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';                   // atomic number, top-left corner
  ctx.textBaseline = 'top';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(String(atomicNumber), 16, 12);

  ctx.textAlign = 'center';                 // big symbol, center
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 110px Arial';
  ctx.fillText(element.symbol, 128, 128);

  ctx.font = '28px Arial';                  // name, bottom (maxWidth squeezes long names)
  ctx.fillText(element.name, 128, 226, 236);

  return new THREE.CanvasTexture(canvas);
}

function createTitleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#22303c';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(' Elements', 512, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createPeriodicWall(scene, interactableObjects) {
  const elementsGroup = new THREE.Group();
  const tiles = [];

  // Poster scaled down to 71% and re-centered at eye height (1.6 m) so the
  // whole board fits in the player's field of view without craning the neck.
  const S = 0.71;
  const tileStep = 0.30 * S;   // tile size 0.199 m + gap, scaled

  elementsData.forEach((element, index) => {
    const atomicNumber = index + 1;
    const cell = getGridPosition(atomicNumber);
    const color = categoryColors[getCategory(atomicNumber)];

    const texture = createElementTexture(element, atomicNumber, color);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(0.28 * S, 0.28 * S, 0.02 * S),
      material
    );

    const xPos = (cell.col - 9.5) * tileStep;      // cols 1..18 centered on x=0
    // Old layout ran rows 1..9.5 from y=2.95 down to 0.40 (center 1.675);
    // scale that band about eye height so the poster stays put but shrinks.
    const yPos = 1.6 + (3.25 - cell.row * 0.30 - 1.675) * S;
    tile.position.set(xPos, yPos, -4.96);

    tile.userData = {
      name: element.name + ' (' + element.symbol + ')',
      description: element.fact + ' ' + element.use,
      isElement: true,
      atomicNumber: atomicNumber,
      homePosition: tile.position.clone()   // where to fly back to after popping out
    };

    interactableObjects.push(tile);
    tiles.push(tile);
    elementsGroup.add(tile);
  });
  scene.add(elementsGroup);

  // Dark board behind the tiles ("poster frame")
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(5.9 * S, 3.1 * S, 0.04 * S),
    new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.85 })
  );
  board.position.set(0, 1.6, -4.99);
  scene.add(board);

  // Title strip
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(3 * S, 0.375 * S),   // same 8:1 ratio as the 1024x128 canvas
    new THREE.MeshStandardMaterial({ map: createTitleTexture() })
  );
  title.position.set(0, 2.75, -4.97);
  scene.add(title);

  return { tiles };
}
