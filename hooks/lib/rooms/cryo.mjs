import { R, P, hash, lit, clip } from "../util.mjs";
import { block, onY, onX, onFloor, halo, rad, fadeDown, blend, glow, neonText, text, blink, frames } from "../kit.mjs";
import { bot, HAIR_STYLES } from "../chars.mjs";
import { camera, cameraFx, wallScreen } from "../props.mjs";
import { shell, front, sign, target } from "./shell.mjs";
import { WH, WT, person, mark, obstacle } from "../ctx.mjs";
import { lookOf } from "../model.mjs";
import { T } from "../strings.mjs";

const ICE = "#7fd8ff", SNOW = "#e6faff", DAY = 864e5, EDGES = [3, 5, 7, 14, 30, 60], PODS = 14;
const TUBE = "M-12.9 -6V-49a12.9 7.4 0 0 1 25.8 0V-6a12.9 7.4 0 0 1-25.8 0z";
const RING = "M-15.9 -2.4a15.9 9.2 0 0 0 31.8 0";
const agoShort = (ms) => { const h = ms / 36e5; return h < 48 ? Math.round(h) + " h" : Math.round(h / 24) + " d" };

export function defs() {
  const lg = (id, vertical, stops) => `<linearGradient id="cryo-${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? "" : ` stop-opacity="${a}"`}/>`).join("")}</linearGradient>`;
  const base = (on) => (on ? `<ellipse cy="4" rx="31" ry="13" fill="${rad(ICE)}" opacity=".6"/>` : "")
    + `<path d="M-15.9 -6v6a15.9 9.2 0 0 0 31.8 0v-6z" fill="url(#cryo-metal)"/><ellipse cy="-6" rx="15.9" ry="9.2" fill="${on ? "#43557c" : "#2a3652"}"/>`
    + (on ? `<path d="${RING}" fill="none" stroke="${ICE}" stroke-width="3.4" opacity=".28"/><path d="${RING}" fill="none" stroke="${SNOW}" stroke-width=".9"/>` : `<path d="${RING}" fill="none" stroke="#35566f" stroke-width=".9"/>`)
    + `<path d="${TUBE}" fill="${on ? "url(#cryo-in)" : "#08121f"}"${on ? "" : ' opacity=".9"'}/><ellipse cy="-6" rx="11" ry="6.2" fill="${on ? SNOW : "#1f4058"}" opacity="${on ? 0.9 : 0.55}"/>`;
  const lid = `<path d="${TUBE}" fill="url(#cryo-glass)" stroke="#c4f0ff" stroke-width=".7"/><path d="M-12.9 -6V-26h25.8V-6a12.9 7.4 0 0 1-25.8 0z" fill="url(#cryo-rime)"/>`
    + `<path d="M-9 -13V-43" stroke="#fff" stroke-width="2.2" opacity=".26" stroke-linecap="round"/><path d="M-5.4 -19v-13" stroke="#fff" stroke-width=".9" opacity=".3" stroke-linecap="round"/><path d="M4 -12l3.4 -4.4M6 -11v-5.4M9.4 -9.4l-4.6 -2.2M-8 -6l2.6 -3.4M-4.6 -4.6v-4" stroke="#fff" stroke-width=".5" opacity=".7"/>`
    + `<path d="M-14.1 -56v7a14.1 8.1 0 0 0 28.2 0v-7z" fill="url(#cryo-metal)"/><ellipse cy="-56" rx="14.1" ry="8.1" fill="#51658f"/><ellipse cy="-56" rx="9" ry="5.2" fill="#2c3b5e" stroke="#172038" stroke-width=".8"/><ellipse cy="-56" rx="3.4" ry="2" fill="${ICE}" opacity=".85"/><path d="M-14.1 -56a14.1 8.1 0 0 0 28.2 0" fill="none" stroke="#bfeaff" stroke-width=".6" opacity=".8"/>`
    + `<rect x="-9.2" y="-47.6" width="6.4" height="4.6" rx="1" fill="#060b14"/><circle cx="-6" cy="-45.3" r="1.4" fill="#17435a"/>`
    + `<rect x="-5.4" y="4" width="10.8" height="3.6" rx=".7" fill="#04101a"/><path d="M-3.8 5.8h3.2M1 5.8h2.6" stroke="${ICE}" stroke-width=".9"/>`;
  const fig = `<use href="#c-legs"/><use href="#c-torso"/><path d="M-6 -23.4L3.4 -17.6M6 -23.4L-3.4 -17.6" stroke="#05060b" stroke-width="4.6" stroke-linecap="round"/><path d="M-6 -23.4L3.4 -17.6M6 -23.4L-3.4 -17.6" class="sj ln" stroke-width="3.2"/><circle cx="3.8" cy="-17.2" r="1.7" class="sk ol"/><circle cx="-3.8" cy="-17.2" r="1.7" class="sk ol"/>`
    + `<g transform="translate(0 -31.6)"><use href="#c-head"/><path d="M-3.4 .9h2.2M1.4 .9h2.2M-1 3.7h2" stroke="#12131a" stroke-width=".7" stroke-linecap="round"/></g>`;
  const ghost = `<g fill="#062a44" opacity=".85"><circle cy="-36" r="5.6"/><path d="M-6.4 -29q6.4 -3 12.8 0l-1.2 13l-1.2 9h-8l-1.2 -9z"/></g>`;
  const tank = `<path d="M-15.9 -46V0a15.9 9.2 0 0 0 31.8 0V-46z" fill="url(#cryo-steel)"/><path d="M-15.9 -14V0a15.9 9.2 0 0 0 31.8 0V-14z" fill="url(#cryo-rime)"/>`
    + `<path d="M-15.9 -46a15.9 12.4 0 0 1 31.8 0a15.9 9.2 0 0 1-31.8 0z" fill="#f2f8ff"/><path d="M0 -58.4a15.9 12.4 0 0 1 15.9 12.4a15.9 9.2 0 0 1-15.9 9.2z" fill="#8fa3c2" opacity=".55"/>`
    + `<path d="M-15.9 -35a15.9 9.2 0 0 0 31.8 0M-15.9 -9a15.9 9.2 0 0 0 31.8 0" fill="none" stroke="#4c5b78" stroke-width="1.3"/>`
    + `<rect x="-11.8" y="-21" width="6" height="18" rx="3" fill="${ICE}" opacity=".3"/><rect x="-10.6" y="-29" width="3.6" height="27" rx="1.8" fill="#04101a"/><rect x="-9.8" y="-18" width="2" height="15.2" rx="1" fill="${SNOW}"/>`
    + `<text x="-3" y="-17" class="cx" font-size="8" fill="#1b3558">LN2</text><path d="M5 -9.6l3.6 -3.8l3.6 3.8l-3.6 3.8z" fill="#fcee0a"/><path d="M8.6 -11.6v3M8.6 -7.6v.1" stroke="#1b1a05" stroke-width=".9"/>`
    + `<path d="M0 -58v-6" stroke="#4c5b78" stroke-width="2.6"/><ellipse cy="-64" rx="5.4" ry="2.6" fill="none" stroke="#ff8a3d" stroke-width="1.3"/>`;
  return lg("metal", 0, [[0, "#44557c"], [0.45, "#26334f"], [1, "#0e1524"]])
    + lg("in", 1, [[0, "#04121f", 0.92], [0.5, "#0d4668", 0.88], [1, "#a8eaff", 0.96]])
    + lg("glass", 0, [[0, "#eafcff", 0.6], [0.24, "#9fdcff", 0.12], [0.72, ICE, 0.05], [1, "#eafcff", 0.42]])
    + lg("rime", 1, [[0, "#ffffff", 0], [1, "#f4fdff", 0.8]])
    + lg("steel", 0, [[0, "#f6faff"], [0.38, "#b4c4da"], [1, "#46546f"]])
    + `<g id="cryo-on">${base(true)}</g><g id="cryo-off">${base(false)}</g><g id="cryo-lid">${lid}</g><g id="cryo-fig">${fig}</g>`
    + HAIR_STYLES.map((k) => `<g id="cryo-u-${k}"><use href="#cryo-on"/><g transform="translate(0 -8) scale(.9)" opacity=".78"><use href="#cryo-fig"/><use href="#hf-${k}" y="-31.6"/></g><use href="#cryo-lid"/></g>`).join("")
    + `<g id="cryo-c1"><use href="#cryo-on"/>${ghost}<use href="#cryo-lid"/></g><g id="cryo-c0"><use href="#cryo-off"/><use href="#cryo-lid"/></g><g id="cryo-tank">${tank}</g>`;
}

