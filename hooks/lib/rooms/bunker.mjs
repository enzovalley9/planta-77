import { R, P, hash, lit, NEONS, tw } from "../util.mjs";
import { block, quad, floor, onY, onX, onFloor, glows, hair, halo, pool, spark, fadeDown, fadeRight, blend, neonText, text, blink, frames, stepMove } from "../kit.mjs";
import { standing, bot, HAIR_STYLES } from "../chars.mjs";
import { use, camera, cameraFx } from "../props.mjs";
import { front, sign, target } from "./shell.mjs";
import { WH, WT, person, mark, obstacle } from "../ctx.mjs";
import { lookOf } from "../model.mjs";
import { MAX_DANCERS } from "../layout.mjs";
import { T } from "../strings.mjs";

const V = "#b26bff", M = "#ff2bd6", C = "#00e5ff", G = "#39ff88", HZ = "#fcee0a";
const DJ = { style: "mohawk", visor: true, trim: M, q: "qs2 qh1 qj1 qt1 qi0 qc" };
const FU = 62, FV = 90, TS = 24, COLS = 12, LX = 154, LW = 180, LZ = 53, LH = 45, BARS = 22;
const TILE = ["#241043", "#7d38e8", "#e61cc4", "#10b4dc"];
const liteId = (L) => `bunker-d-${L.style}${L.visor ? 1 : 0}`;
const seg = (a, b) => `M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}`;

export function defs() {
  const cone = (cy) => `<circle cx="14" cy="${cy}" r="8.6" fill="#050408" stroke="#3a3350" stroke-width=".8"/><circle cx="14" cy="${cy}" r="9.7" fill="none" stroke="#c06bff" stroke-width=".7" opacity=".8"/><circle cx="14" cy="${cy}" r="3.2" fill="#1d1830"/>`;
  const spk = block(0, 0, 0, 28, 22, 50, "#17131f", { top: "#3d3458", left: "#262036", right: "#120f1a", edge: "#c06bff", edgeO: 0.9, edgeW: 0.9 })
    + onY(0, 22, 50, `<rect x="6" y="3.5" width="16" height="6" rx="2" fill="#050408" stroke="#3a3350" stroke-width=".6"/>${cone(20)}${cone(38)}`);
  const stool = block(2, 2, 0, 2, 2, 8, "#0d0b13") + block(0, 0, 8, 6, 6, 1.6, "#3a1638", { top: M });
  const deck = onFloor(0, 0, 0, `<circle r="8" fill="#08070b" stroke="#3a3350" stroke-width=".8"/><circle r="5.4" fill="none" stroke="#1d1830" stroke-width="1.6"/><circle r="2.2" fill="${M}"/><path d="M8 -8L3 -2" stroke="#aab0c4" stroke-width="1"/>`);
  const lamp = `<path d="M-1 -7h2v3h-2z" fill="#0c0a12"/><path d="M-3.6 -4h7.2l1.4 6h-10z" fill="#1d1929" stroke="#4a4560" stroke-width=".5"/>`;
  const drum = `<ellipse cy="1" rx="7" ry="3" fill="#000" opacity=".4"/><path d="M-5 0v-12a5 2.2 0 0 1 10 0v12a5 2.2 0 0 1-10 0z" fill="#26243a"/><path d="M0 2.2a5 2.2 0 0 0 5-2.2v-12a5 2.2 0 0 1-5 2.2z" fill="#16141f"/><path d="M-5 -7a5 2.2 0 0 0 10 0" stroke="${HZ}" stroke-width="1.8" fill="none" opacity=".85"/><ellipse cy="-12" rx="5" ry="2.2" fill="#3a3650"/><ellipse cy="-12" rx="3.6" ry="1.5" fill="${G}" opacity=".9"/>`;
  let lite = "";
  HAIR_STYLES.forEach((style, i) => [false, true].forEach((visor) => { const L = { q: "", style, visor }; lite += `<g id="${liteId(L)}">${standing([0, 0], L, { dance: (i + (visor ? 1 : 0)) % 4 })}</g>` }));
  return lite + `<g id="bunker-spk">${spk}</g><g id="bunker-stool">${stool}</g><g id="bunker-deck">${deck}</g><g id="bunker-lamp">${lamp}</g><g id="bunker-drum">${drum}</g>`;
}

