import * as THREE from 'three';
import { AICharacter } from '../entities/AICharacter.js';
import { NPCCharacter } from '../entities/NPCCharacter.js';
import { DQNAgent } from '../ai/DQNAgent.js';
import { vibrationReward } from '../ai/RewardFunctions.js';
import { AudioEngine } from '../utils/AudioEngine.js';
import { hslToHex } from '../utils/ColorUtils.js';
import { ARENA_HALF } from '../entities/Character.js';

const NPC_COUNT = 19;
const FREQ_MIN  = 110;
const FREQ_MAX  = 880;
const FREQ_RANGE = FREQ_MAX - FREQ_MIN;

// Wave-ring vertex shader
const WAVE_VERT = /* glsl */`
  uniform float uTime;
  uniform float uFrequency;
  uniform float uAmplitude;
  uniform float uPhase;
  varying vec3 vPos;

  void main() {
    vPos = position;
    vec3 p = position;
    float angle = atan(p.x, p.z);
    float wave = uAmplitude * sin(uFrequency * angle * 6.0 + uTime * 3.0 + uPhase);
    p.y += wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const WAVE_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vPos;

  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

export class VibrationScene {
  constructor(dashboard, guiConfig) {
    this._dashboard  = dashboard;
    this._guiConfig  = guiConfig;
    this.threeScene  = new THREE.Scene();
    this._characters = [];
    this._aiChar     = null;
    this._agent      = null;
    this._waveRings  = new Map();      // char → ring mesh
    this._mergeRings = [];             // interference rings on love events
    this._audio      = new AudioEngine();
    this._audioEnabled = false;
    this._particles  = [];
    this._episodeTimer    = 0;
    this._episodeDuration = 30;
    this._frameCount      = 0;
  }

  async init() {
    this._buildEnvironment();
    this._spawnCharacters();
    this._initAgent();
    // Audio is opt-in; activated on first click
    this._bindAudioActivation();
  }

  _bindAudioActivation() {
    const handler = async () => {
      if (!this._audioEnabled) {
        await this._audio.activate();
        this._audioEnabled = true;
        // Register currently spawned characters
        this._characters.forEach((char, i) => {
          this._audio.register(i, char.trait.frequency, char === this._aiChar);
        });
        this._audio.setAIVolume(-15);
      }
    };
    document.addEventListener('click', handler, { once: true });
  }

  _buildEnvironment() {
    const scene = this.threeScene;
    scene.background = new THREE.Color(0x01010a);
    scene.fog = new THREE.FogExp2(0x01010a, 0.015);

    const floorGeo = new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x030310, roughness: 0.95 });
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    scene.add(new THREE.GridHelper(ARENA_HALF * 2, 20, 0x0a0a2a, 0x0a0a2a));
    this._buildArenaBorder();
    scene.add(new THREE.AmbientLight(0x0a0a30, 2.0));
    const sun = new THREE.DirectionalLight(0x8888ff, 2.0);
    sun.position.set(5, 20, 10);
    sun.castShadow = true;
    scene.add(sun);
    this._buildStarField();
  }

  _buildArenaBorder() {
    const h = ARENA_HALF;
    const pts = [
      new THREE.Vector3(-h,0,-h), new THREE.Vector3(h,0,-h),
      new THREE.Vector3(h,0,h),   new THREE.Vector3(-h,0,h),
      new THREE.Vector3(-h,0,-h),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.threeScene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3333ff })));
  }

  _buildStarField() {
    const count = 700;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random()-0.5)*200;
      pos[i*3+1] = Math.random()*60+5;
      pos[i*3+2] = (Math.random()-0.5)*200;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.threeScene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaaaff, size: 0.12 })));
  }

  _freqToColor(freq) {
    // Map frequency logarithmically to hue: low=violet, high=red
    const t = Math.log(freq / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN);
    const hue = (1 - t) * 270; // 270° (violet) → 0° (red)
    return hslToHex(hue, 0.9, 0.58);
  }

  _spawnCharacters() {
    const aiFreq  = FREQ_MIN + Math.random() * FREQ_RANGE;
    const aiColor = this._freqToColor(aiFreq);

    this._aiChar = new AICharacter({ color: aiColor, trait: { frequency: aiFreq, phase: 0 } });
    this._placeRandomly(this._aiChar);
    this.threeScene.add(this._aiChar.group);
    this._buildWaveRing(this._aiChar, true);
    this._characters.push(this._aiChar);

    // Love-target: same frequency as AI (within 5 Hz)
    const loveFreq  = aiFreq + (Math.random() - 0.5) * 10;
    const loveColor = this._freqToColor(loveFreq);
    const loveNPC   = new NPCCharacter({ color: loveColor, trait: { frequency: loveFreq, phase: Math.random() * Math.PI * 2 } });
    this._placeRandomly(loveNPC);
    this.threeScene.add(loveNPC.group);
    this._buildWaveRing(loveNPC, false);
    this._characters.push(loveNPC);

    for (let i = 0; i < NPC_COUNT - 1; i++) {
      const freq  = FREQ_MIN + Math.random() * FREQ_RANGE;
      const color = this._freqToColor(freq);
      const npc   = new NPCCharacter({ color, trait: { frequency: freq, phase: Math.random() * Math.PI * 2 } });
      this._placeRandomly(npc);
      this.threeScene.add(npc.group);
      this._buildWaveRing(npc, false);
      this._characters.push(npc);
    }
  }

  _placeRandomly(char) {
    const margin = 2;
    char.position.set(
      (Math.random()-0.5)*(ARENA_HALF-margin)*2,
      0,
      (Math.random()-0.5)*(ARENA_HALF-margin)*2
    );
  }

  _buildWaveRing(char, isAI) {
    // Torus ring with ShaderMaterial for wave displacement
    const geo = new THREE.TorusGeometry(1.4 + (isAI ? 0.2 : 0), 0.04, 8, 64);
    const col = new THREE.Color(char._baseColor);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uFrequency: { value: char.trait.frequency / 100 },
        uAmplitude: { value: isAI ? 0.18 : 0.12 },
        uPhase:     { value: char.trait.phase ?? 0 },
        uColor:     { value: col },
        uOpacity:   { value: 0.75 },
      },
      vertexShader: WAVE_VERT,
      fragmentShader: WAVE_FRAG,
      transparent: true,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    char.group.add(ring);
    this._waveRings.set(char, ring);
  }

  _initAgent() {
    this._agent = new DQNAgent({ pattern: 'vibration' });
    this._aiChar.agent = this._agent;
    this._aiChar.rewardFn = (ai, all) => {
      const { reward, loveTriggered } = vibrationReward(ai, all);
      this._agent.episodeReward += reward;
      if (loveTriggered) {
        this._agent.onLoveBond();
        this._spawnInterferenceRing(ai.position.clone());
      }
      return reward;
    };
    this._agent.onMetricsUpdate = () => this._dashboard?.updateMetrics(this._agent);
    this._dashboard?.setAgent(this._agent);
  }

  _spawnInterferenceRing(position) {
    // Expanding ring burst
    const geo = new THREE.RingGeometry(0.1, 0.3, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x88aaff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = 0.1;
    this.threeScene.add(ring);
    this._mergeRings.push({ ring, life: 2.0, maxLife: 2.0 });
  }

  update(deltaTime, _elapsedTime) {
    this._episodeTimer += deltaTime;
    if (this._episodeTimer >= this._episodeDuration) {
      this._agent.endEpisode();
      this._episodeTimer = 0;
    }

    const t = performance.now() * 0.001;

    for (const char of this._characters) {
      char.update(deltaTime, this._characters);
    }

    // Animate wave rings
    for (const [char, ring] of this._waveRings) {
      ring.material.uniforms.uTime.value = t;
      const dist = this._aiChar.position.distanceTo(char.position);
      const resonance = 1 - Math.abs(this._aiChar.trait.frequency - char.trait.frequency) / FREQ_RANGE;
      // Rings pulse more intensely when resonating
      const amp = char === this._aiChar ? 0.18 : 0.08 + resonance * 0.22;
      ring.material.uniforms.uAmplitude.value = amp;
      ring.material.uniforms.uOpacity.value = 0.4 + resonance * 0.55;
      ring.scale.setScalar(1 + (1 - dist / 40) * 0.2);

      // Update audio
      if (this._audioEnabled) {
        const idx = this._characters.indexOf(char);
        if (idx >= 0 && char !== this._aiChar) {
          this._audio.setVolumeByDistance(idx, dist);
        }
      }
    }

    // Animate merge rings (expanding)
    for (let i = this._mergeRings.length - 1; i >= 0; i--) {
      const m = this._mergeRings[i];
      m.life -= deltaTime;
      const progress = 1 - m.life / m.maxLife;
      m.ring.scale.setScalar(1 + progress * 8);
      m.ring.material.opacity = m.life / m.maxLife * 0.9;
      if (m.life <= 0) {
        this.threeScene.remove(m.ring);
        m.ring.geometry.dispose();
        m.ring.material.dispose();
        this._mergeRings.splice(i, 1);
      }
    }

    this._frameCount++;
    if (this._frameCount % 6 === 0) {
      this._dashboard?.updateMetrics(this._agent);
    }
  }

  getAgent() { return this._agent; }
  getAIChar() { return this._aiChar; }

  dispose() {
    for (const char of this._characters) char.dispose();
    this._mergeRings.forEach((m) => { m.ring.geometry.dispose(); m.ring.material.dispose(); });
    this._audio.deactivate();
    this.threeScene.clear();
    this._agent = null;
  }
}
