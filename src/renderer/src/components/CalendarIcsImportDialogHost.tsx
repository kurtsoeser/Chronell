import { useEffect, useMemo } from 'react'
import { CalendarIcsImportDialog } from '@/components/CalendarIcsImportDialog'
import { useCalendarIcsImportStore } from '@/stores/calendar-ics-import'
import { useAccountsStore } from '@/stores/accounts'
import { useAppModeStore } from '@/stores/app-mode'

/**
 * Globaler Dialog zum Import von .ics-Dateien. In `App.tsx` mounten;
 * oeffnen per Dateizuordnung, IPC-Event oder `useCalendarIcsImportStore`.
 */
export function CalendarIcsImportDialogHost(): JSX.Element {
  const open = useCalendarIcsImportStore((s) => s.open)
  const openFromFilePath = useCalendarIcsImportStore((s) => s.openFromFilePath)
  const accounts = useAccountsStore((s) => s.accounts)

  const calendarAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  useEffect(() => {
    const dispose = window.mailClient.calendar.onIcsFileOpen(({ filePath }) => {
      useAppModeStore.getState().setMode('calendar')
      void openFromFilePath(filePath)
    })
    return dispose
  }, [openFromFilePath])

  if (!open) return <></>

  return <CalendarIcsImportDialog calendarAccounts={calendarAccounts} />
}
