import { create } from 'zustand'
import type { EventsOsInboxKind } from '@shared/types/events-os'

export type EventsOsPickResult = {
  eventId: string
  title: string
  kind: EventsOsInboxKind
  studioAkteUrl?: string
}

interface EventsOsDestinationPickerStore {
  open: boolean
  messageId: number | null
  suggestedQuery: string
  subject: string
  _finish: ((result: EventsOsPickResult | null) => void) | null
  close: (result: EventsOsPickResult | null) => void
}

const initial = {
  open: false,
  messageId: null as number | null,
  suggestedQuery: '',
  subject: '',
  _finish: null as ((result: EventsOsPickResult | null) => void) | null
}

export const useEventsOsDestinationPickerStore = create<EventsOsDestinationPickerStore>(
  (set, get) => ({
    ...initial,
    close(result: EventsOsPickResult | null): void {
      const fn = get()._finish
      set({ ...initial })
      fn?.(result)
    }
  })
)

export function pickEventsOsDestination(options: {
  messageId: number
  suggestedQuery?: string
  subject?: string
}): Promise<EventsOsPickResult | null> {
  return new Promise((resolve) => {
    useEventsOsDestinationPickerStore.setState({
      open: true,
      messageId: options.messageId,
      suggestedQuery: options.suggestedQuery?.trim() || '',
      subject: options.subject?.trim() || '',
      _finish: resolve
    })
  })
}
