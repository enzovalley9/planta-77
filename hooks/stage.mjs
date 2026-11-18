const RHO = 2.4, CH_PX = 7.8, P_MAX = 4.6, CAP_CH = 440, TALL = 1000, TREE_MAX = 93000, CAL_CH = 2000;
const PAGES = 5, PAGE_MAX = 88000, UI_MAX = 94000, MSG_MAX = 270, MSG_HARD = 360, LOD_P = [0.5, 0.95];
const POST_GAP = 90;
const DOUBLE_MS = 420, SWAP_MS = 320, ZOOM_STEP = 1.6, WHEEL_STEP = 1.3, KEY_PAN = 0.22, NEED_RETRY = 2500, SESSION_P = 0.78, ROOM_HOVER_P = 1.15;
const INK = "#05060b", PANEL = "rgba(7,9,18,.86)", LINE = "rgba(120,150,210,.28)", CYAN = "#22e4ff", TXT = "#e9f1ff", DIM = "#8fa3c7";
const FONT = "font-family:inherit", MONO = "font-family:'Ubuntu Sans Mono','Ubuntu Mono',ui-monospace,monospace";

const G = {
  src: new Map(), pg: new Map(), ld: new Map(), plan: [], host: [], used: 0, lod: -1, uiLen: 24000, sent: [], uiDirty: false, ui: null, P: null, cam: null, tw: null, drag: null, hover: null, ptr: null, stop: null,
  frame: 0, cmdSeq: null, wheelSeq: null, pulse: null, help: false, hint: true, hud: [], cols: 0, rows: 0, vbKey: "", lastClick: null,
  bucket: -1, bucketAt: 0, sentBucket: -1, dirty: false, press: null, atHome: true, calRho: 0,
};

const now = () => Date.now();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const f2 = (v) => Math.round(v * 100) / 100;
const RAW = typeof document !== "undefined";
let EL = null;
const plain = (kids) => kids.map((k) => (typeof k === "string" ? EL.Text({ children: k }) : k));
const div = (style, children = []) => (RAW ? { type: "div", props: { style }, children } : EL.Box({ children: plain(children) }));
const span = (style, text) => (RAW ? { type: "span", props: { style }, children: [String(text)] } : EL.Text({ children: String(text) }));
const group = (style, children) => (RAW ? { type: "span", props: { style }, children } : EL.Box({ children }));
const ch = (v) => `calc(${f2(v)} * 1ch)`;
const lh = (v) => `calc(${f2(v)} * 1lh)`;

const rho = () => G.calRho || (G.P && G.P.rho > 1 ? G.P.rho : RHO);
const stageW = () => G.cols;
const stageH = () => G.rows * rho();
function limits() {
  const v = G.P.vb, sMin = Math.max(stageW() / v[2], stageH() / v[3]);
  return { sMin, sMax: Math.max(sMin * 1.2, P_MAX / CH_PX) };
}
export function clampCam(c) {
  const v = G.P.vb, { sMin, sMax } = limits(), s = clamp(c.s, sMin, sMax), vw = stageW() / s, vh = stageH() / s;
  return {
    s,
    cx: vw >= v[2] ? v[0] + v[2] / 2 : clamp(c.cx, v[0] + vw / 2, v[0] + v[2] - vw / 2),
    cy: vh >= v[3] ? v[1] + v[3] / 2 : clamp(c.cy, v[1] + vh / 2, v[1] + v[3] - vh / 2),
  };
}
const homeCam = () => { const v = G.P.vb; return clampCam({ cx: v[0] + v[2] / 2, cy: v[1] + v[3] / 2, s: 0 }) };
const viewOf = (c) => { const vw = stageW() / c.s, vh = stageH() / c.s; return [c.cx - vw / 2, c.cy - vh / 2, vw, vh] };
const frameCam = (r, pad = 1) => clampCam({ cx: r[0] + r[2] / 2, cy: r[1] + r[3] / 2, s: Math.min(stageW() / (r[2] * pad), stageH() / (r[3] * pad)) });
const toWorld = (col, row, c = G.cam) => { const v = viewOf(c); return [v[0] + col / c.s, v[1] + (row * rho()) / c.s] };
const toCh = (wx, wy, c = G.cam) => { const v = viewOf(c); return [(wx - v[0]) * c.s, (wy - v[1]) * c.s] };
const pxPerUnit = (c = G.cam) => c.s * CH_PX;
const near = (a, b) => Math.abs(a.cx - b.cx) * a.s < 0.05 && Math.abs(a.cy - b.cy) * a.s < 0.05 && Math.abs(a.s / b.s - 1) < 0.002;
const ease = (t) => 1 - Math.pow(1 - t, 3);

function flyTo(to, dur = 420) {
  const target = clampCam(to);
  if (near(G.cam, target)) return;
  G.drag = null;
  G.tw = { kind: "fly", from: { ...G.cam }, to: target, t0: now(), dur };
  kick();
}
function zoomAt(col, row, factor, dur = 220) {
  const base = G.tw && G.tw.kind === "zoom" ? G.tw.to : G.cam;
  const { sMin, sMax } = limits(), s = clamp(base.s * factor, sMin, sMax);
  const a = toWorld(col, row);
  G.drag = null;
  G.tw = { kind: "zoom", a, from: { ...G.cam }, to: { s }, t0: now(), dur };
  kick();
}
function stepTween(t) {
  const w = G.tw, u = ease(clamp((t - w.t0) / w.dur, 0, 1));
  const s = w.from.s * Math.pow(w.to.s / w.from.s, u);
  if (w.kind === "zoom") G.cam = clampCam({ s, cx: w.a[0] + (w.from.cx - w.a[0]) * (w.from.s / s), cy: w.a[1] + (w.from.cy - w.a[1]) * (w.from.s / s) });
  else G.cam = clampCam({ s, cx: w.from.cx + (w.to.cx - w.from.cx) * u, cy: w.from.cy + (w.to.cy - w.from.cy) * u });
  if (u >= 1) G.tw = null;
}

