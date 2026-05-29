import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  chronellDashboardTileSubtitleClass,
  chronellDashboardTileTitleClass
} from '@/lib/chronell-ui-classes'
import { DASHBOARD_TILE_IDS, type DashboardTileId } from '@/app/home/dashboard-layout'
import { useDashboardTileCatalog } from '@/app/home/use-dashboard-tile-catalog'
import { InboxCalendarSidebar } from '@/app/layout/InboxCalendarSidebar'
import {
  listPickableMailRightSidebarTileIds,
  MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID,
  readMailRightSidebarTileOrder,
  writeMailRightSidebarTileOrder,
  type MailRightSidebarTileId
} from '@/app/layout/mail-right-sidebar/mail-right-sidebar-dashboard-storage'
import { MailRightSidebarSortableTile } from '@/app/layout/mail-right-sidebar/MailRightSidebarSortableTile'

export function MailRightSidebarDashboard(): JSX.Element {
  const { t } = useTranslation()
  const { tileById } = useDashboardTileCatalog()
  const [tileOrder, setTileOrder] = useState<MailRightSidebarTileId[]>(() => readMailRightSidebarTileOrder())
  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const addPanelRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  useEffect(() => {
    writeMailRightSidebarTileOrder(tileOrder)
  }, [tileOrder])

  useEffect(() => {
    if (!addPanelOpen) return undefined
    const onDoc = (e: MouseEvent): void => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (addPanelRef.current?.contains(target) || addButtonRef.current?.contains(target)) return
      setAddPanelOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [addPanelOpen])

  const visibleSet = useMemo(() => new Set(tileOrder), [tileOrder])

  const isOnlyVisibleTile = useCallback(
    (id: MailRightSidebarTileId): boolean => visibleSet.has(id) && tileOrder.length <= 1,
    [tileOrder.length, visibleSet]
  )

  const hideTile = useCallback((id: MailRightSidebarTileId): void => {
    setTileOrder((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((x) => x !== id)
    })
  }, [])

  const setTileVisibleInPanel = useCallback((id: MailRightSidebarTileId, visible: boolean): void => {
    setTileOrder((prev) => {
      const has = prev.includes(id)
      if (visible) {
        if (has) return prev
        if (id === 'calendar' && prev.includes(MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID)) {
          return prev
        }
        return [...prev, id]
      }
      if (!has || prev.length <= 1) return prev
      return prev.filter((x) => x !== id)
    })
  }, [])

  const onDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTileOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as MailRightSidebarTileId)
      const newIndex = prev.indexOf(over.id as MailRightSidebarTileId)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  const pickableIds = useMemo(() => listPickableMailRightSidebarTileIds(), [])

  const labelForTileId = useCallback(
    (id: MailRightSidebarTileId): string => {
      if (id === MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID) {
        return t('dashboard.tiles.calendarTitle')
      }
      return tileById.get(id)?.title ?? id
    },
    [t, tileById]
  )

  const renderTile = (id: MailRightSidebarTileId): JSX.Element | null => {
    const hideDisabled = isOnlyVisibleTile(id)

    if (id === MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID) {
      return (
        <MailRightSidebarSortableTile
          key={id}
          id={id}
          title={t('dashboard.tiles.calendarTitle')}
          icon={Calendar}
          hideDisabled={hideDisabled}
          onHide={(): void => hideTile(id)}
          bodyClassName="flex max-h-[min(28rem,52vh)] min-h-[12rem] flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <InboxCalendarSidebar hideChrome />
          </div>
        </MailRightSidebarSortableTile>
      )
    }

    if (!isDashboardTileId(id)) return null
    const tile = tileById.get(id)
    if (!tile) return null

    return (
      <MailRightSidebarSortableTile
        key={id}
        id={id}
        title={tile.title}
        subtitle={tile.subtitle}
        icon={tile.icon}
        onOpenFull={tile.onOpenFull}
        hideDisabled={hideDisabled}
        onHide={(): void => hideTile(id)}
        bodyClassName="max-h-[min(24rem,48vh)] overflow-hidden"
      >
        {tile.body}
      </MailRightSidebarSortableTile>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tileOrder} strategy={verticalListSortingStrategy}>
            <div className="flex w-full min-w-0 flex-col gap-2">{tileOrder.map((id) => renderTile(id))}</div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="relative shrink-0 border-t border-border bg-sidebar/95 px-2 py-2 backdrop-blur">
        <button
          ref={addButtonRef}
          type="button"
          onClick={(): void => setAddPanelOpen((o) => !o)}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border',
            'bg-secondary/30 px-3 py-1.5 text-2xs font-medium text-foreground transition-colors',
            'hover:bg-secondary/60'
          )}
          aria-expanded={addPanelOpen}
          aria-label={t('mail.rightSidebar.addTileAria')}
        >
          <span className="text-sm leading-none" aria-hidden>
            +
          </span>
          {t('mail.rightSidebar.addTile')}
        </button>

        {addPanelOpen ? (
          <div
            ref={addPanelRef}
            className="chronell-acrylic-popover absolute bottom-full left-2 right-2 z-[80] mb-1 max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain p-3 text-popover-foreground"
            role="dialog"
            aria-label={t('mail.rightSidebar.tilesPanelTitle')}
          >
            <div className={cn(chronellDashboardTileTitleClass, 'mb-2')}>
              {t('mail.rightSidebar.tilesPanelTitle')}
            </div>
            <ul className="space-y-1.5">
              {pickableIds.map((id) => {
                const checked = visibleSet.has(id)
                const disableUncheck = checked && isOnlyVisibleTile(id)
                const hideCalendarDuplicate =
                  id === 'calendar' && visibleSet.has(MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID)
                if (hideCalendarDuplicate) return null
                const catalogTile = id === MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID ? null : tileById.get(id)
                const RowIcon = id === MAIL_RIGHT_SIDEBAR_AGENDA_TILE_ID ? Calendar : catalogTile?.icon
                return (
                  <li
                    key={id}
                    className="flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50"
                  >
                    <input
                      id={`mail-rs-tile-${id}`}
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
                      checked={checked}
                      disabled={disableUncheck}
                      title={
                        disableUncheck ? t('dashboardGrid.lastVisibleTileHint') : undefined
                      }
                      onChange={(e): void => setTileVisibleInPanel(id, e.target.checked)}
                    />
                    <div className="flex min-w-0 flex-1 gap-2">
                      {RowIcon ? (
                        <RowIcon
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary/80"
                          strokeWidth={2}
                          aria-hidden
                        />
                      ) : null}
                      <label
                        htmlFor={`mail-rs-tile-${id}`}
                        className={cn(
                          chronellDashboardTileTitleClass,
                          'min-w-0 flex-1 cursor-pointer font-medium leading-snug',
                          disableUncheck && 'cursor-not-allowed text-muted-foreground'
                        )}
                      >
                        <span>{labelForTileId(id)}</span>
                        {catalogTile?.subtitle ? (
                          <span className={cn(chronellDashboardTileSubtitleClass, 'mt-0.5 block truncate')}>
                            {catalogTile.subtitle}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className={cn(chronellDashboardTileSubtitleClass, 'mt-2 leading-snug')}>
              {t('mail.rightSidebar.tilesPanelHint')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function isDashboardTileId(id: MailRightSidebarTileId): id is DashboardTileId {
  return (DASHBOARD_TILE_IDS as string[]).includes(id)
}
