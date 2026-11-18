import { R, P, hash, lit, tw, esc } from "../util.mjs";
import { block, floor, wallY, wallX, onY, onX, onFloor, halo, rad, fadeDown, blend, glow, hair, text, frames, blink, stepMove } from "../kit.mjs";
import { standing, seatedBack } from "../chars.mjs";
import { use, camera, cameraFx } from "../props.mjs";
import { shell, front, target } from "./shell.mjs";
import { WH, WT, person, mark, obstacle } from "../ctx.mjs";
import { lookOf } from "../model.mjs";
import { T } from "../strings.mjs";

const AMB = "#ffb14a", LAN = "#ff5a3c", INK = "#1a1012";
const u = (id, p) => `<use href="#ramen-${id}" x="${R(p[0])}" y="${R(p[1])}"/>`;
const pt = (x, y, z) => { const p = P(x, y, z); return `${R(p[0])} ${R(p[1])}` };
const jp = (xy, str, size, col, full = true) => `<g class="jp" font-size="${size}" stroke="${col}" stroke-linejoin="round" fill="none"><text ${xy} stroke-width="${R(size * 0.42)}" opacity=".16">${str}</text>${full ? `<text ${xy} stroke-width="${R(size * 0.16)}" opacity=".45">${str}</text>` : ""}<text ${xy} stroke="none" fill="${lit(col, 0.72)}">${str}</text></g>`;
const body = (p, inner) => `<g transform="translate(${R(p[0])} ${R(p[1])}) scale(1.15)">${inner}</g>`;

