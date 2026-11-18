import { expect, test } from 'claude-code/testing'
import { world, openStage, uiProps, uiTexts, twin, click, arrive, sleep, hoverAt, offCamera, opened, urlOf, sid, COLS, ROWS } from './fixture'

const FLIGHT = { timeoutMs: 20000 }
const roomId = (ui: any, name: string) => ui.rooms.find((r: any) => r.n === name).id

test('clicking a waiting session in the queue flies to it and its arrow opens it', FLIGHT, async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane), t = twin(ui)
  expect(ui.queue).toEqual([sid(2), sid(3), sid(4), sid(5)])
  expect((await uiTexts(pane)).join('|')).toContain('!|Delete old build artifacts|ZETA|↗|?|Pick a database|ACME|↗')
  const chip = t.hud(`q:${sid(2)}`)!
  await hoverAt(pane, { x: chip.x + 2, y: chip.y })
  await click(pane, { x: chip.x + 2, y: chip.y })
  expect(opened(w)).toEqual([])
  await arrive(pane, 520)
  expect(await offCamera(pane, t.toSession(sid(2)))).toEqual([])
  await click(pane, { x: chip.x + chip.w - 1, y: chip.y })
  expect(opened(w)).toEqual([urlOf(2)])
  const second = t.hud(`q:${sid(3)}`)!
  await click(pane, { x: second.x + second.w - 3, y: second.y })
  expect(opened(w)).toEqual([urlOf(2), urlOf(3)])
})

test('clicking a room on the whole floor flies into it, and then clicking someone opens their session', FLIGHT, async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane), t = twin(ui)
  const acme = roomId(ui, 'ACME'), home = t.home(), inside = t.room(acme)
  expect(await hoverAt(pane, t.roomCell(home, acme))).toEqual(['ACME  ·  click to enter'])
  await click(pane, t.roomCell(home, acme))
  expect(opened(w)).toEqual([])
  await arrive(pane, 520)
  expect(await offCamera(pane, inside)).toEqual([])
  const person = t.session(inside, sid(1))!
  const card = await hoverAt(pane, person)
  expect(card.slice(0, 3)).toEqual(['Migrate the payments API', 'WORKING', 'ACME · 0 min ago'])
  expect(card).toContain('click: open the session')
  expect(card.join(' ')).toContain('PRIVATE-TOKEN: ***')
  await click(pane, person)
  expect(opened(w)).toEqual([urlOf(1)])
  await pane.pointer({ type: 'leave', x: 0, y: 0, in: 'ui' })
  expect((await uiTexts(pane))[0]).toBe('PLANTA 77')
  await pane.pointer({ type: 'down', x: person.x, y: person.y, button: 'right', in: 'ui' })
  await pane.pointer({ type: 'up', x: person.x, y: person.y, button: 'right', in: 'ui' })
  expect(opened(w)).toEqual([urlOf(1)])
})

test('a click on someone from the whole floor does not open their session', async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane), t = twin(ui)
  const home = t.home(), b = ui.sessions.find((s: any) => s.id === sid(1)).b
  const cell = t.cell(home, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
  expect(home.s * 7.8).toBeLessThan(0.78)
  expect(t.pick(home, cell.x, cell.y)).toEqual({ kind: 'room', id: ui.info[sid(1)].r })
  expect(await hoverAt(pane, cell)).toEqual(['ACME  ·  click to enter'])
  await click(pane, cell)
  await pane.advance(16)
  await pane.key({ key: 'return', in: 'ui' })
  expect(opened(w)).toEqual([])
})

test('dragging moves the floor with the pointer and opens nothing', FLIGHT, async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane), t = twin(ui)
  const from = t.room(roomId(ui, 'ACME'))
  await click(pane, t.roomCell(t.home(), roomId(ui, 'ACME')))
  await arrive(pane, 520)
  await pane.pointer({ type: 'down', x: 60, y: 40, button: 'left', in: 'ui' })
  await pane.pointer({ type: 'move', x: 50, y: 34, button: 'left', in: 'ui' })
  await pane.pointer({ type: 'move', x: 40, y: 30, button: 'left', in: 'ui' })
  await pane.advance(16 * 40)
  await sleep(140)
  await pane.pointer({ type: 'up', x: 40, y: 30, button: 'left', in: 'ui' })
  await pane.advance(16 * 40)
  const to = t.pan(from, 20 / COLS, 10 / ROWS)
  expect(to.cx).toBeGreaterThan(from.cx)
  expect(to.cy).toBeGreaterThan(from.cy)
  expect(await offCamera(pane, to)).toEqual([])
  expect(await offCamera(pane, from)).not.toEqual([])
  expect(opened(w)).toEqual([])
})

test('a double click zooms in at that point and with Shift it zooms out', FLIGHT, async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane), t = twin(ui)
  const home = t.home(), at = { x: 78, y: 17 }
  await click(pane, at)
  await click(pane, at)
  await arrive(pane, 300)
  const near = t.zoom(home, at.x + 0.5, at.y + 0.5, 2.2)
  expect(near.s).toBeGreaterThan(home.s * 2)
  expect(await offCamera(pane, near)).toEqual([])
  expect(await offCamera(pane, t.zoom(home, COLS / 2, ROWS / 2, 2.2))).not.toEqual([])
  const gap = t.gap(near, [null, 'room'])!
  await click(pane, gap, { shift: true })
  await click(pane, gap, { shift: true })
  await arrive(pane, 300)
  const back = t.zoom(near, gap.x + 0.5, gap.y + 0.5, 1 / 2.2)
  expect(Math.abs(back.s - home.s)).toBeLessThan(1e-9)
  expect(await offCamera(pane, back)).toEqual([])
  expect(opened(w)).toEqual([])
})
