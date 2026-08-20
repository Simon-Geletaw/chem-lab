# 2026-08-20 — Tangent-basis comet trails (no more head-ring drift)

## Problem
Each electron's comet trail was a `TubeGeometry` over a ring-buffer of the
last 32 positions. Every frame the vertex positions were rescaled radially
toward each ring's center — but the fresh (head) ring shared the tube's
original radial directions from the *initial* curve, so the newest vertices
collapsed onto the electron and the trail's head visibly drifted off the
orbit. A Node simulation reproduced the artifact: the head ring ended up
~0.18 m from where the electron actually is.

## Change
- **`src/ui/atomicStructure.js`** — the trail is now a plain `BufferGeometry`
  of 32 rings × 7 vertices (`TRAIL_RADIALS = 6`). Each ring is rebuilt every
  frame in the plane perpendicular to the local path tangent (central
  difference): `T = normalize(next − prev)`, basis `U = UP × T`, `V = T × U`,
  ring vertex = center + U·cosθ·r + V·sinθ·r. The head ring is rebuilt from
  scratch around the electron's own position, so it can never collapse onto
  it; the taper (0.015 → 0.145) is unchanged.
- One shared `writeTrailRings()` helper writes the initial geometry and each
  frame's mutation — no duplicated math.
- MeshBasicMaterial (unlit, additive) needs no normals, so the attribute is
  not computed — 224 verts × 3 electrons is a trivially cheap update.

## Verification
- Node simulation of the exact math over 2000 frames: head ring stays within
  2.9e-7 of the electron at radius 0.015, ring plane normal stays within
  2.1e-5 of perpendicular to the path, tail ring at 0.145, every point on the
  ellipse to 4.4e-16, zero NaNs.
- `npm run build` — all four labs exit 0.
- Visual check (user's browser): the trailing comet heads hug the electrons
  as they orbit; no drifting glow at the front of each trail.