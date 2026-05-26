import { endOfMonth, format, startOfMonth } from 'date-fns'
import { readNotesSettingsPrefs, type NotesDateFilterMode } from '@/lib/notes-settings-prefs'

export function initialNotesDateRangeFromPrefs(): {
  dateFrom: string
  dateTo: string
  miniMonth: Date
  scheduledOnly: boolean
} {
  const mode: NotesDateFilterMode = readNotesSettingsPrefs().defaultDateFilterMode
  const now = new Date()
  if (mode === 'current_month') {
    const start = startOfMonth(now)
    const end = endOfMonth(now)
    return {
      dateFrom: format(start, 'yyyy-MM-dd'),
      dateTo: format(end, 'yyyy-MM-dd'),
      miniMonth: start,
      scheduledOnly: false
    }
  }
  return {
    dateFrom: '',
    dateTo: '',
    miniMonth: startOfMonth(now),
    scheduledOnly: mode === 'scheduled_only'
  }
}
