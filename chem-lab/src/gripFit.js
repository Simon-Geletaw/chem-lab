// gripFit.js — procedural grip fitting: find the hand ROLL and per-joint curl
// angles that make the fingers actually WRAP the bottle, by measuring the
// loaded skeleton — no hand-tuned pose constants.
//
// WHY A ROLL: at bind pose the fingers point along the bottle's own axis
// (straight up). Fingers parallel to a cylinder can only touch it along a
// line — no flexion axis can wrap them around it (measured: single-axis
// z-flexion left every mid-joint 1-4 cm INSIDE the glass). A real hand rolls
// at the wrist so the fingers run HORIZONTAL, then curls them around the
// vertical bottle. So the fitter sweeps a roll about the palm normal
// (rollGroup.rotation.z) and, for each roll, curls every joint about its
// local X (the anatomical curl axis) until each fingertip/segment rides the
// glass. The roll+pose with the most surface contact and least penetration
// wins.
//
// PURE LOGIC RULE: no DOM, no textures — only Three.js math. grip-audit.mjs
// (headless Node) imports THIS file and verifies the same code path the
// browser runs.
import * as THREE from 'three';

const FINGERS = ['index', 'midd', 'ring', 'pinky'];
const FINGER_JOINTS = ['meta', 'prox', 'midd', 'dist'];
const THUMB_JOINTS = ['trapez', 'meta', 'prox', 'dist'];

// Anatomical flexion caps (radians) about the local X curl axis.
// meta = metacarpal (in-palm, nearly rigid), prox = MCP, midd = PIP, dist = DIP.
const FINGER_CAPS = [0.15, 1.5, 1.7, 1.1];
const THUMB_CAPS = [0.5, 1.0, 1.0, 0.9];

const STEP = 0.03;          // rad per curl sweep step
const ROLL_MIN = -1.8, ROLL_MAX = 1.8, ROLL_STEP = 0.15;
const SKIN = 0.004;         // pads rest 4 mm outside the glass
const PENETRATION = 0.002;  // >2 mm inside the glass counts as a violation

/**
 * @param {Object} opts
 * @param {Object}   opts.bones     bone map of the DISPLAYED skeleton: { name: {bone, baseQuat} }
 * @param {THREE.Object3D} opts.rig       hand rig (bottle parent) — defines measurement space
 * @param {THREE.Object3D} opts.rollGroup group between orient and the hand model; z-rotation = roll
 * @param {THREE.Object3D} opts.anchorObject the hand model root IN THE SCENE (clone for the right hand)
 * @param {THREE.Vector3}  opts.anchorPoint  palm anchor in anchorObject LOCAL space — where the
 *                                            bottle base sits (already offset one bottle radius
 *                                            outside the palm along +z, the palm normal)
 * @param {number}   opts.bottleR   bottle body radius (m)
 * @returns {{ perJoint, roll, gripPos, contacts, penetrations, summary }}
 */
