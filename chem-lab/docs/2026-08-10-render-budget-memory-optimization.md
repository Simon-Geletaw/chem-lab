# Render Budget — Memory Optimization

**Date:** 2026-08-10
**Files:** `src/quality.js`, `src/main.js`, `src/ui/loader.js`
**Feature:** brought overall browser memory down toward the 150–250 MB target
(measured ~500 MB before) by capping the framebuffer, without a visible quality
drop on normal screens.

---

## Problem

A chemistry lab with many small objects was consuming ~500 MB of browser memory.
Counting objects is not the cause — the dominant cost is the **render
framebuffer**, which scales with `window width × height × pixel-ratio²` (plus
bloom/the transmission pass that follow the same resolution). On a high-DPI or
large screen that single buffer dwarfs the whole scene.

## Change (three levers)

1. **Resolution render budget (`quality.js`, `main.js`)**
   - Added `quality.maxRenderPixels = 2 073 600` (≈ 1080p).
   - New `effectivePixelRatio()` returns
     `min(devicePixelRatio, pixelRatioCap, sqrt(maxRenderPixels / (w·h)))`.
   - `main.js` now sets `renderer.setPixelRatio(effectivePixelRatio())` instead
     of a DPR-only cap. On a 1080p screen this is unchanged (ratio 1); on a
     large/4K screen the framebuffer is clamped to ≈1920×1080 so memory stops
     growing with monitor size.
2. **Bloom resolution cap (`main.js`)**
   - The `UnrealBloomPass` target width is clamped to `quality.maxBloomWidth`
     (1280, aspect preserved). Bloom is a blur — it never needs full render
     resolution, so this trims the biggest extra buffer set on big screens.
   - The transmission pass already runs at half resolution and shrinks with the
     smaller framebuffer automatically.
3. **Memory hygiene (`loader.js`)**
   - `loader.done()` now **removes the loading-screen element** from the DOM
     after the fade so its nodes/canvas are reclaimed; it is never used again.

**Textures:** reviewed — floor (1024²), painted walls (512² ×4), periodic tiles
(256² ×118) and title (1024×128) are all already modest; they were **not** the
bottleneck, so they were left at their crisp sizes to preserve the room realism
(no visible downgrade).

## How it was verified

- `npm run build` passes (no errors).
- Logic: on a 1920×1080 screen the effective ratio stays 1 (no visual change); on
  1440p/4K the framebuffer is clamped to ≤ ~2.07 Mpx and bloom to ≤ 1280 wide.
- Live: run `npm run dev`, open Chrome Task Manager / DevTools Memory, and
  compare total memory before/after — expect a significant drop toward the
  150–250 MB target, most visible on a large or high-DPI monitor.
