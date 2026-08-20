# Exact Stage-Driven Loading Progress + Fail-Safe Boot

**Date:** 2026-08-20  
**Area:** `src/ui/loader.js`, `src/main.js` (all four labs: chem, biology, math, physics)  
**Change type:** Startup progress-reporting and fail-safe fix

## Problem

The loading screens reported progress that was not real. `loader.js` accepted
hardcoded percentages (15/35/55/75/88/98) sprinkled through `main.js`, and
`yieldToPaint()` was a single arbitrary 30 ms `setTimeout`. Two real failure
modes existed: `await document.fonts.load(...)` could hang the boot forever
with no timeout, and there was no boot watchdog — a mid-boot crash left the
progress bar frozen with no error state.

The user's locked decision was **accurate progress only**: the percent must
reflect real stages (no fake jumps, no stuck spinner), with the simulation
loop continuing to run behind the start screen exactly as before.

## Change

| Area | Change | Result |
| --- | --- | --- |
| Loader API | Replaced `set(percent)` with a stage pipeline: `register(stages)` takes `{ name, weight, run }` entries whose weights sum to 100, and `run()` executes them in order. | The percent at any moment is `completedWeight + easedFraction(stageProgress) × stageWeight`, so it is real, smooth, and monotonic. |
| Eased progress | In-stage progress is eased with `1 − (1 − p)²`; the runner forces each stage to its full weight before advancing. | The bar never jumps at stage boundaries and never falls back. |
| Structured yield | `yieldToPaint()` is now a double-`requestAnimationFrame` followed by a `setTimeout(0)` macrotask; the runner also inserts a macrotask between stages. | The browser can paint the bar between heavy synchronous boot chunks; the arbitrary 30 ms pause is gone. |
| Boot stages (chem) | `data` 15 (registry/simulations/bottles) · `fonts` 5 (font race) · `scene` 40 (camera, renderer, world build, room, furniture) · `equipment` 20 (PPE, bottles, effect systems) · `effects+warm-up` 10 (postprocessing + effect warm-up) · `compile+first render` 8 (shader compilation + first render) · `handoff` 2 (start screen ready). | The existing boot work is unchanged — it is now distributed across stages that report real progress. |
| Boot stages (satellites) | `data` 20 (room.json + fonts) · `world` 45 (scene, camera, renderer, room, player) · `furniture+door` 20 · `compile+frame` 13 · `handoff` 2. | Same shell code as chem, mapped to the satellite labs' smaller boot. |
| Font fail-safe | `document.fonts.load(...)` is raced against a ~2500 ms timeout (`Promise.race`) and the failure is swallowed. | A slow or blocked font fetch can never hang the boot; the app falls back to system fonts. |
| Boot watchdog | A 20 s watchdog starts when boot begins and calls `loader.fail('Taking too long — check your connection and reload.')` if `done()` has not fired; it is cleared when the boot completes. | A stuck boot always ends in a red error state with a working Reload button instead of a frozen bar. |
| Error card | `fail(message)` keeps the existing red error state and shows the Reload button (`location.reload()`). | Failure paths (crash or timeout) are recoverable with one click. |
| Handoff | `done()` keeps the existing two-frame handoff: after the first world frame has painted, the start page fades in over the running sim. | The sim keeps running behind the start screen exactly as before. |

> The loading bar now measures real work. Every visible percent is derived
> from completed stage weights and eased in-stage progress — there are no
> hardcoded numbers left in any boot path.

## Performance

The stage pipeline adds no assets, scene objects, render passes, or per-frame
work. The only additions are a few double-rAF yields between large
synchronous build chunks (each ~2 frames) and one macrotask between stages,
replacing the old single 30 ms wait — total startup cost is essentially
unchanged. The font race and the watchdog are timers that clear themselves.

## Validation

| Check | Result |
| --- | --- |
| Production build | `npm run build` passed for all four labs (chem 70 modules, satellites 31 each); all exited code 0. |
| No fake percents | Grep confirms no `loader.set(...)` calls and none of the old hardcoded percentages (15/35/55/75/88/98) remain in any `main.js` or `loader.js`. |
| No 30 ms yield | Grep confirms `yieldToPaint` no longer uses the 30 ms `setTimeout`; it is a double-rAF + macrotask. |
| Shell identity | All four `loader.js` files are byte-identical (same SHA-256); the three satellite `main.js` files are byte-identical; chem's `main.js` differs only in its lab-specific imports and world content. |
| Watchdog + font race | Both exist in all four `main.js` files. |
| Scope isolation | Only the eight source files, this change record, and the docs index are included in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `chem-lab/src/ui/loader.js` (×4 labs) | Stage pipeline, eased monotonic progress, structured yields, fail state. |
| `chem-lab/src/main.js` (×4 labs) | Boot reworked into weighted stages, font-load timeout race, 20 s watchdog. |
| `docs/2026-08-20-exact-stage-loading-progress.md` | Documents the cause, implementation, validation, and performance behaviour. |