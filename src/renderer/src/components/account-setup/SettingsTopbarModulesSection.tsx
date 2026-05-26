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
  Users
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppShellMode } from '@/stores/app-mode'
import { cn } from '@/lib/utils'
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

export function SettingsTopbarModulesSection(): JSX.Element {
  const { t } = useTranslation()
  const [order, setOrder] = useState<AppShellMode[]>(() => readTopbarModuleOrder())
  const [hidden, setHidden] = useState<Set<AppShellMode>>(() => readTopbarModuleHiddenSet())

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  const rows = useMemo(() => {
    const byId = new Map(MODULE_DEFS.map((m) => [m.id, m]))
    return order
      .map((id) => byId.get(id))
      .filter((x): x is (typeof MODULE_DEFS)[number] => x != null)
  }, [order])

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

  const dragAria = t('topbar.moduleDragAria')
  const dragTitle = t('topbar.moduleDragTitle')

  return (
    <section className="space-y-2 rounded-md bg-background/60 p-3">
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
    </section>
  )
}
