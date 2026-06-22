import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  LayoutGrid,
  Building2,
  Calendar,
  GripVertical,
  House,
  Inbox,
  ListChecks,
  ListTodo,
  Link2,
  MessageCircle,
  StickyNote,
  Users,
  Files,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppShellMode } from '@/stores/app-mode'
import { cn } from '@/lib/utils'
import { showAppConfirm } from '@/stores/app-dialog'
import {
  DEFAULT_TOPBAR_MODULE_ORDER,
  readTopbarModuleOrder,
  reconcileTopbarModuleOrder
} from '@/app/layout/topbar-module-order'
import {
  TOPBAR_MODULE_PREFS_CHANGED_EVENT,
  applyTopbarModulePrefsFromSettings,
  readTopbarModuleHiddenSet
} from '@/app/layout/topbar-module-prefs'
import {
  CUSTOM_VIEWS_CHANGED_EVENT,
  useCustomViewsStore
} from '@/stores/custom-views'
import {
  readCustomViewTopbarOrder,
  reconcileCustomViewTopbarOrder
} from '@/app/custom-views/custom-views-storage'
import { resolveCustomViewTabIcon } from '@/lib/custom-view-tab-icon'

const CUSTOM_VIEW_SORT_PREFIX = 'custom-view:'

function customViewSortId(viewId: string): string {
  return `${CUSTOM_VIEW_SORT_PREFIX}${viewId}`
}

const MODULE_DEFS: Array<{
  id: AppShellMode
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'home', labelKey: 'topbar.modeHome', icon: House },
  { id: 'mail', labelKey: 'topbar.modeMail', icon: Inbox },
  { id: 'calendar', labelKey: 'topbar.modeCalendar', icon: Calendar },
  { id: 'bookings', labelKey: 'topbar.modeBookings', icon: Building2 },
  { id: 'tasks', labelKey: 'topbar.modeTasks', icon: ListTodo },
  { id: 'work', labelKey: 'topbar.modeWork', icon: ListChecks },
  { id: 'people', labelKey: 'topbar.modePeople', icon: Users },
  { id: 'notes', labelKey: 'topbar.modeNotes', icon: StickyNote },
  { id: 'files', labelKey: 'topbar.modeFiles', icon: Files },
  { id: 'connections', labelKey: 'topbar.modeConnections', icon: Link2 },
  { id: 'chat', labelKey: 'topbar.modeChat', icon: MessageCircle }
]

function SortableModuleRow({
  id,
  label,
  icon: Icon,
  visible,
  visibleCount,
  onToggleVisible,
  dragAria,
  dragTitle
}: {
  id: AppShellMode
  label: string
  icon: React.ComponentType<{ className?: string }>
  visible: boolean
  visibleCount: number
  onToggleVisible: (id: AppShellMode, next: boolean) => void
  dragAria: string
  dragTitle: string
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: 'relative' } : {})
  }
  const disableHide = visible && visibleCount <= 1

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md bg-background/80 px-2 py-1.5',
        !visible && 'opacity-55',
        isDragging && 'shadow-md'
      )}
    >
      <button
        type="button"
        className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-secondary/60 active:cursor-grabbing"
        title={dragTitle}
        aria-label={dragAria}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label}</span>
      <label className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
        <input
          type="checkbox"
          checked={visible}
          disabled={disableHide}
          title={disableHide ? undefined : visible ? undefined : label}
          onChange={(e): void => onToggleVisible(id, e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border"
        />
        <span className="sr-only">{label}</span>
      </label>
    </li>
  )
}

function SortableCustomViewRow({
  sortId,
  name,
  iconId,
  onEdit,
  onDelete,
  dragAria,
  dragTitle,
  editLabel,
  deleteLabel
}: {
  sortId: string
  name: string
  iconId?: string
  onEdit: () => void
  onDelete: () => void
  dragAria: string
  dragTitle: string
  editLabel: string
  deleteLabel: string
}): JSX.Element {
  const ViewIcon = resolveCustomViewTabIcon(iconId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: 'relative' } : {})
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5',
        isDragging && 'shadow-md'
      )}
    >
      <button
        type="button"
        className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-secondary/60 active:cursor-grabbing"
        title={dragTitle}
        aria-label={dragAria}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      <ViewIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{name}</span>
      <button
        type="button"
        onClick={onEdit}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        title={editLabel}
        aria-label={editLabel}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        title={deleteLabel}
        aria-label={deleteLabel}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  )
}

