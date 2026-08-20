// --- PERIODIC TABLE DATA ---
// All 118 elements with 2 descriptive fields: fact and use. The live data is
// server/data/periodic-table.json — static import + validation, with the
// defaults below as the fallback (same pattern as room.json / theme.json /
// chemicals.json). The loader also owns the chemical-family mapping and the
// category tile colors, so the poster never has to re-derive either.
import rawTable from '../server/data/periodic-table.json';

// Chemical family for atomic number z (drives the tile color). Used both to
// fill a missing JSON "category" and as the grid-side fallback for a category
// the JSON does not name.
export function getCategory(z) {
  if ([1, 6, 7, 8, 15, 16, 34].includes(z))         return 'nonmetal';
  if ([2, 10, 18, 36, 54, 86, 118].includes(z))     return 'noble-gas';
  if ([9, 17, 35, 53, 85, 117].includes(z))         return 'halogen';
  if ([3, 11, 19, 37, 55, 87].includes(z))          return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(z))          return 'alkaline';
  if ([5, 14, 32, 33, 51, 52].includes(z))          return 'metalloid';
  if (z >= 57 && z <= 71)                           return 'lanthanide';
  if (z >= 89 && z <= 103)                          return 'actinide';
  if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(z)) return 'post-transition';
  return 'transition';                              // everything else
}

export const DEFAULT_CATEGORY_COLORS = {
  'alkali':          '#d95d39',
  'alkaline':        '#e8a94b',
  'transition':      '#3f6fa8',
  'post-transition': '#7d8ca3',
  'metalloid':       '#c9a227',
  'nonmetal':        '#2a9d5c',
  'halogen':         '#1f9e89',
  'noble-gas':       '#8d5bd4',
  'lanthanide':      '#c95f8e',
  'actinide':        '#a4636f'
};

