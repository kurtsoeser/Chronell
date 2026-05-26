import { create } from 'zustand'
import type { CalendarParseIcsFileResult } from '@shared/types'

interface CalendarIcsImportState {
  open: boolean
  loading: boolean
  parsed: CalendarParseIcsFileResult | null
  error: string | null
  openFromFilePath: (filePath: string) => Promise<void>
  openFromPicker: () => Promise<void>
  close: () => void
}

export const useCalendarIcsImportStore = create<CalendarIcsImportState>((set, get) => ({
  open: false,
  loading: false,
  parsed: null,
  error: null,

  async openFromFilePath(filePath: string): Promise<void> {
    const p = filePath.trim()
    if (!p) return
    set({ open: true, loading: true, parsed: null, error: null })
    try {
      const parsed = await window.mailClient.calendar.parseIcsFile(p)
      if (parsed.events.length === 0) {
        set({
          loading: false,
          error: parsed.warnings[0] ?? 'Keine Termine in der Datei.'
        })
        return
      }
      set({ loading: false, parsed })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  },

  async openFromPicker(): Promise<void> {
    set({ open: true, loading: true, parsed: null, error: null })
    try {
      const result = await window.mailClient.calendar.pickIcsFile()
      if ('cancelled' in result && result.cancelled) {
        const wasOpen = get().parsed != null
        if (!wasOpen) {
          set({ open: false, loading: false })
        } else {
          set({ loading: false })
        }
        return
      }
      const parsed = result as CalendarParseIcsFileResult
      if (parsed.events.length === 0) {
        set({
          loading: false,
          error: parsed.warnings[0] ?? 'Keine Termine in der Datei.'
        })
        return
      }
      set({ loading: false, parsed })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  },

  close(): void {
    set({ open: false, loading: false, parsed: null, error: null })
  }
}))
