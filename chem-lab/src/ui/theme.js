// ui/theme.js — one source of truth for the visual language shared by every
// DOM panel (welcome card, pour dialog, HUD chips, warning card, info panel).
//
// LOOK: "deep blue glass + sky accent" built on the brand colour #054b89.
// Surfaces are dark navy-tinted frosted glass over the 3D lab; panels wear a
// thin sky-blue hairline. The ONE bright thing is the sky accent (#4da3ff)
// used for icons, focus rings and success — the eye always knows where to click.
// BUTTONS ARE FLAT: no gradients anywhere — a solid brand fill for the primary
// action, ghost surfaces for secondary, and a solid red for destructive.
//
// Safety rule that OUTRANKS the theme: a DANGER warning stays RED. The blue
// look must never let the "you did something unsafe" card blend in.
export const theme = {
    // Space Grotesk for big titles, Inter for everything else (loaded in
    // index.html; system-ui is the fallback while they load).
    heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    font: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",

    // --- brand: deep blue #054b89 + its family (flat, no gradients) ---
    brand: '#054b89',                  // primary fills, active borders
    brandHover: '#0a63ad',             // primary hover
    brandActive: '#043a68',            // primary pressed
    onBrand: '#eaf4ff',                // text sitting ON a brand fill
    accent: '#4da3ff',                 // bright sky: icons, success, focus
    accentSoft: 'rgba(77, 163, 255, 0.14)',    // tinted secondary fill
    accentBorder: 'rgba(77, 163, 255, 0.35)',  // sky hairline
    accentGlow: '0 0 16px rgba(77, 163, 255, 0.30)',   // very soft halo only

    // --- surfaces: deep navy-tinted glass ---
    glassBg: 'rgba(4, 16, 34, 0.88)',             // deep navy-black panel
    glassBlur: 'blur(20px) saturate(140%)',       // the frosted-glass smear
    glassBorder: '1px solid rgba(77, 163, 255, 0.22)',   // subtle sky hairline
    glassShadow: '0 24px 70px rgba(0, 0, 0, 0.65)',
    overlayBg: 'rgba(2, 9, 20, 0.62)',            // full-screen scrim

    // --- text (blue-tinted neutrals) ---
    title: '#eef5fd',      // near-white with a blue hint
    body: '#b9cbe2',       // muted blue-gray for paragraphs
    dim: '#8299b2',        // captions / secondary

    // --- semantic (do NOT theme these away) ---
    danger: '#ff6b7a',     // red — unsafe warnings, destructive text/icons
    dangerSolid: '#d6455a',// red — destructive button fill
    dangerHover: '#e9576c',// red — destructive hover
    dangerSoft: 'rgba(255, 107, 122, 0.12)',
    dangerBorder: 'rgba(255, 107, 122, 0.45)',
    ok: '#4da3ff',         // sky — correct-procedure / success (same as accent)
    warm: '#ffc36b',       // amber — "hot" temperature chips
    cool: '#8fd0ff',       // light sky — "cool" temperature chips

    // green — the "PPE worn / safe" state (e.g. the HUD gloves & mask chips).
    // The room UI is blue by design; GREEN is reserved for the unmistakable
    // "you are protected" signal, and RED (dangerSolid) is the "not protected".
    safe: '#3ddc84',                    // bright green — safe state text/icon
    safeSolid: '#2bb673',               // green fill for the ON chip (dark text rides on it)
    safeSoft: 'rgba(61, 220, 132, 0.14)',
    safeBorder: 'rgba(61, 220, 132, 0.45)'
};

// glassPanel() — the shared CSS block every frosted panel pastes in, so the
// fill + blur + border + shadow live in exactly ONE place. The `-webkit-` twin
// is required for Safari / iOS, which still needs the prefix.
export function glassPanel() {
    return `
      background: ${theme.glassBg};
      -webkit-backdrop-filter: ${theme.glassBlur};
      backdrop-filter: ${theme.glassBlur};
      border: ${theme.glassBorder};
      box-shadow: ${theme.glassShadow};`;
}

// primaryButton() — the flat brand primary action. No gradient: a solid pine
// fill, a mint hairline, and a subtle lift on hover. Paste into a button's CSS.
export function primaryButton() {
    return `
      background: ${theme.brand};
      color: ${theme.onBrand};
      border: 1px solid ${theme.accentBorder};
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.06s ease;
      border-radius: 10px;`;
}

// accentButton() — kept as an alias so old call sites stay working; the accent
// look IS the flat primaryButton (no gradient anywhere in the UI).
export function accentButton() {
    return primaryButton();
}
