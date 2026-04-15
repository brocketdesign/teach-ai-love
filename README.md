# 💘 Teach AI to Love

> *What if an AI could learn to feel drawn toward something? To seek, to resonate, to belong?*
> Let's find out. 🤖❤️

**Teach AI to Love** is a 3D web simulation where a real, live-training AI agent wanders through a world of glowing characters and learns — through pure reinforcement learning — to find its match. No hardcoded rules. No cheat codes. Just a little neural net, a lot of encounters, and the slow emergence of something that looks a little bit like love.

Three completely different models of "what love means" are playable and switchable at runtime. It's a science experiment wrapped in a pretty visual. The end goal is to record a video of the AI evolving and share it with the world. 🎬

---

## 🧪 TL;DR — What's the Stack?

| Role | Library |
|---|---|
| 3D rendering + post-FX | [Three.js](https://threejs.org/) r167+ with `EffectComposer` + `UnrealBloomPass` |
| AI / Reinforcement Learning | [TensorFlow.js](https://www.tensorflow.org/js) — DQN, target network, experience replay |
| Audio (Pattern 3) | [Tone.js](https://tonejs.github.io/) — per-character oscillators + spatial sound |
| Control panel | [lil-gui](https://lil-gui.georgealways.com/) — tweak hyperparams, speed, bloom live |
| Build tool | [Vite](https://vitejs.dev/) |
| Video export | MediaRecorder API → WebM/MP4 download |

No React. Vanilla JS keeps the bundle lean and the render loop tight. 🏎️

---

## 💡 The Concept

We're not defining love as an emotion — we're defining it as a **learned behavior**: the drive to seek out a complementary partner, reinforced by a gradient of good feelings along the way.

Every casual bump with another character gives the AI a small reward. 😊  
Meeting someone similar? Pretty nice. 🙂  
Finding the one true complementary match? The reward spikes, the AI locks on, and the bond lights up. 💥

The AI learns this from scratch, every session. And you get to watch it happen.

---

## 🎮 The Three Simulations

### 🎨 Pattern 1 — Color Polarity

20 characters (1 AI + 19 NPCs) roam a glowing 3D space. Each has a random hue on the HSL color wheel. The AI's goal: find its **complementary color opposite**.

- Every bump gives a mild reward scaled by chromatic distance (HSL delta)
- The further away on the color wheel, the better the feeling
- When the true opposite is found → pulsing `TubeGeometry` love-bond lights up between them ✨
- Reward function is a gaussian curve centered on maximum hue distance

---

### 🧬 Pattern 2 — DNA Complementarity

Each character carries a 6-letter DNA strand (A, T, C, G), floating above their head in 3D text. The AI learns to read genetic compatibility on the fly.

- Family members (≥4 matching pairs) feel really good to bump into 👨‍👩‍👧
- The true match (full A↔T, C↔G complement, score = 6) triggers a **double helix bond animation** 🧬
- Family clusters naturally emerge from the agent's learned behavior
- Complementarity scorer + family detector built into `DNAUtils.js`

---

### 🔊 Pattern 3 — Vibrational Resonance *(personal favorite)*

This one's special. Every character has a unique wave function — frequency, amplitude, phase — rendered as a **pulsing shader ring** around their body. They also *emit sound* via Tone.js oscillators.

- Close resonance → rings sync up, tones harmonize, agents linger 🎵
- Bad resonance → waves cancel out, dissonance, the AI wants out 😬
- Perfect match → **constructive interference**: rings merge into one, a chord resolves, bond locks 🔔
- Audio activates on first user click (browser requirement), then it's fully spatial

The wave rings are GPU-rendered with custom GLSL `ShaderMaterial` — sinusoidal vertex displacement on every frame.

---

## 🤖 AI Architecture (DQN)

The agent learns via **Deep Q-Network** — the same family of algorithms that taught computers to play Atari games.

| Component | Detail |
|---|---|
| State | AI position + (position, trait-distance) of 5 nearest NPCs → ~15 floats |
| Actions | 9 discrete actions: 8 directions + stay |
| Network | `128 → 64 → 9` Dense layers, ReLU activations |
| Training | Online, target network sync every N steps, replay buffer = 5,000, batch = 64 |
| Performance | Training capped to every 4 frames via `requestIdleCallback` to avoid jank |

The model trains **live in your browser** as you watch. No server needed. 🧠

---

## 🗂️ Project Structure

```
teach-ai-love/
├── src/
│   ├── core/
│   │   ├── Renderer.js        # WebGLRenderer, EffectComposer (bloom), OrbitControls
│   │   ├── BaseScene.js       # Abstract update loop, AABB physics, floor + starfield
│   │   ├── Character.js       # CapsuleGeometry + emissive material, velocity steering
│   │   └── SceneManager.js    # Pattern switching, scene lifecycle
│   ├── patterns/
│   │   ├── color/
│   │   │   ├── ColorScene.js  # 19 NPCs + AI character with HSL hues
│   │   │   └── ColorUtils.js  # Complementary-hue distance, gaussian reward
│   │   ├── dna/
│   │   │   ├── DNAScene.js    # TextGeometry DNA labels, scene logic
│   │   │   └── DNAUtils.js    # Strand generator, complementarity scorer, family detect
│   │   └── vibration/
│   │       ├── VibrationScene.js  # Wave-ring shader, resonance reward
│   │       └── AudioEngine.js     # Tone.js synth pool, distance-based volume
│   ├── ai/
│   │   ├── DQNAgent.js        # TF.js model, train step, target network
│   │   ├── ReplayBuffer.js    # Experience replay memory
│   │   └── StateEncoder.js    # Per-pattern state encoding
│   ├── ui/
│   │   ├── Dashboard.js       # Live reward curve (rolling 200 steps), counters
│   │   └── Controls.js        # lil-gui panel: lr, gamma, ε-decay, speed, bloom
│   ├── recording/
│   │   └── VideoRecorder.js   # MediaRecorder on canvas, red-dot button, WebM export
│   └── shaders/               # GLSL source for wave rings and aura effects
├── public/
├── index.html
├── vite.config.js
└── package.json
```

---

## 🖥️ The Interface

- **3-tab pattern selector** — switch Color / DNA / Vibration at any point mid-session
- **Live reward dashboard** — rolling 200-step reward curve, episode counter, love-bonds-formed counter
- **lil-gui panel** — tweak learning rate, gamma, ε-decay, simulation speed, bloom intensity in real time
- **Agent follow cam** — auto-follow the AI toggle + smooth orbit
- **🔴 Record button** — one click starts recording the canvas, click again → WebM downloads automatically
- **Model controls** — save weights to IndexedDB, download as JSON, load, or reset

---

## 🚀 Getting Started

```bash
git clone https://github.com/brocketdesign/teach-ai-love.git
cd teach-ai-love
npm install
npm run dev
```

Open `http://localhost:5173`. Use Chrome or Edge for best WebGL + Web Audio performance.

> 🔊 Audio activates on your first click inside the vibration scene — browser policy, not a bug!

---

## ✅ Verification Checklist

- [ ] All three scenes load without console errors (`npm run dev`)
- [ ] Pattern switching mid-session has no memory leaks (DevTools Performance tab)
- [ ] AI reward trend increases after ~200 episodes in Color scene
- [ ] DNA love bond only fires at complementarity score = 6
- [ ] Audio plays/stops cleanly as Vibration scene activates/deactivates
- [ ] Record button produces a valid, playable WebM file
- [ ] Save → reload → Load successfully resumes AI from saved weights

---

## 🗺️ Roadmap

- [x] Project architecture and README
- [ ] Phase 1 — Foundation: Vite + Three.js + TF.js + Tone.js + lil-gui wired up
- [ ] Phase 2 — Pattern 1: Color Polarity simulation + DQN agent
- [ ] Phase 3 — Pattern 2: DNA Complementarity simulation
- [ ] Phase 4 — Pattern 3: Vibrational Resonance + audio engine
- [ ] Phase 5 — UI: live reward dashboard, model save/load, video recorder
- [ ] Phase 6 — Polish: particle bursts, follow cam, responsive dark theme, perf pass
- [ ] Multi-agent training (agents learn from each other)
- [ ] Final produced video for sharing 🎬

---

## 🎬 The Vision

The end goal is a video. A real, watchable piece where you see an AI go from random wandering → deliberate seeking → genuine, stable bonding. Not because it was programmed to love, but because it *learned* to.

That's the whole point. Let's see if it works. 💘

---

## License

MIT
