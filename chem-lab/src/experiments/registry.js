// experiments/registry.js — the ONE place that knows where experiment-card
// data comes from.
//
// Same architecture rule as src/chemistry/ and src/simulations/: no Three.js
// imports here — plain objects and strings only, so the data can be validated
// and tested in the browser console without the 3D lab.
//
// The experiment cards on the corner table are fully data-driven from
// server/data/experiments.json: titles, descriptions, safety lines, image
// paths, accent colours, destination URLs and the E-trigger geometry.
// experimentTable.js builds the 3D table + cards from what this module hands
// it, and the card count is dynamic — add or remove a JSON entry and the
// table re-lengthens on the next boot.
import rawData from '../../server/data/experiments.json';

let data = null;

// Shared UI labels for the experiment-card overlay. Every word on the card UI
// now lives in JSON (experiments.json "ui" block) instead of hard-coded
// strings — swap a label in the JSON and the overlay follows on next boot.
const DEFAULT_UI = {
  safetyLabel: 'Safety first:',
  openButton: 'Open Experiment',
  closeButton: 'Close',
  travelText: 'Opening {title} experiment\u2026'
};

export async function loadExperiments() {
  data = { ...rawData, ui: { ...DEFAULT_UI, ...(rawData.ui || {}) } };
  validate(data);
  console.log(`experiments: ${data.experiments.length} experiment cards loaded`);
  return data;
}

export function getExperiments() {
  return data.experiments;
}

export function getExperiment(id) {
  return data.experiments.find((e) => e.id === id) || null;
}

export function getUiLabels() {
  return data.ui;
}

// ---------------------------------------------------------------------------
// validate() — fail LOUDLY at startup instead of silently mid-demo (same
// philosophy as chemistry/registry.js and simulations/registry.js): a typo'd
// accent or a missing trigger radius would otherwise surface as a broken
// card at runtime.
// ---------------------------------------------------------------------------
function validate(d) {
  if (!d || !Array.isArray(d.experiments)) {
    throw new Error('experiments.json must have { experiments: [...] }');
  }

  const ui = d.ui || {};
  for (const key of Object.keys(DEFAULT_UI)) {
    if (ui[key] !== undefined && typeof ui[key] !== 'string') {
      throw new Error(`experiments.json ui.${key} must be a string`);
    }
  }
  if (ui.travelText !== undefined && !ui.travelText.includes('{title}')) {
    throw new Error('experiments.json ui.travelText must contain the {title} placeholder');
  }

  const ids = new Set();
  for (const e of d.experiments) {
    if (!e.id) throw new Error('An experiment card is missing an id');
    if (ids.has(e.id)) throw new Error(`Duplicate experiment id: "${e.id}"`);
    if (!e.title) throw new Error(`Experiment "${e.id}" is missing a title`);
    if (!e.subtitle) throw new Error(`Experiment "${e.id}" is missing a subtitle`);
    if (!e.description) throw new Error(`Experiment "${e.id}" is missing a description`);
    if (!/^#[0-9a-fA-F]{6}$/.test(e.accent)) {
      throw new Error(`Experiment "${e.id}" has a bad accent "${e.accent}" — use #rrggbb`);
    }
    if (!Array.isArray(e.safety) || e.safety.length === 0 ||
        e.safety.some((s) => typeof s !== 'string' || !s.trim())) {
      throw new Error(`Experiment "${e.id}" needs a non-empty safety[] array of strings`);
    }
    if (!e.image || typeof e.image !== 'string' || !e.image.startsWith('/')) {
      throw new Error(`Experiment "${e.id}" needs an image path starting with "/"`);
    }
    if (e.href !== '' && !/^https?:\/\/\S+$/.test(e.href)) {
      throw new Error(`Experiment "${e.id}" has a bad href "${e.href}" — use a http(s) URL or ""`);
    }
    if (e.target !== '_self' && e.target !== '_blank') {
      throw new Error(`Experiment "${e.id}" target must be "_self" or "_blank"`);
    }
    if (!e.trigger || !(e.trigger.radius > 0) || !(e.trigger.reach > 0)) {
      throw new Error(`Experiment "${e.id}" needs trigger { radius, reach }`);
    }
    ids.add(e.id);
  }
}