function display(ctx, r, c, cryo) {
  const lod = ctx.lod, W = 164, H = 40, u = r.x + 134, v = r.y + WT + 0.2, zt = 53;
  let inner = lod >= 1 ? neonText(6, 35.4, String(cryo.length), c, { size: 29, ls: 0.6 }) + text(lod >= 2 ? 15 : 6, 8.8, T.scene.frozen, { size: 6, cls: "cs", ls: 1.1, fill: c }) : text(6, 31, String(cryo.length), { size: 29, ls: 0.6, fill: lit(c, 0.6) });
  if (lod >= 1) {
    const bins = EDGES.map(() => 0);
    for (const s of cryo) { let k = 0; while (k < 5 && s.age / DAY >= EDGES[k + 1]) k++; bins[k]++ }
    const max = Math.max(1, ...bins);
    let bars = "", ticks = "";
    bins.forEach((b, i) => {
      const h = R(b ? Math.max(1.6, (b / max) * 15) : 0.6), bx = 80 + i * 13.6;
      bars += `<rect x="${bx}" y="${R(31 - h)}" width="10.4" height="${h}" fill="${lit(c, i * 0.13)}"/>`;
      if (lod >= 2) ticks += `<text x="${R(bx + 5.2)}" y="36.8">${EDGES[i]}d</text>` + (b ? `<text x="${R(bx + 5.2)}" y="${R(29.8 - h)}" fill="${SNOW}">${b}</text>` : "");
    });
    inner += `<path d="M78 31.4H${W - 4}" stroke="${c}" stroke-width=".5" opacity=".7"/>` + bars;
    if (lod >= 2) inner += `<path d="M5 6.4h7M6.7 3.4l3.6 6M10.3 3.4l-3.6 6" stroke="${SNOW}" stroke-width=".9" stroke-linecap="round"/>` + text(W - 5, 8.8, "-196°C", { size: 5.2, cls: "mo", anchor: "end", fill: SNOW, fit: false }) + `<g class="mo" font-size="4.2" text-anchor="middle" fill="#a9d4ea">${ticks}</g>`;
  }
  obstacle(ctx, [P(u, v, zt + 1), P(u + W, v, zt + 1), P(u, v, zt - H), P(u + W, v, zt - H)]);
  return (lod >= 2 ? halo(P(u + W / 2, v, zt - H / 2), 104, 44, c, 0.42) : "") + wallScreen(u, v, zt, W, H, c, inner, { bg: "#03121d" });
}

