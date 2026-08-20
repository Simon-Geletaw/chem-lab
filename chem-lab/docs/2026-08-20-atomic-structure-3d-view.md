# Atomic-Structure 3D View — Click the Picture, Walk Around the Atom

**Date:** 2026-08-20  
**Area:** `src/atomView.js`, `src/ui/atomicStructure.js`, `src/main.js`, `src/hand.js`, `src/interactions.js`, `src/periodicWall.js`  
**Change type:** New interactive showcase

## Problem

The atomic-structure sticker (sticker 1, beside the periodic table) was a flat
decorative picture. The room had no way to show *why* the periodic table works
— what an atom actually looks like from any angle.

## Change

| Area | Change | Result |
| --- | --- | --- |
| Wall sticker | Sticker 1 is now clickable: `createWallSticker(..., interactableObjects)` registers it in the raycast pool with `isAtomSticker` + a `homePosition` anchor. | Clicking the picture (or the 3D atom inside) is a real game click, not a decoration. |
| Atom view | New `atomView.js` state machine (`closed → opening → open → closing`): the display glides out of the picture (`EMERGE_DIST` 1.43 m) while scaling up from the picture plane onto a museum pedestal. A gold nucleus, 3 orbit rings and 3 coloured electrons animate on it. | A 3D atom appears on a pedestal and keeps orbiting while you walk freely around it. |
| Showcase lighting | The display carries its own key + rim directional lights aimed at the nucleus, and ramps bloom strength/threshold (0.12→0.6 / 0.95→0.75) via a `setBloom` hook into main.js's `UnrealBloomPass`. | The atom glows in a demo spotlight; the rest of the room keeps its normal glow. |
| Exit | E (hand.js owns the keyboard) is the ONLY way back — the display retracts into the picture and the room's bloom returns. A second click on the picture is a no-op while it is out. | The showcase can never trap the player. |
| Collision | A small box collider is registered around the pedestal so you bump into it instead of walking through. | Consistent with the room's bump-into-furniture rule. |
| Hand | While the atom is out, the hint bar becomes "[E] Put the atomic model back" and every other hand interaction is suspended (WASD still walks). Aiming at the picture or the atom while holding a bottle shows "Set the bottle down first". | The hand never conflicts with the showcase. |
| Interactions | Click handling distinguishes drags from clicks (OrbitControls fires a click at the end of every drag; the pointerdown position is compared to reject moves > 6 px). | Dragging around the atom never accidentally closes it or clicks the room behind it. |
| Headless hook | `interactions.simulateAtomClick()` dispatches a real pointerdown+click at the sticker's screen position, and `window.__atomView` exposes the view — for smoke tests. | The full raycast → handler → atomView path is exercisable from the console. |

> The room now has one living exhibit: click the atomic-structure picture and
> the periodic table's promise becomes something you can walk around.

## Validation

| Check | Result |
| --- | --- |
| Interaction | Clicking sticker 1 opens the atom; walking around it keeps collision and the orbiting electrons animating; E retracts it and restores normal bloom. |
| Drag-vs-click | Dragging with the atom's orbit camera does not close the view. |
| Reset path | `resetLab()` retracts the atom if it is out (exit door "Return to Lab", burn restart). |
| Build | `npm run build` passed; Vite transformed the new modules. |
| Scope isolation | `atomView.js`, `atomicStructure.js`, `main.js`, `interactions.js`, `periodicWall.js`, and the atomic-view hunks of `hand.js` are included in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `src/atomView.js` | The display state machine, pedestal, showcase lighting, bloom ramp. |
| `src/ui/atomicStructure.js` | The animated gold-nucleus atom (orbits + electrons). |
| `src/main.js` | Wires the bloom hook, creates the view, `resetLab` retraction. |
| `src/interactions.js` | Drag-vs-click filter, sticker click handler, `setAtomHandler`, `simulateAtomClick`. |
| `src/periodicWall.js` | Registers sticker 1 as a clickable interactable. |
| `src/hand.js` | Atomic-view hunks only (E to exit, hint, aim chain). |
| `docs/2026-08-20-atomic-structure-3d-view.md` | Documents the change. |