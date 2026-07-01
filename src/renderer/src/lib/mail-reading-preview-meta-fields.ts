export type MailReadingPreviewMetaFieldId =
  | 'dateTime'
  | 'folder'
  | 'from'
  | 'to'
  | 'cc'
  | 'categories'
  | 'account'
  | 'flagged'
  | 'importance'

export const MAIL_READING_PREVIEW_META_FIELD_IDS: MailReadingPreviewMetaFieldId[] = [
  'dateTime',
  'folder',
  'from',
  'to',
  'cc',
  'categories',
  'account',
  'flagged',
  'importance'
]

export const DEFAULT_MAIL_READING_PREVIEW_META_FIELD_ORDER: MailReadingPreviewMetaFieldId[] = [
  ...MAIL_READING_PREVIEW_META_FIELD_IDS
]

const ORDER_STORAGE_KEY = 'mailclient.mailReading.previewMeta.order.v1'
const HIDDEN_STORAGE_KEY = 'mailclient.mailReading.previewMeta.hidden.v1'

export const MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT =
  'mailclient:mail-reading-preview-meta-fields-changed'

export interface MailReadingPreviewMetaFieldPrefs {
  order: MailReadingPreviewMetaFieldId[]
  hidden: Set<MailReadingPreviewMetaFieldId>
}

export interface MailReadingPreviewMetaFieldContext {
  dateTimeLabel: string | null
  folderLabel: string | null
  fromLabel: string
  fromAddrDetail: string | null
  toAddrs: string | null
  ccAddrs: string | null
  categories: string[]
  accountLabel: string | null
  isFlagged: boolean
  importance: string | null
}

export function parseMailReadingPreviewMetaFieldId(
  raw: string
): MailReadingPreviewMetaFieldId | null {
  const s = raw.trim()
  if ((MAIL_READING_PREVIEW_META_FIELD_IDS as string[]).includes(s)) {
    return s as MailReadingPreviewMetaFieldId
  }
  return null
}

export function reconcileMailReadingPreviewMetaFieldOrder(
  order: MailReadingPreviewMetaFieldId[]
): MailReadingPreviewMetaFieldId[] {
  const seen = new Set<MailReadingPreviewMetaFieldId>()
  const next: MailReadingPreviewMetaFieldId[] = []
  for (const id of order) {
    if (!parseMailReadingPreviewMetaFieldId(id) || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  for (const id of MAIL_READING_PREVIEW_META_FIELD_IDS) {
    if (!seen.has(id)) {
      seen.add(id)
      next.push(id)
    }
  }
  return next
}

function readStoredOrder(): MailReadingPreviewMetaFieldId[] | null {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const ids: MailReadingPreviewMetaFieldId[] = []
    for (const it of parsed) {
      if (typeof it !== 'string') continue
      const id = parseMailReadingPreviewMetaFieldId(it)
      if (id) ids.push(id)
    }
    return ids.length > 0 ? ids : null
  } catch {
    return null
  }
}

function readStoredHidden(): Set<MailReadingPreviewMetaFieldId> | null {
  try {
    const raw = window.localStorage.getItem(HIDDEN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const hidden = new Set<MailReadingPreviewMetaFieldId>()
    for (const it of parsed) {
      if (typeof it !== 'string') continue
      const id = parseMailReadingPreviewMetaFieldId(it)
      if (id) hidden.add(id)
    }
    return hidden
  } catch {
    return null
  }
}

export function readMailReadingPreviewMetaFieldPrefs(): MailReadingPreviewMetaFieldPrefs {
  const order = reconcileMailReadingPreviewMetaFieldOrder(
    readStoredOrder() ?? [...DEFAULT_MAIL_READING_PREVIEW_META_FIELD_ORDER]
  )
  const hidden = readStoredHidden() ?? new Set<MailReadingPreviewMetaFieldId>()
  return { order, hidden }
}

export function applyMailReadingPreviewMetaFieldPrefs(
  order: MailReadingPreviewMetaFieldId[],
  hidden: Set<MailReadingPreviewMetaFieldId>
): void {
  const reconciled = reconcileMailReadingPreviewMetaFieldOrder(order)
  const hiddenArr = [...hidden].filter((id) => reconciled.includes(id))
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(reconciled))
    window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hiddenArr))
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT))
}

export function resetMailReadingPreviewMetaFieldPrefs(): void {
  applyMailReadingPreviewMetaFieldPrefs(
    [...DEFAULT_MAIL_READING_PREVIEW_META_FIELD_ORDER],
    new Set()
  )
}

export function mailReadingPreviewMetaFieldHasData(
  id: MailReadingPreviewMetaFieldId,
  ctx: MailReadingPreviewMetaFieldContext
): boolean {
  switch (id) {
    case 'dateTime':
      return Boolean(ctx.dateTimeLabel?.trim())
    case 'folder':
      return Boolean(ctx.folderLabel?.trim())
    case 'from':
      return Boolean(ctx.fromLabel?.trim())
    case 'to':
      return Boolean(ctx.toAddrs?.trim())
    case 'cc':
      return Boolean(ctx.ccAddrs?.trim())
    case 'categories':
      return true
    case 'account':
      return Boolean(ctx.accountLabel?.trim())
    case 'flagged':
      return ctx.isFlagged
    case 'importance':
      return ctx.importance === 'high'
    default:
      return false
  }
}

export function getConfiguredMailReadingPreviewMetaFields(
  prefs: MailReadingPreviewMetaFieldPrefs
): MailReadingPreviewMetaFieldId[] {
  return prefs.order.filter((id) => !prefs.hidden.has(id))
}

export function getVisibleMailReadingPreviewMetaFields(
  prefs: MailReadingPreviewMetaFieldPrefs,
  ctx: MailReadingPreviewMetaFieldContext
): MailReadingPreviewMetaFieldId[] {
  return getConfiguredMailReadingPreviewMetaFields(prefs).filter((id) =>
    mailReadingPreviewMetaFieldHasData(id, ctx)
  )
}
