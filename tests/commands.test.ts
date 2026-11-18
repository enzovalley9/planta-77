import { expect, test } from 'claude-code/testing'
import { world, openStage, runCommand, uiProps, uiTexts, twin, click, arrive, settle, drawnLayers, drawnBy, labelsDrawn, offCamera, opened, urlOf, sid, DATA, SECRET, PANE_PROPS } from './fixture'
import type { Entry } from './fixture'

const FLIGHT = { timeoutMs: 20000 }
const roomId = (ui: any, name: string) => ui.rooms.find((r: any) => r.n === name).id
const snapOf = (w: any) => JSON.parse(w.writes.get(`${DATA}/snap.json`)!)
test('/cameras shows the security wall, and a camera leads to its room on the floor', FLIGHT, async ($, on) => {
  const w = world(on)
  const pane = await openStage($, 'cameras')
  const ui = await uiProps(pane), t = twin(ui)
  expect(ui.mode).toBe('cameras')
  expect(ui.wheel).toBeNull()
  expect(Object.keys(ui.cams).sort()).toEqual(['docker', 'dockerN', 'mrs', 'pipes', 'radar', 'sys', 'traces'])
  expect(ui.cams.traces.map((x: any) => [x.id, x.tool, x.t])).toEqual([[sid(1), 'Bash', '21:59'], [sid(3), 'Question', '21:57'], [sid(1), 'Read', '21:56']])
  expect(JSON.stringify(ui)).not.toContain(SECRET)
  expect(await pane.find({ key: 'wheel-top' })).toBeUndefined()
  expect(await pane.find({ key: 'wheel-bottom' })).toBeUndefined()
  const texts = (await uiTexts(pane)).join('|')
  for (const text of ['CAM-01|ACME', 'CAM-02|ZETA', 'CAM-09|CRYO', 'NO ACTIVITY', 'LIVE TRACES', '21:59|Migrate the payments API|Bash', 'PIPELINES|3 open MRs, 2 yours', '✖|acme-api|payments', 'SYSTEM', 'CPU|42.5 %', 'RAM|8/16 GB', 'DOCKER 2: acme-postgres-1 · acme-redis-1', 'OFFICE|?']) expect(texts).toContain(text)
  expect(texts).not.toContain('⌂')
  const tiles = t.G.hud.filter((r: any) => r.act === 'cam').map((r: any) => r.room)
  expect(tiles).toEqual(ui.rooms.map((r: any) => r.id))
  const zeta = roomId(ui, 'ZETA'), tile = t.hud(`cam:${zeta}`)!
  const spot = [1, 2, 3, 4].map((dx) => ({ x: tile.x + tile.w - dx, y: tile.y + 1 })).find((c) => t.hudAt(c.x, c.y).id === tile.id)!
  expect(await uiTexts(pane)).not.toContain('click: go to the room')
  await pane.pointer({ type: 'move', x: spot.x, y: spot.y, in: 'ui' })
  expect(await uiTexts(pane)).toContain('click: go to the room')
  await click(pane, spot)
  const office = await uiProps(pane)
  expect(office.mode).toBe('office')
  expect(office.cmd).toMatchObject({ kind: 'room', id: zeta })
  expect('cams' in office).toBe(false)
  expect((await pane.find({ key: 'wheel-top' }))!.props.height).toBe(1)
  expect(opened(w)).toEqual([])
  await arrive(pane, 560)
  expect(await offCamera(pane, twin(office).room(zeta))).toEqual([])
})

