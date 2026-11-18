import { expect, test } from 'claude-code/testing'
import { decide, sanitize, THRESHOLDS, MIN, HOUR, DAY } from '../hooks/lib/states.mjs'
import { parseAi, heuristicGroups, groupsKey } from '../hooks/lib/projects.mjs'
import { layout } from '../hooks/lib/layout.mjs'
import { newBoard, place, tagLabel, alertLabel, chipLabel, labelsFor } from '../hooks/lib/labels.mjs'
import { clip, sq, P } from '../hooks/lib/util.mjs'
import { trimDocker } from '../hooks/lib/model.mjs'
import { buildScene, labelLayers, tierLayers, buildCompat, bucketOf, bucketSpec, aspectStep, revOf, CLIENT_MAX, TIER_CHUNK, LABEL_P0, LABEL_STEP, LABEL_BUCKETS, LABEL_K_MAX } from '../hooks/lib/office.mjs'
import { buildParts } from '../hooks/lib/world.mjs'
import { cameraData } from '../hooks/lib/feeds.mjs'
import { readStores } from '../hooks/lib/collect.mjs'
import { wheelStep, WHEEL_ZOOM, WHEEL_GAP_MS, WHEEL_MAX_BY } from '../hooks/lib/wheel.mjs'
import { __test as STAGE, clampCam, pickWorld } from '../hooks/stage.mjs'
import { modelOf, stageUi, stageScene, bigSpecs, twin, sleep, sid, SPECS, SECRET, COLS, ROWS } from './fixture'

const NOW = 1_800_000_000_000
const at = (ago: number, extra: object = {}) => decide({ last: NOW - ago, mtime: 0, tail: null, live: null, pinned: false, ...extra } as any, NOW).state

test('time thresholds at their edges', () => {
  expect(at(29 * MIN)).toBe('turn')
  expect(at(31 * MIN)).toBe('idle')
  expect(at(89 * MIN)).toBe('idle')
  expect(at(91 * MIN)).toBe('doze')
  expect(at(3 * HOUR - MIN)).toBe('doze')
  expect(at(3 * HOUR + MIN)).toBe('cafe')
  expect(at(14 * HOUR - MIN)).toBe('cafe')
  expect(at(14 * HOUR + MIN)).toBe('lounge')
  expect(at(3 * DAY - HOUR)).toBe('lounge')
  expect(at(3 * DAY + HOUR)).toBe('cryo')
  expect(at(40 * DAY, { pinned: true })).toBe('lounge')
  expect(THRESHOLDS).toEqual({ turn: 30 * MIN, idle: 90 * MIN, doze: 3 * HOUR, cafe: 14 * HOUR, lounge: 3 * DAY })
})

test('the live state wins over the time', () => {
  expect(at(2 * DAY, { live: { state: 'perm', at: NOW - 2 * DAY, detail: 'x' } })).toBe('perm')
  expect(at(4 * DAY, { live: { state: 'perm', at: NOW - 4 * DAY } })).toBe('cryo')
  expect(at(5 * MIN, { live: { state: 'work', at: NOW - 5 * MIN } })).toBe('work')
  expect(at(12 * MIN, { live: { state: 'work', at: NOW - 12 * MIN } })).toBe('turn')
  const tailAsk = { lastTs: NOW - HOUR, endTurn: false, lastKind: 'tool_use', pending: [{ name: 'AskUserQuestion' }], ask: { text: 'A or B?' }, traces: [], subagents: 0, lines: 2 }
  expect(at(HOUR, { tail: tailAsk })).toBe('ask')
  const tailTool = { lastTs: NOW - 5 * MIN, endTurn: false, lastKind: 'tool_use', pending: [{ name: 'Bash' }], ask: null, traces: [], subagents: 0, lines: 2 }
  expect(at(5 * MIN, { tail: tailTool })).toBe('work')
  expect(at(40 * MIN, { tail: { ...tailTool, lastTs: NOW - 40 * MIN } })).toBe('idle')
})

