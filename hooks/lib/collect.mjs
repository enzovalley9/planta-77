import { readTail, decide, sanitize, THRESHOLDS, DAY } from "./states.mjs";
import { T } from "./strings.mjs";

export const TAIL_BYTES = 96 * 1024, TAIL_BYTES_WIDE = 2 * 1024 * 1024;
const FOLDER_TTL = 10 * 60 * 1000;

export function encodeCwd(cwd) { return String(cwd).replace(/[^A-Za-z0-9]/g, "-") }
export function desktopRoot(home, platform) {
  return platform === "darwin" ? `${home}/Library/Application Support/Claude/claude-code-sessions` : `${home}/.config/Claude/claude-code-sessions`;
}
export function repoRoot(cwd) {
  const i = String(cwd).indexOf("/.claude-worktrees/");
  if (i >= 0) return cwd.slice(0, i);
  const j = String(cwd).indexOf("/.claude/worktrees/");
  return j >= 0 ? cwd.slice(0, j) : cwd;
}

async function safe(p, fallback) { try { return await p } catch { return fallback } }

export async function readDesktop(io, cache) {
  const root = desktopRoot(io.home, io.platform);
  const out = [];
  const seen = new Set();
  for (const a of await safe(io.list(root), [])) {
    if (a.kind !== "dir") continue;
    for (const b of await safe(io.list(`${root}/${a.name}`), [])) {
      if (b.kind !== "dir") continue;
      const dir = `${root}/${a.name}/${b.name}`;
      for (const f of await safe(io.list(dir), [])) {
        if (f.kind !== "file" || !/^local_[0-9a-f-]+\.json$/.test(f.name)) continue;
        const path = `${dir}/${f.name}`;
        seen.add(path);
        const hit = cache?.get(path);
        if (hit && hit.mtimeMs === f.mtimeMs) { out.push(hit.rec); continue }
        const d = await safe(io.read(path).then(JSON.parse), null);
        if (!d || typeof d.sessionId !== "string") continue;
        const rec = {
          id: d.sessionId, cli: d.cliSessionId ?? null, title: String(d.title ?? T.untitled), cwd: String(d.cwd ?? d.originCwd ?? io.home),
          created: Number(d.createdAt) || 0, last: Number(d.lastActivityAt) || 0, archived: !!d.isArchived, pinned: !!d.isStarred,
          turns: Number(d.completedTurns) || 0,
          summary: d.postTurnSummary ? sanitize(d.postTurnSummary.needs_action || d.postTurnSummary.status_detail || "") : "",
          status: d.postTurnSummary?.status_category ?? null,
        };
        cache?.set(path, { mtimeMs: f.mtimeMs, rec });
        out.push(rec);
      }
    }
  }
  if (cache) for (const k of [...cache.keys()]) if (!seen.has(k) && k.startsWith(root)) cache.delete(k);
  return out;
}

export async function transcriptTimes(io, cwds) {
  const out = new Map();
  for (const cwd of cwds) {
    const dir = `${io.home}/.claude/projects/${encodeCwd(cwd)}`;
    for (const f of await safe(io.list(dir), [])) if (f.kind === "file" && f.name.endsWith(".jsonl")) out.set(`${dir}/${f.name}`, f.mtimeMs);
  }
  return out;
}

export function newestStore(entries, plugin) {
  return entries.filter((e) => e.kind === "file" && e.name.startsWith(plugin + "_") && e.name.endsWith(".json")).sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}
export async function readStores(io) {
  const dir = `${io.home}/.claude/plugins/store`;
  const entries = await safe(io.list(dir), []);
  const read = async (f) => {
    const d = await safe(io.read(`${dir}/${f.name}`).then(JSON.parse), null);
    return d ? { at: f.mtimeMs, data: d } : null;
  };
  const heatFile = newestStore(entries, "heat-gate");
  const others = entries.filter((e) => e.kind === "file" && e.name.endsWith(".json") && !/^(planta-77|heat-gate)_/.test(e.name)).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 12);
  const [heat, ...feeds] = await Promise.all([heatFile ? read(heatFile) : null, ...others.map(read)]);
  const radar = feeds.find((f) => f?.data?.radar?.pipelines) ?? null;
  const mrs = feeds.find((f) => Array.isArray(f?.data?.mrs?.mrs)) ?? null;
  const out = { pipelines: null, mrs: null, system: null, docker: null };
  if (radar?.data?.radar?.pipelines) {
    out.pipelines = {
      at: radar.data.radar.at ?? radar.at, me: radar.data.radar.me ?? null,
      list: Object.values(radar.data.radar.pipelines).map((p) => ({
        key: p.key, path: p.path, project: p.project, branch: p.branch ?? p.ref ?? "", status: p.status, duration: p.duration ?? null,
        startedAt: Date.parse(p.startedAt ?? p.createdAt ?? "") || 0, finishedAt: Date.parse(p.finishedAt ?? "") || 0,
        stages: (p.stages ?? []).map((s) => ({ name: s.name, group: s.group })), baseline: p.baseline ?? null,
      })).sort((a, b) => (b.finishedAt || b.startedAt) - (a.finishedAt || a.startedAt)),
    };
  }
  if (Array.isArray(mrs?.data?.mrs?.mrs)) {
    const me = mrs.data.mrs.me;
    const list = mrs.data.mrs.mrs;
    out.mrs = { at: mrs.data.mrs.fetchedAt ?? mrs.at, open: list.length, mine: list.filter((m) => m.author === me).length, byProject: list.reduce((a, m) => (a[m.project] = (a[m.project] ?? 0) + 1, a), {}) };
  }
  const sense = heat?.data?.sense?.sample;
  if (sense) {
    out.system = {
      at: heat.data.sense.at ?? heat.at, cpu: Number(sense.cpu) || 0, temp: Number(sense.tctl ?? sense.acpi) || null, ncpu: sense.ncpu ?? null,
      ramUsed: sense.mem ? sense.mem.used / 1e9 : null, ramTotal: sense.mem ? sense.mem.total / 1e9 : null, swapUsed: sense.mem ? sense.mem.swapUsed / 1e9 : null,
    };
  }
  if (Array.isArray(heat?.data?.docker?.list)) out.docker = { at: heat.data.docker.at ?? heat.at, list: heat.data.docker.list.map((c) => ({ name: String(c.name), cpu: Number(c.cpu) || 0, mem: Number(c.mem) || 0 })) };
  return out;
}

