import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Loader2, RotateCcw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { entityRefKey, type EntityRefKind } from '@shared/entity-ref'
import type { EntityLinkTargetCandidate } from '@shared/entity-links'
import { cn } from '@/lib/utils'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import { setActivePaletteDrag, setGraphEntityDragData } from '@/app/connections/graph-entity-drag'
import { fetchEntityPaletteList } from '@/lib/entity-links-client'

const PALETTE_KINDS: EntityRefKind[] = [
  'mail',
  'mail_todo',
  'calendar_event',
  'cloud_task',
  'people_contact',
  'note'
]

const PALETTE_PAGE_SIZE = 50

function allKindsSet(): Set<EntityRefKind> {
  return new Set(PALETTE_KINDS)
}

export function ConnectionsObjectPalette({
  className,
  selectedKey = null,
  onSelectItem
}: {
  className?: string
  selectedKey?: string | null
  onSelectItem?: (item: EntityLinkTargetCandidate) => void
}): JSX.Element {
  const { t } = useTranslation()
  const [activeKinds, setActiveKinds] = useState<Set<EntityRefKind>>(allKindsSet)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<EntityLinkTargetCandidate[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(PALETTE_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const didDragRef = useRef(false)

  const kindsList = useMemo(() => PALETTE_KINDS.filter((k) => activeKinds.has(k)), [activeKinds])
  const allKindsActive = activeKinds.size === PALETTE_KINDS.length

  const load = useCallback(async (): Promise<void> => {
    if (kindsList.length === 0) {
      setItems([])
      setHasMore(false)
      return
    }
    setLoading(true)
    try {
      const rows = await fetchEntityPaletteList({
        kinds: kindsList,
        query: search.trim(),
        limit: displayLimit + 1
      })
      setHasMore(rows.length > displayLimit)
      setItems(rows.slice(0, displayLimit))
    } catch {
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [kindsList, search, displayLimit])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load()
    }, 150)
    return (): void => window.clearTimeout(handle)
  }, [load])

  useEffect(() => {
    setDisplayLimit(PALETTE_PAGE_SIZE)
  }, [search, kindsList.join('\0')])

  const resetFilters = (): void => {
    setActiveKinds(allKindsSet())
  }

  const toggleKindFilter = (kind: EntityRefKind): void => {
    setActiveKinds((prev) => {
      const allActive = prev.size === PALETTE_KINDS.length
      if (allActive) {
        return new Set([kind])
      }
      const next = new Set(prev)
      if (next.has(kind)) {
        next.delete(kind)
        if (next.size === 0) return allKindsSet()
        return next
      }
      next.add(kind)
      if (next.size === PALETTE_KINDS.length) return allKindsSet()
      return next
    })
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div
        className="shrink-0 border-b border-border px-2 pb-2 pt-0"
        title={t('connections.palette.hint')}
      >
        <p className="chronell-type-section-label mb-1.5 text-muted-foreground">
          {t('connections.palette.filterLabel')}
        </p>
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label={t('connections.palette.filterLabel')}
        >
          {PALETTE_KINDS.map((kind) => {
            const Icon = entityRefKindIcon(kind)
            const filtered = !allKindsActive && activeKinds.has(kind)
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={filtered}
                onClick={(): void => toggleKindFilter(kind)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                  filtered
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-secondary/60',
                  allKindsActive && 'opacity-90'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {t(`connections.kind.${kind}`)}
              </button>
            )
          })}
          <button
            type="button"
            onClick={resetFilters}
            disabled={allKindsActive}
            title={t('connections.palette.resetFilter')}
            aria-label={t('connections.palette.resetFilter')}
            className={cn(
              'ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
              allKindsActive
                ? 'cursor-default text-muted-foreground/40'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
            )}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-border px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            placeholder={t('connections.palette.searchPlaceholder')}
            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {kindsList.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t('connections.palette.noFilter')}
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t('connections.palette.empty')}
          </p>
        ) : (
          <>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = entityRefKindIcon(item.target.kind)
                const key = entityRefKey(item.target)
                const isSelected = selectedKey === key
                return (
                  <li key={key}>
                    <div
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e): void => {
                        didDragRef.current = true
                        const payload = { ref: item.target, title: item.title }
                        setGraphEntityDragData(e.dataTransfer, payload)
                        if (e.dataTransfer.setDragImage) {
                          const el = e.currentTarget
                          e.dataTransfer.setDragImage(el, 16, 16)
                        }
                      }}
                      onDragEnd={(): void => {
                        setActivePaletteDrag(null)
                        window.setTimeout(() => {
                          didDragRef.current = false
                        }, 0)
                      }}
                      onClick={(): void => {
                        if (didDragRef.current) return
                        onSelectItem?.(item)
                      }}
                      onKeyDown={(e): void => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        onSelectItem?.(item)
                      }}
                      className={cn(
                        'flex cursor-grab items-center gap-1.5 rounded-md border px-1.5 py-1.5 text-left hover:border-border hover:bg-secondary/50 active:cursor-grabbing',
                        isSelected
                          ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20'
                          : 'border-transparent'
                      )}
                      title={t('connections.palette.itemHint')}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-foreground">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {hasMore ? (
              <button
                type="button"
                onClick={(): void => setDisplayLimit((n) => n + PALETTE_PAGE_SIZE)}
                className="mt-2 w-full rounded-md border border-border py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                {t('connections.palette.showMore')}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
