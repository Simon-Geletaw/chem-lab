// beaker.js — the reaction flask: a procedural GRADUATED beaker (F3) with a
// real volume model, printed ml marks, a liquid that rises to the exact line,
// and a floating label showing contents · volume · temperature.
//
// Built from PRIMITIVES (no downloaded model) because we need to OWN its parts:
// the liquid mesh must change color/height and the effects system needs its
// exact position. The GLB beaker stays as decoration; this one is the tool.
//
// THE calibration trick (F3): ONE function, mlToY(ml), converts a volume to a
// height. Both the printed graduation marks AND the liquid surface use it, so
// they can never disagree — pour 25 ml and the surface sits ON the 25 line.
//
// The flask's FSM (book Ch 6.3):
//   EMPTY --receive(chem, ml)--> HAS_CONTENTS --receive + rule--> REACTING --done--> HAS_CONTENTS
//     ^                                                                                  |
//     '------------------------------- R key (reset) -------------------------------------'
import * as THREE from 'three';
import { getChemical, getData } from './chemistry/registry.js';
import { findReaction, defaultMix } from './chemistry/reactionEngine.js';

const getReactions = () => getData().reactions;

// ---------------------------------------------------------------- dimensions
// All in meters (1 unit = 1 m). A ~100 ml lab beaker, slightly oversized so
// the graduation numbers stay readable from a standing player.
const CAPACITY = 100;        // ml — hard limit, receive() rejects past this
const RIM_Y = 0.15;          // top of the flared rim
const LIQ_R = 0.046;         // liquid radius: 4 mm inside the glass = no z-fight
const LIQ_BASE = 0.006;      // y of the liquid column's base (above glass floor)
const ML_TOP = 0.126;        // y of the 100 ml line (below the flare)

// volume -> height. THE single source of truth shared by ticks and liquid.
const mlToY = (ml) => LIQ_BASE + (ml / CAPACITY) * (ML_TOP - LIQ_BASE);

