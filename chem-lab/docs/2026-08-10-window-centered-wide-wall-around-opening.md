# Window — centered between logo & extinguisher, wide 1.7 m, wall around opening

**Date:** 2026-08-10 · **Area:** `src/room.js`, `diag-window.html`
**Follow-up to:** [Window — invisible-on-wall fix](2026-08-10-window-not-rendering-fix.md)

## Problem

1. **Wrong spot / cramped.** The window sat at z=+2.5 — 8 cm away from the
   fire extinguisher (z=2, `furniture.js`) — while the AIT logo occupied
   z=-2.5. The two feature walls clashed instead of reading as a layout.
2. **Portrait, not a room window.** The model scaled to a narrow 0.63 × 1.5 m
   portrait. A real room window is wide and landscape.
3. **Hole too big.** The wall gap was full-height (floor→ceiling), so above
   and below the window you saw flat sky through a huge gap instead of
   painted wall like the sides.
4. **Glass barely drew.** The SketchUp pane geometry is degenerate — ~5,000 m²
   of overlapping triangles per ~1 m² pane — it z-fights and rendered only
   ~170 px of a ~10,000 px opening (proven by an opaque-red probe).

## Change

1. **Centered position.** Window opening z ∈ [-0.87, +0.87] — the wall's
   middle, between the AIT logo (z=-2.5) and the fire extinguisher (z=2),
   with 0.85 m breathing room to each neighbour.
2. **Wide landscape window.** Non-uniform scale sizes each axis explicitly:
   `scale(1.7 / width, 1.5 / height, 0.15 / depth)` → 1.7 m wide × 1.5 m
   tall × 0.15 m thick. The frame reads as a real built-in window.
3. **Wall above AND below the window.** The right wall is now FOUR pieces:
   two full-height side panels (z ±[0.87..5]) plus a linteel band
   (y 2.3..3.5) and a sill band (y 0..0.8) — real painted wall like the
   sides. A `paintBandMat(y0, y1)` helper samples just the band's slice of
   the 3.5 m wall texture (`repeat.y`, `offset.y`), so the blue-gray dado
   band stays glued to the floor on the sill wall exactly like the sides.
   The hazard stripe under the wall is split into three pieces (4.13 +
   1.74 + 4.13 m) so the line stays continuous beneath the sill.
4. **Clean replacement glass.** The original `Glass_Crystal` meshes are
   hidden (`visible = false`) and replaced with two single transparent
   planes — one per frame cell (0.69 m and 0.68 m wide, 1.39 m tall), inset
   2 cm behind the frame's front face. Material: cool tint `0xbfd8ea`,
   50% opacity, DoubleSide, `depthWrite: false`. Two draw calls instead of
   hundreds of degenerates — and the sky reads through them.
5. **Sky only in the window.** The gradient sky plane is sized to the window
   (2.2 × 1.9 m vs the 1.7 × 1.5 m opening, ~0.25 m margin at x=9). The
   wall bands now hide its top and bottom; the side panels hide its edges —
   nothing of the outside is visible beyond the window frame.

## How it was verified

Headless-browser frame-diffs (diag-window.html, dev server + `msedge
--headless --dump-dom`), all states rendered from the app's default camera
looking at the window:

| Metric | Pixels |
|---|---|
| A) OLD window over solid wall (baseline) | **233** |
| B) NEW window over opening wall | **6,172** (≈27× more) |
| C) sky visible through the opening | 6,313 |
| D) wall bands above/below restore | 14,532 |
| E) clean glass panes' own footprint | 12,610 |

- **Build:** `npm run build` passes.
- **Visual:** `npm run dev` — right wall center: a wide aluminum-framed
  window with two glazed panes showing the blue sky, painted wall above and
  below it, dado band and hazard stripe running unbroken beneath the sill,
  the logo to its left and the extinguisher to its right.