/**
 * Utilities for the DNA matching pattern.
 */

const BASES = ['A', 'T', 'C', 'G'];
const COMPLEMENTS = { A: 'T', T: 'A', C: 'G', G: 'C' };
const STRAND_LEN = 6;

/** Generate a random DNA strand of 6 bases. */
export function randomStrand() {
  return Array.from({ length: STRAND_LEN }, () => BASES[Math.floor(Math.random() * 4)]);
}

/** Returns the perfect complement of a strand. */
export function complementStrand(strand) {
  return strand.map((b) => COMPLEMENTS[b]);
}

/**
 * Counts how many positions pair correctly (A↔T, C↔G).
 * Returns 0..STRAND_LEN integer.
 */
export function complementarityCount(strandA, strandB) {
  let count = 0;
  for (let i = 0; i < STRAND_LEN; i++) {
    if (COMPLEMENTS[strandA[i]] === strandB[i]) count++;
  }
  return count;
}

/** Normalized 0..1 complementarity score. */
export function complementarityScore(strandA, strandB) {
  return complementarityCount(strandA, strandB) / STRAND_LEN;
}

/** True if score >= 4/6 (qualifies as "family"). */
export function isFamily(strandA, strandB) {
  return complementarityCount(strandA, strandB) >= 4;
}

/** True if score == 6/6 (perfect love match). */
export function isPerfectMatch(strandA, strandB) {
  return complementarityCount(strandA, strandB) === STRAND_LEN;
}

/** Returns a Color integer for a strand — maps base counts to hue. */
export function strandToHue(strand) {
  const aCount = strand.filter((b) => b === 'A').length;
  const tCount = strand.filter((b) => b === 'T').length;
  // hue derived from A/T ratio
  return ((aCount * 60 + tCount * 30) % 360);
}
