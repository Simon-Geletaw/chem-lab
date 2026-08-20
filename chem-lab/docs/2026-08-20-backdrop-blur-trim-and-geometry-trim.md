# 2026-08-20 — Backdrop-blur trim on near-opaque overlays + geometry micro-trim

## Problem
`backdrop-filter` is one of the most expensive paint effects a browser can
run (it forces the compositor to keep a live snapshot of everything behind
the element, per frame). Three full-screen light panels were painted at
`rgba(206,225,242,0.94)` — at 94% opacity the 3D scene behind them is
essentially invisible, so the blur was literally imperceptible while still
taxing an integrated GPU.

## Change
- **Removed `backdrop-filter`** from the three 0.94-alpha light overlays:
  `#loading-card` + `#start-card` (index.html, all four labs) and
  `#burn-panel` (src/ui/burnCard.js, chem). Same edit in the three satellite
  labs; their `index.html` remain byte-identical apart from the three
  lab-name lines.
- Kept the blur on the genuinely translucent dark UI (`#action-hint`,
  `#travel-overlay`, `.dpad`, `#tour-skip`, `#info-panel` at 0.72–0.90 alpha,
  the `glassPanel()` HUD, the atom tooltip card) — there the backdrop is
  visible and the glass look is intentional.
- **Geometry micro-trim (chem, `src/ui/atomicStructure.js`)** — electron
  spheres 32→24 segments and orbit-tube curves 120→96 samples (~30% fewer
  vertices on the orbit rings). Sphere silhouette at the showcase's
  palm-sized scale is unchanged; the tube is 0.045 m radius and reads as a
  smooth ring either way.

## Verification
- `npm run build` — all four labs exit 0.
- Visual check (user's browser): loading/start/burn cards look identical (the
  blur was invisible behind them anyway); translucent HUD panels keep their
  glass blur; the atom looks the same.