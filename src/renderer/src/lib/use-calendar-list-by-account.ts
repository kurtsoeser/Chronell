import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarGraphCalendarRow, ConnectedAccount } from '@shared/types'
import { CALENDAR_VISIBILITY_CHANGED_EVENT } from '@/lib/calendar-visibility-storage'

export function useCalendarListByAccount(
  calendarLinkedAccounts: ConnectedAccount[]
): Record<string, CalendarGraphCalendarRow[]> {
  const [calendarsByAccount, setCalendarsByAccount] = useState<
    Record<string, CalendarGraphCalendarRow[]>
  >({})

  const accountKey = calendarLinkedAccounts
    .map((a) => a.id)
    .sort()
    .join('\u001f')

  const accountsRef = useRef(calendarLinkedAccounts)
  accountsRef.current = calendarLinkedAccounts

  const load = useCallback(async (): Promise<void> => {
    const linked = accountsRef.current
    if (linked.length === 0) {
      setCalendarsByAccount({})
      return
    }
    const next: Record<string, CalendarGraphCalendarRow[]> = {}
    await Promise.all(
      linked.map(async (acc) => {
        try {
          next[acc.id] = await window.mailClient.calendar.listCalendars({ accountId: acc.id })
        } catch {
          next[acc.id] = []
        }
      })
    )
    setCalendarsByAccount(next)
  }, [accountKey])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onVis = (): void => {
      void load()
    }
    window.addEventListener(CALENDAR_VISIBILITY_CHANGED_EVENT, onVis)
    return () => window.removeEventListener(CALENDAR_VISIBILITY_CHANGED_EVENT, onVis)
  }, [load])

  return calendarsByAccount
}
