import type { ComposeReferenceAttachment } from './compose'

export type UserNoteKind = 'mail' | 'calendar' | 'standalone'
export type UserNoteCalendarSource = 'microsoft' | 'google'

export interface UserNote {
  id: number
  kind: UserNoteKind
  messageId: number | null
  accountId: string | null
  calendarSource: UserNoteCalendarSource | null
  calendarRemoteId: string | null
  eventRemoteId: string | null
  title: string | null
  body: string
  createdAt: string
  updatedAt: string
  eventTitleSnapshot: string | null
  eventStartIsoSnapshot: string | null
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  scheduledAllDay: boolean
  sectionId: number | null
  sortOrder: number
  /** Lokales Anzeige-Icon (`calendar-event-icons`), nicht mit Mail/Kalender synchronisiert. */
  iconId?: string | null
  iconColor?: string | null
  /** Unterseite einer anderen Notiz (Seiten-Hierarchie). */
  parentNoteId?: number | null
  /** Angeheftet in der Seitenliste. */
  isPinned?: boolean
}

/** Lokales Notiz-Icon und Farbe setzen/entfernen. */
export interface UserNotePatchDisplayInput {
  noteId: number
  iconId?: string | null
  iconColor?: string | null
}

export type UserNoteAttachmentKind = 'local' | 'cloud'

export interface UserNoteAttachment {
  id: number
  noteId: number
  kind: UserNoteAttachmentKind
  name: string
  contentType: string | null
  size: number | null
  /** Absoluter Pfad unter userData (nur `local`). */
  localPath: string | null
  /** OneDrive/SharePoint-`webUrl` (nur `cloud`). */
  sourceUrl: string | null
  providerType?: ComposeReferenceAttachment['providerType'] | null
  createdAt: string
}

export interface UserNoteAttachmentAddLocalInput {
  noteId: number
  name: string
  contentType: string
  size: number
  dataBase64: string
}

export interface UserNoteAttachmentAddCloudInput {
  noteId: number
  name: string
  sourceUrl: string
  providerType?: ComposeReferenceAttachment['providerType']
}

export interface NoteSection {
  id: number
  name: string
  icon: string | null
  iconColor: string | null
  parentId: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface UserNoteLinkedItem {
  id: number
  kind: UserNoteKind
  title: string | null
  body: string
  scheduledStartIso: string | null
  updatedAt: string
}

export interface UserNoteScheduleInput {
  id: number
  scheduledStartIso: string
  scheduledEndIso?: string | null
  scheduledAllDay?: boolean
}

export interface UserNoteScheduleFields {
  scheduledStartIso?: string | null
  scheduledEndIso?: string | null
  scheduledAllDay?: boolean
}

export interface NoteSectionCreateInput {
  name: string
  icon?: string | null
  iconColor?: string | null
  parentId?: number | null
}

export interface NoteSectionUpdateInput {
  id: number
  name?: string
  icon?: string | null
  iconColor?: string | null
  parentId?: number | null
}

export interface NoteSectionReorderInput {
  /** Geschwister-Gruppe (null = Wurzelebene). */
  parentId?: number | null
  orderedIds: number[]
}

export interface UserNoteMoveToSectionInput {
  noteId: number
  sectionId: number | null
  sortOrder?: number
}

export interface UserNoteMoveToParentInput {
  noteId: number
  parentNoteId: number | null
  sortOrder?: number
}

export interface UserNoteSetCategoriesInput {
  noteId: number
  accountId: string
  categories: string[]
}

export interface UserNoteSetPinnedInput {
  noteId: number
  isPinned: boolean
}

export interface UserNoteLinkInput {
  fromNoteId: number
  toNoteId: number
}

export type {
  NoteEntityLinkTarget,
  NoteEntityLinkTargetKind,
  NoteEntityLinkedItem,
  NoteLinkTargetCandidate,
  NoteLinksBundle
} from '@shared/note-entity-links'

export interface UserNoteLinkAddInput {
  fromNoteId: number
  target: import('@shared/note-entity-links').NoteEntityLinkTarget
}

export interface UserNoteLinkRemoveInput {
  fromNoteId: number
  linkId: number
  /** Ausgehend von dieser Notiz (Standard) oder eingehende Backlink-Verknuepfung. */
  direction?: 'outgoing' | 'incoming'
}

export type UserNoteListInRangeDateMode = 'created' | 'scheduled'

export interface UserNoteListInRangeFilters {
  startIso: string
  endIso: string
  /** Standard: `scheduled` (Hauptkalender-Overlay). */
  dateMode?: UserNoteListInRangeDateMode
  kinds?: UserNoteKind[]
  limit?: number
}

export interface UserNoteListItem extends UserNote {
  mailSubject: string | null
  mailAccountId: string | null
  mailFromAddr: string | null
  mailFromName: string | null
  mailSnippet: string | null
  mailSentAt: string | null
  mailReceivedAt: string | null
  mailIsRead: boolean | null
  mailHasAttachments: boolean | null
  /** Erste ausgehende Verknuepfung (fuer Standard-Icon bei freien Notizen). */
  primaryLinkKind?:
    | 'note'
    | 'mail'
    | 'calendar_event'
    | 'cloud_task'
    | 'people_contact'
    | null
  /** Outlook-Kategorienamen (Farben via Masterkategorien). */
  categories?: string[]
}

export interface UserNoteMailUpsertInput extends UserNoteScheduleFields {
  messageId: number
  title?: string | null
  body: string
  sectionId?: number | null
  sortOrder?: number
}

export interface UserNotePeopleContactUpsertInput {
  contactId: number
  title?: string | null
  body: string
}

export interface UserNoteCalendarKey {
  accountId: string
  calendarSource: UserNoteCalendarSource
  calendarRemoteId: string
  eventRemoteId: string
}

export interface UserNoteCalendarUpsertInput extends UserNoteCalendarKey, UserNoteScheduleFields {
  title?: string | null
  body: string
  eventTitleSnapshot?: string | null
  eventStartIsoSnapshot?: string | null
  sectionId?: number | null
  sortOrder?: number
}

export interface UserNoteStandaloneCreateInput extends UserNoteScheduleFields {
  title?: string | null
  body?: string
  sectionId?: number | null
  sortOrder?: number
  parentNoteId?: number | null
}

export interface UserNoteStandaloneUpdateInput extends UserNoteScheduleFields {
  id: number
  title?: string | null
  body?: string
  sectionId?: number | null
  sortOrder?: number
  clearSchedule?: boolean
}

export interface UserNoteListFilters {
  kinds?: UserNoteKind[]
  accountIds?: string[]
  dateFrom?: string | null
  dateTo?: string | null
  search?: string | null
  scheduledOnly?: boolean
  sectionId?: number | null
  /** Nur Notizen mit mindestens einer dieser Outlook-Kategorien. */
  categoriesAny?: string[]
  pinnedOnly?: boolean
  limit?: number
}

export interface UserNoteSearchFilters {
  query: string
  kinds?: UserNoteKind[]
  categoriesAny?: string[]
  limit?: number
}

/** Welcher Aspekt der Notiz sich geaendert hat — Renderer koennen gezielt neu laden. */
export type NotesChangedScope = 'content' | 'attachments' | 'links' | 'meta' | 'structure'

export interface NotesChangedPayload {
  kind?: UserNoteKind
  noteId?: number
  messageId?: number | null
  accountId?: string | null
  scope?: NotesChangedScope
}
