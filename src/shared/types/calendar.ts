import type { CalendarIncludeCalendarRef } from './account'
import type { ComposeAttachment, ComposeReferenceAttachment } from './compose'

export interface CalendarEventView {
  id: string
  source: 'microsoft' | 'google'
  accountId: string
  accountEmail: string
  accountColorClass: string
  /** Anzeigefarbe aus MS365 (`calendar.hexColor` / Kalenderfarbe), sonst null → Kontenfarbe. */
  displayColorHex?: string | null
  /** Kalender-ID (Graph oder Google), fuer Loeschen/Patchen. */
  graphCalendarId?: string | null
  /** Termin-ID (Graph oder Google). */
  graphEventId?: string
  title: string
  startIso: string
  endIso: string
  isAllDay: boolean
  location: string | null
  webLink: string | null
  joinUrl: string | null
  organizer: string | null
  /** Outlook/Graph `categories` (Masterkategorien-Namen). */
  categories?: string[]
  /** false: Kalender erlaubt keine Aenderungen (z. B. Google `reader`). */
  calendarCanEdit?: boolean
  /** Lokales Anzeige-Icon (`calendar-event-icons`), nicht mit Graph/Google synchronisiert. */
  icon?: string | null
}

/** Lokales Termin-Icon setzen/entfernen. */
export interface CalendarPatchEventIconInput {
  accountId: string
  graphEventId: string
  /** `calendar-event-icons` ID oder null/leer = Standard (kein Icon). */
  iconId?: string | null
}

/** Kalender-Ordner unter einem Konto (Graph `GET /me/calendars` oder Google `calendarList`). */
export interface CalendarGraphCalendarRow {
  id: string
  name: string
  isDefaultCalendar: boolean
  /** Graph `calendarColor` (z. B. lightBlue), wenn kein hexColor gesetzt. */
  color?: string | null
  /** In Outlook/365 gewaehlte Farbe; Vorrang vor `color`. */
  hexColor?: string | null
  /** Nur MailClient: Anzeigefarbe bei schreibgeschuetzten/abonnierten Kalendern. */
  displayColorOverrideHex?: string | null
  /** Graph `canEdit`; `false` z. B. bei rein freigegebenen Kalendern (Farbe nicht aenderbar). */
  canEdit?: boolean
  /** Standard: Microsoft Graph; `google` fuer Google Calendar API. */
  provider?: 'microsoft' | 'google'
  /** Google Calendar: `owner` / `writer` / `reader` / … */
  accessRole?: string | null
  /** Microsoft 365: Kalender einer Unified Group (`m365g:{groupId}`), lazy geladen. */
  calendarKind?: 'standard' | 'm365Group'
}

/** Paginierte Antwort von `calendar:list-ms365-group-calendars`. */
export interface CalendarM365GroupCalendarsPage {
  calendars: CalendarGraphCalendarRow[]
  /** Anzahl Unified Groups (nach Sortierung, inkl. ohne ladbarer Kalender). */
  totalGroups: number
  offset: number
  limit: number
  hasMore: boolean
}

/** Argumente fuer `calendar.listEventsForContact` (lokaler Cache). */
export interface CalendarListEventsForContactInput {
  emails: string[]
  startIso: string
  endIso: string
  limit?: number
}

/** Argumente fuer `calendar.listEvents` (IPC `calendar:list-events`). */
export interface CalendarListEventsInput {
  startIso: string
  endIso: string
  /**
   * Wenn gesetzt: nur Termine aus diesem Kalender (Konto + Graph-Kalender-ID).
   * Vorrang vor `includeCalendars`.
   */
  focusCalendar?: { accountId: string; graphCalendarId: string } | null
  /**
   * Wenn gesetzt: nur diese Kalender abfragen (leeres Array = keine Cloud-Termine).
   * Wenn nicht gesetzt: alle Kalender aller verbundenen Konten wie zuvor.
   */
  includeCalendars?: CalendarIncludeCalendarRef[] | null
  /** Cache ignorieren und von der Cloud neu laden (wenn online). */
  forceRefresh?: boolean
}