test('sanitizing removes secrets from the traces', () => {
  const secrets = ['glpat-' + 'Ab12'.repeat(5), 'ghp_' + 'a'.repeat(36), 'sk-ant-api03-' + 'b'.repeat(40), 'xoxb-1234-5678-abcdefgh', 'AKIA' + 'C'.repeat(16), 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ']
  for (const sec of secrets) expect(sanitize(`curl -H "x: ${sec}" https://example.com`)).not.toContain(sec)
  expect(sanitize('Authorization: Bearer abcdef123456789')).not.toContain('abcdef123456789')
  expect(sanitize('https://user:hunter2@example.com/repo.git')).not.toContain('hunter2')
  expect(sanitize('password=hunter2 export')).not.toContain('hunter2')
  expect(sanitize('PRIVATE-TOKEN: zzzzyyyyxxxx1234')).not.toContain('zzzzyyyyxxxx1234')
  expect(sanitize('git status')).toBe('git status')
})

test('sanitizing masks passwords in client flags, JSON, headers, Vault tokens and URLs', () => {
  const pw = 'S3cr3t'
  const leaks = [
    `mysql -u root -p${pw} app`, `mariadb -h db -u root -p ${pw}`, `app --password ${pw}`, `app --pass=${pw}`, `docker login -u me -p ${pw} registry.example`,
    `sshpass -p ${pw} ssh -p 22 host`, `redis-cli -h cache -a ${pw} ping`, `rabbitmqadmin -u guest -p ${pw} list queues`, `curl -u admin:${pw} https://example.com`,
    `DB_PASS=${pw} ./run.sh`, `curl -d '{"password":"${pw}"}' https://example.com`, `curl -d '{"api_key": "${pw}"}' https://example.com`, `{"apiKey":"${pw}","access_key":"${pw}"}`,
    `curl -H "Authorization: Token ${pw}" https://example.com`, `glab auth login --hostname gitlab.example --token ${pw}`, `vault login hvs.${pw}${'x'.repeat(20)}`, `vault login s.${pw}${'Ab3'.repeat(6)}`,
  ]
  for (const t of leaks) expect(sanitize(t)).not.toContain(pw)
  expect(sanitize('psql postgresql://app:p@ss/w0rd@db/app')).toBe('psql postgresql://app:***@db/app')
  expect(sanitize('redis-cli -u redis://:hunter2@cache:6379')).toBe('redis-cli -u redis://:***@cache:6379')
  const harmless = ['mkdir -p dir', 'ssh -p 22 host', 'git commit -p', 'cp -p a b', 'docker run -p 8080:80 img', 'mysql -u root -p -e "select 1"', 'docker login -u me --password-stdin registry.example', 'curl -u admin https://example.com', 'http://localhost:8080/api', 'Tests passed: 45', 'jest --passWithNoTests']
  for (const t of harmless) expect(sanitize(t)).toBe(t)
})

test('the AI answer is validated and what it leaves out goes through the heuristic', () => {
  const folders = ['/h/a', '/h/a-docs', '/h/b', '/h'].map((cwd) => ({ cwd, path: cwd, count: 1, active: 1, recent: 0, titles: [], isRepo: false, repos: [] }))
  expect(parseAi('not json', folders, '/h')).toBeNull()
  expect(parseAi('{"projects":[]}', folders, '/h')).toBeNull()
  const g = parseAi('Here you go: {"groups":[{"name":"Suite A","folders":[0,1,1,9,-1]},{"name":"","folders":[2]},{"name":"X","folders":[0]}]}', folders, '/h')!
  expect(g.map((x: any) => [x.name, x.members, x.ai])).toEqual([['SUITE A', ['/h/a', '/h/a-docs'], true], ['B', ['/h/b'], false], ['HOME', ['/h'], false]])
  expect(heuristicGroups(folders, '/h').map((x: any) => x.name)).toEqual(['A', 'A-DOCS', 'B', 'HOME'])
  expect(groupsKey(folders)).toBe(groupsKey([...folders].reverse()))
})

function overlaps(a: any, b: any) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h }
const boxOverlap = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

test('rooms never overlap and fit on the floor', () => {
  const projects = Array.from({ length: 9 }, (_, i) => ({ key: 'p' + i, name: 'P' + i, desk: Array.from({ length: (i * 5) % 14 }, (_, k) => `s${i}-${k}`), party: 0, cryo: 0, lit: true, repos: [], path: '', neon: '#00e5ff' }))
  const L = layout({ projects, counts: { cafe: 30, lounge: 80 } } as any)
  const rects = L.rooms.map((r: any) => ({ x: r.x, y: r.y, w: r.w, h: r.d }))
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBe(false)
  for (const r of L.rooms) { expect(r.x + r.w).toBeLessThanOrEqual(L.width); expect(r.y + r.d).toBeLessThanOrEqual(L.depth) }
  expect(L.rooms.filter((r: any) => r.kind === 'project').every((r: any) => r.n <= 12)).toBe(true)
})

test('placed labels never overlap each other', () => {
  const B = newBoard([-400, -300, 800, 600], 1.6)
  const states = ['work', 'turn', 'perm', 'ask', 'idle', 'doze', 'cafe', 'lounge']
  for (let i = 0; i < 40; i++) {
    const a = P((i % 8) * 30, Math.floor(i / 8) * 30, 0), st = states[i % states.length]
    const s = { id: 'local_' + i, title: `Test session number ${i} with a long title`, state: st, detail: 'Detail', traces: [] }
    tagLabel(B, a, s, st, { optional: st === 'lounge' })
    if (st === 'perm') alertLabel(B, a, s, st)
    if (i % 7 === 0) chipLabel(B, a, 'CHIP ' + i, '#fff', 2)
  }
  const { placed } = place(B)
  expect(placed.length).toBeGreaterThan(15)
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i].r, placed[j].r)).toBe(false)
  for (const l of placed) { expect(l.r.x).toBeGreaterThanOrEqual(-400); expect(l.r.x + l.r.w).toBeLessThanOrEqual(400) }
})

test('the label targets of every zoom bucket never overlap and stay on the floor', async () => {
  const model = await modelOf()
  const scene = buildScene(model, { hour: 22, aspect: 0.8 })
  const vb = scene.vb
  for (let b = 0; b < LABEL_BUCKETS; b++) {
    const spec = bucketSpec(b)
    const raw = labelsFor(scene.w, model, scene.L, { vb, k: spec.k, tier: spec.tier })
    expect(raw.count).toBeGreaterThan(0)
    expect(raw.bodies.length).toBe(raw.count)
    for (let i = 0; i < raw.targets.length; i++) for (let j = i + 1; j < raw.targets.length; j++) expect(boxOverlap(raw.targets[i].box, raw.targets[j].box), `bucket ${b}: ${raw.targets[i].id} over ${raw.targets[j].id}`).toBe(false)
    for (const t of raw.targets) {
      expect(t.box[0]).toBeGreaterThanOrEqual(vb[0])
      expect(t.box[1]).toBeGreaterThanOrEqual(vb[1])
      expect(t.box[2]).toBeLessThanOrEqual(vb[0] + vb[2])
      expect(t.box[3]).toBeLessThanOrEqual(vb[1] + vb[3])
    }
    const lab = labelLayers(scene, model, b)
    expect(lab.bucket).toBe(b)
    expect(lab.tier).toBe(spec.tier)
    expect(lab.targets.map((t: any) => [t.kind, t.id])).toEqual(raw.targets.map((t: any) => [t.kind, t.id]))
    expect(lab.targets.every((t: any) => t.b.length === 4 && t.b[0] < t.b[2] && t.b[1] < t.b[3])).toBe(true)
    expect(lab.layers.every((l: any) => /^lab\d+$/.test(l.key) && l.label === true && l.box === null)).toBe(true)
    expect(labelLayers(scene, model, b)).toBe(lab)
  }
  const far = labelLayers(scene, model, 0), near = labelLayers(scene, model, LABEL_BUCKETS - 1)
  expect(far.targets.every((t: any) => t.kind === 'room')).toBe(true)
  expect(far.targets.map((t: any) => t.id).sort()).toEqual(scene.rooms.map((r: any) => r.id).sort())
  expect(near.targets.some((t: any) => t.kind === 'session' && t.id === sid(6))).toBe(true)
  expect(labelLayers(scene, model, 99).bucket).toBe(LABEL_BUCKETS - 1)
  expect(labelLayers(scene, model, -3).bucket).toBe(0)
})

