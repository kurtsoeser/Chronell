import type {
  OneNoteNotebook,
  OneNoteOpenedHint,
  OneNoteRecentTarget,
  OneNoteSection
} from './types/onenote'

/** Abschnitt, den Chronell anlegt, wenn das Notizbuch noch keinen hat. */
export const ONENOTE_MAIL_SECTION_NAME = 'Chronell'

export type OneNoteKindFilter = 'alle' | 'notebooks' | 'sections'
export type OneNoteGroupMode = 'used' | 'modified' | 'opened' | 'notebook'

export interface OneNotePickerRow {
  key: string
  targetKind: 'notebook' | 'section'
  title: string
  notebookId: string
  notebookName: string
  sectionId: string | null
  sectionName: string | null
  sectionGroupName: string | null
  modifiedAt: string | null
  openedAt: string | null
  usedAt: string | null
  isDefaultNotebook: boolean
  isShared: boolean
}

export interface OneNotePickerGroup {
  key: string
  labelKey:
    | 'used'
    | 'rest'
    | 'opened'
    | 'today'
    | 'week'
    | 'older'
    | 'none'
    | 'notebooks'
    | 'notebook'
  /** Anzeigename bei `labelKey === 'notebook'`. */
  label: string
  order: number
  items: OneNotePickerRow[]
}

const PREFERRED_SECTION_NAMES = ['schnellnotizen', 'quick notes', 'unfiled notes', 'notizen']

function norm(value: string): string {
  return value.trim().toLocaleLowerCase('de')
}

function timeMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function latestIso(values: Array<string | null | undefined>): string | null {
  let best: number | null = null
  let bestIso: string | null = null
  for (const value of values) {
    const t = timeMs(value)
    if (t == null) continue
    if (best == null || t > best) {
      best = t
      bestIso = value || null
    }
  }
  return bestIso
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function preferredSection(
  notebookId: string,
  sections: OneNoteSection[],
  recent: OneNoteRecentTarget[]
): OneNoteSection | null {
  const own = sections.filter((section) => section.notebookId === notebookId)
  if (own.length === 0) return null

  const recentIds = recent
    .filter((entry) => entry.notebookId === notebookId)
    .sort((a, b) => (timeMs(b.usedAt) ?? 0) - (timeMs(a.usedAt) ?? 0))
  for (const entry of recentIds) {
    const hit = own.find((section) => section.id === entry.sectionId)
    if (hit) return hit
  }

  const named = own.find((section) =>
    PREFERRED_SECTION_NAMES.includes(norm(section.displayName))
  )
  if (named) return named

  return [...own].sort((a, b) => {
    const ta = timeMs(a.lastModifiedDateTime)
    const tb = timeMs(b.lastModifiedDateTime)
    if (ta != null && tb != null && ta !== tb) return tb - ta
    if (ta != null && tb == null) return -1
    if (ta == null && tb != null) return 1
    return a.displayName.localeCompare(b.displayName, 'de')
  })[0] ?? null
}

function soleSectionMatch(sections: OneNoteSection[], query: string): OneNoteSection | null {
  const q = norm(query)
  if (!q) return null
  const hits = sections.filter(
    (section) =>
      norm(section.displayName).includes(q) || norm(section.sectionGroupName || '').includes(q)
  )
  return hits.length === 1 ? hits[0] : null
}

function matchesQuery(query: string, parts: Array<string | null | undefined>): boolean {
  const q = norm(query)
  if (!q) return true
  return parts.some((part) => norm(part || '').includes(q))
}

function sectionRow(
  section: OneNoteSection,
  notebook: OneNoteNotebook | undefined,
  recent: OneNoteRecentTarget[],
  openedAt: string | null
): OneNotePickerRow {
  const usedAt = latestIso(
    recent.filter((entry) => entry.sectionId === section.id).map((entry) => entry.usedAt)
  )
  return {
    key: `section:${section.id}`,
    targetKind: 'section',
    title: section.displayName,
    notebookId: section.notebookId,
    notebookName: section.notebookName,
    sectionId: section.id,
    sectionName: section.displayName,
    sectionGroupName: section.sectionGroupName,
    modifiedAt: section.lastModifiedDateTime,
    openedAt,
    usedAt,
    isDefaultNotebook: notebook?.isDefault === true,
    isShared: notebook?.isShared === true
  }
}

function notebookRow(
  notebook: OneNoteNotebook,
  sections: OneNoteSection[],
  recent: OneNoteRecentTarget[],
  openedAt: string | null
): OneNotePickerRow {
  const preferred = preferredSection(notebook.id, sections, recent)
  const usedAt = latestIso(
    recent.filter((entry) => entry.notebookId === notebook.id).map((entry) => entry.usedAt)
  )
  return {
    key: `notebook:${notebook.id}`,
    targetKind: 'notebook',
    title: notebook.displayName,
    notebookId: notebook.id,
    notebookName: notebook.displayName,
    sectionId: preferred?.id ?? null,
    sectionName: preferred?.displayName ?? null,
    sectionGroupName: preferred?.sectionGroupName ?? null,
    modifiedAt: notebook.lastModifiedDateTime,
    openedAt,
    usedAt,
    isDefaultNotebook: notebook.isDefault,
    isShared: notebook.isShared
  }
}

export function buildOneNotePickerRows(input: {
  notebooks: OneNoteNotebook[]
  sections: OneNoteSection[]
  recent: OneNoteRecentTarget[]
  opened: OneNoteOpenedHint[]
  query: string
  kind: OneNoteKindFilter
}): OneNotePickerRow[] {
  const byNotebook = new Map(input.notebooks.map((notebook) => [notebook.id, notebook]))
  const openedByNotebook = new Map<string, string>()
  for (const hint of input.opened) {
    if (!openedByNotebook.has(hint.notebookId)) {
      openedByNotebook.set(hint.notebookId, hint.accessedAt)
    }
  }

  const query = input.query.trim()
  const wantNotebooks = input.kind === 'alle' || input.kind === 'notebooks'
  const wantSections = input.kind === 'sections' || (input.kind === 'alle' && query.length > 0)

  const rows: OneNotePickerRow[] = []

  if (wantNotebooks) {
    for (const notebook of input.notebooks) {
      const ownSections = input.sections.filter((section) => section.notebookId === notebook.id)
      const hit = matchesQuery(query, [
        notebook.displayName,
        ...ownSections.flatMap((section) => [section.displayName, section.sectionGroupName])
      ])
      if (!hit) continue
      const row = notebookRow(
        notebook,
        input.sections,
        input.recent,
        openedByNotebook.get(notebook.id) ?? null
      )
      const sole = soleSectionMatch(ownSections, query)
      rows.push(
        sole
          ? {
              ...row,
              sectionId: sole.id,
              sectionName: sole.displayName,
              sectionGroupName: sole.sectionGroupName
            }
          : row
      )
    }
  }

  if (wantSections) {
    for (const section of input.sections) {
      const notebook = byNotebook.get(section.notebookId)
      const hit = matchesQuery(query, [
        section.displayName,
        section.notebookName,
        section.sectionGroupName,
        notebook?.displayName
      ])
      if (!hit) continue
      rows.push(
        sectionRow(
          section,
          notebook,
          input.recent,
          openedByNotebook.get(section.notebookId) ?? null
        )
      )
    }
  }

  return rows
}

function compareTitle(a: OneNotePickerRow, b: OneNotePickerRow): number {
  return a.title.localeCompare(b.title, 'de')
}

function compareTimeDesc(
  a: string | null,
  b: string | null,
  titleA: string,
  titleB: string
): number {
  const ta = timeMs(a)
  const tb = timeMs(b)
  if (ta != null && tb != null && ta !== tb) return tb - ta
  if (ta != null && tb == null) return -1
  if (ta == null && tb != null) return 1
  return titleA.localeCompare(titleB, 'de')
}

function modifiedBucket(
  iso: string | null,
  now: Date
): { key: string; labelKey: OneNotePickerGroup['labelKey']; order: number } {
  const t = timeMs(iso)
  if (t == null) return { key: 'none', labelKey: 'none', order: 3 }
  const start = startOfLocalDay(now).getTime()
  const week = start - 6 * 24 * 60 * 60 * 1000
  if (t >= start) return { key: 'today', labelKey: 'today', order: 0 }
  if (t >= week) return { key: 'week', labelKey: 'week', order: 1 }
  return { key: 'older', labelKey: 'older', order: 2 }
}

export function groupOneNotePickerRows(
  rows: OneNotePickerRow[],
  mode: OneNoteGroupMode,
  now: Date = new Date()
): OneNotePickerGroup[] {
  const map = new Map<string, OneNotePickerGroup>()

  const put = (
    key: string,
    labelKey: OneNotePickerGroup['labelKey'],
    label: string,
    order: number,
    row: OneNotePickerRow
  ): void => {
    const existing = map.get(key)
    if (existing) {
      existing.items.push(row)
      return
    }
    map.set(key, { key, labelKey, label, order, items: [row] })
  }

  for (const row of rows) {
    if (mode === 'used') {
      if (row.usedAt) put('used', 'used', '', 0, row)
      else put('rest', 'rest', '', 1, row)
      continue
    }
    if (mode === 'opened') {
      if (row.openedAt) put('opened', 'opened', '', 0, row)
      else put('rest', 'rest', '', 1, row)
      continue
    }
    if (mode === 'notebook') {
      if (row.targetKind === 'section') {
        put(`notebook:${row.notebookId}`, 'notebook', row.notebookName, 0, row)
      } else {
        put('notebooks', 'notebooks', '', 0, row)
      }
      continue
    }
    const bucket = modifiedBucket(row.modifiedAt, now)
    put(bucket.key, bucket.labelKey, '', bucket.order, row)
  }

  const groups = [...map.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.label.localeCompare(b.label, 'de') || a.key.localeCompare(b.key, 'de')
  })

  for (const group of groups) {
    group.items.sort((a, b) => {
      if (mode === 'used' && group.key === 'used') {
        return compareTimeDesc(a.usedAt, b.usedAt, a.title, b.title)
      }
      if (mode === 'opened' && group.key === 'opened') {
        return compareTimeDesc(a.openedAt, b.openedAt, a.title, b.title)
      }
      if (mode === 'notebook') return compareTitle(a, b)
      return compareTimeDesc(a.modifiedAt, b.modifiedAt, a.title, b.title)
    })
  }

  return groups
}
