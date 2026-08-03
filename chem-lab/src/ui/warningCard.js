// ui/warningCard.js — the big unmissable safety overlay (book Phase 7).
//
// Plain HTML/CSS, not a 3D object: safety text must be readable INSTANTLY,
// from any camera angle, over any chaos — that's a job for the DOM layer,
// same as the crosshair and info panel.
//
// Two moods, one card:
//   'danger' (red)  — the student did something unsafe; the eruption rages
//                     BEHIND the card. Card + chaos together is the pedagogy;
//                     we deliberately do NOT pause the simulation.
//   'info' (blue)   — the student followed correct procedure; positive
//                     reinforcement teaches as much as the warning does.
export function createWarningCard() {
  const root = document.createElement('div');
  root.id = 'warning-card';
  root.innerHTML = `
    <div id="warning-box">
      <div id="warning-icon"></div>
      <h2 id="warning-title"></h2>
      <p id="warning-text"></p>
      <button id="warning-ok">I understand</button>
    </div>`;
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    #warning-card {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 18;                 /* above crosshair/hints, below start overlay */
      align-items: flex-start;
      justify-content: center;
      pointer-events: none;        /* keep looking around while it's up */
      font-family: system-ui, sans-serif;
    }
    #warning-box {
      margin-top: 8vh;
      max-width: 480px;
      padding: 22px 28px;
      border-radius: 14px;
      background: rgba(24, 34, 48, 0.9);
      color: #fff;
      text-align: center;
      border: 3px solid;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
      font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
    }
    #warning-card.danger #warning-box { border-color: #e74c3c; }
    #warning-card.info   #warning-box { border-color: #3498db; }
    #warning-card.danger #warning-icon::before { content: '\\26A0'; color: #e74c3c; }
    #warning-card.info   #warning-icon::before { content: '\\2714'; color: #3498db; }
    #warning-icon::before { font-size: 44px; }
    #warning-title { margin: 10px 0 8px; font-size: 22px; }
    #warning-text  { margin: 0 0 16px; font-size: 15px; line-height: 1.55; color: #dde6ee; }
    #warning-ok {
      pointer-events: auto;        /* the ONE clickable thing (Esc frees the mouse) */
      padding: 9px 26px;
      border: 0;
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
      color: #fff;
    }
    #warning-card.danger #warning-ok { background: #c0392b; }
    #warning-card.info   #warning-ok { background: #2980b9; }`;
  document.head.appendChild(style);

  const title = root.querySelector('#warning-title');
  const text = root.querySelector('#warning-text');
  root.querySelector('#warning-ok').addEventListener('click', () => {
    root.style.display = 'none';
  });

  return {
    // kind: 'danger' (red, ⚠) or 'info' (blue, ✔)
    show(warning, kind = 'danger') {
      title.textContent = warning.title;
      text.textContent = warning.text;
      root.className = kind;
      root.style.display = 'flex';
    },
    hide() {
      root.style.display = 'none';
    }
  };
}