function graffiti(str, size, col, n = 4) {
  const w = tw(str, size);
  let d = "";
  for (let i = 0; i < n; i++) d += `M${3 + (hash(str + i) % Math.max(4, Math.round(w - 6)))} 1v${3 + (hash(str + "l" + i) % 8)}`;
  return `<g transform="skewX(-10)" opacity=".92">${text(0, 0, str, { size, fill: col, extra: 'stroke="#05030a" stroke-width="1.4" paint-order="stroke"' })}<path d="${d}" stroke="${col}" stroke-width=".8" stroke-linecap="round" opacity=".7"/></g>`;
}

function concrete(ctx, r, c) {
  const { x, y, w, d } = r, lod = ctx.lod;
  let s = floor(x, y, 0, w, d, "#0b0a11");
  if (lod >= 1) {
    let l = "";
    for (let u = 70; u < w; u += 70) l += seg(P(x + u, y + WT, 0), P(x + u, y + d, 0));
    for (let v = 70; v < d; v += 70) l += seg(P(x + WT, y + v, 0), P(x + w, y + v, 0));
    s += `<path d="${l}" stroke="#191622" stroke-width=".8" fill="none"/>`;
    s += pool(x + w / 2, y + d / 2 + 10, 0, R(w * 0.52), R(d * 0.36), c, 0.36) + onFloor(x + WT, y + WT, 0.1, `<rect width="${w - WT}" height="16" fill="${fadeDown("#000000", 0.6, 0)}"/><rect width="16" height="${d - WT}" fill="${fadeRight("#000000", 0.6, 0)}"/>`);
  }
  const tex = (len, stains) => {
    if (lod < 1) return "";
    let seams = "";
    for (let u = 70; u < len - 10; u += 70) seams += `M${u} 2V${WH}`;
    let t = `<path d="${seams}M0 29H${len}" stroke="#09070d" stroke-width=".8" opacity=".75" fill="none"/>`;
    if (lod >= 2) {
      t += `<path d="M18 9H${len}M18 47H${len}" stroke="#08060c" stroke-width="1.8" stroke-dasharray="1.8 33.2" opacity=".85"/>`;
      for (let k = 0; k < stains; k++) t += `<rect x="${R(len * (0.3 + k * 0.56))}" width="${7 + k * 3}" height="${34 + k * 10}" fill="${fadeDown("#000000", 0.36, 0)}"/>`;
    }
    return t;
  };
  const cap = "#2f2a3e";
  s += quad([P(x, y, WH), P(x + w, y, WH), P(x + w, y + WT, WH), P(x, y + WT, WH)], cap);
  s += onY(x, y + WT, WH, `<rect width="${w}" height="${WH}" fill="${blend("#1b1826", "#35274f")}"/>${tex(w, 2)}`);
  s += quad([P(x, y, WH), P(x + WT, y, WH), P(x + WT, y + d, WH), P(x, y + d, WH)], cap);
  s += onX(x + WT, y + d, WH, `<rect width="${d - WT}" height="${WH}" fill="${blend("#131019", "#291d40")}"/>${tex(d - WT, 0)}`);
  s += quad([P(x, y + d, 0), P(x + WT, y + d, 0), P(x + WT, y + d, WH), P(x, y + d, WH)], "#231f30");
  const na = P(x + WT, y + d, WH - 2.4), nb = P(x + WT, y + WT, WH - 2.4), nc = P(x + w, y + WT, WH - 2.4);
  return s + (lod >= 1 ? glows([[na, nb], [nb, nc]], c, 1.2, 0.9) : `<path d="${seg(na, nb)}${seg(nb, nc)}" stroke="${c}" stroke-width="1.3" fill="none"/>`);
}

