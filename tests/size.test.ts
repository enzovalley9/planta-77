import { expect, test } from 'claude-code/testing'
import { world, openStage, buildFs, bigSpecs, clients, uiProps, direct, PANE_PROPS, DATA } from './fixture'
import type { Entry } from './fixture'
import { buildScene, labelLayers, tierLayers, CLIENT_MAX, TIER_CHUNK, LABEL_BUCKETS } from '../hooks/lib/office.mjs'

const MAX_SVG = 131072, MAX_TREE = 262144, MAX_MESSAGE = 100000, SMALL_TREE = 65000, SMALL_PROPS = 60000
const WIDTHS = [60, 110, 200]
const CLIENTS = ['cal', 'ld-0', 'ld-1', 'ld-2', 'P-0', 'P-1', 'P-2', 'P-3', 'P-4', 'ui']

const size = (v: unknown) => JSON.stringify(v).length
const answer = (l: any) => ({ props: { role: 'loader', n: 2, got: { id: l.key, rev: l.rev, src: l.src, bucket: LABEL_BUCKETS - 1 } } })

test('with 320 sessions and 14 projects every room layer, every chunk of the packed floor and every label layer of every zoom fits the client limit', { timeoutMs: 90000 }, async ($, on) => {
  const w = world(on, { fs: buildFs(bigSpecs()) })
  await openStage($)
  const snap = JSON.parse(w.writes.get(`${DATA}/snap.json`)!)
  expect(snap.sessions).toHaveLength(320)
  expect(snap.projects).toHaveLength(9)
  const over: string[] = []
  for (const aspect of [0.6, 0.8, 1.4, 2.4]) {
    const scene = buildScene(snap, { hour: 22, aspect })
    expect(scene.layers.length).toBeGreaterThan(20)
    const check = (where: string, l: any, most = CLIENT_MAX) => {
      if (size(l.src) > CLIENT_MAX) over.push(`${where}/${l.key}: source ${size(l.src)}`)
      if (l.src.length > most) over.push(`${where}/${l.key}: ${l.src.length} characters`)
      if (size(answer(l)) > MAX_MESSAGE) over.push(`${where}/${l.key}: answer ${size(answer(l))}`)
      if (!l.src.startsWith('<svg') || !l.src.endsWith('</svg>')) over.push(`${where}/${l.key}: cut`)
    }
    for (const l of scene.layers) check(`${aspect}`, l)
    for (const lod of [0, 1]) {
      const tier = tierLayers(scene, snap, lod) as any[]
      expect(tier.length).toBeGreaterThan(1)
      expect(tier.length).toBeLessThan(scene.layers.length / 4)
      for (const l of tier) check(`${aspect}/detail ${lod}`, l, TIER_CHUNK)
    }
    for (let b = 0; b < LABEL_BUCKETS; b++) {
      const lab = labelLayers(scene, snap, b)
      expect(lab.layers.length).toBeGreaterThan(0)
      for (const l of lab.layers) check(`${aspect}/bucket ${b}`, l)
    }
    expect(size(scene.mini)).toBeLessThan(20000)
  }
  expect(over).toEqual([])
})

test('with 320 sessions the tree stays small at every width, zoom and detail level, with the same ten Clients and no drawing in it', { timeoutMs: 90000 }, async ($, on) => {
  world(on, { fs: buildFs(bigSpecs()) })
  const pane = await openStage($)
  const sizes: string[] = [], lists = new Set<number>()
  for (const bodyColumns of WIDTHS) {
    await pane.redraw({ ...PANE_PROPS, bodyColumns } as any)
    for (const [lod, buckets] of [[0, [1]], [1, [2]], [2, [0, 3, 5]]] as const) for (const bucket of buckets) {
      await pane.post({ kind: 'view', bucket, lod }, { in: 'ui' })
      const tree = size(await pane.drawn()), ui = await uiProps(pane), all = await clients(pane)
      sizes.push(`${bodyColumns}/${lod}/${bucket}: ${tree}`)
      expect(tree, sizes.join(', ')).toBeLessThan(SMALL_TREE)
      expect(ui).toMatchObject({ bucket, lod })
      expect(await pane.find({ type: 'Svg' })).toBeUndefined()
      expect(all.map((c) => c.key)).toEqual(CLIENTS)
      for (const c of all) expect(size(c.props.props), c.key).toBeLessThan(SMALL_PROPS)
      expect(ui.man.some((m: Entry) => m.lab)).toBe(true)
      expect(ui.man.every((m: Entry) => !('src' in m))).toBe(true)
      expect(ui.man.length).toBeGreaterThan(lod === 2 ? 20 : 2)
      expect(ui.man.length).toBeLessThan(lod === 2 ? 60 : 10)
      lists.add(ui.man.length)
    }
  }
  expect(lists.size).toBeGreaterThan(1)
})

test('with 320 sessions every answer to a loader fits one message, at every width, zoom and detail level (hooks driven directly: the kit does not show the answer to a message)', { timeoutMs: 90000 }, async () => {
  const h = await direct({}, buildFs(bigSpecs()))
  await h.run('office')
  const over: string[] = []
  let answers = 0
  for (const bodyColumns of [60, 200]) {
    const props = { ...PANE_PROPS, bodyColumns }
    for (const [lod, buckets] of bodyColumns === 60 ? [[0, [0]], [1, [2]]] as const : [[1, [3]], [2, [0, 1, 2, 3, 4, 5]]] as const) for (const bucket of buckets) {
      await h.post({ kind: 'view', bucket, lod })
      const ui = await h.ui(props)
      expect(ui).toMatchObject({ bucket, lod })
      expect(Object.keys(ui.info).length).toBeGreaterThan(80)
      for (const m of (ui.man as Entry[]).filter((m) => m.lab || bucket === buckets[0])) {
        const where = `${bodyColumns}/${lod}/${bucket}/${m.id}`, reply = await h.post({ kind: 'need', n: 1, id: m.id, rev: m.rev }, 'ld-1'), got = reply.props.got
        answers++
        expect(got, where).toMatchObject({ id: m.id, rev: m.rev })
        if (size(reply) > MAX_MESSAGE) over.push(`${where}: answer ${size(reply)}`)
        if (size(got.src) > CLIENT_MAX) over.push(`${where}: source ${size(got.src)}`)
        if (!got.src.startsWith('<svg') || !got.src.endsWith('</svg>')) over.push(`${where}: cut`)
      }
    }
  }
  expect(answers).toBeGreaterThan(60)
  expect(over).toEqual([])
})

test('with 320 sessions the compatible mode keeps every Svg and the whole tree within the app limits', { timeoutMs: 90000, options: { compat_mode: true } }, async ($, on) => {
  world(on, { fs: buildFs(bigSpecs()) })
  const pane = await openStage($)
  for (const bodyColumns of WIDTHS) {
    await pane.redraw({ ...PANE_PROPS, bodyColumns } as any)
    const svgs = await pane.findAll({ type: 'Svg' })
    expect(svgs.length).toBeGreaterThanOrEqual(1)
    for (const svg of svgs) {
      const src = String(svg.props.source)
      expect(src.length).toBeLessThanOrEqual(MAX_SVG)
      expect(src.startsWith('<svg')).toBe(true)
      expect(src.endsWith('</svg>')).toBe(true)
    }
    expect(size(await pane.drawn())).toBeLessThan(MAX_TREE)
    expect((await clients(pane)).map((c) => c.key)).toEqual(['ui'])
    expect((await uiProps(pane)).compat).toBe(true)
  }
})
