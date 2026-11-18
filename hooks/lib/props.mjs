import { R, P, NEONS, hash, lit, drk, esc } from "./util.mjs";
import { block, quad, onY, onX, onFloor, halo, rad, fadeDown, glow, hair, wallY, text, blink, step, at } from "./kit.mjs";
import { T } from "./strings.mjs";

const rel = (u, v, z) => { const p = P(u, v, z); return `${R(p[0])} ${R(p[1])}` };
const SCREEN = { u: 6, v: 6, w: 30, h: 19, z: 40 };

function screen(bg, inner, edge) {
  return onY(SCREEN.u, SCREEN.v, SCREEN.z, `<rect x="-1.2" y="-1.2" width="${SCREEN.w + 2.4}" height="${SCREEN.h + 2.4}" rx="1.2" fill="#070910"/><rect width="${SCREEN.w}" height="${SCREEN.h}" rx=".6" fill="${bg}"/>${inner}<rect width="${SCREEN.w}" height="${SCREEN.h}" rx=".6" fill="none" stroke="${edge}" stroke-width=".7"/><rect width="${SCREEN.w}" height="5" fill="#fff" opacity=".05"/>`);
}
const bars = (rows, color) => rows.map(([x, w, o, c], i) => `<rect x="${x}" y="${4.4 + i * 2.8}" width="${w}" height="1.3" rx=".6" fill="${c ?? color}" opacity="${o}"/>`).join("");
const glyph = (ch, color, size = 15) => `<text x="${SCREEN.w / 2}" y="${SCREEN.h / 2 + size * 0.36}" text-anchor="middle" class="cx" font-size="${size}" fill="${color}">${ch}</text>`;

