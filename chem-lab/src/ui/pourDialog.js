// ui/pourDialog.js — the F4 "how much?" dialog.
//
// Opens when the player pours (E on the flask while holding a bottle). Presets
// 25/50/100 ml plus a custom amount; anything past the flask's remaining
// capacity is disabled with a reason. Plain DOM like warningCard.js.
//
// POINTER-LOCK CONTRACT: the CALLER (hand.js) wraps open/close in
// player.beginModal()/endModal() — the dialog itself never touches the lock.
// Every close path (choose, cancel, Esc) funnels through ONE close() so the
// modal state can never leak.
import { theme, glassPanel, primaryButton } from './theme.js';

export function createPourDialog() {
    const root = document.createElement('div');
    root.id = 'pour-dialog';
    root.innerHTML = `
      <div id="pour-box" role="dialog" aria-labelledby="pour-title">
        <h2 id="pour-title"></h2>
        <p id="pour-capacity"></p>
        <p id="pour-question">How much?</p>
        <div id="pour-presets">
          <button data-ml="25">25 ml</button>
          <button data-ml="50">50 ml</button>
          <button data-ml="100">100 ml</button>
          <button id="pour-custom-btn">Custom&hellip;</button>
        </div>
        <div id="pour-custom-row">
          <input id="pour-custom-input" type="number" min="1" step="1" inputmode="numeric" />
          <span id="pour-custom-unit">ml</span>
          <button id="pour-custom-go">Pour</button>
        </div>
        <button id="pour-cancel">Cancel</button>
      </div>`;
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.textContent = `
      #pour-dialog {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 26;                    /* above warning card (18) and pause overlay (20) */
        align-items: center;
        justify-content: center;
        background: ${theme.overlayBg};
        font-family: ${theme.font};
      }
      #pour-box {
        width: min(360px, calc(100vw - 40px));
        padding: 28px 32px;
        border-radius: 16px;
        ${glassPanel()}
        text-align: center;
        color: ${theme.title};
        animation: pour-in 0.15s ease-out;
      }
      @keyframes pour-in {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) { #pour-box { animation: none; } }
      #pour-title { margin: 0 0 6px; font-size: 21px; font-weight: 600; }
      #pour-capacity { margin: 0 0 16px; font-size: 14px; color: ${theme.body}; }
      #pour-question { margin: 0 0 10px; font-size: 15px; font-weight: 600; color: ${theme.body}; }
      #pour-presets {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
      }
      #pour-presets button {
        padding: 11px 0;
        font-size: 15px;
        font-weight: 600;
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        ${primaryButton()}
      }
      #pour-presets button:hover:not(:disabled) {
        background: ${theme.brandHover};
        box-shadow: 0 0 18px rgba(77, 163, 255, 0.25);
      }
      #pour-presets button:active:not(:disabled) { background: ${theme.brandActive}; transform: translateY(1px); }
      #pour-presets button:disabled {
        background: rgba(255, 255, 255, 0.05);
        color: rgba(240, 250, 246, 0.3);
        border-color: rgba(255, 255, 255, 0.08);
        box-shadow: none;
        cursor: not-allowed;
      }
      #pour-custom-btn { background: ${theme.accentSoft} !important;
        color: ${theme.title} !important;
        box-shadow: none !important;
        border: 1px solid ${theme.accentBorder} !important; }
      #pour-custom-btn:hover:not(:disabled) { background: rgba(77, 163, 255, 0.22) !important; }
      #pour-custom-row {
        display: none;
        gap: 8px;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
      }
      #pour-custom-input {
        width: 90px;
        padding: 9px 10px;
        font-size: 15px;
        font-family: inherit;
        color: ${theme.title};
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        text-align: center;
      }
      #pour-custom-input:focus { border-color: ${theme.accentBorder}; }
      #pour-custom-input.bad {
        border-color: ${theme.danger};
        animation: pour-shake 0.2s;
      }
      @keyframes pour-shake {
        25% { transform: translateX(-4px); } 75% { transform: translateX(4px); }
      }
      #pour-custom-unit { color: ${theme.body}; font-size: 14px; }
      #pour-custom-go {
        padding: 9px 20px;
        font-size: 14px;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        ${primaryButton()}
      }
      #pour-custom-go:hover { background: ${theme.brandHover}; box-shadow: 0 0 18px rgba(77, 163, 255, 0.25); }
      #pour-cancel {
        padding: 9px 26px;
        font-size: 14px;
        color: ${theme.body};
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
      }
      #pour-cancel:hover { color: ${theme.title}; border-color: ${theme.accentBorder}; background: ${theme.accentSoft}; }
      #pour-dialog button:focus-visible, #pour-custom-input:focus-visible {
        outline: 2px solid ${theme.accent};
        outline-offset: 2px;
      }`;
    document.head.appendChild(style);

    const box = root.querySelector('#pour-box');
    const title = root.querySelector('#pour-title');
    const capLine = root.querySelector('#pour-capacity');
    const presets = [...root.querySelectorAll('#pour-presets button[data-ml]')];
    const customBtn = root.querySelector('#pour-custom-btn');
    const customRow = root.querySelector('#pour-custom-row');
    const customInput = root.querySelector('#pour-custom-input');
    const customUnit = root.querySelector('#pour-custom-unit');
    const customGo = root.querySelector('#pour-custom-go');
    const cancelBtn = root.querySelector('#pour-cancel');

    let session = null;    // { remaining, onChoose, onCancel } while open

    function close() {
        root.style.display = 'none';
        customRow.style.display = 'none';
        customInput.classList.remove('bad');
        session = null;
    }

    function choose(ml) {
        const { onChoose } = session;
        close();
        onChoose(ml);          // caller re-locks the pointer from this gesture
    }

    function cancel() {
        if (!session) return;
        const { onCancel } = session;
        close();
        onCancel();
    }

    presets.forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.ml))));

    customBtn.addEventListener('click', () => {
        customRow.style.display = 'flex';
        customInput.value = '';
        customInput.max = session.remaining;
        customInput.placeholder = `1\u2013${session.remaining} ${session.unit}`;
        customInput.focus();
    });

    function submitCustom() {
        const ml = Number(customInput.value);
        const ok = Number.isInteger(ml) && ml >= 1 && ml <= session.remaining;
        if (!ok) {                        // out of range / not a whole number
            customInput.classList.remove('bad');
            void customInput.offsetWidth;   // restart the shake animation
            customInput.classList.add('bad');
            return;
        }
        choose(ml);
    }
    customGo.addEventListener('click', submitCustom);
    customInput.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') submitCustom();
        e.stopPropagation();              // typing must not reach game hotkeys (E/Q/R/H)
    });

    cancelBtn.addEventListener('click', cancel);
    window.addEventListener('keydown', (e) => {
        if (session && e.code === 'Escape') cancel();
    });

    return {
        get isOpen() { return !!session; },

        // chem: { name, formula, state } · totalMl/capacity from beaker.getInfo()
        // Powders pour by WEIGHT: presets, unit label and placeholder switch to
        // grams for powder bottles; the capacity line uses the flask's own unit.
        open({ chem, totalMl, capacity, flaskPowder = false, onChoose, onCancel }) {
            const unit = chem.state === 'powder' ? 'g' : 'ml';
            const flaskUnit = flaskPowder ? 'g' : 'ml';
            session = { remaining: capacity - totalMl, unit, onChoose, onCancel };
            title.textContent = `Pour ${chem.name} (${chem.formula})`;
            capLine.textContent = `Flask: ${totalMl} ${flaskUnit} / ${capacity} ${flaskUnit}`;
            customUnit.textContent = unit;
            for (const b of presets) {
                const amount = Number(b.dataset.ml);
                b.textContent = `${amount} ${unit}`;
                const over = amount > session.remaining;
                b.disabled = over;
                b.title = over ? `exceeds flask ${flaskUnit} capacity` : '';
            }
            root.style.display = 'flex';
        }
    };
}
