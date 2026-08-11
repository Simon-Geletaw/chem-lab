# Lab coat — E toggles ON/OFF at the rack (bin handles only gloves + mask)

**Date:** 2026-08-11 · **Area:** `src/hand.js`, `src/trashBin.js`, `src/coat.js`
**Follow-up to:** [Lab coat — invisible-on-hanger fix (coat scaled from its
own bounds)](2026-08-11-lab-coat-not-rendering-fix.md)

## Problem

Putting the coat on worked (E at the hanging coat), but taking it off was
locked to the biohazard bin (disposal order gloves → mask → coat). The rack
E hinted "Lab coat already on" and refused. The teacher wanted the rack to
be a plain toggle: E puts the coat on (it leaves the hanger), walk back and
E takes it off (it hangs there again) — and the bin and the hanger kept
physically separate roles: used gloves/mask go DOWN into the bin at foot
level, the coat is put on and taken off UP at the hanger.

## Change

1. **`src/hand.js` — the rack E is a toggle.** In the EMPTY-hand branch,
   aiming the hanging coat now works both ways: `coat.on` → `coat.remove()`
   (sleeves go, the chip flips red, the coat reappears on the rack);
   otherwise → `coat.wear()`. The "You are already wearing the lab coat"
   guard is gone; the zone gate (`inZone('coat')`) still forces the player
   to be at the rack.
2. **`src/hand.js` — the biohazard bin drops the coat.** The bin's E now
   disposes gloves first, then the mask — the `coat` branch (and its
   "leaves from the chest" flight) is removed. Any PPE state is fine at the
   rack (no glove/mask order enforced there — the coat is the outermost
   layer and comes off first).
3. **`src/hand.js` — hover hints.** At the rack: `[E] Take off lab coat`
   when worn, `[E] Put on lab coat` when not. At the bin: `[E] Throw away
   gloves` / `[E] Throw away mask` / `Nothing to throw away`.
4. **`src/trashBin.js`** — `dispose()` accepts only `'gloves' | 'mask'`;
   the bundled-coat prop (`makeCoatProp`) is deleted and the bin description
   stops claiming coats go there.
5. **`src/coat.js`** — header and `remove()` comments updated: the rack E is
   the only way off (the bin never touches the coat).

## How it was verified

- **Build:** `npm run build` passes.
- **No stale refs:** grep for `dispose('coat'`, `makeCoatProp`,
  `Throw away coat`, `already wearing the lab coat` — all gone.
- **Visual:** `npm run dev` — coat hangs on the rack; E → it vanishes,
  sleeves appear, chip green; walk back, [E] Take off lab coat → sleeves go,
  the coat hangs again. Gloves + mask still dispose at the bin (gloves
  first); the bin says "Nothing to throw away" when only the coat is worn.