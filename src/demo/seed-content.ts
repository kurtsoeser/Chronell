import type Database from 'better-sqlite3'
import {
  addDays,
  endOfMonth,
  formatISO,
  getDaysInMonth,
  startOfWeek,
  subDays
} from 'date-fns'
import {
  DEMO_ACCOUNT_GOOGLE_ID,
  DEMO_ACCOUNT_GOOGLE_EMAIL,
  DEMO_ACCOUNT_M365_ID,
  DEMO_ACCOUNT_M365_EMAIL
} from '@shared/demo'
import { entityRefKey, type ChronellEntityRef } from '@shared/entity-ref'

const WEEK_STARTS_ON = 1 as const // Montag

function setTimeOnDate(d: Date, hour: number, minute = 0): Date {
  const out = new Date(d)
  out.setHours(hour, minute, 0, 0)
  return out
}

function isoDaysFromNow(days: number, hour = 10): string {
  return setTimeOnDate(addDays(new Date(), days), hour).toISOString()
}

function isoDaysAgo(days: number, hour = 9): string {
  return setTimeOnDate(subDays(new Date(), days), hour).toISOString()
}

function dueDate(days: number): string {
  return isoDaysFromNow(days).slice(0, 10)
}

function overdueDate(days: number): string {
  return isoDaysAgo(days).slice(0, 10)
}

/** 0 = Montag … 6 = Sonntag der aktuellen Kalenderwoche */
function demoThisWeek(
  weekday: number,
  startHour: number,
  endHour: number
): { start_iso: string; end_iso: string; is_all_day: 0 } {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON })
  const start = setTimeOnDate(addDays(weekStart, weekday), startHour)
  const end = setTimeOnDate(addDays(weekStart, weekday), endHour)
  return { start_iso: start.toISOString(), end_iso: end.toISOString(), is_all_day: 0 }
}

function demoToday(
  startHour: number,
  endHour: number
): { start_iso: string; end_iso: string; is_all_day: 0 } {
  const start = setTimeOnDate(new Date(), startHour)
  const end = setTimeOnDate(new Date(), endHour)
  return { start_iso: start.toISOString(), end_iso: end.toISOString(), is_all_day: 0 }
}

/** Kalendertag im laufenden Monat (1 = 1., wird auf Monatsende begrenzt) */
function demoThisMonth(
  dayOfMonth: number,
  startHour: number,
  endHour: number,
  allDay = false
): { start_iso: string; end_iso: string; is_all_day: 0 | 1 } {
  const now = new Date()
  const day = Math.min(Math.max(1, dayOfMonth), getDaysInMonth(now))
  const d = new Date(now.getFullYear(), now.getMonth(), day)
  if (allDay) {
    const start = setTimeOnDate(d, 0)
    const end = setTimeOnDate(d, 23, 59)
    return { start_iso: start.toISOString(), end_iso: end.toISOString(), is_all_day: 1 }
  }
  const start = setTimeOnDate(d, startHour)
  const end = setTimeOnDate(d, endHour)
  return { start_iso: start.toISOString(), end_iso: end.toISOString(), is_all_day: 0 }
}

/** Heute + N Tage, höchstens bis Monatsende */
function demoDaysAheadInMonth(
  daysAhead: number,
  startHour: number,
  endHour: number,
  allDay = false
): { start_iso: string; end_iso: string; is_all_day: 0 | 1 } {
  const now = new Date()
  const cap = endOfMonth(now)
  let d = addDays(now, daysAhead)
  if (d > cap) d = cap
  if (allDay) {
    const start = setTimeOnDate(d, 0)
    const end = setTimeOnDate(d, 23, 59)
    return { start_iso: start.toISOString(), end_iso: end.toISOString(), is_all_day: 1 }
  }
  const start = setTimeOnDate(d, startHour)
  const end = setTimeOnDate(d, endHour)
  return { start_iso: start.toISOString(), end_iso: end.toISOString(), is_all_day: 0 }
}

export interface DemoMailSeedResult {
  inboxFolderId: number
  messageIds: number[]
  threadIds: number[]
  todoIds: number[]
}

