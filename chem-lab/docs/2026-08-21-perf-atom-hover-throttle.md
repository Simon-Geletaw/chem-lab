# 2026-08-21 — Perf: atom hover raycaster + tooltip on every 2nd frame

## Problem
While the 3D atomic model was out, `AtomicStructure.update()` drove the hover
raycaster + emissive boost every single frame. Even when the cursor was still,
the crosshair picked up, the DOM tooltip re-positioned/populated, and the
`getHovered()` → emissive-boost chain refreshed at 60 Hz. A tooltip doesn't
need 60 Hz pointer precision, and halving that work is free smoothness on the
weakest laptops.

## Change
- **`chem-lab/src/ui/atomicStructure.js`** — the hover block in `update()` now
  only runs on even frames: a `_hoverTick` counter gates `this._hover.update()`
  and the emissive boost together. Electrons, orbit rings, trails and the
  nucleus pulse still animate at the full frame rate (their math lives
  upstream of the hover block).
- Raycasting, `intersectObjects`, tooltip `_populate()` and the `atm-vis`
  class-toggles now happen at half rate — visually identical, roughly half the
  hover cost per frame.
- `_hoverTick` is initialized in the constructor.

## Verification
- `npm run build` — all four labs exit 0.
- Static read-through: the hover path is unchanged logically, only gated by the
  parity of `_hoverTick`; all meshes still register and the tooltip still
  follows the cursor.
- Manual check (user's browser): with the atom out, hover electrons, orbit
  rings, the nucleus and the pedestal — identical tooltip + glow, and the
  atom's animated parts never pause.