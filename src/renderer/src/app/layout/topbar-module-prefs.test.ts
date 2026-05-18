// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_TOPBAR_HIDDEN_MODULES,
  readTopbarModuleHiddenSet,
  persistTopbarModuleHiddenSet,
  readVisibleTopbarModuleOrder,
  resolveVisibleAppShellMode,
  reorderVisibleTopbarModules
} from './topbar-module-prefs'
import { DEFAULT_TOPBAR_MODULE_ORDER } from './topbar-module-order'

describe('topbar-module-prefs', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('blendet „Alle Arbeit“ standardmäßig aus', () => {
    const hidden = readTopbarModuleHiddenSet()
    expect(hidden.has('work')).toBe(true)
    expect(DEFAULT_TOPBAR_HIDDEN_MODULES).toContain('work')
  })

  it('readVisibleTopbarModuleOrder filtert ausgeblendete Module', () => {
    persistTopbarModuleHiddenSet(new Set(['work', 'chat']))
    const visible = readVisibleTopbarModuleOrder()
    expect(visible).not.toContain('work')
    expect(visible).not.toContain('chat')
    expect(visible.length).toBe(DEFAULT_TOPBAR_MODULE_ORDER.length - 2)
  })

  it('resolveVisibleAppShellMode nutzt Alternativen', () => {
    persistTopbarModuleHiddenSet(new Set(['work']))
    expect(resolveVisibleAppShellMode('work', ['tasks', 'calendar'])).toBe('tasks')
  })

  it('reorderVisibleTopbarModules ändert nur sichtbare Positionen', () => {
    persistTopbarModuleHiddenSet(new Set(['work']))
    const full = [...DEFAULT_TOPBAR_MODULE_ORDER]
    const next = reorderVisibleTopbarModules(full, new Set(['work']), 'calendar', 'mail')
    const visible = readVisibleTopbarModuleOrder(next, new Set(['work']))
    expect(visible.indexOf('calendar')).toBeLessThan(visible.indexOf('mail'))
    expect(next.filter((id) => id === 'work')).toEqual(['work'])
  })
})
