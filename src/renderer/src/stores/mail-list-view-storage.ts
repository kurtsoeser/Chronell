import type { MailListArrangeBy, MailListChronoOrder } from '@/lib/mail-list-arrange'
import type { MailFilter, MailListKind } from '@/stores/mail-store-types'
import type { TodoDueKindList } from '@shared/types'

const STORAGE_KEY = 'mailclient.mailListViewPrefs.v1'

export interface MailListViewPrefsV1 {
  arrange: MailListArrangeBy
  chrono: MailListChronoOrder
  filter: MailFilter
}

type MailListViewPrefsStoreV1 = {
  v: 1
  byScope: Record<string, MailListViewPrefsV1>
}

export interface MailListViewScopeInput {
  listKind: MailListKind
  todoDueKind: TodoDueKindList | null
  selectedFolderAccountId: string | null
  selectedFolderId: number | null
  selectedMetaFolderId: number | null
}

const DEFAULT_PREFS: MailListViewPrefsV1 = {
  arrange: 'date_conversations',
  chrono: 'newest_on_top',
  filter: 'all'
}

const ARRANGE_VALUES = new Set<MailListArrangeBy>([
  'date_conversations',
  'from',
  'to',
  'categories',
  'read_status',
  'importance',
  'flag_start',
  'flag_due',
  'subject',
  'attachments',
  'account',
  'message_type',
  'size_preview',
  'todo_bucket'
])

const CHRONO_VALUES = new Set<MailListChronoOrder>(['newest_on_top', 'oldest_on_top'])

const FILTER_VALUES = new Set<MailFilter>(['all', 'unread', 'flagged', 'with_todo'])

function coerceArrange(v: unknown, fallback: MailListArrangeBy): MailListArrangeBy {
  return typeof v === 'string' && ARRANGE_VALUES.has(v as MailListArrangeBy)
    ? (v as MailListArrangeBy)
    : fallback
}

function coerceChrono(v: unknown, fallback: MailListChronoOrder): MailListChronoOrder {
  return typeof v === 'string' && CHRONO_VALUES.has(v as MailListChronoOrder)
    ? (v as MailListChronoOrder)
    : fallback
}

function coerceFilter(v: unknown, fallback: MailFilter): MailFilter {
  return typeof v === 'string' && FILTER_VALUES.has(v as MailFilter) ? (v as MailFilter) : fallback
}

/** Stabiler Schluessel pro Mail-Ansicht (Ordner, Schnellzugriff, Meta-Ordner). */
export function mailListViewScopeKey(input: MailListViewScopeInput): string | null {
  switch (input.listKind) {
    case 'folder': {
      if (!input.selectedFolderAccountId || input.selectedFolderId == null) return null
      return `folder:${input.selectedFolderAccountId}:${input.selectedFolderId}`
    }
    case 'unified_inbox':
      return 'unified_inbox'
    case 'meta_folder': {
      if (input.selectedMetaFolderId == null) return null
      return `meta_folder:${input.selectedMetaFolderId}`
    }
    case 'todo':
      return input.todoDueKind == null ? 'todo:all' : `todo:${input.todoDueKind}`
    case 'snoozed':
      return 'snoozed'
    case 'waiting':
      return 'waiting'
    case 'search':
      return 'search'
    default:
      return null
  }
}

export function defaultMailListViewPrefs(input: MailListViewScopeInput): MailListViewPrefsV1 {
  if (input.listKind === 'todo' && input.todoDueKind == null) {
    return { arrange: 'todo_bucket', chrono: 'newest_on_top', filter: 'all' }
  }
  return { ...DEFAULT_PREFS }
}

function readStore(): MailListViewPrefsStoreV1 {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { v: 1, byScope: {} }
    const parsed = JSON.parse(raw) as Partial<MailListViewPrefsStoreV1>
    if (parsed.v !== 1 || typeof parsed.byScope !== 'object' || parsed.byScope == null) {
      return { v: 1, byScope: {} }
    }
    return { v: 1, byScope: parsed.byScope as Record<string, MailListViewPrefsV1> }
  } catch {
    return { v: 1, byScope: {} }
  }
}

function writeStore(store: MailListViewPrefsStoreV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore
  }
}

export function readMailListViewPrefs(
  input: MailListViewScopeInput
): MailListViewPrefsV1 | null {
  const scopeKey = mailListViewScopeKey(input)
  if (!scopeKey) return null
  const entry = readStore().byScope[scopeKey]
  if (!entry) return null
  const defaults = defaultMailListViewPrefs(input)
  return {
    arrange: coerceArrange(entry.arrange, defaults.arrange),
    chrono: coerceChrono(entry.chrono, defaults.chrono),
    filter: coerceFilter(entry.filter, defaults.filter)
  }
}

export function resolveMailListViewPrefs(input: MailListViewScopeInput): MailListViewPrefsV1 {
  return readMailListViewPrefs(input) ?? defaultMailListViewPrefs(input)
}

export function persistMailListViewPrefs(
  input: MailListViewScopeInput,
  prefs: MailListViewPrefsV1
): void {
  const scopeKey = mailListViewScopeKey(input)
  if (!scopeKey) return
  const store = readStore()
  store.byScope[scopeKey] = {
    arrange: coerceArrange(prefs.arrange, DEFAULT_PREFS.arrange),
    chrono: coerceChrono(prefs.chrono, DEFAULT_PREFS.chrono),
    filter: coerceFilter(prefs.filter, DEFAULT_PREFS.filter)
  }
  writeStore(store)
}

export function persistMailListViewPrefsFromState(state: MailListViewScopeInput & MailListViewPrefsV1): void {
  persistMailListViewPrefs(state, {
    arrange: state.arrange,
    chrono: state.chrono,
    filter: state.filter
  })
}
