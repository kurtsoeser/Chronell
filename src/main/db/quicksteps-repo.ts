import { getDb } from './index'
import type { MailQuickStep, TodoDueKindList, TodoDueKindOpen } from '@shared/types'

const OPEN_TODO_KINDS = new Set<TodoDueKindOpen>(['today', 'tomorrow', 'this_week', 'later'])

function parseTodoDueKind(v: unknown): TodoDueKindOpen | null {
  if (typeof v !== 'string') return null
  if (OPEN_TODO_KINDS.has(v as TodoDueKindOpen)) return v as TodoDueKindOpen
  return null
}

function inferQuickStepVisualBucket(actionsJson: string, name: string): TodoDueKindList | null {
  try {
    const actions = JSON.parse(actionsJson) as unknown
    if (Array.isArray(actions)) {
      for (const raw of actions) {
        if (!raw || typeof raw !== 'object') continue
        const type = (raw as { type?: unknown }).type
        if (type === 'addTodo') {
          const dueKind = parseTodoDueKind((raw as { dueKind?: unknown }).dueKind)
          if (dueKind) return dueKind
        }
      }
      const types = actions
        .filter((a): a is { type?: unknown } => !!a && typeof a === 'object')
        .map((a) => a.type)
      if (types.includes('markRead') && types.includes('archive')) return 'done'
    }
  } catch {
    // ignore
  }
  const n = name.toLowerCase()
  if (n.includes('heute')) return 'today'
  if (n.includes('morgen')) return 'tomorrow'
  if (n.includes('woche')) return 'this_week'
  if (n.includes('später') || n.includes('spaeter')) return 'later'
  if (n.includes('erledigt') || n.includes('archiv') || n.includes('gelesen')) return 'done'
  return null
}

interface QuickStepListRow {
  id: number
  name: string
  icon: string | null
  shortcut: string | null
  actions_json: string
  sort_order: number
  enabled: number
}

interface QuickStepRow extends QuickStepListRow {
  actions_json: string
}

function rowToListItem(r: QuickStepListRow): MailQuickStep {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    shortcut: r.shortcut,
    sortOrder: r.sort_order,
    visualBucket: inferQuickStepVisualBucket(r.actions_json, r.name)
  }
}

export function listMailQuickSteps(): MailQuickStep[] {
  const db = getDb()
  const rows = db
    .prepare<[], QuickStepListRow>(
      `SELECT id, name, icon, shortcut, actions_json, sort_order, enabled
       FROM quicksteps
       WHERE enabled = 1
       ORDER BY sort_order ASC, id ASC`
    )
    .all()
  return rows.map(rowToListItem)
}

export interface QuickStepDbRow {
  id: number
  name: string
  actionsJson: string
  enabled: boolean
}

export function getQuickStepById(id: number): QuickStepDbRow | null {
  const db = getDb()
  const r = db
    .prepare<[number], QuickStepRow>(
      `SELECT id, name, icon, shortcut, actions_json, sort_order, enabled
       FROM quicksteps WHERE id = ?`
    )
    .get(id)
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    actionsJson: r.actions_json,
    enabled: !!r.enabled
  }
}

export interface QuickStepFullBackupRow {
  id: number
  name: string
  icon: string | null
  shortcut: string | null
  actionsJson: string
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function listAllQuickStepsForBackup(): QuickStepFullBackupRow[] {
  const db = getDb()
  const rows = db
    .prepare<
      [],
      {
        id: number
        name: string
        icon: string | null
        shortcut: string | null
        actions_json: string
        sort_order: number
        enabled: number
        created_at: string
        updated_at: string
      }
    >(
      `SELECT id, name, icon, shortcut, actions_json, sort_order, enabled, created_at, updated_at
       FROM quicksteps
       ORDER BY sort_order ASC, id ASC`
    )
    .all()
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    shortcut: r.shortcut,
    actionsJson: r.actions_json,
    sortOrder: r.sort_order,
    enabled: !!r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))
}

/** Vollstaendiger Ersatz (Einstellungen-Import); IDs aus der Sicherung bleiben erhalten. */
export function replaceAllQuickStepsFromBackup(
  rows: Array<{
    id: number
    name: string
    icon: string | null
    shortcut: string | null
    actionsJson: string
    sortOrder: number
    enabled: boolean
    createdAt: string
    updatedAt: string
  }>
): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM quicksteps').run()
    const ins = db.prepare(
      `INSERT INTO quicksteps (id, name, icon, shortcut, actions_json, sort_order, enabled, created_at, updated_at)
       VALUES (@id, @name, @icon, @shortcut, @actions_json, @sort_order, @enabled, @created_at, @updated_at)`
    )
    for (const r of rows) {
      ins.run({
        id: r.id,
        name: r.name,
        icon: r.icon,
        shortcut: r.shortcut,
        actions_json: r.actionsJson,
        sort_order: r.sortOrder,
        enabled: r.enabled ? 1 : 0,
        created_at: r.createdAt,
        updated_at: r.updatedAt
      })
    }
  })
  tx()
}
