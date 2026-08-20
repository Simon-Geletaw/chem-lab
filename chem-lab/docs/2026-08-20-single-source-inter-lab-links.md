# Single-Source Inter-Lab Links via /data/simulations.json

**Date:** 2026-08-20  
**Area:** `server.mjs`, `chem-lab/server/data/simulations.json`, `chem-lab/src/simulations/registry.js`, `chem-lab/src/simDoors.js`, `biology/math/physics-lab/src/exitDoor.js`  
**Change type:** Cross-lab navigation architecture

## Problem

The inter-lab links lived in two places: the chem-lab's sim doors read their
destinations from `simulations.json`, and each satellite lab's exit door read
its "Back to the Chemistry Lab" link from its own `room.json` `backHref`. Every
lab could point at a different chemistry URL, and the committed
`simulations.json` hardcoded `http://localhost:5174/…` dev URLs that would be
baked into the production bundle — deployed sim doors would have opened the
visitor's *own* localhost.

## Change

| Area | Change | Result |
| --- | --- | --- |
| Backend | `server.mjs` serves `/data/simulations.json` directly (same file the chem-lab imports at build time) with `Cache-Control: no-cache`. | One file is the source of truth for the inter-lab topology. |
| Simulations data | Added a link-only `chemistry` entry (label/subtitle/accent/href `/c`) that carries no door geometry; sibling hrefs reverted to backend-relative paths (`/b`, `/m`, `/p`); new optional `hrefDev` fields carry the per-port vite dev URLs. | Production uses same-origin paths; dev keeps working without a backend. |
| Chem sim doors | `simDoors.enter()` resolves `href` with the same `import.meta.env.DEV ? hrefDev || href : href` split the satellite exit doors use for `backHrefDev`. | Doors open the right destination in dev and prod alike. |
| Registry | `simulations/registry.js` skips door validation for link-only entries and validates `hrefDev` when present. | A link-only entry or a bad dev URL fails loudly at boot, not mid-demo. |
| Satellite exit doors | Each satellite's exit door fetches `/data/simulations.json` in production and reads the `chemistry` entry's href (falling back to `room.json.backHref`); in vite dev it uses `room.json.backHrefDev` (no backend to fetch from). | Every "Back to the Chemistry Lab" door now resolves the same way. |

> The inter-lab map now has exactly one author: `chem-lab/server/data/simulations.json`.
> The backend serves it, the chem hub reads it at build time, and each satellite
> reads it at runtime — no more divergent link constants.

## Validation

| Check | Result |
| --- | --- |
| Production path | `npm run build && npm run serve` — chem sim doors open `/b`, `/m`, `/p` on the single origin; satellite exit doors fetch `/data/simulations.json` and route to `/c`. |
| Dev path | `node dev.mjs` — chem sim doors open `http://localhost:5174/b/` etc.; satellite exit doors use `room.json.backHrefDev`. |
| Validation | A simulation entry without a `door` is accepted; a bad `hrefDev` throws at load. |
| Build | All four labs build clean. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `server.mjs` | Serves `/data/simulations.json`. |
| `chem-lab/server/data/simulations.json` | Adds the `chemistry` entry and `hrefDev` fields; keeps sibling hrefs relative. |
| `chem-lab/src/simulations/registry.js` | Link-only entries + `hrefDev` validation. |
| `chem-lab/src/simDoors.js` | DEV/prod href resolution on door entry. |
| `biology-lab/src/exitDoor.js`, `math-lab/src/exitDoor.js`, `physics-lab/src/exitDoor.js` | Runtime back-link resolution from the served JSON. |
| `docs/2026-08-20-single-source-inter-lab-links.md` | Documents the change. |