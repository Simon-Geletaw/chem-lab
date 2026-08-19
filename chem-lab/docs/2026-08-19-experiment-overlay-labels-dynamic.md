# Experiment-card overlay labels — data-driven from server JSON

**Date:** 2026-08-19 · **Area:** `server/data/experiments.json`, `src/experiments/registry.js`, `src/ui/experimentOverlay.js`

## Goal

The experiment table cards (titration, flame test, copper sulfate) were already
fully data-driven — title, subtitle, description, safety lines, accent colour,
**image path (loaded at runtime)**, href, target, trigger. The only hard-coded
strings left were the overlay's UI chrome labels. Those now also live in the
server JSON.

## Change

1. **`server/data/experiments.json`** — new top-level `ui` block:

   ```json
   "ui": {
     "safetyLabel": "Safety first:",
     "openButton": "Open Experiment",
     "closeButton": "Close",
     "travelText": "Opening {title} experiment…"
   }
   ```

   `travelText` supports a `{title}` placeholder filled with the card's title
   when the travel overlay is shown.

2. **`src/experiments/registry.js`** — `loadExperiments()` merges the JSON `ui`
   block over `DEFAULT_UI` defaults (so a JSON without `ui` still works) and
   exposes `getUiLabels()`. `validate()` rejects non-string labels or a
   `travelText` missing the `{title}` placeholder.

3. **`src/ui/experimentOverlay.js`** — the "Safety first:" label, the Open /
   Close buttons and the travel text are read from `getUiLabels()` instead of
   literals; the image `alt` is set from the entry's title.

## How it was verified

- Node check: `data.ui` is read back from the JSON (`"safetyLabel":
  "Safety first:", …`) and the card image path comes from JSON
  (`/cards/titration.png`).
- **Build:** `npm run build` passes.

To change any label, edit the `ui` block in `server/data/experiments.json` —
no code changes needed.