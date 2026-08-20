# chem-lab — Engineering Documentation

Every code improvement is documented here as a date-prefixed, single-subject
Markdown file, and is committed together with the code change it describes (one
focused commit per improvement, no co-author trailers).

Each document follows the same structure so it is easy to scan:

- **Problem** — what looked/behaved wrong.
- **Change** — exactly what was modified and why.
- **How it was verified** — build/visual checks performed.

## Index

| 2026-08-20 | [UI theme colors from server/data/theme.json](2026-08-20-data-driven-ui-theme.md) | `server/data/theme.json`, `src/ui/theme.js` (chem) |
| 2026-08-20 | [Data-driven wall paint from server/data/room.json (all four labs)](2026-08-20-data-driven-wall-paint.md) | `server/data/room.json`, `src/roomRegistry.js`, `src/room.js` (all labs), `src/main.js` (chem) |
| 2026-08-20 | [Showcase lights leak fix + branded scrollbars + fullscreen toggle](2026-08-20-showcase-light-leak-scrollbars-fullscreen.md) | `src/atomView.js`, `src/ui/atomicStructure.js`, `src/furniture.js`, `index.html`, `src/fullscreen.js`, `src/main.js` (all labs) |
| Date | Doc | Area |
|---|---|---|
| 2026-08-10 | [Window — flush-mounted at z=+2.5 with gradient sky backdrop](2026-08-10-window-position-sky-backdrop.md) | `src/room.js` |
| 2026-08-10 | [Window — not rendering fix (BASE_URL asset paths)](2026-08-10-window-not-rendering-fix.md) | `src/room.js` |
| 2026-08-10 | [Window — centred, wide wall-around-opening rework](2026-08-10-window-centered-wide-wall-around-opening.md) | `src/room.js` |
| 2026-08-10 | [Room wall painting — realism](2026-08-10-room-wall-painting-realism.md) | `src/room.js` |
| 2026-08-10 | [Floor tiles — realism](2026-08-10-floor-tile-realism.md) | `src/room.js` |
| 2026-08-10 | [PPE status indicators — red off / green on](2026-08-10-ppe-indicator-status-colors.md) | `src/ui/hud.js`, `src/ui/theme.js` |
| 2026-08-10 | [Animated loading screen](2026-08-10-animated-loading-screen.md) | `index.html`, `src/ui/loader.js` |
| 2026-08-10 | [Pale-blue glass theme](2026-08-10-pale-blue-glass-theme.md) | `src/ui/theme.js`, `index.html`, `src/ui/burnCard.js`, `src/ui/warningCard.js`, `src/ui/pourDialog.js` |
| 2026-08-10 | [Render budget — memory optimization](2026-08-10-render-budget-memory-optimization.md) | `src/quality.js`, `src/main.js`, `src/ui/loader.js` |
| 2026-08-11 | [Lab coat — procedural Three.js rewrite + placement by the entrance door](2026-08-11-lab-coat-procedural-rewrite.md) | `src/coat.js`, `public/draco/` |
| 2026-08-11 | [Lab coat — non-blocking warning (no longer blocks the experiment)](2026-08-11-lab-coat-non-blocking-experiment.md) | `src/hand.js` |
| 2026-08-11 | [Atomic-structure sticker — fills the open back-wall space left of the periodic table](2026-08-11-atomic-structure-sticker-left-wall.md) | `src/periodicWall.js`, `src/main.js`, `public/sticker/` |
| 2026-08-11 | [Atomic-structure sticker — fills the open back-wall space right of the periodic table](2026-08-11-sticker-right-of-periodic.md) | `src/periodicWall.js`, `src/main.js`, `public/sticker/` |
| 2026-08-11 | [Chemistry sticker — front wall, between the Biology and the exit door](2026-08-11-sticker-front-wall-chemistry.md) | `src/periodicWall.js`, `src/main.js`, `public/sticker/` |
| 2026-08-11 | [Fire extinguisher — label text faces into the room (readable)](2026-08-11-fire-extinguisher-label-facing-fix.md) | `src/furniture.js` |
| 2026-08-11 | [PPE station — glove and mask boxes separated (gloves box visible)](2026-08-11-ppe-glove-mask-box-separated.md) | `src/mask.js` |
| 2026-08-11 | [Safety goggles — PPE table dispenser, E to toggle on/off (HUD chip + FPS overlay)](2026-08-11-safety-goggles.md) | `src/eyegoggles.js`, `src/hand.js`, `src/ui/hud.js`, `src/main.js`, `src/furniture.js`, `src/ui/welcomeCard.js` |
| 2026-08-20 | [Safety goggles — HUD chip and E-toggle wiring](2026-08-20-goggles-hud-chip.md) | `src/ui/hud.js`, `src/ui/welcomeCard.js`, `src/hand.js`, `index.html` |
| 2026-08-20 | [Atomic-structure 3D view — click the picture, walk around the atom](2026-08-20-atomic-structure-3d-view.md) | `src/atomView.js`, `src/ui/atomicStructure.js`, `src/main.js`, `src/hand.js`, `src/interactions.js`, `src/periodicWall.js` |
| 2026-08-20 | [Single-source inter-lab links via /data/simulations.json](2026-08-20-single-source-inter-lab-links.md) | `server.mjs`, `chem-lab/src/simulations/registry.js`, `chem-lab/src/simDoors.js`, `simulations.json`, satellite `exitDoor.js` ×3 |
| 2026-08-20 | [Lab coat procedural rewrite + centred window + compressed sticker](2026-08-20-lab-coat-window-rewrite.md) | `src/coat.js`, `src/room.js`, `public/sticker/sticker3 chemistry .png` |
| 2026-08-20 | [Exact stage-driven loading progress + fail-safe boot](2026-08-20-exact-stage-loading-progress.md) | `src/ui/loader.js`, `src/main.js` (all four labs) |
| 2026-08-20 | [Perf — vendor-split three.js + addons chunks](2026-08-20-perf-vendor-split.md) | `vite.config.js` (all four labs) |
| 2026-08-20 | [Perf — world delta clamp + per-frame allocation removal](2026-08-20-perf-delta-clamp-allocations.md) | `src/main.js`, `src/player.js` (all four labs), `src/tour.js`, `src/interactions.js`, `src/ui/atomicStructure.js` (chem-lab) |
| 2026-08-20 | [Start screen — light scrim + settled first frames behind the loader](2026-08-20-start-screen-scrim-settle-frames.md) | `index.html`, `src/main.js` (all four labs) |
| 2026-08-20 | [Window — GLB loads inside the loading stage (no pop-in)](2026-08-20-window-glb-inside-loading-stage.md) | `src/room.js`, `src/main.js` (chem-lab) |
| 2026-08-20 | [Atom showcase — prebuilt at boot + in-place trail tubes (no click freeze)](2026-08-20-atom-showcase-prebuilt-trails.md) | `src/atomView.js`, `src/ui/atomicStructure.js` (chem-lab) |
| 2026-08-20 | [Perf — lighting/shadow budget: static shadow map + fitted shadow camera](2026-08-20-perf-lighting-shadow-budget.md) | `src/main.js`, `src/room.js` (all four labs), `src/shadowUpdate.js`, `src/eyegoggles.js`, `src/trashBin.js` (chem-lab) |
| 2026-08-20 | [Satellite labs — truthful per-lab comments (Phase 3 cleanup)](2026-08-20-satellite-comment-consistency.md) | satellite `main.js`, `player.js`, `exitDoor.js`, `registry.js`, `furniture.js` |
| 2026-08-20 | [Perf — material/texture reuse: shared instances instead of per-object duplicates](2026-08-20-perf-materials-texture-reuse.md) | `src/room.js` (all four labs), `src/furniture.js`, `src/coat.js`, `src/gloves.js`, `src/experimentTable.js` (chem-lab) |

