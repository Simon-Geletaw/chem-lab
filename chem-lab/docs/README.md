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
| 2026-08-10 | [Room wall painting — realism](2026-08-10-room-wall-painting-realism.md) | `src/room.js` |
| 2026-08-10 | [Floor tiles — realism](2026-08-10-floor-tile-realism.md) | `src/room.js` |
| 2026-08-10 | [PPE status indicators — red off / green on](2026-08-10-ppe-indicator-status-colors.md) | `src/ui/hud.js`, `src/ui/theme.js` |
| 2026-08-10 | [Animated loading screen](2026-08-10-animated-loading-screen.md) | `index.html`, `src/ui/loader.js` |
| 2026-08-10 | [Render budget — memory optimization](2026-08-10-render-budget-memory-optimization.md) | `src/quality.js`, `src/main.js`, `src/ui/loader.js` |