/** Argumente fuer `calendar.listCalendars` (IPC `calendar:list-calendars`). */
export interface CalendarListCalendarsInput {
  accountId: string
  /** Wenn true: Cache ignorieren und neu von der API laden (nur Google; Microsoft unveraendert). */
  forceRefresh?: boolean
}

/** Lokaler Kalender-Sync-Stand pro Konto (`calendar:get-account-sync-states`). */
export interface CalendarAccountSyncStateRow {
  accountId: string
  hasSynced: boolean
}

/** Serienfrequenz beim Anlegen (UI + API-Mapping). */
export type CalendarRecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

/** Ende der Serie: unbegrenzt, bis Datum, oder nach N Vorkommen (inkl. erstem Termin). */
export type CalendarRecurrenceRangeEndMode = 'never' | 'until' | 'count'

/** Serientermin nur beim **Anlegen** (Microsoft Graph `recurrence` / Google `RRULE`). */
export interface CalendarSaveEventRecurrence {
  frequency: CalendarRecurrenceFrequency
  rangeEnd: CalendarRecurrenceRangeEndMode
  /** Für weekly/biweekly: ausgewählte Wochentage (`monday`..`sunday`). */
  weekdays?: Array<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  >
  /** `YYYY-MM-DD`, wenn `rangeEnd === 'until'` */
  untilDate?: string | null
  /** Wenn `rangeEnd === 'count'`: 1–999 (inkl. erstem Termin). */
  count?: number | null
}

/** Ein Termin aus einer .ics-Datei (Vorschau fuer Import-Dialog). */
export interface CalendarIcsImportEventPreview {
  uid: string | null
  summary: string
  startIso: string
  endIso: string
  isAllDay: boolean
  location: string | null
  bodyHtml: string | null
  descriptionPlain: string | null
}

export interface CalendarParseIcsFileResult {
  filePath: string | null
  fileName: string | null
  events: CalendarIcsImportEventPreview[]
  warnings: string[]
}

/** Einfacher Termin (ohne Teams) anlegen oder aktualisieren — Microsoft Graph. */
export interface CalendarSaveEventInput {
  accountId: string
  /** Graph-Kalender-ID; `null`/`undefined` = Standard (`POST /me/events`). */
  graphCalendarId?: string | null
  subject: string
  startIso: string
  endIso: string
  isAllDay: boolean
  location?: string | null
  bodyHtml?: string | null
  /** Outlook-Kategorien (max. 25 Namen). */
  categories?: string[] | null
  /** Teilnehmer-Einladungen (Graph `attendees` / Google `attendees` + `sendUpdates`). Beim PATCH: gesamte Liste ersetzen. */
  attendeeEmails?: string[] | null
  /** Microsoft 365: Teams-Besprechung (`isOnlineMeeting` / `onlineMeetingProvider`) — nicht fuer Ganztage. Einladungen unabhaengig davon. */
  teamsMeeting?: boolean | null
  /** Dateianhaenge (Microsoft Graph fileAttachment / Google Drive). */
  attachments?: ComposeAttachment[] | null
  /** Microsoft 365: OneDrive/SharePoint als referenceAttachment. */
  referenceAttachments?: ComposeReferenceAttachment[] | null
  /** Serientermin (nur Anlegen; Bearbeiten der Serie ist nicht implementiert). */
  recurrence?: CalendarSaveEventRecurrence | null
  /** Microsoft 365: Graph `isReminderOn` / `reminderMinutesBeforeStart`. */
  reminderMinutesBeforeStart?: number | null
  /** IANA-Zeitzone fuer Start/Ende (nur zeitgebundene Termine). */
  timeZone?: string | null
}

export interface CalendarSaveEventResult {
  id: string
  webLink: string | null
  /** Microsoft 365: Teams-Beitrittslink (`onlineMeeting.joinUrl`), falls vorhanden. */
  joinUrl?: string | null
  /** Sofort aus lokalem Cache — fuer optimistische Kalender-Aktualisierung in der UI. */
  event?: CalendarEventView
}

export interface CalendarUpdateEventInput extends CalendarSaveEventInput {
  graphEventId: string
}

