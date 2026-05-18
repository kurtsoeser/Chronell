import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { ReadingPane } from '@/app/layout/ReadingPane'
import { useIsolatedMailView } from '@/app/layout/use-isolated-mail-view'
import { useMailReadingPopoutStore } from '@/stores/mail-reading-popout'
import { useAppModeStore } from '@/stores/app-mode'
import { useMailStore } from '@/stores/mail'
import { useMailWorkspaceLayoutStore } from '@/stores/mail-workspace-layout'

const MAIL_GLOBAL_POPOUT_SIZE_KEY = 'mailclient.mailReadingPopout.floatSize'

export function MailReadingPopoutHost(): JSX.Element | null {
  const { t } = useTranslation()
  const open = useMailReadingPopoutStore((s) => s.open)
  const messageId = useMailReadingPopoutStore((s) => s.messageId)
  const close = useMailReadingPopoutStore((s) => s.close)
  const isolatedView = useIsolatedMailView(open ? messageId : null)

  const floatWidth = useMemo(() => Math.min(720, Math.max(380, Math.round(window.innerWidth * 0.42))), [])
  const floatPos = useMemo(() => {
    const x = Math.max(12, window.innerWidth - floatWidth - 24)
    return { x, y: 72 }
  }, [floatWidth])

  const title = useMemo(() => {
    const subject = isolatedView.selectedMessage?.subject?.trim()
    return subject || t('mail.readingPopout.panelTitle')
  }, [isolatedView.selectedMessage?.subject, t])

  const handleDock = useCallback((): void => {
    const id = messageId
    close()
    if (id == null) return
    useAppModeStore.getState().setMode('mail')
    const layout = useMailWorkspaceLayoutStore.getState()
    layout.setReadingOpen(true)
    layout.setReadingPlacement('dock')
    void useMailStore.getState().selectMessageWithThreadPreview(id)
  }, [close, messageId])

  if (!open || messageId == null) return null

  return (
    <CalendarFloatingPanel
      open
      title={title}
      widthPx={floatWidth}
      minHeightPx={360}
      persistSizeKey={MAIL_GLOBAL_POPOUT_SIZE_KEY}
      defaultPosition={floatPos}
      zIndex={94}
      onClose={close}
      onDock={handleDock}
    >
      <ReadingPane isolatedView={isolatedView} />
    </CalendarFloatingPanel>
  )
}
