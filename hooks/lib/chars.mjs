import { R, SKINS, NEONS, JACKETS } from "./util.mjs";
import { rad, stepMove, step } from "./kit.mjs";

const mixd = (v, p) => `color-mix(in srgb,var(${v}) ${p}%,#000)`;
const mixl = (v, p) => `color-mix(in srgb,var(${v}) ${p}%,#fff)`;

export const CHAR_CSS = `.j{fill:var(--j)}.jd{fill:${mixd("--j", 62)}}.jl{fill:${mixl("--j", 82)}}.sj{stroke:var(--j)}.sjd{stroke:${mixd("--j", 62)}}.sk{fill:var(--sk)}.skd{fill:${mixd("--sk", 80)}}.ssk{stroke:var(--sk)}.h{fill:var(--h)}.hd{fill:${mixd("--h", 55)}}.hl{fill:${mixl("--h", 60)}}.sh{stroke:var(--h)}.tr{fill:var(--t)}.st{stroke:var(--t)}.im{fill:var(--im)}.sim{stroke:var(--im)}.ol{stroke:#05060b;stroke-width:.7;stroke-linejoin:round}.ln{fill:none;stroke-linecap:round;stroke-linejoin:round}.cc{fill:var(--c)}.scc{stroke:var(--c)}`;

export const LOOK_CSS = SKINS.map((c, i) => `.qs${i}{--sk:${c}}`).join("") + NEONS.map((c, i) => `.qh${i}{--h:${c}}.qt${i}{--t:${c}}.qi${i}{--im:${c}}`).join("") + JACKETS.map((c, i) => `.qj${i}{--j:${c}}`).join("");

const HAIR_FRONT = {
  mohawk: `<path d="M-2 -1.5 L-1.4 -10.5 L0 -13 L1.6 -10.6 L2.2 -1.5Z" class="h ol"/><path d="M0 -12 L.4 -2" stroke="#fff" stroke-width=".6" opacity=".45"/>`,
  undercut: `<path d="M-6.2 .8 Q-6.6 -6.6 0 -7 Q7.2 -7.4 6.4 -.4 Q2.6 -3.6 -1.4 -1.6 Q-4 -.6 -6.2 .8Z" class="h ol"/>`,
  buzz: `<path d="M-5.9 -.6 A6 6.2 0 0 1 5.9 -.6 Q0 -3.4 -5.9 -.6Z" class="hd ol"/>`,
  long: `<path d="M-6.4 8 Q-7.6 -4 -1.2 -6.8 Q7 -7.4 6.8 0 L6.2 8 Q5 0 0 -1.6 Q-4.4 0 -6.4 8Z" class="h ol"/>`,
  bun: `<circle cy="-8" r="3" class="h ol"/><path d="M-6 -.6 A6.1 6.3 0 0 1 6 -.6 Q0 -4 -6 -.6Z" class="h ol"/>`,
  bald: `<path d="M-4.4 -3.4 q1.8 -2.2 4 -1.8" class="sim ln" stroke-width=".8"/>`,
  bob: `<path d="M-6.6 4 Q-7.4 -6.8 0 -7 Q7.4 -6.8 6.6 4 L4.8 4 Q5.2 -1.6 0 -2.4 Q-5.2 -1.6 -4.8 4Z" class="h ol"/>`,
  spikes: `<path d="M-6 -1 L-7 -6 L-4 -4.4 L-3.4 -9.4 L-.6 -5.6 L1.4 -10.4 L3 -5.4 L6.4 -8 L6 -1 Q0 -4 -6 -1Z" class="h ol"/>`,
};
const HAIR_BACK = {
  mohawk: `<path d="M-2 -5.4 L-1.2 -11 L0 -13 L1.4 -11 L2 -5.4 L1.6 5 L-1.6 5Z" class="h ol"/>`,
  undercut: `<path d="M-6.2 1 Q-7 -7 0 -7.2 Q7 -7 6.2 1 Q0 -1.6 -6.2 1Z" class="h ol"/>`,
  buzz: `<path d="M-6 1.6 Q-6.8 -6.6 0 -6.8 Q6.8 -6.6 6 1.6Z" class="hd ol"/>`,
  long: `<path d="M-6.4 9 Q-7.6 -7 0 -7.2 Q7.6 -7 6.4 9Z" class="h ol"/>`,
  bun: `<circle cy="-8" r="3.1" class="h ol"/><path d="M-6.1 2 Q-6.9 -6.8 0 -7 Q6.9 -6.8 6.1 2Z" class="h ol"/>`,
  bald: `<path d="M-3.4 -3 q3.4 -2.6 6.8 0" class="sim ln" stroke-width=".8"/>`,
  bob: `<path d="M-6.8 5.4 Q-7.6 -7 0 -7.2 Q7.6 -7 6.8 5.4Z" class="h ol"/>`,
  spikes: `<path d="M-6.2 2 L-7.2 -5.6 L-4.2 -4.4 L-3.4 -9.4 L-.6 -5.8 L1.4 -10.4 L3 -5.6 L6.6 -7.8 L6.2 2Z" class="h ol"/>`,
};
export const HAIR_STYLES = Object.keys(HAIR_FRONT);

