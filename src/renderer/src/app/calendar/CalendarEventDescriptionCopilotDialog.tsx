import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles, X } from 'lucide-react'
import type { CopilotChatEngine } from '@shared/types'
import { isCopilotApiEngine, normalizeCopilotChatEngine } from '@shared/types'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { CopilotMarkdown } from '@/components/copilot/CopilotMarkdown'
import { buildGroundedCopilotMessage } from '@/components/copilot/build-grounded-copilot-message'
import { copilotMarkdownToSafeHtml } from '@/components/copilot/copilot-markdown'
import { resolveDefaultEventTimeZone } from '@/lib/calendar-event-timezone'
import { resolveCopilotPrompt } from '@/lib/copilot-prompt-prefs'
import {
  defaultCopilotEngine,
  listCopilotEngineOptions
} from '@/lib/copilot-engine-options'
import { useDefaultCopilotEnginePref } from '@/lib/copilot-engine-prefs'
import { useAiConnectionsSettings } from '@/lib/use-ai-connections-settings'
import { useWorkIqAvailable } from '@/lib/use-workiq-available'
import { persistWorkIqAvailable } from '@/lib/workiq-availability'
import { cn } from '@/lib/utils'

export function CalendarEventDescriptionCopilotDialog({
  open,
  accountId,
  subject,
  location,
  existingHtml,
  onApply,
  onClose
}: {
  open: boolean
  accountId: string
  subject: string
  location: string
  existingHtml: string
  onApply: (html: string, mode: 'replace' | 'append') => void
  onClose: () => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const { settings: aiSettings } = useAiConnectionsSettings()
  const preferredEngine = useDefaultCopilotEnginePref()
  const microsoftAccount = accountId.startsWith('ms:')
  const workIqAvailable = useWorkIqAvailable(microsoftAccount ? accountId : null)
  const engineOptions = useMemo(
    () => listCopilotEngineOptions({ microsoftAccount, aiSettings, workIqAvailable }),
    [aiSettings, microsoftAccount, workIqAvailable]
  )
  const [prompt, setPrompt] = useState('')
  const [engine, setEngine] = useState<CopilotChatEngine>(() =>
    defaultCopilotEngine({
      microsoftAccount,
      aiSettings: null,
      preferred: preferredEngine,
      workIqAvailable: false
    })
  )
  const [busy, setBusy] = useState(false)
  const [replyText, setReplyText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canUse = engineOptions.length > 0

  useEffect(() => {
    if (!open) return
    setPrompt(t('calendar.eventDialog.copilotDescriptionPrompt'))
    setReplyText(null)
    setError(null)
    setBusy(false)
    setEngine(
      defaultCopilotEngine({
        microsoftAccount,
        aiSettings,
        preferred: preferredEngine,
        workIqAvailable
      })
    )
  }, [open, t, microsoftAccount, aiSettings, preferredEngine, workIqAvailable])

  const runGenerate = useCallback(async (): Promise<void> => {
    const text = prompt.trim()
    if (!text || busy || !canUse) return
    setBusy(true)
    setError(null)
    try {
      const chat = window.mailClient?.copilot?.chat
      if (typeof chat !== 'function') {
        setError(t('copilot.assist.preloadStale'))
        return
      }
      const contexts = [
        `EVENT_SUBJECT:\n${subject.trim() || '(ohne Titel)'}`,
        location.trim() ? `EVENT_LOCATION:\n${location.trim()}` : '',
        existingHtml.trim()
          ? `EXISTING_DESCRIPTION_HTML:\n${existingHtml.trim().slice(0, 4000)}`
          : ''
      ].filter(Boolean)
      const promptWithEngine =
        engine === 'workiq'
          ? `${text}\n\n${resolveCopilotPrompt('assist.workIqExtra', t)}`
          : text
      const payloadMessage = buildGroundedCopilotMessage(promptWithEngine, contexts)
      const res = await chat({
        accountId,
        conversationId: null,
        message: payloadMessage,
        timeZone: resolveDefaultEventTimeZone(null),
        additionalContext: contexts,
        disableWebSearch: true,
        engine
      })
      if (res.status === 'ok' && res.replyText) {
        setReplyText(res.replyText)
        if (engine === 'workiq') persistWorkIqAvailable(accountId, true)
        return
      }
      if (res.status === 'forbidden') {
        const forbiddenKey =
          engine === 'workiq'
            ? 'copilot.assist.workIqForbidden'
            : isCopilotApiEngine(engine)
              ? 'copilot.assist.apiForbidden'
              : 'copilot.assist.forbidden'
        setError(
          res.errorMessage ? `${t(forbiddenKey)}\n${res.errorMessage}` : t(forbiddenKey)
        )
      } else if (res.status === 'unsupported') {
        setError(t('copilot.assist.unsupported'))
      } else {
        setError(res.errorMessage || t('copilot.assist.error'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [accountId, busy, canUse, engine, existingHtml, location, prompt, subject, t])

  const apply = useCallback(
    (mode: 'replace' | 'append'): void => {
      const md = replyText?.trim()
      if (!md) return
      const fragment = copilotMarkdownToSafeHtml(md)
      if (!fragment.trim()) {
        setError(t('copilot.compose.adoptEmpty'))
        return
      }
      onApply(fragment, mode)
      onClose()
    },
    [onApply, onClose, replyText, t]
  )

  if (!open) return null

  return (
    <ModalRoot open zIndex={220} onBackdropClick={onClose}>
      <ModalPanel
        className="app-dialog-panel flex max-h-[min(90vh,40rem)] w-full max-w-[34rem] flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-foreground shadow-2xl"
        aria-labelledby="event-desc-copilot-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <h2
              id="event-desc-copilot-title"
              className="truncate text-sm font-semibold text-foreground"
            >
              {t('calendar.eventDialog.copilotDescriptionTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {engineOptions.length > 1 ? (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t('copilot.assist.engine')}</span>
            <select
              value={engine}
              disabled={busy}
              onChange={(e): void =>
                setEngine(normalizeCopilotChatEngine(e.target.value) ?? engine)
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {engineOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex min-h-0 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t('copilot.compose.hint')}</span>
          <textarea
            value={prompt}
            disabled={busy}
            onChange={(e): void => setPrompt(e.target.value)}
            rows={4}
            className="resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm leading-relaxed"
          />
        </label>

        {error ? (
          <p className="whitespace-pre-wrap text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {replyText ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-background/50 p-2">
            <CopilotMarkdown markdown={replyText} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy || !prompt.trim() || !canUse}
            onClick={(): void => void runGenerate()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
            )}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t('copilot.compose.generate')}
          </button>
          {replyText ? (
            <>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                onClick={(): void => apply('append')}
              >
                {t('copilot.compose.append')}
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={(): void => apply('replace')}
              >
                {t('copilot.compose.adopt')}
              </button>
            </>
          ) : null}
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
