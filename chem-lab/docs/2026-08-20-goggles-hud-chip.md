# Safety Goggles — HUD Chip and E-Toggle Wiring

**Date:** 2026-08-20  
**Area:** `src/ui/hud.js`, `src/ui/welcomeCard.js`, `src/hand.js`, `index.html`  
**Change type:** PPE-status and interaction refinement

## Problem

The safety goggles (added 2026-08-11) had no status readout in the HUD —
gloves, mask and coat each show an on/off chip, but goggles were invisible to
the HUD. Their on/off toggle (E at the goggle box on the PPE table) was also
still missing from the hand's interaction chain.

## Change

| Area | Change | Result |
| --- | --- | --- |
| HUD | Added a fourth `Goggles: OFF/ON` chip (`#hud-goggles`) next to the coat chip, with the same `setGoggles(on)` API as the other PPE items. | The goggles state is visible at a glance, like every other PPE item. |
| Hand interaction | The E key now aims at the goggle box (`aimAt('goggleBox', 2.5)`), requires standing in the PPE zone, and toggles `goggles.wear()` / `goggles.remove()` (box vanishes/appears, FPS frame overlay shows/hides). Holding a bottle near the box shows the "Set the bottle down first" notice. | The goggles are worn and removed the same way as the coat — never via the biohazard bin. |
| Welcome card | The lab-workflow copy now reads "gloves, mask and safety goggles". | The onboarding describes the full PPE set. |
| Start overlay | Re-added the missing `&nbsp;` separators in the keys line (broken by an earlier mojibake cleanup). | The keyboard hints render with proper spacing again. |

> The goggles are now a first-class PPE item: HUD state, E toggle, zone guard,
> and mid-carry protection — exactly parallel to the coat's interaction model.

## Validation

| Check | Result |
| --- | --- |
| HUD markup | `#hud-goggles` renders after the coat chip and toggles with the `on`/`off` classes. |
| E-trigger | Standing in the PPE zone and aiming at the box toggles the goggles; outside the zone shows the "live at the PPE station" hint. |
| Build | `npm run build` passed. |
| Scope isolation | Only `hud.js`, `welcomeCard.js`, the goggle hunks of `hand.js`, `index.html`, and this change record are included in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `src/ui/hud.js` | Adds the goggles status chip and `setGoggles()`. |
| `src/ui/welcomeCard.js` | Mentions the goggles in the lab-workflow copy. |
| `src/hand.js` | Goggle-box E toggle (goggle hunks only; the atomic-view hunks land in their own commit). |
| `index.html` | Restores the keys-line separators. |
| `docs/2026-08-20-goggles-hud-chip.md` | Documents the change. |