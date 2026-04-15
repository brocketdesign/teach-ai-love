import * as tf from '@tensorflow/tfjs';
import { ReplayBuffer } from './ReplayBuffer.js';
import { StateEncoder } from './StateEncoder.js';

const NUM_ACTIONS = 9;
const STORAGE_KEY = 'teach-ai-love-model';

export class DQNAgent {
  constructor({
    pattern = 'color',
    nearestK = 5,
    learningRate = 0.001,
    gamma = 0.95,
    epsilonStart = 1.0,
    epsilonEnd = 0.05,
    epsilonDecay = 0.9995,
    batchSize = 64,
    bufferCapacity = 5000,
    targetUpdateFreq = 200,
  } = {}) {
    this.pattern = pattern;
    this.gamma = gamma;
    this.epsilon = epsilonStart;
    this.epsilonEnd = epsilonEnd;
    this.epsilonDecay = epsilonDecay;
    this.batchSize = batchSize;
    this.targetUpdateFreq = targetUpdateFreq;
    this._trainStepCount = 0;

    this.encoder = new StateEncoder(pattern, nearestK);
    this.buffer = new ReplayBuffer(bufferCapacity);

    const stateSize = this.encoder.stateSize;
    this.onlineNet  = this._buildNetwork(stateSize, learningRate);
    this.targetNet  = this._buildNetwork(stateSize, learningRate);
    this._syncTargetNetwork();

    // Metrics
    this.totalSteps = 0;
    this.episodeReward = 0;
    this.episodeCount = 0;
    this.loveBonds = 0;
    this.rewardHistory = [];      // rolling window

    // Observable callback for UI
    this.onMetricsUpdate = null;
  }

  _buildNetwork(inputSize, lr) {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [inputSize], units: 128, activation: 'relu',
      kernelInitializer: 'glorotUniform' }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dense({ units: NUM_ACTIONS, activation: 'linear' }));
    model.compile({
      optimizer: tf.train.adam(lr),
      loss: 'meanSquaredError',
    });
    return model;
  }

  _syncTargetNetwork() {
    const onlineWeights = this.onlineNet.getWeights();
    this.targetNet.setWeights(onlineWeights.map((w) => w.clone()));
  }

  // Encode state — delegate to StateEncoder
  encodeState(aiChar, allChars) {
    return this.encoder.encode(aiChar, allChars);
  }

  // ε-greedy action selection
  act(state) {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * NUM_ACTIONS);
    }
    return tf.tidy(() => {
      const stateTensor = tf.tensor2d([Array.from(state)]);
      const qValues = this.onlineNet.predict(stateTensor);
      return qValues.argMax(1).dataSync()[0];
    });
  }

  remember(state, action, reward, nextState, done) {
    this.buffer.push(state, action, reward, nextState, done);
    this.totalSteps++;
    this.episodeReward += reward;

    // Decay epsilon
    this.epsilon = Math.max(this.epsilonEnd, this.epsilon * this.epsilonDecay);
  }

  trainStep() {
    if (this.buffer.size < this.batchSize) return;

    const batch = this.buffer.sample(this.batchSize);

    tf.tidy(() => {
      const states     = tf.tensor2d(batch.map((e) => Array.from(e.state)));
      const nextStates = tf.tensor2d(batch.map((e) => Array.from(e.nextState)));
      const rewards    = tf.tensor1d(batch.map((e) => e.reward));
      const actions    = batch.map((e) => e.action);
      const dones      = tf.tensor1d(batch.map((e) => e.done ? 1 : 0));

      // Double DQN: online selects action, target evaluates Q
      const nextQOnline = this.onlineNet.predict(nextStates);
      const nextActions = nextQOnline.argMax(1);
      const nextQTarget = this.targetNet.predict(nextStates);

      // Gather Q-values for selected next actions
      const batchIndices = tf.range(0, this.batchSize, 1, 'int32');
      const indices2D    = tf.stack([batchIndices, nextActions], 1);
      const nextQSelected = tf.gatherND(nextQTarget, indices2D);

      const targetQ = rewards.add(
        tf.scalar(this.gamma).mul(nextQSelected).mul(tf.scalar(1).sub(dones))
      );

      // Current Q predictions
      const currentQ = this.onlineNet.predict(states);
      const currentQArray = currentQ.arraySync();

      // Update only the taken actions
      actions.forEach((a, i) => { currentQArray[i][a] = targetQ.arraySync()[i]; });

      const targetTensor = tf.tensor2d(currentQArray);
      this.onlineNet.trainOnBatch(states, targetTensor);
    });

    this._trainStepCount++;
    if (this._trainStepCount % this.targetUpdateFreq === 0) {
      this._syncTargetNetwork();
    }
  }

  onLoveBond() {
    this.loveBonds++;
    this.onMetricsUpdate?.();
  }

  endEpisode() {
    this.rewardHistory.push(this.episodeReward);
    if (this.rewardHistory.length > 300) this.rewardHistory.shift();
    this.episodeCount++;
    this.episodeReward = 0;
    this.onMetricsUpdate?.();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  async saveModel() {
    try {
      await this.onlineNet.save(`indexeddb://${STORAGE_KEY}-${this.pattern}`);
      // Also offer JSON download
      const saveResult = await this.onlineNet.save('downloads://teach-ai-love');
      return saveResult;
    } catch (e) {
      console.error('[DQNAgent] Save failed:', e);
    }
  }

  async loadModel() {
    try {
      const loaded = await tf.loadLayersModel(`indexeddb://${STORAGE_KEY}-${this.pattern}`);
      this.onlineNet = loaded;
      this._syncTargetNetwork();
      this.epsilon = this.epsilonEnd; // loaded model should exploit
      console.log('[DQNAgent] Model loaded from IndexedDB');
    } catch (e) {
      console.warn('[DQNAgent] No saved model found:', e.message);
    }
  }

  resetModel() {
    this.buffer.clear();
    this.epsilon = 1.0;
    this.totalSteps = 0;
    this.episodeReward = 0;
    this.episodeCount = 0;
    this.loveBonds = 0;
    this.rewardHistory = [];
    const stateSize = this.encoder.stateSize;
    this.onlineNet.dispose();
    this.targetNet.dispose();
    this.onlineNet = this._buildNetwork(stateSize, 0.001);
    this.targetNet = this._buildNetwork(stateSize, 0.001);
    this._syncTargetNetwork();
  }

  // Expose hyperparameters for lil-gui wiring
  get hyperparams() {
    return {
      get epsilon()      { return this.epsilon; },
      get trainSteps()   { return this._trainStepCount; },
    };
  }

  setLearningRate(lr) {
    // TF.js doesn't expose setLearningRate directly on compiled model;
    // rebuild optimizer on next compile
    this.onlineNet.compile({
      optimizer: tf.train.adam(lr),
      loss: 'meanSquaredError',
    });
  }
}
