import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  EntityLinkAiScanAnchor,
  EntityLinkAiScanCostEstimate,
  EntityLinkAiScanItem,
  EntityLinkAiScanProfile,
  EntityLinkAiScanStatus
} from '@shared/entity-links'
import { ConnectionChainTimeline } from '@/components/connections/ConnectionChainTimeline'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import {
  acceptEntityLinkAiScanItems,
  cancelEntityLinkAiScan,
  dismissEntityLinkAiScanItems,
  estimateEntityLinkAiScanCost,
  fetchAiConnectionsSettings,
  fetchEntityLinkAiScanStatus,
  startEntityLinkAiScan,
  subscribeEntityLinkAiScanProgress
} from '@/lib/entity-links-client'
import { showAppConfirm } from '@/stores/app-dialog'

export function ConnectionsAiScanPanel({
  open,
  scanAnchors = null,
  scanProfile = null,
  onClose,
  onAccepted,
  onFocusItem
}: {
  open: boolean
  /** Nur diese Objekte scannen; null = automatische Mail-Anker (90 Tage). */
  scanAnchors?: EntityLinkAiScanAnchor[] | null
  scanProfile?: EntityLinkAiScanProfile | null
  onClose: () => void
  onAccepted?: () => void
  onFocusItem?: (item: EntityLinkAiScanItem) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const [aiReady, setAiReady] = useState(false)
  const [compareProviders, setCompareProviders] = useState(false)
  const [status, setStatus] = useState<EntityLinkAiScanStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [lookbackDays, setLookbackDays] = useState(90)
  const [maxAnchors, setMaxAnchors] = useState(50)
  const [profile, setProfile] = useState<EntityLinkAiScanProfile>('sparse_mails')
  const [costEstimate, setCostEstimate] = useState<EntityLinkAiScanCostEstimate | null>(null)

  const selectionMode = Boolean(scanAnchors && scanAnchors.length > 0)

  useEffect(() => {
    if (!open) return
    void fetchAiConnectionsSettings()
      .then((s) => {
        setAiReady(s.enabled && s.hasActiveApiKey)
        setCompareProviders(s.compareProviders)
        setLookbackDays(s.scanLookbackDays)
        setMaxAnchors(s.scanMaxAnchors)
      })
      .catch(() => setAiReady(false))
    void fetchEntityLinkAiScanStatus().then(setStatus)
    if (scanProfile) setProfile(scanProfile)
  }, [open, scanProfile])

  useEffect(() => {
    if (!open || selectionMode) {
      setCostEstimate(null)
      return
    }
    const input =
      profile === 'recent_30'
        ? { scanProfile: profile, maxAnchors, lookbackDays: 30 }
        : profile === 'contacts_calendar'
          ? { scanProfile: profile, maxAnchors }
          : { scanProfile: profile, maxAnchors, lookbackDays }
    void estimateEntityLinkAiScanCost(input).then(setCostEstimate).catch(() => setCostEstimate(null))
  }, [open, selectionMode, profile, maxAnchors, lookbackDays])

  useEffect(() => {
    if (!open || !selectionMode || !scanAnchors) {
      return
    }
    void estimateEntityLinkAiScanCost({ anchors: scanAnchors }).then(setCostEstimate)
  }, [open, selectionMode, scanAnchors])

  useEffect(() => {
    if (!open) return
    return subscribeEntityLinkAiScanProgress(setStatus)
  }, [open])

  const startScan = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      if (!selectionMode) {
        await window.mailClient.aiConnections.setSettings({
          scanLookbackDays: lookbackDays,
          scanMaxAnchors: maxAnchors
        })
      }
      const next = await startEntityLinkAiScan(
        selectionMode && scanAnchors
          ? { anchors: scanAnchors }
          : profile === 'recent_30'
            ? { scanProfile: profile, maxAnchors, lookbackDays: 30 }
            : { scanProfile: profile, maxAnchors, lookbackDays }
      )
      setStatus(next)
    } catch (err) {
      setStatus({
        running: false,
        progress: { done: 0, total: 0, suggestionsFound: 0 },
        items: [],
        error: err instanceof Error ? err.message : t('connections.scan.error')
      })
    } finally {
      setBusy(false)
    }
  }, [t, selectionMode, scanAnchors, maxAnchors, lookbackDays, profile])

  const cancelScan = useCallback(async (): Promise<void> => {
    const next = await cancelEntityLinkAiScan()
    setStatus(next)
  }, [])

  const acceptOne = useCallback(
    async (item: EntityLinkAiScanItem): Promise<void> => {
      setBusy(true)
      try {
        await acceptEntityLinkAiScanItems([item.id])
        setStatus(await fetchEntityLinkAiScanStatus())
        onAccepted?.()
      } finally {
        setBusy(false)
      }
    },
    [onAccepted]
  )

  const dismissOne = useCallback(async (item: EntityLinkAiScanItem): Promise<void> => {
    setBusy(true)
    try {
      await dismissEntityLinkAiScanItems([item.id])
      setStatus(await fetchEntityLinkAiScanStatus())
    } finally {
      setBusy(false)
    }
  }, [])

  const acceptAll = useCallback(async (): Promise<void> => {
    if (!status?.items.length) return
    const ok = await showAppConfirm(
      t('connections.scan.acceptAllConfirm', { count: status.items.length }),
      {
        title: t('connections.scan.acceptAllTitle'),
        confirmLabel: t('connections.scan.acceptAll'),
        variant: 'default'
      }
    )
    if (!ok) return
    setBusy(true)
    try {
      await acceptEntityLinkAiScanItems(status.items.map((i) => i.id))
      setStatus(await fetchEntityLinkAiScanStatus())
      onAccepted?.()
    } finally {
      setBusy(false)
    }
  }, [status?.items, t, onAccepted])

  if (!open) return null

  const running = status?.running ?? false
  const items = status?.items ?? []
  const progress = status?.progress
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[45%] flex-col border-t border-primary/30 bg-card shadow-lg">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-xs font-medium text-foreground">
            {selectionMode
              ? t('connections.scan.titleSelection', { count: scanAnchors!.length })
              : t('connections.scan.title')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!running && items.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={(): void => void acceptAll()}
              className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {t('connections.scan.acceptAll')}
            </button>
          ) : null}
          {running ? (
            <button
              type="button"
              disabled={busy}
              onClick={(): void => void cancelScan()}
              className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary"
            >
              {t('connections.scan.cancel')}
            </button>
          ) : (
            <button
              type="button"
              disabled={!aiReady || busy}
              onClick={(): void => void startScan()}
              className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : t('connections.scan.start')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
            aria-label={t('common.close')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {running && progress ? (
        <div className="shrink-0 space-y-1 border-b border-border/50 px-3 py-2">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>
              {t('connections.scan.progress', {
                done: progress.done,
                total: progress.total,
                found: progress.suggestionsFound
              })}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {status?.error ? (
        <p className="shrink-0 px-3 py-2 text-[10px] text-destructive">{status.error}</p>
      ) : null}

      {!aiReady && !running ? (
        <p className="shrink-0 px-3 py-2 text-[10px] text-muted-foreground">
          {t('connections.suggestions.aiDisabled')}
        </p>
      ) : null}

      {!running && selectionMode ? (
        <p className="shrink-0 px-3 py-1 text-[10px] text-muted-foreground">
          {t('connections.scan.selectionHint', { count: scanAnchors!.length })}
        </p>
      ) : null}

      {costEstimate && !running ? (
        <p className="shrink-0 px-3 py-1 text-[10px] text-muted-foreground">
          {t('connections.scan.costEstimate', {
            calls: costEstimate.apiCalls,
            tokens: costEstimate.tokensEstimate.toLocaleString(),
            suffix: compareProviders ? t('connections.scan.costEstimateCompare') : ''
          })}
        </p>
      ) : null}

      {!running && !selectionMode && aiReady ? (
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-border/50 px-3 py-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted-foreground">
              {t('connections.scan.profile')}
            </span>
            <select
              className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
              value={profile}
              disabled={busy}
              onChange={(e): void =>
                setProfile(e.target.value as EntityLinkAiScanProfile)
              }
            >
              <option value="sparse_mails">{t('connections.scan.profileSparse')}</option>
              <option value="recent_30">{t('connections.scan.profileRecent30')}</option>
              <option value="contacts_calendar">
                {t('connections.scan.profileContactsCalendar')}
              </option>
            </select>
          </label>
          {profile === 'sparse_mails' ? (
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-muted-foreground">
                {t('connections.scan.lookbackDays')}
              </span>
              <input
                type="number"
                min={7}
                max={365}
                value={lookbackDays}
                disabled={busy}
                onChange={(e): void => setLookbackDays(Number(e.target.value) || 90)}
                className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted-foreground">
              {t('connections.scan.maxAnchors')}
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={maxAnchors}
              disabled={busy}
              onChange={(e): void => setMaxAnchors(Number(e.target.value) || 50)}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
            />
          </label>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 && !running ? (
          <p className="px-1 text-[10px] text-muted-foreground">
            {selectionMode
              ? t('connections.scan.emptySelection')
              : t('connections.scan.empty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = entityRefKindIcon(item.suggestion.target.kind)
              const conf = item.suggestion.confidence
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <button
                    type="button"
                    disabled={busy || running || !onFocusItem}
                    onClick={(): void => onFocusItem?.(item)}
                    className="min-w-0 flex-1 text-left hover:opacity-90 disabled:opacity-50"
                    title={t('connections.scan.showInGraph')}
                  >
                    <p className="truncate text-[11px] font-medium text-foreground">
                      {item.anchorTitle}
                      <span className="mx-1 text-muted-foreground">→</span>
                      {item.suggestion.title}
                    </p>
                    {item.chain ? (
                      <ConnectionChainTimeline chain={item.chain} compact />
                    ) : item.suggestion.reasonText ? (
                      <p className="truncate text-[9px] text-muted-foreground">
                        {item.suggestion.reasonText}
                      </p>
                    ) : null}
                  </button>
                  <span className="shrink-0 text-[9px] text-muted-foreground">
                    {item.suggestion.providerConsensus
                      ? `${t('connections.suggestions.consensus')} · `
                      : ''}
                    {conf != null ? `${Math.round(conf * 100)}%` : 'KI'}
                  </span>
                  <button
                    type="button"
                    disabled={busy || running}
                    onClick={(): void => void dismissOne(item)}
                    className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    {t('connections.scan.dismiss')}
                  </button>
                  <button
                    type="button"
                    disabled={busy || running}
                    onClick={(): void => void acceptOne(item)}
                    className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] hover:bg-secondary disabled:opacity-50"
                  >
                    {t('connections.scan.accept')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {progress?.cancelled && !running ? (
        <p className="shrink-0 border-t border-border/50 px-3 py-1 text-[10px] text-muted-foreground">
          {t('connections.scan.cancelled')}
        </p>
      ) : null}
    </div>
  )
}
