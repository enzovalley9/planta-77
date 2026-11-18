import { clip, bbox } from "./util.mjs";

export const WH = 56, WT = 6;
export const STATE_COLOR = { work: "#39ff88", turn: "#fcee0a", perm: "#ff8a3d", ask: "#22e4ff", idle: "#8fa3c7", doze: "#6a7aa8", cafe: "#ff3b5c", lounge: "#c06bff", cryo: "#7fd8ff" };
export const PRIO = { perm: 9, ask: 8.6, turn: 8, work: 6, idle: 4, doze: 3, cafe: 2, lounge: 1.5, cryo: 0.5 };
export const TIER_FAR = 0, TIER_FLOOR = 1, TIER_ROOM = 2;

export function newCtx(model, L, o = {}) {
  return {
    model, L, th: o.theme, lod: o.lod ?? 1,
    byId: new Map(model.sessions.map((s) => [s.id, s])),
    S: [], F: [], targets: [], marks: [], obst: [], people: [], sizes: {},
  };
}

export function person(ctx, s, a, h, room, o = {}) {
  const w = o.w ?? 10;
  ctx.people.push({ id: s?.id ?? null, x: a[0], y: a[1], h, room });
  if (!s) return;
  ctx.targets.push({ kind: "session", id: s.id, box: [a[0] - w, a[1] - h - 5, a[0] + w, a[1] + 4], z: 3, label: clip(s.title, 40), color: STATE_COLOR[s.state], room });
}
export function roomTarget(ctx, r, name, color, poly) {
  ctx.targets.push({ kind: "room", id: r.key, poly, z: 1, label: name, color, room: r.key });
}
export function mark(ctx, m) { ctx.marks.push(m) }
export function obstacle(ctx, points, wt = 0.5) { ctx.obst.push(bbox(points, wt)) }
