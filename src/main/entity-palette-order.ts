/** SQL-Hilfen fuer die Objekt-Palette (Verbindungen): relevante Objekte zuerst. */

/** JOINs fuer Mail-Prioritaet (Posteingang, offenes Mail-ToDo, WIP/Erledigt). */
export const MAIL_PALETTE_JOINS = `
  INNER JOIN folders f ON f.id = m.folder_id
  LEFT JOIN account_workflow_mail_folders aw ON aw.account_id = m.account_id
  LEFT JOIN (
    SELECT message_id, MAX(id) AS picked_todo_id
    FROM todos
    WHERE status = 'open'
    GROUP BY message_id
  ) open_pick ON open_pick.message_id = m.id
  LEFT JOIN todos open_todo ON open_todo.id = open_pick.picked_todo_id
`

/** Niedriger = weiter oben in der Palette. */
export const MAIL_PALETTE_PRIORITY_SQL = `
  CASE
    WHEN f.well_known IN ('deleteditems', 'junkemail') THEN 50
    WHEN f.well_known = 'mailclient_done' THEN 40
    WHEN aw.done_folder_remote_id IS NOT NULL AND f.remote_id = aw.done_folder_remote_id THEN 40
    WHEN f.well_known = 'archive' THEN 40
    WHEN LOWER(COALESCE(f.name, '')) LIKE '%erledigt%'
      OR LOWER(COALESCE(f.name, '')) LIKE '%archiv%'
      OR LOWER(COALESCE(f.path, '')) LIKE '%erledigt%'
      OR LOWER(COALESCE(f.path, '')) LIKE '%archiv%' THEN 40
    WHEN open_todo.id IS NOT NULL THEN 0
    WHEN f.well_known = 'inbox' THEN 0
    WHEN f.well_known = 'mailclient_wip' THEN 5
    WHEN aw.wip_folder_remote_id IS NOT NULL AND f.remote_id = aw.wip_folder_remote_id THEN 5
    WHEN f.well_known IN ('drafts', 'sentitems', 'outbox') THEN 25
    ELSE 20
  END
`

export function calendarPaletteWindowBounds(now = new Date()): {
  rangeStartIso: string
  rangeEndIso: string
  nowIso: string
} {
  const past = new Date(now)
  past.setDate(past.getDate() - 21)
  const future = new Date(now)
  future.setDate(future.getDate() + 120)
  return {
    rangeStartIso: past.toISOString(),
    rangeEndIso: future.toISOString(),
    nowIso: now.toISOString()
  }
}

/** Sortierung: Termine nahe „heute“ zuerst (vergangen und kommend). */
export const CALENDAR_PALETTE_ORDER_SQL = `
  ABS(julianday(COALESCE(start_iso, '')) - julianday(?)) ASC,
  start_iso ASC
`

/** Aufgaben: naechste Faelligkeit nahe heute. */
export const CLOUD_TASK_PALETTE_ORDER_SQL = `
  CASE WHEN due_iso IS NULL OR TRIM(due_iso) = '' THEN 1 ELSE 0 END,
  ABS(julianday(COALESCE(due_iso, '')) - julianday(?)) ASC,
  due_iso ASC
`
