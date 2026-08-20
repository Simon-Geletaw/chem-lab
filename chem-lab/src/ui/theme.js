// ui/theme.js — one source of truth for the visual language shared by every
// DOM panel (welcome card, pour dialog, HUD chips, warning card, info panel).
//
// LOOK: "pale-blue glass #CEE1F2 + dark navy readable text". Every panel is a light,
// frosted glass card in #CEE1F2 with DARK navy text, so on any (even mid-lit)
// background all text stays readable. Brand blue (#054b89) stays ONLY for
// primary buttons and the green accent (#388e4f) for icons/focus — each carries
// high-contrast labels.
//
// SAFETY RULE that outranks the theme: a DANGER warning stays RED (deepened so
// it reads on pale glass). The green look must never let an unsafe card blend in.
//
// The tokens live in server/data/theme.json — read like every other data file
// (static import + validation, with the defaults below as the fallback). Edit
// the JSON, rebuild, the whole UI restyles. A malformed token only falls back;
// it must never brick the UI.
import rawTheme from '../../server/data/theme.json';

const DEFAULT_THEME = {
    heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    font: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",

    // --- brand (kept for primary buttons) ---
    brand: '#054b89',
    brandHover: '#0a63ad',
    brandActive: '#043a68',
    onBrand: '#eaf4ff',                 // text ON a brand fill
    accent: '#388e4f',                  // green: icons, focus, success
    accentSoft: 'rgba(46, 125, 66, 0.10)',
    accentBorder: 'rgba(46, 125, 66, 0.30)',
    accentGlow: '0 0 16px rgba(46, 125, 66, 0.25)',

    // --- surfaces: pale #CEE1F2 frosted glass (never black) ---
    glassBg: 'rgba(206, 225, 242, 0.92)',
    glassBlur: 'blur(20px) saturate(140%)',
    glassBorder: '1px solid rgba(10, 43, 77, 0.18)',
    glassShadow: '0 24px 70px rgba(25, 55, 95, 0.42)',
    overlayBg: 'rgba(214, 229, 243, 0.62)',   // light blue-gray scrim

    // --- text (DARK navies - >= ~6:1 on #CEE1F2) ---
    title: '#0a2b4d',
    body:  '#1c3a5a',
    dim:   '#45607c',

    // --- semantic (danger deepened for pale bg) ---
    danger: '#c62828',
    dangerSolid: '#b3261e',
    dangerHover: '#c93a31',
    dangerSoft: 'rgba(198, 40, 40, 0.10)',
    dangerBorder: 'rgba(198, 40, 40, 0.40)',
    ok: '#1b6b37',
    warm: '#b26a00',
    cool: '#197a8c',

    // green — the "PPE worn / safe" state (HUD gloves & mask chips).
    safe: '#0f7a3d',
    safeSolid: '#2bb673',
    safeSoft: 'rgba(46, 125, 66, 0.14)',
    safeBorder: 'rgba(46, 125, 66, 0.45)'
};

// buildTheme() — merge the JSON over the defaults: every token must be a
// non-empty string, otherwise the default wins. Same contract as the room
// paint: the JSON is the source of truth, the code below is the fallback.
function buildTheme() {
    const out = {};
    for (const key of Object.keys(DEFAULT_THEME)) {
        const v = rawTheme ? rawTheme[key] : undefined;
        out[key] = (typeof v === 'string' && v.trim()) ? v : DEFAULT_THEME[key];
    }
    return out;
}

export const theme = buildTheme();

// glassPanel() — the shared CSS block every frosted panel pastes in, so the
// fill + blur + border + shadow live in exactly ONE place. The `-webkit-` twin
// is required for Safari / iOS, which still needs the prefix.
export function glassPanel() {
    return `\n      background: ${theme.glassBg};\n      -webkit-backdrop-filter: ${theme.glassBlur};\n      backdrop-filter: ${theme.glassBlur};\n      border: ${theme.glassBorder};\n      box-shadow: ${theme.glassShadow};`;
}

// primaryButton() — the flat brand primary action. Solid pine fill, a mint
// hairline, and a subtle lift on hover. Paste into a button's CSS.
export function primaryButton() {
    return `\n      background: ${theme.brand};\n      color: ${theme.onBrand};\n      border: 1px solid ${theme.accentBorder};\n      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);\n      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.06s ease;\n      border-radius: 10px;`;
}

// accentButton() — kept as an alias so old call sites stay working; the accent
// look IS the flat primaryButton (no gradient anywhere in the UI).
export function accentButton() {
    return primaryButton();
}