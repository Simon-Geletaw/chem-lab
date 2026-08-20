// ui/loader.js — drives the startup loading screen (static markup in
// index.html, so it paints before any JavaScript runs).
//
//   register(stages) — install the boot stage pipeline. Each stage is
//                       { name, weight, run } with weights summing to 100.
//   progress(f)      — report 0..1 progress within the running stage; the
//                       loader converts it to a real, monotonic percentage.
//   setPercent(p)    — internal: clamp + paint the bar, readout and flask.
//   run()            — execute every stage in order.
//   yieldToPaint()   — structured yield (double rAF + macrotask) so the
//                       browser paints the bar between heavy boot chunks.
//   done()           — everything loaded: fade the screen, show the start menu.
//   fail(message)    — error card with a Reload button instead of a dead page.
//
// The percent is never faked: it equals the completed stage weight plus the
// eased fraction of the running stage's weight, so it moves smoothly forward
// and never jumps or falls back.

const screen = document.getElementById('loading-screen');
const bar = document.getElementById('loading-bar');
const status = document.getElementById('loading-status');
const pct = document.getElementById('loading-pct');
const reloadBtn = document.getElementById('loading-reload');
const liquid = document.getElementById('flask-liquid-wrap');

const stages = [];
let stageIndex = -1;       // index of the running stage, -1 while idle
let stageFraction = 0;     // 0..1 progress within the running stage
let completedWeight = 0;   // weight fully delivered by finished stages
let shown = 0;             // highest percent painted (monotonic guard)

// Ease the in-stage progress so the bar accelerates toward each stage end
// instead of lurching: f(0)=0, f(1)=1, monotonic for p in [0,1].
const easeOut = (p) => 1 - (1 - p) * (1 - p);

function setPercent(p, message) {
  shown = Math.max(shown, Math.min(100, p));
  if (bar) bar.style.width = `${shown}%`;
  if (pct) pct.textContent = `${Math.round(shown)}%`;
  if (status && message) status.textContent = message;
  // The flask "reaction": liquid starts at a quarter-full and fills toward the
  // top as the bar advances (a pure CSS var + transform, no animation cost).
  if (liquid) liquid.style.setProperty('--liquid', String(0.25 + 0.75 * shown / 100));
}

export const loader = {
  register(list) {
    stages.length = 0;
    stages.push(...list);
    stageIndex = -1;
    stageFraction = 0;
    completedWeight = 0;
    shown = 0;
  },

  // 0..1 fraction of the RUNNING stage's work done. The visible percentage is
  // completedWeight + eased(fraction) * stageWeight — real, smooth, monotonic.
  progress(f) {
    if (stageIndex < 0) return;
    stageFraction = Math.min(1, Math.max(0, f));
    setPercent(completedWeight + easeOut(stageFraction) * stages[stageIndex].weight);
  },

  async run() {
    for (let i = 0; i < stages.length; i++) {
      stageIndex = i;
      stageFraction = 0;
      const stage = stages[i];
      if (status) status.textContent = stage.name;
      setPercent(completedWeight);
      if (stage.run) await stage.run();
      // Force the stage to its full weight before advancing, so the bar never
      // jumps at a stage boundary.
      stageFraction = 1;
      completedWeight += stage.weight;
      stageIndex = -1;
      setPercent(completedWeight);
      // Between stages, give the event loop a macrotask turn.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  },

  setPercent,

  yieldToPaint,

  done,

  fail,
};

// yieldToPaint() — a structured yield: two animation frames guarantee a paint
// happened (so the bar visibly moves before the next synchronous block), then
// a macrotask lets other queued tasks run. Replaces the old arbitrary 30 ms wait.
function yieldToPaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(resolve, 0))
    )
  );
}

function done() {
  setPercent(100, 'Ready!');
  const overlay = document.getElementById('start-overlay');

  // The game animation loop is already running. Waiting for two painted
  // frames guarantees that the completed lab is present on the canvas before
  // the loading layer fades and the existing start page becomes visible.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (overlay) overlay.classList.add('ready');
      screen.classList.add('done');

      // The faded loading screen is no longer needed after its transition.
      window.setTimeout(() => {
        if (screen.parentNode) screen.parentNode.removeChild(screen);
      }, 360);
    });
  });
}

function fail(message) {
  screen.classList.add('error');
  if (status) status.textContent = message;
  if (pct) pct.textContent = '';
  if (reloadBtn) reloadBtn.hidden = false;
}

if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());