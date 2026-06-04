import { describe, expect, it } from 'vitest'
import { computeVisibleTopbarTabIndices } from '@/app/layout/topbar-tabs-visible'

describe('computeVisibleTopbarTabIndices', () => {
  it('zeigt alle Tabs wenn genug Platz', () => {
    const { visible, needsOverflow } = computeVisibleTopbarTabIndices(
      [80, 90, 70],
      1,
      300,
      40
    )
    expect(needsOverflow).toBe(false)
    expect(visible).toEqual(new Set([0, 1, 2]))
  })

  it('blendet entfernte Tabs aus und reserviert Overflow-Button', () => {
    const { visible, needsOverflow } = computeVisibleTopbarTabIndices(
      [80, 90, 70, 100],
      3,
      200,
      36
    )
    expect(needsOverflow).toBe(true)
    expect(visible.has(3)).toBe(true)
    expect(visible.size).toBeLessThan(4)
  })

  it('haelt aktiven Tab sichtbar', () => {
    const widths = [60, 60, 60, 120, 60]
    const { visible } = computeVisibleTopbarTabIndices(widths, 3, 150, 32)
    expect(visible.has(3)).toBe(true)
  })
})
