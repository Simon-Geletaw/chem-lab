# Atomic-structure sticker — fills the open back-wall space left of the periodic table

**Date:** 2026-08-11 · **Area:** `src/periodicWall.js`, `src/main.js`, `public/sticker/`

## Problem

The back wall carried only the periodic-table poster, centered on x=0. That
left a ~4.9 m run of completely empty painted wall between the poster's left
edge (x ≈ -2.1) and the left-wall corner (x = -7) — a dead zone with no visual
anchor, while the right side of the room already has the window, the AIT logo
and the fire extinguisher.

## Change

1. **New `createWallSticker(scene, url, x)` in `src/periodicWall.js`** — hangs
   `public/sticker/sticker-1-atomic-structure-1.png` (1536×1024, 1.5:1) on the
   open band left of the poster (called with `url` = the sticker's path and
   `x` = its center; the same function later hangs the second sticker on the
   right band — see [sticker-right-of-periodic](2026-08-11-sticker-right-of-periodic.md)):
   - **Size:** 1.8 m wide × 1.2 m tall (keeps the image's native 1.5:1 aspect —
     big enough to read as a feature, small enough not to crowd the poster).
   - **Position:** x = -4.55 (centered in the free band, ~1.55 m breathing room
     to both the poster edge and the wall corner), y = 1.7 (same eye-height
     center as the AIT logo on the right wall; bottom edge 1.1 m sits just
     above the 1.05 m wainscot break line), z = -4.98 (level with the poster
     board at -4.99, in front of the wall face).
   - **Presentation:** plain canvas, no frame. The PNG is transparent, so the
     painted wall shows through its empty pixels — same treatment as the AIT
     logo. Unlit `MeshBasicMaterial` (like the poster tiles): the image carries
     its own lighting, no per-pixel light cost.
   - **Interactivity:** decorative only — not pushed to `interactableObjects`.
2. **Wired in `src/main.js`** — `createWallSticker(scene)` is called right
   after `createPeriodicWall(scene, interactableObjects)` so the wall art loads
   together behind the loading screen.

## How it was verified

- **Build:** `npm run build` passes.
- **Visual:** `npm run dev` — looking at the back wall from the room center:
  the sticker hangs centered in the open space left of the periodic-table
  poster, 1.8 × 1.2 m, sitting above the wainscot line, transparent pixels
  letting the wall paint show through, no overlap with the poster board
  (≈1.55 m gap) or the left-wall chemical shelves (they run along x = -6.85,
  z = -1 — around the corner, not on the back wall).
