import { create } from 'zustand'

interface SnoozePickerAnchor {
  x: number
  y: number
}

interface SnoozeUiState {
  /** Mail, fuer die der Picker geoeffnet ist. null = geschlossen. */
  pendingMessageId: number | null
  /** Zusaetzliche Mails fuer Massen-Snooze (gleiche Uhrzeit). */
  bulkMessageIds: number[] | null
  anchor: SnoozePickerAnchor | null
  open: (messageId: number, anchor: SnoozePickerAnchor, bulkMessageIds?: number[]) => void
  close: () => void
}

/**
 * Steuert das Snooze-Picker-Overlay. Mehrere Aufrufer (Triage-Bar,
 * MailRow-Actions, globaler Shortcut) koennen den Picker oeffnen,
 * ohne dass der Picker an einem konkreten Component haengt.
 */
export const useSnoozeUiStore = create<SnoozeUiState>((set) => ({
  pendingMessageId: null,
  bulkMessageIds: null,
  anchor: null,
  open(messageId, anchor, bulkMessageIds): void {
    const bulk =
      bulkMessageIds && bulkMessageIds.length > 1
        ? [...new Set(bulkMessageIds.filter((id) => Number.isFinite(id)))]
        : null
    set({ pendingMessageId: messageId, anchor, bulkMessageIds: bulk })
  },
  close(): void {
    set({ pendingMessageId: null, bulkMessageIds: null, anchor: null })
  }
}))
