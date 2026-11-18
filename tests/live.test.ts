import { expect, test } from 'claude-code/testing'
import { world, openStage, uiProps, settle, labelsDrawn, cli, sid, DATA, HOME, SECRET, NOW, MIN } from './fixture'

const ME = cli(77)
const liveOf = (w: any) => { const t = w.writes.get(`${DATA}/live/${ME}.json`); return t ? JSON.parse(t) : null }

test('starting a turn marks the session as working and finishing it, as your turn', async ($, on) => {
  const w = world(on, { cli: ME })
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: 'ok' }))
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: HOME } as any)
  await $.turn.start({ text: 'hello', turnId: 't1' } as any)
  expect(liveOf(w)).toMatchObject({ state: 'work', at: NOW })
  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' } as any)
  expect(liveOf(w)).toMatchObject({ state: 'turn' })
})

test('a permission request shows as asking permission, without secrets, and goes back to working once it goes on', async ($, on) => {
  const w = world(on, { cli: ME })
  on('tool.call', () => ({ result: 'ok', text: 'ok' }))
  on('classic.PermissionRequest', () => ({}))
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: HOME } as any)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: `curl -H "PRIVATE-TOKEN: ${SECRET}" https://gitlab.example` } } as any)
  const perm = liveOf(w)
  expect(perm.state).toBe('perm')
  expect(perm.detail).toContain('Bash')
  expect(JSON.stringify(perm)).not.toContain(SECRET)
  await w.clock.advance(2 * MIN)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
  expect(liveOf(w).state).toBe('work')
})

test('AskUserQuestion puts the session in asks you while it waits for the answer', async ($, on) => {
  const w = world(on, { cli: ME })
  const during: string[] = []
  on('tool.call', () => { during.push(liveOf(w)?.state); return { result: { answers: { q: 'Postgres' } }, text: 'Postgres' } })
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: HOME } as any)
  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Postgres or MySQL?', header: 'DB', options: [{ label: 'Postgres', description: '' }, { label: 'MySQL', description: '' }], multiSelect: false }] } as any)
  expect(during).toEqual(['ask'])
  expect(liveOf(w).state).toBe('work')
})

test('the live state of another session shows in the pane', async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  expect(w.writes.has(`${DATA}/snap.json`)).toBe(true)
  const snap = JSON.parse(w.writes.get(`${DATA}/snap.json`)!)
  const stateOf = (title: string) => snap.sessions.find((s: any) => s.title === title)?.state
  expect(stateOf('Delete old build artifacts')).toBe('perm')
  expect(stateOf('Pick a database')).toBe('ask')
  expect(stateOf('Migrate the payments API')).toBe('work')
  const ui = await uiProps(pane)
  expect(ui.info[sid(2)]).toMatchObject({ s: 'perm', d: 'Bash › rm -rf build' })
  expect(ui.info[sid(3)]).toMatchObject({ s: 'ask', d: 'Postgres or MySQL?' })
  expect(ui.info[sid(1)].s).toBe('work')
  expect(ui.queue.slice(0, 2)).toEqual([sid(2), sid(3)])
  await settle(pane)
  await pane.post({ kind: 'view', bucket: 3 }, { in: 'ui' })
  await settle(pane, 0)
  const labels = await labelsDrawn(pane)
  expect(labels).toContain('Asks for permission')
  expect(labels).toContain('Has a question')
  expect(labels).not.toContain(SECRET)
})
