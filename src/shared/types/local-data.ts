export const LOCAL_DATA_ARCHIVE_FORMAT_VERSION = 1 as const

export type LocalDataArchiveExportMode = 'portable' | 'full'

export interface LocalDataUsageCategory {
  id: string
  /** i18n-Key fuer die Anzeige */
  labelKey: string
  bytes: number
  fileCount: number
  canOptimize: boolean
}

export interface LocalDataUsageBreakdown {
  /** Ordner `data/` inkl. mail.db (+ WAL/SHM). */
  databaseBytes: number
  /** Chromium-Caches, blob_storage, attachment-cache. */
  cacheBytes: number
  /** Konten-Token, Bilder, Notiz-Anhaenge, config, Local Storage, … */
  essentialBytes: number
  /** Dateien in attachment-cache aelter als die Aufbewahrungsfrist. */
  attachmentCacheStaleBytes: number
}

export interface LocalDataUsageReport {
  userDataPath: string
  totalBytes: number
  totalFileCount: number
  reclaimableBytes: number
  breakdown: LocalDataUsageBreakdown
  categories: LocalDataUsageCategory[]
}

export interface LocalDataOptimizeResult {
  freedBytes: number
  beforeTotalBytes: number
  afterTotalBytes: number
  /** Chromium-Ordner waren gesperrt; Rest wird beim naechsten App-Start entfernt. */
  chromiumCacheNeedsRestart?: boolean
  details: {
    cacheAndTempBytes: number
    attachmentCacheStaleBytes: number
    databaseBytes: number
    orphanAvatarsBytes: number
    orphanContactPhotosBytes: number
  }
}

export type LocalDataArchiveExportResult =
  | { ok: true; path: string; mode: LocalDataArchiveExportMode }
  | { ok: false; cancelled: true }

export type LocalDataArchiveImportResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

/** Einstellungen-UI: gespeicherte Remote-IDs und aufloesbare lokale Ordner-IDs. */
