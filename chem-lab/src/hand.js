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
import { getChemical } from './chemistry/registry.js';
import { RIGHT_REST, RIGHT_POUR, LEFT_REST, LEFT_SUPPORT, GRIP_POS } from './gloves.js';

// --- F2: auto chemical info card -----------------------------------------
// Aiming the crosshair at a bottle fills the top-right #info-panel with its
// data sheet (name, formula, hazard, description) — no click needed. The DOM
// is only rewritten when the aimed chemical changes (cache), and the panel
// hides ~150 ms after the aim leaves so it doesn't flicker frame-to-frame.
const infoPanel = document.getElementById('info-panel');
const infoTitle = document.getElementById('info-title');
const infoText = document.getElementById('info-description');
const esc = (s) => s.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hazardColor = {
  corrosive: '#d63031', toxic: '#e67e22', flammable: '#d63031', oxidizer: '#8e44ad'
};
let aimInfoKey = null;   // cache key of what the panel currently shows

// F3: the flask gets its own data sheet — contents breakdown, volume, temp.
// Pure DOM assembly from beaker.getInfo()'s plain data; the cache key encodes
// volume/contents/temp so the panel rewrites itself the moment they change.
function flaskInfoHTML(info) {
    if (!info.currentId) {
        return `Empty &middot; capacity ${info.capacity} ml<br><br>Carry a bottle here and pour to see what happens.`;
    }
    const rows = info.list.map((e) => {
        const c = getChemical(e.chemicalId);
        return `&middot; ${e.ml} ml ${esc(c.name)} (${esc(c.formula)})`;
    }).join('<br>');
    const chem = getChemical(info.currentId);
    return `<b>Contents: ${info.totalMl} / ${info.capacity} ml</b><br>${rows}` +
        `<br><b>Temp:</b> ${info.temp}&deg;C<br><br>${esc(chem.description)}`;
}

function showAimInfo(target, beaker) {
    const isFlask = !!target?.userData?.isBeaker;
    const chem = !isFlask && target?.userData?.chemicalId
        ? getChemical(target.userData.chemicalId)
        : null;

    clearTimeout(showAimInfo._timer);
    if (!chem && !isFlask) {
        if (aimInfoKey) showAimInfo._timer = setTimeout(() => {
            infoPanel.style.display = 'none';
            aimInfoKey = null;
        }, 150);
        return;
    }

    if (isFlask) {
        const info = beaker.getInfo();
        const key = `flask|${info.totalMl}|${info.currentId}|${info.temp}`;
        if (key === aimInfoKey && infoPanel.style.display === 'block') return;
        aimInfoKey = key;
        infoTitle.textContent = 'Reaction Flask';
        infoText.innerHTML = flaskInfoHTML(info);
        infoPanel.style.display = 'block';
        return;
    }

    // Only rewrite the DOM when the aimed chemical changes AND the panel is
    // not already showing it (a click may have hidden or replaced it).
    if (chem.id === aimInfoKey && infoPanel.style.display === 'block') return;

    aimInfoKey = chem.id;
    infoTitle.textContent = chem.name;
    const badge = chem.hazard === 'none' ? '' :
        ` &middot; <b style="color:${hazardColor[chem.hazard] || '#9fb6d4'}">${chem.hazard.toUpperCase()}</b>`;
    infoText.innerHTML = `<b>${esc(chem.formula)}</b>${badge}<br><br>${esc(chem.description)}`;
    infoPanel.style.display = 'block';
}

