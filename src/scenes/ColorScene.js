import * as THREE from 'three';
import { AICharacter } from '../entities/AICharacter.js';
import { NPCCharacter } from '../entities/NPCCharacter.js';
import { DQNAgent } from '../ai/DQNAgent.js';
import { colorReward } from '../ai/RewardFunctions.js';
import { randomHue, hslToHex, complementaryHue, hueDist } from '../utils/ColorUtils.js';
import { ARENA_HALF } from '../entities/Character.js';
import { worldToCell, cellDist, GRID_SIZE, CELL_SIZE, cellCenter } from '../utils/ZoneGrid.js';

const NPC_COUNT = 19;
const LOVE_THRESHOLD_DIST = 1.8;
const LOVE_HUE_DIFF       = 165;

export class ColorScene {
  constructor(dashboard, guiConfig) {
    this._dashboard = dashboard;
    this._guiConfig = guiConfig;
    this.threeScene = new THREE.Scene();
    this._characters = [];
    this._aiChar = null;
    this._agent = null;
    this._bonds = new Map();          // npc → bond mesh
    this._particles = [];
    this._episodeTimer = 0;
    this._episodeDuration = 30;       // seconds per episode
    this._frameCount = 0;
    this._zoneCells = [];             // floor zone tile meshes
    this._zoneHighlight = null;       // current lit cell mesh
    this._aiZoneHighlight = null;     // cell under AI
  }

  async init() {
    this._buildEnvironment();
    this._spawnCharacters();
    this._initAgent();
  }

  _buildEnvironment() {
    const scene = this.threeScene;
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.018);

