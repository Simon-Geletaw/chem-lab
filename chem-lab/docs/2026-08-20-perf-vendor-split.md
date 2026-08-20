# Perf — Vendor-Split three.js + Addons Chunks

**Date:** 2026-08-20  
**Area:** `vite.config.js` (all four labs: chem, biology, math, physics)  
**Change type:** Production build optimization (manualChunks)

## Problem

The chemistry lab's production build emitted a single ~1.04 MiB JS chunk
(`index-*.js`, 1,093,156 bytes) containing the three.js core, the
`three/addons/*` modules, and the whole app inlined. Every lab shipped and
re-parsed its own copy of three, so (a) the shared vendor bytes were never
cached across labs or page loads, and (b) any app change re-downloaded the
entire bundle.

## Change

Each lab's `vite.config.js` gains an identical
`build.rollupOptions.output.manualChunks` function. All four labs import three
in two shapes, which resolve to two distinct module-id families:

- `import * as THREE from 'three'` → `node_modules/three/build/three.module.js`
- `three/addons/postprocessing/*`, `three/addons/lights/*`, and direct
  `three/examples/jsm/*` (GLTFLoader, PointerLockControls, SkeletonUtils) →
  `node_modules/three/examples/jsm/*`

The function therefore emits two stable vendor chunks and leaves everything
else (the app) in its own chunk:

| Chunk | Modules | Purpose |
| --- | --- | --- |
| `vendor-three` | `node_modules/three/build/*` | three core (`WebGLRenderer`, scene graph, math, loaders, …) |
| `vendor-three-addons` | `node_modules/three/examples/jsm/*` | addons (EffectComposer passes, RectAreaLightUniformsLib, GLTFLoader, PointerLockControls) |
| `index-*` | lab `src/` | app code only |

The addons chunk imports the core chunk at runtime, so nothing changes for the
bundler or the browser besides where the bytes live. `index.html` and all
`src/` files are untouched — Vite rewrites the script/modulepreload tags and
the `BASE_PATH` override still applies unchanged.

> Vendor bytes are now cached per content hash: across labs and across page
> loads, and app-only edits re-download just the small app chunk.

## Performance

The three.js core (~597 kB raw / ~151 kB gzip for chem) and addons (~312 kB
raw / ~123 kB gzip) are now downloaded once per content hash and reused. The
chem app chunk drops from 1,093,156 bytes to 185,197 bytes (57.2 kB gzip).
The three satellite labs (biology, math, physics) emit byte-identical vendor
chunks with identical content hashes (`vendor-three-DX_kmkDa.js`,
`vendor-three-addons-Crg66sgw.js`), so a browser that visited one lab gets
cache hits on the other labs' vendor files as well.

## Validation

| Check | Result |
| --- | --- |
| Production build | `npm run build` passed for all four labs (chem 70 modules, satellites 31 each); all exited code 0. |
| Chunk graph (chem) | Three chunks: `vendor-three-CPs1OaNS.js` 596,727 B, `vendor-three-addons-GE9ufmgn.js` 312,201 B, app `index-De-kEdwq.js` 185,197 B. |
| Vendor contains core | Grep `vendor-three-CPs1OaNS.js` for `WebGLRenderer` → present; addons chunk for `EffectComposer` → present and imports `vendor-three`. |
| App chunk clean | Grep app `index-De-kEdwq.js` → contains neither `WebGLRenderer` nor `EffectComposer`. |
| index.html | Chem references all three scripts with `modulepreload`; satellites each reference their own app chunk plus the shared vendor chunks under their `BASE_PATH`. |
| Stable vendor names | Rebuild produced identical vendor hashes (`vendor-three-CPs1OaNS.js`, `vendor-three-addons-GE9ufmgn.js`) — no hash churn. |
| Config identity | The `manualChunks` block is byte-identical in all four `vite.config.js` files (only `base` and ports differ, as before). |
| Scope isolation | Only the four `vite.config.js` files, this change record, and the docs index are included in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `chem-lab/vite.config.js` (×4 labs) | Adds `build.rollupOptions.output.manualChunks` vendor split. |
| `docs/2026-08-20-perf-vendor-split.md` | Documents the problem, change, validation, and performance behaviour. |