// fullscreen.js — the corner ⛶ toggle (button lives in index.html). The Web
// Fullscreen API is not available in every browser/embed; if it is missing
// the button hides itself and the lab is not degraded. The icon swaps
// enter/exit via a CSS class and stays in sync with the real fullscreen
// state — including when the user leaves with ESC.
const btn = document.getElementById('fullscreen-btn');

function supported() {
  return !!(document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen);
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function sync() {
  if (!btn) return;
  const fs = isFullscreen();
  btn.classList.toggle('fullscreen', fs);
  btn.setAttribute('aria-label', fs ? 'Exit fullscreen' : 'Enter fullscreen');
  btn.setAttribute('title', fs ? 'Exit fullscreen (ESC)' : 'Enter fullscreen');
}

function toggle() {
  if (isFullscreen()) {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } else if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.documentElement.webkitRequestFullscreen) {
    document.documentElement.webkitRequestFullscreen();
  }
}

if (btn && supported()) {
  btn.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
} else if (btn) {
  btn.hidden = true;
}