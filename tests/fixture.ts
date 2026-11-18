import { mock } from 'claude-code/testing'
import { collect } from '../hooks/lib/collect.mjs'
import { buildModel } from '../hooks/lib/model.mjs'
import { buildScene, labelLayers, tierLayers, revOf, LABEL_P0, LABEL_STEP, LABEL_BUCKETS } from '../hooks/lib/office.mjs'
import { register } from '../hooks/planta-77.mjs'
import Stage, { __test as STAGE, clampCam, pickWorld } from '../hooks/stage.mjs'

export const HOME = '/home/tester'
export const NOW = Date.UTC(2026, 9, 7, 20, 0, 0)
export const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR
export const DESK = `${HOME}/.config/Claude/claude-code-sessions/org-1/acct-1`
export const DATA = `${HOME}/.claude/plugins/data/planta-77`
export const SECRET = 'glpat-' + 'Ab12'.repeat(5)

export const enc = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, '-')
export const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`
export const sid = (n: number) => `local_${uuid(n)}`
export const cli = (n: number) => `c${String(n).padStart(7, '0')}-1111-4000-8000-000000000000`

export const ACME = `${HOME}/projects/acme`
export const ACME_DOCS = `${HOME}/projects/acme-docs`
export const ZETA = `${HOME}/projects/zeta`
export const OLD = `${HOME}/projects/old`

type Spec = { n: number, title: string, cwd: string, ago: number, expect: string, archived?: boolean, starred?: boolean, summary?: string, transcript?: string, mtimeAgo?: number }

const line = (o: object) => JSON.stringify(o)
const ts = (ms: number) => new Date(ms).toISOString()
const userPrompt = (t: number, text: string) => line({ type: 'user', timestamp: ts(t), message: { role: 'user', content: text } })
const toolUse = (t: number, id: string, name: string, input: object) => line({ type: 'assistant', timestamp: ts(t), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] } })
const toolResult = (t: number, id: string) => line({ type: 'user', timestamp: ts(t), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } })
const answer = (t: number, text: string) => line({ type: 'assistant', timestamp: ts(t), message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text }] } })

export const SPECS: Spec[] = [
  { n: 1, title: 'Migrate the payments API', cwd: ACME, ago: 40 * 1000, expect: 'work', mtimeAgo: 20 * 1000, transcript: [userPrompt(NOW - 5 * MIN, 'migrate'), toolUse(NOW - 4 * MIN, 't1', 'Read', { file_path: `${ACME}/acme-api/src/pay.ts` }), toolResult(NOW - 4 * MIN, 't1'), toolUse(NOW - 30 * 1000, 't2', 'Bash', { command: `curl -H "PRIVATE-TOKEN: ${SECRET}" https://gitlab.example/api` })].join('\n') },
  { n: 2, title: 'Delete old build artifacts', cwd: ZETA, ago: 2 * MIN, expect: 'perm' },
  { n: 3, title: 'Pick a database', cwd: ACME, ago: 3 * MIN, expect: 'ask', mtimeAgo: 3 * MIN, transcript: [userPrompt(NOW - 6 * MIN, 'which database'), toolUse(NOW - 3 * MIN, 'q1', 'AskUserQuestion', { questions: [{ question: 'Postgres or MySQL?', options: [] }] })].join('\n') },
  { n: 4, title: 'Review the login PR', cwd: ACME, ago: 10 * MIN, expect: 'turn', summary: 'Review the PR and tell me whether to merge it', mtimeAgo: 10 * MIN, transcript: [userPrompt(NOW - 12 * MIN, 'review'), answer(NOW - 10 * MIN, 'Done')].join('\n') },
  { n: 5, title: 'Worktree of branch X', cwd: `${ZETA}/.claude-worktrees/feat-x`, ago: 20 * MIN, expect: 'turn' },
  { n: 6, title: 'Sketch the data model', cwd: ZETA, ago: 60 * MIN, expect: 'idle' },
  { n: 7, title: 'Personal notes', cwd: HOME, ago: 2 * HOUR, expect: 'doze' },
  { n: 8, title: 'Ramen one', cwd: ACME, ago: 5 * HOUR, expect: 'cafe' },
  { n: 9, title: 'Ramen two', cwd: ZETA, ago: 8 * HOUR, expect: 'cafe' },
  { n: 10, title: 'Ramen three', cwd: ACME_DOCS, ago: 13 * HOUR, expect: 'cafe' },
  { n: 11, title: 'Party one', cwd: ACME, ago: 20 * HOUR, expect: 'lounge' },
  { n: 12, title: 'Party two', cwd: ZETA, ago: 2 * DAY, expect: 'lounge' },
  { n: 13, title: 'Old pinned one', cwd: ACME, ago: 10 * DAY, expect: 'lounge', starred: true },
  { n: 14, title: 'Party three', cwd: HOME, ago: 2.5 * DAY, expect: 'lounge' },
  { n: 15, title: 'Frozen one', cwd: ACME, ago: 4 * DAY, expect: 'cryo' },
  { n: 16, title: 'Frozen two', cwd: ZETA, ago: 6 * DAY, expect: 'cryo' },
  { n: 17, title: 'Frozen three', cwd: OLD, ago: 20 * DAY, expect: 'cryo' },
  { n: 18, title: 'Frozen four', cwd: OLD, ago: 30 * DAY, expect: 'cryo' },
  { n: 19, title: 'Frozen five', cwd: ACME_DOCS, ago: 9 * DAY, expect: 'cryo' },
  { n: 20, title: 'Recently archived', cwd: ACME, ago: 30 * MIN, expect: 'archived', archived: true },
]