export function createHand(camera, scene, interactableObjects, beaker, player, pourDialog, gloves, warningCard, hud) {
    let state = 'EMPTY';    // 'EMPTY' | 'HOLDING' | 'CHOOSING' | 'RETURNING' | 'POURING'
    let heldBottle = null;

    // The bottle's FULL home transform, captured ONCE at pickup, BEFORE
    // camera.attach() re-parents it: { parent, position, rotation }.
    // Rotation must be a full Euler (x, y, z) — the pour tilts z by 1.9 rad,
    // and a y-only lerp can never undo that, leaving bottles upside-down.
    let homeTransform = null;

    // REALISTIC HANDS: the bottle no longer floats in front of the camera —
    // it is re-parented INTO the right hand rig (gloves.js), fingers curled
    // around it. The pour choreography then animates the whole HAND, and the
    // bottle rides along exactly like a real held object.
    //
    // A NATURAL pour: z tilts the mouth ~60° toward the flask at screen
    // center; x leans it ~20° forward so the stream aims down at the rim.
    const POUR_TILT = 1.05;
    const POUR_LEAN = -0.35;
    // Anticipation: real pours LIFT first, then tip. For the first slice of
    // the tilt phase the hand aims at this raised point before settling.
    const POUR_LIFT = RIGHT_POUR.clone().add(new THREE.Vector3(0.03, 0.06, 0.02));

    // F4: the dialog decides how much each pour delivers; the hold phase
    // stretches with the amount so a 100 ml pour visibly takes longer.
    let pourMl = 25;
    let holdDuration = 0.6;

    // The pour is a fixed CHOREOGRAPHY (book Ch 15.1): a mini-FSM inside the
    // POURING state. tilt (0.4s) -> hold (0.6s, receive fires ONCE) -> return (0.4s).
    let pourPhase = null;           // 'tilt' | 'hold' | 'return'
    let pourClock = 0;
    let delivered = false;          // guards receive() from firing every frame

    // The stream: a thin translucent cylinder between bottle mouth and beaker
    // rim, visible only during 'hold'. A scene child using WORLD coordinates —
    // parenting it to the tilted bottle would be a coordinate headache.
    // Tapered like a real pour: narrow at the mouth, widening as it falls.
    const stream = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0065, 0.0035, 1, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false })
    );
    stream.visible = false;
    scene.add(stream);

    const _mouthWorld = new THREE.Vector3();    // scratch vectors, allocated once
    const _rimWorld = new THREE.Vector3();      // (a new Vector3 per frame would
    const _mid = new THREE.Vector3();           //  churn the garbage collector)
    const _rimOffset = new THREE.Vector3(0, beaker.rimY, 0);   // flask base -> rim height

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
            // F5: the glove box toggles gloves — but only empty-handed, so the
            // ray checks it BEFORE bottles (they never overlap anyway).
            const gbox = aimAt('gloveBox', 2.5);
            if (gbox) {
                hud.setGloves(gloves.toggle());
                return;
            }

            const bottle = aimAt('isBottle', 2.5);
            if (bottle) {
                // F5 pickup gate: hazardous chemicals demand gloves. The rule
                // is assembled from the registry data — no hardcoded names.
                const chem = getChemical(bottle.userData.chemicalId);
                if (chem && chem.hazard !== 'none' && !gloves.on) {
                    warningCard.show({
                        title: 'Gloves required!',
                        text: `${chem.name} is ${chem.hazard}. Put on nitrile gloves from the glove box before handling it.`
                    }, 'danger');
                    return;
                }
                // Capture the full home transform in the bottle's OWN parent
                // space (the shelf group) before re-parenting it.
                homeTransform = {
                    parent: bottle.parent,
                    position: bottle.position.clone(),
                    rotation: bottle.rotation.clone()
                };
                // Into the HAND, not the camera: attach() preserves the world
                // position (no teleport), then update() lerps it into the
                // curled fingers while the grip pose closes around it.
                gloves.rightRig.attach(bottle);
                gloves.setRightPose('grip');
                heldBottle = bottle;
                state = 'HOLDING';
            }
        }

        if (event.code === 'KeyE' && state === 'HOLDING') {
            // Pour: only if the crosshair rests on the beaker within arm's reach.
            const vessel = aimAt('isBeaker', 2);
            if (vessel) {
                // F3: ask the flask BEFORE animating — a rejected pour must not
                // play a stream that delivers nothing. 'full' teaches with a
                // card; 'reacting' just refuses silently (the eruption says why).
                const verdict = beaker.checkReceive(1);
                if (verdict === 'full') { beaker.warnFull(); return; }
                if (verdict !== 'ok') return;

                // F4: free the mouse (no pause menu — modal mode) and ask how
                // much. The pour choreography only starts on a chosen amount.
                state = 'CHOOSING';
                player.beginModal();
                const info = beaker.getInfo();
                pourDialog.open({
                    chem: getChemical(heldBottle.userData.chemicalId),
                    totalMl: info.totalMl,
                    capacity: info.capacity,
                    onChoose(ml) {
                        pourMl = ml;
                        holdDuration = 0.4 + (ml / 100) * 0.8;   // 25→0.6s, 100→1.2s
                        state = 'POURING';
                        pourPhase = 'tilt';
                        pourClock = 0;
                        delivered = false;
                        stream.material.color.set(
                            heldBottle.children[0].material.color   // stream matches the liquid
                        );
                        player.endModal();       // re-lock from the button's click gesture
                    },
                    onCancel() {
                        state = 'HOLDING';
                        player.endModal();
                    }
                });
            }
        }

        if (event.code === 'KeyQ' && state === 'HOLDING') {
            if (homeTransform) homeTransform.parent.attach(heldBottle);  // back to its shelf
            else scene.attach(heldBottle);
            gloves.setRightPose('relaxed');  // fingers open as the bottle leaves
            state = 'RETURNING';            // update() flies it home, then releases it
        }
    });

    return {
        get state() { return state; },
        get heldBottle() { return heldBottle; },
        aimAt,                              // Phase 4 (pouring) reuses this

        update(delta) {
            const t = Math.min(1, delta * 8);   // the easing idiom (book Ch 2.1 #4)

            if (state === 'HOLDING' || state === 'CHOOSING') {
                // Coords are RIG-space now (the bottle is a child of the right
                // hand). Ease it into the palm while the fingers curl shut;
                // all three rotation axes settle so the bottle stands upright
                // in the grip with its label facing the player.
                heldBottle.position.lerp(GRIP_POS, t);
                heldBottle.rotation.x += (0 - heldBottle.rotation.x) * t;
                heldBottle.rotation.y += (0 - heldBottle.rotation.y) * t;
                heldBottle.rotation.z += (0 - heldBottle.rotation.z) * t;
                // The hand itself drifts back to rest (it may return from a pour).
                gloves.rightRig.position.lerp(RIGHT_REST, t);
                gloves.leftRig.position.lerp(LEFT_REST, t);
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
                const rig = gloves.rightRig;     // hand + gripped bottle move as one

                if (pourPhase === 'tilt') {
                    // Real pours have ANTICIPATION: lift the bottle first, then
                    // tip it. First 0.15 s the hand aims at a raised point; only
                    // then does it settle to the pour position while the WRIST
                    // rolls the whole hand (z toward screen center, x leaning
                    // the mouth down at the rim). The bottle never moves inside
                    // the grip — the hand carries it, like reality.
                    rig.position.lerp(pourClock < 0.15 ? POUR_LIFT : RIGHT_POUR, t);
                    rig.rotation.z += (POUR_TILT - rig.rotation.z) * t;
                    rig.rotation.x += (POUR_LEAN - rig.rotation.x) * t;
                    // The free hand rises instinctively to guard the flask.
                    gloves.leftRig.position.lerp(LEFT_SUPPORT, t);
                    if (pourClock > 0.45) {
                        pourPhase = 'hold';
                        pourClock = 0;
                    }
                }

                if (pourPhase === 'hold') {
                    // THE one line where the hand meets the beaker — exactly once.
                    // (Without the flag this fires ~36 times = 36 pours. Book Ch 15.1.)
                    if (!delivered) {
                        delivered = true;
                        beaker.receive(heldBottle.userData.chemicalId, pourMl);
                    }

                    // Micro-adjustments: nobody holds a pour statue-still. The
                    // wrist breathes ±1.7° around the tilt the whole time.
                    rig.rotation.z = POUR_TILT + Math.sin(pourClock * 7) * 0.03;

                    // Stream: world-space line from bottle mouth to beaker rim.
                    // localToWorld handles all the tilt math for us (book Phase 4).
                    heldBottle.localToWorld(_mouthWorld.set(0, 0.2, 0));
                    _rimWorld.copy(beaker.group.position).add(_rimOffset);
                    _mid.addVectors(_mouthWorld, _rimWorld).multiplyScalar(0.5);

                    stream.position.copy(_mid);
                    stream.scale.y = _mouthWorld.distanceTo(_rimWorld);
                    // GLUG: the stream's thickness pulses as air replaces liquid
                    // in the bottle — the signature rhythm of a real pour.
                    const glug = 1 + 0.3 * Math.sin(pourClock * 22);
                    stream.scale.x = glug;
                    stream.scale.z = glug;
                    // Cylinders point along Y but lookAt aims Z — orient, then fix 90°.
                    stream.lookAt(_rimWorld);
                    stream.rotateX(Math.PI / 2);
                    stream.visible = true;

                    if (pourClock > holdDuration) {
                        pourPhase = 'return';
                        pourClock = 0;
                        stream.visible = false;
                    }
                }

                if (pourPhase === 'return') {
                    rig.position.lerp(RIGHT_REST, t);
                    rig.rotation.z += (0 - rig.rotation.z) * t;
                    rig.rotation.x += (0 - rig.rotation.x) * t;
                    gloves.leftRig.position.lerp(LEFT_REST, t);
                    if (pourClock > 0.45) {
                        rig.rotation.z = 0;
                        rig.rotation.x = 0;      // wrist square again — no residual lean
                        pourPhase = null;
                        state = 'HOLDING';       // still in hand: pour again, or Q
                    }
                }
            }

            // Hover hint: teach the keys by showing them exactly when they work.
            // One ray per frame against a few dozen objects costs nothing.
            if (!hint) return;
            if (state === 'EMPTY') {
                const target = aimAt('isBottle', 2.5);
                const gbox = target ? null : aimAt('gloveBox', 2.5);
                if (target) hint.textContent = `[E] Pick up ${target.userData.name}`;
                else if (gbox) hint.textContent = gloves.on ? '[E] Take off gloves' : '[E] Put on gloves';
                hint.style.display = (target || gbox) ? 'block' : 'none';
                // F2 data sheet for bottles; F3: empty-handed aim at the flask
                // shows its contents breakdown instead.
                showAimInfo(target || aimAt('isBeaker', 2.5), beaker);
            } else if (state === 'HOLDING') {
                const overBeaker = aimAt('isBeaker', 2);
                const overGloveBox = overBeaker ? null : aimAt('gloveBox', 2.5);
                hint.textContent = overBeaker
                    ? `[E] Pour ${heldBottle.userData.name}`
                    : overGloveBox
                        ? 'Put the bottle down first'      // F5: no gloving-up mid-carry
                        : `[Q] Put back ${heldBottle.userData.name}`;
                hint.style.display = 'block';
                // Over the flask: show ITS panel (contents) right as the pour is
                // prepared; elsewhere the stale bottle sheet fades out.
                showAimInfo(overBeaker, beaker);
            } else {
                hint.style.display = 'none';
            }
        }
    };
}