function ledWall(ctx, r) {
  const { x, y } = r, v = y + WT + 0.2, lod = ctx.lod;
  let inner = `<rect x="-3" y="-2" width="${LW + 6}" height="${LH + 4}" fill="#020104"/><rect width="${LW}" height="${LH}" fill="${blend("#1c0a30", "#060309")}" stroke="${M}"/>`;
  inner += lod >= 1 ? `<path d="M3 26.5H${3 + BARS * 8}" stroke="#2a1248" stroke-width="33" stroke-dasharray="6 2"/>` : eqBars(0, 2);
  if (lod >= 1) inner += text(68, 6.6, "NEURAL//BASS", { size: 5.2, ls: 2.2, fill: "#ffffff", o: 0.8 });
  if (lod >= 2) inner += text(LW - 4, 6.6, "140 BPM", { size: 5.2, ls: 1, fill: M, anchor: "end" });
  obstacle(ctx, [P(x + LX, v, LZ), P(x + LX + LW, v, LZ), P(x + LX, v, LZ - LH), P(x + LX + LW, v, LZ - LH)], 0.3);
  return (lod >= 1 ? halo(P(x + LX + LW / 2, v, 30), 120, 46, M, 0.5) : "") + onY(x + LX, v, LZ, inner);
}
function eqBars(f, k = 1) {
  let d = "";
  for (let i = 0; i < BARS; i += k) {
    const env = 0.5 + 0.5 * Math.sin((Math.PI * (i + 0.5)) / BARS), h = Math.round(5 + 28 * env * (0.35 + (hash(`eq${f}.${i}`) % 66) / 100));
    d += `${i ? `m${8 * k} 0` : "M3 43"}v-${h}h${8 * k - 2}v${h}z`;
  }
  return `<path d="${d}" fill="${blend(M, C)}"/>`;
}

function danceFloor(ctx, r, rows) {
  const { x, y } = r, lod = ctx.lod, fw = COLS * TS, fd = rows * TS;
  let s = floor(x + FU - 3, y + FV - 3, 0.2, fw + 6, fd + 6, "#040308");
  const big = lod < 1 ? 2 : 1, n = COLS / big, m = Math.ceil(rows / big), ts = TS * big;
  const d = ["", "", "", ""];
  let line = "", core = "";
  for (let j = 0; j < m; j++) {
    line += `M1 ${j * TS + 12}H${fw - 1}`;
    core += `M6 ${j * TS + 12}H${fw - 1}`;
    for (let i = 0; i < n; i++) {
      const k = hash(`t${i}.${j}`) % 10, q = big > 1 ? 1 + ((i + 2 * j) % 3) : k < 3 ? 0 : k < 5 ? 1 : k < 8 ? 2 : 3, hh = Math.min(ts, fd - j * ts) - 2;
      if (q || big > 1) d[q] += `M${i * ts + 1} ${j * ts + 1}h${ts - 2}v${hh}h${2 - ts}z`;
    }
  }
  let inner = big > 1 ? "" : `<path d="${line}" stroke="${TILE[0]}" stroke-width="22" stroke-dasharray="22 2"/>`;
  inner += d.map((p, q) => (p ? `<path d="${p}" fill="${TILE[q]}"/>` : "")).join("");
  if (big === 1) inner += `<path d="${core}" stroke="#fff" stroke-width="12" stroke-dasharray="12 12" opacity=".2"/>`;
  s += onFloor(x + FU, y + FV, 0.3, inner);
  const a = P(x + FU - 3, y + FV + fd + 3, 0.3), b = P(x + FU + fw + 3, y + FV + fd + 3, 0.3), e = P(x + FU + fw + 3, y + FV - 3, 0.3);
  s += lod >= 2 ? glows([[a, b], [b, e]], M, 1.1) : `<path d="${seg(a, b)}${seg(b, e)}" stroke="${M}" stroke-width="1.2" fill="none"/>`;
  s += pool(x + FU + fw / 2, y + FV + fd / 2, 0, 190, 70, V, 0.5);
  if (lod >= 2) s += pool(x + FU + fw * 0.8, y + FV + fd * 0.4, 0, 90, 34, M, 0.4) + pool(x + FU + fw * 0.2, y + FV + fd * 0.6, 0, 90, 34, C, 0.32);
  return s;
}
function tileFx(r, rows) {
  const pick = (f) => {
    let d = "";
    for (let k = 0; k < 6; k++) { const i = hash(`fx${f}.${k}`) % COLS, j = hash(`fy${f}.${k}`) % rows; d += `M${i * TS + 1} ${j * TS + 1}h22v22h-22z` }
    return `<path d="${d}" fill="#fff" opacity=".42"/>`;
  };
  return onFloor(r.x + FU, r.y + FV, 0.3, frames([pick(0), pick(1)], { ticks: 2 }));
}

