# Animated Loading Screen

**Date:** 2026-08-10
**Files:** `index.html`, `src/ui/loader.js`
**Feature:** the startup loading screen now feels alive — an animated flask
"reaction" plus a polished progress bar — while keeping the existing click-to-start menu and transition.

---

## Problem

The loading screen was a static flask/logo, a plain text status and a progress
bar. The user asked for a fancier loading experience (animated flask/reactions,
shimmer progress bar) *without* changing the flow: loading → fade → start menu.

## Change

1. **Animated flask logo (`index.html`)** — the SVG is restructured so the
   flask can react:
   - **Liquid fill** (`#flask-liquid-wrap` + `#flask-liquid`): an ellipse of
     liquid inside the bulb whose `scaleY` is driven by a `--liquid` CSS var.
     `loader.js` sets that var from the real progress (`0.25 + 0.75 × pct`), so
     the flask visibly "fills" as the bar advances — a fake reaction on load.
   - **Slosh** — the liquid sways (`flask-slosh` skew) and the whole flask
     gently **bobs** (`flask-bob`).
   - **Bubbles** — three bubbles rise inside the liquid on staggered delays
     (`bubble-rise`).
   - **Title reveal** — the title eases in (`title-in`).
2. **Progress bar** — the existing gloss-sweep **shimmer** is kept and the bar
   is tied to the same progress; no extra cost.
3. **`prefers-reduced-motion`** — every new animation is disabled for users who
   ask for no motion (the liquid still fills, just without transforms).

## How it was verified

- `npm run build` passes (no errors).
- Visual: `npm run dev` → watch startup — flask bobs, liquid rises with the bar,
  bubbles animate, title fades in, then the loading screen fades to the existing
  start menu (behaviour unchanged).
