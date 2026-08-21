# 2026-08-21 — Perf: one crosshair raycast per frame (hint chains 9x → 1x)

## Problem
Walking through the lab felt choppy. While empty-handed (or carrying), the
hand's `update()` fires a chain of ~9 `aimAt()` calls every frame — one per
object flag (`exitDoor`, `isBottle`, `gloveBox`, `maskBox`, `trashBin`…).
Each `aimAt()` ran a full `raycaster.intersectObjects(interactableObjects, true)`
pass against the whole room (~130 objects incl. 118 periodic tiles).
Same crosshair, same camera, same frame → the sorted hit list cannot change
between the calls, yet the room-wide raycast was repeated up to 9× per frame.

## Change
- **`chem-lab/src/hand.js`** — `intersectFrame()` now computes the shared
  sorted hit list ONCE and caches it. The cache self-invalidates whenever the
  camera moves (position, quaternion or aspect changed), so `aimAt()` used from
  keydown handlers (rare, off-frame) rebuilds lazily and can never read stale
  hits.
- `scanHits(flag, maxDistance, intersects)` extracted the single-pass resolver:
  walk the pre-sorted list near→far, skip hits owned by the held bottle
  (`isHeld`), stop at the first real object carrying `flag` — identical
  semantics to the old `aimAt` body.
- The update loop's hint chains still call `aimAt()` up to 9× per frame, but
  now they all read the same cached list from an initial cache miss: one
  room-wide `intersectObjects` per frame instead of up to nine.

## Verification
- `npm run build` — all four labs exit 0.
- Static read-through: `heldBottle` skip, blocked-by-solid-geometry, and
  nearest-hit-wins behaviors are preserved verbatim from the old `aimAt`.
- The camera-state cache validity check (`_cachePos` / `_cacheQuat` /
  `_cacheAspect`) guarantees keydowns rebuild when the view moves.
- Manual check (user's browser): walking the lab no longer stutters; the
  crosshair hints still appear at the correct objects/distances.