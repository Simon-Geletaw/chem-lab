# Perf — lighting/shadow budget: static shadow map + fitted shadow camera

**Date:** 2026-08-20

## Problem

Every frame re-rendered the room's 1024² PCF soft shadow map, even though the
shadow casters are static except for a few brief interactions. On the
integrated-GPU target laptop that depth pass is pure waste. The shadow camera
was also an unfitted ±8 m square with default near/far planes — shadow texels
were spread over space the room never occupies.

## Change

All four labs:

- **Static shadow map.** `renderer.shadowMap.autoUpdate = false` with one
  initial `needsUpdate = true` at setup — the map is rendered once and reused.
- **Fitted shadow camera** (`src/room.js`): `±7.3 × ±5.3` (room footprint
  14 × 10 m plus margin) instead of `±8 × ±8`, and `near = 1, far = 7` clamped
  to the room's height — sharper contact shadows on the same 1024² map, and
  nothing outside the room eats depth texels.

chem-lab only (it has dynamic casters; the satellites' rooms are fully
static):

- New `src/shadowUpdate.js` — a single shared hook:
  `bindShadowUpdate(fn)` / `requestShadowUpdate()`. main.js binds a callback
  that sets `renderer.shadowMap.needsUpdate = true`.
- `src/eyegoggles.js` — asks for one re-render when the goggle pair is
  worn/returned (visibility flip moves its shadow).
- `src/trashBin.js` — asks for a re-render every frame while the hinged lid is
  still swinging, so the lid's shadow never lags.

The flying disposal props deliberately cast no shadows, and the atom showcase
casts none either, so neither needs updates.

## How it was verified

- `npm run build` — all four labs exit 0.
- Satellite `main.js`/`room.js` copies remain byte-identical (SHA-256 check).
- Visual: shadows look identical (same 1024² PCFSoft map, now tighter) while
  the per-frame depth pass is gone; goggle toggle and trash-bin lid keep
  correct shadows.