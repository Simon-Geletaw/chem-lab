# Floor Tiles — Realism Pass

**Date:** 2026-08-10
**Files:** `src/room.js`
**Feature:** the floor now reads as real glazed ceramic laboratory tiles, not a flat vinyl checkerboard.

---

## Problem

The floor was a 512×512 canvas drawn as a flat, low-contrast vinyl checker: a
uniform solid fill, hairline grout, and faint speckle. With flat lighting every
square looked identical and the surface read as a single artificial sheet.

## Change

1. **`createFloorTexture()` rewritten** — a 1024×1024 canvas (higher resolution,
   same 8×8 tile grid → 0.5 m per tile, so the existing `repeat(3.5, 2.5)` scale
   is unchanged):
   - **Grout bed first** — the canvas is filled with the seam color and each
     tile is drawn *inset* on top, so the seams are crisp, uniform and thicker
     (~10 px ≈ real 1 cm grout) instead of hairline strokes.
   - **Per-tile tone variation** — every tile rolls a random multiplier
     (`0.96–1.04`) so no two tiles are the same shade (real tile has batch tone
     drift).
   - **Diagonal bevel gradient** — each tile is lighter top-left → darker
     bottom-right, so it catches the area-light like real glazed ceramic instead
     of lying flat.
   - **Internal speckle** per tile to break glassy uniformity.
2. **Floor material tuned** — `roughness: 0.7 → 0.5`, `metalness: 0.1 → 0.05`,
   a subtle glazed sheen without looking slippery.

## Design note (adjustment from plan)

The original plan proposed an additional tile **cove-base strip** rising ~0.12 m
up the walls. This was **not added**: the room already carries yellow/black
**hazard stripes at the base of the back/left/right walls** (y 0–0.14 m), and a
second base strip would visually collide with them. Keeping the hazard stripe is
the more realistic laboratory detail, so the tile work is focused on the floor
itself.

## How it was verified

- `npm run build` passes (no errors).
- Visual: `npm run dev` → Start → floor shows crisp grout seams, tiles with
  individual tone + a light-catching bevel, and a gentle sheen; the 0.5 m tile
  scale and 14×10 m coverage are unchanged.
