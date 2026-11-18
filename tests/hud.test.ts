import { expect, test } from 'claude-code/testing'
import { bucketOf } from '../hooks/lib/office.mjs'
import { world, openStage, uiProps, uiTexts, twin, click, arrive, settle, isLoading, drawnLayers, offCamera, opened, urlOf, sid, PANE_PROPS, COLS, ROWS } from './fixture'
import type { Entry } from './fixture'

const FLIGHT = { timeoutMs: 20000 }
const pairs = (man: Entry[]) => man.map((m) => [m.id, m.rev])
const WHEEL = { component: 'Pane', requestId: 'planta-77', offset: 0, by: -1, bodyRows: ROWS, contentRows: ROWS + 2, origin: { kind: 'person' }, pointer: { column: 30, row: 20 } }

test('the drawn buttons zoom in and out, the minimap moves the camera, home goes back to the whole floor and ? shows the help', FLIGHT, async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane), t = twin(ui)
  const home = t.home(), mid = [COLS / 2, ROWS / 2] as const
  const press = (id: string) => { const b = t.hud(id)!; return click(pane, { x: b.cx, y: b.cy }) }
  expect((await uiTexts(pane)).join('|')).toContain('CAMERAS|?|+|−|⌂')
  await press('in')
  await press('in')
  await arrive(pane, 260)
  const near = t.zoom(home, ...mid, 1.6 * 1.6)
  expect(await offCamera(pane, near)).toEqual([])
  expect(await offCamera(pane, t.zoom(home, ...mid, 1.6))).not.toEqual([])
  const map = t.hud('map')!
  const camAt = (at: { x: number, y: number }) => t.pan({ ...near, cx: ui.mb[0] + ((at.x + 0.5 - map.map.x) / map.map.w) * ui.mb[2], cy: ui.mb[1] + (((at.y + 0.5) * ui.rho - map.map.y) / map.map.h) * ui.mb[3] }, 0, 0)
  const at = [[0.85, 0.5], [0.8, 0.2], [0.5, 0.15], [0.2, 0.8]].map(([fx, fy]) => ({ x: map.x + Math.floor(map.w * fx), y: map.y + Math.floor(map.h * fy) }))
    .find((c) => Math.abs(camAt(c).cx - near.cx) * near.s > 8 && ui.sessions.some((s: any) => t.session(camAt(c), s.id)))!
  await pane.pointer({ type: 'down', x: at.x, y: at.y, button: 'left', in: 'ui' })
  await pane.pointer({ type: 'up', x: at.x, y: at.y, button: 'left', in: 'ui' })
  await pane.advance(16 * 60)
  const moved = camAt(at)
  expect(await offCamera(pane, moved)).toEqual([])
  expect(await offCamera(pane, near)).not.toEqual([])
  await press('out')
  await arrive(pane, 260)
  expect(await offCamera(pane, t.zoom(moved, ...mid, 1 / 1.6))).toEqual([])
  await press('home')
  await arrive(pane, 480)
  expect(await offCamera(pane, home)).toEqual([])
  await press('help')
  const help = await uiTexts(pane)
  expect(help).toContain('CONTROLS')
  expect(help).toContain('zoom at the pointer')
  expect(help).toContain('security cameras')
  await press('help')
  expect(await uiTexts(pane)).not.toContain('CONTROLS')
  expect(opened(w)).toEqual([])
})

test('on a short pane the queue shows how many more are waiting and that line walks through them', async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  await pane.resize({ columns: 70, rows: 16, in: 'ui' })
  const ui = await uiProps(pane), t = twin(ui, 70, 16)
  expect(t.G.hud.map((r: any) => r.id)).toEqual(['mode', 'help', 'in', 'out', 'home', `q:${sid(2)}`, `q:${sid(3)}`, 'more'])
  expect(await uiTexts(pane)).toContain('+2 more waiting')
  const more = t.hud('more')!
  for (const n of [2, 3, 4]) {
    await click(pane, { x: more.cx, y: more.cy })
    await pane.key({ key: 'return', in: 'ui' })
    expect(opened(w).at(-1)).toBe(urlOf(n))
  }
})

