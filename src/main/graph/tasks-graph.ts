import {
  dueIsoFromClientInput,
  dueIsoToGraphDateTimePayload,
  trimFractionalSeconds,
  utcIsoFromWallDateTime
} from '@shared/calendar-datetime'

import type { TaskItemRow, TaskListRow, TaskSaveRecurrence } from '@shared/types'
import {
  buildMicrosoftTodoRecurrencePatchPayload,
  buildMicrosoftTodoRecurrencePayload,
  parseGraphTodoRecurrence
} from '../task-recurrence'

import { graphWindowsZoneToIana, ianaToWindowsTimeZone } from '@shared/microsoft-timezones'

import { createGraphClient } from './client'

import { isGraphItemNotFound } from './graph-request-errors'

import { loadConfig } from '../config'

import { resolveCalendarTimeZone } from '../todo-due-buckets'



async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {

  const config = await loadConfig()

  if (!config.microsoftClientId) {

    throw new Error('Keine Azure Client-ID konfiguriert.')

  }

  const homeAccountId = accountId.replace(/^ms:/, '')

  return createGraphClient(config.microsoftClientId, homeAccountId)

}



interface GraphDateTimeTimeZone {

  dateTime: string

  timeZone: string

}



interface GraphItemBody {

  content?: string | null

  contentType?: string | null

}



interface GraphTodoTaskList {

  id: string

  displayName?: string | null

  wellKnownListName?: string | null

}



interface GraphTodoTask {

  id: string

  title?: string | null

  body?: GraphItemBody | null

  status?: string | null

  dueDateTime?: GraphDateTimeTimeZone | null

  recurrence?: unknown

  categories?: string[] | null

}



interface ODataCollection<T> {

  value: T[]

  '@odata.nextLink'?: string

}



async function graphTodoTimeZone(): Promise<{ iana: string; windows: string }> {

  const appCfg = await loadConfig()

  const iana = resolveCalendarTimeZone(appCfg.calendarTimeZone)

  return { iana, windows: ianaToWindowsTimeZone(iana) }

}



