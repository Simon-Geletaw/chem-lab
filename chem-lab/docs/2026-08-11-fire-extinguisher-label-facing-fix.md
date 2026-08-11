# Fire extinguisher — valve/"screw" + label face into the room (readable)

**Date:** 2026-08-11 · **Area:** `src/furniture.js`

## Problem

The fire extinguisher (`public/Models/FireEx.glb`) hangs on the right wall at
`(x 6.85, y 1.0, z 2)`, but its orientation only showed the **plain box/back
side**:

- The load callback set `model.rotation.y = -Math.PI / 2` with the comment
  *"turn it to face into the room"*.
- That rotation turned the model's printed label AND its top valve/"screw"
  toward **+x and +z** (into the wall and toward the back of the room). A
  visitor walking up to it saw the featureless side, not the readable text —
  exactly the opposite of what a wall-mounted extinguisher should show.

## Change

Determined which local face of the mesh carries the label and which side the
top valve/"screw" sits on, then re-aimed them.

1. **Analysed the model** (`FireEx.glb`): a Node script decoded the embedded
   base-color texture (PNG) and, for every triangle, sampled the texture at its
   UV centroid to find the bright / white "instruction text" region. Weighting
   by face area, the label maps almost entirely onto the model's **local +X
   face** (≈0.168 mapped area vs ≤0.056 on every other side).

2. **Located the valve/"screw".** The same script measured the horizontal
   centroid of the top valve/nozzle cluster and found it leans onto the
   model's **local −Z side** (≈0.14 m offset from the bottle centre).

3. **Picked a rotation that shows both.** Under the old `-π/2` the label and
   valve both point toward the wall/back. The load callback now uses:

   ```js
   model.rotation.y = Math.PI / 2;   // valve/"screw" + label face the lab interior
   ```

   `rotation.y = π/2` sends the **valve/"screw" (−Z) side straight toward −x**
   (at the viewer walking up from the room), while the label's world normal
   also points mostly into the room (x-component ≈ −0.82), so the text stays
   readable.

   The red mounting backplate is untouched; the extinguisher still reads as
   wall-mounted, now with the printed label and valve/"screw" facing out.

## How it was verified

- **Numerical check:** a Node script parsed the mesh (positions / normals / UVs
  from the GLB buffer). It reported the label's local normal
  `(+0.57, 0, −0.82)` (side walls only) and the top valve cluster offset
  `(x +0.006, z −0.14)`. Applying `rotation.y = π/2` maps that valve offset to
  world `(−0.14, −0.01)` — i.e. straight into the room — while the label's world
  x-component becomes `−0.82` (also into the room). The old `-π/2` and the
  intermediate `π` each left the valve pointing toward the back/wall.
- **Build:** `npm run build` passes.
- **Visual (expected):** walk to the right wall at `(x≈6.85, z=2)` and the fire
  extinguisher shows its top valve/"screw" and its printed label/procedure, both
  facing the room.

