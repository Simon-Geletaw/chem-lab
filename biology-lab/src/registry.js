// registry.js — the ONE place that knows where the Biology Lab's room data
// comes from. Everything user-facing in this app (room name, tagline, accent,
// the back-to-chem-lab link, station signs) is driven by server/data/room.json
// — change the JSON, restart, and the room relabels itself.
//
// Same architecture rule as chem-lab: plain objects and strings only, no
// Three.js, so the data can be validated in the browser console.
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

// ---------------------------------------------------------------------------
// validate() — fail LOUDLY at startup instead of showing a half-named room:
// a missing accent or a station without a label would otherwise surface as a
// broken sign at runtime.
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
  }
}