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
import { quality } from './quality.js';

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
    // PERF (Phase 5a): see furniture.js — real transmission costs an extra
    // full-scene pass per frame, so it's disabled on LOW quality.
    transmission: quality.level === 'high' ? 0.9 : 0,
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

  // --- powder heap (T4b): a matte cone shown while the flask holds ONLY
  // solids. Same translate trick as the liquid: base at local y=0, scale.y =
  // heap height, so mlToY keeps powder honest against the graduations too.
  // The grain look: one GRAYSCALE speckle texture × material.color — tinting
  // beats regenerating a canvas for every chemical, and colorChange effects
  // keep working (they mutate the color, the speckle stays).
  function makeGrainTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#dcdcdc';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2000; i++) {
      const v = 170 + (Math.random() * 85) | 0;    // light grays -> white grains
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random(), 1 + Math.random());
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }
  const heapMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: makeGrainTexture(),
    roughness: 0.95
  });
  const heapGeom = new THREE.ConeGeometry(LIQ_R * 0.92, 1, 24);
  heapGeom.translate(0, 0.5, 0);                   // base at y=0, apex up
  const heap = new THREE.Mesh(heapGeom, heapMat);
  heap.position.y = LIQ_BASE;
  heap.visible = false;
  group.add(heap);
  let heapOnly = false;   // true while the contents are undissolved powder

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
  // beaker at (-0.3, 1.0, -1.5).
  group.position.set(-0.55, 1.0, -1.5);
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
  // displayName: the label line 1 when the contents are a reaction mixture —
  // never "Unknown Mixture": a settled reaction names its real product.
  const contents = { list: [], currentId: null, totalMl: 0, temp: 25, displayName: null };
  let pendingRule = null;              // the rule whose effects are still playing
  let warningTimer = null;             // delayed reaction warning (shows after the effects start)
  let lastShownTemp = 25;              // throttles label redraws while the liquid cools

  function setLabel(line1, line2) {
    if (label.material.map) label.material.map.dispose();   // old texture -> GPU leak otherwise
    label.material.map = makeLabelTexture(line1, line2);
    label.material.needsUpdate = true;
  }

  function refreshLabel() {
    lastShownTemp = Math.round(contents.temp);
    if (!contents.currentId) {
      setLabel('Reaction Flask', 'empty');
      return;
    }
    const chem = getChemical(contents.currentId);
    const line1 = contents.displayName || chem.name;   // never "Unknown Mixture"
    const unit = heapOnly ? 'g' : 'ml';                // powder heaps weigh grams, liquids measure ml
    setLabel(line1, `${chem.formula} · ${contents.totalMl} ${unit} · ${Math.round(contents.temp)}°C`);
  }

  // Contents visuals follow totalMl. ONE function for both physical states:
  // heapOnly -> the powder cone rises to the graduation line; otherwise the
  // liquid column + meniscus disc do (and the heap hides — dissolved).
  function syncContents() {
    const has = contents.totalMl > 0;
    heap.visible = has && heapOnly;
    liquid.visible = has && !heapOnly;
    surface.visible = has && !heapOnly;
    if (!has) return;
    if (heapOnly) {
      heap.scale.y = Math.max(0.0001, mlToY(contents.totalMl) - LIQ_BASE);
    } else {
      liquid.scale.y = Math.max(0.0001, mlToY(contents.totalMl) - LIQ_BASE);
      surface.position.y = mlToY(contents.totalMl) + 0.0004;
    }
  }

  // One message builder for EVERY rule kind: reactions settling in update(),
  // dissolutions and inert mixes handled inline in receive(). The equation
  // chip prefers the teacher's hand-written `equation` (real products like
  // "2NaOH + H2SO4 → Na2SO4 + 2H2O") and only auto-builds from formulas when
  // the rule didn't bother (products match the flask contents then).
  function resultMsg(rule) {
    const into = getChemical(rule.reactants.into);
    const added = getChemical(rule.reactants.added);
    const product = getChemical(rule.result.chemicalId);
    return {
      title: rule.title || rule.warning?.title || product.name,
      equation: rule.equation || `${into.formula} + ${added.formula} \u2192 ${product.formula}`,
      tempAfter: rule.tempAfter,
      text: rule.explanation || rule.result.note || product.description
    };
  }

  // The rich result toast, fired when a reaction settles. Popup is
  // non-blocking — the lab keeps running. Danger reactions skip this: their
  // blocking red card (2.5 s in) already carries title + explanation, and a
  // toast behind it would just double up.
  function showResult(rule) {
    if (rule.danger) return;
    warningCard.show(resultMsg(rule), 'info');
  }

  // When a real reaction has no single clean product (an oxidation residue, a
  // burnt mess...), its result is the 'mixture' chemical. The flask label must
  // never read "Unknown Mixture": prefer the teacher's short product name from
  // result.name, then the result note, then the two reactant names.
  function productLabel(rule) {
    if (rule.result.chemicalId !== 'mixture') return null;
    if (rule.result.name) return rule.result.name;
    const note = (rule.result.note || '').trim().replace(/\.$/, '');
    if (note) return note.charAt(0).toUpperCase() + note.slice(1);
    return `${getChemical(rule.reactants.into).name} + ${getChemical(rule.reactants.added).name}`;
  }

  function setContents(id, tempAfter, displayName) {
    if (!id) {                        // emptied
      clearTimeout(warningTimer);      // no queued card after a reset
      state = 'EMPTY';
      contents.list = [];
      contents.currentId = null;
      contents.totalMl = 0;
      heapOnly = false;
      contents.temp = 25;              // an empty flask is back at room temperature
      contents.displayName = null;
      syncContents();
      refreshLabel();
      return;
    }
    // Reaction settled: the constituents are consumed, the product IS the volume.
    const chem = getChemical(id);
    state = 'HAS_CONTENTS';
    contents.currentId = id;
    contents.displayName = displayName ?? null;
    contents.list = [{ chemicalId: id, ml: contents.totalMl }];
    if (tempAfter !== undefined) contents.temp = tempAfter;   // exo/endothermic outcome
    heapOnly = chem.state === 'powder';   // a solid product stays a heap
    liquid.material.color.set(chem.color);   // .set mutates in place — no new material
    syncContents();
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
    const unit = heapOnly ? 'g' : 'ml';
    warningCard.show({
      title: 'The flask is full',
      text: `It holds ${CAPACITY} ${unit} at most and already contains ${contents.totalMl} ${unit}. Press R to empty it and start over.`
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
      heapOnly = chem.state === 'powder';   // dry salt into a dry flask = a heap
      liquid.material.color.set(chem.color);
      syncContents();
      refreshLabel();
      return { ok: true };
    }

    const rule = findReaction(contents.currentId, addedId, getReactions());
    contents.totalMl += ml;
    contents.list.push({ chemicalId: addedId, ml });
    // Powder stays a heap only while EVERY pour has been powder. The first
    // liquid wets it: the heap disappears into a liquid column (dissolution —
    // or a real reaction, which the rule below decides).
    heapOnly = heapOnly && getChemical(addedId).state === 'powder';

    if (addedId === contents.currentId) {
      // Same chemical into itself (HCl into HCl): that's just MORE of the
      // same thing, not a reaction. The volume rises, nothing else changes.
      syncContents();
      refreshLabel();
      return { ok: true };
    }

    if (!rule) {
      // No rule: they just mix. The flask KEEPS the first chemical's identity
      // (a mix of unreactive liquids is still mostly the first liquid) and the
      // blended color tints the liquid — so the label never reads "Unknown
      // Mixture" and later pours keep finding the right reactions. The pour-by-
      // pour breakdown survives for the side panel; the toast says WHAT mixed.
      const aName = getChemical(contents.currentId).name;
      const bName = getChemical(addedId).name;
      const mix = defaultMix(getChemical(contents.currentId).color, getChemical(addedId).color);
      liquid.material.color.set(mix.mixedColor);   // override the generic gray
      syncContents();
      refreshLabel();
      warningCard.show({
        title: 'No reaction',
        text: `${aName} and ${bName} have no known reaction — they simply mixed.`
      }, 'info');
      return { ok: true };
    }

    if (rule.inert) {
      // An inert pair (two acids, two salts, salt in alcohol...): a rule
      // EXISTS so the toast can say WHY nothing happens, and no new substance
      // forms. The flask KEEPS the first chemical's identity — same reason as
      // above: inert liquids simply dilute each other, later pours still find
      // the right reactions, and the label never reads "Unknown Mixture".
      // The curated mixColor tints the liquid so the mix still reads visually.
      liquid.material.color.set(rule.mixColor || getChemical(contents.currentId).color);
      syncContents();
      refreshLabel();
      warningCard.show({
        title: rule.title,
        text: rule.explanation
      }, 'info');
      return { ok: true };
    }

    if (rule.dissolve) {
      // Dissolution (salt/crystal into liquid): no reaction, but the solid
      // genuinely disappears into the liquid and keeps its identity — the
      // product IS the dissolved chemical (CuSO4 in water stays CuSO4), so
      // later pours (NaOH → precipitate) still chain correctly. heapOnly is
      // forced off so the powder never re-heaps.
      const chem = getChemical(rule.result.chemicalId);
      const mouth = group.position.clone();
      mouth.y += RIM_Y;
      effectRunner.play(rule.effects, mouth);      // gentle bubbles as it dissolves
      contents.currentId = rule.result.chemicalId;
      heapOnly = false;                            // dissolved — powder never re-heaps
      if (rule.tempAfter !== undefined) contents.temp = rule.tempAfter;
      liquid.material.color.set(chem.color);
      syncContents();
      refreshLabel();
      warningCard.show(resultMsg(rule), 'info');
      return { ok: true };
    }

    // A real reaction (Ch 6.4 steps 7-9): hand the effect DESCRIPTORS — plain
    // data straight from the teacher's JSON — to the runner, which turns them
    // into particles, lights and shakes. The flask never knows how.
    state = 'REACTING';
    pendingRule = rule;
    syncContents();                        // the poured volume is in — liquid rises now
    refreshLabel();

    // Phase 7 pedagogy: danger = red card over the eruption; a correct
    // procedure with a warning block = blue reinforcement card. Shown a beat
    // AFTER the pour lands so the player sees the reaction start (fire, smoke,
    // bubbles) before the card covers the screen — not instantly on the pour.
    if (rule.warning) {
      clearTimeout(warningTimer);
      warningTimer = setTimeout(
        () => warningCard.show(rule.warning, rule.danger ? 'danger' : 'info'),
        2500
      );
    }

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
        isPowder: heapOnly,             // powder heap -> grams, liquid -> ml
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
      // The heap tints the same way: grayscale speckle map × liquid color =
      // colored crystals, and colorChange effects work on powder too.
      if (heap.visible) heapMat.color.copy(liquidMat.color);

      // While REACTING, wait for every effect to finish, then settle into the
      // product (Ch 6.4 step 10). runner.busy replaces the Phase 5 timer.
      if (state === 'REACTING' && !effectRunner.busy) {
        const rule = pendingRule;
        setContents(rule.result.chemicalId, rule.tempAfter, productLabel(rule));   // sets state = HAS_CONTENTS too
        showResult(rule);               // announce the product, temp and explanation
        pendingRule = null;
      }

      // Exothermic/endothermic afterglow: the liquid slowly cools (or warms)
      // back to room temperature. The floating label only redraws when the
      // displayed degree actually changes, so cooling costs almost nothing.
      if (state === 'HAS_CONTENTS' && contents.temp !== 25) {
        contents.temp += (25 - contents.temp) * Math.min(1, delta * 0.04);
        if (Math.abs(contents.temp - 25) < 0.5) contents.temp = 25;
        const shown = Math.round(contents.temp);
        if (shown !== lastShownTemp) {
          lastShownTemp = shown;
          refreshLabel();
        }
      }
    }
  };
}
