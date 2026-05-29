/**
 * QuickSteps: benutzerdefinierte Aktionsketten (sequentiell = UND),
 * lokal in SQLite — keine MS-Graph-Synchronisation mit Outlook-QuickSteps.
 */

import type { MailQuickStep, TodoDueKindOpen } from './types'
import type { RuleSnoozePreset } from './mail-rules'

/** Kanonische Aktions-Typen (JSON in `quicksteps.actions_json`). */
export type QuickStepActionType =
  | 'mark_read'
  | 'mark_unread'
  | 'archive'
  | 'delete'
  | 'move_to_folder'
  | 'add_todo'
  | 'mark_flagged'
  | 'clear_flagged'
  | 'add_tag'
  | 'snooze'

export type QuickStepActionCategory = 'filing' | 'status' | 'categories' | 'snooze'

export interface QuickStepActionMarkRead {
  type: 'mark_read'
}

export interface QuickStepActionMarkUnread {
  type: 'mark_unread'
}

export interface QuickStepActionArchive {
  type: 'archive'
}

export interface QuickStepActionDelete {
  type: 'delete'
}

export interface QuickStepActionMoveToFolder {
  type: 'move_to_folder'
  folderId: number
}

export interface QuickStepActionAddTodo {
  type: 'add_todo'
  dueKind: TodoDueKindOpen
}

export interface QuickStepActionMarkFlagged {
  type: 'mark_flagged'
}

export interface QuickStepActionClearFlagged {
  type: 'clear_flagged'
}

export interface QuickStepActionAddTag {
  type: 'add_tag'
  tag: string
}

export interface QuickStepActionSnooze {
  type: 'snooze'
  preset: RuleSnoozePreset
}

export type QuickStepAction =
  | QuickStepActionMarkRead
  | QuickStepActionMarkUnread
  | QuickStepActionArchive
  | QuickStepActionDelete
  | QuickStepActionMoveToFolder
  | QuickStepActionAddTodo
  | QuickStepActionMarkFlagged
  | QuickStepActionClearFlagged
  | QuickStepActionAddTag
  | QuickStepActionSnooze

export interface QuickStepActionCatalogEntry {
  type: QuickStepActionType
  category: QuickStepActionCategory
  /** Braucht Ordnerauswahl in der UI. */
  needsFolder?: boolean
  /** Braucht ToDo-Bucket-Auswahl. */
  needsTodoDueKind?: boolean
  /** Braucht Freitext (Tag). */
  needsTag?: boolean
  /** Braucht Snooze-Preset. */
  needsSnoozePreset?: boolean
}

export const QUICK_STEP_ACTION_CATALOG: QuickStepActionCatalogEntry[] = [
  { type: 'move_to_folder', category: 'filing', needsFolder: true },
  { type: 'archive', category: 'filing' },
  { type: 'delete', category: 'filing' },
  { type: 'mark_read', category: 'status' },
  { type: 'mark_unread', category: 'status' },
  { type: 'add_tag', category: 'categories', needsTag: true },
  { type: 'mark_flagged', category: 'categories' },
  { type: 'clear_flagged', category: 'categories' },
  { type: 'add_todo', category: 'categories', needsTodoDueKind: true },
  { type: 'snooze', category: 'snooze', needsSnoozePreset: true }
]

const OPEN_TODO_KINDS = new Set<TodoDueKindOpen>(['today', 'tomorrow', 'this_week', 'later'])

const LEGACY_TYPE_MAP: Record<string, QuickStepActionType | null> = {
  markRead: 'mark_read',
  markUnread: 'mark_unread',
  archive: 'archive',
  moveToTrash: 'delete',
  addTodo: 'add_todo',
  mark_read: 'mark_read',
  mark_unread: 'mark_unread',
  delete: 'delete',
  move_to_folder: 'move_to_folder',
  add_todo: 'add_todo',
  mark_flagged: 'mark_flagged',
  clear_flagged: 'clear_flagged',
  add_tag: 'add_tag',
  snooze: 'snooze'
}

function parseTodoDueKind(v: unknown): TodoDueKindOpen | null {
  if (typeof v !== 'string') return null
  return OPEN_TODO_KINDS.has(v as TodoDueKindOpen) ? (v as TodoDueKindOpen) : null
}

/** Einzelne Roh-Aktion aus JSON in kanonisches Format bringen (inkl. Legacy). */
export function normalizeQuickStepAction(raw: unknown): QuickStepAction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const legacyType = typeof o.type === 'string' ? o.type : ''
  const type = LEGACY_TYPE_MAP[legacyType]
  if (!type) return null

  switch (type) {
    case 'mark_read':
    case 'mark_unread':
    case 'archive':
    case 'delete':
    case 'mark_flagged':
    case 'clear_flagged':
      return { type }
    case 'move_to_folder': {
      const folderId =
        typeof o.folderId === 'number'
          ? o.folderId
          : typeof o.folder_id === 'number'
            ? o.folder_id
            : NaN
      if (!Number.isFinite(folderId) || folderId <= 0) return null
      return { type, folderId }
    }
    case 'add_todo': {
      const dueKind = parseTodoDueKind(o.dueKind ?? o.due_kind)
      if (!dueKind) return null
      return { type, dueKind }
    }
    case 'add_tag': {
      const tag = typeof o.tag === 'string' ? o.tag.trim() : ''
      if (!tag) return null
      return { type, tag }
    }
    case 'snooze': {
      const preset = o.preset
      if (typeof preset !== 'string') return null
      return { type, preset: preset as RuleSnoozePreset }
    }
    default:
      return null
  }
}

export function parseQuickStepActionsJson(json: string): QuickStepAction[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: QuickStepAction[] = []
  for (const raw of parsed) {
    const action = normalizeQuickStepAction(raw)
    if (action) out.push(action)
  }
  return out
}

/** Serialisierung fuer DB — kanonische Typen, Legacy wird beim Lesen normalisiert. */
export function serializeQuickStepActions(actions: QuickStepAction[]): string {
  return JSON.stringify(actions)
}

export function defaultQuickStepAction(type: QuickStepActionType): QuickStepAction {
  switch (type) {
    case 'mark_read':
    case 'mark_unread':
    case 'archive':
    case 'delete':
    case 'mark_flagged':
    case 'clear_flagged':
      return { type }
    case 'move_to_folder':
      return { type, folderId: 0 }
    case 'add_todo':
      return { type, dueKind: 'today' }
    case 'add_tag':
      return { type, tag: '' }
    case 'snooze':
      return { type, preset: 'tomorrow-morning' }
  }
}

export function isQuickStepActionComplete(action: QuickStepAction): boolean {
  switch (action.type) {
    case 'move_to_folder':
      return action.folderId > 0
    case 'add_tag':
      return action.tag.trim().length > 0
    default:
      return true
  }
}

export function validateQuickStepDraft(
  name: string,
  actions: QuickStepAction[]
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'name_required' }
  if (actions.length === 0) return { ok: false, error: 'actions_required' }
  for (const a of actions) {
    if (!isQuickStepActionComplete(a)) return { ok: false, error: 'action_incomplete' }
  }
  return { ok: true }
}

/** QuickStep inkl. Aktionsliste (Editor). */
export interface MailQuickStepDetail extends MailQuickStep {
  enabled: boolean
  actions: QuickStepAction[]
}

export interface SaveMailQuickStepInput {
  id?: number
  name: string
  shortcut?: string | null
  enabled?: boolean
  actions: QuickStepAction[]
}
