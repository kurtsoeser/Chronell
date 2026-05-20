import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef, EntityRefKind } from '@shared/entity-ref'
import { ENTITY_REF_KINDS, entityRefKey } from '@shared/entity-ref'
import type {
  EntityLinkedItem,
  EntityLinkSuggestion,
  EntityLinkSuggestionChain,
  EntityLinkTargetCandidate
} from '@shared/entity-links'
import { ConnectionChainTimeline } from '@/components/connections/ConnectionChainTimeline'
import { cn } from '@/lib/utils'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import {
  dismissEntityLinkAiSuggestion,
  fetchAiConnectionsSettings,
  fetchEntityLinkAiSuggestions,
  fetchEntityLinkSuggestions,
  subscribeEntityLinksChanged
} from '@/lib/entity-links-client'
import { openEntityRef } from '@/lib/entity-link-nav'
import { openConnectionsGraphForRef } from '@/lib/open-connections-graph'
import { useAppModeStore, type AppShellMode } from '@/stores/app-mode'

const PICKER_KINDS: EntityRefKind[] = [...ENTITY_REF_KINDS]

export function ConnectionsPanel({
  anchor,
  className,
  sectionCollapsedDefault = true,
  contentPaddingClass = 'px-6'
}: {
  anchor: ChronellEntityRef
  className?: string
  sectionCollapsedDefault?: boolean
  /** Horizontal padding for header and body (e.g. px-0 inside padded parents). */
  contentPaddingClass?: string
}): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const anchorKey = useMemo(() => entityRefKey(anchor), [anchor])

  const [expanded, setExpanded] = useState(!sectionCollapsedDefault)
  const [links, setLinks] = useState<EntityLinkedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerKind, setPickerKind] = useState<EntityRefKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<EntityLinkTargetCandidate[]>([])
  const [suggestions, setSuggestions] = useState<EntityLinkSuggestion[]>([])
  const [chains, setChains] = useState<EntityLinkSuggestionChain[]>([])
  const [aiReady, setAiReady] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadLinks = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.mailClient.entityLinks.list(anchor)
      setLinks(result.links)
    } catch {
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [anchor, anchorKey])

  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  useEffect(() => {
    return subscribeEntityLinksChanged(() => {
      void loadLinks()
    })
  }, [loadLinks])

  const loadSuggestions = useCallback(async (): Promise<void> => {
    if (anchor.kind !== 'mail' && anchor.kind !== 'mail_todo') {
      setSuggestions([])
      return
    }
    try {
      const rows = await fetchEntityLinkSuggestions(anchor)
      setSuggestions(rows)
    } catch {
      setSuggestions([])
    }
  }, [anchor, anchorKey])

  useEffect(() => {
    if (!expanded) return
    void loadSuggestions()
  }, [expanded, loadSuggestions])

  useEffect(() => {
    if (!expanded) return
    void fetchAiConnectionsSettings()
      .then((s) => setAiReady(s.enabled && s.hasActiveApiKey))
      .catch(() => setAiReady(false))
  }, [expanded, anchorKey])

  useEffect(() => {
    if (!expanded) return
    return subscribeEntityLinksChanged(() => {
      void loadSuggestions()
    })
  }, [expanded, loadSuggestions])

  useEffect(() => {
    if (!pickerOpen) return
    const handle = window.setTimeout(() => {
      void window.mailClient.entityLinks
        .searchTargets({ anchor, query: search.trim(), limit: 40 })
        .then((rows) => {
          const linkedKeys = new Set(links.map((item) => entityRefKey(item.peer)))
          setCandidates(
            rows.filter((c) => {
              if (pickerKind !== 'all' && c.target.kind !== pickerKind) return false
              return !linkedKeys.has(entityRefKey(c.target))
            })
          )
        })
        .catch(() => setCandidates([]))
    }, 150)
    return (): void => window.clearTimeout(handle)
  }, [pickerOpen, search, anchor, anchorKey, pickerKind, links])

  const loadAiSuggestions = useCallback(async (): Promise<void> => {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await fetchEntityLinkAiSuggestions({ anchor })
      setSuggestions(result.suggestions)
      setChains(result.chains)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('connections.suggestions.aiError'))
    } finally {
      setAiLoading(false)
    }
  }, [anchor, anchorKey, t])

  async function addLink(peer: ChronellEntityRef, fromSuggestion = false): Promise<void> {
    setBusy(true)
    try {
      await window.mailClient.entityLinks.add({
        a: anchor,
        b: peer,
        linkKind: fromSuggestion ? 'suggested' : undefined
      })
      setPickerOpen(false)
      setSearch('')
      await loadLinks()
      await loadSuggestions()
    } finally {
      setBusy(false)
    }
  }

  async function acceptChain(chain: EntityLinkSuggestionChain): Promise<void> {
    setBusy(true)
    try {
      for (let i = 0; i < chain.steps.length - 1; i++) {
        const a = chain.steps[i]!.ref
        const b = chain.steps[i + 1]!.ref
        await window.mailClient.entityLinks.add({ a, b, linkKind: 'suggested' })
      }
      await loadLinks()
      await loadSuggestions()
      setChains((prev) =>
        prev.filter(
          (c) =>
            c.steps.map((s) => entityRefKey(s.ref)).join('>') !==
            chain.steps.map((s) => entityRefKey(s.ref)).join('>')
        )
      )
    } finally {
      setBusy(false)
    }
  }

  async function dismissSuggestion(peer: ChronellEntityRef): Promise<void> {
    setBusy(true)
    try {
      await dismissEntityLinkAiSuggestion({ anchor, peer })
      setSuggestions((prev) =>
        prev.filter((s) => entityRefKey(s.target) !== entityRefKey(peer))
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeLink(linkId: number): Promise<void> {
    setBusy(true)
    try {
      await window.mailClient.entityLinks.remove({ linkId, anchor })
      await loadLinks()
      await loadSuggestions()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={cn('border-t border-border', className)}>
      <div className={cn('flex w-full items-center gap-2 py-2', contentPaddingClass)}>
        <button
          type="button"
          onClick={(): void => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:bg-secondary/30"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-xs font-medium text-foreground">{t('connections.title')}</span>
          {!expanded && links.length > 0 ? (
            <span className="ml-1 rounded-full bg-secondary px-1.5 py-0 text-[10px] tabular-nums text-muted-foreground">
              {links.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className="shrink-0 text-[10px] font-medium text-primary hover:underline"
          onClick={(): void => openConnectionsGraphForRef(anchor)}
        >
          {t('connections.shell.showInGraph')}
        </button>
      </div>

      {expanded ? (
        <div className={cn('space-y-2 pb-3', contentPaddingClass)}>
          <div className="space-y-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-medium text-foreground">
                {t('connections.suggestions.title')}
              </p>
              <button
                type="button"
                disabled={!aiReady || aiLoading || busy}
                title={
                  aiReady
                    ? t('connections.suggestions.aiLoad')
                    : t('connections.suggestions.aiDisabled')
                }
                onClick={(): void => void loadAiSuggestions()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium hover:bg-secondary disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {t('connections.suggestions.aiLoad')}
              </button>
            </div>
            {aiError ? <p className="text-[10px] text-destructive">{aiError}</p> : null}
            {chains.length > 0 ? (
              <div className="space-y-1.5">
                {chains.map((chain) => (
                  <div
                    key={chain.steps.map((s) => entityRefKey(s.ref)).join('>')}
                    className="flex items-start gap-1 rounded-md border border-primary/20 bg-primary/5 p-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <ConnectionChainTimeline chain={chain} compact />
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(): void => void acceptChain(chain)}
                      className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] hover:bg-secondary disabled:opacity-50"
                    >
                      {t('connections.suggestions.acceptChain')}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="space-y-0.5">
                {suggestions.map((s) => {
                  const SIcon = entityRefKindIcon(s.target.kind)
                  const isAi = s.reason === 'ai_semantic'
                  return (
                    <div
                      key={`${entityRefKey(s.target)}:${s.reason}`}
                      className="flex w-full items-start gap-1 rounded-md px-1 py-1 hover:bg-secondary/50"
                    >
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(): void => void addLink(s.target, true)}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left text-xs"
                      >
                        <SIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.title}</span>
                          {s.reasonText ? (
                            <span className="block truncate text-[9px] text-muted-foreground">
                              {s.reasonText}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[9px] text-muted-foreground">
                          {isAi && s.providerConsensus
                            ? `${t('connections.suggestions.consensus')} · `
                            : ''}
                          {isAi && s.confidence != null
                            ? `${t('connections.suggestions.reason.ai_semantic')} · ${Math.round(s.confidence * 100)}%`
                            : t(`connections.suggestions.reason.${s.reason}`)}
                        </span>
                      </button>
                      {isAi ? (
                        <button
                          type="button"
                          disabled={busy}
                          title={t('connections.suggestions.dismiss')}
                          onClick={(): void => void dismissSuggestion(s.target)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {t('connections.suggestions.empty')}
              </p>
            )}
          </div>

          <ConnectionsPicker
            pickerOpen={pickerOpen}
            setPickerOpen={setPickerOpen}
            pickerKind={pickerKind}
            setPickerKind={setPickerKind}
            search={search}
            setSearch={setSearch}
            candidates={candidates}
            busy={busy}
            addLink={addLink}
            t={t}
          />

          {loading ? (
            <ConnectionsLoading t={t} />
          ) : links.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('connections.empty')}</p>
          ) : (
            <div className="space-y-0.5">
              {links.map((item) => (
                <ConnectionLinkRow
                  key={item.linkId}
                  item={item}
                  busy={busy}
                  setAppMode={setAppMode}
                  onRemove={(): void => void removeLink(item.linkId)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function ConnectionLinkRow({
  item,
  busy,
  setAppMode,
  onRemove,
  t
}: {
  item: EntityLinkedItem
  busy: boolean
  setAppMode: (mode: AppShellMode) => void
  onRemove: () => void
  t: (key: string) => string
}): JSX.Element {
  const kind = item.peer.kind
  const Icon = entityRefKindIcon(kind)
  const open = (): void => {
    void openEntityRef(item.peer, setAppMode)
  }
  return (
    <div className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-secondary/40">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <button type="button" onClick={open} className="min-w-0 flex-1 text-left" title={item.title}>
        <span className="block truncate text-xs text-foreground">{item.title}</span>
        {item.subtitle ? (
          <span className="block truncate text-[10px] text-muted-foreground">
            {t(`connections.kind.${kind}`)} · {item.subtitle}
          </span>
        ) : (
          <span className="block text-[10px] text-muted-foreground">
            {t(`connections.kind.${kind}`)}
          </span>
        )}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={open}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label={t('connections.open')}
        title={t('connections.open')}
      >
        <ExternalLink className="h-3 w-3" />
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label={t('connections.remove')}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function ConnectionsLoading({ t }: { t: (key: string) => string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t('common.loading')}
    </div>
  )
}

function ConnectionsPicker({
  pickerOpen,
  setPickerOpen,
  pickerKind,
  setPickerKind,
  search,
  setSearch,
  candidates,
  busy,
  addLink,
  t
}: {
  pickerOpen: boolean
  setPickerOpen: Dispatch<SetStateAction<boolean>>
  pickerKind: EntityRefKind | 'all'
  setPickerKind: (k: EntityRefKind | 'all') => void
  search: string
  setSearch: (s: string) => void
  candidates: EntityLinkTargetCandidate[]
  busy: boolean
  addLink: (peer: ChronellEntityRef) => Promise<void>
  t: (key: string) => string
}): JSX.Element {
  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={(): void => setPickerOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"
        >
          <Plus className="h-3 w-3" />
          {t('connections.add')}
        </button>
      </div>

      {pickerOpen ? (
        <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={(): void => setPickerKind('all')}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[10px]',
                pickerKind === 'all'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary/60'
              )}
            >
              {t('connections.filterAll')}
            </button>
            {PICKER_KINDS.map((kind) => {
              const KindIcon = entityRefKindIcon(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={(): void => setPickerKind(kind)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px]',
                    pickerKind === kind
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-secondary/60'
                  )}
                >
                  <KindIcon className="h-3 w-3" />
                  {t(`connections.kind.${kind}`)}
                </button>
              )
            })}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            placeholder={t('connections.searchPlaceholder')}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
          <div className="max-h-44 overflow-y-auto rounded-md border border-border">
            {candidates.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">{t('connections.noCandidates')}</div>
            ) : (
              candidates.map((c) => {
                const CandIcon = entityRefKindIcon(c.target.kind)
                return (
                  <button
                    key={entityRefKey(c.target)}
                    type="button"
                    disabled={busy}
                    onClick={(): void => void addLink(c.target)}
                    className="flex w-full items-center gap-2 border-b border-border/50 px-2 py-1.5 text-left text-xs hover:bg-secondary/50 last:border-0"
                  >
                    <CandIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {t(`connections.kind.${c.target.kind}`)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