export function bigSpecs(): Spec[] {
  const folders = Array.from({ length: 14 }, (_, i) => `${HOME}/work/project-${String.fromCharCode(97 + i)}-with-a-long-name`)
  const plan: [string, number, number][] = [['work', 6, 20 * 1000], ['turn', 18, 15 * MIN], ['idle', 14, 60 * MIN], ['doze', 12, 2 * HOUR], ['cafe', 40, 8 * HOUR], ['lounge', 90, 1.5 * DAY], ['cryo', 140, 10 * DAY]]
  const specs: Spec[] = []
  let n = 100
  for (const [state, count, ago] of plan) for (let k = 0; k < count; k++) {
    const cwd = folders[n % folders.length]
    specs.push({ n, title: `Session ${state} number ${k} with a fairly long title to test the clipping`, cwd, ago: ago + k * 1000, expect: state, mtimeAgo: state === 'work' ? 10 * 1000 : undefined, transcript: state === 'work' ? toolUse(NOW - 20000, 'x' + n, 'Bash', { description: 'Build the module and run its integration tests' }) : undefined })
    n++
  }
  return specs
}

export function expectedCounts(specs = SPECS) {
  const c: Record<string, number> = {}
  for (const s of specs) if (s.expect !== 'archived') c[s.expect] = (c[s.expect] ?? 0) + 1
  return c
}

export type Fs = Map<string, { text: string, mtimeMs: number }>

