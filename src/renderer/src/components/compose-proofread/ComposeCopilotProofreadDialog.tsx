import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles, X } from 'lucide-react'
import type { CopilotChatEngine } from '@shared/types'
import { isCopilotApiEngine, normalizeCopilotChatEngine } from '@shared/types'
import {
  composeEditorHtmlToPlainText,
  composePlainTextToEditorHtml
} from '@shared/compose-proofread-text'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { CopilotMarkdown } from '@/components/copilot/CopilotMarkdown'
import { buildGroundedCopilotMessage } from '@/components/copilot/build-grounded-copilot-message'
import { copilotMarkdownToSafeHtml } from '@/components/copilot/copilot-markdown'
import { isComposeBodyEffectivelyEmpty } from '@/lib/compose-default-body'
import { resolveCopilotPrompt } from '@/lib/copilot-prompt-prefs'
import {
  defaultCopilotEngine,
  listCopilotEngineOptions
} from '@/lib/copilot-engine-options'
import { useDefaultCopilotEnginePref } from '@/lib/copilot-engine-prefs'
import { useAiConnectionsSettings } from '@/lib/use-ai-connections-settings'
import { useWorkIqAvailable } from '@/lib/use-workiq-available'
import { persistWorkIqAvailable } from '@/lib/workiq-availability'
import { resolveDefaultEventTimeZone } from '@/lib/calendar-event-timezone'
export function ComposeCopilotProofreadDialog({
  open,
  accountId,
  bodyHtml,
  onApply,
  onClose
}: {
  open: boolean
  accountId: string
  bodyHtml: string
  onApply: (html: string) => void
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
  const [hadRichFormatting, setHadRichFormatting] = useState(false)

  const canUse = engineOptions.length > 0

  useEffect(() => {
    if (!open) return
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
  }, [open, microsoftAccount, aiSettings, preferredEngine, workIqAvailable])

  const runCheck = useCallback(async (): Promise<void> => {
    const plain = composeEditorHtmlToPlainText(bodyHtml)
    if (!plain || isComposeBodyEffectivelyEmpty(bodyHtml)) {
      setError(t('mail.compose.proofread.emptyBody'))
      return
    }
    const rich =
      bodyHtml.replace(/<[^>]+>/g, '').trim().length < bodyHtml.trim().length - 20 &&
      /<(?:b|strong|i|em|u|span|font|table|ul|ol|img)\b/i.test(bodyHtml)
    setHadRichFormatting(rich)
    if (!canUse) return

    setBusy(true)
    setError(null)
    try {
      const chat = window.mailClient?.copilot?.chat
      if (typeof chat !== 'function') {
        setError(t('copilot.assist.preloadStale'))
        return
      }
      const prompt = resolveCopilotPrompt('compose.proofread', t)
      const contexts = [`DRAFT_TEXT:\n${plain.slice(0, 12_000)}`]
      const promptWithEngine =
        engine === 'workiq'
          ? `${prompt}\n\n${resolveCopilotPrompt('assist.workIqExtra', t)}`
          : prompt
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
  }, [accountId, bodyHtml, canUse, engine, t])

  useEffect(() => {
    if (!open || !canUse) return
    void runCheck()
  }, [open, canUse, bodyHtml, runCheck])

  const adopt = useCallback((): void => {
    const md = replyText?.trim()
    if (!md) return
    const fromMd = copilotMarkdownToSafeHtml(md)
    const html = fromMd.trim() || composePlainTextToEditorHtml(md)
    if (!html.trim()) {
      setError(t('copilot.compose.adoptEmpty'))
      return
    }
    onApply(html)
    onClose()
  }, [onApply, onClose, replyText, t])

  if (!open) return null

  return (
    <ModalRoot open zIndex={220} onBackdropClick={onClose}>
      <ModalPanel
        className="app-dialog-panel flex max-h-[min(90vh,40rem)] w-full max-w-[34rem] flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-foreground shadow-2xl"
        aria-labelledby="compose-copilot-proofread-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <h2 id="compose-copilot-proofread-title" className="truncate text-sm font-semibold">
              {t('mail.compose.proofread.copilotTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{t('mail.compose.proofread.copilotHint')}</p>

        {!canUse ? (
          <p className="text-xs text-destructive" role="alert">
            {t('copilot.assist.unsupported')}
          </p>
        ) : null}

        {hadRichFormatting ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-2xs text-amber-200">
            {t('mail.compose.proofread.formattingWarning')}
          </p>
        ) : null}

        {canUse && engineOptions.length > 1 ? (
          <label className="flex flex-col gap-1 text-2xs">
            <span className="text-muted-foreground">{t('copilot.assist.engineLabel')}</span>
            <select
              value={engine}
              onChange={(e): void =>
                setEngine(normalizeCopilotChatEngine(e.target.value as CopilotChatEngine))
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {engineOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {error ? (
          <p className="text-xs text-destructive" role="alert">{error}</p>
        ) : null}

        {busy ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('mail.compose.proofread.checking')}
          </div>
        ) : null}

        {replyText && !busy ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-2">
            <p className="mb-1 text-2xs font-medium text-muted-foreground">
              {t('mail.compose.proofread.preview')}
            </p>
            <CopilotMarkdown markdown={replyText} className="text-xs" />
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || !canUse}
            onClick={(): void => void runCheck()}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
          >
            {t('mail.compose.proofread.recheck')}
          </button>
          <button
            type="button"
            disabled={busy || !replyText?.trim()}
            onClick={adopt}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {t('mail.compose.proofread.adopt')}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
