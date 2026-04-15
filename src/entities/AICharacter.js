import * as THREE from 'three';
import { Character } from './Character.js';

const ACTION_DIRS = [
  new THREE.Vector3( 0,  0,  0),  // 0: stay
  new THREE.Vector3( 1,  0,  0),  // 1: +X
  new THREE.Vector3(-1,  0,  0),  // 2: -X
  new THREE.Vector3( 0,  0,  1),  // 3: +Z
  new THREE.Vector3( 0,  0, -1),  // 4: -Z
  new THREE.Vector3( 1,  0,  1).normalize(),  // 5: +X+Z
  new THREE.Vector3(-1,  0,  1).normalize(),  // 6: -X+Z
  new THREE.Vector3( 1,  0, -1).normalize(),  // 7: +X-Z
  new THREE.Vector3(-1,  0, -1).normalize(),  // 8: -X-Z
];

export const MOVE_SPEED = 8;

export class AICharacter extends Character {
  constructor(options = {}) {
    super(options);
    this.agent = null;
    this.rewardFn = null;
    this._stepAccum = 0;
    this._trainEvery = 4;
    this._lastAction = 0;
    this._lastState = null;
    this._currentAction = 0;
    this._loveBondPartner = null;

    // Restlessness tracking — record position every N frames
    this._posHistory = [];          // ring buffer of recent positions
    this._posHistoryInterval = 8;   // frames between snapshots (~0.8 sec window)
    this._posHistoryMax = 6;        // keep last 6 snapshots (48 frames ≈ 0.8 sec)
    this._restlessnessPenalty = 0;  // exposed to reward function

    this._buildAIRing();
  }

  _buildAIRing() {
    const geo = new THREE.TorusGeometry(1.1, 0.04, 8, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
    });
    this._ring = new THREE.Mesh(geo, mat);
    this._ring.rotation.x = Math.PI / 2;
    this._ring.position.y = 0.15;
    this._group.add(this._ring);
  }

  update(deltaTime, allCharacters) {
    // Ring pulse animation
    const t = performance.now() * 0.001;
    const pulse = 0.8 + 0.4 * Math.sin(t * 3.0);
    this._ring.material.emissiveIntensity = pulse;
    this._ring.scale.setScalar(0.9 + 0.15 * Math.sin(t * 2.0));

    // Snapshot position periodically for restlessness detection
    this._stepAccum++;
    if (this._stepAccum % this._posHistoryInterval === 0) {
      this._posHistory.push(this._group.position.clone());
      if (this._posHistory.length > this._posHistoryMax) {
        this._posHistory.shift();
      }
      // Compute how much the AI has actually displaced over recent history
      if (this._posHistory.length >= 2) {
        const oldest = this._posHistory[0];
        const newest = this._posHistory[this._posHistory.length - 1];
        const totalDisplacement = oldest.distanceTo(newest);
        // Penalty grows when AI hasn't moved more than 4 units over ~0.8 seconds.
        // Lower threshold = quicker detection of camping; kicks in within 1 sec.
        this._restlessnessPenalty = totalDisplacement < 4.0
          ? (4.0 - totalDisplacement) / 4.0   // 0..1
          : 0;
      }
    }

    if (this.agent && this.rewardFn) {
      const state = this.agent.encodeState(this, allCharacters);

      if (this._lastState !== null) {
        const reward = this.rewardFn(this, allCharacters);
        const done = false;
        this.agent.remember(this._lastState, this._lastAction, reward, state, done);
        if (this._stepAccum % this._trainEvery === 0) {
          this.agent.trainStep();
        }
      }

      this._lastAction = this.agent.act(state);
      this._lastState = state;
      this._applyAction(this._lastAction);
    }

    this._applyPhysics(deltaTime);
  }

  _applyAction(actionIdx) {
    // If isolated (no one nearby) always move — never idle alone
    // If already in contact with NPCs, staying put is valid (enjoy the moment)
    let idx = actionIdx;
    if (idx === 0 && this.agent) {
      // Check if isolated — if so, force movement
      const hasNeighbor = this._lastState && this._lastState[2] < 0.1; // feeling is low = isolated
      if (hasNeighbor || this.agent.epsilon > 0.2) {
        idx = 1 + Math.floor(Math.random() * 8);
      }
    }

    const dir = ACTION_DIRS[idx];
    // Moderate impulse — deliberate movement, not frantic sprinting
    this.velocity.addScaledVector(dir, MOVE_SPEED * 0.35);
    if (this.velocity.length() > MOVE_SPEED) {
      this.velocity.setLength(MOVE_SPEED);
    }
  }

  setLoveBond(partner) {
    this._loveBondPartner = partner;
    this.loveLevel = 1.0;
  }

  clearLoveBond() {
    this._loveBondPartner = null;
    this.loveLevel = 0;
  }
}