test('in the cameras a trace row or someone on a screen opens their session, and the keys and the OFFICE button go back', async ($, on) => {
  const w = world(on)
  const pane = await openStage($, 'cameras')
  const ui = await uiProps(pane), t = twin(ui)
  const row = t.hud('tr:1')!, mark = t.hud(`s:${sid(2)}`)!
  expect(row.sid).toBe(sid(3))
  await click(pane, { x: row.x + 5, y: row.y })
  expect(opened(w)).toEqual([urlOf(3)])
  await pane.pointer({ type: 'move', x: mark.x, y: mark.y, in: 'ui' })
  const card = await uiTexts(pane)
  expect(card).toContain('Delete old build artifacts')
  expect(card).toContain('click: open the session')
  await click(pane, { x: mark.x, y: mark.y })
  expect(opened(w)).toEqual([urlOf(3), urlOf(2)])
  await pane.pointer({ type: 'down', x: row.x + 5, y: row.y, button: 'left', in: 'ui' })
  await pane.pointer({ type: 'up', x: row.x + 5, y: row.y + 1, button: 'left', in: 'ui' })
  expect(opened(w)).toHaveLength(2)
  await pane.key({ key: '4', in: 'ui' })
  expect(await uiProps(pane)).toMatchObject({ mode: 'office', cmd: { kind: 'room', id: ui.rooms[3].id } })
  for (const back of ['c', '0', 'home']) {
    await runCommand($, 'cameras')
    expect((await uiProps(pane)).mode).toBe('cameras')
    await pane.key({ key: back, in: 'ui' })
    expect((await uiProps(pane)).mode).toBe('office')
  }
  await runCommand($, 'cameras')
  const mode = twin(await uiProps(pane)).hud('mode')!
  expect(mode.mode).toBe('office')
  await click(pane, { x: mode.cx, y: mode.cy })
  expect((await uiProps(pane)).mode).toBe('office')
  const toCameras = twin(await uiProps(pane)).hud('mode')!
  expect(toCameras.mode).toBe('cameras')
  await click(pane, { x: toCameras.cx, y: toCameras.cy })
  expect((await uiProps(pane)).mode).toBe('cameras')
  expect(opened(w)).toHaveLength(2)
})

test('in the cameras the stage asks for the per-room layers and the screens draw the layers of their rooms, and nothing else', async ($, on) => {
  world(on)
  const pane = await openStage($, 'cameras')
  await settle(pane)
  const ui = await uiProps(pane), man = ui.man as Entry[], t = twin(ui)
  expect(ui).toMatchObject({ mode: 'cameras', lod: 2 })
  const screens = t.G.hud.filter((r: any) => r.act === 'cam').map((r: any) => r.room)
  expect(screens).toEqual(ui.rooms.map((r: any) => r.id))
  const drawn = await drawnLayers(pane)
  expect(drawn.map((d) => d.id)).toEqual(man.filter((m) => m.room && screens.includes(m.room)).map((m) => m.id))
  expect(drawn.length).toBe(screens.length * 2)
  expect(man.filter((m) => !m.room).map((m) => m.id)).toEqual(expect.arrayContaining(['sky', 'slab', 'lab0']))
  expect(await drawnBy(pane, 'ui')).toEqual([])
  expect(JSON.stringify(drawn)).not.toContain(SECRET)
  await pane.key({ key: 'c', in: 'ui' })
  await settle(pane)
  const office = await uiProps(pane)
  expect(office).toMatchObject({ mode: 'office', lod: 1 })
  expect((await drawnLayers(pane)).map((d) => d.id)).toEqual(office.man.map((m: Entry) => m.id))
})

test('the container prefix option shortens the names in the cameras', { options: { container_prefix: 'acme-' } }, async ($, on) => {
  world(on)
  const pane = await openStage($, 'cameras')
  expect((await uiProps(pane)).cams.docker).toEqual(['postgres-1', 'redis-1'])
  expect(await uiTexts(pane)).toContain('DOCKER 2: postgres-1 · redis-1')
})

