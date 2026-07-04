import type { FilesMailCategory } from './attachment-category'
import type { ComposeDriveExplorerScope, ComposeListDriveExplorerInput } from './types'

export type { FilesMailCategory } from './attachment-category'

/** Zielordner für Upload (OneDrive / SharePoint). */
export interface FilesDriveUploadDestination {
  accountId: string
  scope: ComposeDriveExplorerScope
  folderId: string | null
  folderDriveId: string | null
  siteId?: string | null
}

export interface FilesDriveUploadDestinationPick extends FilesDriveUploadDestination {
  /** Brotkrumen-Pfad zur Anzeige */
  folderLabel: string
}

export interface FilesSaveMailToDriveInput {
  fileId: number
  destination: FilesDriveUploadDestination
}

export interface FilesSaveMailToDriveResult {
  ok: boolean
  webUrl?: string
  name?: string
  error?: string
}

/** UI-Quelle im Modul „Dateien“. */
export type FilesShellSourceId = 'mail' | 'cloud'

export type FilesSourceId = 'mail' | 'onedrive' | 'sharepoint' | 'google_drive'

export type FileElementType = 'email' | 'cloud' | 'note'

export type FilesMailSortBy = 'receivedAt' | 'name' | 'size' | 'subject'
export type FilesSortDir = 'asc' | 'desc'

/** Listen- oder Kachelansicht im Modul „Dateien“. */
export type FilesMailViewMode = 'table' | 'tiles'

/** Gruppierung der Mail-Dateiliste im Modul „Dateien“. */
export type FilesMailGroupBy =
  | 'date'
  | 'fileType'
  | 'size'
  | 'nameLetter'
  | 'from'
  | 'account'
  | 'extension'
  | 'subjectLetter'

/** Zeile im Modul „Dateien“ (Quelle: Mail-Anhänge). */
export interface MailFileIndexRow {
  id: number
  messageId: number
  accountId: string
  remoteAttachmentId: string
  name: string
  mime: string | null
  size: number | null
  receivedAt: string | null
  subject: string
  fromAddr: string | null
  elementType: 'email'
}

export interface FilesListMailQuery {
  accountIds?: string[]
  category?: FilesMailCategory
  search?: string
  sortBy?: FilesMailSortBy
  sortDir?: FilesSortDir
  limit?: number
  offset?: number
  /** Anhänge von Mails mit dieser Korrespondenz-Adresse (From/To/Cc). */
  contactEmail?: string
  /** Mehrere Adressen (People-Aliase); ergänzt `contactEmail`. */
  contactEmails?: string[]
  /** Papierkorb/Junk bei Kontaktfilter auslassen (Standard: true). */
  excludeDeletedJunk?: boolean
}

export interface FilesListMailResult {
  rows: MailFileIndexRow[]
  total: number
}

export interface FilesMailIndexStatus {
  pending: number
  enabled: boolean
}

/** Zeile bei Quelle OneDrive / SharePoint / Google Drive. */
export interface CloudFileRow {
  rowKey: string
  accountId: string
  cloudProvider: 'microsoft' | 'google'
  itemId: string
  driveId: string | null
  siteId: string | null
  name: string
  webUrl: string | null
  mime: string | null
  size: number | null
  isFolder: boolean
  scope: ComposeDriveExplorerScope | GoogleDriveExplorerScope
  locationLabel: string
  elementType: 'cloud'
}

export type FilesListCloudInput = ComposeListDriveExplorerInput

export interface FilesSaveCloudItemInput {
  accountId: string
  itemId: string
  driveId?: string | null
  suggestedName?: string
}

export interface FilesSaveCloudItemResult {
  ok: boolean
  path?: string
  error?: string
  cancelled?: boolean
}

export interface FilesOpenCloudItemResult {
  ok: boolean
  error?: string
}

/** Google-Drive-Bereich im Dateien-Modul. */
export type GoogleDriveExplorerScope = 'mydrive' | 'sharedWithMe' | 'starred'

export interface FilesListGoogleDriveInput {
  accountId: string
  scope: GoogleDriveExplorerScope
  /** Ordner-ID; `null` = Wurzel des Bereichs. */
  folderId?: string | null
}

export interface GoogleDriveExplorerNavCrumb {
  id: string | null
  name: string
}
