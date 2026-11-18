import { R, P, hash, lit, drk, clip, esc, NEONS } from "./util.mjs";
import { block, quad, floor, onX, onY, onFloor, glow, glows, halo, rad, core, fadeDown, blend, neonText, text, blink, frames, step, at } from "./kit.mjs";
import { use } from "./props.mjs";
import { bot } from "./chars.mjs";
import { WH } from "./ctx.mjs";
import { T } from "./strings.mjs";

export function themeFor(hour) {
  if (hour >= 21 || hour < 6) return { name: "night", sky: ["#04030b", "#150a2c", "#3a0f3e"], haze: "#5a1a6a", orb: "#ff5ad0", orbGlow: "#ff2bd6", rain: true, win: 1, bld: ["#0a0918", "#0d0b20", "#120f2a"], stars: true };
  if (hour < 8) return { name: "dawn", sky: ["#0e0b26", "#4a1d4e", "#d2607a"], haze: "#ff8a6a", orb: "#ffd0a0", orbGlow: "#ff8a5a", rain: false, win: 0.7, bld: ["#120f24", "#19132e", "#221938"], stars: false };
  if (hour < 19) return { name: "day", sky: ["#182036", "#36405e", "#8a7a8c"], haze: "#b0a0b8", orb: "#fff4d8", orbGlow: "#ffe0b0", rain: false, win: 0.4, bld: ["#161b2c", "#1c2236", "#242c42"], stars: false };
  return { name: "dusk", sky: ["#0c0820", "#3e1548", "#c5485c"], haze: "#ff6a6a", orb: "#ffb060", orbGlow: "#ff5a3a", rain: false, win: 0.85, bld: ["#100c20", "#17112c", "#1e1634"], stars: false };
}

export function skyDefs(th) {
  return `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.sky[0]}"/><stop offset=".55" stop-color="${th.sky[1]}"/><stop offset="1" stop-color="${th.sky[2]}"/></linearGradient>`;
}

export function backdrop(vb, th, lod) {
  const [x0, y0, w, h] = vb;
  let s = `<rect x="${R(x0)}" y="${R(y0)}" width="${R(w)}" height="${R(h)}" fill="url(#sky)"/>`;
  if (th.stars && lod >= 1) {
    let d = "";
    for (let i = 0; i < 70; i++) d += `M${R(x0 + (hash("sx" + i) % 1000) / 1000 * w)} ${R(y0 + (hash("sy" + i) % 1000) / 1000 * h * 0.34)}h${0.8 + (i % 3) * 0.5}`;
    s += `<path d="${d}" stroke="#cfe0ff" stroke-width="1.2" opacity=".5" stroke-linecap="round"/>`;
  }
  const ox = x0 + w * 0.7, oy = y0 + h * 0.2, or = Math.min(w, h) * 0.12;
  s += halo([ox, oy], or * 3.2, or * 3.2, th.orbGlow, 0.5) + `<circle cx="${R(ox)}" cy="${R(oy)}" r="${R(or)}" fill="${blend(lit(th.orb, 0.25), th.orbGlow)}" opacity=".92"/>`;
  for (let i = 0; i < 5; i++) s += `<rect x="${R(ox - or)}" y="${R(oy + or * (0.18 + i * 0.17))}" width="${R(or * 2)}" height="${R(or * (0.03 + i * 0.018))}" fill="${th.sky[1]}"/>`;
  for (let L = lod >= 1 ? 0 : 1; L < 3; L++) {
    const baseY = y0 + h * (0.4 + L * 0.115);
    let x = x0 - 20, towers = "", lights = "", tops = "";
    const ads = [];
    while (x < x0 + w) {
      const bw = 34 + (hash("bw" + L + Math.round(x)) % 74), bh = 110 + (hash("bh" + L + Math.round(x)) % (270 - L * 50)), y = baseY - bh;
      towers += `M${R(x)} ${R(y0 + h)}V${R(y)}h${bw}V${R(y0 + h)}z`;
      if (hash("an" + L + Math.round(x)) % 4 === 0) tops += `M${R(x + bw / 2)} ${R(y)}v-${18 + (hash("ah" + Math.round(x)) % 26)}`;
      if (L > 0 && lod >= 1) {
        const rows = Math.min(9, Math.floor(bh / 16));
        for (let k = 0; k < rows; k++) if (hash("wr" + L + Math.round(x) + k) % 3) lights += `M${R(x + 4)} ${R(y + 9 + k * 14)}h${bw - 8}`;
      }
      if (hash("ad" + L + Math.round(x)) % 5 === 0 && lod >= 1) {
        const c = NEONS[hash("ac" + Math.round(x)) % NEONS.length], ah = 18 + (hash("as" + Math.round(x)) % 26);
        ads.push({ x: x + 6, y: y + 20, w: bw - 12, h: ah, c });
      }
      x += bw + 6 + (hash("bg" + L + Math.round(x)) % 30);
    }
    s += `<path d="${towers}" fill="${th.bld[L]}"/>`;
    if (tops) s += `<path d="${tops}" stroke="${th.bld[L]}" stroke-width="2"/>`;
    if (lights) s += `<path d="${lights}" stroke="${L === 1 ? "#ffcf7a" : "#7fd8ff"}" stroke-width="2.2" stroke-dasharray="3 5" opacity="${R((0.16 + L * 0.1) * th.win)}"/>`;
    for (const a of ads) s += `<rect x="${R(a.x - 8)}" y="${R(a.y - 8)}" width="${R(a.w + 16)}" height="${a.h + 16}" fill="${rad(a.c)}" opacity="${R(0.3 + L * 0.12)}"/><rect x="${R(a.x)}" y="${R(a.y)}" width="${R(a.w)}" height="${a.h}" fill="${a.c}" opacity="${R(0.28 + L * 0.16)}"/>`;
    s += `<rect x="${R(x0)}" y="${R(baseY - 60)}" width="${R(w)}" height="150" fill="${fadeDown(th.haze, 0, 0.22)}"/>`;
  }
  return s;
}

