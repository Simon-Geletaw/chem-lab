# Start screen — light scrim + settled first frames behind the loader

**Date:** 2026-08-20

## Problem

After the loader finished, the start screen showed a near-black backdrop for a
while before the room "woke up" to its fully lit self. Two causes stacked up:

1. The start-screen overlay used a dark navy scrim
   (`rgba(4,16,34,0.42)`) over a deliberately dim lab, and `html, body` had a
   near-black background (`#071018`). On a laptop with an integrated GPU the
   combined effect read as "the page went black".
2. `loader.done()` fired immediately after the first raw render — shadow maps,
   bloom history and the area-light accumulation were all still settling, so
   the very first frames the start screen revealed were the darkest ones.

## Change

- **All four labs** (`chem-lab`, `biology-lab`, `math-lab`, `physics-lab`
  `index.html`):
  - `html, body { background: #071018 }` → `#9fbdd6` (pale blue sky tone).
  - `#start-overlay` background `rgba(4,16,34,0.42)` →
    `rgba(233, 243, 252, 0.55)` — a light, airy scrim that matches the pale
    blue loading screen instead of a dark one. Modal overlays (travel/d-pad)
    keep their dark backdrops intentionally.
- **All four labs** `src/main.js` — after `renderer.compile()` + the first
  `renderer.render()`, the "Compiling the first frame…" stage now waits **8
  animation frames** behind the loader before `animate()` starts and the
  loader hands off. Shadow maps, bloom warm-up and area lights settle during
  those frames, so the start screen always reveals a fully lit room.

Satellite copies (`biology/math/physics`) remain byte-identical to each other.

## How it was verified

- `npm run build` — all four labs exit 0.
- Visual: loading screen now hands off into a lit room; the start screen no
  longer flashes black, even on the integrated-GPU laptop.