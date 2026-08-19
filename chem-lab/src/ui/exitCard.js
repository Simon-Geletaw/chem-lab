// ui/exitCard.js — the "You left the lab" overlay shown when the player presses
// E at the steel exit door on the front wall.
//
// Same visual language as welcomeCard.js (theme tokens + glassPanel + primary
// button), so it reads as part of the same UI system. It is triggered from
// hand.js through the player's modal mode: the mouse is freed WITHOUT raising
// the pause menu, and "Return to Lab" re-locks it from the click gesture.
import { theme, glassPanel, primaryButton } from './theme.js';

export function createExitCard(onReturn) {
    const root = document.createElement('div');
    root.id = 'exit-card';
    root.innerHTML = `
      <div id="exit-box" role="dialog" aria-labelledby="exit-title">
        <h1 id="exit-title">You left the lab</h1>
        <p id="exit-text">Session complete — thanks for visiting the Chemistry Lab.
          Returning will start a fresh session from the entrance.</p>
        <p id="exit-ppe">
          <span id="exit-warn" aria-hidden="true">&#9888;</span>
          <span>Remember: used gloves and masks go in the biohazard bin before leaving.</span>
        </p>
        <button id="exit-return">Return to Lab</button>
      </div>`;
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.textContent = `
      #exit-card {
        display: none;                   /* hidden until E at the exit door */
        position: fixed;
        inset: 0;
        z-index: 35;                     /* above the pause menu (z-20) and welcome card (z-30) */
        align-items: center;
        justify-content: center;
        background: ${theme.overlayBg};
        font-family: ${theme.font};
      }
      #exit-box {
        width: min(520px, calc(100vw - 40px));
        padding: 36px 48px;
        border-radius: 16px;
        ${glassPanel()}
        text-align: center;
        color: ${theme.title};
        animation: exit-in 0.2s ease-out;
      }
      @keyframes exit-in {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        #exit-box { animation: none; }
      }
      #exit-box h1 {
        margin: 0 0 14px;
        font-size: 40px;
        font-weight: 600;
        font-family: ${theme.heading};
        letter-spacing: 0.5px;
        color: ${theme.title};
      }
      #exit-text {
        margin: 0 0 18px;
        font-size: 15px;
        line-height: 1.6;
        color: ${theme.body};
      }
      #exit-ppe {
        display: flex;
        gap: 10px;
        margin: 0 0 24px;
        padding: 14px 18px;
        border-radius: 10px;
        border: 1px solid ${theme.accentBorder};
        background: ${theme.accentSoft};
        font-size: 14px;
        line-height: 1.65;
        color: ${theme.body};
        text-align: left;
        align-items: flex-start;
      }
      #exit-warn { color: ${theme.accent}; font-size: 16px; line-height: 1.5; }
      #exit-return {
        width: 100%;
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
      #exit-return:hover {
        transform: translateY(-2px);
        background: ${theme.brandHover};
        box-shadow: 0 0 24px rgba(77, 163, 255, 0.30), 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      #exit-return:active { transform: translateY(1px); background: ${theme.brandActive}; }
      #exit-return:focus-visible {
        outline: 2px solid ${theme.accent};
        outline-offset: 2px;
      }`;
    document.head.appendChild(style);

    const show = () => { root.style.display = 'flex'; };
    const hide = () => { root.style.display = 'none'; };

    root.querySelector('#exit-return').addEventListener('click', () => {
        hide();
        onReturn();    // player.endModal() re-locks from the click gesture
    });

    return { show, hide };
}