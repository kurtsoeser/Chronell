import { getDb } from './index'
import {
  parseQuickStepActionsJson,
  serializeQuickStepActions,
  type MailQuickStepDetail,
  type QuickStepAction
} from '@shared/quicksteps'
import type { MailQuickStep, TodoDueKindList } from '@shared/types'

function inferQuickStepVisualBucket(actionsJson: string, name: string): TodoDueKindList | null {
  const actions = parseQuickStepActionsJson(actionsJson)
  for (const a of actions) {
    if (a.type === 'add_todo') return a.dueKind
  }
  const types = actions.map((a) => a.type)
  if (types.includes('mark_read') && types.includes('archive')) return 'done'
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
  return listMailQuickStepsInternal(true)
}

/** Alle QuickSteps inkl. deaktivierte (Einstellungen-Editor). */
export function listMailQuickStepsAll(): MailQuickStep[] {
  return listMailQuickStepsInternal(false)
}

function listMailQuickStepsInternal(enabledOnly: boolean): MailQuickStep[] {
  const db = getDb()
  const rows = db
    .prepare<[], QuickStepListRow>(
      `SELECT id, name, icon, shortcut, actions_json, sort_order, enabled
       FROM quicksteps
       ${enabledOnly ? 'WHERE enabled = 1' : ''}
       ORDER BY sort_order ASC, id ASC`
    )
    .all()
  return rows.map(rowToListItem)
}

export function getMailQuickStepDetail(id: number): MailQuickStepDetail | null {
  const db = getDb()
  const r = db
    .prepare<[number], QuickStepRow>(
      `SELECT id, name, icon, shortcut, actions_json, sort_order, enabled
       FROM quicksteps WHERE id = ?`
    )
    .get(id)
  if (!r) return null
  return {
    ...rowToListItem(r),
    enabled: !!r.enabled,
    actions: parseQuickStepActionsJson(r.actions_json)
  }
}

export interface UpsertMailQuickStepInput {
  id?: number
  name: string
  shortcut?: string | null
  actions: QuickStepAction[]
  enabled?: boolean
  sortOrder?: number
}

export function upsertMailQuickStep(input: UpsertMailQuickStepInput): MailQuickStepDetail {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('QuickStep-Name fehlt.')
  if (input.actions.length === 0) throw new Error('Mindestens eine Aktion erforderlich.')

  const actionsJson = serializeQuickStepActions(input.actions)
  const enabled = input.enabled !== false ? 1 : 0
  const now = new Date().toISOString()

  if (input.id != null) {
    const existing = getQuickStepById(input.id)
    if (!existing) throw new Error('QuickStep nicht gefunden.')
    db.prepare(
      `UPDATE quicksteps
       SET name = @name, shortcut = @shortcut, actions_json = @actions_json,
           enabled = @enabled, sort_order = COALESCE(@sort_order, sort_order), updated_at = @updated_at
       WHERE id = @id`
    ).run({
      id: input.id,
      name,
      shortcut: input.shortcut ?? null,
      actions_json: actionsJson,
      enabled,
      sort_order: input.sortOrder ?? null,
      updated_at: now
    })
    const detail = getMailQuickStepDetail(input.id)
    if (!detail) throw new Error('QuickStep nach Speichern nicht lesbar.')
    return detail
  }

  const maxSort =
    db.prepare<[], { m: number | null }>('SELECT MAX(sort_order) AS m FROM quicksteps').get()?.m ?? -1
  const sortOrder = input.sortOrder ?? maxSort + 1

  const result = db
    .prepare(
      `INSERT INTO quicksteps (name, icon, shortcut, actions_json, sort_order, enabled, created_at, updated_at)
       VALUES (@name, NULL, @shortcut, @actions_json, @sort_order, @enabled, @created_at, @updated_at)`
    )
    .run({
      name,
      shortcut: input.shortcut ?? null,
      actions_json: actionsJson,
      sort_order: sortOrder,
      enabled,
      created_at: now,
      updated_at: now
    })

  const detail = getMailQuickStepDetail(Number(result.lastInsertRowid))
  if (!detail) throw new Error('QuickStep nach Anlage nicht lesbar.')
  return detail
}

export function deleteMailQuickStep(id: number): void {
  const db = getDb()
  const r = db.prepare('DELETE FROM quicksteps WHERE id = ?').run(id)
  if (r.changes === 0) throw new Error('QuickStep nicht gefunden.')
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