test('clip cuts at a word and never goes over the maximum', () => {
  for (const t of ['Thorough review of the platform MR', 'Supercalifragilisticexpialidocious', 'short']) {
    for (const n of [5, 10, 18, 30]) expect(clip(t, n).length).toBeLessThanOrEqual(Math.max(n, t.length <= n ? t.length : n))
  }
  expect(clip('Thorough review of the payments MR', 23)).toBe('Thorough review of the…')
  expect(clip('Thorough refactoring of the MR', 18)).toBe('Thorough refactor…')
})

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps
const inside = (v: number[], vb: number[], eps = 1e-6) => v[0] >= vb[0] - eps && v[1] >= vb[1] - eps && v[0] + v[2] <= vb[0] + vb[2] + eps && v[1] + v[3] <= vb[1] + vb[3] + eps

for (const [cols, rows] of [[COLS, ROWS], [200, 50], [80, 30]]) {
  test(`the whole-floor camera fills the stage, stays on the floor and shows every room (${cols}x${rows})`, async () => {
    const ui = stageUi(await modelOf(), cols / (rows * 2.4))
    const t = twin(ui, cols, rows)
    const home = t.home(), v = STAGE.viewOf(home), vb = ui.vb
    expect(inside(v, vb)).toBe(true)
    expect(close(v[2], vb[2], 1e-3) || close(v[3], vb[3], 1e-3)).toBe(true)
    expect(close(home.s, STAGE.limits().sMin)).toBe(true)
    expect(close(v[2] * home.s, cols) && close(v[3] * home.s, rows * 2.4)).toBe(true)
    for (const r of ui.rooms) for (const [x, y] of r.poly) expect(x >= v[0] && x <= v[0] + v[2] && y >= v[1] && y <= v[1] + v[3], `${r.n} at ${x},${y} outside ${v.map(Math.round)}`).toBe(true)
  })
}

test('clampCam keeps the view inside the floor and the zoom inside its limits', async () => {
  const ui = stageUi(await modelOf())
  twin(ui)
  const vb = ui.vb, { sMin, sMax } = STAGE.limits()
  expect(sMax).toBeGreaterThan(sMin)
  for (const s of [0, sMin / 3, sMin, sMin * 2, sMax, sMax * 9]) {
    for (const [cx, cy] of [[0, 0], [-1e6, -1e6], [1e6, 1e6], [vb[0], vb[1] + vb[3]], [vb[0] + vb[2], vb[1]], [1e6, 0]]) {
      const c = clampCam({ s, cx, cy })
      expect(c.s).toBeGreaterThanOrEqual(sMin)
      expect(c.s).toBeLessThanOrEqual(sMax)
      expect(inside(STAGE.viewOf(c), vb)).toBe(true)
      expect(clampCam(c)).toEqual(c)
    }
  }
  const mid = { s: sMin * 2, cx: vb[0] + vb[2] / 2 + 5, cy: vb[1] + vb[3] / 2 - 7 }
  expect(clampCam(mid)).toEqual(mid)
})

test('frameCam frames every room whole and as large as the stage allows', async () => {
  const ui = stageUi(await modelOf())
  twin(ui)
  for (const r of ui.rooms) {
    const c = STAGE.frameCam(r.f, 1.02), v = STAGE.viewOf(c)
    expect(inside(r.f, v), `${r.n}: ${r.f} in ${v.map(Math.round)}`).toBe(true)
    expect(inside(v, ui.vb)).toBe(true)
    expect(close(c.s, Math.min(COLS / (r.f[2] * 1.02), (ROWS * 2.4) / (r.f[3] * 1.02)))).toBe(true)
    expect(c.s * 7.8).toBeGreaterThanOrEqual(0.78)
  }
})

test('toWorld and toCh are inverse of each other', async () => {
  const ui = stageUi(await modelOf())
  const t = twin(ui)
  for (const cam of [t.home(), t.room('ramen'), t.zoom(t.home(), 20, 50, 3.1)]) {
    for (const [col, row] of [[0, 0], [COLS, ROWS], [12.5, 7.25], [80, 3]]) {
      const [wx, wy] = STAGE.toWorld(col, row, cam), [x, y] = STAGE.toCh(wx, wy, cam)
      expect(close(x, col) && close(y, row * 2.4)).toBe(true)
    }
    const v = STAGE.viewOf(cam)
    expect(STAGE.toWorld(0, 0, cam)).toEqual([v[0], v[1]])
    const [wx, wy] = STAGE.toWorld(COLS / 2, ROWS / 2, cam)
    expect(close(wx, cam.cx) && close(wy, cam.cy)).toBe(true)
  }
})

