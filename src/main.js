import { Renderer } from './core/Renderer.js';
import { SceneManager } from './core/SceneManager.js';
import { VideoRecorder } from './core/VideoRecorder.js';
import { ColorScene } from './scenes/ColorScene.js';
import { DNAScene } from './scenes/DNAScene.js';
import { VibrationScene } from './scenes/VibrationScene.js';
import { Dashboard } from './ui/Dashboard.js';
import { Controls } from './ui/Controls.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const canvas = document.getElementById('main-canvas');

const dashboard    = new Dashboard();
const renderer     = new Renderer(canvas);
const sceneManager = new SceneManager(renderer, dashboard);
const recorder     = new VideoRecorder(canvas);
const controls     = new Controls(renderer, sceneManager);

// Register all three scene factories
sceneManager.register('color',     ColorScene,     dashboard, {});
sceneManager.register('dna',       DNAScene,       dashboard, {});
sceneManager.register('vibration', VibrationScene, dashboard, {});

// ── Pattern tab switching ─────────────────────────────────────────────────────

const tabs = document.querySelectorAll('.pattern-tab');
tabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const key = tab.dataset.pattern;
    await sceneManager.switchTo(key);
    // Re-wire auto-follow if enabled
    const params = controls.gui.controllersRecursive()
      .find((c) => c.property === 'autoFollow');
    if (params?._value) {
      const aiChar = sceneManager.currentScene?.getAIChar?.();
      renderer.setAutoFollow(true, aiChar);
    }
  });
});

// ── Header button wiring ──────────────────────────────────────────────────────

document.getElementById('btn-record').addEventListener('click', () => {
  recorder.toggle();
});

recorder.onStatusChange((isRecording) => {
  const badge = document.getElementById('rec-badge');
  const btn   = document.getElementById('btn-record');
  if (isRecording) {
    badge?.classList.remove('hidden');
    btn.classList.add('recording');
    btn.textContent = '⏹ STOP';
  } else {
    badge?.classList.add('hidden');
    btn.classList.remove('recording');
    btn.textContent = '⏺ REC';
  }
});

document.getElementById('btn-save-model').addEventListener('click', async () => {
  const agent = sceneManager.currentScene?.getAgent?.();
  if (agent) {
    await agent.saveModel();
    showToast('Model saved ✓');
  }
});

document.getElementById('btn-load-model').addEventListener('click', async () => {
  const agent = sceneManager.currentScene?.getAgent?.();
  if (agent) {
    await agent.loadModel();
    showToast('Model loaded ✓');
  }
});

document.getElementById('btn-reset-model').addEventListener('click', () => {
  const agent = sceneManager.currentScene?.getAgent?.();
  if (agent) {
    agent.resetModel();
    dashboard.updateMetrics(agent);
    showToast('Agent reset — retraining from scratch ↺');
  }
});

// ── Render loop ───────────────────────────────────────────────────────────────

let lastTime = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now   = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = now;

  sceneManager.update(delta, now * 0.001);
  renderer.render(delta);
}

// ── Start with Color scene ────────────────────────────────────────────────────

sceneManager.switchTo('color').then(() => {
  loop();
});

// ── Toast utility ─────────────────────────────────────────────────────────────

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
