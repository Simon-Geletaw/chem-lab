// hand.js — the player's hand: pick up a bottle (E), carry it, put it back (Q).
//
// THE core Three.js lesson here is PARENTING (book Ch 10):
//   camera.attach(bottle) -> the bottle becomes a CHILD of the camera, keeping
//                            its world position (no teleport). From then on it
//                            follows every walk and head-turn automatically —
//                            we never "update it to follow", the scene graph does.
//   scene.attach(bottle)  -> the mirror move: back to world space, no jump.
//
// State is ONE string, not boolean flags (book Ch 6.3): with `isHolding` plus
// `isPouring` there are 4 combinations and one is nonsense — and nonsense states
// are where bugs live. A single enum makes illegal states unrepresentable.
import * as THREE from 'three';

export function createHand(camera, scene, interactableObjects) {
    let state = 'EMPTY';    // 'EMPTY' | 'HOLDING' | 'RETURNING'  (+ 'POURING' in Phase 4)
    let heldBottle = null;

    // Camera space: 35 cm right, 30 cm down, 60 cm forward of the eyes —
    // the classic first-person "held item" corner.
    const Hand_Pos = new THREE.Vector3(0.35, -0.3, -0.6);

    const raycaster = new THREE.Raycaster();
    const CENTER = new THREE.Vector2(0, 0);   // crosshair = exact screen center

    const hint = document.getElementById('action-hint');

    // Aim the crosshair and return the nearest object within maxDistance whose
    // userData carries `flag` (climbing parents — the interactions.js pattern).
    //
    // Two separate jobs, kept separate on purpose:
    //   1. skip anything belonging to the bottle already in our hand — it sits
    //      right in front of the camera and would eat every ray (book Ch 14)
    //   2. stop at the first REAL hit: if a bench or wall is nearer than the
    //      bottle, the bottle is behind it and should not be reachable.
    function aimAt(flag, maxDistance) {
        raycaster.setFromCamera(CENTER, camera);
        const intersects = raycaster.intersectObjects(interactableObjects, true);

        for (const hit of intersects) {
            // intersects is sorted near -> far, so the first one past our reach
            // means everything after it is too far as well.
            if (hit.distance > maxDistance) return null;

            let obj = hit.object;
            let isHeld = false;
            while (obj) {
                if (obj === heldBottle) isHeld = true;
                if (obj.userData && obj.userData[flag]) break;
                obj = obj.parent;
            }

            if (isHeld) continue;      // job 1: ignore our own bottle, keep looking
            return obj || null;        // job 2: found the flag, or blocked by solid geometry
        }
        return null;
    }

    window.addEventListener('keydown', (event) => {
        if (event.code === 'KeyE' && state === 'EMPTY') {
            const bottle = aimAt('isBottle', 2.5);
            if (bottle) {
                camera.attach(bottle);      // re-parent, world position preserved
                heldBottle = bottle;
                state = 'HOLDING';
            }
        }

        if (event.code === 'KeyQ' && state === 'HOLDING') {
            scene.attach(heldBottle);       // back to world coords, still no jump
            state = 'RETURNING';            // update() flies it home, then releases it
        }
    });

    return {
        get state() { return state; },
        get heldBottle() { return heldBottle; },
        aimAt,                              // Phase 4 (pouring) reuses this

        update(delta) {
            const t = Math.min(1, delta * 8);   // the easing idiom (book Ch 2.1 #4)

            if (state === 'HOLDING') {
                // Coords are camera-space now, since the bottle is a camera child.
                // Also ease the shelf rotation away so the label turns to face us.
                heldBottle.position.lerp(Hand_Pos, t);
                heldBottle.rotation.y += (0 - heldBottle.rotation.y) * t;
            }

            if (state === 'RETURNING') {
                // Mirror of interactions.js returningTiles: fly home, snap the last mm.
                const home = heldBottle.userData.homePosition;
                heldBottle.position.lerp(home, t);
                heldBottle.rotation.y += (Math.PI / 2 - heldBottle.rotation.y) * t;

                if (heldBottle.position.distanceTo(home) < 0.005) {
                    heldBottle.position.copy(home);
                    heldBottle.rotation.y = Math.PI / 2;   // label back toward the room
                    heldBottle = null;
                    state = 'EMPTY';
                }
            }

            // Hover hint: teach the keys by showing them exactly when they work.
            // One ray per frame against a few dozen objects costs nothing.
            if (!hint) return;
            if (state === 'EMPTY') {
                const target = aimAt('isBottle', 2.5);
                hint.textContent = target ? `[E] Pick up ${target.userData.name}` : '';
                hint.style.display = target ? 'block' : 'none';
            } else if (state === 'HOLDING') {
                hint.textContent = `[Q] Put back ${heldBottle.userData.name}`;
                hint.style.display = 'block';
            } else {
                hint.style.display = 'none';
            }
        }
    };
}
