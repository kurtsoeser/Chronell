import { create } from 'zustand'
import type { CloudFileRow, MailFileIndexRow } from '@shared/files'
import type { ChronellEntityRef } from '@shared/entity-ref'

export type FilesContextTarget =
  | { source: 'mail'; row: MailFileIndexRow }
  | { source: 'cloud'; row: CloudFileRow }

interface FilesContextUiState {
  noteAttachTarget: FilesContextTarget | null
  entityLinkAnchor: ChronellEntityRef | null
  createTaskInitial: { title: string; notes?: string; accountId?: string } | null
  createCalendarInitial: {
    subject: string
    accountId?: string
    referenceAttachments?: { name: string; sourceUrl: string }[]
    attachments?: { name: string; contentType: string; size: number; dataBase64: string }[]
  } | null
  openNoteAttach: (target: FilesContextTarget) => void
  closeNoteAttach: () => void
  openEntityLink: (anchor: ChronellEntityRef) => void
  closeEntityLink: () => void
  openCreateTask: (initial: { title: string; notes?: string; accountId?: string }) => void
  closeCreateTask: () => void
  openCreateCalendar: (initial: {
    subject: string
    accountId?: string
    referenceAttachments?: { name: string; sourceUrl: string }[]
    attachments?: { name: string; contentType: string; size: number; dataBase64: string }[]
  }) => void
  closeCreateCalendar: () => void
}

export const useFilesContextUiStore = create<FilesContextUiState>((set) => ({
  noteAttachTarget: null,
  entityLinkAnchor: null,
  createTaskInitial: null,
  createCalendarInitial: null,
  openNoteAttach(target): void {
    set({ noteAttachTarget: target })
  },
  closeNoteAttach(): void {
    set({ noteAttachTarget: null })
  },
  openEntityLink(anchor): void {
    set({ entityLinkAnchor: anchor })
  },
  closeEntityLink(): void {
    set({ entityLinkAnchor: null })
  },
  openCreateTask(initial): void {
    set({ createTaskInitial: initial })
  },
  closeCreateTask(): void {
    set({ createTaskInitial: null })
  },
  openCreateCalendar(initial): void {
    set({ createCalendarInitial: initial })
  },
  closeCreateCalendar(): void {
    set({ createCalendarInitial: null })
  }
}))
