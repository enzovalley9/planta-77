import { R, P, pts, lit, drk, esc, tw } from "./util.mjs";

export const TICK = 0.25;

const hexOf = (c) => String(c).replace("#", "").toLowerCase();
const pct = (o) => Math.round(Math.max(0, Math.min(1, o)) * 100);

export function rad(color) { return `url(#rg-${hexOf(color)})` }
export function core(color) { return `url(#rc-${hexOf(color)})` }
export function fadeDown(color, from = 1, to = 0) { return `url(#lv-${hexOf(color)}-${pct(from)}-${pct(to)})` }
export function fadeRight(color, from = 1, to = 0) { return `url(#lh-${hexOf(color)}-${pct(from)}-${pct(to)})` }
export function blend(top, bottom) { return `url(#lb-${hexOf(top)}-${hexOf(bottom)})` }

export function autoDefs(...bodies) {
  const seen = new Set();
  let out = "";
  for (const body of bodies) {
    for (const m of String(body).matchAll(/url\(#((?:rg|rc|lv|lh|lb)-[0-9a-f-]+)\)/g)) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const [kind, a, b, c] = id.split("-");
      if (kind === "rg") out += `<radialGradient id="${id}"><stop offset="0" stop-color="#${a}" stop-opacity=".9"/><stop offset=".35" stop-color="#${a}" stop-opacity=".42"/><stop offset=".7" stop-color="#${a}" stop-opacity=".1"/><stop offset="1" stop-color="#${a}" stop-opacity="0"/></radialGradient>`;
      else if (kind === "rc") out += `<radialGradient id="${id}"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".18" stop-color="#${a}" stop-opacity=".85"/><stop offset=".5" stop-color="#${a}" stop-opacity=".22"/><stop offset="1" stop-color="#${a}" stop-opacity="0"/></radialGradient>`;
      else if (kind === "lv" || kind === "lh") out += `<linearGradient id="${id}" x1="0" y1="0" x2="${kind === "lh" ? 1 : 0}" y2="${kind === "lh" ? 0 : 1}"><stop offset="0" stop-color="#${a}" stop-opacity="${Number(b) / 100}"/><stop offset="1" stop-color="#${a}" stop-opacity="${Number(c) / 100}"/></linearGradient>`;
      else if (kind === "lb") out += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#${a}"/><stop offset="1" stop-color="#${b}"/></linearGradient>`;
    }
  }
  return out;
}

export function halo(p, rx, ry, color, o = 1, extra = "") {
  return `<ellipse cx="${R(p[0])}" cy="${R(p[1])}" rx="${R(rx)}" ry="${R(ry)}" fill="${rad(color)}"${o === 1 ? "" : ` opacity="${o}"`}${extra ? " " + extra : ""}/>`;
}
export function spark(p, r, color, o = 1) {
  return `<circle cx="${R(p[0])}" cy="${R(p[1])}" r="${R(r)}" fill="${core(color)}"${o === 1 ? "" : ` opacity="${o}"`}/>`;
}
export function pool(x, y, z, rx, ry, color, o = 0.5) { return halo(P(x, y, z), rx, ry, color, o) }

const seg = (a, b) => `M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}`;
export function glowPath(d, color, w = 1.4, o = 1) {
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round"${o === 1 ? "" : ` opacity="${o}"`}><path d="${d}" stroke="${color}" stroke-width="${R(w * 5.5)}" opacity=".11"/><path d="${d}" stroke="${color}" stroke-width="${R(w * 2.6)}" opacity=".34"/><path d="${d}" stroke="${lit(color, 0.6)}" stroke-width="${R(w)}"/></g>`;
}
export function glow(a, b, color, w = 1.4, o = 1) { return glowPath(seg(a, b), color, w, o) }
export function glows(segs, color, w = 1.4, o = 1) { return glowPath(segs.map(([a, b]) => seg(a, b)).join(""), color, w, o) }
export function hair(a, b, color, w = 0.7, o = 1) {
  return `<line x1="${R(a[0])}" y1="${R(a[1])}" x2="${R(b[0])}" y2="${R(b[1])}" stroke="${color}" stroke-width="${w}"${o === 1 ? "" : ` opacity="${o}"`}/>`;
}

export function quad(a, fill, extra = "") { return `<polygon points="${pts(a)}" fill="${fill}"${extra ? " " + extra : ""}/>` }
export function floor(x, y, z, w, d, fill, extra = "") { return quad([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)], fill, extra) }
export function wallY(x, y, z1, z2, w, fill, extra = "") { return quad([P(x, y, z1), P(x + w, y, z1), P(x + w, y, z2), P(x, y, z2)], fill, extra) }
export function wallX(x, y, z1, z2, d, fill, extra = "") { return quad([P(x, y, z1), P(x, y + d, z1), P(x, y + d, z2), P(x, y, z2)], fill, extra) }

export function block(x, y, z, w, d, h, base, o = {}) {
  const top = o.top ?? lit(base, 0.12), left = o.left ?? base, right = o.right ?? drk(base, 0.32);
  return quad([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left)
    + quad([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right)
    + quad([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], top)
    + (o.edge ? `<path d="${seg(P(x, y + d, z + h), P(x + w, y + d, z + h))}${seg(P(x + w, y + d, z + h), P(x + w, y, z + h))}" stroke="${o.edge}" stroke-width="${o.edgeW ?? 0.6}" fill="none" opacity="${o.edgeO ?? 0.7}"/>` : "");
}

const mat = (m, p, inner, extra) => `<g transform="matrix(${m} ${R(p[0])} ${R(p[1])})"${extra ? " " + extra : ""}>${inner}</g>`;
export function onY(x, y, z, inner, extra = "") { return mat(".866 .5 0 1", P(x, y, z), inner, extra) }
export function onX(x, y, z, inner, extra = "") { return mat(".866 -.5 0 1", P(x, y, z), inner, extra) }
export function onFloor(x, y, z, inner, extra = "") { return mat(".866 .5 -.866 .5", P(x, y, z), inner, extra) }
export function at(p, inner, extra = "") { return `<g transform="translate(${R(p[0])} ${R(p[1])})"${extra ? " " + extra : ""}>${inner}</g>` }

export function text(x, y, str, o = {}) {
  const size = o.size ?? 8, cls = o.cls ?? "cx", ls = o.ls ?? 0;
  const w = o.fit === false ? 0 : R(tw(str, size, cls, ls));
  return `<text x="${R(x)}" y="${R(y)}" class="${cls}" font-size="${size}"${ls ? ` letter-spacing="${ls}"` : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""} fill="${o.fill ?? "#eef4ff"}"${o.o != null ? ` opacity="${o.o}"` : ""}${w > 0 ? ` textLength="${w}" lengthAdjust="spacingAndGlyphs"` : ""}${o.extra ? " " + o.extra : ""}>${esc(str)}</text>`;
}
export function neonText(x, y, str, color, o = {}) {
  const size = o.size ?? 12, cls = o.cls ?? "cx", ls = o.ls ?? 1, w = R(tw(str, size, cls, ls));
  const base = `x="${R(x)}" y="${R(y)}" class="${cls}" font-size="${size}" letter-spacing="${ls}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""} textLength="${w}" lengthAdjust="spacingAndGlyphs"`;
  const t = esc(str);
  return `<text ${base} fill="none" stroke="${color}" stroke-width="${R(size * 0.42)}" stroke-linejoin="round" opacity=".16">${t}</text><text ${base} fill="none" stroke="${color}" stroke-width="${R(size * 0.16)}" stroke-linejoin="round" opacity=".45">${t}</text><text ${base} fill="${o.fill ?? lit(color, 0.72)}">${t}</text>`;
}

export function step(attr, values, o = {}) {
  const n = values.length, dur = (o.ticks ?? 1) * n * TICK, begin = -((o.phase ?? 0) % n) * (o.ticks ?? 1) * TICK;
  return `<animate attributeName="${attr}" values="${values.join(";")}" calcMode="discrete" dur="${R(dur * 100) / 100}s"${begin ? ` begin="${R(begin * 100) / 100}s"` : ""} repeatCount="indefinite"/>`;
}
export function stepMove(offsets, o = {}) {
  const n = offsets.length, dur = (o.ticks ?? 1) * n * TICK, begin = -((o.phase ?? 0) % n) * (o.ticks ?? 1) * TICK;
  return `<animateTransform attributeName="transform" type="${o.type ?? "translate"}" values="${offsets.join(";")}" calcMode="discrete" dur="${R(dur * 100) / 100}s"${begin ? ` begin="${R(begin * 100) / 100}s"` : ""} repeatCount="indefinite"${o.additive ? ' additive="sum"' : ""}/>`;
}
export function blink(inner, o = {}) {
  const pattern = o.pattern ?? [1, 0.15];
  return `<g>${inner}${step("opacity", pattern, o)}</g>`;
}
export function frames(list, o = {}) {
  const n = list.length;
  return list.map((inner, i) => `<g opacity="${i === 0 ? 1 : 0}">${inner}${step("opacity", Array.from({ length: n }, (_, k) => (k === i ? 1 : 0)), o)}</g>`).join("");
}
