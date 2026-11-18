import { R, P, hash, lit, drk, clip, tw, esc } from "../util.mjs";
import { quad, onY, onX, halo, pool, rad, fadeDown, glow, at, step, stepMove, blink, frames } from "../kit.mjs";
import { standing, seatedBack, typingFx, bot } from "../chars.mjs";
import { use, cursorFx, camera, cameraFx, wallScreen } from "../props.mjs";
import { shell, front, sign, target, rug } from "./shell.mjs";
import { WH, WT, STATE_COLOR, person, mark } from "../ctx.mjs";
import { lookOf } from "../model.mjs";
import { WAITING } from "../states.mjs";
import { T } from "../strings.mjs";

const ICON = { turn: "✓", perm: "!", ask: "?" };

export function fitList(items, size, maxw) {
  let out = "";
  for (let i = 0; i < items.length; i++) {
    const next = out ? out + " · " + items[i] : items[i], rest = items.length - i - 1;
    if (tw(next + (rest ? ` +${rest}` : ""), size, "mo") > maxw) return (out || clip(items[i], 18)) + ` +${items.length - i - (out ? 0 : 1)}`;
    out = next;
  }
  return out;
}
export function pipeColor(st) { return st === "SUCCESS" ? "#39ff88" : st === "FAILED" ? "#ff3b5c" : st === "RUNNING" || st === "PENDING" ? "#22e4ff" : st === "CANCELED" ? "#8fa3c7" : "#fcee0a" }
export function pipeIcon(st) { return st === "SUCCESS" ? "✔" : st === "FAILED" ? "✖" : st === "RUNNING" ? "▶" : st === "PENDING" ? "…" : st === "CANCELED" ? "⊘" : "●" }
export function dur(q) { const s = q.duration ?? 0; return s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "" }

export function beacon(a, color, icon, phase = 0) {
  const y = a[1] - 62;
  const pin = `<path d="M0 9L-7 -1.6A7.6 7.6 0 1 1 7 -1.6Z" fill="${color}" stroke="#05060b" stroke-width=".9" stroke-linejoin="round"/><text y="-1.6" text-anchor="middle" class="cx" font-size="10" fill="#05060b">${icon}</text>`;
  return `<g transform="translate(${R(a[0])} ${R(y)})"><ellipse cy="-4" rx="15" ry="15" fill="${rad(color)}" opacity=".5"/><g>${pin}${stepMove(["0 0", "0 -3.4"], { phase, ticks: 2 })}</g></g>`;
}
export function ring(a, color, phase = 0) {
  const e = (rx, ry, o, sw) => `<ellipse cx="${R(a[0])}" cy="${R(a[1])}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${o}"/>`;
  return frames([e(15, 6.4, 0.9, 1.4), e(19, 8.2, 0.45, 1)], { phase, ticks: 2 });
}
function gear(a, phase = 0) {
  const g = `<path d="M0 -5.4V5.4M-5.4 0H5.4M-3.8 -3.8L3.8 3.8M-3.8 3.8L3.8 -3.8" stroke="#ff8a3d" stroke-width="2" stroke-linecap="round"/><circle r="2.6" fill="#ff8a3d"/><circle r="1" fill="#05060b"/>`;
  return `<g transform="translate(${R(a[0] + 1)} ${R(a[1] - 52)})"><circle r="10" fill="${rad("#ff8a3d")}" opacity=".6"/><g>${g}${stepMove(["0", "22.5"], { type: "rotate", phase, ticks: 1 })}</g></g>`;
}
function zzz(a, phase = 0) {
  const z = (x, y, size, o) => `<text x="${x}" y="${y}" class="cx" font-size="${size}" fill="#aebbe0" opacity="${o}">z</text>`;
  return `<g transform="translate(${R(a[0] + 9)} ${R(a[1] - 34)})">${frames([z(0, 0, 8, 1) + z(5, -7, 10, 0.5), z(1, -2, 8, 0.6) + z(6, -9, 10, 1)], { phase, ticks: 3 })}</g>`;
}

