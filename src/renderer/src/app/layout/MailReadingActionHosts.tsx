import { Suspense, lazy } from 'react'
import { ToastStack } from '@/components/ToastStack'

const AppDialogHost = lazy(async () => {
  const m = await import('@/components/AppDialogHost')
  return { default: m.AppDialogHost }
})
const MailScheduleMeetingHost = lazy(async () => {
  const m = await import('@/components/MailScheduleMeetingHost')
  return { default: m.MailScheduleMeetingHost }
})
const MailReplyWithMeetingHost = lazy(async () => {
  const m = await import('@/components/MailReplyWithMeetingHost')
  return { default: m.MailReplyWithMeetingHost }
})

/**
 * Dialoge/Toasts fuer Mail-Leseaktionen in isolierten Fenstern (OS-Popout),
 * die nicht in der Haupt-`App` gemountet sind.
 */
export function MailReadingActionHosts(): JSX.Element {
  return (
    <>
      <ToastStack />
      <Suspense fallback={null}>
        <AppDialogHost />
      </Suspense>
      <Suspense fallback={null}>
        <MailScheduleMeetingHost />
      </Suspense>
      <Suspense fallback={null}>
        <MailReplyWithMeetingHost />
      </Suspense>
    </>
  )
}
