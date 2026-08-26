import { create } from 'zustand'

interface TasksListSearchState {
  /** Aktiver Textfilter fuer Aufgabenlisten (Titel/Notizen). Leer = kein Filter. */
  query: string
  setQuery: (query: string) => void
  clear: () => void
}

export const useTasksListSearchStore = create<TasksListSearchState>((set) => ({
  query: '',
  setQuery(query): void {
    set({ query })
  },
  clear(): void {
    set({ query: '' })
  }
}))
