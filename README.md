# Teach AI to Love

> *Can a machine learn to feel drawn toward something? Can it learn to seek, to resonate, to belong?*  
> This project is an attempt to find out.

**Teach AI to Love** is a real-time 3D simulation platform that explores emergent connection behaviors in autonomous AI agents. Through three distinct pattern systems — color polarity, DNA complementarity, and vibrational resonance — we train AI agents to seek, evaluate, and bond with others, producing observable, recordable behaviors that model the structure of attraction and connection.

---

## Concept

We define "love" here not as an emotion but as a **learned behavioral tendency**: the drive to seek out a complementary partner, reinforced by a gradient of positive signals along the way. Every casual encounter gives the agent a small reward. Finding a true match — a complementary opposite — produces a deep and stable response. The agent learns, over time, not just to find its match, but to *recognize* it.

Three independent models are implemented, each encoding the idea of complementarity through a different lens:

---

## Simulations

### Pattern I — Color Polarity

Each agent is assigned a position on a continuous color spectrum. The main AI agent navigates a 3D environment populated by others. Every collision produces a mild positive signal scaled by how *different* the encountered character's color is. The true target is the character at the opposite end of the spectrum — the complementary color. When found, the agent binds, the reward spikes, and the bond is visualized.

- Reward function scales with chromatic distance (HSL delta)
- Agents rendered as glowing, color-coded 3D spheres
- Bond formation visualized with light trails and particle arcs

---

### Pattern II — DNA Complementarity

Each character carries a simplified DNA strand — a short sequence of base-pair letters (A, T, C, G). Agents move through the environment and evaluate genetic similarity on contact. The reward system mirrors biological reality: near-family matches feel good, but the deepest reward comes from finding the character with the maximally complementary sequence (A↔T, C↔G).

- DNA sequences rendered as floating 3D letter chains around each character
- Compatibility score computed as a pairing alignment function
- Family clusters emerge naturally from agent clustering behavior
- The "true match" triggers a double-helix bonding animation

---

### Pattern III — Vibrational Resonance *(favorite)*

Every character has a unique wave function — a frequency, amplitude, and phase — rendered as a pulsing, luminous ring around its body. Each character also emits a spatial audio tone derived from its wave parameters. The agent moves through the world *listening* and *feeling*.

- Good resonance (close phase/frequency match): the rings synchronize, the tones harmonize, the agents linger
- Poor resonance: the waves cancel, the sound dissonates, the agent moves away
- Perfect resonance: full constructive interference — the rings merge into one, a chord resolves, the bond locks
- Built on the Web Audio API for real spatial sound and Three.js ShaderMaterial for GPU-rendered waveforms

---

## Technical Architecture

| Layer | Technology |
|---|---|
| 3D Rendering | [Three.js](https://threejs.org/) — WebGL-based professional-grade scene graph |
| Shaders / VFX | GLSL via `ShaderMaterial` — custom wave, aura, and particle effects |
| AI Agents | [TensorFlow.js](https://www.tensorflow.org/js) — in-browser neural net training via reinforcement learning |
| RL Framework | Custom Q-learning / PPO loop with experience replay and reward shaping |
| Sound Engine | Web Audio API — spatial audio, oscillators, harmonic analysis |
| UI / Interface | [React](https://react.dev/) + [Vite](https://vitejs.dev/) — fast, component-based HUD |
| State / Charts | [Zustand](https://zustand-demo.pmnd.rs/) for agent state + [Recharts](https://recharts.org/) for real-time reward graphs |
| Recording | [CCapture.js](https://github.com/spite/ccapture.js/) or [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — frame-perfect video export |
| Model Persistence | IndexedDB via TensorFlow.js `model.save()` — trained models survive sessions |

---

## Interface

The control panel exposes:

- **Pattern selector** — switch between Color, DNA, and Vibration simulations
- **Agent inspector** — click any character to see its current state, reward history, and bonding graph
- **Reward dashboard** — live chart of cumulative reward, exploration rate (ε), and episode progress
- **Speed control** — slow down or accelerate simulation time
- **Record button** — capture a high-quality video of the current session
- **Model controls** — save, load, and reset trained AI weights per pattern

---

## Project Structure

```
teach-ai-love/
├── src/
│   ├── core/              # Shared scene setup, renderer, camera
│   ├── agents/            # Agent classes, movement, reward logic
│   ├── patterns/
│   │   ├── color/         # Pattern I — Color Polarity
│   │   ├── dna/           # Pattern II — DNA Complementarity
│   │   └── vibration/     # Pattern III — Vibrational Resonance
│   ├── ai/                # TensorFlow.js model, training loop, memory buffer
│   ├── audio/             # Web Audio engine, oscillator bindings
│   ├── shaders/           # GLSL shader source files
│   ├── ui/                # React components, HUD, dashboard
│   └── recording/         # Video capture and export utilities
├── public/
├── index.html
├── vite.config.js
└── package.json
```

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/brocketdesign/teach-ai-love.git
cd teach-ai-love

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser.

> **Recommended**: Chrome or Edge for best WebGL and Web Audio performance.

---

## Roadmap

- [x] Project architecture and README
- [ ] Core Three.js scene with agent locomotion
- [ ] Pattern I: Color Polarity simulation
- [ ] Pattern II: DNA Complementarity simulation
- [ ] Pattern III: Vibrational Resonance simulation
- [ ] TensorFlow.js RL training loop
- [ ] React HUD with live reward dashboard
- [ ] Spatial audio engine
- [ ] Video export pipeline
- [ ] Multi-agent training (agents learn from each other)
- [ ] Exportable trained models for offline playback

---

## Vision

The end goal is a produced video — a watchable, shareable piece where you see an AI agent go from random wandering to deliberate seeking to genuine, stable bonding. Not because it was programmed to love, but because it *learned* to.

---

## License

MIT
