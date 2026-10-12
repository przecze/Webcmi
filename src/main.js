// Wiring: the only file that touches the DOM. Owns the game loop.
//
//   input  ──>  game command  ──>  events  ──>  view queue  ──>  animation
//                (instant)                          (over time)
//
// Input is ignored while the view is still animating, which is the same
// "you can't click while the creature walks" behaviour as HoMM3.

import { createGame, moveActiveUnit, endTurn, activeUnit, canMoveTo } from './game.js';
import { createView, enqueue, update, render, isBusy, boardPixelSize, canvasToBoard, HEX_SIZE } from './view.js';
import { pixelToHex } from './hex.js';
import { inBounds } from './battlefield.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const state = createGame();
const view = createView(state);

// Crisp rendering on HiDPI screens: back the canvas with more real pixels,
// then scale the drawing so we can keep thinking in CSS pixels.
const { width, height } = boardPixelSize(state.field);
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
ctx.scale(dpr, dpr);

function eventToHex(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = width / rect.width; // handles the canvas being shrunk by CSS
  const b = canvasToBoard((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale);
  const hex = pixelToHex(b.x, b.y, HEX_SIZE);
  return inBounds(state.field, hex) ? hex : null;
}

canvas.addEventListener('mousemove', e => {
  view.hover = eventToHex(e);
  canvas.style.cursor = view.hover && !isBusy(view) && canMoveTo(state, view.hover) ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => (view.hover = null));

canvas.addEventListener('click', e => {
  if (isBusy(view)) return;
  const hex = eventToHex(e);
  if (hex) enqueue(view, moveActiveUnit(state, hex));
});

document.getElementById('wait').addEventListener('click', () => {
  if (!isBusy(view)) enqueue(view, endTurn(state));
});

// The loop: advance animations by real elapsed time, then redraw everything.
// Redrawing the whole board every frame is cheap at this size and removes
// a whole class of "stale pixels" bugs.
let last = performance.now();
function frame(now) {
  update(view, now - last);
  last = now;
  render(ctx, state, view);
  const u = activeUnit(state);
  status.textContent = `Round ${state.round} · ${u.name} (${u.count}) · speed ${u.speed}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
