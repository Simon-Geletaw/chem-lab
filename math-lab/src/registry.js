// registry.js — the ONE place that knows where the Mathematics Lab's room data
// comes from. Everything user-facing in this app (room name, tagline, accent,
// the back-to-chem-lab link, station signs, lighting, sky, hazards, toggle signs)
// is driven by server/data/room.json — change the JSON, restart, and the room
// relabels itself entirely.
//
// Architecture rule: plain objects and strings only, no Three.js imports,
// so the data can be validated in the browser console and loaded by both
// client (Vite) and server (Express) without bundler differences.
import rawData from '../server/data/room.json';

let data = null;

export async function loadRoom() {
  data = rawData;
  validate(data);
  console.log(`room: "${data.name}" loaded`);
  return data;
}

export function getRoom() {
  return data;
}

// getWallPaint() — the five paint tokens (upper/dado/break/ceiling/trim).
// null until loadRoom() has run; callers fall back to their own defaults.
export function getWallPaint() {
  return data ? data.wallPaint : null;
}

// getGeometry() — room footprint (width, depth, height in metres).
// Falls back to the original 14 × 10 × 3.5 lab defaults if absent.
export function getGeometry() {
  return data?.geometry ?? { width: 14, depth: 10, height: 3.5 };
}

// getLighting() — full lighting config (ambient, fill, directional, fixtures).
// All values are driven by room.json so the room mood is editable without code.
export function getLighting() {
  return data?.lighting ?? {
    ambient: { color: '#c8d4da', intensity: 0.10 },
    fill:    { color: '#dde6ea', ground: '#8f8a80', intensity: 0.22 },
    dir:     { color: '#dfe8ec', intensity: 0.12, position: [0, 6, 0] },
    fixtures: []
  };
}

// getSky() — sky gradient and plane parameters.
export function getSky() {
  return data?.sky ?? {
    colors: ['#2f5c8f', '#7fa8c9', '#d9e7f1'],
    size: [2.2, 1.9],
    position: [9, 1.55, 0],
    opacity: 1
  };
}

// getHazard() — yellow/black hazard stripe config.
export function getHazard() {
  return data?.hazard ?? {
    baseColor: '#e0b81f',
    stripeColor: '#1b1b1b',
    height: 0.14,
    stripePeriod: 32
  };
}

// getExit() — exit door and sign placement / style.
export function getExit() {
  return data?.exit ?? {
    doorPos: [3, 4.97],
    signPos: [3, 2.55, 4.97],
    label: 'EXIT',
    color: '#1f7a3c'
  };
}

// getStations() — hanging station signs (label, subtitle, position, style).
export function getStations() {
  return data?.stations ?? [];
}

// getToggleSigns() — E-toggled wall signs with multiple states.
export function getToggleSigns() {
  return data?.toggleSigns ?? [];
}