const HEAD = `<ellipse rx="6" ry="6.3" class="sk ol"/><path d="M2.4 -5.6 Q6.4 -2 5.4 3.6 Q6.6 .4 6 -2.6Z" class="skd"/>`;
const EYES = `<ellipse cx="-2.3" cy=".6" rx=".9" ry="1.2" fill="#12131a"/><ellipse cx="2.5" cy=".6" rx=".9" ry="1.2" fill="#12131a"/><circle cx="-2" cy=".2" r=".35" fill="#fff"/><circle cx="2.8" cy=".2" r=".35" fill="#fff"/><path d="M-1.2 3.6 q1.3 .8 2.6 0" stroke="#3a1f1a" stroke-width=".6" fill="none" stroke-linecap="round"/><circle cx="4.9" cy="2" r=".8" class="im"/>`;
const VISOR = `<rect x="-5.6" y="-1.6" width="11.2" height="3.4" rx="1.6" class="im" opacity=".92"/><rect x="-5.6" y="-1.6" width="11.2" height="1.2" rx=".6" fill="#fff" opacity=".35"/><path d="M-1.2 3.8 q1.3 .7 2.6 0" stroke="#3a1f1a" stroke-width=".6" fill="none" stroke-linecap="round"/>`;
const LEGS = `<path d="M-4.2 -12 L-4.6 -1.4 L-.8 -1.4 L-.4 -12Z" fill="#171b27" class="ol"/><path d="M.4 -12 L.8 -1.4 L4.6 -1.4 L4.2 -12Z" fill="#11141d" class="ol"/><path d="M-5.2 -1.6 h4.6 v1.8 h-5.2z M.6 -1.6 h4.4 l.8 1.8 h-5.2z" fill="#0a0b10"/><path d="M-5.4 .3 h4.8 M.6 .3 h5" class="st" stroke-width=".7"/>`;
const TORSO = `<path d="M-6.4 -24.4 Q-7.2 -17 -5.6 -11.4 L5.6 -11.4 Q7.2 -17 6.4 -24.4 Q0 -27 -6.4 -24.4Z" class="j ol"/><path d="M.2 -25.8 Q4 -25.6 6.4 -24.4 Q7.2 -17 5.6 -11.4 L1 -11.4Z" class="jd"/><path d="M-1.8 -25.4 L0 -18.6 L1.8 -25.4" class="jl"/><path d="M-1.8 -25.4 L0 -18.6 L1.8 -25.4" class="st ln" stroke-width=".7"/><path d="M-5.6 -13.2 H5.6" stroke="#0a0b10" stroke-width="1.3"/><rect x="-1" y="-14" width="2" height="1.6" class="tr"/><path d="M6.3 -24 Q7 -17 5.6 -11.8" class="st ln" stroke-width=".8" opacity=".85"/>`;
const NECK = `<rect x="-1.6" y="-27.6" width="3.2" height="3" class="skd"/>`;
const ARM = (d, extra = "") => `<path d="${d}" stroke="#05060b" stroke-width="4.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" class="sj ln" stroke-width="3.2"/>${extra}`;
const HAND = (x, y) => `<circle cx="${x}" cy="${y}" r="1.7" class="sk ol"/>`;

const ARMS = {
  idleL: ARM("M-6 -23.4 L-7.4 -14.6", HAND(-7.5, -13.4)),
  idleR: ARM("M6 -23.4 L7.4 -14.6", HAND(7.5, -13.4)),
  upL: ARM("M-6 -23.4 L-10.2 -31", HAND(-10.6, -32.2)),
  upR: ARM("M6 -23.4 L10.2 -31", HAND(10.6, -32.2)),
  hipL: ARM("M-6 -23.4 L-9 -18 L-5.6 -15", ""),
  hipR: ARM("M6 -23.4 L9 -18 L5.6 -15", ""),
  outR: ARM("M6 -23.4 L11.6 -22", HAND(12.8, -21.8)),
};

