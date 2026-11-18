import { collect } from "./lib/collect.mjs";
import { buildModel } from "./lib/model.mjs";
import { folderList, groupsKey, aiRequest, parseAi } from "./lib/projects.mjs";
import { buildScene, labelLayers, tierLayers, buildCompat, altText, themeFor, LABEL_P0, LABEL_STEP, LABEL_BUCKETS } from "./lib/office.mjs";
import { wheelStep, WHEEL_TOP, WHEEL_BOTTOM } from "./lib/wheel.mjs";
import { cameraData } from "./lib/feeds.mjs";
import { traceOf, sanitize, WAITING, DAY } from "./lib/states.mjs";
import { clip, hash } from "./lib/util.mjs";
import { STRINGS, T, setLanguage, languageOf } from "./lib/strings.mjs";

const PANE = "planta-77";
const SNAP_V = 2, CLAIM_MS = 30000, CLAIM_RENEW = 10000, LIVE_TTL = 3 * DAY, WORK_REWRITE = 60000, AI_RETRY = 30 * 60000, AI_WAIT = 2 * 60000;
const RHO = 2.4, MIN_ROWS = 8, ANCHOR = "p77-anchor", PAGES = 5, LOADERS = 3;
const SESSION_RE = /^local_[0-9a-f-]{36}$/;
const SPECIAL_ROOMS = ["server", "ramen", "bunker", "cctv", "cryo"];

const S = {
  opts: { language: "en", partyDesks: false, ai: true, refreshMs: 5000, wheel: true },
  caches: { desktop: new Map(), tails: new Map(), folders: new Map() },
  ui: { mode: "office", error: null, busy: false, now: 0, open: false, sig: null, bucket: 0, cmd: null, cmdSeq: 0, wheel: null, wheelSeq: 0, wheelDir: 0, settling: false, remote: false, compat: false, faults: 0, faultLog: [], rho: null, lod: null, diag: 0 },
  env: { home: null, platform: null, tz: 0, tzAt: 0, me: null, cli: null },
  snap: null, timer: null, scene: null, compat: null, lastLive: null, again: false,
};

async function boot($) {
  const env = S.env;
  if (!env.home) env.home = (await $.env.get("HOME")) || "";
  if (!env.platform) {
    const r = await $.process.run(["uname", "-s"], { timeoutMs: 3000 }).catch(() => null);
    env.platform = String(r?.stdout ?? "").trim() === "Darwin" ? "darwin" : "linux";
  }
  if (!env.cli) env.cli = await $.session.id().catch(() => null);
  if (!env.me) env.me = env.cli || `p${Math.random().toString(36).slice(2)}`;
  const now = await $.clock.now();
  if (now - env.tzAt > 3600000) {
    const r = await $.process.run(["date", "+%z"], { timeoutMs: 3000 }).catch(() => null);
    const m = String(r?.stdout ?? "").trim().match(/^([+-])(\d\d)(\d\d)$/);
    env.tz = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
    env.tzAt = now;
  }
  return env;
}
function dataDir() { return `${S.env.home}/.claude/plugins/data/planta-77` }

function makeIo($) {
  return {
    home: S.env.home, platform: S.env.platform,
    list: (p) => $.fs.list(p),
    read: (p) => $.fs.read(p),
    exists: (p) => $.fs.exists(p),
    tail: (p, n) => $.process.run(["tail", "-c", String(n), p], { timeoutMs: 8000 }).then((r) => r.stdout),
    run: (argv, init = {}) => $.process.run(argv, { timeoutMs: init.timeoutMs ?? 10000 }),
    now: () => $.clock.now(),
  };
}
async function readJson($, path) {
  try { return JSON.parse(await $.fs.read(path)) } catch { return null }
}

