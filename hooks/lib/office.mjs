import { R, P, hash, sq, ago, clip, esc, drk } from "./util.mjs";
import { layout, floorPoly } from "./layout.mjs";
import { buildParts, layerOf, packBodies, buildingBox, themeFor, wrap, FONT_CSS } from "./world.mjs";
import { labelsFor } from "./labels.mjs";
import { STATE_COLOR, PRIO } from "./ctx.mjs";
import { WAITING } from "./states.mjs";
import { T } from "./strings.mjs";

export const CHUNK = 45000, TIER_CHUNK = 84000, CLIENT_MAX = 94000, COMPAT_BUDGET = 232000;
export const LABEL_P0 = 0.22, LABEL_STEP = 1.7, LABEL_BUCKETS = 6, LABEL_PX = 10.5, LABEL_K_MAX = 2.7;

export const revOf = (s) => hash(s).toString(36) + s.length.toString(36);
const local = (svg) => sq(svg).replace("preserveAspectRatio='none'", "preserveAspectRatio='xMinYMin meet'");
const r1 = (v) => Math.round(v * 10) / 10;

export function aspectStep(a) { return Math.max(0.6, Math.min(3, Math.round((Number.isFinite(a) ? a : 1.6) * 10) / 10)) }
export function worldRect(L) {
  const bb = buildingBox(L);
  return { x: bb.x - 30, y: bb.y - 120, w: bb.w + 60, h: bb.h + 150 };
}
export function baseFor(L, aspect) {
  const r = worldRect(L);
  let w = r.w, h = r.h;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) * 0.64, w, h };
}
export function roomRect(r) {
  const sc = r.screen;
  return [r1(sc.x - 30), r1(sc.y - 74), r1(sc.w + 60), r1(sc.h + 104)];
}
const roomName = (r) => (r.kind === "project" ? r.project.name : r.name);
const roomNeon = (r) => (r.kind === "project" ? r.project.neon : r.neon);

export function bucketOf(p) {
  return Math.max(0, Math.min(LABEL_BUCKETS - 1, Math.round(Math.log(Math.max(0.01, p) / LABEL_P0) / Math.log(LABEL_STEP))));
}
export function bucketSpec(b) {
  const p = LABEL_P0 * Math.pow(LABEL_STEP, b);
  return { p, k: Math.min(LABEL_K_MAX, LABEL_PX / (9.4 * p)), tier: p < 0.8 ? 0 : p < 1.3 ? 1 : 2 };
}

const miniBox = (L) => { const r = worldRect(L); return [r.x, r.y + 70, r.w, r.h - 70].map(r1) };
function miniMap(model, L, vb) {
  let s = "";
  for (const r of L.rooms) {
    const c = roomNeon(r), lit = r.kind !== "project" || r.project.lit;
    s += `<polygon points="${floorPoly(r).map((p) => R(p[0]) + "," + R(p[1])).join(" ")}" fill="${lit ? drk(c, 0.55) : "#1a2030"}" stroke="${lit ? c : "#3a445c"}" stroke-width="${lit ? 9 : 6}" stroke-linejoin="round"/>`;
  }
  return sq(wrap(vb, "", s)).replace("preserveAspectRatio='none'", "preserveAspectRatio='xMinYMin meet'");
}

function sessionInfo(model, L, w) {
  const roomOf = new Map();
  for (const t of w.targets) if (t.kind === "session") roomOf.set(t.id, t.room);
  const names = new Map(L.rooms.map((r) => [r.key, roomName(r)]));
  const info = {};
  for (const s of model.sessions) {
    if (!roomOf.has(s.id)) continue;
    const tr = s.traces?.length ? s.traces[s.traces.length - 1] : null;
    info[s.id] = {
      t: clip(s.title, 64), s: s.state, c: STATE_COLOR[s.state], r: roomOf.get(s.id), rn: names.get(roomOf.get(s.id)) ?? "",
      p: model.projects.find((p) => p.key === s.project)?.name ?? "", d: clip(s.detail || "", 110), a: ago(model.at - s.last),
      tr: tr ? clip(`${tr.tool} › ${tr.text}`, 90) : "", n: s.subagents || 0,
    };
  }
  return info;
}

