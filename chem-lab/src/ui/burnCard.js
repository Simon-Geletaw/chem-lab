// ui/burnCard.js — the T6 burn game-over overlay ("Severe Burn" → Restart).
//
// Two beats, one API:
//   1. THE REVEAL  — the instant a hazardous chemical touches bare skin, we
//      freeze the player (beginModal), fade in a red vignette, and drive the
//      right hand from healthy → charred in REAL time (hand.applyBurn), so you
//      literally watch the burn happen. The gripped bottle stays in hand.
//   2. THE CARD    — after the reveal, a blocking "Severe Burn" panel pops in
//      with a Restart Experiment button. Nothing else is clickable (modal), and
//      Esc never opens the pause menu behind it — same contract as warningCard.
//
// Clicking Restart hands the reset to main.js via onRestart (gloves/mask off,
// flask emptied, effects cleared, camera to the entrance, pointer lock re-entered).
import { theme, glassPanel, primaryButton } from './theme.js';

const RAMP_MS = 2000;      // the hand chars 0→100% (real time) while you hold the bottle
const DROP_MS = 800;        // the bottle pitches off + tumbles forward to the floor
const BURN_HOLD_MS = 3000;  // empty, charred hand held alone before the card
const CARD_AT = RAMP_MS + DROP_MS + BURN_HOLD_MS; // total reveal before the card pops

