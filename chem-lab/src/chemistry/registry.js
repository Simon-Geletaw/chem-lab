// registry.js — the ONE place that knows where chemistry data comes from.
//
// ARCHITECTURE RULE (decision #4 in the book): nothing in src/chemistry/ may
// import Three.js. This folder is pure logic — plain objects and strings — so
// you can test it in the browser console without walking around the 3D lab.
//
// Phase 1: the data is imported straight from the JSON file — statically, so
// Vite bundles it into the main chunk and there is NO network round-trip at
// startup (the old dynamic import added a code-split fetch before the lab
// could begin building).
// Phase 10: ONE line below changes to fetch('/api/data') and nothing else moves.
// That is the whole reason this module exists instead of importing JSON directly
// wherever it is needed.
import rawData from '../../server/data/chemicals.json';

let data = null;

export async function loadChemistry() {
  data = rawData;
  validate(data);
  // Physical state drives rendering: 'liquid' (default) or 'powder'.
  for (const c of data.chemicals) c.state = c.state ?? 'liquid';
  console.log(
    `chemistry: ${data.chemicals.length} chemicals, ${data.reactions.length} reactions loaded`
  );
  return data;
}

// Accessors. Everything else in the app asks through these, never touching
// `data` directly — so a later switch to a Map or an API cache stays local.
export function getData() {
  return data;
}

export function getChemical(id) {
  return data.chemicals.find((c) => c.id === id) || null;
}

// Chemicals that get a physical bottle on the shelf. Reaction PRODUCTS
// (dilute acid, precipitates, "mixture") set shelf:false — they can exist in
// the beaker but you cannot pick them up.
export function getShelfChemicals() {
  return data.chemicals.filter((c) => c.shelf !== false);
}

// ---------------------------------------------------------------------------
// validate() — fail LOUDLY at startup instead of silently mid-demo.
//
// This is the cost of data-driven design (book Ch 4.4): code trusts the data,
// so a typo'd id would break things at runtime. Twenty lines here convert a
// mysterious mid-lesson bug into a clear console error before the lab opens.
// ---------------------------------------------------------------------------
function validate(d) {
  if (!d || !Array.isArray(d.chemicals) || !Array.isArray(d.reactions)) {
    throw new Error('chemicals.json must have { chemicals: [...], reactions: [...] }');
  }

  const ids = new Set();
  for (const c of d.chemicals) {
    if (!c.id) throw new Error(`Chemical "${c.name}" is missing an id`);
    if (ids.has(c.id)) throw new Error(`Duplicate chemical id: "${c.id}"`);
    if (!/^#[0-9a-fA-F]{6}$/.test(c.color)) {
      throw new Error(`Chemical "${c.id}" has a bad color "${c.color}" — use #rrggbb`);
    }
    // T6 optional burn fields: how fast bare skin burns and what colour it
    // turns. Both optional; if present they must be well-formed (a data typo
    // here would silently disable a chemical's burn, so fail loudly instead).
    if (c.burnRate !== undefined && !(typeof c.burnRate === 'number' && c.burnRate > 0)) {
      throw new Error(`Chemical "${c.id}" has a bad burnRate "${c.burnRate}" — use a positive number`);
    }
    if (c.burnColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(c.burnColor)) {
      throw new Error(`Chemical "${c.id}" has a bad burnColor "${c.burnColor}" — use #rrggbb`);
    }
    ids.add(c.id);
  }

  // Referential integrity, by hand (book Ch 8.2): every id a reaction mentions
  // must be a chemical that actually exists.
  const ruleIds = new Set();
  for (const r of d.reactions) {
    if (!r.id) throw new Error('A reaction is missing an id');
    if (ruleIds.has(r.id)) throw new Error(`Duplicate reaction id: "${r.id}"`);
    ruleIds.add(r.id);

    const refs = [
      ['reactants.into', r.reactants?.into],
      ['reactants.added', r.reactants?.added],
      ['result.chemicalId', r.result?.chemicalId]
    ];
    for (const [field, id] of refs) {
      if (!id) throw new Error(`Reaction "${r.id}" is missing ${field}`);
      if (!ids.has(id)) {
        throw new Error(`Reaction "${r.id}" ${field} references unknown chemical "${id}"`);
      }
    }

    if (r.danger && !r.warning) {
      throw new Error(`Reaction "${r.id}" is danger:true but has no warning text`);
    }
    if (!Array.isArray(r.effects)) {
      throw new Error(`Reaction "${r.id}" needs an effects array (it may be empty)`);
    }
  }
}