test('the wheel zooms one step per notch at the pointer, both ways, and the pane never scrolls away', FLIGHT, async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane), t = twin(ui)
  const home = t.home(), ptr = { x: WHEEL.pointer.column, y: WHEEL.pointer.row }
  expect(ui.wheel).toEqual({ seq: 0, dir: 0 })
  await $.ui.scroll(WHEEL as any)
  expect((await uiProps(pane)).wheel).toEqual({ seq: 1, dir: 1, ...ptr })
  await $.ui.scroll({ ...WHEEL, by: -3 } as any)
  expect((await uiProps(pane)).wheel.seq).toBe(1)
  await w.clock.advance(120)
  await $.ui.scroll({ ...WHEEL, by: -2 } as any)
  expect((await uiProps(pane)).wheel).toEqual({ seq: 2, dir: 1, ...ptr })
  await arrive(pane, 160)
  const near = t.zoom(home, ptr.x + 0.5, ptr.y + 0.5, 1.3 * 1.3)
  expect(await offCamera(pane, near)).toEqual([])
  expect(await offCamera(pane, t.zoom(home, COLS / 2, ROWS / 2, 1.3 * 1.3))).not.toEqual([])
  const other = { column: 82.7, row: 41.2 }
  await $.ui.scroll({ ...WHEEL, by: 1, offset: 2, pointer: other } as any)
  expect((await uiProps(pane)).wheel).toEqual({ seq: 3, dir: -1, x: 82, y: 41 })
  await arrive(pane, 160)
  expect(await offCamera(pane, t.zoom(near, 82.5, 41.5, 1 / 1.3))).toEqual([])
  expect(w.scrolls.map((e) => e.offset)).toEqual([1, 1, 1, 1])
  await w.clock.advance(500)
  const { pointer, ...keys } = WHEEL
  for (const e of [keys, { ...WHEEL, by: 0 }, { ...WHEEL, by: 40 }, { ...WHEEL, requestId: 'other', offset: 7 }, { ...WHEEL, origin: { kind: 'plugin', name: 'x' }, offset: 5 }]) await $.ui.scroll(e as any)
  expect(w.scrolls.slice(4).map((e) => e.offset)).toEqual([1, 1, 1, 7, 5])
  expect((await uiProps(pane)).wheel.seq).toBe(3)
  expect((await pane.find({ key: 'wheel-top' }))!.props.height).toBe(1)
  expect((await pane.find({ key: 'wheel-bottom' }))!.props.height).toBe(1)
})

test('with the wheel zoom off there is no gap around the stage and the wheel is left alone', { options: { wheel_zoom: false } }, async ($, on) => {
  const w = world(on)
  const pane = await openStage($)
  expect(await pane.find({ key: 'wheel-top' })).toBeUndefined()
  expect(await pane.find({ key: 'wheel-bottom' })).toBeUndefined()
  expect((await uiProps(pane)).wheel).toBeNull()
  await $.ui.scroll({ ...WHEEL, offset: 4 } as any)
  expect(w.scrolls.map((e) => e.offset)).toEqual([4])
  expect((await uiProps(pane)).wheel).toBeNull()
  expect((await pane.find({ key: 'stage' }))!.props.height).toBe(ROWS)
})

test('when the camera settles on another zoom it asks for the labels of that zoom', FLIGHT, async ($, on) => {
  world(on)
  const pane = await openStage($)
  const before = await uiProps(pane), t = twin(before)
  expect(before.bucket).toBe(0)
  expect(before.lt.every((l: any) => l.kind === 'room')).toBe(true)
  const zoomIn = t.hud('in')!
  for (let i = 0; i < 3; i++) await click(pane, { x: zoomIn.cx, y: zoomIn.cy })
  await arrive(pane, 260)
  await arrive(pane, 120)
  const near = t.zoom(t.home(), COLS / 2, ROWS / 2, 1.6 ** 3), after = await uiProps(pane)
  expect(after.bucket).toBe(bucketOf(near.s * 7.8))
  expect(after.bucket).toBeGreaterThan(2)
  expect(pairs(after.man.filter((m: Entry) => m.lab))).not.toEqual(pairs(before.man.filter((m: Entry) => m.lab)))
  expect(after.lt.some((l: any) => l.kind === 'session')).toBe(true)
  expect(await offCamera(pane, near)).toEqual([])
  await pane.redraw({ ...PANE_PROPS } as any)
  expect((await uiProps(pane)).bucket).toBe(after.bucket)
})

test('zooming in far enough makes the stage ask for the per-room layers and draw the ones in view, and zooming back out for the packed floor', FLIGHT, async ($, on) => {
  world(on)
  const pane = await openStage($)
  await settle(pane)
  const far = await uiProps(pane), t = twin(far)
  const packed = (ui: any) => ui.man.filter((m: Entry) => !m.lab).every((m: Entry) => /^[wx][01]-\d+$/.test(m.id) && !m.box)
  expect(far.lod).toBe(1)
  expect(packed(far)).toBe(true)
  expect((await drawnLayers(pane)).map((d) => d.id)).toEqual(far.man.map((m: Entry) => m.id))
  const zoomIn = t.hud('in')!, home = t.hud('home')!
  for (let i = 0; i < 3; i++) await click(pane, { x: zoomIn.cx, y: zoomIn.cy })
  await arrive(pane, 260)
  await settle(pane)
  const near = await uiProps(pane), cam = t.zoom(t.home(), COLS / 2, ROWS / 2, 1.6 ** 3)
  expect(near.lod).toBe(2)
  expect(packed(near)).toBe(false)
  expect(await isLoading(pane)).toBe(false)
  const inView = near.man.filter((m: Entry) => t.sees(cam, m.box))
  expect(inView.length).toBeLessThan(near.man.length)
  expect(inView.some((m: Entry) => m.room)).toBe(true)
  expect((await drawnLayers(pane)).map((d) => d.id)).toEqual(inView.map((m: Entry) => m.id))
  await click(pane, { x: home.cx, y: home.cy })
  await arrive(pane, 480)
  await settle(pane)
  const back = await uiProps(pane)
  expect(back.lod).toBe(1)
  expect(pairs(back.man)).toEqual(pairs(far.man))
  expect((await drawnLayers(pane)).map((d) => d.id)).toEqual(back.man.map((m: Entry) => m.id))
})
