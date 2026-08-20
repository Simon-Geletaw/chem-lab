# Safety goggles — PPE table dispenser, E to toggle on/off (PPE layer 4)

**Date:** 2026-08-11 · **Area:** `src/eyegoggles.js` (new), `src/hand.js`, `src/ui/hud.js`,
`src/main.js`, `src/furniture.js`, `src/ui/welcomeCard.js`

## Problem

The PPE station had three layers of protection — gloves, mask, and the lab coat —
each with a dispenser, an E-to-toggle, and a bottom-left HUD chip. The goggles slot
was the missing fourth layer: the teacher wanted eye protection to sit on the table
right where you suited up (between the glove box and the mask box), toggled the same
way the coat works, with its own status chip.

## Design decisions (confirmed with the user)

- **Toggle on/off, coat-style:** the box on the PPE table is the *only* control point.
  E puts the goggles on (the box vanishes from the table, a first-person overlay
  appears at the top of the view) and E again takes them off (the box reappears).
  Unlike gloves/mask, the biohazard bin never touches the goggles.
- **Visibility:** the worn goggles are a slim dark frame + a faint transparent lens
  painted across the top of the view, so wearing them is visible in the window but
  does **not** cover the crosshair or the info card / pour stream.
- **Effect:** cosmetic only — the overlay does not block pickups, pours, or anything
  else. It exists so the player can see they're geared up.
- **UI:** a fourth chip `Goggles: OFF/ON` in the bottom-left chip row (same red/green
  signal colours as the other three); status-only, not clickable.

## How it was done

1. **`src/eyegoggles.js` (new).** A `createEyegoggles(scene, camera,
   interactableObjects, hud)` factory returns `{ on, wear, remove }`, mirroring
   `createCoat`.

   - **The dispenser box** is procedural (no external model): a cardboard case
     (`0x4f8fc7`, chosen to read as distinct from the glove box blue and the mask box
     green) with a white lid, a dark dispensing slot, a canvas label reading
     `SAFETY GOGGLES`, and a tiny resting goggle pair on the lid. `box.userData = {
     goggleBox: true, name: 'Goggles Box', description: '…' }` and it is pushed onto
     `interactableObjects` so `aimAt('goggleBox', 2.5)` resolves in the hand.

   - **Placement** mirrors the mask box across the glove box for a symmetric pair on
     the bench: `box.position.set(ZONES.ppe.x + 0.5, 1.0, ZONES.ppe.z)`,
     `rotation.y = 0.25`. The 0.5 m offset gives a +0.249 m edge gap between the
     rotated corners (same math as the glove/mask separation fix), so the goggles
     box no longer visually clips the glove box label.
   - **The worn overlay** is a `THREE.Group` parented to `camera` (added as a scene
     child via `camera.add(overlay)`). It holds: two faint lens panes, a nose-bridge
     pane (transparent `MeshBasicMaterial`, `opacity: 0.06`, `depthWrite: false`), a
     dark brow band, and two angled side temples — all sized to sit in the top band
     of the 75° FOV, above the crosshair. Every overlay mesh uses
     `layers.set(HAND_LAYER)` so gloves.js's camera-parented hand light keeps them
     bright in the dim room (the same layer the coat sleeves ride on).
   - **Toggle** is one function: `setOn(v)` sets `on`, calls `hud.setGoggles(on)`,
     hides/shows the box (`box.visible = !on`), and shows/hides the overlay
     (`overlay.visible = on`). The returned `wear()`/`remove()` just call `setOn`.
   - `overlay.visible = false` by default — off until E is pressed.

2. **`src/ui/hud.js`** — a fourth status chip, identical to the other three:
   ```
   <div id="hud-goggles" class="hud-chip off">Goggles: OFF</div>
   ```
   plus `setGoggles(on) { gogglesChip.textContent = on ? 'Goggles: ON' : 'Goggles: OFF'; gogglesChip.classList.toggle('on', on); ... }`.

3. **`src/main.js`** — `import { createEyegoggles }`, instantiate `goggles` from the
   factory right after the mask, pass it to `createHand(...)` as a named argument,
   and strip it on the burn-restart flow (`if (goggles.on) goggles.remove();`), just
   like the coat. `expTable` and `experimentOverlay` remain in scope and are passed
   after `goggles` to keep the parameter order intact.

4. **`src/hand.js`** — two regions:
   - **E-key FSM (mask box branch):** a new `gox = aimAt('goggleBox', 2.5)` branch
     placed between the mask box and the coat rack. It re-uses the existing
     `inZone('ppe', camera)` gate (goggles go on/take off only at the PPE table), then
     toggles `goggles.wear()` / `goggles.remove()` — exactly the coat's toggle shape,
     no "already on" warning because the box itself is the on/off control.
   - **Hover hints:** `gox` / `overGoggleBox` are added to both the EMPTY and
     HOLDING ray chains so the prompt reads `[E] Put on safety goggles` ⇄
     `[E] Take off safety goggles` when empty-handed, and `Set the bottle down
     first` when holding something (mirrors the glove-box HOLDING hint).

5. **Copy updates** — the PPE station's `userData.description` and proximity card
   text (in `src/furniture.js`) now read "nitrile gloves, face masks **and safety
   goggles**", and the welcome card's lab-workflow line reads "PPE station — gloves,
   mask **and safety goggles**".

## How it was verified

- **Build:** `npm run build` passes (no new lint errors, all imports resolve).
- **Imports:** `createEyegoggles` is exported once and imported once in `main.js`.
- **Call site:** `createHand(...)` passes `goggles` between `coat` and `expTable`,
  matching the updated signature `...coat, goggles, expTable, experimentOverlay` —
  so `expTable`/`experimentOverlay` are **not** clobbered (they're still used at
  hand.js lines 272, 283, 785, 810).
- **Aim:** `aimAt('goggleBox', 2.5)` resolves from in front of the PPE station — the
  new box sits clearly right of the glove box and does not overlap the mask box.
- **Visual:** `npm run dev` — stand at the PPE table, aim the goggles box → the prompt
  reads `[E] Put on safety goggles` → E → box vanishes, the goggles overlay appears
  at the top of the view, chip flips green → E again → overlay hides, box
  reappears, chip flips red. Looking down at the beaker / info card is unobstructed.
- **Zone gate:** aiming the box outside the `ppe` zone yields "The safety goggles
  live at the PPE station by the door…".
- **Restart:** the burn-restart flow strips goggles too (chip + overlay cleared).
