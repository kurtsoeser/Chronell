import { describe, expect, it } from 'vitest'
import {
  buildOneNotePickerRows,
  groupOneNotePickerRows,
  preferredSection
} from './onenote-catalog'
import type { OneNoteNotebook, OneNoteSection } from './types/onenote'

const notebooks: OneNoteNotebook[] = [
  {
    id: 'nb-schule',
    displayName: 'Schule',
    lastModifiedDateTime: '2026-11-25T08:00:00.000Z',
    createdDateTime: null,
    isDefault: true,
    isShared: false,
    clientUrl: null,
    webUrl: null
  },
  {
    id: 'nb-privat',
    displayName: 'Privat',
    lastModifiedDateTime: '2026-10-01T08:00:00.000Z',
    createdDateTime: null,
    isDefault: false,
    isShared: false,
    clientUrl: null,
    webUrl: null
  }
]

const sections: OneNoteSection[] = [
  {
    id: 'sec-quick',
    displayName: 'Schnellnotizen',
    notebookId: 'nb-schule',
    notebookName: 'Schule',
    sectionGroupName: null,
    lastModifiedDateTime: '2026-11-01T08:00:00.000Z',
    createdDateTime: null
  },
  {
    id: 'sec-mathe',
    displayName: 'Mathematik',
    notebookId: 'nb-schule',
    notebookName: 'Schule',
    sectionGroupName: 'Unterricht',
    lastModifiedDateTime: '2026-11-20T08:00:00.000Z',
    createdDateTime: null
  },
  {
    id: 'sec-privat',
    displayName: 'Ideen',
    notebookId: 'nb-privat',
    notebookName: 'Privat',
    sectionGroupName: null,
    lastModifiedDateTime: '2026-10-01T08:00:00.000Z',
    createdDateTime: null
  }
]

describe('preferredSection', () => {
  it('nimmt den zuletzt verwendeten Abschnitt vor Schnellnotizen', () => {
    const picked = preferredSection('nb-schule', sections, [
      {
        notebookId: 'nb-schule',
        sectionId: 'sec-mathe',
        notebookName: 'Schule',
        sectionName: 'Mathematik',
        usedAt: '2026-11-24T10:00:00.000Z'
      }
    ])
    expect(picked?.id).toBe('sec-mathe')
  })

  it('fällt auf Schnellnotizen zurück', () => {
    expect(preferredSection('nb-schule', sections, [])?.id).toBe('sec-quick')
  })
})

describe('buildOneNotePickerRows', () => {
  it('hängt bei eindeutiger Suche den passenden Abschnitt an das Notizbuch', () => {
    const rows = buildOneNotePickerRows({
      notebooks,
      sections,
      recent: [],
      opened: [],
      query: 'mathe',
      kind: 'notebooks'
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.notebookId).toBe('nb-schule')
    expect(rows[0]?.sectionId).toBe('sec-mathe')
  })

  it('findet einen Abschnitt über die Suche', () => {
    const rows = buildOneNotePickerRows({
      notebooks,
      sections,
      recent: [],
      opened: [],
      query: 'mathe',
      kind: 'alle'
    })
    expect(rows.some((row) => row.sectionId === 'sec-mathe')).toBe(true)
    expect(rows.some((row) => row.notebookId === 'nb-privat')).toBe(false)
  })

  it('listet ohne Suche die Notizbücher', () => {
    const rows = buildOneNotePickerRows({
      notebooks,
      sections,
      recent: [],
      opened: [],
      query: '',
      kind: 'alle'
    })
    expect(rows.map((row) => row.targetKind)).toEqual(['notebook', 'notebook'])
    expect(rows[0]?.sectionId).toBe('sec-quick')
  })
})

describe('groupOneNotePickerRows', () => {
  it('legt heute geänderte Notizbücher nach oben', () => {
    const now = new Date(2026, 10, 25, 15, 0, 0)
    const rows = buildOneNotePickerRows({
      notebooks: [
        {
          ...notebooks[0],
          lastModifiedDateTime: new Date(2026, 10, 25, 9, 0, 0).toISOString()
        },
        {
          ...notebooks[1],
          lastModifiedDateTime: new Date(2026, 9, 1, 9, 0, 0).toISOString()
        }
      ],
      sections,
      recent: [],
      opened: [],
      query: '',
      kind: 'notebooks'
    })
    const groups = groupOneNotePickerRows(rows, 'modified', now)
    expect(groups.map((group) => group.labelKey)).toEqual(['today', 'older'])
    expect(groups[0]?.items[0]?.notebookId).toBe('nb-schule')
  })

  it('hebt zuletzt verwendete Ziele hervor', () => {
    const rows = buildOneNotePickerRows({
      notebooks,
      sections,
      recent: [
        {
          notebookId: 'nb-privat',
          sectionId: 'sec-privat',
          notebookName: 'Privat',
          sectionName: 'Ideen',
          usedAt: '2026-11-24T10:00:00.000Z'
        }
      ],
      opened: [],
      query: '',
      kind: 'notebooks'
    })
    const groups = groupOneNotePickerRows(rows, 'used', new Date(2026, 10, 25, 15, 0, 0))
    expect(groups[0]?.labelKey).toBe('used')
    expect(groups[0]?.items.map((row) => row.notebookId)).toEqual(['nb-privat'])
  })
})