async function writeLive($, state, detail = "") {
  try {
    await boot($);
    if (!S.env.cli) return;
    const now = await $.clock.now();
    if (state === "work" && S.lastLive?.state === "work" && now - S.lastLive.at < WORK_REWRITE) return;
    S.lastLive = { state, at: now, detail: sanitize(detail).slice(0, 160) };
    await $.fs.write(`${dataDir()}/live/${S.env.cli}.json`, JSON.stringify(S.lastLive));
  } catch {}
}
async function readLive($, now) {
  const out = {};
  const dir = `${dataDir()}/live`;
  const list = await $.fs.list(dir).catch(() => []);
  for (const f of list) {
    if (f.kind !== "file" || !f.name.endsWith(".json") || now - f.mtimeMs > LIVE_TTL) continue;
    const d = await readJson($, `${dir}/${f.name}`);
    if (d && typeof d.state === "string" && typeof d.at === "number") out[f.name.slice(0, -5)] = d;
  }
  return out;
}

async function askAi($, folders, key, home) {
  const req = aiRequest(folders, home);
  let groups = null, reason = "";
  try {
    const r = await $.model.complete({ model: "haiku", system: req.system, prompt: req.prompt, maxTokens: 1500, effort: "low", timeoutMs: 30000 });
    if (!r?.isAnswered) reason = T.ai.noAnswer([r?.reason, r?.error, r?.status].filter(Boolean).join(" "));
    else {
      groups = parseAi(r.text, folders, home);
      if (!groups) reason = T.ai.badJson;
    }
  } catch (err) {
    reason = String(err?.message ?? err).slice(0, 160);
  }
  const now = await $.clock.now();
  if (groups) await $.store.set("groups", { key, groups, ai: true, at: now }).catch(() => {});
  else await $.store.set("aiFail", { key, at: now, reason }).catch(() => {});
  const pending = await $.store.get("aiPending").catch(() => null);
  if (pending?.key === key && pending.by === S.env.me) await $.store.delete("aiPending").catch(() => {});
  return { groups, reason };
}
async function cachedGroups($, key) {
  const cached = await $.store.get("groups").catch(() => null);
  return cached && cached.key === key && cached.ai === true && Array.isArray(cached.groups) ? cached.groups : null;
}
async function aiAllowed($, key, now) {
  if (!S.opts.ai) return false;
  const [pending, fail] = await Promise.all([$.store.get("aiPending"), $.store.get("aiFail")]).catch(() => []);
  return !(pending?.key === key && now - pending.at < AI_WAIT) && !(fail?.key === key && now - fail.at < AI_RETRY);
}
async function askAiLater($, folders, key, home) {
  const r = await askAi($, folders, key, home);
  if (r.groups && S.timer) await refresh($, true);
}
async function groupsFor($, raw) {
  const folders = folderList(raw);
  const key = groupsKey(folders);
  const cached = await cachedGroups($, key);
  if (cached) return cached;
  if (await aiAllowed($, key, raw.at)) {
    await $.store.set("aiPending", { key, at: raw.at, by: S.env.me }).catch(() => {});
    const pending = await $.store.get("aiPending").catch(() => null);
    if (pending?.key === key && pending.by === S.env.me) askAiLater($, folders, key, raw.home).catch(() => {});
  }
  return null;
}

async function compute($) {
  const now = await $.clock.now();
  const raw = await collect(makeIo($), { caches: S.caches, live: await readLive($, now) });
  const groups = await groupsFor($, raw);
  const model = buildModel(raw, groups, { partyDesks: S.opts.partyDesks, containerPrefix: S.opts.containerPrefix });
  model.v = SNAP_V;
  model.lang = S.opts.language;
  model.by = S.env.me;
  model.groupsByAi = !!groups && groups.some((g) => g.ai);
  return model;
}

async function writeClaim($, dir, until) {
  try { await $.fs.write(`${dir}/claim.json`, JSON.stringify({ by: S.env.me, until: until ?? (await $.clock.now()) + CLAIM_MS })) } catch {}
}
function usable(snap) { return snap?.v === SNAP_V && snap.lang === S.opts.language }
async function claimedByOther($, dir, now, shared) {
  if (!usable(shared)) return false;
  const claim = await readJson($, `${dir}/claim.json`);
  return !!claim && claim.by !== S.env.me && now < claim.until;
}
async function computeShared($, dir) {
  const renew = $.clock.every(CLAIM_RENEW, () => { writeClaim($, dir) });
  try { S.snap = await compute($) } finally { renew.cancel() }
  await $.fs.write(`${dir}/snap.json`, JSON.stringify(S.snap)).catch(() => {});
  await writeClaim($, dir);
}
async function releaseClaim($) {
  await boot($);
  const dir = dataDir();
  const claim = await readJson($, `${dir}/claim.json`);
  if (claim?.by === S.env.me) await writeClaim($, dir, 0);
}