export const DEFAULT_ELEMENTS = [
  { symbol: "H", name: "Hydrogen", fact: "Lightest element, makes up 75% of universe.", use: "Used in fuel cells and ammonia production." },
  { symbol: "He", name: "Helium", fact: "Second lightest, inert noble gas.", use: "Used in balloons and cooling MRI scanners." },
  { symbol: "Li", name: "Lithium", fact: "Lightest metal, highly reactive.", use: "Used in rechargeable batteries." },
  { symbol: "Be", name: "Beryllium", fact: "Lightweight but extremely stiff.", use: "Used in aerospace materials." },
  { symbol: "B", name: "Boron", fact: "Metalloid essential for plant growth.", use: "Used in glass and detergents." },
  { symbol: "C", name: "Carbon", fact: "Basis of all known life.", use: "Used in steel and diamonds." },
  { symbol: "N", name: "Nitrogen", fact: "Makes up 78% of Earth's atmosphere.", use: "Used in fertilizers." },
  { symbol: "O", name: "Oxygen", fact: "Essential for respiration.", use: "Used in medical breathing apparatus." },
  { symbol: "F", name: "Fluorine", fact: "Most reactive element.", use: "Used in toothpaste." },
  { symbol: "Ne", name: "Neon", fact: "Inert noble gas that glows red.", use: "Used in neon signs." },
  { symbol: "Na", name: "Sodium", fact: "Soft metal that explodes in water.", use: "Used in street lights." },
  { symbol: "Mg", name: "Magnesium", fact: "Lightweight structural metal.", use: "Used in fireworks." },
  { symbol: "Al", name: "Aluminum", fact: "Most abundant metal in Earth's crust.", use: "Used in cans and foil." },
  { symbol: "Si", name: "Silicon", fact: "Main component of sand.", use: "Used in computer chips." },
  { symbol: "P", name: "Phosphorus", fact: "Exists in white and red forms.", use: "Used in matchsticks." },
  { symbol: "S", name: "Sulfur", fact: "Yellow solid with distinct smell.", use: "Used in vulcanizing rubber." },
  { symbol: "Cl", name: "Chlorine", fact: "Toxic green gas.", use: "Used to disinfect water." },
  { symbol: "Ar", name: "Argon", fact: "Most abundant noble gas in air.", use: "Used as shielding gas in welding." },
  { symbol: "K", name: "Potassium", fact: "Reactive alkali metal.", use: "Essential for plant growth." },
  { symbol: "Ca", name: "Calcium", fact: "Essential for bones.", use: "Used in cement." },
  { symbol: "Sc", name: "Scandium", fact: "Rare earth metal.", use: "Used in aerospace components." },
  { symbol: "Ti", name: "Titanium", fact: "Strong and corrosion resistant.", use: "Used in medical implants." },
  { symbol: "V", name: "Vanadium", fact: "Hard transition metal.", use: "Used in steel alloys." },
  { symbol: "Cr", name: "Chromium", fact: "Hard and shiny.", use: "Used in stainless steel." },
  { symbol: "Mn", name: "Manganese", fact: "Essential trace nutrient.", use: "Used in batteries." },
  { symbol: "Fe", name: "Iron", fact: "Most used metal on Earth.", use: "Used to make steel." },
  { symbol: "Co", name: "Cobalt", fact: "Produces deep blue color.", use: "Used in lithium batteries." },
  { symbol: "Ni", name: "Nickel", fact: "Corrosion resistant.", use: "Used in coins." },
  { symbol: "Cu", name: "Copper", fact: "Excellent conductor.", use: "Used in electrical wiring." },
  { symbol: "Zn", name: "Zinc", fact: "Brittle at room temp.", use: "Used to galvanize steel." },
  { symbol: "Ga", name: "Gallium", fact: "Melts in your hand.", use: "Used in LEDs." },
  { symbol: "Ge", name: "Germanium", fact: "Early semiconductor.", use: "Used in fiber optics." },
  { symbol: "As", name: "Arsenic", fact: "Notorious poison.", use: "Used in semiconductors." },
  { symbol: "Se", name: "Selenium", fact: "Nonmetal essential for animals.", use: "Used in glassmaking." },
  { symbol: "Br", name: "Bromine", fact: "Liquid at room temp.", use: "Used in flame retardants." },
  { symbol: "Kr", name: "Krypton", fact: "Rare noble gas.", use: "Used in high performance lighting." },
  { symbol: "Rb", name: "Rubidium", fact: "Soft silvery metal.", use: "Used in atomic clocks." },
  { symbol: "Sr", name: "Strontium", fact: "Burns bright red.", use: "Used in fireworks." },
  { symbol: "Y", name: "Yttrium", fact: "Transition metal.", use: "Used in lasers." },
  { symbol: "Zr", name: "Zirconium", fact: "Resistant to heat.", use: "Used in nuclear reactors." },
  { symbol: "Nb", name: "Niobium", fact: "Soft grey metal.", use: "Used in superconductors." },
  { symbol: "Mo", name: "Molybdenum", fact: "High melting point.", use: "Used in steel alloys." },
  { symbol: "Tc", name: "Technetium", fact: "First artificial element.", use: "Used in medical imaging." },
  { symbol: "Ru", name: "Ruthenium", fact: "Rare transition metal.", use: "Used in electronics." },
  { symbol: "Rh", name: "Rhodium", fact: "Highly reflective.", use: "Used in catalytic converters." },
  { symbol: "Pd", name: "Palladium", fact: "Absorbs hydrogen.", use: "Used in catalytic converters." },
  { symbol: "Ag", name: "Silver", fact: "Best electrical conductor.", use: "Used in jewelry." },
  { symbol: "Cd", name: "Cadmium", fact: "Toxic metal.", use: "Used in old batteries." },
  { symbol: "In", name: "Indium", fact: "Soft metal.", use: "Used in touchscreens." },
  { symbol: "Sn", name: "Tin", fact: "Used since ancient times.", use: "Used in solder." },
  { symbol: "Sb", name: "Antimony", fact: "Metalloid.", use: "Used in flame retardants." },
  { symbol: "Te", name: "Tellurium", fact: "Brittle metalloid.", use: "Used in solar panels." },
  { symbol: "I", name: "Iodine", fact: "Essential for thyroid.", use: "Used as antiseptic." },
  { symbol: "Xe", name: "Xenon", fact: "Heavy noble gas.", use: "Used in car headlights." },
  { symbol: "Cs", name: "Cesium", fact: "Most reactive metal.", use: "Used in atomic clocks." },
  { symbol: "Ba", name: "Barium", fact: "Heavy metal.", use: "Used in medical X-rays." },
  { symbol: "La", name: "Lanthanum", fact: "First lanthanide.", use: "Used in camera lenses." },
  { symbol: "Ce", name: "Cerium", fact: "Most abundant rare earth.", use: "Used in lighter flints." },
  { symbol: "Pr", name: "Praseodymium", fact: "Green tinted metal.", use: "Used in magnets." },
  { symbol: "Nd", name: "Neodymium", fact: "Strongest magnets.", use: "Used in headphones." },
  { symbol: "Pm", name: "Promethium", fact: "Radioactive.", use: "Used in luminous paint." },
  { symbol: "Sm", name: "Samarium", fact: "Rare earth metal.", use: "Used in headphones." },
  { symbol: "Eu", name: "Europium", fact: "Most reactive rare earth.", use: "Used in Euro banknotes." },
  { symbol: "Gd", name: "Gadolinium", fact: "Magnetic properties.", use: "Used in MRI contrast." },
  { symbol: "Tb", name: "Terbium", fact: "Soft silvery metal.", use: "Used in green LEDs." },
  { symbol: "Dy", name: "Dysprosium", fact: "High melting point.", use: "Used in wind turbines." },
  { symbol: "Ho", name: "Holmium", fact: "Highest magnetic strength.", use: "Used in lasers." },
  { symbol: "Er", name: "Erbium", fact: "Pink colored salts.", use: "Used in fiber optics." },
  { symbol: "Tm", name: "Thulium", fact: "Rarest lanthanide.", use: "Used in X-ray machines." },
  { symbol: "Yb", name: "Ytterbium", fact: "Soft metal.", use: "Used in atomic clocks." },
  { symbol: "Lu", name: "Lutetium", fact: "Hardest lanthanide.", use: "Used in PET scans." },
  { symbol: "Hf", name: "Hafnium", fact: "Absorbs neutrons.", use: "Used in nuclear control rods." },
  { symbol: "Ta", name: "Tantalum", fact: "Resistant to corrosion.", use: "Used in phone capacitors." },
  { symbol: "W", name: "Tungsten", fact: "Highest melting point.", use: "Used in lightbulb filaments." },
  { symbol: "Re", name: "Rhenium", fact: "Very rare.", use: "Used in jet engines." },
  { symbol: "Os", name: "Osmium", fact: "Densest element.", use: "Used in fountain pen tips." },
  { symbol: "Ir", name: "Iridium", fact: "Most corrosion resistant.", use: "Found in meteorites." },
  { symbol: "Pt", name: "Platinum", fact: "Precious metal.", use: "Used in jewelry." },
  { symbol: "Au", name: "Gold", fact: "Unreactive precious metal.", use: "Used in electronics." },
  { symbol: "Hg", name: "Mercury", fact: "Liquid metal at room temp.", use: "Used in thermometers." },
  { symbol: "Tl", name: "Thallium", fact: "Highly toxic.", use: "Used in rat poison." },
  { symbol: "Pb", name: "Lead", fact: "Heavy toxic metal.", use: "Used in car batteries." },
  { symbol: "Bi", name: "Bismuth", fact: "Crystallizes geometrically.", use: "Used in Pepto-Bismol." },
  { symbol: "Po", name: "Polonium", fact: "Highly radioactive.", use: "Used in antistatic devices." },
  { symbol: "At", name: "Astatine", fact: "Rarest natural element.", use: "Used in cancer research." },
  { symbol: "Rn", name: "Radon", fact: "Radioactive noble gas.", use: "Used in cancer therapy." },
  { symbol: "Fr", name: "Francium", fact: "Extremely unstable.", use: "Only used for research." },
  { symbol: "Ra", name: "Radium", fact: "Glows in the dark.", use: "Used in old watch dials." },
  { symbol: "Ac", name: "Actinium", fact: "Glows pale blue.", use: "Used in neutron sources." },
  { symbol: "Th", name: "Thorium", fact: "Weakly radioactive.", use: "Potential nuclear fuel." },
  { symbol: "Pa", name: "Protactinium", fact: "Rare and toxic.", use: "Only used for research." },
  { symbol: "U", name: "Uranium", fact: "Used in nuclear power.", use: "Used in reactors and bombs." },
  { symbol: "Np", name: "Neptunium", fact: "First transuranium element.", use: "Used in neutron detectors." },
  { symbol: "Pu", name: "Plutonium", fact: "Used in nuclear weapons.", use: "Used in RTGs for space probes." },
  { symbol: "Am", name: "Americium", fact: "Synthetic element.", use: "Used in smoke detectors." },
  { symbol: "Cm", name: "Curium", fact: "Named after Marie Curie.", use: "Used in pacemakers." },
  { symbol: "Bk", name: "Berkelium", fact: "Synthetic element.", use: "Used to make heavier elements." },
  { symbol: "Cf", name: "Californium", fact: "Strong neutron emitter.", use: "Used in oil well logging." },
  { symbol: "Es", name: "Einsteinium", fact: "Found in hydrogen bomb debris.", use: "Only used for research." },
  { symbol: "Fm", name: "Fermium", fact: "Heaviest element made in labs.", use: "Only used for research." },
  { symbol: "Md", name: "Mendelevium", fact: "Named after Mendeleev.", use: "Only used for research." },
  { symbol: "No", name: "Nobelium", fact: "Named after Alfred Nobel.", use: "Only used for research." },
  { symbol: "Lr", name: "Lawrencium", fact: "Last actinide.", use: "Only used for research." },
  { symbol: "Rf", name: "Rutherfordium", fact: "First transactinide.", use: "Only used for research." },
  { symbol: "Db", name: "Dubnium", fact: "Highly radioactive.", use: "Only used for research." },
  { symbol: "Sg", name: "Seaborgium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Bh", name: "Bohrium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Hs", name: "Hassium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Mt", name: "Meitnerium", fact: "Named after Lise Meitner.", use: "Only used for research." },
  { symbol: "Ds", name: "Darmstadtium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Rg", name: "Roentgenium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Cn", name: "Copernicium", fact: "Predicted to be a gas.", use: "Only used for research." },
  { symbol: "Nh", name: "Nihonium", fact: "First discovered in Japan.", use: "Only used for research." },
  { symbol: "Fl", name: "Flerovium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Mc", name: "Moscovium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Lv", name: "Livermorium", fact: "Synthetic element.", use: "Only used for research." },
  { symbol: "Ts", name: "Tennessine", fact: "Synthetic halogen.", use: "Only used for research." },
  { symbol: "Og", name: "Oganesson", fact: "Heaviest known element.", use: "Only used for research." }
];