test('zooming at a point keeps that world point under the pointer, and zooming out ends on the whole floor', async () => {
  const ui = stageUi(await modelOf())
  const t = twin(ui)
  const G = t.G, at = { x: 78, y: 17 }
  const tick = () => t.listeners.ticks.forEach((fn) => fn())
  const dbl = (extra: object = {}) => { for (let i = 0; i < 2; i++) for (const type of ['down', 'up']) t.listeners.pointer!({ type, x: at.x, y: at.y, button: 'left', ...extra }) }
  const before = { ...G.cam }, under = STAGE.toWorld(at.x + 0.5, at.y + 0.5, before)
  expect(before).toEqual(t.home())
  dbl()
  expect(G.tw.kind).toBe('zoom')
  await sleep(330)
  tick()
  expect(G.tw).toBeNull()
  expect(close(G.cam.s, before.s * 2.2)).toBe(true)
  const after = STAGE.toWorld(at.x + 0.5, at.y + 0.5, G.cam)
  expect(close(after[0], under[0], 1e-6) && close(after[1], under[1], 1e-6)).toBe(true)
  expect(G.cam).toEqual(t.zoom(before, at.x + 0.5, at.y + 0.5, 2.2))
  dbl({ shift: true })
  await sleep(330)
  tick()
  expect(close(G.cam.s, before.s) && close(G.cam.cx, before.cx, 1e-3) && close(G.cam.cy, before.cy, 1e-3)).toBe(true)
})

const PAGE_MAX = 88000, MAX_TREE = 100000, PAGE_KEYS = [0, 1, 2, 3, 4]
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)
async function staged(specs: any[], lod: number, zoom = 1) {
  const model = await modelOf(specs), first = stageScene(model, { lod })
  const camOf = (t: ReturnType<typeof twin>) => t.zoom(t.home(), COLS / 2, ROWS / 2, zoom)
  const st = stageScene(model, { lod, bucket: bucketOf(camOf(twin(first.ui)).s * 7.8), scene: first.scene })
  const t = twin(st.ui), cam = camOf(t)
  t.G.cam = cam
  return { ...st, t, cam }
}
function drawnBy(t: ReturnType<typeof twin>, layers: any[]) {
  const keyOf = new Map(layers.map((l) => [l.src, l.key])), pages = PAGE_KEYS.map((n) => t.page(n)), hosted = t.hosted()
  for (const page of pages) {
    if (page.length > 1) expect(sum(page.map((src) => src.length))).toBeLessThanOrEqual(PAGE_MAX)
    expect(JSON.stringify(page).length).toBeLessThan(MAX_TREE)
  }
  const used = pages.map((page) => page.length > 0)
  expect(used).toEqual([...used].sort().reverse())
  return { pages, hosted, sources: [...pages.flat(), ...hosted], keys: [...pages.flat(), ...hosted].map((src) => keyOf.get(src)) }
}

for (const [name, specs, lod] of [['19 sessions packed', SPECS, 1], ['19 sessions by room', SPECS, 2], ['320 sessions packed from afar', bigSpecs(), 0], ['320 sessions packed', bigSpecs(), 1]] as const) {
  test(`the pages take every layer in view in paint order, none over the page limit, and the HUD instance takes the last ones when they fit (${name})`, async () => {
    const { layers, t } = await staged(specs as any[], lod)
    expect(drawnBy(t, layers).keys).toEqual([])
    t.load(layers.slice(0, 2))
    expect(drawnBy(t, layers).keys).toEqual(layers.slice(0, 2).map((l) => l.key))
    t.load(layers.slice(2))
    const { pages, hosted, keys } = drawnBy(t, layers)
    expect(keys).toEqual(layers.map((l) => l.key))
    expect(pages[0].length).toBeGreaterThan(0)
    expect(sum(hosted.map((src) => src.length))).toBeLessThan(PAGE_MAX - 20000)
    if (specs === SPECS) expect(hosted.length).toBeGreaterThan(0)
    t.load(layers)
    expect(drawnBy(t, layers).keys).toEqual(keys)
  })
}

test('while the layers of another detail level load the ones already drawn stay, and they give way all at once', async () => {
  const far = await staged(SPECS, 1), near = stageScene(await modelOf(), { lod: 2, bucket: far.ui.bucket, scene: far.scene })
  const t = far.t, sources = (layers: any[]) => layers.map((l) => l.src), drawn = () => drawnBy(t, []).sources
  t.load(far.layers)
  expect(drawn()).toEqual(sources(far.layers))
  t.redraw(near.ui)
  expect(drawn()).toEqual(sources(far.layers))
  t.load(near.layers.slice(0, -2))
  expect(drawn()).toEqual(sources(far.layers))
  t.load(near.layers.slice(-2))
  expect(drawn()).toEqual(sources(near.layers))
  t.redraw(far.ui)
  expect(drawn()).toEqual(sources(near.layers))
  t.load(far.layers)
  expect(drawn()).toEqual(sources(far.layers))
})

test('while a new revision of a layer replaces the old one every layer of the list stays drawn', async () => {
  const { ui, layers, t } = await staged(bigSpecs(), 1), model = await modelOf(bigSpecs())
  t.load(layers)
  expect(drawnBy(t, layers).keys).toEqual(layers.map((l) => l.key))
  const busy = { ...model, sessions: model.sessions.map((s: any, i: number) => (i ? s : { ...s, state: s.state === 'doze' ? 'idle' : 'doze' })) }
  const next = stageScene(busy, { lod: 1, bucket: ui.bucket }), fresh = next.layers.filter((l, i) => l.rev !== layers[i].rev)
  expect(next.layers.map((l) => l.key)).toEqual(layers.map((l) => l.key))
  expect(fresh.length).toBeGreaterThan(0)
  expect(fresh.length).toBeLessThan(layers.length)
  t.redraw(next.ui)
  t.load(fresh)
  const { sources } = drawnBy(t, next.layers)
  expect(sources.length).toBeGreaterThan(layers.length - 1)
  expect(next.layers.filter((l) => !sources.includes(l.src)).map((l) => l.key)).toEqual([])
})