export function seedDemoMail(db: Database.Database): DemoMailSeedResult {
  const insertFolder = db.prepare(`
    INSERT INTO folders (id, account_id, remote_id, name, well_known, is_favorite, unread_count, total_count)
    VALUES (@id, @account_id, @remote_id, @name, @well_known, @is_favorite, @unread_count, @total_count)
  `)

  const folders = [
    { id: 1, account_id: DEMO_ACCOUNT_M365_ID, remote_id: 'inbox', name: 'Posteingang', well_known: 'inbox', unread: 12, total: 28 },
    { id: 2, account_id: DEMO_ACCOUNT_M365_ID, remote_id: 'sent', name: 'Gesendet', well_known: 'sentitems', unread: 0, total: 8 },
    { id: 3, account_id: DEMO_ACCOUNT_M365_ID, remote_id: 'drafts', name: 'Entwürfe', well_known: 'drafts', unread: 0, total: 2 },
    { id: 4, account_id: DEMO_ACCOUNT_GOOGLE_ID, remote_id: 'inbox', name: 'Posteingang', well_known: 'inbox', unread: 5, total: 11 },
    { id: 5, account_id: DEMO_ACCOUNT_GOOGLE_ID, remote_id: 'sent', name: 'Gesendet', well_known: 'sentitems', unread: 0, total: 4 }
  ]
  for (const f of folders) {
    insertFolder.run({
      id: f.id,
      account_id: f.account_id,
      remote_id: f.remote_id,
      name: f.name,
      well_known: f.well_known,
      is_favorite: 1,
      unread_count: f.unread,
      total_count: f.total
    })
  }

  db.prepare(`
    INSERT INTO meta_folders (id, name, sort_order, criteria_json, created_at, updated_at)
    VALUES (1, 'Heute & Wichtig', 0, '{"match":"flagged_or_todo_today"}', datetime('now'), datetime('now'))
  `).run()

  const insertThread = db.prepare(`
    INSERT INTO threads (id, account_id, remote_thread_id, subject_normalized, last_message_at, message_count)
    VALUES (@id, @account_id, @remote_thread_id, @subject_normalized, @last_message_at, @message_count)
  `)

  const threads = [
    { id: 1, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-kickoff', subject_normalized: 'Kick-off Projekt Nordlicht', last_message_at: isoDaysAgo(0, 8), message_count: 4 },
    { id: 2, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-budget', subject_normalized: 'Budget Q3 — Freigabe', last_message_at: isoDaysAgo(1, 14), message_count: 3 },
    { id: 3, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-stakeholder', subject_normalized: 'Stakeholder-Update', last_message_at: isoDaysAgo(2, 16), message_count: 2 },
    { id: 4, account_id: DEMO_ACCOUNT_GOOGLE_ID, remote_thread_id: 'thr-alpha', subject_normalized: 'Sprint Alpha', last_message_at: isoDaysAgo(0, 13), message_count: 3 },
    { id: 5, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-waiting', subject_normalized: 'Angebot Kunde Müller', last_message_at: isoDaysAgo(5, 10), message_count: 2 }
  ]
  for (const t of threads) insertThread.run(t)

  const insertMessage = db.prepare(`
    INSERT INTO messages (
      id, account_id, folder_id, thread_id, remote_id, remote_thread_id,
      subject, from_addr, from_name, to_addrs, sent_at, received_at, snippet,
      body_html, body_text, is_read, is_flagged, has_attachments, importance,
      snoozed_until, snoozed_from_folder_id, waiting_for_reply_until
    ) VALUES (
      @id, @account_id, @folder_id, @thread_id, @remote_id, @remote_thread_id,
      @subject, @from_addr, @from_name, @to_addrs, @sent_at, @received_at, @snippet,
      @body_html, @body_text, @is_read, @is_flagged, @has_attachments, @importance,
      @snoozed_until, @snoozed_from_folder_id, @waiting_for_reply_until
    )
  `)

  const messages: Array<Record<string, unknown>> = [
    {
      id: 1, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 1,
      remote_id: 'msg-kickoff-1', remote_thread_id: 'thr-kickoff',
      subject: 'Kick-off Projekt Nordlicht — Agenda',
      from_addr: 'lisa.hoffmann@nordlicht-demo.local', from_name: 'Lisa Hoffmann',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(3, 11), received_at: isoDaysAgo(3, 11),
      snippet: 'Hallo Anna, anbei die Agenda für Montag …',
      body_html: '<p>Hallo Anna,</p><p>anbei die Agenda für unser Kick-off am Montag. Bitte die offenen Punkte aus dem letzten Steering vorbereiten.</p>',
      body_text: 'Hallo Anna, anbei die Agenda für unser Kick-off am Montag.',
      is_read: 0, is_flagged: 1, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 2, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 1,
      remote_id: 'msg-kickoff-2', remote_thread_id: 'thr-kickoff',
      subject: 'Re: Kick-off Projekt Nordlicht — Agenda',
      from_addr: 'thomas.berger@nordlicht-demo.local', from_name: 'Thomas Berger',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(2, 9), received_at: isoDaysAgo(2, 9),
      snippet: 'Ich nehme den Budget-Block mit …',
      body_html: '<p>Ich nehme den Budget-Block mit — siehe auch die Notiz im Chronell-Graph.</p>',
      body_text: 'Ich nehme den Budget-Block mit.',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 3, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 2,
      remote_id: 'msg-budget-1', remote_thread_id: 'thr-budget',
      subject: 'Budget Q3 — Freigabe erforderlich',
      from_addr: 'finance@nordlicht-demo.local', from_name: 'Finanzen Nordlicht',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(4, 16), received_at: isoDaysAgo(4, 16),
      snippet: 'Bitte bis Freitag freigeben …',
      body_html: '<p>Bitte bis Freitag freigeben. Die Details sind in der angehängten Tabelle.</p>',
      body_text: 'Bitte bis Freitag freigeben.',
      is_read: 1, is_flagged: 0, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 4, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-newsletter', remote_thread_id: null,
      subject: 'Chronell Insights — Newsletter Juli',
      from_addr: 'news@chronell-demo.local', from_name: 'Chronell Demo',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(5, 7), received_at: isoDaysAgo(5, 7),
      snippet: 'Neu in 1.0: Notizen, Verbindungs-Graph …',
      body_html: '<p>Willkommen in der Demo-Umgebung von Chronell 1.0.</p>',
      body_text: 'Willkommen in der Demo-Umgebung.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'low',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 5, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-meeting-invite', remote_thread_id: null,
      subject: 'Einladung: Steering Montag 09:00',
      from_addr: 'lisa.hoffmann@nordlicht-demo.local', from_name: 'Lisa Hoffmann',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(2, 15), received_at: isoDaysAgo(2, 15),
      snippet: 'Microsoft Teams-Besprechung …',
      body_html: '<p>Teams-Meeting — siehe Kalendertermin.</p>',
      body_text: 'Teams-Meeting',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 6, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 1,
      remote_id: 'msg-kickoff-3', remote_thread_id: 'thr-kickoff',
      subject: 'Re: Kick-off — Raum & Catering',
      from_addr: 'sarah.klein@nordlicht-demo.local', from_name: 'Sarah Klein',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(1, 14), received_at: isoDaysAgo(1, 14),
      snippet: 'Raum B ist reserviert, Catering kommt …',
      body_html: '<p>Raum B ist reserviert. Catering bestätigt für 12 Personen.</p>',
      body_text: 'Raum B reserviert, Catering bestätigt.',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 7, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 2,
      remote_id: 'msg-budget-2', remote_thread_id: 'thr-budget',
      subject: 'Re: Budget Q3 — Rückfrage Marketing',
      from_addr: 'anna.weber@nordlicht-demo.local', from_name: 'Anna Weber',
      to_addrs: 'finance@nordlicht-demo.local', sent_at: isoDaysAgo(2, 10), received_at: isoDaysAgo(2, 10),
      snippet: 'Marketing-Posten bitte auf Q4 verschieben …',
      body_html: '<p>Marketing-Posten bitte auf Q4 verschieben — siehe Anhang.</p>',
      body_text: 'Marketing-Posten auf Q4 verschieben.',
      is_read: 1, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 8, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 3,
      remote_id: 'msg-stakeholder-1', remote_thread_id: 'thr-stakeholder',
      subject: 'Stakeholder-Update — Entwurf',
      from_addr: 'lisa.hoffmann@nordlicht-demo.local', from_name: 'Lisa Hoffmann',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(3, 16), received_at: isoDaysAgo(3, 16),
      snippet: 'Bitte bis morgen kommentieren …',
      body_html: '<p>Bitte bis morgen kommentieren. Fokus: Meilensteine und Risiken.</p>',
      body_text: 'Bitte bis morgen kommentieren.',
      is_read: 0, is_flagged: 1, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 9, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 5,
      remote_id: 'msg-waiting-1', remote_thread_id: 'thr-waiting',
      subject: 'Angebot Kunde Müller — Rückmeldung?',
      from_addr: 'kunde.mueller@extern-demo.local', from_name: 'Kunde Müller GmbH',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(6, 11), received_at: isoDaysAgo(6, 11),
      snippet: 'Wir warten noch auf Ihr Feedback …',
      body_html: '<p>Wir warten noch auf Ihr Feedback zum Angebot vom letzten Montag.</p>',
      body_text: 'Wir warten auf Feedback zum Angebot.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: isoDaysFromNow(3)
    },
    {
      id: 10, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-snoozed', remote_thread_id: null,
      subject: 'IT: VPN-Zugang für Externe',
      from_addr: 'it@nordlicht-demo.local', from_name: 'IT Nordlicht',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(1, 8), received_at: isoDaysAgo(1, 8),
      snippet: 'Formular ausfüllen bis nächste Woche …',
      body_html: '<p>Bitte das VPN-Formular für externe Berater ausfüllen.</p>',
      body_text: 'VPN-Formular ausfüllen.',
      is_read: 0, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: isoDaysFromNow(2, 9), snoozed_from_folder_id: 1, waiting_for_reply_until: null
    },
    {
      id: 11, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 2, thread_id: null,
      remote_id: 'msg-sent-1', remote_thread_id: null,
      subject: 'Kick-off: Danke & nächste Schritte',
      from_addr: DEMO_ACCOUNT_M365_EMAIL, from_name: 'Anna Weber',
      to_addrs: 'lisa.hoffmann@nordlicht-demo.local', sent_at: isoDaysAgo(0, 17), received_at: isoDaysAgo(0, 17),
      snippet: 'Danke für die gute Session …',
      body_html: '<p>Danke für die Session. Nächste Schritte in der Projektnotiz.</p>',
      body_text: 'Danke für die Session.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 12, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: 4,
      remote_id: 'msg-alpha-1', remote_thread_id: 'thr-alpha',
      subject: 'Alpha — Sprint Review',
      from_addr: 'dev@nordlicht-demo.local', from_name: 'Dev Team',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(1, 13), received_at: isoDaysAgo(1, 13),
      snippet: 'Zusammenfassung der Review …',
      body_html: '<p>Sprint Review abgeschlossen — Demo-Daten in Chronell.</p>',
      body_text: 'Sprint Review abgeschlossen.',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 13, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: 4,
      remote_id: 'msg-alpha-2', remote_thread_id: 'thr-alpha',
      subject: 'Re: Alpha — Offene Bugs',
      from_addr: 'marc.weber@nordlicht-demo.local', from_name: 'Marc Weber',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(0, 9), received_at: isoDaysAgo(0, 9),
      snippet: '3 Blocker für Release …',
      body_html: '<p>3 Blocker für Release — siehe Board in Notizen.</p>',
      body_text: '3 Blocker für Release.',
      is_read: 0, is_flagged: 1, has_attachments: 0, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 14, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: null,
      remote_id: 'msg-alpha-deploy', remote_thread_id: null,
      subject: 'Alpha — Staging Deployment',
      from_addr: 'ci@nordlicht-demo.local', from_name: 'CI Pipeline',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(0, 6), received_at: isoDaysAgo(0, 6),
      snippet: 'Build #412 erfolgreich …',
      body_html: '<p>Build #412 auf Staging deployed. Smoke-Tests grün.</p>',
      body_text: 'Build #412 deployed.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'low',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    }
  ]

  for (const m of messages) insertMessage.run(m)

  const insertTodo = db.prepare(`
    INSERT INTO todos (message_id, account_id, due_kind, due_at, status, created_at)
    VALUES (@message_id, @account_id, @due_kind, @due_at, 'open', datetime('now'))
  `)
  const todoSeeds = [
    { message_id: 1, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'today', due_at: dueDate(0) },
    { message_id: 2, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'today', due_at: dueDate(0) },
    { message_id: 3, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'tomorrow', due_at: dueDate(1) },
    { message_id: 5, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'this_week', due_at: dueDate(3) },
    { message_id: 8, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'later', due_at: dueDate(6) },
    { message_id: 9, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'later', due_at: dueDate(4) },
    { message_id: 10, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'tomorrow', due_at: dueDate(1) },
    { message_id: 13, account_id: DEMO_ACCOUNT_GOOGLE_ID, due_kind: 'today', due_at: dueDate(0) },
    { message_id: 12, account_id: DEMO_ACCOUNT_GOOGLE_ID, due_kind: 'this_week', due_at: dueDate(2) }
  ]
  const todoIds: number[] = []
  for (const t of todoSeeds) {
    const res = insertTodo.run(t)
    todoIds.push(Number(res.lastInsertRowid))
  }

  return {
    inboxFolderId: 1,
    messageIds: messages.map((m) => m.id as number),
    threadIds: threads.map((t) => t.id),
    todoIds
  }
}

export interface DemoCalendarSeedResult {
  eventIds: string[]
}

export function seedDemoCalendar(db: Database.Database): DemoCalendarSeedResult {
  const stmt = db.prepare(`
    INSERT INTO calendar_events (
      id, account_id, source, graph_event_id, graph_calendar_id,
      account_email, account_color_class, title, start_iso, end_iso, is_all_day,
      location, web_link, join_url, organizer, categories_json, calendar_can_edit
    ) VALUES (
      @id, @account_id, @source, @graph_event_id, @graph_calendar_id,
      @account_email, @account_color_class, @title, @start_iso, @end_iso, @is_all_day,
      @location, @web_link, @join_url, @organizer, @categories_json, 1
    )
  `)

  const events = [
    // —— Aktuelle Woche (Mo–So) ——
    (() => {
      const t = demoThisWeek(0, 9, 10)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-standup`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-standup', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Daily Stand-up Nordlicht', ...t,
        location: 'Teams', web_link: 'https://teams.microsoft.com/demo/standup', join_url: 'https://teams.microsoft.com/demo/standup/join',
        organizer: 'Lisa Hoffmann', categories_json: '["Projekt"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(1, 9, 10)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-steering`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-steering', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Steering Projekt Nordlicht', ...t,
        location: 'Teams', web_link: 'https://teams.microsoft.com/demo', join_url: 'https://teams.microsoft.com/demo/join',
        organizer: 'Lisa Hoffmann', categories_json: '["Projekt"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(2, 10, 15)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-workshop`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-workshop', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Workshop Anforderungen', ...t,
        location: 'Raum A', web_link: null, join_url: null,
        organizer: 'Thomas Berger', categories_json: '["Workshop"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(3, 11, 12)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-1on1`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-1on1', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: '1:1 mit Lisa', ...t,
        location: 'Büro', web_link: null, join_url: null,
        organizer: 'Lisa Hoffmann', categories_json: null
      }
    })(),
    (() => {
      const t = demoThisWeek(4, 14, 16)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-week-close`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-week-close', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Wochenabschluss — Status', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Anna Weber', categories_json: '["Projekt"]'
      }
    })(),
    (() => {
      const t = demoToday(14, 16)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-focus`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-focus', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Fokuszeit — Budget', ...t,
        location: null, web_link: null, join_url: null,
        organizer: 'Anna Weber', categories_json: '["Deep Work"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(2, 15, 16)
      return {
        id: `${DEMO_ACCOUNT_GOOGLE_ID}:evt-review`,
        account_id: DEMO_ACCOUNT_GOOGLE_ID, source: 'google', graph_event_id: 'evt-review', graph_calendar_id: 'primary',
        account_email: DEMO_ACCOUNT_GOOGLE_EMAIL, account_color_class: 'bg-emerald-500',
        title: 'Sprint Review Alpha', ...t,
        location: 'Raum Gelb', web_link: null, join_url: null,
        organizer: 'Dev Team', categories_json: null
      }
    })(),
    // —— Später im aktuellen Monat ——
    (() => {
      const t = demoDaysAheadInMonth(5, 10, 12)
      return {
        id: `${DEMO_ACCOUNT_GOOGLE_ID}:evt-planning`,
        account_id: DEMO_ACCOUNT_GOOGLE_ID, source: 'google', graph_event_id: 'evt-planning', graph_calendar_id: 'primary',
        account_email: DEMO_ACCOUNT_GOOGLE_EMAIL, account_color_class: 'bg-emerald-500',
        title: 'Sprint Planning Alpha', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Marc Weber', categories_json: '["Alpha"]'
      }
    })(),
    (() => {
      const t = demoDaysAheadInMonth(8, 9, 10)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-client`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-client', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Kundentermin Müller GmbH', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Anna Weber', categories_json: '["Kunde"]'
      }
    })(),
    (() => {
      const t = demoThisMonth(15, 13, 17)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-training`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-training', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Schulung Chronell 1.0', ...t,
        location: 'Raum B', web_link: null, join_url: null,
        organizer: 'Thomas Berger', categories_json: '["Training"]'
      }
    })(),
    (() => {
      const t = demoThisMonth(22, 0, 23, true)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-offsite`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-offsite', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Team-Offsite (Ganztägig)', ...t,
        location: 'Salzburg', web_link: null, join_url: null,
        organizer: 'Lisa Hoffmann', categories_json: '["Team"]'
      }
    })(),
    (() => {
      const t = demoDaysAheadInMonth(10, 15, 16)
      return {
        id: `${DEMO_ACCOUNT_GOOGLE_ID}:evt-retro`,
        account_id: DEMO_ACCOUNT_GOOGLE_ID, source: 'google', graph_event_id: 'evt-retro', graph_calendar_id: 'primary',
        account_email: DEMO_ACCOUNT_GOOGLE_EMAIL, account_color_class: 'bg-emerald-500',
        title: 'Sprint Retrospektive Alpha', ...t,
        location: 'Raum Gelb', web_link: null, join_url: null,
        organizer: 'Marc Weber', categories_json: '["Alpha"]'
      }
    })(),
    (() => {
      const t = demoThisMonth(Math.min(28, getDaysInMonth(new Date())), 9, 11)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-month-review`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-month-review', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Monats-Review Nordlicht', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Lisa Hoffmann', categories_json: '["Review"]'
      }
    })()
  ]

  for (const ev of events) stmt.run(ev)
  return { eventIds: events.map((e) => e.graph_event_id) }
}

export function seedDemoTasks(db: Database.Database): void {
  const listStmt = db.prepare(`
    INSERT INTO task_lists (account_id, list_id, name, is_default, provider)
    VALUES (@account_id, @list_id, @name, @is_default, @provider)
  `)
  const lists = [
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', name: 'Aufgaben', is_default: 1, provider: 'microsoft' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', name: 'Planung', is_default: 0, provider: 'microsoft' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', name: 'Alpha Backlog', is_default: 1, provider: 'google' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', name: 'Alpha Bugs', is_default: 0, provider: 'google' }
  ]
  for (const l of lists) listStmt.run(l)

  const taskStmt = db.prepare(`
    INSERT INTO cloud_tasks (account_id, list_id, task_id, title, completed, due_iso, notes)
    VALUES (@account_id, @list_id, @task_id, @title, @completed, @due_iso, @notes)
  `)

  const tasks = [
    // Microsoft — heute / überfällig / diese Woche
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't1', title: 'Budget Q3 freigeben', completed: 0, due_iso: dueDate(0), notes: 'Heute — aus Mail Finance' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't2', title: 'Kick-off Agenda prüfen', completed: 1, due_iso: overdueDate(1), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't3', title: 'Stakeholder-Update vorbereiten', completed: 0, due_iso: dueDate(1), notes: 'Morgen' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't4', title: 'Angebot Müller nachfassen', completed: 0, due_iso: overdueDate(2), notes: 'Überfällig' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't5', title: 'VPN-Formular IT', completed: 0, due_iso: dueDate(2), notes: 'Mail gesnoozed' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't8', title: 'Steering-Unterlagen senden', completed: 0, due_iso: dueDate(0), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't9', title: 'Feedback Workshop einholen', completed: 0, due_iso: dueDate(3), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't10', title: 'Projektstatus für Lisa', completed: 0, due_iso: dueDate(4), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't6', title: 'Risikoliste aktualisieren', completed: 0, due_iso: dueDate(5), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't7', title: 'Meilenstein-Plan Monatsende', completed: 0, due_iso: dueDate(Math.min(12, getDaysInMonth(new Date()) - new Date().getDate())), notes: 'Im aktuellen Monat' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't11', title: 'Lieferantenvertrag prüfen', completed: 0, due_iso: null, notes: 'Ohne Fälligkeit' },
    // Google Alpha
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g1', title: 'API-Mock für Alpha', completed: 0, due_iso: dueDate(0), notes: 'Heute' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g2', title: 'UI-Review Notizen', completed: 0, due_iso: dueDate(1), notes: 'Siehe Chronell-Notiz' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g3', title: 'Release Notes Alpha', completed: 0, due_iso: dueDate(6), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g6', title: 'Staging-Smoke-Tests', completed: 0, due_iso: dueDate(2), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g7', title: 'Demo-Datenpaket reviewen', completed: 0, due_iso: dueDate(3), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g4', title: 'Bug #127 — Login Timeout', completed: 0, due_iso: dueDate(0), notes: 'Blocker — heute' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g5', title: 'Bug #131 — Export CSV', completed: 1, due_iso: overdueDate(3), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g8', title: 'Bug #140 — Kalender-Sync', completed: 0, due_iso: overdueDate(1), notes: 'Überfällig' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g9', title: 'Bug #145 — Dark Mode Kontrast', completed: 0, due_iso: dueDate(4), notes: null }
  ]
  for (const t of tasks) taskStmt.run(t)
}

