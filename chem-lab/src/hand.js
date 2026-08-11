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
import { inZone, facingZone } from './zones.js';
import { playAlarm } from './audio/alarm.js';

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
        const unit = c.state === 'powder' ? 'g' : 'ml';   // powders pour by weight
        return `&middot; ${e.ml} ${unit} ${esc(c.name)} (${esc(c.formula)})`;
    }).join('<br>');
    const chem = getChemical(info.currentId);
    const unit = info.isPowder ? 'g' : 'ml';
    return `<b>Contents: ${info.totalMl} ${unit} / ${info.capacity} ${unit}</b><br>${rows}` +
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

export function createHand(camera, scene, interactableObjects, beaker, player, pourDialog, gloves, warningCard, hud, mask, trashBin, effectRunner, simDoors, coat) {
    let state = 'EMPTY';    // 'EMPTY' | 'HOLDING' | 'CHOOSING' | 'RETURNING' | 'POURING'
    let heldBottle = null;

    // T6: bare-handed hazard burn. The damage ACCUMULATES across pickups and
    // does NOT heal when the bottle goes back — only nitrile gloves let the
    // skin recover. `burnChem` holds the currently-gripped hazardous chemical
    // (its burnRate/burnColor drive the ramp), or null when the hand is safe.
    // Pouring accelerates the burn (fresh chemical runs over the skin).
    let burnChem = null;
    let burnLevel = 0;
    // T6 game-over: FIRST contact with ANY hazardous chemical bare-handed, no
    // matter how brief, triggers the burn reveal -> restart flow (burnCard owns
    // the reveal; onBurn is wired by main.js). Once set, the player can no
    // longer move/pour/return — they only see the burn, then the Restart card.
    let burnOut = false;
    let onBurn = null;               // callback(chem) fired once on the fatal contact
    // T6 dropped-bottle reveal: when the hand is burned the gripped bottle is
    // flung free and tumbles to the floor (dropBottle), where it lies on its
    // side, visible, until the player restarts. resolveBurn puts it back.
    let dropAnim = null;
    // Survives the drop animation: once the tumble finishes (applyDropProgress
    // nulls dropAnim), this keeps the fallen bottle so resolveBurn can still
    // return it to the shelf on restart. Without it, the reference is lost and
    // the bottle would lie on the floor forever after the experiment restarts.
    let droppedBottle = null;
    const POUR_BURN_BOOST = 2.5;   // pouring eats skin 2.5× faster than holding
    const BURN_HEAL = 0.18;        // gloved recovery: full → healed in ~5.5 s
    // The glove reminder card nags at most this many times per session, then
    // trusts the player to have learned it (user: "warn each pickup, cap 3").
    let gloveWarnings = 0;
    const GLOVE_WARN_CAP = 3;

    // Zone-gate helper: a blocked E-action names the station instead of doing
    // nothing — the lab workflow is a sequence (PPE -> storage -> reaction).
    function zoneHint(text) {
        warningCard.show({ title: 'Wrong station', text }, 'info');
    }

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

    // The GRAIN stream (T4b): powders don't pour as a glassy cylinder — they
    // fall as separate grains. One THREE.Points built ONCE (48 verts, recycled
    // every pour, zero per-pour allocation), particles slide mouth -> rim with
    // a gravity-flavored ease and a little sideways scatter.
    const GRAINS = 48;
    const grainPos = new Float32Array(GRAINS * 3);
    const grainGeo = new THREE.BufferGeometry();
    grainGeo.setAttribute('position', new THREE.BufferAttribute(grainPos, 3));
    const grainProg = new Float32Array(GRAINS);       // 0..1 fall progress
    const grainJit = [];                              // per-grain scatter + speed
    for (let i = 0; i < GRAINS; i++) {
        grainProg[i] = Math.random();
        grainJit.push({
            x: (Math.random() - 0.5) * 0.014,
            z: (Math.random() - 0.5) * 0.014,
            s: 0.7 + Math.random() * 0.6
        });
    }
    const grains = new THREE.Points(grainGeo, new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.008,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
    }));
    grains.visible = false;
    scene.add(grains);
    let pourIsPowder = false;   // set per-pour from the chemical's state

    const _mouthWorld = new THREE.Vector3();    // scratch vectors, allocated once
    const _rimWorld = new THREE.Vector3();      // (a new Vector3 per frame would
    const _mid = new THREE.Vector3();           //  churn the garbage collector)
    const _rimOffset = new THREE.Vector3(0, beaker.rimY, 0);   // flask base -> rim height
    const _ppeFrom = new THREE.Vector3();   // where a discarded glove/mask leaves the body
    const _returnDir = new THREE.Vector3(); // shelf-facing check reuses one vector

    const raycaster = new THREE.Raycaster();
    const CENTER = new THREE.Vector2(0, 0);   // crosshair = exact screen center

    const hint = document.getElementById('action-hint');

    // MASK SAFETY: pouring a hazardous chemical without a mask releases fumes.
    // The hazard text says WHAT the player is breathing in, so the alarm teaches
    // instead of just scolding. Fires on every unmasked hazardous pour — the
    // same set of chemicals that burns bare hands (T6).
    const hazardBreath = {
        corrosive: 'corrosive fumes can burn your airways',
        toxic: 'toxic vapors are dangerous to breathe',
        flammable: 'flammable vapors are being released',
        oxidizer: 'oxidizer dust is toxic to inhale'
    };
    function maskAlarm(chem, mouthWorld) {
        const breath = hazardBreath[chem.hazard] || 'hazardous fumes are being released';
        warningCard.show({
            title: 'MASK ALARM — no mask!',
            text: `You poured ${chem.name} without a mask on: ${breath}. Walk to the PPE station by the door and put one on before handling hazardous chemicals.`
        }, 'alarm');
        effectRunner.play([
            { type: 'fumes', color: chem.color, intensity: 1, duration: 3 }
        ], mouthWorld);
        playAlarm(5);
        hud.flashMask(true);
    }

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
        if (burnOut) return;   // game-over: block every E/Q interaction during the burn reveal
        if (event.code === 'KeyE' && state === 'EMPTY') {
            // Simulation doors: E on a door (crosshair) routes to its sim —
            // only when standing close enough, and only empty-handed.
            const simDoor = simDoors.aim(camera);
            if (simDoor) {
                const verdict = simDoors.enter(simDoor, camera);
                if (verdict === 'far') {
                    zoneHint('Step closer to the door, then press E to enter.');
                } else if (verdict === 'undep') {
                    warningCard.show({
                        title: `${simDoor.label} simulation`,
                        text: 'This simulation has not been deployed yet — check back soon.'
                    }, 'info');
                }
                return;
            }

            // F5: the glove box toggles gloves — but only empty-handed, so the
            // ray checks it BEFORE bottles (they never overlap anyway).
            const gbox = aimAt('gloveBox', 2.5);
            if (gbox) {
                // PPE gate: gear up (and down) only at the PPE station.
                if (!inZone('ppe', camera)) {
                    zoneHint('The gloves live at the PPE station by the door — walk over and put them on there.');
                    return;
                }
                // Dispensers only put PPE ON. Used gloves are contaminated —
                // they go in the biohazard bin, never back in the box.
                if (gloves.on) {
                    zoneHint('Used gloves never go back in the box — throw them into the biohazard bin (press E on it).');
                    return;
                }
                hud.setGloves(gloves.toggle());
                return;
            }

            const mbox = aimAt('maskBox', 2.5);
            if (mbox) {
                if (!inZone('ppe', camera)) {
                    zoneHint('The masks live at the PPE station by the door — put one on there.');
                    return;
                }
                if (mask.on) {
                    zoneHint('Used masks never go back in the box — throw yours into the biohazard bin (press E on it).');
                    return;
                }
                hud.setMask(mask.toggle());
                return;
            }

            // The lab coat: E at the hanging coat (rack beside the exit door)
            // toggles it — look UP at the hanger: E puts it on (the coat
            // vanishes from the rack), E again takes it off (it hangs there
            // again). The biohazard bin never touches the coat; used gloves
            // and masks go DOWN into the bin.
            const coatRack = aimAt('coat', 2.5);
            if (coatRack) {
                if (!inZone('coat', camera)) {
                    zoneHint('The lab coat hangs on the rack by the exit door — walk over and put it on.');
                    return;
                }
                if (coat.on) {
                    coat.remove();                  // sleeves go + coat back on the rack
                } else {
                    coat.wear();                    // coat vanishes from the rack
                }
                return;
            }

            // The biohazard bin: the ONLY way to take OFF the gloves and the
            // mask (dispensers only put ON) — the coat comes off at its rack.
            // One item per press: gloves first, then the mask.
            const tbin = aimAt('trashBin', 2.5);
            if (tbin) {
                if (!gloves.on && !mask.on) {
                    zoneHint('You are not wearing any PPE — nothing to throw away.');
                    return;
                }
                if (gloves.on) {
                    hud.setGloves(gloves.toggle());          // hands go bare on screen
                    trashBin.dispose('gloves', gloves.rightRig.getWorldPosition(_ppeFrom));
                } else if (mask.on) {
                    hud.setMask(mask.toggle());
                    _ppeFrom.set(0, -0.2, -0.3);             // the mask leaves the face
                    camera.localToWorld(_ppeFrom);
                    trashBin.dispose('mask', _ppeFrom);
                }
                return;
            }

            const bottle = aimAt('isBottle', 2.5);
            if (bottle) {
                // Storage gate: chemicals are taken from the shelf, nowhere else.
                if (!inZone('shelf', camera)) {
                    zoneHint('Chemicals are stored on the shelf along the left wall — pick them up there.');
                    return;
                }
                // Coat note (NON-BLOCKING): not wearing the lab coat never stops
                // the experiment. It only reminds the player each time a
                // hazardous chemical is grabbed without the coat on — the
                // pickup and the reaction still proceed (nothing happens to
                // block you). Splash risk is real, but the coat is optional.
                const chem = getChemical(bottle.userData.chemicalId);
                if (chem && chem.hazard !== 'none' && !coat.on) {
                    zoneHint('You are not wearing the lab coat. It will NOT stop the experiment, but a splash could ruin your clothes and skin — the coat hangs on the rack by the door if you want it.');
                }
                // T6 pickup gate: hazardous chemicals no longer BLOCK the grab —
                // bare skin can grab them, but it BURNS (and keeps burning after
                // you put it back). Each chemical has its own burnRate/burnColor
                // from chemicals.json. The reminder card nags up to 3 times, then
                // trusts the player. Water / hazard-none is safe.
                burnChem = (chem && chem.hazard !== 'none' && !gloves.on && chem.burnRate)
                    ? chem : null;
                // T6 game-over (harsh rule): the FIRST bare-handed contact with a
                // burnable hazardous chemical is a fatal burn — the old 'glove up
                // to heal' path is gone. Fire onBurn once so main.js starts the
                // burn reveal, then the Restart-experiment flow. The bottle STILL
                // gets attached below, so it stays gripped through the reveal.
                if (burnChem) {
                    burnOut = true;
                    if (onBurn) onBurn(chem);
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
                // Reaction gate: the flask lives on the island bench.
                if (!inZone('reaction', camera)) {
                    zoneHint('The reaction flask sits on the island bench — carry the bottle there to pour.');
                    return;
                }
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
                    flaskPowder: info.isPowder,
                    onChoose(ml) {
                        pourMl = ml;
                        holdDuration = 0.4 + (ml / 100) * 0.8;   // 25→0.6s, 100→1.2s
                        state = 'POURING';
                        pourPhase = 'tilt';
                        pourClock = 0;
                        delivered = false;
                        // Powder pours as falling grains; liquid as a stream.
                        // Color from the DATA (chem.color), not the bottle
                        // mesh — powder bottles carry a white-based grain map,
                        // so their material color is not the chemical's color.
                        const pourChem = getChemical(heldBottle.userData.chemicalId);
                        pourIsPowder = pourChem.state === 'powder';
                        if (pourIsPowder) grains.material.color.set(pourChem.color);
                        else stream.material.color.set(pourChem.color);
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
            // Return gate: a chemical goes back ONLY at the shelf, and only if
            // the player is standing in the shelf zone AND facing it (within
            // ±50° of the straight-on axis). Otherwise Q is silently ignored —
            // the bottle stays in hand, no card, no animation, no state change.
            camera.getWorldDirection(_returnDir);          // includes looking up/down
            const fwd = { x: _returnDir.x, z: _returnDir.z };
            if (!inZone('shelf', camera) ||
                !facingZone('shelf', { x: camera.position.x, z: camera.position.z }, fwd, 50)) {
                return;
            }
            if (homeTransform) homeTransform.parent.attach(heldBottle);  // back to its shelf
            else scene.attach(heldBottle);
            gloves.setRightPose('relaxed');  // fingers open as the bottle leaves
            burnChem = null;                 // T6: ramp stops, but the burn STAYS (heals only when gloved)
            state = 'RETURNING';            // update() flies it home, then releases it
        }
    });

    // --- dropped-bottle reveal (the burned hand flings the grip free) --------
    // Ease curves: the fall accelerates (gravity), the tip lags (weight), the
    // little roll eases both ends — reads as a physical tumble, not a lerp.
    const easeInCubic = (x) => x * x * x;
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const DROP_FLOOR_Y = 0.03;   // the bottle rests ~3 cm off the floor (on its side)

    // Called when the char ramp completes: free the bottle from the hand so it
    // can tumble forward to the floor (applyDropProgress animates it).
    function dropBottle() {
        if (!heldBottle) return;
        scene.attach(heldBottle);                       // stop following the camera
        droppedBottle = heldBottle;                     // keep the ref for resolveBurn
        dropAnim = {
            obj: heldBottle,
            startPos: heldBottle.position.clone(),
            startRot: heldBottle.rotation.clone()
        };
        gloves.setRightPose('relaxed');                 // the fingers opened — it slipped
        heldBottle = null;
        state = 'EMPTY';                                // nothing carried anymore
    }

    // Advance the tumble purely from progress f (0..1) — burnCard drives f on a
    // real-time clock so the roll's pace doesn't depend on slow-motion. The
    // bottle pitches off FORWARD (away from the player: -z) and comes to rest on
    // its side a short distance ahead, exactly as authored.
    function applyDropProgress(f) {
        const a = dropAnim;
        if (!a) return;
        const p = Math.min(1, Math.max(0, f));
        const o = a.obj;
        o.position.y = a.startPos.y
            + (DROP_FLOOR_Y - a.startPos.y) * easeInCubic(p);   // gravity fall
        o.position.z = a.startPos.z - 0.5 * easeInOut(p);        // roll FORWARD away
        o.position.x = a.startPos.x + 0.08 * easeInOut(p);
        // Tip over (+y rolls forward so the cap points ahead) + a splash of yaw.
        o.rotation.set(
            a.startRot.x + (Math.PI / 2) * easeOut(p),
            a.startRot.y + 0.5 * easeInOut(p),
            a.startRot.z
        );
        if (p >= 1) dropAnim = null;                  // planted on the floor
    }

    return {
        get state() { return state; },
        get heldBottle() { return heldBottle; },
        aimAt,                              // Phase 4 (pouring) reuses this

        // T6 burn game-over API (wired by main.js):
        get burnOut() { return burnOut; },          // is the reveal running?
        get timeScale() { return burnOut ? 0.35 : 1; }, // slow-motion during the reveal
        set onBurn(cb) { onBurn = cb; },            // fired once on first fatal contact
        dropBottle,                                 // fling the grip free at the burn
        applyDropProgress,                          // burnCard drives the forward tumble
        // burnCard drives the charring 0→1 in real time during the reveal. It
        // uses the gripped chemical's own burnColor, so acids redden, oxidisers
        // purple — the exact same tint setBurn already renders.
        applyBurn(level) {
            burnLevel = level;
            gloves.setBurn(level, true, burnChem && burnChem.burnColor);
        },
        // "Restart experiment" (on the Restart button click): snap the STILL
        // gripped bottle back to its shelf slot, clear every hand-local burn
        // var, and reset the skin to healthy. Non-hand state (gloves, mask,
        // flask, effects, camera) is reset by main.js.
        resolveBurn() {
            // A dropped (fallen) bottle OR a still-gripped one — either way it
            // goes back to its shelf slot. droppedBottle survives the tumble
            // (dropAnim is nulled when it lands), so the fallen bottle is found.
            const obj = heldBottle || droppedBottle;
            if (obj && homeTransform) {
                homeTransform.parent.attach(obj);        // back to its shelf
                obj.position.copy(homeTransform.position);
                obj.rotation.copy(homeTransform.rotation);
            } else if (obj) {
                scene.attach(obj);
            }
            dropAnim = null;
            droppedBottle = null;
            heldBottle = null;
            homeTransform = null;
            gloves.setRightPose('relaxed');   // fingers open as it leaves
            burnChem = null;
            burnLevel = 0;
            burnOut = false;
            gloveWarnings = 0;                // fresh run gets the full 3-reminder budget
            gloves.setBurn(0, false);
            state = 'EMPTY';
        },

        update(delta) {
            const t = Math.min(1, delta * 8);   // the easing idiom (book Ch 2.1 #4)
            // T6 game-over reveal: freeze normal hand behaviour. The char ramp
            // (applyBurn) and the drop (applyDropProgress) are driven by burnCard
            // on real-time clocks, so their pacing is exact even though the world
            // runs in slow-motion. Here we only ease the still-gripped bottle into
            // the palm while it chars (before the drop flings it free).
            if (burnOut) {
                if (state === 'HOLDING' && heldBottle) {
                    heldBottle.position.lerp(GRIP_POS, t);
                    heldBottle.rotation.x += (0 - heldBottle.rotation.x) * t;
                    heldBottle.rotation.y += (0 - heldBottle.rotation.y) * t;
                    heldBottle.rotation.z += (0 - heldBottle.rotation.z) * t;
                }
                return;
            }

            // T6: bare-handed burn. While a hazardous bottle is gripped bare,
            // the burn climbs at the chemical's own burnRate — FASTER while
            // pouring (fresh chemical runs over the skin). It does NOT fall
            // when the bottle is put back; the ONLY recovery is gloves. The
            // chemical's burnColor tints the skin (acids red, oxidiser purple…).
            const carrying = state === 'HOLDING' || state === 'CHOOSING' || state === 'POURING';
            const burning = !!burnChem && carrying;
            if (burning) {
                const boost = state === 'POURING' ? POUR_BURN_BOOST : 1;
                burnLevel = Math.min(1, burnLevel + delta * burnChem.burnRate * boost);
            } else if (gloves.on) {
                burnLevel = Math.max(0, burnLevel - delta * BURN_HEAL);
            }
            gloves.setBurn(burnLevel, burning, burnChem && burnChem.burnColor);

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
                        const result = beaker.receive(heldBottle.userData.chemicalId, pourMl);
                        // MASK ALARM: the pour landed and the chemical is
                        // hazardous — no mask on means fumes at the flask mouth,
                        // a red pulsing banner and a two-tone siren. Repeats on
                        // every unmasked pour (rejected pours pour nothing, so
                        // they never alarm).
                        if (result.ok) {
                            const poured = getChemical(heldBottle.userData.chemicalId);
                            if (!mask.on && poured.hazard && poured.hazard !== 'none') {
                                const mouth = beaker.group.position.clone();
                                mouth.y += beaker.rimY;
                                maskAlarm(poured, mouth);
                            }
                        }
                    }

                    // Micro-adjustments: nobody holds a pour statue-still. The
                    // wrist breathes ±1.7° around the tilt the whole time.
                    rig.rotation.z = POUR_TILT + Math.sin(pourClock * 7) * 0.03;

                    // Stream: world-space line from bottle mouth to beaker rim.
                    // localToWorld handles all the tilt math for us (book Phase 4).
                    heldBottle.localToWorld(_mouthWorld.set(0, 0.2, 0));
                    _rimWorld.copy(beaker.group.position).add(_rimOffset);

                    if (pourIsPowder) {
                        // GRAINS: each particle slides mouth -> rim on its own
                        // clock. t² easing = gravity acceleration; the jitter
                        // scatters them into a falling column, not a line.
                        for (let i = 0; i < GRAINS; i++) {
                            grainProg[i] += delta * 1.7 * grainJit[i].s;
                            if (grainProg[i] > 1) grainProg[i] -= 1;
                            const p = grainProg[i];
                            const e = p * p * 0.65 + p * 0.35;   // accelerate downward
                            grainPos[i * 3] = _mouthWorld.x + (_rimWorld.x - _mouthWorld.x) * e + grainJit[i].x * p;
                            grainPos[i * 3 + 1] = _mouthWorld.y + (_rimWorld.y - _mouthWorld.y) * e;
                            grainPos[i * 3 + 2] = _mouthWorld.z + (_rimWorld.z - _mouthWorld.z) * e + grainJit[i].z * p;
                        }
                        grainGeo.attributes.position.needsUpdate = true;
                        grains.visible = true;
                    } else {
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
                    }

                    if (pourClock > holdDuration) {
                        pourPhase = 'return';
                        pourClock = 0;
                        stream.visible = false;
                        grains.visible = false;
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
                const simDoor = simDoors.aim(camera);
                const target = simDoor ? null : aimAt('isBottle', 2.5);
                const gbox = target ? null : aimAt('gloveBox', 2.5);
                const mbox = target || gbox ? null : aimAt('maskBox', 2.5);
                const coatRack = target || gbox || mbox ? null : aimAt('coat', 2.5);
                const tbin = target || gbox || mbox || coatRack ? null : aimAt('trashBin', 2.5);
                if (simDoor) hint.textContent = `[E] Enter ${simDoor.label} simulation`;
                else if (target) hint.textContent = `[E] Pick up ${target.userData.name}`;
                else if (gbox) hint.textContent = gloves.on ? 'Used gloves go in the biohazard bin' : '[E] Put on gloves';
                else if (mbox) hint.textContent = mask.on ? 'Used masks go in the biohazard bin' : '[E] Put on mask';
                else if (coatRack) hint.textContent = coat.on ? '[E] Take off lab coat' : '[E] Put on lab coat';
                else if (tbin) {
                    hint.textContent = gloves.on
                        ? '[E] Throw away gloves'
                        : mask.on ? '[E] Throw away mask' : 'Nothing to throw away';
                }
                hint.style.display = (simDoor || target || gbox || mbox || coatRack || tbin) ? 'block' : 'none';
                // F2 data sheet for bottles; F3: empty-handed aim at the flask
                // shows its contents breakdown instead.
                showAimInfo(target || aimAt('isBeaker', 2.5), beaker);
            } else if (state === 'HOLDING') {
                const overDoor = simDoors.aim(camera);
                const overBeaker = overDoor ? null : aimAt('isBeaker', 2);
                const overGloveBox = overBeaker ? null : aimAt('gloveBox', 2.5);
                // The [Q] return notice only appears near the chemical shelf —
                // exactly where Q actually works (near + facing). Away from the
                // shelf the hint directs the player there instead.
                let showHint = false;
                if (overDoor) {
                    hint.textContent = 'Set the bottle down first';     // nothing is carried past a door
                    showHint = true;
                } else if (overBeaker) {
                    hint.textContent = `[E] Pour ${heldBottle.userData.name}`;
                    showHint = true;
                } else if (overGloveBox) {
                    hint.textContent = 'Set the bottle down first';  // F5: no gloving-up mid-carry
                    showHint = true;
                } else if (inZone('shelf', camera)) {
                    hint.textContent = `[Q] Put back ${heldBottle.userData.name}`;
                    showHint = true;
                }
                hint.style.display = showHint ? 'block' : 'none';
                // Over the flask: show ITS panel (contents) right as the pour is
                // prepared; elsewhere the stale bottle sheet fades out.
                showAimInfo(overBeaker, beaker);
            } else {
                hint.style.display = 'none';
            }
        }
    };
}
