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
import type { EntityLinkAiDomainProfileId } from '@shared/ai-link-domain'
import type { AiLinkCustomDomainProfile } from '@shared/ai-link-domain'
import type {
  EntityLinkedItem,
  EntityLinkQuality,
  EntityLinkQualityAssessment,
  EntityLinkSuggestion,
  EntityLinkSuggestionChain,
  EntityLinkTargetCandidate
} from '@shared/entity-links'
import { AiSnippetConsentDialog } from '@/components/connections/AiSnippetConsentDialog'
import { ConnectionChainTimeline } from '@/components/connections/ConnectionChainTimeline'
import type { EntityLinkAiPayloadPreview } from '@shared/entity-link-ai-payload'
import type { AiConnectionsSettings } from '@shared/ai-connections'
import {
  isAiSnippetAskSkippedForSession,
  setAiSnippetAskSkippedForSession
} from '@/lib/ai-snippet-session'
import { entityContextDividerClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import {
  dismissEntityLinkAiSuggestion,
  fetchAiConnectionsSettings,
  fetchEntityLinkAiPayloadPreview,
  fetchEntityLinkAiSuggestions,
  fetchEntityLinkQuality,
  fetchEntityLinkSuggestions,
  subscribeEntityLinksChanged
} from '@/lib/entity-links-client'
import { openEntityRef } from '@/lib/entity-link-nav'
import { openConnectionsGraphForRef } from '@/lib/open-connections-graph'
import { useAppModeStore, type AppShellMode } from '@/stores/app-mode'

const PICKER_KINDS: EntityRefKind[] = [...ENTITY_REF_KINDS]

import type {
  EntityContextRelationsStats,
  EntityContextTab
} from '@/components/connections/entity-context-types'

export type { EntityContextTab, EntityContextRelationsStats } from '@/components/connections/entity-context-types'

export function EntityContextRelations({
  anchor,
  contentPaddingClass = 'px-6',
  expanded,
  activeTab,
  onActiveTabChange,
  pickerOpen: pickerOpenProp,
  onPickerOpenChange,
  onStatsChange
}: {
  anchor: ChronellEntityRef
  contentPaddingClass?: string
  expanded: boolean
  activeTab: EntityContextTab
  onActiveTabChange: (tab: EntityContextTab) => void
  pickerOpen?: boolean
  onPickerOpenChange?: (open: boolean) => void
  onStatsChange?: (stats: EntityContextRelationsStats) => void
}): JSX.Element {
  const { t } = useTranslation()
  const setAppMode = useAppModeStore((s) => s.setMode)
  const anchorKey = useMemo(() => entityRefKey(anchor), [anchor])

  const [links, setLinks] = useState<EntityLinkedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pickerOpenInternal, setPickerOpenInternal] = useState(false)
  const pickerOpen = pickerOpenProp ?? pickerOpenInternal
  const setPickerOpen = useCallback(
    (value: SetStateAction<boolean>): void => {
      const resolve = (prev: boolean): boolean =>
        typeof value === 'function' ? value(prev) : value
      if (onPickerOpenChange) {
        onPickerOpenChange(resolve(pickerOpenProp ?? pickerOpenInternal))
      } else {
        setPickerOpenInternal(value)
      }
    },
    [onPickerOpenChange, pickerOpenProp, pickerOpenInternal]
  )
  const [pickerKind, setPickerKind] = useState<EntityRefKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<EntityLinkTargetCandidate[]>([])
  const [suggestions, setSuggestions] = useState<EntityLinkSuggestion[]>([])
  const [chains, setChains] = useState<EntityLinkSuggestionChain[]>([])
  const [aiReady, setAiReady] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [snippetAsk, setSnippetAsk] = useState<{
    preview: EntityLinkAiPayloadPreview | null
    skipSession: boolean
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [domainProfileId, setDomainProfileId] = useState<EntityLinkAiDomainProfileId>('general')
  const [customDomains, setCustomDomains] = useState<AiLinkCustomDomainProfile[]>([])
  const [qualityByLinkId, setQualityByLinkId] = useState<Map<number, EntityLinkQualityAssessment>>(
    () => new Map()
  )
  const [qualityLoading, setQualityLoading] = useState(false)
  const [qualityError, setQualityError] = useState<string | null>(null)
  const [filterWeakOnly, setFilterWeakOnly] = useState(false)
  const [qualitySnippetAsk, setQualitySnippetAsk] = useState<{
    preview: EntityLinkAiPayloadPreview | null
    skipSession: boolean
  } | null>(null)

  const visibleLinks = useMemo(() => {
    if (!filterWeakOnly) return links
    return links.filter((item) => {
      const q = qualityByLinkId.get(item.linkId)
      return q && (q.quality === 'weak' || q.quality === 'questionable')
    })
  }, [links, filterWeakOnly, qualityByLinkId])

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
    try {
      const rows = await fetchEntityLinkSuggestions(anchor)
      setSuggestions(rows)
    } catch {
      setSuggestions([])
    }
  }, [anchor, anchorKey])

  useEffect(() => {
    onStatsChange?.({
      linkCount: links.length,
      suggestionCount: suggestions.length + chains.length
    })
  }, [links.length, suggestions.length, chains.length, onStatsChange])

  useEffect(() => {
    if (activeTab === 'quality' && (links.length === 0 || !aiReady)) {
      onActiveTabChange('links')
    }
  }, [activeTab, links.length, aiReady, onActiveTabChange])

  useEffect(() => {
    if (!expanded) return
    void loadSuggestions()
  }, [expanded, loadSuggestions])

  useEffect(() => {
    if (!expanded) return
    void fetchAiConnectionsSettings()
      .then((s) => {
        setAiReady(s.enabled && s.hasActiveApiKey)
        setCustomDomains(s.customDomainProfiles ?? [])
      })
      .catch(() => setAiReady(false))
  }, [expanded, anchorKey])

  useEffect(() => {
    setQualityByLinkId(new Map())
    setQualityError(null)
    setFilterWeakOnly(false)
  }, [anchorKey])

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

  const loadAiSuggestions = useCallback(
    async (includeExcerpt?: boolean): Promise<void> => {
      setAiLoading(true)
      setAiError(null)
      try {
        const result = await fetchEntityLinkAiSuggestions({
          anchor,
          includeExcerpt,
          domainProfileId
        })
        setSuggestions(result.suggestions)
        setChains(result.chains)
      } catch (err) {
        setAiError(err instanceof Error ? err.message : t('connections.suggestions.aiError'))
      } finally {
        setAiLoading(false)
      }
    },
    [anchor, anchorKey, domainProfileId, t]
  )

  const loadLinkQuality = useCallback(
    async (includeExcerpt?: boolean): Promise<void> => {
      setQualityLoading(true)
      setQualityError(null)
      try {
        const result = await fetchEntityLinkQuality({ anchor, includeExcerpt })
        const map = new Map<number, EntityLinkQualityAssessment>()
        for (const row of result.assessments) {
          map.set(row.linkId, row)
        }
        setQualityByLinkId(map)
        window.dispatchEvent(new CustomEvent('entity-link-quality:updated'))
      } catch (err) {
        setQualityError(
          err instanceof Error ? err.message : t('connections.quality.error')
        )
      } finally {
        setQualityLoading(false)
      }
    },
    [anchor, anchorKey, t]
  )

  const beginLinkQuality = useCallback(async (): Promise<void> => {
    let settings: AiConnectionsSettings
    try {
      settings = await fetchAiConnectionsSettings()
    } catch {
      void loadLinkQuality(false)
      return
    }
    if (settings.snippetMode === 'ask' && !isAiSnippetAskSkippedForSession()) {
      const preview = await fetchEntityLinkAiPayloadPreview({
        anchor,
        includeExcerpt: true
      })
      setQualitySnippetAsk({ preview, skipSession: false })
      return
    }
    void loadLinkQuality(settings.snippetMode === 'on')
  }, [anchor, loadLinkQuality])

  const beginAiSuggestions = useCallback(async (): Promise<void> => {
    let settings: AiConnectionsSettings
    try {
      settings = await fetchAiConnectionsSettings()
    } catch {
      void loadAiSuggestions(false)
      return
    }
    if (settings.snippetMode === 'ask' && !isAiSnippetAskSkippedForSession()) {
      const preview = await fetchEntityLinkAiPayloadPreview({
        anchor,
        includeExcerpt: true
      })
      setSnippetAsk({ preview, skipSession: false })
      return
    }
    void loadAiSuggestions(settings.snippetMode === 'on')
  }, [anchor, loadAiSuggestions])

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

  if (!expanded) return <></>

  const tabBtn = (tab: EntityContextTab, label: string, badge?: number): JSX.Element => (
    <button
      key={tab}
      type="button"
      onClick={(): void => onActiveTabChange(tab)}
      className={cn(
        'rounded-md border px-2 py-0.5 text-[10px] font-medium',
        activeTab === tab
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-secondary/60'
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span className="ml-1 tabular-nums text-primary">({badge})</span>
      ) : null}
    </button>
  )

  return (
    <div className={cn('space-y-2 pb-3', contentPaddingClass)}>
      <div className={cn('flex flex-wrap gap-1 border-b pb-2', entityContextDividerClass)}>
        {tabBtn('links', t('context.tabs.links'))}
        {tabBtn('suggestions', t('context.tabs.suggestions'), suggestions.length + chains.length)}
        {links.length > 0 && aiReady
          ? tabBtn('quality', t('context.tabs.quality'))
          : null}
      </div>

      {activeTab === 'suggestions' ? (
        <div className="space-y-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-medium text-foreground">
                {t('connections.suggestions.title')}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span>{t('connections.domain.label')}</span>
                  <select
                    value={domainProfileId}
                    onChange={(e): void =>
                      setDomainProfileId(e.target.value as EntityLinkAiDomainProfileId)
                    }
                    className="max-w-[8rem] rounded border border-border bg-background px-1 py-0.5 text-[9px]"
                  >
                    <option value="general">{t('connections.domain.general')}</option>
                    <option value="workshop_honorar">
                      {t('connections.domain.workshopHonorar')}
                    </option>
                    <option value="travel">{t('connections.domain.travel')}</option>
                    {customDomains.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!aiReady || aiLoading || busy}
                  title={
                    aiReady
                      ? t('connections.suggestions.aiLoad')
                      : t('connections.suggestions.aiDisabled')
                  }
                  onClick={(): void => void beginAiSuggestions()}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium hover:bg-secondary disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {t('connections.suggestions.aiLoad')}
                </button>
              </div>
            </div>
            {snippetAsk ? (
              <AiSnippetConsentDialog
                preview={snippetAsk.preview}
                busy={aiLoading}
                skipSession={snippetAsk.skipSession}
                onSkipSessionChange={(v): void =>
                  setSnippetAsk((s) => (s ? { ...s, skipSession: v } : s))
                }
                onConfirmMetadataOnly={(): void => {
                  if (snippetAsk.skipSession) setAiSnippetAskSkippedForSession(true)
                  setSnippetAsk(null)
                  void loadAiSuggestions(false)
                }}
                onConfirmWithExcerpt={(): void => {
                  if (snippetAsk.skipSession) setAiSnippetAskSkippedForSession(true)
                  setSnippetAsk(null)
                  void loadAiSuggestions(true)
                }}
                onCancel={(): void => setSnippetAsk(null)}
              />
            ) : null}
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
                  const isAi = s.reason === 'ai_semantic' || s.reason === 'embedding_semantic'
                  return (
                    <div
                      key={`${entityRefKey(s.target)}:${s.reason}`}
                      className="flex w-full items-start gap-1 rounded-md px-1 py-1 hover:bg-secondary/50"
                    >
                      <SIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1 text-xs">
                        <span className="block truncate font-medium">{s.title}</span>
                        {s.reasonText ? (
                          <span className="block truncate text-[9px] text-muted-foreground">
                            {s.reasonText}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 pt-0.5 text-[9px] text-muted-foreground">
                        {isAi && s.providerConsensus
                          ? `${t('connections.suggestions.consensus')} · `
                          : ''}
                        {isAi && s.confidence != null
                          ? `${t(`connections.suggestions.reason.${s.reason}`)} · ${Math.round(s.confidence * 100)}%`
                          : t(`connections.suggestions.reason.${s.reason}`)}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        title={t('connections.suggestions.accept')}
                        onClick={(): void => void addLink(s.target, true)}
                        className="inline-flex shrink-0 items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[9px] font-medium hover:bg-secondary disabled:opacity-50"
                      >
                        <Link2 className="h-3 w-3" />
                        {t('connections.suggestions.accept')}
                      </button>
                      {isAi ? (
                        <button
                          type="button"
                          disabled={busy}
                          title={t('connections.suggestions.dismiss')}
                          onClick={(): void => void dismissSuggestion(s.target)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-50"
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
      ) : null}

      {activeTab === 'links' ? (
        <>
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
          ) : visibleLinks.length === 0 && filterWeakOnly ? (
            <p className="text-xs text-muted-foreground">{t('connections.quality.noneWeak')}</p>
          ) : (
            <div className="space-y-0.5">
              {visibleLinks.map((item) => (
                <ConnectionLinkRow
                  key={item.linkId}
                  item={item}
                  busy={busy}
                  quality={qualityByLinkId.get(item.linkId)}
                  setAppMode={setAppMode}
                  onRemove={(): void => void removeLink(item.linkId)}
                  t={t}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {activeTab === 'quality' && links.length > 0 && aiReady ? (
            <div className="space-y-1 rounded-md border border-border/60 bg-secondary/20 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-medium text-foreground">
                  {t('connections.quality.title')}
                </p>
                <button
                  type="button"
                  disabled={qualityLoading || busy}
                  onClick={(): void => void beginLinkQuality()}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium hover:bg-secondary disabled:opacity-50"
                >
                  {qualityLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {t('connections.quality.check')}
                </button>
              </div>
              {qualitySnippetAsk ? (
                <AiSnippetConsentDialog
                  preview={qualitySnippetAsk.preview}
                  busy={qualityLoading}
                  skipSession={qualitySnippetAsk.skipSession}
                  onSkipSessionChange={(v): void =>
                    setQualitySnippetAsk((s) => (s ? { ...s, skipSession: v } : s))
                  }
                  onConfirmMetadataOnly={(): void => {
                    if (qualitySnippetAsk.skipSession) setAiSnippetAskSkippedForSession(true)
                    setQualitySnippetAsk(null)
                    void loadLinkQuality(false)
                  }}
                  onConfirmWithExcerpt={(): void => {
                    if (qualitySnippetAsk.skipSession) setAiSnippetAskSkippedForSession(true)
                    setQualitySnippetAsk(null)
                    void loadLinkQuality(true)
                  }}
                  onCancel={(): void => setQualitySnippetAsk(null)}
                />
              ) : null}
              {qualityError ? (
                <p className="text-[10px] text-destructive">{qualityError}</p>
              ) : null}
              {qualityByLinkId.size > 0 ? (
                <label className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={filterWeakOnly}
                    onChange={(e): void => setFilterWeakOnly(e.target.checked)}
                  />
                  {t('connections.quality.filterWeak')}
                </label>
              ) : null}
            </div>
      ) : null}
    </div>
  )
}

const QUALITY_BADGE_CLASS: Record<EntityLinkQuality, string> = {
  strong: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  moderate: 'bg-secondary text-muted-foreground',
  weak: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
  questionable: 'bg-destructive/15 text-destructive'
}

function ConnectionLinkRow({
  item,
  busy,
  quality,
  setAppMode,
  onRemove,
  t
}: {
  item: EntityLinkedItem
  busy: boolean
  quality?: EntityLinkQualityAssessment
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
        <span className="flex items-center gap-1 truncate text-xs text-foreground">
          <span className="truncate">{item.title}</span>
          {quality ? (
            <span
              className={cn(
                'shrink-0 rounded px-1 py-px text-[8px] font-medium',
                QUALITY_BADGE_CLASS[quality.quality]
              )}
              title={quality.reasonText ?? undefined}
            >
              {t(`connections.quality.${quality.quality}`)}
            </span>
          ) : null}
        </span>
        {quality?.reasonText ? (
          <span className="block truncate text-[9px] text-muted-foreground">{quality.reasonText}</span>
        ) : null}
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

export { EntityContextBlock } from '@/components/connections/EntityContextBlock'
export { ConnectionsPanel } from '@/components/connections/connections-panel-compat'

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