export function propDefs() {
  let dk = "";
  for (const [u, v] of [[2, 2], [38, 2], [2, 18], [38, 18]]) dk += block(u, v, 0, 2, 2, 15, "#2a3348");
  dk += block(0, 0, 15, 42, 22, 2.4, "#222a3e", { top: "#313b55", left: "#1b2234", right: "#151b2a" });
  dk += `<path d="M${rel(0, 22, 17.4)}L${rel(42, 22, 17.4)}" class="scc" stroke-width="1.1" opacity=".9"/><path d="M${rel(0, 22, 17.4)}L${rel(42, 22, 17.4)}" class="scc" stroke-width="3.4" opacity=".22"/>`;
  dk += block(19.6, 6.4, 17.4, 2.8, 2, 4.6, "#2a3348") + block(15, 5.4, 17.4, 12, 4, 0.8, "#2a3348");
  const work = screen("#04222c", `<rect width="${SCREEN.w}" height="2.4" fill="#0a3a48"/><circle cx="1.8" cy="1.2" r=".6" fill="#ff5a5a"/><circle cx="3.8" cy="1.2" r=".6" fill="#fcee0a"/><circle cx="5.8" cy="1.2" r=".6" fill="#39ff88"/>` + bars([[2, 13, 0.95, "#ffffff"], [4, 9, 0.8], [4, 17, 0.9, "#ff8a3d"], [2, 7, 0.8], [4, 12, 0.95, "#ffffff"]], "#7ff0ff"), "#22e4ff");
  const wait = (icon, c) => screen(drk(c, 0.82), `<rect width="${SCREEN.w}" height="${SCREEN.h}" fill="${c}" opacity=".12"/>` + glyph(icon, c), c);
  const idle = screen("#0c1426", bars([[3, 12, 0.5], [3, 17, 0.35], [3, 8, 0.3]], "#7f9bd0"), "#4a5f8a");
  const doze = screen("#090d18", `<path d="M17.5 5.4a4.6 4.6 0 1 0 3.4 7.8a5.4 5.4 0 0 1-3.4-7.8z" fill="#8fa3c7" opacity=".7"/><circle cx="9" cy="6" r=".5" fill="#8fa3c7"/><circle cx="23" cy="14" r=".5" fill="#8fa3c7"/>`, "#2a3a5a");
  const off = screen("#06080d", "", "#1a2233");
  const cafe = screen("#22070c", `<text x="${SCREEN.w / 2}" y="9.4" text-anchor="middle" class="jp" font-size="6.4" fill="#ff5a70">ラーメン</text><path d="M9 12h12q-1 4.6-6 5q-5-.4-6-5z" fill="none" stroke="#ff5a70" stroke-width=".9"/>`, "#ff3b5c");
  const lounge = screen("#150a26", `<text x="${SCREEN.w / 2}" y="13" text-anchor="middle" class="cx" font-size="7.4" letter-spacing=".6" fill="#d39bff">${esc(T.scene.partyScreen)}</text>`, "#c06bff");
  const kb = block(12, 12, 17.4, 17, 6, 0.8, "#3a4460", { top: "#4b5878" }) + block(32, 13, 17.4, 3, 4, 0.7, "#3a4460", { top: "#55627f" });
  const mugA = P(4.5, 9, 17.4);
  const mug = `<g transform="translate(${R(mugA[0])} ${R(mugA[1])})"><path d="M-2 0v-3.8h4v3.8q-2 1.1-4 0z" fill="#e4e8f0"/><ellipse cy="-3.8" rx="2" ry=".9" fill="#3a2418"/><path d="M2 -3q1.6 0 1.4 1.4q-.2 1-1.4 .7" stroke="#e4e8f0" stroke-width=".6" fill="none"/></g>`;
  const ch = block(4.6, 34.6, 0, 3.2, 3.2, 6.4, "#1b2030") + block(-1, 28, 6.4, 14, 13, 2.6, "#2c3449", { top: "#3b4663" }) + `<path d="M${rel(-1, 41, 9)}L${rel(13, 41, 9)}" class="scc" stroke-width=".7" opacity=".6"/>`;
  const cb = block(-1, 39, 9, 14, 2.4, 14, "#2c3449", { left: "#343e58", top: "#465272" }) + `<path d="M${rel(-1, 41.4, 23)}L${rel(13, 41.4, 23)}" class="scc" stroke-width=".9"/>`;

  const a = P(6, 6, 12);
  let leaves = "";
  [[-15, -10], [-10, -21], [-2, -26], [7, -23], [13, -12], [-5, -17], [5, -15]].forEach(([u, v], i) => { leaves += `<path d="M${R(a[0])} ${R(a[1])}Q${R(a[0] + u * 0.3)} ${R(a[1] + v * 0.7)} ${R(a[0] + u)} ${R(a[1] + v)}Q${R(a[0] + u * 0.7)} ${R(a[1] + v * 0.3)} ${R(a[0])} ${R(a[1])}Z" fill="${i % 2 ? "#12704a" : "#1c9a6a"}" stroke="#7dffc0" stroke-width=".5" stroke-opacity=".7"/>` });
  const plant = `<ellipse cx="${R(P(6, 6, 0)[0])}" cy="${R(P(6, 6, 0)[1] + 2)}" rx="13" ry="5" fill="#000" opacity=".35"/>` + block(0, 0, 0, 12, 12, 12, "#232a3c", { top: "#102418" }) + `<ellipse cx="${R(a[0])}" cy="${R(a[1] - 12)}" rx="20" ry="16" fill="${rad("#39ff88")}" opacity=".28"/>` + leaves;

  let dots = "";
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) dots += `<rect x="${2 + k * 4}" y="${4 + r * 6}" width="2.6" height="4.2" rx=".7" fill="${NEONS[(r * 4 + k) % NEONS.length]}" opacity=".9"/>`;
  const vend = block(0, 0, 0, 22, 16, 44, "#1a1730", { top: "#332c4e", left: "#221d3a", right: "#120f22" }) + wallY(2, 16, 8, 40, 18, "#0c1a2a") + onY(2, 16, 40, dots) + onY(2, 16, 40, `<rect width="18" height="32" fill="none" class="scc" stroke-width=".8"/>`) + wallY(4, 16, 2, 6, 14, "#05070c");

  const cam = `<path d="M0 0l-2 -6" stroke="#3a4256" stroke-width="1.4"/><rect x="-6" y="-3.6" width="10.4" height="5.6" rx="1.6" fill="#232a3c" stroke="#4a556f" stroke-width=".5"/><circle cx="3.2" cy="-.8" r="1.9" fill="#0a0c12" stroke="#6a7895" stroke-width=".5"/><circle cx="3.2" cy="-.8" r=".7" fill="#22e4ff" opacity=".8"/>`;

  const podTop = P(15, 13, 52), podBase = P(15, 13, 6), hgt = R(podBase[1] - podTop[1] - 12);
  const pod = `<ellipse cx="${R(P(15, 13, 0)[0])}" cy="${R(P(15, 13, 0)[1] + 3)}" rx="26" ry="10" fill="${rad("#7fd8ff")}" opacity=".5"/>` + block(0, 0, 0, 30, 26, 6, "#243047", { top: "#34425e" }) + `<path d="M${rel(0, 26, 3)}L${rel(30, 26, 3)}" stroke="#7fd8ff" stroke-width=".9"/><path d="M${rel(0, 26, 3)}L${rel(30, 26, 3)}" stroke="#7fd8ff" stroke-width="3" opacity=".25"/>`;
  const dome = `<path d="M-13 0V-${hgt}a13 12 0 0 1 26 0V0Q0 7-13 0Z" fill="url(#frost)" stroke="#9fe6ff" stroke-width=".8"/>`;
  const domeTop = `<path d="M-13 0V-${hgt}a13 12 0 0 1 26 0V0" fill="none" stroke="#ffffff" stroke-width=".6" opacity=".45"/><path d="M-9 -8v-30" stroke="#ffffff" stroke-width="2.4" opacity=".2" stroke-linecap="round"/><path d="M-5.4 -12v-12" stroke="#ffffff" stroke-width="1" opacity=".16" stroke-linecap="round"/>`;

  const sofa = block(0, 0, 0, 44, 16, 7, "#3a2a52", { top: "#4c3870" }) + block(0, 0, 7, 44, 5, 9, "#32244a", { top: "#463366" }) + block(0, 0, 7, 5, 16, 4, "#32244a", { top: "#463366" }) + block(39, 0, 7, 5, 16, 4, "#32244a", { top: "#463366" });
  const cooler = block(0, 0, 0, 9, 9, 16, "#dfe6f2", { top: "#f4f7fc", left: "#c9d2e2", right: "#aab4c8" }) + at(P(4.5, 4.5, 16), `<path d="M-3.6 0v-9a3.6 3.6 0 0 1 7.2 0v9z" fill="#5ec8ff" opacity=".55" stroke="#bfefff" stroke-width=".5"/><ellipse cy="-9" rx="3.6" ry="1.4" fill="#bfefff" opacity=".6"/>`);
  const bin = block(0, 0, 0, 6, 6, 8, "#1c2333", { top: "#0c0f17" });
  const lamp = `<path d="M0 0v-30" stroke="#3a4256" stroke-width="1.2"/><path d="M-5 -30h10l3 5h-16z" fill="#2c3449"/><ellipse cy="-25" rx="8" ry="2" class="cc" opacity=".9"/>`;

  return `<linearGradient id="frost" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cdf3ff" stop-opacity=".6"/><stop offset=".5" stop-color="#5fb8e0" stop-opacity=".2"/><stop offset="1" stop-color="#cdf3ff" stop-opacity=".5"/></linearGradient>`
    + `<g id="dk">${dk}</g><g id="s-work">${work}</g><g id="s-turn">${wait("✓", "#fcee0a")}</g><g id="s-perm">${wait("!", "#ff8a3d")}</g><g id="s-ask">${wait("?", "#22e4ff")}</g><g id="s-idle">${idle}</g><g id="s-doze">${doze}</g><g id="s-off">${off}</g><g id="s-cafe">${cafe}</g><g id="s-lounge">${lounge}</g><g id="kb">${kb}</g><g id="mug">${mug}</g><g id="ch">${ch}</g><g id="cb">${cb}</g>`
    + `<g id="plant">${plant}</g><g id="vend">${vend}</g><g id="cam">${cam}</g><g id="pod">${pod}</g><g id="dome">${dome}</g><g id="domet">${domeTop}</g><g id="sofa">${sofa}</g><g id="cooler">${cooler}</g><g id="bin">${bin}</g><g id="lamp">${lamp}</g>`;
}