function vault(ctx, r, c, over) {
  const { x, y, d } = r, lod = ctx.lod, len = d - 24, cols = Math.floor((len - 4) / 12), W = cols * 12, m = R((len - W) / 2), cap = cols * 5, n = Math.min(over, cap);
  const ly = (j) => R(4.4 + j * 9.6), lx = (i) => R(m + 9.6 + i * 12), run = (j, a, b) => `M${lx(a)} ${ly(j)}H${R(lx(b - 1) + 0.1)}`;
  const box = block(x + WT, y + 14, 0, 9, len, 51, "#22304f", { top: "#44557c", right: "#1d2a48" });
  if (over > 0) mark(ctx, { kind: "chip", a: P(x + WT + 9, y + d / 2, 22), text: T.scene.moreSessions(over), color: c, prio: 3, size: 7, room: r.key, tier: 1 });
  if (lod < 1) return box;
  let g = `<rect width="${len}" height="51" fill="${blend("#2c3d63", "#141d35")}"/>`, seams = "", dim = "", on = "";
  for (let i = 0; i <= cols; i++) seams += `M${R(m + i * 12)} 1.6V49.6`;
  for (let j = 0; j <= 5; j++) seams += `M${m} ${R(1.6 + j * 9.6)}H${R(m + W)}`;
  g += `<path d="${seams}" stroke="#070c17" stroke-width=".9" fill="none"/>`;
  if (lod >= 2) { let hd = ""; for (let j = 0; j < 5; j++) hd += `M${R(m + 2.6)} ${R(8.4 + j * 9.6)}H${R(m + W)}`; g += `<path d="${hd}" stroke="#8298c0" stroke-width="1.2" stroke-dasharray="4.6 7.4"/>` }
  const scatter = lod >= 2 && n < cap, order = Array.from({ length: cap }, (_, i) => i).sort((a, b) => hash("v" + a) - hash("v" + b));
  const dot = (i) => `M${lx(i % cols)} ${ly(Math.floor(i / cols))}h.1`;
  if (scatter) order.slice(0, n).forEach((i) => { on += dot(i) });
  for (let j = 0; j < 5; j++) {
    const q = scatter ? 0 : Math.floor(n / 5) + (j < n % 5 ? 1 : 0);
    if (q < cols) dim += run(j, 0, cols - q);
    if (q) on += run(j, cols - q, cols);
  }
  const live = order.slice(0, n).filter((i) => i < cols * 2 && (scatter || i % cols >= cols - Math.floor(n / 5))).slice(0, 6);
  for (const half of [0, 1]) {
    const pick = live.filter((_, k) => k % 2 === half).map(dot).join("");
    if (pick) ctx.F.push(onX(x + WT + 9, y + 14 + len, 51, blink(`<path d="${pick}" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/>`, { pattern: [1, 0], ticks: 4, phase: half })));
  }
  const dots = scatter ? "" : ' stroke-dasharray=".1 11.9"';
  g += `<g fill="none" stroke-linecap="round"${dots}>${dim ? `<path d="${dim}" stroke="#1d2c49" stroke-width="1.5" stroke-dasharray=".1 11.9"/>` : ""}${on ? `<path d="${on}" stroke="${c}" stroke-width="4.6" opacity=".34"/><path d="${on}" stroke="${SNOW}" stroke-width="1.9"/>` : ""}</g>`;
  return box + onX(x + WT + 9, y + 14 + len, 51, g) + (lod >= 2 ? glow(P(x + WT + 9, y + 14 + len, 51), P(x + WT + 9, y + 14, 51), c, 0.9, 0.8) : "");
}

