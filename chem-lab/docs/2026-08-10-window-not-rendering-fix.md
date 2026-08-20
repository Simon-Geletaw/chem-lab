# Window — invisible-on-wall fix (wall gap + visible frame + glazed glass)

**Date:** 2026-08-10 · **Area:** `src/room.js`, `diag-window.html`
**Follow-up to:** [Window — flush-mounted at z=+2.5 with gradient sky
backdrop](2026-08-10-window-position-sky-backdrop.md)

## Problem

After the placement fix, the window was still not visible in the room. A
pixel-level diagnostic proved WHY (every number below comes from headless-
browser frames, rendered in a mirror of the app's scene):

| State | Pixels the window draws |
|---|---|
| OLD window over solid wall | **271** — effectively invisible |
| NEW window over gap wall | **3,293** — clearly drawn |

Four compounding causes:

1. **The wall is a solid opaque plane.** The gradient sky plane sits OUTSIDE
   the wall (x=9). With no hole in the wall, what you see through the glass is
   wall paint — never sky (7,641 px of sky DID appear as soon as a gap existed).
2. **Frame color ≈ wall color.** The model's `metal_blanco` material is
   near-white (0.92) on the off-white painted wall — silhouette invisible.
3. **Glass at 10% opacity.** `Glass_Crystal` alpha 0.1 is a barely-there veil;
   nothing reads as glass.
4. **1.24 m-deep frame body.** The SketchUp model is a deep tunnel, not a
   built-in window; from inside you look down a white shaft instead of seeing
   a flat window face.

## Change

1. **Real hole in the wall.** The right wall is now TWO panels —
   z∈[-5, 2.18] and z∈[2.82, 5] — leaving a 0.64 m gap exactly where the
   window sits (frame z-span 2.184..2.816). The sky plane at x=9 shows
   through the gap, through the glass. The hazard stripe under the right wall
   is split into matching pieces (7.18 m + 2.18 m) so no stripe floats over
   the sky at the gap.
2. **Flattened depth.** Non-uniform scale `(1.5/height, 1.5/height, 0.15/depth)`
   squashes the 1.24 m tunnel to a realistic 0.15 m frame thickness (local z
   is the room-x depth axis after the π/2 yaw). Width (0.63 m) and height
   (1.5 m) are unchanged.
3. **Contrast.** `metal_blanco` repainted to brushed-aluminum gray
   (`0x9aa5ad`) — pops off the wall paint like a real lab window.
4. **Real glass.** `Glass_Crystal` → cool tint `0xbfd8ea`, alpha 0.1 → **0.35**,
   `side: DoubleSide` (visible from any angle), `depthWrite: false` (never
   occludes the sky behind it).

## How it was verified

- **Headless-browser frame-diff** (diag-window.html, served by the dev
  server, dumped via `msedge --headless=new --dump-dom`):
  - OLD state: window draws **271 px** over the old wall — invisible.
  - NEW state: window draws **3,293 px** over the gap wall — visible.
  - Gap without any window: **7,641 px** of sky — the hole alone reveals
    the gradient sky, so the glazed glass reads as sky.
- **Build:** `npm run build` passes.
- **Visual:** `npm run dev`, look at the right wall (default camera) — an
  aluminum-gray framed window with glazed blue glass sits at waist height at
  z=+2.5, sky clearly visible through the panes.

## Dev tool

`diag-window.html` (project root) — standalone harness that loads
`window.glb` with the exact placement/repaint code and frame-diffs OLD vs NEW
states. Run the dev server, then
`msedge --headless=new --dump-dom http://localhost:5173/diag-window.html`
and read the `A/B/C` lines.