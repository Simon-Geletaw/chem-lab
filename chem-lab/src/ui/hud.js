// ui/hud.js — small persistent status chips (bottom-left corner).
//
// F5 adds the first one: the gloves badge. Future features can add chips to
// the same container so status never scatters across the screen.
import { theme } from './theme.js';

export function createHUD() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div id="hud-gloves" class="hud-chip off">Gloves: OFF</div>
      <div id="hud-mask" class="hud-chip off">Mask: OFF</div>
      <div id="hud-coat" class="hud-chip off">Coat: OFF</div>
      <div id="hud-goggles" class="hud-chip off">Goggles: OFF</div>`;
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
        font-family: inherit;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
      }
      /* PPE status = unmistakable signal colour:
         ON  → GREEN (worn = safe),      OFF → RED (not worn = danger). */
      .hud-chip.on {
        background: ${theme.safeSolid};
        border: 1px solid ${theme.safeBorder};
        color: #06210f;             /* dark text on the green fill */
      }
      .hud-chip.off {
        background: ${theme.dangerSolid};
        border: 1px solid ${theme.dangerBorder};
        color: #fff;
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
    const coatChip = root.querySelector('#hud-coat');
    const gogglesChip = root.querySelector('#hud-goggles');

    // flashMask(on): safety-alarm state — the mask chip pulses red for a few
    // seconds when a hazardous chemical is poured without a mask on.
    let flashTimer = null;

    return {
        setGloves(on) {
            glovesChip.textContent = on ? 'Gloves: ON' : 'Gloves: OFF';
            glovesChip.classList.toggle('on', on);
            glovesChip.classList.toggle('off', !on);
        },
        setMask(on) {
            maskChip.textContent = on ? 'Mask: ON' : 'Mask: OFF';
            maskChip.classList.toggle('on', on);
            maskChip.classList.toggle('off', !on);
        },
        setCoat(on) {
            coatChip.textContent = on ? 'Coat: ON' : 'Coat: OFF';
            coatChip.classList.toggle('on', on);
            coatChip.classList.toggle('off', !on);
        },
        setGoggles(on) {
            gogglesChip.textContent = on ? 'Goggles: ON' : 'Goggles: OFF';
            gogglesChip.classList.toggle('on', on);
            gogglesChip.classList.toggle('off', !on);
        },
        flashMask(on) {
            clearTimeout(flashTimer);
            maskChip.classList.toggle('alarm', on);
            if (on) flashTimer = setTimeout(() => maskChip.classList.remove('alarm'), 5000);
        }
    };
}