function car(x, y, sc, dir, col) {
  return `<g transform="translate(${x} ${y}) scale(${dir * sc} ${sc})"><rect x="-90" y="0" width="76" height="2" fill="url(#lh-${col.slice(1)}-0-70)"/><path d="M-14 1q1-5 9-6.4h9q7 1 10 6.4q-14 3-28 0z" fill="#1c2030"/><path d="M-3 -4.6h8q4 .6 6 3.4h-15z" fill="${col}" opacity=".6"/><rect x="-13" y="1" width="27" height="2" rx="1" fill="#0d0f18"/><circle cx="13.4" cy="1.4" r="4" fill="${core("#ffffff")}"/><circle cx="-13.4" cy="1.6" r="3" fill="${core("#ff2340")}"/></g>`;
}
function drone(x, y, beamTo) {
  const beam = beamTo ? quad([[x - 2, y + 3], [x + 2, y + 3], [beamTo[0] + 24, beamTo[1]], [beamTo[0] - 24, beamTo[1]]], fadeDown("#e8f6ff", 0.3, 0)) : "";
  return `${beam}<g transform="translate(${R(x)} ${R(y)})"><path d="M-10 -1L10 -1" stroke="#3a4256" stroke-width="1.6"/><ellipse cx="-10" cy="-2.4" rx="5.4" ry="1.3" fill="#9fb4d6" opacity=".3"/><ellipse cx="10" cy="-2.4" rx="5.4" ry="1.3" fill="#9fb4d6" opacity=".3"/><path d="M-4 -2h8l2 4h-12z" fill="#262d40"/><circle cx="10" cy="-.6" r="1" fill="#39ff88"/><circle cy="2.8" r="3" fill="${core("#e8f6ff")}"/></g>`;
}