test('/office takes the room words in English and in Spanish, and project names', FLIGHT, async ($, on) => {
  world(on)
  const pane = await openStage($)
  const ui = await uiProps(pane)
  let seq = 0
  for (const [word, room] of [['servers', 'server'], ['servidores', 'server'], ['SERVER', 'server'], ['security', 'cctv'], ['seguridad', 'cctv'], ['cryo', 'cryo'], ['criogenia', 'cryo'], ['bunker', 'bunker'], ['búnker', 'bunker'], ['ramen', 'ramen'],
    ['zeta', roomId(ui, 'ZETA')], ['acme', roomId(ui, 'ACME')], ['Acme-Docs', roomId(ui, 'ACME-DOCS')], ['docs', roomId(ui, 'ACME-DOCS')]]) {
    await runCommand($, 'office', word)
    const cmd = (await uiProps(pane)).cmd
    expect(cmd, word).toMatchObject({ kind: 'room', id: room, fresh: true })
    expect(cmd.seq).toBeGreaterThan(seq)
    seq = cmd.seq
  }
  await arrive(pane, 560)
  expect(await offCamera(pane, twin(ui).room(roomId(ui, 'ACME-DOCS')))).toEqual([])
  await runCommand($, 'office', 'no such room')
  await runCommand($, 'office')
  expect((await uiProps(pane)).cmd.seq).toBe(seq)
  expect((await uiProps(pane)).mode).toBe('office')
})

test('/office with a room as the first command opens the pane already flying to that room', FLIGHT, async ($, on) => {
  world(on)
  const pane = await openStage($, 'office', 'ramen')
  const ui = await uiProps(pane)
  expect(ui.cmd).toMatchObject({ kind: 'room', id: 'ramen', fresh: true })
  await arrive(pane, 560)
  expect(await offCamera(pane, twin(ui).room('ramen'))).toEqual([])
})

test('/office with a project name as the first command opens that room too', async ($, on) => {
  world(on)
  const pane = await openStage($, 'office', 'zeta')
  const ui = await uiProps(pane)
  expect(ui.cmd).toMatchObject({ kind: 'room', id: roomId(ui, 'ZETA') })
})

test('with language es the stage, the cameras, the labels and the terminal are in Spanish', { options: { language: 'es' } }, async ($, on) => {
  const w = world(on)
  const pane = await openStage($, 'office', 'criogenia')
  const ui = await uiProps(pane)
  expect(ui.cmd).toMatchObject({ kind: 'room', id: 'cryo' })
  expect(ui.text).toMatchObject({ live: 'EN VIVO', office: 'OFICINA', cameras: 'CÁMARAS', open: 'clic: abrir la sesión', helpTitle: 'CONTROLES', state: { work: 'TRABAJANDO', perm: 'PIDE PERMISO' }, stat: { wait: 'te esperan' }, cam: { traces: 'TRAZAS EN VIVO' } })
  expect(ui.rooms.map((r: any) => r.n)).toEqual(expect.arrayContaining(['SERVIDORES', 'BÚNKER', 'SEGURIDAD', 'CRIOGENIA']))
  expect(snapOf(w).lang).toBe('es')
  const texts = (await uiTexts(pane)).join('|')
  expect(texts).toContain('EN VIVO|● 1|trabajando|● 4|te esperan')
  expect(texts).toContain('CÁMARAS')
  await arrive(pane, 560)
  await settle(pane)
  expect((await uiProps(pane)).bucket).toBeGreaterThanOrEqual(3)
  const labels = await labelsDrawn(pane)
  expect(labels).toContain('Te pide permiso')
  expect(labels).toContain('TRABAJANDO')
  expect(labels).not.toContain('Asks for permission')
  await pane.key({ key: 'c', in: 'ui' })
  const cams = (await uiTexts(pane)).join('|')
  expect(cams).toContain('TRAZAS EN VIVO')
  expect(cams).toContain('3 MR abiertos, 2 tuyos')
  expect(cams).toContain('OFICINA')
  const term = await $.ui.mount({ plugin: 'planta-77', component: 'Pane', surface: 'terminal', requestId: 'planta-77', viewport: { columns: 200, rows: 70 }, props: PANE_PROPS } as any)
  expect((await term.find({ type: 'Text', text: /sesiones · / }))!.text).toContain('4 te esperan')
  expect((await term.find({ type: 'Text', text: /en mesa ·/ }))!.text).toContain('ACME')
})
