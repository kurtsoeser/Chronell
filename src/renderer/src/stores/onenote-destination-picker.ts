import { create } from 'zustand'
import type { OneNotePickResult } from '@shared/types/onenote'

interface OneNoteDestinationPickerStore {
  open: boolean
  messageId: number | null
  subject: string
  _finish: ((result: OneNotePickResult | null) => void) | null
  close: (result: OneNotePickResult | null) => void
}

const initial = {
  open: false,
  messageId: null as number | null,
  subject: '',
  _finish: null as ((result: OneNotePickResult | null) => void) | null
}

export const useOneNoteDestinationPickerStore = create<OneNoteDestinationPickerStore>(
  (set, get) => ({
    ...initial,

    close(result: OneNotePickResult | null): void {
      const fn = get()._finish
      set({ ...initial })
      fn?.(result)
    }
  })
)

export function pickOneNoteDestination(options: {
  messageId: number
  subject?: string | null
}): Promise<OneNotePickResult | null> {
  return new Promise((resolve) => {
    useOneNoteDestinationPickerStore.setState({
      open: true,
      messageId: options.messageId,
      subject: options.subject?.trim() ?? '',
      _finish: resolve
    })
  })
}