function visible(box, c = G.cam) {
  if (!box) return true;
  const v = viewOf(c);
  return box[0] < v[0] + v[2] && box[2] > v[0] && box[1] < v[1] + v[3] && box[3] > v[1];
}
const IDLE_MS = 100;
function sent(n = 1) {
  const t = now(), q = G.sent;
  for (let i = 0; i < n; i++) q.push(t);
  while (q.length && t - q[0] >= 1000) q.shift();
  if (q.length > (G.msgPeak ?? 0)) G.msgPeak = q.length;
}
const msgs = () => { const t = now(), q = G.sent; while (q.length && t - q[0] >= 1000) q.shift(); return q.length };
function set(surface, state) {
  if (msgs() >= MSG_HARD) { G.dirty = true; G.uiDirty = true; return }
  sent(2);
  surface.setState(state);
}
const post = (surface, data) => { sent(); surface.post(data) };
function say(data) {
  const t = now();
  G.out ??= [];
  if (!G.out.length && !G.said && t - (G.outAt ?? 0) >= (RAW ? POST_GAP : 0)) {
    G.outAt = t; G.said = true;
    Promise.resolve().then(() => { G.said = false });
    post(G.ui, data);
    return;
  }
  if (data.kind === "view") G.out = G.out.filter((x) => x.kind !== "view");
  G.out.push(data);
  kick();
}
const every = (surface, ms, fn) => { sent(); const stop = surface.every(ms, fn); return () => { sent(); stop() } };
const refresh = () => { if (G.ui) set(G.ui, { f: ++G.frame }) };
const nudge = () => { G.uiDirty = true; kick() };
function poke(n) {
  const pg = G.pg.get(n);
  if (!pg) return;
  pg.want = G.frame;
  if (!pg.keep) pg.keep = every(pg.surface, 16, () => {
    if (pg.want !== pg.done) { pg.done = pg.want; set(pg.surface, { f: pg.want }) }
    else if (!G.stop && pg.keep) { pg.keep(); pg.keep = null }
  });
}
function rest() {
  if (G.stop) { G.stop(); G.stop = null }
  for (const pg of G.pg.values()) if (pg.keep && pg.want === pg.done) { pg.keep(); pg.keep = null }
  G.idleAt = 0;
}
const camMode = () => !!G.P && G.P.mode === "cameras";
const lodOf = (p) => (p < LOD_P[0] ? 0 : p < LOD_P[1] ? 1 : 2);
function wantLod() {
  if (camMode()) return 2;
  const p = pxPerUnit(), raw = lodOf(p);
  if (G.lod < 0 || (raw !== G.lod && lodOf(p * 1.07) !== G.lod && lodOf(p / 1.07) !== G.lod)) G.lod = raw;
  if (G.cap && G.cam.s > G.cap * 1.25) G.cap = 0;
  return G.cap ? Math.min(G.lod, 1) : G.lod;
}
const have = (man) => Array.isArray(man) && man.length > 0 && man.every((m) => m.lab || G.src.has(m.id));
function manNow() {
  const P = G.P;
  if (have(P.man) && G.shown !== P.man) {
    G.shown = P.man;
    const ids = new Set(P.man.map((m) => m.id));
    for (const k of [...G.src.keys()]) if (!ids.has(k)) G.src.delete(k);
  }
  return have(P.man) || !have(G.shown) ? P.man ?? [] : [...G.shown.filter((m) => !m.lab), ...P.man.filter((m) => m.lab)];
}
function pack(man, swap) {
  const cams = camMode(), t = now();
  const pages = [[]], sizes = [0];
  const add = (it, len) => {
    const cost = len + 600, i = pages.length - 1;
    if (sizes[i] + cost > PAGE_MAX && pages[i].length) { pages.push([it]); sizes.push(cost) }
    else { pages[i].push(it); sizes[i] += cost }
  };
  for (const m of man) {
    let tile = null;
    if (cams) {
      tile = m.room && G.camL ? G.camL.tiles.get(m.room) : null;
      if (!tile) continue;
    } else if (!visible(m.box)) continue;
    const e = G.src.get(m.id);
    if (!e) continue;
    let extra = "";
    if (m.lab) {
      const off = Number.isInteger(e.bucket) ? Math.abs(bucketNow() - e.bucket) : 0;
      if (off >= 2) continue;
      if (off || e.rev !== m.rev) extra = "opacity:.45";
    }
    const old = swap && e.old && !m.lab && t < e.old.until;
    if (old) add({ src: e.old.src, len: e.old.len, tile, bg: cams && !m.fx, extra }, e.old.len);
    add({ src: e.src, len: e.len, tile, bg: cams && !m.fx && !old, extra }, e.len);
  }
  let host = [];
  const last = pages.length - 1;
  if (!cams && pages[last].length && G.uiLen + sizes[last] + 3000 <= UI_MAX) host = pages.pop();
  return { pages, host };
}
function makePlan() {
  const man = manNow();
  let plan = pack(man, true);
  if (plan.pages.length > PAGES) plan = pack(man, false);
  if (plan.pages.length > PAGES && !camMode() && G.lod === 2 && !G.cap) G.cap = G.cam.s;
  return { pages: plan.pages.slice(0, PAGES), host: plan.host };
}
function paint() {
  G.frame++;
  const plan = makePlan();
  G.plan = plan.pages; G.host = plan.host;
  const used = G.plan.filter((x) => x.length).length, n = Math.max(used, G.used);
  G.used = used;
  for (let i = 0; i < Math.min(PAGES, n); i++) poke(i);
  if (G.ui) set(G.ui, { f: G.frame });
}
function pump() {
  const P = G.P;
  if (!P || !G.cam || !Array.isArray(P.man)) return;
  const t = now(), want = [], flying = new Set();
  G.fail ??= new Map();
  for (const ld of G.ld.values()) {
    if (ld.busy && t - ld.busy.at > NEED_RETRY) { G.fail.set(ld.busy.key, (G.fail.get(ld.busy.key) ?? 0) + 1); ld.busy = null }
    if (ld.busy) flying.add(ld.busy.key);
  }
  for (const m of P.man) {
    const e = G.src.get(m.id);
    if ((e && e.rev === m.rev) || flying.has(m.id) || (G.fail.get(m.id) ?? 0) >= 4) continue;
    if (visible(m.box)) want.unshift(m);
    else want.push(m);
  }
  let held = false;
  for (const ld of G.ld.values()) {
    if (ld.busy || !want.length) continue;
    if (msgs() + 3 > MSG_MAX - 60) { held = true; break }
    const w = want.shift();
    ld.busy = { key: w.id, at: t };
    post(ld.surface, { kind: "need", n: ld.n, id: w.id, rev: w.rev });
  }
  G.pumpAt = want.length || [...G.ld.values()].some((ld) => ld.busy) ? t : 0;
  G.pumpNext = t + (held ? 60 : 400);
}
const loaded = () => { const man = G.P?.man ?? []; return [man.filter((m) => G.src.has(m.id)).length, man.length] };
function kick() {
  if (G.stop || !G.ui) return;
  G.stop = every(G.ui, 16, tick);
}
function tick() {
  if (!G.P || !G.cam) return;
  const t = now();
  let busy = false, cam = false, ui = false;
  if (camMode()) { G.tw = null; G.drag = null }
  if (G.tw) { stepTween(t); busy = true; cam = true }
  if (G.drag && G.drag.target) {
    const d = G.drag, k = d.held ? 0.45 : 0.2;
    const next = clampCam({ s: G.cam.s, cx: G.cam.cx + (d.target.cx - G.cam.cx) * k, cy: G.cam.cy + (d.target.cy - G.cam.cy) * k });
    const still = near(next, G.cam) || (Math.abs(next.cx - d.target.cx) * next.s < 0.04 && Math.abs(next.cy - d.target.cy) * next.s < 0.04);
    const to = still ? clampCam({ ...d.target, s: G.cam.s }) : next;
    if (to.cx !== G.cam.cx || to.cy !== G.cam.cy) { G.cam = to; cam = true }
    if (still && !d.held) G.drag = null;
    else busy = true;
  }
  for (const e of G.src.values()) {
    if (!e.old) continue;
    if (t >= e.old.until) { e.old = null; G.dirty = true }
    else busy = true;
  }
  if (G.pumpAt) { busy = true; if (t >= (G.pumpNext ?? 0)) pump() }
  if (G.out && G.out.length) {
    busy = true;
    if (t - (G.outAt ?? 0) >= (RAW ? POST_GAP : 0)) { G.outAt = t; post(G.ui, G.out.shift()) }
  }
  if (G.uiDirty) { G.uiDirty = false; ui = true }
  const lod = wantLod();
  if (G.pulse) {
    const ph = t > G.pulse.until ? -1 : Math.floor((G.pulse.until - t) / 220);
    if (ph !== G.pulse.ph) { G.pulse.ph = ph; ui = true }
    if (ph < 0) G.pulse = null;
    else busy = true;
  }
  if (G.diag) {
    const d = G.diag;
    busy = true;
    d.ticks++;
    if (t - d.tickAt > d.tickGap) d.tickGap = t - d.tickAt;
    d.tickAt = t;
    while (d.i < d.plan.length && t - d.t0 >= d.plan[d.i][0]) d.plan[d.i++][1]();
  }
  if (G.dirty) { G.dirty = false; cam = true }
  if (G.late) cam = true;
  if (cam) {
    if (msgs() + 2 * (G.used + 1) <= MSG_MAX - (G.pumpAt ? 70 : 0)) { G.late = false; paint() }
    else G.late = true;
  } else if (ui && msgs() + 6 <= MSG_MAX) set(G.ui, { f: ++G.frame });
  else if (ui) G.uiDirty = true;
  if (cam || ui) busy = true;
  const b = camMode() ? G.bucket : bucketNow(), view = `${b}|${lod}`;
  if (view !== G.view) { G.view = view; G.bucket = b; G.bucketAt = t }
  if (G.sentView === view && ((Number.isInteger(G.P.bucket) && G.P.bucket !== b) || (Number.isInteger(G.P.lod) && G.P.lod !== lod)) && t - (G.viewAt ?? 0) > 1500) G.sentView = "";
  if (G.sentView !== view) {
    if (!G.tw && t - G.bucketAt > 120) { G.sentView = view; G.sentBucket = b; G.viewAt = t; say({ kind: "view", bucket: Math.max(0, b), lod }) }
    else busy = true;
  }
  idle(busy, t);
}
function idle(busy, t) {
  if (busy) { G.idleAt = 0; return }
  if (!G.idleAt) G.idleAt = t;
  else if (t - G.idleAt >= IDLE_MS) rest();
}
function startDiag(seq) {
  const rooms = G.P.rooms ?? [], a = rooms[0], b = rooms[rooms.length - 1], t0 = now();
  const d = { seq, t0, i: 0, renders: 0, last: t0, maxGap: 0, gaps: 0, ticks: 0, tickAt: t0, tickGap: 0 };
  d.plan = [
    [0, () => flyTo(homeCam(), 300)],
    [500, () => { d.renders = 0; d.gaps = 0; d.maxGap = 0; d.ticks = 0; d.tickGap = 0; d.last = d.tickAt = d.m0 = now(); if (a) flyTo(frameCam(a.f, 1.02), 900) }],
    [1500, () => { const v = viewOf(G.cam); flyTo({ s: G.cam.s, cx: G.cam.cx + v[2] * 0.6, cy: G.cam.cy + v[3] * 0.4 }, 700) }],
    [2300, () => { if (b) flyTo(frameCam(b.f, 1.02), 900) }],
    [3300, () => flyTo(homeCam(), 800)],
    [4200, () => {
      const ms = now() - d.m0, [ready, total] = loaded();
      say({ kind: "diag", seq, fps: Math.round((d.renders / ms) * 10000) / 10, renders: d.renders, ms, maxGap: d.maxGap, slow: d.gaps, ticks: Math.round((d.ticks / ms) * 10000) / 10, tickGap: d.tickGap, rho: rho(), cal: G.calRho, cols: G.cols, rows: G.rows, layers: `${ready}/${total}`, pages: G.used, lod: G.lod, msgs: G.msgPeak ?? 0, bucket: G.bucket, raw: RAW, hidden: RAW ? document.hidden === true : null });
      G.diag = null;
    }],
  ];
  G.diag = d;
  kick();
}
function bucketNow() {
  const sp = G.P.buckets;
  return sp ? clamp(Math.round(Math.log(Math.max(0.01, pxPerUnit()) / sp.p0) / Math.log(sp.step)), 0, sp.n - 1) : 0;
}

