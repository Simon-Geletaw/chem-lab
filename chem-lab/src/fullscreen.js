// fullscreen.js â€” pause-menu fullscreen control. The browser fullscreen API is
// optional, so unsupported environments simply omit this pause action.
const btn = document.getElementById('fullscreen-btn');

function supported() {
  return !!(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen
  );
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function sync() {
  if (!btn) return;
  const active = isFullscreen();
  btn.classList.toggle('fullscreen', active);
  btn.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
  btn.setAttribute('aria-pressed', String(active));
  btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  btn.setAttribute('title', active ? 'Exit fullscreen (ESC)' : 'Enter fullscreen');
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
  // The pause overlay enters the lab on clicks. Preserve pause state when using
  // its fullscreen action by preventing this click from reaching the overlay.
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggle();
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
} else if (btn) {
  btn.hidden = true;
}
