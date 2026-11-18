import { hash, basename, tildify, clip } from "./util.mjs";
import { sanitize } from "./states.mjs";

const NOT_NAME = /[^\p{Lu}\p{Nd}._ -]/gu;

export const PROJECT_NEONS = ["#00e5ff", "#ff2bd6", "#fcee0a", "#39ff88", "#ff8a00", "#b26bff", "#7fd8ff", "#ff6a3d"];

export function folderList(raw) {
  const by = new Map();
  for (const s of raw.sessions) {
    const f = by.get(s.repo) ?? { cwd: s.repo, count: 0, active: 0, recent: 0, titles: [] };
    f.count++;
    if (s.state !== "cryo") f.active++;
    f.recent = Math.max(f.recent, s.last);
    f.titles.push([s.last, s.title]);
    by.set(s.repo, f);
  }
  return [...by.values()].map((f) => {
    const info = raw.folders[f.cwd] ?? { isRepo: false, repos: [] };
    return { cwd: f.cwd, path: tildify(f.cwd, raw.home), count: f.count, active: f.active, recent: f.recent, titles: f.titles.sort((a, b) => b[0] - a[0]).slice(0, 4).map((t) => clip(sanitize(t[1]), 60)), isRepo: info.isRepo, repos: info.repos ?? [] };
  }).sort((a, b) => a.cwd.localeCompare(b.cwd));
}

export function nameOf(cwd, home) {
  if (cwd === home) return "HOME";
  return basename(cwd).toUpperCase().replace(NOT_NAME, "-").slice(0, 26);
}

export function heuristicGroups(folders, home) {
  return folders.map((f) => ({ name: nameOf(f.cwd, home), members: [f.cwd], ai: false }));
}

export function groupsKey(folders) {
  return "g" + hash(folders.map((f) => f.cwd).sort().join("\n")).toString(36);
}

export function aiRequest(folders, home) {
  const lines = folders.map((f, i) => {
    const repos = f.isRepo ? "(a git repo)" : f.repos.length ? `repos inside: ${f.repos.slice(0, 10).join(", ")}${f.repos.length > 10 ? ` and ${f.repos.length - 10} more` : ""}` : "no repos inside";
    return `${i}. ${tildify(f.cwd, home)} · ${repos} · ${f.count} sessions · titles: ${f.titles.map((t) => JSON.stringify(t)).join(", ")}`;
  });
  return {
    system: "You group a developer's working folders into projects for a dashboard. You answer with valid JSON only, with no text around it.",
    prompt: `These are the folders where Claude Code sessions were opened:\n${lines.join("\n")}\n\nRules:\n- Put folders together only when they are clearly the same project or product (for example, the repo of a service and a docs or workspace folder of the same product with a similar name). Look at the names, the repos and the titles.\n- A parent folder that holds many different repos (a workspace) is a group of its own: do not put it together with a child folder.\n- The home folder (~) goes on its own.\n- Each folder goes in exactly one group. Every folder must appear.\n- Give each group a short name in capital letters, the name people would use for it (22 characters at most).\n\nAnswer with exactly this format: {"groups":[{"name":"NAME","folders":[0,3]}]}`,
  };
}

export function parseAi(text, folders, home) {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let d;
  try { d = JSON.parse(m[0]) } catch { return null }
  if (!Array.isArray(d?.groups)) return null;
  const used = new Set();
  const out = [];
  for (const g of d.groups) {
    const idx = [...new Set((Array.isArray(g?.folders) ? g.folders : []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < folders.length && !used.has(i));
    if (!idx.length) continue;
    idx.forEach((i) => used.add(i));
    const members = idx.map((i) => folders[i].cwd);
    const raw = String(g.name ?? "").toUpperCase().replace(NOT_NAME, "").trim().slice(0, 22);
    out.push({ name: raw || nameOf(members[0], home), members, ai: members.length > 1 });
  }
  folders.forEach((f, i) => { if (!used.has(i)) out.push({ name: nameOf(f.cwd, home), members: [f.cwd], ai: false }) });
  return out;
}

export function projectsFrom(groups, folders, home) {
  const byCwd = new Map(folders.map((f) => [f.cwd, f]));
  const taken = new Set();
  return groups.map((g) => {
    const fs = g.members.map((c) => byCwd.get(c)).filter(Boolean);
    const key = "p" + hash(g.members.slice().sort().join("|")).toString(36);
    const repos = [];
    for (const f of fs) {
      if (f.isRepo && !repos.includes(basename(f.cwd))) repos.push(basename(f.cwd));
      for (const r of f.repos) if (!repos.includes(r)) repos.push(r);
    }
    const shortest = fs.map((f) => f.cwd).sort((a, b) => a.length - b.length)[0] ?? g.members[0];
    let ci = hash(g.name) % PROJECT_NEONS.length;
    for (let k = 0; k < PROJECT_NEONS.length && taken.has(ci); k++) ci = (ci + 1) % PROJECT_NEONS.length;
    taken.add(ci);
    return { key, name: g.name, members: g.members, path: g.members.length > 1 ? g.members.map((c) => tildify(c, home)).join(" + ") : tildify(shortest, home), repos, ai: !!g.ai, neon: PROJECT_NEONS[ci] };
  });
}