function deck(ctx, r, c, rows) {
  const { w, d } = r, lod = ctx.lod, gx = 36, gy = 80, gw = w - 78, gd = 14, pitch = (w - 118) / 6;
  let g = lod >= 1 ? `<rect x="${gx}" y="${gy - 20}" width="${gw}" height="20" fill="${fadeDown(c, 0, 0.3)}"/><rect x="${gx}" y="${gy + gd}" width="${gw}" height="24" fill="${fadeDown(c, 0.3, 0)}"/>` : "";
  if (lod >= 2) {
    let pipes = `M${w - 26} 44V${gy + gd / 2}H${gx + gw}`;
    for (let k = 0; k < 7; k++) pipes += `M${R(60 + k * pitch)} ${rows[0] + 12}V${gy}M${R(60 + k * pitch)} ${gy + gd}V${rows[1] - 12}`;
    g += `<g fill="none"><path d="${pipes}" stroke="#263451" stroke-width="4.4"/><path d="${pipes}" stroke="${c}" stroke-width="1" opacity=".75"/></g>`;
  }
  g += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gd}" fill="#02060c"/><rect x="${gx}" y="${gy + 2.5}" width="${gw}" height="${gd - 5}" fill="${c}" opacity=".7"/><rect x="${gx}" y="${gy + gd / 2 - 0.9}" width="${gw}" height="1.8" fill="${SNOW}" opacity=".8"/>`;
  if (lod >= 1) g += `<path d="M${gx} ${gy + gd / 2}H${gx + gw}" stroke="#0b1322" stroke-width="${gd}" stroke-dasharray="3 2.6" opacity=".88"/>`;
  if (lod >= 2) {
    g += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gd}" fill="none" stroke="#4a5d84" stroke-width="1.1"/>`;
    g += `<path d="M${gx} ${gy - 2.4}H${gx + gw}M${gx} ${gy + gd + 2.4}H${gx + gw}" stroke="#fcee0a" stroke-width="1.3" stroke-dasharray="5 5" opacity=".45"/>`;
    let nums = "";
    for (let k = 0; k < 7; k++) nums += `<text x="${R(53 + k * pitch)}" y="${d - 16}">${String(k + 1).padStart(2, "0")}</text>`;
    g += `<g class="cx" font-size="9" fill="${c}" opacity=".5">${nums}</g>`;
  }
  return onFloor(r.x, r.y, 0.2, g) + (lod >= 2 ? onY(r.x + gx, r.y + gy + gd / 2, 22, `<rect width="${gw}" height="22" fill="${fadeDown(c, 0, 0.2)}"/>`) : "");
}

