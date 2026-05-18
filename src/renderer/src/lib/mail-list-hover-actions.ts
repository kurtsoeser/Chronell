import type { MailQuickStep } from '@shared/types'

/** Eingebaute Aktionen in der Maillisten-Zeile (Mouse-over-Leiste). */
export type MailListHoverBuiltinActionId =
  | 'reply'
  | 'flag'
  | 'archive'
  | 'delete'
  | 'popout'
  | 'forward'
  | 'snooze'
  | 'markRead'
  | 'markUnread'
  | 'todo'

export type MailListHoverActionId =
  | MailListHoverBuiltinActionId
  | `quickstep:${number}`

export const MAIL_LIST_HOVER_BUILTIN_ACTION_IDS: MailListHoverBuiltinActionId[] = [
  'reply',
  'flag',
  'archive',
  'delete',
  'popout',
  'forward',
  'snooze',
  'markRead',
  'markUnread',
  'todo'
]

/** Sichtbare Standard-Aktionen: ToDo Heute, Erledigt, Antworten, Loeschen. */
export const DEFAULT_MAIL_LIST_HOVER_ACTION_ORDER: MailListHoverActionId[] = [
  'quickstep:2',
  'quickstep:1',
  'reply',
  'delete'
]

const DEFAULT_MAIL_LIST_HOVER_HIDDEN_BUILTIN: MailListHoverBuiltinActionId[] = [
  'flag',
  'archive',
  'popout',
  'forward',
  'snooze',
  'markRead',
  'markUnread',
  'todo'
]

const ORDER_STORAGE_KEY = 'mailclient.mailList.hoverActions.order.v2'
const HIDDEN_STORAGE_KEY = 'mailclient.mailList.hoverActions.hidden.v2'

export const MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT = 'mailclient:mail-list-hover-actions-changed'

export interface MailListHoverActionPrefs {
  order: MailListHoverActionId[]
  hidden: Set<MailListHoverActionId>
}

export function mailListHoverQuickStepId(quickStepId: number): MailListHoverActionId {
  return `quickstep:${quickStepId}`
}

export function parseMailListHoverActionId(raw: string): MailListHoverActionId | null {
  const s = raw.trim()
  if ((MAIL_LIST_HOVER_BUILTIN_ACTION_IDS as string[]).includes(s)) {
    return s as MailListHoverBuiltinActionId
  }
  if (s.startsWith('quickstep:')) {
    const id = Number.parseInt(s.slice('quickstep:'.length), 10)
    if (Number.isFinite(id) && id > 0) return mailListHoverQuickStepId(id)
  }
  return null
}

function buildDefaultHiddenSet(quickSteps: MailQuickStep[]): Set<MailListHoverActionId> {
  const hidden = new Set<MailListHoverActionId>(DEFAULT_MAIL_LIST_HOVER_HIDDEN_BUILTIN)
  for (const q of quickSteps) {
    if (q.id !== 1 && q.id !== 2) {
      hidden.add(mailListHoverQuickStepId(q.id))
    }
  }
  return hidden
}

export function reconcileMailListHoverActionOrder(
  order: MailListHoverActionId[],
  quickSteps: MailQuickStep[]
): MailListHoverActionId[] {
  const valid = new Set<MailListHoverActionId>([
    ...MAIL_LIST_HOVER_BUILTIN_ACTION_IDS,
    ...quickSteps.map((q) => mailListHoverQuickStepId(q.id))
  ])
  const seen = new Set<MailListHoverActionId>()
  const next: MailListHoverActionId[] = []
  for (const id of order) {
    if (!valid.has(id) || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  for (const id of DEFAULT_MAIL_LIST_HOVER_ACTION_ORDER) {
    if (!seen.has(id) && valid.has(id)) {
      seen.add(id)
      next.push(id)
    }
  }
  for (const id of MAIL_LIST_HOVER_BUILTIN_ACTION_IDS) {
    if (!seen.has(id)) {
      seen.add(id)
      next.push(id)
    }
  }
  for (const q of quickSteps) {
    const id = mailListHoverQuickStepId(q.id)
    if (!seen.has(id)) {
      seen.add(id)
      next.push(id)
    }
  }
  return next
}

function readStoredOrder(): MailListHoverActionId[] | null {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const ids: MailListHoverActionId[] = []
    for (const item of parsed) {
      if (typeof item !== 'string') continue
      const id = parseMailListHoverActionId(item)
      if (id) ids.push(id)
    }
    return ids.length > 0 ? ids : null
  } catch {
    return null
  }
}

function readStoredHidden(): Set<MailListHoverActionId> | null {
  try {
    const raw = window.localStorage.getItem(HIDDEN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const hidden = new Set<MailListHoverActionId>()
    for (const item of parsed) {
      if (typeof item !== 'string') continue
      const id = parseMailListHoverActionId(item)
      if (id) hidden.add(id)
    }
    return hidden
  } catch {
    return null
  }
}

export function readMailListHoverActionPrefs(quickSteps: MailQuickStep[] = []): MailListHoverActionPrefs {
  const hasStored = readStoredOrder() != null || readStoredHidden() != null
  const order = reconcileMailListHoverActionOrder(
    readStoredOrder() ?? [...DEFAULT_MAIL_LIST_HOVER_ACTION_ORDER],
    quickSteps
  )
  const hidden = hasStored
    ? (readStoredHidden() ?? new Set())
    : buildDefaultHiddenSet(quickSteps)
  return { order, hidden }
}

export function getVisibleMailListHoverActions(
  prefs: MailListHoverActionPrefs
): MailListHoverActionId[] {
  return prefs.order.filter((id) => !prefs.hidden.has(id))
}

export function applyMailListHoverActionPrefs(
  order: MailListHoverActionId[],
  hidden: Set<MailListHoverActionId>,
  quickSteps: MailQuickStep[] = []
): void {
  const reconciled = reconcileMailListHoverActionOrder(order, quickSteps)
  const hiddenArr = [...hidden].filter((id) => reconciled.includes(id))
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(reconciled))
    window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hiddenArr))
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT))
}

export function resetMailListHoverActionPrefs(quickSteps: MailQuickStep[] = []): void {
  applyMailListHoverActionPrefs(
    [...DEFAULT_MAIL_LIST_HOVER_ACTION_ORDER],
    buildDefaultHiddenSet(quickSteps),
    quickSteps
  )
}