// Tiny HTML escaper — chemical names/hazard labels come from the (trusted but
// typed-by-hand) chemistry JSON, so guard them before injecting into the card.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createBurnCard(player, hand, onRestart) {
  const root = document.createElement('div');
  root.id = 'burn-card';
  root.innerHTML = `
    <div id="burn-vignette"></div>
    <div id="burn-box">
      <div id="burn-panel">
        <div id="burn-icon">
          <svg class="icon-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h2 id="burn-title">Severe Burn</h2>
        <p id="burn-text"></p>
        <button id="burn-restart">Restart Experiment</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    #burn-card {
      position: fixed;
      inset: 0;
      z-index: 21;                 /* above the start overlay, the top layer */
      opacity: 0;
      pointer-events: none;        /* reveal is hands-off; only the card is live */
      transition: opacity 0.5s ease;
      font-family: ${theme.font};
    }
    #burn-card.visible { opacity: 1; }
    /* THE vignette: a loose red wash with a fully clear center, so the burned
       hand and the fallen bottle stay visible around the compact card */
    #burn-vignette {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at center, transparent 58%,
          rgba(180, 20, 20, 0.20) 84%, rgba(120, 0, 0, 0.42) 100%);
      animation: burn-pulse 1.4s ease-in-out infinite;
    }
    @keyframes burn-pulse {
      0%, 100% { opacity: 0.55; }
      50%      { opacity: 0.9; }
    }
    #burn-box {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      /* recess: nudge the card up-clear of the fallen bottle near your feet */
      padding-bottom: 8vh;
      opacity: 0;
      transform: translateY(12px) scale(0.96);
      transition: opacity 0.45s ease, transform 0.45s ease;
      pointer-events: none;        /* only the revealed card is interactive */
    }
    #burn-box.pop { opacity: 1; transform: none; pointer-events: auto; }
    /* The compact, lighter glass card — the scene shows all around it */
    #burn-panel {
      background: rgba(206, 225, 242, 0.94);
      border: 1px solid rgba(255, 107, 122, 0.35);
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.45);
      padding: 22px 30px;
      border-radius: 16px;
      max-width: 430px;
      width: 88%;
      text-align: center;
      font-family: ${theme.font};
    }
    #burn-icon {
      width: 56px; height: 56px; margin: 0 auto 12px;
      display: grid; place-items: center;
      color: ${theme.danger};
      border-radius: 50%;
      background: ${theme.dangerSoft};
      border: 1px solid ${theme.dangerBorder};
      box-shadow: 0 0 26px rgba(214, 69, 90, 0.28);
    }
    #burn-icon svg { width: 30px; height: 30px; }
    #burn-title {
      margin: 0 0 8px;
      font-family: ${theme.heading};
      font-size: 28px; font-weight: 600; letter-spacing: 0.4px;
      color: ${theme.title};
    }
    #burn-text {
      margin: 0 0 20px;
      font-size: 14px; line-height: 1.6;
      color: ${theme.body};
    }
    #burn-restart {
      ${primaryButton()}
      padding: 12px 28px; font-size: 15px; font-weight: 600; cursor: pointer;
      color: #fff;
      background: ${theme.dangerSolid};
      border-color: ${theme.dangerBorder};
    }
    #burn-restart:hover { background: ${theme.dangerHover}; border-color: ${theme.danger}; }
    #burn-restart:active { transform: translateY(1px); }
    @media (prefers-reduced-motion: reduce) {
      #burn-vignette { animation: none; }
    }`;
  document.head.appendChild(style);

  const box = root.querySelector('#burn-box');
  const textEl = root.querySelector('#burn-text');
  let cardTimer = null;
  let rampTimer = null;
  let dropTimer = null;
  let charTimer = null;

  function clearRun() {
    if (cardTimer) { clearTimeout(cardTimer); cardTimer = null; }
    if (rampTimer) { clearTimeout(rampTimer); rampTimer = null; }
    if (dropTimer) { clearInterval(dropTimer); dropTimer = null; }
    if (charTimer) { clearInterval(charTimer); charTimer = null; }
  }

  // The fatal contact already happened (hand fired onBurn with the chemical);
  // start the reveal and detail the poster with the actual reagent involved.
  function start(chem) {
    clearRun();
    // Keep the pointer LOCKED but disable walking: the viewer can still look
    // around the room (spot the fallen bottle on the floor + the burning hand)
    // while unable to move or act. The pointer is freed only when the card pops
    // (below) so its Restart button is clickable.
    player.enabled = false;

    // --- the text: name the chemical, explain the cause, and teach the fix ---
    const name = chem?.name ? esc(chem.name) : 'an unlabelled chemical';
    const formula = chem?.formula ? ` (${esc(chem.formula)})` : '';
    const hazard = chem?.hazard && chem.hazard !== 'none' ? esc(chem.hazard) : 'hazardous';
    textEl.innerHTML =
      `Your bare hand came into contact with <b>${name}${formula}</b> &mdash; a <b>${hazard}</b> chemical &mdash; ` +
      `and was <b>severely burned</b>.<br><br>` +
       +
      `<b>What went wrong:</b>&nbsp; a dangerous substance was handled with bare skin.<br>` +
      `<b>How to avoid it:</b> before touching any hazardous chemical &mdash;<br>` +
      `&nbsp;&bull;&nbsp; put on the <b> gloves</b> at the PPE station by the door, and<br>` +
      `&nbsp;&bull;&nbsp; wear a <b>face mask</b> before pouring hazardous liquids.<br><br>` +
      `Gear up first &mdash; one bare-handed grab costs the whole experiment.`;

    root.classList.add('visible');

    // BEAT 1 — CHAR RAMP (2 s): the hand chars 0→100% in real time while you
    // still hold the bottle. Uses wall-clock, not frame delta, so it plays even
    // though the world is in slow-motion.
    const t0 = performance.now();
    charTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / RAMP_MS);
      hand.applyBurn(p);
      if (p >= 1) { clearInterval(charTimer); charTimer = null; }
    }, 40);

    // BEAT 2 — DROP (starts at 2 s, runs 0.8 s): fling the bottle free and
    // tumble it FORWARD away from the player, resting on its side ahead.
    rampTimer = setTimeout(() => {
      rampTimer = null;
      hand.dropBottle();
      const d0 = performance.now();
      dropTimer = setInterval(() => {
        const f = Math.min(1, (performance.now() - d0) / DROP_MS);
        hand.applyDropProgress(f);
        if (f >= 1) { clearInterval(dropTimer); dropTimer = null; }
      }, 40);
    }, RAMP_MS);

    // BEAT 4 — CARD (at 5.8 s, after the 3 s burned-hand hold): free the mouse
    // (modal) so the Restart button becomes clickable, then pop in the notice.
    cardTimer = setTimeout(() => {
      cardTimer = null;
      player.beginModal();          // unlock pointer for the button
      box.classList.add('pop');
    }, CARD_AT);
  }

  root.querySelector('#burn-restart').addEventListener('click', () => {
    clearRun();
    root.classList.remove('visible');
    box.classList.remove('pop');
    onRestart();                  // main.js resets everything + re-enters the lab
  });

  return {
    start,
    hide() { clearRun(); root.classList.remove('visible'); box.classList.remove('pop'); }
  };
}