function layerNode(src, s, vx, vy, extra = "") {
  const v = G.P.vb, W = v[2] * s, aspect = v[2] / v[3], cap = CAP_CH * Math.min(1, aspect), Wb = Math.min(W, cap), k = W / Wb;
  const tx = (v[0] - vx) * s, ty = (v[1] - vy) * s;
  const style = `position:absolute;left:0;top:0;width:${ch(Wb)};height:${ch(Wb / aspect)};overflow:hidden;pointer-events:none;transform-origin:0 0;transform:translate(${ch(tx)},${ch(ty)}) scale(${Math.round(k * 1e4) / 1e4});${extra}`;
  return div(style, [h("Svg", { source: src, alt: "Planta 77", width: 4096, height: 4096 })]);
}
function Page(props, surface) {
  const { Box } = surface.elements, n = props.n | 0;
  EL = surface.elements;
  const pg = G.pg.get(n);
  if (!pg || pg.surface !== surface) G.pg.set(n, { surface, keep: null, want: 0, done: 0 });
  const children = [];
  if (G.P && G.cam && !G.P.compat) {
    const v = viewOf(G.cam);
    for (const it of G.plan[n] ?? []) {
      const t = it.tile;
      if (t) children.push(div(`position:absolute;left:${ch(t.x)};top:${lh(t.y)};width:${ch(t.w)};height:${lh(t.h)};overflow:hidden;pointer-events:none;${it.bg ? "background:radial-gradient(ellipse at 50% 60%,#131a2e 0%,#080b15 70%,#04050a 100%)" : ""}`, [layerNode(it.src, t.s, t.vx, t.vy)]));
      else children.push(layerNode(it.src, G.cam.s, v[0], v[1], it.extra));
    }
  }
  return Box({ key: "root", width: "100%", height: TALL, children });
}
function Loader(props, surface) {
  const { Box } = surface.elements, n = props.n | 0;
  sent();
  let ld = G.ld.get(n);
  if (!ld || ld.surface !== surface) G.ld.set(n, (ld = { n, surface, busy: null, seen: "" }));
  const g = props.got;
  if (g && g.gone === true && ld.busy && ld.busy.key === g.id && ld.seen !== `gone|${g.id}|${ld.busy.at}`) { ld.seen = `gone|${g.id}|${ld.busy.at}`; ld.busy = null }
  if (g && typeof g.src === "string" && typeof g.id === "string") {
    const key = g.id, mark = `${key}|${g.rev}`;
    if (mark !== ld.seen) {
      ld.seen = mark;
      const prev = G.src.get(key), len = g.src.length + 200;
      const old = prev && prev.rev !== g.rev && prev.src !== g.src ? { src: prev.src, len: prev.len, until: now() + SWAP_MS } : null;
      G.src.set(key, { rev: g.rev, src: g.src, len, bucket: Number.isInteger(g.bucket) ? g.bucket : null, old });
      if (ld.busy && ld.busy.key === key) ld.busy = null;
      G.dirty = true;
      nudge();
    }
  }
  pump();
  return Box({ key: "root", children: [] });
}

function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function pickWorld(P, wx, wy, tol, withSessions) {
  if (withSessions) {
    let best = null, bd = Infinity;
    for (const list of [P.lt ?? [], P.sessions ?? []]) {
      for (const t of list) {
        if (t.kind === "room") continue;
        const b = t.b;
        if (wx < b[0] - tol || wx > b[2] + tol || wy < b[1] - tol || wy > b[3] + tol) continue;
        const d = Math.hypot(wx - (b[0] + b[2]) / 2, wy - (b[1] + b[3]) / 2);
        if (d < bd) { bd = d; best = t }
      }
      if (best) return { kind: "session", id: best.id, b: best.b };
    }
  }
  for (const t of P.lt ?? []) if (t.kind === "room" && wx >= t.b[0] && wx <= t.b[2] && wy >= t.b[1] && wy <= t.b[3]) return { kind: "room", id: t.id };
  let room = null;
  for (const r of P.rooms ?? []) if (inPoly(r.poly, wx, wy)) room = r;
  return room ? { kind: "room", id: room.id } : null;
}
const hudAt = (x, y) => G.hud.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
function pickAt(x, y) {
  const hud = hudAt(x, y);
  if (hud) return { kind: "hud", hud };
  if (!G.cam) return null;
  const [wx, wy] = toWorld(x + 0.5, y + 0.5);
  return pickWorld(G.P, wx, wy, 0.6 / G.cam.s, pxPerUnit() >= SESSION_P);
}
const roomOf = (id) => (G.P.rooms ?? []).find((r) => r.id === id);
const sessionBox = (id) => (G.P.sessions ?? []).find((s) => s.id === id)?.b ?? null;

function goSession(id, open) {
  const b = sessionBox(id), info = G.P.info?.[id];
  if (!b) return;
  const room = info ? roomOf(info.r) : null;
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const target = room ? frameCam(room.f, 1.02) : { ...G.cam };
  const s = Math.max(target.s, Math.min(limits().sMax, 1.5 / CH_PX));
  flyTo({ s, cx: room && s === target.s ? target.cx : cx, cy: room && s === target.s ? target.cy : cy - 14 }, 520);
  G.pulse = { id, until: now() + 2600 };
  kick();
  if (open) say({ kind: "session", id });
}
function act(hud, x, y) {
  const a = hud.act;
  G.hint = false;
  if (a === "in") zoomAt(G.cols / 2, G.rows / 2, ZOOM_STEP, 260);
  else if (a === "out") zoomAt(G.cols / 2, G.rows / 2, 1 / ZOOM_STEP, 260);
  else if (a === "home") flyTo(homeCam(), 480);
  else if (a === "help") { G.help = !G.help; refresh() }
  else if (a === "mode") say({ kind: "mode", mode: hud.mode });
  else if (a === "queue") goSession(hud.sid, x >= hud.x + hud.w - 3);
  else if (a === "more") { const q = G.P.queue ?? []; if (q.length) goSession(q[(q.indexOf(G.pulse?.id) + 1) % q.length], false) }
  else if (a === "map") mapGo(hud, x, y);
  else if (a === "cam") say({ kind: "camera", id: hud.room });
  else if (a === "open") say({ kind: "session", id: hud.sid });
}
function mapGo(hud, x, y) {
  G.tw = null;
  const v = G.P.mb ?? G.P.vb, m = hud.map;
  const wx = v[0] + clamp((x + 0.5 - m.x) / m.w, 0, 1) * v[2], wy = v[1] + clamp(((y + 0.5) * rho() - m.y) / m.h, 0, 1) * v[3];
  G.drag = { held: false, target: clampCam({ s: G.cam.s, cx: wx, cy: wy }) };
  kick();
}
function nextWaiting(dir = 1) {
  const q = G.P.queue ?? [];
  if (!q.length) return;
  const i = q.indexOf(G.pulse?.id);
  goSession(q[(i + dir + q.length) % q.length], false);
}

