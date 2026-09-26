import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, NotebookPen, Sparkles } from 'lucide-react'
import type {
  CopilotChatEngine,
  CopilotChatMessageAttribution,
  MailCorrespondenceItem,
  PeopleContactView
} from '@shared/types'
import { isCopilotApiEngine, normalizeCopilotChatEngine } from '@shared/types'
import { CopilotMarkdown } from '@/components/copilot/CopilotMarkdown'
import { CopilotSourcePills } from '@/components/copilot/CopilotSourcePills'
import { buildGroundedCopilotMessage } from '@/components/copilot/build-grounded-copilot-message'
import { appendCopilotReplyToObjectNote } from '@/components/copilot/copilot-to-object-note'
import { buildContactCopilotContext } from '@/app/layout/mail-right-sidebar/build-contact-copilot-context'
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

export function ContactCopilotSummaryPanel({
  accountId,
  displayName,
  primaryEmail,
  emails,
  contact,
  historyItems,
  historyLoading
}: {
  /** Microsoft-Konto für Copilot (`ms:…`). */
  accountId: string | null
  displayName: string
  primaryEmail: string
  emails: string[]
  contact: PeopleContactView | null
  historyItems: MailCorrespondenceItem[]
  historyLoading: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const { settings: aiSettings } = useAiConnectionsSettings()
  const preferredEngine = useDefaultCopilotEnginePref()
  const microsoftAccount = Boolean(accountId?.startsWith('ms:'))
  const workIqAvailable = useWorkIqAvailable(microsoftAccount ? accountId : null)
  const engineOptions = useMemo(
    () => listCopilotEngineOptions({ microsoftAccount, aiSettings, workIqAvailable }),
    [aiSettings, microsoftAccount, workIqAvailable]
  )
  const chatAccountId = accountId?.trim() || 'ai:local'
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<string | null>(null)
  const [attributions, setAttributions] = useState<CopilotChatMessageAttribution[]>([])
  const [error, setError] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState('')
  const [engine, setEngine] = useState<CopilotChatEngine>(() =>
    defaultCopilotEngine({
      microsoftAccount,
      aiSettings: null,
      preferred: preferredEngine,
      workIqAvailable: false
    })
  )
  const [adopting, setAdopting] = useState(false)
  const [adoptedOk, setAdoptedOk] = useState(false)
  const [contextHint, setContextHint] = useState<string | null>(null)

  const canUse = engineOptions.length > 0

  useEffect(() => {
    if (engineOptions.length === 0) return
    if (!engineOptions.some((o) => o.value === engine)) {
      setEngine(
        defaultCopilotEngine({
          microsoftAccount,
          aiSettings,
          preferred: preferredEngine ?? engine,
          workIqAvailable
        })
      )
    }
  }, [aiSettings, engine, engineOptions, microsoftAccount, preferredEngine, workIqAvailable])

  useEffect(() => {
    if (busy || replyText) return
    if (!preferredEngine) return
    if (!engineOptions.some((o) => o.value === preferredEngine)) return
    setEngine(preferredEngine)
  }, [busy, engineOptions, preferredEngine, replyText])

  const contextKey = useMemo(
    () => `contact:${primaryEmail.toLowerCase()}|${accountId ?? ''}`,
    [accountId, primaryEmail]
  )

  useEffect(() => {
    setConversationId(null)
    setReplyText(null)
    setAttributions([])
    setError(null)
    setFollowUp('')
    setBusy(false)
    setAdoptedOk(false)
    setContextHint(null)
  }, [contextKey, engine])

  const runChat = useCallback(
    async (message: string, opts?: { resetConversation?: boolean }): Promise<void> => {
      const text = message.trim()
      if (!text || busy || !canUse) return

      setBusy(true)
      setError(null)
      try {
        const chat = window.mailClient?.copilot?.chat
        if (typeof chat !== 'function') {
          setError(t('copilot.assist.preloadStale'))
          return
        }

        const embedContext = opts?.resetConversation === true || !conversationId
        let contexts: string[] = []
        if (embedContext) {
          if (historyItems.length === 0 && !historyLoading) {
            setError(t('copilot.contact.emptyHistory'))
            return
          }
          contexts = await buildContactCopilotContext({
            displayName,
            primaryEmail,
            emails,
            contact,
            historyItems,
            includeRecentBodies: true
          })
          setContextHint(
            t('copilot.contact.contextHint', {
              count: historyItems.length,
              name: displayName
            })
          )
          if (contexts.join('').trim().length < 20) {
            setError(t('copilot.assist.contextMissing'))
            return
          }
        }

        const promptWithEngine =
          engine === 'workiq'
            ? `${text}\n\n${resolveCopilotPrompt('assist.workIqExtra', t)}`
            : text
        const payloadMessage = embedContext
          ? buildGroundedCopilotMessage(promptWithEngine, contexts)
          : promptWithEngine

        const res = await chat({
          accountId: chatAccountId,
          conversationId: opts?.resetConversation ? null : conversationId,
          message: payloadMessage,
          timeZone: resolveDefaultEventTimeZone(null),
          additionalContext: embedContext ? contexts : undefined,
          disableWebSearch: true,
          engine
        })

        if (res.status === 'ok' && res.replyText) {
          setConversationId(res.conversationId)
          setReplyText(res.replyText)
          setAttributions(res.attributions ?? [])
          setAdoptedOk(false)
          if (engine === 'workiq' && accountId) persistWorkIqAvailable(accountId, true)
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
    },
    [
      busy,
      canUse,
      chatAccountId,
      contact,
      conversationId,
      displayName,
      emails,
      engine,
      historyItems,
      historyLoading,
      primaryEmail,
      t
    ]
  )

  const onPrimary = useCallback((): void => {
    void runChat(resolveCopilotPrompt('contact.summarize', t), { resetConversation: true })
  }, [runChat, t])

  const onFollowUp = useCallback((): void => {
    const q = followUp.trim()
    if (!q) return
    setFollowUp('')
    void runChat(q)
  }, [followUp, runChat])

  const onAdoptToNote = useCallback((): void => {
    if (!contact || !replyText?.trim() || adopting) return
    setAdopting(true)
    setAdoptedOk(false)
    const engineLabel =
      engine === 'workiq' ? t('copilot.assist.engineWorkIq') : t('copilot.assist.engineGraph')
    void appendCopilotReplyToObjectNote({
      target: {
        kind: 'people_contact',
        contactId: contact.id,
        title: displayName
      },
      replyText,
      attributions,
      heading: t('copilot.assist.noteHeading', { engine: engineLabel }),
      sourcesHeading: t('copilot.assist.sources')
    })
      .then(() => {
        setAdoptedOk(true)
        window.setTimeout(() => setAdoptedOk(false), 2500)
      })
      .catch((e) => {
        setError(
          e instanceof Error && e.message === 'empty_copilot_snippet'
            ? t('copilot.assist.adoptEmpty')
            : e instanceof Error
              ? e.message
              : t('copilot.assist.adoptError')
        )
      })
      .finally(() => setAdopting(false))
  }, [adopting, attributions, contact, displayName, engine, replyText, t])

  if (!canUse) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4 text-center text-2xs text-muted-foreground">
        {t('copilot.assist.unsupported')}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="mr-auto text-2xs font-semibold text-foreground">
          {t('copilot.contact.title')}
        </span>
        <select
          className="max-w-[9rem] shrink-0 rounded-md border border-border/60 bg-background px-1.5 py-1 text-2xs text-foreground"
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
          disabled={busy || historyLoading}
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-2xs font-semibold',
            busy || historyLoading
              ? 'bg-secondary text-muted-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
          onClick={onPrimary}
        >
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('copilot.assist.loading')}
            </span>
          ) : replyText ? (
            t('copilot.assist.refresh')
          ) : (
            t('copilot.contact.summarize')
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2.5">
        {historyLoading && historyItems.length === 0 ? (
          <p className="inline-flex items-center gap-2 text-2xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('mail.rightSidebar.contactHistoryLoading')}
          </p>
        ) : null}

        {contextHint && !busy ? (
          <p className="text-2xs text-muted-foreground">{contextHint}</p>
        ) : null}

        {error ? (
          <p className="whitespace-pre-wrap break-all text-2xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {busy && !replyText ? (
          <p className="inline-flex items-center gap-2 text-2xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('copilot.assist.loading')}
          </p>
        ) : null}

        {replyText ? (
          <div className="rounded-md border border-border/50 bg-secondary/[0.04] px-2.5 py-2">
            <CopilotMarkdown
              markdown={replyText}
              className="[&_.copilot-cite]:ml-0.5 [&_.copilot-cite_a]:text-primary [&_.copilot-cite_a]:no-underline hover:[&_.copilot-cite_a]:underline"
            />
          </div>
        ) : !busy && !error && !historyLoading ? (
          <p className="text-2xs text-muted-foreground">{t('copilot.contact.hint')}</p>
        ) : null}

        <CopilotSourcePills attributions={attributions} replyText={replyText} />

        {replyText && contact ? (
          <button
            type="button"
            disabled={busy || adopting}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-2xs font-medium text-foreground hover:bg-secondary/40 disabled:opacity-50"
            onClick={onAdoptToNote}
          >
            {adopting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : adoptedOk ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            ) : (
              <NotebookPen className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            )}
            {adoptedOk ? t('copilot.assist.adopted') : t('copilot.assist.adoptToNote')}
          </button>
        ) : null}

        {replyText ? (
          <div className="flex gap-2 pb-1">
            <input
              type="text"
              value={followUp}
              disabled={busy}
              onChange={(e): void => setFollowUp(e.target.value)}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onFollowUp()
                }
              }}
              placeholder={t('copilot.assist.followUpPlaceholder')}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-2xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={busy || !followUp.trim()}
              onClick={onFollowUp}
              className="shrink-0 rounded-md border border-border px-2 py-1.5 text-2xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
            >
              {t('copilot.assist.send')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
