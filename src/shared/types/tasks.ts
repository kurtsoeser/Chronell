import type { CalendarRecurrenceFrequency, CalendarRecurrenceRangeEndMode } from './calendar'

/** Cloud-Aufgabenliste (Microsoft To Do oder Google Tasks). */
export interface TaskListRow {
  id: string
  name: string
  /** Microsoft: `wellKnownListName === defaultList`; Google: `@default`. */
  isDefault?: boolean
  /** Microsoft Graph `wellKnownListName` (z. B. `defaultList`, `flaggedEmails`). */
  wellKnownListName?: string | null
  provider: 'microsoft' | 'google'
}

/** Serienfrequenz für Cloud-Aufgaben (gleiches Modell wie Kalendertermine). */
export type TaskRecurrenceFrequency = CalendarRecurrenceFrequency

/** Ende der Aufgaben-Serie. */
export type TaskRecurrenceRangeEndMode = CalendarRecurrenceRangeEndMode

/**
 * Wiederholende Cloud-Aufgabe beim Anlegen.
 * Microsoft To Do: Graph `recurrence`. Google Tasks: nur lokal (API ohne Serien).
 */
export interface TaskSaveRecurrence {
  frequency: TaskRecurrenceFrequency
  rangeEnd: TaskRecurrenceRangeEndMode
  weekdays?: Array<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  >
  untilDate?: string | null
  count?: number | null
}

/** Einzelne Cloud-Aufgabe (nicht Mail-Triage-ToDos). */
export interface TaskItemRow {
  id: string
  listId: string
  title: string
  completed: boolean
  /** Faelligkeit als ISO-Datum (`YYYY-MM-DD`) oder UTC-ISO mit Uhrzeit, sonst null. */
  dueIso: string | null
  notes: string | null
  /** Lokales Anzeige-Icon (`calendar-event-icons`), nicht mit Graph/Google synchronisiert. */
  iconId?: string | null
  /** Hex-Farbe für das Anzeige-Icon. */
  iconColor?: string | null
  /** Serienmuster (Graph oder lokal bei Google). */
  recurrence?: TaskSaveRecurrence | null
  /** true = nur in der App gespeichert (Google Tasks API ohne Wiederholung). */
  recurrenceLocalOnly?: boolean
  /** Outlook/Graph `categories` (nur Microsoft To Do). */
  categories?: string[]
}

/** Lokales Aufgaben-Icon und Farbe setzen/entfernen. */
export interface TasksPatchTaskDisplayInput {
  accountId: string
  listId: string
  taskId: string
  iconId?: string | null
  iconColor?: string | null
}

export interface TasksListListsInput {
  accountId: string
  /** Cache ignorieren und von der Cloud neu laden (wenn online). */
  forceRefresh?: boolean
  /** Nur lokaler Cache — kein Hintergrund-Sync (z. B. nach tasks-changed-Broadcast). */
  cacheOnly?: boolean
}

export interface TasksListTasksInput {
  accountId: string
  listId: string
  /** Standard: true (wie Google API-Default). */
  showCompleted?: boolean
  showHidden?: boolean
  /** Cache ignorieren und von der Cloud neu laden (wenn online). */
  forceRefresh?: boolean
  /** Nur lokaler Cache — kein Hintergrund-Sync (z. B. nach tasks-changed-Broadcast). */
  cacheOnly?: boolean
}

export interface TasksCreateTaskInput {
  accountId: string
  listId: string
  title: string
  notes?: string | null
  dueIso?: string | null
  completed?: boolean
  /** Serienaufgabe (MS365: Graph; Google: lokales Metadatum). Erfordert `dueIso`. */
  recurrence?: TaskSaveRecurrence | null
  /** Outlook-Masterkategorien (nur Microsoft To Do). */
  categories?: string[] | null
}

export interface TasksPatchTaskInput {
  accountId: string
  listId: string
  taskId: string
  title?: string | null
  notes?: string | null
  /** `null` loescht die Faelligkeit; `undefined` = keine Aenderung. */
  dueIso?: string | null
  completed?: boolean
  /** Outlook-Masterkategorien (nur Microsoft To Do). */
  categories?: string[] | null
}

export interface TasksUpdateTaskInput extends TasksCreateTaskInput {
  taskId: string
}

export interface TasksDeleteTaskInput {
  accountId: string
  listId: string
  taskId: string
}

/** Microsoft 365: alle **erledigten** Aufgaben in der Built-in-Liste `flaggedEmails` (Gekennzeichnete E-Mail) per Graph löschen. */
export interface TasksBulkDeleteCompletedFlaggedEmailInput {
  accountId: string
}

export interface TasksBulkDeleteCompletedFlaggedEmailResult {
  /** `false`, wenn Graph keine Liste `flaggedEmails` liefert. */
  listFound: boolean
  /** Erfolgreich von Graph entfernt und lokal bereinigt. */
  deleted: number
  /** Einzel-Löschungen mit Fehler (z. B. Throttling). */
  failed: number
}

/** Lokale Planungszeit für Cloud-Aufgaben (Kalender-Blöcke). */
export interface TaskPlannedScheduleDto {
  taskKey: string
  plannedStartIso: string
  plannedEndIso: string
}

export interface TasksListPlannedSchedulesInput {
  taskKeys: string[]
}

export interface TasksSetPlannedScheduleInput {
  taskKey: string
  plannedStartIso: string
  plannedEndIso: string
}

export interface TasksClearPlannedScheduleInput {
  taskKey: string
}

export interface MailCloudTaskLinkDto {
  messageId: number
  accountId: string
  listId: string
  taskId: string
}

export interface TasksCreateMailCloudTaskFromMessageInput {
  messageId: number
  accountId: string
  listId: string
  title: string
  notes?: string | null
  dueIso?: string | null
}

export interface TasksPromoteMailTodoToCloudTaskInput {
  todoId: number
  accountId: string
  listId: string
  title: string
  notes?: string | null
  dueIso?: string | null
}