function onPointer(e) {
  if (!G.P || !G.cam || G.P.compat) return compatPointer(e);
  if (e.type !== "leave" && Number.isFinite(e.x)) G.ptr = { x: e.x, y: e.y };
  if (camMode()) return camPointer(e);
  const t = now();
  if (e.type === "down") {
    if (e.button === "right") return;
    const hud = hudAt(e.x, e.y);
    G.press = { x: e.x, y: e.y, t, hud, moved: false, cam: { ...G.cam }, trail: [[t, e.x, e.y]] };
    if (hud && hud.act === "map") { G.press.moved = true; mapGo(hud, e.x, e.y) }
    return;
  }
  if (e.type === "move" && G.press && e.button) {
    const p = G.press;
    if (p.hud) { if (p.hud.act === "map") mapGo(p.hud, e.x, e.y); return }
    if (!p.moved && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < 1) return;
    p.moved = true; G.tw = null; G.hint = false;
    p.trail.push([t, e.x, e.y]);
    if (p.trail.length > 6) p.trail.shift();
    G.drag = { held: true, target: clampCam({ s: G.cam.s, cx: p.cam.cx - (e.x - p.x) / p.cam.s, cy: p.cam.cy - ((e.y - p.y) * rho()) / p.cam.s }) };
    G.hover = null;
    kick();
    return;
  }
  if (e.type === "up") {
    const p = G.press;
    G.press = null;
    if (!p) return;
    if (p.hud) { const hud = hudAt(e.x, e.y); if (hud && hud.id === p.hud.id && hud.act !== "map") act(hud, e.x, e.y); return }
    if (p.moved) {
      if (G.drag) {
        G.drag.held = false;
        const first = p.trail.find((q) => t - q[0] < 120) ?? p.trail[p.trail.length - 1], dt = Math.max(16, t - first[0]);
        const vx = (e.x - first[1]) / dt, vy = (e.y - first[2]) / dt;
        if (t - first[0] < 120 && Math.abs(vx) + Math.abs(vy) > 0.004) G.drag.target = clampCam({ s: G.cam.s, cx: G.drag.target.cx - (vx * 170) / G.cam.s, cy: G.drag.target.cy - (vy * 170 * rho()) / G.cam.s });
        kick();
      }
      return;
    }
    const dbl = G.lastClick && t - G.lastClick.t < DOUBLE_MS && Math.abs(G.lastClick.x - e.x) <= 1 && Math.abs(G.lastClick.y - e.y) <= 1;
    G.lastClick = dbl ? null : { t, x: e.x, y: e.y };
    G.hint = false;
    const hit = pickAt(e.x, e.y);
    if (hit && hit.kind === "session") { G.pulse = { id: hit.id, until: t + 1500 }; kick(); say({ kind: "session", id: hit.id }); return }
    if (dbl) { zoomAt(e.x + 0.5, e.y + 0.5, e.shift ? 1 / 2.2 : 2.2, 300); return }
    if (hit && hit.kind === "room") {
      const r = roomOf(hit.id);
      if (r && pxPerUnit() < ROOM_HOVER_P) flyTo(frameCam(r.f, 1.02), 520);
    }
    return;
  }
  if (e.type === "leave") { G.ptr = null; if (G.hover) { G.hover = null; refresh() } return }
  if (e.type === "move" || e.type === "enter") {
    G.ptr = { x: e.x, y: e.y };
    const hit = pickAt(e.x, e.y);
    const key = hit ? (hit.kind === "hud" ? `h:${hit.hud.id}` : `${hit.kind}:${hit.id}`) : null;
    const moved = G.hover && G.hover.kind === "session" && (G.hover.x !== e.x || G.hover.y !== e.y);
    if (key !== (G.hover?.key ?? null) || moved) {
      G.hover = hit ? { key, kind: hit.kind, id: hit.kind === "hud" ? hit.hud.id : hit.id, x: e.x, y: e.y } : null;
      refresh();
    }
  }
}
function onKey(k) {
  if (!G.P || !G.cam || G.P.compat) return;
  const key = k.key;
  G.hint = false;
  if (camMode()) {
    if (key === "c" || key === "0" || key === "home") say({ kind: "mode", mode: "office" });
    else if (key === "?" || key === "h") { G.help = !G.help; refresh() }
    else if (/^[1-9]$/.test(key)) { const r = (G.P.rooms ?? [])[Number(key) - 1]; if (r) say({ kind: "camera", id: r.id }) }
    return;
  }
  const v = viewOf(G.cam);
  const pan = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[key];
  if (pan) flyTo({ s: G.cam.s, cx: (G.tw?.to.cx ?? G.cam.cx) + pan[0] * v[2] * KEY_PAN, cy: (G.tw?.to.cy ?? G.cam.cy) + pan[1] * v[3] * KEY_PAN }, 200);
  else if (key === "+" || key === "=") zoomAt(G.cols / 2, G.rows / 2, ZOOM_STEP, 240);
  else if (key === "-" || key === "_") zoomAt(G.cols / 2, G.rows / 2, 1 / ZOOM_STEP, 240);
  else if (key === "0" || key === "home" || key === "f") flyTo(homeCam(), 460);
  else if (key === "n" || key === "space") nextWaiting(1);
  else if (key === "p") nextWaiting(-1);
  else if (key === "return") { if (G.pulse) say({ kind: "session", id: G.pulse.id }) }
  else if (key === "?" || key === "h") { G.help = !G.help; refresh() }
  else if (key === "c") say({ kind: "mode", mode: G.P.mode === "cameras" ? "office" : "cameras" });
  else if (/^[1-9]$/.test(key)) { const r = (G.P.rooms ?? [])[Number(key) - 1]; if (r) flyTo(frameCam(r.f, 1.02), 520) }
}

function compatPointer(e) {
  if (!G.P) return;
  if (e.type === "up" && e.button !== "right") {
    const hit = compatPick(e.x, e.y);
    if (hit && hit.kind === "session") say({ kind: "session", id: hit.id });
  } else if (e.type === "move" || e.type === "enter") {
    const hit = compatPick(e.x, e.y), key = hit ? `${hit.kind}:${hit.id}` : null;
    if (key !== (G.hover?.key ?? null)) { G.hover = hit ? { key, kind: hit.kind, id: hit.id, x: e.x, y: e.y } : null; set(G.ui, { f: ++G.frame }) }
  } else if (e.type === "leave" && G.hover) { G.hover = null; set(G.ui, { f: ++G.frame }) }
}
function compatPick(x, y) {
  const v = G.P.vb;
  return pickWorld(G.P, v[0] + ((x + 0.5) / G.cols) * v[2], v[1] + ((y + 0.5) / G.rows) * v[3], (0.6 * v[2]) / G.cols, true);
}
function compatTree(Box, Text) {
  const children = [], hv = G.hover, v = G.P.vb;
  if (hv) {
    const label = hv.kind === "session" ? G.P.info?.[hv.id]?.t : roomOf(hv.id)?.n;
    const color = hv.kind === "session" ? G.P.info?.[hv.id]?.c ?? CYAN : roomOf(hv.id)?.c ?? CYAN;
    if (hv.kind === "session") {
      const b = sessionBox(hv.id);
      if (b) {
        const left = clamp(Math.floor(((b[0] - v[0]) / v[2]) * G.cols), 0, G.cols - 2), top = clamp(Math.floor(((b[1] - v[1]) / v[3]) * G.rows), 0, G.rows - 2);
        children.push(Box({ key: "ring", position: "absolute", top, left, width: Math.max(2, Math.ceil(((b[2] - b[0]) / v[2]) * G.cols) + 1), height: Math.max(2, Math.ceil(((b[3] - b[1]) / v[3]) * G.rows) + 1), borderStyle: "round", borderColor: color }));
      }
    }
    if (label) {
      const text = ` ${label} `.slice(0, Math.max(4, G.cols - 2));
      children.push(Box({ key: "tip", position: "absolute", top: clamp(hv.y - 1, 0, G.rows - 1), left: clamp(hv.x + 2, 0, Math.max(0, G.cols - text.length)), children: [Text({ color: INK, backgroundColor: color, bold: true, children: text })] }));
    }
  }
  return Box({ key: "root", width: "100%", height: TALL, children });
}

