/**
 * Shared zone/grid utilities used by reward functions and scene visuals.
 *
 * The arena (ARENA_HALF = 18, so 36×36 units) is divided into a GRID_SIZE×GRID_SIZE
 * grid of equal cells. Each cell is (ARENA_HALF*2 / GRID_SIZE) units wide/deep.
 *
 * Cell coordinates: { cx: 0..GRID_SIZE-1, cz: 0..GRID_SIZE-1 }
 *   cx=0 is the -X edge, cz=0 is the -Z edge.
 */

import { ARENA_HALF } from '../entities/Character.js';

export const GRID_SIZE  = 6;                                    // 6×6 = 36 cells
export const CELL_SIZE  = (ARENA_HALF * 2) / GRID_SIZE;        // 6 units per cell

/** Convert a world-space THREE.Vector3 to a grid cell {cx, cz}. */
export function worldToCell(pos) {
  const cx = Math.floor((pos.x + ARENA_HALF) / CELL_SIZE);
  const cz = Math.floor((pos.z + ARENA_HALF) / CELL_SIZE);
  return {
    cx: Math.max(0, Math.min(GRID_SIZE - 1, cx)),
    cz: Math.max(0, Math.min(GRID_SIZE - 1, cz)),
  };
}

/** Chebyshev (chess-king) distance between two cells. */
export function cellDist(a, b) {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cz - b.cz));
}

/** True if a cell is on the edge of the grid (border ring). */
export function isBorderCell({ cx, cz }) {
  return cx === 0 || cz === 0 || cx === GRID_SIZE - 1 || cz === GRID_SIZE - 1;
}

/** True if a cell is a corner cell (both axes are at the edge). */
export function isCornerCell({ cx, cz }) {
  const edgeX = cx === 0 || cx === GRID_SIZE - 1;
  const edgeZ = cz === 0 || cz === GRID_SIZE - 1;
  return edgeX && edgeZ;
}

/** World-space center of a grid cell. */
export function cellCenter(cx, cz) {
  return {
    x: -ARENA_HALF + cx * CELL_SIZE + CELL_SIZE / 2,
    z: -ARENA_HALF + cz * CELL_SIZE + CELL_SIZE / 2,
  };
}
