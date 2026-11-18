import { R, P, lit, esc } from "../util.mjs";
import { block, quad, onY, onX, onFloor, at, halo, spark, pool, glow, glows, hair, wallY, rad, fadeDown, fadeRight, blend, blink, frames, stepMove } from "../kit.mjs";
import { bot, seatedBack, typingFx } from "../chars.mjs";
import { use } from "../props.mjs";
import { shell, front, sign, target } from "./shell.mjs";
import { WH, WT, STATE_COLOR, person, obstacle } from "../ctx.mjs";
import { WAITING } from "../states.mjs";
import { T } from "../strings.mjs";

const TINT = ["#39ff88", "#22e4ff", "#ff2bd6", "#ffb000"];
const TONE = "013210232031302113", FEED = "031220311203123002";
const ICON = { perm: "!", ask: "?", turn: "✓" };
const AMBER = "#ffb000", INK = "#05060a";
const GUARD = { q: "qs1 qh2 qj4 qt2 qi2 qn", style: "buzz", visor: true, trim: "#fcee0a" };
const LEG = 48, FW = R(1.732 * LEG);

export function defs() {
  const mon = (art) => `<rect x="-1" y="-1" width="31" height="16" rx=".8" fill="${INK}"/><rect width="29" height="14" class="cc" opacity=".22"/>${art}<rect x="1.5" y="11.6" width="7" height="1" class="cc" opacity=".8"/><rect width="29" height="4" fill="#fff" opacity=".08"/>`;
  return [
    `<path d="M0 14L11 5h7l11 9M11 5V0M18 5V0" class="scc" fill="none" stroke-width=".7" opacity=".75"/><rect x="13.6" y="6.4" width="1.8" height="3.8" class="cc"/>`,
    `<path d="M3 8.6l11.5-5 11.5 5-11.5 4.4z" class="scc" fill="none" stroke-width=".7" opacity=".75"/><path d="M10 8h2M15 6.4h2M17 10h2" class="scc" stroke-width="1.4"/>`,
    `<path d="M2 9l3-4 3 2.4 4-5 3 6.4 4-3.2 3 2 5-4.4" class="scc" fill="none" stroke-width=".9"/>`,
    `<rect x="9.4" y="2.4" width="9" height="9" fill="none" class="scc" stroke-width=".6" opacity=".8"/><circle cx="13.9" cy="5.6" r="1.7" class="cc"/><path d="M10.8 11.4q3.1-6 6.2 0z" class="cc"/>`,
  ].map((a, i) => `<g id="cctv-m${i}">${mon(a)}</g>`).join("");
}

const feed = (i, cols, f = FEED[i % 18], t = TONE[i % 18]) => `<use href="#cctv-m${f}" x="${(i % cols) * 33 + 1}" y="${((i / cols) | 0) * 17 + 1}" style="--c:${TINT[t]}"/>`;

