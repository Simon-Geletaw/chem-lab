# 2026-08-20 — Showcase lights leak into the room: bench glare + glow under the atomic sticker, branded scrollbars, fullscreen toggle

## Problem
- The atom showcase's "demo" lights were **DirectionalLights** inside the showcase
  group (`atomView.js`). A directional light ignores position/group falloff, so
  despite the comment claiming "the rest of the room is never lit by the
  showcase", a white 2.4 + cool 1.5 top-down directional pair **flooded the
  whole lab** — washing out the room and producing the glaring reflection on
  the reaction bench (and every bench).
- The atom's internal under-bounce `PointLight(0x301800, 1.2, distance 22)` sat
  0.68 m below the atom; with distance 22 m it lit the whole room orange, and
  when the showcase was closed the light collapsed onto the back wall — the
  glow "below the atomic sticker".
- Bench worktops were semi-glossy (`roughness 0.4, metalness 0.1`), mirroring
  the bright ceiling fixtures and window even after the lights were fixed.
- The default browser scrollbar (chunky grey, never styled) clashed with the
  glass UI.
- No way to view the lab in true fullscreen.

## Change
1. **`chem-lab/src/atomView.js`** — deleted the two showcase DirectionalLights
   (key + rim + their targets); the atom keeps its own internal rig
   (`atomicStructure.js` untouched: nucleus glow, orbit colors, dark
   hemisphere, electrons unchanged). Headers/comments updated to be truthful.
2. **`chem-lab/src/ui/atomicStructure.js`** — removed only the orange
   under-bounce PointLight (the "light below the atomic sticker"); nothing
   else in the atom was touched — electrons, rings, nucleus and their
   materials/lights are byte-identical.
3. **`src/furniture.js` ×4 labs** — `worktopMat` is now matte laminate
   (`roughness 0.85, metalness 0`) — one shared material, kills the bench
   glare everywhere (island, wall, PPE and experiment-table benches).
4. **`index.html` ×4 labs** — slim branded scrollbars (WebKit + Firefox
   `scrollbar-width`/`scrollbar-color`) and the new `#fullscreen-btn` (dark
   glass chip, top-right, enter/exit SVG icon swap).
5. **`src/fullscreen.js` ×4 labs (new)** — self-wiring toggle: Web Fullscreen
   API with webkit fallbacks; button hides itself where the API is missing;
   icon/labels sync with `fullscreenchange` (including ESC exits).
6. **`src/main.js` ×4 labs** — one `import './fullscreen.js';` line.

Satellite copies stay byte-identical (main.js ×3 identical, fullscreen.js ×4
identical, index.html ×3 differ only in the three lab-name lines).

## Verification
- `npm run build` — all four labs exit 0 (only the pre-existing vendor-chunk
  size warnings).
- `npm run serve` smoke — `/c /b /m /p` all 200.
- `Compare-Object` on the satellite index.html trio: only the title /
  loading-title / start-title lines differ; SHA-256 identical for the
  satellite main.js trio and the fullscreen.js quartet.
- Visual check (user's browser): no bench reflection, no glow under the
  atomic sticker, slim scrollbars, fullscreen toggle works and exits with ESC.