const SKIN = `background:${PANEL};border:1px solid ${LINE};border-radius:5px;pointer-events:none;overflow:hidden`;
const ROW = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
const geo = (x, y, w, h) => `position:absolute;left:${ch(x)};top:${lh(y)};width:${ch(w)};height:${lh(h)};box-sizing:border-box`;
const inner = (style, kids) => div(`width:100%;height:100%;box-sizing:border-box;${FONT};color:${TXT};${style}`, kids);
const box = (x, y, w, h, skin, style, kids) => div(`${geo(x, y, w, h)};${skin}`, [inner(style, kids)]);
function button(id, x, y, w, h, label, o = {}) {
  const hot = G.hover?.key === `h:${id}`, c = o.color ?? CYAN;
  G.hud.push({ id, x, y, w, h, act: o.act ?? id, ...o.data });
  return box(x, y, w, h, `background:${hot ? c : o.on ? "rgba(34,228,255,.18)" : PANEL};border:1px solid ${hot || o.on ? c : LINE};border-radius:5px;pointer-events:none;overflow:hidden;${hot ? `box-shadow:0 0 12px ${c}` : ""}`,
    `display:flex;align-items:center;justify-content:center;color:${hot ? INK : o.on ? c : TXT};font-weight:800;font-size:${o.size ?? 13}px;letter-spacing:${o.ls ?? 0}px;white-space:nowrap`, [label]);
}
const STAT = [["work", "#39ff88"], ["wait", "#fcee0a"], ["cafe", "#ff3b5c"], ["lounge", "#c06bff"], ["cryo", "#7fd8ff"]];
function hudTree() {
  const P = G.P, T = P.text ?? {}, cols = G.cols, rows = G.rows, out = [];
  const narrow = cols < 86, tiny = cols < 54 || rows < 14;
  const c = P.counts ?? {}, wait = (P.queue ?? []).length;
  const vals = { work: c.work ?? 0, wait, cafe: c.cafe ?? 0, lounge: c.lounge ?? 0, cryo: c.cryo ?? 0 };
  const stats = STAT.filter(([k]) => !tiny || k === "work" || k === "wait").map(([k, col]) => group(`margin-left:${narrow ? 7 : 11}px;white-space:nowrap`, [span(`color:${col};font-weight:800`, `● ${vals[k]}`), ...(narrow ? [] : [span(`color:${DIM};margin-left:4px`, T.stat?.[k] ?? k)])]));
  out.push(div(`position:absolute;left:${ch(1)};top:0;max-width:${ch(cols - (tiny ? 7 : 21))};height:${lh(2)};box-sizing:border-box;${SKIN}`, [inner("display:flex;align-items:center;padding:0 10px;font-size:11.5px;white-space:nowrap", [
    span(`font-weight:900;letter-spacing:2px;color:${CYAN};font-size:12.5px`, "PLANTA 77"),
    span(`margin-left:9px;color:${P.stale ? "#ff3b5c" : "#39ff88"};font-size:10px;font-weight:800;letter-spacing:1px`, P.stale ? T.stale ?? "●" : T.live ?? "●"),
    ...stats,
  ])]));
  if (!tiny) out.push(button("mode", cols - 19, 0, 13, 2, P.mode === "cameras" ? T.office ?? "OFFICE" : T.cameras ?? "CAMERAS", { size: 11, ls: 1.5, act: "mode", data: { mode: P.mode === "cameras" ? "office" : "cameras" } }));
  out.push(button("help", cols - 5, 0, 4, 2, "?", { on: G.help }));
  if (P.mode === "cameras") return out;

  const zy = Math.max(3, Math.floor(rows / 2) - 3);
  if (rows >= 11) {
    out.push(button("in", cols - 5, zy, 4, 2, "+", { size: 17 }));
    out.push(button("out", cols - 5, zy + 2, 4, 2, "−", { size: 17 }));
    out.push(button("home", cols - 5, zy + 4, 4, 2, "⌂", { size: 15 }));
    const { sMin, sMax } = limits(), u = clamp(Math.log(G.cam.s / sMin) / Math.log(sMax / sMin), 0, 1);
    out.push(div(`${geo(cols - 6.4, zy, 0.8, 6)};background:rgba(120,150,210,.16);border-radius:3px;pointer-events:none`, [div(`position:absolute;left:0;right:0;bottom:0;height:${Math.round(u * 100)}%;background:${CYAN};border-radius:3px;box-shadow:0 0 8px ${CYAN}`)]));
  }

  const q = P.queue ?? [], maxQ = clamp(Math.floor((rows - 8) / 3.5), 0, 6), qw = clamp(Math.floor(cols * (cols < 90 ? 0.62 : 0.46)), 18, 42);
  q.slice(0, maxQ).forEach((id, i) => {
    const s = P.info?.[id];
    if (!s) return;
    const hid = `q:${id}`, hot = G.hover?.key === `h:${hid}`, sel = G.pulse?.id === id;
    G.hud.push({ id: hid, x: 1, y: 3 + i, w: qw, h: 1, act: "queue", sid: id });
    out.push(box(1, 3 + i, qw, 1, `background:${hot || sel ? "rgba(20,26,44,.96)" : PANEL};border-left:3px solid ${s.c};border-radius:3px;pointer-events:none;overflow:hidden;${hot ? `box-shadow:0 0 10px ${s.c}` : ""}`, "display:flex;align-items:center;font-size:11px;padding:0 6px;white-space:nowrap", [
      span(`color:${s.c};font-weight:900;margin-right:6px`, s.s === "perm" ? "!" : s.s === "ask" ? "?" : "✓"),
      span(`flex:1;overflow:hidden;text-overflow:ellipsis;font-weight:700`, s.t),
      span(`color:${DIM};margin-left:6px;font-size:10px`, s.rn),
      span(`color:${hot ? s.c : DIM};margin-left:7px;font-weight:900`, "↗"),
    ]));
  });
  if (q.length > maxQ && maxQ > 0) {
    G.hud.push({ id: "more", x: 1, y: 3 + maxQ, w: 18, h: 1, act: "more" });
    out.push(box(1, 3 + maxQ, 18, 1, "pointer-events:none", `display:flex;align-items:center;color:${G.hover?.key === "h:more" ? "#fcee0a" : DIM};font-size:10.5px;padding:0 6px;white-space:nowrap`, [`+${q.length - maxQ} ${T.moreWaiting ?? ""}`]));
  }

  if (!tiny && rows >= 18) {
    const v = P.mb ?? P.vb, mw = Math.min(28, Math.max(14, Math.floor(cols * 0.24))), mhCh = mw / (v[2] / v[3]), mh = Math.ceil(mhCh / rho()), my = rows - mh - 1;
    G.hud.push({ id: "map", x: 1, y: my, w: mw, h: mh, act: "map", map: { x: 1, y: my * rho(), w: mw, h: mhCh } });
    const view = viewOf(G.cam), vx = ((view[0] - v[0]) / v[2]) * mw, vy = ((view[1] - v[1]) / v[3]) * mhCh, vw = (view[2] / v[2]) * mw, vh = (view[3] / v[3]) * mhCh;
    out.push(div(`${geo(1, my, mw, mh)};${SKIN}`, [
      div(`position:absolute;left:0;top:0;width:${ch(mw)};height:${ch(mhCh)};overflow:hidden;opacity:.9`, [h("Svg", { source: P.mini, alt: "map", width: 4096, height: 4096 })]),
      div(`position:absolute;left:${ch(Math.max(0, vx))};top:${ch(Math.max(0, vy))};width:${ch(Math.min(mw, vx + vw) - Math.max(0, vx))};height:${ch(Math.min(mhCh, vy + vh) - Math.max(0, vy))};box-sizing:border-box;border:1.5px solid #fff;border-radius:2px;background:rgba(255,255,255,.1);box-shadow:0 0 8px rgba(255,255,255,.5)`),
    ]));
  }
  return out;
}
function sessionCard(out, id, px, py) {
  const P = G.P, T = P.text ?? {}, cols = G.cols, rows = G.rows, s = P.info?.[id];
  if (!s) return;
  const w = Math.min(48, cols - 2), x = clamp(px + 3, 1, Math.max(1, cols - w - 1)), lines = 3 + (s.d ? 1 : 0) + (s.tr ? 1 : 0), hgt = lines + 1;
  const y = py + 2 + hgt > rows ? Math.max(0, py - hgt - 1) : py + 2;
  const meta = [s.rn, s.a ? (T.ago ?? "{t}").replace("{t}", s.a) : "", s.n ? (T.subs ?? "{n}").replace("{n}", s.n) : ""].filter(Boolean).join(" · ");
  out.push(box(x, y, w, hgt, `background:rgba(6,8,16,.95);border:1px solid ${s.c};border-radius:7px;pointer-events:none;overflow:hidden;box-shadow:0 0 18px rgba(0,0,0,.7),0 0 10px ${s.c}55`, "display:flex;flex-direction:column;justify-content:space-evenly;font-size:11.5px;padding:3px 10px", [
    div(`${ROW};font-weight:800;font-size:12.5px`, [s.t]),
    div(ROW, [span(`background:${s.c};color:${INK};font-weight:900;font-size:9.5px;letter-spacing:1px;padding:1px 6px;border-radius:3px`, T.state?.[s.s] ?? s.s), span(`color:${DIM};margin-left:8px`, meta)]),
    ...(s.d ? [div(`${ROW};color:#fff`, [s.d])] : []),
    ...(s.tr ? [div(`${ROW};color:${s.c};${MONO};font-size:10.5px`, [s.tr])] : []),
    div(`${ROW};color:${DIM};font-size:10px`, [T.open ?? ""]),
  ]));
}
function overlayTree() {
  const P = G.P, T = P.text ?? {}, out = [], cols = G.cols, rows = G.rows, hv = G.hover;
  const ring = (id, color, strong) => {
    const b = sessionBox(id);
    if (!b) return;
    const [x0, y0] = toCh(b[0], b[1]), [x1, y1] = toCh(b[2], b[3]), w = x1 - x0, hgt = y1 - y0, pad = Math.max(0.5, w * 0.25);
    out.push(div(`position:absolute;left:${ch(x0 - pad)};top:${ch(y0 - pad)};width:${ch(w + pad * 2)};height:${ch(hgt + pad * 2)};box-sizing:border-box;border:${strong ? 2.5 : 1.5}px solid ${color};border-radius:${ch(Math.min(w, hgt))};box-shadow:0 0 ${strong ? 22 : 10}px ${color},inset 0 0 ${strong ? 14 : 6}px ${color};pointer-events:none`));
  };
  if (G.pulse && Math.floor((G.pulse.until - now()) / 220) % 2 === 0) ring(G.pulse.id, P.info?.[G.pulse.id]?.c ?? CYAN, true);
  if (hv && hv.kind === "room" && pxPerUnit() < ROOM_HOVER_P) {
    const r = roomOf(hv.id);
    if (r) {
      const pts = r.poly.map((p) => { const [x, y] = toCh(p[0], p[1]); return `${ch(x)} ${ch(y)}` }).join(",");
      out.push(div(`position:absolute;left:0;top:0;width:100%;height:${lh(rows)};background:${r.c};opacity:.16;clip-path:polygon(${pts});pointer-events:none`));
      const top = r.poly.reduce((a, p) => (p[1] < a[1] ? p : a)), [tx, ty] = toCh((r.poly[0][0] + r.poly[1][0]) / 2, top[1]);
      out.push(div(`position:absolute;left:${ch(clamp(tx - 9, 0, Math.max(0, cols - 24)))};top:${ch(Math.max(0, ty - 4.6))};pointer-events:none`, [div(`${FONT};background:${r.c};color:${INK};font-weight:900;font-size:12px;letter-spacing:1.5px;padding:2px 9px;border-radius:4px;white-space:nowrap;box-shadow:0 0 14px ${r.c}`, [`${r.n}  ·  ${T.enter ?? "↵"}`])]));
    }
  }
  if (hv && hv.kind === "session") {
    ring(hv.id, P.info?.[hv.id]?.c ?? CYAN, false);
    sessionCard(out, hv.id, hv.x, hv.y);
  }
  return out;
}
function chrome() {
  const P = G.P, T = P.text ?? {}, out = [], cols = G.cols, rows = G.rows;
  const [ready, total] = loaded();
  if (ready < total) {
    out.push(box(Math.max(1, cols / 2 - 18), Math.max(0, rows / 2 - 1), Math.min(36, cols - 2), 2, `${SKIN};border-color:${CYAN}`, "display:flex;align-items:center;justify-content:center;font-size:12px;letter-spacing:1px", [`${T.loading ?? "…"}  ${ready}/${total}`]));
  } else if (G.hint && T.hint && rows >= 12 && !G.help && !camMode()) {
    const left = rows >= 18 && cols >= 54 ? Math.min(28, Math.max(14, Math.floor(cols * 0.24))) + 3 : 1, w = Math.max(10, Math.min(cols - left - 1, 100));
    out.push(box(left, rows - 2, w, 1, "pointer-events:none;overflow:hidden", `display:flex;align-items:center;color:${DIM};font-size:10.5px;text-shadow:0 1px 3px #000`, [span(ROW, T.hint)]));
  }
  if (G.help && Array.isArray(T.help)) {
    const w = Math.min(cols - 4, 60), hgt = Math.min(rows - 2, T.help.length + 3);
    out.push(box((cols - w) / 2, Math.max(1, (rows - hgt) / 2), w, hgt, `background:rgba(6,8,16,.96);border:1px solid ${CYAN};border-radius:8px;pointer-events:none;overflow:hidden;box-shadow:0 0 24px rgba(34,228,255,.35)`, "display:flex;flex-direction:column;justify-content:space-evenly;font-size:11.5px;padding:4px 14px", [
      div(`font-weight:900;letter-spacing:2px;color:${CYAN}`, [T.helpTitle ?? "?"]),
      ...T.help.map(([k, d]) => div("display:flex;white-space:nowrap", [span("color:#fcee0a;font-weight:800;width:9.5em;flex-shrink:0", k), span(`color:${TXT};overflow:hidden;text-overflow:ellipsis`, d)])),
    ]));
  }
  return out;
}