    // Floor plane (receives shadows)
    const floorGeo  = new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2);
    const floorMat  = new THREE.MeshStandardMaterial({ color: 0x080820, roughness: 0.9 });
    const floor     = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Zone grid — visible cells replace the generic GridHelper
    this._buildZoneGrid();

    // Arena border glow lines
    this._buildArenaBorder();

    // Ambient + directional lighting
    scene.add(new THREE.AmbientLight(0x101030, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(1024);
    scene.add(sun);

    // Star-field background particles
    this._buildStarField();
  }

  _buildZoneGrid() {
    // Create GRID_SIZE×GRID_SIZE clickable floor tiles
    // Default: very dark; love-target cell glows pink; AI cell glows white
    for (let cx = 0; cx < GRID_SIZE; cx++) {
      for (let cz = 0; cz < GRID_SIZE; cz++) {
        const c = cellCenter(cx, cz);
        const tileGeo = new THREE.PlaneGeometry(CELL_SIZE - 0.12, CELL_SIZE - 0.12);
        const tileMat = new THREE.MeshBasicMaterial({
          color: 0x0a0a22,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
        });
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(c.x, 0.01, c.z);
        tile.userData = { cx, cz };
        this.threeScene.add(tile);
        this._zoneCells.push(tile);
      }
    }

    // Draw cell border lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      const coord = -ARENA_HALF + i * CELL_SIZE;
      const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1a44, transparent: true, opacity: 0.6 });
      // Row line (along X)
      const rowGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-ARENA_HALF, 0.015, coord),
        new THREE.Vector3( ARENA_HALF, 0.015, coord),
      ]);
      this.threeScene.add(new THREE.Line(rowGeo, lineMat));
      // Col line (along Z)
      const colGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(coord, 0.015, -ARENA_HALF),
        new THREE.Vector3(coord, 0.015,  ARENA_HALF),
      ]);
      this.threeScene.add(new THREE.Line(colGeo, lineMat.clone()));
    }
  }

  _updateZoneHighlights() {
    if (!this._aiChar) return;

    // Find best NPC
    let bestNPC = null, bestHueDiff = 0;
    for (const npc of this._characters) {
      if (npc === this._aiChar) continue;
      const delta = Math.abs(this._aiChar.trait.hue - npc.trait.hue);
      const diff  = Math.min(delta, 360 - delta);
      if (diff > bestHueDiff) { bestHueDiff = diff; bestNPC = npc; }
    }

    const aiCell   = worldToCell(this._aiChar.position);
    const loveCell = bestNPC ? worldToCell(bestNPC.position) : null;

    const t = performance.now() * 0.001;
    for (const tile of this._zoneCells) {
      const { cx, cz } = tile.userData;
      const isLove = loveCell && cx === loveCell.cx && cz === loveCell.cz;
      const isAI   = cx === aiCell.cx && cz === aiCell.cz;
      const isBoth = isLove && isAI;

      if (isBoth) {
        // AI is in same cell as love target — bright magenta pulse
        tile.material.color.setHex(0xff44ff);
        tile.material.opacity = 0.28 + 0.14 * Math.sin(t * 6);
      } else if (isLove) {
        // Love target's cell — soft pink heartbeat
        tile.material.color.setHex(0xff2266);
        tile.material.opacity = 0.12 + 0.08 * Math.sin(t * 2.5);
      } else if (isAI) {
        // AI's current cell — cool white
        tile.material.color.setHex(0x8899ff);
        tile.material.opacity = 0.08 + 0.04 * Math.sin(t * 4);
      } else {
        // Check adjacency to love target for gradient hint
        if (loveCell) {
          const cd = cellDist({ cx, cz }, loveCell);
          if (cd === 1) {
            tile.material.color.setHex(0x551133);
            tile.material.opacity = 0.05;
          } else {
            tile.material.opacity = 0.0;
          }
        } else {
          tile.material.opacity = 0.0;
        }
      }
    }
  }

  _buildArenaBorder() {
    const h = ARENA_HALF;
    const points = [
      new THREE.Vector3(-h, 0.02, -h),
      new THREE.Vector3( h, 0.02, -h),
      new THREE.Vector3( h, 0.02,  h),
      new THREE.Vector3(-h, 0.02,  h),
      new THREE.Vector3(-h, 0.02, -h),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x2233ff, linewidth: 1.5 });
    this.threeScene.add(new THREE.Line(geo, mat));
  }

  _buildStarField() {
    const count = 800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 60 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, sizeAttenuation: true });
    this.threeScene.add(new THREE.Points(geo, mat));
  }

  _spawnCharacters() {
    const aiHue = randomHue();
    const aiColor = hslToHex(aiHue);
    this._aiChar = new AICharacter({
      color: aiColor,
      trait: { hue: aiHue },
    });
    this._placeRandomly(this._aiChar);
    this.threeScene.add(this._aiChar.group);
    this._characters.push(this._aiChar);

    // One NPC placed as the "love target" (complementary hue ±5°)
    const loveHue   = (complementaryHue(aiHue) + (Math.random() - 0.5) * 10 + 360) % 360;
    const loveNPC   = new NPCCharacter({ color: hslToHex(loveHue), trait: { hue: loveHue } });
    this._placeRandomly(loveNPC);
    this.threeScene.add(loveNPC.group);
    this._characters.push(loveNPC);

    for (let i = 0; i < NPC_COUNT - 1; i++) {
      const hue   = randomHue();
      const color = hslToHex(hue);
      const npc   = new NPCCharacter({ color, trait: { hue } });
      this._placeRandomly(npc);
      this.threeScene.add(npc.group);
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

  _initAgent() {
    this._agent = new DQNAgent({ pattern: 'color' });
    this._aiChar.agent = this._agent;
    this._aiChar.rewardFn = (ai, all) => {
      const { reward, loveTriggered } = colorReward(ai, all);
      this._agent.episodeReward += reward;
      if (loveTriggered) {
        this._agent.onLoveBond();
        this._spawnLoveBurst(ai.position.clone());
      }
      return reward;
    };

    this._agent.onMetricsUpdate = () => this._dashboard?.updateMetrics(this._agent);
    this._dashboard?.setAgent(this._agent);
  }

  update(deltaTime, elapsedTime) {
    this._episodeTimer += deltaTime;
    if (this._episodeTimer >= this._episodeDuration) {
      this._agent.endEpisode();
      this._episodeTimer = 0;
    }

    const all = this._characters;
    for (const char of all) {
      char.update(deltaTime, all);
    }

    this._updateBonds();
    this._updateParticles(deltaTime);
    this._updateZoneHighlights();
    this._frameCount++;

    // Update dashboard every 6 frames
    if (this._frameCount % 6 === 0) {
      this._dashboard?.updateMetrics(this._agent);
    }
  }

  _updateBonds() {
    const ai = this._aiChar;

    for (const npc of this._characters) {
      if (npc === ai) continue;

      const dist  = ai.position.distanceTo(npc.position);
      const delta = Math.abs(ai.trait.hue - npc.trait.hue);
      const diff  = Math.min(delta, 360 - delta);
      const isLove = dist < LOVE_THRESHOLD_DIST && diff > LOVE_HUE_DIFF;

      if (isLove) {
        this._ensureBond(ai, npc);
      } else {
        this._removeBond(npc);
      }
    }
  }

  _ensureBond(ai, npc) {
    if (this._bonds.has(npc)) {
      // Update existing bond tube
      this._updateBondGeometry(ai, npc, this._bonds.get(npc));
      return;
    }
    const bond = this._createBondMesh(ai, npc);
    this._bonds.set(npc, bond);
    this.threeScene.add(bond);
  }

  _createBondMesh(ai, npc) {
    const mid = ai.position.clone().lerp(npc.position, 0.5);
    mid.y += 1.0;
    const curve = new THREE.QuadraticBezierCurve3(
      ai.position.clone().setY(1.2),
      mid,
      npc.position.clone().setY(1.2)
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.06, 6, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xff88ff,
      emissive: 0xff44ff,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.85,
    });
    return new THREE.Mesh(tubeGeo, tubeMat);
  }

  _updateBondGeometry(ai, npc, bondMesh) {
    bondMesh.geometry.dispose();
    const mid = ai.position.clone().lerp(npc.position, 0.5);
    mid.y += 1.0;
    const curve = new THREE.QuadraticBezierCurve3(
      ai.position.clone().setY(1.2),
      mid,
      npc.position.clone().setY(1.2)
    );
    bondMesh.geometry = new THREE.TubeGeometry(curve, 12, 0.06, 6, false);
    // Pulse emissive
    const t = performance.now() * 0.002;
    bondMesh.material.emissiveIntensity = 2.0 + 1.5 * Math.sin(t * 4);
  }

  _removeBond(npc) {
    if (!this._bonds.has(npc)) return;
    const mesh = this._bonds.get(npc);
    this.threeScene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    this._bonds.delete(npc);
  }

  _spawnLoveBurst(position) {
    const count = 60;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = position.x;
      positions[i * 3 + 1] = position.y + 1.5;
      positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 6
      ));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff55ff, size: 0.25, sizeAttenuation: true });
    const points = new THREE.Points(geo, mat);
    this.threeScene.add(points);
    this._particles.push({ points, velocities, positions, life: 1.5 });
  }

  _updateParticles(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.threeScene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        this._particles.splice(i, 1);
        continue;
      }
      const pos = p.points.geometry.attributes.position;
      for (let j = 0; j < p.velocities.length; j++) {
        p.velocities[j].y -= 4 * dt; // gravity
        pos.array[j * 3 + 0] += p.velocities[j].x * dt;
        pos.array[j * 3 + 1] += p.velocities[j].y * dt;
        pos.array[j * 3 + 2] += p.velocities[j].z * dt;
      }
      pos.needsUpdate = true;
      p.points.material.opacity = p.life / 1.5;
      p.points.material.transparent = true;
    }
  }

  getAgent() { return this._agent; }
  getAIChar() { return this._aiChar; }

  dispose() {
    for (const char of this._characters) char.dispose();
    this._bonds.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this._bonds.clear();
    this._particles.forEach((p) => {
      p.points.geometry.dispose();
      p.points.material.dispose();
    });
    this._particles = [];
    this._zoneCells.forEach((t) => { t.geometry.dispose(); t.material.dispose(); });
    this._zoneCells = [];
    this.threeScene.clear();
    this._agent = null;
  }
}
