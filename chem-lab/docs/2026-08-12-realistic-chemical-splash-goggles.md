# Realistic Chemical-Splash Goggles

**Date:** 2026-08-12  
**Area:** `src/eyegoggles.js`  
**Change type:** Visual feature refinement and first-person view correction

## Request and Design Decision

The safety goggles needed to read as genuine laboratory chemical-splash goggles, especially as the physical prop on the PPE station. The approved design is a **clear chemical-splash goggle** rather than open safety glasses or tinted eyewear.

## What Changed

| Area | Implementation | Result |
| --- | --- | --- |
| Physical PPE prop | Rebuilt the resting goggles as two clear wraparound cups with dark silicone-style gasket rings, a centre bridge, four vent details, strap adjusters, lens highlights, and a curved elastic strap. | The object has the silhouette and construction cues of sealed laboratory splash goggles from multiple viewing angles. |
| Dispenser | Retained the interactable PPE dispenser and added a clear `CHEMICAL SPLASH GOGGLES` label. | The interaction point remains identifiable and communicates the item type. |
| Worn first-person view | Replaced the former generic overlay with two rounded gasket silhouettes, a centre bridge, extremely light clear lens tint, and restrained lens highlights. | The player sees that goggles are worn without blocking the crosshair, pouring stream, or centre of the view. |
| Gameplay compatibility | Preserved the `goggleBox` interaction flag, `wear()` / `remove()` API, HUD updates, PPE-zone gating, and box visibility toggle. | Existing hand controls, restart logic, and HUD integration continue to work. |

## Performance Decisions

The model is created only once when the PPE station is initialized. It has no per-frame animation, no asynchronous asset loading, and no update-loop work. Repeated physical parts reuse their geometries and materials, while the curved strap uses a single low-segment tube. The first-person overlay uses inexpensive `MeshBasicMaterial` rendering and shares one geometry/material set across both eye cups. The clear lens opacity is intentionally low to avoid visual clutter and unnecessary transparency stacking.

> The prioritised visual fidelity is the physical prop. The worn overlay remains deliberately subtle so that safety equipment does not interfere with laboratory interaction.

## Validation

| Check | Result |
| --- | --- |
| Production build | Passed with `npm run build`. |
| Module transformation | Vite transformed 67 modules successfully. |
| Interaction compatibility review | Confirmed the hand controller raycasts recursively and resolves the parent `goggleBox` flag, so the nested prop meshes remain interactable. |
| Existing build notice | Vite continued to report the project-wide post-minification large-chunk notice; this change does not introduce runtime-loaded assets or a new frame update. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `src/eyegoggles.js` | Lightweight realistic chemical-splash goggle prop, dispenser, and first-person overlay. |
| `docs/2026-08-12-realistic-chemical-splash-goggles.md` | This feature record, including performance decisions and validation evidence. |