const WAIT = { perm: 3, ask: 3, turn: 2 }, SYM = { perm: "!", ask: "?", turn: "✓" };
const p2 = (n) => String(n).padStart(2, "0");
function camLayout() {
  const P = G.P, cols = G.cols, rows = G.rows, rh = rho(), rooms = P.rooms ?? [], byRoom = new Map();
  for (const s of P.sessions ?? []) { const i = P.info?.[s.id]; if (!i) continue; if (!byRoom.has(i.r)) byRoom.set(i.r, []); byRoom.get(i.r).push(s.id) }
  const top = 3, H = rows - top, side = cols >= 104 ? clamp(Math.floor(cols * 0.36), 38, 58) : 0;
  const below = side ? 0 : rows >= 24 ? clamp(Math.floor(H * 0.42), 8, 24) : 0;
  const W = cols - 2 - (side ? side + 1 : 0), FH = H - (below ? below + 1 : 0);
  let best = null;
  for (let n = Math.min(rooms.length, 12); n >= 1 && !best; n--) {
    for (let gc = 1; gc <= Math.min(n, 5); gc++) {
      const gr = Math.ceil(n / gc), tw = (W - (gc - 1)) / gc, th = Math.floor(FH / gr);
      if (n > 1 && (tw < 24 || th < 6)) continue;
      const sc = Math.min(tw / 2, th * rh);
      if (!best || sc > best.sc) best = { n, gc, gr, tw, th, sc };
    }
  }
  const tiles = new Map();
  if (best && best.th >= 2) {
    const score = (r) => (byRoom.get(r.id) ?? []).reduce((a, id) => a + (WAIT[P.info[id].s] ? 100 : 1), 0);
    const pick = new Set(rooms.map((r, i) => [r, i, score(r)]).sort((a, b) => b[2] - a[2] || a[1] - b[1]).slice(0, best.n).map((x) => x[0].id));
    let i = 0;
    rooms.forEach((r, ri) => {
      if (!pick.has(r.id)) return;
      const x = 1 + (i % best.gc) * (best.tw + 1), y = top + Math.floor(i / best.gc) * best.th, w = best.tw, hgt = best.th;
      const f = r.f[2] > 80 && r.f[3] > 120 ? [r.f[0] + 20, r.f[1] + 58, r.f[2] - 40, r.f[3] - 70] : r.f;
      const s = Math.min(w / f[2], (hgt * rh) / f[3]) * 0.97;
      tiles.set(r.id, { x, y, w, h: hgt, n: ri + 1, s, vx: f[0] + f[2] / 2 - w / (2 * s), vy: f[1] + f[3] / 2 - (hgt * rh) / (2 * s) });
      i++;
    });
  }
  const used = best ? Math.ceil(tiles.size / best.gc) * best.th : 0, py = top + used + 1;
  const panel = side ? { x: cols - side - 1, y: top, w: side, h: H } : below && rows - py >= 6 ? { x: 1, y: py, w: cols - 2, h: rows - py } : null;
  return { tiles, byRoom, panel, sig: `${cols}x${rows}|${rh}|${[...tiles].map(([k, t]) => `${k}:${f2(t.x)},${t.y},${f2(t.w)},${t.h}`).join(";")}` };
}
function camsTree() {
  const P = G.P, T = P.text ?? {}, TC = T.cam ?? {}, C = P.cams ?? {}, out = [], marks = [], Lc = G.camL, rh = rho(), hv = G.hover;
  const t0 = now(), blink = Math.floor(t0 / 1000) % 2 === 0, d = new Date(t0), clock = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  for (const [rid, t] of Lc.tiles) {
    const r = roomOf(rid), list = Lc.byRoom.get(rid) ?? [], hot = hv?.key === `h:cam:${rid}`, counts = new Map();
    let alert = null, trace = "";
    for (const id of list) {
      const i = P.info[id], k = WAIT[i.s] ? i.s : i.c;
      counts.set(k, { n: (counts.get(k)?.n ?? 0) + 1, c: i.c, sym: SYM[i.s] ?? "●", w: WAIT[i.s] ?? 0 });
      if (WAIT[i.s] && (!alert || WAIT[i.s] > WAIT[alert.s])) alert = i;
      if (!trace && i.s === "work" && i.tr) trace = i.tr;
    }
    const shown = list.slice().sort((a, b) => (WAIT[P.info[b].s] ?? 0) - (WAIT[P.info[a].s] ?? 0)).slice(0, 12);
    for (const id of shown) {
      const b = sessionBox(id), i = P.info[id];
      if (!b) continue;
      const x0 = t.x + (b[0] - t.vx) * t.s, y0 = t.y * rh + (b[1] - t.vy) * t.s, w = (b[2] - b[0]) * t.s, hg = (b[3] - b[1]) * t.s;
      if (x0 < t.x || x0 + w > t.x + t.w || y0 < (t.y + 1) * rh || y0 + hg > (t.y + t.h - 1) * rh) continue;
      const hid = `s:${id}`, on = hv?.key === `h:${hid}`;
      G.hud.push({ id: hid, x: Math.floor(x0), y: Math.floor(y0 / rh), w: Math.max(1, Math.ceil(x0 + w) - Math.floor(x0)), h: Math.max(1, Math.ceil((y0 + hg) / rh) - Math.floor(y0 / rh)), act: "open", sid: id });
      if ((WAIT[i.s] && marks.length < 36) || on) marks.push(div(`position:absolute;left:${ch(x0 - 0.4)};top:${ch(y0 - 0.4)};width:${ch(w + 0.8)};height:${ch(hg + 0.8)};box-sizing:border-box;border:${on ? 2 : 1.5}px solid ${i.c};border-radius:3px;pointer-events:none;${on || blink ? `box-shadow:0 0 9px ${i.c}` : "opacity:.5"}`));
    }
    G.hud.push({ id: `cam:${rid}`, x: Math.floor(t.x), y: t.y, w: Math.ceil(t.w), h: t.h, act: "cam", room: rid });
    const edge = hot ? CYAN : alert && blink ? alert.c : LINE;
    const chips = [...counts.values()].sort((a, b) => b.w - a.w).map((k) => span(`color:${k.c};font-weight:800;margin-right:8px`, `${k.sym} ${k.n}`));
    const foot = hot ? TC.go ?? "" : trace;
    out.push(div(`${geo(t.x, t.y, t.w, t.h)};border:1px solid ${edge};border-radius:4px;overflow:hidden;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0,rgba(0,0,0,.2) 1px,transparent 1px,transparent 3px);box-shadow:inset 0 0 30px rgba(0,0,0,.8)${hot ? `,0 0 14px ${CYAN}` : alert && blink ? `,0 0 12px ${alert.c}` : ""}`, [
      div(`position:absolute;left:0;top:0;right:0;display:flex;align-items:center;${FONT};font-size:10.5px;white-space:nowrap;background:linear-gradient(180deg,rgba(4,5,10,.9),rgba(4,5,10,0));padding:0 6px 6px 0`, [
        span(`background:#fcee0a;color:${INK};font-weight:900;letter-spacing:1px;padding:1px 6px;margin-right:7px`, `CAM-${p2(t.n)}`),
        span(`color:${r?.c ?? TXT};font-weight:800;letter-spacing:1px;flex:1;overflow:hidden;text-overflow:ellipsis`, r?.n ?? rid),
        span(`color:${blink ? "#ff3b5c" : "#5a1522"};font-weight:900;margin-left:6px`, "●"),
        span(`color:${TXT};margin-left:4px;font-size:9.5px;letter-spacing:1px`, t.w >= 34 ? `REC ${clock}` : "REC"),
      ]),
      div(`position:absolute;left:0;bottom:0;right:0;display:flex;align-items:center;${FONT};font-size:10.5px;white-space:nowrap;background:linear-gradient(0deg,rgba(4,5,10,.92),rgba(4,5,10,0));padding:6px 7px 1px`, list.length || hot
        ? [...chips, span(`flex:1;text-align:right;color:${hot ? CYAN : DIM};font-size:9.5px;overflow:hidden;text-overflow:ellipsis;${hot ? "" : MONO}`, foot)]
        : [span(`color:${DIM};letter-spacing:2px;font-size:9.5px`, TC.empty ?? "")]),
    ]));
  }
  const pn = Lc.panel, tilesOut = out.length;
  out.push(...marks);
  if (pn) {
    const pipes = C.pipes ?? [], traces = C.traces ?? [], sys = C.sys, bars = sys ? [["CPU", sys.cpu, 100, `${sys.cpu} %`, "#39ff88"], ...(sys.temp ? [["TEMP", sys.temp, 100, `${sys.temp} °C`, "#fcee0a"]] : []), ...(sys.ram ? [["RAM", sys.ram[0], sys.ram[1] || 1, `${sys.ram[0]}/${sys.ram[1]} GB`, CYAN]] : [])] : [];
    const sysH = pn.h >= 20 ? 1 + Math.max(1, bars.length) + (C.dockerN ? 1 : 0) : 0, pipeH = pn.h >= 12 ? 1 + Math.max(1, Math.min(pipes.length, pn.h >= 20 ? 5 : 3)) : 0;
    const gaps = (sysH ? 1 : 0) + (pipeH ? 1 : 0), traceH = pn.h - sysH - pipeH - gaps;
    const head = (y, hgt, title, color, sub) => {
      out.push(div(`${geo(pn.x, y, pn.w, hgt)};${SKIN};border-top:2px solid ${color}`));
      out.push(box(pn.x, y, pn.w, 1, "pointer-events:none;overflow:hidden", "display:flex;align-items:center;font-size:10.5px;white-space:nowrap;padding:0 8px", [span(`color:${color};font-weight:900;letter-spacing:2px`, title), span(`flex:1;text-align:right;color:${DIM};font-size:9.5px;overflow:hidden;text-overflow:ellipsis;margin-left:8px`, sub ?? "")]));
    };
    const line = (y, style, kids, bg = "") => out.push(box(pn.x, y, pn.w, 1, `pointer-events:none;overflow:hidden;${bg}`, `display:flex;align-items:center;font-size:10.5px;white-space:nowrap;padding:0 8px;${style}`, kids));
    let y = pn.y;
    if (traceH >= 2) {
      head(y, traceH, TC.traces ?? "", CYAN, "");
      if (!traces.length) line(y + 1, `color:${DIM}`, [TC.noTraces ?? ""]);
      traces.slice(0, traceH - 1).forEach((tr, i) => {
        const hid = `tr:${i}`, on = hv?.key === `h:${hid}`;
        G.hud.push({ id: hid, x: pn.x, y: y + 1 + i, w: pn.w, h: 1, act: "open", sid: tr.id });
        line(y + 1 + i, "", [
          span(`color:${DIM};margin-right:7px;font-size:9.5px`, tr.t),
          span(`color:${tr.c};font-weight:700;width:30%;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;margin-right:7px`, tr.n),
          span(`color:${CYAN};width:5.6em;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;margin-right:6px;${MONO};font-size:10px`, tr.tool),
          span(`color:${on ? "#fff" : TXT};flex:1;overflow:hidden;text-overflow:ellipsis;${MONO};font-size:10px`, tr.x),
        ], on ? "background:rgba(34,228,255,.14)" : "");
      });
      y += traceH + 1;
    }
    if (pipeH) {
      head(y, pipeH, TC.pipes ?? "", "#39ff88", C.mrs ? (TC.mrs ?? "").replace("{o}", C.mrs[0]).replace("{m}", C.mrs[1]) : "");
      if (!pipes.length) line(y + 1, `color:${DIM}`, [C.radar ? TC.noPipes ?? "" : TC.installRadar ?? ""]);
      pipes.slice(0, pipeH - 1).forEach((q, i) => line(y + 1 + i, "", [
        span(`color:${q.c};font-weight:900;margin-right:7px`, q.i),
        span(`color:${TXT};font-weight:700;width:34%;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;margin-right:7px`, q.p),
        span(`color:${DIM};flex:1;overflow:hidden;text-overflow:ellipsis;${MONO};font-size:10px`, q.b),
        group("margin-left:6px;letter-spacing:1px;font-size:9px", q.st.map((c) => span(`color:${c}`, "●"))),
        span(`color:${DIM};margin-left:8px;font-size:9.5px;${MONO}`, q.d),
      ]));
      y += pipeH + 1;
    }
    if (sysH) {
      head(y, sysH, TC.system ?? "", "#ff3b5c", "");
      if (!sys) line(y + 1, `color:${DIM}`, [TC.installHeat ?? ""]);
      bars.forEach(([label, val, max, txt, c], i) => line(y + 1 + i, "", [
        span(`color:${DIM};width:3.4em;flex-shrink:0;font-size:9.5px;letter-spacing:1px`, label),
        div("flex:1;height:7px;background:#151a26;border-radius:2px;overflow:hidden;margin:0 8px", [div(`width:${Math.round(clamp(val / max, 0, 1) * 100)}%;height:100%;background:${c};box-shadow:0 0 6px ${c}`)]),
        span(`color:${TXT};width:8em;flex-shrink:0;text-align:right;${MONO};font-size:10px`, txt),
      ]));
      if (C.dockerN) line(y + 1 + Math.max(1, bars.length), `color:${DIM};font-size:9.5px`, [span(`${ROW};${MONO}`, `DOCKER ${C.dockerN}: ${(C.docker ?? []).join(" · ")}`)]);
    }
  }
  if (hv && hv.key.startsWith("h:s:")) sessionCard(out, hv.id.slice(2), hv.x, hv.y);
  if (RAW && JSON.stringify(out).length > TREE_MAX - 12000) out.splice(tilesOut, marks.length);
  return out;
}
function runCmd(c) {
  if (c.kind === "room") { const r = roomOf(c.id); if (r) flyTo(frameCam(r.f, 1.02), 560) }
  else if (c.kind === "session") goSession(c.id, false);
  else if (c.kind === "home") flyTo(homeCam(), 460);
}
function camPointer(e) {
  if (e.type === "down") { if (e.button !== "right") G.press = { x: e.x, y: e.y, hud: hudAt(e.x, e.y) }; return }
  if (e.type === "up") {
    const p = G.press, hud = hudAt(e.x, e.y);
    G.press = null;
    if (p && p.hud && hud && hud.id === p.hud.id) act(hud, e.x, e.y);
    return;
  }
  if (e.type === "leave") { G.ptr = null; if (G.hover) { G.hover = null; refresh() } return }
  if (e.type === "move" || e.type === "enter") {
    const hud = hudAt(e.x, e.y), key = hud ? `h:${hud.id}` : null;
    if (key !== (G.hover?.key ?? null) || (hud && hud.sid && G.hover && (G.hover.x !== e.x || G.hover.y !== e.y))) {
      G.hover = hud ? { key, kind: "hud", id: hud.id, x: e.x, y: e.y } : null;
      refresh();
    }
  }
}

