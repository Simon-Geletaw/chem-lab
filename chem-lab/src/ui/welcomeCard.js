// ui/welcomeCard.js — the F2 welcome/help overlay ("Controls & Safety").
//
// Shown on load (above the pointer-lock start overlay) and again on H, or via
// the pause menu's "Controls & Safety" button. Built as plain DOM like
// warningCard.js: structural control text lives here (it's UI, not chemistry —
// chemistry text stays in chemicals.json).
//
// DESIGN: deliberately the SAME visual language as the pause menu (#start-card)
// — same panel tokens, title scale, button style and backdrop gradient — so the
// two screens read as one system.
import { theme, glassPanel, primaryButton } from './theme.js';

export function createWelcomeCard(onStart) {
    const root = document.createElement('div');
    root.id = 'welcome-card';
    root.innerHTML = `
      <div id="welcome-box" role="dialog" aria-labelledby="welcome-title">
        <h1 id="welcome-title">Controls &amp; Safety</h1>
        <div id="welcome-keys">
          <div class="key-row"><b class="key">W A S D</b><span>Walk</span></div>
          <div class="key-row"><b class="key">Mouse</b><span>Look around</span></div>
          <div class="key-row"><b class="key">E</b><span>Interact &middot; gloves/mask &middot; pick up &middot; pour</span></div>
          <div class="key-row"><b class="key">Q</b><span>Put bottle back</span></div>
          <div class="key-row"><b class="key">R</b><span>Reset flask</span></div>
          <div class="key-row"><b class="key">Esc</b><span>Release mouse</span></div>
        </div>
        <p id="welcome-flow">
          <b>Lab workflow:</b> 1&rarr; PPE station by the door &mdash; put on gloves
          and mask &middot; 2&rarr; take a chemical from the storage shelf
          &middot; 3&rarr; pour it into the flask on the island bench.
        </p>
        <p id="welcome-safety">
          <span id="welcome-warn" aria-hidden="true">&#9888;</span>
          <span>Wear gloves before handling hazardous chemicals. Never add water
          to concentrated acid. Follow the procedure panel during experiments.</span>
        </p>
        <button id="welcome-start">Start Experiment</button>
      </div>`;
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.textContent = `
      #welcome-card {
        display: none;                   /* hidden until H / pause-menu button */
        position: fixed;
        inset: 0;
        z-index: 30;                     /* above the start overlay (z-20) */
        align-items: center;
        justify-content: center;
        background: ${theme.overlayBg};
        font-family: ${theme.font};
      }
      #welcome-box {
        width: min(560px, calc(100vw - 40px));
        padding: 36px 48px;
        border-radius: 16px;
        ${glassPanel()}
        text-align: center;
        color: ${theme.title};
        animation: welcome-in 0.2s ease-out;
      }
      @keyframes welcome-in {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        #welcome-box { animation: none; }
      }
      #welcome-box h1 {
        margin: 0 0 22px;
        font-size: 42px;
        font-weight: 600;
        font-family: ${theme.heading};
        letter-spacing: 0.5px;
        color: ${theme.title};
      }
      #welcome-keys {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 28px;
        row-gap: 12px;
        margin: 0 0 22px;
        text-align: left;
      }
      .key-row {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .key-row .key {
        flex: 0 0 92px;                  /* fixed keycap width = labels align */
        padding: 5px 0;
        border-radius: 7px;
        border: 1px solid ${theme.accentBorder};
        background: ${theme.accentSoft};
        color: ${theme.title};
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.5px;
        text-align: center;
      }
      .key-row span {
        font-size: 15px;
        color: ${theme.body};
        line-height: 1.4;
      }
      #welcome-safety {
        display: flex;
        gap: 10px;
        margin: 0 0 24px;
        padding: 14px 18px;
        border-radius: 10px;
        border: 1px solid ${theme.dangerBorder};
        background: ${theme.dangerSoft};
        font-size: 14px;
        line-height: 1.65;
        color: ${theme.body};
        text-align: left;
        align-items: flex-start;
      }
      #welcome-warn { color: ${theme.danger}; font-size: 16px; line-height: 1.5; }
      #welcome-flow {
        margin: 0 0 14px;
        padding: 12px 18px;
        border-radius: 10px;
        border: 1px solid ${theme.accentBorder};
        background: ${theme.accentSoft};
        font-size: 14px;
        line-height: 1.65;
        color: ${theme.body};
        text-align: left;
      }
      #welcome-start {
        width: 100%;                     /* full-width primary action, like the pause menu */
        padding: 13px 30px;
        box-sizing: border-box;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.4px;
        ${primaryButton()}
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
      }
      #welcome-start:hover {
        transform: translateY(-2px);
        background: ${theme.brandHover};
        box-shadow: 0 0 24px rgba(77, 163, 255, 0.30), 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      #welcome-start:active { transform: translateY(1px); background: ${theme.brandActive}; }
      #welcome-start:focus-visible {
        outline: 2px solid ${theme.accent};
        outline-offset: 2px;
      }`;
    document.head.appendChild(style);

    const show = () => { root.style.display = 'flex'; };
    const hide = () => { root.style.display = 'none'; };

    root.querySelector('#welcome-start').addEventListener('click', () => {
        hide();
        onStart();    // requests pointer lock from the user's real click gesture
    });

    // H = help: release the mouse politely, then show the card again.
    window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyH') return;
        if (e.target.closest('input, textarea')) return;   // don't hijack typing
        const pour = document.getElementById('pour-dialog');
        if (pour && pour.style.display === 'flex') return; // F4 dialog owns the screen
        document.exitPointerLock();
        show();
    });

    // Shown on load (CSS default display is flex); Start hides it. The pause
    // menu's "Controls & Safety" button and the H key re-open it on demand.
    return { show, hide };
}
