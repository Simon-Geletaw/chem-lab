# 2026-08-20 — Periodic table from server/data/periodic-table.json

## Problem
The 118-element periodic-table poster was data-hardcoded: `periodicTable.js`
held the element array (symbol/name/fact/use), and `periodicWall.js` held the
chemical-family mapping (`getCategory`) and the 10 category tile colors.
Changing a fact, a color, or the whole palette meant a code edit; the data
and its presentation colors lived in two files.

## Change
- **`chem-lab/server/data/periodic-table.json`** (new) — the full catalogue:
  `categoryColors` (10 families) + `elements` (118 entries, each
  `{ symbol, name, number, category, fact, use }`). Generated from the
  existing array + family logic so no transcription error was possible
  (verified: 118 entries, first/last spot-checked).
- **`chem-lab/src/periodicTable.js`** — now the loader. It owns the family
  mapping (`getCategory`) and `DEFAULT_CATEGORY_COLORS`, imports the JSON,
  and merges it over `DEFAULT_ELEMENTS` (the old array, kept verbatim as the
  fallback): the JSON must list exactly 118 elements; any missing/malformed
  field falls back per-element; an unnamed category keeps its default color.
  Exports `elementsData`, `categoryColors`, `getCategory` — the same shape
  the consumers already used.
- **`chem-lab/src/periodicWall.js`** — imports them from the loader and
  removed its local copies; tile color is now
  `categoryColors[element.category] || categoryColors[getCategory(z)]`
  (JSON category wins, the family logic covers the rest).

Edit the JSON, rebuild, the poster's facts, uses and tile colors all update
from one source of truth.

## Verification
- `npm run build` — all four labs exit 0 (periodic table is chem-only).
- Generated JSON validated by a Node script (118 elements, 10 categories).
- Visual check (user's browser): the poster renders identically — the JSON
  ships the same values as the old literals.