function stage(ctx, r, z) {
  const { x, y } = r, lod = ctx.lod;
  if (!z) return floor(x + 148, y + WT, 0.2, 192, 64, "#1d172b") + block(x + 192, y + 40, 0, 100, 18, 14, "#120e1a", { top: "#3a2d5c", left: "#1c1430", right: "#0e0a16" });
  let s = block(x + 148, y + WT, 0, 192, 64, z, "#15121d", { top: "#292140", left: "#1d172b", right: "#0e0b15", edge: V, edgeO: 0.75 });
  s += onFloor(x + LX, y + WT + 0.4, z + 0.1, `<rect width="${LW}" height="30" fill="${fadeDown(M, 0.36, 0)}"/>`);
  s += block(x + 192, y + 40, z, 100, 18, 14, "#120e1a", { top: "#3a2d5c", left: "#1c1430", right: "#0e0a16", edge: M, edgeO: 0.95, edgeW: 0.9 });
  s += onY(x + 192, y + 58, z + 14, `<rect x="3" y="2.4" width="94" height="9.6" fill="#07040d"/>${text(50, 10.2, "DJ OPUS 5.5", { size: 7.6, ls: 2.2, fill: "#ff8af0", anchor: "middle" })}`);
  s += use("bunker-deck", P(x + 208, y + 49, z + 14.2)) + use("bunker-deck", P(x + 276, y + 49, z + 14.2));
  if (lod >= 2) {
    s += block(x + 229, y + 43, z + 14, 26, 12, 1.6, "#1c1728", { top: "#4a3d6e" });
    const m = (u, col) => hair(P(x + u, y + 46, z + 15.8), P(x + u + 8, y + 46, z + 15.8), col, 1.3);
    s += m(232, C) + m(243, HZ);
  }
  return s;
}

