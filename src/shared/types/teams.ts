import type { MailListItem } from './mail'

export interface TeamsChatSummary {
  id: string
  topic: string | null
  chatType: string | null
  lastUpdatedDateTime: string | null
  /** Bei 1:1 ohne Thema: Anzeigename des Gegenuebers aus Chat-Mitgliedern, sonst null. */
  peerDisplayName: string | null
}

/** Microsoft Graph `chatMessage`, fuer die Anzeige reduziert. */
export type TeamsChatMessageKind = 'user' | 'system'

export interface TeamsChatMessageView {
  id: string
  createdDateTime: string
  bodyPreview: string | null
  fromDisplayName: string | null
  /** Graph `from.user.id` — fuer eigene Nachrichten (rechtsbuendig). */
  fromUserId: string | null
  /** `system`: Teams-Systemereignis (`systemEventMessage` / eventDetail). */
  messageKind: TeamsChatMessageKind
}

/** Interner Schluessel fuer Teams-Chat-Popout-Fenster (`accountId::chatId`). */
export type TeamsChatPopoutKey = string

export interface TeamsChatPopoutOpenInput {
  accountId: string
  chatId: string
  title?: string
  /** Beim Oeffnen; ohne Angabe wird der gespeicherte Standard aus dem Renderer genutzt. */
  alwaysOnTop?: boolean
}

export interface TeamsChatPopoutRef {
  accountId: string
  chatId: string
}

export interface TeamsChatPopoutListItem extends TeamsChatPopoutRef {
  title: string
  alwaysOnTop: boolean
}

/** Interner Schluessel fuer Mail-Lese-Popout-Fenster (`messageId` als String). */
export type MailReadingPopoutKey = string

export interface MailReadingPopoutOpenInput {
  messageId: number
  title?: string
  /** Standard: true (immer im Vordergrund). */
  alwaysOnTop?: boolean
}

export interface MailReadingPopoutRef {
  messageId: number
}