export function SettingsTopbarModulesSection(): JSX.Element {
  const { t } = useTranslation()
  const [order, setOrder] = useState<AppShellMode[]>(() => readTopbarModuleOrder())
  const [hidden, setHidden] = useState<Set<AppShellMode>>(() => readTopbarModuleHiddenSet())

  const customViews = useCustomViewsStore((s) => s.views)
  const customTopbarOrder = useCustomViewsStore((s) => s.topbarOrder)
  const openWizard = useCustomViewsStore((s) => s.openWizard)
  const startEditingView = useCustomViewsStore((s) => s.startEditingView)
  const deleteCustomView = useCustomViewsStore((s) => s.deleteView)
  const reorderCustomViews = useCustomViewsStore((s) => s.reorderViews)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  const rows = useMemo(() => {
    const byId = new Map(MODULE_DEFS.map((m) => [m.id, m]))
    return order
      .filter((id) => id !== 'customView' && byId.has(id))
      .map((id) => byId.get(id as (typeof MODULE_DEFS)[number]['id'])!)
  }, [order])

  const orderedCustomViews = useMemo(() => {
    const byId = new Map(customViews.map((v) => [v.id, v]))
    return customTopbarOrder
      .map((id) => byId.get(id))
      .filter((v): v is NonNullable<typeof v> => v != null)
  }, [customViews, customTopbarOrder])

  const customSortIds = useMemo(
    () => orderedCustomViews.map((v) => customViewSortId(v.id)),
    [orderedCustomViews]
  )

  const visibleCount = useMemo(
    () => order.filter((id) => !hidden.has(id)).length,
    [order, hidden]
  )

  const persist = useCallback((nextOrder: AppShellMode[], nextHidden: Set<AppShellMode>) => {
    const reconciled = reconcileTopbarModuleOrder(nextOrder, DEFAULT_TOPBAR_MODULE_ORDER)
    setOrder(reconciled)
    setHidden(nextHidden)
    applyTopbarModulePrefsFromSettings(reconciled, nextHidden)
  }, [])

  useEffect(() => {
    const onChanged = (): void => {
      setOrder(readTopbarModuleOrder())
      setHidden(readTopbarModuleHiddenSet())
    }
    window.addEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, onChanged)
  }, [])

  useEffect(() => {
    const syncCustomTopbarOrder = (): void => {
      const views = useCustomViewsStore.getState().views
      useCustomViewsStore.setState({
        topbarOrder: reconcileCustomViewTopbarOrder(views, readCustomViewTopbarOrder())
      })
    }
    window.addEventListener(CUSTOM_VIEWS_CHANGED_EVENT, syncCustomTopbarOrder)
    return (): void => window.removeEventListener(CUSTOM_VIEWS_CHANGED_EVENT, syncCustomTopbarOrder)
  }, [])

  const onDragEnd = useCallback(
    (e: DragEndEvent): void => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIndex = order.indexOf(active.id as AppShellMode)
      const newIndex = order.indexOf(over.id as AppShellMode)
      if (oldIndex < 0 || newIndex < 0) return
      persist(arrayMove(order, oldIndex, newIndex), hidden)
    },
    [hidden, order, persist]
  )

  const onCustomDragEnd = useCallback(
    (e: DragEndEvent): void => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const ids = orderedCustomViews.map((v) => v.id)
      const oldIndex = customSortIds.indexOf(String(active.id))
      const newIndex = customSortIds.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      reorderCustomViews(arrayMove(ids, oldIndex, newIndex))
    },
    [customSortIds, orderedCustomViews, reorderCustomViews]
  )

  const onToggleVisible = useCallback(
    (id: AppShellMode, nextVisible: boolean): void => {
      const nextHidden = new Set(hidden)
      if (nextVisible) {
        nextHidden.delete(id)
      } else {
        const wouldRemain = order.filter((m) => m !== id && !nextHidden.has(m))
        if (wouldRemain.length === 0) return
        nextHidden.add(id)
      }
      persist(order, nextHidden)
    },
    [hidden, order, persist]
  )

  const onDeleteCustomView = useCallback(
    async (viewId: string, name: string): Promise<void> => {
      const ok = await showAppConfirm(t('settings.modulesCustomViewDeleteConfirm', { name }), {
        title: t('customView.delete'),
        variant: 'danger',
        confirmLabel: t('common.delete')
      })
      if (!ok) return
      deleteCustomView(viewId)
    },
    [deleteCustomView, t]
  )

  const dragAria = t('topbar.moduleDragAria')
  const dragTitle = t('topbar.moduleDragTitle')

  return (
    <section className="space-y-4 rounded-md bg-background/60 p-3">
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          {t('settings.modulesHeading')}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.modulesHint')}</p>
        <p className="text-2xs leading-relaxed text-muted-foreground">{t('settings.modulesOrderHint')}</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {rows.map(({ id, labelKey, icon }) => (
                <SortableModuleRow
                  key={id}
                  id={id}
                  label={t(labelKey)}
                  icon={icon}
                  visible={!hidden.has(id)}
                  visibleCount={visibleCount}
                  onToggleVisible={onToggleVisible}
                  dragAria={dragAria}
                  dragTitle={dragTitle}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('settings.modulesCustomViewsHeading')}
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('settings.modulesCustomViewsHint')}
        </p>
        <button
          type="button"
          onClick={openWizard}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {t('settings.modulesCustomViewCreate')}
        </button>

        {orderedCustomViews.length > 0 ? (
          <>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {t('settings.modulesCustomViewsOrderHint')}
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCustomDragEnd}>
              <SortableContext items={customSortIds} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5">
                  {orderedCustomViews.map((view) => (
                    <SortableCustomViewRow
                      key={view.id}
                      sortId={customViewSortId(view.id)}
                      name={view.name}
                      iconId={view.iconId}
                      onEdit={(): void => startEditingView(view.id)}
                      onDelete={(): void => {
                        void onDeleteCustomView(view.id, view.name)
                      }}
                      dragAria={dragAria}
                      dragTitle={dragTitle}
                      editLabel={t('settings.modulesCustomViewEdit')}
                      deleteLabel={t('settings.modulesCustomViewDelete')}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        ) : (
          <p className="text-2xs text-muted-foreground">{t('settings.modulesCustomViewsEmpty')}</p>
        )}
      </div>
    </section>
  )
}
