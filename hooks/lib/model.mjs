import { folderList, heuristicGroups, projectsFrom } from "./projects.mjs";
import { tildify, hash, SKINS, NEONS, JACKETS, STYLES } from "./util.mjs";
import { DAY } from "./states.mjs";
import { T } from "./strings.mjs";

export const AT_DESK = new Set(["work", "turn", "perm", "ask", "idle", "doze"]);
export const MAX_PROJECT_ROOMS = 8;

export function lookOf(seed) {
  const h = hash(seed);
  const ix = { s: h % SKINS.length, h: (h >>> 3) % NEONS.length, j: (h >>> 11) % JACKETS.length, t: (h >>> 15) % NEONS.length, i: (h >>> 19) % NEONS.length };
  const cyberArm = ((h >>> 26) % 3) === 0;
  return { skin: SKINS[ix.s], hair: NEONS[ix.h], style: STYLES[(h >>> 7) % STYLES.length], jacket: JACKETS[ix.j], trim: NEONS[ix.t], implant: NEONS[ix.i], visor: ((h >>> 23) % 5) === 0, cyberArm, q: `qs${ix.s} qh${ix.h} qj${ix.j} qt${ix.t} qi${ix.i} ${cyberArm ? "qc" : "qn"}` };
}

const ORDER = { perm: 0, ask: 0, turn: 1, work: 2, idle: 3, doze: 4, cafe: 5, lounge: 6, cryo: 7 };

export function trimDocker(docker, prefix) {
  if (!docker || !prefix) return docker ?? null;
  return { ...docker, list: docker.list.map((c) => (c.name.startsWith(prefix) && c.name.length > prefix.length ? { ...c, name: c.name.slice(prefix.length) } : c)) };
}

export function buildModel(raw, groups, opts = {}) {
  const now = raw.at;
  const folders = folderList(raw);
  const projects = projectsFrom(groups ?? heuristicGroups(folders, raw.home), folders, raw.home);
  const projectOf = new Map();
  for (const p of projects) for (const c of p.members) projectOf.set(c, p.key);
  const sessions = raw.sessions.map((s) => ({
    id: s.id, cli: s.cli, title: s.title, path: tildify(s.cwd, raw.home), project: projectOf.get(s.repo) ?? null,
    state: s.state, age: s.age, last: Math.max(s.last, s.mtime || 0), detail: s.detail ?? "", source: s.source, pinned: s.pinned,
    traces: (s.traces ?? []).map((t) => ({ tool: t.tool, text: t.text, ts: t.ts ?? 0 })), subagents: s.subagents ?? 0,
  })).sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.last - a.last);

  for (const p of projects) {
    const mine = sessions.filter((s) => s.project === p.key);
    p.count = mine.length;
    p.desk = mine.filter((s) => AT_DESK.has(s.state) || s.state === "cafe" || (opts.partyDesks && s.state === "lounge")).map((s) => s.id);
    p.party = mine.filter((s) => s.state === "lounge").length;
    p.cryo = mine.filter((s) => s.state === "cryo").length;
    p.lit = mine.some((s) => AT_DESK.has(s.state) || s.state === "cafe");
    p.recent = Math.max(0, ...mine.map((s) => s.last));
    p.active = mine.filter((s) => s.state !== "cryo").length;
  }
  const eligible = projects.filter((p) => p.active > 0 || now - p.recent < 7 * DAY)
    .sort((a, b) => Number(b.lit) - Number(a.lit) || b.desk.length - a.desk.length || b.active - a.active || b.recent - a.recent);
  const roomProjects = eligible.slice(0, MAX_PROJECT_ROOMS);
  const overflow = eligible.slice(MAX_PROJECT_ROOMS);
  if (overflow.length) {
    const rest = { key: "others", name: T.others, members: overflow.flatMap((p) => p.members), path: T.moreProjects(overflow.length), repos: overflow.map((p) => p.name.toLowerCase()), ai: false, neon: "#9fb4d6", count: 0, desk: [], party: 0, cryo: 0, lit: false, recent: 0, active: 0 };
    for (const p of overflow) {
      for (const k of ["count", "party", "cryo", "active"]) rest[k] += p[k];
      rest.desk.push(...p.desk); rest.lit ||= p.lit; rest.recent = Math.max(rest.recent, p.recent);
      for (const s of sessions) if (s.project === p.key) s.project = "others";
    }
    roomProjects.push(rest);
  }
  const roomKeys = new Set(roomProjects.map((p) => p.key));

  const st = raw.stores ?? {};
  const pipelines = (st.pipelines?.list ?? []).slice(0, 12).map((p) => ({ ...p, room: roomProjects.find((r) => r.repos.includes(p.project))?.key ?? null }));
  const counts = {};
  for (const s of sessions) counts[s.state] = (counts[s.state] ?? 0) + 1;
  return {
    v: 1, at: now, home: raw.home, total: raw.total, archived: raw.archived, counts,
    sessions, projects: roomProjects, roomKeys: [...roomKeys],
    pipelines, pipelinesAt: st.pipelines?.at ?? null, mrs: st.mrs ?? null, system: st.system ?? null, docker: trimDocker(st.docker, opts.containerPrefix),
    sources: { desktop: raw.total > 0, pipelines: !!st.pipelines, mrs: !!st.mrs, system: !!st.system, docker: !!st.docker },
  };
}