function Ui(props, surface) {
  const { Box, Text } = surface.elements;
  EL = surface.elements;
  if (G.ui !== surface) { G.stop = null; G.camTimer = null; G.idleAt = 0; G.tw = null; G.drag = null; G.press = null; G.hover = null; G.dirty = true; G.sentBucket = -1; G.sentView = ""; G.out = [] }
  G.ui = surface; G.P = props; G.cols = surface.columns; G.rows = surface.rows;
  surface.onPointer(onPointer);
  surface.onKey(onKey);
  if (!(G.cols > 0 && G.rows > 0) || !Array.isArray(props.vb)) return Box({ key: "root", width: "100%", height: TALL, children: [] });
  if (props.compat) return compatTree(Box, Text);
  const vbKey = `${props.vb.join(",")}|${G.cols}x${G.rows}|${rho()}`;
  const resized = !!G.cam && vbKey !== G.vbKey;
  if (!G.cam) G.cam = homeCam();
  else if (resized) {
    const fit = G.atHome !== false;
    G.cam = fit ? homeCam() : clampCam(G.cam);
    G.tw = null; G.drag = null; G.dirty = true; kick();
  }
  G.vbKey = vbKey;
  G.atHome = near(G.cam, homeCam());
  if (!props.cmd) G.cmdSeq = 0;
  if (props.cmd && props.cmd.seq !== G.cmdSeq) {
    const first = G.cmdSeq === null && !props.cmd.fresh;
    G.cmdSeq = props.cmd.seq;
    if (!first) { G.goal = { c: props.cmd, until: now() + 2500 }; runCmd(props.cmd) }
  } else if (resized && G.goal && now() < G.goal.until) runCmd(G.goal.c);
  if (G.diag) { const t = now(), gap = t - G.diag.last; G.diag.renders++; G.diag.last = t; if (gap > G.diag.maxGap) G.diag.maxGap = gap; if (gap > 34) G.diag.gaps++ }
  if (props.diag && props.diag !== G.diagSeq) { G.diagSeq = props.diag; startDiag(props.diag) }
  if (props.wheel && props.wheel.seq !== G.wheelSeq) {
    const first = G.wheelSeq === null || props.wheel.seq < G.wheelSeq;
    G.wheelSeq = props.wheel.seq;
    if (!first) { const w = props.wheel, p = Number.isFinite(w.x) && Number.isFinite(w.y) ? { x: clamp(w.x, 0, G.cols - 1), y: clamp(w.y, 0, G.rows - 1) } : G.ptr ?? { x: G.cols / 2, y: G.rows / 2 }; G.hint = false; zoomAt(p.x + 0.5, p.y + 0.5, props.wheel.dir > 0 ? WHEEL_STEP : 1 / WHEEL_STEP, 160) }
  }
  const cams = camMode();
  G.hud = [];
  if (props.bucket !== G.propBucket) { G.propBucket = props.bucket; G.dirty = true; kick() }
  const manSig = (props.man ?? []).map((m) => `${m.id}:${m.rev}`).join(",");
  if (manSig !== G.manSig) {
    G.manSig = manSig;
    G.fail = new Map(); G.dirty = true; kick();
  }
  if (cams !== G.wasCams) { G.wasCams = cams; G.dirty = true; G.hover = null; G.press = null; kick() }
  if (cams) {
    G.camL = camLayout();
    if (G.camL.sig !== G.camSig) { G.camSig = G.camL.sig; G.dirty = true; kick() }
    if (!G.camTimer) G.camTimer = every(surface, 1000, () => { if (G.ui) set(G.ui, { f: ++G.frame }) });
  } else {
    if (G.camTimer) { G.camTimer(); G.camTimer = null }
  }
  if (G.sentView !== `${cams ? G.bucket : bucketNow()}|${wantLod()}`) kick();
  pump();
  const cursor = cams ? (G.hover ? "pointer" : "default") : G.press?.moved ? "grabbing" : G.hover ? (G.hover.kind === "room" && pxPerUnit() >= ROOM_HOVER_P ? "grab" : "pointer") : "grab";
  const own = [div(`position:absolute;left:0;top:0;width:100%;height:${lh(G.rows)};cursor:${cursor}`), ...(cams ? camsTree() : overlayTree()), ...hudTree(), ...chrome()];
  G.uiLen = RAW ? JSON.stringify(own).length : 20000;
  const hosted = [], v = viewOf(G.cam);
  let room = UI_MAX - G.uiLen - 1500;
  for (const it of cams ? [] : G.host) {
    room -= it.len + 600;
    if (room < 0) { G.dirty = true; kick(); break }
    hosted.push(layerNode(it.src, G.cam.s, v[0], v[1], it.extra));
  }
  const children = [...hosted, ...own];
  return Box({ key: "root", width: "100%", height: TALL, children });
}

function Cal(props, surface) {
  const { Box } = surface.elements, rows = surface.rows;
  EL = surface.elements;
  if (rows > 200) {
    const r = Math.round((CAL_CH / (rows + 0.5)) * 1000) / 1000;
    if (r > 1.6 && r < 3.6 && Math.abs(r - G.calRho) > 0.004) {
      G.calRho = r;
      if (Math.abs(r - (props.rho ?? 0)) > 0.004) post(surface, { kind: "rho", rho: r });
      if (G.ui) { G.dirty = true; kick() }
    }
  }
  return Box({ key: "root", children: [div(`height:calc(${CAL_CH} * 1ch);width:1ch;flex-shrink:0`)] });
}

export default function Stage(props, surface) {
  const role = props?.role;
  return role === "page" ? Page(props, surface) : role === "loader" ? Loader(props, surface) : role === "cal" ? Cal(props, surface) : Ui(props ?? {}, surface);
}
export const __test = { G, limits, homeCam, frameCam, toWorld, toCh, viewOf };