async function refresh($, force = false) {
  if (S.ui.busy) { if (force) S.again = true; return }
  S.ui.busy = true;
  try {
    await boot($);
    const now = await $.clock.now();
    const dir = dataDir();
    const shared = force ? null : await readJson($, `${dir}/snap.json`);
    if (usable(shared) && now - shared.at < snapFresh()) S.snap = shared;
    else if (await claimedByOther($, dir, now, shared)) S.snap = shared;
    else {
      await writeClaim($, dir);
      if (await claimedByOther($, dir, now, shared)) S.snap = shared;
      else await computeShared($, dir);
    }
    S.ui.error = null;
    S.ui.sig = sigOf(S.snap);
    S.ui.now = await $.clock.now();
  } catch (err) {
    S.ui.error = String(err?.message ?? err).slice(0, 200);
  } finally {
    S.ui.busy = false;
  }
  $.ui.invalidate("ui.render");
  if (S.again) { S.again = false; await refresh($, true) }
}

function snapFresh() { return Math.max(2000, S.opts.refreshMs - 1000) }
function sigOf(snap) {
  if (!snap) return null;
  const parts = [
    snap.sessions.map((s) => [s.id, s.state, s.title, s.detail, s.project, s.traces?.length ? s.traces[s.traces.length - 1].ts : 0]),
    snap.projects.map((p) => [p.key, p.name, p.desk.length, p.party, p.cryo, p.lit]),
    snap.pipelines.map((p) => [p.key, p.status]),
    Math.round((snap.system?.cpu ?? 0) / 5), snap.docker?.list?.length ?? 0, snap.groupsByAi, Math.floor(snap.at / 60000),
  ];
  return hash(JSON.stringify(parts)).toString(36);
}

function tick($) { refresh($).catch(() => {}) }
function startTimer($) {
  if (!S.timer) S.timer = $.clock.every(S.opts.refreshMs, () => tick($));
}
function stopTimer() {
  if (S.timer) { S.timer.cancel(); S.timer = null }
}

async function openSession($, id) {
  if (!SESSION_RE.test(id)) return;
  await boot($);
  const url = `claude://claude.ai/epitaxy/${id}`;
  const r = await $.process.run([S.env.platform === "darwin" ? "open" : "xdg-open", url], { timeoutMs: 10000 }).catch((err) => ({ exitCode: 1, stderr: String(err) }));
  if (r.exitCode !== 0) $.ui.toast(T.pane.openFailed(r.exitCode));
}

function command($, kind, id = null, fresh = false) {
  S.ui.cmd = { seq: ++S.ui.cmdSeq, kind, id, ...(fresh ? { fresh: true } : {}) };
  $.ui.invalidate("ui.render");
}
function goTo($, mode, room = null) {
  S.ui.mode = mode;
  if (mode === "office") command($, room ? "room" : "home", room);
  else $.ui.invalidate("ui.render");
}

async function show($, mode, room = null) {
  S.ui.mode = mode;
  S.ui.open = true;
  S.ui.closed = false;
  if (S.ui.rho === null) { const r = await $.store.get("rho").catch(() => null); if (Number.isFinite(r) && r > 1.6 && r < 3.6) S.ui.rho = r }
  await $.ui.open({ id: PANE, title: "Planta 77", focus: true, closeOnEscape: true, columns: 130, backgroundColor: "#05060b" });
  startTimer($);
  if (!S.snap) await refresh($);
  else { $.ui.invalidate("ui.render"); tick($) }
  if (room) command($, "room", room, true);
}