/** Microsoft 365: Einzeltermin fuer Dialog (Teilnehmer, Teams-Link). */
export interface CalendarGetEventInput {
  accountId: string
  graphEventId: string
  graphCalendarId?: string | null
  /** Cache ignorieren und von Graph neu laden (wenn online). */
  forceRefresh?: boolean
  /** Nur lokale Detail-Cache-Zeile (kein Netzwerk) — z. B. vor Drag/Resize. */
  cacheOnly?: boolean
}

export type CalendarEventAttachmentKind = 'file' | 'reference' | 'google_drive'

/** Anhang-Metadaten eines Kalendertermins (Remote). */
export interface CalendarEventAttachmentMeta {
  id: string
  name: string
  contentType: string | null
  size: number | null
  kind: CalendarEventAttachmentKind
  /** Cloud-Anhang / Google Drive: URL zum Oeffnen im Browser. */
  sourceUrl?: string | null
  isInline?: boolean
}

export interface CalendarListEventAttachmentsInput {
  accountId: string
  graphEventId: string
  graphCalendarId?: string | null
}

export interface CalendarEventAttachmentActionInput extends CalendarListEventAttachmentsInput {
  attachmentId: string
}

export interface CalendarGetEventResult {
  subject: string | null
  attendeeEmails: string[]
  joinUrl: string | null
  isOnlineMeeting: boolean
  /** Roh-HTML aus Graph (`body.contentType=html`) bzw. Google `description` (oft HTML). */
  bodyHtml: string | null
  location?: string | null
  organizer?: string | null
  /** Microsoft 365: `isReminderOn` aus Graph. */
  isReminderOn?: boolean | null
  reminderMinutesBeforeStart?: number | null
  /** IANA-Zeitzone von Start/Ende (zeitgebundene Termine). */
  timeZone?: string | null
  /** Vorhandene Termin-Anhaenge (nur wenn frisch von der API geladen). */
  attachments?: CalendarEventAttachmentMeta[]
  /** Zeitplan (bei Live-Abruf aus Graph/Google). */
  startIso?: string | null
  endIso?: string | null
  isAllDay?: boolean
  webLink?: string | null
}

export interface CalendarResolveMeetingRecordingInput {
  accountId: string
  joinUrl?: string | null
  bodyHtml?: string | null
}

export interface CalendarResolveMeetingRecordingResult {
  recordingUrl: string | null
  recapUrl: string | null
  source: 'body' | 'graph' | null
  recapSource: 'body' | 'joinUrl' | null
  /** Graph bestätigt eine Aufzeichnung, auch wenn keine öffentliche Stream-URL vorliegt. */
  hasGraphRecording?: boolean
}

/** Termin in anderen Kalender / anderes Konto kopieren oder verschieben. */
export interface CalendarTransferEventInput {
  source: {
    accountId: string
    graphEventId: string
    graphCalendarId?: string | null
    title: string
    startIso: string
    endIso: string
    isAllDay: boolean
    location?: string | null
    categories?: string[] | null
    /** false bei Abo/Feed oder reinem Lesezugriff — Verschieben nicht moeglich. */
    calendarCanEdit?: boolean
  }
  targetAccountId: string
  targetGraphCalendarId?: string | null
  mode: 'copy' | 'move'
  /** Bei Bearbeiten+Verschieben: aktuelle Formularwerte fuer den Zieltermin. */
  payloadOverride?: Omit<CalendarSaveEventInput, 'accountId' | 'graphCalendarId'>
}

/** Termin loeschen (Graph oder Google). */
export interface CalendarDeleteEventInput {
  accountId: string
  graphEventId: string
  /** Google: Kalender-ID (`primary` oder Kalender-E-Mail); bei Microsoft optional. */
  graphCalendarId?: string | null
}

/** Nur Zeitraum aendern (Drag & Drop / Resize) — `PATCH` ohne Body. */
export interface CalendarPatchScheduleInput {
  accountId: string
  graphEventId: string
  /** Google: Kalender-ID; bei Microsoft aus Event ableitbar. */
  graphCalendarId?: string | null
  startIso: string
  endIso: string
  isAllDay: boolean
  /** Google: `sendUpdates=all`; Microsoft sendet bei Besprechungen automatisch. */
  notifyAttendees?: boolean
}

