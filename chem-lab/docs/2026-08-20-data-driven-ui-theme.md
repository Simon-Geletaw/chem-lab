# 2026-08-20 — UI theme colors from server/data/theme.json

## Problem
Every DOM panel (welcome card, pour dialog, HUD chips, warning card, info
panel) read its palette from `ui/theme.js` — 30 hardcoded CSS tokens
(glass surfaces, brand blue, danger red, safe green, text navies). Restyling
the UI meant a code edit.

## Change
- **`chem-lab/server/data/theme.json`** (new) — the full 30-token palette in
  JSON (same values as the old literals).
- **`chem-lab/src/ui/theme.js`** — the object is now built by `buildTheme()`:
  static JSON import, then each token must be a non-empty string or the
  `DEFAULT_THEME` value (the old literals) wins. Public API unchanged —
  `theme`, `glassPanel()`, `primaryButton()`, `accentButton()` all still
  export exactly as before, so no UI call site changed. The SAFETY RULE
  (danger warnings stay red) is preserved: it is enforced by the module that
  picks the token, and any malformed JSON falls back to the safe defaults.

Edit the JSON, rebuild, the whole UI restyles — one source of truth, same
pattern as the room paint and chemicals/simulations/experiments data.

## Verification
- `npm run build` — all four labs exit 0 (chem is the only lab with
  `ui/theme.js`; the satellites do not import it).
- All consuming modules still compile against the same `theme` export
  (32 modules transformed in the chem build, unchanged count).
- Visual check (user's browser): pale-blue glass panels render identically —
  the JSON ships the same values.