export async function readFolder(io, cwd, cache, now) {
  const hit = cache?.get(cwd);
  if (hit && now - hit.at < FOLDER_TTL) return hit.info;
  const info = { cwd, isRepo: false, repos: [] };
  if (cwd === io.home) { cache?.set(cwd, { at: now, info }); return info }
  info.isRepo = await safe(io.exists(`${cwd}/.git`), false);
  if (!info.isRepo) {
    const r = await safe(io.run(["find", cwd, "-mindepth", "2", "-maxdepth", "3", "-name", ".git", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.claude-worktrees/*"], { timeoutMs: 8000 }), null);
    const gits = r ? String(r.stdout).split("\n").filter((p) => p.startsWith(cwd + "/") && /^[^/]+\/\.git$/.test(p.slice(cwd.length + 1))) : [];
    const names = gits.map((p) => p.slice(cwd.length + 1, -5));
    const times = new Map(names.map((n) => [n, 0]));
    if (gits.length) {
      const st = await safe(io.run(io.platform === "darwin" ? ["stat", "-f", "%m %N", ...gits] : ["stat", "-c", "%Y %n", ...gits], { timeoutMs: 8000 }), null);
      for (const row of String(st?.stdout ?? "").split("\n")) {
        const m = row.match(/^(\d+) (.+)\/\.git$/);
        if (m && m[2].startsWith(cwd + "/")) times.set(m[2].slice(cwd.length + 1), Number(m[1]) * 1000);
      }
    }
    info.repos = [...times.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
  }
  cache?.set(cwd, { at: now, info });
  return info;
}

export async function collect(io, opts = {}) {
  const now = await io.now();
  const caches = opts.caches ?? {};
  const all = await readDesktop(io, caches.desktop);
  const sessions = all.filter((s) => !s.archived);
  const cwds = [...new Set(sessions.map((s) => s.cwd))];
  const times = await transcriptTimes(io, cwds);
  const live = opts.live ?? {};
  for (const s of sessions) {
    s.transcript = s.cli ? `${io.home}/.claude/projects/${encodeCwd(s.cwd)}/${s.cli}.jsonl` : null;
    s.mtime = s.transcript ? times.get(s.transcript) ?? 0 : 0;
    s.live = s.cli ? live[s.cli] ?? null : null;
    const recent = now - Math.max(s.last, s.mtime) < THRESHOLDS.doze || (s.live && now - (s.live.at || 0) < DAY);
    s.tail = null;
    if (recent && s.transcript && s.mtime) {
      const hit = caches.tails?.get(s.transcript);
      if (hit && hit.mtime === s.mtime) s.tail = hit.tail;
      else {
        let text = await safe(io.tail(s.transcript, TAIL_BYTES), "");
        s.tail = readTail(text);
        if (!s.tail.lines && text.length >= TAIL_BYTES * 0.9) {
          text = await safe(io.tail(s.transcript, TAIL_BYTES_WIDE), "");
          s.tail = readTail(text);
        }
        caches.tails?.set(s.transcript, { mtime: s.mtime, tail: s.tail });
      }
    }
    const d = decide(s, now);
    s.state = d.state; s.age = d.age; s.detail = d.detail; s.source = d.source;
    s.traces = s.tail?.traces ?? [];
    s.subagents = s.state === "work" ? s.tail?.subagents ?? 0 : 0;
    s.repo = repoRoot(s.cwd);
  }
  const roots = [...new Set(sessions.filter((s) => s.state !== "cryo" || now - s.last < 7 * DAY).map((s) => s.repo))];
  const folders = {};
  for (const cwd of roots) folders[cwd] = await readFolder(io, cwd, caches.folders, now);
  const stores = await readStores(io);
  return { at: now, home: io.home, platform: io.platform, total: all.length, archived: all.length - sessions.length, sessions, folders, stores };
}