export function createBeaker(scene, interactableObjects, camera, effectRunner, warningCard) {
  const group = new THREE.Group();

  // --- glass: a LatheGeometry surface of revolution — floor, straight wall,
  // and a 1 cm outward flare that reads as a pouring rim. One profile gives
  // floor + wall in a single mesh (no separate bottom circle needed).
  // MeshPhysicalMaterial.transmission = real refraction, so it reads as glass.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8f4ff,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 0.02,
    ior: 1.5,
    clearcoat: 1,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const profile = [
    [0.0, 0.003],      // center of the floor
    [0.032, 0.003],    // flat floor
    [0.046, 0.005],    // rounded floor corner
    [0.05, 0.012],     // wall begins
    [0.05, 0.138],     // straight wall ends
    [0.0535, 0.145],   // flare out…
    [0.057, RIM_Y]     // …to the rim lip
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), glassMat);
  group.add(glass);

  // --- rim highlight: a thin torus hugging the lip sells "thick glass edge".
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.0022, 8, 32), glassMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = RIM_Y;
  group.add(rim);

  // --- graduation marks: a transparent canvas texture wrapped on an open
  // cylinder JUST outside the glass (r 0.0512 vs 0.05) — printed enamel look.
  // FrontSide only: the far side's mirrored text is culled instead of showing
  // reversed through the glass.
  const MARK_BOTTOM = 0.0;
  const MARK_TOP = 0.132;
  function makeMarksTexture() {
    const W = 1024, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    for (const ml of [25, 50, 75, 100]) {
      const v = (mlToY(ml) - MARK_BOTTOM) / (MARK_TOP - MARK_BOTTOM);
      const y = (1 - v) * H;
      // soft dark underline first = contrast against any liquid color
      ctx.fillStyle = 'rgba(20, 30, 40, 0.35)';
      ctx.fillRect(0, y + 2, W, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(0, y - 2, W, 4);
      // the number twice around the circumference → readable from two sides
      ctx.font = 'bold 44px Arial';
      ctx.textAlign = 'left';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(20, 30, 40, 0.7)';
      ctx.fillStyle = '#ffffff';
      const text = ml === 100 ? '100 ml' : `${ml}`;
      for (const u of [0.08, 0.58]) {
        ctx.strokeText(text, u * W, y - 12);
        ctx.fillText(text, u * W, y - 12);
      }
    }
    return new THREE.CanvasTexture(canvas);
  }
  const marks = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0512, 0.0512, MARK_TOP - MARK_BOTTOM, 32, 1, true),
    new THREE.MeshBasicMaterial({
      map: makeMarksTexture(),
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide
    })
  );
  marks.position.y = (MARK_TOP + MARK_BOTTOM) / 2;
  marks.renderOrder = 1;   // draw AFTER the glass: crisp print, no sort-flicker
  group.add(marks);

  // --- liquid: a unit-height cylinder with its BASE at local y=0 (translate
  // trick), so scale.y = column height and the base never moves. mlToY drives
  // the height — the same function that printed the tick lines.
  const liquidMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const liquidGeom = new THREE.CylinderGeometry(LIQ_R, LIQ_R, 1, 32);
  liquidGeom.translate(0, 0.5, 0);
  const liquid = new THREE.Mesh(liquidGeom, liquidMat);
  liquid.position.y = LIQ_BASE;
  liquid.visible = false;
  group.add(liquid);

  // --- liquid surface: a slightly lighter disc riding on top of the column —
  // a visible meniscus line right where the graduation mark is.
  const surfaceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(LIQ_R, 32), surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.visible = false;
  group.add(surface);
  const _white = new THREE.Color(0xffffff);

  // --- floating content label: canvas-texture, redrawn only when contents
  // change. Line 1 = chemical name; line 2 = formula · volume · temperature.
  function makeLabelTexture(line1, line2) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
    ctx.beginPath();
    ctx.roundRect(2, 2, 380, 124, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(line1, 192, 50);
    ctx.fillStyle = '#9fc5e8';
    ctx.font = '26px Arial';
    ctx.fillText(line2, 192, 94);
    return new THREE.CanvasTexture(canvas);
  }

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.093),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  );
  label.position.y = 0.26;            // floats above the rim
  group.add(label);

  // --- placement: island bench worktop, left of the burner, clear of the GLB
  // beaker at (-0.3, 0.9, -1.5).
  group.position.set(-0.55, 0.9, -1.5);
  group.userData = {
    isBeaker: true,
    name: 'Reaction Flask',
    description: `The main reaction vessel — a graduated 100 ml beaker. Carry a bottle here and pour to see what happens.`
  };
  scene.add(group);
  interactableObjects.push(group);

  // ------------------------------------------------------------------ state
  let state = 'EMPTY';                // 'EMPTY' | 'HAS_CONTENTS' | 'REACTING'
  // F3 volume model: what's in the flask, as data.
  //   list     — the pour-by-pour breakdown, for the side panel
  //   currentId— the single chemical the flask "is" (drives rules + label)
  //   totalMl  — drives the liquid height via mlToY
  //   temp     — °C; constant 25 until F6 (burner/ice bath) animates it
  const contents = { list: [], currentId: null, totalMl: 0, temp: 25 };
  let pendingResult = null;           // what the flask becomes once effects finish

  function setLabel(line1, line2) {
    if (label.material.map) label.material.map.dispose();   // old texture -> GPU leak otherwise
    label.material.map = makeLabelTexture(line1, line2);
    label.material.needsUpdate = true;
  }

  function refreshLabel() {
    if (!contents.currentId) {
      setLabel('Reaction Flask', 'empty');
      return;
    }
    const chem = getChemical(contents.currentId);
    setLabel(chem.name, `${chem.formula} · ${contents.totalMl} ml · ${Math.round(contents.temp)}°C`);
  }

  // Liquid height + surface disc follow totalMl. Called on every change.
  function syncLiquid() {
    const has = contents.totalMl > 0;
    liquid.visible = has;
    surface.visible = has;
    if (!has) return;
    liquid.scale.y = Math.max(0.0001, mlToY(contents.totalMl) - LIQ_BASE);
    surface.position.y = mlToY(contents.totalMl) + 0.0004;
  }

  // Full clear (R key / pause-menu reset) or post-reaction settle both land here.
  function setContents(id) {
    if (!id) {                        // emptied
      state = 'EMPTY';
      contents.list = [];
      contents.currentId = null;
      contents.totalMl = 0;
      syncLiquid();
      refreshLabel();
      return;
    }
    // Reaction settled: the constituents are consumed, the product IS the volume.
    const chem = getChemical(id);
    state = 'HAS_CONTENTS';
    contents.currentId = id;
    contents.list = [{ chemicalId: id, ml: contents.totalMl }];
    liquid.material.color.set(chem.color);   // .set mutates in place — no new material
    syncLiquid();
    refreshLabel();
  }

  // Can the flask take this pour right now? The hand asks BEFORE animating,
  // so a rejected pour never plays a stream that delivers nothing.
  function checkReceive(ml) {
    if (state === 'REACTING') return 'reacting';
    if (contents.totalMl + ml > CAPACITY) return 'full';
    return 'ok';
  }

  function warnFull() {
    warningCard.show({
      title: 'The flask is full',
      text: `It holds ${CAPACITY} ml at most and already contains ${contents.totalMl} ml. Press R to empty it and start over.`
    }, 'info');
  }

  // The single entry point the hand calls when a pour lands (Phase 4), now
  // volume-aware (F3): every pour carries an ml amount. 25 ml per pour until
  // the F4 dialog lets the player choose.
  function receive(addedId, ml = 25) {
    const verdict = checkReceive(ml);
    if (verdict === 'full') { warnFull(); return { ok: false, reason: 'full' }; }
    if (verdict !== 'ok') return { ok: false, reason: verdict };

    if (state === 'EMPTY') {
      const chem = getChemical(addedId);
      state = 'HAS_CONTENTS';
      contents.currentId = addedId;
      contents.list = [{ chemicalId: addedId, ml }];
      contents.totalMl = ml;
      liquid.material.color.set(chem.color);
      syncLiquid();
      refreshLabel();
      return { ok: true };
    }

    const rule = findReaction(contents.currentId, addedId, getReactions());
    contents.totalMl += ml;
    contents.list.push({ chemicalId: addedId, ml });

    if (!rule) {
      // No rule: they just mix. Average the colors, contents become 'mixture' —
      // but the pour-by-pour breakdown survives for the side panel.
      const mix = defaultMix(getChemical(contents.currentId).color, getChemical(addedId).color);
      contents.currentId = mix.result.chemicalId;
      liquid.material.color.set(mix.mixedColor);   // override the generic gray
      syncLiquid();
      refreshLabel();
      return { ok: true };
    }

    // A real reaction (Ch 6.4 steps 7-9): hand the effect DESCRIPTORS — plain
    // data straight from the teacher's JSON — to the runner, which turns them
    // into particles, lights and shakes. The flask never knows how.
    state = 'REACTING';
    pendingResult = rule.result.chemicalId;
    syncLiquid();                        // the poured volume is in — liquid rises now
    refreshLabel();

    // Phase 7 pedagogy: danger = red card over the eruption; a correct
    // procedure with a warning block = blue reinforcement card.
    if (rule.warning) warningCard.show(rule.warning, rule.danger ? 'danger' : 'info');

    const mouth = group.position.clone();
    mouth.y += RIM_Y;                    // effects spawn at the rim, not the base
    effectRunner.play(rule.effects, mouth);
    return { ok: true };
  }

  // R = reset, for demo flow (book Ch 3.3 step 3). Guarded so typing in a
  // dialog input (F4 custom amount) can never nuke the flask.
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.code === 'KeyR' && state !== 'EMPTY') setContents(null);
  });

  refreshLabel();                        // label reads "Reaction Flask · empty" on load

  return {
    group,
    liquidMaterial: liquidMat,        // Phase 6b's colorChange effect needs this
    rimY: RIM_Y,                      // the hand aims the pour stream at the rim
    get state() { return state; },
    get contentsId() { return contents.currentId; },
    receive,
    checkReceive,
    warnFull,
    setContents,
    reset() { setContents(null); },   // pause-menu "Reset Flask" = restart reactions

    // Everything the side panel needs, as plain data (hand.js renders it).
    getInfo() {
      return {
        capacity: CAPACITY,
        totalMl: contents.totalMl,
        temp: Math.round(contents.temp),
        currentId: contents.currentId,
        list: contents.list.map((e) => ({ ...e }))
      };
    },

    update(delta) {
      // Billboard the label toward the player (same trick as proximity cards).
      // lookAt takes a WORLD position; the group is unrotated, so this is safe.
      label.lookAt(camera.position);

      // The surface disc shadows the liquid color every frame, so the
      // colorChange effect (which mutates liquidMat.color) carries it along.
      if (surface.visible) surfaceMat.color.copy(liquidMat.color).lerp(_white, 0.18);

      // While REACTING, wait for every effect to finish, then settle into the
      // product (Ch 6.4 step 10). runner.busy replaces the Phase 5 timer.
      if (state === 'REACTING' && !effectRunner.busy) {
        setContents(pendingResult);   // sets state = HAS_CONTENTS too
      }
    }
  };
}