export function use(id, p, style = "") {
  return `<use href="#${id}" x="${R(p[0])}" y="${R(p[1])}"${style ? ` style="${style}"` : ""}/>`;
}
export function cursorFx(dx, dy, color = "#ffffff") {
  return onY(dx + SCREEN.u, dy + SCREEN.v, SCREEN.z, blink(`<rect x="17.4" y="14.8" width="1.6" height="1.8" fill="${color}"/>`, { ticks: 2 }));
}
export function camera(x, y, z, color = "#ff2340") {
  const a = P(x, y, z);
  return quad([a, P(x + 70, y + 74, 0), P(x + 22, y + 112, 0)], fadeDown(color, 0.16, 0)) + use("cam", a);
}
export function cameraFx(x, y, z) {
  const a = P(x, y, z);
  return blink(`<circle cx="${R(a[0] - 3.4)}" cy="${R(a[1] - 1.6)}" r="1.1" fill="#ff2340"/><circle cx="${R(a[0] - 3.4)}" cy="${R(a[1] - 1.6)}" r="3" fill="#ff2340" opacity=".3"/>`, { ticks: 2, phase: hash(`cam${x}.${y}`) % 2 });
}
export function wallScreen(x, y, zTop, w, h, color, inner, o = {}) {
  const on = o.axis === "x" ? onX : onY;
  return on(x, y, zTop, `<rect x="-1.4" y="-1.4" width="${w + 2.8}" height="${h + 2.8}" fill="#05070c"/><rect width="${w}" height="${h}" fill="${o.bg ?? drk(color, 0.86)}"/>${inner}<rect width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width=".8" opacity=".9"/><rect width="${w}" height="${R(h * 0.3)}" fill="#fff" opacity=".04"/>`);
}
export { glow, hair, halo, lit, text, step };
