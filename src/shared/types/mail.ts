import type { Provider } from './account'
import type { CalendarEventView } from './calendar'
import type { UserNoteKind } from './notes'
import type { MetaFolderConditionGroup } from '../meta-folder-match-expression'

export interface MailFolder {
  id: number
  accountId: string
  remoteId: string
  name: string
  parentRemoteId: string | null
  path: string | null
  wellKnown: string | null
  isFavorite: boolean
  unreadCount: number
  totalCount: number
}

export type TodoDueKindOpen = 'today' | 'tomorrow' | 'this_week' | 'later'

export type TodoDueKindList = TodoDueKindOpen | 'done' | 'overdue'

/** Workflow-Kanban: eine Spalte mit optionaler QuickStep-ID und optionalem ToDo-Bucket. */
export interface WorkflowColumn {
  id: string
  title: string
  quickStepId: number | null
  /** Offene ToDos dieses Buckets in der Spalte anzeigen (today, tomorrow, …). */
  todoDueKind?: TodoDueKindList | null
}

export interface WorkflowBoard {
  id: number
  name: string
  columns: WorkflowColumn[]
  sortOrder: number
}

export interface TodoOpenCounts {
  /** Fälligkeit vor heute (Kalendertag), nur mit gesetztem `due_at`. */
  overdue: number
  today: number
  tomorrow: number
  this_week: number
  later: number
}

export interface TodoCountsAll extends TodoOpenCounts {
  done: number
  /** Mails mit gesetztem `waiting_for_reply_until`. */
  waiting: number
}

export interface MailListItem {
  id: number
  accountId: string
  folderId: number | null
  threadId: number | null
  remoteId: string
  remoteThreadId: string | null
  subject: string | null
  fromAddr: string | null
  fromName: string | null
  snippet: string | null
  sentAt: string | null
  receivedAt: string | null
  isRead: boolean
  isFlagged: boolean
  hasAttachments: boolean
  importance: string | null
  /** ISO 8601, falls die Mail aktuell gesnoozt ist. */
  snoozedUntil: string | null
  /** Gesetzt, wenn die Zeile aus einer ToDo-Ansicht stammt. */
  todoId?: number
  todoDueKind?: string | null
  todoDueAt?: string | null
  /** Kalender-Block: Beginn (ISO 8601), optional zu due_at. */
  todoStartAt?: string | null
  /** Kalender-Block: Ende (ISO 8601). */
  todoEndAt?: string | null
  todoCompletedAt?: string | null
  /** ISO 8601: Antwort bis (Waiting-for), falls gesetzt. */
  waitingForReplyUntil?: string | null
  /** Rohwert des List-Unsubscribe-Headers (mailto/https). */
  listUnsubscribe?: string | null
  /** List-Unsubscribe-Post fuer RFC-8058 One-Click. */
  listUnsubscribePost?: string | null
  /** Absender ist als VIP markiert (lokal). */
  isVipSender?: boolean
  /**
   * Kategorie-Namen (Outlook/Graph `categories`, lokal in `message_tags`).
   * Spaeter auch fuer Kalender-Termine nutzbar.
   */
  categories?: string[]
  /** An: Empfaenger-Rohstring (fuer Gruppierung „An“ in der Liste). */
  toAddrs?: string | null
}

export interface MailFull extends MailListItem {
  bodyHtml: string | null
  bodyText: string | null
  ccAddrs: string | null
  bccAddrs: string | null
  /** Lokale offene ToDo zu dieser Mail, falls vorhanden. */
  openTodoId: number | null
  openTodoDueKind: string | null
  openTodoDueAt: string | null
  openTodoStartAt: string | null
  openTodoEndAt: string | null
}

/** Outlook-Masterkategorie (Microsoft Graph `outlookCategory`). */
export interface MailMasterCategory {
  id: string
  displayName: string
  color: string
}

export interface SearchHit extends MailListItem {
  folderName: string | null
  folderWellKnown: string | null
}

/** Eintrag im Kontakt-Konversationsverlauf (rechte Seitenleiste). */
export interface MailCorrespondenceItem extends MailListItem {
  isFromMe: boolean
  folderWellKnown: string | null
}

export interface ListCorrespondenceInput {
  email: string
  /** Zusaetzliche Adressen (z. B. People-Aliase). */
  emails?: string[]
  /** Ein Konto (Legacy); bevorzugt `accountIds`. */
  accountId?: string
  /** Ein oder mehrere Konten. */
  accountIds?: string[]
  limit?: number
  offset?: number
  /** Papierkorb und Junk auslassen (Standard: true). */
  excludeDeletedJunk?: boolean
  /** E-Mails der gewaehlten Konten (fuer «Sie» in Mehrkonto-Ansicht). */
  accountOwnerEmails?: string[]
}