test('when the per-room layers in view do not fit the pages the stage draws what fits, in paint order, and asks for the packed floor until the camera zooms in further', async () => {
  const { ui, layers, t, cam } = await staged(bigSpecs(), 2, 1.6 ** 3)
  expect(cam.s * 7.8).toBeGreaterThan(1.1)
  t.load(layers)
  const { pages, keys } = drawnBy(t, layers), inView = layers.filter((l) => t.sees(cam, l.box)).map((l) => l.key)
  expect(inView.length).toBeLessThan(layers.length)
  expect(keys.length).toBeLessThan(inView.length)
  expect(pages.every((page) => page.length > 0)).toBe(true)
  expect(keys).toEqual(inView.filter((key) => keys.includes(key)))
  expect(t.listeners.posts).toEqual([])
  t.tick()
  await sleep(130)
  t.tick()
  expect(t.listeners.posts).toEqual([{ kind: 'view', bucket: ui.bucket, lod: 1 }])
  t.G.cam = t.zoom(cam, COLS / 2, ROWS / 2, 1.3)
  t.tick()
  await sleep(130)
  t.tick()
  expect(t.listeners.posts.at(-1)).toMatchObject({ kind: 'view', lod: 2 })
})

test('however fast the camera moves the stage stays under the message rate the app allows, and a paint it had to skip is done once there is room again', async () => {
  const { layers, t } = await staged(SPECS, 2)
  for (const n of PAGE_KEYS) t.page(n)
  t.load(layers)
  const G = t.G, home = t.home(), start = Date.now(), painted: number[] = []
  let frame = G.frame, ticks = 0
  while (Date.now() - start < 1150) {
    G.cam = { ...home, s: home.s * (1 + (ticks % 2) / 100) }
    G.dirty = true
    t.tick()
    ticks++
    if (G.frame !== frame) { frame = G.frame; painted.push(Date.now() - start) }
  }
  const sent = t.listeners.sent
  let most = 0
  for (let i = 0, j = 0; j < sent.length; j++) { while (sent[j] - sent[i] >= 1000) i++; most = Math.max(most, j - i + 1) }
  expect(ticks).toBeGreaterThan(1000)
  expect(most).toBeGreaterThan(150)
  expect(most).toBeLessThanOrEqual(400)
  expect(painted[0]).toBeLessThan(200)
  expect(painted.length).toBeLessThan(ticks / 4)
  expect(painted.some((ms) => ms > 1000)).toBe(true)
})

test('a click picks the label or the person only when zoomed in, the room otherwise, and reaches labels thinner than a row', () => {
  const room = { id: 'r', poly: [[0, 0], [400, 0], [400, 300], [0, 300]] }
  const ui = { rooms: [room], sessions: [{ id: 'a', b: [100, 100, 120, 140] }, { id: 'b', b: [130, 100, 150, 140] }], lt: [{ kind: 'session', id: 'b', b: [90, 60, 180, 75] }, { kind: 'room', id: 'r2', b: [300, -40, 380, -10] }] }
  expect(pickWorld(ui, 110, 120, 1, true)).toMatchObject({ kind: 'session', id: 'a' })
  expect(pickWorld(ui, 110, 120, 1, false)).toEqual({ kind: 'room', id: 'r' })
  expect(pickWorld(ui, 124, 120, 5, true)).toMatchObject({ kind: 'session', id: 'a' })
  expect(pickWorld(ui, 127, 120, 5, true)).toMatchObject({ kind: 'session', id: 'b' })
  expect(pickWorld(ui, 110, 70, 1, true)).toMatchObject({ kind: 'session', id: 'b' })
  expect(pickWorld(ui, 340, -20, 1, false)).toEqual({ kind: 'room', id: 'r2' })
  expect(pickWorld(ui, 250, 250, 1, true)).toEqual({ kind: 'room', id: 'r' })
  expect(pickWorld(ui, 500, 500, 1, true)).toBeNull()
  expect(pickWorld({}, 0, 0, 1, true)).toBeNull()
  const s = 0.2, row = 2.4 / s, tol = 0.6 / s
  for (let k = 0; k < 20; k++) {
    const top = 400 + (k / 20) * row, thin = { rooms: [], sessions: [], lt: [{ kind: 'session', id: 'thin', b: [0, top, 90, top + row * 0.85] }] }
    const rows = [0, 1, 2, 3].map((n) => 400 + (n - 1 + 0.5) * row).filter((wy) => pickWorld(thin, 45, wy, tol, true)?.id === 'thin')
    expect(rows.length, `label at ${top}`).toBeGreaterThanOrEqual(1)
  }
})

test('the HUD keeps its buttons inside the stage, apart from each other, and drops what does not fit', async () => {
  const ui = stageUi(await modelOf())
  const ids = (cols: number, rows: number) => {
    const hud = twin(ui, cols, rows).G.hud as any[]
    for (const r of hud) expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= cols && r.y + r.h <= rows, `${r.id} at ${cols}x${rows}`).toBe(true)
    for (let i = 0; i < hud.length; i++) for (let j = i + 1; j < hud.length; j++) expect(overlaps(hud[i], hud[j]), `${hud[i].id} over ${hud[j].id} at ${cols}x${rows}`).toBe(false)
    return hud.map((r) => r.id.replace(/^q:.*/, 'q'))
  }
  expect(ids(COLS, ROWS)).toEqual(['mode', 'help', 'in', 'out', 'home', 'q', 'q', 'q', 'q', 'map'])
  expect(ids(60, 16)).toEqual(['mode', 'help', 'in', 'out', 'home', 'q', 'q', 'more'])
  expect(ids(40, 10)).toEqual(['help'])
  const queue = twin(ui).hud(`q:${ui.queue[0]}`)
  expect(queue).toMatchObject({ act: 'queue', sid: ui.queue[0], h: 1 })
  expect(twin({ ...ui, mode: 'cameras', cams: {} }).G.hud.map((r: any) => r.id).filter((id: string) => !/^(cam|s|tr):/.test(id))).toEqual(['mode', 'help'])
})

