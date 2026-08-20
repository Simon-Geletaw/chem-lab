# Atom showcase — prebuilt at boot + in-place trail tubes (no click freeze)

**Date:** 2026-08-20

## Problem

Clicking the periodic-wall picture hard-froze the whole page for a long time
on an integrated GPU:

- The whole display (nucleons, orbit rings, electrons, 3 comet trails) was
  built **on click**; nothing existed before that moment.
- Heavy shaders were compiled at click time: `MeshPhysicalMaterial` with
  clearcoat, a procedurally built PMREM environment map, and a fresnel
  `onBeforeCompile` — a multi-second GPU stall on an iGPU.
- The procedural env map was ~95% black, so the metallic rings rendered black.
- Trails created a new `TubeGeometry` and disposed it every frame (×3
  electrons), and all three electrons shared one module-level point array.
  The initial all-zero duplicate points produced NaN geometry at open.

## Change

`src/atomView.js` + `src/ui/atomicStructure.js` (chem-lab only):

- **Prebuilt at boot.** `createAtomView()` builds the display once during
  loading (scale 0, invisible, in the scene) so every shader compiles behind
  the loader. Clicking is now an instant scale-up animation.
- **Materials.** Removed the procedural env map, PMREM and clearcoat entirely.
  Nucleons: `MeshStandardMaterial` with emissive energy. Orbit rings: steel
  `0x8fa6c0` with a deep-blue emissive. Electrons: emissive 1.3 + fresnel
  glow, brighter sphere geometry (24 segments).
- **Trails: zero-allocation ring buffer.** Each electron has its own history
  pre-seeded along the orbit (never duplicate points → no NaN), its own
  ordered point array, and **one** `TubeGeometry` built once (32 rings × 7
  vertices). Each frame the vertices are rewritten in place — a tangent basis
  (`UP × T`, `T × X`) rebuilds every cross-section so the tube hugs the moving
  centerline — and `needsUpdate` is set. No geometry is allocated or disposed
  per frame.
- **Collider lifecycle.** The solid pedestal collider is pushed on focus and
  removed on close; at scale 0 the display never blocks the wall.
- **Delta clamp.** `Math.min(clock.getDelta(), 0.05)` guards the electron
  integration on a stalled frame.

Verified in Node: 300 simulated frames of the trail update — 0 NaN writes,
0 out-of-bounds, every ring at its exact radius, head ring 0.18 m from the
electron.

## How it was verified

- `npm run build` — chem-lab exits 0.
- Trail math simulation (Node): no NaN/out-of-bounds after 300 frames.
- Visual: clicking the picture shows the atom instantly (no freeze); trails
  sweep behind the electrons and taper cleanly.