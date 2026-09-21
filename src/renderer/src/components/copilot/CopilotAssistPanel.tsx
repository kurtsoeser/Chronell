import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, NotebookPen, Sparkles } from 'lucide-react'
import type {
  CopilotChatEngine,
  CopilotChatMessageAttribution,
  CopilotRetrievalHit
} from '@shared/types'
import { openExternalUrl } from '@/lib/open-external'
import { resolveDefaultEventTimeZone } from '@/lib/calendar-event-timezone'
import { cn } from '@/lib/utils'
import { CopilotMarkdown } from '@/components/copilot/CopilotMarkdown'
import { CopilotSourcePills } from '@/components/copilot/CopilotSourcePills'
import { buildGroundedCopilotMessage } from '@/components/copilot/build-grounded-copilot-message'
import { parseMailMessageIdFromContextKey } from '@/components/copilot/parse-mail-context-key'
import { appendCopilotReplyToObjectNote } from '@/components/copilot/copilot-to-object-note'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { PreviewFoldSection } from '@/components/PreviewFoldSection'

export interface CopilotAssistPanelProps {
  accountId: string
  /** Stable key to reset conversation when context changes (message id / event id). */
  contextKey: string
  /** Grounding text passed as additionalContext (mail body, event details). */
  contextTexts: string[]
  primaryPrompt: string
  primaryActionLabel: string
  title: string
  className?: string
  /** Optional retrieval query (SharePoint + OneDrive). */
  retrievalQuery?: string | null
  collapsedDefault?: boolean
  /** Gebundene Chronell-Objektnotiz (Mail/Termin) für „In Notiz übernehmen“. */
  noteTarget?: ObjectNoteTarget | null
}

