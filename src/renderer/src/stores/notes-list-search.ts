import { create } from 'zustand'

interface NotesListSearchState {
  /** Aktiver Textfilter fuer die Notizen-Liste. Leer = kein Filter. */
  query: string
  setQuery: (query: string) => void
  clear: () => void
}

export const useNotesListSearchStore = create<NotesListSearchState>((set) => ({
  query: '',
  setQuery(query): void {
    set({ query })
  },
  clear(): void {
    set({ query: '' })
  }
}))
