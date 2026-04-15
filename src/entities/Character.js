import * as THREE from 'three';

export const ARENA_HALF = 18; // half-size of movement arena

export class Character {
  constructor({ color = 0xffffff, trait = {}, radius = 0.55, height = 1.4 } = {}) {
    this.trait = trait; // pattern-specific data (hue, dnaStrand, frequency…)
    this.radius = radius;
    this.height = height;
    this.velocity = new THREE.Vector3();
    this.mesh = null;
    this.glowLight = null;
    this._baseColor = new THREE.Color(color);
    this._currentColor = new THREE.Color(color);
    this._bonds = [];           // active bond visual objects
    this._feelingLevel = 0;     // 0..1 general positivity
    this._loveLevel = 0;        // 0..1 love specifically
    this._group = new THREE.Group();
    this._buildMesh(color);
    this._buildGlow();
  }

  _buildMesh(color) {
    // Capsule: humanoid silhouette
    const geometry = new THREE.CapsuleGeometry(this.radius, this.height, 4, 8);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.5,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.position.y = this.radius + this.height / 2;
    this._group.add(this.mesh);
  }

  _buildGlow() {
    // Soft point light halo around each character
    this.glowLight = new THREE.PointLight(this._baseColor, 0.8, 4);
    this.glowLight.position.y = this.radius + this.height / 2;
    this._group.add(this.glowLight);
  }

  get group() { return this._group; }
  get position() { return this._group.position; }

  get feelingLevel() { return this._feelingLevel; }
  set feelingLevel(v) {
    this._feelingLevel = Math.max(0, Math.min(1, v));
    this._updateEmission();
  }

  get loveLevel() { return this._loveLevel; }
  set loveLevel(v) {
    this._loveLevel = Math.max(0, Math.min(1, v));
    this._updateEmission();
  }

  _updateEmission() {
    const combined = Math.min(1, this._feelingLevel * 0.5 + this._loveLevel);
    this.mesh.material.emissiveIntensity = 0.25 + combined * 1.8;
    this.glowLight.intensity = 0.5 + combined * 3.0;
  }

  setColor(color) {
    this._currentColor.set(color);
    this.mesh.material.color.set(color);
    this.mesh.material.emissive.set(color);
    this.glowLight.color.set(color);
  }

  // Called every frame; subclasses override to add AI/NPC behavior
  update(deltaTime, _allCharacters) {
    this._applyPhysics(deltaTime);
  }

  _applyPhysics(deltaTime) {
    this._group.position.addScaledVector(this.velocity, deltaTime);

    // Soft wall repulsion — narrow zone, sharp force right at the wall
    // Zone kept small so repulsion doesn't dominate the arena interior
    const lim = ARENA_HALF - this.radius;
    const WALL_ZONE  = 2.5;   // only last 2.5 units before the wall
    const WALL_FORCE = 55.0;  // sharp push when very close
    ['x', 'z'].forEach((axis) => {
      const pos = this._group.position[axis];
      const distToWall = lim - Math.abs(pos);
      if (distToWall < WALL_ZONE) {
        const t = 1 - distToWall / WALL_ZONE;
        const force = WALL_FORCE * t * t * t; // cubic — very gentle far, sharp close
        this.velocity[axis] -= Math.sign(pos) * force * deltaTime;
      }
      // Hard clamp as last resort
      if (Math.abs(pos) > lim) {
        this._group.position[axis] = Math.sign(pos) * lim;
        this.velocity[axis] *= -0.3;
      }
    });
    this._group.position.y = 0; // stay on ground plane

    // Friction
    this.velocity.multiplyScalar(0.88);
    // Face direction of movement
    if (this.velocity.lengthSq() > 0.001) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this._group.rotation.y = angle;
    }
    // Subtle idle bob
    const t = performance.now() * 0.001;
    this.mesh.position.y = this.radius + this.height / 2 + Math.sin(t * 2.1 + this._group.id) * 0.05;
  }

  dispose() {
    this._group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    this._bonds.forEach((b) => b.dispose?.());
    this._bonds = [];
  }
}
