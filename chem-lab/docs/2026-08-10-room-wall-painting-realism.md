# Room Wall Painting — Realism Pass

**Date:** 2026-08-10
**Files:** `src/room.js`
**Feature:** walls no longer a flat paint fill — a realistic two-tone painted laboratory room.

---

## Problem

All four walls were a single flat `MeshStandardMaterial({ color: 0xe7eae8 })` —
one uniform, artificial-looking surface. The room read as a box, not a real
painted room; there was no visual definition between floor, wall and ceiling.

## Change

1. **`createWallTexture()`** (new) — a 512×512 canvas painted like a real
   laboratory wall:
   - **Upper paint:** warm off-white `#e9ece9`.
   - **Dado / wainscot band:** soft blue-gray `#9fb2bd` from the floor up to
     ~1.05 m (30% of a 3.5 m wall).
   - **Break line:** a crisp `#7d8f9b` painted line between the two tones.
   - **Roller-grain mottle:** ~1,400 soft light/dark specks (6% alpha) so the
     surface is never a flat solid — real paint is never perfectly uniform.
   - **UV contract:** v=0 (wall bottom at the floor) maps to the bottom row of
     the canvas, and vertical repeat is `ClampToEdge`, so the dado band stays
     pinned at the floor regardless of wall height.
2. **Per-wall painted materials** — each of the 4 walls gets a *fresh* material
   + texture so the grain never aliases/repeats identically across walls.
3. **Ceiling cornice** (new `createTrimMaterial()` + four trim runs) — crisp
   white painted molding all around the wall/ceiling junction, framing the room.

## How it was verified

- `npm run build` passes (58 modules transformed, no errors).
- Visual: `npm run dev` → Start → walls show an off-white upper section, a
  blue-gray dado band at the floor, a crisp break line, subtle grain mottle,
  and white cornice trim at the ceiling. Back-wall accents (periodic table,
  EXIT sign, hazard stripes, windows, door) remain intact and sit on top of the
  painted wall.
