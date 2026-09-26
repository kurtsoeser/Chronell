import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles, X } from 'lucide-react'
import type { CopilotChatEngine } from '@shared/types'
import { isCopilotApiEngine, normalizeCopilotChatEngine } from '@shared/types'
import type { ComposeDraft, ComposeMode } from '@/stores/compose'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { CopilotMarkdown } from '@/components/copilot/CopilotMarkdown'
import { buildGroundedCopilotMessage } from '@/components/copilot/build-grounded-copilot-message'
import {
  buildComposeCopilotContext,
  composeCopilotNeedsRecipients
} from '@/components/copilot/build-compose-copilot-context'
import { copilotMarkdownToSafeHtml } from '@/components/copilot/copilot-markdown'
import { appendHtmlToComposeBody } from '@/lib/compose-cloud-link'
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
import { useComposeStore } from '@/stores/compose'

function defaultPromptForMode(mode: ComposeMode, t: (key: string) => string): string {
  if (mode === 'reply' || mode === 'replyAll') {
    return resolveCopilotPrompt('compose.reply', t)
  }
  if (mode === 'forward') {
    return resolveCopilotPrompt('compose.forward', t)
  }
  return resolveCopilotPrompt('compose.new', t)
}

export function ComposeCopilotDraftDialog({
  open,
  draft,
  onClose
}: {
  open: boolean
  draft: ComposeDraft
  onClose: () => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const update = useComposeStore((s) => s.update)
  const { settings: aiSettings } = useAiConnectionsSettings()
  const preferredEngine = useDefaultCopilotEnginePref()
  const microsoftAccount = draft.accountId.startsWith('ms:')
  const workIqAvailable = useWorkIqAvailable(microsoftAccount ? draft.accountId : null)
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
  const [contextBusy, setContextBusy] = useState(false)
  const [replyText, setReplyText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contextHint, setContextHint] = useState<string | null>(null)

  const canUse = engineOptions.length > 0

  useEffect(() => {
    if (!open) return
    setPrompt(defaultPromptForMode(draft.mode, t))
    setReplyText(null)
    setError(null)
    setContextHint(null)
    setBusy(false)
    setEngine(
      defaultCopilotEngine({
        microsoftAccount,
        aiSettings,
        preferred: preferredEngine,
        workIqAvailable
      })
    )
  }, [open, draft.id, draft.mode, t, microsoftAccount, aiSettings, preferredEngine, workIqAvailable])

  const title = useMemo(() => {
    if (draft.mode === 'reply' || draft.mode === 'replyAll') {
      return t('copilot.compose.replyTitle')
    }
    if (draft.mode === 'forward') {
      return t('copilot.compose.forwardTitle')
    }
    return t('copilot.compose.newTitle')
  }, [draft.mode, t])

  const runGenerate = useCallback(async (): Promise<void> => {
    const text = prompt.trim()
    if (!text || busy || !canUse) return

    if (!composeCopilotNeedsRecipients(draft) && draft.mode === 'new') {
      setError(t('copilot.compose.needRecipientOrSubject'))
      return
    }

    setBusy(true)
    setContextBusy(true)
    setError(null)
    try {
      const chat = window.mailClient?.copilot?.chat
      if (typeof chat !== 'function') {
        setError(t('copilot.assist.preloadStale'))
        return
      }

      const contexts = await buildComposeCopilotContext(draft)
      setContextBusy(false)

      const joined = contexts.join('').trim()
      if (joined.length < 12) {
        setError(t('copilot.compose.contextMissing'))
        return
      }

      const hasCorrespondence = contexts.some((c) => c.startsWith('PRIOR_CORRESPONDENCE'))
      const hasThread = contexts.some((c) => c.startsWith('CONVERSATION_THREAD'))
      const hasOriginal = contexts.some((c) => c.startsWith('ORIGINAL_EMAIL'))
      if (draft.mode === 'new' && hasCorrespondence) {
        setContextHint(t('copilot.compose.contextHintCorrespondence'))
      } else if (hasThread || hasOriginal) {
        setContextHint(t('copilot.compose.contextHintThread'))
      } else {
        setContextHint(t('copilot.compose.contextHintDraftOnly'))
      }

      const promptWithEngine =
        engine === 'workiq'
          ? `${text}\n\n${resolveCopilotPrompt('assist.workIqExtra', t)}`
          : text
      const payloadMessage = buildGroundedCopilotMessage(promptWithEngine, contexts)

      const res = await chat({
        accountId: draft.accountId,
        conversationId: null,
        message: payloadMessage,
        timeZone: resolveDefaultEventTimeZone(null),
        additionalContext: contexts,
        disableWebSearch: true,
        engine
      })

      if (res.status === 'ok' && res.replyText) {
        setReplyText(res.replyText)
        if (engine === 'workiq') persistWorkIqAvailable(draft.accountId, true)
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
      setContextBusy(false)
      setBusy(false)
    }
  }, [busy, canUse, draft, engine, prompt, t])

  const applyToBody = useCallback(
    (mode: 'replace' | 'append'): void => {
      const md = replyText?.trim()
      if (!md) return
      const fragment = copilotMarkdownToSafeHtml(md)
      if (!fragment.trim()) {
        setError(t('copilot.compose.adoptEmpty'))
        return
      }
      const next =
        mode === 'replace'
          ? fragment
          : appendHtmlToComposeBody(draft.prependRichHtml, fragment)
      update(draft.id, { prependRichHtml: next })
      onClose()
    },
    [draft.id, draft.prependRichHtml, onClose, replyText, t, update]
  )

  if (!open) return null

  return (
    <ModalRoot open zIndex={220} onBackdropClick={onClose}>
      <ModalPanel
        className="app-dialog-panel flex max-h-[min(90vh,40rem)] w-full max-w-[34rem] flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-foreground shadow-2xl"
        aria-labelledby="compose-copilot-draft-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <h2
              id="compose-copilot-draft-title"
              className="truncate text-sm font-semibold text-foreground"
            >
              {title}
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

        {!canUse ? (
          <p className="text-xs text-destructive" role="alert">
            {t('copilot.assist.unsupported')}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t('copilot.compose.hint')}</p>

            <label className="flex flex-col gap-1.5">
              <span className="text-2xs font-medium text-muted-foreground">
                {t('copilot.compose.promptLabel')}
              </span>
              <textarea
                value={prompt}
                onChange={(e): void => setPrompt(e.target.value)}
                rows={4}
                disabled={busy}
                className="resize-y rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary/50 disabled:opacity-50"
                placeholder={t('copilot.compose.promptPlaceholder')}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="max-w-[10rem] rounded-md border border-border bg-background px-1.5 py-1.5 text-2xs text-foreground"
                value={engine}
                disabled={busy}
                aria-label={t('copilot.assist.engineLabel')}
                title={t('copilot.assist.engineHint')}
                onChange={(e): void => {
                  setEngine(normalizeCopilotChatEngine(e.target.value))
                }}
              >
                {engineOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !prompt.trim()}
                onClick={(): void => void runGenerate()}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold',
                  busy || !prompt.trim()
                    ? 'bg-secondary text-muted-foreground'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {replyText ? t('copilot.assist.refresh') : t('copilot.compose.generate')}
              </button>
            </div>

            {contextBusy || busy ? (
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {contextBusy && !replyText
                  ? t('copilot.compose.loadingContext')
                  : t('copilot.assist.loading')}
              </p>
            ) : null}

            {contextHint && !busy ? (
              <p className="text-2xs text-muted-foreground">{contextHint}</p>
            ) : null}

            {error ? (
              <p className="whitespace-pre-wrap break-all text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {replyText ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
                <p className="text-2xs font-medium text-muted-foreground">
                  {t('copilot.compose.preview')}
                </p>
                <div className="max-h-[14rem] overflow-y-auto rounded-md border border-border/70 bg-secondary/20 px-3 py-2">
                  <CopilotMarkdown markdown={replyText} />
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(): void => applyToBody('append')}
                    className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                  >
                    {t('copilot.compose.append')}
                  </button>
                  <button
                    type="button"
                    onClick={(): void => applyToBody('replace')}
                    className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {t('copilot.compose.adopt')}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </ModalPanel>
    </ModalRoot>
  )
}
