import { create } from 'zustand'

interface PeoplePendingFocusState {
  pendingContactId: number | null
  pendingStartEdit: boolean
  setPendingContactId: (id: number | null) => void
  /** Kontakt fokussieren und optional direkt in den Bearbeitungsmodus wechseln. */
  setPendingContactFocus: (id: number, options?: { startEdit?: boolean }) => void
  takePendingContactId: () => number | null
  takePendingStartEdit: () => boolean
}

export const usePeoplePendingFocusStore = create<PeoplePendingFocusState>((set, get) => ({
  pendingContactId: null,
  pendingStartEdit: false,
  setPendingContactId(id): void {
    set({ pendingContactId: id, pendingStartEdit: false })
  },
  setPendingContactFocus(id, options): void {
    set({ pendingContactId: id, pendingStartEdit: Boolean(options?.startEdit) })
  },
  takePendingContactId(): number | null {
    const id = get().pendingContactId
    if (id != null) set({ pendingContactId: null })
    return id
  },
  takePendingStartEdit(): boolean {
    const startEdit = get().pendingStartEdit
    if (startEdit) set({ pendingStartEdit: false })
    return startEdit
  }
}))
