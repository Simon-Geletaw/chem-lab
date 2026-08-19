// ui/experimentOverlay.js — the card-detail overlay for the experiment table.
//
// Aim at a card and press E (hand.js) → this overlay opens with the card's
// image, title, subtitle, full description and its SAFETY chips (the lines
// from experiments.json, e.g. "Wear nitrile gloves"). The "Open Experiment"
// button runs the same travel-overlay beat as the simulation doors, then
// routes to the card's href.
//
// Pointer-lock contract (same as warningCard.js): while the pointer is locked,
// clicks land at the frozen screen-center coordinates and can never hit the
// buttons — so show() frees the mouse (player.beginModal) and the buttons
// re-lock it (player.endModal) from the real click gesture.
import { theme, glassPanel, primaryButton } from './theme.js';
import { getUiLabels } from '../experiments/registry.js';

export function createExperimentOverlay(player) {
  const ui = getUiLabels();   // every label on this card comes from experiments.json
  const root = document.createElement('div');
  root.id = 'experiment-overlay';
  root.innerHTML = `
    <div id="experiment-box">
      <img id="experiment-image" alt="">
      <div id="experiment-body">
        <h2 id="experiment-title"></h2>
        <p id="experiment-subtitle"></p>
        <p id="experiment-description"></p>
        <div id="experiment-safety"><span id="safety-label">${ui.safetyLabel}</span></div>
        <div id="experiment-actions">
          <button id="experiment-open">${ui.openButton}</button>
          <button id="experiment-close">${ui.closeButton}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    #experiment-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 22;                 /* above hints/panels, below the travel overlay */
      align-items: center;
      justify-content: center;
      background: ${theme.overlayBg};
      font-family: ${theme.font};
    }
    #experiment-box {
      display: flex;
      width: min(640px, calc(100vw - 40px));
      max-height: min(560px, calc(100vh - 60px));
      overflow: hidden;
      border-radius: 18px;
      ${glassPanel()}
      color: ${theme.title};
      font-family: ${theme.font};
    }
    #experiment-image {
      flex: 0 0 40%;
      object-fit: cover;
      background: #c9d8ea;
      min-height: 0;
    }
    #experiment-body {
      flex: 1;
      padding: 24px 26px;
      overflow-y: auto;
    }
    #experiment-title {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 600;
      font-family: ${theme.heading};
      color: ${theme.title};
    }
    #experiment-subtitle {
      margin: 0 0 14px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: ${theme.brand};
    }
    #experiment-description {
      margin: 0 0 16px;
      font-size: 14.5px;
      line-height: 1.65;
      color: ${theme.body};
    }
    #experiment-safety {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 22px;
    }
    #safety-label {
      font-size: 13px;
      font-weight: 600;
      color: ${theme.dim};
    }
    .safety-chip {
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      color: ${theme.danger};
      background: ${theme.dangerSoft};
      border: 1px solid ${theme.dangerBorder};
    }
    #experiment-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    #experiment-open {
      ${primaryButton()}
      padding: 11px 26px;
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: 0.3px;
      cursor: pointer;
      font-family: inherit;
    }
    #experiment-open:hover {
      background: ${theme.brandHover};
      box-shadow: 0 0 22px rgba(77, 163, 255, 0.35);
    }
    #experiment-open:active { background: ${theme.brandActive}; transform: translateY(1px); }
    #experiment-open:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 2px; }
    #experiment-close {
      padding: 11px 20px;
      border-radius: 10px;
      border: 1px solid ${theme.glassBorder};
      background: transparent;
      color: ${theme.body};
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    #experiment-close:hover { background: rgba(10, 43, 77, 0.08); }
    #experiment-close:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      #experiment-box { animation: none; }
    }`;
  document.head.appendChild(style);

  const image = root.querySelector('#experiment-image');
  const title = root.querySelector('#experiment-title');
  const subtitle = root.querySelector('#experiment-subtitle');
  const description = root.querySelector('#experiment-description');
  const safety = root.querySelector('#experiment-safety');
  let currentEntry = null;

  image.onerror = () => { image.style.display = 'none'; };
  image.onload = () => { image.style.display = ''; };

  function travelOverlay(label) {
    document.getElementById('travel-text').textContent = ui.travelText.replace('{title}', label);
    const overlay = document.getElementById('travel-overlay');
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function hide() {
    root.style.display = 'none';
  }

  root.querySelector('#experiment-close').addEventListener('click', () => {
    hide();
    if (player && player.endModal) player.endModal();
  });

  root.querySelector('#experiment-open').addEventListener('click', () => {
    if (!currentEntry) return;
    const entry = currentEntry;
    hide();
    // Re-lock from this real gesture, then run the travel beat + route.
    if (player && player.endModal) player.endModal();
    travelOverlay(entry.title);
    setTimeout(() => {
      if (entry.target === '_blank') window.open(entry.href, '_blank', 'noopener,noreferrer');
      else window.location.assign(entry.href);
    }, 420);
  });

  return {
    show(entry) {
      currentEntry = entry;
      image.style.display = '';
      image.alt = entry.title;   // dynamic alt text from the JSON entry
      image.src = entry.image;
      title.textContent = entry.title;
      subtitle.textContent = entry.subtitle;
      description.textContent = entry.description;
      safety.querySelectorAll('.safety-chip').forEach((c) => c.remove());
      entry.safety.forEach((line) => {
        const chip = document.createElement('span');
        chip.className = 'safety-chip';
        chip.textContent = line;
        safety.appendChild(chip);
      });
      root.style.display = 'flex';
      if (player && player.beginModal) player.beginModal();
    },
    hide
  };
}