export interface ListCorrespondenceResult {
  items: MailCorrespondenceItem[]
  total: number
}

export interface GlobalSearchNoteHit {
  id: number
  kind: UserNoteKind
  title: string
  updatedAt: string
}

export interface GlobalSearchTaskHit {
  accountId: string
  listId: string
  taskId: string
  title: string
  notes: string | null
  dueIso: string | null
}

export interface GlobalSearchContactHit {
  id: number
  accountId: string
  displayName: string | null
  primaryEmail: string | null
  company: string | null
}

/** Arten der globalen Suche (API-Filter und Ergebnis-Tabs). */
export type GlobalSearchKind = 'mails' | 'notes' | 'calendarEvents' | 'tasks' | 'contacts'

export const GLOBAL_SEARCH_KINDS: readonly GlobalSearchKind[] = [
  'mails',
  'notes',
  'calendarEvents',
  'tasks',
  'contacts'
] as const

export interface GlobalSearchResult {
  query: string
  mails: SearchHit[]
  notes: GlobalSearchNoteHit[]
  calendarEvents: CalendarEventView[]
  tasks: GlobalSearchTaskHit[]
  contacts: GlobalSearchContactHit[]
}

/** Felder der Outlook-aehnlichen Detail-Suche (Mails). */
export interface AdvancedMailSearchCriteria {
  /** Teilstring Absender (Name/Adresse). */
  fromContains?: string
  /** Teilstring Empfaenger (to_addrs). */
  toContains?: string
  /** Teilstring Cc. */
  ccContains?: string
  /** Teilstring Betreff. */
  subjectContains?: string
  /** FTS-Schluesselwoerter (Body/Betreff/Absender wie globale Suche). */
  keywords?: string
  /** Empfangsdatum ab (YYYY-MM-DD oder ISO). */
  dateFrom?: string
  /** Empfangsdatum bis (YYYY-MM-DD oder ISO). */
  dateTo?: string
  /** Lesestatus: alle | ungelesen | gelesen. */
  readStatus?: 'all' | 'unread' | 'read'
  /** Nur Mails mit Anlagen. */
  hasAttachmentsOnly?: boolean
  /** Optional: Ordner-IDs; leer = alle ausser Papierkorb/Junk. */
  scopeFolderIds?: number[]
}

/**
 * Einzelne Ausnahme-Regel (wird mit anderen Ausnahmen per ODER in NOT (...) kombiniert).
 * Innerhalb einer Regel gelten gesetzte Felder per UND.
 */
export interface MetaFolderExceptionClause {
  textQuery?: string
  unreadOnly?: boolean
  flaggedOnly?: boolean
  hasAttachmentsOnly?: boolean
  fromContains?: string
  /** Verknuepfung der aktiven Filter innerhalb dieser Ausnahme-Karte. */
  matchOp?: 'and' | 'or'
}

/**
 * Filter fuer Meta-Ordner (virtuelle Ansicht, alle Konten, keine Verschiebung).
 *
 * - Volltext: `textQuery` und jede Zeile in `textQueryOrAlternatives` bilden eine eigene FTS-Suche;
 *   Treffer, wenn mindestens eine Zeile passt (ODER). Innerhalb einer Zeile: Woerter per Leerzeichen
 *   wie bei der globalen Suche (UND).
 * - Absender: `fromContains` und `fromContainsOrAlternatives` bilden eine ODER-Gruppe (eine Zeile reicht).
 * - `matchOp`: Verknuepfung der Positiv-Bedingungen aus der **Volltext-ODER-Gruppe** (falls gesetzt),
 *   der **Absender-ODER-Gruppe** (falls gesetzt) und den Feldern `unreadOnly` / `flaggedOnly` /
 *   `hasAttachmentsOnly`.
 *   Standard ist `and` (kompatibel mit aelteren Eintraegen ohne Feld).
 * - `exceptions`: Mails, die mindestens eine Ausnahme-Zeile voll erfuellen, werden ausgeschlossen:
 *   `AND NOT ( (Zeile0) OR (Zeile1) OR ... )`, innerhalb einer Zeile UND zwischen den Feldern.
 */
