# Hex Battle

A minimal HoMM3-style hex battlefield. One stack walks around a 15×11 board with obstacles.

```
npm start      # serves on http://localhost:8000 (ES modules don't load from file://)
npm test       # logic tests, no browser needed
```

Click a shaded hex to move. **Wait** skips the turn.

## Architecture

```
src/hex.js          pure hex math (coords, neighbours, distance, pixel<->hex)
src/battlefield.js  static board: size, obstacles
src/pathfinding.js  BFS: reachable area + path reconstruction
src/game.js         rules & state; commands return events
src/view.js         canvas drawing + event playback (animation)
src/main.js         DOM wiring, input, game loop
```

Dependencies only point downward: `main → view → game → pathfinding → battlefield → hex`.
Nothing below `view.js` touches the DOM, so all of it runs in Node tests.

### Decisions and alternatives

**No framework, no build step.** Native ES modules + Canvas 2D.
*Alternatives:* Phaser or PixiJS give a scene graph, sprites and tweens for free,
but they hide the loop and the coordinate math, which is what we want to learn.
TypeScript + Vite is the first upgrade to consider once the code grows.

**Offset coords for storage, axial for math.** The board is a rectangle, so
`(col,row)` with odd rows shifted right ("odd-r") indexes it naturally. Neighbours and distance
are computed by converting to axial `(q,r)`, where they are the same everywhere
instead of depending on row parity. See redblobgames.com/grids/hexagons.

**String keys (`"3,5"`).** JS `Map`/`Set` compare objects by identity, so hexes
are keyed by string. An alternative is an integer index `row*COLS+col`, which is faster
but less readable.

**BFS, not A\*.** Uniform step cost, and we need the whole reachable area for
the shading anyway. One BFS gives the range *and* every path via `prev` pointers.
Terrain costs would mean switching to Dijkstra.

**Logic resolves instantly; the view replays events.** `moveActiveUnit` sets
`unit.pos` immediately and returns `[{type:'move', path}, {type:'turnStart'}]`.
The view queues these and animates them, keeping its own `drawPos` per unit.
Input is ignored while the queue is non-empty.
*Alternative:* animate inside the game state (unit moves 1 hex per N frames).
That's simpler at first, but then AI, replays, networking and tests all have to deal with time.

**Derived data is recomputed, never stored.** The movement range is calculated
from state on demand (every frame while idle). With 165 hexes this is negligible and
it can never go stale. Cache it only if profiling says so.

**Full redraw every frame** via `requestAnimationFrame`. That's the standard
game-loop model. Dirty-rect tracking isn't worth it at this size.

**Mutable state.** Commands mutate `state` in place. Switching to
"return a new state" would enable undo/time-travel debugging, and is easy because
all mutation already goes through the command functions in `game.js`.

## Next steps (roughly HoMM3 order)

1. Second stack + speed-based turn order (structure already in `endTurn`)
2. Melee attack: hover an enemy and pick the adjacent hex from the cursor angle (HoMM3's 6-direction sword cursor)
3. Damage formula, stack counts dying, retaliation
4. Flyers (range = hex distance, ignore obstacles) and two-hex-wide units
5. Wait/Defend semantics, shooters, simple AI using the same command API
