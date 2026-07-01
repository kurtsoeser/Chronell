import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import type { Dispatch, SetStateAction } from 'react'
import type { ConnectedAccount } from '@shared/types'
import type { SchedulingSlot } from '@shared/scheduling-types'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { clearSchedulingDraft } from '@/app/calendar/scheduling-draft-storage'
import { persistRightPreviewOpen } from '@/app/calendar/calendar-shell-storage'

export function useCalendarShellSchedulingActions(
  msAccounts: ConnectedAccount[],
  dismissQuickCreate: () => void,
  t: TFunction,
  setSchedulingOpen: Dispatch<SetStateAction<boolean>>,
  setSchedulingSlots: Dispatch<SetStateAction<SchedulingSlot[]>>,
  setSchedulingAccountId: Dispatch<SetStateAction<string>>,
  setSchedulingDurationMin: Dispatch<SetStateAction<number>>,
  setSchedulingMeetingTitle: Dispatch<SetStateAction<string>>,
  setRightPreviewOpen: (open: boolean) => void,
  setPreviewDockStripInDom: (v: boolean) => void
) {
  const closeSchedulingPanel = useCallback((): void => {
    setSchedulingOpen(false)
  }, [setSchedulingOpen])

  const openSchedulingPanel = useCallback((): void => {
    if (msAccounts.length === 0) return
    dismissQuickCreate()
    clearSchedulingDraft()
    const preferred =
      msAccounts.find((a) => a.bookWithMeUrl?.trim()) ?? msAccounts[0]!
    setSchedulingAccountId(preferred.id)
    setSchedulingSlots([])
    setSchedulingDurationMin(30)
    setSchedulingMeetingTitle(
      t('calendar.scheduling.defaultMeetingTitle', { name: preferred.displayName })
    )
    setSchedulingOpen(true)
    persistRightPreviewOpen(true)
    setRightPreviewOpen(true)
    setPreviewDockStripInDom(true)
  }, [
    msAccounts,
    dismissQuickCreate,
    t,
    setSchedulingOpen,
    setSchedulingSlots,
    setSchedulingAccountId,
    setSchedulingDurationMin,
    setSchedulingMeetingTitle,
    setRightPreviewOpen,
    setPreviewDockStripInDom
  ])

  const addSchedulingSlot = useCallback(
    (range: CalendarCreateRange): void => {
      const slot: SchedulingSlot = {
        id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        startIso: range.start.toISOString(),
        endIso: range.end.toISOString(),
        isAllDay: range.allDay
      }
      setSchedulingSlots((prev) =>
        [...prev, slot].sort(
          (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime()
        )
      )
    },
    [setSchedulingSlots]
  )

  return { closeSchedulingPanel, openSchedulingPanel, addSchedulingSlot }
}
