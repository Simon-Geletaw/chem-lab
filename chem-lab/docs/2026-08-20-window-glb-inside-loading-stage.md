# Window — GLB loads inside the loading stage (no pop-in)

**Date:** 2026-08-20

## Problem

The window model (`Models/window.glb`) loaded asynchronously **after** the
loader handed off to the start screen. On slower disks the aluminium frame and
glass panes popped into existence a moment later — a visible glitch right at
the moment the user takes over. Worse, if the GLB failed or was slow there was
no fallback, and the dark opening sat empty.

## Change

`src/room.js` + `src/main.js` (chem-lab only — satellites have no window GLB):

- `createRoom()` now returns a `windowReady` promise alongside its lights.
- The window load path resolves `windowReady` on success and builds the frame
  exactly as before (GLB frame + shared glass material/pane placement via a
  new `addGlassPanes()` helper).
- On failure it builds a simple aluminium fallback frame (two jambs, head and
  sill in `0x9aa5ad` box geometry) plus the same glass panes, then resolves —
  the room always has a believable window.
- `src/main.js` awaits `Promise.race([room.windowReady, 5 s timeout])` inside
  the loading stage, so the window is fully in place before the start screen
  is revealed; a stalled or missing GLB can no longer stall the boot.
- Load progress keeps running underneath; the loading screen never flashes.

## How it was verified

- `npm run build` — chem-lab exits 0.
- Visual: the window (GLB or fallback frame) is present the moment the start
  screen appears; no pop-in, no empty dark opening.