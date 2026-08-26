import { create } from 'zustand'

interface CalendarEventSearchState {
  /** Aktiver Textfilter fuer Kalenderansichten (Titel/Ort). Leer = kein Filter. */
  query: string
  setQuery: (query: string) => void
  clear: () => void
}

export const useCalendarEventSearchStore = create<CalendarEventSearchState>((set) => ({
  query: '',
  setQuery(query): void {
    set({ query })
  },
  clear(): void {
    set({ query: '' })
  }
}))
