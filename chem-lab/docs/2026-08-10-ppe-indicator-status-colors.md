# PPE Status Indicators — Red OFF / Green ON

**Date:** 2026-08-10
**Files:** `src/ui/hud.js`, `src/ui/theme.js`
**Feature:** the gloves & mask HUD chips now signal safety with colour:
**RED when the PPE is NOT worn (off/danger), GREEN when it is worn (on/safe).**

---

## Problem

The two PPE chips used the brand-blue "on" look and a muted frosted-glass "off"
look. Blue and gray are neutral UI colours — they convey a state change but do
not tell the player *at a glance* whether they are protected. The user asked for
an unmistakable signal convention (confirmed before implementation):
**red when not on, green when on.**

## Change

1. **`src/ui/theme.js`** — added a green `safe` token family (the room UI is
   blue by design, so GREEN is reserved for the unmistakable "protected" state):
   `safe`, `safeSolid`, `safeSoft`, `safeBorder`. RED reuses the existing
   `dangerSolid` / `dangerBorder`.

2. **`src/ui/hud.js`**
   - Chip CSS now has explicit `.on` (green fill, dark text) and `.off` (red
     fill, white text) states with a smooth 0.2 s colour transition. The base
     `.hud-chip` rule no longer hard-codes brand blue.
   - `setGloves()` / `setMask()` now toggle **both** `.on` and `.off` classes
     (previously they toggled only `.off` against a brand-blue default), so the
     chip is exactly one of green (on) / red (off).
   - The `.alarm` violation pulse (mask only, red glow) is preserved.
   - Removed the now-unused `glassPanel` import.

## How it was verified

- `npm run build` passes (no errors).
- Visual: `npm run dev` → Start → both chips start **RED** "OFF". Walk to the
  PPE station and press **E** on the glove box and mask box → each chip turns
  **GREEN** "ON"; pressing E again flips it back to **RED** "OFF". Pouring a
  hazardous chemical without a mask still triggers the red glow pulse on the
  mask chip.