export function defs() {
  const steam = (d) => `<path d="${d}" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".5"/>`;
  const stool = `<ellipse cy="1.5" rx="7.6" ry="3.2" fill="#000" opacity=".4"/><ellipse rx="4.6" ry="2" fill="#1b1f2c"/><rect x="-1.1" y="-9" width="2.2" height="9" fill="#444b63"/><ellipse cy="-3.6" rx="3.8" ry="1.6" fill="none" stroke="#7a86a3" stroke-width=".6"/><path d="M-6.4 -10.6v1.8a6.4 3.2 0 0 0 12.8 0v-1.8z" fill="#7d1628"/><ellipse cy="-10.6" rx="6.4" ry="3.2" fill="#ff3b5c"/><ellipse cx="-1.4" cy="-11.2" rx="3.4" ry="1.4" fill="#ff8a9c" opacity=".7"/>`;
  const bowl = `<ellipse cy="1.2" rx="5.2" ry="1.9" fill="#000" opacity=".35"/><path d="M-5.6 -3Q-5 1 -2 1.6H2Q5 1 5.6 -3Z" fill="#e9e2d4"/><path d="M-5.3 -1.5Q0 .8 5.3 -1.5" stroke="#d2283e" stroke-width=".9" fill="none"/><ellipse cy="-3" rx="5.6" ry="2.3" fill="#fbf7ee"/><ellipse cy="-2.9" rx="4.6" ry="1.75" fill="#d9892b"/><ellipse cx="-1.7" cy="-3.2" rx="1.5" ry=".8" fill="#fff5d8"/><circle cx="-1.7" cy="-3.2" r=".55" fill="#ffb21f"/><path d="M.8 -3.8h2.2v1.5h-2.2z" fill="#16331f"/><path d="M-.6 -2.1q1.5 .9 3 0" stroke="#f7df9a" stroke-width=".5" fill="none"/><path d="M1.8 -2.6L8.2 -6.8M2.8 -2.2L9.2 -6.2" stroke="#e7c796" stroke-width=".6"/>`;
  const lan = `<path d="M0 -10v-6" stroke="${INK}" stroke-width=".8"/><rect x="-3.2" y="-11.2" width="6.4" height="2.2" fill="${INK}"/><rect x="-3.2" y="8.8" width="6.4" height="2" fill="${INK}"/><ellipse rx="7" ry="9" fill="#ff4630"/><ellipse rx="4.6" ry="7.2" fill="#ff9a5c" opacity=".85"/><ellipse cx="-1" cy="-1" rx="2.3" ry="4.2" fill="#ffe0a8" opacity=".75"/><path d="M-6.5 -3.4Q0 -1.8 6.5 -3.4M-7 0Q0 1.7 7 0M-6.5 3.4Q0 5 6.5 3.4" stroke="#a81a14" stroke-width=".5" fill="none" opacity=".8"/><text y="2.8" text-anchor="middle" class="jp" font-size="7" fill="#5a0a0a" opacity=".85">麺</text>`;
  const btl = [[0, 9, "#39ff88"], [4.4, 7, AMB], [8.6, 10, "#7fd8ff"], [13, 6.4, "#ff6ad5"], [17.2, 8.6, "#fcee0a"]].map(([x, h, c]) => `<path d="M${x} 0v${R(2.6 - h)}l1 -1v-1.6h1.4v1.6l1 1v${R(h - 2.6)}z" fill="${c}" opacity=".82"/><rect x="${R(x + 0.5)}" y="${R(2.4 - h)}" width=".7" height="${R(h - 3.4)}" fill="#fff" opacity=".5"/>`).join("");
  const tbl = `<ellipse cy="2" rx="14" ry="5.6" fill="#000" opacity=".4"/><ellipse rx="6" ry="2.6" fill="#1b1f2c"/><rect x="-1.4" y="-23" width="2.8" height="23" fill="#444b63"/><path d="M-13 -24.6v1.9a13 6.4 0 0 0 26 0v-1.9z" fill="#4a2c18"/><ellipse cy="-24.6" rx="13" ry="6.4" fill="#9a6639" stroke="#ffcf8a" stroke-width=".7" stroke-opacity=".8"/><use href="#ramen-b" x="-4" y="-23.6"/><path d="M5.2 -26.4v-5l.7 -1.2v-2h1.2v2l.7 1.2v5z" fill="#5fe0a0" opacity=".9"/>`;
  const post = `<ellipse rx="3.2" ry="1.5" fill="#1b1f2c"/><rect x="-.8" y="-14" width="1.6" height="14" fill="#c9a24a"/><circle cy="-14.6" r="1.6" fill="#ffd98a"/>`;
  const pot = `<path d="M-6 -8v8a6 2.6 0 0 0 12 0v-8z" fill="#8a93a8"/><path d="M2.4 -8v10.4a6 2.6 0 0 0 3.6 -2.4v-8z" fill="#5d6679"/><ellipse cy="-8" rx="6" ry="2.6" fill="#c9d1e0"/><ellipse cy="-8" rx="4.9" ry="2" fill="#e09a3a"/><path d="M-6 -5.6h-1.8M6 -5.6h1.8" stroke="#5d6679" stroke-width="1.1"/>`;
  const cnd = `<path d="M-4 0v-2.6h4.4v2.6z" fill="#2a1a12"/><path d="M-3.4 -2.6v-2.2M-2.2 -2.6v-2.8M-1 -2.6v-2.2" stroke="#e7c796" stroke-width=".5"/><path d="M1.6 0v-3.4h.6v-1.1h1.2v1.1h.6v3.4z" fill="#3a1410"/><rect x="2.2" y="-4.9" width="1.2" height=".8" fill="#ff3b5c"/>`;
  return `<g id="ramen-s">${stool}</g><g id="ramen-b">${bowl}</g><g id="ramen-l">${lan}</g><g id="ramen-btl">${btl}</g><g id="ramen-tbl">${tbl}</g><g id="ramen-post">${post}</g><g id="ramen-pot">${pot}</g><g id="ramen-cnd">${cnd}</g>`
    + `<g id="ramen-st1">${steam("M-2 -6q-2.2-2.6 0-5.2t0-5.2M2.2 -7.4q2.2-2.6 0-5.2")}</g><g id="ramen-st2">${steam("M-2.4 -8.4q2.2-2.6 0-5.2t0-4.6M2 -6q-2.2-2.6 0-5.2t0-4.4")}</g>`;
}

