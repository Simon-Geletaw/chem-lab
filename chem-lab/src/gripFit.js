// gripFit.js — procedural grip fitting: curl each finger joint until it
// TOUCHES the bottle, instead of shipping hand-tuned pose constants.
//
// WHY: the old POSES.grip values were numerically fitted OFFLINE against one
// specific model + one grip position. Any change to the model, scale, or
// GRIP_POS silently broke the wrap (fingers hovering or piercing the glass).
// This module measures the ACTUAL skeleton at load time, in rig space, and
// finds the contact angle per joint — the same way you'd close your own hand
// around a bottle: each segment stops when it meets the glass.
//
// PURE LOGIC RULE: no DOM, no scene, no textures — only Three.js math. That
// is what lets grip-audit.mjs (headless Node) import THIS EXACT file and
// verify the same code path that runs in the browser.
//
// Algorithm, per digit (index/midd/ring/pinky/thumb), joints root -> tip:
//   1. sweep the joint's curl angle 0..cap in small steps about the grip
//      axis (z — the only flexion that wraps a VERTICAL bottle, measured
//      by the offline probes);
//   2. after each step, measure the controlled point (the NEXT joint down
//      the chain; for the last joint, an extrapolated fingertip) — radial
//      distance from the vertical bottle axis through gripPos, in rig space;
//   3. keep the FIRST angle that reaches the bottle surface (+ skin offset);
//      if the sweep never touches, keep the angle of closest approach;
//   4. back off while the point penetrates the glass.
// Joints are fitted in order, so each joint sees its parents already frozen.
import * as THREE from 'three';

const FINGERS = ['index', 'midd', 'ring', 'pinky'];
const FINGER_JOINTS = ['meta', 'prox', 'midd', 'dist'];
const THUMB_JOINTS = ['trapez', 'meta', 'prox', 'dist'];

// Anatomical range caps (radians) — a joint never curls past these even if
// it hasn't touched the bottle (short pinky, thumb base).
const FINGER_CAPS = [0.9, 1.6, 1.2, 0.9];   // meta, prox, midd, dist
const THUMB_CAPS = [0.4, 1.0, 1.1, 0.7];    // trapez, meta, prox, dist

const STEP = 0.02;          // rad per sweep step
const SKIN = 0.004;         // grip stops 4 mm outside the glass (finger pad)
const PENETRATION = 0.002;  // never allow a point more than 2 mm inside

/**
 * @param {Object}   bones    gloves.js bone map: { name: {bone, baseQuat} }
 * @param {THREE.Object3D} rig  the hand rig (bottle parent); defines the space
 * @param {THREE.Vector3} gripPos  bottle BASE position in rig space (axis is vertical through x/z)
 * @param {number}   bottleR  bottle body radius (m)
 * @returns {{ perJoint: Object, contacts: number, summary: string, rows: Array }}
 */
export function fitGrip(bones, rig, gripPos, bottleR) {
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const target = bottleR + SKIN;

  rig.updateWorldMatrix(true, true);

  // Radial distance (m) of a world-space point from the vertical bottle axis,
  // measured in RIG space (the mirror, orient pitch/yaw and model scale all
  // collapse into this one conversion — nothing is assumed, only measured).
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
    _q.setFromAxisAngle(Z_AXIS, angle);
    entry.bone.quaternion.copy(entry.baseQuat).multiply(_q);
  }

  // Fit one digit: jointNames root->tip. Returns { angles[], touched }.
  function fitDigit(jointNames, caps) {
    const chain = jointNames.map((n) => bones[n]).filter(Boolean);
    chain.forEach((e) => e.bone.quaternion.copy(e.baseQuat));   // start straight
    const angles = new Array(chain.length).fill(0);
    let touched = false;

    for (let ji = 0; ji < chain.length; ji++) {
      const entry = chain[ji];
      const isLast = ji === chain.length - 1;
      // Controlled point: the next joint down; for the last joint, a tip
      // extrapolated one phalanx-length along the bone's +y (fingers point
      // along +y at bind; segment length read from the skeleton itself).
      const nextBone = isLast ? entry.bone : chain[ji + 1].bone;
      const tipOffset = isLast
        ? new THREE.Vector3(0, entry.bone.position.length() * 0.75, 0)
        : null;

      let best = 0;
      let bestR = Infinity;
      let contactA = -1;
      for (let a = 0; a <= caps[ji] + 1e-9; a += STEP) {
        setCurl(entry, a);
        const r = radialOf(nextBone, tipOffset);
        if (r < bestR) { bestR = r; best = a; }
        if (r <= target) { contactA = a; break; }   // first touch from outside
      }
      let a = contactA >= 0 ? contactA : best;      // touch, or closest approach
      // Back off while penetrating the glass.
      setCurl(entry, a);
      while (a > 0 && radialOf(nextBone, tipOffset) < bottleR - PENETRATION) {
        a -= STEP;
        setCurl(entry, a);
      }
      angles[ji] = a;
      if (contactA >= 0) touched = true;
    }

    // Final measured tip radius for the report, then restore the digit.
    const last = chain[chain.length - 1];
    const tipR = radialOf(last.bone, new THREE.Vector3(0, last.bone.position.length() * 0.75, 0));
    chain.forEach((e) => e.bone.quaternion.copy(e.baseQuat));
    return { angles, touched, tipR };
  }

  const perJoint = {};
  const rows = [];
  let contacts = 0;

  for (const f of FINGERS) {
    const res = fitDigit(FINGER_JOINTS.map((j) => `${f}_${j}`), FINGER_CAPS);
    perJoint[f] = res.angles;
    if (res.touched) contacts++;
    rows.push({ digit: f, angles: res.angles, touched: res.touched, tipR: res.tipR });
  }
  const th = fitDigit(THUMB_JOINTS.map((j) => `thumb_${j}`), THUMB_CAPS);
  perJoint.thumb = th.angles;
  if (th.touched) contacts++;
  rows.push({ digit: 'thumb', angles: th.angles, touched: th.touched, tipR: th.tipR });

  const summary = rows
    .map((r) => `${r.digit}: [${r.angles.map((a) => a.toFixed(2)).join(', ')}] tip ${(r.tipR * 100).toFixed(1)}cm ${r.touched ? 'CONTACT' : 'no-contact'}`)
    .join('\n');

  return { perJoint, contacts, summary, rows };
}
