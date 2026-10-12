import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance, neighbors, hexToPixel, pixelToHex, offsetToAxial, axialToOffset } from '../src/hex.js';
import { createGame, moveActiveUnit, canMoveTo, activeUnit } from '../src/game.js';
import { createBattlefield } from '../src/battlefield.js';
import { reachable, pathTo } from '../src/pathfinding.js';

test('offset <-> axial round-trips', () => {
  for (let row = 0; row < 11; row++)
    for (let col = 0; col < 15; col++)
      assert.deepEqual(axialToOffset(offsetToAxial({ col, row })), { col, row });
});

test('every neighbour is at distance 1, on even and odd rows', () => {
  for (const h of [{ col: 5, row: 4 }, { col: 5, row: 5 }]) {
    const ns = neighbors(h);
    assert.equal(ns.length, 6);
    for (const n of ns) assert.equal(distance(h, n), 1);
  }
});

test('pixel -> hex finds the hex whose centre we started from', () => {
  for (let row = 0; row < 11; row++)
    for (let col = 0; col < 15; col++) {
      const p = hexToPixel({ col, row }, 26);
      assert.deepEqual(pixelToHex(p.x + 5, p.y - 5, 26), { col, row });
    }
});

test('BFS walks around an obstacle', () => {
  // wall at col 1 on rows 0..2; going from (0,1) to (2,1) must detour
  const field = createBattlefield([{ col: 1, row: 0 }, { col: 1, row: 1 }, { col: 1, row: 2 }]);
  const reach = reachable(field, { col: 0, row: 1 }, 10, h => field.obstacles.has(`${h.col},${h.row}`));
  const path = pathTo(reach, { col: 2, row: 1 });
  assert.ok(path.length - 1 > distance({ col: 0, row: 1 }, { col: 2, row: 1 }));
});

test('move resolves instantly and emits a move event', () => {
  const s = createGame();
  const target = { col: 3, row: 5 };
  assert.ok(canMoveTo(s, target));
  const events = moveActiveUnit(s, target);
  assert.deepEqual(activeUnit(s).pos, target);
  assert.equal(events[0].type, 'move');
  assert.equal(events[0].path.length, 4);
});

test('cannot move further than speed', () => {
  const s = createGame();
  assert.equal(canMoveTo(s, { col: 10, row: 5 }), false);
  assert.deepEqual(moveActiveUnit(s, { col: 10, row: 5 }), []);
});
