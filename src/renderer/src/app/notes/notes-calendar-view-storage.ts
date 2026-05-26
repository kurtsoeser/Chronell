import { isValidNotesCalendarFcView } from '@/lib/notes-settings-prefs'
import {
  persistNotesActiveFcView,
  readNotesActiveFcView
} from '@/app/notes/notes-active-fc-view-storage'

/** @deprecated Nutze readNotesActiveFcView */
export function readNotesCalendarFcView(): string {
  return readNotesActiveFcView()
}

export function persistNotesCalendarFcView(viewId: string): void {
  if (isValidNotesCalendarFcView(viewId)) persistNotesActiveFcView(viewId)
}
