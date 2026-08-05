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
import { theme } from './theme.js';

export function createWelcomeCard(onStart) {
    const root = document.createElement('div');
    root.id = 'welcome-card';
    root.innerHTML = `
      <div id="welcome-box" role="dialog" aria-labelledby="welcome-title">
        <h1 id="welcome-title">Controls &amp; Safety</h1>
        <div id="welcome-keys">
          <div class="key-row"><b class="key">W A S D</b><span>move</span></div>
          <div class="key-row"><b class="key">Mouse</b><span>look</span></div>
          <div class="key-row"><b class="key">E</b><span>interact &middot; gloves/mask &middot; pick &middot; pour</span></div>
          <div class="key-row"><b class="key">Q</b><span>put back</span></div>
          <div class="key-row"><b class="key">R</b><span>reset flask</span></div>
          <div class="key-row"><b class="key">Esc</b><span>release mouse</span></div>
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
        background: linear-gradient(
          rgba(10, 18, 26, 0.6),
          rgba(10, 18, 26, 0.15) 45%,
          rgba(10, 18, 26, 0.6)
        );                              /* same backdrop as the pause menu */
        font-family: ${theme.font};
      }
      #welcome-box {
        width: min(560px, calc(100vw - 40px));
        padding: 36px 48px;
        border-radius: 16px;
        background: rgba(24, 34, 48, 0.85);
        border: 1px solid rgba(159, 182, 212, 0.35);
        box-shadow: 0 16px 60px rgba(0, 0, 0, 0.45);
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
        font-size: 40px;
        font-weight: 600;
        letter-spacing: 2px;
        color: #ffffff;
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
        border: 1px solid rgba(159, 182, 212, 0.45);
        background: rgba(63, 109, 179, 0.28);
        color: #ffffff;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.5px;
        text-align: center;
      }
      .key-row span {
        font-size: 15px;
        color: #c9d8ea;
        line-height: 1.4;
      }
      #welcome-safety {
        display: flex;
        gap: 10px;
        margin: 0 0 24px;
        padding: 14px 18px;
        border-radius: 10px;
        border: 1px solid rgba(214, 48, 49, 0.4);
        background: rgba(214, 48, 49, 0.12);
        font-size: 14px;
        line-height: 1.65;
        color: #c9d8ea;
        text-align: left;
        align-items: flex-start;
      }
      #welcome-warn { color: ${theme.danger}; font-size: 16px; line-height: 1.5; }
      #welcome-flow {
        margin: 0 0 14px;
        padding: 12px 18px;
        border-radius: 10px;
        border: 1px solid rgba(63, 109, 179, 0.45);
        background: rgba(63, 109, 179, 0.14);
        font-size: 14px;
        line-height: 1.65;
        color: #c9d8ea;
        text-align: left;
      }
      #welcome-start {
        width: 100%;                     /* full-width primary action, like the pause menu */
        padding: 12px 30px;
        box-sizing: border-box;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.4px;
        color: #fff;
        background: ${theme.accent};
        border: 0;
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
      }
      #welcome-start:hover { background: #4d84c9; }
      #welcome-start:focus-visible,
      #welcome-start:active {
        outline: 2px solid #9fc5e8;
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
