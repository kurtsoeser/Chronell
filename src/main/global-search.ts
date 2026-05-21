import type {
  CalendarEventView,
  GlobalSearchContactHit,
  GlobalSearchResult,
  SearchHit
} from '@shared/types'
import {
  buildSqlLikeTokenAndClause,
  buildSqlPhraseRankCaseMulti,
  splitSearchTokens
} from '@shared/search-token-query'
import { getDb } from './db/index'
import { decorateMailListLike } from './ipc/ipc-helpers'
import { normalizeMessagesFtsMatchQuery } from './db/messages-repo'
import { searchMessages } from './db/messages-repo'
import { searchNotes } from './db/user-notes-repo'
import { getPeopleContactById } from './db/people-repo'
import type { UserNoteKind } from '@shared/types'

function resolveNoteSearchTitle(note: {
  kind: UserNoteKind
  title: string | null
  mailSubject?: string | null
  eventTitleSnapshot?: string | null
}): string {
  if (note.title?.trim()) return note.title.trim()
  if (note.kind === 'mail' && note.mailSubject?.trim()) return note.mailSubject.trim()
  if (note.kind === 'calendar' && note.eventTitleSnapshot?.trim()) return note.eventTitleSnapshot.trim()
  return ''
}

function searchCalendarEvents(rawQuery: string, limit: number): CalendarEventView[] {
  const params: unknown[] = []
  const where = buildSqlLikeTokenAndClause(
    ['title', "IFNULL(location, '')"],
    rawQuery,
    params
  )
  if (!where) return []
  const phraseRank = buildSqlPhraseRankCaseMulti(['title', "IFNULL(location, '')"], rawQuery)
  const orderSql = phraseRank ? `${phraseRank.sql}, start_iso DESC` : `start_iso DESC`
  const rows = getDb()
    .prepare(
      `SELECT
         id, account_id, source, graph_event_id, graph_calendar_id, account_email,
         account_color_class, title, start_iso, end_iso, is_all_day, location,
         web_link, join_url, organizer, display_color_hex, calendar_can_edit
       FROM calendar_events
       WHERE ${where}
       ORDER BY ${orderSql}
       LIMIT ?`
    )
    .all(...params, ...(phraseRank?.params ?? []), limit) as Array<{
    id: string
    account_id: string
    source: 'microsoft' | 'google'
    graph_event_id: string
    graph_calendar_id: string | null
    account_email: string
    account_color_class: string
    title: string
    start_iso: string
    end_iso: string
    is_all_day: number
    location: string | null
    web_link: string | null
    join_url: string | null
    organizer: string | null
    display_color_hex: string | null
    calendar_can_edit: number | null
  }>

  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    accountId: r.account_id,
    accountEmail: r.account_email,
    accountColorClass: r.account_color_class,
    displayColorHex: r.display_color_hex,
    graphCalendarId: r.graph_calendar_id,
    graphEventId: r.graph_event_id,
    title: r.title,
    startIso: r.start_iso,
    endIso: r.end_iso,
    isAllDay: !!r.is_all_day,
    location: r.location,
    webLink: r.web_link,
    joinUrl: r.join_url,
    organizer: r.organizer,
    calendarCanEdit: r.calendar_can_edit == null ? undefined : !!r.calendar_can_edit
  }))
}

function searchCloudTasks(
  rawQuery: string,
  limit: number
): Array<{
  accountId: string
  listId: string
  taskId: string
  title: string
  notes: string | null
  dueIso: string | null
}> {
  const params: unknown[] = []
  const where = buildSqlLikeTokenAndClause(['title', "IFNULL(notes, '')"], rawQuery, params)
  if (!where) return []
  const phraseRank = buildSqlPhraseRankCaseMulti(['title', "IFNULL(notes, '')"], rawQuery)
  const orderSql = phraseRank
    ? `${phraseRank.sql}, completed ASC, due_iso ASC NULLS LAST, title ASC`
    : `completed ASC, due_iso ASC NULLS LAST, title ASC`
  return getDb()
    .prepare(
      `SELECT account_id as accountId, list_id as listId, task_id as taskId,
              title, notes, due_iso as dueIso
       FROM cloud_tasks
       WHERE ${where}
       ORDER BY ${orderSql}
       LIMIT ?`
    )
    .all(...params, ...(phraseRank?.params ?? []), limit) as Array<{
    accountId: string
    listId: string
    taskId: string
    title: string
    notes: string | null
    dueIso: string | null
  }>
}

function searchContacts(rawQuery: string, limit: number): GlobalSearchContactHit[] {
  const params: unknown[] = []
  const where = buildSqlLikeTokenAndClause(
    [
      "IFNULL(display_name, '')",
      'primary_email',
      "IFNULL(emails_json, '')",
      "IFNULL(company, '')"
    ],
    rawQuery,
    params
  )
  if (!where) return []
  const phraseRank = buildSqlPhraseRankCaseMulti(
    [
      "IFNULL(display_name, '')",
      "IFNULL(company, '')",
      'primary_email',
      "IFNULL(emails_json, '')"
    ],
    rawQuery
  )
  const orderSql = phraseRank
    ? `${phraseRank.sql}, is_favorite DESC, display_name ASC`
    : `is_favorite DESC, display_name ASC`
  const rows = getDb()
    .prepare(
      `SELECT id, account_id as accountId, display_name as displayName, primary_email as primaryEmail
       FROM people_contacts
       WHERE primary_email IS NOT NULL AND primary_email != ''
         AND (${where})
       ORDER BY ${orderSql}
       LIMIT ?`
    )
    .all(...params, ...(phraseRank?.params ?? []), limit) as Array<{
    id: number
    accountId: string
    displayName: string | null
    primaryEmail: string | null
  }>

  return rows
    .map((r) => {
      const full = getPeopleContactById(r.id)
      if (!full) return null
      return {
        id: full.id,
        accountId: full.accountId,
        displayName: full.displayName,
        primaryEmail: full.primaryEmail,
        company: full.company
      }
    })
    .filter((r): r is GlobalSearchContactHit => r != null)
}

export function globalSearch(rawQuery: string, limitPerKind = 8): GlobalSearchResult {
  const query = rawQuery.trim()
  const fts = normalizeMessagesFtsMatchQuery(query)
  const empty: GlobalSearchResult = {
    query,
    mails: [],
    notes: [],
    calendarEvents: [],
    tasks: [],
    contacts: []
  }
  if (!fts && splitSearchTokens(query).length === 0) return empty

  const mails: SearchHit[] = fts
    ? decorateMailListLike(searchMessages(query, limitPerKind))
    : []

  const noteItems = fts
    ? searchNotes({ query, limit: limitPerKind }).map((n) => ({
        id: n.id,
        kind: n.kind,
        title: resolveNoteSearchTitle(n) || 'Ohne Titel',
        updatedAt: n.updatedAt
      }))
    : []

  const calendarEvents = searchCalendarEvents(query, limitPerKind)
  const tasks = searchCloudTasks(query, limitPerKind)
  const contacts = searchContacts(query, limitPerKind)

  return {
    query,
    mails,
    notes: noteItems,
    calendarEvents,
    tasks,
    contacts
  }
}
