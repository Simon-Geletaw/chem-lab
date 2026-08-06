// ui/hud.js — small persistent status chips (bottom-left corner).
//
// F5 adds the first one: the gloves badge. Future features can add chips to
// the same container so status never scatters across the screen.
import { theme, glassPanel } from './theme.js';

export function createHUD() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div id="hud-gloves" class="hud-chip off">Gloves: OFF</div>
      <div id="hud-mask" class="hud-chip off">Mask: OFF</div>`;
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
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.4px;
        color: ${theme.onBrand};        /* near-white mint on the brand fill */
        background: ${theme.brand};
        border: 1px solid ${theme.accentBorder};
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      }
      .hud-chip.off {
        ${glassPanel()}
        color: ${theme.dim};            /* muted gray on frosted glass */
      }
      /* safety-violation flash: the offending chip pulses red */
      .hud-chip.alarm {
        background: ${theme.dangerSolid};
        border-color: ${theme.dangerBorder};
        color: #fff;
        animation: hud-alarm 0.9s ease-in-out infinite;
      }
      @keyframes hud-alarm {
        0%, 100% { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); }
        50%      { box-shadow: 0 0 22px rgba(255, 107, 122, 0.6); }
      }
      @media (prefers-reduced-motion: reduce) { .hud-chip.alarm { animation: none; } }`;
    document.head.appendChild(style);

    const glovesChip = root.querySelector('#hud-gloves');
    const maskChip = root.querySelector('#hud-mask');

    // flashMask(on): safety-alarm state — the mask chip pulses red for a few
    // seconds when a hazardous chemical is poured without a mask on.
    let flashTimer = null;

    return {
        setGloves(on) {
            glovesChip.textContent = on ? 'Gloves: ON' : 'Gloves: OFF';
            glovesChip.classList.toggle('off', !on);
        },
        setMask(on) {
            maskChip.textContent = on ? 'Mask: ON' : 'Mask: OFF';
            maskChip.classList.toggle('off', !on);
        },
        flashMask(on) {
            clearTimeout(flashTimer);
            maskChip.classList.toggle('alarm', on);
            if (on) flashTimer = setTimeout(() => maskChip.classList.remove('alarm'), 5000);
        }
    };
}