// build() — merge server/data/periodic-table.json over the defaults. The JSON
// must list exactly 118 elements; any element/field that is missing or
// malformed falls back to the default, and any unnamed category keeps its
// default color. Same contract as the room paint and UI theme.
function build() {
  const jsonElements =
    Array.isArray(rawTable && rawTable.elements) && rawTable.elements.length === DEFAULT_ELEMENTS.length
      ? rawTable.elements
      : null;

  const elementsData = DEFAULT_ELEMENTS.map((d, i) => {
    const e = jsonElements ? jsonElements[i] : {};
    return {
      symbol:   (typeof e.symbol === 'string' && e.symbol) ? e.symbol : d.symbol,
      name:     (typeof e.name === 'string' && e.name) ? e.name : d.name,
      fact:     (typeof e.fact === 'string' && e.fact) ? e.fact : d.fact,
      use:      (typeof e.use === 'string' && e.use) ? e.use : d.use,
      number:   Number.isInteger(e.number) ? e.number : i + 1,
      category: (typeof e.category === 'string' && e.category) ? e.category : getCategory(i + 1)
    };
  });

  const categoryColors = {};
  for (const key of Object.keys(DEFAULT_CATEGORY_COLORS)) {
    const v = rawTable && rawTable.categoryColors ? rawTable.categoryColors[key] : undefined;
    categoryColors[key] = (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : DEFAULT_CATEGORY_COLORS[key];
  }

  return { elementsData, categoryColors };
}

const built = build();
export const elementsData = built.elementsData;
export const categoryColors = built.categoryColors;