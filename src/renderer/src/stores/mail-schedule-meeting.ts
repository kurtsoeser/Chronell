import { create } from 'zustand'
import type { CalendarSuggestionFromMail, MailFull } from '@shared/types'

type MailScheduleMeetingState = {
  suggestion: CalendarSuggestionFromMail | null
  loading: boolean
  error: string | null
  openFromMessageId: (messageId: number) => Promise<void>
  openFromMessage: (message: Pick<MailFull, 'id'>) => void
  close: () => void
}

export const useMailScheduleMeetingStore = create<MailScheduleMeetingState>((set) => ({
  suggestion: null,
  loading: false,
  error: null,
  async openFromMessageId(messageId: number): Promise<void> {
    set({ loading: true, error: null, suggestion: null })
    try {
      const suggestion = await window.mailClient.calendar.suggestFromMessage(messageId)
      set({ suggestion, loading: false, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ loading: false, error: msg, suggestion: null })
    }
  },
  openFromMessage(message: Pick<MailFull, 'id'>): void {
    void useMailScheduleMeetingStore.getState().openFromMessageId(message.id)
  },
  close(): void {
    set({ suggestion: null, loading: false, error: null })
  }
}))
