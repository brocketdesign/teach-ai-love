import * as Tone from 'tone';

const FREQ_MIN = 110;
const FREQ_MAX = 880;

export class AudioEngine {
  constructor() {
    this._synths = new Map();     // character id → Synth
    this._aiSynth = null;
    this._active = false;
    this._masterGain = null;
    this._activated = false;
  }

  /**
   * Must be called from a user gesture (click/touch) to unlock Web Audio.
   */
  async activate() {
    if (this._activated) return;
    await Tone.start();
    this._masterGain = new Tone.Gain(0.15).toDestination();
    this._activated = true;
    this._active = true;
  }

  deactivate() {
    this._active = false;
    this._synths.forEach((synth) => {
      synth.triggerRelease();
      synth.dispose();
    });
    this._synths.clear();
    this._aiSynth?.triggerRelease();
    this._aiSynth?.dispose();
    this._aiSynth = null;
    this._masterGain?.dispose();
    this._masterGain = null;
    this._activated = false;
  }

  /**
   * Register a character for audio.
   * @param {string} id   unique identifier (char index)
   * @param {number} freq  oscillator frequency in Hz
   * @param {boolean} isAI
   */
  register(id, freq, isAI = false) {
    if (!this._activated) return;
    if (this._synths.has(id)) return;

    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 },
    }).connect(this._masterGain);

    synth.triggerAttack(freq);
    synth.volume.value = -40; // start silent; update via setVolume

    this._synths.set(id, synth);
    if (isAI) this._aiSynth = synth;
  }

  /**
   * Unregister and silence a character.
   */
  unregister(id) {
    const synth = this._synths.get(id);
    if (!synth) return;
    synth.triggerRelease();
    synth.dispose();
    this._synths.delete(id);
  }

  /**
   * Update volume of character based on distance to AI.
   * @param {string} id
   * @param {number} dist  distance in world units
   * @param {number} maxDist
   */
  setVolumeByDistance(id, dist, maxDist = 12) {
    const synth = this._synths.get(id);
    if (!synth) return;
    const normalized = Math.max(0, 1 - dist / maxDist);
    // -40dB (silent) to -10dB (close)
    synth.volume.value = -40 + normalized * 30;
  }

  /**
   * AI always plays at a baseline volume.
   */
  setAIVolume(vol = -18) {
    if (this._aiSynth) this._aiSynth.volume.value = vol;
  }

  get isActive() {
    return this._active && this._activated;
  }
}