/** Nur Kalenderfarbe (Outlook-Preset) — `PATCH /me/calendars/{id}`. */
export interface CalendarPatchCalendarColorInput {
  accountId: string
  graphCalendarId: string
  /** Microsoft Graph `calendar.color`, z. B. `lightTeal` oder `auto`. */
  color: string
}

/** Vorschlag fuer „Termin aus Mail“ (Kalender-Dialog). */
export interface CalendarSuggestionFromMail {
  accountId: string
  messageId: number
  subject: string
  startIso: string
  endIso: string
  bodyHtml: string
  attendeeEmails: string[]
  /** Original-Mail als .eml fuer den Termin-Anhang (optional). */
  mailAttachment?: ComposeAttachment | null
}

export interface CalendarFreeSlot {
  startIso: string
  endIso: string
}

export interface CalendarFindLocalFreeSlotsInput {
  accountId: string
  durationMinutes: number
  rangeStartIso: string
  rangeEndIso: string
  workingHoursStart?: number
  workingHoursEnd?: number
  maxResults?: number
  notBeforeIso?: string | null
}

export interface CalendarAttendeeScheduleItem {
  startIso: string
  endIso: string
  status: 'free' | 'busy' | 'tentative' | 'oof' | 'workingElsewhere' | 'unknown'
}

export interface CalendarAttendeeScheduleView {
  email: string
  items: CalendarAttendeeScheduleItem[]
  /** Graph availabilityView: 0=free, 1=tentative, 2=busy, 3=oof, 4=workingElsewhere */
  availabilityView?: string | null
}

export interface CalendarGetAttendeeScheduleInput {
  accountId: string
  attendeeEmails: string[]
  startIso: string
  endIso: string
  intervalMinutes?: number
}

export interface CalendarFindMeetingTimesInput {
  accountId: string
  attendeeEmails: string[]
  durationMinutes: number
  rangeStartIso: string
  rangeEndIso: string
  maxCandidates?: number
}

export type MeetingInvitationResponseKind = 'accept' | 'decline' | 'tentative' | 'propose'

export type MeetingAttendeePartStat =
  | 'accepted'
  | 'declined'
  | 'tentative'
  | 'needs-action'
  | 'delegated'
  | 'unknown'

export interface MeetingInvitationAttendeeView {
  email: string
  name: string | null
  partStat: MeetingAttendeePartStat
}

export interface MeetingInvitationView {
  uid: string | null
  method: string | null
  sequence: number
  status: string | null
  summary: string
  startIso: string | null
  endIso: string | null
  isAllDay: boolean
  location: string | null
  descriptionPlain: string | null
  bodyHtml: string | null
  organizer: { email: string; name: string | null } | null
  attendees: MeetingInvitationAttendeeView[]
  joinUrl: string | null
  selfPartStat: MeetingAttendeePartStat | null
  isCancelled: boolean
  canRespond: boolean
  respondUnsupportedReason: string | null
  /** Microsoft Graph: Organisator erlaubt alternative Zeiten (Standard: true). */
  allowNewTimeProposals: boolean
  /** Vom angemeldeten Konto vorgeschlagene Alternative (falls bereits gesendet). */
  selfProposedStartIso: string | null
  selfProposedEndIso: string | null
}

export interface CalendarParseMeetingFromMessageResult {
  invitation: MeetingInvitationView | null
  warnings: string[]
}

export interface CalendarRespondToMeetingInput {
  accountId: string
  messageId: number
  response: MeetingInvitationResponseKind
  comment?: string | null
  /** Nur bei `response: 'propose'` — alternative Start-/Endzeit (UTC-ISO). */
  proposedStartIso?: string | null
  proposedEndIso?: string | null
  /** Microsoft Graph: Antwort an Organisator senden (Standard: true). */
  sendResponse?: boolean
}

export interface CalendarRespondToMeetingResult {
  ok: boolean
  error?: string
  selfPartStat?: MeetingAttendeePartStat
  selfProposedStartIso?: string | null
  selfProposedEndIso?: string | null
}
