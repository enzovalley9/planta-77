import { P } from "./util.mjs";
import { T } from "./strings.mjs";

export const GAP = 20, CORR = 40, TARGET = 1040, GX = 92, GY = 74;
export const SPECIAL = {
  server: { neon: "#39ff88" },
  ramen: { neon: "#ff3b5c" },
  bunker: { neon: "#c06bff" },
  cctv: { neon: "#fcee0a" },
  cryo: { neon: "#7fd8ff" },
};
export const MAX_DANCERS = 36, MAX_SEATS = 10, MAX_DESKS = 12;

function projectBox(p) {
  const n = Math.max(2, Math.min(MAX_DESKS, p.desk.length));
  const cols = n <= 2 ? 2 : n <= 6 ? 3 : n <= 12 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  return { kind: "project", key: p.key, project: p, n, cols, rows, gx: GX, gy: GY, w: Math.max(210, 40 + cols * GX + 20), d: Math.max(200, 50 + rows * GY + 40) };
}

export function layout(model) {
  const counts = model.counts ?? {};
  const projects = model.projects.map(projectBox);
  const cafe = Math.min(MAX_SEATS, Math.max(6, counts.cafe ?? 0));
  const dancers = Math.min(MAX_DANCERS, counts.lounge ?? 0);
  const floorRows = Math.max(4, Math.ceil(Math.max(dancers, 14) / 8));
  const special = {
    server: { kind: "server", key: "server", w: 170, d: 200 },
    ramen: { kind: "ramen", key: "ramen", w: Math.max(350, 62 + cafe * 48), d: 200, seats: cafe },
    bunker: { kind: "bunker", key: "bunker", w: 420, d: Math.max(200, 100 + floorRows * 24 + 16), floorRows },
    cctv: { kind: "cctv", key: "cctv", w: 160, d: 200 },
    cryo: { kind: "cryo", key: "cryo", w: 400, d: 200 },
  };
  for (const [k, v] of Object.entries(special)) Object.assign(v, SPECIAL[k], { name: T.rooms[k] });
  const rows = [];
  const queue = [...projects];
  const fill = (reserved) => {
    const row = [];
    let w = reserved ? reserved.w + GAP : 0;
    while (queue.length && (row.length === 0 || w + queue[0].w + GAP <= TARGET + 40)) { const r = queue.shift(); row.push(r); w += r.w + GAP }
    if (reserved) row.push(reserved);
    return row;
  };
  rows.push(fill(special.server));
  rows.push(fill(special.ramen));
  while (queue.length) rows.push(fill(null));
  rows.push([special.bunker, special.cctv, special.cryo]);
  const rooms = [];
  let y = 0, width = 0;
  for (const row of rows) {
    const d = Math.max(...row.map((r) => r.d));
    let x = 0;
    for (const r of row) {
      r.x = x; r.y = y; r.d = d;
      x += r.w + GAP;
      rooms.push(r);
    }
    width = Math.max(width, x - GAP);
    y += d + CORR;
  }
  const depth = y - CORR;
  const corridors = [];
  let cy = 0;
  for (let i = 0; i < rows.length - 1; i++) { cy += Math.max(...rows[i].map((r) => r.d)); corridors.push({ y: cy, d: CORR }); cy += CORR }
  for (const r of rooms) r.screen = roomScreen(r);
  return { rooms, rows, width, depth, corridors, special };
}

export function roomScreen(r) {
  const c = [P(r.x, r.y, 56), P(r.x + r.w, r.y, 56), P(r.x, r.y + r.d, 0), P(r.x + r.w, r.y + r.d, 0), P(r.x, r.y, 0), P(r.x + r.w, r.y + r.d, 16)];
  const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
export function floorPoly(r) {
  return [P(r.x, r.y, 0), P(r.x + r.w, r.y, 0), P(r.x + r.w, r.y + r.d, 0), P(r.x, r.y + r.d, 0)];
}
