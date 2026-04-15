import * as THREE from 'three';

const _tmp = new THREE.Vector3();

/**
 * Converts scene snapshot → flat Float32Array observation for the DQN.
 * Works for all three patterns via trait-specific sub-encoders.
 */
export class StateEncoder {
  constructor(pattern = 'color', nearestK = 5) {
    this._pattern = pattern;
    this._nearestK = nearestK;
  }

  /**
   * Returns Float32Array of length (3 + K * 4 + 4):
   *   [ai.x/norm, ai.z/norm, ai.feelingLevel,
   *    npc0..K-1: dx, dz, dist_norm, trait_score,   ← (K-1) nearest by distance
   *    bestMatch: dx, dz, dist_norm, trait_score]    ← globally best-scored NPC
   *
   * The final "best match" slot acts as a compass — the DQN can always see
   * the direction and distance to its love target, no matter how far away it is.
   */
  encode(aiChar, allChars) {
    const NORM = 18; // arena half-size
    const npcs = allChars.filter((c) => c !== aiChar);

    // (K-1) nearest by distance
    const nearestK = this._sortByDistance(aiChar, npcs).slice(0, this._nearestK - 1);

    // 1 globally best-scored NPC (the "love compass")
    const bestMatch = this._findBestMatch(aiChar, npcs);

    const slots = [...nearestK, bestMatch].filter(Boolean);

    const obs = new Float32Array(3 + this._nearestK * 4);
    obs[0] = aiChar.position.x / NORM;
    obs[1] = aiChar.position.z / NORM;
    obs[2] = aiChar.feelingLevel;

    slots.forEach((npc, i) => {
      const base = 3 + i * 4;
      _tmp.subVectors(npc.position, aiChar.position);
      obs[base + 0] = _tmp.x / (NORM * 2);
      obs[base + 1] = _tmp.z / (NORM * 2);
      obs[base + 2] = _tmp.length() / (NORM * 2);
      obs[base + 3] = this._traitScore(aiChar, npc);
    });

    return obs;
  }

  get stateSize() {
    return 3 + this._nearestK * 4;
  }

  /** Returns the NPC with the highest trait score, regardless of distance. */
  _findBestMatch(ai, npcs) {
    let best = null, bestScore = -1;
    for (const npc of npcs) {
      const score = this._traitScore(ai, npc);
      if (score > bestScore) { bestScore = score; best = npc; }
    }
    return best;
  }

  _sortByDistance(ai, npcs) {
    return npcs.slice().sort((a, b) => {
      return a.position.distanceTo(ai.position) - b.position.distanceTo(ai.position);
    });
  }

  _traitScore(ai, npc) {
    switch (this._pattern) {
      case 'color':     return this._colorScore(ai.trait, npc.trait);
      case 'dna':       return this._dnaScore(ai.trait, npc.trait);
      case 'vibration': return this._vibrationScore(ai.trait, npc.trait);
      default:          return 0;
    }
  }

  // ── Pattern 1: Color ────────────────────────────────────────────────────────

  _colorScore(traitA, traitB) {
    // Returns 0..1 where 1 = perfectly complementary (180° apart on hue wheel)
    const delta = Math.abs(traitA.hue - traitB.hue);
    const hueDiff = Math.min(delta, 360 - delta); // 0..180
    return hueDiff / 180;
  }

  // ── Pattern 2: DNA ──────────────────────────────────────────────────────────

  _dnaScore(traitA, traitB) {
    if (!traitA.strand || !traitB.strand) return 0;
    let matches = 0;
    const len = Math.min(traitA.strand.length, traitB.strand.length);
    for (let i = 0; i < len; i++) {
      if (this._isComplement(traitA.strand[i], traitB.strand[i])) matches++;
    }
    return matches / len;
  }

  _isComplement(a, b) {
    return (a === 'A' && b === 'T') || (a === 'T' && b === 'A') ||
           (a === 'C' && b === 'G') || (a === 'G' && b === 'C');
  }

  // ── Pattern 3: Vibration ────────────────────────────────────────────────────

  _vibrationScore(traitA, traitB) {
    const FREQ_RANGE = 770; // 880 - 110
    return 1 - Math.abs(traitA.frequency - traitB.frequency) / FREQ_RANGE;
  }
}
