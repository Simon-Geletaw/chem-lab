# Pause-Only Fullscreen Control

**Date:** 2026-08-12  
**Area:** `index.html`, `src/fullscreen.js`  
**Change type:** Pause-menu UI refinement

## Purpose

The Chemistry Lab already supported browser fullscreen, but its control was a permanent fixed button in the upper-right corner during gameplay. The requested behaviour is to expose that feature through the existing pause screen instead, so the in-game interface remains focused on the laboratory and HUD.

## Implementation

| Area | Change | Result |
| --- | --- | --- |
| Control placement | Moved the fullscreen button from the global gameplay layer into the existing `#overlay-buttons` group on the Chemistry Lab start/pause card. | The control appears with the pause screen and is absent during active gameplay. |
| Visual integration | Removed the fixed top-right icon styles and applied a matching secondary pause-menu button treatment. | Fullscreen now reads as a normal pause action alongside Controls & Safety and Reset Flask. |
| State feedback | The pause button changes from `Fullscreen` to `Exit Fullscreen` when browser fullscreen is active. | The label accurately reflects the action available to the user. |
| Accessibility | Added `aria-pressed`, state-specific label text, and state-specific title text. | Assistive technologies receive the current fullscreen state. |
| Pause safety | Stops the fullscreen button click from bubbling to the pause overlay. | Toggling fullscreen does not accidentally resume the laboratory. |
| Compatibility | Unsupported fullscreen APIs hide only this action. | The rest of the start/pause interface continues to work in restricted browsers or embeds. |

> Fullscreen is now a deliberate pause-screen setting rather than always-visible gameplay UI. Pressing **Esc** still exits browser fullscreen and may also be used by the browser or game to release the cursor, according to normal browser behaviour.

## Validation

| Check | Result |
| --- | --- |
| Placement review | Confirmed the only fullscreen button is inside `#overlay-buttons`, which is part of the start/pause card. |
| Gameplay UI review | Confirmed the former fixed top-right button and icon CSS are removed. |
| Interaction review | Confirmed the fullscreen click calls `stopPropagation()` before invoking the browser fullscreen API. |
| State review | Confirmed browser fullscreen-change events update the button label and `aria-pressed` value. |
| Production build | `npm run build` passed; Vite transformed 77 modules. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `index.html` | Places and styles the fullscreen action inside the pause-card button group. |
| `src/fullscreen.js` | Preserves fullscreen support, updates state feedback, and prevents an unintended resume action. |
| `docs/2026-08-12-pause-only-fullscreen-control.md` | Documents the pause-only placement, validation, and interaction guarantees. |
