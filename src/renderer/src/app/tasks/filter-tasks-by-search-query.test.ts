import { describe, expect, it } from 'vitest'
import { filterTasksBySearchQuery } from '@/app/tasks/filter-tasks-by-search-query'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'

function cloud(partial: Partial<CloudTaskListItem> & Pick<CloudTaskListItem, 'id' | 'title'>): CloudTaskListItem {
  return {
    source: 'cloud',
    accountId: 'a1',
    listId: 'l1',
    listName: 'Liste',
    dueIso: null,
    completed: false,
    notes: null,
    iconId: null,
    iconColor: null,
    ...partial
  }
}

describe('filterTasksBySearchQuery', () => {
  const items = [
    cloud({ id: '1', title: 'Rechnung prüfen', notes: 'Kunde Alpha' }),
    cloud({ id: '2', title: 'Meeting', notes: null }),
    cloud({ id: '3', title: 'Andere', notes: 'rechnung folgen' })
  ]

  it('gibt unveraendert zurueck bei kurzer Query', () => {
    expect(filterTasksBySearchQuery(items, 'r')).toEqual(items)
    expect(filterTasksBySearchQuery(items, '  ')).toEqual(items)
  })

  it('filtert Titel und Notizen (Token-AND)', () => {
    expect(filterTasksBySearchQuery(items, 'rechnung').map((i) => i.id)).toEqual(['1', '3'])
    expect(filterTasksBySearchQuery(items, 'rechnung alpha').map((i) => i.id)).toEqual(['1'])
    expect(filterTasksBySearchQuery(items, 'meeting')).toHaveLength(1)
  })
})
