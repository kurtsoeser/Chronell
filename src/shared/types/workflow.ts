export interface WorkflowMailFolderUiState {
  prefs: {
    wipFolderRemoteId: string | null
    doneFolderRemoteId: string | null
  } | null
  wipFolderId: number | null
  doneFolderId: number | null
}

/** Rueckgabe von `mail:ensure-workflow-mail-folders` (Microsoft). */
export interface EnsureWorkflowMailFoldersResult {
  wipFolderId: number
  doneFolderId: number
  wipFolderRemoteId: string
  doneFolderRemoteId: string
}

/** Kalender-Eintrag fuer die UI (Graph + Google). */
