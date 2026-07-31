// beaker.js — the reaction vessel: a procedural glass beaker with a visible,
// colorable liquid, standing on the island bench.
//
// Built from PRIMITIVES (no downloaded model) because we need to OWN its parts:
// the liquid mesh must change color and the effects system (Phase 6) needs its
// exact position. The GLB beaker stays as decoration; this one is the tool.
//
// The beaker's FSM (book Ch 6.3):
//   EMPTY --receive(chem)--> HAS_CONTENTS --receive + rule--> REACTING --done--> HAS_CONTENTS
//     ^                                                                              |
//     '----------------------------- R key (reset) ----------------------------------'
//
// Phase 3 builds EMPTY <-> HAS_CONTENTS and logs the mix; Phase 5 adds the
// reaction engine + REACTING.
import * as THREE from 'three';
import { getChemical, getData } from './chemistry/registry.js';
import { findReaction, defaultMix } from './chemistry/reactionEngine.js';

const getReactions = () => getData().reactions;

export function createBeaker(scene, interactableObjects, camera, effectRunner) {
  const group = new THREE.Group();

  // --- glass: an OPEN cylinder (openEnded=true keeps the top uncovered).
  // DoubleSide is essential: an open cylinder has an inside you can see into,
  // and single-sided faces are invisible from behind (book Phase 3 pitfalls).
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdfefff,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    side: THREE.DoubleSide
  });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.045, 0.14, 24, 1, true),
    glassMat
  );
  wall.position.y = 0.07;
  group.add(wall);

  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), glassMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.002;
  group.add(bottom);

  // --- liquid: a solid cylinder INSIDE the glass. Radius 0.043 vs glass 0.045
  // leaves the 2 mm gap that prevents z-fighting flicker (book Ch 11.3).
  const liquidMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.041, 0.06, 24),
    liquidMat
  );
  liquid.position.y = 0.033;          // bottom third of the beaker
  liquid.visible = false;             // empty until something is poured
  group.add(liquid);

  // --- floating content label: reuses the canvas-texture trick. Redrawn on
  // every setContents(); tiny canvas is fine for two short lines.
  function makeLabelTexture(line1, line2) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
    ctx.beginPath();
    ctx.roundRect(2, 2, 252, 92, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px Arial';
    ctx.fillText(line1, 128, 38);
    ctx.fillStyle = '#9fc5e8';
    ctx.font = '20px Arial';
    ctx.fillText(line2, 128, 70);
    return new THREE.CanvasTexture(canvas);
  }

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.1),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  );
  label.position.y = 0.24;            // floats above the rim
  label.visible = false;
  group.add(label);

  // --- placement: island bench worktop, left of the burner, clear of the GLB
  // beaker at (-0.3, 0.9, -1.5).
  group.position.set(-0.55, 0.9, -1.5);
  group.userData = {
    isBeaker: true,
    name: 'Reaction Beaker',
    description: 'The main reaction vessel. Carry a bottle here and pour to see what happens.'
  };
  scene.add(group);
  interactableObjects.push(group);

  // ------------------------------------------------------------------ state
  let state = 'EMPTY';                // 'EMPTY' | 'HAS_CONTENTS' | 'REACTING'
  let contentsId = null;
  let pendingResult = null;           // what the beaker becomes once effects finish

  function setLabel(chem) {
    if (label.material.map) label.material.map.dispose();   // old texture -> GPU leak otherwise
    label.material.map = makeLabelTexture(chem.name, chem.formula);
    label.material.needsUpdate = true;
    label.visible = true;
  }

  function setContents(id) {
    contentsId = id;
    if (!id) {                        // emptied
      state = 'EMPTY';
      liquid.visible = false;
      label.visible = false;
      return;
    }
    const chem = getChemical(id);
    state = 'HAS_CONTENTS';
    liquid.visible = true;
    liquid.material.color.set(chem.color);   // .set mutates in place — no new material
    setLabel(chem);
  }

  // The single entry point the hand calls when a pour lands (Phase 4), now
  // routed through the reaction engine (Phase 5).
  function receive(addedId) {
    if (state === 'REACTING') return;   // can't pour into an erupting beaker (Ch 6.3)

    if (state === 'EMPTY') {
      setContents(addedId);
      return;
    }

    const rule = findReaction(contentsId, addedId, getReactions());

    if (!rule) {
      // No rule: they just mix. Average the colors, contents become 'mixture'.
      const mix = defaultMix(getChemical(contentsId).color, getChemical(addedId).color);
      setContents(mix.result.chemicalId);
      liquid.material.color.set(mix.mixedColor);   // override the generic gray
      return;
    }

    // A real reaction (Ch 6.4 steps 7-9): hand the effect DESCRIPTORS — plain
    // data straight from the teacher's JSON — to the runner, which turns them
    // into particles, lights and shakes. The beaker never knows how.
    state = 'REACTING';
    pendingResult = rule.result.chemicalId;

    if (rule.danger) console.warn('DANGER:', rule.warning.title, '—', rule.warning.text);

    const mouth = group.position.clone();
    mouth.y += 0.14;                     // effects spawn at the rim, not the base
    effectRunner.play(rule.effects, mouth);
  }

  // R = reset, for demo flow (book Ch 3.3 step 3). Guarded so typing R in a
  // future input field can't nuke the beaker: only with pointer lock active.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && state !== 'EMPTY') setContents(null);
  });

  return {
    group,
    liquidMaterial: liquidMat,        // Phase 6b's colorChange effect needs this
    get state() { return state; },
    get contentsId() { return contentsId; },
    receive,
    setContents,

    update(delta) {
      // Billboard the label toward the player (same trick as proximity cards).
      // lookAt takes a WORLD position; the group is unrotated, so this is safe.
      if (label.visible) label.lookAt(camera.position);

      // While REACTING, wait for every effect to finish, then settle into the
      // product (Ch 6.4 step 10). runner.busy replaces the Phase 5 timer.
      if (state === 'REACTING' && !effectRunner.busy) {
        setContents(pendingResult);   // sets state = HAS_CONTENTS too
      }
    }
  };
}