export function charDefs() {
  let s = "";
  for (const [k, v] of Object.entries(HAIR_FRONT)) s += `<g id="hf-${k}">${v}</g>`;
  for (const [k, v] of Object.entries(HAIR_BACK)) s += `<g id="hb-${k}">${v}</g>`;
  s += `<g id="c-head">${HEAD}</g><g id="c-eyes">${EYES}</g><g id="c-visor">${VISOR}</g>`;
  s += `<g id="c-shadow"><ellipse rx="8.4" ry="3.2" fill="#000" opacity=".5"/></g>`;
  s += `<g id="c-legs">${LEGS}</g><g id="c-torso">${TORSO}${NECK}</g>`;
  for (const [k, v] of Object.entries(ARMS)) s += `<g id="a-${k}">${v}</g>`;
  s += `<g id="c-back"><path d="M-6.6 -17.6 Q-7.4 -9 -6 -2.4 L6 -2.4 Q7.4 -9 6.6 -17.6 Q0 -20.2 -6.6 -17.6Z" class="j ol"/><path d="M.2 -19 Q4 -18.8 6.6 -17.6 Q7.4 -9 6 -2.4 L1 -2.4Z" class="jd"/><path d="M-4 -15 h8" class="st" stroke-width=".7" opacity=".8"/><path d="M6.5 -17.2 Q7.2 -9 6 -2.8" class="st ln" stroke-width=".8" opacity=".85"/></g>`;
  s += `<g id="c-backhead"><rect x="-1.7" y="-22" width="3.4" height="3" class="skd"/><ellipse cy="-26.4" rx="6" ry="6.2" class="sk ol"/><path d="M-6 -26.4 a6 6.2 0 0 0 12 0" class="skd" opacity=".35"/><circle cx="-5.6" cy="-25.2" r=".9" class="im"/></g>`;
  s += `<g id="b-type"><path d="M-5.6 -16 L-8.6 -22.4M5.6 -16 L3.4 -23" stroke="#05060b" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="M-5.6 -16 L-8.6 -22.4" class="sj ln" stroke-width="3.2"/><path d="M5.6 -16 L3.4 -23" class="sjd ln" stroke-width="3.2"/></g>`;
  s += `<g id="b-type2"><path d="M-5.6 -16 L-7.6 -23M5.6 -16 L4.6 -22.2" stroke="#05060b" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="M-5.6 -16 L-7.6 -23" class="sj ln" stroke-width="3.2"/><path d="M5.6 -16 L4.6 -22.2" class="sjd ln" stroke-width="3.2"/></g>`;
  s += `<g id="b-rest"><path d="M-5.8 -15.6 L-7 -8.4 M5.8 -15.6 L7 -8.4" class="sjd ln" stroke-width="3.2"/></g>`;
  s += `<g id="b-slump"><path d="M-5.6 -15 L-8 -21.4 M5.6 -15 L3.6 -21.8" class="sjd ln" stroke-width="3.2"/></g>`;
  s += `<g id="c-front"><path d="M-3.4 -3.6 L6 -.6 L7 -3.4 L-1.6 -6.6Z" fill="#141720"/><path d="M-6.4 -16.4 Q-7.2 -9.6 -5.8 -3.4 L5.8 -3.4 Q7.2 -9.6 6.4 -16.4 Q0 -19 -6.4 -16.4Z" class="j ol"/><path d="M.2 -17.8 Q4 -17.6 6.4 -16.4 Q7.2 -9.6 5.8 -3.4 L1 -3.4Z" class="jd"/><path d="M-1.6 -17.4 L0 -11 L1.6 -17.4" class="st ln" stroke-width=".7"/><rect x="-1.6" y="-20.4" width="3.2" height="3" class="skd"/></g>`;
  s += `<g id="bot"><ellipse cy="1" rx="6" ry="2.4" fill="#000" opacity=".45"/><path d="M-5.4 -6.6 Q-5.4 -13.6 0 -13.6 Q5.4 -13.6 5.4 -6.6 Q5.4 -3 0 -3 Q-5.4 -3 -5.4 -6.6Z" fill="#2b3040" class="ol"/><path d="M-5.4 -6.6 Q-5.4 -13.6 0 -13.6 Q-2.6 -10 -2.6 -6.6 Q-2.6 -3.6 0 -3 Q-5.4 -3 -5.4 -6.6Z" fill="#3a4156"/><rect x="-3.8" y="-10.2" width="7.6" height="2.6" rx="1.3" class="cc"/><rect x="-3.8" y="-10.2" width="7.6" height="1" rx=".5" fill="#fff" opacity=".4"/><path d="M0 -13.6 v-2.4" stroke="#6a7590" stroke-width=".7"/><circle cy="-16.6" r="1.1" class="cc"/><path d="M-5.2 -4.4 l-1.6 2.2 M5.2 -4.4 l1.6 2.2" stroke="#3a4156" stroke-width="1.2" stroke-linecap="round"/></g>`;
  return s;
}

