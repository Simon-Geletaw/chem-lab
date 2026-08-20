# 2026-08-20 — Atom hover tooltips from server/data/atomic-model.json + hover activation

## Problem
The atomic-structure showcase had a fully built hover system (HoverSystem:
raycaster + DOM tooltip with a per-part icon, tag and fact rows) but it was
DEAD: the constructor's `opts.camera` was never passed and `setCamera()` was
never called, so `_camera` stayed null and the tooltip never raycast. Only
the nucleus/nucleons/electrons were registered as hover targets — the orbit
rings (built inline) and the pedestal (built in atomView) were not, so the
eye-catching parts of the exhibit were untouchable. The fact catalogue
(`PARTICLE_INFO` / `ELECTRON_INFO`) was also hardcoded in the module.

## Change
- **`chem-lab/server/data/atomic-model.json`** (new) — the full catalogue:
  `intro` (model header), `parts` (nucleus / proton / neutron / pedestal) and
  `shells` (3 electron shells) and `orbit` — each entry `{ name, tag, color,
  hexIcon, rows[] }`. Exactly the shape the tooltip already renders.
- **`chem-lab/src/ui/atomicStructure.js`** — `buildCatalogue()` imports the
  JSON and merges it over the old literals (now named defaults, kept verbatim
  as fallback). Per-field validation: bad/missing hex color → default, empty
  row label/value → default, missing part/shell → default — a JSON typo can
  never blank a tooltip. Exports `ATOM_CATALOGUE`.
- **Hover activated** — `atomView.js` now calls `atom.setCamera(camera)` and
  registers the pedestal via a new `atom.addHoverTarget(mesh, info)` hook.
  Orbit rings are registered inside the atom (they were inline-created, so a
  mesh reference was added).
- **Engaging feedback** — `HoverSystem.getHovered()` exposes the mesh under
  the cursor; the atom's `update()` applies a gentle 1.35× emissive boost to
  the hovered object (restoring it on move-out). Even the static orbit rings
  and the pedestal light up under the cursor.

Hover tooltips only raycast while the showcase is open (`update()` is gated
by the open/close state), so the mouse never ghosts the closed room.

## Verification
- `npm run build` — all four labs exit 0.
- Tooltip DOM is created once at boot (inside the loading screen) and reused;
  the closed room shows no tooltip because raycasting is camera-gated.
- Visual check (user's browser): hover the nucleus, protons, neutrons, each
  electron, each orbit ring and the pedestal while the atom is out — each
  shows its JSON-defined card and glows gently.