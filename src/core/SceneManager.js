export class SceneManager {
  constructor(renderer, dashboard) {
    this._renderer = renderer;
    this._dashboard = dashboard;
    this._scenes = {};
    this._current = null;
    this._currentKey = null;
  }

  register(key, SceneClass, ...args) {
    this._scenes[key] = { SceneClass, args, instance: null };
  }

  async switchTo(key) {
    if (key === this._currentKey) return;

    // Dispose current scene
    if (this._current) {
      this._current.dispose();
      this._current = null;
    }

    const entry = this._scenes[key];
    if (!entry) throw new Error(`Unknown scene key: ${key}`);

    // Lazily instantiate
    if (!entry.instance) {
      entry.instance = new entry.SceneClass(...entry.args);
    } else {
      // Re-init if already used once
      entry.instance = new entry.SceneClass(...entry.args);
    }

    this._current = entry.instance;
    this._currentKey = key;
    await this._current.init();

    this._renderer.setScene(this._current.threeScene);
    this._dashboard?.onSceneSwitch(key);
  }

  update(deltaTime, elapsedTime) {
    this._current?.update(deltaTime, elapsedTime);
  }

  get currentScene() {
    return this._current;
  }

  get currentKey() {
    return this._currentKey;
  }
}
