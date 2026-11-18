import { R, P, hash, lit, drk, clip, tw, esc } from "../util.mjs";
import { block, quad, floor, wallY, wallX, onY, onX, onFloor, glow, glows, hair, pool, fadeDown, fadeRight, blend, neonText, text } from "../kit.mjs";
import { WH, WT, obstacle, roomTarget } from "../ctx.mjs";

const CITY = ["#ffd27a", "#7fd8ff", "#ff6ad5", "#ffffff", "#ffb14a"];

function cityGlass(seed, w, h) {
  let s = `<rect width="${R(w)}" height="${h}" fill="${blend("#131c3a", "#070a14")}"/>`;
  const n = Math.max(4, Math.round(w / 9));
  let sky = "";
  let x = 0, k = 0;
  while (x < w) {
    const bw = 8 + (hash(seed + "b" + k) % 14), bh = 6 + (hash(seed + "h" + k) % (h - 10));
    sky += `M${R(x)} ${h}v${-bh}h${Math.min(bw, R(w - x))}v${bh}z`;
    x += bw + 1 + (hash(seed + "g" + k) % 4);
    k++;
  }
  s += `<path d="${sky}" fill="#05070f"/>`;
  for (let i = 0; i < n; i++) {
    const wx = hash(seed + "x" + i) % Math.max(1, Math.round(w - 3)), wy = 8 + (hash(seed + "y" + i) % Math.max(1, h - 12));
    s += `<rect x="${wx}" y="${wy}" width="${1.4 + (i % 3) * 0.8}" height="1.5" fill="${CITY[i % CITY.length]}" opacity="${0.45 + (i % 4) * 0.13}"/>`;
  }
  return s + `<path d="M${R(w * 0.18)} 0L${R(w * 0.06)} ${h}M${R(w * 0.24)} 0L${R(w * 0.12)} ${h}" stroke="#fff" stroke-width="2.4" opacity=".05"/>`;
}

export function shell(ctx, r, c, on, o = {}) {
  const { x, y, w, d } = r;
  const base = o.floor ?? (on ? "#151c2e" : "#0a0d16");
  let s = floor(x, y, 0, w, d, base);
  if (ctx.lod >= 1 && !o.plainFloor) {
    let lines = "";
    for (let u = 46; u < w; u += 46) { const a = P(x + u, y + WT, 0), b = P(x + u, y + d, 0); lines += `M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}` }
    for (let v = 46; v < d; v += 46) { const a = P(x + WT, y + v, 0), b = P(x + w, y + v, 0); lines += `M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}` }
    s += `<path d="${lines}" stroke="${on ? "#222e4a" : "#131a2a"}" stroke-width=".7" fill="none"/>`;
  }
  if (on) s += pool(x + w / 2, y + d / 2 + 6, 0, R(w * 0.5), R(d * 0.3), c, o.pool ?? 0.3);
  if (on && !o.noReflect) s += onFloor(x + WT, y + WT, 0.1, `<rect width="${w - WT}" height="34" fill="${fadeDown(c, 0.2, 0)}"/>`);
  s += onFloor(x + WT, y + WT, 0.1, `<rect width="${w - WT}" height="14" fill="${fadeDown("#000000", 0.5, 0)}"/><rect width="14" height="${d - WT}" fill="${fadeRight("#000000", 0.5, 0)}"/>`);

  const wallTop = on ? "#34405c" : "#1a2031", faceA = on ? "#222c45" : "#0f141f", faceB = on ? "#131a2c" : "#0a0d15";
  s += quad([P(x, y, WH), P(x + w, y, WH), P(x + w, y + WT, WH), P(x, y + WT, WH)], wallTop);
  s += onY(x, y + WT, WH, `<rect width="${w}" height="${WH}" fill="${blend(faceA, faceB)}"/>`);
  if (ctx.lod >= 1) {
    let seams = "";
    for (let u = 60; u < w - 10; u += 60) seams += `M${u} 2V${WH}`;
    if (seams) s += onY(x, y + WT, WH, `<path d="${seams}" stroke="#0a0e18" stroke-width=".8" opacity=".7"/>`);
  }
  if (r.y === 0 && !o.noWindows && ctx.lod >= 1) {
    const ww = w - 30;
    s += onY(x + 16, y + WT, 47, cityGlass("y" + r.key, ww, 30) + `<rect width="${ww}" height="30" fill="none" stroke="#3a4664" stroke-width="1.4"/>`);
    let mull = "";
    for (let u = 46; u < ww - 6; u += 46) mull += `M${u} 0V30`;
    if (mull) s += onY(x + 16, y + WT, 47, `<path d="${mull}" stroke="#3a4664" stroke-width="1.2"/>`);
  }
  s += quad([P(x, y, WH), P(x + WT, y, WH), P(x + WT, y + d, WH), P(x, y + d, WH)], wallTop);
  s += onX(x + WT, y + d, WH, `<rect width="${d - WT}" height="${WH}" fill="${blend(drk(faceA, 0.22), drk(faceB, 0.25))}"/>`);
  s += quad([P(x, y + d, 0), P(x + WT, y + d, 0), P(x + WT, y + d, WH), P(x, y + d, WH)], on ? "#2a3550" : "#141a28");
  if (r.x === 0 && !o.noWindows && ctx.lod >= 1) {
    const ww = d - 30;
    s += onX(x + WT, y + d - 12, 47, cityGlass("x" + r.key, ww, 30) + `<rect width="${ww}" height="30" fill="none" stroke="#3a4664" stroke-width="1.4"/>`);
  }
  const nc = on ? c : drk(c, 0.6);
  s += glows([[P(x + WT, y + d, WH - 2.4), P(x + WT, y + WT, WH - 2.4)], [P(x + WT, y + WT, WH - 2.4), P(x + w, y + WT, WH - 2.4)]], nc, on ? 1.3 : 0.9, on ? 1 : 0.7);
  s += `<path d="M${R(P(x + WT, y + d, 0.6)[0])} ${R(P(x + WT, y + d, 0.6)[1])}L${R(P(x + WT, y + WT, 0.6)[0])} ${R(P(x + WT, y + WT, 0.6)[1])}L${R(P(x + w, y + WT, 0.6)[0])} ${R(P(x + w, y + WT, 0.6)[1])}" stroke="${nc}" stroke-width=".8" fill="none" opacity=".55"/>`;
  return s;
}

