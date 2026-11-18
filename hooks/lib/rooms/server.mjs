import { R, P, hash, lit, clip, esc } from "../util.mjs";
import { block, wallY, wallX, onY, onX, onFloor, halo, pool, fadeDown, blink, frames, stepMove } from "../kit.mjs";
import { bot } from "../chars.mjs";
import { use, cameraFx, wallScreen } from "../props.mjs";
import { shell, front, sign, target } from "./shell.mjs";
import { WH, WT, mark, obstacle } from "../ctx.mjs";
import { T } from "../strings.mjs";

const RW = 26, RD = 22, RH = 44, PITCH = 29, X0 = 46, ROWS = [30, 110], AISLE = ROWS[1] - ROWS[0], MAX = 8;
const UY = [7, 14, 21, 28, 35], PAD = [84, 186];
const COLD = "#4df0e0", AMBER = "#ff8a00", RED = "#ff3b5c";
const seg = (a, b) => `M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}`;
const rows = (x, len) => UY.map((y) => `M${R(x)} ${y}h${len}`).join("");

export function defs() {
  const rack = block(0, 0, 0, RW, RD, RH, "#0c121c", { top: "#2a3750", right: "#172032", edge: "#6c84ad", edgeO: 0.55 })
    + onY(0, RD, RH, `<path d="${rows(2.5, 21)}" stroke="#182438" stroke-width="5.4"/><path d="M2.5 41h21" stroke="#04070c" stroke-width="2.4" stroke-dasharray="1.2 1"/><rect x=".6" y=".6" width="24.8" height="42.8" fill="none" stroke="#2e3d5a" stroke-width=".7"/>`)
    + onX(RW, RD, RH, `<path d="M11 6v21" stroke="#0a0f18" stroke-width="13" stroke-dasharray=".9 2.3"/><path d="M3 34h16" stroke="#2a3852" stroke-width=".8"/>`);
  const on = `<rect x="2.5" y="1.4" width="21" height="2.2" class="cc"/><path d="${rows(3.4, 1.5)}" class="scc" stroke-width="1.6"/><path d="${rows(6.2, 1.2)}" stroke="#7fd8ff" stroke-width="1.3" opacity=".85"/><path d="${rows(9.5, 13)}" class="scc" stroke-width="1.6" opacity=".18"/>`;
  const off = `<rect x="2.5" y="1.4" width="21" height="2.2" fill="#33425e" opacity=".7"/><rect x="3.4" y="6.2" width="1.6" height="1.6" fill="${AMBER}" opacity=".75"/>`;
  const dial = `<path d="M-10 0A10 10 0 0 1 10 0" stroke="#14262a" stroke-width="3.4"/><path d="M-13 0A13 13 0 0 1 7.6 -10.5" stroke="#2f6a52" stroke-width=".9"/><path d="M7.6 -10.5A13 13 0 0 1 11.6 -5.9" stroke="${AMBER}" stroke-width=".9"/><path d="M11.6 -5.9A13 13 0 0 1 13 0" stroke="${RED}" stroke-width=".9"/>`;
  const row = [0, 1, 2, 3].map((k) => `<use href="#server-rack" x="${R(P(k * PITCH, 0, 0)[0])}" y="${R(P(k * PITCH, 0, 0)[1])}"/>`).join("");
  return `<g id="server-rack">${rack}</g><g id="server-row">${row}</g><g id="server-on">${on}</g><g id="server-off">${off}</g><g id="server-dial" fill="none">${dial}</g>`;
}

const ramText = (sys) => (sys?.ramUsed && sys.ramTotal ? `RAM ${sys.ramUsed.toFixed(1)}/${sys.ramTotal.toFixed(1)} GB` : "");
const tone = (p, c) => (p > 0.85 ? RED : p > 0.7 ? AMBER : c);
const heat = (t) => (t <= 70 ? t / 100 : t <= 80 ? 0.7 + (t - 70) * 0.015 : Math.min(1, 0.85 + (t - 80) * 0.0075));

function gauges(sys) {
  return [
    ["CPU", sys ? sys.cpu / 100 : null, sys ? `${Math.round(sys.cpu)}%` : ""],
    ["RAM", sys?.ramUsed && sys.ramTotal ? sys.ramUsed / sys.ramTotal : null, sys?.ramUsed && sys.ramTotal ? `${Math.round((sys.ramUsed / sys.ramTotal) * 100)}%` : ""],
    ["°C", sys?.temp ? heat(sys.temp) : null, sys?.temp ? `${Math.round(sys.temp)}` : ""],
  ];
}

