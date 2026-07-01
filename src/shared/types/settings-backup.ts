import type { AccountAvatarIconId, AccountAvatarKind } from '../account-avatar'
import type { MailRuleDefinition, MailRuleTrigger } from '../mail-rules'
import type {
  AccountSignatureTemplate,
  SharedMailboxSendAs
} from './account'
import type { AppConfig } from './app-config'
import type { WorkflowColumn } from './mail'

export const SETTINGS_BACKUP_FORMAT_VERSION = 2 as const

/** Unterstuetzte Import-Versionen (aeltere Exporte bleiben lesbar). */
export const SETTINGS_BACKUP_SUPPORTED_FORMAT_VERSIONS = [1, 2] as const

/** Regel ohne DB-IDs — fuer Sicherungsdatei und Wiederherstellung. */
export interface SettingsBackupMailRuleSnapshot {
  name: string
  enabled: boolean
  trigger: MailRuleTrigger
  sortOrder: number
  definition: MailRuleDefinition
}

export interface SettingsBackupWorkflowBoardSnapshot {
  id: number
  columns: WorkflowColumn[]
  /** Ab Export mit App-Version die Boards voll mitschreibt; fehlt bei aelteren Dateien. */
  name?: string
  sortOrder?: number
}

/** QuickStep-Zeile fuer Sicherung (IDs bleiben erhalten, Workflow-Spalten verweisen darauf). */
export interface SettingsBackupQuickStepSnapshot {
  id: number
  name: string
  icon: string | null
  shortcut: string | null
  actionsJson: string
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SettingsBackupTemplateSnapshot {
  id: number
  name: string
  bodyHtml: string
  bodyText: string | null
  variablesJson: string | null
  shortcut: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SettingsBackupMetaFolderSnapshot {
  id: number
  name: string
  sortOrder: number
  criteriaJson: string
  createdAt: string
  updatedAt: string
}

/** Nur ausstehende geplante Sends; beim Import werden bestehende Pending-Eintraege ersetzt. */
export interface SettingsBackupComposeScheduledSnapshot {
  payloadJson: string
  sendAtIso: string
}

/**
 * Notiz exportiert mit stabilen Schluesseln (Mail: Konto + Remote-Message-Id),
 * damit sie nach Import wieder an lokale message_id angebunden werden kann.
 */
export interface SettingsBackupNoteSectionSnapshot {
  name: string
  icon?: string | null
  iconColor?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  /** Index in noteSections-Array der Elternsektion; null = Wurzel. */
  parentIndex?: number | null
}

export interface SettingsBackupUserNoteLinkSnapshot {
  fromNoteIndex: number
  toNoteIndex: number
  createdAt: string
}

/** Vollstaendiger Export/Import aller Zeilen aus entity_links. */
export interface SettingsBackupFullEntityLinkSnapshot {
  refAKey: string
  refBKey: string
  aKind: string
  aNoteId?: number | null
  aMailMessageId?: number | null
  aMailTodoId?: number | null
  aCalendarAccountId?: string | null
  aCalendarGraphEventId?: string | null
  aTaskAccountId?: string | null
  aTaskListId?: string | null
  aTaskId?: string | null
  aPeopleContactId?: number | null
  bKind: string
  bNoteId?: number | null
  bMailMessageId?: number | null
  bMailTodoId?: number | null
  bCalendarAccountId?: string | null
  bCalendarGraphEventId?: string | null
  bTaskAccountId?: string | null
  bTaskListId?: string | null
  bTaskId?: string | null
  bPeopleContactId?: number | null
  linkKind?: string | null
  createdAt: string
}

/** Verknuepfung einer Notiz mit Mail, Kalender, Aufgabe oder anderer Notiz. */
export interface SettingsBackupEntityLinkSnapshot {
  fromNoteIndex: number
  targetKind: 'note' | 'mail' | 'calendar_event' | 'cloud_task' | 'people_contact'
  toNoteIndex?: number
  mailMessageId?: number
  calendarAccountId?: string
  calendarGraphEventId?: string
  taskAccountId?: string
  taskListId?: string
  taskId?: string
  peopleContactId?: number
  createdAt: string
}

/** Freie Notiz, die per Entity-Link mit einem Kontakt verknuepft ist. */
export interface PeopleContactLinkedNote {
  noteId: number
  linkId: number
  title: string | null
  body: string
  updatedAt: string
}

/** Benutzerdefinierte Kalenderfarbe in der Sidebar (Graph-Kalender-ID). */
export interface SettingsBackupCalendarColorOverrideSnapshot {
  accountId: string
  calendarId: string
  displayColorOverrideHex: string | null
}

/** Kontenbezogene Einstellungen ohne OAuth-Token (Merge per Konto-ID beim Import). */
export interface SettingsBackupAccountPreferenceSnapshot {
  accountId: string
  color?: string
  avatarKind?: AccountAvatarKind
  avatarIconId?: AccountAvatarIconId | null
  calendarLoadAheadDays?: number | null
  signatureTemplates?: AccountSignatureTemplate[]
  defaultSignatureTemplateId?: string | null
  bookWithMeUrl?: string | null
  sharedMailboxSendAs?: SharedMailboxSendAs[]
}

export interface SettingsBackupNotionDestinationSnapshot {
  id: string
  title: string
  icon: string | null
  kind: 'page' | 'database'
  addedAt: string
  lastUsedAt?: string
}

export interface SettingsBackupNotionDestinationsSnapshot {
  favorites: SettingsBackupNotionDestinationSnapshot[]
  defaultMailPageId: string | null
  defaultCalendarPageId: string | null
  lastUsedPageId: string | null
  newPageParentId: string | null
}

export interface SettingsBackupUserNoteSnapshot {
  kind: 'mail' | 'calendar' | 'standalone'
  mailAccountId?: string | null
  mailRemoteId?: string | null
  accountId?: string | null
  calendarSource?: 'microsoft' | 'google' | null
  calendarRemoteId?: string | null
  eventRemoteId?: string | null
  title: string | null
  body: string
  createdAt: string
  updatedAt: string
  eventTitleSnapshot?: string | null
  eventStartIsoSnapshot?: string | null
  scheduledStartIso?: string | null
  scheduledEndIso?: string | null
  scheduledAllDay?: boolean
  sectionIndex?: number | null
  sortOrder?: number
  iconId?: string | null
  iconColor?: string | null
  /** Indizes in userNotes-Array fuer Verknuepfungen (nur ausgehend). */
  linkedToNoteIndices?: number[]
}

export interface SettingsBackupDatabaseExtras {
  mailRules: SettingsBackupMailRuleSnapshot[]
  workflowBoards: SettingsBackupWorkflowBoardSnapshot[]
  vipSenders: { accountId: string; emailLower: string }[]
  workflowMailFolders: {
    accountId: string
    wipFolderRemoteId: string | null
    doneFolderRemoteId: string | null
  }[]
  /** Fehlt bei aelteren Exporten: QuickSteps bleiben in der DB unveraendert. */
  quickSteps?: SettingsBackupQuickStepSnapshot[]
  mailTemplates?: SettingsBackupTemplateSnapshot[]
  metaFolders?: SettingsBackupMetaFolderSnapshot[]
  composeScheduledPending?: SettingsBackupComposeScheduledSnapshot[]
  userNotes?: SettingsBackupUserNoteSnapshot[]
  noteSections?: SettingsBackupNoteSectionSnapshot[]
  userNoteLinks?: SettingsBackupUserNoteLinkSnapshot[]
  /** Ab v2: alle Notiz-Verknuepfungen (Mail/Kalender/Aufgabe/Notiz). */
  entityLinks?: SettingsBackupEntityLinkSnapshot[]
  /** Ab v2: vollstaendiges Verknuepfungsnetz (entity_links). */
  fullEntityLinks?: SettingsBackupFullEntityLinkSnapshot[]
  /** Ab v2: benutzerdefinierte Kalenderfarben. */
  calendarColorOverrides?: SettingsBackupCalendarColorOverrideSnapshot[]
}

/**
 * Secure-Store und kontobezogene Praeferenzen (ohne OAuth-Token).
 * Ab Format v2; fehlt in v1-Exporten.
 */
export interface SettingsBackupAiConnectionsDismissedPair {
  anchorKey: string
  peerKey: string
  dismissedAt: string
}

export interface SettingsBackupAiConnectionsExtras {
  settings: import('@shared/ai-connections').AiConnectionsSettingsBackupSnapshot
  dismissedPairs?: SettingsBackupAiConnectionsDismissedPair[]
  /** Hinweis: API-Schlüssel liegen im Secure Store und sind nicht in dieser Datei. */
}

export interface SettingsBackupSecureExtras {
  accountPreferences?: SettingsBackupAccountPreferenceSnapshot[]
  accountOrder?: string[]
  notionDestinations?: SettingsBackupNotionDestinationsSnapshot
  /** Ab Format v2: KI-Verbindungen (ohne API-Keys). */
  aiConnections?: SettingsBackupAiConnectionsExtras
}

/**
 * Lokale Einstellungs-Sicherung (ohne Mails, ohne Konten-Token).
 * Enthaelt App-Config, Renderer-localStorage, Mail-Regeln, Workflow (Boards + QuickSteps),
 * Vorlagen, Meta-Ordner, VIP, Triage-Ordner, geplanten Versand (pending), Notizen und ab v2
 * Konten-Praeferenzen, Notion-Ziele sowie Kalenderfarb-Ueberschreibungen.
 */
export interface SettingsBackupPayload {
  formatVersion: typeof SETTINGS_BACKUP_FORMAT_VERSION
  exportedAt: string
  appVersion: string
  config: AppConfig
  localStorage: Record<string, string>
  /** Fehlt bei aelteren Exporten: Datenbank-Teile werden dann nicht geaendert. */
  databaseExtras?: SettingsBackupDatabaseExtras
  /** Fehlt bei v1-Exporten: Secure-Store-Praeferenzen ohne Token. */
  secureExtras?: SettingsBackupSecureExtras
}

export type SettingsBackupExportResult =
  | { ok: true; path: string }
  | { ok: false; cancelled: true }

export type SettingsBackupPickResult =
  | { ok: true; backup: SettingsBackupPayload }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

export interface SettingsAutoBackupStatus {
  enabled: boolean
  directory: string | null
  lastAt: string | null
  lastPath: string | null
  lastError: string | null
}

export type SettingsAutoBackupRunResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export type SettingsBackupDirectoryPickResult =
  | { ok: true; path: string }
  | { ok: false; cancelled: true }

/** ZIP-Archiv des userData-Ordners (portable = ohne Chromium-Caches). */
