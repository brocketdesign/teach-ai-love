import * as THREE from 'three';
import { AICharacter } from '../entities/AICharacter.js';
import { NPCCharacter } from '../entities/NPCCharacter.js';
import { DQNAgent } from '../ai/DQNAgent.js';
import { dnaReward } from '../ai/RewardFunctions.js';
import {
  randomStrand, complementStrand, complementarityScore, isPerfectMatch, strandToHue
} from '../utils/DNAUtils.js';
import { hslToHex } from '../utils/ColorUtils.js';
import { ARENA_HALF } from '../entities/Character.js';

const NPC_COUNT = 19;

// Base colors for DNA visualization
const BASE_COLORS = { A: 0x44ff88, T: 0xff4466, C: 0x4488ff, G: 0xffcc00 };

export class DNAScene {
  constructor(dashboard, guiConfig) {
    this._dashboard = dashboard;
    this._guiConfig = guiConfig;
    this.threeScene = new THREE.Scene();
    this._characters = [];
    this._aiChar = null;
    this._agent = null;
    this._labels = new Map();          // char → label group
    this._bonds = new Map();           // npc → bond mesh
    this._helixObjects = [];
    this._particles = [];
    this._episodeTimer = 0;
    this._episodeDuration = 30;
    this._frameCount = 0;
  }

  async init() {
    this._buildEnvironment();
    this._spawnCharacters();
    this._initAgent();
  }

