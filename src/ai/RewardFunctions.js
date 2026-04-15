/**
 * Per-pattern reward functions.
 * Each function receives (aiChar, allChars) and returns a scalar reward.
 */

import { worldToCell, cellDist, isCornerCell } from '../utils/ZoneGrid.js';

const CONTACT_RADIUS = 3.2; // units; close enough to "touch"
const LOVE_RADIUS    = 1.8; // units; intimate proximity = love event

// Per-AI state for reward computation
const _prevDistToBest      = new WeakMap(); // last distance to best NPC
const _lastRewardCallTime  = new WeakMap(); // for dt normalization
const _loveEventCooldown   = new WeakMap(); // ai → Map<npc, lastFireTime>

const LOVE_EVENT_COOLDOWN_MS = 4000; // love event fires at most once per 4s per NPC

function getLoveCooldowns(ai) {
  if (!_loveEventCooldown.has(ai)) _loveEventCooldown.set(ai, new Map());
  return _loveEventCooldown.get(ai);
}

// ── Pattern 1: Color ─────────────────────────────────────────────────────────

export function colorReward(ai, allChars) {
  // dt normalization: makes continuous rewards frame-rate independent.
  // At 60fps dtScale≈1.0; at 30fps dtScale≈2.0 (same reward per second).
  const now      = performance.now();
  const prevTime = _lastRewardCallTime.has(ai) ? _lastRewardCallTime.get(ai) : now;
  const dt       = Math.min((now - prevTime) / 1000, 0.05); // clamp to 50ms
  const dtScale  = dt * 60;                                  // 1.0 at 60fps
  _lastRewardCallTime.set(ai, now);

  let totalReward = 0;
  let loveTriggered = false;
  const npcs = allChars.filter((c) => c !== ai);

  // ── 1. Find globally best-matched NPC (love compass) ─────────────────────
  let bestNPC = null, bestHueDiff = 0;
  for (const npc of npcs) {
    const delta = Math.abs(ai.trait.hue - npc.trait.hue);
    const diff  = Math.min(delta, 360 - delta);
    if (diff > bestHueDiff) { bestHueDiff = diff; bestNPC = npc; }
  }

  // ── 2. Chase reward: only earned by CLOSING the gap ──────────────────────
  // Per-displacement (not per-frame) so it's already rate-independent.
  // This is the primary positive signal — the AI must actively pursue.
  if (bestNPC) {
    const currentDist = ai.position.distanceTo(bestNPC.position);
    const prevDist    = _prevDistToBest.has(ai) ? _prevDistToBest.get(ai) : currentDist;
    _prevDistToBest.set(ai, currentDist);

    const gap       = prevDist - currentDist; // +: approaching, –: retreating
    const compScore = bestHueDiff / 180;

    if (gap > 0.01) {
      totalReward += 1.2 * gap * compScore; // reward the chase
    } else if (gap < -0.05) {
      totalReward += 0.5 * gap * compScore; // penalise retreat (gap is negative)
    }
    // gap ≈ 0 (stationary camper) → zero here
  }

  // ── 3. Contact rewards — frame-rate normalised ────────────────────────────
  // Multiply by dtScale so the reward is ~per-second regardless of fps.
  // Hard cap of 0.15 per frame ensures a single prolonged contact can never
  // produce the +1000 spikes that made camping dominate.
  const loveCooldowns = getLoveCooldowns(ai);
  for (const npc of npcs) {
    const dist = ai.position.distanceTo(npc.position);
    if (dist > CONTACT_RADIUS) continue;

    const proximity      = 1 - dist / CONTACT_RADIUS;
    const delta          = Math.abs(ai.trait.hue - npc.trait.hue);
    const hueDiff        = Math.min(delta, 360 - delta);
    const complementScore = hueDiff / 180;

    // Raw value 0..2.2 → normalised and capped → max ~9/sec at 60fps
    const rawContact  = (0.3 + 1.9 * complementScore * complementScore) * proximity;
    const contactReward = Math.min(0.15, rawContact * dtScale);
    totalReward += contactReward;

    npc.feelingLevel = Math.min(1, npc.feelingLevel + contactReward * 0.3);

    // ── Love event: one-shot per NPC with cooldown ─────────────────────────
    // Previously fired every frame → +300/sec spike. Now at most once per 4s.
    if (dist < LOVE_RADIUS && hueDiff > 165) {
      const lastFire = loveCooldowns.get(npc) ?? 0;
      if (now - lastFire >= LOVE_EVENT_COOLDOWN_MS) {
        totalReward += 5.0;
        loveTriggered = true;
        npc.loveLevel = 1.0;
        loveCooldowns.set(npc, now);
      }
    }
  }

  // ── 4. Restlessness penalty — normalised to per-second ────────────────────
  // ai._restlessnessPenalty: 0 (moving) → 1 (static camper)
  // Max ~18/sec > max contact ~9/sec → camping is always net-negative.
  if (ai._restlessnessPenalty > 0) {
    totalReward -= 0.3 * ai._restlessnessPenalty * dtScale;
  }

  return { reward: totalReward, loveTriggered };
}

