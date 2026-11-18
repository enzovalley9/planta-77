import { expect, test } from 'claude-code/testing'
import { world, openStage, buildFs, bigSpecs, uiProps, twin, click, arrive, settle, swapped, isLoading, drawnLayers, pageKeys, PANE_PROPS, SECRET, ROWS } from './fixture'
import type { Entry } from './fixture'

const MAX_TREE = 100000, PAGE_MAX = 88000
const size = (v: unknown) => JSON.stringify(v).length
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)

async function fits(pane: any, where: string) {
  const drawn = await drawnLayers(pane), keys = [...(await pageKeys(pane)), 'ui']
  for (const key of keys) {
    expect(size(await pane.drawn({ in: key })), `${where}: tree of ${key}`).toBeLessThan(MAX_TREE)
    const here = drawn.filter((d) => d.at === key).map((d) => d.src.length)
    if (here.length > 1) expect(sum(here), `${where}: sources in ${key}`).toBeLessThanOrEqual(PAGE_MAX)
  }
  const used = keys.slice(0, -1).map((key) => drawn.some((d) => d.at === key))
  expect(used, `${where}: pages in use`).toEqual([...used].sort().reverse())
  return drawn
}

async function steady(pane: any) {
  await settle(pane)
  if ((await uiProps(pane)).lod === 2) await settle(pane)
}

test('with 320 sessions every page and the HUD instance stay under the size of one message while they draw every layer in view, at every width, zoom and detail level', { timeoutMs: 90000 }, async ($, on) => {
  world(on, { fs: buildFs(bigSpecs()) })
  const pane = await openStage($)
  const seen = new Set<number>()
  let held = 0, zoomed = 0
  for (const [cols, zooms] of [[60, [0]], [110, [2, 2]], [200, [0, 2]]] as const) {
    if (zoomed) {
      const zoomOut = twin(await uiProps(pane)).hud('out')!
      for (let i = 0; i < zoomed + 2; i++) await click(pane, { x: zoomOut.cx, y: zoomOut.cy })
      await arrive(pane, 260)
      zoomed = 0
    }
    await pane.redraw({ ...PANE_PROPS, bodyColumns: cols } as any)
    await pane.resize({ columns: cols, rows: ROWS, in: 'ui' })
    await settle(pane)
    await fits(pane, `${cols} while the old sources leave`)
    const t = twin(await uiProps(pane), cols, ROWS), zoomIn = t.hud('in')!
    let cam = t.home()
    for (const clicks of zooms) {
      if (clicks) {
        for (let i = 0; i < clicks; i++) await click(pane, { x: zoomIn.cx, y: zoomIn.cy })
        await arrive(pane, 260)
        await steady(pane)
        cam = t.zoom(cam, cols / 2, ROWS / 2, 1.6 ** clicks)
        zoomed += clicks
      } else await swapped(pane)
      const ui = await uiProps(pane), px = cam.s * 7.8, where = `${cols} at ${px.toFixed(2)} px, detail ${ui.lod}, zoom ${ui.bucket}`
      expect(await isLoading(pane), where).toBe(false)
      const drawn = await fits(pane, where)
      expect(drawn.map((d) => d.id), where).toEqual(ui.man.filter((m: Entry) => t.sees(cam, m.box)).map((m: Entry) => m.id))
      expect(drawn.every((d) => d.src.endsWith('</svg>') && !d.src.includes(SECRET))).toBe(true)
      expect(ui.lod, where).toBeLessThanOrEqual(px < 0.45 ? 0 : px < 0.85 ? 1 : 2)
      if (px > 1.1 && ui.lod === 1) held++
      seen.add(ui.lod)
    }
  }
  expect([...seen].sort()).toEqual([0, 1, 2])
  expect(held).toBeGreaterThan(0)
})