const wheelSite = () => S.ui.mode === "office" && S.ui.remote === true && S.opts.wheel && !S.ui.compat;
async function onWheel($, e, next) {
  if (e.requestId !== PANE || e.component !== "Pane" || e.origin?.kind !== "person" || !wheelSite()) return next(e);
  const step = wheelStep(e, S.ui.wheel, await $.clock.now());
  S.ui.wheel = step.last;
  const at = e.pointer && Number.isFinite(e.pointer.column) && Number.isFinite(e.pointer.row) ? { x: Math.floor(e.pointer.column), y: Math.floor(e.pointer.row) } : null;
  if (at) S.ui.wheelPointer = true;
  if (step.factor !== 1 && (at || !S.ui.wheelPointer)) {
    S.ui.wheelSeq++;
    S.ui.wheelDir = step.factor > 1 ? 1 : -1;
    S.ui.wheelAt = at;
    $.ui.invalidate("ui.render");
  }
  return next({ ...e, offset: WHEEL_TOP });
}
function settle($) {
  $.ui.scroll({ in: PANE, to: { key: ANCHOR }, block: "start" }).catch(() => null).finally(() => { S.ui.settling = false });
}

function layersNow() {
  const sc = S.scene?.sc;
  if (!sc) return [];
  const lab = labelLayers(sc, S.snap, S.ui.bucket), base = tierLayers(sc, S.snap, S.ui.lod ?? 0);
  return [...base.filter((l) => !l.fx), ...base.filter((l) => l.fx), ...lab.layers];
}
function onClient($, d, element) {
  if (d.kind === "need" && typeof d.id === "string") {
    if (typeof element !== "string" || !/^ld-\d+$/.test(element)) return null;
    const l = layersNow().find((x) => x.key === d.id), n = Number.isInteger(d.n) && d.n >= 0 && d.n < LOADERS ? d.n : 0;
    return { props: { role: "loader", n, got: l ? { id: l.key, rev: l.rev, src: l.src, ...(l.label ? { bucket: S.ui.bucket } : {}) } : { id: clip(d.id, 60), gone: true } } };
  }
  if (d.kind === "view" && Number.isInteger(d.bucket) && d.bucket >= 0 && d.bucket < LABEL_BUCKETS) {
    const lod = d.lod === 0 || d.lod === 1 || d.lod === 2 ? d.lod : S.ui.lod;
    if (d.bucket !== S.ui.bucket || lod !== S.ui.lod) { S.ui.bucket = d.bucket; S.ui.lod = lod; $.ui.invalidate("ui.render") }
    return null;
  }
  if (d.kind === "rho" && Number.isFinite(d.rho) && d.rho > 1.6 && d.rho < 3.6) {
    if (Math.abs(d.rho - (S.ui.rho ?? 0)) > 0.004) { S.ui.rho = d.rho; $.store.set("rho", d.rho).catch(() => {}); $.ui.invalidate("ui.render") }
    return null;
  }
  if (d.kind === "diag" && S.ui.diag !== 0 && d.seq === S.ui.diag) {
    S.ui.diag = 0;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const out = { at: S.ui.now, fps: num(d.fps), renders: num(d.renders), ms: num(d.ms), maxGap: num(d.maxGap), slow: num(d.slow), rho: num(d.rho), cal: num(d.cal), cols: num(d.cols), rows: num(d.rows), layers: clip(String(d.layers ?? ""), 12), bucket: num(d.bucket), pages: num(d.pages), lod: num(d.lod), msgs: num(d.msgs), ticks: num(d.ticks), tickGap: num(d.tickGap), raw: d.raw === true, hidden: d.hidden === true, compat: S.ui.compat, faults: S.ui.faults, faultLog: S.ui.faultLog };
    $.fs.write(`${dataDir()}/diag.json`, JSON.stringify(out, null, 1)).catch(() => {});
    $.ui.toast(T.pane.diag(out));
    $.ui.invalidate("ui.render");
    return null;
  }
  if (d.kind === "mode" && (d.mode === "office" || d.mode === "cameras")) { S.ui.mode = d.mode; $.ui.invalidate("ui.render") }
  else if (d.kind === "camera" && typeof d.id === "string" && S.scene?.sc.rooms.some((r) => r.id === d.id)) goTo($, "office", d.id);
  return null;
}

function specialRoom(q) {
  if (SPECIAL_ROOMS.includes(q)) return q;
  for (const t of Object.values(STRINGS)) for (const [key, words] of Object.entries(t.roomWords)) if (words.includes(q)) return key;
  return null;
}
function roomFor(query) {
  const q = query.toLowerCase();
  const special = specialRoom(q);
  if (special) return special;
  const ps = S.snap?.projects ?? [];
  return (ps.find((p) => p.name.toLowerCase() === q) ?? ps.find((p) => p.name.toLowerCase().includes(q)))?.key ?? null;
}

