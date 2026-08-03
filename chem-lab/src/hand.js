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

export function createHand(camera, scene, interactableObjects, beaker) {
    let state = 'EMPTY';    // 'EMPTY' | 'HOLDING' | 'RETURNING' | 'POURING'
    let heldBottle = null;

    // The bottle's FULL home transform, captured ONCE at pickup, BEFORE
    // camera.attach() re-parents it: { parent, position, rotation }.
    // Rotation must be a full Euler (x, y, z) — the pour tilts z by 1.9 rad,
    // and a y-only lerp can never undo that, leaving bottles upside-down.
    let homeTransform = null;

    // Camera space: 35 cm right, 30 cm down, 60 cm forward of the eyes —
    // the classic first-person "held item" corner.
    const Hand_Pos = new THREE.Vector3(0.35, -0.3, -0.6);
    // While pouring, reach up-and-forward toward the beaker so the tilt reads
    // as a deliberate gesture, not a wrist-flick in the corner.
    const Pour_Pos = new THREE.Vector3(0.35, -0.2, -0.75);
    const POUR_TILT = 1.9;          // radians (~110°) — past horizontal, liquid streams

    // The pour is a fixed CHOREOGRAPHY (book Ch 15.1): a mini-FSM inside the
    // POURING state. tilt (0.4s) -> hold (0.6s, receive fires ONCE) -> return (0.4s).
    let pourPhase = null;           // 'tilt' | 'hold' | 'return'
    let pourClock = 0;
    let delivered = false;          // guards receive() from firing every frame

    // The stream: a thin translucent cylinder between bottle mouth and beaker
    // rim, visible only during 'hold'. A scene child using WORLD coordinates —
    // parenting it to the tilted bottle would be a coordinate headache.
    const stream = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 1, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false })
    );
    stream.visible = false;
    scene.add(stream);

    const _mouthWorld = new THREE.Vector3();    // scratch vectors, allocated once
    const _rimWorld = new THREE.Vector3();      // (a new Vector3 per frame would
    const _mid = new THREE.Vector3();           //  churn the garbage collector)
    const _rimOffset = new THREE.Vector3(0, 0.14, 0);   // beaker base -> rim height

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
                // Capture the full home transform in the bottle's OWN parent
                // space (the shelf group) before camera.attach re-parents it.
                homeTransform = {
                    parent: bottle.parent,
                    position: bottle.position.clone(),
                    rotation: bottle.rotation.clone()
                };
                camera.attach(bottle);      // re-parent, world position preserved
                heldBottle = bottle;
                state = 'HOLDING';
            }
        }

        if (event.code === 'KeyE' && state === 'HOLDING') {
            // Pour: only if the crosshair rests on the beaker within arm's reach.
            const vessel = aimAt('isBeaker', 2);
            if (vessel) {
                state = 'POURING';
                pourPhase = 'tilt';
                pourClock = 0;
                delivered = false;
                stream.material.color.set(
                    heldBottle.children[0].material.color   // stream matches the liquid
                );
            }
        }

        if (event.code === 'KeyQ' && state === 'HOLDING') {
            if (homeTransform) homeTransform.parent.attach(heldBottle);  // back to its shelf
            else scene.attach(heldBottle);
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
                // Fly home: lerp ALL THREE Euler axes toward the captured home
                // rotation (not just y), plus position. The snap kills any
                // residual tilt so the bottle lands perfectly upright and the
                // label faces the room exactly as authored.
                const home = homeTransform;
                heldBottle.position.lerp(home.position, t);
                heldBottle.rotation.x += (home.rotation.x - heldBottle.rotation.x) * t;
                heldBottle.rotation.y += (home.rotation.y - heldBottle.rotation.y) * t;
                heldBottle.rotation.z += (home.rotation.z - heldBottle.rotation.z) * t;

                if (heldBottle.position.distanceTo(home.position) < 0.01) {
                    heldBottle.position.copy(home.position);
                    heldBottle.rotation.copy(home.rotation);   // exact, no drift
                    heldBottle = null;
                    homeTransform = null;
                    state = 'EMPTY';
                }
            }

            if (state === 'POURING') {
                pourClock += delta;

                if (pourPhase === 'tilt') {
                    // Reach toward the beaker and tip past horizontal. z-rotation
                    // tips the bottle LEFT — toward screen center where the beaker is
                    // (the bottle rides at the right edge of the view).
                    heldBottle.position.lerp(Pour_Pos, t);
                    heldBottle.rotation.z += (POUR_TILT - heldBottle.rotation.z) * t;
                    if (pourClock > 0.4) {
                        pourPhase = 'hold';
                        pourClock = 0;
                    }
                }

                if (pourPhase === 'hold') {
                    // THE one line where the hand meets the beaker — exactly once.
                    // (Without the flag this fires ~36 times = 36 pours. Book Ch 15.1.)
                    if (!delivered) {
                        delivered = true;
                        beaker.receive(heldBottle.userData.chemicalId);
                    }

                    // Stream: world-space line from bottle mouth to beaker rim.
                    // localToWorld handles all the tilt math for us (book Phase 4).
                    heldBottle.localToWorld(_mouthWorld.set(0, 0.2, 0));
                    _rimWorld.copy(beaker.group.position).add(_rimOffset);
                    _mid.addVectors(_mouthWorld, _rimWorld).multiplyScalar(0.5);

                    stream.position.copy(_mid);
                    stream.scale.y = _mouthWorld.distanceTo(_rimWorld);
                    // Cylinders point along Y but lookAt aims Z — orient, then fix 90°.
                    stream.lookAt(_rimWorld);
                    stream.rotateX(Math.PI / 2);
                    stream.visible = true;

                    if (pourClock > 0.6) {
                        pourPhase = 'return';
                        pourClock = 0;
                        stream.visible = false;
                    }
                }

                if (pourPhase === 'return') {
                    heldBottle.position.lerp(Hand_Pos, t);
                    heldBottle.rotation.z += (0 - heldBottle.rotation.z) * t;
                    if (pourClock > 0.4) {
                        heldBottle.rotation.z = 0;
                        pourPhase = null;
                        state = 'HOLDING';     // still in hand: pour again, or Q
                    }
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
                const overBeaker = aimAt('isBeaker', 2);
                hint.textContent = overBeaker
                    ? `[E] Pour ${heldBottle.userData.name}`
                    : `[Q] Put back ${heldBottle.userData.name}`;
                hint.style.display = 'block';
            } else {
                hint.style.display = 'none';
            }
        }
    };
}
