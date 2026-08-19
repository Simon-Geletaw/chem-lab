# Four subject labs — Math and Physics join Biology

**Date:** 2026-08-19 · **Area:** `AIT-Threejs/` monorepo

## What exists now

Every subject is a standalone Vite app on its own port, spawned together by the
root runner. Each is a copy of the Biology Lab scaffold: same room shell (walls,
window, steel exit door, walking + collision), **no subject equipment** — a
themed room with JSON-driven signage.

| Lab | Port | Folder | Accent |
|-----|------|--------|--------|
| Chemistry (hub) | 5173 | `chem-lab/` | — |
| Biology | 5174 | `biology-lab/` | `#2e8b57` |
| Mathematics | 5175 | `math-lab/` | `#1f6fd6` |
| Physics | 5176 | `physics-lab/` | `#b3541e` |

## How they connect

- **chem-lab → labs:** three doors on the front wall (`server/data/simulations.json`),
  each with an `href` pointing at its app's URL (5174/5175/5176). E at a door
  opens the sim in a new tab (`target: "_blank"`).
- **labs → chem-lab:** each app's steel exit door (E + 1.3 m gate) opens the
  Chemistry Lab at `room.json.backHref` (http://localhost:5173).

## Creating a new subject lab

1. `robocopy biology-lab <subject>-lab /E /XD node_modules dist .git`
2. `package.json` → rename; `vite.config.js` → port + room name comment.
3. `index.html` → title + loading-title + start-title.
4. `server/data/room.json` → name, tagline, accent, stations, backHref.
5. Add `{ "name", "dir", "port" }` to `labs.json`.
6. Point the matching chem-lab door `href` in `simulations.json` at the port.
7. `npm install`, `npm run build`, smoke-test.

## Run everything

```bash
npm run dev            # all four apps, one terminal, prefixed output
node dev.mjs math      # just one
npm run build          # production build of every lab
```

## Production note

`href`/`backHref` are `localhost` for local dev. For Vercel (or any host),
replace them in the JSON files with the deployed URLs — no code change needed.