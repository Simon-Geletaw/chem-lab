# chem-lab — Engineering Documentation

Every code improvement is documented here as a date-prefixed, single-subject
Markdown file, and is committed together with the code change it describes (one
focused commit per improvement, no co-author trailers).

Each document follows the same structure so it is easy to scan:

- **Problem** — what looked/behaved wrong.
- **Change** — exactly what was modified and why.
- **How it was verified** — build/visual checks performed.

## Index

| Date | Doc | Area |
|---|---|---|
| 2026-08-10 | [Window — flush-mounted at z=+2.5 with gradient sky backdrop](2026-08-10-window-position-sky-backdrop.md) | `src/room.js` |
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
| 2026-08-11 | [Fire extinguisher — label text faces into the room (readable)](2026-08-11-fire-extinguisher-label-facing-fix.md) | `src/furniture.js` |
