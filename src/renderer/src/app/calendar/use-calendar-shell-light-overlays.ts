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
import {
  mailTodoCalendarDisplaySignature,
  userNoteCalendarDisplaySignature
} from '@/app/calendar/calendar-overlay-display-signature'

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
  const mailTodoLayerSigRef = useRef('')
  const mailTodoRangeKeyRef = useRef('')
  const userNoteLayerSigRef = useRef('')
  const userNoteRangeKeyRef = useRef('')

  useEffect(() => {
    if (migrateLegacyCalendarShellSource()) {
      setMailTodoOverlay(true)
    }
  }, [setMailTodoOverlay])

  const commitMailTodoLayer = useCallback((list: MailListItem[], start: Date, end: Date): void => {
    const rangeKey = `${start.toISOString()}|${end.toISOString()}`
    const sig = mailTodoCalendarDisplaySignature(list)
    if (sig === mailTodoLayerSigRef.current && rangeKey === mailTodoRangeKeyRef.current) return
    mailTodoLayerSigRef.current = sig
    mailTodoRangeKeyRef.current = rangeKey
    setMailTodoItems(list)
  }, [])

  const commitUserNoteLayer = useCallback((list: UserNoteListItem[], start: Date, end: Date): void => {
    const rangeKey = `${start.toISOString()}|${end.toISOString()}`
    const sig = userNoteCalendarDisplaySignature(list)
    if (sig === userNoteLayerSigRef.current && rangeKey === userNoteRangeKeyRef.current) return
    userNoteLayerSigRef.current = sig
    userNoteRangeKeyRef.current = rangeKey
    setUserNoteRangeItems(list)
  }, [])

  const loadMailTodosForRange = useCallback(async (start: Date, end: Date): Promise<void> => {
    if (!mailTodoOverlayRef.current) return
    try {
      const list = await window.mailClient.mail.listTodoMessagesInRange({
        accountId: null,
        rangeStartIso: start.toISOString(),
        rangeEndIso: end.toISOString(),
        limit: 500
      })
      commitMailTodoLayer(list, start, end)
    } catch (err) {
      logIpcError('calendar.loadMailTodosForRange', err)
      mailTodoLayerSigRef.current = ''
      mailTodoRangeKeyRef.current = ''
      setMailTodoItems([])
    }
  }, [commitMailTodoLayer])

  const loadUserNotesForRange = useCallback(async (start: Date, end: Date): Promise<void> => {
    if (!userNoteOverlayRef.current) return
    try {
      const list = await window.mailClient.notes.listInRange({
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        limit: 500
      })
      commitUserNoteLayer(list, start, end)
    } catch (err) {
      logIpcError('calendar.loadUserNotesForRange', err)
      userNoteLayerSigRef.current = ''
      userNoteRangeKeyRef.current = ''
      setUserNoteRangeItems([])
    }
  }, [commitUserNoteLayer])

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
      mailTodoLayerSigRef.current = ''
      mailTodoRangeKeyRef.current = ''
      setMailTodoItems([])
      return
    }
    const range = lastRangeRef.current
    if (!range) return
    void loadMailTodosForRange(range.start, range.end)
  }, [mailTodoOverlay, loadMailTodosForRange, lastRangeRef])

  useEffect(() => {
    if (!mailTodoOverlay) return
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const off = window.mailClient.events.onMailChanged(() => {
      const range = lastRangeRef.current
      if (!range) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void loadMailTodosForRange(range.start, range.end)
      }, 400)
    })
    return (): void => {
      off()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [mailTodoOverlay, loadMailTodosForRange, lastRangeRef])

  useEffect(() => {
    if (!userNoteOverlay) {
      userNoteLayerSigRef.current = ''
      userNoteRangeKeyRef.current = ''
      setUserNoteRangeItems([])
      return
    }
    const range = lastRangeRef.current
    if (!range) return
    void loadUserNotesForRange(range.start, range.end)
  }, [userNoteOverlay, loadUserNotesForRange, lastRangeRef])

  useEffect(() => {
    if (!userNoteOverlay) return
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const off = window.mailClient.events.onNotesChanged(() => {
      const range = lastRangeRef.current
      if (!range) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void loadUserNotesForRange(range.start, range.end)
      }, 400)
    })
    return (): void => {
      off()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
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