export function skyExtras(vb, th, lod, model) {
  const [x0, y0, w] = vb, x1 = x0 + w;
  let s = "", f = "";
  if (lod >= 1) {
    const ax = x1 - 330, ay = y0 + 60;
    s += `<g transform="translate(${R(ax)} ${R(ay)})"><rect x="-14" y="-14" width="264" height="132" fill="${rad("#22e4ff")}" opacity=".25"/><rect width="236" height="104" fill="#031a22" opacity=".8"/><rect width="236" height="104" fill="none" stroke="#22e4ff" stroke-width="1.2" opacity=".8"/>${neonText(14, 44, "ネオ麺", "#22e4ff", { size: 30, cls: "jp", ls: 0 })}<text x="14" y="66" class="cx" font-size="15" letter-spacing="3" fill="#bdf8ff">NEURO//RAMEN</text><text x="14" y="82" class="mo" font-size="7.5" fill="#7ff0ff" opacity=".85">${esc(T.scene.ad)}</text><g transform="translate(190 52)" stroke="#7ff0ff" fill="none" stroke-width="1.8"><path d="M-26 0h52q-4 22-26 24q-22-2-26-24z"/><path d="M-14 -4q-4-10 0-18M0 -4q-4-10 0-18M14 -4q-4-10 0-18" stroke-width="1.1"/><path d="M10 -2L34 -30M14 -1L38 -27"/></g></g>`;
    f += blink(`<rect x="${R(ax)}" y="${R(ay)}" width="236" height="104" fill="#04030b"/>`, { pattern: [0, 0, 0, 0, 0, 0, 0.55, 0, 0.3, 0, 0, 0], ticks: 1 });
    const kx = x0 + 140, ky = y0 + 150;
    s += `<g transform="translate(${R(kx)} ${R(ky)})" opacity=".85"><ellipse cx="60" cy="0" rx="90" ry="40" fill="${rad("#ff6a3d")}" opacity=".35"/><path d="M0 0C24 -18 70 -20 104 -2C72 16 26 16 0 0Z" fill="#ff6a3d" opacity=".4" stroke="#ffb08a"/><path d="M104 -2L132 -20L124 -2L134 16Z" fill="#ff6a3d" opacity=".35" stroke="#ffb08a"/><path d="M40 -12q10-14 26-12M44 10q8 12 20 12" stroke="#ffb08a" fill="none"/><circle cx="16" cy="-3" r="2" fill="#ffffff"/><path d="M30 -8q8 6 0 14M50 -12q8 8 0 22M70 -10q8 8 0 18" stroke="#ffffff" fill="none" stroke-width=".7" opacity=".5"/></g><text x="${R(kx + 40)}" y="${R(ky + 78)}" class="cx" font-size="9" letter-spacing="4" fill="#ffb08a" opacity=".75">KOI·NET 鯉</text>`;
    [[x0 + 380, y0 + 74, 1.5, 1, "#22e4ff"], [x0 + 620, y0 + 140, 1.1, -1, "#ff2bd6"], [x1 - 560, y0 + 40, 1.6, -1, "#fcee0a"], [x1 - 120, y0 + 290, 1.3, 1, "#39ff88"], [x0 + 100, y0 + 330, 1, 1, "#ff8a00"]].forEach(([x, y, sc, dir, col]) => { s += car(R(x), R(y), sc, dir, col) });
  }
  return { s, f };
}

export function slab(model, L, th, lod) {
  const W = L.width, D = L.depth;
  const X0 = -20, X1 = W + 20, Y0 = -20, Y1 = D + 20;
  let s = quad([P(X0, Y1, -24), P(X1, Y1, -24), P(X1, Y1, -900), P(X0, Y1, -900)], blend("#141a2c", "#070910")) + quad([P(X1, Y0, -24), P(X1, Y1, -24), P(X1, Y1, -900), P(X1, Y0, -900)], blend("#0d1220", "#05060c"));
  if (lod >= 1) {
    let ya = "", xa = "";
    for (let i = 0; i < 26; i++) {
      const z = -52 - i * 32;
      ya += `M${R(P(X0 + 8, Y1, z)[0])} ${R(P(X0 + 8, Y1, z)[1])}L${R(P(X1 - 8, Y1, z)[0])} ${R(P(X1 - 8, Y1, z)[1])}`;
      xa += `M${R(P(X1, Y0 + 8, z)[0])} ${R(P(X1, Y0 + 8, z)[1])}L${R(P(X1, Y1 - 8, z)[0])} ${R(P(X1, Y1 - 8, z)[1])}`;
    }
    s += `<path d="${ya}" stroke="#ffcf7a" stroke-width="7" stroke-dasharray="9 17" opacity="${R(0.2 * th.win)}"/><path d="${ya}" stroke="#ff6ad5" stroke-width="7" stroke-dasharray="9 121" stroke-dashoffset="40" opacity="${R(0.3 * th.win)}"/>`;
    s += `<path d="${xa}" stroke="#7fd8ff" stroke-width="7" stroke-dasharray="9 17" opacity="${R(0.14 * th.win)}"/><path d="${xa}" stroke="#ffcf7a" stroke-width="7" stroke-dasharray="9 95" stroke-dashoffset="20" opacity="${R(0.22 * th.win)}"/>`;
  }
  s += glow(P(X0, Y1, -24), P(X1, Y1, -24), "#ff2bd6", 1.6) + glow(P(X1, Y0, -24), P(X1, Y1, -24), "#22e4ff", 1.6);
  s += glows([0, 1, 2, 3].map((i) => [P(X0, Y1, -150 - i * 160), P(X1, Y1, -150 - i * 160)]), "#ff2bd6", 0.8, 0.7);
  s += glows([0, 1, 2, 3].map((i) => [P(X1, Y0, -150 - i * 160), P(X1, Y1, -150 - i * 160)]), "#22e4ff", 0.8, 0.5);
  s += block(X0, Y0, -24, X1 - X0, Y1 - Y0, 24, "#161b2a", { top: "#0c0f18", left: "#1b2236", right: "#101421" });
  const vs = P(X0 + 120, Y1, -60);
  s += `<g transform="translate(${R(vs[0])} ${R(vs[1])})"><rect x="-30" y="-12" width="60" height="184" fill="${rad("#ff2bd6")}" opacity=".3"/><rect x="-16" y="0" width="32" height="160" fill="#0a0410" stroke="#ff2bd6" stroke-width="1.4"/><text x="0" y="30" text-anchor="middle" class="jp" font-size="20" fill="#ffa0f4" writing-mode="tb">クロード</text></g>`;
  s += onX(X1, Math.min(Y1 - 20, 420), -50, `<rect x="-8" y="-8" width="166" height="82" fill="${rad("#22e4ff")}" opacity=".22"/><rect width="150" height="66" fill="#04121a" opacity=".9"/><rect width="150" height="66" fill="none" stroke="#22e4ff" stroke-width=".9" opacity=".7"/><text x="10" y="24" class="cx" font-size="17" letter-spacing="2" fill="#7ff0ff">PLANTA 77</text><text x="10" y="40" class="mo" font-size="7.4" fill="#7fd8ff">${esc(T.scene.building(model.total - model.archived, model.projects.length))}</text><text x="10" y="54" class="mo" font-size="7.4" fill="#7fd8ff">${esc(T.scene.openMrs(model.mrs?.open ?? "?"))}</text>`);
  for (const cor of L.corridors) {
    s += floor(X0, cor.y, 0.05, X1 - X0, cor.d, "#10141f");
    const a = P(0, cor.y + cor.d / 2, 0.2), b = P(W, cor.y + cor.d / 2, 0.2), col = cor === L.corridors[0] ? "#22e4ff" : "#ff2bd6";
    s += `<path d="M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}" stroke="${col}" stroke-width="5" stroke-dasharray="22 30" opacity=".12"/><path d="M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}" stroke="${col}" stroke-width="1.6" stroke-dasharray="22 30" opacity=".85"/>`;
  }
  return s;
}

