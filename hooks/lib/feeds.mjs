import { clip } from "./util.mjs";
import { STATE_COLOR } from "./ctx.mjs";

const STAGE = { success: "#39ff88", failed: "#ff3b5c", running: "#00e5ff", pending: "#00e5ff", created: "#3a4256", skipped: "#3a4256", manual: "#b26bff", canceled: "#8fa3c7" };
const PIPE_COLOR = { SUCCESS: "#39ff88", FAILED: "#ff3b5c", RUNNING: "#00e5ff", PENDING: "#00e5ff", CANCELED: "#8fa3c7" };
const PIPE_ICON = { SUCCESS: "✔", FAILED: "✖", RUNNING: "▶", PENDING: "…", CANCELED: "⊘" };

export function clockText(ms, tzMin = 0, withSec = true) {
  const d = new Date(ms + tzMin * 60000), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${withSec ? ":" + p(d.getUTCSeconds()) : ""}`;
}
const dur = (q) => { const s = Math.round(q.duration ?? 0); return s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "" };

export function cameraData(model, tzMin = 0) {
  const traces = [];
  for (const s of model.sessions) for (const t of s.traces ?? []) traces.push({ ts: t.ts || 0, id: s.id, c: STATE_COLOR[s.state], n: clip(s.title, 34), tool: clip(t.tool, 16), x: clip(t.text, 96) });
  traces.sort((a, b) => b.ts - a.ts);
  const sy = model.system, dk = model.docker?.list ?? [];
  return {
    traces: traces.slice(0, 30).map((t) => ({ id: t.id, c: t.c, n: t.n, tool: t.tool, x: t.x, t: t.ts ? clockText(t.ts, tzMin, false) : "--:--" })),
    pipes: (model.pipelines ?? []).slice(0, 6).map((p) => ({
      c: PIPE_COLOR[p.status] ?? "#fcee0a", i: PIPE_ICON[p.status] ?? "●", p: clip(p.project, 26), b: clip(String(p.branch ?? "").replace(/^(feat|feature|fix|integration)\//, ""), 32),
      st: (p.stages ?? []).slice(0, 7).map((sg) => STAGE[sg.group] ?? "#3a4256"), d: dur(p),
    })),
    radar: !!model.sources?.pipelines,
    mrs: model.mrs ? [model.mrs.open ?? 0, model.mrs.mine ?? 0] : null,
    sys: sy ? { cpu: Math.round((sy.cpu ?? 0) * 10) / 10, temp: sy.temp ? Math.round(sy.temp) : 0, ram: sy.ramUsed ? [Math.round(sy.ramUsed * 10) / 10, Math.round(sy.ramTotal ?? 0)] : null } : null,
    docker: dk.slice(0, 6).map((d) => clip(d.name, 20)), dockerN: dk.length,
  };
}
