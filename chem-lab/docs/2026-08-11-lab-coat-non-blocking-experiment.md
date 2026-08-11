# Lab coat — non-blocking warning (wearing it no longer blocks the experiment)

**Date:** 2026-08-11 · **Area:** `src/hand.js`

**Follow-up to:** [Lab coat — procedural Three.js rewrite](2026-08-11-lab-coat-procedural-rewrite.md)

## Problem

Picking up a hazardous chemical while the lab coat was OFF was fully blocked:
`src/hand.js` showed a hint and `return`ed, refusing the grab. That hard gate
interfered with the experiment. The teacher wanted the coat to be optional —
when it isn't worn, tell the player they aren't wearing it, but **never stop
the experiment** (nothing happens to block them).

## Change

- **`src/hand.js`** — replaced the hard coat gate (which `return`ed and blocked
  the grab) with a **non-blocking reminder** shown **every time** a hazardous
  chemical is grabbed without the coat on:
  *"You are not wearing the lab coat. It will NOT stop the experiment, but a
  splash could ruin your clothes and skin — the coat hangs on the rack by the
  door if you want it."*
  The pickup and the reaction proceed normally; nothing is refused.
- The separate T6 bare-hands **burn** rule (gloves) is untouched — that is a
  distinct safety mechanic and out of scope for this change.

## How it was verified

- **Build:** Vite transforms all modules cleanly.
- **Grep:** the old blocking text ("Splashes ruin clothes and skin …") and its
  `return` are gone from `src/hand.js`.
- **Visual (`npm run dev`):** with the coat off, grab a hazardous bottle → the
  reminder appears but the grab succeeds and the pour works; with the coat on,
  no reminder and the chip is green. The biohazard bin still disposes
  **gloves → mask**, and E at the rack puts the coat back on the hanger.