function station(ctx, r, dx, dy, s, c, i) {
  const st = s ? s.state : "off";
  const away = st === "cafe" || st === "lounge";
  const o = P(dx, dy, 0), tr = `translate(${R(o[0])} ${R(o[1])})`;
  const rel = (u, v, z) => { const p = P(u, v, z); return `${R(p[0])} ${R(p[1])}` };
  const sc = s ? STATE_COLOR[st] : "#1a2233";
  let out = "";
  if (ctx.lod >= 2) {
    const a = P(dx + 6, dy + 4, 0), b = dy - r.y < 60 ? P(dx + 2, r.y + WT, 0) : P(dx - 10, dy - 6, 0);
    out += `<path d="M${R(a[0])} ${R(a[1])}Q${R((a[0] + b[0]) / 2 + 6)} ${R((a[1] + b[1]) / 2 + 3)} ${R(b[0])} ${R(b[1])}" stroke="#05070c" stroke-width="1.6" fill="none"/>`;
  }
  out += `<ellipse cx="${R(P(dx + 21, dy + 13, 0)[0])}" cy="${R(P(dx + 21, dy + 13, 0)[1] + 2)}" rx="34" ry="13" fill="#000" opacity=".28"/>`;
  let g = `<use href="#dk"/><use href="#s-${st}"/>${ctx.lod >= 1 ? '<use href="#kb"/>' : ""}`;
  if (s && !away && ctx.lod >= 2) g += `<use href="#mug"/>`;
  if (s && st !== "doze") { const p = P(21, 15, 17.6); g += `<ellipse cx="${R(p[0])}" cy="${R(p[1])}" rx="26" ry="10" fill="${rad(sc)}" opacity="${st === "work" ? 0.5 : 0.3}"/>` }
  const chairAt = (cx) => `<use href="#ch" transform="translate(${rel(cx, 0, 0)})"/>`, backAt = (cx) => `<use href="#cb" transform="translate(${rel(cx, 0, 0)})"/>`;
  out += `<g transform="${tr}" style="--c:${c}">${g}`;
  if (!s || away) return out + chairAt(24) + backAt(24) + "</g>";
  out += chairAt(15) + "</g>";
  const L = lookOf(s.id), ph = hash(s.id) % 4;
  if (!WAITING.has(st)) {
    const a = P(dx + 21, dy + 33, 9);
    out += seatedBack(a, L, { typing: st === "work", doze: st === "doze", lean: st === "idle", rim: c });
    out += `<g transform="${tr}" style="--c:${c}">${backAt(15)}</g>`;
    const feet = P(dx + 21, dy + 33, 0);
    mark(ctx, { kind: "tag", a: feet, s, state: st, room: r.key, tier: st === "work" ? 0 : 1 });
    person(ctx, s, a, 34, r.key);
    if (st === "work") {
      mark(ctx, { kind: "trace", a, s, color: c, room: r.key, tier: 1 });
      ctx.F.push(cursorFx(dx, dy), gear(a, ph));
      if (ctx.lod >= 1) ctx.F.push(typingFx(a, L));
    }
    if (st === "doze") ctx.F.push(zzz(a, ph));
  } else {
    out += `<g transform="${tr}" style="--c:${c}">${backAt(15)}</g>`;
    const a = P(dx + 53, dy + 25, 0);
    out += `<rect x="${R(a[0] - 5)}" y="${R(a[1] - 150)}" width="10" height="150" fill="${fadeDown(sc, 0, 0.3)}"/>`;
    out += halo(a, 22, 9.4, sc, 0.75) + `<ellipse cx="${R(a[0])}" cy="${R(a[1])}" rx="15" ry="6.4" fill="${sc}" opacity=".12"/>`;
    out += standing(a, L, { pose: "wave", rim: sc });
    ctx.F.push(ring(a, sc, ph), beacon(a, sc, ICON[st], ph));
    mark(ctx, { kind: "tag", a, s, state: st, room: r.key, tier: 0 });
    mark(ctx, { kind: "alert", a, s, state: st, room: r.key, tier: 0 });
    person(ctx, s, a, 42, r.key, { w: 11 });
  }
  const n = Math.min(3, s.subagents ?? 0);
  for (let k = 0; k < n; k++) out += bot(P(dx - 12, dy + 10 + k * 14, 0), "#ff8a3d");
  if (n) mark(ctx, { kind: "chip", a: P(dx - 12, dy + 10 + (n - 1) * 14, 0), text: T.scene.subagents(s.subagents), color: "#ff8a3d", prio: 4, size: 6.6, dy: 4, room: r.key, tier: 1 });
  return out;
}

function sideBoard(r, c, p) {
  const b = T.scene.board, rows = [[b.desk, p.deskCount ?? 0, "#39ff88"], [b.party, p.party, "#c06bff"], [b.cryo, p.cryo, "#7fd8ff"], [b.total, p.count, "#9fb4d6"]];
  const max = Math.max(1, ...rows.map((x) => x[1]));
  let inner = `<text x="5" y="8" class="cs" font-size="5.6" letter-spacing="1" fill="${c}">${esc(b.title)}</text>`;
  rows.forEach(([l, v, col], i) => { const bw = R(Math.max(1.5, (v / max) * 20)); inner += `<text x="5" y="${16.4 + i * 6.6}" class="mo" font-size="4.6" fill="#9fb4d6">${esc(l)}</text><rect x="34" y="${12.6 + i * 6.6}" width="${bw}" height="3.8" fill="${col}" opacity=".9"/><text x="${R(37 + bw)}" y="${16.4 + i * 6.6}" class="mo" font-size="4.8" fill="${col}">${v}</text>` });
  return wallScreen(r.x + WT + 0.2, r.y + r.d - 30, 49, 72, 38, c, inner, { axis: "x" });
}

