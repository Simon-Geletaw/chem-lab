// ui/hud.js — small persistent status chips (bottom-left corner).
//
// F5 adds the first one: the gloves badge. Future features can add chips to
// the same container so status never scatters across the screen.
import { theme } from './theme.js';

export function createHUD() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `<div id="hud-gloves" class="hud-chip off">Gloves: OFF</div>`;
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.textContent = `
      #hud {
        position: fixed;
        left: 16px;
        bottom: 16px;
        display: flex;
        gap: 8px;
        z-index: 12;                  /* over the canvas, under dialogs */
        pointer-events: none;         /* never steal clicks */
        font-family: ${theme.font};
      }
      .hud-chip {
        padding: 7px 14px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.4px;
        color: #fff;
        background: ${theme.accent};
        border: 1px solid rgba(159, 182, 212, 0.4);
      }
      .hud-chip.off {
        background: rgba(24, 34, 48, 0.75);
        color: #9fb6d4;
      }`;
    document.head.appendChild(style);

    const glovesChip = root.querySelector('#hud-gloves');

    return {
        setGloves(on) {
            glovesChip.textContent = on ? 'Gloves: ON' : 'Gloves: OFF';
            glovesChip.classList.toggle('off', !on);
        }
    };
}
