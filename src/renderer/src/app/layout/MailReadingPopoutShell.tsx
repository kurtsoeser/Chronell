import { useEffect, useState } from 'react'
import { Pin, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ReadingPane } from '@/app/layout/ReadingPane'
import { useIsolatedMailView } from '@/app/layout/use-isolated-mail-view'
import { parseMailReadingPopoutRoute } from '@/app/layout/mail-reading-popout-route'
import {
  loadMailReadingPopoutAlwaysOnTopDefault,
  saveMailReadingPopoutAlwaysOnTopDefault
} from '@/app/layout/mail-reading-popout-prefs'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderShellBarClass
} from '@/components/ModuleColumnHeader'
import { cn } from '@/lib/utils'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'

export function MailReadingPopoutShell(): JSX.Element {
  const { t } = useTranslation()
  const route = parseMailReadingPopoutRoute()
  const messageId = route?.messageId ?? null
  const isolatedView = useIsolatedMailView(messageId)
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => loadMailReadingPopoutAlwaysOnTopDefault())

  useEffect(() => {
    useMailStore.getState().initialize()
    void useAccountsStore.getState().initialize()
  }, [])

  useEffect(() => {
    if (messageId == null) return
    let cancelled = false
    void window.mailClient.mailReadingPopout.getAlwaysOnTop({ messageId }).then((v) => {
      if (!cancelled) setAlwaysOnTop(v)
    })
    return (): void => {
      cancelled = true
    }
  }, [messageId])

  useEffect(() => {
    const subject = isolatedView.selectedMessage?.subject?.trim()
    if (subject) document.title = `${subject} — ${t('mail.readingPopout.windowTitle')}`
  }, [isolatedView.selectedMessage?.subject, t])

  const handleToggleAlwaysOnTop = (): void => {
    if (messageId == null) return
    const next = !alwaysOnTop
    setAlwaysOnTop(next)
    saveMailReadingPopoutAlwaysOnTopDefault(next)
    void window.mailClient.mailReadingPopout.setAlwaysOnTop({ messageId, alwaysOnTop: next })
  }

  const handleClose = (): void => {
    if (messageId == null) return
    void window.mailClient.mailReadingPopout.close({ messageId })
  }

  if (messageId == null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6 text-foreground">
        <p className="text-sm text-muted-foreground">{t('mail.readingPopout.invalidRoute')}</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <div className={moduleColumnHeaderShellBarClass}>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {isolatedView.selectedMessage?.subject?.trim() || t('mail.readingPopout.windowTitle')}
        </span>
        <ModuleColumnHeaderIconButton
          type="button"
          pressed={alwaysOnTop}
          onClick={handleToggleAlwaysOnTop}
          title={
            alwaysOnTop
              ? t('mail.readingPopout.alwaysOnTopOff')
              : t('mail.readingPopout.alwaysOnTopOn')
          }
          aria-label={
            alwaysOnTop
              ? t('mail.readingPopout.alwaysOnTopOff')
              : t('mail.readingPopout.alwaysOnTopOn')
          }
        >
          <Pin className={cn(moduleColumnHeaderIconGlyphClass, alwaysOnTop && 'text-primary')} />
        </ModuleColumnHeaderIconButton>
        <ModuleColumnHeaderIconButton
          type="button"
          onClick={handleClose}
          title={t('common.close')}
          aria-label={t('common.close')}
        >
          <X className={moduleColumnHeaderIconGlyphClass} />
        </ModuleColumnHeaderIconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ReadingPane isolatedView={isolatedView} />
      </div>
    </div>
  )
}
