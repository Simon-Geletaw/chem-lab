# Window — flush-mounted at z=+2.5 with gradient sky backdrop

**Date:** 2026-08-10 · **Area:** `src/room.js`

## Problem

The real 3D window (`public/Models/window.glb`, a SketchUp-era multi-pane
window with transparent glass, alpha 0.1) was parked crudely on the right wall:

- **Bad position** — scale-boxed to 2 m tall and placed at z=0, while the AIT
  logo sits at z=-2.5, so the wall read unbalanced.
- **Wrong scale** — a "full-height" 2 m window, far taller than the posters and
  furniture it shared the wall with.
- **No sky** — the model's glass panes ARE transparent, but what is behind them
  is solid wall paint. The blue `scene.background` (0x9fbdd6) never shows
  because the walls fully enclose the room, so the window looked like a flat
  grey pane, not a window.
- **Crude mounting** — the position was set center-out without measuring the
  rotated bounds, so the 1.65 m-deep frame body jutted partway into the room
  instead of sitting inside the wall.

## Change

1. **Waist-height scale:** scale is now 1.5 / model height (model ships ~80
   units tall) instead of 2.0 — the window stands 1.5 m tall.

2. **Flush mount:** the rotation (`y = π/2`) is applied FIRST, then the
   rotated `Box3` is measured, then the mesh is pinned so:
   - its inner frame face sits at x = 6.96 (the wall plane at x=7, 4 cm proud —
     the same inset the old procedural frames used);
   - its base rests on the sill line at y = 0.8 (top lands at 2.3 m);
   - it is centered at z = +2.5, mirroring the AIT logo at z=-2.5 so the two
     halves of the right wall balance.
   The 1.24 m-deep frame body now passes cleanly through the zero-thickness
   wall plane to the outside (outer face at x = 8.196).

3. **Gradient sky backdrop:** a new `createSkyTexture()` canvas texture — deep
   zenith blue (#2f5c8f) fading through mid sky (#7fa8c9) to a pale misty
   horizon (#d9e7f1), matching the scene's late-afternoon mood. Applied to a
   `MeshBasicMaterial` (unlit, because sky is self-illuminated) plane at
   x = 9, behind the window, 2.5 × 2.6 m — about 4× the 0.63 × 1.5 m opening,
   so its edges can never peek around the frame; the plane faces into the room
   (`rotation.y = -π/2`). Through the model's transparent glass panes it now
   reads as real sky. The backdrop is positioned clear of the frame's outer
   end (8.196 < 9) so nothing clips.

## How it was verified

- **Numerical check:** a Node script loaded `window.glb` with the real
  `GLTFLoader`, applied the exact scale/rotation/position code, and reported
  the final world-space bounds:
  `inner face 6.960 · outer end 8.196 · sill 0.800 · top 2.300 · z center 2.500`
  — every value matches the design above.
- **Build:** `npm run build` passes.
- **Visual:** open the lab (`npm run dev`), look at the right wall — the
  window hangs waist-height at the wall's right third, the logo balances the
  left third, and the glass shows a blue gradient sky instead of wall paint.