function bar(ctx, r) {
  const { x, y, d } = r, lod = ctx.lod, v0 = y + 98, len = Math.min(96, d - 122), wx = x + WT + 0.2;
  let s = "";
  if (lod >= 1) {
    let shelf = `<rect width="${len - 4}" height="27" fill="#04070d"/><rect width="${len - 4}" height="27" fill="${fadeDown(C, 0.34, 0.08)}"/>`;
    if (lod >= 2) {
      const b = ["", "", "", ""];
      for (let k = 0; k < Math.floor((len - 8) / 7); k++) for (let j = 0; j < 2; j++) { const h = 6 + (hash(`b${j}${k}`) % 4); b[(k + j * 3 + hash("bc" + k) % 2) % 4] += `M${3 + k * 7} ${12 + j * 13}v-${h}h3.4v${h}z` }
      shelf += b.map((p, q) => `<path d="${p}" fill="${[M, HZ, G, "#ffffff"][q]}" opacity=".85"/>`).join("");
    }
    shelf += `<path d="M0 12.6H${len - 4}M0 25.6H${len - 4}" stroke="#7ff0ff" stroke-width="1.2"/><rect width="${len - 4}" height="27" fill="none" stroke="${C}" stroke-width=".8"/>`;
    s += onX(wx, v0 + len - 2, 34, shelf);
    s += onX(wx, v0 + len - 14, 51, (lod >= 2 ? neonText(0, 11, "BAR", C, { size: 13, ls: 2.4 }) : text(0, 11, "BAR", { size: 13, ls: 2.4, fill: "#b4f6ff" })) + `<text x="42" y="10" class="jp" font-size="7.4" fill="#9ff4ff">酒場</text>`);
    s += halo(P(wx, v0 + len / 2, 26), 70, 40, C, 0.4) + bot(P(x + 14, v0 + len * 0.55, 6), C);
  }
  s += block(x + 22, v0, 0, 16, len, 17, "#171222", { top: "#2d2347", left: "#1c1530", right: "#100c1b", edge: C, edgeO: 0.95, edgeW: 0.9 });
  if (lod >= 1) {
    s += onFloor(x + 38, v0, 0.2, `<rect width="18" height="${len}" fill="${fadeRight(C, 0.4, 0)}"/>`);
    s += hair(P(x + 38, v0, 3), P(x + 38, v0 + len, 3), "#9ff4ff", 1, 0.9);
    for (let i = 0; i * 22 + 14 < len; i++) s += use("bunker-stool", P(x + 45, v0 + 8 + i * 22, 0));
  }
  if (lod >= 2) [[0.2, M], [0.5, HZ], [0.78, G]].forEach(([t, col]) => { s += spark(P(x + 31, v0 + len * t, 19.4), 3.6, col) });
  return s;
}

function vault(wx, vy) {
  return onX(wx, vy, 50, `<rect width="38" height="50" fill="#0b0910"/><rect x="1.4" y="1.4" width="35.2" height="47.2" fill="none" stroke="${HZ}" stroke-width="2.4" stroke-dasharray="4 4" opacity=".8"/><circle cx="19" cy="27" r="15" fill="#3d3856" stroke="#8a84a6" stroke-width="1.4"/><circle cx="19" cy="27" r="12.4" fill="none" stroke="#15121d" stroke-width="2" stroke-dasharray=".1 6.4" stroke-linecap="round"/><circle cx="19" cy="27" r="5.4" fill="none" stroke="#d6d0ee" stroke-width="1.5"/><path d="M11.6 27h14.8M19 19.6v14.8" stroke="#d6d0ee" stroke-width="1.3"/><circle cx="19" cy="6.4" r="1.7" fill="#ff3b5c"/>`);
}

const BEAMS = [
  [[124, 104, 150, V], [210, 216, 172, M], [348, 312, 130, C]],
  [[124, 176, 122, C], [210, 292, 166, V], [348, 250, 116, M]],
];
function cones(r, set, spot) {
  return set.map(([eu, tu, tv, col]) => {
    const e = P(r.x + eu, r.y + 9, 54), t = P(r.x + tu, r.y + tv, 0);
    return quad([e, [t[0] - 30, t[1]], [t[0] + 30, t[1]]], fadeDown(lit(col, 0.3), 0.62, 0.3)) + halo(t, 38, 17, lit(col, 0.3), 1) + (spot ? `<ellipse cx="${R(t[0])}" cy="${R(t[1])}" rx="26" ry="11.4" fill="${lit(col, 0.55)}" opacity=".22"/>` : "");
  }).join("");
}
function fan(e, r, us, col) {
  return `<path d="${us.map((u) => seg(e, P(r.x + u, r.y + r.d - 5, 0))).join("")}" stroke="${col}" stroke-width=".8" opacity=".7" fill="none"/>`;
}

