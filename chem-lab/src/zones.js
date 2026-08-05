// zones.js — the lab's three workflow stations, as plain data.
//
// The pedagogy of this lab is a SEQUENCE: gear up at the PPE station, take a
// chemical from the storage shelf, then react it at the island bench. Each
// zone is WHERE its step is allowed — hand.js blocks E-actions outside the
// right zone with a hint card. Pure data + a 2D distance check; deliberately
// no Three.js import (same rule as src/chemistry/).
export const ZONES = {
  ppe:      { x: 5.2,   z: 3.6, radius: 1.8 },   // gloves + mask table, front-right corner by the door
  shelf:    { x: -6.55, z: -1,  radius: 1.8 },   // the left-wall chemical shelves
  reaction: { x: 0,     z: -1.5, radius: 2.0 }   // island bench + reaction flask
};

// Is the camera inside the named zone? Horizontal distance only — the eye
// height never matters for "am I standing at this table".
export function inZone(name, camera) {
  const z = ZONES[name];
  if (!z) return false;
  const dx = camera.position.x - z.x;
  const dz = camera.position.z - z.z;
  return dx * dx + dz * dz <= z.radius * z.radius;
}