export function buildFs(specs = SPECS, extra: Record<string, string> = {}): Fs {
  const fs: Fs = new Map()
  const put = (path: string, text: string, mtimeMs = NOW - HOUR) => fs.set(path, { text, mtimeMs })
  for (const s of specs) {
    const last = NOW - s.ago
    put(`${DESK}/${sid(s.n)}.json`, JSON.stringify({ sessionId: sid(s.n), cliSessionId: cli(s.n), title: s.title, cwd: s.cwd, originCwd: s.cwd, createdAt: last - HOUR, lastActivityAt: last, isArchived: !!s.archived, isStarred: !!s.starred, completedTurns: 3, postTurnSummary: s.summary ? { status_category: 'needs_input', needs_action: s.summary } : undefined }), last)
    if (s.transcript) put(`${HOME}/.claude/projects/${enc(s.cwd)}/${cli(s.n)}.jsonl`, s.transcript + '\n', NOW - (s.mtimeAgo ?? s.ago))
  }
  put(`${DATA}/live/${cli(2)}.json`, JSON.stringify({ state: 'perm', at: NOW - 2 * MIN, detail: 'Bash › rm -rf build' }), NOW - 2 * MIN)
  for (const r of ['acme-api', 'acme-web', 'acme-infra']) put(`${ACME}/${r}/.git/HEAD`, 'ref: refs/heads/main')
  put(`${ZETA}/.git/HEAD`, 'ref: refs/heads/main')
  put(`${ACME_DOCS}/README.md`, '# docs')
  put(`${HOME}/.claude/plugins/store/some-ci-mod_some-ci-mod-1.json`, JSON.stringify({ radar: { at: NOW - MIN, me: 'tester', pipelines: {
    a: { key: 'a', path: 'g/acme-api', project: 'acme-api', branch: 'feat/payments', status: 'FAILED', duration: 312, startedAt: ts(NOW - 20 * MIN), finishedAt: ts(NOW - 15 * MIN), stages: [{ name: 'build', group: 'success' }, { name: 'test', group: 'failed' }] },
    b: { key: 'b', path: 'g/zeta', project: 'zeta', branch: 'main', status: 'RUNNING', duration: 61, startedAt: ts(NOW - 2 * MIN), stages: [{ name: 'build', group: 'running' }] },
  } } }), NOW - MIN)
  put(`${HOME}/.claude/plugins/store/heat-gate_heat-gate-1.json`, JSON.stringify({ sense: { at: NOW - 10000, sample: { cpu: 42.5, tctl: 61, ncpu: 16, mem: { used: 8e9, total: 16e9, swapUsed: 0 } } }, docker: { at: NOW - 10000, list: [{ name: 'acme-postgres-1', cpu: 1.2, mem: 120 }, { name: 'acme-redis-1', cpu: 0.3, mem: 20 }] } }), NOW - 10000)
  put(`${HOME}/.claude/plugins/store/some-mr-mod_some-mr-mod-1.json`, JSON.stringify({ mrs: { me: 'tester', fetchedAt: NOW - MIN, mrs: [{ author: 'tester', project: 'acme-api' }, { author: 'someone else', project: 'zeta' }, { author: 'tester', project: 'zeta' }] } }), NOW - MIN)
  for (const [k, v] of Object.entries(extra)) put(k, v, NOW)
  return fs
}

function listDir(fs: Fs, path: string) {
  const base = path.replace(/\/+$/, '') + '/'
  const seen = new Map<string, any>()
  for (const [p, f] of fs) {
    if (!p.startsWith(base)) continue
    const rest = p.slice(base.length), i = rest.indexOf('/')
    const name = i < 0 ? rest : rest.slice(0, i)
    if (seen.has(name)) continue
    seen.set(name, i < 0 ? { name, kind: 'file', size: f.text.length, mtimeMs: f.mtimeMs, isLink: false } : { name, kind: 'dir', size: 0, mtimeMs: f.mtimeMs, isLink: false })
  }
  return seen.size ? [...seen.values()] : null
}
const exists = (fs: Fs, path: string) => fs.has(path) || [...fs.keys()].some((p) => p.startsWith(path.replace(/\/+$/, '') + '/'))