/** Graph dueDateTime → ISO für Cache/UI (analog calendar-graph). */
export function graphDueToIso(d: GraphDateTimeTimeZone | null | undefined): string | null {

  if (!d?.dateTime) return null

  const raw = trimFractionalSeconds(d.dateTime.trim())

  if (raw.startsWith('0001-01-01')) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00.000Z`

  const iana = graphWindowsZoneToIana(d.timeZone)

  if (/T00:00:00/.test(raw)) {
    return `${raw.slice(0, 10)}T12:00:00.000Z`
  }

  const utcIso = utcIsoFromWallDateTime(raw, iana, false, () => iana)
  return utcIso

}



/** Client dueIso (YYYY-MM-DD oder ISO) → Graph dateTimeTimeZone. */

async function dueIsoToGraphPayload(dueIso: string): Promise<GraphDateTimeTimeZone | undefined> {

  const s = dueIso.trim()

  if (!s) return undefined

  const { iana, windows } = await graphTodoTimeZone()

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {

    return { dateTime: `${s}T00:00:00.0000000`, timeZone: windows }

  }

  return dueIsoToGraphDateTimePayload(s, windows, iana)
}

export { dueIsoFromClientInput } from '@shared/calendar-datetime'



function mergeDueFromPatch(row: TaskItemRow, patchDueIso: string | null | undefined): TaskItemRow {
  if (patchDueIso === undefined) return row
  if (patchDueIso === null || !String(patchDueIso).trim()) {
    return { ...row, dueIso: null }
  }
  if (row.dueIso?.trim()) return row
  return { ...row, dueIso: dueIsoFromClientInput(patchDueIso) }
}



function bodyNotes(body: GraphItemBody | null | undefined): string | null {

  const c = body?.content

  if (typeof c !== 'string' || c.trim() === '') return null

  return c.trim()

}

export function normalizeGraphTodoCategories(c: string[] | null | undefined): string[] | undefined {
  if (c === undefined) return undefined
  if (c === null) return []
  const u = Array.from(new Set(c.map((x) => x.trim()).filter((x) => x.length > 0)))
  return u.slice(0, 25)
}

function parseGraphTodoCategories(raw: string[] | null | undefined): string[] | undefined {
  const normalized = normalizeGraphTodoCategories(raw ?? [])
  return normalized && normalized.length > 0 ? normalized : undefined
}



function rowFromGraphTask(listId: string, t: GraphTodoTask): TaskItemRow | null {

  if (!t.id) return null

  const completed = t.status === 'completed'

  const recurrence = parseGraphTodoRecurrence(t.recurrence)
  const categories = parseGraphTodoCategories(t.categories)

  return {

    id: t.id,

    listId,

    title: (t.title ?? '').trim() || '(Ohne Titel)',

    completed,

    dueIso: graphDueToIso(t.dueDateTime),

    notes: bodyNotes(t.body ?? undefined),

    ...(recurrence ? { recurrence, recurrenceLocalOnly: false } : {}),

    ...(categories ? { categories } : {})

  }

}



async function graphGetTodoTask(

  accountId: string,

  listId: string,

  taskId: string

): Promise<GraphTodoTask> {

  const client = await getClientFor(accountId)

  const encList = encodeURIComponent(listId)

  const encTask = encodeURIComponent(taskId)

  return (await client.api(`/me/todo/lists/${encList}/tasks/${encTask}`).get()) as GraphTodoTask

}



/** PATCH-Response enthält oft kein dueDateTime – danach explizit laden. */

async function rowAfterGraphTaskWrite(

  accountId: string,

  listId: string,

  taskId: string,

  patchDueIso: string | null | undefined

): Promise<TaskItemRow> {

  const full = await graphGetTodoTask(accountId, listId, taskId)

  let row = rowFromGraphTask(listId, full)

  if (!row) throw new Error('Graph: Aufgabe konnte nicht gelesen werden.')

  row = mergeDueFromPatch(row, patchDueIso)

  return row

}



async function paginateODataPath<T>(accountId: string, initialPath: string): Promise<T[]> {

  const client = await getClientFor(accountId)

  const out: T[] = []

  let url: string | null = initialPath

  while (url) {

    const page = (await client.api(url).get()) as ODataCollection<T>

    for (const v of page.value) {

      out.push(v)

    }

    const next = page['@odata.nextLink']

    url = next ? next.replace(/^https?:\/\/[^/]+\/v[0-9.]+/, '') : null

  }

  return out

}



export async function graphListTodoLists(accountId: string): Promise<TaskListRow[]> {

  // Graph To Do: `$select` auf Listen/Tasks loest oft 400 «Invalid request» aus (API-Limitierung).

  const lists = await paginateODataPath<GraphTodoTaskList>(accountId, '/me/todo/lists?$top=200')

  return lists.map((L) => ({

    id: L.id,

    name: (L.displayName ?? '').trim() || L.id,

    isDefault: L.wellKnownListName === 'defaultList',

    wellKnownListName: L.wellKnownListName ?? null,

    provider: 'microsoft' as const

  }))

}



export async function graphFindFlaggedEmailsListId(accountId: string): Promise<string | null> {

  const lists = await paginateODataPath<GraphTodoTaskList>(accountId, '/me/todo/lists?$top=200')

  const flagged = lists.find((L) => L.wellKnownListName === 'flaggedEmails')

  const id = flagged?.id?.trim()

  return id && id.length > 0 ? id : null

}



export async function graphListCompletedTodoTaskIdsInList(accountId: string, listId: string): Promise<string[]> {

  const encList = encodeURIComponent(listId)

  const encFilter = encodeURIComponent("status eq 'completed'")

  const initialPath = `/me/todo/lists/${encList}/tasks?$select=id&$filter=${encFilter}&$top=200`

  const tasks = await paginateODataPath<GraphTodoTask>(accountId, initialPath)

  const ids: string[] = []

  for (const t of tasks) {

    if (t?.id) ids.push(t.id)

  }

  return ids

}



export async function graphListTodoTasks(

  accountId: string,

  listId: string,

  opts?: { showCompleted?: boolean; showHidden?: boolean }

): Promise<TaskItemRow[]> {

  const encList = encodeURIComponent(listId)

  const showCompleted = opts?.showCompleted !== false

  // `showHidden`: Google-spezifisch; Graph liefert keine versteckten To-Do-Listenpositionen analog.

  void opts?.showHidden

  const filter = showCompleted ? '' : "&$filter=status ne 'completed'"

  const tasks = await paginateODataPath<GraphTodoTask>(

    accountId,

    `/me/todo/lists/${encList}/tasks?$top=100${filter}`

  )

  const rows: TaskItemRow[] = []

  for (const t of tasks) {

    const row = rowFromGraphTask(listId, t)

    if (row) rows.push(row)

  }

  return rows

}



export async function graphCreateTodoTask(

  accountId: string,

  listId: string,

  input: {
    title: string
    notes?: string | null
    dueIso?: string | null
    completed?: boolean
    recurrence?: TaskSaveRecurrence | null
    categories?: string[] | null
  }

): Promise<TaskItemRow> {

  const client = await getClientFor(accountId)

  const encList = encodeURIComponent(listId)

  const body: Record<string, unknown> = {

    title: input.title.trim() || '(Ohne Titel)',

    status: input.completed ? 'completed' : 'notStarted'

  }

  if (input.notes != null && String(input.notes).trim() !== '') {

    body.body = { contentType: 'text', content: String(input.notes) }

  }

  if (input.dueIso != null && String(input.dueIso).trim() !== '') {

    const due = await dueIsoToGraphPayload(String(input.dueIso))

    if (due) body.dueDateTime = due

  }

  if (input.recurrence && input.dueIso?.trim()) {

    const { iana, windows } = await graphTodoTimeZone()

    Object.assign(

      body,

      buildMicrosoftTodoRecurrencePayload(input.recurrence, String(input.dueIso), windows, iana)

    )

  }

  const cats = normalizeGraphTodoCategories(input.categories)
  if (cats !== undefined) body.categories = cats

  const created = (await client.api(`/me/todo/lists/${encList}/tasks`).post(body)) as GraphTodoTask

  const taskId = created.id

  if (!taskId) throw new Error('Graph: Aufgabe ohne ID angelegt.')

  let row = rowFromGraphTask(listId, created)
  if (!row) throw new Error('Graph: Aufgabe ohne ID angelegt.')
  row = mergeDueFromPatch(row, input.dueIso)
  if (input.recurrence) {
    row = {
      ...row,
      recurrence: row.recurrence ?? input.recurrence,
      recurrenceLocalOnly: false
    }
  }
  if (input.dueIso?.trim() && !row.dueIso) {
    return rowAfterGraphTaskWrite(accountId, listId, taskId, input.dueIso)
  }
  return row

}



export async function graphPatchTodoTask(

  accountId: string,

  listId: string,

  taskId: string,

  patch: {

    title?: string | null

    notes?: string | null

    dueIso?: string | null

    completed?: boolean

    categories?: string[] | null

    recurrence?: TaskSaveRecurrence | null

  }

): Promise<TaskItemRow> {

  const client = await getClientFor(accountId)

  const encList = encodeURIComponent(listId)

  const encTask = encodeURIComponent(taskId)

  const body: Record<string, unknown> = {}

  if (patch.title !== undefined) {

    body.title = patch.title === null ? '' : String(patch.title).trim() || '(Ohne Titel)'

  }

  if (patch.notes !== undefined) {

    if (patch.notes === null || String(patch.notes).trim() === '') {

      body.body = { contentType: 'text', content: '' }

    } else {

      body.body = { contentType: 'text', content: String(patch.notes) }

    }

  }

  if (patch.dueIso !== undefined) {

    if (patch.dueIso === null || String(patch.dueIso).trim() === '') {

      body.dueDateTime = null

    } else {

      const due = await dueIsoToGraphPayload(String(patch.dueIso))

      if (due) body.dueDateTime = due

    }

  }

  if (patch.completed !== undefined) {

    body.status = patch.completed ? 'completed' : 'notStarted'

  }

  if (patch.categories !== undefined) {
    body.categories = normalizeGraphTodoCategories(patch.categories) ?? []
  }

  if (patch.recurrence !== undefined) {
    body.recurrence = patch.recurrence
  }

  const updated = (await client
    .api(`/me/todo/lists/${encList}/tasks/${encTask}`)
    .patch(body)) as GraphTodoTask

  const statusOnlyPatch =
    patch.completed !== undefined &&
    patch.title === undefined &&
    patch.notes === undefined &&
    patch.dueIso === undefined &&
    patch.categories === undefined &&
    patch.recurrence === undefined

  if (statusOnlyPatch) {
    const row = rowFromGraphTask(listId, updated)
    if (row) return row
  }

  return rowAfterGraphTaskWrite(accountId, listId, taskId, patch.dueIso)

}



export async function graphUpdateTodoTask(

  accountId: string,

  listId: string,

  taskId: string,

  input: {
    title: string
    notes?: string | null
    dueIso?: string | null
    completed?: boolean
    categories?: string[] | null
  }

): Promise<TaskItemRow> {

  return graphPatchTodoTask(accountId, listId, taskId, {

    title: input.title,

    notes: input.notes ?? null,

    dueIso: input.dueIso ?? null,

    completed: input.completed ?? false,

    categories: input.categories

  })

}



export async function graphPatchTodoTaskRecurrence(

  accountId: string,

  listId: string,

  taskId: string,

  recurrence: TaskSaveRecurrence,

  dueIso: string

): Promise<TaskItemRow> {

  const client = await getClientFor(accountId)

  const encList = encodeURIComponent(listId)

  const encTask = encodeURIComponent(taskId)

  const { iana, windows } = await graphTodoTimeZone()

  const body = buildMicrosoftTodoRecurrencePatchPayload(recurrence, dueIso, windows, iana)

  await client.api(`/me/todo/lists/${encList}/tasks/${encTask}`).patch(body)

  const full = await graphGetTodoTask(accountId, listId, taskId)

  let row = rowFromGraphTask(listId, full)

  if (!row) throw new Error('Graph: Aufgabe konnte nicht gelesen werden.')

  row = mergeDueFromPatch(row, dueIso)

  return {

    ...row,

    recurrence: row.recurrence ?? recurrence,

    recurrenceLocalOnly: false

  }

}



export async function graphDeleteTodoTask(accountId: string, listId: string, taskId: string): Promise<void> {

  const client = await getClientFor(accountId)

  const encList = encodeURIComponent(listId)

  const encTask = encodeURIComponent(taskId)

  try {

    await client.api(`/me/todo/lists/${encList}/tasks/${encTask}`).delete()

  } catch (e) {

    if (isGraphItemNotFound(e)) return

    throw e

  }

}

function escapeODataSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Versucht, Aufgaben in der Graph-Liste „Gekennzeichnete E-Mail“ zu loeschen,
 * die per `linkedResources.externalId` an diese Nachricht gebunden sind.
 * Fehler werden ignoriert (lokaler Todo-Eintrag ist bereits entfernt).
 */
export async function graphTryDeleteFlaggedEmailTasksForMessage(
  accountId: string,
  messageRemoteId: string
): Promise<void> {
  const rid = messageRemoteId.trim()
  if (rid.length === 0) return

  const lists = await paginateODataPath<GraphTodoTaskList>(accountId, '/me/todo/lists?$top=200')
  const flagged = lists.find((L) => L.wellKnownListName === 'flaggedEmails')
  if (flagged?.id == null || flagged.id.length === 0) return

  const quoted = escapeODataSingleQuotedString(rid)
  const filter = `linkedResources/any(l:l/externalId eq '${quoted}')`
  const encList = encodeURIComponent(flagged.id)
  const encFilter = encodeURIComponent(filter)
  const initialPath = `/me/todo/lists/${encList}/tasks?$select=id&$filter=${encFilter}&$top=200`

  let tasks: GraphTodoTask[]
  try {
    tasks = await paginateODataPath<GraphTodoTask>(accountId, initialPath)
  } catch {
    return
  }

  for (const t of tasks) {
    if (!t?.id) continue
    try {
      await graphDeleteTodoTask(accountId, flagged.id, t.id)
    } catch {
      // einzelner Task-Delete optional
    }
  }
}