  _buildEnvironment() {
    const scene = this.threeScene;
    scene.background = new THREE.Color(0x020a05);
    scene.fog = new THREE.FogExp2(0x020a05, 0.016);

    // Dark green floor
    const floorGeo = new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x040f08, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid lines
    const grid = new THREE.GridHelper(ARENA_HALF * 2, 24, 0x0a2a0a, 0x0a2a0a);
    scene.add(grid);

    // Arena border
    const h = ARENA_HALF;
    const pts = [
      new THREE.Vector3(-h, 0, -h), new THREE.Vector3( h, 0, -h),
      new THREE.Vector3( h, 0,  h), new THREE.Vector3(-h, 0,  h),
      new THREE.Vector3(-h, 0, -h)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x00ff44 })));

    scene.add(new THREE.AmbientLight(0x102010, 2.0));
    const sun = new THREE.DirectionalLight(0xaaffcc, 2.2);
    sun.position.set(8, 18, 8);
    sun.castShadow = true;
    scene.add(sun);

    this._buildStarField();
  }

  _buildStarField() {
    const count = 600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = Math.random() * 60 + 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.threeScene.add(new THREE.Points(geo,
      new THREE.PointsMaterial({ color: 0xaaffcc, size: 0.12 })));
  }

  _spawnCharacters() {
    const aiStrand = randomStrand();
    const aiHue    = strandToHue(aiStrand);
    const aiColor  = hslToHex(aiHue, 0.9, 0.55);

    this._aiChar = new AICharacter({ color: aiColor, trait: { strand: aiStrand } });
    this._placeRandomly(this._aiChar);
    this.threeScene.add(this._aiChar.group);
    this._buildLabel(this._aiChar, aiStrand, true);
    this._characters.push(this._aiChar);

    // Perfect-match NPC
    const loveStrand = complementStrand(aiStrand);
    const loveHue    = strandToHue(loveStrand);
    const loveNPC    = new NPCCharacter({ color: hslToHex(loveHue, 0.9, 0.6), trait: { strand: loveStrand } });
    this._placeRandomly(loveNPC);
    this.threeScene.add(loveNPC.group);
    this._buildLabel(loveNPC, loveStrand, false);
    this._characters.push(loveNPC);

    for (let i = 0; i < NPC_COUNT - 1; i++) {
      const strand = randomStrand();
      const hue    = strandToHue(strand);
      const npc    = new NPCCharacter({ color: hslToHex(hue, 0.8, 0.55), trait: { strand } });
      this._placeRandomly(npc);
      this.threeScene.add(npc.group);
      this._buildLabel(npc, strand, false);
      this._characters.push(npc);
    }
  }

  _placeRandomly(char) {
    const margin = 2;
    char.position.set(
      (Math.random() - 0.5) * (ARENA_HALF - margin) * 2,
      0,
      (Math.random() - 0.5) * (ARENA_HALF - margin) * 2
    );
  }

  _buildLabel(char, strand, isAI) {
    const group = new THREE.Group();

    strand.forEach((base, i) => {
      const color = BASE_COLORS[base] ?? 0xffffff;
      // Simple box for each base letter (no font needed)
      const boxGeo = new THREE.BoxGeometry(0.28, 0.28, 0.08);
      const boxMat = new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.2,
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set((i - 2.5) * 0.32, 0, 0);
      group.add(box);
    });

    if (isAI) {
      // Crown marker
      const crownGeo = new THREE.ConeGeometry(0.18, 0.35, 6);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 1.0 });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set(0, 0.4, 0);
      group.add(crown);
    }

    group.position.set(0, 3.2, 0);
    char.group.add(group);
    this._labels.set(char, group);
  }

  _initAgent() {
    this._agent = new DQNAgent({ pattern: 'dna' });
    this._aiChar.agent = this._agent;
    this._aiChar.rewardFn = (ai, all) => {
      const { reward, loveTriggered } = dnaReward(ai, all);
      this._agent.episodeReward += reward;
      if (loveTriggered) {
        this._agent.onLoveBond();
        this._spawnHelixBond(ai, all);
      }
      return reward;
    };
    this._agent.onMetricsUpdate = () => this._dashboard?.updateMetrics(this._agent);
    this._dashboard?.setAgent(this._agent);
  }

  _spawnHelixBond(ai, allChars) {
    // Find closest perfect-match NPC
    let closest = null, minDist = Infinity;
    for (const npc of allChars) {
      if (npc === ai || !isPerfectMatch(ai.trait.strand, npc.trait.strand)) continue;
      const d = ai.position.distanceTo(npc.position);
      if (d < minDist) { minDist = d; closest = npc; }
    }
    if (!closest) return;

    // Build a small double-helix tube between them
    const points1 = [], points2 = [];
    const steps = 40;
    const p0 = ai.position.clone().setY(1.5);
    const p1 = closest.position.clone().setY(1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const base = p0.clone().lerp(p1, t);
      const angle = t * Math.PI * 4;
      const radius = 0.3;
      points1.push(base.clone().add(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.5, 0)));
      points2.push(base.clone().add(new THREE.Vector3(-Math.cos(angle) * radius, -Math.sin(angle) * radius * 0.5, 0)));
    }

    const makeHelix = (pts, color) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, steps, 0.04, 6, false);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 2.0 });
      const mesh = new THREE.Mesh(geo, mat);
      this.threeScene.add(mesh);
      this._helixObjects.push({ mesh, life: 4.0 });
    };

    makeHelix(points1, 0x44ff88);
    makeHelix(points2, 0xff4466);
  }

  update(deltaTime, _elapsedTime) {
    this._episodeTimer += deltaTime;
    if (this._episodeTimer >= this._episodeDuration) {
      this._agent.endEpisode();
      this._episodeTimer = 0;
    }

    for (const char of this._characters) {
      char.update(deltaTime, this._characters);
    }

    // Animate labels (gentle float)
    const t = performance.now() * 0.001;
    for (const [, label] of this._labels) {
      label.position.y = 3.2 + 0.12 * Math.sin(t * 1.5);
      label.rotation.y = t * 0.4;
    }

    // Decay helix bonds
    for (let i = this._helixObjects.length - 1; i >= 0; i--) {
      const h = this._helixObjects[i];
      h.life -= deltaTime;
      h.mesh.material.opacity = h.life / 4.0;
      h.mesh.material.transparent = true;
      if (h.life <= 0) {
        this.threeScene.remove(h.mesh);
        h.mesh.geometry.dispose();
        h.mesh.material.dispose();
        this._helixObjects.splice(i, 1);
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
    this._bonds.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
    this._helixObjects.forEach((h) => { h.mesh.geometry.dispose(); h.mesh.material.dispose(); });
    this.threeScene.clear();
    this._agent = null;
  }
}
