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
  reaction: { x: 0,     z: -1.5, radius: 2.0 },  // island bench + reaction flask
  coat:     { x: 3.7,   z: 4.6,  radius: 1.8 }   // coat stand beside the exit door (front-right)
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

// Is the camera AIMED at the named zone? Pass the flattened (x,z) world aim
// and the player's feet position as plain objects so this file stays free of
// Three.js (same architecture rule that keeps inZone pure). The check is a
// simple horizontal (XZ) dot product: the forward aim vs. the direction from
// the feet to the zone center. `toleranceDeg` is how far off the straight-on
// axis still counts as "facing that way" (e.g. 50 = within ±50°).
export function facingZone(name, pos, forward, toleranceDeg) {
  const z = ZONES[name];
  if (!z) return false;
  const dzx = z.x - pos.x;
  const dzz = z.z - pos.z;
  const len = Math.hypot(dzx, dzz);
  if (len < 1e-6) return false;                    // standing dead-on the center: safe
  const dot = (dzx / len) * forward.x + (dzz / len) * forward.z;
  return dot >= Math.cos(toleranceDeg * Math.PI / 180);
}
