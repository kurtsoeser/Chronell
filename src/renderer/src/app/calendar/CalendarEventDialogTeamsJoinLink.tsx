import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import {
  useCalendarEventDialogJoinUrl,
  type CalendarEventDialogJoinUrlStore
} from '@/app/calendar/calendar-event-dialog-join-url-store'
import { voidOpenExternalUrl } from '@/lib/open-external'

export const CalendarEventDialogTeamsJoinLink = memo(function CalendarEventDialogTeamsJoinLink({
  store,
  teamsMeeting,
  isAllDay,
  teamsProvisioning
}: {
  store: CalendarEventDialogJoinUrlStore
  teamsMeeting: boolean
  isAllDay: boolean
  teamsProvisioning: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  const joinUrl = useCalendarEventDialogJoinUrl(store)
  const [copied, setCopied] = useState(false)

  if (joinUrl?.trim()) {
    const url = joinUrl.trim()
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
        <a
          href={url}
          className="min-w-0 flex-1 truncate text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          onClick={(e): void => {
            e.preventDefault()
            voidOpenExternalUrl(url)
          }}
        >
          {url}
        </a>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary"
          onClick={(): void => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2000)
            })
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied
            ? t('calendar.eventDialog.teamsLinkCopied')
            : t('calendar.eventDialog.teamsCopyLink')}
        </button>
      </div>
    )
  }

  if (teamsMeeting && !isAllDay && !teamsProvisioning) {
    return (
      <p className="mt-1 px-1 text-2xs text-muted-foreground" role="status">
        {t('calendar.eventDialog.teamsLinkPendingHint')}
      </p>
    )
  }

  return null
})