function chef(p, lod) {
  const base = `<path d="M-7.6 -3Q-8.8 -13 -7 -23H7Q8.8 -13 7.6 -3Z" fill="#eef1f7"/>`, head = `<rect x="-7.2" y="-43" width="14.4" height="12" rx="3.8" fill="#e3e8f1"/>`, band = `<path d="M-7.4 -42.2h14.8v2.8h-14.8z${lod >= 1 ? "M7 -41.4l4.6 -2.6l-.4 2.8l3.2 1.4l-5.6 .8z" : ""}" fill="#ff3b5c"/>`, visor = `<rect x="-5.6" y="-38.4" width="11.2" height="4.4" rx="2.2" fill="#131722"/>`;
  if (lod < 1) return body(p, base + head + visor + band);
  return halo([p[0], p[1] - 34], 26, 24, AMB, 0.3) + body(p, `<g stroke="#05060b" stroke-width=".7">${base}${lod >= 2 ? `<path d="M-8 -26L-12.6 -18.4L-9.4 -12.4" stroke="#8f99ad" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-9.4" cy="-11.6" r="1.9" fill="#dfe4ee" stroke-width=".5"/>` : ""}<rect x="-8.8" y="-29.4" width="17.6" height="7.4" rx="3.4" fill="#99a3b8"/>${head}</g>`
    + (lod >= 2 ? `<path d="M1.4 -22.6H6.8Q8.4 -13 7.2 -3.4H2.4ZM2.6 -42.6h1a3.4 3.4 0 0 1 3.2 3.4v4.6a3.4 3.4 0 0 1-3.2 3.4h-1z" fill="#b3bccf"/><rect x="-3.6" y="-15.4" width="7.2" height="5.4" rx="1" fill="none" stroke="#98a2b8" stroke-width=".6"/><circle cy="-40.8" r="1.1" fill="#fff"/>` : "")
    + `<path d="M-7.6 -19.4H7.6" stroke="#ff3b5c" stroke-width="1.8"/>${visor}<path d="M-4 -35.6q1.4 -1.8 2.8 0M1.2 -35.6q1.4 -1.8 2.8 0" stroke="#ffc874" fill="none" stroke-linecap="round"/>${band}`);
}

function chefFx(p) {
  const arm = "M0 0L4.8 6.6L3.8 12.6";
  return body(p, `<g transform="translate(8 -26)"><g><path d="${arm}" stroke="#05060b" stroke-width="4.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${arm}" stroke="#8f99ad" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3.8" cy="13.2" r="1.9" fill="#dfe4ee"/><path d="M3.8 13.4l1.2 4" stroke="#c9a24a"/><path d="M1.4 17h7q-.4 4.6-3.5 4.6t-3.5-4.6z" fill="#3a4156" stroke="#c9d1e0" stroke-width=".5"/><path d="M2.6 18q1.2 1.4 2.4 0t2.4 0" stroke="#ffe08a" stroke-width=".8" fill="none"/>${stepMove(["0", "-40"], { type: "rotate", ticks: 2 })}</g></g>`);
}

function backWall(ctx, r, c, rich) {
  const { x, y, w } = r, lod = ctx.lod, wy = y + WT + 0.2, hrs = lod >= 1 ? T.scene.ramenHours : "";
  const pw = R(92 + Math.max(tw(r.name, 11, "cx", 1.4), tw(hrs, 5.4, "mo")));
  obstacle(ctx, [P(x + 16, wy, 54), P(x + 16 + pw, wy, 54), P(x + 16, wy, 26), P(x + 16 + pw, wy, 26)]);
  const name = text(84, hrs ? 12.4 : 17, r.name, { size: 11, ls: 1.4, fill: lit(c, 0.72) });
  if (lod < 1) return onY(x + 16, wy, 53, `<text x="5" y="19.6" class="jp" font-size="17" fill="${lit(c, 0.72)}">ラーメン</text>${name}`);
  let s = halo(P(x + 56, wy, 40), 62, 30, c, 0.5) + onY(x + 16, wy, 53, `<rect width="${pw}" height="26" rx="2" fill="#12060a" opacity=".92"/>${jp('x="5" y="19.6"', "ラーメン", 17, c, lod >= 2)}${name}<text x="84" y="20.8" class="mo" font-size="5.4" fill="#ffc9d2">${esc(hrs)}</text>`);
  let ux = 16 + pw + 10;
  const end = w - 48;
  if (rich) {
    let plaques = "", ticks = "";
    for (let i = 0; i < 5; i++) { plaques += `M${i * 10} 2h8.4v19h-8.4z`; ticks += `M${i * 10 + 2} 14h4.4M${i * 10 + 2} 17h${3 + (i % 2) * 0.8}` }
    s += onY(x + ux, wy, 51, `<rect x="-2" width="52.4" height="2.2" fill="#3a2114"/><path d="${plaques}" fill="#ecdcb8"/><text class="jp" font-size="6.4" fill="#8a1424" x="1 11 21 31 41" y="10">麺飯酒餃丼</text><path d="${ticks}" stroke="#3a2114" stroke-width=".9" opacity=".7"/>`);
    ux += 60;
  }
  const n = rich ? Math.max(0, Math.min(lod >= 2 ? 4 : 3, Math.floor((end - ux) / 23))) : 0;
  if (n) {
    const bw = n * 23 + 1;
    let b = `<path d="M-2 0h${bw}v1.6h-${bw}z${lod >= 2 ? `M-2 13h${bw}v1.6h-${bw}z` : ""}" fill="#6e4426"/>`;
    for (let i = 0; i < n; i++) b += `<use href="#ramen-btl" x="${i * 23}"/>` + (lod >= 2 ? `<use href="#ramen-btl" x="${i * 23 + 1}" y="13"/>` : "");
    s += onY(x + ux, wy, lod >= 2 ? 41 : 36, b);
    ux += bw + 9;
  }
  if (lod < 2) return s;
  if (end - ux >= 40) {
    s += onY(x + ux, wy, 50, `<rect width="34" height="26" rx="2" fill="#140c04" opacity=".9"/>${jp('x="4" y="19"', "生", 15, AMB, false)}<path d="M21 8h7v12h-7zM28 11h3v6h-3" fill="none" stroke="${AMB}" stroke-width="1.2" stroke-linejoin="round"/><path d="M21.6 8.4h5.8" stroke="#fff" stroke-width="1.6" opacity=".85"/>`);
    ux += 44;
  }
  if (end - ux >= 52) {
    let ban = "";
    ["餃子", "焼飯", "唐揚"].forEach((t, i) => { ban += `<rect x="${i * 17}" width="13" height="27" fill="${["#d92c48", "#1f3a6e", "#e9dcc0"][i]}"/><text class="jp" font-size="8.4" fill="${i === 2 ? "#8a1424" : "#fff0e0"}" x="${i * 17 + 2.3}" y="11 21">${t}</text>` });
    s += onY(x + ux, wy, 50, `<rect x="-2" y="-1.4" width="51" height="1.6" fill="${INK}"/>${ban}`);
  }
  return s;
}

