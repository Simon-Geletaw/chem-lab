# Chemistry sticker — front wall, between the Biology and the exit door

**Date:** 2026-08-11 · **Area:** `src/periodicWall.js`, `src/main.js`, `public/sticker/`
**Follow-up to:** [Atomic-structure sticker — right of the periodic table](2026-08-11-sticker-right-of-periodic.md)

## Problem

The front wall carries the three simulation doors (Biology x=-5.8, Mathematics
x=-4.0, Physics x=-2.2 — each 1.0 m wide) and the exit door (x=3, 0.9 m wide).
Between the Biology door and the exit door there is one large free band of bare
painted wall — between the Physics door's right edge (x=-1.7) and the exit
door's left edge (x=2.55) — while the smaller gaps between doors are only
0.8 m, too narrow for a 1.8 m canvas. A third sticker (chemistry, same 1.5:1
atomic-structure series) fills that band.

## Change

1. **`createWallSticker(scene, url, x, z, rotY = 0)` extended** in
   `src/periodicWall.js` — the shared builder gains the wall-plane depth and
   rotation: `z = -4.98` for the back wall (plane already faces +z, i.e. into
   the room) and `z = 4.97` with `rotY = Math.PI` for the front wall (the
   plane's front face points +z by default, so it must be flipped to face the
   room — exactly like the EXIT sign and the sim-door lightboxes). Everything
   else stays the same: 1.8 m × 1.2 m, plain transparent canvas, unlit
   `MeshBasicMaterial`, decorative only, y = 1.7 (eye height, bottom edge just
   above the 1.05 m wainscot break line).
2. **Third call in `src/main.js`** —
   `createWallSticker(scene, '/sticker/sticker3%20chemistry%20.png', 0.425,
   4.97, Math.PI)`.
   - **Position:** x = **+0.425** — centered in the 4.25 m free band between
     the Physics door frame (right edge -1.7) and the exit door frame (left
     edge 2.55), leaving ~1.23 m of painted wall to each side.
   - **URL:** `sticker3 chemistry .png` contains spaces, encoded as `%20`
     (same pattern as the AIT logo and sticker 2).
   - **Footprint check:** the PNG is 1536×1024 (1.5:1), same as stickers 1 and
     2, so the shared geometry fits. Unlike them it is FULLY OPAQUE (no
     transparent pixels) — the `transparent: true` material renders it
     identically, just without the wall showing through.
   - **No collisions:** the exit sign (x=3, y=2.55) sits above the exit door,
     the coat stand (x=3.7), PPE table (x=5.2) and trash bin (x=3.35) all
     stand right of the exit door — the sticker's band x -0.475..1.325 is
     clear wall.

## How it was verified

- **Build:** `npm run build` passes; the new PNG is copied to `dist/sticker/`
  by the public-folder pass.
- **Visual:** `npm run dev` — looking at the front wall from the room center:
  the chemistry sticker hangs centered between the Physics door and the exit
  door at eye height, reading as the fourth element of the wall's display row
  (Biology / Mathematics / Physics signs, then the chemistry canvas, then the
  EXIT lightbox). Back-wall stickers are unaffected (still ±4.55, z=-4.98).
