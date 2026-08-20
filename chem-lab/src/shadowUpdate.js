// shadowUpdate.js — one shared hook for "the shadow map is stale, re-render it".
//
// main.js binds a real callback that sets renderer.shadowMap.needsUpdate after
// turning off autoUpdate (the room's shadow casters are static except for a
// handful of interactions). Modules that move a shadow caster call
// requestShadowUpdate() and the map re-renders for exactly that frame — the
// other ~every-frame depth passes go away.
let request = () => {};

export function bindShadowUpdate(fn) {
  request = fn;
}

export function requestShadowUpdate() {
  request();
}