import { expect, test } from 'claude-code/testing'
import { world, openPane, uiProps, buildFs, cli, DATA, DESK, NOW, MIN, HOME } from './fixture'
import { groupsKey } from '../hooks/lib/projects.mjs'

const STATUS = /\d+ sessions? · /
const SLOW = { timeoutMs: 30000 }
const statusOf = async (pane: any) => (await pane.find({ type: 'Text', text: STATUS }))!.text as string
const roomNames = async (pane: any) => ((await pane.find({ type: 'Text', text: /at desk ·/ }))!.text as string).split('\n').map((l) => l.slice(0, 22).trim())

const snapOf = (at: number, title: string, lang = 'en') => JSON.stringify({
  v: 2, lang, at, by: 'other', home: HOME, total: 1, archived: 0, counts: { work: 1 }, groupsByAi: false,
  sessions: [{ id: 'local_99999999-0000-4000-8000-999999999999', cli: 'x', title, path: '~/projects/acme', project: 'pq', state: 'work', age: 1000, last: at, detail: '', source: 'live', pinned: false, traces: [], subagents: 0 }],
  projects: [{ key: 'pq', name: 'SHARED', members: [`${HOME}/projects/acme`], path: '~/projects/acme', repos: [], ai: false, neon: '#00e5ff', count: 1, desk: ['local_99999999-0000-4000-8000-999999999999'], party: 0, cryo: 0, lit: true, recent: at, active: 1 }],
  roomKeys: ['pq'], pipelines: [], pipelinesAt: null, mrs: null, system: null, docker: null, sources: { desktop: true, pipelines: false, mrs: false, system: false, docker: false },
})

test('a recent snapshot from another session is used without reading Desktop again', async ($, on) => {
  const fs = buildFs()
  fs.set(`${DATA}/snap.json`, { text: snapOf(NOW - 2000, 'Shared session'), mtimeMs: NOW - 2000 })
  const w = world(on, { fs })
  const pane = await openPane($, 'terminal')
  expect(await statusOf(pane)).toContain('1 session · ')
  expect(w.reads.some((p) => p.startsWith(DESK))).toBe(false)
  expect(w.writes.has(`${DATA}/snap.json`)).toBe(false)
})

test('a recent snapshot written in another language is computed again', async ($, on) => {
  const fs = buildFs()
  fs.set(`${DATA}/snap.json`, { text: snapOf(NOW - 2000, 'Shared session', 'es'), mtimeMs: NOW - 2000 })
  const w = world(on, { fs })
  const pane = await openPane($, 'terminal')
  expect(await statusOf(pane)).toContain('19 sessions')
  expect(w.reads.some((p) => p.startsWith(DESK))).toBe(true)
  expect(JSON.parse(w.writes.get(`${DATA}/snap.json`)!).lang).toBe('en')
})

test('when another session is computing, it waits for that snapshot instead of repeating the work', async ($, on) => {
  const fs = buildFs()
  fs.set(`${DATA}/snap.json`, { text: snapOf(NOW - 60000, 'A bit old'), mtimeMs: NOW - 60000 })
  fs.set(`${DATA}/claim.json`, { text: JSON.stringify({ by: 'other', until: NOW + 10000 }), mtimeMs: NOW })
  const w = world(on, { fs })
  const pane = await openPane($, 'terminal')
  expect(await statusOf(pane)).toContain('1 session · ')
  expect(w.reads.some((p) => p.startsWith(DESK))).toBe(false)
})

test('with an expired claim it computes the snapshot, shares it and refreshes it on the clock', SLOW, async ($, on) => {
  const fs = buildFs()
  fs.set(`${DATA}/snap.json`, { text: snapOf(NOW - 60000, 'A bit old'), mtimeMs: NOW - 60000 })
  fs.set(`${DATA}/claim.json`, { text: JSON.stringify({ by: 'other', until: NOW - 1000 }), mtimeMs: NOW - 21000 })
  const w = world(on, { fs })
  const pane = await openPane($, 'terminal')
  expect(await statusOf(pane)).toContain('19 sessions')
  const snap = JSON.parse(w.writes.get(`${DATA}/snap.json`)!)
  expect(snap.v).toBe(2)
  expect(snap.lang).toBe('en')
  expect(JSON.parse(w.writes.get(`${DATA}/claim.json`)!)).toEqual({ by: cli(99), until: NOW + 30000 })
  const before = w.reads.filter((p) => p.startsWith(DESK)).length
  await w.clock.advance(31000)
  expect(w.reads.filter((p) => p.startsWith(DESK)).length).toBeGreaterThanOrEqual(before)
  expect(JSON.parse(w.writes.get(`${DATA}/snap.json`)!).at).toBeGreaterThan(snap.at)
})