export function corridorProps(L, ri, lod) {
  const cor = L.corridors[ri];
  if (!cor) return { s: "", f: "" };
  const W = L.width;
  let s = "", f = "";
  if (lod >= 1) {
    const vx = Math.min(W - 60, 300);
    s += use("vend", P(vx, cor.y + 4, 0), "--c:#22e4ff") + use("vend", P(vx + 26, cor.y + 4, 0), "--c:#ff2bd6");
    if (ri === 0) s += bot(P(Math.min(W - 80, 470), cor.y + 22, 0), "#39ff88");
  }
  const next = L.rows[ri + 1]?.[0];
  if (next) {
    const nm = next.kind === "project" ? next.project.name : next.name, col = next.kind === "project" ? next.project.neon : next.neon;
    s += onFloor(Math.max(20, next.x + 40), cor.y + 12, 0.3, text(0, 0, `${clip(nm, 18)} ▸`, { size: 11, ls: 3, fill: col, o: 0.6 }));
  }
  return { s, f };
}

export function rainFx(vb) {
  const [x0, y0, w, h] = vb;
  const set = (seed) => {
    let d = "";
    for (let i = 0; i < 90; i++) { const x = x0 + (hash(seed + "x" + i) % 1000) / 1000 * w, y = y0 + (hash(seed + "y" + i) % 1000) / 1000 * h, l = 12 + (i % 14); d += `M${R(x)} ${R(y)}l-3.4 ${l}` }
    return `<path d="${d}" stroke="#a8dcff" stroke-width=".8" opacity=".3" stroke-linecap="round"/>`;
  };
  return frames([set("a"), set("b"), set("c")], { ticks: 1 });
}

export function drones(L) {
  const W = L.width, D = L.depth;
  const a = P(W * 0.36, 0, WH), b = P(0, D * 0.4, WH), c = P(W, D * 0.3, WH);
  const list = [[a[0] + 20, a[1] - 70, P(W * 0.36, 60, 0)], [b[0] - 30, b[1] - 60, null], [c[0] + 40, c[1] - 50, P(W - 60, D * 0.3, 0)]];
  let s = "", f = "";
  list.forEach(([x, y, to], i) => { s += drone(x, y, to); f += blink(`<circle cx="${R(x - 10)}" cy="${R(y - 0.6)}" r="1.2" fill="#ff2340"/><circle cx="${R(x - 10)}" cy="${R(y - 0.6)}" r="3.4" fill="#ff2340" opacity=".3"/>`, { ticks: 2, phase: i }) });
  return { s, f };
}
export { step, at, onY };
