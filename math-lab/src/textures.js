// textures.js — JSON-driven texture & material factory for the Mathematics Lab.
// All canvas-based textures (floor tiles, painted walls, sky gradient, hazard
// stripes, sign plates) are built from room.json tokens so colors, sizes, and
// visual details are editable without code changes.
//
// Uses threejs-materials skill patterns: CanvasTexture with proper wrapping,
// cached material maps, and per-builder documentation.
import * as THREE from 'three';
import { getRoom, getGeometry, getWallPaint, getSky, getHazard, getExit, getStations, getToggleSigns } from './registry.js';

// ============================================================================
// Module-level caches (one canvas/texture per unique param set)
// ============================================================================
const floorTextureCache = new Map();
const wallTextureCache = new Map();
const signTextureCache = new Map();
const toggleTextureCache = new Map();

// ============================================================================
// Helpers
// ============================================================================
function hexToColor(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.startsWith('#')) return parseInt(v.slice(1), 16);
  return 0xffffff;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ============================================================================
// Floor: ceramic tiles with grout lines, subtle bevel + speckle per tile
// ============================================================================
export function createFloorTexture() {
  const room = getRoom() || {};
  const geometry = getGeometry();
  const SIZE = 1024;           // canvas resolution
  const TILE = 128;            // px per tile → 8×8 tiles per canvas, 0.5 m each
  const GRID = SIZE / TILE;
  const HALF_GROUT = 5;        // px inset per tile edge → 10 px seams (~1 cm real)

  // Cache key: geometry + tile config (fixed for now)
  const key = `${geometry.width}x${geometry.depth}`;
  if (floorTextureCache.has(key)) return floorTextureCache.get(key);

  const canvas = makeCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // Grout bed
  ctx.fillStyle = '#a6a398';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Individual tiles with random tone + diagonal bevel + speckle
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const v = 0.96 + Math.random() * 0.08;
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

      // Speckle
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = Math.random() > 0.5
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(90, 90, 85, 0.06)';
        ctx.fillRect(x + Math.random() * w, y + Math.random() * w, 2, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  // One canvas = 8×8 tiles = 4 m. Floor is W×D m → repeat W/4 × D/4
  texture.repeat.set(geometry.width / 4, geometry.depth / 4);

  floorTextureCache.set(key, texture);
  return texture;
}

// ============================================================================
// Wall: painted wall with dado band (lower 1.05 m) + break line + mottle
// ============================================================================
export function createWallTexture() {
  const paint = getWallPaint() || {
    upper: '#d3d4d3', dado: '#82a1b4', break: '#7d8f9b', ceiling: '#d3d4d3', trim: '#f4f6f8'
  };
  const key = `${paint.upper}|${paint.dado}|${paint.break}`;
  if (wallTextureCache.has(key)) return wallTextureCache.get(key);

  const canvas = makeCanvas(512, 512);
  const ctx = canvas.getContext('2d');

  // Dado height ratio: 1.05 m wainscot over 3.5 m wall
  const bandRatio = 1.05 / 3.5;
  const bandPx = Math.round(512 * bandRatio);

  const UPPER = paint.upper;
  const DADO  = paint.dado;
  const BREAK = paint.break;

  ctx.fillStyle = UPPER;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = DADO;
  ctx.fillRect(0, 512 - bandPx, 512, bandPx);

  ctx.fillStyle = BREAK;
  ctx.fillRect(0, 512 - bandPx - 3, 512, 3);

  // Subtle roller-grain mottle (alpha ≤ 0.06)
  for (let i = 0; i < 1400; i++) {
    ctx.globalAlpha = Math.random() * 0.06;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#222222';
    const r = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  wallTextureCache.set(key, canvas);
  return canvas;
}

export function makeWallTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Paint band helper: samples a vertical slice of the full-wall canvas
export function paintBandMat(y0, y1, wallCanvas) {
  const tex = makeWallTexture(wallCanvas);
  const wallH = 3.5; // full wall height in metres (from geometry)
  tex.repeat.set(2, (y1 - y0) / wallH);
  tex.offset.y = y0 / wallH;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
}

// ============================================================================
// Trim / cornice material (crisp white molding)
// ============================================================================
export function createTrimMaterial() {
  const paint = getWallPaint() || { trim: '#f4f6f8' };
  return new THREE.MeshStandardMaterial({ color: hexToColor(paint.trim), roughness: 0.5 });
}

// ============================================================================
// Sky: vertical gradient seen through window
// ============================================================================
export function createSkyTexture() {
  const sky = getSky();
  const key = sky.colors.join('|');
  if (signTextureCache.has(key)) return signTextureCache.get(key);

  const canvas = makeCanvas(128, 512);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  sky.colors.forEach((c, i) => g.addColorStop(i / (sky.colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  signTextureCache.set(key, texture);
  return texture;
}

// ============================================================================
// Hazard stripes: yellow/black diagonal pattern
// ============================================================================
function createHazardStripeCanvas() {
  const hazard = getHazard();
  const key = `${hazard.baseColor}|${hazard.stripeColor}|${hazard.stripePeriod}`;
  if (toggleTextureCache.has(key)) return toggleTextureCache.get(key);

  const canvas = makeCanvas(128, 32);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hazard.baseColor;
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = hazard.stripeColor;
  for (let x = 0; x < 128; x += hazard.stripePeriod) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 16, 32);
    ctx.closePath();
    ctx.fill();
  }

  toggleTextureCache.set(key, canvas);
  return canvas;
}

export function createHazardStripeMaterial(width) {
  const canvas = createHazardStripeCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(width * 2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
}

// ============================================================================
// Exit sign texture (green EXIT lightbox)
// ============================================================================
export function createExitTexture() {
  const exit = getExit();
  const key = `${exit.color}|${exit.label}`;
  if (signTextureCache.has(key)) return signTextureCache.get(key);

  const canvas = makeCanvas(128, 64);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = exit.color;
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(exit.label, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  signTextureCache.set(key, texture);
  return texture;
}

// ============================================================================
// Station sign plate texture (reusable for all hanging signs)
// ============================================================================
export function createStationSignTexture(station) {
  const room = getRoom();
  const accent = station.accent || room.accent;
  const key = `${station.label}|${station.subtitle}|${accent}|${station.width}|${station.height}|${station.fontSize}|${station.subtitleSize}`;
  if (signTextureCache.has(key)) return signTextureCache.get(key);

  const canvas = makeCanvas(512, 96);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#22303c';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${station.fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(station.label, 256, 42, 500);
  ctx.font = `${station.subtitleSize}px Arial`;
  ctx.fillStyle = '#b9cbe2';
  ctx.fillText(station.subtitle, 256, 78, 500);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  signTextureCache.set(key, texture);
  return texture;
}

// ============================================================================
// Toggle sign plate texture (two-state wall sign)
// ============================================================================
export function createToggleSignTexture(state) {
  const key = `${state.label}|${state.subtitle}|${state.bg}|${state.text}|${state.accent}|${state.borderColor}|${state.fontSize}|${state.subtitleSize}`;
  if (toggleTextureCache.has(key)) return toggleTextureCache.get(key);

  const canvas = makeCanvas(512, 96);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = state.bg;
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = state.borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = state.text;
  ctx.font = `bold ${state.fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.label, 256, 42, 500);
  ctx.font = `${state.subtitleSize}px Arial`;
  ctx.fillStyle = state.accent;
  ctx.fillText(state.subtitle, 256, 78, 500);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  toggleTextureCache.set(key, texture);
  return texture;
}

// ============================================================================
// Glass material (window panes) — shared
// ============================================================================
export function createGlassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xbfd8ea,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}