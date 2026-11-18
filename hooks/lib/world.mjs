import { R, P, pruneDefs } from "./util.mjs";
import { autoDefs } from "./kit.mjs";
import { charDefs, CHAR_CSS, LOOK_CSS } from "./chars.mjs";
import { propDefs } from "./props.mjs";
import { backdrop, skyDefs, skyExtras, slab, corridorProps, rainFx, drones, themeFor } from "./building.mjs";
import { newCtx, WH } from "./ctx.mjs";
import { projectRoom } from "./rooms/project.mjs";
import * as serverMod from "./rooms/server.mjs";
import * as ramenMod from "./rooms/ramen.mjs";
import * as bunkerMod from "./rooms/bunker.mjs";
import * as cctvMod from "./rooms/cctv.mjs";
import * as cryoMod from "./rooms/cryo.mjs";

export const MAX_SVG = 131072, LAYER_BUDGET = 124000, OUT_W = 2400;
export const FONT_CSS = `.cx{font-family:'Ubuntu Sans','Ubuntu','Inter','Segoe UI',system-ui,sans-serif;font-stretch:75%;font-weight:800}.cs{font-family:'Ubuntu Sans','Ubuntu','Inter','Segoe UI',system-ui,sans-serif;font-stretch:75%;font-weight:600}.mo{font-family:'Ubuntu Sans Mono','Ubuntu Mono','JetBrains Mono',ui-monospace,monospace}.jp{font-family:'Noto Sans CJK JP','Hiragino Sans','Yu Gothic',sans-serif;font-weight:900}`;

const MODS = { server: serverMod, ramen: ramenMod, bunker: bunkerMod, cctv: cctvMod, cryo: cryoMod };
const ROOMS = { project: projectRoom, ...Object.fromEntries(Object.entries(MODS).map(([k, m]) => [k, m[`${k}Room`]])) };
const roomDefs = () => Object.values(MODS).map((m) => (typeof m.defs === "function" ? m.defs() : "")).join("");

export function buildingBox(L) {
  const X0 = -20, X1 = L.width + 20, Y0 = -20, Y1 = L.depth + 20;
  const c = [P(X0, Y0, WH), P(X1, Y0, WH), P(X0, Y1, 0), P(X1, Y1, 0), P(X0, Y1, -24), P(X1, Y1, -24)];
  const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function wrap(vb, defs, body, o = {}) {
  const w = o.width ?? OUT_W, h = R(w * vb[3] / vb[2]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(R).join(" ")}" width="${w}" height="${h}" preserveAspectRatio="none"><defs>${defs}</defs>${body}</svg>`;
}

function symbolDefs(th) {
  return `<style>${FONT_CSS}${CHAR_CSS}${LOOK_CSS}</style>${skyDefs(th)}${charDefs()}${propDefs()}${roomDefs()}`;
}
export function layerOf(vb, th, body, o = {}) {
  const defs = pruneDefs(symbolDefs(th), body) + autoDefs(body);
  return wrap(vb, defs, body, o);
}

const pad = (sc, l, t, r, b) => [sc.x - l, sc.y - t, sc.x + sc.w + r, sc.y + sc.h + b];

export function buildParts(model, L, o = {}) {
  const th = o.theme ?? themeFor(o.hour ?? 22), lod = o.lod ?? 2, vb = o.vb;
  const ctx = newCtx(model, L, { theme: th, lod });
  const parts = [];
  const sky = skyExtras(vb, th, lod, model);
  parts.push({ key: "sky", s: backdrop(vb, th, lod) + sky.s, f: sky.f, box: null });
  parts.push({ key: "slab", s: slab(model, L, th, lod), f: "", box: null });
  L.rows.forEach((row, ri) => {
    for (const r of row) {
      ctx.S = []; ctx.F = [];
      ctx.lod = o.lodOf ? o.lodOf(r) : lod;
      (ROOMS[r.kind] ?? projectRoom)(ctx, r);
      const s = ctx.S.join("");
      parts.push({ key: r.key, room: r.key, s, f: ctx.F.join(""), box: pad(r.screen, 90, 130, 90, 70) });
      ctx.sizes[r.key] = s.length;
    }
    ctx.lod = lod;
    const cp = corridorProps(L, ri, lod);
    if (cp.s || cp.f) parts.push({ key: `corr${ri}`, s: cp.s, f: cp.f, box: null });
  });
  if (lod >= 1) { const d = drones(L); parts.push({ key: "drones", s: d.s, f: d.f, box: null }) }
  if (th.rain && lod >= 1 && o.rain !== false) parts.push({ key: "rain", s: "", f: rainFx(vb), box: null });
  return { vb, theme: th, lod, parts, targets: ctx.targets, marks: ctx.marks, obst: ctx.obst, people: ctx.people, byId: ctx.byId, sizes: ctx.sizes };
}

export function packBodies(vb, th, bodies, budget) {
  const out = [];
  let cur = "";
  for (const b of bodies) {
    if (!b) continue;
    if (cur && layerOf(vb, th, cur + b).length > budget) { out.push(layerOf(vb, th, cur)); cur = "" }
    cur += b;
  }
  if (cur) out.push(layerOf(vb, th, cur));
  return out;
}

export function buildWorld(model, L, o = {}) {
  const w = buildParts(model, L, o), th = w.theme, vb = w.vb;
  const layers = packBodies(vb, th, w.parts.map((p) => p.s), o.budget ?? LAYER_BUDGET);
  const fxBody = w.parts.map((p) => p.f).join("");
  return { ...w, layers, fx: fxBody ? layerOf(vb, th, fxBody) : null, over: layers.some((s) => s.length > MAX_SVG) };
}
export { themeFor };
