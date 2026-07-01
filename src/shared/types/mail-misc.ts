import type { MailListItem } from './mail'

export type MailActionType =
  | 'set-read'
  | 'set-flagged'
  | 'archive'
  | 'move-to-trash'
  | 'move-message'
  | 'add-tag'
  | 'snooze'
  | 'unsnooze'
  | 'add-todo'
  | 'change-todo'
  | 'remove-todo'
  | 'add-waiting-for'
  | 'change-waiting-for'
  | 'remove-waiting-for'
  | 'quickstep'

export interface UndoableActionSummary {
  id: number
  actionType: MailActionType
  /** Anzeige-Label fuer die Toast ("Archiviert: Re: ...") */
  label: string
  performedAt: string
}

export interface UndoResult {
  ok: boolean
  label?: string
  error?: string
}

/** Snooze-Presets fuer den Picker. */
export type SnoozePreset =
  | 'this-evening'
  | 'tomorrow-morning'
  | 'tomorrow-evening'
  | 'next-week'
  | 'next-monday'
  | 'in-1-hour'
  | 'in-3-hours'
  | 'custom'

export interface SnoozeOption {
  preset: SnoozePreset
  /** Berechneter Wake-Zeitpunkt als ISO 8601. */
  wakeAt: string
}

export interface SnoozedMessageItem extends MailListItem {
  snoozedUntil: string | null
  snoozedFromFolderId: number | null
  snoozedFromFolderName: string | null
}

/** Einheitliche Fehlermeldung bei fehlender Netzwerkverbindung (Main: `assertAppOnline()`). */
export const OFFLINE_APP_ERROR = 'Keine Netzwerkverbindung.'
