import { T } from "./strings.mjs";

export const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
export const THRESHOLDS = { turn: 30 * MIN, idle: 90 * MIN, doze: 3 * HOUR, cafe: 14 * HOUR, lounge: 3 * DAY };
export const WAITING = new Set(["turn", "perm", "ask"]);
export const LIVE_FRESH = 10 * MIN;
export const WRITING_FRESH = 90 * 1000;
export const TOOL_IN_FLIGHT = 30 * MIN;

const SECRET = [
  [/\b(glpat|gldt|glptt|glrt|glsoat)-[\w-]{8,}/g, "$1-***"],
  [/\bgh[pousr]_[A-Za-z0-9]{10,}/g, "gh*_***"],
  [/\bsk-[A-Za-z0-9_-]{10,}/g, "sk-***"],
  [/\bxox[abposr]-[\w-]{6,}/g, "xox*-***"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "AKIA***"],
  [/\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/g, "jwt***"],
  [/\bhv[sbr]\.[\w-]{20,}/g, "hv*.***"],
  [/\bs\.[A-Za-z0-9]{24,}\b/g, "s.***"],
  [/(\bAuthorization["']?\s*[:=]\s*["']?)[^"'\n]+/gi, "$1***"],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 ***"],
  [/(\b(?:(?:mysql|mariadb)[\w-]*|sshpass|rabbitmqadmin|(?:docker|podman|buildah|nerdctl)\s+login)\b[^;|&\n]*?\s-p(?:\s+(?![-<>]))?)("[^"]*"|'[^']*'|[^\s"']+)/g, "$1***"],
  [/(\bredis-cli\b[^;|&\n]*?\s-a\s+)("[^"]*"|'[^']*'|[^\s"']+)/g, "$1***"],
  [/(\bcurl\b[^;|&\n]*?\s(?:-u\s*|--user[=\s]\s*)["']?[^\s:"']*:)[^\s"']+/g, "$1***"],
  [/(--(?:[\w-]*[-_])?(?:password|passwd|pass|pwd|token|secret|api[-_]?key|access[-_]?key)(?:=|\s+)(?![-<>]))("[^"]*"|'[^']*'|[^\s"']+)/gi, "$1***"],
  [/(\b[\w.-]*(?:password|passwd|pwd|token|secret|api[_-]?key|private[_-]?(?:token|key)|access[_-]?key)[\w.-]*\b["']?\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1***"],
  [/(\b\w*pass\w*=)("[^"]*"|'[^']*'|\S+)/gi, "$1***"],
  [/(PRIVATE-TOKEN:\s*)\S+/gi, "$1***"],
  [/(\/\/[^\s/:@]*:)(?!\d+(?:[/?#\s"'`]|$))[^\s"'`]*@/g, "$1***@"],
  [/\b[0-9a-f]{40,}\b/gi, "***"],
];
export function sanitize(text) {
  let s = String(text ?? "");
  for (const [re, to] of SECRET) s = s.replace(re, to);
  return s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

const TOOL_LABEL = { Bash: "Bash", Read: "Read", Edit: "Edit", Write: "Write", MultiEdit: "Edit", Grep: "Grep", Glob: "Glob", WebFetch: "Web", WebSearch: "Web", Agent: "Agent", Task: "Agent", Skill: "Skill", NotebookEdit: "Edit" };
function base(p) { return String(p ?? "").split("/").filter(Boolean).pop() ?? "" }
export function traceOf(name, input) {
  const i = input && typeof input === "object" ? input : {};
  const tool = name === "AskUserQuestion" ? T.askTool : TOOL_LABEL[name] ?? (String(name).startsWith("mcp__") ? String(name).split("__").pop() : String(name));
  let text;
  if (name === "Bash") text = i.description || String(i.command ?? "").split("\n")[0];
  else if (["Read", "Edit", "Write", "MultiEdit", "NotebookEdit"].includes(name)) text = base(i.file_path ?? i.notebook_path);
  else if (name === "Grep" || name === "Glob") text = String(i.pattern ?? "");
  else if (name === "WebFetch") { try { text = new URL(String(i.url)).host } catch { text = "" } }
  else if (name === "WebSearch") text = String(i.query ?? "");
  else if (name === "Agent" || name === "Task") text = i.description || i.subagent_type || T.subagent;
  else if (name === "AskUserQuestion") text = i.questions?.[0]?.question ?? "";
  else if (name === "Skill") text = i.skill ?? "";
  else if (name === "ToolSearch") text = String(i.query ?? "");
  else text = i.description ?? "";
  return { tool, text: sanitize(text).slice(0, 120) };
}

function isPrompt(content) {
  if (typeof content === "string") return content.trim().length > 0;
  return Array.isArray(content) && content.some((b) => b?.type === "text" && String(b.text ?? "").trim()) && !content.some((b) => b?.type === "tool_result");
}

export function readTail(text) {
  const out = { lastTs: 0, endTurn: false, lastKind: null, pending: [], traces: [], ask: null, subagents: 0, lines: 0 };
  if (!text) return out;
  const rows = String(text).split("\n");
  if (rows.length > 1 && !rows[0].trimStart().startsWith("{")) rows.shift();
  const pending = new Map();
  for (const raw of rows) {
    if (!raw.trim()) continue;
    let d;
    try { d = JSON.parse(raw) } catch { continue }
    if (d.isSidechain || (d.type !== "user" && d.type !== "assistant")) continue;
    out.lines++;
    const ts = Date.parse(d.timestamp ?? "") || 0;
    if (ts > out.lastTs) out.lastTs = ts;
    const m = d.message ?? {}, content = m.content;
    if (d.type === "assistant") {
      const blocks = Array.isArray(content) ? content : [];
      for (const b of blocks) {
        if (b?.type === "tool_use") {
          pending.set(b.id, { name: b.name, input: b.input, ts });
          out.traces.push({ ts, ...traceOf(b.name, b.input) });
        }
      }
      if (blocks.some((b) => b?.type === "text" || b?.type === "tool_use")) {
        out.lastKind = blocks.some((b) => b?.type === "tool_use") ? "tool_use" : "text";
        out.endTurn = m.stop_reason === "end_turn" || (out.lastKind === "text" && m.stop_reason !== "tool_use" && m.stop_reason != null);
      }
    } else {
      if (Array.isArray(content)) for (const b of content) if (b?.type === "tool_result") pending.delete(b.tool_use_id);
      if (isPrompt(content)) { out.lastKind = "prompt"; out.endTurn = false }
      else if (Array.isArray(content) && content.some((b) => b?.type === "tool_result")) { out.lastKind = "tool_result"; out.endTurn = false }
    }
  }
  out.pending = [...pending.values()];
  const ask = out.pending.find((p) => p.name === "AskUserQuestion");
  if (ask) out.ask = { text: sanitize(ask.input?.questions?.[0]?.question ?? T.hasQuestion), ts: ask.ts };
  out.subagents = out.pending.filter((p) => p.name === "Agent" || p.name === "Task").length;
  out.traces = out.traces.slice(-3);
  return out;
}

export function decide(s, now) {
  const tail = s.tail;
  const last = Math.max(s.last || 0, s.mtime || 0, tail?.lastTs || 0);
  const age = Math.max(0, now - last);
  const live = s.live && now - (s.live.at || 0) < (WAITING.has(s.live.state) && s.live.state !== "turn" ? 3 * DAY : LIVE_FRESH) ? s.live : null;
  if (live && (live.state === "perm" || live.state === "ask") && age < THRESHOLDS.lounge) return { state: live.state, age, detail: live.detail ?? "", source: "live" };
  if (live && live.state === "work") return { state: "work", age, detail: "", source: "live" };
  if (tail?.ask && age < THRESHOLDS.lounge) return { state: "ask", age, detail: tail.ask.text, source: "transcript" };
  if (tail && !tail.endTurn && tail.lastKind) {
    const inFlight = tail.pending.length > 0 && now - (tail.lastTs || last) < TOOL_IN_FLIGHT;
    const writing = s.mtime && now - s.mtime < WRITING_FRESH;
    if (inFlight || writing) return { state: "work", age, detail: "", source: "transcript" };
  }
  if (age < THRESHOLDS.turn) return { state: "turn", age, detail: s.summary ?? "", source: "time" };
  if (age < THRESHOLDS.idle) return { state: "idle", age, detail: "", source: "time" };
  if (age < THRESHOLDS.doze) return { state: "doze", age, detail: "", source: "time" };
  if (age < THRESHOLDS.cafe) return { state: "cafe", age, detail: "", source: "time" };
  if (age < THRESHOLDS.lounge || s.pinned) return { state: "lounge", age, detail: "", source: "time" };
  return { state: "cryo", age, detail: "", source: "time" };
}
