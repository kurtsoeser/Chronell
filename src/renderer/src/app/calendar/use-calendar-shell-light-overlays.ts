import { useCallback, useEffect, useMemo, useRef, useState, type RefObject, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { MailListItem, UserNoteListItem } from '@shared/types'
import {
  mailTodoItemsToFullCalendarEvents
} from '@/app/calendar/mail-todo-calendar'
import { notesToFullCalendarEvents } from '@/app/calendar/notes-calendar'
import {
  migrateLegacyCalendarShellSource,
  persistMailTodoOverlay,
  persistUserNoteOverlay,
  readMailTodoOverlayFromStorage,
  readUserNoteOverlayFromStorage
} from '@/app/calendar/calendar-shell-storage'
import { logIpcError } from '@/lib/ipc-error-log'

export function useCalendarShellLightOverlays(
  accountColorById: Record<string, string>,
  lastRangeRef: RefObject<{ start: Date; end: Date }>
) {
  const { t } = useTranslation()

  const [mailTodoOverlay, setMailTodoOverlayState] = useState<boolean>(readMailTodoOverlayFromStorage)
  const mailTodoOverlayRef = useRef(mailTodoOverlay)
  mailTodoOverlayRef.current = mailTodoOverlay
  const setMailTodoOverlay = useCallback((value: SetStateAction<boolean>): void => {
    setMailTodoOverlayState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      persistMailTodoOverlay(next)
      return next
    })
  }, [])

  const [userNoteOverlay, setUserNoteOverlayState] = useState<boolean>(readUserNoteOverlayFromStorage)
  const userNoteOverlayRef = useRef(userNoteOverlay)
  userNoteOverlayRef.current = userNoteOverlay
  const setUserNoteOverlay = useCallback((value: SetStateAction<boolean>): void => {
    setUserNoteOverlayState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      persistUserNoteOverlay(next)
      return next
    })
  }, [])

  const [mailTodoItems, setMailTodoItems] = useState<MailListItem[]>([])
  const [userNoteRangeItems, setUserNoteRangeItems] = useState<UserNoteListItem[]>([])

  useEffect(() => {
    if (migrateLegacyCalendarShellSource()) {
      setMailTodoOverlay(true)
    }
  }, [setMailTodoOverlay])

  const loadMailTodosForRange = useCallback(async (start: Date, end: Date): Promise<void> => {
    if (!mailTodoOverlayRef.current) return
    try {
      const list = await window.mailClient.mail.listTodoMessagesInRange({
        accountId: null,
        rangeStartIso: start.toISOString(),
        rangeEndIso: end.toISOString(),
        limit: 500
      })
      setMailTodoItems(list)
    } catch (err) {
      logIpcError('calendar.loadMailTodosForRange', err)
      setMailTodoItems([])
    }
  }, [])

  const loadUserNotesForRange = useCallback(async (start: Date, end: Date): Promise<void> => {
    if (!userNoteOverlayRef.current) return
    try {
      const list = await window.mailClient.notes.listInRange({
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        limit: 500
      })
      setUserNoteRangeItems(list)
    } catch (err) {
      logIpcError('calendar.loadUserNotesForRange', err)
      setUserNoteRangeItems([])
    }
  }, [])

  const mailTodoFcEvents = useMemo(
    () => mailTodoItemsToFullCalendarEvents(mailTodoItems, accountColorById),
    [mailTodoItems, accountColorById]
  )

  const userNoteFcEvents = useMemo(
    () => notesToFullCalendarEvents(userNoteRangeItems, { defaultTitle: t('notes.shell.untitled') }),
    [userNoteRangeItems, t]
  )

  useEffect(() => {
    if (!mailTodoOverlay) {
      setMailTodoItems([])
      return
    }
    const range = lastRangeRef.current
    if (!range) return
    void loadMailTodosForRange(range.start, range.end)
  }, [mailTodoOverlay, loadMailTodosForRange, lastRangeRef])

  useEffect(() => {
    if (!mailTodoOverlay) return
    const off = window.mailClient.events.onMailChanged(() => {
      const range = lastRangeRef.current
      if (!range) return
      void loadMailTodosForRange(range.start, range.end)
    })
    return off
  }, [mailTodoOverlay, loadMailTodosForRange, lastRangeRef])

  useEffect(() => {
    if (!userNoteOverlay) {
      setUserNoteRangeItems([])
      return
    }
    const range = lastRangeRef.current
    if (!range) return
    void loadUserNotesForRange(range.start, range.end)
  }, [userNoteOverlay, loadUserNotesForRange, lastRangeRef])

  useEffect(() => {
    if (!userNoteOverlay) return
    const off = window.mailClient.events.onNotesChanged(() => {
      const range = lastRangeRef.current
      if (!range) return
      void loadUserNotesForRange(range.start, range.end)
    })
    return off
  }, [userNoteOverlay, loadUserNotesForRange, lastRangeRef])

  return {
    mailTodoOverlay,
    setMailTodoOverlay,
    mailTodoOverlayRef,
    mailTodoItems,
    setMailTodoItems,
    loadMailTodosForRange,
    userNoteOverlay,
    setUserNoteOverlay,
    userNoteOverlayRef,
    userNoteRangeItems,
    setUserNoteRangeItems,
    loadUserNotesForRange,
    mailTodoFcEvents,
    userNoteFcEvents
  }
}