async function dump($, dir) {
  await boot($);
  const target = dir || `${dataDir()}/dump`;
  let model = await compute($);
  let ai = model.groupsByAi ? T.dump.cached : T.dump.off;
  if (!model.groupsByAi && S.opts.ai) {
    const now = await $.clock.now();
    const raw = await collect(makeIo($), { caches: S.caches, live: await readLive($, now) });
    const folders = folderList(raw);
    const r = await askAi($, folders, groupsKey(folders), raw.home);
    ai = r.groups ? T.dump.fresh : T.dump.failed(r.reason);
    if (r.groups) model = await compute($);
  }
  const now = await $.clock.now();
  const hour = new Date(now + S.env.tz * 60000).getUTCHours();
  const out = [];
  await $.fs.write(`${target}/model.json`, JSON.stringify(model, null, 1));
  const sc = buildScene(model, { hour, aspect: 1.6 });
  for (const l of sc.layers) {
    await $.fs.write(`${target}/layer-${l.key}.svg`, l.src);
    out.push(T.dump.view(l.key, l.src.length, 2, 0));
  }
  await $.fs.write(`${target}/targets.json`, JSON.stringify({ rooms: sc.rooms, sessions: sc.sessions, queue: sc.queue }));
  return { text: `${T.dump.done(target, model, ai)}\n${out.join("\n")}` };
}

function hourNow() { return new Date(S.snap.at + S.env.tz * 60000).getUTCHours() }
function sceneFor(aspect) {
  const snap = S.snap, theme = themeFor(hourNow()).name;
  const key = `${S.ui.sig}|${theme}|${aspect.toFixed(1)}|${S.opts.language}`;
  if (S.scene?.key !== key) S.scene = { key, sc: buildScene(snap, { hour: hourNow(), aspect }) };
  return S.scene.sc;
}
function compatFor(aspect, cols) {
  const key = `${S.ui.sig}|${themeFor(hourNow()).name}|${aspect.toFixed(1)}|${cols}|${S.opts.language}`;
  if (S.compat?.key !== key) {
    const c = buildCompat(S.snap, { hour: hourNow(), aspect, p: (cols * 7.8) / 2600 });
    const sc = buildScene(S.snap, { hour: hourNow(), aspect });
    S.compat = { key, c, sc };
  }
  return S.compat;
}
function uiProps(sc, extra = {}) {
  const ui = S.ui;
  return {
    role: "ui", vb: sc.vb, rho: ui.rho ?? RHO, mode: ui.mode, rooms: sc.rooms, sessions: sc.sessions, info: sc.info, queue: sc.queue, counts: sc.counts, mini: sc.mini, mb: sc.mb,
    buckets: { p0: LABEL_P0, step: LABEL_STEP, n: LABEL_BUCKETS }, bucket: ui.bucket, lod: ui.lod, cmd: ui.cmd, wheel: wheelSite() ? { seq: ui.wheelSeq, dir: ui.wheelDir, ...(ui.wheelAt ?? {}) } : null,
    stale: !!ui.error, text: { ...T.hud, state: T.state }, ...(ui.diag ? { diag: ui.diag } : {}), ...(ui.mode === "cameras" ? { cams: cameraData(S.snap, S.env.tz) } : {}), ...extra,
  };
}

