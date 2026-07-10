import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarEventDialog } from '@/app/calendar/CalendarEventDialog'
import { useAccountsStore } from '@/stores/accounts'
import { useMailReplyWithMeetingStore } from '@/stores/mail-reply-with-meeting'
import { showAppAlert } from '@/stores/app-dialog'
import { formatMeetingAttendeesForComposeInput } from '@shared/mail-meeting-attendees'
import type { TaskListRow } from '@shared/types'

/**
 * Globaler Termin-Editor «Mit Besprechung antworten». In `App.tsx` mounten;
 * oeffnen ueber `useMailReplyWithMeetingStore`.
 */
export function MailReplyWithMeetingHost(): JSX.Element | null {
  const { t } = useTranslation()
  const suggestion = useMailReplyWithMeetingStore((s) => s.suggestion)
  const loading = useMailReplyWithMeetingStore((s) => s.loading)
  const error = useMailReplyWithMeetingStore((s) => s.error)
  const close = useMailReplyWithMeetingStore((s) => s.close)

  const accounts = useAccountsStore((s) => s.accounts)
  const calendarLinkedAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const loadTaskListsForAccount = useCallback(
    async (accountId: string): Promise<TaskListRow[]> =>
      window.mailClient.tasks.listLists({ accountId }),
    []
  )

  const initialRange = useMemo(() => {
    if (!suggestion) return undefined
    const start = new Date(suggestion.startIso)
    const end = new Date(suggestion.endIso)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined
    return { start, end, allDay: false }
  }, [suggestion])

  const createPrefill = useMemo(() => {
    if (!suggestion) return undefined
    const account = accounts.find((a) => a.id === suggestion.accountId)
    const attendeeInput = formatMeetingAttendeesForComposeInput(
      suggestion.attendeeEmails.map((address) => ({ address }))
    )
    return {
      subject: suggestion.subject,
      attendeeInput,
      descriptionHtml: suggestion.bodyHtml,
      teamsMeeting: account?.provider === 'microsoft',
      attachments: suggestion.mailAttachment ? [suggestion.mailAttachment] : undefined
    }
  }, [suggestion, accounts])

  useEffect(() => {
    if (!error) return
    void showAppAlert(error, { title: t('mail.replyWithMeeting.errorTitle') }).then(() => close())
  }, [error, close, t])

  useEffect(() => {
    if (loading || !suggestion || calendarLinkedAccounts.length > 0) return
    void showAppAlert(t('mail.replyWithMeeting.noCalendarAccount'), {
      title: t('mail.replyWithMeeting.errorTitle')
    }).then(() => close())
  }, [loading, suggestion, calendarLinkedAccounts.length, close, t])

  if (error || loading || !suggestion) return null
  if (calendarLinkedAccounts.length === 0) return null

  const defaultAccountId =
    calendarLinkedAccounts.some((a) => a.id === suggestion.accountId) ?
      suggestion.accountId
    : calendarLinkedAccounts[0]!.id

  return (
    <CalendarEventDialog
      open
      mode="create"
      accounts={calendarLinkedAccounts}
      defaultAccountId={defaultAccountId}
      initialRange={initialRange}
      createPrefill={createPrefill}
      initialCreateKind="event"
      taskAccounts={taskAccounts}
      loadListsForAccount={loadTaskListsForAccount}
      onClose={close}
      onSaved={(): void => close()}
    />
  )
}