function board(ctx, r, c, sys, n, cells, alarm) {
  const W = 124, H = 36, x = r.x + WT + 0.2, y = r.y + 176, zt = 51, full = ctx.lod >= 1;
  let inner = `<g fill="none" text-anchor="middle" class="cx" font-size="7.4">`;
  cells.forEach(([title, p, val], i) => {
    const cx = 22 + i * 40;
    inner += `<use href="#server-dial" x="${cx}" y="21"/>`;
    if (full) inner += `<text x="${cx - 19}" y="6.8" text-anchor="start" class="cs" font-size="4.8" fill="#8fb8a6">${title}</text>`;
    if (p == null) { inner += `<text x="${cx}" y="20.4" fill="#3d5a50">--</text>`; return }
    const q = Math.max(0.03, Math.min(1, p)), col = tone(p, c), d = `M${cx - 10} 21A10 10 0 0 1 ${R(cx - 10 * Math.cos(Math.PI * q))} ${R(21 - 10 * Math.sin(Math.PI * q))}`;
    inner += `${full ? `<path d="${d}" stroke="${col}" stroke-width="7" opacity=".22"/>` : ""}<path d="${d}" stroke="${col}" stroke-width="3.4"/><text x="${cx}" y="20.4" fill="${lit(col, 0.65)}">${val}</text>`;
  });
  inner += `</g><circle cx="118.4" cy="5.6" r="1.8" fill="${alarm}"/>`;
  if (full) {
    const left = sys ? ramText(sys) : T.scene.noSensors[0];
    const right = sys || ctx.model.docker ? T.scene.dockerUp(n) : T.scene.noSensors[1];
    inner += `<path d="M3 26.4h118" stroke="${c}" stroke-width=".5" opacity=".4"/><text x="4" y="32.8" class="mo" font-size="5" fill="${sys ? "#c8ffe2" : AMBER}">${esc(left)}</text><text x="120" y="32.8" text-anchor="end" class="mo" font-size="5" fill="${lit(c, 0.3)}">${esc(right)}</text>`;
  }
  obstacle(ctx, [P(x, y, zt), P(x, y - W, zt), P(x, y, zt - H), P(x, y - W, zt - H)]);
  return (full ? halo(P(x, y - W / 2, zt - H / 2), 78, 34, c, 0.28) : "") + wallScreen(x, y, zt, W, H, c, inner, { axis: "x", bg: "#03100c" });
}

function tray(x, y, len, along) {
  const w = along ? len : 8, h = along ? 8 : len, run = (o) => (along ? `M0 ${o}h${len}` : `M${o} 0v${len}`);
  return (along ? wallY(x, y + 8, RH - 1.6, RH + 0.4, len, "#1d2940") : wallX(x + 8, y, RH - 1.6, RH + 0.4, len, "#121a2b"))
    + onFloor(x, y, RH + 0.4, `<rect width="${w}" height="${h}" fill="#090e16"/><path d="${run(4)}" stroke="#34425f" stroke-width="8" stroke-dasharray=".8 4.2"/><path d="${run(2.5)}" stroke="${AMBER}"/><path d="${run(4)}" stroke="#22e4ff"/><path d="${run(5.5)}" stroke="#ff2bd6"/><path d="${run(0.4)}${run(7.6)}" stroke="#7d95bd"/>`, 'fill="none" stroke-width=".8"');
}

