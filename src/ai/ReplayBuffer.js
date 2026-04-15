/**
 * Circular experience replay buffer for DQN.
 * Stores (state, action, reward, nextState, done) tuples.
 */
export class ReplayBuffer {
  constructor(capacity = 5000) {
    this._capacity = capacity;
    this._buffer = [];
    this._index = 0;
  }

  get size() { return this._buffer.length; }

  push(state, action, reward, nextState, done) {
    const entry = { state, action, reward, nextState, done };
    if (this._buffer.length < this._capacity) {
      this._buffer.push(entry);
    } else {
      this._buffer[this._index] = entry;
    }
    this._index = (this._index + 1) % this._capacity;
  }

  sample(batchSize) {
    const n = Math.min(batchSize, this._buffer.length);
    const indices = [];
    while (indices.length < n) {
      const i = Math.floor(Math.random() * this._buffer.length);
      if (!indices.includes(i)) indices.push(i);
    }
    return indices.map((i) => this._buffer[i]);
  }

  clear() {
    this._buffer = [];
    this._index = 0;
  }
}
