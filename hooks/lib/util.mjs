export const NEONS = ["#00e5ff", "#ff2bd6", "#fcee0a", "#39ff88", "#ff8a00", "#b26bff", "#ff3b5c", "#7fd8ff"];
export const SKINS = ["#f1c9a5", "#e0ac85", "#c68b62", "#9a6646", "#f5d6bd", "#7a4c33"];
export const JACKETS = ["#34446e", "#6a3068", "#1f6a6c", "#7a5628", "#4a4a5e", "#7c3044", "#2c5a94"];
export const STYLES = ["mohawk", "undercut", "buzz", "long", "bun", "bald", "bob", "spikes", "mohawk", "long", "bob", "spikes"];

export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0;
}
export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
export function clip(t, n) {
  t = String(t ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const w = t.slice(0, n - 1).split(" ");
  if (w.length > 1 && t[n - 1] !== " ") w.pop();
  const cut = w.join(" ").replace(/[\s:,.\-]+$/, "");
  return (cut.length < n * 0.6 ? t.slice(0, n - 1).trim() : cut) + "…";
}
export function tw(t, size, kind = "cx", ls = 0) {
  let w = 0, n = 0;
  for (const ch of String(t)) {
    n++;
    if (kind === "mo") { w += 0.56; continue }
    w += /[MW]/.test(ch) ? 0.72 : /[\p{Lu}\p{Nd}#?!\u00a1\u00bf]/u.test(ch) ? 0.55 : /[mw]/.test(ch) ? 0.66 : ch === " " ? 0.24 : /[.,:;'|()·\-ilj]/.test(ch) ? 0.26 : 0.46;
  }
  return w * size + ls * n;
}
export function R(n) { return Math.round(n * 10) / 10 }

function hex2rgb(h) { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) }
function rgb2hex(r) { return "#" + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("") }
export function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)) }
export function lit(h, t) { return mix(h, "#ffffff", t) }
export function drk(h, t) { return mix(h, "#000000", t) }

export const C = 0.866, S = 0.5;
export function P(x, y, z = 0) { return [(x - y) * C, (x + y) * S - z] }
export function pts(a) { return a.map((p) => R(p[0]) + "," + R(p[1])).join(" ") }
export function poly(a, fill, extra = "") { return `<polygon points="${pts(a)}" fill="${fill}"${extra ? " " + extra : ""}/>` }
export function box(x, y, z, w, d, h, base, o = {}) {
  const top = o.top || lit(base, 0.1), left = o.left || base, right = o.right || drk(base, 0.3);
  return poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left, o.lx || "")
    + poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right, o.rx || "")
    + poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], top, o.tx || "");
}
export function flat(x, y, z, w, d, fill, extra = "") { return poly([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)], fill, extra) }
export function faceY(x, y, z1, z2, w, fill, extra = "") { return poly([P(x, y, z1), P(x + w, y, z1), P(x + w, y, z2), P(x, y, z2)], fill, extra) }
export function faceX(x, y, z1, z2, d, fill, extra = "") { return poly([P(x, y, z1), P(x, y + d, z1), P(x, y + d, z2), P(x, y, z2)], fill, extra) }
export function onY(x, y, z, inner, extra = "") { const [ex, ey] = P(x, y, z); return `<g transform="matrix(.866 .5 0 1 ${R(ex)} ${R(ey)})"${extra ? " " + extra : ""}>${inner}</g>` }
export function onX(x, y, z, inner, extra = "") { const [ex, ey] = P(x, y, z); return `<g transform="matrix(.866 -.5 0 1 ${R(ex)} ${R(ey)})"${extra ? " " + extra : ""}>${inner}</g>` }
export function onFloor(x, y, z, inner, extra = "") { const [ex, ey] = P(x, y, z); return `<g transform="matrix(.866 .5 -.866 .5 ${R(ex)} ${R(ey)})"${extra ? " " + extra : ""}>${inner}</g>` }
export function line(a, b, c, w = 1, extra = "") { return `<line x1="${R(a[0])}" y1="${R(a[1])}" x2="${R(b[0])}" y2="${R(b[1])}" stroke="${c}" stroke-width="${w}"${extra ? " " + extra : ""}/>` }
export function neon(a, b, c, w = 1.6) { return `<g class="gl">${line(a, b, c, R(w * 2.2), 'opacity=".55"')}${line(a, b, lit(c, 0.55), w)}</g>` }
export function neons(segs, c, w = 1.6) {
  const d = segs.map(([a, b]) => `M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}`).join("");
  return `<g class="gl" fill="none"><path d="${d}" stroke="${c}" stroke-width="${R(w * 2.2)}" opacity=".55"/><path d="${d}" stroke="${lit(c, 0.55)}" stroke-width="${w}"/></g>`;
}
export function splitTop(markup) {
  const out = [];
  let depth = 0, start = 0;
  const re = /<(\/?)[a-zA-Z][^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(markup))) {
    if (depth === 0) start = m.index;
    if (m[1]) depth--;
    else if (!m[2]) depth++;
    if (depth === 0) { out.push(markup.slice(start, re.lastIndex)); start = re.lastIndex }
  }
  return out;
}
export function pruneDefs(defs, ...uses) {
  const items = splitTop(defs).map((x) => ({ x, id: (x.match(/^<[a-zA-Z]+ id="([^"]+)"/) || [])[1] }));
  const byId = new Map(items.filter((i) => i.id).map((i) => [i.id, i]));
  const keep = new Set(), queue = [];
  const scan = (t) => { for (const m of t.matchAll(/(?:href="#|url\(#)([\w-]+)/g)) if (byId.has(m[1]) && !keep.has(m[1])) { keep.add(m[1]); queue.push(byId.get(m[1]).x) } };
  uses.forEach(scan);
  while (queue.length) scan(queue.pop());
  return items.filter((i) => !i.id || keep.has(i.id)).map((i) => i.x).join("");
}
export function pool(x, y, z, rx, ry, c, o = 0.35) { const a = P(x, y, z); return `<ellipse cx="${R(a[0])}" cy="${R(a[1])}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${o}" filter="url(#soft)"/>` }
export function at(a, inner, extra = "") { return `<g transform="translate(${R(a[0])} ${R(a[1])})"${extra ? " " + extra : ""}>${inner}</g>` }
export function bbox(ps, wt = 1) {
  const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), wt };
}
export function tildify(path, home) {
  if (!home) return path;
  if (path === home) return "~";
  return path.startsWith(home + "/") ? "~" + path.slice(home.length) : path;
}
export function basename(path) { return String(path).replace(/\/+$/, "").split("/").pop() || path }
export function ago(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h";
  return Math.round(h / 24) + " d";
}
export function sq(svg) {
  return svg.replace(/="([^"]*)"/g, (m, v) => `='${v.includes("'") ? v.replace(/'/g, "&apos;") : v}'`);
}
