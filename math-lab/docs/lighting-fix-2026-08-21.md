# Math Lab Lighting Fix — Right-Wall Window Opening

**Date:** 2026-08-21  
**Scope:** One isolated lighting-related room-geometry correction.  
**Planned commit:** `fix(room): restore right-wall window opening`

## Symptom and diagnosis

The right side of the Math Lab could present an incorrect lighting appearance around the window because the two wall panels surrounding the window opening were constructed with the full remaining wall depth rather than the width of one individual side panel.

The room configuration is 10 metres deep and the window opening is 1.7 metres wide. The existing code already calculates the intended side-panel width as `(10 - 1.7) / 2 = 4.15` metres through `sidePanelZ`, but the meshes were created with `geometry.depth - windowWidth = 8.3` metres each. This allowed the two panels to extend into the window area.

## Fix applied

Both right-wall panel geometries in `src/room.js` now use `sidePanelZ` as their width. Their positions, rotations, materials, shadow flags, and all lighting values remain unchanged.

| Concern | Before | After |
|---|---|---|
| Right-wall panel width | `geometry.depth - windowWidth` (`8.3` m) | `sidePanelZ` (`4.15` m) |
| Window opening | Could be overlapped by wall geometry | Preserved between the two side panels |
| Lights | Unchanged | Unchanged |
| Shadows | Unchanged | Unchanged |
| Quality presets | Unchanged | Unchanged |
| Per-frame work | Unchanged | Unchanged |
| Geometry feature | Not touched | Not touched |
| Server-driven loading | Not touched | Not touched |

## Files changed

| File | Change |
|---|---|
| `src/room.js` | Corrected the width of the two right-wall side panels. |
| `docs/lighting-fix-2026-08-21.md` | Recorded the symptom, diagnosis, scope, validation, and rollback information. |

No Geometry module, server-data endpoint, lighting intensity, shadow configuration, or quality logic was changed in this fix.

## Validation

The Math Lab production build completed successfully with `npm --prefix math-lab run build`. The build transformed 35 modules and emitted the expected application and Three.js vendor chunks. The isolated Git diff contains two changed source lines and no unrelated source modifications.

The change does not add meshes, lights, materials, textures, event listeners, or per-frame operations. Its expected runtime cost is neutral while the corrected opening restores the intended scene layout and window/sky visibility.

A final visual check should inspect the entrance view, window-facing view, right-wall/Geometry area, floor shadowing, and the exit-door interaction in both normal quality and `?quality=low`. If the original lighting symptom remains after this correctness fix, that will be treated as a separate lighting task requiring a new diagnosis and approval.

## Rollback

Revert the commit containing this file and the two `room.js` replacements. No data migration or asset rollback is required.
