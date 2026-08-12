# Start Page Renders Over the Completed Lab

**Date:** 2026-08-12  
**Area:** `src/ui/loader.js`, `index.html`  
**Change type:** Startup visual-transition fix

## Problem

The loading screen reached 100% and then faded away before the current start page was presented. During that handoff, the browser could expose a white or blank page frame instead of the completed Three.js laboratory, making the transition feel unfinished.

The existing start-page content and format were explicitly retained. The fix changes only the timing and backdrop through which it appears.

## Fix

| Stage | Previous behaviour | Corrected behaviour |
| --- | --- | --- |
| Loading completion | The loading screen faded, then the start overlay was set to `display: flex` after a 500 ms timeout. | The overlay is permanently in the layout but hidden with opacity and visibility until it is ready to fade in. |
| First game frame | The transition did not explicitly wait for a completed world frame. | The loader waits for two animation frames after boot completion, ensuring the already-running game loop has drawn the finished lab before UI changes. |
| Start-page reveal | A light translucent screen could be the first exposed visual. | The existing card fades in over the rendered lab using a darker translucent backdrop. |
| Fallback page colour | Browser-default white could appear during canvas exposure. | The root page background is fixed to deep lab blue-black (`#071018`). |
| Loading DOM cleanup | The loading screen was hidden and then removed. | It fades normally and is removed only after its 360 ms transition completes. |

> The lab is now the persistent visual backdrop. After loading hits 100%, the player sees the completed 3D scene first, and the existing start page fades in over it without a white or blank intermediate frame.

## Performance

The startup handoff adds no assets, scene objects, render passes, or per-frame update work. The only runtime change is two nested `requestAnimationFrame` calls at completion, which run once to synchronize the DOM transition with the already-running renderer. The loading screen is still removed once its fade ends, so it does not remain in the DOM during gameplay.

## Validation

| Check | Result |
| --- | --- |
| Loader flow review | Confirmed the start-overlay `ready` class and loading-screen `done` class are applied together only after two rendered frames. |
| Canvas fallback review | Confirmed the page background is deep blue-black instead of browser-default white. |
| Existing start-page format | Preserved the current start-card markup and interaction model. |
| Production build | `npm run build` passed; Vite transformed 67 modules. |
| Scope isolation | Only the loader, start-overlay CSS, and this documentation are included in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `src/ui/loader.js` | Synchronizes the loading-screen fade and start-page reveal with rendered game frames. |
| `index.html` | Keeps the start page hidden until ready, fades it over the lab, and supplies a dark fallback page background. |
| `docs/2026-08-12-start-page-renders-over-lab.md` | Documents the cause, implementation, validation, and performance behaviour. |
