# Pale-Blue Glass Theme (#CEE1F2) + Non-Black Backgrounds

**Date:** 2026-08-10
**Files:** `src/ui/theme.js`, `index.html`, `src/ui/burnCard.js`, `src/ui/warningCard.js`, `src/ui/pourDialog.js`
**Feature:** every glass panel is #CEE1F2 pale-blue glass with dark, WCAG-visible navy text, and the loading/resume (start) backgrounds are light instead of black.

---

## Problem

All DOM panels used deep navy glass (`rgba(4,16,34,…)`) with near-white text, and the loading screen background was near-black (`rgba(2,9,20,0.82)`). The user asked for the glass color to become #CEE1F2 (a very pale blue), for the loading and resume/start screens to not be black, and — like a careful developer — for every piece of text to stay clearly readable on the new light surface. An earlier pass used #CFF4D2; this pass moved the same family to the requested #CEE1F2 pale blue.

## Change

1. **`theme.js` (single source of truth) — pale-blue glass system:**
   - `glassBg` → `rgba(206, 225, 242, 0.92)` (#CEE1F2 frosted glass), navy `glassBorder`/`glassShadow`.
   - `overlayBg` → light blue-gray scrim (never black), so welcome/pour/warning backdrops follow.
   - Text tokens → DARK navies verified ≥ ~6:1 on #CEE1F2: `title #0a2b4d`, `body #1c3a5a`, `dim #45607c`.
   - Brand blue stays ONLY on primary buttons; `accent` stays green (the "PPE safe" icon/focus cue); `danger` stays deepened red. This auto-recolored the welcome, warning, and pour-dialog panels (they consume the tokens).

2. **`index.html` — loading + start (resume) screens:**
   - Loading screen background → soft light blue gradient (`#eef6fd → #cfe2f2`); start-overlay scrim → `rgba(214,229,243,0.72)`.
   - Loading card and start card fills → `rgba(206,225,242,0.94)` with dark navy headings/body/keys; translucent/secondary buttons re-inked navy (tour/controls) or dark-red (reset flask).

3. **`burnCard.js`** — burn-game panel fill → `rgba(206,225,242,0.94)`; its title/text use the dark theme tokens; red danger accents kept. The burned hand keeps its **realistic dark/charred** tint (unchanged — user chose not to recolor the burn).

4. **`warningCard.js` / `pourDialog.js`** — removed hardcoded white text/borders that would vanish on light glass; re-inked to navy/translucent equivalents on the pale-blue surface.

## How it was verified

- `npm run build` passes (58 modules).
- Visual: run `npm run dev` — loading screen is light with a pale-blue glass card and dark text; start menu, welcome card, burn card, warning card and pour dialog all read as #CEE1F2 glass with dark readable text; backgrounds are light, not black.
- Contrast: the dark navy text on #CEE1F2 is ≈6–11:1 — comfortably above AA/AAA for body and headings.
