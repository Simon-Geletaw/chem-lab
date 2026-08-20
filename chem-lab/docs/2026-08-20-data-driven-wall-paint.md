# 2026-08-20 — Data-driven wall paint: every surface reads server/data/room.json

## Problem
The room's paint was hardcoded: wall canvas colors (upper/dado/break),
ceiling and cornice trim lived as literals inside `room.js` in all four labs.
The Chemistry Lab had no `room.json` at all (its satellites did — but only for
name/tagline/stations). Repainting the room meant a code edit in four places.

## Change
- **`chem-lab/server/data/room.json`** (new) — `name` + a `wallPaint` block with
  the five tokens: `upper`, `dado`, `break`, `ceiling`, `trim`.
- **`chem-lab/src/roomRegistry.js`** (new) — mirrors the satellite registries:
  static JSON import, `loadRoom()`/`getRoom()`/`getWallPaint()`, loud
  validation. A missing `wallPaint` block throws at startup; a single bad hex
  only warns and falls back (a typo must never brick the lab).
- **`src/room.js` ×4** — `createWallTexture()` (upper/dado/break),
  `createTrimMaterial()` (trim) and the ceiling material now read
  `paint()` = registry values with the old literals as the DEFAULT_PAINT
  fallback. **Ceiling is now `#d3d4d3`** (the JSON default) — the upper-paint
  tone — so the whole room reads as one painted space, matching the
  doors wall by construction: ONE source drives every surface.
- **Satellites** — identical `wallPaint` block appended to each
  `server/data/room.json`; their `registry.js` gained `getWallPaint()` +
  validation; their `room.js` got the same `paint()` pattern
  (room.js ×3 and registry.js ×3 stay byte-identical).
- **`chem-lab/src/main.js`** — `loadRoom()` runs first in Phase 1 and the
  document title / start-card titles sync from `room.json` (same behavior
  the satellites already had).

Change a hex in the JSON, rebuild, the entire room repaints everywhere.

## Verification
- `npm run build` — all four labs exit 0.
- SHA-256: satellite room.js ×3 identical; registry.js ×3 identical.
- JSON payloads load (build statically bundles them; `npm run serve` smoke
  still serves `/c /b /m /p` — verified in the follow-up run).
- Visual check (user's browser): ceiling now reads as one paint with the
  walls; no surface can drift from the doors-wall paint.