# Atomic-structure sticker — fills the open back-wall space right of the periodic table

**Date:** 2026-08-11 · **Area:** `src/periodicWall.js`, `src/main.js`, `public/sticker/`
**Follow-up to:** [Atomic-structure sticker — left of the periodic table](2026-08-11-atomic-structure-sticker-left-wall.md)

## Problem

The first sticker filled the back wall's open band LEFT of the periodic-table
poster, but the band on the other side — between the poster's right edge
(x ≈ +2.1) and the right-wall corner (x = +7) — was still a ~4.9 m run of bare
painted wall, breaking the visual symmetry of the chemistry display wall.

## Change

1. **`createWallSticker(scene, url, x)` generalized** in `src/periodicWall.js` —
   the one-sticker function from the left-wall change now takes the sticker's
   texture URL and its x-center as parameters, so both sides of the poster are
   driven by the same builder (identical size, height, depth, material).
   (The signature later grew a `z` and `rotY` param when the third sticker
   moved to the front wall — see
   [sticker-front-wall-chemistry](2026-08-11-sticker-front-wall-chemistry.md).)
   - **Size:** 1.8 m wide × 1.2 m tall (1.5:1 — matches the PNG's native ratio).
   - **Position:** x = **+4.55** (mirror of the left sticker, centered in the
     free band with ~1.55 m breathing room to both the poster edge and the
     wall corner), y = 1.7 (same eye-height center as the AIT logo; bottom
     edge 1.1 m above the 1.05 m wainscot break line), z = -4.98 (level with
     the poster board).
   - **Presentation:** plain canvas, no frame; the PNG is transparent, so the
     wall paint shows through its empty pixels. Unlit `MeshBasicMaterial` —
     no per-pixel light cost.
   - **Interactivity:** decorative only — not pushed to `interactableObjects`.
2. **Second call in `src/main.js`** — `createWallSticker(scene, '/sticker/
   sticker-2%20c2h205%20.png', 4.55)` runs right after the left sticker.
   The new file is `sticker-2 c2h205 .png` — its spaces are URL-encoded as
   `%20`, the same pattern already used for the AIT logo
   (`/Logo/AIT%20logo%20.png`).
3. **Verified asset sizes:** `sticker-2 c2h205 .png` is 1536×1024 (1.5:1,
   transparent) — identical footprint to sticker 1, so the shared 1.8 × 1.2 m
   geometry needs no per-image sizing.

## How it was verified

- **Build:** `npm run build` passes; the new PNG is copied to
  `dist/sticker/sticker-2 c2h205 .png` by the public-folder pass.
- **Visual:** `npm run dev` — looking at the back wall from the room center:
  two identical-sized stickers flank the periodic-table poster symmetrically
  (±4.55, 1.55 m clear of the board), both sitting above the wainscot line at
  eye height, transparent pixels letting the wall paint through. Nothing on
  the right band collides: the window, AIT logo and fire extinguisher all live
  on the RIGHT wall (x = +7), not the back wall.
