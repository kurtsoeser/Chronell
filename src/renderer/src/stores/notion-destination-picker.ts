import { create } from 'zustand'
import type {
  CalendarEventView,
  NotionPickIntent,
  NotionPickResult
} from '@shared/types'

export type NotionPickKind = 'mail' | 'calendar' | 'note'

export interface NotionPickOptions {
  suggestedTitle?: string
  /** Mail-ID beim Senden aus dem Kontextmenü (für „Neue Seite mit Inhalt“). */
  messageId?: number
  /** Notiz-ID beim Senden aus dem Notizen-Kontextmenü. */
  noteId?: number
  /** Termin beim Senden aus dem Kalender-Kontextmenü. */
  calendarEvent?: CalendarEventView
  localeCode?: 'de' | 'en'
  /** append = an Seite anhaengen; createUnder = Elternseite fuer neue Notion-Seite waehlen. */
  intent?: NotionPickIntent
}

interface NotionDestinationPickerStore {
  open: boolean
  kind: NotionPickKind | null
  intent: NotionPickIntent
  suggestedTitle: string
  messageId: number | null
  noteId: number | null
  calendarEvent: CalendarEventView | null
  localeCode: 'de' | 'en'
  _finish: ((result: NotionPickResult | null) => void) | null
  close: (result: NotionPickResult | null) => void
}

const initial = {
  open: false,
  kind: null as NotionPickKind | null,
  intent: 'append' as NotionPickIntent,
  suggestedTitle: '',
  messageId: null as number | null,
  noteId: null as number | null,
  calendarEvent: null as CalendarEventView | null,
  localeCode: 'de' as const,
  _finish: null as ((result: NotionPickResult | null) => void) | null
}

export const useNotionDestinationPickerStore = create<NotionDestinationPickerStore>((set, get) => ({
  ...initial,

  close(result: NotionPickResult | null): void {
    const fn = get()._finish
    set({ ...initial })
    fn?.(result)
  }
}))

export function pickNotionDestination(
  kind: NotionPickKind,
  options?: NotionPickOptions
): Promise<NotionPickResult | null> {
  return new Promise((resolve) => {
    useNotionDestinationPickerStore.setState({
      open: true,
      kind,
      intent: options?.intent === 'createUnder' ? 'createUnder' : 'append',
      suggestedTitle: options?.suggestedTitle?.trim() ?? '',
      messageId: options?.messageId ?? null,
      noteId: options?.noteId ?? null,
      calendarEvent: options?.calendarEvent ?? null,
      localeCode: options?.localeCode === 'en' ? 'en' : 'de',
      _finish: resolve
    })
  })
}
