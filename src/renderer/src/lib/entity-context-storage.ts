import type { EntityContextTab } from '@/components/connections/entity-context-types'

const EXPANDED_PREFIX = 'mailclient.entityContext.expanded.'
const TAB_PREFIX = 'mailclient.entityContext.tab.'

export function readEntityContextExpanded(anchorKey: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(`${EXPANDED_PREFIX}${anchorKey}`)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    /* ignore */
  }
  return defaultValue
}

export function persistEntityContextExpanded(anchorKey: string, expanded: boolean): void {
  try {
    localStorage.setItem(`${EXPANDED_PREFIX}${anchorKey}`, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readEntityContextTab(anchorKey: string): EntityContextTab {
  try {
    const raw = localStorage.getItem(`${TAB_PREFIX}${anchorKey}`)
    if (raw === 'links' || raw === 'suggestions' || raw === 'quality') return raw
  } catch {
    /* ignore */
  }
  return 'links'
}

export function persistEntityContextTab(anchorKey: string, tab: EntityContextTab): void {
  try {
    localStorage.setItem(`${TAB_PREFIX}${anchorKey}`, tab)
  } catch {
    /* ignore */
  }
}
