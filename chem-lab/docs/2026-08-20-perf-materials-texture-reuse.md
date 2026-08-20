# Perf — material/texture reuse: shared instances instead of per-object duplicates

**Date:** 2026-08-20

## Problem

Phase 2c of the integrated-GPU perf plan: several modules re-created identical
materials and canvas textures once per object. The room redrew the same painted
wall canvas seven times (5 full-height walls + 2 window bands) and the same
deterministic hazard-stripe canvas five times; every reagent bottle got its own
cap material and its own body+neck material pair; both test-tube racks rebuilt
the same five liquid materials; both glove hands built a second identical cuff
material; and the hanging coat and first-person sleeves drew the weave fabric
canvas twice. None of these are mutated after creation, so each was a pure
duplicate: wasted boot-time canvas drawing, extra GPU texture uploads and extra
material allocations on the budget GPU.

## Change

Focused, mutation-safe sharing (each shared instance was verified to be created
once and never modified afterwards):

- **`src/room.js` (all four labs):** the painted wall is drawn **once** into a
  single canvas (`createWallTexture` now returns the canvas; new
  `makeWallTexture` wraps it). The four full-height walls (back, left, right
  panels 1+2, front) share **one `wallMat` + one texture** (the grain is
  alpha ≤ 0.06 mottle, so a single grain is imperceptible); the two window
  bands resample the same canvas with their own repeat/offset. Hazard stripes
  likewise draw their deterministic artwork once (`createHazardStripeCanvas`)
  and every stripe builds a texture from that one canvas.
- **`src/furniture.js` (chem-lab):** one shared `capMat` for every reagent
  bottle; liquid bottles share a single material between body and neck;
  test-tube-rack liquids are cached **by color** (both racks show the same five
  liquids); the bottle-label texture builder and the powder-grain texture
  builder now cache **by text / by base color** so identical inputs share one
  texture.
- **`src/coat.js` (chem-lab):** the deterministic weave fabric texture is built
  once (`getFabricTexture`) and shared by the hanging coat panels and the
  first-person sleeves.
- **`src/gloves.js` (chem-lab):** one shared `cuffMat` for both hands instead
  of a fresh cuff material per hand.
- **`src/experimentTable.js` (chem-lab):** one shared `backplateMat` for all
  experiment-card plaques (identical dark paint, never mutated).

Reviewed and left alone (safe to share nothing, or already shared): the PPE box
materials in `mask.js` / `gloves.js` / `eyegoggles.js` (each box is built once;
values differ per product), `simDoors.js` (leaf/glass/trim already shared;
door-accent and LED materials are per-door by design and LED intensity is
mutated per frame), `periodicWall.js` (118 tile textures are content-unique and
were deliberately kept at 256² — see 2026-08-10 render-budget doc),
`atomView.js` (single pedestal built once) and `ui/theme.js` (DOM/CSS, no
three.js materials). `src/ui/atomicStructure.js` was not touched.

Satellite copies (`biology|math|physics-lab/src/room.js`) were edited with the
identical changes and verified byte-identical.

## How it was verified

- `npm run build` at the root — all four labs exit 0.
- Satellite `main.js`, `ui/loader.js`, `furniture.js`, `exitDoor.js` and
  `room.js` remain byte-identical to each other (git blob hash check).
- No visible change: wall/stripe/band sampling regions are unchanged (same
  repeat/offset values, same canvas contents), so the rendered image is
  pixel-identical apart from the single shared wall grain (imperceptible
  noise); shared materials are never mutated, so nothing leaks between objects.
- No loader.js logic, loading-stage structure/weights in main.js,
  `shadowUpdate.js` mechanism, shadow-map behavior or tone-mapping values were
  touched.