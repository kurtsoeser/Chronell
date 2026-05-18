export const MAIL_LIST_TABLE_BREAKPOINT_PX = 540

export const MAIL_LIST_TABLE_COLUMNS_STORAGE_KEY = 'mailclient.mailListTableColumns.v1'

export type MailListTableColumnId =
  | 'from'
  | 'to'
  | 'subject'
  | 'preview'
  | 'received'
  | 'sent'
  | 'categories'
  | 'importance'
  | 'attachments'
  | 'todoDue'
  | 'todoBucket'
  | 'waiting'
  | 'snoozed'
  | 'account'
  | 'read'

/** Alle konfigurierbaren Spalten (Reihenfolge im Einstellungsdialog). */
export const MAIL_LIST_TABLE_COLUMN_CATALOG: MailListTableColumnId[] = [
  'from',
  'to',
  'subject',
  'preview',
  'received',
  'sent',
  'categories',
  'importance',
  'attachments',
  'todoDue',
  'todoBucket',
  'waiting',
  'snoozed',
  'account',
  'read'
]

export const DEFAULT_MAIL_LIST_TABLE_COLUMNS: MailListTableColumnId[] = [
  'from',
  'subject',
  'received'
]

const COLUMN_SET = new Set<MailListTableColumnId>(MAIL_LIST_TABLE_COLUMN_CATALOG)

function isColumnId(v: unknown): v is MailListTableColumnId {
  return typeof v === 'string' && COLUMN_SET.has(v as MailListTableColumnId)
}

function coerceColumns(raw: unknown): MailListTableColumnId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_MAIL_LIST_TABLE_COLUMNS]
  const out: MailListTableColumnId[] = []
  for (const item of raw) {
    if (isColumnId(item) && !out.includes(item)) out.push(item)
  }
  return out.length > 0 ? out : [...DEFAULT_MAIL_LIST_TABLE_COLUMNS]
}

export function readMailListTableColumns(): MailListTableColumnId[] {
  try {
    const raw = window.localStorage.getItem(MAIL_LIST_TABLE_COLUMNS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_MAIL_LIST_TABLE_COLUMNS]
    const parsed = JSON.parse(raw) as { v?: number; columns?: unknown }
    if (parsed.v !== 1) return [...DEFAULT_MAIL_LIST_TABLE_COLUMNS]
    return coerceColumns(parsed.columns)
  } catch {
    return [...DEFAULT_MAIL_LIST_TABLE_COLUMNS]
  }
}

function sortColumnsByCatalog(columns: MailListTableColumnId[]): MailListTableColumnId[] {
  return [...columns].sort(
    (a, b) => MAIL_LIST_TABLE_COLUMN_CATALOG.indexOf(a) - MAIL_LIST_TABLE_COLUMN_CATALOG.indexOf(b)
  )
}

export function persistMailListTableColumns(columns: MailListTableColumnId[]): void {
  const cleaned = sortColumnsByCatalog(coerceColumns(columns))
  try {
    window.localStorage.setItem(
      MAIL_LIST_TABLE_COLUMNS_STORAGE_KEY,
      JSON.stringify({ v: 1, columns: cleaned })
    )
  } catch {
    // ignore
  }
}

const COLUMN_GRID_MIN: Record<MailListTableColumnId, string> = {
  from: 'minmax(108px, 1.15fr)',
  to: 'minmax(96px, 1fr)',
  subject: 'minmax(140px, 2fr)',
  preview: 'minmax(120px, 1.4fr)',
  received: 'minmax(68px, 0.55fr)',
  sent: 'minmax(68px, 0.55fr)',
  categories: 'minmax(88px, 0.9fr)',
  importance: 'minmax(72px, 0.5fr)',
  attachments: 'minmax(44px, 0.35fr)',
  todoDue: 'minmax(88px, 0.75fr)',
  todoBucket: 'minmax(96px, 0.8fr)',
  waiting: 'minmax(88px, 0.75fr)',
  snoozed: 'minmax(88px, 0.75fr)',
  account: 'minmax(88px, 0.85fr)',
  read: 'minmax(52px, 0.4fr)'
}

/** CSS grid-template-columns fuer Kopfzeile und Datenzeilen (ohne Expand-/Aktions-Spalten). */
export function buildMailListTableGridTemplate(columns: MailListTableColumnId[]): string {
  const parts = columns.map((c) => COLUMN_GRID_MIN[c] ?? 'minmax(80px, 1fr)')
  return parts.join(' ')
}

export function moveMailListTableColumn(
  columns: MailListTableColumnId[],
  id: MailListTableColumnId,
  direction: 'up' | 'down'
): MailListTableColumnId[] {
  const idx = columns.indexOf(id)
  if (idx < 0) return columns
  const swap = direction === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= columns.length) return columns
  const next = [...columns]
  ;[next[idx], next[swap]] = [next[swap], next[idx]]
  return next
}

export function toggleMailListTableColumn(
  columns: MailListTableColumnId[],
  id: MailListTableColumnId,
  enabled: boolean
): MailListTableColumnId[] {
  if (enabled) {
    if (columns.includes(id)) return columns
    const catalogIdx = MAIL_LIST_TABLE_COLUMN_CATALOG.indexOf(id)
    const next = [...columns, id]
    next.sort(
      (a, b) =>
        MAIL_LIST_TABLE_COLUMN_CATALOG.indexOf(a) - MAIL_LIST_TABLE_COLUMN_CATALOG.indexOf(b)
    )
    void catalogIdx
    return next
  }
  const filtered = columns.filter((c) => c !== id)
  return filtered.length > 0 ? filtered : [...DEFAULT_MAIL_LIST_TABLE_COLUMNS]
}
