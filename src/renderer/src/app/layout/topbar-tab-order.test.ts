import { describe, expect, it } from 'vitest'
import {
  mergeTopbarTabOrderAfterModulePrefsChange,
  parseTopbarTabCustomViewId,
  reconcileTopbarTabOrder,
  reorderVisibleTopbarTabs,
  topbarTabCustomViewId
} from '@/app/layout/topbar-tab-order'
import { DEFAULT_TOPBAR_MODULE_ORDER } from '@/app/layout/topbar-module-order'

describe('topbar-tab-order', () => {
  it('erkennt eigene Ansichten anhand des Praefix', () => {
    expect(parseTopbarTabCustomViewId('customView:abc')).toBe('abc')
    expect(parseTopbarTabCustomViewId('mail')).toBeNull()
  })

  it('reconciled fuegt fehlende Module und Ansichten an', () => {
    const order = reconcileTopbarTabOrder(
      [topbarTabCustomViewId('v1'), 'mail'],
      DEFAULT_TOPBAR_MODULE_ORDER,
      ['v1', 'v2']
    )
    expect(order[0]).toBe(topbarTabCustomViewId('v1'))
    expect(order).toContain('mail')
    expect(order).toContain(topbarTabCustomViewId('v2'))
    expect(order).toContain('home')
  })

  it('reorderVisibleTopbarTabs mischt Module und Ansichten', () => {
    const full = [
      'home',
      topbarTabCustomViewId('v1'),
      'mail',
      topbarTabCustomViewId('v2')
    ]
    const next = reorderVisibleTopbarTabs(full, new Set(), topbarTabCustomViewId('v2'), 'home')
    expect(next[0]).toBe(topbarTabCustomViewId('v2'))
    expect(next[1]).toBe('home')
    expect(next[2]).toBe(topbarTabCustomViewId('v1'))
    expect(next[3]).toBe('mail')
  })

  it('mergeTopbarTabOrderAfterModulePrefsChange behaelt Ansichtspositionen', () => {
    const prev = [
      'home',
      topbarTabCustomViewId('v1'),
      'mail',
      topbarTabCustomViewId('v2')
    ]
    const next = mergeTopbarTabOrderAfterModulePrefsChange(
      prev,
      ['mail', 'home', 'calendar'],
      ['v1', 'v2']
    )
    expect(next[0]).toBe('mail')
    expect(next[1]).toBe(topbarTabCustomViewId('v1'))
    expect(next[2]).toBe('home')
    expect(next[3]).toBe(topbarTabCustomViewId('v2'))
    expect(next).toContain('calendar')
  })
})
