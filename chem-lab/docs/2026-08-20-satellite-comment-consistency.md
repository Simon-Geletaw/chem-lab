# Satellite labs — truthful per-lab comments (Phase 3 cleanup)

**Date:** 2026-08-20

## Problem

The satellite labs (biology-lab, math-lab, physics-lab) were cloned from one
another, so several header comments still said "the Biology room / Biology
Lab" in the Mathematics and Physics apps, and player.js claimed the
"Enter Lab / Resume" pause button was "chemistry lab only".

## Change

- `main.js` (all three satellites, byte-identical): header now describes a
  generic satellite lab ("Biology / Mathematics / Physics") instead of
  claiming every copy is the Biology Lab.
- `player.js` (all three, byte-identical): the pause-menu button comment now
  says "(all labs)".
- `math-lab` `exitDoor.js`, `registry.js`, `furniture.js`: "Biology" →
  "Mathematics" in header comments.
- `physics-lab` `exitDoor.js`, `registry.js`, `furniture.js`: "Biology" →
  "Physics" in header comments.

Comment-only changes — no behavior touched. The byte-identity contract
(main.js / loader.js / index.html identical across satellites) is preserved:
main.js and player.js were edited identically in all three.

## How it was verified

- `npm run build` — all four labs exit 0.
- SHA-256: main.js identical across the three satellites; math and physics
  player.js identical.
- `npm run serve` — `/c`, `/b`, `/m`, `/p` all return 200 from their built
  dist folders.