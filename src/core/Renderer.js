import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this._autoFollow = false;
    this._followTarget = null;
    this._cameraOffset = new THREE.Vector3(0, 12, 18);
    this._smoothPos = new THREE.Vector3();

    this._initRenderer();
    this._initCamera();
    this._initOrbit();
    this._initComposer();
    this._handleResize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.position.set(0, 20, 30);
    this.camera.lookAt(0, 0, 0);
  }

  _initOrbit() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(0, 0, 0);
  }

  _initComposer() {
    this.scene = new THREE.Scene(); // placeholder; swapped per-scene
    this.composer = new EffectComposer(this.renderer);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,   // strength
      0.4,   // radius
      0.1    // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  _handleResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
      this.bloomPass.resolution.set(w, h);
    });
  }

  setScene(threeScene) {
    this.scene = threeScene;
    this.renderPass.scene = threeScene;
  }

  setBloom(strength, radius, threshold) {
    this.bloomPass.strength = strength;
    this.bloomPass.radius = radius;
    this.bloomPass.threshold = threshold;
  }

  setAutoFollow(enabled, target = null) {
    this._autoFollow = enabled;
    this._followTarget = target;
    this.controls.enabled = !enabled;
  }

  render(deltaTime) {
    if (this._autoFollow && this._followTarget) {
      const targetPos = this._followTarget.mesh.position
        .clone()
        .add(this._cameraOffset);
      this._smoothPos.lerp(targetPos, 0.05);
      this.camera.position.copy(this._smoothPos);
      this.camera.lookAt(this._followTarget.mesh.position);
    } else {
      this.controls.update();
    }
    this.composer.render(deltaTime);
  }

  get domElement() {
    return this.renderer.domElement;
  }
}
