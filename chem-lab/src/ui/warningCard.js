// ui/warningCard.js — the safety overlay (book Phase 7).
//
// TWO DIFFERENT WEIGHTS, one API:
//   'danger'  — a full-screen blocking card. The student did something unsafe;
//               the eruption rages BEHIND the card. Card + chaos together is
//               the pedagogy; the card frees the mouse (beginModal) so the
//               "I understand" button is clickable, then re-locks (endModal).
//   'info'    — a compact NON-blocking toast at top-center. Positive
//               reinforcement must not stop the experiment: the player keeps
//               looking around and pouring while it auto-dismisses (~8 s with
//               a progress bar). It never touches pointer lock.
//
// Both moods share the animated badge: a circular ring with an SVG check
// (info) or warning triangle (danger) that pops in and draws its stroke.
import { theme, glassPanel } from './theme.js';

const TOAST_MS = 8000;   // how long the info toast stays before sliding away
const ALARM_MS = 5000;   // mask/PPE alarms shout shorter — they repeat on demand

export function createWarningCard(player) {
  const root = document.createElement('div');
  root.id = 'warning-card';
  root.innerHTML = `
    <div id="warning-box">
      <div id="warning-icon">
        <svg class="icon-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      </div>
      <h2 id="warning-title"></h2>
      <p id="warning-text"></p>
      <button id="warning-ok">I understand</button>
    </div>`;
  document.body.appendChild(root);

  const toast = document.createElement('div');
  toast.id = 'success-toast';
  toast.innerHTML = `
    <div id="toast-icon">
      <svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1"
           aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 6.5"/></svg>
      <svg class="icon-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
    </div>
    <div id="toast-body">
      <h3 id="toast-title"></h3>
      <p id="toast-text"></p>
      <div id="toast-meta">
        <span id="toast-eq"></span>
        <span id="toast-temp"></span>
      </div>
    </div>
    <button id="toast-close" aria-label="Dismiss">&#10005;</button>
    <div id="toast-bar"></div>`;
  document.body.appendChild(toast);

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
      max-width: 500px;
      padding: 28px 36px;
      border-radius: 18px;
      ${glassPanel()}
      color: #fff;
      text-align: center;
      border-width: 2px;           /* the danger red paints a thicker rim below */
      font-family: ${theme.font};
    }
    #warning-card.danger #warning-box {
      border-color: ${theme.dangerBorder};
      box-shadow: ${theme.glassShadow}, 0 0 60px rgba(255, 107, 122, 0.16);
    }

    /* --- danger badge: circular ring, red triangle, pop + pulse --- */
    #warning-icon {
      position: relative;
      width: 60px;
      height: 60px;
      margin: 4px auto 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid;
      color: ${theme.danger};
      background: ${theme.dangerSoft};
      border-color: ${theme.dangerBorder};
      box-shadow: 0 0 26px rgba(255, 107, 122, 0.30), 0 0 0 6px rgba(255, 107, 122, 0.06);
    }
    #warning-icon svg { width: 30px; height: 30px; }
    #warning-icon.pop { animation: icon-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    #warning-icon::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid currentColor;
      opacity: 0;
      animation: icon-ring 2.6s ease-out 1.1s infinite;
    }
    @keyframes icon-pop {
      from { transform: scale(0.3); opacity: 0; }
      to   { transform: scale(1);  opacity: 1; }
    }
    @keyframes icon-ring {
      0%   { transform: scale(1);    opacity: 0.65; }
      100% { transform: scale(1.5);  opacity: 0; }
    }
    #warning-title {
      margin: 12px 0 10px;
      font-size: 25px;
      font-weight: 600;
      font-family: ${theme.heading};
      color: ${theme.title};
    }
    #warning-text  { margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: ${theme.body}; }
    #warning-ok {
      pointer-events: auto;        /* the ONE clickable thing (Esc frees the mouse) */
      padding: 12px 34px;
      border: 1px solid ${theme.dangerBorder};
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.3px;
      cursor: pointer;
      color: #fff;
      font-family: inherit;
      background: ${theme.dangerSolid};
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.06s ease;
    }
    #warning-ok:active { transform: translateY(1px); background: #b3384a; }
    #warning-ok:hover { background: ${theme.dangerHover}; box-shadow: 0 0 22px rgba(255, 107, 122, 0.35); }
    #warning-ok:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 2px; }

    /* ================================================================
       INFO TOAST — non-blocking, top-center, auto-dismissing
       ================================================================ */
    #success-toast {
      display: none;
      position: fixed;
      top: 24px;
      left: 50%;
      z-index: 24;                 /* over hints/panels, under dialogs */
      transform: translateX(-50%);
      width: min(480px, calc(100vw - 40px));
      box-sizing: border-box;
      align-items: flex-start;
      gap: 14px;
      padding: 16px 44px 18px 18px;
      border-radius: 16px;
      ${glassPanel()}
      border-color: ${theme.accentBorder};
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.4),
        0 20px 60px rgba(0, 0, 0, 0.6);
      font-family: ${theme.font};
      overflow: hidden;
    }
    #success-toast.show { display: flex; }
    #success-toast.hide { animation: toast-out 0.3s ease forwards; }
    @keyframes toast-in {
      from { opacity: 0; transform: translate(-50%, -14px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }
    @keyframes toast-out {
      from { opacity: 1; transform: translate(-50%, 0); }
      to   { opacity: 0; transform: translate(-50%, -14px); }
    }

    #toast-icon {
      position: relative;
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${theme.accent};
      background: ${theme.accentSoft};
      border: 2px solid ${theme.accentBorder};
      box-shadow: 0 0 14px rgba(77, 163, 255, 0.25), 0 0 0 4px rgba(77, 163, 255, 0.06);
    }
    #toast-icon svg { width: 21px; height: 21px; }
    #toast-icon .icon-check { stroke-dasharray: 1; stroke-dashoffset: 1; }
    #toast-icon .icon-warn { display: none; }

    /* ALARM mood: red warning-triangle icon + pulsing red frame */
    #success-toast.alarm #toast-icon {
      color: ${theme.danger};
      background: ${theme.dangerSoft};
      border-color: ${theme.dangerBorder};
      box-shadow: 0 0 16px rgba(255, 107, 122, 0.35), 0 0 0 4px rgba(255, 107, 122, 0.08);
    }
    #success-toast.alarm #toast-icon .icon-check { display: none; }
    #success-toast.alarm #toast-icon .icon-warn { display: block; }
    #success-toast.alarm {
      border-color: ${theme.dangerBorder};
      animation: alarm-pulse 0.9s ease-in-out infinite;
    }
    @keyframes alarm-pulse {
      0%, 100% { border-color: rgba(255, 107, 122, 0.45); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 10px rgba(255, 107, 122, 0.18); }
      50%      { border-color: rgba(255, 107, 122, 0.95); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 107, 122, 0.45); }
    }
    #success-toast.alarm #toast-bar { background: ${theme.danger}; box-shadow: 0 0 8px rgba(255, 107, 122, 0.5); }

    #success-toast.show #toast-icon { animation: icon-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    #success-toast.show #toast-icon .icon-check {
      animation: icon-draw 0.45s 0.25s cubic-bezier(0.65, 0, 0.35, 1) forwards;
    }
    #toast-icon::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid currentColor;
      opacity: 0;
      animation: icon-ring 2.6s ease-out 1.1s infinite;
    }
    @keyframes icon-draw { to { stroke-dashoffset: 0; } }

    #toast-title {
      margin: 1px 0 3px;
      font-size: 16px;
      font-weight: 600;
      font-family: ${theme.heading};
      color: ${theme.title};
    }
    #toast-text  { margin: 0; font-size: 13.5px; line-height: 1.5; color: ${theme.body}; }

    /* Result chips: the balanced equation and the after-reaction temperature */
    #toast-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    #toast-meta > span {
      display: none;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }
    #toast-meta > span.show { display: inline-block; }
    #toast-eq {
      font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
      color: ${theme.accent};
      background: ${theme.accentSoft};
      border: 1px solid ${theme.accentBorder};
    }
    #toast-temp {
      color: ${theme.warm};
      background: rgba(255, 195, 107, 0.10);
      border: 1px solid rgba(255, 195, 107, 0.35);
    }
    #toast-temp.cool {
      color: ${theme.cool};
      background: rgba(94, 234, 212, 0.08);
      border-color: rgba(94, 234, 212, 0.30);
    }
    #toast-close {
      position: absolute;
      top: 10px;
      right: 12px;
      background: none;
      border: none;
      color: ${theme.dim};
      font-size: 13px;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 6px;
      line-height: 1;
    }
    #toast-close:hover { color: #ffffff; background: rgba(255, 255, 255, 0.08); }
    #toast-close:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 1px; }

    #toast-bar {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 3px;
      background: ${theme.accent};
      box-shadow: 0 0 8px rgba(77, 163, 255, 0.5);
    }
    #success-toast.show #toast-bar {
      animation: bar-shrink ${TOAST_MS}ms linear forwards;
    }
    @keyframes bar-shrink { from { width: 100%; } to { width: 0%; } }

    @media (prefers-reduced-motion: reduce) {
      #warning-icon.pop,
      #warning-icon::after,
      #success-toast.show #toast-icon,
      #success-toast.show #toast-icon .icon-check,
      #success-toast.show #toast-bar,
      #success-toast.alarm,
      #success-toast.hide { animation: none; }
      #toast-icon .icon-check { stroke-dashoffset: 0; }
    }`;
  document.head.appendChild(style);

  const title = root.querySelector('#warning-title');
  const text = root.querySelector('#warning-text');
  const icon = root.querySelector('#warning-icon');
  root.querySelector('#warning-ok').addEventListener('click', () => {
    root.style.display = 'none';
    // POINTER-LOCK CONTRACT: while the pointer is locked, clicks land at the
    // frozen screen-center coordinates and can never hit this button. The card
    // freed the mouse in show() (beginModal) — re-lock from this real gesture.
    if (player && player.endModal) player.endModal();
  });

  // --- toast plumbing (info + alarm moods) ---
  const toastTitle = toast.querySelector('#toast-title');
  const toastText = toast.querySelector('#toast-text');
  const toastEq = toast.querySelector('#toast-eq');
  const toastTemp = toast.querySelector('#toast-temp');
  let toastTimer = null;

  function showToast(warning, mood = 'info') {
    clearTimeout(toastTimer);
    toastTitle.textContent = warning.title;
    toastText.textContent = warning.text;
    // Optional result chips (equation + final temperature) — hidden when a
    // simple message has no reaction data to show (e.g. the "No reaction" note).
    if (warning.equation) {
      toastEq.textContent = warning.equation;
      toastEq.classList.add('show');
    } else {
      toastEq.classList.remove('show');
    }
    if (typeof warning.tempAfter === 'number') {
      toastTemp.textContent = `${Math.round(warning.tempAfter)}\u00B0C`;
      toastTemp.classList.toggle('cool', warning.tempAfter <= 30);
      toastTemp.classList.add('show');
    } else {
      toastTemp.classList.remove('show');
    }
    // Mood: 'info' = mint success, 'alarm' = pulsing red safety violation.
    toast.classList.toggle('alarm', mood === 'alarm');
    // restart every entrance animation: drop .show, force reflow, re-add it
    toast.classList.remove('show', 'hide');
    void toast.offsetWidth;
    toast.classList.add('show');
    const holdMs = mood === 'alarm' ? ALARM_MS : TOAST_MS;
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => {
        toast.classList.remove('hide');
        toast.style.display = 'none';
      }, 300);
    }, holdMs);
  }

  toast.querySelector('#toast-close').addEventListener('click', () => {
    clearTimeout(toastTimer);
    toast.classList.remove('show');
    toast.style.display = 'none';
  });

  return {
    // kind: 'danger' (red, blocking ⚠ card), 'alarm' (red, non-blocking,
    // pulsing ⚠ banner) or 'info' (mint, non-blocking ✔ toast).
    show(warning, kind = 'danger') {
      if (kind !== 'danger') { showToast(warning, kind); return; }
      title.textContent = warning.title;
      text.textContent = warning.text;
      root.className = kind;
      icon.classList.remove('pop');
      void icon.offsetWidth;         // restart the pop + ring animations
      icon.classList.add('pop');
      root.style.display = 'flex';
      // Free the mouse (no pause menu — modal mode) so the button is actually
      // clickable; endModal() in the button handler re-locks it.
      if (player && player.beginModal) player.beginModal();
    },
    hide() {
      root.style.display = 'none';
      clearTimeout(toastTimer);
      toast.classList.remove('show', 'hide');
      toast.style.display = 'none';
    }
  };
}
