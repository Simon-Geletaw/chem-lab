// ui/loader.js — drives the startup loading screen (static markup in
// index.html, so it paints before any JavaScript runs).
//
//   set(percent, message) — report progress (monotonic, never goes back)
//   done()                — everything loaded: fade the screen, show the start menu
//   fail(message)         — WebGL missing or startup threw: a friendly error card
//                           with a Reload button instead of a silently dead page

export function createLoader() {
  const screen = document.getElementById('loading-screen');
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  const pct = document.getElementById('loading-pct');
  const reloadBtn = document.getElementById('loading-reload');

  let shown = 0;
  const liquid = document.getElementById('flask-liquid-wrap');

  function set(percent, message) {
    shown = Math.max(shown, Math.min(100, percent));
    if (bar) bar.style.width = `${shown}%`;
    if (pct) pct.textContent = `${Math.round(shown)}%`;
    if (status && message) status.textContent = message;
    // The flask "reaction": liquid starts at a quarter-full and fills toward the
    // top as the bar advances (a pure CSS var + transform, no animation cost).
    if (liquid) liquid.style.setProperty('--liquid', String(0.25 + 0.75 * shown / 100));
  }

  function done() {
    set(100, 'Ready!');
    screen.classList.add('done');
    // After the fade, hand the screen over to the start overlay (pause menu).
    setTimeout(() => {
      screen.style.display = 'none';
      const overlay = document.getElementById('start-overlay');
      if (overlay) overlay.style.display = 'flex';
    }, 500);
  }

  function fail(message) {
    screen.classList.add('error');
    if (status) status.textContent = message;
    if (pct) pct.textContent = '';
    if (reloadBtn) reloadBtn.hidden = false;
  }

  if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());

  return { set, done, fail };
}

// yieldToPaint() — one macrotask lets the browser actually paint the loading
// screen (and visibly move the bar) before the heavy synchronous world-build
// blocks the main thread.
export const yieldToPaint = () => new Promise((resolve) => setTimeout(resolve, 30));
