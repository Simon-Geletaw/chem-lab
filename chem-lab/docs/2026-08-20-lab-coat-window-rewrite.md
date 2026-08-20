# Lab Coat Procedural Rewrite + Centred Window + Compressed Sticker

**Date:** 2026-08-20  
**Area:** `src/coat.js`, `src/room.js`, `public/sticker/sticker3 chemistry .png`  
**Change type:** Procedural 3D rewrite, wall/window rework, asset compression

## Problem

The previous lab coat was a boxy, single-texture approximation that did not
read as a real garment on its stand, and its old change record
(`2026-08-11-lab-coat-procedural-rewrite.md`) no longer matched the code. The
right wall had a single full-height plane with the window glued in front of it,
so the window's real opening was never a hole — the wall texture showed through
the gap. The chemistry wall sticker was a 1.9 MB PNG.

## Change

| Area | Change | Result |
| --- | --- | --- |
| Coat | `coat.js` rewritten as a procedural garment: wood-texture tripod stand (hub, three splayed legs with foot caps, pole, collars, peg, finial) and a hanger with curved wood shoulders, bar, neck, collar and chrome hook, hanging a fabric coat built from an extruded torso shape with lapels, double-seam pockets, placket, buttons, side seams and a hem, plus first-person sleeves/cuffs that appear on the glove rolls when worn. | A readable lab coat and stand built entirely from primitives + two generated textures. |
| Coat interaction | `createCoat` registers both the coat and the stand as interactables, toggles via `setOn` (sleeves visible / coat hidden on wear), and the hanger is centred on the stand's pole (`z = 0`) so its hook lines up with the peg. | E at the rack wears/removes the coat with the same protocol as the other PPE. |
| Window | `room.js` splits the right wall into four painted panels around a real opening (two full-height sides, a linteel band and a sill band) using texture sampling (`v' = v·(y1−y0)/3.5 + y0/3.5`) so the dado stays glued to the floor; hazard stripes split to match; the window GLB is non-uniformly scaled to a 1.7 × 1.5 × 0.15 m landscape opening, flush-mounted and centred at z=0 between the AIT logo and the fire extinguisher, with the sky plane sized to the window only. | The window is a real hole in the wall; nothing floats over the sky. |
| Asset | `sticker3 chemistry .png` compressed 1.9 MB → 523 KB (same filename, same references). | The front-wall sticker loads ~4× faster. |

> Known visual follow-up (in-browser check): the hanger hook base sits ~0.1 m
> above the stand peg and the coat's neckline is drawn above the hanger — the
> verticals of the coat/hanger assembly are approximate. The peg and finial are
> visible when the coat is off, so nothing is removed; a later visual pass can
> re-align hook-to-peg heights if the in-browser read calls for it.

## Validation

| Check | Result |
| --- | --- |
| Build | `npm run build` passed. |
| Wall seams | Right-wall panels share the wall texture with the sides; band sampling keeps the dado height continuous; stripes line up with the panels. |
| Window | Opening spans 1.7 m wide × 1.5 m tall, sill at 0.8 m, frame flush at x≈6.96; sky plane does not exceed the opening. |
| Sticker | `main.js`/`periodicWall.js` references unchanged; asset is a same-name PNG swap. |
| Scope isolation | Only `coat.js`, `room.js`, the compressed sticker, and this change record are in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `src/coat.js` | Full procedural stand + hanger + coat rewrite, centred hook. |
| `src/room.js` | Four-panel right wall around a real window opening, split hazard stripes, non-uniform window scale. |
| `public/sticker/sticker3 chemistry .png` | Compressed 1.9 MB → 523 KB. |
| `docs/2026-08-20-lab-coat-window-rewrite.md` | Documents the change. |