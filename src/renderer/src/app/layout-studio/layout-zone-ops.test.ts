// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { createZoneLeaf, countZoneLeaves } from './layout-zone-model'
import { splitZoneLeaf, removeZoneLeaf, setZoneLeafPanel, swapZoneLeafPanels } from './layout-zone-ops'
import { buildZoneTemplate } from './layout-zone-templates'

describe('layout-zone-ops', () => {
  it('splitZoneLeaf erzeugt zwei Zonen', () => {
    const root = createZoneLeaf('mailList')
    const next = splitZoneLeaf(root, root.id, 'vertical')
    expect(countZoneLeaves(next)).toBe(2)
  })

  it('removeZoneLeaf reduziert Zonenanzahl', () => {
    const root = buildZoneTemplate('columns3')
    const leaves = countZoneLeaves(root)
    expect(leaves).toBe(3)
    const firstId =
      root.type === 'split'
        ? root.first.type === 'leaf'
          ? root.first.id
          : null
        : root.id
    expect(firstId).toBeTruthy()
    if (!firstId) return
    const next = removeZoneLeaf(root, firstId)
    expect(countZoneLeaves(next)).toBe(leaves - 1)
  })

  it('setZoneLeafPanel aktualisiert Panel', () => {
    const root = createZoneLeaf('none')
    const next = setZoneLeafPanel(root, root.id, 'agenda')
    expect(next.type === 'leaf' && next.panel).toBe('agenda')
  })

  it('swapZoneLeafPanels tauscht Panel-Zuweisungen', () => {
    const root = buildZoneTemplate('columns3')
    const leaves: { id: string; panel: string }[] = []
    const collect = (n: typeof root): void => {
      if (n.type === 'leaf') {
        leaves.push({ id: n.id, panel: n.panel })
        return
      }
      collect(n.first)
      collect(n.second)
    }
    collect(root)
    expect(leaves.length).toBe(3)
    const [a, b] = leaves
    const next = swapZoneLeafPanels(root, a.id, b.id)
    const after: { id: string; panel: string }[] = []
    const collectAfter = (n: typeof next): void => {
      if (n.type === 'leaf') {
        after.push({ id: n.id, panel: n.panel })
        return
      }
      collectAfter(n.first)
      collectAfter(n.second)
    }
    collectAfter(next)
    const byId = Object.fromEntries(after.map((l) => [l.id, l.panel]))
    expect(byId[a.id]).toBe(b.panel)
    expect(byId[b.id]).toBe(a.panel)
  })
})