function attrs(L, o) {
  return ` class="${L.q}"${o.rim && o.rim !== L.trim ? ` style="--t:${o.rim}"` : ""}`;
}
const face = (L) => `<use href="#${L.visor ? "c-visor" : "c-eyes"}"/>`;
const TILT = [-6, 5, -3, 7];
const POSE = { idle: ["idleL", "idleR"], wave: ["idleL", "upR"], cheer: ["upL", "upR"], point: ["hipL", "outR"], sass: ["hipL", "hipR"], 0: ["upL", "upR"], 1: ["upL", "hipR"], 2: ["hipL", "upR"], 3: ["hipL", "outR"] };

function standingBody(L, o) {
  const pose = o.dance != null ? o.dance : o.pose ?? "idle";
  const [al, ar] = POSE[pose] ?? POSE.idle;
  const phones = o.phones ? `<path d="M-6.4 -31.4 A6.6 7 0 0 1 6.4 -31.4" stroke="#1a1d26" stroke-width="1.7" fill="none"/><rect x="-8" y="-33" width="3.2" height="5" rx="1.3" fill="#1a1d26"/><rect x="4.8" y="-33" width="3.2" height="5" rx="1.3" fill="#1a1d26"/><circle cx="6.4" cy="-30.5" r="1" fill="${o.phones}"/>` : "";
  const stick = o.stick && ar === "upR" ? `<path d="M10.6 -32.2 L12.6 -40" stroke="${o.stick}" stroke-width="1.6" stroke-linecap="round"/><path d="M10.6 -32.2 L12.6 -40" stroke="${o.stick}" stroke-width="4.4" stroke-linecap="round" opacity=".25"/>` : "";
  return `<use href="#c-legs"/><use href="#a-${al}"/><use href="#c-torso"/><use href="#a-${ar}"/><g transform="translate(0 -31.6)"><use href="#c-head"/>${face(L)}<use href="#hf-${L.style}"/></g>${phones}${stick}`;
}

export function standing(a, L, o = {}) {
  const tilt = o.dance != null ? ` rotate(${TILT[o.dance % 4]})` : "";
  const scale = o.scale && o.scale !== 1 ? ` scale(${o.scale})` : "";
  const inner = standingBody(L, o);
  const anim = o.hop ? stepMove(["0 0", `0 ${-(o.hopBy ?? 3)}`], { phase: o.phase ?? 0, ticks: o.ticks ?? 1, additive: true }) : "";
  return `<g transform="translate(${R(a[0])} ${R(a[1])})"${o.extra ? " " + o.extra : ""}><use href="#c-shadow"/><g transform="${(tilt + scale).trim() || "scale(1)"}"${attrs(L, o)}>${anim ? `<g>${inner}${anim}</g>` : inner}</g></g>`;
}

export function seatedBack(a, L, o = {}) {
  const arms = o.typing ? "b-type" : o.doze ? "b-slump" : "b-rest";
  const hd = o.doze ? ` transform="translate(-2.4 4.6) rotate(-24 0 -20)"` : o.lean ? ` transform="rotate(9 0 -20)"` : "";
  return `<g transform="translate(${R(a[0])} ${R(a[1])})"${attrs(L, o)}><use href="#c-back"/><use href="#${arms}"/><g${hd}><use href="#c-backhead"/><g transform="translate(0 -26.4)"><use href="#hb-${L.style}"/></g></g></g>`;
}
export function typingFx(a, L) {
  return `<g transform="translate(${R(a[0])} ${R(a[1])})" class="${L.q}"><g opacity="0"><use href="#b-type2"/>${step("opacity", [0, 1])}</g></g>`;
}

export function seatedFront(a, L, o = {}) {
  return `<g transform="translate(${R(a[0])} ${R(a[1])})"${attrs(L, o)}${o.extra ? " " + o.extra : ""}><use href="#c-front"/><g transform="translate(0 -25.4)"><use href="#c-head"/>${face(L)}<use href="#hf-${L.style}"/></g></g>`;
}

export function portrait(L, o = {}) {
  return `<g${attrs(L, o)}><use href="#c-torso"/><g transform="translate(0 -31.6)"><use href="#c-head"/>${face(L)}<use href="#hf-${L.style}"/></g></g>`;
}

export function bot(a, c, o = {}) {
  const body = `<use href="#bot" style="--c:${c}"/>`;
  return `<g transform="translate(${R(a[0])} ${R(a[1])})">${o.glow === false ? "" : `<ellipse cy="-8" rx="13" ry="11" fill="${rad(c)}" opacity=".35"/>`}${body}</g>`;
}