export function seedDemoPeople(db: Database.Database): number[] {
  const stmt = db.prepare(`
    INSERT INTO people_contacts (
      id, account_id, provider, remote_id, display_name, given_name, surname,
      company, job_title, primary_email, emails_json, is_favorite
    ) VALUES (
      @id, @account_id, @provider, @remote_id, @display_name, @given_name, @surname,
      @company, @job_title, @primary_email, @emails_json, @is_favorite
    )
  `)
  const contacts = [
    { id: 1, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-lisa', display_name: 'Lisa Hoffmann', given_name: 'Lisa', surname: 'Hoffmann', company: 'Nordlicht Consulting', job_title: 'Projektleitung', primary_email: 'lisa.hoffmann@nordlicht-demo.local', emails_json: null, is_favorite: 1 },
    { id: 2, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-thomas', display_name: 'Thomas Berger', given_name: 'Thomas', surname: 'Berger', company: 'Nordlicht Consulting', job_title: 'Consultant', primary_email: 'thomas.berger@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 3, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-finance', display_name: 'Finanzen', given_name: null, surname: null, company: 'Nordlicht Consulting', job_title: 'Shared Mailbox', primary_email: 'finance@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 4, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-sarah', display_name: 'Sarah Klein', given_name: 'Sarah', surname: 'Klein', company: 'Nordlicht Consulting', job_title: 'Office Management', primary_email: 'sarah.klein@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 5, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-mueller', display_name: 'Kunde Müller', given_name: 'Hans', surname: 'Müller', company: 'Müller GmbH', job_title: 'Einkauf', primary_email: 'kunde.mueller@extern-demo.local', emails_json: null, is_favorite: 1 },
    { id: 6, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-it', display_name: 'IT Support', given_name: null, surname: null, company: 'Nordlicht Consulting', job_title: 'IT', primary_email: 'it@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 7, account_id: DEMO_ACCOUNT_GOOGLE_ID, provider: 'google', remote_id: 'c-marc', display_name: 'Marc Weber', given_name: 'Marc', surname: 'Weber', company: 'Nordlicht Consulting', job_title: 'Tech Lead Alpha', primary_email: 'marc.weber@nordlicht-demo.local', emails_json: null, is_favorite: 1 },
    { id: 8, account_id: DEMO_ACCOUNT_GOOGLE_ID, provider: 'google', remote_id: 'c-dev', display_name: 'Dev Team', given_name: null, surname: null, company: 'Nordlicht Consulting', job_title: 'Distribution List', primary_email: 'dev@nordlicht-demo.local', emails_json: null, is_favorite: 0 }
  ]
  for (const c of contacts) stmt.run(c)
  return contacts.map((c) => c.id)
}

export function seedDemoNotes(db: Database.Database, messageIds: number[]): { noteIds: number[]; sectionIds: number[] } {
  db.prepare(`
    INSERT INTO note_sections (id, name, icon, icon_color, sort_order, parent_id, created_at, updated_at)
    VALUES (1, 'Projekt Nordlicht', 'briefcase', '#3478f6', 0, NULL, datetime('now'), datetime('now')),
           (2, 'Meetings', 'calendar', '#7c6fe1', 1, NULL, datetime('now'), datetime('now')),
           (3, 'Sprint Alpha', 'folder', '#3ecf8e', 0, NULL, datetime('now'), datetime('now')),
           (4, 'Quick Capture', 'zap', '#f59e0b', 2, NULL, datetime('now'), datetime('now'))
  `).run()

  const noteStmt = db.prepare(`
    INSERT INTO user_notes (id, kind, message_id, account_id, title, body, created_at, updated_at, section_id)
    VALUES (@id, @kind, @message_id, @account_id, @title, @body, datetime('now'), datetime('now'), @section_id)
  `)

  const notes = [
    {
      id: 1, kind: 'standalone', message_id: null, account_id: null,
      title: 'Projektübersicht',
      body: '<h2>Nordlicht Q3</h2><p>Zentrale Notiz mit <strong>Verknüpfungen</strong> zu Mail, Terminen und Aufgaben.</p><p>Siehe auch [[Stakeholder-Update]]</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Budget freigeben</li><li data-type="taskItem" data-checked="true">Kick-off vorbereiten</li><li data-type="taskItem" data-checked="false">Risiken reviewen</li></ul>',
      section_id: 1
    },
    {
      id: 2, kind: 'mail', message_id: messageIds[0], account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Notiz zur Kick-off-Mail',
      body: '<p>Antwort an Lisa bis Montag — Budget-Block mit Thomas abstimmen.</p>',
      section_id: 2
    },
    {
      id: 3, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_GOOGLE_ID,
      title: 'Alpha Sprint 12',
      body: '<p>Review-Ergebnisse und offene Punkte für die Demo-Umgebung.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Bug #127 fixen</li><li data-type="taskItem" data-checked="false">Release Notes</li></ul>',
      section_id: 3
    },
    {
      id: 4, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Stakeholder-Update',
      body: '<h3>Entwurf KW27</h3><p>Meilensteine grün, Budget gelb. Nächster Steering-Termin Montag.</p>',
      section_id: 1
    },
    {
      id: 5, kind: 'mail', message_id: messageIds[7], account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Kommentare Stakeholder-Mail',
      body: '<p>Lisa: Fokus auf Risiken. Thomas: Grafik auf Seite 3 anpassen.</p>',
      section_id: 2
    },
    {
      id: 6, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Meeting-Notiz Steering',
      body: '<p>Teilnehmer: Lisa, Thomas, Anna</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Budget bis Freitag</li><li data-type="taskItem" data-checked="false">Workshop Einladungen</li></ul>',
      section_id: 2
    },
    {
      id: 7, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_GOOGLE_ID,
      title: 'Alpha Architektur',
      body: '<p>API-Gateway → Mock-Services. Embed-Beispiel: <a href="https://example.com">Dokumentation</a></p>',
      section_id: 3
    },
    {
      id: 8, kind: 'standalone', message_id: null, account_id: null,
      title: 'Quick Capture — Ideen',
      body: '<p>• Demo-Pack regelmäßig zurücksetzen<br>• Screenshots für Homepage</p>',
      section_id: 4
    }
  ]
  for (const n of notes) noteStmt.run(n)
  return { noteIds: notes.map((n) => n.id), sectionIds: [1, 2, 3, 4] }
}

type EntityLinkSide = ChronellEntityRef

function sideToColumns(side: EntityLinkSide, prefix: 'a' | 'b'): Record<string, unknown> {
  const cols: Record<string, unknown> = {
    [`${prefix}_kind`]: side.kind === 'people_contact' ? 'people_contact' : side.kind,
    [`${prefix}_note_id`]: null,
    [`${prefix}_mail_message_id`]: null,
    [`${prefix}_calendar_account_id`]: null,
    [`${prefix}_calendar_graph_event_id`]: null,
    [`${prefix}_task_account_id`]: null,
    [`${prefix}_task_list_id`]: null,
    [`${prefix}_task_id`]: null,
    [`${prefix}_people_contact_id`]: null
  }
  switch (side.kind) {
    case 'note':
      cols[`${prefix}_note_id`] = side.noteId
      break
    case 'mail':
      cols[`${prefix}_mail_message_id`] = side.messageId
      break
    case 'mail_todo':
      cols[`${prefix}_kind`] = 'mail_todo'
      cols[`${prefix}_mail_todo_id`] = side.todoId
      break
    case 'calendar_event':
      cols[`${prefix}_calendar_account_id`] = side.accountId
      cols[`${prefix}_calendar_graph_event_id`] = side.graphEventId
      break
    case 'cloud_task':
      cols[`${prefix}_task_account_id`] = side.accountId
      cols[`${prefix}_task_list_id`] = side.listId
      cols[`${prefix}_task_id`] = side.taskId
      break
    case 'people_contact':
      cols[`${prefix}_people_contact_id`] = side.contactId
      break
  }
  return cols
}

function insertEntityLinkPair(db: Database.Database, left: EntityLinkSide, right: EntityLinkSide, linkKind = 'related'): void {
  const keyL = entityRefKey(left)
  const keyR = entityRefKey(right)
  const [refA, refB, sideA, sideB] = keyL < keyR ? [keyL, keyR, left, right] : [keyR, keyL, right, left]
  const aCols = sideToColumns(sideA, 'a')
  const bCols = sideToColumns(sideB, 'b')
  db.prepare(`
    INSERT INTO entity_links (
      ref_a_key, ref_b_key,
      a_kind, a_note_id, a_mail_message_id, a_mail_todo_id,
      a_calendar_account_id, a_calendar_graph_event_id,
      a_task_account_id, a_task_list_id, a_task_id, a_people_contact_id,
      b_kind, b_note_id, b_mail_message_id, b_mail_todo_id,
      b_calendar_account_id, b_calendar_graph_event_id,
      b_task_account_id, b_task_list_id, b_task_id, b_people_contact_id,
      link_kind
    ) VALUES (
      @ref_a_key, @ref_b_key,
      @a_kind, @a_note_id, @a_mail_message_id, @a_mail_todo_id,
      @a_calendar_account_id, @a_calendar_graph_event_id,
      @a_task_account_id, @a_task_list_id, @a_task_id, @a_people_contact_id,
      @b_kind, @b_note_id, @b_mail_message_id, @b_mail_todo_id,
      @b_calendar_account_id, @b_calendar_graph_event_id,
      @b_task_account_id, @b_task_list_id, @b_task_id, @b_people_contact_id,
      @link_kind
    )
  `).run({
    ref_a_key: refA,
    ref_b_key: refB,
    link_kind: linkKind,
    a_mail_todo_id: null,
    b_mail_todo_id: null,
    ...aCols,
    ...bCols
  })
}

export function seedDemoEntityLinks(
  db: Database.Database,
  ctx: {
    messageIds: number[]
    noteIds: number[]
    contactIds: number[]
    todoIds: number[]
    calendarEventIds: string[]
  }
): void {
  const { messageIds, noteIds, contactIds, todoIds } = ctx
  const pairs: Array<[EntityLinkSide, EntityLinkSide]> = [
    [{ kind: 'mail', messageId: messageIds[0]! }, { kind: 'note', noteId: noteIds[1]! }],
    [{ kind: 'note', noteId: noteIds[0]! }, { kind: 'people_contact', contactId: contactIds[0]! }],
    [{ kind: 'mail', messageId: messageIds[2]! }, { kind: 'people_contact', contactId: contactIds[2]! }],
    [{ kind: 'mail', messageId: messageIds[4]! }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-steering' }],
    [{ kind: 'note', noteId: noteIds[5]! }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-steering' }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't1' }, { kind: 'mail', messageId: messageIds[2]! }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't4' }, { kind: 'mail', messageId: messageIds[8]! }],
    [{ kind: 'note', noteId: noteIds[3]! }, { kind: 'mail', messageId: messageIds[7]! }],
    [{ kind: 'people_contact', contactId: contactIds[4]! }, { kind: 'mail', messageId: messageIds[8]! }],
    [{ kind: 'mail_todo', todoId: todoIds[0]! }, { kind: 'note', noteId: noteIds[1]! }],
    [{ kind: 'note', noteId: noteIds[2]! }, { kind: 'cloud_task', accountId: DEMO_ACCOUNT_GOOGLE_ID, listId: 'google-bugs', taskId: 'g4' }],
    [{ kind: 'people_contact', contactId: contactIds[6]! }, { kind: 'note', noteId: noteIds[2]! }],
    [{ kind: 'calendar_event', accountId: DEMO_ACCOUNT_GOOGLE_ID, graphEventId: 'evt-review' }, { kind: 'note', noteId: noteIds[2]! }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't8' }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-steering' }],
    [{ kind: 'mail', messageId: messageIds[12]! }, { kind: 'people_contact', contactId: contactIds[6]! }]
  ]
  for (const [a, b] of pairs) insertEntityLinkPair(db, a, b)
}

export function seedDemoConfig(): Record<string, unknown> {
  return {
    firstRunSetupCompleted: true,
    configSchemaVersion: 1,
    syncWindowDays: 30,
    mailPollIntervalSeconds: 120,
    microsoftMailTransport: 'graph',
    profileDataMode: 'local'
  }
}

export function seedDemoPackManifest(): Record<string, unknown> {
  return {
    version: 3,
    chronellMinVersion: '1.0.0',
    scenario: 'nordlicht-consulting',
    builtAt: formatISO(new Date())
  }
}
