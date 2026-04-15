import * as THREE from 'three';
import { Character, ARENA_HALF } from './Character.js';

export class NPCCharacter extends Character {
  constructor(options = {}) {
    super(options);
    this._wanderTimer = Math.random() * 3;
    this._wanderDir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      0,
      (Math.random() - 0.5) * 2
    ).normalize();
    this._speed = 3.5 + Math.random() * 2.0; // a bit faster so they spread out
    this._reactionDecay = 0.02; // how fast feeling decays per frame
  }

  update(deltaTime, _allCharacters) {
    // Autonomous wander with direction changes
    this._wanderTimer -= deltaTime;
    if (this._wanderTimer <= 0) {
      this._wanderDir.set(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
      ).normalize();
      // Weak center-bias: prevents NPCs from pooling in corners
      // so the AI can't just pick a corner and wait for them to arrive.
      const toCenter = new THREE.Vector3(
        -this._group.position.x,
        0,
        -this._group.position.z
      ).normalize();
      this._wanderDir.addScaledVector(toCenter, 0.35).normalize();
      this._wanderTimer = 1.5 + Math.random() * 3.5;
    }

    this.velocity.addScaledVector(this._wanderDir, this._speed * 0.15);

    // Decay feeling over time
    this.feelingLevel = Math.max(0, this.feelingLevel - this._reactionDecay * deltaTime * 60);

    this._applyPhysics(deltaTime);
  }

  /** Called when AI brushes against this NPC */
  onContact(intensity = 0.3) {
    this.feelingLevel = Math.min(1, this.feelingLevel + intensity);
    // Visual pulse: brief scale spike
    this.mesh.scale.setScalar(1 + intensity * 0.3);
    setTimeout(() => this.mesh.scale.setScalar(1), 250);
  }
}
