// Everything visual: drawing, and playing back game events as animations.
//
// The view keeps its OWN notion of where each unit is drawn (`drawPos`),
// separate from the game's `unit.pos`. During a walk animation they differ;
// when the event queue is empty they agree again.

import { hexToPixel, hexCorners, key, SQRT3 } from './hex.js';
import { allHexes, isObstacle } from './battlefield.js';
import { activeUnit, movementRange, canMoveTo } from './game.js';
import { pathTo } from './pathfinding.js';

export const HEX_SIZE = 26;
const MARGIN = { x: 30, y: 40 };
const STEP_MS = 140; // time to walk one hex

export function boardPixelSize(field) {
  return {
    width: SQRT3 * HEX_SIZE * (field.cols + 0.5) + MARGIN.x * 2,
    height: HEX_SIZE * (2 + 1.5 * (field.rows - 1)) + MARGIN.y * 2,
  };
}

// Board origin = centre of hex (0,0) in canvas pixels.
const origin = { x: MARGIN.x + SQRT3 * HEX_SIZE / 2, y: MARGIN.y + HEX_SIZE };

export function hexCenter(hex) {
  const p = hexToPixel(hex, HEX_SIZE);
  return { x: p.x + origin.x, y: p.y + origin.y };
}

export function canvasToBoard(x, y) {
  return { x: x - origin.x, y: y - origin.y };
}

export function createView(state) {
  return {
    queue: [],        // pending events to animate
    current: null,    // { event, elapsed }
    drawPos: new Map(state.units.map(u => [u.id, hexCenter(u.pos)])),
    hover: null,      // hovered hex or null
  };
}

export const isBusy = view => view.current !== null || view.queue.length > 0;

export function enqueue(view, events) {
  view.queue.push(...events);
}

// --- animation playback ------------------------------------------------------

export function update(view, dt) {
  if (!view.current && view.queue.length) view.current = { event: view.queue.shift(), elapsed: 0 };
  const cur = view.current;
  if (!cur) return;
  cur.elapsed += dt;

  const ev = cur.event;
  if (ev.type === 'move') {
    // Walk the path hex by hex, linearly interpolating between centres.
    const segments = ev.path.length - 1;
    const t = Math.min(cur.elapsed / STEP_MS, segments);
    const i = Math.min(Math.floor(t), segments - 1);
    const a = hexCenter(ev.path[i]);
    const b = hexCenter(ev.path[i + 1]);
    const f = t - i;
    view.drawPos.set(ev.unitId, { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    if (t >= segments) view.current = null;
  } else {
    view.current = null; // instantaneous events (turnStart) need no animation yet
  }
}

// --- drawing ------------------------------------------------------------------

function hexPath(ctx, hex, inset = 0) {
  const pts = hexCorners(hexCenter(hex), HEX_SIZE - inset);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

export function render(ctx, state, view) {
  const { width, height } = boardPixelSize(state.field);

  // background: grassy field
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#5d7a3a');
  g.addColorStop(1, '#3f5a26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  const busy = isBusy(view);
  const range = busy ? new Map() : movementRange(state);
  const unit = activeUnit(state);

  // 1. grid + movement shading (HoMM3 darkens hexes the active stack can reach)
  for (const hex of allHexes(state.field)) {
    hexPath(ctx, hex);
    if (range.has(key(hex))) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 2. obstacles
  for (const hex of allHexes(state.field)) {
    if (!isObstacle(state.field, hex)) continue;
    const c = hexCenter(hex);
    ctx.fillStyle = '#6b6259';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 4, HEX_SIZE * 0.75, HEX_SIZE * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a8076';
    ctx.beginPath();
    ctx.ellipse(c.x - 3, c.y, HEX_SIZE * 0.5, HEX_SIZE * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. hover highlight + path preview
  if (!busy && view.hover) {
    const ok = canMoveTo(state, view.hover);
    if (ok) {
      const path = pathTo(range, view.hover);
      ctx.fillStyle = 'rgba(255,240,150,0.9)';
      for (const h of path.slice(1)) {
        const c = hexCenter(h);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    hexPath(ctx, view.hover, 1.5);
    ctx.strokeStyle = ok ? '#ffe680' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 4. active unit's hex outline (HoMM3's pulsing yellow border)
  if (!busy) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
    hexPath(ctx, unit.pos, 1.5);
    ctx.strokeStyle = `rgba(255,215,0,${pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 5. units (sorted by y so lower units overlap higher ones)
  const sorted = [...state.units].sort((a, b) => view.drawPos.get(a.id).y - view.drawPos.get(b.id).y);
  for (const u of sorted) drawUnit(ctx, u, view.drawPos.get(u.id));
}

function drawUnit(ctx, u, p) {
  // placeholder figure: shadow, body, head, spear
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 12, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d8c8a0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + 10, p.y + 12);
  ctx.lineTo(p.x + 10, p.y - 30);
  ctx.stroke();

  ctx.fillStyle = u.side === 'left' ? '#2f5fbf' : '#bf2f2f';
  ctx.fillRect(p.x - 8, p.y - 14, 16, 24);
  ctx.fillStyle = '#e8c39e';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 19, 6, 0, Math.PI * 2);
  ctx.fill();

  // stack count box, bottom-right like HoMM3
  const label = String(u.count);
  ctx.font = 'bold 11px sans-serif';
  const w = ctx.measureText(label).width + 8;
  ctx.fillStyle = '#5b2f8f';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.fillRect(p.x + 6, p.y + 6, w, 14);
  ctx.strokeRect(p.x + 6, p.y + 6, w, 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, p.x + 10, p.y + 17);
}
