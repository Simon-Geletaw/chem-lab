// lights.js — JSON-driven lighting for the Mathematics Lab.
// Builds all lights from room.json "lighting" + "geometry" so the entire
// illumination mood (ambient, fill, directional shadow-caster, ceiling
// fluorescent fixtures) is editable without touching code.
//
// Uses threejs-lighting skill patterns: RectAreaLight for realistic tubes,
// DirectionalLight for contact shadows only, HemisphereLight for fill.
// Falls back to PointLight on LOW quality (no RectAreaLight cost).
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { quality } from './quality.js';
import { getRoom, getGeometry, getLighting } from './registry.js';

const DEFAULTS = {
  ambient: { color: 0xc8d4da, intensity: 0.10 },
  fill:    { color: 0xdde6ea, ground: 0x8f8a80, intensity: 0.22 },
  dir:     { color: 0xdfe8ec, intensity: 0.12, position: [0, 6, 0] },
  fixtures: []
};

// Hex string -> THREE.Color helper (accepts #rrggbb or 0xRRGGBB)
function hexToColor(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.startsWith('#')) return parseInt(v.slice(1), 16);
  return 0xffffff;
}

/**
 * createLights(scene) — builds and adds all lights to the scene.
 * Returns an object with references for later disposal / quality switching.
 *
 * @param {THREE.Scene} scene
 * @returns {{ ambient: THREE.AmbientLight, fill: THREE.HemisphereLight, dir: THREE.DirectionalLight, fixtures: THREE.Mesh[], fixtureLights: (THREE.RectAreaLight|THREE.PointLight)[] }}
 */
export function createLights(scene) {
  const room = getRoom() || {};
  const lighting = { ...DEFAULTS, ...room.lighting };
  const geometry = getGeometry();

  // ---- Ambient: cool dim fill, barely there ----
  const ambient = new THREE.AmbientLight(
    hexToColor(lighting.ambient.color),
    lighting.ambient.intensity
  );
  scene.add(ambient);

  // ---- Hemisphere: cool ceiling / warm floor bounce ----
  const fill = new THREE.HemisphereLight(
    hexToColor(lighting.fill.color),
    hexToColor(lighting.fill.ground),
    lighting.fill.intensity
  );
  scene.add(fill);

  // ---- Directional: SHADOW CASTER ONLY (no visual contribution) ----
  // Sits at ceiling height, casts soft PCF shadows so furniture reads grounded.
  const dir = new THREE.DirectionalLight(
    hexToColor(lighting.dir.color),
    lighting.dir.intensity
  );
  dir.position.set(...lighting.dir.position);
  dir.castShadow = true;

  // Shadow quality settings
  dir.shadow.radius = lighting.dir.shadow?.radius ?? 6;
  const [mapW, mapH] = lighting.dir.shadow?.mapSize ?? [1024, 1024];
  dir.shadow.mapSize.set(mapW, mapH);

  // Shadow camera fitted to room geometry with a small margin
  const cam = lighting.dir.shadow?.camera ?? {};
  dir.shadow.camera.left   = cam.left   ?? -geometry.width / 2 - 0.3;
  dir.shadow.camera.right  = cam.right  ??  geometry.width / 2 + 0.3;
  dir.shadow.camera.top    = cam.top    ??  geometry.depth / 2 + 0.3;
  dir.shadow.camera.bottom = cam.bottom ?? -geometry.depth / 2 - 0.3;
  dir.shadow.camera.near   = cam.near   ?? 1;
  dir.shadow.camera.far    = cam.far    ?? geometry.height + 3;

  dir.shadow.bias        = lighting.dir.shadow?.bias ?? -0.0001;
  dir.shadow.normalBias  = lighting.dir.shadow?.normalBias ?? 0.02;

  scene.add(dir);

  // ---- Ceiling fixtures: emissive mesh + real area/point light ----
  // Each fixture gets a glowing panel mesh (visual) + a RectAreaLight
  // (HIGH quality) or PointLight (LOW quality). The panel is positioned
  // flush with the ceiling; the light sits just below it.
  RectAreaLightUniformsLib.init();

  const fixtureMeshes = [];
  const fixtureLights = [];

  for (const fix of lighting.fixtures) {
    // Fixture mesh (emissive panel)
    const [w, h] = fix.size;
    const panelMat = new THREE.MeshStandardMaterial({
      color: hexToColor(fix.emissiveColor),
      emissive: hexToColor(fix.emissiveColor),
      emissiveIntensity: fix.emissiveIntensity
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, h), panelMat);
    panel.position.set(fix.x, fix.y, fix.z);
    scene.add(panel);
    fixtureMeshes.push(panel);

    // Real light (area on HIGH, point on LOW)
    if (quality.level === 'high') {
      const tube = new THREE.RectAreaLight(
        hexToColor(fix.lightColor),
        fix.lightIntensity,
        w,
        h
      );
      tube.position.set(fix.x, fix.y - 0.05, fix.z);
      if (fix.lookAt) tube.lookAt(...fix.lookAt);
      scene.add(tube);
      fixtureLights.push(tube);
    } else {
      const bulb = new THREE.PointLight(
        hexToColor(fix.lightColor),
        fix.lightIntensity * 0.8,  // slightly dimmer to compensate for omnidirectional
        geometry.width,
        2.0
      );
      bulb.position.set(fix.x, fix.y - 0.2, fix.z);
      bulb.castShadow = false;
      scene.add(bulb);
      fixtureLights.push(bulb);
    }
  }

  return { ambient, fill, dir, fixtures: fixtureMeshes, fixtureLights };
}

/**
 * rebuildFixtureLights(scene, current) — called when quality level changes.
 * Disposes old fixture lights, recreates them at the new quality tier.
 */
export function rebuildFixtureLights(scene, current) {
  if (!current) return;
  for (const l of current.fixtureLights) {
    scene.remove(l);
    l.dispose?.();
  }
  current.fixtureLights.length = 0;

  const room = getRoom() || {};
  const lighting = { ...DEFAULTS, ...room.lighting };

  RectAreaLightUniformsLib.init();

  for (const fix of lighting.fixtures) {
    const [w, h] = fix.size;
    if (quality.level === 'high') {
      const tube = new THREE.RectAreaLight(
        hexToColor(fix.lightColor),
        fix.lightIntensity,
        w,
        h
      );
      tube.position.set(fix.x, fix.y - 0.05, fix.z);
      if (fix.lookAt) tube.lookAt(...fix.lookAt);
      scene.add(tube);
      current.fixtureLights.push(tube);
    } else {
      const bulb = new THREE.PointLight(
        hexToColor(fix.lightColor),
        fix.lightIntensity * 0.8,
        20,
        2.0
      );
      bulb.position.set(fix.x, fix.y - 0.2, fix.z);
      bulb.castShadow = false;
      scene.add(bulb);
      current.fixtureLights.push(bulb);
    }
  }
}