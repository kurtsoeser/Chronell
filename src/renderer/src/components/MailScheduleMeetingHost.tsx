import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MailScheduleMeetingDialog } from '@/components/MailScheduleMeetingDialog'
import { useAccountsStore } from '@/stores/accounts'
import { useMailScheduleMeetingStore } from '@/stores/mail-schedule-meeting'
import { showAppAlert } from '@/stores/app-dialog'

/**
 * Globaler Dialog «Termin aus Mail planen». In `App.tsx` mounten;
 * oeffnen ueber `useMailScheduleMeetingStore` oder `openScheduleMeetingFromMail`.
 */
export function MailScheduleMeetingHost(): JSX.Element | null {
  const { t } = useTranslation()
  const suggestion = useMailScheduleMeetingStore((s) => s.suggestion)
  const loading = useMailScheduleMeetingStore((s) => s.loading)
  const error = useMailScheduleMeetingStore((s) => s.error)
  const close = useMailScheduleMeetingStore((s) => s.close)

  const accounts = useAccountsStore((s) => s.accounts)
  const calendarLinkedAccounts = accounts.filter(
    (a) => a.provider === 'microsoft' || a.provider === 'google'
  )

  useEffect(() => {
    if (!error) return
    void showAppAlert(error, { title: t('mail.scheduleMeeting.errorTitle') }).then(() => close())
  }, [error, close, t])

  useEffect(() => {
    if (loading || !suggestion || calendarLinkedAccounts.length > 0) return
    void showAppAlert(t('mail.scheduleMeeting.noCalendarAccount'), {
      title: t('mail.scheduleMeeting.errorTitle')
    }).then(() => close())
  }, [loading, suggestion, calendarLinkedAccounts.length, close, t])

  if (error || loading || !suggestion) return null
  if (calendarLinkedAccounts.length === 0) return null

  return (
    <MailScheduleMeetingDialog
      open
      suggestion={suggestion}
      accounts={calendarLinkedAccounts}
      onClose={close}
    />
  )
}