export function bunkerRoom(ctx, r) {
  const c = r.neon, { x, y, w, d } = r, lod = ctx.lod, rows = r.floorRows ?? 4, wx = x + WT + 0.2, wy = y + WT + 0.2;
  const lounge = ctx.model.sessions.filter((s) => s.state === "lounge");
  const S = ctx.S;
  S.push(concrete(ctx, r, c));
  let s = sign(ctx, r, r.name, c, true, [lod >= 2 ? "地下 B4F · 24H" : "", T.scene.bunkerHours], { maxSize: 15, avail: 124 });
  s += ledWall(ctx, r);
  if (lod >= 2) {
    s += onY(x + 346, wy, 41, graffiti(T.scene.graffiti[0], 11, HZ) + `<g transform="translate(2 11)">${graffiti(T.scene.graffiti[1], 9, G, 3)}</g>`);
    s += vault(wx, y + 50) + onX(wx, y + 94, 42, graffiti("rm -rf /", 10.4, M) + `<g transform="translate(5 13)">${graffiti("CTRL+Z", 8.4, C, 3)}</g>`);
    const ta = P(x + 104, y + 9, 55.4), tb = P(x + 366, y + 9, 55.4);
    s += `<path d="${seg(ta, tb)}" stroke="#0a0810" stroke-width="3.4"/><path d="${seg(ta, tb)}" stroke="#4a4560" stroke-width="2.6" stroke-dasharray="1 3"/>`;
  }
  if (lod >= 1) BEAMS[0].forEach(([eu, , , col]) => { const p = P(x + eu, y + 9, 54); s += use("bunker-lamp", p) + spark([p[0], p[1] + 2.4], 5, col) });
  const sz = lod >= 1 ? 4 : 0;
  S.push(s, danceFloor(ctx, r, rows), stage(ctx, r, sz));
  s = "";
  if (lod >= 2) {
    s += use("bunker-drum", P(x + 362, y + 16, 0)) + use("bunker-drum", P(x + 375, y + 14, 0)) + use("bunker-drum", P(x + 370, y + 27, 0));
    const ca = P(x + 240, y + 62, 0), cb = P(x + 142, y + 76, 0), cc = P(x + 338, y + 78, 0);
    s += `<path d="M${R(ca[0])} ${R(ca[1])}Q${R(ca[0] - 30)} ${R(ca[1] + 22)} ${R(cb[0])} ${R(cb[1])}M${R(ca[0])} ${R(ca[1])}Q${R(ca[0] + 60)} ${R(ca[1] + 14)} ${R(cc[0])} ${R(cc[1])}" stroke="#040307" stroke-width="1.6" fill="none"/>`;
  }
  s += use("bunker-spk", P(x + 114, y + 52, 0)) + use("bunker-spk", P(x + 338, y + 52, 0));
  S.push(s, bar(ctx, r));
  s = "";
  if (lod >= 2) {
    s += block(x + 358, y + 96, 0, 18, 14, 10, "#1d1829", { top: "#3a2f58", left: "#2a2140", right: "#120f1a", edge: M, edgeO: 0.8 }) + block(x + 361, y + 98, 10, 12, 10, 8, "#1d1829", { top: "#3a2f58", left: "#2a2140", right: "#120f1a", edge: C, edgeO: 0.8 });
    s += use("bunker-stool", P(x + 362, y + 124, 0)) + spark(P(x + 365, y + 127, 12), 3.6, HZ);
  }
  if (lod >= 1) s += pool(x + 214, y + d * 0.62, 22, 190, 56, V, 0.22);

  const fx = [];
  if (lod >= 1) fx.push(onY(x + LX, wy, LZ, (lod >= 2 ? frames([eqBars(0), eqBars(1), eqBars(2)]) : frames([eqBars(0), eqBars(1)], { ticks: 2 })) + `<path d="M91 10V43" stroke="#07040d" stroke-width="176" stroke-dasharray=".7 2.3"/>`));
  if (lod >= 2) {
    fx.push(tileFx(r, rows));
    [114, 338].forEach((u, k) => fx.push(onY(x + u, y + 74, 50, blink(`<circle cx="14" cy="38" r="5.8" fill="none" stroke="${k ? C : M}" stroke-width="1.8"/>`, { pattern: [0.9, 0], phase: k }))));
  }
  const dj = P(x + 242, y + 26, sz);
  fx.push(standing(dj, DJ, { dance: 2, phones: M, rim: M, hop: true, hopBy: 2, ticks: 2 }));
  person(ctx, null, dj, 46, r.key);

  const slots = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < 8; i++) slots.push([FU + 20 + i * 34 + (j % 2) * 14 + (hash("jx" + i + j) % 9) - 4, FV + 12 + j * TS + (hash("jy" + i + j) % 7) - 3]);
  const cu = FU + COLS * TS / 2, cv = FV + rows * TS / 2;
  const key = (i) => ((slots[i][0] - cu) / 2.2) ** 2 + (slots[i][1] - cv) ** 2 + (hash("o" + i) % 1400);
  const order = slots.map((p, i) => i).sort((a, b) => key(a) - key(b));
  const shown = lounge.slice(0, Math.min(slots.length, MAX_DANCERS));
  const npcs = lod >= 2 ? Math.max(0, 10 - shown.length) : 0;
  const crowd = shown.map((o, i) => ({ p: slots[order[i]], o }));
  for (let i = 0; i < npcs; i++) crowd.push({ p: slots[order[shown.length + i]], npc: i });
  crowd.sort((a, b) => a.p[0] + a.p[1] - b.p[0] - b.p[1]).forEach(({ p, o, npc }, i) => {
    const a = P(x + p[0], y + p[1], 0), id = o ? o.id : "npc" + npc, L = lookOf(id), every = lod ? 2 : 4;
    if (lod >= 2) fx.push(standing(a, L, { dance: hash("dz" + id) % 4, rim: i % 2 ? M : C, hop: true, phase: i % 2, ticks: hash("ht" + id) % 5 ? 1 : 2, stick: !o && npc % 2 === 0 ? NEONS[npc % NEONS.length] : null, extra: o ? "" : 'opacity=".8"' }));
    else fx.push(`<use href="#${liteId(L)}" x="${R(a[0])}" y="${R(a[1])}" class="${L.q}"${i % every ? "/>" : `>${stepMove(["0 0", "0 -3"], { phase: (i / every) % 2 })}</use>`}`);
    person(ctx, o ?? null, a, 40, r.key);
    if (o) mark(ctx, { kind: "tag", a, s: o, state: "lounge", room: r.key, tier: 2, mini: true, optional: true, max: 22, dy: 8, near: 30 });
  });
  if (lounge.length > shown.length) mark(ctx, { kind: "chip", a: P(x + w - 60, y + d - 16, 0), text: T.scene.inLine(lounge.length - shown.length), color: c, prio: 2, size: 7, room: r.key, tier: 1 });

  if (lod >= 1) fx.push(frames([cones(r, BEAMS[0], lod >= 2), cones(r, BEAMS[1], lod >= 2)], { ticks: 4 }));
  else fx.push(cones(r, BEAMS[0]));
  if (lod >= 2) {
    const e = P(x + 9, y + 30, 55);
    fx.push(frames([fan(e, r, [64, 132, 200, 268, 336], G), fan(e, r, [98, 166, 234, 302, 366], G)], { ticks: 2, phase: 1 }));
    const e2 = P(x + 396, y + 9, 55);
    fx.push(frames([fan(e2, r, [226, 272, 318, 364], C), fan(e2, r, [204, 250, 296, 342], C)], { ticks: 3 }));
    fx.push(blink(spark(P(x + 186, y + 9, 56), 7, "#ffffff"), { pattern: [1, 0, 0, 0.6, 0, 0], phase: 2 }));
  }
  s += camera(x + 10, y + 10, WH - 6) + front(ctx, r, c, true);
  fx.push(cameraFx(x + 10, y + 10, WH - 6));
  S.push(s);
  ctx.F.push(...fx);
  target(ctx, r, r.name, c);
}