export function fitGrip({ bones, rig, rollGroup, anchorObject, anchorPoint, bottleR, handScale }) {
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const target = bottleR + SKIN;
  const gripPos = new THREE.Vector3();

  // offsetM shifts the bottle axis along the palm normal (model +z), in
  // METERS. The mesh-measured palm surface overshoots (thumb-base bulge), so
  // the optimizer probes a few millimeters inward/outward for the offset
  // where the fingers can actually close on the glass.
  function computeGripPos(offsetM) {
    anchorObject.updateWorldMatrix(true, false);
    _p.copy(anchorPoint);
    _p.z += offsetM / handScale;
    anchorObject.localToWorld(_p);
    rig.worldToLocal(_p);
    gripPos.copy(_p);
  }

  // Radial distance (m) of a bone (or its extrapolated tip) from the vertical
  // bottle axis through gripPos, in RIG space. Mirror/orient/roll/scale all
  // collapse into this one measured conversion.
  function radialOf(bone, tipOffset) {
    bone.updateWorldMatrix(true, false);
    if (tipOffset) {
      _p.copy(tipOffset);
      bone.localToWorld(_p);
    } else {
      bone.getWorldPosition(_p);
    }
    rig.worldToLocal(_p);
    return Math.hypot(_p.x - gripPos.x, _p.z - gripPos.z);
  }

  function setCurl(entry, angle) {
    _q.setFromAxisAngle(X_AXIS, angle);
    entry.bone.quaternion.copy(entry.baseQuat).multiply(_q);
  }

  const tipOffsetOf = (entry) =>
    new THREE.Vector3(0, entry.bone.position.length() * 0.75, 0);

  // Curl one digit, joints root->tip, LEAVING it posed. Each joint keeps the
  // angle whose controlled point (next joint down; extrapolated tip for the
  // last) sits closest to the resting surface, with penetration heavily
  // penalized so fingers wrap around the glass, never through it.
  function fitDigit(jointNames, caps) {
    const chain = jointNames.map((n) => bones[n]).filter(Boolean);
    chain.forEach((e) => e.bone.quaternion.copy(e.baseQuat));
    const angles = new Array(chain.length).fill(0);
    let touched = false;

    for (let ji = 0; ji < chain.length; ji++) {
      const entry = chain[ji];
      const isLast = ji === chain.length - 1;
      const nextBone = isLast ? entry.bone : chain[ji + 1].bone;
      const tipOffset = isLast ? tipOffsetOf(entry) : null;

      let best = 0;
      let bestScore = Infinity;
      for (let a = 0; a <= caps[ji] + 1e-9; a += STEP) {
        setCurl(entry, a);
        const r = radialOf(nextBone, tipOffset);
        const score = Math.abs(r - target) + (r < bottleR - PENETRATION ? 10 : 0);
        if (score < bestScore) { bestScore = score; best = a; }
      }
      setCurl(entry, best);
      angles[ji] = best;
      if (isLast && bestScore <= 0.006) touched = true;   // tip riding the glass
    }
    return { chain, angles, touched };
  }

  const digits = [
    ...FINGERS.map((f) => ({ name: f, joints: FINGER_JOINTS.map((j) => `${f}_${j}`), caps: FINGER_CAPS })),
    { name: 'thumb', joints: THUMB_JOINTS.map((j) => `thumb_${j}`), caps: THUMB_CAPS }
  ];

  const restoreAll = () => {
    for (const d of digits) {
      for (const n of d.joints) {
        const e = bones[n];
        if (e) e.bone.quaternion.copy(e.baseQuat);
      }
    }
  };

  // Try one roll+offset: fit every digit, then score the WHOLE hand posed.
  function tryRoll(roll, offsetM) {
    rollGroup.rotation.z = roll;
    rollGroup.updateWorldMatrix(true, true);
    computeGripPos(offsetM);

    const perJoint = {};
    let contacts = 0;
    const fitted = [];
    for (const d of digits) {
      const res = fitDigit(d.joints, d.caps);
      perJoint[d.name] = res.angles;
      if (res.touched) contacts++;
      fitted.push({ d, res });
    }

    // Score: penetrations are the cardinal sin, then tip-to-surface error.
    let penetrations = 0;
    let err = 0;
    const rows = [];
    for (const { d, res } of fitted) {
      for (const e of res.chain) {
        if (radialOf(e.bone) < bottleR - PENETRATION) penetrations++;
      }
      const last = res.chain[res.chain.length - 1];
      const tipR = radialOf(last.bone, tipOffsetOf(last));
      if (tipR < bottleR - PENETRATION) penetrations++;
      err += Math.abs(tipR - target);
      rows.push({ digit: d.name, angles: res.angles, touched: res.touched, tipR });
    }
    restoreAll();
    return {
      roll, offsetM, perJoint, contacts, penetrations, rows,
      gripPos: gripPos.clone(),
      score: penetrations * 1 + err + (5 - contacts) * 0.02
    };
  }

  // Phase 1: coarse roll sweep at the mesh-measured palm distance.
  let best = null;
  for (let roll = ROLL_MIN; roll <= ROLL_MAX + 1e-9; roll += ROLL_STEP) {
    const res = tryRoll(roll, 0);
    if (!best || res.score < best.score) best = res;
  }
  // Phase 2: probe the palm-normal offset at the winning roll — a few mm
  // closer usually lets the fingers actually close on the glass.
  for (const off of [-0.014, -0.010, -0.006, -0.003, 0.003]) {
    const res = tryRoll(best.roll, off);
    if (res.score < best.score) best = res;
  }
  // Phase 3: refine the roll around the winner at the winning offset.
  for (const dr of [-0.10, -0.05, 0.05, 0.10]) {
    const res = tryRoll(best.roll + dr, best.offsetM);
    if (res.score < best.score) best = res;
  }
  // Leave the rig exactly as we found it — update()/applyPose owns animation.
  rollGroup.rotation.z = 0;
  rollGroup.updateWorldMatrix(true, true);
  restoreAll();

  best.summary =
    `roll ${best.roll.toFixed(2)} rad · palm offset ${(best.offsetM * 1000).toFixed(0)} mm · ` +
    `contacts ${best.contacts}/5 · penetrations ${best.penetrations}\n` +
    best.rows
      .map((r) => `${r.digit}: [${r.angles.map((a) => a.toFixed(2)).join(', ')}] tip ${(r.tipR * 100).toFixed(1)}cm ${r.touched ? 'CONTACT' : 'no-contact'}`)
      .join('\n');
  return best;
}
