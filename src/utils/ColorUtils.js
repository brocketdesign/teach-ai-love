/**
 * Utility functions for the Color pattern.
 */

/** Generates a random HSL hue (0–360). */
export function randomHue() {
  return Math.random() * 360;
}

/** Given a hue, returns its complementary hue (180° offset). */
export function complementaryHue(hue) {
  return (hue + 180) % 360;
}

/**
 * Converts HSL (hue: 0-360, s: 0-1, l: 0-1) to a hex color integer.
 */
export function hslToHex(h, s = 0.85, l = 0.55) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color);
  };
  const r = f(0), g = f(8), b = f(4);
  return (r << 16) | (g << 8) | b;
}

/**
 * Returns 0..180 hue distance between two hues.
 */
export function hueDist(a, b) {
  const delta = Math.abs(a - b);
  return Math.min(delta, 360 - delta);
}

/**
 * Gaussian reward centered at target distance 180°.
 * Returns 0..1
 */
export function complementReward(hueA, hueB, sigma = 40) {
  const dist = hueDist(hueA, hueB);
  return Math.exp(-0.5 * ((dist - 180) / sigma) ** 2);
}