function leftWall(ctx, r, rich) {
  const { x, y, d } = r, lod = ctx.lod, wx = x + WT + 0.2;
  let cloth = "";
  for (let i = 0; i < 4; i++) cloth += `M${i * 9} 2.6h8.4v${i % 2 ? 15 : 16.4}h-8.4z`;
  let s = onX(wx, y + d - 42, 46, `<rect width="36" height="46" fill="${blend("#070a14", "#1c3f7a")}" stroke="#5a3620" stroke-width="2.4"/><path d="${cloth}" fill="#d92c48"/>${!rich ? "" : lod < 2 ? `<text class="jp" font-size="6.6" fill="#fff0e0" x=".9 9.9 18.9 27.9" y="13">ラーメン</text>` : `<path d="M0 2.6h35.4v2.4h-35.4z" fill="#8a1424"/><rect x="-3" y="1" width="42" height="1.6" fill="${INK}"/><text class="jp" font-size="6.6" fill="#fff0e0" x=".9 9.9 18.9 27.9" y="13">ラーメン</text>`}`);
  if (lod < 2) return s;
  s += onX(wx, y + 124, 51, `<rect width="14" height="37" rx="1.6" fill="#140c04" opacity=".92"/>${jp('x="2" y="11.4 22.4 33.4"', "営業中", 10, AMB)}`);
  return s + onX(wx, y + 58, 49, `<rect width="24" height="30" fill="#efe1c0" stroke="#3a2114" stroke-width="1.2"/><circle cx="15" cy="11" r="6" fill="#e0344a"/><path d="M1 24q4 -8 8 -2t7 -3t7 1v9h-22z" fill="#274b8a"/><path d="M1 24q4 -8 8 -2t7 -3t7 1" stroke="#fff" stroke-width=".8" fill="none"/>`);
}