function runOn(fs: Fs, argv: string[]) {
  const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '' })
  if (argv[0] === 'uname') return ok('Linux\n')
  if (argv[0] === 'date') return ok('+0200\n')
  if (argv[0] === 'tail') { const f = fs.get(argv[3]); return f ? ok(f.text.slice(-Number(argv[2]))) : { exitCode: 1, stdout: '', stderr: 'no such file' } }
  if (argv[0] === 'find') { const root = argv[1]; return ok([...new Set([...fs.keys()].filter((p) => p.startsWith(root + '/') && /\/\.git\//.test(p)).map((p) => p.slice(0, p.indexOf('/.git/') + 5)))].join('\n')) }
  if (argv[0] === 'stat') return ok(argv.slice(3).map((p, i) => `${Math.floor(NOW / 1000) - i * 60} ${p}`).join('\n'))
  return ok('')
}

export type World = { fs: Fs, runs: string[][], writes: Map<string, string>, reads: string[], toasts: string[], scrolls: any[], ai: { calls: number, answer: string | null }, clock: ReturnType<typeof mock.clock> }

export function world(on: any, o: { fs?: Fs, ai?: string | null, store?: Record<string, unknown>, cli?: string } = {}): World {
  const fs = o.fs ?? buildFs()
  const w: World = { fs, runs: [], writes: new Map(), reads: [], toasts: [], scrolls: [], ai: { calls: 0, answer: o.ai === undefined ? null : o.ai }, clock: mock.clock(on, { now: NOW }) }
  mock.env(on, { HOME })
  mock.store(on, o.store ?? {})
  on('session.id', () => ({ value: o.cli ?? cli(99) }))
  on('fs.list', ($: any, e: any) => { const l = listDir(fs, e.path); return l ? { value: l } : { deny: `ENOENT: ${e.path}` } })
  on('fs.exists', ($: any, e: any) => ({ value: exists(fs, e.path) }))
  on('fs.read', ($: any, e: any) => {
    w.reads.push(e.path)
    const f = fs.get(e.path)
    return f ? { value: f.text } : { deny: `ENOENT: ${e.path}` }
  })
  on('fs.write', ($: any, e: any) => {
    w.writes.set(e.path, e.text)
    fs.set(e.path, { text: e.text, mtimeMs: w.clock.now() })
    return { value: undefined }
  })
  on('model.complete', () => {
    w.ai.calls++
    return { value: w.ai.answer == null ? { isAnswered: false, reason: 'api-error', status: 500 } : { isAnswered: true, text: w.ai.answer, usage: { inputTokens: 1, outputTokens: 1 } } }
  })
  on('process.run', ($: any, e: any) => {
    const argv = [...e.argv] as string[]
    w.runs.push(argv)
    return { value: runOn(fs, argv) }
  })
  for (const name of ['ui.status', 'ui.log', 'command.register']) on(name, () => ({ value: undefined }))
  on('ui.toast', ($: any, e: any) => { w.toasts.push(String(e.text)); return { value: undefined } })
  on('ui.scroll', ($: any, e: any) => { w.scrolls.push(e); return {} })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
  on('session.start', () => ({ cwd: HOME }))
  return w
}

export const COLS = 110, ROWS = 60
export const PANE_PROPS = { title: 'Planta 77', isFocused: true, bodyColumns: COLS, placement: 'dock', scroll: { offset: 0, bodyRows: ROWS }, view: {} }

export async function openPane($: any, surface: 'desktop' | 'terminal', command = 'office', args = '') {
  await $.session.start({ surface, isInteractive: true, cwd: HOME } as any)
  await $.command.run({ command, args, origin: 'user', presentation: 'immediate' } as any)
  return $.ui.mount({ plugin: 'planta-77', component: 'Pane', surface, requestId: 'planta-77', viewport: { columns: 200, rows: 70 }, props: PANE_PROPS } as any)
}
export async function openStage($: any, command = 'office', args = '') {
  const pane = await openPane($, 'desktop', command, args)
  await pane.resize({ columns: COLS, rows: ROWS, in: 'ui' })
  return pane
}
export const runCommand = ($: any, command: string, args = '') => $.command.run({ command, args, origin: 'user', presentation: 'immediate' } as any)

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const clients = async (pane: any) => (await pane.findAll({ type: 'Client' })) as any[]
export const uiProps = async (pane: any) => ((await clients(pane)).find((c) => c.key === 'ui')?.props?.props ?? {}) as any
export type Entry = { id: string, rev: string, box?: number[], room?: string, fx?: 1, lab?: 1 }
export const manifest = async (pane: any) => ((await uiProps(pane)).man ?? []) as Entry[]
export const pageKeys = async (pane: any) => (await clients(pane)).filter((c) => c.props.props?.role === 'page').map((c) => c.key as string)
const FLOOR_ALT = 'Planta 77'
export async function drawnBy(pane: any, key: string) {
  return ((await pane.findAll({ type: 'Svg', in: key })) as any[]).filter((s) => s.props.alt === FLOOR_ALT && s.props.width !== 1).map((s) => String(s.props.source))
}
export async function drawnLayers(pane: any) {
  const ids = new Map((await manifest(pane)).map((m) => [m.rev, m]))
  const out: { at: string, src: string, id: string | null, lab: boolean }[] = []
  for (const key of [...(await pageKeys(pane)), 'ui']) for (const src of await drawnBy(pane, key)) { const m = ids.get(revOf(src)); out.push({ at: key, src, id: m?.id ?? null, lab: m?.lab === 1 }) }
  return out
}
export const labelsDrawn = async (pane: any) => (await drawnLayers(pane)).filter((l) => l.lab).map((l) => l.src).join('')
export const isLoading = async (pane: any) => { const word = (await uiProps(pane)).text?.loading; return !!word && (await uiTexts(pane)).some((t) => t.startsWith(word)) }
export async function settle(pane: any, wait = 130) {
  await pane.advance(16)
  if (wait) await sleep(wait)
  for (let i = 0; i < 60; i++) {
    await pane.advance(48)
    if (!(await isLoading(pane))) break
    await sleep(15)
  }
  await pane.advance(32)
}
export async function swapped(pane: any) {
  await sleep(340)
  await pane.advance(48)
}
export const uiTexts = async (pane: any) => ((await pane.findAll({ type: 'Text', in: 'ui' })) as any[]).map((t) => t.text as string)
export const opened = (w: World) => w.runs.filter((r) => r[0] === 'xdg-open').map((r) => r[1])
export const urlOf = (n: number) => `claude://claude.ai/epitaxy/${sid(n)}`
export async function click(pane: any, c: { x: number, y: number }, extra: object = {}) {
  await pane.pointer({ type: 'down', x: c.x, y: c.y, button: 'left', in: 'ui', ...extra })
  await pane.pointer({ type: 'up', x: c.x, y: c.y, button: 'left', in: 'ui', ...extra })
}
export async function arrive(pane: any, ms: number) {
  await sleep(ms + 25)
  await pane.advance(16)
}

export function ioOf(fs: Fs, now = NOW) {
  const need = (path: string) => { const f = fs.get(path); if (!f) throw new Error(`ENOENT: ${path}`); return f.text }
  return {
    home: HOME, platform: 'linux',
    list: async (path: string) => { const l = listDir(fs, path); if (!l) throw new Error(`ENOENT: ${path}`); return l },
    read: async (path: string) => need(path),
    exists: async (path: string) => exists(fs, path),
    tail: async (path: string, n: number) => need(path).slice(-n),
    run: async (argv: string[]) => runOn(fs, argv),
    now: async () => now,
  }
}
export async function modelOf(specs = SPECS, opts: object = {}) {
  const fs = buildFs(specs)
  const live: Record<string, unknown> = {}
  for (const [path, f] of fs) if (path.startsWith(`${DATA}/live/`)) live[path.slice(DATA.length + 6, -5)] = JSON.parse(f.text)
  return buildModel(await collect(ioOf(fs), { live }), null, opts) as any
}
export function stageScene(model: any, o: { aspect?: number, lod?: number, bucket?: number, scene?: any } = {}) {
  const lod = o.lod ?? 1, bucket = o.bucket ?? 0
  const scene = o.scene ?? buildScene(model, { hour: 22, aspect: o.aspect ?? COLS / (ROWS * 2.4) })
  const lab = labelLayers(scene, model, bucket), base = tierLayers(scene, model, lod) as any[]
  const layers = [...base.filter((l) => !l.fx), ...base.filter((l) => l.fx), ...lab.layers] as any[]
  const man = layers.map((l) => ({ id: l.key, rev: l.rev, ...(l.box ? { box: l.box } : {}), ...(l.room ? { room: l.room } : {}), ...(l.fx ? { fx: 1 } : {}), ...(l.label ? { lab: 1 } : {}) })) as Entry[]
  const ui = { role: 'ui', vb: scene.vb, rho: 2.4, mode: 'office', rooms: scene.rooms, sessions: scene.sessions, info: scene.info, queue: scene.queue, counts: scene.counts, mini: scene.mini, mb: scene.mb, buckets: { p0: LABEL_P0, step: LABEL_STEP, n: LABEL_BUCKETS }, bucket, lod, cmd: null, wheel: null, stale: false, text: {}, lt: lab.targets, man } as any
  return { scene, layers, ui }
}
export const stageUi = (model: any, aspect?: number) => stageScene(model, { aspect }).ui

const el = (type: string) => (props: any = {}) => ({ type, props })
const G = STAGE.G as any
const G0 = { ...G }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export type Cam = { s: number, cx: number, cy: number }

export function twin(ui: any, cols = COLS, rows = ROWS) {
  const g = globalThis as any
  g.h ??= (type: string, props: object) => ({ type, props })
  const listeners: { pointer?: (e: any) => void, ticks: (() => void)[], posts: any[], sent: number[] } = { ticks: [], posts: [], sent: [] }
  const count = (n = 1) => { for (let i = 0; i < n; i++) listeners.sent.push(Date.now()) }
  const every = (ms: number, fn: () => void) => { count(); listeners.ticks.push(fn); return () => { count(); listeners.ticks = listeners.ticks.filter((t) => t !== fn) } }
  const side = () => ({ elements: { Box: el('Box'), Text: el('Text') }, columns: cols, rows, state: undefined, setState() { count(2) }, every, onPointer: () => () => {}, onKey: () => () => {}, post() { count() } })
  const surface = { ...side(), onPointer: (fn: (e: any) => void) => { listeners.pointer = fn; return () => {} }, post(data: any) { count(); listeners.posts.push(data) } }
  const loader = side(), pages = new Map<number, ReturnType<typeof side>>()
  const floor = (node: any): string[] => (node?.type === 'Svg' ? (node.props.alt === FLOOR_ALT && node.props.width !== 1 ? [String(node.props.source)] : []) : Array.isArray(node?.props?.children) ? node.props.children.flatMap(floor) : [])
  for (const k of Object.keys(G)) if (!(k in G0)) delete G[k]
  for (const m of [G.src, G.pg, G.ld]) m.clear()
  Object.assign(G, G0, { plan: [], host: [], sent: [], hud: [], diagSeq: ui.diag })
  let shown = ui
  Stage(ui, surface as any)
  const rho = ui.rho as number
  const t = {
    G, listeners,
    home: () => STAGE.homeCam() as Cam,
    room: (id: string) => STAGE.frameCam(ui.rooms.find((r: any) => r.id === id).f, 1.02) as Cam,
    zoom: (cam: Cam, col: number, row: number, factor: number) => {
      const { sMin, sMax } = STAGE.limits(), s = clamp(cam.s * factor, sMin, sMax), a = STAGE.toWorld(col, row, cam)
      return clampCam({ s, cx: a[0] + (cam.cx - a[0]) * (cam.s / s), cy: a[1] + (cam.cy - a[1]) * (cam.s / s) }) as Cam
    },
    pan: (cam: Cam, dx: number, dy: number) => { const v = STAGE.viewOf(cam); return clampCam({ s: cam.s, cx: cam.cx + dx * v[2], cy: cam.cy + dy * v[3] }) as Cam },
    cell: (cam: Cam, wx: number, wy: number) => { const [x, y] = STAGE.toCh(wx, wy, cam); return { x: Math.floor(x), y: Math.floor(y / rho) } },
    pick: (cam: Cam, x: number, y: number, lt = ui.lt) => { const [wx, wy] = STAGE.toWorld(x + 0.5, y + 0.5, cam); return pickWorld({ ...ui, lt }, wx, wy, 0.6 / cam.s, cam.s * 7.8 >= 0.78) as { kind: string, id: string } | null },
    toSession: (id: string) => {
      const room = t.room(ui.info[id].r), s = Math.max(room.s, Math.min(STAGE.limits().sMax, 1.5 / 7.8)), b = ui.sessions.find((x: any) => x.id === id).b
      return s === room.s ? room : clampCam({ s, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2 - 14 }) as Cam
    },
    free: (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && !t.hudAt(x, y),
    session: (cam: Cam, id: string, lt = ui.lt) => {
      const b = ui.sessions.find((s: any) => s.id === id).b, c = t.cell(cam, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
      for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const hit = t.pick(cam, c.x + dx, c.y + dy, lt)
        if (hit?.kind === 'session' && hit.id === id && t.free(c.x + dx, c.y + dy)) return { x: c.x + dx, y: c.y + dy }
      }
      return null
    },
    roomCell: (cam: Cam, id: string) => { const f = ui.rooms.find((r: any) => r.id === id).f; return t.cell(cam, f[0] + f[2] / 2, f[1] + f[3] / 2) },
    gap: (cam: Cam, kinds: (string | null)[] = [null]) => {
      for (let y = 8; y < rows - 12; y += 2) for (let x = 46; x < cols - 10; x += 3) if (t.free(x, y) && kinds.includes(t.pick(cam, x, y)?.kind ?? null)) return { x, y }
      return null
    },
    sees: (cam: Cam, box?: number[] | null) => { const v = STAGE.viewOf(cam); return !box || (box[0] < v[0] + v[2] && box[2] > v[0] && box[1] < v[1] + v[3] && box[3] > v[1]) },
    tick: () => { for (const fn of listeners.ticks) fn() },
    load: (layers: any[], bucket = ui.bucket) => {
      for (const l of layers) Stage({ role: 'loader', n: 0, got: { id: l.key, rev: l.rev, src: l.src, ...(l.label ? { bucket } : {}) } }, loader as any)
      t.tick()
    },
    page: (n: number) => { if (!pages.has(n)) pages.set(n, side()); return floor(Stage({ role: 'page', n }, pages.get(n) as any)) },
    hosted: () => floor(Stage(shown, surface as any)),
    redraw: (next: any) => { shown = next; Stage(next, surface as any); t.tick() },
    hudAt: (x: number, y: number) => (G.hud as any[]).find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null,
    hud: (id: string) => { const r = (G.hud as any[]).find((x) => x.id === id); return r ? { ...r, cx: Math.floor(r.x + r.w / 2), cy: Math.floor(r.y + r.h / 2) } : null },
  }
  return t
}

export async function hoverAt(pane: any, c: { x: number, y: number }) {
  await pane.pointer({ type: 'move', x: c.x, y: c.y, in: 'ui' })
  const texts = await uiTexts(pane)
  return texts.slice(0, texts.indexOf('PLANTA 77'))
}
export async function offCamera(pane: any, cam: Cam) {
  const ui = await uiProps(pane), t = twin(ui), out: string[] = []
  if (cam.s * 7.8 >= 0.78) {
    const far = (c: { x: number, y: number }) => Math.hypot(c.x - COLS / 2, (c.y - ROWS / 2) * ui.rho)
    const seen = ui.sessions.map((s: any) => ({ id: s.id, c: t.session(cam, s.id)! })).filter((x: any) => x.c).sort((a: any, b: any) => far(b.c) - far(a.c)).slice(0, 2)
    if (!seen.length) out.push('nobody in view')
    for (const { id, c } of seen) {
      const over = await hoverAt(pane, c)
      if (over[0] !== ui.info[id].t) out.push(`${ui.info[id].t} is not at ${c.x},${c.y}: ${over.join(' | ') || 'nothing'}`)
    }
  } else {
    let rooms = 0
    for (let y = 9; y < ROWS - 10; y += 11) for (let x = 44; x < COLS - 8; x += 15) {
      if (!t.free(x, y)) continue
      const hit = t.pick(cam, x, y), room = hit ? ui.rooms.find((r: any) => r.id === hit.id) : null, over = await hoverAt(pane, { x, y })
      const label = over.find((text) => text.endsWith(ui.text.enter)) ?? ''
      if (room) rooms++
      if (label !== (room ? `${room.n}  ·  ${ui.text.enter}` : '')) out.push(`${x},${y}: ${label || 'nothing'} instead of ${room?.n ?? 'nothing'}`)
    }
    if (!rooms) out.push('no room in view')
  }
  await pane.pointer({ type: 'leave', x: 0, y: 0, in: 'ui' })
  return out
}

let lastDirect: { close: () => Promise<void> } | null = null
export async function direct(options: Record<string, unknown> = {}, fs = buildFs()) {
  await lastDirect?.close()
  const hooks = new Map<string, { match: Record<string, unknown> | null, fn: (...a: any[]) => any }[]>()
  register(((event: string, a: any, b?: any) => { hooks.set(event, [...(hooks.get(event) ?? []), b ? { match: a, fn: b } : { match: null, fn: a }]); return { catch: () => undefined } }) as any, options)
  const io = ioOf(fs), tag = (type: string) => (props: any = {}) => ({ type, key: props.key, props })
  const d = { now: NOW, invalidated: 0, scrolls: [] as any[], toasts: [] as string[], writes: new Map<string, string>(), store: new Map<string, unknown>(), timers: [] as { at: number, every: number, fn: () => void }[] }
  const timer = (ms: number, fn: () => void, every = 0) => { const t = { at: d.now + ms, every, fn }; d.timers.push(t); return { cancel: () => { d.timers = d.timers.filter((x) => x !== t) } } }
  const $ = {
    env: { get: async () => HOME }, session: { id: async () => cli(98) }, command: { register: async () => undefined },
    process: { run: async (argv: string[]) => runOn(fs, argv) },
    clock: { now: async () => d.now, every: (ms: number, fn: () => void) => timer(ms, fn, ms), after: (ms: number, fn: () => void) => timer(ms, fn) },
    fs: { list: io.list, read: io.read, exists: io.exists, write: async (path: string, text: string) => { d.writes.set(path, text); fs.set(path, { text, mtimeMs: d.now }) } },
    store: { get: async (k: string) => d.store.get(k) ?? null, set: async (k: string, v: unknown) => { d.store.set(k, v) }, delete: async (k: string) => { d.store.delete(k) } },
    model: { complete: async () => ({ isAnswered: false, reason: 'api-error', status: 500 }) },
    ui: {
      open: async () => ({ isPlaced: true }), invalidate: () => { d.invalidated++ }, toast: (text: string) => { d.toasts.push(text) },
      resolve: () => ({ Box: tag('Box'), Text: tag('Text'), Client: tag('Client'), Svg: tag('Svg'), Button: tag('Button') }),
      scroll: async (args: unknown) => { d.scrolls.push(args); return {} },
    },
  }
  const raise = (event: string, e: any) => {
    const hook = (hooks.get(event) ?? []).find((h) => !h.match || Object.entries(h.match).every(([k, v]) => e[k] === v))
    return hook ? hook.fn($, e, async () => ({})) : undefined
  }
  const advance = async (ms: number) => {
    const end = d.now + ms
    for (let due; (due = d.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0]);) {
      d.now = due.at
      if (due.every) due.at += due.every
      else d.timers = d.timers.filter((t) => t !== due)
      due.fn()
      await sleep(0)
    }
    d.now = end
  }
  const flat = (node: any): any[] => (node && typeof node === 'object' ? [node, ...(node.props?.children ?? []).flatMap(flat)] : [])
  const draw = async (props: object = PANE_PROPS) => flat(await raise('ui.render', { component: 'Pane', requestId: 'planta-77', surface: 'desktop', props }))
  const ui = async (props?: object) => (await draw(props)).find((n) => n.key === 'ui')?.props.props as any
  const post = async (data: unknown, element = 'ui') => (await raise('ui.message', { surface: 'desktop', component: 'Pane', requestId: 'planta-77', element, module: 'hooks/stage.mjs', data })) as any
  const run = async (command: string, args = '') => { await raise('command.run', { command, args }); await sleep(0) }
  const close = async () => { await raise('ui.close', { id: 'planta-77' }); await advance(1000); await sleep(0) }
  return (lastDirect = { $, d, raise, run, advance, draw, ui, post, close })
}