export interface MetaFolderCriteria {
  /** FTS-Prefixsuche (Betreff/Absender/Body), gleiche Token-Logik wie globale Suche. */
  textQuery?: string
  /**
   * Weitere Volltextzeilen; zusammen mit `textQuery` per ODER verknuepft (eine Zeile reicht).
   * Jede Zeile einzeln wie `textQuery` tokenisiert.
   */
  textQueryOrAlternatives?: string[]
  unreadOnly?: boolean
  flaggedOnly?: boolean
  hasAttachmentsOnly?: boolean
  /** Teilstring in Absender-Adresse oder -Name (case-insensitive). */
  fromContains?: string
  /**
   * Weitere Absender-Teilstrings; zusammen mit `fromContains` per ODER (eine Zeile reicht).
   */
  fromContainsOrAlternatives?: string[]
  /**
   * Wenn nicht leer: nur diese Ordner-IDs (ueber alle Konten).
   * Wenn leer/weggelassen: alle synchronisierten Ordner ausser Papierkorb und Junk.
   */
  scopeFolderIds?: number[]
  /**
   * Kategorie-Filter (Outlook/Graph `categories`, lokal in `message_tags` gespeichert).
   * Wenn nicht leer: Mail muss **mindestens eine** dieser Kategorien tragen.
   *
   * Hinweis: Die Namen sind die sichtbaren Kategorie-Namen (nicht IDs).
   */
  categoriesAny?: string[]
  /** Verknuepfung der Positiv-Filter; Standard `and`. Legacy — bevorzugt `matchExpression`. */
  matchOp?: 'and' | 'or'
  /**
   * Positiv-Filter (Schritt „Was?“) als verschachtelter UND/ODER-Baum mit Klammergruppen.
   * Siehe `MetaFolderConditionGroup` in `meta-folder-match-expression.ts`.
   */
  matchExpression?: MetaFolderConditionGroup
  /** Ausnahmen (werden mit ODER verknuepft und gesamt negiert). */
  exceptions?: MetaFolderExceptionClause[]
  /**
   * ODER/UND zwischen den Ausnahme-Karten (danach gesamtes Ergebnis via NOT negiert).
   * Fehlt = historisch kompatibel: 'or'
   */
  exceptionsMatchOp?: 'and' | 'or'
}

export interface MetaFolderSummary {
  id: number
  name: string
  sortOrder: number
  criteria: MetaFolderCriteria
  createdAt: string
  updatedAt: string
}

export interface MetaFolderCreateInput {
  name: string
  criteria: MetaFolderCriteria
}

export interface MetaFolderUpdateInput {
  id: number
  name?: string
  criteria?: MetaFolderCriteria
}

export interface AttachmentMeta {
  /** Graph-Attachment-ID (nur fuer Remote-Operationen) */
  id: string
  name: string
  contentType: string | null
  size: number | null
  isInline: boolean
  contentId: string | null
}

/** IPC `mail:clear-local-mail-cache` — lokaler Mail-Sync-Cache neu aufbauen. */
export interface ClearLocalMailCacheResult {
  /** True, wenn direkt danach ein vollständiger Erst-Sync lief (Online). */
  resynced: boolean
  folders?: number
  inboxMessages?: number
}

export interface MailBulkUnflagInput {
  accountId: string
  excludeDeletedJunk: boolean
  dryRun: boolean
}

export interface MailBulkUnflagDryRunResult {
  dryRun: true
  count: number
}

export interface MailBulkUnflagExecuteResult {
  dryRun: false
  processed: number
  failed: number
  firstError: string | null
}

export type MailBulkUnflagResult = MailBulkUnflagDryRunResult | MailBulkUnflagExecuteResult

export interface MailBulkUnflagProgressPayload {
  accountId: string
  done: number
  total: number
}

/** Nach `removeMailTodoRecordsForMessage`: lokale `todos`-Zeilen entfernt (Mail bleibt). */
export interface RemoveMailTodoRecordsResult {
  removed: number
}

/** IPC `tasks:clear-local-tasks-cache` — lokaler To-Do-/Aufgaben-Cache neu aufbauen. */
export interface ClearLocalTasksCacheResult {
  /** Online: vollständiger Listen-/Task-Sync wurde im Hintergrund angestoßen (kein Warten bis fertig). Offline: false. */
  resynced: boolean
}

export interface SyncStatus {
  accountId: string
  state: 'idle' | 'syncing-folders' | 'syncing-messages' | 'error'
  message?: string
}

/** IPC `mail:get-account-sync-meta` — letzter Mail-Sync-Lauf pro Konto. */
export interface AccountMailSyncMeta {
  accountId: string
  lastSyncFinishedAt: string | null
  lastSyncError: string | null
  lastActivityAt: string | null
}

/** Microsoft Graph `/me/chats` — Teams-Chat (1:1 oder Gruppe). */
