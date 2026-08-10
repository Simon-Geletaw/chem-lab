# Simulation doors — Biology / Mathematics / Physics on the front wall

**Date:** 2026-08-10 · **Area:** `src/simDoors.js`, `src/simulations/registry.js`,
`server/data/simulations.json`, `src/hand.js`, `src/main.js`, `index.html`

## Problem

The lab had one exit door on the front wall (x = +3) and nothing else — the
player could never leave toward another lab. The teacher wanted three
subject-lab doors (Biology, Mathematics, Physics) beside the exit door, each
labelled, each routing to its own simulation when the player presses E — and
everything about them (labels, positions, destinations, trigger radii) driven
by a JSON file, exactly like the rest of the lab's data.

## Design

**Layout.** Three doors on the front wall (z = 5), to the LEFT of the exit
door: centers at x = −5.8, −4.0, −2.2 (1.8 m pitch). Each leaf is 1.0 m wide
× 2.1 m tall — 0.8 m of painted wall between doors, so the player can stand
comfortably in front of each, and a clear ~5 m gap before the exit door. The
positions come from the JSON (`door.x`), so moving a door is a data edit.

**Each door is built from primitives** (no downloaded models, per project
rule), reusing the room's material language:

- white painted frame strips (same `trimMat` as the ceiling cornice),
- a steel leaf matching the exit door's tone (0x59636d) with a small glazed
  vision window (same glass recipe as the big wall window),
- an accent-colored handle and a pulsing **LED status strip** at the hinge
  edge (brightens to full strength while the crosshair aims at the door),
- an accent **threshold strip** on the floor at the base,
- a flat **emissive lightbox sign above each door** — styled exactly like the
  EXIT sign in `room.js` (solid accent plaque, white border, big white bold
  label, small subtitle, badge number) — readable in the dim lab and blooming
  on the HIGH preset.

**The trigger is data-driven.** `server/data/simulations.json` is the single
source of truth (mirroring `chemicals.json`):

```jsonc
{
  "simulations": [
    {
      "id": "physics",
      "label": "Physics",
      "subtitle": "Motion & energy",
      "accent": "#b3541e",
      "href": "",                    // paste the simulation URL here
      "target": "_blank",            // "_self" or "_blank"
      "door": { "x": -2.2, "z": 5.0, "width": 1.0 },
      "trigger": { "radius": 1.3, "reach": 3.0 }
    }
  ]
}
```

- `trigger.radius` — how close (m) the player must stand to press E.
- `trigger.reach` — how far away the crosshair can still aim at a door.
- `href` empty → the door says "not deployed yet" instead of routing.

**How pressing E works.** The hand's existing `KeyE` handler (hand.js) gets a
new branch ahead of the PPE stations: `simDoors.aim(camera)` raycasts from the
screen centre (same `aimAt` technique), and `simDoors.enter(sim, camera)`
returns `'ok' | 'far' | 'undep'`:

- `ok` → a 0.4 s "Opening Physics simulation…" travel overlay (new DOM +
  CSS in `index.html`), then routes via `href` (same tab or new tab per
  `target`).
- `far` → hint card "Step closer to the door".
- `undep` → info card "not deployed yet".
- Aiming while holding a bottle shows "Set the bottle down first" — nothing
  is carried through a door.

`src/simulations/registry.js` loads + validates the JSON at boot (fail-loud
rules identical to `chemistry/registry.js`), and `src/main.js` wires it: the
doors are built after the room, the sim registry loads with the chemistry
data, and the LED pulse runs in the animation loop.

## How it was verified

- **Build:** `npm run build` passes.
- **Numbers:** door centers −5.8 / −4.0 / −2.2, pitch 1.8 m, leaf 1.0 × 2.1 m,
  sign top at 2.52 m — no overlap with the exit door at x = +3 or the PPE
  station at the front-right.
- **Visual:** open the lab (`npm run dev`) — three labelled doors line the
  front wall left of the exit; each sign glows in its accent colour; aiming at
  a door flares its LED and shows "[E] Enter Physics simulation".
- **Interactions:** E at a door with an empty `href` shows the "not deployed
  yet" card; E too far away says "Step closer"; filling in `href` makes the
  door route (same tab or new tab per `target`).