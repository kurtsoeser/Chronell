import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link2, Loader2, MapPin, Pin, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { resolveCustomViewTabIcon } from '@/lib/custom-view-tab-icon'
import { customViewIconIdOrDefault } from '@/app/custom-views/custom-views-storage'
import { clusterLabelForKey } from '@/app/connections/connections-graph-labels'
import { loadGraphViewSettings } from '@/app/connections/connections-graph-view-settings'
import { fetchEntityLinksGraph } from '@/lib/entity-links-client'
import {
  addDashboardPinnedShortcut,
  readDashboardPinnedShortcuts,
  removeDashboardPinnedShortcut,
  writeDashboardPinnedShortcuts,
  DASHBOARD_PINNED_SHORTCUTS_CHANGED_EVENT,
  type DashboardPinnedShortcutEntry
} from '@/app/home/dashboard-pinned-shortcuts'
import { useAccountsStore } from '@/stores/accounts'
import { useCustomViewsStore } from '@/stores/custom-views'
import { useAppModeStore } from '@/stores/app-mode'
import { useConnectionsGraphFocusStore } from '@/stores/connections-graph-focus'

type IslandCandidate = { clusterKey: string; label: string }

export function DashboardPinnedShortcutsTile(): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const views = useCustomViewsStore((s) => s.views)
  const focusCustomView = useCustomViewsStore((s) => s.focusCustomView)
  const setAppMode = useAppModeStore((s) => s.setMode)
  const requestFocusCluster = useConnectionsGraphFocusStore((s) => s.requestFocusCluster)

  const [entries, setEntries] = useState<DashboardPinnedShortcutEntry[]>(() =>
    readDashboardPinnedShortcuts()
  )
  const [addOpen, setAddOpen] = useState(false)
  const [islandsLoading, setIslandsLoading] = useState(false)
  const [islandCandidates, setIslandCandidates] = useState<IslandCandidate[]>([])
  const addPanelRef = useRef<HTMLDivElement>(null)

  const graphLabels = useMemo(() => loadGraphViewSettings().componentIslandLabels, [addOpen])

  const persist = useCallback((next: DashboardPinnedShortcutEntry[]): void => {
    setEntries(next)
    writeDashboardPinnedShortcuts(next)
  }, [])

  useEffect(() => {
    const onChanged = (): void => setEntries(readDashboardPinnedShortcuts())
    window.addEventListener(DASHBOARD_PINNED_SHORTCUTS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(DASHBOARD_PINNED_SHORTCUTS_CHANGED_EVENT, onChanged)
  }, [])

  useEffect(() => {
    if (!addOpen) return
    const onDoc = (e: MouseEvent): void => {
      const el = addPanelRef.current
      if (el && !el.contains(e.target as Node)) setAddOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [addOpen])

  useEffect(() => {
    if (!addOpen) return
    let cancelled = false
    setIslandsLoading(true)
    void (async (): Promise<void> => {
      try {
        const graph = await fetchEntityLinksGraph()
        if (cancelled) return
        const settings = loadGraphViewSettings()
        const keys = new Set<string>()
        for (const key of Object.keys(settings.componentIslandLabels)) keys.add(key)
        for (const key of Object.keys(settings.clusterIslandStyles)) keys.add(key)
        for (const n of graph.nodes) {
          if (n.clusterKey) keys.add(n.clusterKey)
        }
        const list: IslandCandidate[] = [...keys]
          .sort((a, b) =>
            clusterLabelForKey(a, t, accounts, settings.componentIslandLabels).localeCompare(
              clusterLabelForKey(b, t, accounts, settings.componentIslandLabels),
              undefined,
              { sensitivity: 'base' }
            )
          )
          .map((clusterKey) => ({
            clusterKey,
            label: clusterLabelForKey(
              clusterKey,
              t,
              accounts,
              settings.componentIslandLabels
            )
          }))
        setIslandCandidates(list)
      } catch {
        if (!cancelled) {
          const settings = loadGraphViewSettings()
          const keys = new Set([
            ...Object.keys(settings.componentIslandLabels),
            ...Object.keys(settings.clusterIslandStyles)
          ])
          setIslandCandidates(
            [...keys].map((clusterKey) => ({
              clusterKey,
              label: clusterLabelForKey(
                clusterKey,
                t,
                accounts,
                settings.componentIslandLabels
              )
            }))
          )
        }
      } finally {
        if (!cancelled) setIslandsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [addOpen, accounts, t])

  const pinnedViewIds = useMemo(
    () => new Set(entries.filter((e) => e.kind === 'custom_view').map((e) => e.viewId)),
    [entries]
  )
  const pinnedClusterKeys = useMemo(
    () =>
      new Set(entries.filter((e) => e.kind === 'connection_island').map((e) => e.clusterKey)),
    [entries]
  )

  const unpinnedViews = useMemo(
    () => views.filter((v) => !pinnedViewIds.has(v.id)),
    [views, pinnedViewIds]
  )

  const unpinnedIslands = useMemo(
    () => islandCandidates.filter((c) => !pinnedClusterKeys.has(c.clusterKey)),
    [islandCandidates, pinnedClusterKeys]
  )

  const openEntry = useCallback(
    (entry: DashboardPinnedShortcutEntry): void => {
      if (entry.kind === 'custom_view') {
        focusCustomView(entry.viewId)
        return
      }
      setAppMode('connections')
      requestFocusCluster(entry.clusterKey)
    },
    [focusCustomView, requestFocusCluster, setAppMode]
  )

  const pinView = useCallback(
    (viewId: string): void => {
      persist(addDashboardPinnedShortcut(entries, { kind: 'custom_view', viewId }))
    },
    [entries, persist]
  )

  const pinIsland = useCallback(
    (clusterKey: string): void => {
      persist(addDashboardPinnedShortcut(entries, { kind: 'connection_island', clusterKey }))
    },
    [entries, persist]
  )

  const unpin = useCallback(
    (id: string): void => {
      persist(removeDashboardPinnedShortcut(entries, id))
    },
    [entries, persist]
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border/40 px-2 py-1">
        <button
          type="button"
          onClick={(): void => setAddOpen((o) => !o)}
          className="flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          title={t('dashboard.pinnedShortcuts.addTitle')}
          aria-label={t('dashboard.pinnedShortcuts.addAria')}
          aria-expanded={addOpen}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('dashboard.pinnedShortcuts.add')}
        </button>
      </div>

      {addOpen ? (
        <div
          ref={addPanelRef}
          className="chronell-acrylic-popover absolute right-2 top-9 z-[60] flex max-h-[min(50vh,16rem)] w-[min(calc(100%-1rem),18rem)] flex-col overflow-hidden rounded-lg border border-border/80 text-popover-foreground shadow-lg"
          role="dialog"
          aria-label={t('dashboard.pinnedShortcuts.addPanelTitle')}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-2.5 py-1.5">
            <span className="text-[11px] font-semibold">{t('dashboard.pinnedShortcuts.addPanelTitle')}</span>
            <button
              type="button"
              onClick={(): void => setAddOpen(false)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted/60"
              aria-label={t('common.close')}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('dashboard.pinnedShortcuts.sectionViews')}
            </div>
            {unpinnedViews.length === 0 ? (
              <p className="mb-3 px-1 text-[10px] text-muted-foreground">
                {t('dashboard.pinnedShortcuts.noViewsToAdd')}
              </p>
            ) : (
              <ul className="mb-3 space-y-0.5">
                {unpinnedViews.map((view) => {
                  const Icon = resolveCustomViewTabIcon(customViewIconIdOrDefault(view.iconId))
                  return (
                    <li key={view.id}>
                      <button
                        type="button"
                        onClick={(): void => {
                          pinView(view.id)
                          setAddOpen(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{view.name}</span>
                        <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('dashboard.pinnedShortcuts.sectionIslands')}
            </div>
            {islandsLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[10px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('dashboard.loading.generic')}
              </div>
            ) : unpinnedIslands.length === 0 ? (
              <p className="px-1 text-[10px] text-muted-foreground">
                {t('dashboard.pinnedShortcuts.noIslandsToAdd')}
              </p>
            ) : (
              <ul className="max-h-[8rem] space-y-0.5 overflow-y-auto overscroll-contain">
                {unpinnedIslands.map((c) => (
                  <li key={c.clusterKey}>
                    <button
                      type="button"
                      onClick={(): void => {
                        pinIsland(c.clusterKey)
                        setAddOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-2 py-8 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground/40" aria-hidden />
            <p className="text-xs text-muted-foreground">{t('dashboard.pinnedShortcuts.empty')}</p>
            <p className="text-[10px] text-muted-foreground/80">
              {t('dashboard.pinnedShortcuts.emptyHint')}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry) => {
              const isView = entry.kind === 'custom_view'
              const view = isView ? views.find((v) => v.id === entry.viewId) : null
              const label = isView
                ? view?.name ?? t('dashboard.pinnedShortcuts.missingView')
                : clusterLabelForKey(entry.clusterKey, t, accounts, graphLabels)
              const Icon = isView
                ? resolveCustomViewTabIcon(
                    customViewIconIdOrDefault(view?.iconId)
                  )
                : Link2
              const missing = isView && !view

              return (
                <li key={entry.id}>
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 pr-1',
                      missing && 'opacity-60'
                    )}
                  >
                    <button
                      type="button"
                      onClick={(): void => openEntry(entry)}
                      disabled={missing}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors hover:bg-secondary/50 disabled:cursor-not-allowed"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {label}
                      </span>
                      <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                        {isView
                          ? t('dashboard.pinnedShortcuts.badgeView')
                          : t('dashboard.pinnedShortcuts.badgeIsland')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(): void => unpin(entry.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={t('dashboard.pinnedShortcuts.unpinTitle')}
                      aria-label={t('dashboard.pinnedShortcuts.unpinAria', { name: label })}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