function pipesBoard(ctx, r, c, pipes) {
  const w = 172, h = 12 + pipes.length * 7.2, x = r.x + r.w - w - 22;
  const rows = pipes.map((q, i) => `<text x="6" y="${R(17 + i * 7.2)}" class="mo" font-size="5.2" fill="#d6e6ff"><tspan fill="${pipeColor(q.status)}">${pipeIcon(q.status)}</tspan> ${esc(clip(q.project, 18))} ${esc(clip(q.branch.replace(/^(feat|fix|feature)\//, ""), 20))} <tspan fill="#8fa3c7">${dur(q)}</tspan></text>`).join("");
  return wallScreen(x, r.y + WT + 0.2, 50, w, h, c, `<text x="6" y="8.4" class="cs" font-size="5.8" letter-spacing="1.2" fill="${c}">PIPELINES</text>` + rows, { bg: "#04121a" });
}

function poster(r, c, k) {
  const x = r.x + r.w - 62 - k * 50, tone = [c, "#ff3df2", "#fcee0a"][k % 3];
  const art = k % 2 ? `<circle cx="16" cy="13" r="8" fill="none" stroke="${tone}" stroke-width="1.6"/><path d="M4 26h24M4 30h16" stroke="${tone}" stroke-width="1.4" opacity=".7"/>` : `<path d="M4 24L12 10L18 18L22 13L28 24Z" fill="${tone}" opacity=".75"/><path d="M4 29h24" stroke="${tone}" stroke-width="1.4" opacity=".7"/>`;
  return onY(x, r.y + WT + 0.2, 46, `<rect width="32" height="34" fill="#0a0f1c" stroke="#2c3650" stroke-width=".8"/>${art}`);
}

export function projectRoom(ctx, r) {
  const p = r.project, c = p.neon, on = p.lit;
  const desk = p.desk.map((id) => ctx.byId.get(id)).filter(Boolean);
  p.deskCount = desk.length;
  const pipes = ctx.lod >= 1 ? ctx.model.pipelines.filter((q) => q.room === p.key).slice(0, 4) : [];
  const wide = r.w >= 420;
  const avail = Math.min(r.w - 50, wide && pipes.length ? r.w - 240 : r.w - 50);
  const sub = [p.path + (p.ai ? T.scene.groupedByAi : ""), ctx.lod < 1 ? "" : p.repos.length ? fitList(p.repos, 5.8, avail - 22) : T.scene.noRepo];
  let s = shell(ctx, r, c, on) + sign(ctx, r, p.name, c, on, sub, { avail });
  if (ctx.lod >= 1) {
    if (r.x !== 0) s += sideBoard(r, c, p);
    if (pipes.length && wide) s += pipesBoard(ctx, r, c, pipes);
    else if (on && r.w - avail > 60) s += poster(r, c, 0);
  }
  const rows = Math.ceil(r.n / r.cols);
  if (on) s += rug(r.x + 18, r.y + 22, Math.min(r.w - 30, r.cols * r.gx + 6), Math.min(r.d - 34, rows * r.gy - 4), c, 0.07);
  const items = [];
  for (let i = 0; i < r.n; i++) {
    const cx = i % r.cols, cy = Math.floor(i / r.cols), dx = r.x + 28 + cx * r.gx, dy = r.y + 30 + cy * r.gy;
    items.push({ k: dx + dy, f: () => station(ctx, r, dx, dy, desk[i], c, i) });
  }
  if (ctx.lod >= 1) {
    items.push({ k: 9e9, f: () => use("plant", P(r.x + r.w - 26, r.y + r.d - 30, 0)) });
    if (r.d >= 190 && r.w >= 240) items.push({ k: r.x + 14 + r.y + r.d - 22, f: () => use("cooler", P(r.x + 14, r.y + r.d - 24, 0)) + use("bin", P(r.x + 28, r.y + r.d - 20, 0)) });
  }
  items.sort((a, b) => a.k - b.k).forEach((it) => { s += it.f() });
  if (ctx.lod >= 0) { s += camera(r.x + 10, r.y + 10, WH - 6); ctx.F.push(cameraFx(r.x + 10, r.y + 10, WH - 6)) }
  s += front(ctx, r, c, on);
  if (desk.length > r.n) mark(ctx, { kind: "chip", a: P(r.x + r.w - 40, r.y + r.d - 14, 0), text: T.scene.moreSessions(desk.length - r.n), color: c, prio: 5, size: 7, room: r.key, tier: 1 });
  if (!on) mark(ctx, { kind: "chip", a: P(r.x + r.w / 2, r.y + r.d / 2 + 20, 10), text: T.scene.powerOff(p.party, p.cryo), color: drk(c, 0.15), prio: 2, size: 7.4, ls: 0.8, dy: 0, room: r.key, tier: 1 });
  target(ctx, r, p.name, c);
  ctx.S.push(s);
}
export { lit, onX, quad, glow, pool, at, step, blink };
