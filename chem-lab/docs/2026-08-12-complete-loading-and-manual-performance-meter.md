# Complete Loading Preparation and Manual Performance Meter

**Date:** 2026-08-12  
**Area:** `src/main.js`, `src/quality.js`  
**Change type:** Startup-readiness and diagnostic-UI refinement

## Problem

The start page could appear while final GPU preparation was still occurring, which made the laboratory feel as though it was continuing to load after the loading page had completed. In addition, the FPS and frame-time readout appeared automatically in the player-facing interface even though it is a diagnostic tool rather than gameplay UI.

## Implementation

| Area | Change | Result |
| --- | --- | --- |
| GPU preparation | Kept effect warm-up behind the loading screen, then explicitly compiled the completed scene and submitted a full initial render before starting the normal animation loop. | The room, materials, and effect resources are prepared while the loading page is still visible. |
| Loading progress | Added a dedicated `Preparing the laboratory view…` stage before compilation and a `Lab ready…` completion stage after the initial render. | The progress copy now reflects the final work that occurs before the start page is allowed to appear. |
| Start-page readiness | The existing two-frame loader handoff now runs after scene construction, effect warm-up, GPU compilation, and initial render. | The start page is presented only when the lab is ready behind it. |
| Performance indicator | Changed the FPS/frame-time meter from visible by default to hidden by default. | Players start without diagnostic clutter. |
| Manual access | Preserved the `P` shortcut that toggles the performance meter. | Developers, teachers, and troubleshooters can display or hide the meter on demand. |

> The loading page now owns all heavyweight startup preparation. Seeing the start page means the interactive laboratory has completed its scene construction, effect warm-up, shader compilation, and initial render.

## Performance Considerations

`renderer.compile(scene, camera)` and one `renderer.render(scene, camera)` now occur once during loading. This moves potential first-frame shader compilation and resource-upload cost away from the user-facing start screen. The change adds no new per-frame work. When hidden, the FPS meter returns before collecting frame statistics, so its diagnostic calculations do not run until the user presses **P**.

## Validation

| Check | Result |
| --- | --- |
| Startup sequence review | Confirmed effect warm-up, compile, initial render, then animation loop occur before `loader.done()`. |
| Performance meter review | Confirmed the meter starts with `visible = false` and `display: none`; `P` remains the manual toggle. |
| Production build | `npm run build` passed; Vite transformed 67 modules. |
| Scope isolation | Only `src/main.js`, `src/quality.js`, and this change record are included in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `src/main.js` | Completes GPU preparation and the initial lab render under the loading page. |
| `src/quality.js` | Hides the performance readout by default while retaining the `P` toggle. |
| `docs/2026-08-12-complete-loading-and-manual-performance-meter.md` | Documents the startup/readiness and diagnostic-display behaviour. |