test('the zoom buckets grow with the zoom and the bucket of each spec is itself', () => {
  expect(bucketOf(0)).toBe(0)
  expect(bucketOf(-5)).toBe(0)
  expect(bucketOf(1e9)).toBe(LABEL_BUCKETS - 1)
  let last = -1
  for (let p = 0.05; p < 6; p *= 1.07) { const b = bucketOf(p); expect(b).toBeGreaterThanOrEqual(last); last = b }
  expect(last).toBe(LABEL_BUCKETS - 1)
  for (let b = 0; b < LABEL_BUCKETS; b++) {
    const spec = bucketSpec(b)
    expect(bucketOf(spec.p)).toBe(b)
    expect(close(spec.p, LABEL_P0 * Math.pow(LABEL_STEP, b))).toBe(true)
    expect(spec.k).toBeGreaterThan(0)
    expect(spec.k).toBeLessThanOrEqual(LABEL_K_MAX)
    expect(spec.tier).toBe(spec.p < 0.8 ? 0 : spec.p < 1.3 ? 1 : 2)
    if (b) expect(spec.k).toBeLessThanOrEqual(bucketSpec(b - 1).k)
  }
  expect(bucketSpec(0).tier).toBe(0)
  expect(bucketSpec(LABEL_BUCKETS - 1).tier).toBe(2)
})

test('the pane shape is rounded to a tenth and kept between tall and wide', () => {
  expect(aspectStep(NaN)).toBe(1.6)
  expect(aspectStep(undefined as any)).toBe(1.6)
  expect(aspectStep(0.764)).toBe(0.8)
  expect(aspectStep(1.649)).toBe(1.6)
  expect(aspectStep(0.1)).toBe(0.6)
  expect(aspectStep(12)).toBe(3)
})

test('the wheel: one step per notch, up zooms in, no repeat within the debounce', () => {
  const person = (by: number) => ({ by, origin: { kind: 'person' } })
  const up = wheelStep(person(-1), null, 1000)
  expect(up.factor).toBe(WHEEL_ZOOM)
  expect(up.last).toEqual({ dir: 1, at: 1000 })
  expect(wheelStep(person(-2), up.last, 1000 + WHEEL_GAP_MS - 1).factor).toBe(1)
  expect(wheelStep(person(-1), up.last, 1000 + WHEEL_GAP_MS).factor).toBe(WHEEL_ZOOM)
  const down = wheelStep(person(3), up.last, 1010)
  expect(down.factor).toBe(1 / WHEEL_ZOOM)
  expect(down.last).toEqual({ dir: -1, at: 1010 })
  expect(wheelStep(person(-WHEEL_MAX_BY), null, 0).factor).toBe(WHEEL_ZOOM)
  for (const e of [person(0), person(WHEEL_MAX_BY + 1), person(-(WHEEL_MAX_BY + 1)), { by: -1, origin: { kind: 'plugin', name: 'x' } }, { by: 'x', origin: { kind: 'person' } }, null]) {
    const r = wheelStep(e as any, up.last, 5000)
    expect(r.factor).toBe(1)
    expect(r.last).toBe(up.last)
  }
})

test('the container prefix is dropped from the server room names', () => {
  const docker = { at: 1, list: [{ name: 'shop-postgres-1', cpu: 1, mem: 2 }, { name: 'redis', cpu: 0, mem: 1 }, { name: 'shop-', cpu: 0, mem: 1 }] }
  expect(trimDocker(docker, 'shop-').list.map((c: any) => c.name)).toEqual(['postgres-1', 'redis', 'shop-'])
  expect(trimDocker(docker, '')).toBe(docker)
  expect(trimDocker(null, 'shop-')).toBe(null)
})

test('the camera feeds: newest traces first, pipelines, merge requests and system', async () => {
  const T0 = Date.UTC(2026, 9, 7, 20, 0, 0)
  const trace = (i: number) => ({ tool: i % 2 ? 'Bash' : 'Read', text: `step ${i}`, ts: T0 + ((i * 37) % 50) * 60000 })
  const model = {
    sessions: [
      { id: sid(1), state: 'work', title: 'A session with a title that is far too long to fit the column', traces: Array.from({ length: 25 }, (_, i) => trace(i)) },
      { id: sid(2), state: 'perm', title: 'Two', traces: Array.from({ length: 20 }, (_, i) => trace(i + 25)) },
      { id: sid(3), state: 'turn', title: 'No clock', traces: [{ tool: 'Edit', text: 'x'.repeat(200) }] },
      { id: sid(4), state: 'idle', title: 'Nothing' },
    ],
    pipelines: [
      { project: 'acme-api', branch: 'feat/payments', status: 'FAILED', duration: 312, stages: [{ group: 'success' }, { group: 'failed' }, { group: 'odd' }] },
      { project: 'zeta', branch: 'main', status: 'RUNNING', duration: 61, stages: Array.from({ length: 9 }, () => ({ group: 'running' })) },
      { project: 'p', branch: 'fix/x', status: 'WEIRD' }, ...Array.from({ length: 5 }, (_, i) => ({ project: 'q' + i, branch: 'b', status: 'SUCCESS', duration: 0 })),
    ],
    sources: { pipelines: true }, mrs: { open: 3, mine: 2 },
    system: { cpu: 42.54, temp: 61.4, ramUsed: 8.04, ramTotal: 16 },
    docker: { list: Array.from({ length: 8 }, (_, i) => ({ name: `container-with-a-long-name-${i}` })) },
  }
  const c = cameraData(model, 120)
  expect(c.traces).toHaveLength(30)
  const minutes = c.traces.filter((t: any) => t.t !== '--:--').map((t: any) => Number(t.t.slice(0, 2)) * 60 + Number(t.t.slice(3)))
  expect(minutes).toEqual([...minutes].sort((a, b) => b - a))
  expect(c.traces[0]).toEqual({ id: sid(2), c: '#ff8a3d', n: 'Two', tool: 'Bash', x: 'step 27', t: '22:49' })
  expect(c.traces.find((t: any) => t.id === sid(1)).n).toBe('A session with a title that is…')
  expect(c.traces.every((t: any) => t.n.length <= 34 && t.tool.length <= 16 && t.x.length <= 96 && /^local_/.test(t.id))).toBe(true)
  expect(cameraData(model, 0).traces[0].t).toBe('20:49')
  expect(cameraData({ ...model, sessions: [model.sessions[2]] }).traces).toEqual([expect.objectContaining({ id: sid(3), t: '--:--', tool: 'Edit' })])
  expect(c.pipes).toHaveLength(6)
  expect(c.pipes[0]).toEqual({ c: '#ff3b5c', i: '✖', p: 'acme-api', b: 'payments', st: ['#39ff88', '#ff3b5c', '#3a4256'], d: '5:12' })
  expect(c.pipes[1]).toMatchObject({ i: '▶', b: 'main', d: '1:01' })
  expect(c.pipes[1].st).toHaveLength(7)
  expect(c.pipes[2]).toMatchObject({ c: '#fcee0a', i: '●', b: 'x', st: [], d: '' })
  expect(c.radar).toBe(true)
  expect(c.mrs).toEqual([3, 2])
  expect(c.sys).toEqual({ cpu: 42.5, temp: 61, ram: [8, 16] })
  expect(c.dockerN).toBe(8)
  expect(c.docker).toHaveLength(6)
  expect(c.docker.every((n: string) => n.length <= 20)).toBe(true)
  expect(cameraData({ sessions: [] })).toEqual({ traces: [], pipes: [], radar: false, mrs: null, sys: null, docker: [], dockerN: 0 })
  const real = cameraData(await modelOf(), 120)
  expect(real.traces.map((t: any) => t.t)).toEqual(['21:59', '21:57', '21:56'])
  expect(real.traces[0]).toMatchObject({ id: sid(1), tool: 'Bash' })
  expect(JSON.stringify(real)).not.toContain(SECRET)
  expect(real.pipes.map((p: any) => p.p)).toEqual(['zeta', 'acme-api'])
  expect(real.sys).toEqual({ cpu: 42.5, temp: 61, ram: [8, 16] })
  expect(real.docker).toEqual(['acme-postgres-1', 'acme-redis-1'])
})

