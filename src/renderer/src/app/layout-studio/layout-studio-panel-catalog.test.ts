import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { buildLayoutStudioPanelGroups } from './layout-studio-panel-catalog'

const t = ((key: string): string => {
  const map: Record<string, string> = {
    'layoutStudio.panels.none': '— leer —',
    'layoutStudio.panels.mailList': 'Mail-Liste',
    'layoutStudio.panels.agenda': 'Kalender-Agenda',
    'layoutStudio.panels.reading': 'Mail-Vorschau',
    'layoutStudio.panelCategory.mail': 'E-Mail',
    'layoutStudio.panelCategory.calendar': 'Kalender',
    'layoutStudio.panelCategory.general': 'Allgemein'
  }
  if (map[key]) return map[key]
  if (key.startsWith('layoutStudio.panelCategory.')) {
    return key.slice('layoutStudio.panelCategory.'.length)
  }
  if (key.startsWith('layoutStudio.panels.')) {
    return key.slice('layoutStudio.panels.'.length)
  }
  if (key.startsWith('dashboard.tiles.')) return key
  return key
}) as TFunction

describe('buildLayoutStudioPanelGroups', () => {
  it('sortiert Einträge innerhalb einer Kategorie alphabetisch', () => {
    const mail = buildLayoutStudioPanelGroups(t, 'de').find((g) => g.category === 'mail')
    expect(mail).toBeDefined()
    const labels = mail!.items.map((i) => i.label)
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'de'))
    expect(labels).toEqual(sorted)
  })

  it('blendet Kalender-Duplikate im Picker aus', () => {
    const calendar = buildLayoutStudioPanelGroups(t, 'de').find((g) => g.category === 'calendar')
    const ids = calendar?.items.map((i) => i.id) ?? []
    expect(ids).not.toContain('calendarMain')
    expect(ids).not.toContain('tile:week')
    expect(ids).not.toContain('tile:month')
    expect(ids).not.toContain('tile:today_timeline')
  })

  it('enthält „leer“ in Allgemein', () => {
    const general = buildLayoutStudioPanelGroups(t, 'de').find((g) => g.category === 'general')
    expect(general?.items.some((i) => i.id === 'none')).toBe(true)
  })
})
