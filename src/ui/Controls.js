import GUI from 'lil-gui';

export class Controls {
  constructor(renderer, sceneManager) {
    this._renderer = renderer;
    this._sceneManager = sceneManager;
    this._gui = null;
    this._agentFolder = null;
    this._params = {
      // Bloom
      bloomStrength:  1.2,
      bloomRadius:    0.4,
      bloomThreshold: 0.1,
      // Simulation
      simulationSpeed: 1.0,
      autoFollow:      false,
      // Training (populated per-agent)
      learningRate:    0.001,
      gamma:           0.95,
      epsilonDecay:    0.9995,
      batchSize:       64,
    };
    this._build();
  }

  _build() {
    this._gui = new GUI({ title: 'Controls', width: 240 });

    // Visual
    const visual = this._gui.addFolder('Visual');
    visual.add(this._params, 'bloomStrength', 0, 3, 0.05).name('Bloom Strength')
      .onChange((v) => this._renderer.setBloom(v, this._params.bloomRadius, this._params.bloomThreshold));
    visual.add(this._params, 'bloomRadius', 0, 1, 0.05).name('Bloom Radius')
      .onChange((v) => this._renderer.setBloom(this._params.bloomStrength, v, this._params.bloomThreshold));
    visual.add(this._params, 'bloomThreshold', 0, 1, 0.05).name('Bloom Threshold')
      .onChange((v) => this._renderer.setBloom(this._params.bloomStrength, this._params.bloomRadius, v));

    // Camera
    const camera = this._gui.addFolder('Camera');
    camera.add(this._params, 'autoFollow').name('Follow AI').onChange((v) => {
      const aiChar = this._sceneManager.currentScene?.getAIChar?.();
      this._renderer.setAutoFollow(v, aiChar ?? null);
    });

    // Training
    this._agentFolder = this._gui.addFolder('Training');
    this._agentFolder.add(this._params, 'learningRate', 0.0001, 0.01, 0.0001).name('Learning Rate')
      .onChange((v) => this._sceneManager.currentScene?.getAgent?.()?.setLearningRate(v));
    this._agentFolder.add(this._params, 'gamma', 0.8, 0.999, 0.001).name('Gamma (γ)');
    this._agentFolder.add(this._params, 'epsilonDecay', 0.999, 0.99999, 0.00001).name('ε Decay');

    this._gui.close(); // collapsed by default; user can expand
  }

  get gui() { return this._gui; }

  destroy() {
    this._gui?.destroy();
  }
}
