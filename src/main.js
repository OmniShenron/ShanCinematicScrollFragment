import { createScene } from './scene.js';
import { loadFragments } from './loader.js';
import { updateFragments } from './motion.js';
import { clamp01 } from './math.js';

const canvas = document.getElementById('c');
const status = document.getElementById('status');
const { renderer, scene, camera } = createScene(canvas);
const modelUrl = `${import.meta.env.BASE_URL}models/shan3D-fractured.glb`;

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

const state = {
  fragments: [],
  root: null,
  ready: false,
  progress: 0,
  target: 0,
};

// ─── Mouse / touch tilt ──────────────────────────────────────────────────────
// targetX/Y: normalised cursor position, -1 → +1
// currentX/Y: lazily lerped value used for rotation
const mouse = { targetX: 0, targetY: 0, currentX: 0, currentY: 0 };

const MAX_TILT_Y = 0.36;   // ±~20° left / right
const MAX_TILT_X = 0.18;   // ±~10° up / down
const MOUSE_LAG  = 0.055;  // lower = slower / more cinematic

window.addEventListener('mousemove', (e) => {
  mouse.targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
  mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

// Touch parity
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  mouse.targetX = (t.clientX / window.innerWidth  - 0.5) * 2;
  mouse.targetY = (t.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

// ─── Scroll ──────────────────────────────────────────────────────────────────
let bootLocked = true;

function resetScroll() {
  window.scrollTo(0, 0);
  state.progress = 0;
  state.target   = 0;
}

function getScrollProgress() {
  const root      = document.documentElement;
  const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
  return clamp01(window.scrollY / maxScroll);
}

function syncScroll() {
  if (bootLocked) { state.target = 0; return; }
  state.target = getScrollProgress();
}

resetScroll();
window.addEventListener('scroll',            syncScroll, { passive: true });
window.addEventListener('resize',            syncScroll, { passive: true });
window.addEventListener('orientationchange', syncScroll, { passive: true });

requestAnimationFrame(() => {
  resetScroll();
  requestAnimationFrame(() => {
    bootLocked = false;
    syncScroll();
  });
});

// ─── Load ────────────────────────────────────────────────────────────────────
loadFragments(scene, modelUrl, (value) => {
  if (status) status.textContent = `Loading ${Math.round(value)}%`;
})
  .then(({ root, fragments }) => {
    state.root      = root;
    state.fragments = fragments;
    state.ready     = true;
    if (status) status.remove();
  })
  .catch((error) => {
    console.error(error);
    if (status) status.textContent = 'Model failed to load';
  });

// ─── Render loop ─────────────────────────────────────────────────────────────
function animate() {
  // Scroll progress — cinematic lag
  state.progress += (state.target - state.progress) * 0.04;

  // Mouse tilt — lazy follow
  mouse.currentX += (mouse.targetX - mouse.currentX) * MOUSE_LAG;
  mouse.currentY += (mouse.targetY - mouse.currentY) * MOUSE_LAG;

  if (state.ready) {
    updateFragments(state.fragments, state.progress);

    // Rotate entire model root toward cursor
    // Y-axis: left/right  |  X-axis: up/down (negated so up = tilt up)
    state.root.rotation.y =  mouse.currentX * MAX_TILT_Y;
    state.root.rotation.x = -mouse.currentY * MAX_TILT_X;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