export function cryoRoom(ctx, r) {
  const c = r.neon, lod = ctx.lod, { x, y, w, d } = r;
  const cryo = ctx.model.sessions.filter((s) => s.state === "cryo");
  const rows = [62, d - 44], pitch = (w - 118) / 6, lights = [[], [], [], []];
  let s = shell(ctx, r, c, true, { floor: "#0e182a", pool: 0.36 });
  if (lod >= 2) s += onY(x + WT, y + WT + 0.1, 20, `<rect width="${w - WT}" height="20" fill="${fadeDown(SNOW, 0, 0.16)}"/><path d="M12 11H${w - 40}M12 15H${w - 40}" stroke="#3a4b70" stroke-width="2.6"/><path d="M12 10.2H${w - 40}M12 14.2H${w - 40}" stroke="#bfeaff" stroke-width=".6" opacity=".7"/>`)
    + onY(x + w - 96, y + WT + 0.2, 44, `<rect width="26" height="24" rx="1" fill="#0b1526" stroke="#3f5078" stroke-width=".8"/><circle cx="8.6" cy="9" r="5.4" fill="#04101a" stroke="${c}" stroke-width=".8"/><path d="M8.6 9l3.4 -2.6" stroke="${SNOW}" stroke-width=".9" stroke-linecap="round"/><path d="M17.6 5h5M17.6 9h5M17.6 13h3" stroke="${c}" stroke-width="1.2" opacity=".8"/><rect x="3" y="17.6" width="20" height="3.4" fill="#fcee0a" opacity=".75"/><path d="M5 21l2.4 -3.4M10 21l2.4 -3.4M15 21l2.4 -3.4M20 21l2.4 -3.4" stroke="#0b1526" stroke-width="1.4"/><path d="M13 24V35" stroke="#3a4b70" stroke-width="2"/>`);
  s += sign(ctx, r, r.name, c, true, lod >= 1 ? [T.scene.cryoHours] : [], { maxSize: 13, avail: 150 }) + display(ctx, r, c, cryo) + vault(ctx, r, c, Math.max(0, cryo.length - PODS));
  const tk = P(x + w - 26, y + 30, 0);
  if (lod >= 1) s += halo([tk[0], tk[1] + 4], 34, 14, SNOW, 0.4);
  s += `<use href="#cryo-tank" x="${R(tk[0])}" y="${R(tk[1])}"/>` + deck(ctx, r, c, rows);
  const pod = (i) => {
    const o = cryo[i], a = P(x + 60 + (i % 7) * pitch, y + rows[i < 7 ? 1 : 0], 0);
    const put = (id, cls = "") => `<use href="#cryo-${id}"${cls} x="${R(a[0])}" y="${R(a[1])}"/>`;
    if (!o) return put("c0");
    person(ctx, o, a, 58, r.key, { w: 14 });
    mark(ctx, { kind: "chip", a: [a[0], a[1] + 9], text: `${clip(o.title, 20)} · ${agoShort(o.age)}`, color: c, prio: 0.5, size: 7.4, cls: "mo", ls: 0, fill: lit(c, 0.45), dy: 3, optional: true, room: r.key, tier: 2 });
    lights[hash(o.id) % 4].push(`M${R(a[0] - 6)} ${R(a[1] - 45.3)}h.1`);
    if (lod < 1) return put("c1");
    const L = lookOf(o.id);
    return put("u-" + L.style, ` class="${L.q}"`);
  };
  const fog = (u, v, rx, o) => halo(P(x + u, y + v, 0), rx, R(rx * 0.3), SNOW, o);
  for (let i = 7; i < PODS; i++) s += pod(i);
  if (lod >= 2) s += fog(110, 86, 60, 0.22) + fog(270, 92, 70, 0.2);
  for (let i = 0; i < 7; i++) s += pod(i);
  if (lod >= 1) s += bot(P(x + w - 24, y + d - 52, 0), c) + fog(70, d - 20, 56, 0.26) + fog(330, d - 22, 60, 0.26);
  if (lod >= 2) s += fog(200, d - 16, 70, 0.22);
  s += camera(x + 10, y + 10, WH - 6, c) + front(ctx, r, c, true);
  ctx.F.push(cameraFx(x + 10, y + 10, WH - 6));
  lights.forEach((l, p) => { if (l.length) ctx.F.push(blink(`<g fill="none" stroke-linecap="round"><path d="${l.join("")}" stroke="${c}" stroke-width="7" opacity=".32"/><path d="${l.join("")}" stroke="${SNOW}" stroke-width="2.3"/></g>`, { pattern: [1, 1, 1, 0.12], ticks: 3, phase: p })) });
  const puff = (dx, dy, k) => halo([tk[0] + dx, tk[1] - 70 - dy], 9 * k, 6 * k, "#ffffff", R(0.55 / k));
  ctx.F.push(frames([puff(2, 0, 1) + puff(6, 9, 1.4), puff(4, 4, 1.2) + puff(10, 15, 1.7)], { ticks: 3 }));
  target(ctx, r, r.name, c);
  ctx.S.push(s);
}
