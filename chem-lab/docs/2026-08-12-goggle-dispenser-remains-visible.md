# Goggle Dispenser Remains Visible When Worn

**Date:** 2026-08-12  
**Area:** `src/eyegoggles.js`  
**Change type:** PPE interaction and scene-state fix

## Problem

When the player put on the safety goggles, the full dispenser group was hidden. This removed the box, label, and physical station context from the PPE table even though only the resting goggles had been taken.

## Fix

The wear-state logic now toggles the `physicalGoggles` group instead of the enclosing `box` group.

| Player state | Dispenser box | Resting goggles on box | First-person goggle view | HUD |
| --- | --- | --- | --- | --- |
| Not worn | Visible | Visible | Hidden | Off |
| Worn | Visible | Hidden | Visible | On |

> The box remains a permanent, visible PPE-station fixture. The top goggles disappear only while the player is wearing them and reappear when the player removes them.

## Validation

| Check | Result |
| --- | --- |
| Static state review | Confirmed `physicalGoggles.visible = !on` replaces the former box-level visibility toggle. |
| Interactions | The parent dispenser remains in the interactable set, preserving the existing PPE-zone and remove/wear interaction path. |
| Production build | `npm run build` passed; Vite transformed 67 modules. |
| Performance | The change is a single boolean visibility assignment and adds no geometry, materials, assets, or update-loop work. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `src/eyegoggles.js` | Separates resting-goggle visibility from dispenser-box visibility. |
| `docs/2026-08-12-goggle-dispenser-remains-visible.md` | Documents the issue, state behaviour, and validation. |
