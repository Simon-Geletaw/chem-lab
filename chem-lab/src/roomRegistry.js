// roomRegistry.js — the ONE place that knows where the Chemistry Lab's room
// data comes from. Everything user-facing in this app (room name, the wall
// paint every surface reads) is driven by server/data/room.json — change the
// JSON, rebuild, and the whole room relabels and repaints itself.
//
// Same architecture rule as the satellite registries: plain objects and
// strings only, no Three.js, so the data can be validated in the browser
// console.
import rawData from '../server/data/room.json';

let data = null;

export async function loadRoom() {
  data = rawData;
  validate(data);
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
// validate() — fail LOUDLY at startup on a structurally broken JSON: a
// missing wallPaint block would otherwise surface as a mis-painted room at
// runtime. A single bad color token only warns — a hex typo must never brick
// the lab, callers fall back to their defaults.
// ---------------------------------------------------------------------------
function validate(d) {
  if (!d || typeof d.name !== 'string' || !d.name.trim()) {
    throw new Error('room.json must have a non-empty "name"');
  }
  if (!d.wallPaint || typeof d.wallPaint !== 'object') {
    throw new Error('room.json must have a "wallPaint" object');
  }
  for (const key of ['upper', 'dado', 'break', 'ceiling', 'trim']) {
    if (d.wallPaint[key] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(d.wallPaint[key])) {
      console.warn(`room.json wallPaint.${key} "${d.wallPaint[key]}" is not #rrggbb — using the default`);
    }
  }
}