// The static board: size and terrain. Knows nothing about units or turns.

import { key } from './hex.js';

// HoMM3 battlefield: 15 columns x 11 rows of usable hexes.
export const COLS = 15;
export const ROWS = 11;

export function createBattlefield(obstacleHexes = []) {
  return {
    cols: COLS,
    rows: ROWS,
    obstacles: new Set(obstacleHexes.map(key)),
  };
}

export function inBounds(field, { col, row }) {
  return col >= 0 && col < field.cols && row >= 0 && row < field.rows;
}

export function isObstacle(field, hex) {
  return field.obstacles.has(key(hex));
}

export function* allHexes(field) {
  for (let row = 0; row < field.rows; row++)
    for (let col = 0; col < field.cols; col++)
      yield { col, row };
}
