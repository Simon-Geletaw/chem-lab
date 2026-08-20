# Perf — World Delta Clamp and Per-Frame Allocation Removal

**Date:** 2026-08-20  
**Area:** `src/main.js`, `src/player.js` (all four labs), `src/tour.js`, `src/interactions.js`, `src/ui/atomicStructure.js` (chem-lab)  
**Change type:** Phase 2a performance pass — frame-spike guard and hot-path allocation removal

## Problem

Two per-frame issues surfaced in the earlier performance audit:

1. **Unclamped world delta.** Each animate loop fed the raw `clock.getDelta()` straight into the world updates. After a tab switch or compositor stall the delta spikes to whole seconds, so pooled particle systems (chem `src/effects/*.js`, e.g. fire with POOL_SIZE 2 / MAX 240) and the player camera take one huge per-frame step — visible particle explosions and camera jumps on return to the tab.

2. **Per-frame allocation.** `player.js` `update()` called `camera.position.clone()` (a `Vector3` per frame) and built a fresh `new THREE.Vector3` for the collision `feet` probe every frame. Additional per-frame churn lived in `tour.js` (a new `Vector3` per frame while flying), `interactions.js` (a `clone()` per frame while a periodic-table tile is popped), and `ui/atomicStructure.js` (a fresh `CatmullRomCurve3` plus ~700 scratch `Vector3`s per frame per electron while the atom showcase is open).

## Change

| Area | Change | Result |
| --- | --- | --- |
| World clock (all four labs) | `const delta = Math.min(clock.getDelta(), 0.05)` at the top of every animate loop, right after `requestAnimationFrame`. Chem multiplies it into `worldDelta = delta * hand.timeScale` as before. | A stall can no longer teleport particles or the camera; normal ~0.016 s frames pass through unchanged (the 0.05 s cap only cuts spikes). |
| Player (all four labs) | Replaced the per-frame `camera.position.clone()` and `new THREE.Vector3(...)` with two closure-scoped scratch vectors (`_prevPos`, `_feet`) reused every frame. | `update()` no longer allocates; collision behaviour is identical. |
| Player shell sync | Brought chem's `player.js` in line with the satellites' guarded `enter-btn` block (`const enterBtn = …; if (enterBtn)`), so the four copies are byte-identical again. Chem's HTML still has the button, so behaviour is unchanged. | The four shell copies match byte-for-byte. |
| Tour (chem only) | `posOnOrbit()` now writes into one module-scope scratch vector instead of returning a fresh `Vector3`; it is consumed synchronously by `lerpVectors`/`copy`. | No allocation while the camera flies between stops. |
| Interactions (chem only) | The popped-tile target is computed into a scratch `_popTarget` (`copy(homePosition).add(POP_OFFSET)`) instead of `homePosition.clone().add(...)`. | No allocation while a periodic-table tile is out. |
| Atom showcase (chem only) | `ui/atomicStructure.js` trail rebuild now writes the electron's new position into the oldest preallocated history slot (ring buffer) instead of `pop()`/`unshift(clone)`/`slice().reverse()`; the per-electron `CatmullRomCurve3` is reused (`curve.points = _trailPts`), and the taper loop uses scratch `_center`/`_dir` vectors (via `curve.getPoint(frac, _center)`) instead of ~700 `Vector3` allocations per frame. | The trail keeps its exact shape while the showcase runs allocation-light. |

> The remaining per-frame work in the trail — `new THREE.TubeGeometry(...)` + `geometry.dispose()` per electron — is deliberately left for a focused pass: an in-place geometry rewrite would need to replicate Three's Frenet-frame math, which risks changing the trail's twist. The object-churn removal above is the safe, zero-visual-diff part.

## Performance Considerations

Clamping `delta` to 0.05 s also feeds the FPS meter and the quality monitor, so a single stalled frame reads as ~20 fps instead of a fractional fps — it no longer skews the auto-degrade monitor, and normal frames are untouched. The scratch-object changes remove the per-frame GC pressure entirely from `player.js`; the tour, tile pop, and atom-trail fixes remove ~750 `Vector3` allocations per frame while those features are active. No rendering behaviour changes: the cap only cuts multi-frame spikes.

## Validation

| Check | Result |
| --- | --- |
| Delta clamp present | All four `src/main.js` files contain `Math.min(clock.getDelta(), 0.05)` in the animate loop. |
| Player clone audit | `grep clone()` across all four `src/player.js` files returns nothing. |
| Shell byte-identity | SHA-256 of `player.js` is identical across the four labs; the three satellite `main.js` copies are identical to each other. |
| Production build | `npm run build` passed; all four labs transformed and exited 0. |
| Scope isolation | Only the intended source files, this change record, and the docs index are included in the focused commit. |

## Files Included in the Focused Commit

| File | Purpose |
| --- | --- |
| `chem-lab/src/main.js`, `biology-lab/src/main.js`, `math-lab/src/main.js`, `physics-lab/src/main.js` | World-delta clamp (50 ms cap) at the top of each animate loop. |
| `chem-lab/src/player.js`, `biology-lab/src/player.js`, `math-lab/src/player.js`, `physics-lab/src/player.js` | Scratch-vector reuse in `update()`; chem synced to the guarded `enter-btn` block so all four copies are byte-identical. |
| `chem-lab/src/tour.js` | `posOnOrbit()` returns a scratch vector (chem only). |
| `chem-lab/src/interactions.js` | Popped-tile target computed into a scratch vector (chem only). |
| `chem-lab/src/ui/atomicStructure.js` | Trail history ring buffer, curve reuse, and scratch vectors in the taper loop (chem only). |
| `docs/2026-08-20-perf-delta-clamp-allocations.md` | Documents the delta clamp and allocation-removal pass. |