// Pure hex-grid math. No DOM, no game state — just coordinates.
//
// Two coordinate systems are used on purpose:
//
//   OFFSET (col,row)  — how the board is STORED. HoMM3's battlefield is a
//                       rectangle (15 x 11), which maps naturally to a 2D array.
//                       We use "odd-r": pointy-top hexes, odd rows shoved
//                       right by half a hex.
//
//   AXIAL / CUBE (q,r[,s]) — how the board is REASONED about. Neighbours are
//                       the same 6 vectors everywhere, and distance is one line.
//                       In offset coords both depend on whether the row is
//                       odd or even, which is a classic source of bugs.
//
// Reference: https://www.redblobgames.com/grids/hexagons/ (read it, it's great)

export const SQRT3 = Math.sqrt(3);

// --- conversions -----------------------------------------------------------

export function offsetToAxial({ col, row }) {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

export function axialToOffset({ q, r }) {
  return { col: q + (r - (r & 1)) / 2, row: r };
}

// --- neighbours & distance (done in axial, exposed in offset) --------------

const AXIAL_DIRS = [
  { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 },
];

export function neighbors(hex) {
  const a = offsetToAxial(hex);
  return AXIAL_DIRS.map(d => axialToOffset({ q: a.q + d.q, r: a.r + d.r }));
}

export function distance(a, b) {
  const A = offsetToAxial(a);
  const B = offsetToAxial(b);
  const dq = A.q - B.q;
  const dr = A.r - B.r;
  // cube coords have s = -q - r, distance = max(|dq|,|dr|,|ds|)
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// --- hex <-> pixel ---------------------------------------------------------
// `size` = distance from the hex centre to a corner.
// Pointy-top: width = sqrt(3)*size, height = 2*size, rows are 1.5*size apart.

export function hexToPixel({ col, row }, size) {
  return {
    x: SQRT3 * size * (col + 0.5 * (row & 1)),
    y: 1.5 * size * row,
  };
}

export function pixelToHex(x, y, size) {
  // Invert the axial->pixel matrix to get FRACTIONAL axial coords...
  const q = (SQRT3 / 3 * x - y / 3) / size;
  const r = (2 / 3 * y) / size;
  // ...then snap to the nearest real hex.
  return axialToOffset(axialRound(q, r));
}

// Rounding each cube coord independently can produce an invalid hex
// (q+r+s != 0). Fix it by recomputing whichever coord rounded the worst.
function axialRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // `+ 0` turns -0 (from Math.round(-0.2)) into 0, so coords compare cleanly.
  return { q: rq + 0, r: rr + 0 };
}

// Corner points for drawing. Pointy-top means corner 0 points at -30°.
export function hexCorners(center, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30);
    pts.push({ x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) });
  }
  return pts;
}

// --- keys ------------------------------------------------------------------
// JS Maps/Sets compare objects by reference, so {col:1,row:2} !== {col:1,row:2}.
// We key everything by a string instead.

export const key = ({ col, row }) => `${col},${row}`;
export const sameHex = (a, b) => a.col === b.col && a.row === b.row;
