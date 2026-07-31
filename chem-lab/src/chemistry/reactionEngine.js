// reactionEngine.js — the brain: given what's in the beaker and what's being
// poured, find the matching rule. PURE LOGIC — no Three.js imports allowed in
// src/chemistry/ (book decision #4). You can test every branch of this file
// from the browser console without walking a single step in the lab.

// The matching algorithm (book Ch 5.4). ORDER OF STEPS IS THE SAFETY MECHANISM:
//
//   1. exact directional match  — rule.into == intoId && rule.added == addedId.
//      Ordered rules (water INTO acid = danger) can ONLY match here.
//   2. reversed unordered match — the pair written the other way around, but
//      only if the rule says ordered:false ("either way is the same reaction").
//   3. nothing found -> null    — the caller falls back to defaultMix().
//
// Step 1 before step 2 means a specific directional rule always beats a
// generic unordered one for the same pair: specific-beats-general, the same
// precedence idea as CSS selectors.
export function findReaction(intoId, addedId, reactions) {
  for (const r of reactions) {
    if (r.reactants.into === intoId && r.reactants.added === addedId) return r;
  }
  for (const r of reactions) {
    if (!r.ordered && r.reactants.into === addedId && r.reactants.added === intoId) return r;
  }
  return null;
}

// defaultMix — pouring A into B with NO rule is not an error: most real pairs
// just mix. The liquid becomes the average of the two colors and the contents
// become the "mixture" pseudo-chemical (it lives in chemicals.json like any
// other, shelf:false). This graceful fallback is why the teacher never has to
// define all N*(N-1) pairs.
//
// Color averaging is done on raw "#rrggbb" strings — 8 lines of plain JS —
// precisely so this file stays free of THREE.Color (decision #4 as muscle memory).
export function defaultMix(colorA, colorB) {
  const avg = (a, b, i) =>
    Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2);

  const mixed =
    '#' +
    [1, 3, 5]
      .map((i) => avg(colorA, colorB, i).toString(16).padStart(2, '0'))
      .join('');

  return {
    result: { chemicalId: 'mixture', note: 'No reaction — the liquids simply mixed.' },
    mixedColor: mixed,
    effects: []
  };
}