export function front(ctx, r, c, on) {
  const { x, y, w, d } = r, nc = on ? c : drk(c, 0.6);
  return wallY(x, y + d, 0, 15, w, fadeDown(nc, 0.16, 0.03)) + wallX(x + w, y, 0, 15, d, fadeDown(nc, 0.1, 0.02))
    + glows([[P(x, y + d, 15), P(x + w, y + d, 15)], [P(x + w, y + d, 15), P(x + w, y, 15)]], nc, 1, on ? 0.95 : 0.6)
    + hair(P(x, y + d, 0), P(x + w, y + d, 0), "#34405c", 1.2) + hair(P(x + w, y, 0), P(x + w, y + d, 0), "#34405c", 1.2);
}

export function sign(ctx, r, name, c, on, sub = [], o = {}) {
  const avail = o.avail ?? r.w - 50, maxSize = o.maxSize ?? 17;
  const n = [...name].length, ls = 1.6;
  const size = R(Math.max(7, Math.min(maxSize, (avail - 22 - ls * n) / tw(name, 1))));
  const subs = sub.filter(Boolean).map((t) => (tw(t, 5.8, "mo") > avail - 22 ? clip(t, Math.floor((avail - 22) / 3.25)) : t));
  const pw = R(Math.max(tw(name, size, "cx", ls), ...subs.map((t) => tw(t, 5.8, "mo"))) + 22), ph = R(size + 9 + subs.length * 7.6);
  const x = r.x + (o.dx ?? 20), y = r.y + WT, zt = 53, by = R(size * 0.82 + 3);
  let inner = `<rect width="${pw}" height="${ph}" fill="#04060b" opacity=".9"/><rect width="${pw}" height="1.6" fill="${on ? c : drk(c, 0.5)}"/><rect y="${R(ph - 0.8)}" width="${pw}" height=".8" fill="${on ? c : drk(c, 0.5)}" opacity=".5"/>`;
  inner += on ? neonText(11, by, name, c, { size, ls }) : text(11, by, name, { size, ls, fill: drk(c, 0.4) });
  subs.forEach((t, k) => { inner += `<text x="11" y="${R(by + 9 + k * 7.6)}" class="mo" font-size="5.8" fill="${on ? (k ? "#c9d6f2" : lit(c, 0.4)) : "#56627a"}">${esc(t)}</text>` });
  obstacle(ctx, [P(x, y, zt + 1), P(x + pw, y, zt + 1), P(x, y, zt - ph), P(x + pw, y, zt - ph)]);
  return onY(x, y, zt, inner);
}

export function target(ctx, r, name, c) {
  roomTarget(ctx, r, name, c, [P(r.x, r.y, WH), P(r.x + r.w, r.y, WH), P(r.x + r.w, r.y + r.d, 0), P(r.x, r.y + r.d, 0)]);
}

export function rug(x, y, w, d, c, o = 0.1) {
  return floor(x, y, 0.2, w, d, c, `opacity="${o}"`) + `<polygon points="${[P(x, y, 0.2), P(x + w, y, 0.2), P(x + w, y + d, 0.2), P(x, y + d, 0.2)].map((p) => R(p[0]) + "," + R(p[1])).join(" ")}" fill="none" stroke="${c}" stroke-width=".7" opacity="${R(o * 4)}"/>`;
}
export { block, glow };