// ---------------------------------------------------------------------------
// validate() — fail LOUDLY at startup instead of showing a half-named room:
// a missing accent, bad hex color, or missing numeric coordinate would
// otherwise surface as a broken sign / missing light at runtime.
// ---------------------------------------------------------------------------
function validate(d) {
  if (!d || typeof d.name !== 'string' || !d.name.trim()) {
    throw new Error('room.json must have a non-empty "name"');
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(d.accent)) {
    throw new Error(`room.json has a bad accent "${d.accent}" — use #rrggbb`);
  }
  if (typeof d.backHref !== 'string' || !/^(https?:\/\/\S+|\/\S*)$/.test(d.backHref)) {
    throw new Error(`room.json backHref "${d.backHref}" — use a http(s) URL or a path like "/c"`);
  }
  if (!Array.isArray(d.stations) || d.stations.length === 0) {
    throw new Error('room.json must have a non-empty stations[] array');
  }
  if (!d.wallPaint || typeof d.wallPaint !== 'object') {
    throw new Error('room.json must have a "wallPaint" object');
  }
  for (const key of ['upper', 'dado', 'break', 'ceiling', 'trim']) {
    if (d.wallPaint[key] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(d.wallPaint[key])) {
      console.warn(`room.json wallPaint.${key} "${d.wallPaint[key]}" is not #rrggbb — using the default`);
    }
  }
  for (const s of d.stations) {
    if (!s.label || !s.subtitle) {
      throw new Error('Every station needs a "label" and a "subtitle"');
    }
    if (typeof s.x !== 'number' || typeof s.z !== 'number') {
      throw new Error(`Station "${s.label}" needs numeric x and z`);
    }
    if (s.rotationY !== undefined && typeof s.rotationY !== 'number') {
      throw new Error(`Station "${s.label}" rotationY must be a number`);
    }
  }

  // Validate geometry
  if (d.geometry) {
    if (typeof d.geometry.width !== 'number' || d.geometry.width <= 0) throw new Error('geometry.width must be a positive number');
    if (typeof d.geometry.depth !== 'number' || d.geometry.depth <= 0) throw new Error('geometry.depth must be a positive number');
    if (typeof d.geometry.height !== 'number' || d.geometry.height <= 0) throw new Error('geometry.height must be a positive number');
  }

  // Validate lighting
  if (d.lighting) {
    validateLighting(d.lighting);
  }

  // Validate sky
  if (d.sky) {
    if (!Array.isArray(d.sky.colors) || d.sky.colors.length < 2) throw new Error('sky.colors must be an array with at least 2 hex colors');
    for (const c of d.sky.colors) if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error(`sky.colors entry "${c}" is not #rrggbb`);
    if (d.sky.size && (!Array.isArray(d.sky.size) || d.sky.size.length !== 2 || d.sky.size.some(v => typeof v !== 'number' || v <= 0))) {
      throw new Error('sky.size must be [width, height] positive numbers');
    }
  }

  // Validate hazard
  if (d.hazard) {
    if (!/^#[0-9a-fA-F]{6}$/.test(d.hazard.baseColor)) throw new Error('hazard.baseColor must be #rrggbb');
    if (!/^#[0-9a-fA-F]{6}$/.test(d.hazard.stripeColor)) throw new Error('hazard.stripeColor must be #rrggbb');
    if (typeof d.hazard.height !== 'number' || d.hazard.height <= 0) throw new Error('hazard.height must be a positive number');
  }

  // Validate exit
  if (d.exit) {
    if (!Array.isArray(d.exit.doorPos) || d.exit.doorPos.length !== 2) throw new Error('exit.doorPos must be [x, z]');
    if (!Array.isArray(d.exit.signPos) || d.exit.signPos.length !== 3) throw new Error('exit.signPos must be [x, y, z]');
    if (!/^#[0-9a-fA-F]{6}$/.test(d.exit.color)) throw new Error('exit.color must be #rrggbb');
  }

  // Validate toggleSigns
  if (d.toggleSigns) {
    for (const ts of d.toggleSigns) {
      if (!ts.id) throw new Error('toggleSigns entry missing required "id"');
      if (typeof ts.x !== 'number' || typeof ts.y !== 'number' || typeof ts.z !== 'number') {
        throw new Error(`toggleSign "${ts.id}" needs numeric x, y, z`);
      }
      if (typeof ts.rotationY !== 'number') throw new Error(`toggleSign "${ts.id}" rotationY must be a number`);
      if (!Array.isArray(ts.states) || ts.states.length < 2) {
        throw new Error(`toggleSign "${ts.id}" needs at least 2 states`);
      }
      for (const state of ts.states) {
        if (!state.label) throw new Error(`toggleSign "${ts.id}" state missing label`);
        if (!/^#[0-9a-fA-F]{6}$/.test(state.bg)) throw new Error(`toggleSign "${ts.id}" state.bg must be #rrggbb`);
        if (!/^#[0-9a-fA-F]{6}$/.test(state.text)) throw new Error(`toggleSign "${ts.id}" state.text must be #rrggbb`);
        if (!/^#[0-9a-fA-F]{6}$/.test(state.accent)) throw new Error(`toggleSign "${ts.id}" state.accent must be #rrggbb`);
        if (!/^#[0-9a-fA-F]{6}$/.test(state.borderColor)) throw new Error(`toggleSign "${ts.id}" state.borderColor must be #rrggbb`);
      }
    }
  }
}

function validateLighting(lighting) {
  if (lighting.ambient) {
    if (!/^#[0-9a-fA-F]{6}$/.test(lighting.ambient.color)) throw new Error('lighting.ambient.color must be #rrggbb');
    if (typeof lighting.ambient.intensity !== 'number' || lighting.ambient.intensity < 0) throw new Error('lighting.ambient.intensity must be a non-negative number');
  }
  if (lighting.fill) {
    if (!/^#[0-9a-fA-F]{6}$/.test(lighting.fill.color)) throw new Error('lighting.fill.color must be #rrggbb');
    if (!/^#[0-9a-fA-F]{6}$/.test(lighting.fill.ground)) throw new Error('lighting.fill.ground must be #rrggbb');
    if (typeof lighting.fill.intensity !== 'number' || lighting.fill.intensity < 0) throw new Error('lighting.fill.intensity must be a non-negative number');
  }
  if (lighting.dir) {
    if (!/^#[0-9a-fA-F]{6}$/.test(lighting.dir.color)) throw new Error('lighting.dir.color must be #rrggbb');
    if (typeof lighting.dir.intensity !== 'number' || lighting.dir.intensity < 0) throw new Error('lighting.dir.intensity must be a non-negative number');
    if (lighting.dir.position && (!Array.isArray(lighting.dir.position) || lighting.dir.position.length !== 3)) throw new Error('lighting.dir.position must be [x, y, z]');
    if (lighting.dir.shadow) {
      const s = lighting.dir.shadow;
      if (typeof s.radius !== 'number') throw new Error('lighting.dir.shadow.radius must be a number');
      if (!Array.isArray(s.mapSize) || s.mapSize.length !== 2) throw new Error('lighting.dir.shadow.mapSize must be [width, height]');
      if (s.camera) {
        const c = s.camera;
        for (const k of ['left', 'right', 'top', 'bottom', 'near', 'far']) {
          if (typeof c[k] !== 'number') throw new Error(`lighting.dir.shadow.camera.${k} must be a number`);
        }
      }
    }
  }
  if (lighting.fixtures) {
    for (let i = 0; i < lighting.fixtures.length; i++) {
      const f = lighting.fixtures[i];
      for (const k of ['x', 'y', 'z']) if (typeof f[k] !== 'number') throw new Error(`fixtures[${i}].${k} must be a number`);
      if (!Array.isArray(f.size) || f.size.length !== 2) throw new Error(`fixtures[${i}].size must be [width, height]`);
      if (!/^#[0-9a-fA-F]{6}$/.test(f.emissiveColor)) throw new Error(`fixtures[${i}].emissiveColor must be #rrggbb`);
      if (!/^#[0-9a-fA-F]{6}$/.test(f.lightColor)) throw new Error(`fixtures[${i}].lightColor must be #rrggbb`);
      if (typeof f.emissiveIntensity !== 'number') throw new Error(`fixtures[${i}].emissiveIntensity must be a number`);
      if (typeof f.lightIntensity !== 'number') throw new Error(`fixtures[${i}].lightIntensity must be a number`);
    }
  }
}