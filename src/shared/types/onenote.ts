/** Mail → Microsoft OneNote (Graph `/me/onenote`). */

export interface OneNoteNotebook {
  id: string
  displayName: string
  lastModifiedDateTime: string | null
  createdDateTime: string | null
  isDefault: boolean
  isShared: boolean
  clientUrl: string | null
  webUrl: string | null
}

export interface OneNoteSection {
  id: string
  displayName: string
  notebookId: string
  notebookName: string
  sectionGroupName: string | null
  lastModifiedDateTime: string | null
  createdDateTime: string | null
}

/** Chronell merkt sich, wohin zuletzt gesendet wurde. */
export interface OneNoteRecentTarget {
  notebookId: string
  sectionId: string
  notebookName: string
  sectionName: string
  usedAt: string
}

/** Zuletzt in Microsoft geöffnet (Graph Insights), sofern zuordenbar. */
export interface OneNoteOpenedHint {
  notebookId: string
  accessedAt: string
}

export interface OneNoteCatalog {
  accountId: string
  accountEmail: string
  notebooks: OneNoteNotebook[]
  sections: OneNoteSection[]
  recent: OneNoteRecentTarget[]
  opened: OneNoteOpenedHint[]
}

export interface OneNotePickResult {
  notebookId: string
  sectionId: string | null
  notebookName: string
  sectionName: string | null
}

export interface OneNoteSendMailInput {
  messageId: number
  notebookId: string
  sectionId?: string | null
  notebookName?: string | null
  sectionName?: string | null
}

export interface OneNoteSendMailResult {
  notebookId: string
  sectionId: string
  notebookName: string
  sectionName: string
  pageId: string | null
  webUrl: string | null
  clientUrl: string | null
  hasAttachments: boolean
}