function drawPane($, e) {
  const t = $.ui.resolve(e);
  const cols = Math.max(30, Number(e.props?.bodyColumns) || 100);
  const ui = S.ui, snap = S.snap;
  if (!ui.open && !ui.closed) ui.open = true;
  if (ui.open && !S.timer) startTimer($);
  if (ui.open && !snap && !ui.busy) tick($);
  if (!snap) return t.Box({ flexDirection: "column", children: [t.Text({ key: "status", dimColor: true, children: ui.error ? T.pane.readError(ui.error) : T.pane.loading })] });
  const remote = e.surface !== "terminal" && !!t.Svg && !!t.Client;
  ui.remote = remote;
  if (!remote) {
    const c = snap.counts ?? {};
    const wait = snap.sessions.filter((s) => WAITING.has(s.state)).length;
    const status = T.pane.status({ sessions: snap.sessions.length, work: c.work ?? 0, wait, cafe: c.cafe ?? 0, lounge: c.lounge ?? 0, cryo: c.cryo ?? 0, rooms: snap.projects.length, ai: snap.groupsByAi });
    const lines = snap.projects.map((p) => `${p.name.padEnd(22)} ${T.pane.terminalRoom(String(p.desk.length).padStart(2), p.party, p.cryo)}`);
    const waiting = snap.sessions.filter((s) => WAITING.has(s.state)).slice(0, 8).map((s) => `${s.state === "perm" ? "!" : s.state === "ask" ? "?" : "✓"} ${clip(s.title, 60)}`);
    const pipes = snap.pipelines.slice(0, 3).map((p) => `${p.status === "SUCCESS" ? "✔" : p.status === "FAILED" ? "✖" : "▶"} ${p.project} ${clip(p.branch, 30)}`);
    return t.Box({ flexDirection: "column", children: [
      t.Text({ key: "status", dimColor: true, wrap: "truncate-end", children: status }),
      t.Text({ key: "rooms", children: lines.join("\n") }),
      ...(waiting.length ? [t.Text({ key: "waiting", color: "#fcee0a", children: waiting.join("\n") })] : []),
      ...(pipes.length ? [t.Text({ key: "pipes", dimColor: true, children: pipes.join("\n") })] : []),
    ] });
  }
  const bodyRows = Number(e.props?.scroll?.bodyRows);
  const rows = Math.max(MIN_ROWS, Number.isFinite(bodyRows) && bodyRows > 0 ? bodyRows : 30);
  const aspect = cols / (rows * (ui.rho ?? RHO));
  const abs = (key, child) => t.Box({ key, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, children: [child] });
  const client = (key, props) => t.Client({ key, module: "./stage.mjs", props, width: "100%", height: "100%" });
  const wheel = wheelSite();
  const children = [];
  if (wheel) {
    children.push(t.Box({ key: "wheel-top", height: WHEEL_TOP }));
    const offset = Number(e.props?.scroll?.offset);
    if (Number.isFinite(offset) && offset !== WHEEL_TOP && !ui.settling) { ui.settling = true; $.clock.after(40, () => settle($)) }
  }
  const anchor = t.Box({ key: "anchor-box", position: "absolute", top: 0, left: 0, children: [t.Button({ key: ANCHOR, label: " ", plain: true, onPress: () => {} })] });
  if (ui.compat) {
    const { c, sc } = compatFor(aspect, cols);
    const svgs = c.layers.map((src, i) => t.Box({ key: `c${i}`, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "stretch", children: [t.Svg({ key: "s", source: src, alt: i === 0 ? altText(snap, null) : "" })] }));
    children.push(t.Box({ key: "stage", height: rows, overflow: "hidden", children: [anchor, ...svgs, abs("ui-box", client("ui", uiProps(sc, { compat: true, lt: [] })))] }));
  } else {
    const sc = sceneFor(aspect);
    if (ui.lod === null) { const p = Math.max(cols / sc.vb[2], (rows * (ui.rho ?? RHO)) / sc.vb[3]) * 7.8; ui.lod = p < 0.5 ? 0 : p < 0.95 ? 1 : 2 }
    const lab = labelLayers(sc, snap, ui.bucket);
    const man = layersNow().map((l) => ({ id: l.key, rev: l.rev, ...(l.box ? { box: l.box } : {}), ...(l.room ? { room: l.room } : {}), ...(l.fx ? { fx: 1 } : {}), ...(l.label ? { lab: 1 } : {}) }));
    const pages = Array.from({ length: PAGES }, (_, n) => abs(`b-${n}`, client(`P-${n}`, { role: "page", n })));
    const loaders = Array.from({ length: LOADERS }, (_, n) => t.Client({ key: `ld-${n}`, module: "./stage.mjs", props: { role: "loader", n } }));
    children.push(t.Box({ key: "cal-box", height: 0, overflow: "hidden", flexDirection: "column", children: [t.Client({ key: "cal", module: "./stage.mjs", props: { role: "cal", rho: ui.rho ?? 0 } }), ...loaders] }));
    children.push(t.Box({ key: "stage", height: rows, overflow: "hidden", children: [anchor, ...pages, abs("ui-box", client("ui", uiProps(sc, { lt: lab.targets, man })))] }));
  }
  if (wheel) children.push(t.Box({ key: "wheel-bottom", height: WHEEL_BOTTOM }));
  return t.Box({ flexDirection: "column", children });
}