test('pipelines and merge requests come from any other mod whose store has their shape, newest first', async () => {
  const files: Record<string, [string, number]> = {
    'old-ci_1.json': [JSON.stringify({ radar: { pipelines: { a: { key: 'a', project: 'old', status: 'SUCCESS' } } } }), 1],
    'new-ci_1.json': [JSON.stringify({ radar: { pipelines: { b: { key: 'b', project: 'new', status: 'RUNNING' } } } }), 3],
    'reviews_1.json': [JSON.stringify({ mrs: { me: 'me', mrs: [{ author: 'me', project: 'p' }, { author: 'you', project: 'p' }] } }), 2],
    'broken_1.json': ['{not json', 4],
    'planta-77_1.json': [JSON.stringify({ radar: { pipelines: { c: { key: 'c', project: 'ours' } } } }), 9],
  }
  const io = { home: '/h', list: async () => Object.entries(files).map(([name, [, mtimeMs]]) => ({ name, kind: 'file', mtimeMs })), read: async (p: string) => files[p.split('/').pop()!][0] }
  const st = await readStores(io)
  expect(st.pipelines.list.map((p: any) => p.project)).toEqual(['new'])
  expect(st.mrs).toEqual({ at: 2, open: 2, mine: 1, byProject: { p: 2 } })
  expect(st.system).toBe(null)
  expect((await readStores({ ...io, list: async () => [] })).pipelines).toBe(null)
})

test('sq turns double-quoted attributes into single-quoted ones and keeps apostrophes safe', () => {
  expect(sq('<g id="a" class="b c"><text x="1">it\'s "quoted"</text></g>')).toBe("<g id='a' class='b c'><text x='1'>it's \"quoted\"</text></g>")
  expect(sq(`<text font-family="'Ubuntu Sans',sans-serif">x</text>`)).toBe("<text font-family='&apos;Ubuntu Sans&apos;,sans-serif'>x</text>")
  expect(sq('<path d=""/>')).toBe("<path d=''/>")
  expect(sq('plain')).toBe('plain')
})

