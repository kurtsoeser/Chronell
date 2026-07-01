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

export interface NotionCreatePageInput {
  title: string
  parentPageId?: string | null
  kind?: 'mail' | 'calendar'
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

/** Ergebnis des Ziel-Pickers: an bestehende Seite anhaengen oder neue Seite bereits befuellt. */
export type NotionPickResult =
  | { mode: 'append'; pageId: string }
  | { mode: 'created'; pageId: string; pageUrl: string }

export interface NotionAppendEventInput {
  event: CalendarEventView
  pageId?: string | null
  localeCode?: 'de' | 'en'
}
