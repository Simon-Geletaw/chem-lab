# Exit door — press E to leave the lab (exit card + return)

**Date:** 2026-08-19 · **Area:** `src/room.js`, `src/hand.js`, `src/main.js`, `src/ui/exitCard.js`

## Feature

The steel door on the front wall (`x = 3`, beside the coat rack / PPE station)
was purely decorative. Now the player can walk up to it, aim at it and press
**E** to leave the lab — the same aim + E pattern already used by the three
simulation doors.

## Behaviour

- Aim at the exit door (crosshair) → the hint shows **`[E] Leave the lab`**.
- Press E while standing within ~1.3 m of the door centre and empty-handed →
  the mouse is freed in **modal mode** (no pause menu) and the exit card
  appears: *"You left the lab — Session complete"*, with a green PPE reminder
  and a **Return to Lab** button.
- **Return to Lab** starts a **fresh session** — the shared `resetLab()` in
  `main.js` strips all PPE (gloves, mask, coat, goggles), empties the flask,
  clears every live effect, puts any held bottle back, and resets the camera to
  the entrance `(0, 1.6, 4)` facing into the room — then re-locks the pointer
  from the click gesture (`player.endModal()`). The same `resetLab()` powers the
  T6 burn-game-over "Restart Experiment" card, so both "start over" paths behave
  identically.
- Standing too far → *"Step closer to the exit door, then press E to leave."*
- Carrying a bottle → the exit is blocked with the existing
  *"Set the bottle down first"* notice (same rule as the sim doors); E while
  holding still only pours at the flask.

## Changes

1. **`src/room.js`** — `createRoom(scene, interactableObjects)` now wraps the
   steel door + handle in a raycastable `THREE.Group` marked
   `userData.exitDoor = true` (children keep their exact world positions, so
   the visuals are unchanged). `userData.exitPos = (3, 0, 4.97)` carries the
   door centre for the distance gate. The group is pushed into
   `interactableObjects` so the hand's `aimAt('exitDoor', …)` can find it.
2. **`src/hand.js`** — the E handler checks the exit door right after the sim
   doors (empty hand only), gating on the 1.3 m radius around `exitPos`. When
   triggered it calls `player.beginModal()` + `exitCard.show()`. The hover
   hints cover the exit door in both the EMPTY state (`[E] Leave the lab`) and
   the HOLDING state (`Set the bottle down first`).
3. **`src/ui/exitCard.js`** — new overlay in the same visual language as the
   welcome card (theme tokens + glass panel + primary button, z-index 35 above
   the pause menu). **Return to Lab** → `hide()` + `onReturn()`.
4. **`src/main.js`** — passes `interactableObjects` into `createRoom`, creates
   the exit card with `() => { resetLab(); player.endModal(); }`, and passes it
   into `createHand(...)`. The reset body formerly inside the burn card's
   `onRestart` is extracted into a shared `resetLab()` used by **both** the exit
   door's "Return to Lab" and the burn card's "Restart Experiment".

## Notes

- Desktop (pointer-lock) first — mobile has no E key; the door remains a
  visual only on touch devices.
- "Return to Lab" always starts a fresh session (PPE stripped, flask emptied,
  camera at the entrance) — same reset as the burn-card restart.