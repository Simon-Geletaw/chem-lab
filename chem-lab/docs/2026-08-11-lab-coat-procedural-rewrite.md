# Lab coat — fully procedural wardrobe, placed beside the exit door

**Date:** 2026-08-11 · **Area:** `src/coat.js`, `src/zones.js`,
`public/Models/coat_hanger.glb` (removed), `public/Models/white_coat.glb`
(removed), `public/draco/` (removed)

**Follow-up to:** [Lab coat — E-toggles ON/OFF at the rack](2026-08-11-lab-coat-e-toggle.md)

## Problem

The coat came from downloaded GLB models and was placed through runtime
bounds-scaling, which had been the source of endless layout trouble: the coat
kept showing up near the room's centre / not visibly hanging on a hanger, and
the rack placement didn't read as a wardrobe by the door. Both coat GLBs were
also in a bad state — `white_coat.glb` was deleted from the repo while
`coat.js` still loaded it, and the hanger GLB carried a ~312 m authored scale
that needed fragile per-run normalisation — plus a DRACO decoder (`public/draco/`)
that only existed to decode the now-deleted coat model.

## Change

1. **`src/coat.js` rewritten — a single deterministic procedural wardrobe.**
   No GLBs, no DRACO, no runtime scaling. One unit: a wooden coat stand (floor
   base, pole, crossbar hanger, top knob) with a white lab coat (hanger loop,
   squared torso, two sleeves, collar — woven-fabric texture) hanging from the
   crossbar. The coat is the E target (`userData.coat`); `setOn` hides just the
   coat part on the stand so "wear → coat leaves the stand" and "E at the stand
   → coat hangs again" work exactly as before.
2. **Placement — explicit and out of the middle.** The wardrobe sits at
   `ZONES.coat = (x=3.7, z=4.6)`, flush against the front wall (z = 5) just
   right of the exit door (x = +3) — clearly a corner wardrobe, ~4.5 m away from
   the reaction bench at `(0, -1.5)` and clear of the walking path.
3. **`src/zones.js`** — the `coat` zone moved to the wardrobe's position
   `(3.7, 4.6)` so the E-toggle gate lines up with the object.
4. **Dead assets removed** — `public/Models/coat_hanger.glb` (the old hanger,
   now fully replaced by the procedural stand), `public/draco/` (the decoder
   nothing references anymore), and the already-deleted `white_coat.glb`.
   Nothing in `src/` loads or references any of them.
5. **Performance** — no GLB fetch, no DRACO wasm download, no per-frame
   bounds/projection work; a few shared materials and one small canvas texture.

Behavior is unchanged: aim at the coat → `[E] Put on lab coat`; E → coat leaves
the stand + white sleeves on the wrists + HUD chip green; E at the stand while
worn → the coat hangs again. Wearing the coat never blocks the experiment
(see the non-blocking warning doc).

## How it was verified

- **Syntax:** `node --input-type=module --check` passes for `src/coat.js` and
  `src/zones.js`; Vite transforms all modules cleanly.
- **Grep:** no `coat_hanger`, no `white_coat`, no `setDRACOLoader`, no
  `public/draco` reference remains in `src/`.
- **Geometry:** stand base (Ø ~0.44 m) at (3.7, 4.6) clears the exit door
  (right edge x = 3.45) and the front wall (z = 5); coat hangs from the
  crossbar at y = 1.5 down to ~0.7 m.
- **Visual (`npm run dev`):** the wooden stand + white coat sit beside the exit
  door in the front-right, well away from the middle; E toggles wear/unwear.
