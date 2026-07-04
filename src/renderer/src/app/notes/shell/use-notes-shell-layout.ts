import { useCallback, useRef, useState } from 'react'
import type FullCalendar from '@fullcalendar/react'
import { readNotesActiveFcView } from '@/app/notes/notes-active-fc-view-storage'
import { readNotesCalendarDateMode } from '@/app/notes/notes-calendar-date-mode-storage'
import {
  persistNotesActiveShellView,
  readNotesActiveShellView
} from '@/app/notes/notes-active-shell-view-storage'
import type { NotesCalendarDateMode } from '@/app/calendar/notes-calendar'
import type { NotesShellView } from '@/app/notes/NotesShellViewToggle'
import { useResizableWidth } from '@/components/ResizableSplitter'
import {
  MODULE_NAV_COLUMN_LEGACY_KEYS,
  MODULE_NAV_COLUMN_WIDTH_MAX,
  MODULE_NAV_COLUMN_WIDTH_MIN,
  useModuleNavColumnWidth
} from '@/lib/module-nav-column-width'
import {
  NOTES_CALENDAR_PREVIEW_WIDTH_KEY,
  NOTES_DETAIL_WIDTH_KEY,
  NOTES_NAV_WIDTH_KEY
} from '@/app/notes/shell/notes-shell-types'
import type { NotesSettingsPrefsV1 } from '@/lib/notes-settings-prefs'

export function useNotesShellLayout(notesSettings: NotesSettingsPrefsV1) {
  const [shellView, setShellView] = useState<NotesShellView>(() => readNotesActiveShellView())
  const notesCalendarRef = useRef<FullCalendar | null>(null)
  const [calendarFcView, setCalendarFcView] = useState(() => readNotesActiveFcView())
  const [calendarDateMode, setCalendarDateMode] = useState<NotesCalendarDateMode>(() =>
    readNotesCalendarDateMode()
  )
  const [calendarTitle, setCalendarTitle] = useState('')

  const [globalNavWidth, setGlobalNavWidth] = useModuleNavColumnWidth()
  const [notesNavWidth, setNotesNavWidth] = useResizableWidth({
    storageKey: NOTES_NAV_WIDTH_KEY,
    defaultWidth: notesSettings.defaultNavColumnWidth,
    minWidth: MODULE_NAV_COLUMN_WIDTH_MIN,
    maxWidth: MODULE_NAV_COLUMN_WIDTH_MAX,
    legacyStorageKeys: MODULE_NAV_COLUMN_LEGACY_KEYS
  })
  const navWidth = notesSettings.useGlobalModuleNavWidth ? globalNavWidth : notesNavWidth
  const setNavWidth = notesSettings.useGlobalModuleNavWidth ? setGlobalNavWidth : setNotesNavWidth

  const [calendarEditorWidth, setCalendarEditorWidth] = useResizableWidth({
    storageKey: NOTES_CALENDAR_PREVIEW_WIDTH_KEY,
    defaultWidth: 520,
    minWidth: 320,
    maxWidth: 960
  })

  const [detailColumnWidth, setDetailColumnWidth] = useResizableWidth({
    storageKey: NOTES_DETAIL_WIDTH_KEY,
    defaultWidth: notesSettings.defaultDetailColumnWidth,
    minWidth: 220,
    maxWidth: 480
  })

  const onShellViewChange = useCallback((view: NotesShellView): void => {
    setShellView(view)
    persistNotesActiveShellView(view)
  }, [])

  const onCalendarFcViewChange = useCallback((viewId: string): void => {
    setCalendarFcView(viewId)
  }, [])

  return {
    shellView,
    onShellViewChange,
    notesCalendarRef,
    calendarFcView,
    onCalendarFcViewChange,
    calendarDateMode,
    setCalendarDateMode,
    calendarTitle,
    setCalendarTitle,
    navWidth,
    setNavWidth,
    detailColumnWidth,
    setDetailColumnWidth,
    calendarEditorWidth,
    setCalendarEditorWidth
  }
}
