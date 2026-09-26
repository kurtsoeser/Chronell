import type { CalendarEventView } from './calendar'

export type NotionAuthMode = 'none' | 'oauth' | 'internal'

export interface NotionConnectionStatus {
  connected: boolean
  authMode: NotionAuthMode
  hasCredentials: boolean
  workspaceName: string | null
  workspaceIcon: string | null
  ownerName: string | null
  botId?: string
  workspaceId?: string
}

export interface NotionSearchPageHit {
  id: string
  title: string
  url: string | null
  icon: string | null
  kind: 'page' | 'database'
  /** ISO-Zeit aus der Notion-API (optional, bei Suche/Recent). */
  createdTime?: string | null
  lastEditedTime?: string | null
}

export interface NotionSavedDestination {
  id: string
  title: string
  icon: string | null
  kind: 'page' | 'database'
  addedAt: string
  lastUsedAt?: string
}

export interface NotionDestinationsConfig {
  favorites: NotionSavedDestination[]
  defaultMailPageId: string | null
  defaultCalendarPageId: string | null
  lastUsedPageId: string | null
  /** Optional: neue Seiten werden als Unterseite hier angelegt (sonst Workspace oder Standard). */
  newPageParentId: string | null
}

export type NotionContentKind = 'mail' | 'calendar' | 'note'

export interface NotionCreatePageInput {
  title: string
  parentPageId?: string | null
  kind?: NotionContentKind
}

export interface NotionCreatePageResult {
  pageId: string
  pageUrl: string
}

export interface NotionAppendResult {
  pageId: string
  pageUrl: string
}

export interface NotionAppendMailInput {
  messageId: number
  pageId?: string | null
  webLink?: string | null
}

export interface NotionCreateMailPageInput {
  messageId: number
  title: string
  parentPageId?: string | null
  webLink?: string | null
}

export interface NotionCreateEventPageInput {
  event: CalendarEventView
  title: string
  parentPageId?: string | null
  localeCode?: 'de' | 'en'
}

export interface NotionAppendNoteInput {
  noteId: number
  pageId?: string | null
  localeCode?: 'de' | 'en'
}

export interface NotionCreateNotePageInput {
  noteId: number
  title: string
  parentPageId?: string | null
  localeCode?: 'de' | 'en'
}

/** Ergebnis des Ziel-Pickers: an bestehende Seite anhaengen oder neue Seite bereits befuellt. */
export type NotionPickResult =
  | { mode: 'append'; pageId: string }
  | { mode: 'created'; pageId: string; pageUrl: string }

/** Picker-Absicht: anhaengen vs. uebergeordnete Seite fuer neue Notion-Seite waehlen. */
export type NotionPickIntent = 'append' | 'createUnder'

export interface NotionAppendEventInput {
  event: CalendarEventView
  pageId?: string | null
  localeCode?: 'de' | 'en'
}

/** Treffer aus #kurtrocks Events (DB-Query). */
export interface NotionKurtrocksEventHit {
  id: string
  title: string
  startIso: string | null
  endIso: string | null
  isAllDay: boolean
  /** Veranstaltungsseite: nur veroeffentlichte Kurtrocks-URL (nie Veranstaltungslink/ph-online). */
  websiteUrl: string | null
  descriptionPreview: string | null
  coverUrl: string | null
  pageUrl: string | null
  /** Notion Sites public_url (null wenn nicht veroeffentlicht). */
  publicUrl: string | null
  lastEditedTime: string | null
}

/** Vollstaendiger Import fuer Webinar-Prefill. */
export interface NotionWebinarImportResult {
  pageId: string
  pageUrl: string | null
  /** Notion Sites public_url (null wenn nicht veroeffentlicht). */
  publicUrl: string | null
  title: string
  startIso: string | null
  endIso: string | null
  isAllDay: boolean
  /** Webinar-Feld „Veranstaltungsseite“ = www.kurtrocks.com/… */
  websiteUrl: string | null
  descriptionPlain: string
  /** Einfaches HTML aus Beschreibung (fuer Supplement-Block). */
  descriptionHtml: string
  /** Cover als data:-URL oder null. */
  heroImageDataUrl: string | null
}

/** Forms-/Teams-Links zurueck in #kurtrocks Events schreiben. */
export interface NotionUpdateKurtrocksEventLinksInput {
  pageId: string
  surveyUrl?: string | null
  meetingUrl?: string | null
}

export interface NotionUpdateKurtrocksEventLinksResult {
  pageId: string
  updatedSurvey: boolean
  updatedMeeting: boolean
  missingSurveyProperty: boolean
  missingMeetingProperty: boolean
}