test('if another session overwrites the claim right after it is written, the snapshot is not computed twice', async ($, on) => {
  const fs = buildFs()
  fs.set(`${DATA}/snap.json`, { text: snapOf(NOW - 60000, 'A bit old'), mtimeMs: NOW - 60000 })
  fs.set(`${DATA}/claim.json`, { text: JSON.stringify({ by: 'other', until: NOW - 1000 }), mtimeMs: NOW - 31000 })
  const set = fs.set.bind(fs)
  Object.defineProperty(fs, 'set', { value: (path: string, f: { text: string, mtimeMs: number }) => set(path, path === `${DATA}/claim.json` ? { text: JSON.stringify({ by: 'other', until: NOW + 30000 }), mtimeMs: NOW } : f) })
  const w = world(on, { fs })
  const pane = await openPane($, 'terminal')
  expect(await statusOf(pane)).toContain('1 session · ')
  expect(w.reads.some((p) => p.startsWith(DESK))).toBe(false)
  expect(w.writes.has(`${DATA}/snap.json`)).toBe(false)
})

const AI = '{"groups":[{"name":"ACME SUITE","folders":[1,2]},{"name":"ZETA","folders":[4]},{"name":"HOME","folders":[0]},{"name":"OLD","folders":[3]}]}'

test('the AI puts acme and acme-docs together and is asked only once', async ($, on) => {
  const w = world(on, { ai: AI })
  const pane = await openPane($, 'terminal')
  await w.clock.settle()
  expect(await statusOf(pane)).toContain('3 rooms grouped by AI')
  const names = await roomNames(pane)
  expect(names).toContain('ACME SUITE')
  expect(names).not.toContain('ACME-DOCS')
  await w.clock.advance(25000)
  expect(w.ai.calls).toBe(1)
})

test('an invalid AI answer keeps the heuristic grouping', async ($, on) => {
  const w = world(on, { ai: "sorry, I can't do that" })
  const pane = await openPane($, 'terminal')
  await w.clock.settle()
  expect(await statusOf(pane)).toMatch(/4 rooms$/)
  expect(w.ai.calls).toBe(1)
})

test('with cached groups for the same folders the AI is not asked', async ($, on) => {
  const cwds = [HOME, `${HOME}/projects/acme`, `${HOME}/projects/acme-docs`, `${HOME}/projects/old`, `${HOME}/projects/zeta`]
  const key = groupsKey(cwds.map((cwd) => ({ cwd })))
  const groups = [{ name: 'ALL ACME', members: cwds.slice(1, 3), ai: true }, { name: 'ZETA', members: [cwds[4]], ai: false }, { name: 'HOME', members: [HOME], ai: false }, { name: 'OLD', members: [cwds[3]], ai: false }]
  const w = world(on, { ai: AI, store: { groups: { key, groups, ai: true, at: NOW - MIN } } })
  const pane = await openPane($, 'desktop')
  await w.clock.settle()
  expect(w.ai.calls).toBe(0)
  expect((await uiProps(pane)).rooms.map((r: any) => r.n)).toContain('ALL ACME')
})

test('with AI grouping off the model is never called', { options: { ai_grouping: false } }, async ($, on) => {
  const w = world(on, { ai: AI })
  const pane = await openPane($, 'terminal')
  await w.clock.settle()
  expect(w.ai.calls).toBe(0)
  expect(await statusOf(pane)).toMatch(/4 rooms$/)
})

test('an AI failure is not kept as groups and is retried after half an hour', SLOW, async ($, on) => {
  const w = world(on, { ai: null })
  const pane = await openPane($, 'terminal')
  await w.clock.settle()
  expect(w.ai.calls).toBe(1)
  await w.clock.advance(10 * MIN)
  expect(w.ai.calls).toBe(1)
  w.ai.answer = AI
  await w.clock.advance(21 * MIN)
  expect(w.ai.calls).toBe(2)
  await w.clock.settle()
  expect(await statusOf(pane)).toContain('grouped by AI')
})

const CWDS = [HOME, `${HOME}/projects/acme`, `${HOME}/projects/acme-docs`, `${HOME}/projects/old`, `${HOME}/projects/zeta`]
const KEY = groupsKey(CWDS.map((cwd) => ({ cwd })))

test('if another session is already asking the AI about the same folders, it is not asked again', SLOW, async ($, on) => {
  const w = world(on, { ai: AI, store: { aiPending: { key: KEY, at: NOW - 10000, by: 'other' } } })
  await openPane($, 'terminal')
  await w.clock.settle()
  expect(w.ai.calls).toBe(0)
  await w.clock.advance(2 * MIN)
  await w.clock.settle()
  expect(w.ai.calls).toBe(1)
})

test('an AI failure in another session also waits half an hour', SLOW, async ($, on) => {
  const w = world(on, { ai: AI, store: { aiFail: { key: KEY, at: NOW - 10 * MIN, reason: 'api-error' } } })
  await openPane($, 'terminal')
  await w.clock.settle()
  expect(w.ai.calls).toBe(0)
  await w.clock.advance(21 * MIN)
  expect(w.ai.calls).toBe(1)
})

test('an old cache without a valid AI answer does not stop the question', async ($, on) => {
  const cwds = [HOME, `${HOME}/projects/acme`, `${HOME}/projects/acme-docs`, `${HOME}/projects/old`, `${HOME}/projects/zeta`]
  const key = groupsKey(cwds.map((cwd) => ({ cwd })))
  const w = world(on, { ai: AI, store: { groups: { key, groups: cwds.map((c) => ({ name: c, members: [c], ai: false })), ai: false, at: NOW - MIN } } })
  await openPane($, 'terminal')
  await w.clock.settle()
  expect(w.ai.calls).toBe(1)
})
