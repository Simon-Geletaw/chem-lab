# Peripheral Clear-Goggle Point-of-View Replacement

**Date:** 2026-08-12  
**Area:** `src/eyegoggles.js`  
**Change type:** First-person-view design replacement

## Problem

The preceding worn-goggle overlay was rejected because it appeared artificial and visually unattractive. Its broad continuous frame and centre-adjacent geometry made the goggles read as a decorative screen mask rather than equipment naturally perceived close to the wearer’s face.

Clear chemical-splash goggles must protect the eye sockets and surrounding facial area while allowing unrestricted vision and movement.[1] The point-of-view treatment therefore needs to communicate that equipment is worn without turning the clear lens into a visible opaque overlay.

## Replacement Design

| Design decision | Implementation | Effect in play |
| --- | --- | --- |
| Remove the screen-mask frame | Deleted the full rounded rectangular perimeter, brow bar, central lens-space geometry, and decorative reflections. | The view no longer looks like a graphic overlay pasted onto the camera. |
| Use peripheral geometry only | Added two short upper-corner frame segments and two side seals positioned beyond the working field of view. | The wearer notices a real gasket boundary only at the edge of vision. |
| Preserve a minimal near-face cue | Added a small, low nose-seal curve beneath the crosshair. | The goggles retain a physical wearing cue when looking toward the bench without covering interaction targets. |
| Model clear-lens perception correctly | Kept the centre of the camera completely free of geometry and tint. | The lens reads as optically clear rather than as a coloured visor. |
| Reduce visual weight | Used two low-opacity blue-grey materials and eight low-segment tube meshes. | The worn view is quieter, lighter, and closer to peripheral awareness than a heads-up-display effect. |

> The deliberate design principle is **subtle recognition rather than constant obstruction**: when looking forward, a wearer should mostly see the task; the goggle seal should be noticed only at the outer boundary of vision.

## Performance and Integration

The replacement performs no per-frame work and creates no runtime-loaded resources. It uses two `MeshBasicMaterial` instances, five outer gasket segments, two thin inner-edge segments, and one small nose-seal segment. The former full-frame shape meshes and decorative reflection meshes were removed.

The production build passed after the replacement. The generated JavaScript output is **1,077.66 kB** uncompressed and **325.33 kB** gzipped, with the existing project-wide large-chunk advisory unchanged. The `goggleBox` interaction flag, PPE-zone gating, HUD state change, dispenser visibility toggle, and `wear()` / `remove()` API were not modified.

## Validation

| Check | Result |
| --- | --- |
| Module syntax | Passed `node --check` before transfer. |
| Production build | Passed `npm run build`; Vite transformed 67 modules. |
| Central-view protection | No geometry or tint is rendered across the central task-view area. |
| Performance posture | No update-loop operations, no texture requests, and low-segment reusable geometry only. |

## References

[1]: https://ehs.princeton.edu/book/export/html/289 "Princeton Environmental Health & Safety — Eye and Face Protection"