function artFaults(key: string, src: string) {
  const out: string[] = []
  if (!src.startsWith("<svg xmlns='http://www.w3.org/2000/svg'") || !src.endsWith('</svg>')) out.push(`${key}: not one svg`)
  if (/<filter/.test(src)) out.push(`${key}: <filter`)
  if (/filter=/.test(src)) out.push(`${key}: filter=`)
  if (/<pattern/.test(src)) out.push(`${key}: <pattern`)
  if (/animation/.test(src)) out.push(`${key}: animation`)
  if (/@keyframes/.test(src)) out.push(`${key}: @keyframes`)
  if (/="/.test(src)) out.push(`${key}: double-quoted attribute`)
  if (JSON.stringify(src).length > CLIENT_MAX) out.push(`${key}: ${JSON.stringify(src).length} over ${CLIENT_MAX}`)
  return out
}

test('every layer follows the art rules: no filters, patterns or CSS animation, single quotes, within the client limit', async () => {
  const model = await modelOf()
  const faults: string[] = [], themes = new Set<string>()
  for (const [hour, aspect] of [[22, 0.8], [7, 1.6], [13, 2.4], [20, 0.8]]) {
    const scene = buildScene(model, { hour, aspect })
    themes.add(scene.theme)
    expect(scene.layers.length).toBeGreaterThan(10)
    expect(new Set(scene.layers.map((l: any) => l.key)).size).toBe(scene.layers.length)
    for (const l of scene.layers) faults.push(...artFaults(`${hour}h/${aspect}/${l.key}`, l.src))
    for (let b = 0; b < LABEL_BUCKETS; b++) for (const l of labelLayers(scene, model, b).layers) faults.push(...artFaults(`${hour}h/${aspect}/b${b}/${l.key}`, l.src))
    faults.push(...artFaults(`${hour}h/${aspect}/mini`, scene.mini))
    for (const l of scene.layers) expect(l.src).not.toContain(SECRET)
  }
  expect([...themes].sort()).toEqual(['dawn', 'day', 'dusk', 'night'])
  expect(faults).toEqual([])
})

const pairs = (layers: any[]) => layers.map((l) => [l.key, l.rev])

test('the far and middle detail pack the whole floor into a few big sources with the animated part apart, and the near detail is the per-room layers', async () => {
  const model = await modelOf(), busy = { ...model, sessions: model.sessions.map((s: any) => (s.id === sid(6) ? { ...s, state: 'doze' } : s)) }
  const scene = buildScene(model, { hour: 22, aspect: 0.8 }), again = buildScene(model, { hour: 22, aspect: 0.8 }), other = buildScene(busy, { hour: 22, aspect: 0.8 })
  const biggest = Math.max(...scene.layers.map((l: any) => l.src.length)), faults: string[] = []
  expect(tierLayers(scene, model, 2)).toBe(scene.layers)
  for (const lod of [0, 1]) {
    const tier = tierLayers(scene, model, lod) as any[], still = tier.filter((l) => !l.fx), moving = tier.filter((l) => l.fx)
    expect(tierLayers(scene, model, lod)).toBe(tier)
    expect(tier.map((l) => l.key)).toEqual([...still.map((_, i) => `w${lod}-${i}`), ...moving.map((_, i) => `x${lod}-${i}`)])
    expect(still.length).toBeGreaterThan(0)
    expect(moving.length).toBeGreaterThan(0)
    expect(tier.length).toBeLessThan(scene.layers.length / 3)
    expect(Math.max(...tier.map((l) => l.src.length))).toBeGreaterThan(biggest)
    for (const l of tier) {
      expect(l.src.length, l.key).toBeLessThanOrEqual(TIER_CHUNK)
      expect(l.rev).toBe(revOf(l.src))
      expect(l.box).toBeNull()
      expect('room' in l).toBe(false)
      expect(l.src).not.toContain(SECRET)
      faults.push(...artFaults(`detail ${lod}/${l.key}`, l.src))
    }
    const parts = buildParts(model, scene.L, { theme: scene.th, lod, vb: scene.vb }).parts as any[], floor = still.map((l) => l.src).join(''), fx = moving.map((l) => l.src).join('')
    expect(parts.length).toBeGreaterThan(10)
    for (const part of parts) {
      if (part.s) expect(floor.includes(sq(part.s)), `${part.key} at detail ${lod}`).toBe(true)
      if (part.f) expect(fx.includes(sq(part.f)), `the moving part of ${part.key} at detail ${lod}`).toBe(true)
    }
    expect(floor).not.toContain('<animate')
    expect(fx).toContain('<animate')
    expect(pairs(tierLayers(again, model, lod) as any[])).toEqual(pairs(tier))
    const changed = tierLayers(other, busy, lod) as any[]
    expect(changed.map((l) => l.key)).toEqual(tier.map((l) => l.key))
    expect(changed.filter((l, i) => l.rev !== tier[i].rev).length).toBeGreaterThan(0)
  }
  expect((tierLayers(scene, model, 0) as any[]).length).toBeLessThanOrEqual((tierLayers(scene, model, 1) as any[]).length)
  expect(faults).toEqual([])
})

test('a layer keeps its revision while its source is the same, and a change in one room only touches that room', async () => {
  const model = await modelOf()
  const a = buildScene(model, { hour: 22, aspect: 0.8 }), b = buildScene(model, { hour: 22, aspect: 0.8 })
  expect(b.layers.map((l: any) => [l.key, l.rev])).toEqual(a.layers.map((l: any) => [l.key, l.rev]))
  const other = buildScene({ ...model, sessions: model.sessions.map((s: any) => (s.id === sid(6) ? { ...s, state: 'doze' } : s)) }, { hour: 22, aspect: 0.8 })
  const changed = other.layers.filter((l: any, i: number) => l.rev !== a.layers[i].rev).map((l: any) => l.key)
  const zeta = a.rooms.find((r: any) => r.n === 'ZETA').id
  expect(changed).toEqual([zeta, `fx-${zeta}`])
  expect(a.layers.filter((l: any) => l.fx).every((l: any) => /^fx/.test(l.key))).toBe(true)
  expect(a.layers.filter((l: any) => l.room).map((l: any) => [l.key, l.room])).toEqual([...a.rooms.map((r: any) => [r.id, r.id]), ...a.rooms.map((r: any) => [`fx-${r.id}`, r.id])])
  expect(a.layers.filter((l: any) => l.box).every((l: any) => l.box.length === 4 && l.box[0] < l.box[2] && l.box[1] < l.box[3])).toBe(true)
  expect(a.queue).toEqual([sid(2), sid(3), sid(4), sid(5)])
  expect(Object.keys(a.info).length).toBe(a.sessions.length)
  expect(a.info[sid(2)]).toMatchObject({ s: 'perm', rn: 'ZETA', t: 'Delete old build artifacts' })
})

test('the compatible picture is made of whole Svg sources that each fit one Svg element', async () => {
  const model = await modelOf()
  for (const p of [0.2, 0.4, 1.1]) {
    const c = buildCompat(model, { hour: 22, aspect: 0.8, p })
    expect(c.layers.length).toBeGreaterThanOrEqual(1)
    for (const src of c.layers) {
      expect(src.length).toBeLessThanOrEqual(131072)
      expect(src.startsWith('<svg')).toBe(true)
      expect(src.endsWith('</svg>')).toBe(true)
      expect(src).not.toContain(SECRET)
    }
  }
})
