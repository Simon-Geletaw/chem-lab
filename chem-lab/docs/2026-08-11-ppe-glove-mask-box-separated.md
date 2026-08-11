# PPE station — glove and mask boxes separated (gloves box visible)

**Date:** 2026-08-11 · **Area:** `src/mask.js`

## Problem

On the PPE bench by the door the two dispenser boxes sat 0.25 m apart —
exactly the glove box's own width. Both boxes carry a 0.25 rad rotation, and
at that spacing the rotated corners measure a **−0.001 m edge gap: the boxes
physically touch**. From the door (the approach side) the mask box clipped
the glove box's NITRILE GLOVES label and the two boxes read as one crowded
blob, so the gloves box was hard to see and to aim at.

## Change

The mask box moved from `ZONES.ppe.x - 0.25` to **`ZONES.ppe.x - 0.5`** in
`src/mask.js`:

| Mask box offset | Edge gap (rotated corners) |
|---|---|
| 0.25 m (OLD) | −0.001 m — touching |
| **0.50 m (NEW)** | **+0.249 m** |

Both boxes stay centered on the 3 m PPE bench (mask still 1.35 m clear of
the biohazard bin at `ppe.x - 1.85`), inside the `ppe` zone that gates
gloving/masking, and within the 2.5 m E-reach from the approach side.

## How it was verified

- **Geometry probe (rotated-corner math):** gap goes from −0.001 m to
  +0.249 m at the 0.5 m offset.
- **Build:** `npm run build` passes.
- **Aim:** `aimAt('gloveBox')` / `aimAt('maskBox')` still resolve
  independently from in front of the station — the boxes no longer overlap
  each other's rays.
- **Visual:** `npm run dev`, look at the PPE station from the door — glove
  box (blue) and mask box (green) sit clearly apart on the bench, both
  labels readable side by side.