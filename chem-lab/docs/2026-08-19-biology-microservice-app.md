# Biology Lab microservice — its own app, URL and port

**Date:** 2026-08-19 · **Area:** monorepo root (`AIT-Threejs/`), `biology-lab/`, `chem-lab/`

## Goal

Each subject gets its own **standalone app** ("microservice") that runs on its
own URL/port and contains **the room like the chemistry lab** — but with no
chemistry equipment: a themed room shell (walls, floor, window, door, walking +
collision) with subject signage. Biology is the first; Math and Physics follow
the same recipe.

## Architecture

```
AIT-Threejs/
├── package.json   →  "dev" / "build" run every lab via dev.mjs
├── labs.json      →  list of { name, dir, port } — add a lab = add one line
├── dev.mjs        →  spawns each app's vite on its port, prefixed output
├── chem-lab/      →  port 5173  (the hub — existing chemistry lab)
└── biology-lab/   →  port 5174  (new — standalone Biology room)
```

- Each app is a fully independent Vite app: own `package.json`, `index.html`,
  `vite.config.js` (port + `strictPort`), `src/`, `public/`, `server/data/`.
- **Links:** the chem-lab **Biology sim door** now has
  `href: "http://localhost:5174"` (`server/data/simulations.json`) and opens in
  a new tab via the existing travel-overlay beat. The **Biology room's steel
  door** (E + 1.3 m gate) opens `backHref: "http://localhost:5173"` back to the
  chemistry lab.
- **Everything user-facing in biology is JSON-driven** from
  `biology-lab/server/data/room.json`: room `name` (also sets the browser tab
  title and the start/loading cards), `tagline`, `accent`, `backHref`,
  `backLabel`, `stations[]` (each hanging sign's label/subtitle/position),
  optional `spawn {x, z, yaw}`.

## Files

| Area | Files |
|------|-------|
| Biology app | `biology-lab/{package.json, vite.config.js, index.html}` |
| Biology data | `biology-lab/server/data/room.json` |
| Biology code | `src/main.js` (boot), `src/registry.js` (room.json load + validate), `src/room.js` (room shell, copied from chem-lab), `src/furniture.js` (benches + JSON station signs), `src/exitDoor.js` (E → back to chem-lab), `src/player.js`, `src/quality.js`, `src/ui/{loader,theme}.js` |
| Monorepo | `AIT-Threejs/{package.json, labs.json, dev.mjs}` |
| Chem-lab touch | `vite.config.js` (port 5173 strict), `simulations.json` biology href |

## Running

```bash
npm run dev      # in AIT-Threejs/ → all existing labs on their ports
node dev.mjs chem bio   # only the named labs
npm run build    # builds every lab (math/physics are skipped until created)
```

## Verification

- `npm run build` in `biology-lab/` passes; root `node dev.mjs --build` builds
  chem + biology.
- Smoke test: dev servers respond — `http://localhost:5173` → 200,
  `http://localhost:5174` → 200, biology `main.js` serves.
- JSON wiring checked: chem biology door → `http://localhost:5174`; biology
  room backHref → `http://localhost:5173`.

## Adding Math / Physics later

1. Copy `biology-lab/` → `math-lab/` (rename in `package.json`, change
   `vite.config.js` port to 5175, `index.html` title).
2. Rewrite `server/data/room.json` (name, tagline, accent, stations) — no code
   changes.
3. Add `{ "name": "math", "dir": "math-lab", "port": 5175 }` to `labs.json`.
4. Point the chem-lab Math door's `href` in `simulations.json` at the new
   port.

## Production note

The `href` / `backHref` values are `localhost` for local dev. When deploying
(e.g. Vercel), replace them in the JSON files with the deployed URLs — no code
change needed.