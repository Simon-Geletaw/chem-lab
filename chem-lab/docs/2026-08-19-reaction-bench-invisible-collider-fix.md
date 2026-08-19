# Reaction bench — invisible wall blocking the walkway (phantom collider fix)

**Date:** 2026-08-19 · **Area:** `src/experimentTable.js`

## Problem

The player could not walk **in front of the reaction bench on the door side**:
starting from the entrance (z ≈ 4) and walking toward the island bench
(z = −1.5), movement stopped around z ≈ 0.35 — an invisible object was
blocking the middle of the room. The player was stuck in the open floor,
unable to reach the reaction bench.

## Root cause

The blocker was **not** the reaction bench itself (its collider footprint was
already corrected in commit `3bfe873`). It was the **experiment-cards table's
collider, registered at the wrong position**:

- `createExperimentTable()` builds the table bench in local coordinates
  (`createBench(0, 0, 0, length)`), adds it to a `THREE.Group`, and then — in
  the original code — immediately registered its collider:

  ```js
  const bench = createBench(0, 0, 0, length);
  group.add(bench);
  colliders.push(new THREE.Box3().setFromObject(bench));   // ← too early
  ```

  Only **after** that did it move the group to its real position:

  ```js
  group.position.set(TABLE_X, 0, TABLE_Z);   // (-6.45, 0, 2.55) front-left corner
  group.rotation.y = TABLE_ROT;              // 90°, long side along the wall
  ```

- `THREE.Box3.setFromObject()` samples the object's **current** `matrixWorld`
  (`object.updateWorldMatrix(false, false)` inside `expandByObject`). At the
  moment it ran, the parent group was still at the origin, so the collider was
  captured as a box centered on **(0, 0, 0)** — x ±0.98, z ±0.35, y 0–1.0.

- That **invisible box sat in the middle of the room**, exactly in the walkway
  between the reaction bench (front edge z = −1.2) and the door (z = 5). The
  player's feet (checked at y = 0.5 by `player.js`) landed inside it and every
  step was undone.

- Second symptom of the same bug: the **real** experiment table in the
  front-left corner had **no** collider, so the player could walk straight
  through the visible table.

## Change

`src/experimentTable.js` — the collider is now registered **after** the group
has been moved, rotated and its world matrices updated:

```js
group.position.set(TABLE_X, 0, TABLE_Z);
group.rotation.y = TABLE_ROT;
group.updateMatrixWorld(true);
colliders.push(new THREE.Box3().setFromObject(bench));   // ← after the transform
```

The collider now wraps the table where it actually stands:
`x −6.80…−6.10, z 1.57…3.53` — and the phantom box at the room center is gone.

## How it was verified

- **Numerical check (Node, three.js):** simulated the two registration orders.
  Before the fix the collider was `−0.98…0.98 x, −0.35…0.35 z` centered at the
  origin and `containsPoint(0, 0.5, 0)` returned `true` (the invisible wall).
  After the fix the collider is `−6.80…−6.10 x, 1.57…3.53 z` and the room
  center is free; `containsPoint(-6.45, 0.5, 2.55)` returns `true` (the real
  table now collides).
- **Build:** `npm run build` passes.
- **Visual (expected):** walk from the entrance toward the reaction bench —
  movement is now unblocked through the middle of the room, and the experiment
  cards table in the front-left corner bumps the player like the other
  furniture.