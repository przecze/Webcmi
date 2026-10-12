// Game rules and state. Still no DOM, no canvas, no timing.
//
// KEY DECISION: commands resolve INSTANTLY and return a list of events.
//
//   moveActiveUnit(state, target)
//     -> unit.pos is already the target when this returns
//     -> returns [{ type: 'move', unitId, path }, { type: 'turnStart', ... }]
//
// The view then PLAYS BACK those events as animations. The alternative,
// moving the unit one hex per frame inside the game logic, ties rules to
// frame rate. That makes AI (it would have to wait for animations), replays,
// networking and unit tests all painful. HoMM3 itself works this way: the
// outcome is decided before the creature starts walking.

import { createBattlefield, isObstacle } from './battlefield.js';
import { reachable, pathTo } from './pathfinding.js';
import { key, sameHex } from './hex.js';

export function createGame() {
  const field = createBattlefield([
    // a few rocks in the middle, roughly like a random HoMM3 obstacle layout
    { col: 7, row: 3 }, { col: 7, row: 4 }, { col: 8, row: 4 },
    { col: 5, row: 7 }, { col: 6, row: 7 },
    { col: 10, row: 8 },
  ]);

  return {
    field,
    units: [
      // HoMM3 attacker stacks start in column 0, defenders in column 14.
      { id: 1, name: 'Pikemen', count: 20, speed: 4, side: 'left', pos: { col: 0, row: 5 } },
    ],
    activeUnitId: 1,
    round: 1,
  };
}

export const activeUnit = state => state.units.find(u => u.id === state.activeUnitId);

export const unitAt = (state, hex) => state.units.find(u => sameHex(u.pos, hex));

// What the active unit could do right now. Derived data, recomputed on demand,
// never stored, so it can never go stale.
export function movementRange(state) {
  const unit = activeUnit(state);
  const blocked = hex => isObstacle(state.field, hex) || !!unitAt(state, hex);
  return reachable(state.field, unit.pos, unit.speed, blocked);
}

export function canMoveTo(state, target) {
  const unit = activeUnit(state);
  return !sameHex(unit.pos, target) && movementRange(state).has(key(target));
}

// --- commands: (state, args) -> events --------------------------------------
// These mutate `state` for simplicity. Swapping to immutable updates
// (return a new state) is a later option if we want undo or time-travel debugging.

export function moveActiveUnit(state, target) {
  if (!canMoveTo(state, target)) return [];
  const unit = activeUnit(state);
  const path = pathTo(movementRange(state), target);
  unit.pos = target;
  return [{ type: 'move', unitId: unit.id, path }, ...endTurn(state)];
}

export function endTurn(state) {
  // Turn order: HoMM3 sorts all stacks by speed each round. With one unit,
  // every turn is a new round. The structure is here for when we add more.
  const order = [...state.units].sort((a, b) => b.speed - a.speed);
  const idx = order.findIndex(u => u.id === state.activeUnitId);
  const next = order[(idx + 1) % order.length];
  if (idx + 1 >= order.length) state.round++;
  state.activeUnitId = next.id;
  return [{ type: 'turnStart', unitId: next.id, round: state.round }];
}