export function buildScene(model, o = {}) {
  const L = o.L ?? layout(model), th = o.theme ?? themeFor(o.hour ?? 22), aspect = aspectStep(o.aspect);
  const base = baseFor(L, aspect), vb = [base.x, base.y, base.w, base.h].map(r1);
  const w = buildParts(model, L, { theme: th, lod: 2, vb });
  const layers = [], fxBodies = [], roomFx = [];
  for (const part of w.parts) {
    if (part.f) { if (part.room) roomFx.push(part); else fxBodies.push(part.f) }
    if (!part.s) continue;
    let src = local(layerOf(vb, th, part.s));
    if (JSON.stringify(src).length > CLIENT_MAX && part.room) {
      for (const lod of [1, 0]) {
        const again = buildParts(model, L, { theme: th, lod, vb }).parts.find((p) => p.key === part.key);
        src = local(layerOf(vb, th, again.s));
        if (JSON.stringify(src).length <= CLIENT_MAX) break;
      }
    }
    layers.push({ key: part.key, rev: revOf(src), src, box: part.box ? part.box.map(r1) : null, ...(part.room ? { room: part.key } : {}) });
  }
  packBodies(vb, th, fxBodies, CHUNK).forEach((s, i) => { const src = local(s); layers.push({ key: `fx${i}`, rev: revOf(src), src, box: null, fx: true }) });
  for (const part of roomFx) { const src = local(layerOf(vb, th, part.f)); layers.push({ key: `fx-${part.key}`, rev: revOf(src), src, box: part.box.map(r1), fx: true, room: part.key }) }

  const sessions = [], rooms = [];
  for (const t of w.targets) {
    if (t.kind === "session") sessions.push({ id: t.id, b: t.box.map(r1) });
  }
  for (const r of L.rooms) {
    rooms.push({ id: r.key, kind: r.kind, n: roomName(r), c: roomNeon(r), f: roomRect(r), poly: [P(r.x, r.y, 56), P(r.x + r.w, r.y, 56), P(r.x + r.w, r.y + r.d, 0), P(r.x, r.y + r.d, 0), P(r.x, r.y, 0)].slice(0, 4).map((p) => [r1(p[0]), r1(p[1])]) });
  }
  const info = sessionInfo(model, L, w);
  const queue = model.sessions.filter((s) => WAITING.has(s.state) && info[s.id]).sort((a, b) => PRIO[b.state] - PRIO[a.state] || b.last - a.last).map((s) => s.id);
  return {
    vb, aspect, theme: th.name, th, L, w, layers, sessions, rooms, info, queue, mini: miniMap(model, L, miniBox(L)), mb: miniBox(L), labels: {},
    counts: model.counts ?? {}, total: model.sessions.length, sizes: w.sizes,
  };
}

export function tierLayers(scene, model, lod) {
  if (lod >= 2) return scene.layers;
  scene.tiers ??= {};
  if (scene.tiers[lod]) return scene.tiers[lod];
  const w = buildParts(model, scene.L, { theme: scene.th, lod, vb: scene.vb });
  const pack = (bodies, tag, fx) => packBodies(scene.vb, scene.th, bodies, TIER_CHUNK).map((body, i) => { const src = local(body); return { key: `${tag}${lod}-${i}`, rev: revOf(src), src, box: null, ...(fx ? { fx: true } : {}) } });
  return (scene.tiers[lod] = [...pack(w.parts.map((p) => p.s), "w", false), ...pack(w.parts.map((p) => p.f), "x", true)]);
}

export function labelLayers(scene, model, bucket) {
  const b = Math.max(0, Math.min(LABEL_BUCKETS - 1, bucket | 0));
  if (scene.labels[b]) return scene.labels[b];
  const spec = bucketSpec(b);
  const lab = labelsFor(scene.w, model, scene.L, { vb: scene.vb, k: spec.k, tier: spec.tier });
  const layers = packBodies(scene.vb, scene.th, lab.bodies, CHUNK).map((s, i) => { const src = local(s); return { key: `lab${i}`, rev: revOf(src), src, box: null, label: true } });
  const targets = lab.targets.map((t) => ({ kind: t.kind, id: t.id, b: t.box.map(r1) }));
  return (scene.labels[b] = { bucket: b, tier: spec.tier, layers, targets, count: lab.count, dropped: lab.dropped });
}

export function buildCompat(model, o = {}) {
  const L = o.L ?? layout(model), th = o.theme ?? themeFor(o.hour ?? 22), aspect = aspectStep(o.aspect);
  const base = baseFor(L, aspect), vb = [base.x, base.y, base.w, base.h].map(r1);
  let out = null;
  for (const lod of [1, 0]) {
    const w = buildParts(model, L, { theme: th, lod, vb });
    const lab = labelsFor(w, model, L, { vb, k: Math.min(LABEL_K_MAX, LABEL_PX / (9.4 * (o.p ?? 0.4))), tier: 0 });
    const layers = packBodies(vb, th, [...w.parts.map((p) => p.s), ...w.parts.map((p) => p.f), ...lab.bodies], 110000);
    out = { vb, aspect, theme: th.name, lod, layers, size: layers.reduce((n, s) => n + s.length, 0), w, L };
    if (out.size <= COMPAT_BUDGET) break;
  }
  return out;
}

export function altText(model, room) {
  const c = model.counts ?? {};
  const head = T.alt.head(model.sessions.length, ["perm", "ask", "turn", "work", "idle", "doze", "cafe", "lounge", "cryo"].filter((k) => c[k]).map((k) => `${c[k]} ${T.state[k].toLowerCase()}`).join(", "));
  if (!room) return head + T.alt.rooms(model.projects.map((p) => p.name).join(", "));
  if (room.kind === "project") return T.alt.project(room.project.name, room.project.desk.length, room.project.party, room.project.cryo);
  return T.alt.room(room.name) + head;
}
export { themeFor, FONT_CSS, esc };