function passThrough($, e, next) { return next(e) }

export function register(on, options = {}) {
  const language = languageOf(options.language);
  if (language !== S.opts.language) {
    S.caches = { desktop: new Map(), tails: new Map(), folders: new Map() };
    S.snap = null;
    S.scene = null;
    S.compat = null;
  }
  setLanguage(language);
  S.opts = { language, partyDesks: options.party_desks === true, ai: options.ai_grouping !== false, refreshMs: Math.max(5, Math.min(120, Number(options.refresh_seconds) || 5)) * 1000, containerPrefix: String(options.container_prefix ?? ""), wheel: options.wheel_zoom !== false };
  S.ui.compat = options.compat_mode === true;

  on("session.start", async ($, e, next) => {
    const result = await next(e);
    try { await $.command.register({ name: "office", description: T.commands.office, argumentHint: T.commands.officeHint, immediate: true }) } catch {}
    try { await $.command.register({ name: "cameras", description: T.commands.cameras, immediate: true }) } catch {}
    return result;
  });

  on("command.run", { command: "office" }, async ($, e) => {
    const args = String(e.args ?? "").trim();
    if (args === "dump" || args.startsWith("dump ")) return dump($, args.slice(4).trim());
    if (args === "diag") { await show($, "office", null); S.ui.diag = (await $.clock.now()) || 1; $.ui.invalidate("ui.render"); return {} }
    await show($, "office", null);
    const room = args ? roomFor(args) : null;
    if (room) command($, "room", room, true);
    return {};
  });
  on("command.run", { command: "cameras" }, async ($) => {
    await show($, "cameras");
    return {};
  });

  on("ui.close", async ($, e, next) => {
    if (e.id === PANE) { S.ui.open = false; S.ui.closed = true; S.ui.cmd = null; stopTimer(); await releaseClaim($).catch(() => {}) }
    return next(e);
  }).catch(passThrough);

  on("ui.scroll", onWheel).catch(passThrough);

  on("ui.message", async ($, e, next) => {
    const d = e.data;
    if (e.requestId !== undefined && e.requestId !== PANE) return next(e);
    if (d && typeof d === "object" && !Array.isArray(d)) {
      if (d.kind === "session" && typeof d.id === "string") await openSession($, d.id);
      else {
        const answer = onClient($, d, e.element);
        if (answer) return answer;
      }
    }
    return next(e);
  }).catch(passThrough);

  on("ui.fault", async ($, e, next) => {
    if (e.requestId === PANE) {
      S.ui.faults++;
      S.ui.faultLog = [...S.ui.faultLog.slice(-4), { element: clip(String(e.element ?? ""), 40), phase: clip(String(e.phase ?? ""), 40), reason: clip(String(e.reason ?? ""), 200) }];
      if (!S.ui.compat) { S.ui.compat = true; $.ui.invalidate("ui.render") }
    }
    return next(e);
  }).catch(passThrough);

  on("turn.start", async ($, e, next) => {
    await writeLive($, "work");
    return next(e);
  }).catch(passThrough);
  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId === undefined) await writeLive($, "turn");
    return r;
  }).catch(passThrough);
  on("classic.PermissionRequest", async ($, e, next) => {
    const t = traceOf(e.tool_name, e.tool_input);
    await writeLive($, "perm", `${t.tool} › ${t.text}`);
    return next(e);
  }).catch(passThrough);
  on("tool.call", async ($, e, next) => {
    const main = e.agentId === undefined;
    if (main && e.tool === "AskUserQuestion") await writeLive($, "ask", traceOf("AskUserQuestion", e).text);
    const r = await next(e);
    if (main && S.lastLive && S.lastLive.state !== "work") await writeLive($, "work");
    return r;
  }).catch(passThrough);

  on("ui.render", { component: "Pane" }, ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    return drawPane($, e);
  });
}
