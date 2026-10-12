// Movement range + path reconstruction.
//
// Why BFS and not A*?
//  - Every step costs exactly 1 (HoMM3 has no terrain cost inside a battle),
//    so BFS already gives shortest paths.
//  - We need the WHOLE reachable area anyway (to shade it on screen),
//    not a single path to a single goal. A* is for "one goal, big map".
//  - One BFS gives us both: the set of reachable hexes AND a `prev` pointer
//    per hex, so the path to any hovered hex is free to reconstruct.
//
// If you later add terrain costs (quicksand, moats), switch to Dijkstra:
// same shape, just a priority queue instead of a plain queue.

import { key, neighbors } from './hex.js';
import { inBounds } from './battlefield.js';

/**
 * @param field       battlefield
 * @param start       {col,row}
 * @param maxSteps    unit speed
 * @param isBlocked   (hex) => boolean   — obstacles, other units, etc.
 * @returns Map<key, { hex, dist, prev: key|null }>
 */
export function reachable(field, start, maxSteps, isBlocked) {
  const result = new Map([[key(start), { hex: start, dist: 0, prev: null }]]);
  const queue = [start];

  while (queue.length) {
    const cur = queue.shift();
    const curDist = result.get(key(cur)).dist;
    if (curDist === maxSteps) continue;

    for (const n of neighbors(cur)) {
      const k = key(n);
      if (result.has(k) || !inBounds(field, n) || isBlocked(n)) continue;
      result.set(k, { hex: n, dist: curDist + 1, prev: key(cur) });
      queue.push(n);
    }
  }
  return result;
}

/** Walk the `prev` pointers back from target to start. Returns [start, ..., target]. */
export function pathTo(reach, target) {
  const path = [];
  let node = reach.get(key(target));
  while (node) {
    path.push(node.hex);
    node = node.prev ? reach.get(node.prev) : null;
  }
  return path.reverse();
}
