# Lab coat — invisible-on-hanger fix (coat scaled from its own bounds)

**Date:** 2026-08-11 · **Area:** `src/coat.js`
**Follow-up to:** [Lab coat — coat rack beside the exit door, E to wear (PPE
layer 1)](2026-08-10-lab-coat.md)

## Problem

The white coat was not visible in the room — the rack stood bare. Reading the
GLB chunks proved WHY:

| Model | World-space bounds | Scaled by `rackScale` (0.00577) |
|---|---|---|
| `coat_hanger.glb` | **311.82 m tall** (Sketchfab scene node scale) | 1.8 m — the rack looks right |
| `white_coat.glb` | **1.09 m tall** (node rotation already stands it upright) | **0.006 m = 6 mm — a speck** |

`src/coat.js` scaled the coat with the hanger's scale factor:
`coatGroup.scale.setScalar(rackScale)` where `rackScale = 1.8 / 311.82 ≈ 0.0058`.
That factor is correct for the 312 m hanger model, but applied to the 1.09 m
coat it shrank the coat to a 6 mm white speck at the top of the rack — the
coat was *in the room*, just microscopic.

## Change

1. **The coat is now sized from ITS OWN bounds.** `tryHangCoat()` measures
   the coat's pre-scale height and normalizes it to its authored size:
   `coatGroup.scale.multiplyScalar(COAT_HEIGHT / preSize.y)` with
   `COAT_HEIGHT = 1.09 m` — proportionate to the 1.8 m rack, like a real lab
   coat on a real rack. The normalization is idempotent (the height is
   already `COAT_HEIGHT` on every later call), so repeated settles are safe.
   The hang math is unchanged — the coat's top meets the hook point, centered
   in x/z.
2. **Procedural fallbacks are removed when the GLB arrives.** `settle()` can
   now build the procedural coat before the coat GLB finishes decoding
   (settle runs after *every* load attempt); the fallback stayed in the scene
   when the real coat took over, leaving a duplicate boxy coat at the floor.
   `fallbackRack` / `fallbackCoat` are tracked and removed the moment the
   downloaded models load.

## How it was verified

- **Numbers (node probe of the GLB chunks + hang math):**
  - OLD: coat scale 0.00577 → coat height **0.006 m** (invisible).
  - NEW: coat scale 0.9954 → coat height **1.09 m**, coat top at the hook
    (y = 1.25 m), coat spans **y 0.71 .. 1.25 m**.
- **Build:** `npm run build` passes.
- **Visual:** `npm run dev`, look at the rack beside the exit door — a
  1.09 m white lab coat hangs from the hook, with the sleeves/waist clearing
  the rack pole; press E → the coat vanishes from the hanger (sleeves appear
  on the wrists), [E] again → it reappears.
- **DRACO:** unchanged — the coat GLB still decodes via `/draco/` wasm.