export function CopilotAssistPanel({
  accountId,
  contextKey,
  contextTexts,
  primaryPrompt,
  primaryActionLabel,
  title,
  className,
  retrievalQuery,
  collapsedDefault = true,
  noteTarget = null
}: CopilotAssistPanelProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(!collapsedDefault)
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<string | null>(null)
  const [attributions, setAttributions] = useState<CopilotChatMessageAttribution[]>([])
  const [hits, setHits] = useState<CopilotRetrievalHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState('')
  const [engine, setEngine] = useState<CopilotChatEngine>('graph')
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [cacheLoading, setCacheLoading] = useState(false)
  const [adopting, setAdopting] = useState(false)
  const [adoptedOk, setAdoptedOk] = useState(false)

  const canUse = accountId.startsWith('ms:')
  const mailMessageId = useMemo(
    () => parseMailMessageIdFromContextKey(contextKey),
    [contextKey]
  )

  useEffect(() => {
    setConversationId(null)
    setHits([])
    setError(null)
    setFollowUp('')
    setBusy(false)
    setReplyText(null)
    setAttributions([])
    setCachedAt(null)
    setAdoptedOk(false)

    if (!mailMessageId) return

    const cacheGet = window.mailClient?.copilot?.cacheGet
    if (typeof cacheGet !== 'function') return

    let cancelled = false
    setCacheLoading(true)
    void cacheGet({ messageId: mailMessageId, engine })
      .then((entry) => {
        if (cancelled || !entry?.replyText) return
        setReplyText(entry.replyText)
        setAttributions(entry.attributions ?? [])
        setCachedAt(entry.updatedAt)
        setExpanded(true)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setCacheLoading(false)
      })

    return (): void => {
      cancelled = true
    }
  }, [contextKey, accountId, engine, mailMessageId])

  const persistCache = useCallback(
    async (text: string, attrs: CopilotChatMessageAttribution[]): Promise<void> => {
      if (!mailMessageId) return
      const cacheSet = window.mailClient?.copilot?.cacheSet
      if (typeof cacheSet !== 'function') return
      try {
        const saved = await cacheSet({
          messageId: mailMessageId,
          engine,
          replyText: text,
          attributions: attrs
        })
        if (saved?.updatedAt) setCachedAt(saved.updatedAt)
      } catch {
        // Lokaler Cache ist Best-Effort.
      }
    },
    [engine, mailMessageId]
  )

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
        const contexts = contextTexts.map((c) => c.trim()).filter(Boolean)
        const embedContext = opts?.resetConversation === true || !conversationId
        if (embedContext && contexts.join('').length < 20) {
          setError(t('copilot.assist.contextMissing'))
          return
        }
        const promptWithEngine =
          engine === 'workiq'
            ? `${text}\n\n${t('copilot.assist.workIqPromptExtra')}`
            : text
        const payloadMessage = embedContext
          ? buildGroundedCopilotMessage(promptWithEngine, contexts)
          : promptWithEngine
        const res = await chat({
          accountId,
          conversationId: opts?.resetConversation ? null : conversationId,
          message: payloadMessage,
          timeZone: resolveDefaultEventTimeZone(null),
          additionalContext: contexts,
          disableWebSearch: true,
          engine
        })
        if (res.status === 'ok' && res.replyText) {
          const attrs = res.attributions ?? []
          setConversationId(res.conversationId)
          setReplyText(res.replyText)
          setAttributions(attrs)
          setAdoptedOk(false)
          void persistCache(res.replyText, attrs)
          return
        }
        if (res.status === 'forbidden') {
          setError(
            res.errorMessage
              ? `${t(engine === 'workiq' ? 'copilot.assist.workIqForbidden' : 'copilot.assist.forbidden')}\n${res.errorMessage}`
              : t(engine === 'workiq' ? 'copilot.assist.workIqForbidden' : 'copilot.assist.forbidden')
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
    [accountId, busy, canUse, contextTexts, conversationId, engine, persistCache, t]
  )

  const runRetrieval = useCallback(async (): Promise<void> => {
    const q = retrievalQuery?.trim()
    if (!q || !canUse) return
    try {
      const retrieve = window.mailClient?.copilot?.retrieve
      if (typeof retrieve !== 'function') return
      const [sp, od] = await Promise.all([
        retrieve({
          accountId,
          queryString: q,
          dataSource: 'sharePoint',
          maximumNumberOfResults: 5
        }),
        retrieve({
          accountId,
          queryString: q,
          dataSource: 'oneDriveBusiness',
          maximumNumberOfResults: 5
        })
      ])
      const merged = [...(sp.hits ?? []), ...(od.hits ?? [])]
      setHits(merged.slice(0, 8))
      if (sp.status === 'forbidden' || od.status === 'forbidden') {
        setError((prev) => prev ?? t('copilot.assist.retrievalForbidden'))
      }
    } catch {
      // Retrieval is optional — chat can still succeed.
    }
  }, [accountId, canUse, retrievalQuery, t])

  const onPrimary = useCallback((): void => {
    setExpanded(true)
    void runChat(primaryPrompt, { resetConversation: true })
    if (retrievalQuery?.trim()) void runRetrieval()
  }, [primaryPrompt, retrievalQuery, runChat, runRetrieval])

  const onFollowUp = useCallback((): void => {
    const q = followUp.trim()
    if (!q) return
    setFollowUp('')
    void runChat(q)
  }, [followUp, runChat])

  const onAdoptToNote = useCallback((): void => {
    if (!noteTarget || !replyText?.trim() || adopting) return
    setAdopting(true)
    setAdoptedOk(false)
    const engineLabel =
      engine === 'workiq' ? t('copilot.assist.engineWorkIq') : t('copilot.assist.engineGraph')
    void appendCopilotReplyToObjectNote({
      target: noteTarget,
      replyText,
      attributions,
      hits,
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
  }, [adopting, attributions, engine, hits, noteTarget, replyText, t])

  const cachedAtLabel = useMemo(() => {
    if (!cachedAt) return null
    try {
      // SQLite datetime('now') ist UTC ohne Z — als UTC parsen.
      const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(cachedAt)
        ? cachedAt
        : `${cachedAt.replace(' ', 'T')}Z`
      const d = new Date(normalized)
      if (Number.isNaN(d.getTime())) return t('copilot.assist.cachedLocal')
      return t('copilot.assist.cachedAt', {
        when: d.toLocaleString(i18n.language.startsWith('de') ? 'de-AT' : 'en-US', {
          dateStyle: 'short',
          timeStyle: 'short'
        })
      })
    } catch {
      return t('copilot.assist.cachedLocal')
    }
  }, [cachedAt, i18n.language, t])

  if (!canUse) return null

  const trailing = (
    <>
      {busy || cacheLoading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
      <select
        className="max-w-[9.5rem] shrink-0 rounded-md border border-border/60 bg-background px-1.5 py-1 text-2xs text-foreground"
        value={engine}
        disabled={busy}
        aria-label={t('copilot.assist.engineLabel')}
        title={t('copilot.assist.engineHint')}
        onClick={(e): void => e.stopPropagation()}
        onChange={(e): void => {
          setEngine(e.target.value === 'workiq' ? 'workiq' : 'graph')
        }}
      >
        <option value="graph">{t('copilot.assist.engineGraph')}</option>
        <option value="workiq">{t('copilot.assist.engineWorkIq')}</option>
      </select>
      <button
        type="button"
        disabled={busy}
        className="shrink-0 rounded-md border border-border/60 bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary/40 disabled:opacity-50"
        onClick={(e): void => {
          e.stopPropagation()
          onPrimary()
        }}
      >
        {replyText ? t('copilot.assist.refresh') : primaryActionLabel}
      </button>
    </>
  )

  return (
    <PreviewFoldSection
      icon={Sparkles}
      title={title}
      expanded={expanded}
      onToggle={(): void => setExpanded((v) => !v)}
      iconClassName="text-primary"
      trailing={trailing}
      summary={
        replyText
          ? t('copilot.assist.cachedLocal')
          : engine === 'workiq'
            ? t('copilot.assist.engineWorkIq')
            : t('copilot.assist.engineGraph')
      }
      className={cn('min-h-0', className)}
      contentClassName="space-y-3 text-sm"
    >
      {error ? (
        <p className="whitespace-pre-wrap break-all text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {busy && !replyText ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('copilot.assist.loading')}
        </p>
      ) : null}

      {replyText ? (
        <div className="space-y-1.5">
          {cachedAtLabel ? (
            <p className="text-2xs text-muted-foreground">{cachedAtLabel}</p>
          ) : null}
          <div className="rounded-md border border-border/50 bg-secondary/[0.04] px-2.5 py-2">
            <CopilotMarkdown
              markdown={replyText}
              className="[&_.copilot-cite]:ml-0.5 [&_.copilot-cite_a]:text-primary [&_.copilot-cite_a]:no-underline hover:[&_.copilot-cite_a]:underline"
            />
          </div>
        </div>
      ) : !busy && !error && !cacheLoading ? (
        <p className="text-xs text-muted-foreground">{t('copilot.assist.hint')}</p>
      ) : null}

      <CopilotSourcePills attributions={attributions} replyText={replyText} />

      {replyText && noteTarget ? (
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

      {hits.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">{t('copilot.assist.relatedDocs')}</p>
          <ul className="space-y-1.5">
            {hits.map((hit, i) => (
              <li
                key={`hit-${i}-${hit.resourceTitle ?? ''}`}
                className="rounded-md border border-border/50 bg-secondary/[0.04] px-2 py-1.5"
              >
                {hit.resourceTitle || hit.resourceUrl ? (
                  <p className="text-2xs font-medium text-foreground">
                    {hit.resourceUrl ? (
                      <button
                        type="button"
                        className="text-left text-primary hover:underline"
                        onClick={(): void => {
                          void openExternalUrl(hit.resourceUrl!).catch(() => undefined)
                        }}
                      >
                        {hit.resourceTitle || hit.resourceUrl}
                      </button>
                    ) : (
                      hit.resourceTitle
                    )}
                  </p>
                ) : null}
                {hit.extract ? (
                  <p className="mt-0.5 line-clamp-3 text-2xs text-muted-foreground">{hit.extract}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={followUp}
          disabled={busy || !replyText}
          placeholder={t('copilot.assist.followUpPlaceholder')}
          className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-50"
          onChange={(e): void => setFollowUp(e.target.value)}
          onKeyDown={(e): void => {
            if (e.key === 'Enter') onFollowUp()
          }}
        />
        <button
          type="button"
          disabled={busy || !followUp.trim() || !replyText}
          className="shrink-0 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/40 disabled:opacity-50"
          onClick={onFollowUp}
        >
          {t('copilot.assist.send')}
        </button>
      </div>
    </PreviewFoldSection>
  )
}