function bigScreen(ctx, n, c) {
  const cnt = ctx.model.counts ?? {}, w = R(FW - 8), col = n ? c : "#39ff88", lod = ctx.lod, nx = lod ? 26 : R(FW / 2);
  let s = `<rect width="${FW}" height="${WH}" fill="${blend("#191c26", "#090a0f")}"/><rect x="4" y="6" width="${w}" height="38" fill="${blend(n ? "#2a2205" : "#06200f", "#0b0902")}"/>`;
  s += (lod ? `<ellipse cx="${nx}" cy="27" rx="24" ry="15" fill="${rad(col)}" opacity=".45"/>` : "") + `<text x="${nx}" y="${lod ? 37 : 38}" text-anchor="middle" class="cx" font-size="${lod ? 27 : 30}" fill="${lit(col, 0.5)}">${n}</text>`;
  if (lod >= 1) {
    s += `<rect x="4" y="6" width="${w}" height="6.4" fill="${c}" opacity=".14"/><text x="7" y="11" class="mo" font-size="4.4" fill="${lit(c, 0.3)}">SEC//NET</text><text x="${R(w - 7)}" y="11" class="mo" font-size="4.4" fill="#ff3b5c">REC</text>`;
    Object.keys(ICON).forEach((k, i) => { const v = cnt[k] ?? 0, y = 15.2 + i * 7.2; s += `<g opacity="${v ? 1 : 0.32}"><rect x="50" y="${R(y)}" width="7" height="5.8" rx="1" fill="${STATE_COLOR[k]}"/><text x="53.5" y="${R(y + 4.8)}" text-anchor="middle" class="cx" font-size="5.4" fill="${INK}">${ICON[k]}</text><text x="60" y="${R(y + 5.2)}" class="cx" font-size="6.8" fill="${STATE_COLOR[k]}">${v}</text></g>` });
    s += `<text x="${R(FW / 2)}" y="42.4" text-anchor="middle" class="mo" font-size="4.2" fill="${lit(col, 0.4)}">${esc(T.cams.waiting(n))}</text>`;
  }
  s += `<rect x="4" y="6" width="${w}" height="38" fill="none" stroke="${c}" stroke-width=".9"/>`;
  if (lod >= 2) s += `<rect x="4" y="6" width="${w}" height="11" fill="#fff" opacity=".04"/><path d="M6 49h22M6 51.4h22M6 53.8h22" stroke="#2c3140" stroke-width=".8"/><path d="${[0, 1, 2, 3, 4, 5].map((k) => `M${46 + k * 6} 54l3-6h3l-3 6z`).join("")}" fill="${c}" opacity=".85"/>`;
  return s;
}