// ── Pattern 2: DNA ────────────────────────────────────────────────────────────

export function dnaReward(ai, allChars) {
  let totalReward = 0;
  let loveTriggered = false;

  for (const npc of allChars) {
    if (npc === ai) continue;
    const dist = ai.position.distanceTo(npc.position);
    if (dist > CONTACT_RADIUS) continue;

    const proximity = 1 - dist / CONTACT_RADIUS;
    const score = complementarityScore(ai.trait.strand, npc.trait.strand);

    // Family: score >= 4/6 → strong positive
    // Perfect match: score = 6/6 → love
    let contactReward = 0.05 * proximity + 0.7 * score * proximity;
    if (score >= 4 / 6) contactReward += 0.3 * proximity; // family bonus
    totalReward += contactReward;

    npc.feelingLevel = Math.min(1, npc.feelingLevel + contactReward * 0.4);

    if (dist < LOVE_RADIUS && score === 1.0) {
      totalReward += 5.0;
      loveTriggered = true;
      npc.loveLevel = 1.0;
    }
  }

  totalReward -= 0.005;
  return { reward: totalReward, loveTriggered };
}

// ── Pattern 3: Vibration ──────────────────────────────────────────────────────

export function vibrationReward(ai, allChars) {
  let totalReward = 0;
  let loveTriggered = false;
  const FREQ_RANGE = 770;

  for (const npc of allChars) {
    if (npc === ai) continue;
    const dist = ai.position.distanceTo(npc.position);
    if (dist > CONTACT_RADIUS) continue;

    const proximity = 1 - dist / CONTACT_RADIUS;
    const resonance = 1 - Math.abs(ai.trait.frequency - npc.trait.frequency) / FREQ_RANGE;

    // Bad resonance < 0.2 → negative reward
    let contactReward;
    if (resonance < 0.2) {
      contactReward = -0.3 * proximity;
    } else {
      contactReward = 0.05 * proximity + 0.9 * resonance * proximity;
    }

    totalReward += contactReward;
    npc.feelingLevel = Math.min(1, npc.feelingLevel + Math.max(0, contactReward * 0.5));

    if (dist < LOVE_RADIUS && resonance > 0.92) {
      totalReward += 5.0;
      loveTriggered = true;
      npc.loveLevel = 1.0;
    }
  }

  totalReward -= 0.005;
  return { reward: totalReward, loveTriggered };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gaussian(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function complementarityScore(strandA, strandB) {
  if (!strandA || !strandB) return 0;
  let matches = 0;
  const len = Math.min(strandA.length, strandB.length);
  for (let i = 0; i < len; i++) {
    const a = strandA[i], b = strandB[i];
    if ((a === 'A' && b === 'T') || (a === 'T' && b === 'A') ||
        (a === 'C' && b === 'G') || (a === 'G' && b === 'C')) matches++;
  }
  return matches / len;
}