export function serverRoom(ctx, r) {
  const c = r.neon, lod = ctx.lod, all = ctx.model.docker?.list ?? [], list = all.slice(0, MAX), sys = ctx.model.system ?? null;
  const X = r.x + X0, len = 3 * PITCH + RW;
  const cells = gauges(sys), worst = Math.max(0, ...cells.map((g) => g[1] ?? 0)), alarm = tone(worst, c);
  let s = shell(ctx, r, c, true, { floor: "#0a111b", plainFloor: true, noWindows: true, pool: 0.2 })
    + sign(ctx, r, r.name, c, true, [all.length ? T.scene.dockerSign(all.length) : T.scene.noDocker], { maxSize: 12, avail: 104 });
  if (lod >= 1) {
    let g = "";
    for (let u = 26; u < r.w; u += 20) g += seg(P(r.x + u, r.y + WT, 0), P(r.x + u, r.y + r.d, 0));
    for (let v = 12; v < r.d; v += 20) g += seg(P(r.x + WT, r.y + v, 0), P(r.x + r.w, r.y + v, 0));
    s += `<path d="${g}" stroke="#1a2a3c" stroke-width=".7" fill="none"/>`;
  }
  const vents = ROWS.map((ry, k) => ({ y: r.y + ry + RD + 2, d: k ? 16 : 12 }));
  for (const v of vents) {
    s += onFloor(X - 2, v.y, 0.1, `<rect width="${len + 4}" height="${v.d}" fill="${fadeDown(COLD, 0.42, 0.1)}"/>${lod >= 1 ? `<path d="M0 ${v.d / 2}h${len + 4}" stroke="${lit(COLD, 0.3)}" stroke-width="${v.d - 3}" stroke-dasharray="1.2 2.8" opacity=".75"/>` : ""}`)
      + pool(X + len / 2, v.y + v.d / 2, 0, 78, 17, COLD, 0.5);
  }
  if (lod >= 2) {
    for (const [u, v] of [[106, 152], [146, 152], [26, 152]]) s += onFloor(r.x + u, r.y + v, 0.1, `<rect x="1" y="1" width="18" height="18" fill="${COLD}" opacity=".2"/><path d="M3 10h14" stroke="${lit(COLD, 0.3)}" stroke-width="12" stroke-dasharray="1 3" opacity=".6"/>`) + pool(r.x + u + 10, r.y + v + 10, 0, 22, 10, COLD, 0.4);
    s += onFloor(r.x + 104, r.y + 190, 0.1, `<text class="cx" font-size="10" letter-spacing="2" fill="${COLD}" opacity=".2">SRV//77</text>`);
  }
  if (lod >= 1) {
    const hp = P(r.x + PAD[0], r.y + PAD[1], 0), hx = R(hp[0]), hy = R(hp[1]);
    s += halo(hp, 27, 12.5, c, 0.6) + `<ellipse cx="${hx}" cy="${hy}" rx="13" ry="6.5" fill="#06120e" stroke="${c}"/><ellipse cx="${hx}" cy="${hy}" rx="8" ry="4" fill="none" stroke="${lit(c, 0.5)}" stroke-width=".7"/><path d="M${hx - 8} ${hy}l-6 -34h28l-6 34z" fill="${fadeDown(c, 0, 0.2)}"/>`
      + use("cam", P(r.x + 10, r.y + 10, WH - 6));
    ctx.F.push(cameraFx(r.x + 10, r.y + 10, WH - 6));
  }
  s += board(ctx, r, c, sys, all.length, cells, alarm);
  if (lod >= 2) {
    s += onY(r.x + 132, r.y + WT + 0.2, 50, `<rect width="30" height="22" rx="1.5" fill="#121a29" stroke="#3a4a68" stroke-width=".8"/><circle cx="10" cy="11" r="7.8" fill="#060a11" stroke="#31405c" stroke-width=".8"/><path d="M21 5h6M21 8.5h6M21 12h6" stroke="#31405c" stroke-width="1.3"/><circle cx="24" cy="17.2" r="1.3" fill="${COLD}"/>`);
    ctx.F.push(onY(r.x + 142, r.y + WT + 0.2, 39, `<g>${`<path d="M0 -6.4V6.4M-6.4 0H6.4" stroke="#5d74a0" stroke-width="2.2" stroke-linecap="round"/><circle r="1.6" fill="#8fa6d0"/>`}${stepMove(["0", "45"], { type: "rotate", ticks: 1 })}</g>`));
    s += block(r.x + WT, r.y + 112, 0, 9, 34, 10, "#162030", { top: "#2b3956", right: "#101826", edge: c, edgeO: 0.5 })
      + onFloor(r.x + WT + 1.5, r.y + 115, 10.1, `<rect width="6" height="13" fill="#0b3a2a"/><path d="M1 3h4M1 6h3M1 9h4" stroke="${c}" stroke-width=".8"/><path d="M1.2 18h3.6M1.2 22h3.6M1.2 26h3.6" stroke="${AMBER}" stroke-width="1.6" stroke-dasharray="1.2 1.2"/>`);
  }
  let lights = "";
  const live = [[], [], []], leds = ["", "", ""];
  for (let i = 0; i < MAX; i++) {
    const col = i >> 1, row = i & 1, q = list[i], rx = X + col * PITCH, ry = r.y + ROWS[row], lx = col * PITCH - row * AISLE, ly = row * AISLE;
    if (!q) { lights += `<use href="#server-off" x="${lx}" y="${ly}"/>`; continue }
    const hot = q.cpu > 85 ? RED : q.cpu > 50 ? AMBER : c;
    lights += `${lod >= 1 ? `<rect x="${lx + 1}" y="${ly + 1}" width="24" height="42" fill="${fadeDown(hot, 0.2, 0.03)}"/>` : ""}<use href="#server-on" x="${lx}" y="${ly}"${hot === c ? "" : ` style="--c:${hot}"`}/>`;
    live[q.cpu >= 5 ? 0 : q.cpu >= 1 ? 1 : 2].push({ lx, ly, name: q.name, a: Math.min(1, 0.15 + Math.sqrt(Math.max(0, q.cpu)) / 4.5) });
    for (const k of [0, 1]) leds[(i + k) % 3] += `M${R(lx + 6.2)} ${ly + UY[hash(q.name + k) % 5]}h1.2`;
    mark(ctx, { kind: "chip", a: P(rx + RW / 2, ry + RD / 2, RH), text: `${clip(q.name.replace(/-1$/, ""), 20)} ${q.cpu.toFixed(1)}%`, color: c, prio: 1, size: 6, cls: "mo", ls: 0, fill: "#c8ffe2", dy: -16, room: r.key, tier: 1, optional: true });
  }
  const fy = r.y + ROWS[0] + RD + 0.05;
  s += ROWS.map((ry) => use("server-row", P(X, r.y + ry, 0))).join("") + onY(X, fy, RH, lights, `style="--c:${c}"`);
  if (lod >= 1) for (const v of vents) s += onY(X - 2, v.y + 3, 24, `<rect width="${len + 4}" height="24" fill="${fadeDown(COLD, 0, 0.24)}"/>`);
  if (lod >= 1) {
    s += tray(r.x + WT, r.y + ROWS[0] + RD / 2 - 4, X + len - r.x - WT, true) + tray(X - 6, r.y + ROWS[1] + RD / 2 - 4, len + 6, true);
    if (lod >= 2) s += tray(X - 7, r.y + ROWS[0] + RD / 2 + 4, AISLE - 8, false);
    s += bot(P(r.x + 25, r.y + 128, 0), c);
  }
  s += front(ctx, r, c, true);

  const bars = (items, f) => `<path d="${items.map((q) => UY.map((y, k) => `M${R(q.lx + 9.5)} ${q.ly + y}h${R(Math.max(1.5, 13 * q.a * (0.3 + 0.7 * ((hash(q.name + k + f) % 97) / 96))))}`).join("")).join("")}"/>`;
  let fx = live.map((items, k) => (items.length ? frames(Array.from({ length: k ? 2 : 3 }, (_, f) => bars(items, f)), { ticks: [1, 2, 4][k], phase: k }) : "")).join("");
  fx += leds.map((d, k) => (d ? blink(`<path d="${d}" stroke="#f2fffa"/>`, { pattern: [[1, 0], [1, 0, 1, 1], [0, 1, 1]][k], ticks: k + 1, phase: k }) : "")).join("");
  if (fx) ctx.F.push(onY(X, fy, RH, fx, `fill="none" stroke="${lit(c, 0.35)}" stroke-width="1.6"`));
  if (worst > 0.85) ctx.F.push(onX(r.x + WT + 0.2, r.y + 176, 51, blink(`<circle cx="118.4" cy="5.6" r="5" fill="${RED}" opacity=".35"/><circle cx="118.4" cy="5.6" r="1.8" fill="#ffd0d8"/>`, { ticks: 2 })));

  const lines = sys ? [`CPU ${Math.round(sys.cpu)}%${sys.temp ? `  ${Math.round(sys.temp)}°C` : ""}`, ramText(sys), T.scene.dockerUp(all.length)].filter(Boolean) : T.scene.noSensors;
  mark(ctx, { kind: "panel", a: P(r.x + PAD[0], r.y + PAD[1], 0), lines, color: c, prio: 10, room: r.key, tier: 1 });
  target(ctx, r, r.name, c);
  ctx.S.push(s);
}