export function cctvRoom(ctx, r) {
  const c = r.neon, X = r.x, Y = r.y, lod = ctx.lod;
  const p = (u, v, z = 0) => P(X + u, Y + v, z);
  const n = ctx.model.sessions.filter((q) => WAITING.has(q.state)).length;
  const end = WT + LEG, cols = 4, wy = Y + end + R((r.d - end + cols * 33) / 2) - 1, wz = 54;
  const cell = (i) => [(i % cols) * 33 + 1, ((i / cols) | 0) * 17 + 1];
  let s = shell(ctx, r, c, true, { floor: "#0d0f15", pool: 0.24, noReflect: true });
  s += sign(ctx, r, r.name, c, true, lod ? [T.scene.cctvSign] : [], { dx: 60, avail: 94, maxSize: 12 });

  let wall = `<rect x="-3" y="-2" width="${cols * 33 + 5}" height="56" fill="${INK}" opacity=".72"/>`;
  if (lod) for (let i = 0; i < cols * 3; i++) wall += feed(i, cols);
  else TINT.forEach((t, k) => { let d = ""; for (let i = 0; i < cols * 3; i++) if (+TONE[i % 18] === k) d += `M${cell(i).join(" ")}h29v14h-29z`; wall += `<path d="${d}" fill="${t}" opacity=".45"/>` });
  s += onX(X + WT + 0.3, wy, wz, wall);
  if (lod) s += onFloor(X + WT, Y + end + 6, 0.2, `<rect width="52" height="${r.d - end - 10}" fill="${fadeRight("#22e4ff", 0.2, 0)}"/>`);

  if (lod >= 1) {
    s += block(X + 64, Y + WT, 0, 50, 13, 22, "#171a24", { top: "#262b3a", edge: c });
    s += onY(X + 64, Y + WT + 13.1, 22, `<path d="M40 2.8h1.6M40 13.8h1.6M43 8.3h1.6M43 19.3h1.6" stroke="#39ff88" stroke-width="1.6"/>` + (lod >= 2 ? `<path d="M0 5.5h50M0 11h50M0 16.5h50" stroke="${INK}" stroke-width=".8"/><path d="M3 2.8h18M3 8.3h18M3 13.8h18M3 19.3h18" stroke="${INK}" stroke-width="2.2"/><path d="M43 2.8h1.6M40 8.3h1.6M46 13.8h1.6" stroke="${c}" stroke-width="1.6"/><path d="M46 2.8h1.6M46 19.3h1.6" stroke="#ff3b5c" stroke-width="1.6"/>` : ""));
  }

  if (lod) s += quad([p(WT, WT, WH), p(end, WT, WH), p(WT, end, WH)], "#272c3b");
  s += at(p(WT, end, WH), bigScreen(ctx, n, c)) + (lod ? glow(p(WT, end, WH - 1.2), p(end, WT, WH - 1.2), c, 1.3) : hair(p(WT, end, WH - 1.2), p(end, WT, WH - 1.2), c, 1.6));
  obstacle(ctx, [p(WT, end, WH), p(end, WT, WH), p(WT, end, 8), p(end, WT, 8)]);
  if (lod) s += pool(X + 46, Y + 46, 0, 62, 24, c, 0.42);
  const b = p(20, 20, WH);
  s += at(b, `<ellipse rx="7.4" ry="3.4" fill="${INK}"/><path d="M-5.4 0v-7a5.4 5.4 0 0 1 10.8 0v7q-5.4 2.2-10.8 0z" fill="${n ? "#ffd34d" : "#5e4708"}" stroke="${INK}" stroke-width=".7"/>`);

  if (lod >= 1) {
    s += quad([p(32, 64), p(64, 32), p(112, 32), p(112, 118), p(32, 118)], "#07080c", `opacity=".8" stroke="${c}" stroke-width=".8" stroke-opacity=".7"`);
    const bw = r.w - WT - 8;
    let st = "";
    for (let k = 4; k < bw - 8; k += 12) st += `M${k} 9l5-9h5l-5 9z`;
    s += onFloor(X + WT + 4, Y + r.d - 16, 0.2, `<rect width="${bw}" height="9" fill="#06070a"/><path d="${st}" fill="${c}" opacity=".9"/>`);
  }

  const desk = lod ? { top: "#2a3041", edge: c, edgeO: 0.9, edgeW: 0.8 } : { top: "#2a3041" };
  const mini = (t, art) => `<rect x="-1" y="-1" width="18" height="12" fill="${INK}"/><rect width="16" height="10" fill="${TINT[t]}" opacity=".3"/><path d="${art}" stroke="${TINT[t]}" stroke-width=".9" fill="none"/>`;
  s += block(X + 40, Y + 40, 0, 62, 13, 14, "#1a1e2a", desk);
  if (lod >= 2) {
    s += block(X + 64, Y + 46, 14, 17, 5.4, 0.8, "#3a4460", { top: "#4b5878" });
    s += onFloor(X + 82, Y + 44, 14.1, `<rect width="14" height="7" fill="${INK}"/><path d="M2 2.4h2M6 2.4h2M10 2.4h2" stroke="${c}" stroke-width="1.6"/><path d="M2 5h2M10 5h2" stroke="#ff3b5c" stroke-width="1.6"/><path d="M6 5h2" stroke="#39ff88" stroke-width="1.6"/>`);
    s += onY(X + 62, Y + 42, 26, mini(1, "M2 3h9M2 5.4h6M2 7.8h11")) + onY(X + 82, Y + 42, 26, mini(3, "M2 3h7M2 5.4h11M2 7.8h5")) + use("mug", p(94.5, 38, -3.4));
  }
  s += block(X + 40, Y + 53, 0, 13, 56, 14, "#1a1e2a", desk);
  if (lod >= 2) {
    s += onX(X + 44, Y + 74, 26, mini(0, "M2 7l3-3 3 2 3-4 3 3")) + onX(X + 44, Y + 94, 26, mini(2, "M2 4l3 3 3-5 3 4 3-2"));
    s += onFloor(X + 42.5, Y + 97, 14.1, `<rect width="8.4" height="10" fill="#ff8fc7"/><circle cx="4.2" cy="2.8" r="1.5" fill="none" stroke="#7a3b12" stroke-width="1.5"/><circle cx="4.2" cy="7.2" r="1.5" fill="none" stroke="#fff3d6" stroke-width="1.5"/>`);
  }

  const seat = p(74, 65, 9), ch = p(68, 32);
  s += (lod ? use("ch", ch, `--c:${c}`) : "") + seatedBack(seat, GUARD, { typing: true }) + use("cb", ch, `--c:${c}`);
  person(ctx, null, seat, 34, r.key);

  const AU = 44, AV = 150, SCAN = "#22e4ff", g = p(94, 158);
  if (lod >= 2) {
    const post = (u) => block(X + u, Y + AV, 0, 4, 6, 33, "#222738", { top: "#343b52" });
    s += onFloor(X + AU + 8, Y + AV + 10, 0.2, `<path d="M0 6l5-6 5 6M0 13l5-6 5 6" stroke="${c}" stroke-width="1.6" fill="none" opacity=".7"/>`);
    s += pool(X + AU + 14, Y + AV + 6, 0, 24, 10, SCAN, 0.5) + post(AU) + wallY(X + AU + 4, Y + AV + 6, 0, 33, 20, fadeDown(SCAN, 0.26, 0.05)) + post(AU + 24) + glows([[p(AU + 4, AV + 6, 2), p(AU + 4, AV + 6, 32)], [p(AU + 24, AV + 6, 2), p(AU + 24, AV + 6, 32)]], SCAN, 0.9);
    s += block(X + AU, Y + AV, 33, 28, 6, 5, "#222738", { top: "#343b52", edge: c, edgeO: 1 }) + spark(p(AU + 14, AV + 3, 38.6), 3.4, "#39ff88");
  }
  s += (lod ? halo(g, 26, 11, c, 0.5) : "") + at(g, `<g transform="scale(1.7)">${bot([0, 0], c, { glow: !!lod })}</g>`);
  s += front(ctx, r, c, true);
  ctx.S.push(s);

  let f = !lod ? "" : at(p(WT, end, WH), blink(`<circle cx="${R(FW - 25)}" cy="9.4" r="1.4" fill="#ff3b5c"/>`, { ticks: 2 }) + `<g><rect x="4" y="12.4" width="${R(FW - 8)}" height="1.2" fill="${c}" opacity=".22"/>${stepMove(["0 0", "0 8", "0 16", "0 24"], { ticks: 2 })}</g>`);
  if (lod >= 1) {
    const swap = [[1, 3, 3], [cols + 2, 1, 4], [cols * 2, 2, 4]].map(([i, f2, ticks], k) => blink(feed(i, cols, f2, (+TONE[i % 18] + 2) % 4), { pattern: [0, 1], ticks, phase: k }));
    const dots = [0, cols - 1, cols + 1, cols * 2 + 2].map((i, k) => blink(`<circle cx="${cell(i)[0] + 26.4}" cy="${cell(i)[1] + 2.4}" r="1.1" fill="#ff3b5c"/>`, { ticks: 2, phase: k }));
    f += onX(X + WT + 0.3, wy, wz, swap.join("") + dots.join(""));
    if (lod >= 2) f += onY(X + 64, Y + WT + 13.1, 22, blink(`<path d="M43 2.8h1.6M40 19.3h1.6" stroke="#39ff88" stroke-width="1.6"/>`, { ticks: 1, pattern: [1, 0.2, 1, 1] }) + blink(`<path d="M46 8.3h1.6M40 13.8h1.6" stroke="#ff3b5c" stroke-width="1.6"/>`, { ticks: 3, phase: 1 }));
    f += typingFx(seat, GUARD);
  }
  if (lod >= 2) f += `<g>${glow(p(AU + 4, AV + 6, 6), p(AU + 24, AV + 6, 6), SCAN, 0.7, 0.8)}${stepMove(["0 0", "0 -8", "0 -16", "0 -24", "0 -16", "0 -8"], { ticks: 1 })}</g>`;
  if (n) {
    const beam = (d) => `<path d="M0 -6L${d * 62} -21V9z" fill="${fadeRight(AMBER, d < 0 ? 0 : 0.6, d < 0 ? 0.6 : 0)}"/>`;
    f += at(b, `<circle cy="-6" r="22" fill="${rad(AMBER)}"/>` + frames([beam(-1), beam(1)], { ticks: 2 }) + spark([0, -6], 9, AMBER));
  }
  ctx.F.push(f);
  target(ctx, r, r.name, c);
}
