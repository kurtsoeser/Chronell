import { create } from 'zustand'
import type { MailNoteSelection } from '@/lib/mail-to-note'

interface NotePickerState {
  open: boolean
  messageId: number | null
  selection: MailNoteSelection | null
  openForMailAppend: (messageId: number, selection?: MailNoteSelection | null) => void
  close: () => void
}

export const useNotePickerStore = create<NotePickerState>((set) => ({
  open: false,
  messageId: null,
  selection: null,
  openForMailAppend(messageId, selection = null): void {
    set({ open: true, messageId, selection })
  },
  close(): void {
    set({ open: false, messageId: null, selection: null })
  }
}))
