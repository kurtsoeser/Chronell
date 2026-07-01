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
  CalendarDays,
  FolderOpen,
  GripVertical,
  Mail,
  RotateCcw,
  Star,
  Tag,
  User
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT,
  applyMailReadingPreviewMetaFieldPrefs,
  readMailReadingPreviewMetaFieldPrefs,
  reconcileMailReadingPreviewMetaFieldOrder,
  resetMailReadingPreviewMetaFieldPrefs,
  type MailReadingPreviewMetaFieldId
} from '@/lib/mail-reading-preview-meta-fields'

const FIELD_META: Record<
  MailReadingPreviewMetaFieldId,
  { icon: React.ComponentType<{ className?: string }>; labelKey: string }
> = {
  dateTime: { icon: CalendarDays, labelKey: 'settings.mailPreviewMeta.fields.dateTime' },
  folder: { icon: FolderOpen, labelKey: 'settings.mailPreviewMeta.fields.folder' },
  from: { icon: Mail, labelKey: 'settings.mailPreviewMeta.fields.from' },
  to: { icon: Mail, labelKey: 'settings.mailPreviewMeta.fields.to' },
  cc: { icon: Mail, labelKey: 'settings.mailPreviewMeta.fields.cc' },
  categories: { icon: Tag, labelKey: 'settings.mailPreviewMeta.fields.categories' },
  account: { icon: User, labelKey: 'settings.mailPreviewMeta.fields.account' },
  flagged: { icon: Star, labelKey: 'settings.mailPreviewMeta.fields.flagged' },
  importance: { icon: Star, labelKey: 'settings.mailPreviewMeta.fields.importance' }
}

function SortableMetaFieldRow({
  id,
  label,
  icon: Icon,
  visible,
  onToggleVisible,
  dragAria,
  dragTitle
}: {
  id: MailReadingPreviewMetaFieldId
  label: string
  icon: React.ComponentType<{ className?: string }>
  visible: boolean
  onToggleVisible: (id: MailReadingPreviewMetaFieldId, next: boolean) => void
  dragAria: string
  dragTitle: string
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
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
          onChange={(e): void => onToggleVisible(id, e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border"
        />
        <span className="sr-only">{label}</span>
      </label>
    </li>
  )
}

export function SettingsMailPreviewMetaFieldsSection(): JSX.Element {
  const { t } = useTranslation()
  const [order, setOrder] = useState<MailReadingPreviewMetaFieldId[]>([])
  const [hidden, setHidden] = useState<Set<MailReadingPreviewMetaFieldId>>(() => new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const reload = useCallback((): void => {
    const prefs = readMailReadingPreviewMetaFieldPrefs()
    setOrder(prefs.order)
    setHidden(prefs.hidden)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    window.addEventListener(MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT, reload)
    return (): void =>
      window.removeEventListener(MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT, reload)
  }, [reload])

  const persist = useCallback(
    (nextOrder: MailReadingPreviewMetaFieldId[], nextHidden: Set<MailReadingPreviewMetaFieldId>) => {
      const reconciled = reconcileMailReadingPreviewMetaFieldOrder(nextOrder)
      setOrder(reconciled)
      setHidden(nextHidden)
      applyMailReadingPreviewMetaFieldPrefs(reconciled, nextHidden)
    },
    []
  )

  const rows = useMemo(() => {
    return order.map((id) => {
      const meta = FIELD_META[id]
      return { id, label: t(meta.labelKey), icon: meta.icon }
    })
  }, [order, t])

  const onDragEnd = useCallback(
    (e: DragEndEvent): void => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIndex = order.indexOf(active.id as MailReadingPreviewMetaFieldId)
      const newIndex = order.indexOf(over.id as MailReadingPreviewMetaFieldId)
      if (oldIndex < 0 || newIndex < 0) return
      persist(arrayMove(order, oldIndex, newIndex), hidden)
    },
    [hidden, order, persist]
  )

  const onToggleVisible = useCallback(
    (id: MailReadingPreviewMetaFieldId, nextVisible: boolean): void => {
      const nextHidden = new Set(hidden)
      if (nextVisible) nextHidden.delete(id)
      else nextHidden.add(id)
      persist(order, nextHidden)
    },
    [hidden, order, persist]
  )

  const dragAria = t('settings.mailPreviewMeta.dragAria')
  const dragTitle = t('settings.mailPreviewMeta.dragTitle')

  return (
    <section className="space-y-3 rounded-md bg-background/60 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Mail className="h-3.5 w-3.5" aria-hidden />
        {t('settings.mailPreviewMeta.heading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.mailPreviewMeta.intro')}</p>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        {t('settings.mailPreviewMeta.orderHint')}
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {rows.map(({ id, label, icon }) => (
              <SortableMetaFieldRow
                key={id}
                id={id}
                label={label}
                icon={icon}
                visible={!hidden.has(id)}
                onToggleVisible={onToggleVisible}
                dragAria={dragAria}
                dragTitle={dragTitle}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={(): void => resetMailReadingPreviewMetaFieldPrefs()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/60"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          {t('settings.mailPreviewMeta.reset')}
        </button>
      </div>
    </section>
  )
}
