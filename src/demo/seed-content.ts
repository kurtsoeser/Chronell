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
    { id: 1, account_id: DEMO_ACCOUNT_M365_ID, remote_id: 'inbox', name: 'Posteingang', well_known: 'inbox', unread: 18, total: 42 },
    { id: 2, account_id: DEMO_ACCOUNT_M365_ID, remote_id: 'sent', name: 'Gesendet', well_known: 'sentitems', unread: 0, total: 12 },
    { id: 3, account_id: DEMO_ACCOUNT_M365_ID, remote_id: 'drafts', name: 'Entwürfe', well_known: 'drafts', unread: 0, total: 3 },
    { id: 4, account_id: DEMO_ACCOUNT_GOOGLE_ID, remote_id: 'inbox', name: 'Posteingang', well_known: 'inbox', unread: 9, total: 18 },
    { id: 5, account_id: DEMO_ACCOUNT_GOOGLE_ID, remote_id: 'sent', name: 'Gesendet', well_known: 'sentitems', unread: 0, total: 6 },
    { id: 6, account_id: DEMO_ACCOUNT_M365_ID, remote_id: 'archive', name: 'Archiv', well_known: 'archive', unread: 0, total: 24 }
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
    { id: 1, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-kickoff', subject_normalized: 'Kick-off Projekt Nordlicht', last_message_at: isoDaysAgo(0, 8), message_count: 5 },
    { id: 2, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-budget', subject_normalized: 'Budget Q3 — Freigabe', last_message_at: isoDaysAgo(0, 11), message_count: 4 },
    { id: 3, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-stakeholder', subject_normalized: 'Stakeholder-Update', last_message_at: isoDaysAgo(1, 9), message_count: 3 },
    { id: 4, account_id: DEMO_ACCOUNT_GOOGLE_ID, remote_thread_id: 'thr-alpha', subject_normalized: 'Sprint Alpha', last_message_at: isoDaysAgo(0, 7), message_count: 5 },
    { id: 5, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-waiting', subject_normalized: 'Angebot Kunde Müller', last_message_at: isoDaysAgo(1, 15), message_count: 4 },
    { id: 6, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-legal', subject_normalized: 'NDA Schmidt AG', last_message_at: isoDaysAgo(0, 14), message_count: 3 },
    { id: 7, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-hr', subject_normalized: 'Onboarding Praktikantin', last_message_at: isoDaysAgo(2, 10), message_count: 2 },
    { id: 8, account_id: DEMO_ACCOUNT_GOOGLE_ID, remote_thread_id: 'thr-design', subject_normalized: 'Design System Alpha', last_message_at: isoDaysAgo(0, 16), message_count: 3 },
    { id: 9, account_id: DEMO_ACCOUNT_M365_ID, remote_thread_id: 'thr-marketing', subject_normalized: 'Launch-Kampagne Q3', last_message_at: isoDaysAgo(3, 12), message_count: 2 }
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
      snippet: 'Hallo Anna, anbei die Agenda für Montag — bitte offene Steering-Punkte vorbereiten.',
      body_html:
        '<p>Hallo Anna,</p><p>anbei die Agenda für unser Kick-off am Montag:</p><ol><li>Ziele Q3</li><li>Budget &amp; Ressourcen</li><li>Risiken</li><li>Nächste Meilensteine</li></ol><p>Bitte die offenen Punkte aus dem letzten Steering vorbereiten.</p><p>Liebe Grüße<br>Lisa</p>',
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
      snippet: 'Ich nehme den Budget-Block mit — Folien sind im Anhang.',
      body_html: '<p>Ich nehme den Budget-Block mit — Folien im Anhang. Siehe auch die Notiz im Chronell-Graph.</p>',
      body_text: 'Ich nehme den Budget-Block mit.',
      is_read: 0, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 3, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 2,
      remote_id: 'msg-budget-1', remote_thread_id: 'thr-budget',
      subject: 'Budget Q3 — Freigabe erforderlich',
      from_addr: 'finance@nordlicht-demo.local', from_name: 'Finanzen Nordlicht',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(4, 16), received_at: isoDaysAgo(4, 16),
      snippet: 'Bitte bis Freitag freigeben. Details in der angehängten Tabelle.',
      body_html: '<p>Hallo Anna,</p><p>bitte bis Freitag freigeben. Die Details sind in der angehängten Tabelle (CAPEX / OPEX getrennt).</p><p>Finanzen</p>',
      body_text: 'Bitte bis Freitag freigeben.',
      is_read: 1, is_flagged: 0, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 4, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-newsletter', remote_thread_id: null,
      subject: 'Chronell Insights — Newsletter September',
      from_addr: 'news@chronell-demo.local', from_name: 'Chronell Demo',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(5, 7), received_at: isoDaysAgo(5, 7),
      snippet: 'Neu in 1.3: Webinar-Einladungen, Teams-Vorlagen und Copilot im Composer.',
      body_html: '<p>Willkommen in der Demo-Umgebung von Chronell 1.3 — Webinare, Teams-Meetings und Copilot-Composer.</p>',
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
      snippet: 'Microsoft Teams-Besprechung — bitte Zusage bestätigen.',
      body_html: '<p>Teams-Meeting — siehe Kalendertermin „Steering Projekt Nordlicht“.</p><p><a href="https://teams.microsoft.com/demo/join">Jetzt beitreten</a></p>',
      body_text: 'Teams-Meeting — siehe Kalender.',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 6, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 1,
      remote_id: 'msg-kickoff-3', remote_thread_id: 'thr-kickoff',
      subject: 'Re: Kick-off — Raum & Catering',
      from_addr: 'sarah.klein@nordlicht-demo.local', from_name: 'Sarah Klein',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(1, 14), received_at: isoDaysAgo(1, 14),
      snippet: 'Raum B ist reserviert, Catering für 12 Personen bestätigt.',
      body_html: '<p>Raum B ist reserviert. Catering bestätigt für 12 Personen (vegetarische Option inklusive).</p>',
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
      snippet: 'Marketing-Posten bitte auf Q4 verschieben — siehe Anhang.',
      body_html: '<p>Marketing-Posten bitte auf Q4 verschieben — siehe Anhang mit der geänderten Aufteilung.</p>',
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
      snippet: 'Bitte bis morgen kommentieren — Fokus Meilensteine und Risiken.',
      body_html: '<p>Bitte bis morgen kommentieren. Fokus: Meilensteine und Risiken. Entwurf im Anhang (PDF).</p>',
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
      snippet: 'Wir warten noch auf Ihr Feedback zum Angebot vom letzten Montag.',
      body_html: '<p>Guten Tag Frau Weber,</p><p>wir warten noch auf Ihr Feedback zum Angebot vom letzten Montag. Gerne besprechen wir die Konditionen telefonisch.</p><p>Mit freundlichen Grüßen<br>Hans Müller</p>',
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
      snippet: 'Formular für externe Berater bis nächste Woche ausfüllen.',
      body_html: '<p>Bitte das VPN-Formular für externe Berater ausfüllen und an IT zurücksenden.</p>',
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
      snippet: 'Danke für die gute Session — nächste Schritte in der Projektnotiz.',
      body_html: '<p>Danke für die Session. Nächste Schritte habe ich in der Projektnotiz festgehalten.</p>',
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
      snippet: 'Zusammenfassung der Review — Demo-Daten und offene Punkte.',
      body_html: '<p>Sprint Review abgeschlossen. Highlights: Auth-Flow, Kalender-Sync. Offene Punkte im Board.</p>',
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
      snippet: '3 Blocker für Release — bitte priorisieren.',
      body_html: '<p>3 Blocker für Release (#127, #140, #152) — bitte heute priorisieren. Siehe Board in Notizen.</p>',
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
      snippet: 'Build #412 erfolgreich — Smoke-Tests grün.',
      body_html: '<p>Build #412 auf Staging deployed. Smoke-Tests grün. Artifact: alpha-staging-412.zip</p>',
      body_text: 'Build #412 deployed.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'low',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    // —— Erweiterte Inbox (M365) ——
    {
      id: 15, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 1,
      remote_id: 'msg-kickoff-4', remote_thread_id: 'thr-kickoff',
      subject: 'Re: Kick-off — Entscheidungsvorlage',
      from_addr: 'lisa.hoffmann@nordlicht-demo.local', from_name: 'Lisa Hoffmann',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(0, 8), received_at: isoDaysAgo(0, 8),
      snippet: 'Bitte die Entscheidungsvorlage bis 11 Uhr gegenlesen.',
      body_html: '<p>Anna, bitte die Entscheidungsvorlage bis 11 Uhr gegenlesen — dann schicken wir sie an den Lenkungskreis.</p>',
      body_text: 'Entscheidungsvorlage bis 11 Uhr gegenlesen.',
      is_read: 0, is_flagged: 1, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 16, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 2,
      remote_id: 'msg-budget-3', remote_thread_id: 'thr-budget',
      subject: 'Re: Budget Q3 — Freigabe erteilt (bedingt)',
      from_addr: 'finance@nordlicht-demo.local', from_name: 'Finanzen Nordlicht',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(0, 11), received_at: isoDaysAgo(0, 11),
      snippet: 'Bedingte Freigabe: Marketing bleibt in Q4, Rest freigegeben.',
      body_html: '<p>Bedingte Freigabe erteilt: Marketing bleibt in Q4, restliche Positionen freigegeben. Bitte SAP-Beleg prüfen.</p>',
      body_text: 'Bedingte Freigabe erteilt.',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 17, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 3,
      remote_id: 'msg-stakeholder-2', remote_thread_id: 'thr-stakeholder',
      subject: 'Re: Stakeholder-Update — Kommentare',
      from_addr: 'thomas.berger@nordlicht-demo.local', from_name: 'Thomas Berger',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(1, 9), received_at: isoDaysAgo(1, 9),
      snippet: 'Grafik auf Seite 3 angepasst — bitte finalisieren.',
      body_html: '<p>Grafik auf Seite 3 angepasst. Risiko „Lieferantenabhängigkeit“ ergänzt. Bitte finalisieren.</p>',
      body_text: 'Grafik angepasst, bitte finalisieren.',
      is_read: 0, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 18, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 5,
      remote_id: 'msg-waiting-2', remote_thread_id: 'thr-waiting',
      subject: 'Re: Angebot Müller — Gegenangebot',
      from_addr: 'kunde.mueller@extern-demo.local', from_name: 'Kunde Müller GmbH',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(1, 15), received_at: isoDaysAgo(1, 15),
      snippet: 'Gegenangebot: 8 % Rabatt bei 24-Monats-Laufzeit.',
      body_html: '<p>Wir können 8 % Rabatt bei 24-Monats-Laufzeit anbieten. Bitte bis Donnerstag Rückmeldung.</p>',
      body_text: 'Gegenangebot: 8 % bei 24 Monaten.',
      is_read: 0, is_flagged: 1, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: isoDaysFromNow(2)
    },
    {
      id: 19, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 6,
      remote_id: 'msg-legal-1', remote_thread_id: 'thr-legal',
      subject: 'NDA Schmidt AG — Entwurf zur Prüfung',
      from_addr: 'peter.lang@nordlicht-demo.local', from_name: 'Peter Lang',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(2, 14), received_at: isoDaysAgo(2, 14),
      snippet: 'Bitte Vertraulichkeitsklausel und Haftung gegenlesen.',
      body_html: '<p>Hallo Anna,</p><p>bitte NDA-Entwurf für Schmidt AG gegenlesen — Fokus Vertraulichkeit und Haftung. Deadline Freitag.</p>',
      body_text: 'NDA-Entwurf gegenlesen.',
      is_read: 0, is_flagged: 1, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 20, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 6,
      remote_id: 'msg-legal-2', remote_thread_id: 'thr-legal',
      subject: 'Re: NDA — Rückfrage Haftung',
      from_addr: 'anna.weber@nordlicht-demo.local', from_name: 'Anna Weber',
      to_addrs: 'peter.lang@nordlicht-demo.local', sent_at: isoDaysAgo(1, 11), received_at: isoDaysAgo(1, 11),
      snippet: 'Haftungsdeckelung auf Auftragswert ok? Bitte bestätigen.',
      body_html: '<p>Peter, Haftungsdeckelung auf Auftragswert erscheint mir ok — bitte rechtlich bestätigen.</p>',
      body_text: 'Haftungsdeckelung ok?',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 21, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 6,
      remote_id: 'msg-legal-3', remote_thread_id: 'thr-legal',
      subject: 'Re: NDA — Freigabe Legal',
      from_addr: 'peter.lang@nordlicht-demo.local', from_name: 'Peter Lang',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(0, 14), received_at: isoDaysAgo(0, 14),
      snippet: 'Legal freigegeben — bitte an Schmidt AG senden.',
      body_html: '<p>Legal freigegeben (mit Deckelung). Bitte final an Schmidt AG senden und Termin für Kick-off vorschlagen.</p>',
      body_text: 'Legal freigegeben.',
      is_read: 0, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 22, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 7,
      remote_id: 'msg-hr-1', remote_thread_id: 'thr-hr',
      subject: 'Onboarding Praktikantin — Checkliste',
      from_addr: 'elena.vogt@nordlicht-demo.local', from_name: 'Elena Vogt',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(3, 10), received_at: isoDaysAgo(3, 10),
      snippet: 'Laptop, Zugang und Mentorin bitte bis Montag klären.',
      body_html: '<p>Anna, bitte Laptop, Systemzugänge und Mentorin bis Montag klären. Checkliste im Anhang.</p>',
      body_text: 'Onboarding-Checkliste bis Montag.',
      is_read: 1, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 23, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 7,
      remote_id: 'msg-hr-2', remote_thread_id: 'thr-hr',
      subject: 'Re: Onboarding — Startdatum bestätigt',
      from_addr: 'elena.vogt@nordlicht-demo.local', from_name: 'Elena Vogt',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(2, 10), received_at: isoDaysAgo(2, 10),
      snippet: 'Start am 1. des Monats — Willkommensmail vorbereiten?',
      body_html: '<p>Start bestätigt. Soll ich die Willkommensmail vorbereiten oder übernimmst du das?</p>',
      body_text: 'Start bestätigt, Willkommensmail?',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 24, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 9,
      remote_id: 'msg-mkt-1', remote_thread_id: 'thr-marketing',
      subject: 'Launch-Kampagne Q3 — Assets',
      from_addr: 'julia.reiter@nordlicht-demo.local', from_name: 'Julia Reiter',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(4, 12), received_at: isoDaysAgo(4, 12),
      snippet: 'Landing-Page und Social-Assets zur Freigabe.',
      body_html: '<p>Landing-Page und Social-Assets liegen bereit. Bitte Freigabe bis Mittwoch — Launch am Freitag.</p>',
      body_text: 'Assets zur Freigabe.',
      is_read: 1, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 25, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: 9,
      remote_id: 'msg-mkt-2', remote_thread_id: 'thr-marketing',
      subject: 'Re: Launch — A/B-Test Varianten',
      from_addr: 'julia.reiter@nordlicht-demo.local', from_name: 'Julia Reiter',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(3, 12), received_at: isoDaysAgo(3, 12),
      snippet: 'Zwei Headline-Varianten — welche bevorzugst du?',
      body_html: '<p>Zwei Headline-Varianten im Anhang. Welche bevorzugst du für den Launch?</p>',
      body_text: 'Zwei Headline-Varianten.',
      is_read: 0, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 26, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-schmidt-intro', remote_thread_id: null,
      subject: 'Vorstellung — Schmidt AG / Digitalisierungsprojekt',
      from_addr: 'clara.schmidt@extern-demo.local', from_name: 'Clara Schmidt',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(0, 10), received_at: isoDaysAgo(0, 10),
      snippet: 'Freut mich auf die Zusammenarbeit — Terminvorschlag nächste Woche.',
      body_html: '<p>Sehr geehrte Frau Weber,</p><p>freut mich auf die Zusammenarbeit. Gerne Terminvorschlag für ein Kennenlernen nächste Woche.</p><p>Clara Schmidt<br>Schmidt AG</p>',
      body_text: 'Terminvorschlag Kennenlernen.',
      is_read: 0, is_flagged: 1, has_attachments: 0, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 27, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-travel', remote_thread_id: null,
      subject: 'Reisekosten Offsite Salzburg — Freigabe',
      from_addr: 'sarah.klein@nordlicht-demo.local', from_name: 'Sarah Klein',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(0, 12), received_at: isoDaysAgo(0, 12),
      snippet: 'Hotel und Bahn für Team-Offsite zur Freigabe.',
      body_html: '<p>Hotel und Bahn für das Team-Offsite in Salzburg liegen vor. Bitte Freigabe, damit ich buchen kann.</p>',
      body_text: 'Reisekosten Offsite freigeben.',
      is_read: 0, is_flagged: 0, has_attachments: 1, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 28, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-vendor', remote_thread_id: null,
      subject: 'Lieferant: Verzögerung Modul X',
      from_addr: 'vendor@extern-demo.local', from_name: 'TechSupply GmbH',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(1, 16), received_at: isoDaysAgo(1, 16),
      snippet: 'Lieferung verschiebt sich um 5 Werktage — Entschuldigung.',
      body_html: '<p>Leider verschiebt sich die Lieferung von Modul X um 5 Werktage. Neuer Liefertermin im Anhang.</p>',
      body_text: 'Lieferung Modul X verzögert.',
      is_read: 0, is_flagged: 1, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 29, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 3, thread_id: null,
      remote_id: 'msg-draft-1', remote_thread_id: null,
      subject: 'Entwurf: Antwort Gegenangebot Müller',
      from_addr: DEMO_ACCOUNT_M365_EMAIL, from_name: 'Anna Weber',
      to_addrs: 'kunde.mueller@extern-demo.local', sent_at: isoDaysAgo(0, 15), received_at: isoDaysAgo(0, 15),
      snippet: '(Entwurf) 5 % Rabatt bei 18 Monaten …',
      body_html: '<p>Sehr geehrter Herr Müller,</p><p>wir können 5 % bei 18 Monaten anbieten …</p>',
      body_text: 'Entwurf Gegenangebot.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 30, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 2, thread_id: null,
      remote_id: 'msg-sent-2', remote_thread_id: null,
      subject: 'Wochenstatus an Lenkungskreis',
      from_addr: DEMO_ACCOUNT_M365_EMAIL, from_name: 'Anna Weber',
      to_addrs: 'lisa.hoffmann@nordlicht-demo.local;thomas.berger@nordlicht-demo.local', sent_at: isoDaysAgo(1, 18), received_at: isoDaysAgo(1, 18),
      snippet: 'Kurzer Status: Budget bedingt freigegeben, Müller in Verhandlung.',
      body_html: '<p>Kurzer Status: Budget bedingt freigegeben, Müller in Verhandlung, Alpha Release on track.</p>',
      body_text: 'Wochenstatus.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    // —— Google / Alpha ——
    {
      id: 31, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: 4,
      remote_id: 'msg-alpha-3', remote_thread_id: 'thr-alpha',
      subject: 'Re: Alpha — Release Candidate',
      from_addr: 'marc.weber@nordlicht-demo.local', from_name: 'Marc Weber',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(0, 7), received_at: isoDaysAgo(0, 7),
      snippet: 'RC1 morgen — bitte QA-Checkliste abhaken.',
      body_html: '<p>RC1 morgen früh. Bitte QA-Checkliste in der Alpha-Notiz abhaken und Blocker im Bug-Board markieren.</p>',
      body_text: 'RC1 morgen, QA-Checkliste.',
      is_read: 0, is_flagged: 1, has_attachments: 0, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 32, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: 8,
      remote_id: 'msg-design-1', remote_thread_id: 'thr-design',
      subject: 'Design System Alpha — Tokens Review',
      from_addr: 'nina.hofer@nordlicht-demo.local', from_name: 'Nina Hofer',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(2, 15), received_at: isoDaysAgo(2, 15),
      snippet: 'Farb- und Spacing-Tokens zur Freigabe.',
      body_html: '<p>Farb- und Spacing-Tokens im Figma-Link. Bitte Review bis Donnerstag.</p>',
      body_text: 'Design Tokens Review.',
      is_read: 1, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 33, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: 8,
      remote_id: 'msg-design-2', remote_thread_id: 'thr-design',
      subject: 'Re: Design System — Dark Mode Kontrast',
      from_addr: 'nina.hofer@nordlicht-demo.local', from_name: 'Nina Hofer',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(0, 16), received_at: isoDaysAgo(0, 16),
      snippet: 'Kontrast-Fix für Bug #145 liegt bereit.',
      body_html: '<p>Kontrast-Fix für Bug #145 liegt bereit — bitte in Staging prüfen.</p>',
      body_text: 'Kontrast-Fix bereit.',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 34, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: 4,
      remote_id: 'msg-alpha-4', remote_thread_id: 'thr-alpha',
      subject: 'Alpha — Performance Report',
      from_addr: 'dev@nordlicht-demo.local', from_name: 'Dev Team',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(3, 17), received_at: isoDaysAgo(3, 17),
      snippet: 'LCP −18 % gegenüber letzter Woche.',
      body_html: '<p>Performance Report: LCP −18 %, CLS stabil. Details im Dashboard-Link.</p>',
      body_text: 'Performance Report.',
      is_read: 1, is_flagged: 0, has_attachments: 1, importance: 'low',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 35, account_id: DEMO_ACCOUNT_GOOGLE_ID, folder_id: 4, thread_id: null,
      remote_id: 'msg-sec-scan', remote_thread_id: null,
      subject: 'Security Scan Staging — 2 Medium Findings',
      from_addr: 'security@nordlicht-demo.local', from_name: 'Security Bot',
      to_addrs: DEMO_ACCOUNT_GOOGLE_EMAIL, sent_at: isoDaysAgo(0, 5), received_at: isoDaysAgo(0, 5),
      snippet: 'Zwei Medium-Findings vor RC1 schließen.',
      body_html: '<p>Security Scan: 2 Medium Findings. Bitte vor RC1 schließen. Report angehängt.</p>',
      body_text: '2 Medium Security Findings.',
      is_read: 0, is_flagged: 1, has_attachments: 1, importance: 'high',
      snoozed_until: null, snoozed_from_folder_id: null, waiting_for_reply_until: null
    },
    {
      id: 36, account_id: DEMO_ACCOUNT_M365_ID, folder_id: 1, thread_id: null,
      remote_id: 'msg-bookings', remote_thread_id: null,
      subject: 'Bookings: Neue Buchung — Beratungsgespräch',
      from_addr: 'noreply@bookings-demo.local', from_name: 'Microsoft Bookings',
      to_addrs: DEMO_ACCOUNT_M365_EMAIL, sent_at: isoDaysAgo(0, 9), received_at: isoDaysAgo(0, 9),
      snippet: 'Neue Buchung: Di 14:00 — Clara Schmidt.',
      body_html: '<p>Neue Bookings-Buchung: Di 14:00, Clara Schmidt (Schmidt AG). Termin liegt im Kalender.</p>',
      body_text: 'Neue Bookings-Buchung.',
      is_read: 0, is_flagged: 0, has_attachments: 0, importance: 'normal',
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
    { message_id: 12, account_id: DEMO_ACCOUNT_GOOGLE_ID, due_kind: 'this_week', due_at: dueDate(2) },
    { message_id: 15, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'today', due_at: dueDate(0) },
    { message_id: 18, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'tomorrow', due_at: dueDate(1) },
    { message_id: 19, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'this_week', due_at: dueDate(2) },
    { message_id: 26, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'today', due_at: dueDate(0) },
    { message_id: 28, account_id: DEMO_ACCOUNT_M365_ID, due_kind: 'today', due_at: dueDate(0) },
    { message_id: 31, account_id: DEMO_ACCOUNT_GOOGLE_ID, due_kind: 'today', due_at: dueDate(0) },
    { message_id: 35, account_id: DEMO_ACCOUNT_GOOGLE_ID, due_kind: 'today', due_at: dueDate(0) }
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
    // —— Aktuelle Woche ——
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
      const t = demoThisWeek(1, 14, 15)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-bookings-clara`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-bookings-clara', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Beratung — Clara Schmidt (Bookings)', ...t,
        location: 'Teams', web_link: null, join_url: 'https://teams.microsoft.com/demo/bookings',
        organizer: 'Anna Weber', categories_json: '["Kunde"]'
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
      const t = demoThisWeek(2, 15, 16)
      return {
        id: `${DEMO_ACCOUNT_GOOGLE_ID}:evt-review`,
        account_id: DEMO_ACCOUNT_GOOGLE_ID, source: 'google', graph_event_id: 'evt-review', graph_calendar_id: 'primary',
        account_email: DEMO_ACCOUNT_GOOGLE_EMAIL, account_color_class: 'bg-emerald-500',
        title: 'Sprint Review Alpha', ...t,
        location: 'Raum Gelb', web_link: null, join_url: null,
        organizer: 'Dev Team', categories_json: '["Alpha"]'
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
      const t = demoThisWeek(3, 13, 14)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-legal-sync`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-legal-sync', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Legal Sync — NDA Schmidt', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Peter Lang', categories_json: '["Legal"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(4, 9, 10)
      return {
        id: `${DEMO_ACCOUNT_GOOGLE_ID}:evt-alpha-standup`,
        account_id: DEMO_ACCOUNT_GOOGLE_ID, source: 'google', graph_event_id: 'evt-alpha-standup', graph_calendar_id: 'primary',
        account_email: DEMO_ACCOUNT_GOOGLE_EMAIL, account_color_class: 'bg-emerald-500',
        title: 'Alpha Stand-up', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Marc Weber', categories_json: '["Alpha"]'
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
      const t = demoToday(11, 12)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-mueller-call`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-mueller-call', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Anruf — Gegenangebot Müller', ...t,
        location: 'Telefon', web_link: null, join_url: null,
        organizer: 'Anna Weber', categories_json: '["Kunde"]'
      }
    })(),
    (() => {
      const t = demoToday(14, 16)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-focus`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-focus', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Fokuszeit — Budget & Stakeholder', ...t,
        location: null, web_link: null, join_url: null,
        organizer: 'Anna Weber', categories_json: '["Deep Work"]'
      }
    })(),
    (() => {
      const t = demoToday(16, 17)
      return {
        id: `${DEMO_ACCOUNT_GOOGLE_ID}:evt-qa-sync`,
        account_id: DEMO_ACCOUNT_GOOGLE_ID, source: 'google', graph_event_id: 'evt-qa-sync', graph_calendar_id: 'primary',
        account_email: DEMO_ACCOUNT_GOOGLE_EMAIL, account_color_class: 'bg-emerald-500',
        title: 'QA Sync vor RC1', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Marc Weber', categories_json: '["Alpha"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(2, 8, 9)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-marketing`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-marketing', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Launch-Kampagne Sync', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Julia Reiter', categories_json: '["Marketing"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(3, 15, 16)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-hr-onboard`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-hr-onboard', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Onboarding-Abstimmung HR', ...t,
        location: 'Büro', web_link: null, join_url: null,
        organizer: 'Elena Vogt', categories_json: '["HR"]'
      }
    })(),
    // —— Später im Monat ——
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
      const t = demoDaysAheadInMonth(6, 11, 12)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-schmidt-kick`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-schmidt-kick', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Kennenlernen Schmidt AG', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Clara Schmidt', categories_json: '["Kunde"]'
      }
    })(),
    (() => {
      const t = demoThisMonth(15, 13, 17)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-training`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-training', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Schulung Chronell 1.3', ...t,
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
      const t = demoDaysAheadInMonth(4, 16, 17)
      return {
        id: `${DEMO_ACCOUNT_GOOGLE_ID}:evt-design-crit`,
        account_id: DEMO_ACCOUNT_GOOGLE_ID, source: 'google', graph_event_id: 'evt-design-crit', graph_calendar_id: 'primary',
        account_email: DEMO_ACCOUNT_GOOGLE_EMAIL, account_color_class: 'bg-emerald-500',
        title: 'Design Critique — Tokens', ...t,
        location: 'Figma + Teams', web_link: null, join_url: null,
        organizer: 'Nina Hofer', categories_json: '["Design"]'
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
    })(),
    (() => {
      const t = demoDaysAheadInMonth(3, 10, 11)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-vendor`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-vendor', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Lieferanten-Call TechSupply', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Thomas Berger', categories_json: '["Lieferant"]'
      }
    })(),
    (() => {
      const t = demoThisWeek(1, 16, 17)
      return {
        id: `${DEMO_ACCOUNT_M365_ID}:evt-finance`,
        account_id: DEMO_ACCOUNT_M365_ID, source: 'microsoft', graph_event_id: 'evt-finance', graph_calendar_id: 'cal-primary',
        account_email: DEMO_ACCOUNT_M365_EMAIL, account_color_class: 'bg-blue-500',
        title: 'Budget-Nachbesprechung Finanzen', ...t,
        location: 'Teams', web_link: null, join_url: null,
        organizer: 'Finanzen Nordlicht', categories_json: '["Budget"]'
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
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't1', title: 'Budget Q3 freigeben', completed: 0, due_iso: dueDate(0), notes: 'Heute — bedingte Freigabe prüfen' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't2', title: 'Kick-off Agenda prüfen', completed: 1, due_iso: overdueDate(1), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't3', title: 'Stakeholder-Update finalisieren', completed: 0, due_iso: dueDate(1), notes: 'Morgen — Grafik Seite 3' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't4', title: 'Angebot Müller — Gegenangebot beantworten', completed: 0, due_iso: overdueDate(0), notes: 'Überfällig / Waiting for' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't5', title: 'VPN-Formular IT', completed: 0, due_iso: dueDate(2), notes: 'Mail gesnoozed' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't8', title: 'Steering-Unterlagen senden', completed: 0, due_iso: dueDate(0), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't9', title: 'Feedback Workshop einholen', completed: 0, due_iso: dueDate(3), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't10', title: 'Projektstatus für Lisa', completed: 0, due_iso: dueDate(4), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't12', title: 'NDA Schmidt AG versenden', completed: 0, due_iso: dueDate(0), notes: 'Legal freigegeben' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't13', title: 'Terminvorschlag Clara Schmidt', completed: 0, due_iso: dueDate(0), notes: 'Aus Intro-Mail' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't14', title: 'Reisekosten Offsite freigeben', completed: 0, due_iso: dueDate(1), notes: 'Sarah wartet' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't15', title: 'Lieferverzögerung Modul X eskalieren', completed: 0, due_iso: dueDate(0), notes: 'Risiko im Stakeholder-Update' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't16', title: 'Launch-Headline wählen', completed: 0, due_iso: dueDate(2), notes: 'Julia Marketing' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-default', task_id: 't17', title: 'Onboarding Willkommensmail', completed: 0, due_iso: dueDate(3), notes: 'HR Elena' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't6', title: 'Risikoliste aktualisieren', completed: 0, due_iso: dueDate(5), notes: 'Lieferant + Budget' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't7', title: 'Meilenstein-Plan Monatsende', completed: 0, due_iso: dueDate(Math.min(12, getDaysInMonth(new Date()) - new Date().getDate())), notes: 'Im aktuellen Monat' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't11', title: 'Lieferantenvertrag prüfen', completed: 0, due_iso: null, notes: 'Ohne Fälligkeit' },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't18', title: 'Q4 Budget-Vorschau skizzieren', completed: 0, due_iso: dueDate(10), notes: null },
    { account_id: DEMO_ACCOUNT_M365_ID, list_id: 'todo-planning', task_id: 't19', title: 'Offsite Agenda vorbereiten', completed: 0, due_iso: dueDate(14), notes: 'Salzburg' },
    // Google Alpha
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g1', title: 'API-Mock für Alpha', completed: 0, due_iso: dueDate(0), notes: 'Heute' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g2', title: 'UI-Review Notizen', completed: 0, due_iso: dueDate(1), notes: 'Siehe Chronell-Notiz' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g3', title: 'Release Notes Alpha', completed: 0, due_iso: dueDate(6), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g6', title: 'Staging-Smoke-Tests', completed: 0, due_iso: dueDate(2), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g7', title: 'Demo-Datenpaket reviewen', completed: 0, due_iso: dueDate(3), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g10', title: 'QA-Checkliste RC1 abhaken', completed: 0, due_iso: dueDate(0), notes: 'Vor morgen' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g11', title: 'Design Tokens freigeben', completed: 0, due_iso: dueDate(2), notes: 'Nina' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-tasks-1', task_id: 'g12', title: 'Security Findings schließen', completed: 0, due_iso: dueDate(0), notes: '2 Medium' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g4', title: 'Bug #127 — Login Timeout', completed: 0, due_iso: dueDate(0), notes: 'Blocker — heute' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g5', title: 'Bug #131 — Export CSV', completed: 1, due_iso: overdueDate(3), notes: null },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g8', title: 'Bug #140 — Kalender-Sync', completed: 0, due_iso: overdueDate(1), notes: 'Überfällig' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g9', title: 'Bug #145 — Dark Mode Kontrast', completed: 0, due_iso: dueDate(1), notes: 'Fix von Nina bereit' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g13', title: 'Bug #152 — Attachment Preview', completed: 0, due_iso: dueDate(0), notes: 'Blocker RC1' },
    { account_id: DEMO_ACCOUNT_GOOGLE_ID, list_id: 'google-bugs', task_id: 'g14', title: 'Bug #158 — Search lag', completed: 0, due_iso: dueDate(4), notes: null }
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
    { id: 5, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-mueller', display_name: 'Hans Müller', given_name: 'Hans', surname: 'Müller', company: 'Müller GmbH', job_title: 'Einkauf', primary_email: 'kunde.mueller@extern-demo.local', emails_json: null, is_favorite: 1 },
    { id: 6, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-it', display_name: 'IT Support', given_name: null, surname: null, company: 'Nordlicht Consulting', job_title: 'IT', primary_email: 'it@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 7, account_id: DEMO_ACCOUNT_GOOGLE_ID, provider: 'google', remote_id: 'c-marc', display_name: 'Marc Weber', given_name: 'Marc', surname: 'Weber', company: 'Nordlicht Consulting', job_title: 'Tech Lead Alpha', primary_email: 'marc.weber@nordlicht-demo.local', emails_json: null, is_favorite: 1 },
    { id: 8, account_id: DEMO_ACCOUNT_GOOGLE_ID, provider: 'google', remote_id: 'c-dev', display_name: 'Dev Team', given_name: null, surname: null, company: 'Nordlicht Consulting', job_title: 'Distribution List', primary_email: 'dev@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 9, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-peter', display_name: 'Peter Lang', given_name: 'Peter', surname: 'Lang', company: 'Nordlicht Consulting', job_title: 'Legal Counsel', primary_email: 'peter.lang@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 10, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-elena', display_name: 'Elena Vogt', given_name: 'Elena', surname: 'Vogt', company: 'Nordlicht Consulting', job_title: 'HR Business Partner', primary_email: 'elena.vogt@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 11, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-julia', display_name: 'Julia Reiter', given_name: 'Julia', surname: 'Reiter', company: 'Nordlicht Consulting', job_title: 'Marketing Lead', primary_email: 'julia.reiter@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 12, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-clara', display_name: 'Clara Schmidt', given_name: 'Clara', surname: 'Schmidt', company: 'Schmidt AG', job_title: 'Digital Transformation', primary_email: 'clara.schmidt@extern-demo.local', emails_json: null, is_favorite: 1 },
    { id: 13, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-vendor', display_name: 'TechSupply GmbH', given_name: null, surname: null, company: 'TechSupply GmbH', job_title: 'Lieferant', primary_email: 'vendor@extern-demo.local', emails_json: null, is_favorite: 0 },
    { id: 14, account_id: DEMO_ACCOUNT_GOOGLE_ID, provider: 'google', remote_id: 'c-nina', display_name: 'Nina Hofer', given_name: 'Nina', surname: 'Hofer', company: 'Nordlicht Consulting', job_title: 'Product Designer', primary_email: 'nina.hofer@nordlicht-demo.local', emails_json: null, is_favorite: 1 },
    { id: 15, account_id: DEMO_ACCOUNT_GOOGLE_ID, provider: 'google', remote_id: 'c-sec', display_name: 'Security Bot', given_name: null, surname: null, company: 'Nordlicht Consulting', job_title: 'Automation', primary_email: 'security@nordlicht-demo.local', emails_json: null, is_favorite: 0 },
    { id: 16, account_id: DEMO_ACCOUNT_M365_ID, provider: 'microsoft', remote_id: 'c-anna', display_name: 'Anna Weber', given_name: 'Anna', surname: 'Weber', company: 'Nordlicht Consulting', job_title: 'Projektleitung (Demo)', primary_email: DEMO_ACCOUNT_M365_EMAIL, emails_json: null, is_favorite: 0 }
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
           (4, 'Quick Capture', 'zap', '#f59e0b', 2, NULL, datetime('now'), datetime('now')),
           (5, 'Kunden', 'users', '#ec4899', 3, NULL, datetime('now'), datetime('now')),
           (6, 'Legal & HR', 'scale', '#64748b', 4, NULL, datetime('now'), datetime('now'))
  `).run()

  const noteStmt = db.prepare(`
    INSERT INTO user_notes (id, kind, message_id, account_id, title, body, created_at, updated_at, section_id)
    VALUES (@id, @kind, @message_id, @account_id, @title, @body, datetime('now'), datetime('now'), @section_id)
  `)

  const notes = [
    {
      id: 1, kind: 'standalone', message_id: null, account_id: null,
      title: 'Projektübersicht',
      body: '<h2>Nordlicht Q3</h2><p>Zentrale Notiz mit <strong>Verknüpfungen</strong> zu Mail, Terminen und Aufgaben.</p><p>Siehe auch [[Stakeholder-Update]] und [[Risiken &amp; Lieferanten]].</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true">Kick-off vorbereiten</li><li data-type="taskItem" data-checked="false">Budget final freigeben</li><li data-type="taskItem" data-checked="false">Müller-Verhandlung abschließen</li><li data-type="taskItem" data-checked="false">Schmidt AG onboarden</li></ul>',
      section_id: 1
    },
    {
      id: 2, kind: 'mail', message_id: messageIds[0], account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Notiz zur Kick-off-Mail',
      body: '<p>Antwort an Lisa bis Montag — Budget-Block mit Thomas abstimmen. Entscheidungsvorlage gegenlesen.</p>',
      section_id: 2
    },
    {
      id: 3, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_GOOGLE_ID,
      title: 'Alpha Sprint 12',
      body: '<h3>Release Candidate</h3><p>Review-Ergebnisse und offene Punkte für RC1.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Bug #127 Login Timeout</li><li data-type="taskItem" data-checked="false">Bug #152 Attachment Preview</li><li data-type="taskItem" data-checked="false">Security Findings</li><li data-type="taskItem" data-checked="true">Export CSV (#131)</li></ul>',
      section_id: 3
    },
    {
      id: 4, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Stakeholder-Update',
      body: '<h3>Entwurf</h3><p>Meilensteine grün, Budget gelb (Marketing → Q4), Lieferrisiko Modul X rot. Nächster Steering: siehe Kalender.</p><p>Grafik Seite 3 von Thomas aktualisiert.</p>',
      section_id: 1
    },
    {
      id: 5, kind: 'mail', message_id: messageIds[7], account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Kommentare Stakeholder-Mail',
      body: '<p>Lisa: Fokus auf Risiken. Thomas: Grafik auf Seite 3 anpassen — erledigt.</p>',
      section_id: 2
    },
    {
      id: 6, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Meeting-Notiz Steering',
      body: '<p>Teilnehmer: Lisa, Thomas, Anna</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true">Agenda versenden</li><li data-type="taskItem" data-checked="false">Budget bis Freitag</li><li data-type="taskItem" data-checked="false">Workshop-Einladungen</li></ul>',
      section_id: 2
    },
    {
      id: 7, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_GOOGLE_ID,
      title: 'Alpha Architektur',
      body: '<p>API-Gateway → Mock-Services. Auth-Flow stabil. Embed: <a href="https://example.com">Dokumentation</a></p><p>Performance: LCP −18 %.</p>',
      section_id: 3
    },
    {
      id: 8, kind: 'standalone', message_id: null, account_id: null,
      title: 'Quick Capture — Ideen',
      body: '<p>• Demo-Pack regelmäßig zurücksetzen<br>• Screenshots für Homepage mit echten Daten<br>• Webinar-Vorlage für Schmidt AG prüfen</p>',
      section_id: 4
    },
    {
      id: 9, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Kunde Müller — Verhandlung',
      body: '<h3>Stand</h3><p>Gegenangebot: 8 % bei 24 Monaten. Unser Ziel: 5 % bei 18 Monaten (Entwurf in Posteingang).</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Anruf heute 11:00</li><li data-type="taskItem" data-checked="false">Konditionen mit Finanzen abstimmen</li></ul>',
      section_id: 5
    },
    {
      id: 10, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Schmidt AG — Pipeline',
      body: '<p>Clara Schmidt (Digital Transformation). NDA legal freigegeben. Bookings-Termin Di 14:00. Kick-off-Termin vorschlagen.</p>',
      section_id: 5
    },
    {
      id: 11, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Risiken & Lieferanten',
      body: '<p><strong>Modul X</strong> (TechSupply): +5 Werktage Verzögerung. Eskalation und Auswirkung auf Meilenstein M3 dokumentieren.</p>',
      section_id: 1
    },
    {
      id: 12, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'NDA Checkliste',
      body: '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">Entwurf prüfen</li><li data-type="taskItem" data-checked="true">Haftungsdeckelung bestätigt</li><li data-type="taskItem" data-checked="false">An Schmidt AG senden</li><li data-type="taskItem" data-checked="false">Signatur tracken</li></ul>',
      section_id: 6
    },
    {
      id: 13, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Onboarding Praktikantin',
      body: '<p>Startdatum Monatsanfang. Laptop + Zugänge + Mentorin. Willkommensmail mit Elena abstimmen.</p>',
      section_id: 6
    },
    {
      id: 14, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_GOOGLE_ID,
      title: 'Design System Tokens',
      body: '<p>Farb- und Spacing-Tokens von Nina. Dark-Mode-Kontrast (#145) Fix bereit für Staging.</p>',
      section_id: 3
    },
    {
      id: 15, kind: 'standalone', message_id: null, account_id: DEMO_ACCOUNT_M365_ID,
      title: 'Launch-Kampagne Q3',
      body: '<p>Assets und A/B-Headlines von Julia. Freigabe bis Mittwoch, Launch Freitag.</p>',
      section_id: 1
    },
    {
      id: 16, kind: 'standalone', message_id: null, account_id: null,
      title: 'Wochenfokus',
      body: '<ol><li>Müller-Verhandlung</li><li>RC1 Alpha</li><li>NDA raus</li><li>Stakeholder-Update final</li></ol>',
      section_id: 4
    }
  ]
  for (const n of notes) noteStmt.run(n)
  return { noteIds: notes.map((n) => n.id), sectionIds: [1, 2, 3, 4, 5, 6] }
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
    // Nordlicht / Kick-off / Steering
    [{ kind: 'mail', messageId: messageIds[0]! }, { kind: 'note', noteId: noteIds[1]! }],
    [{ kind: 'note', noteId: noteIds[0]! }, { kind: 'people_contact', contactId: contactIds[0]! }],
    [{ kind: 'note', noteId: noteIds[0]! }, { kind: 'note', noteId: noteIds[3]! }],
    [{ kind: 'note', noteId: noteIds[0]! }, { kind: 'note', noteId: noteIds[10]! }],
    [{ kind: 'mail', messageId: messageIds[2]! }, { kind: 'people_contact', contactId: contactIds[2]! }],
    [{ kind: 'mail', messageId: messageIds[4]! }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-steering' }],
    [{ kind: 'note', noteId: noteIds[5]! }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-steering' }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't1' }, { kind: 'mail', messageId: messageIds[2]! }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't8' }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-steering' }],
    [{ kind: 'mail_todo', todoId: todoIds[0]! }, { kind: 'note', noteId: noteIds[1]! }],
    [{ kind: 'people_contact', contactId: contactIds[0]! }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-1on1' }],
    [{ kind: 'note', noteId: noteIds[3]! }, { kind: 'mail', messageId: messageIds[7]! }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't3' }, { kind: 'note', noteId: noteIds[3]! }],
    // Müller
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't4' }, { kind: 'mail', messageId: messageIds[8]! }],
    [{ kind: 'people_contact', contactId: contactIds[4]! }, { kind: 'mail', messageId: messageIds[8]! }],
    [{ kind: 'people_contact', contactId: contactIds[4]! }, { kind: 'note', noteId: noteIds[8]! }],
    [{ kind: 'note', noteId: noteIds[8]! }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-mueller-call' }],
    [{ kind: 'mail', messageId: messageIds[17]! }, { kind: 'note', noteId: noteIds[8]! }],
    [{ kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-client' }, { kind: 'people_contact', contactId: contactIds[4]! }],
    // Schmidt / Legal
    [{ kind: 'mail', messageId: messageIds[18]! }, { kind: 'people_contact', contactId: contactIds[8]! }],
    [{ kind: 'mail', messageId: messageIds[18]! }, { kind: 'note', noteId: noteIds[11]! }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't12' }, { kind: 'note', noteId: noteIds[11]! }],
    [{ kind: 'people_contact', contactId: contactIds[11]! }, { kind: 'mail', messageId: messageIds[25]! }],
    [{ kind: 'people_contact', contactId: contactIds[11]! }, { kind: 'note', noteId: noteIds[9]! }],
    [{ kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-bookings-clara' }, { kind: 'people_contact', contactId: contactIds[11]! }],
    [{ kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-legal-sync' }, { kind: 'note', noteId: noteIds[11]! }],
    // Lieferant / Risiken
    [{ kind: 'mail', messageId: messageIds[27]! }, { kind: 'people_contact', contactId: contactIds[12]! }],
    [{ kind: 'mail', messageId: messageIds[27]! }, { kind: 'note', noteId: noteIds[10]! }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-default', taskId: 't15' }, { kind: 'note', noteId: noteIds[10]! }],
    [{ kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-vendor' }, { kind: 'people_contact', contactId: contactIds[12]! }],
    // HR / Marketing / Offsite
    [{ kind: 'mail', messageId: messageIds[21]! }, { kind: 'people_contact', contactId: contactIds[9]! }],
    [{ kind: 'note', noteId: noteIds[12]! }, { kind: 'people_contact', contactId: contactIds[9]! }],
    [{ kind: 'mail', messageId: messageIds[23]! }, { kind: 'note', noteId: noteIds[14]! }],
    [{ kind: 'people_contact', contactId: contactIds[10]! }, { kind: 'note', noteId: noteIds[14]! }],
    [{ kind: 'mail', messageId: messageIds[26]! }, { kind: 'calendar_event', accountId: DEMO_ACCOUNT_M365_ID, graphEventId: 'evt-offsite' }],
    // Alpha / Google
    [{ kind: 'note', noteId: noteIds[2]! }, { kind: 'cloud_task', accountId: DEMO_ACCOUNT_GOOGLE_ID, listId: 'google-bugs', taskId: 'g4' }],
    [{ kind: 'note', noteId: noteIds[2]! }, { kind: 'cloud_task', accountId: DEMO_ACCOUNT_GOOGLE_ID, listId: 'google-bugs', taskId: 'g13' }],
    [{ kind: 'people_contact', contactId: contactIds[6]! }, { kind: 'note', noteId: noteIds[2]! }],
    [{ kind: 'calendar_event', accountId: DEMO_ACCOUNT_GOOGLE_ID, graphEventId: 'evt-review' }, { kind: 'note', noteId: noteIds[2]! }],
    [{ kind: 'mail', messageId: messageIds[12]! }, { kind: 'people_contact', contactId: contactIds[6]! }],
    [{ kind: 'mail', messageId: messageIds[30]! }, { kind: 'cloud_task', accountId: DEMO_ACCOUNT_GOOGLE_ID, listId: 'google-tasks-1', taskId: 'g10' }],
    [{ kind: 'mail', messageId: messageIds[34]! }, { kind: 'cloud_task', accountId: DEMO_ACCOUNT_GOOGLE_ID, listId: 'google-tasks-1', taskId: 'g12' }],
    [{ kind: 'people_contact', contactId: contactIds[13]! }, { kind: 'note', noteId: noteIds[13]! }],
    [{ kind: 'cloud_task', accountId: DEMO_ACCOUNT_GOOGLE_ID, listId: 'google-bugs', taskId: 'g9' }, { kind: 'note', noteId: noteIds[13]! }],
    [{ kind: 'calendar_event', accountId: DEMO_ACCOUNT_GOOGLE_ID, graphEventId: 'evt-qa-sync' }, { kind: 'note', noteId: noteIds[2]! }],
    [{ kind: 'note', noteId: noteIds[0]! }, { kind: 'cloud_task', accountId: DEMO_ACCOUNT_M365_ID, listId: 'todo-planning', taskId: 't6' }]
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
    version: 4,
    chronellMinVersion: '1.3.0',
    scenario: 'nordlicht-consulting',
    builtAt: formatISO(new Date())
  }
}
