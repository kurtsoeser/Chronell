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
  arrayMove,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createContext, useContext, useMemo, type HTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarShellColumnId } from '@/app/calendar/calendar-shell-column-order'
import { cn } from '@/lib/utils'

type SortableApi = ReturnType<typeof useSortable>

const CalendarColumnSortableContext = createContext<SortableApi | null>(null)

export function useCalendarColumnSortable(): SortableApi | null {
  return useContext(CalendarColumnSortableContext)
}

/** Klicks auf Header-Buttons sollen kein Spalten-Ziehen starten. */
export const calendarColumnHeaderNoDragProps: Pick<
  HTMLAttributes<HTMLElement>,
  'onPointerDown'
> = {
  onPointerDown: (e): void => {
    e.stopPropagation()
  }
}

/** Ganze Spalten-Titelleiste als Drag-Griff (ohne separates Handle-Icon). */
export function CalendarShellColumnHeaderDragSurface({
  children,
  className,
  as = 'div'
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'header'
}): JSX.Element {
  const { t } = useTranslation()
  const sortable = useCalendarColumnSortable()
  const Tag = as

  if (!sortable) {
    return <Tag className={className}>{children}</Tag>
  }

  const { setActivatorNodeRef, listeners, attributes, isDragging } = sortable

  return (
    <Tag
      ref={setActivatorNodeRef}
      {...listeners}
      {...attributes}
      title={t('calendar.shell.columnDragTitle')}
      className={cn(
        className,
        'cursor-grab touch-none select-none active:cursor-grabbing',
        isDragging && 'cursor-grabbing'
      )}
    >
      {children}
    </Tag>
  )
}

export function CalendarShellSortableColumn({
  id,
  className,
  children
}: {
  id: CalendarShellColumnId
  className?: string
  children: ReactNode
}): JSX.Element {
  const sortable = useSortable({ id })
  const { setNodeRef, transform, transition, isDragging } = sortable
  const style = useMemo(
    (): React.CSSProperties => ({
      transform: CSS.Transform.toString(transform),
      transition,
      ...(isDragging ? { position: 'relative', zIndex: 30 } : {})
    }),
    [isDragging, transform, transition]
  )

  return (
    <CalendarColumnSortableContext.Provider value={sortable}>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          className,
          isDragging && 'rounded-md shadow-lg ring-1 ring-primary/30'
        )}
      >
        {children}
      </div>
    </CalendarColumnSortableContext.Provider>
  )
}

export function CalendarShellColumnDndProvider({
  sortableIds,
  columnOrder,
  onColumnOrderChange,
  onReorderComplete,
  children
}: {
  sortableIds: readonly CalendarShellColumnId[]
  columnOrder: readonly CalendarShellColumnId[]
  onColumnOrderChange: (order: CalendarShellColumnId[]) => void
  onReorderComplete?: () => void
  children: ReactNode
}): JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as CalendarShellColumnId
    const overId = over.id as CalendarShellColumnId
    if (activeId === overId) return
    const oldIndex = columnOrder.indexOf(activeId)
    const newIndex = columnOrder.indexOf(overId)
    if (oldIndex < 0 || newIndex < 0) return
    onColumnOrderChange(arrayMove([...columnOrder], oldIndex, newIndex))
    onReorderComplete?.()
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={[...sortableIds]} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