export function ramenRoom(ctx, r) {
  const c = r.neon, lod = ctx.lod, { x, y, w, d } = r;
  const cafe = ctx.model.sessions.filter((s) => s.state === "cafe");
  const seats = r.seats ?? 6, seated = Math.min(cafe.length, seats, lod >= 1 ? seats : 6), rich = lod >= 2 || (lod === 1 && seats <= 6);
  const cw = seats * 48 + 4, bx = x + 22, by = y + 61, ly = by + 20.6, sy = y + 98, lz = 59;
  const lans = [];
  for (let lx = 73; lx < cw; lx += 96) lans.push(P(x + lx, ly, lz));
  const cx = x + 82.4 + 96 * Math.round((lans.length - 1) / 2), cy = y + 43, cp = P(cx, cy, 0);
  const F = { a: ["", ""], b: ["", ""], c: ["", ""] };
  const steam = (g, p) => { F[g][0] += u("st1", p); F[g][1] += u("st2", p) };

  let s = shell(ctx, r, c, true, { floor: "#2b1b1b", plainFloor: true, noWindows: true, noReflect: true, pool: 0.5 });
  if (lod >= 1) {
    let planks = "";
    for (let v = 96; v < d - 4; v += Math.max(lod >= 2 ? 13 : 26, (d - 100) / 11)) planks += `M${pt(x + WT, y + v, 0)}L${pt(x + w, y + v, 0)}`;
    s += onY(x + WT, y + WT, WH, `<rect width="${w - WT}" height="${WH}" fill="${fadeDown("#ff7a3c", 0.02, 0.24)}"/>`) + (rich ? onX(x + WT, y + d, WH, `<rect width="${d - WT}" height="${WH}" fill="${fadeDown("#ff7a3c", 0, 0.2)}"/>`) : "") + (lod >= 2 ? floor(x + WT, y + WT, 0.1, w - WT, 55, "#17131a", 'opacity=".8"') : "") + `<path d="${planks}" stroke="#1c1012" stroke-width=".7" fill="none" opacity=".7"/>`;
  }
  s += onFloor(bx - 10, by + 18, 0.2, `<rect width="${cw + 20}" height="84" fill="${fadeDown(AMB, 0.46, 0)}"/>`);
  s += backWall(ctx, r, c, rich) + (lod >= 1 ? leftWall(ctx, r, rich) : "");

  if (lod >= 1) {
    const p = P(x + 34, y + 15, 20);
    s += block(x + 12, y + WT + 1.5, 0, w - 64, 13.5, 20, "#2c303e", { top: "#454b60", left: "#343949", right: "#1c1e28" }) + use("vend", P(x + w - 38, y + 9, 0), "--c:#b26bff") + u("pot", p);
    steam("c", [p[0], p[1] - 5]);
    if (lod >= 2) s += u("pot", P(x + 50, y + 15, 20)) + u("b", P(cx - 60, y + 15, 20)) + u("b", P(cx - 48, y + 14, 20));
  }
  s += chef(cp, lod);
  if (lod >= 2) { const q = P(cx + 15, cy + 2, 9); s += block(cx + 10, cy - 3, 0, 10, 10, 9, "#30343f") + u("pot", q); steam("c", [q[0], q[1] - 5]) }

  s += wallY(bx, by + 18, 0, 22, cw, blend("#a86a38", "#40251a")) + (lod >= 1 ? wallX(bx + cw, by + 2, 0, 22, 16, "#24130e") : "");
  s += lod >= 1 ? block(bx - 2, by, 22, cw + 4, 20, 2.6, "#8a5a34", { top: "#a56d3e", left: "#6e4426", right: "#4a2c18", edge: "#ffd9a0", edgeO: 0.9 }) : floor(bx - 2, by, 24.6, cw + 4, 20, "#a56d3e") + hair(P(bx - 2, by + 20, 24), P(bx + cw + 2, by + 20, 24), "#ffd9a0", 1.6);
  if (lod >= 2) s += glow(P(bx, by + 18.4, 20.6), P(bx + cw, by + 18.4, 20.6), AMB, 1.2) + hair(P(bx + 2, by + 22, 5), P(bx + cw - 2, by + 22, 5), "#c9a24a", 0.9, 0.7);

  for (let i = 0; i < seats && lod >= 1; i++) {
    const sx = x + 44 + i * 48;
    if (i < seated) { const p = P(sx, by + 10, 24.6); s += u("b", p); steam(i % 2 ? "b" : "a", [p[0], p[1] - 1]) }
    if (lod >= 2 && i % 2 === 0 && i < seats - 1) s += u("cnd", P(sx + 22, by + 5, 24.6));
  }

  const mid = P(bx + cw / 2, ly, lz - 4), top = lz + 16;
  if (lod >= 1) s += `<path d="M${pt(bx + 10, ly, 24.6)}L${pt(bx + 10, ly, top)}L${pt(bx + cw - 6, ly, top)}L${pt(bx + cw - 6, ly, 24.6)}" stroke="#4a2c18" stroke-width="2" stroke-linejoin="round" fill="none"/>`;
  s += halo(mid, R(cw / 2 + 30), 30, LAN, 0.6, `transform="rotate(30 ${R(mid[0])} ${R(mid[1])})"`);
  let glowFx = "";
  for (const p of lans) {
    s += (lod >= 2 ? halo(p, 21, 21, LAN, 0.75) : "") + u("l", p);
    glowFx += `<circle cx="${R(p[0])}" cy="${R(p[1])}" r="16" fill="${rad("#ffd27a")}"/>`;
  }

  const items = [];
  for (let i = 0; i < seats; i++) {
    const sx = x + 44 + i * 48, o = i < seated ? cafe[i] : null;
    items.push({ k: sx + sy, f: () => {
      const g = lod >= 1 ? u("s", P(sx, sy, 0)) : "";
      if (!o) return g;
      const a = P(sx, sy, 10.6), k = hash(o.id) % 3;
      mark(ctx, { kind: "tag", a: P(sx, sy, 0), s: o, state: "cafe", room: r.key, tier: 2, mini: true, dy: 8 });
      person(ctx, o, a, 34, r.key);
      return g + seatedBack(a, lookOf(o.id), { typing: k === 0, lean: k === 1 });
    } });
  }
  if (lod < 1) {
    let seat = "";
    for (let i = 0; i < seats; i++) seat += `M${pt(x + 40 + i * 48, sy, 10)}h7`;
    s += `<path d="${seat}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
  }
  const fz = d - 112, qy = y + d - 34;
  if (lod >= 1) {
    const tables = [[w - 58, 112 + fz * 0.42], [w * 0.56, d - 36]];
    if (lod >= 2 && w > 440) tables.push([w - 152, d - 46]);
    if (lod >= 2 && fz > 150 && seats < 9) tables.push([w * 0.4, 112 + fz * 0.36], [w * 0.74, 112 + fz * 0.58]);
    for (const [tx, ty] of tables) items.push({ k: x + tx + y + ty, f: () => { const p = P(x + tx, y + ty, 0); return (lod >= 2 ? halo(p, 28, 12, AMB, 0.45) : "") + u("tbl", p) } });
  }
  if (rich) s += onFloor(x + 22, qy - 12, 0.2, `<rect width="104" height="24" fill="${AMB}" fill-opacity=".07" stroke="${AMB}" stroke-width=".8" stroke-dasharray="5 4" stroke-opacity=".5"/><path d="M84 6l6 6l-6 6M92 6l6 6l-6 6" stroke="${AMB}" stroke-width="1.6" fill="none" opacity=".55"/>`);
  (lod >= 2 ? cafe.slice(seated, seated + 3) : []).forEach((o, k) => {
    const qx = x + 96 - k * 24;
    items.push({ k: qx + qy, f: () => {
      const a = P(qx, qy, 0);
      mark(ctx, { kind: "tag", a, s: o, state: "cafe", room: r.key, tier: 2, mini: true });
      person(ctx, o, a, 42, r.key, { w: 11 });
      return standing(a, lookOf(o.id), { pose: k % 2 ? "sass" : "idle" });
    } });
  });
  items.sort((a, b) => a.k - b.k).forEach((it) => { s += it.f() });
  if (rich) {
    const a = P(x + 24, qy + 14, 14), b = P(x + 126, qy + 14, 14);
    s += u("post", P(x + 24, qy + 14, 0)) + u("post", P(x + 126, qy + 14, 0)) + `<path d="M${R(a[0])} ${R(a[1])}Q${R((a[0] + b[0]) / 2)} ${R((a[1] + b[1]) / 2 + 7)} ${R(b[0])} ${R(b[1])}" stroke="#d92c48" stroke-width="1.5" fill="none"/>`;
  }
  if (lod >= 1) { s += camera(x + 10, y + 10, WH - 6); ctx.F.push(cameraFx(x + 10, y + 10, WH - 6)) }
  ctx.S.push(s + front(ctx, r, c, true));

  ctx.F.push(lod >= 1 ? chefFx(cp) : "", blink(glowFx, { pattern: [0.2, 0.55], ticks: 3 }));
  if (F.a[0]) ctx.F.push(frames(F.a, { ticks: 2 }));
  if (F.b[0]) ctx.F.push(frames(F.b, { ticks: 2, phase: 1 }));
  if (F.c[0]) ctx.F.push(frames(F.c, { ticks: 3, phase: 1 }));
  if (lod >= 2) ctx.F.push(onY(x + 16, y + WT + 0.2, 53, blink(`<rect width="80" height="25" rx="2" fill="#12060a"/>`, { pattern: [0, 0, 0, 0, 0, 0, 0.6, 0, 0.45, 0, 0, 0], ticks: 1 })));

  if (cafe.length > seated) mark(ctx, { kind: "chip", a: P(x + 74, y + d - 12, 0), text: T.scene.moreInLine(cafe.length - seated), color: c, prio: 5, size: 7, room: r.key, tier: 1 });
  target(ctx, r, r.name, c);
}
