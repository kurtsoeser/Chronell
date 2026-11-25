/** Chronell → #kurtrocks Events OS (Studio localhost). */

export type EventsOsInboxKind =
  | 'email_anmeldung'
  | 'email_abmeldung'
  | 'email_anfrage'
  | 'honorar'
  | 'anwesenheit'
  | 'angebot'
  | 'note'
  | 'sonstiges'

export type EventsOsEventHit = {
  id: string
  title: string
  date?: string
  category?: string[]
  tn?: number | null
  studioAkteUrl: string
  startIso?: string
  endIso?: string
  coverUrl?: string | null
  descriptionPreview?: string | null
  websiteUrl?: string | null
}

/** Studio → Chronell, analog Notion-Webinar-Import. */
export type EventsOsWebinarPrefill = {
  ok?: boolean
  eventId: string
  title: string
  startIso: string | null
  endIso: string | null
  isAllDay: boolean
  websiteUrl: string | null
  descriptionPlain: string
  descriptionHtml: string
  coverUrl: string | null
  /** Studio liefert Cover schon als data:-URL (Header inkl. Brand-Fallback). */
  heroImageDataUrl?: string | null
  notionPageId: string | null
  error?: string
}

export type EventsOsWebinarImportResult = {
  eventId: string
  title: string
  startIso: string | null
  endIso: string | null
  isAllDay: boolean
  websiteUrl: string | null
  descriptionPlain: string
  descriptionHtml: string
  heroImageDataUrl: string | null
  notionPageId: string | null
}

/** Chronell-Kalender → Eventakte (Rechtsklick). */
export type EventsOsCalendarDraftInput = {
  graphEventId: string
  subject: string
  startIso: string
  endIso: string
  isAllDay?: boolean
  joinUrl?: string | null
  webLink?: string | null
  location?: string | null
  categories?: string[]
}

export type EventsOsCalendarDraftResult = {
  ok: boolean
  eventId: string
  graphEventId: string
  title: string
  created: boolean
  studioAkteUrl: string
  lifecycleStatus?: string
  error?: string
}

export type EventsOsWritebackInput = {
  eventId: string
  meetingUrl?: string | null
  surveyUrl?: string | null
  graphEventId?: string | null
}

export type EventsOsSearchResult = {
  ok: boolean
  q: string
  hits: EventsOsEventHit[]
  cacheUpdatedAt: string | null
  hint?: string | null
  error?: string
}

export type EventsOsSendMailInput = {
  messageId: number
  eventId: string
  kind?: EventsOsInboxKind
}

export type EventsOsSendMailResult = {
  ok: boolean
  item?: { id: string; kind: string; title: string }
  participant?: {
    id: string
    name: string
    email?: string
    status?: string
    cancelledAt?: string | null
  } | null
  person?: { name?: string; email?: string }
  studioAkteUrl?: string
  studioAblageUrl?: string
  message?: string
  error?: string
  /** Anzahl mitgesendeter Anhänge (Chronell → Ablage). */
  attachmentCount?: number
  /** Gründe für übersprungene Anhänge (Inline, zu groß, Fehler). */
  attachmentsSkipped?: string[]
}
