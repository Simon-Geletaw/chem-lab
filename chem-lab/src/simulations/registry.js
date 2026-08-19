// registry.js — the ONE place that knows where simulation-door data comes from.
//
// Same architecture rule as src/chemistry/: no Three.js imports here — plain
// objects and strings only, so the data can be validated and tested in the
// browser console without the 3D lab.
//
// The simulation doors on the front wall are fully data-driven from
// server/data/simulations.json: labels, accent colors, destination URLs and
// the E-trigger geometry (door position, trigger radius, reach). simDoors.js
// builds the 3D doors from what this module hands it.
import rawData from '../../server/data/simulations.json';

let data = null;

export async function loadSimulations() {
  data = rawData;
  validate(data);
  console.log(`simulations: ${data.simulations.length} simulation doors loaded`);
  return data;
}

export function getSimulations() {
  return data.simulations;
}

export function getSimulation(id) {
  return data.simulations.find((s) => s.id === id) || null;
}

// ---------------------------------------------------------------------------
// validate() — fail LOUDLY at startup instead of silently mid-demo (same
// philosophy as chemistry/registry.js): a typo'd accent or a missing trigger
// radius would otherwise surface as a broken door at runtime.
// ---------------------------------------------------------------------------
function validate(d) {
  if (!d || !Array.isArray(d.simulations)) {
    throw new Error('simulations.json must have { simulations: [...] }');
  }

  const ids = new Set();
  for (const s of d.simulations) {
    if (!s.id) throw new Error('A simulation door is missing an id');
    if (ids.has(s.id)) throw new Error(`Duplicate simulation id: "${s.id}"`);
    if (!s.label) throw new Error(`Simulation "${s.id}" is missing a label`);
    if (!/^#[0-9a-fA-F]{6}$/.test(s.accent)) {
      throw new Error(`Simulation "${s.id}" has a bad accent "${s.accent}" — use #rrggbb`);
    }
    if (s.href !== '' && !/^(https?:\/\/\S+|\/\S*)$/.test(s.href)) {
      throw new Error(`Simulation "${s.id}" has a bad href "${s.href}" — use a http(s) URL, a path like "/b", or ""`);
    }
    if (s.target !== '_self' && s.target !== '_blank') {
      throw new Error(`Simulation "${s.id}" target must be "_self" or "_blank"`);
    }
    if (!s.door || typeof s.door.x !== 'number' || typeof s.door.z !== 'number' ||
        !(s.door.width > 0)) {
      throw new Error(`Simulation "${s.id}" needs door { x, z, width }`);
    }
    if (!s.trigger || !(s.trigger.radius > 0) || !(s.trigger.reach > 0)) {
      throw new Error(`Simulation "${s.id}" needs trigger { radius, reach }`);
    }
    ids.add(s.id);
  }
}