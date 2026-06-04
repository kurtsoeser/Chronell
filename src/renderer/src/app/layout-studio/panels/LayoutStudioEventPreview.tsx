import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarEventPreview } from '@/app/calendar/CalendarEventPreview'
import { CloudTaskItemPreview } from '@/app/calendar/CloudTaskItemPreview'
import { ReadingPane } from '@/app/layout/ReadingPane'
import { useCalendarListByAccount } from '@/lib/use-calendar-list-by-account'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { useLayoutStudioPreviewStore } from '@/stores/layout-studio-preview-store'

/**
 * Kontext-Vorschau: Termin, Cloud-Aufgabe oder Mail-Vorschau je nach Auswahl
 * (Zeitliste, ToDo-Kacheln, Kalender, Mail-Liste).
 */
export function LayoutStudioEventPreview(): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const calendarLinkedAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const calendarsByAccount = useCalendarListByAccount(calendarLinkedAccounts)
  const calendarEvent = useLayoutStudioPreviewStore((s) => s.calendarEvent)
  const cloudTask = useLayoutStudioPreviewStore((s) => s.cloudTask)
  const cloudTaskPlanned = useLayoutStudioPreviewStore((s) => s.cloudTaskPlanned)
  const setCalendarEvent = useLayoutStudioPreviewStore((s) => s.setCalendarEvent)
  const clearContextPreview = useLayoutStudioPreviewStore((s) => s.clearContextPreview)
  const selectedMessageId = useMailStore((s) => s.selectedMessageId)

  useEffect(() => {
    if (selectedMessageId != null) clearContextPreview()
  }, [selectedMessageId, clearContextPreview])

  const calendarName = useMemo((): string | null => {
    if (!calendarEvent) return null
    const calId = calendarEvent.graphCalendarId?.trim()
    if (!calId) return null
    const rows = calendarsByAccount[calendarEvent.accountId] ?? []
    return rows.find((c) => c.id === calId)?.name?.trim() || null
  }, [calendarEvent, calendarsByAccount])

  const cloudTaskAccountName = useMemo(() => {
    if (!cloudTask) return undefined
    return accounts.find((a) => a.id === cloudTask.accountId)?.displayName
  }, [cloudTask, accounts])

  if (cloudTask) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CloudTaskItemPreview
          task={cloudTask}
          planned={cloudTaskPlanned}
          accountDisplayName={cloudTaskAccountName}
        />
      </div>
    )
  }

  if (calendarEvent) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CalendarEventPreview
          event={calendarEvent}
          calendarName={calendarName}
          onEdit={(): void => {}}
          onEventChange={(updated): void => setCalendarEvent(updated)}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ReadingPane
        hideChromeWhenEmpty
        hidePreviewDetachToggle
        compactToolbar
        emptySelectionTitle={t('layoutStudio.eventPreviewEmptyTitle')}
        emptySelectionBody={t('layoutStudio.eventPreviewEmptyBody')}
      />
    </div>
  )
}
