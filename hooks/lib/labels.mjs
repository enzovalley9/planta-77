import { R, P, esc, clip, tw, lit, drk } from "./util.mjs";
import { STATE_COLOR, PRIO } from "./ctx.mjs";
import { T } from "./strings.mjs";

export const STATE = Object.fromEntries(Object.entries(STATE_COLOR).map(([k, color]) => [k, { color }]));
export { PRIO };
const ICON = { turn: "✓", perm: "!", ask: "?" };
const fit = (str, size, cls = "cx", ls = 0) => ` textLength="${R(tw(str, size, cls, ls))}" lengthAdjust="spacingAndGlyphs"`;

export function newBoard(vb, k = 1) { return { vb, k, labels: [], obst: [], people: [] } }
export function addLabel(B, L) {
  const k = L.k ?? B.k;
  B.labels.push(Object.assign({ prio: 1 }, L, { k, w: L.w * k, h: L.h * k, dx: (L.dx ?? -L.w / 2) * k, dy: (L.dy ?? 6) * k }));
}

const CELL = 64;
function grid() {
  const cells = new Map();
  const keys = (r, p) => {
    const out = [];
    for (let i = Math.floor((r.x - p) / CELL); i <= Math.floor((r.x + r.w + p) / CELL); i++) for (let j = Math.floor((r.y - p) / CELL); j <= Math.floor((r.y + r.h + p) / CELL); j++) out.push(i * 100003 + j);
    return out;
  };
  return {
    add(r) { for (const k of keys(r, 0)) { let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(r) } },
    near(r, p = 3) { const seen = new Set(); for (const k of keys(r, p)) for (const o of cells.get(k) ?? []) seen.add(o); return seen },
  };
}
function inter(a, b, p = 2.5) {
  const w = Math.min(a.x + a.w + p, b.x + b.w) - Math.max(a.x - p, b.x), h = Math.min(a.y + a.h + p, b.y + b.h) - Math.max(a.y - p, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
function candidates(L, reach) {
  const out = [[L.dx, L.dy]], dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const stepBy = 6 * L.k;
  for (let r = stepBy; r <= reach * L.k; r += stepBy) for (const [u, v] of dirs) out.push([L.dx + u * r * 1.5, L.dy + v * r]);
  return out;
}
function leader(L) {
  const r = L.r, nx = Math.max(r.x, Math.min(L.ax, r.x + r.w)), ny = Math.max(r.y, Math.min(L.ay, r.y + r.h)), d = Math.hypot(nx - L.ax, ny - L.ay);
  if (d < 2 || (!L.always && d < 13 * L.k)) return "";
  const mx = Math.abs(nx - L.ax) > Math.abs(ny - L.ay) ? [L.ax + Math.sign(nx - L.ax) * Math.abs(ny - L.ay), ny] : [nx, L.ay + Math.sign(ny - L.ay) * Math.abs(nx - L.ax)];
  return `<path d="M${R(L.ax)} ${R(L.ay)}L${R(mx[0])} ${R(mx[1])}L${R(nx)} ${R(ny)}" stroke="${L.accent}" stroke-width="${R(0.8 * L.k)}" fill="none" opacity=".85"/><circle cx="${R(L.ax)}" cy="${R(L.ay)}" r="${R(1.6 * L.k)}" fill="${L.accent}"/>`;
}

export function place(B) {
  const { vb } = B;
  const inside = (L) => L.fixed || (L.ax >= vb[0] && L.ax <= vb[0] + vb[2] && L.ay >= vb[1] && L.ay <= vb[1] + vb[3]);
  const G = grid();
  for (const o of B.obst) G.add(Object.assign({ wt: 1 }, o));
  for (const p of B.people) G.add({ x: p.x - 8, y: p.y - p.h - 4, w: 16, h: p.h + 4, wt: 0.3, soft: true });
  const out = [];
  for (const L of [...B.labels].filter(inside).sort((a, b) => b.prio - a.prio)) {
    let best = null;
    for (const reach of L.fixed ? [0] : L.optional ? [L.near ?? 96] : [L.near ?? 96, 220]) {
      const cs = L.fixed ? [[L.dx, L.dy]] : candidates(L, reach);
      let bs = Infinity;
      best = null;
      for (let i = 0; i < cs.length; i++) {
        const r = { x: L.ax + cs[i][0], y: L.ay + cs[i][1], w: L.w, h: L.h };
        let ov = 0, hard = 0;
        for (const p of G.near(r)) { const a = inter(r, p); if (a) { ov += a * p.wt; if (!p.soft) hard += a } }
        if (r.x < vb[0] + 4 || r.y < vb[1] + 4 || r.x + r.w > vb[0] + vb[2] - 4 || r.y + r.h > vb[1] + vb[3] - 4) ov += 1e6;
        if (hard) continue;
        const sc = ov * 4 + i * 1.5;
        if (sc < bs) { bs = sc; best = { r, ov, hard } }
        if (!ov) break;
      }
      if (best && best.ov < 1e6) break;
    }
    if (!best || best.ov >= 1e6) { B.dropped = (B.dropped ?? 0) + 1; continue }
    L.r = best.r;
    G.add({ ...best.r, wt: 1 });
    out.push(L);
  }
  const svgs = out.sort((a, b) => a.prio - b.prio).map((L) => leader(L) + `<g transform="translate(${R(L.r.x)} ${R(L.r.y)})${L.k !== 1 ? ` scale(${R(L.k * 100) / 100})` : ""}">${L.draw()}</g>`);
  return { svg: svgs.join(""), svgs, placed: out };
}

export function tagLabel(B, a, s, state, o = {}) {
  const name = clip(s.title, o.max ?? 26), lab = o.bare || o.mini ? "" : T.state[state], c = STATE_COLOR[state];
  const fs = o.mini ? 8 : 9.4, h = o.mini ? 12.5 : 15;
  const w = R(tw(name, fs) + (lab ? tw(lab, 6, "cx", 0.9) + 27 : 15));
  addLabel(B, { ax: a[0], ay: a[1], w, h, dy: o.dy ?? 6, prio: PRIO[state] + (o.boost ?? 0), accent: c, sid: s.id, optional: o.optional, near: o.near, room: o.room, kind: "tag",
    draw: () => `<rect width="${w}" height="${h}" rx="2.4" fill="#070a12" fill-opacity=".93" stroke="${c}" stroke-width=".8" stroke-opacity=".85"/><rect x="1.2" y="1.2" width="3" height="${R(h - 2.4)}" rx="1.2" fill="${c}"/><text x="8" y="${o.mini ? 9.2 : 10.9}" class="cx" font-size="${fs}" fill="#f2f6ff"${fit(name, fs)}>${esc(name)}</text>${lab ? `<text x="${R(w - 6)}" y="10.4" text-anchor="end" class="cs" font-size="6" letter-spacing=".9" fill="${c}"${fit(lab, 6, "cx", 0.9)}>${esc(lab)}</text>` : ""}` });
}
export function alertLabel(B, a, s, state, o = {}) {
  const c = STATE_COLOR[state], ic = ICON[state] ?? "✓";
  const head = T.bubble[state], detail = o.brief ? "" : clip(s.detail || "", 46);
  const w = R(Math.max(tw(head, 10.4), detail ? tw(detail, 7.6, "cs") : 0) + 38), h = detail ? 32 : 22;
  addLabel(B, { ax: a[0], ay: a[1] - 60, w, h, dx: 10, dy: -h - 12, prio: PRIO[state] + 1, accent: c, always: true, sid: s.id, room: o.room, kind: "alert",
    draw: () => `<path d="M3 0h${R(w - 11)}l8 8v${h - 11}a3 3 0 0 1-3 3h${-(w - 6)}a3 3 0 0 1-3-3v${-(h - 6)}a3 3 0 0 1 3-3z" fill="${drk(c, 0.9)}" fill-opacity=".95" stroke="${c}" stroke-width="1.2"/><rect x="5" y="4" width="14" height="14" rx="2" fill="${c}"/><text x="12" y="15.6" text-anchor="middle" class="cx" font-size="12.5" fill="#06070c">${ic}</text><text x="25" y="15" class="cx" font-size="10.4" fill="${lit(c, 0.25)}"${fit(head, 10.4)}>${esc(head)}</text>${detail ? `<text x="25" y="26.5" class="cs" font-size="7.6" fill="#f4f6ff"${fit(detail, 7.6, "cs")}>${esc(detail)}</text>` : ""}` });
}
export function traceLabel(B, a, s, c, o = {}) {
  const tr = (s.traces ?? []).slice(-3);
  if (!tr.length) return;
  const rows = tr.map((t) => [t.tool, clip(t.text, 46)]);
  const w = R(Math.max(60, ...rows.map(([tool, txt]) => tw(tool + " › " + txt, 7.4, "mo"))) + 22), h = 17 + rows.length * 11;
  addLabel(B, { ax: a[0] + 2, ay: a[1] - 32, w, h, dx: 18, dy: -h - 34, prio: 7, accent: c, always: true, sid: s.id, room: o.room, kind: "trace", optional: true,
    draw: () => `<path d="M2 0h${w - 2}v${h - 6}l-6 6h${-(w - 8)}a2 2 0 0 1-2-2v${-(h - 4)}a2 2 0 0 1 2-2z" fill="#03101a" fill-opacity=".92" stroke="${c}" stroke-width=".8"/><path d="M0 1h46" stroke="${c}" stroke-width="2.4"/><text x="8" y="10" class="cs" font-size="6.4" letter-spacing="1.4" fill="${c}">${esc(T.liveTrace)}</text><circle cx="${w - 8}" cy="7.6" r="1.8" fill="#ff2340"/>${rows.map(([tool, txt], i) => `<text x="8" y="${21 + i * 11}" class="mo" font-size="7.4" fill="${i === rows.length - 1 ? "#ffffff" : "#90a6c8"}"><tspan fill="${c}">${esc(tool)}</tspan> › ${esc(txt)}</text>`).join("")}` });
}
export function chipLabel(B, a, txt, c, prio, o = {}) {
  const size = o.size ?? 6.4, kind = o.kind ?? "cx", ls = o.ls ?? 0.4, w = R(tw(txt, size, kind, ls) + 10), h = R(size + 5);
  addLabel(B, Object.assign({ ax: a[0], ay: a[1], w, h, prio, accent: c,
    draw: () => `<rect width="${w}" height="${h}" rx="1.6" fill="#04060b" fill-opacity=".88" stroke="${c}" stroke-width=".5"/><text x="${R(w / 2)}" y="${R(size + 1.2)}" text-anchor="middle" class="${kind}" font-size="${size}" letter-spacing="${ls}" fill="${o.fill ?? c}"${kind === "mo" ? "" : fit(txt, size, kind, ls)}>${esc(txt)}</text>` }, o.extra ?? {}));
}
export function panelLabel(B, a, lines, c, prio, o = {}) {
  const w = R(Math.max(...lines.map((t) => tw(t, 7.2, "mo"))) + 16), h = 8 + lines.length * 11;
  addLabel(B, { ax: a[0], ay: a[1], w, h, dx: -w / 2, dy: -h - 8, prio, accent: c, kind: "panel", room: o.room,
    draw: () => `<rect width="${w}" height="${h}" rx="2" fill="${drk(c, 0.9)}" fill-opacity=".9" stroke="${c}" stroke-width=".8"/>${lines.map((t, i) => `<text x="8" y="${12.6 + i * 11}" class="mo" font-size="7.2" fill="${lit(c, 0.2)}">${esc(t)}</text>`).join("")}` });
}

function plateText(r, model) {
  const t = T.plate;
  if (r.kind === "project") {
    const p = r.project, desk = p.desk.length;
    return [p.name, [desk ? t.desk(desk) : "", p.party ? t.party(p.party) : "", p.cryo ? t.frozen(p.cryo) : ""].filter(Boolean).join(" · ") || t.empty];
  }
  const c = model.counts ?? {};
  if (r.kind === "ramen") return [r.name, t.ramen(c.cafe ?? 0)];
  if (r.kind === "bunker") return [r.name, t.bunker(c.lounge ?? 0)];
  if (r.kind === "cryo") return [r.name, t.cryo(c.cryo ?? 0)];
  if (r.kind === "server") return [r.name, model.system ? t.server(Math.round(model.system.cpu), model.docker?.list?.length ?? 0) : t.noSensors];
  if (r.kind === "cctv") return [r.name, t.cctv];
  return [r.name, ""];
}
export function plateLabel(B, r, model) {
  const [name, sub] = plateText(r, model);
  const c = r.kind === "project" ? r.project.neon : r.neon, dim = r.kind === "project" && !r.project.lit;
  const w = R(Math.max(tw(name, 13, "cx", 1.2), sub ? tw(sub, 8.8, "cs") : 0) + 20), h = sub ? 33 : 21;
  const a = P(r.x + r.w * 0.42, r.y, 56);
  const waiting = r.kind === "project" ? r.project.desk.length : 0;
  addLabel(B, { ax: a[0], ay: a[1], w, h, k: B.k, dx: -w / 2, dy: -h - 5, near: 40, prio: 9.5 + (waiting ? 0.01 : 0), accent: c, kind: "plate", room: r.key, rid: r.key,
    draw: () => `<path d="M3 0h${R(w - 10)}l7 7v${h - 10}a3 3 0 0 1-3 3h${-(w - 6)}a3 3 0 0 1-3-3v${-(h - 6)}a3 3 0 0 1 3-3z" fill="#04060b" fill-opacity=".9" stroke="${c}" stroke-width="1"${dim ? ' stroke-opacity=".5"' : ""}/><rect x="3" width="${R(w - 13)}" height="2.4" fill="${c}"${dim ? ' opacity=".5"' : ""}/><text x="10" y="16" class="cx" font-size="13" letter-spacing="1.2" fill="${dim ? "#8a96ad" : "#f2f7ff"}"${fit(name, 13, "cx", 1.2)}>${esc(name)}</text>${sub ? `<text x="10" y="27.4" class="cs" font-size="8.8" fill="${dim ? "#6a7690" : lit(c, 0.2)}"${fit(sub, 8.8, "cs")}>${esc(sub)}</text>` : ""}` });
}

export function labelsFor(world, model, L, o) {
  const { vb, k, tier } = o;
  const B = newBoard(vb, k);
  B.obst = world.obst.map((b) => ({ ...b }));
  B.people = world.people;
  for (const m of world.marks) {
    if ((m.tier ?? 0) > tier) continue;
    if (m.kind === "tag") tagLabel(B, m.a, m.s, m.state, { room: m.room, mini: m.mini, max: m.max, optional: m.optional, dy: m.dy, near: m.near });
    else if (m.kind === "alert") alertLabel(B, m.a, m.s, m.state, { room: m.room, brief: tier === 0 });
    else if (m.kind === "trace") traceLabel(B, m.a, m.s, m.color, { room: m.room });
    else if (m.kind === "chip") chipLabel(B, m.a, m.text, m.color, m.prio ?? 1, { size: m.size, kind: m.cls, ls: m.ls, fill: m.fill, extra: { room: m.room, optional: m.optional, ...(m.dy != null ? { dy: m.dy } : {}) } });
    else if (m.kind === "panel") panelLabel(B, m.a, m.lines, m.color, m.prio ?? 5, { room: m.room });
  }
  if (tier === 0) {
    B.labels = [];
    for (const r of L.rooms) plateLabel(B, r, model);
  }
  const placed = place(B);
  const targets = [];
  for (const l of placed.placed) {
    if (l.sid) targets.push({ kind: "session", id: l.sid, z: 4, box: [l.r.x, l.r.y, l.r.x + l.r.w, l.r.y + l.r.h] });
    else if (l.rid) targets.push({ kind: "room", id: l.rid, z: 2, box: [l.r.x, l.r.y, l.r.x + l.r.w, l.r.y + l.r.h] });
  }
  return { body: placed.svg, bodies: placed.svgs, targets, count: placed.placed.length, dropped: B.dropped ?? 0 };
}
