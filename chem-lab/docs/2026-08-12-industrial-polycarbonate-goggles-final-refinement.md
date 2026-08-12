# Industrial Polycarbonate Goggles: Final Material and Worn-View Refinement

**Date:** 2026-08-12  
**Area:** `src/eyegoggles.js`  
**Change type:** Final visual realism and first-person-view refinement

## Purpose

The final refinement addressed two specific visual issues: the worn side gasket and nose bridge needed to feel more natural, and the physical frame needed to resemble industrial-grade polycarbonate rather than coloured rubber. The reference direction was clear industrial splash goggles with a durable one-piece polycarbonate lens, a flexible face-conforming frame or shroud, indirect ventilation, a clear scratch-resistant optical surface, and an adjustable strap.[1]

## Final Changes

| Area | Final implementation | Result |
| --- | --- | --- |
| Physical outer frame | Rebalanced the former translucent blue body into nearly clear cool grey-blue polycarbonate with high clearcoat, low roughness, and an optical index matching polycarbonate. | The frame reads as hard, glossy, injection-moulded safety equipment while preserving a slight cool edge tint for readability. |
| Physical lens | Reduced lens opacity and increased optical clearcoat. | The lens reads as clear and scratch-resistant rather than as a coloured translucent panel. |
| Face-contact shroud | Changed the dark blue gasket to a muted smoke-grey, high-roughness material. | The flexible seal now contrasts with the glossy structural frame without looking like a thick black border. |
| Strap and reflections | Kept the strap matte black and lowered the lens-highlight opacity. | The strap retains a practical fabric/elastomer appearance; the lens has restrained physical glints only. |
| Worn side seals | Removed the doubled dark side edges. Each side is now one fine, low-opacity peripheral seal pushed farther out from the central view. | The seal feels close to the wearer’s face rather than like a floating graphical border. |
| Worn nose bridge | Shortened, lowered, thinned, and reduced the opacity of the nose-contact curve. | The bridge is a subtle close-focus silhouette seen only on glance, not a prominent centre-screen shape. |
| Central sightline | Retained a geometry-free, tint-free central view. | The player can perform laboratory work without a coloured visor, artificial glare, or crosshair obstruction. |

> The final visual rule is **clear equipment should be physically credible but visually quiet**. The game shows only the peripheral cues a wearer would naturally notice, rather than rendering the transparent lens as a screen overlay.

## Performance and Validation

The final version retains a one-time construction path with no per-frame updates, runtime asset loading, or texture requests. The worn view uses two `MeshBasicMaterial` instances and five short, low-segment tube meshes. It removes the previous secondary inner side edges, thereby reducing visual complexity while preserving the protective-equipment cue.

The production build passed successfully with **67 transformed modules**. The final JavaScript bundle is **1,077.67 kB** uncompressed and **325.32 kB** gzipped, a change of **+0.01 kB** and **−0.01 kB** respectively compared with the immediately preceding worn-view revision. The project’s existing large-chunk advisory remains unrelated to this focused goggles work.

| Validation check | Outcome |
| --- | --- |
| Research review | Confirmed a one-piece clear polycarbonate lens, flexible shroud/frame, indirect ventilation, and adjustable strap from manufacturer documentation. |
| Syntax check | Passed `node --check` before project transfer. |
| Production build | Passed `npm run build`. |
| Gameplay contract | Preserved the goggle dispenser flag, PPE-zone gating, HUD state, box visibility change, and `wear()` / `remove()` API. |
| Scope isolation | Only the goggles module and this change record will be included in the focused commit. |

## References

[1]: https://www.3m.com/3M/en_US/p/d/b5005625014/ "3M Chemical Splash Goggle, Black Strap, Clear Lens, 91252"
[2]: https://www.3m.com/3M/en_US/p/c/ppe/eye-protection/goggles/ "3M Safety Goggles"
