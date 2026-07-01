import { useCallback, useMemo } from 'react'
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
import { CalendarDays, GripVertical, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NotesCategoryBadges } from '@/components/NotesCategoryBadges'
import { PreviewMetaDot } from '@/components/preview-meta-chrome'
import { useMailReadingPreviewMetaPrefs } from '@/hooks/use-mail-reading-preview-meta-prefs'
import {
  applyMailReadingPreviewMetaFieldPrefs,
  getVisibleMailReadingPreviewMetaFields,
  type MailReadingPreviewMetaFieldContext,
  type MailReadingPreviewMetaFieldId
} from '@/lib/mail-reading-preview-meta-fields'
import { cn } from '@/lib/utils'

function SortableMetaSegment({
  id,
  children,
  dragAria,
  dragTitle,
  className,
  onContextMenu
}: {
  id: MailReadingPreviewMetaFieldId
  children: React.ReactNode
  dragAria: string
  dragTitle: string
  className?: string
  onContextMenu?: (e: React.MouseEvent) => void
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: 'relative' } : {})
  }

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/meta inline-flex min-w-0 max-w-full items-center gap-1',
        isDragging && 'rounded-sm bg-secondary/40 shadow-sm',
        className
      )}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-secondary/60 hover:text-muted-foreground group-hover/metarow:opacity-100 active:cursor-grabbing"
        title={dragTitle}
        aria-label={dragAria}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" aria-hidden />
      </button>
      {children}
    </span>
  )
}

export function MailReadingPreviewMetaRow({
  ctx,
  accountEnabled,
  onOpenCategories,
  onFromContextMenu
}: {
  ctx: MailReadingPreviewMetaFieldContext
  accountEnabled: boolean
  onOpenCategories: (e: React.MouseEvent | React.KeyboardEvent) => void
  onFromContextMenu: (e: React.MouseEvent) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const prefs = useMailReadingPreviewMetaPrefs()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const visibleIds = useMemo(
    () => getVisibleMailReadingPreviewMetaFields(prefs, ctx),
    [prefs, ctx]
  )

  const onDragEnd = useCallback(
    (e: DragEndEvent): void => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const activeId = active.id as MailReadingPreviewMetaFieldId
      const overId = over.id as MailReadingPreviewMetaFieldId
      const oldIndex = prefs.order.indexOf(activeId)
      const newIndex = prefs.order.indexOf(overId)
      if (oldIndex < 0 || newIndex < 0) return
      applyMailReadingPreviewMetaFieldPrefs(arrayMove(prefs.order, oldIndex, newIndex), prefs.hidden)
    },
    [prefs.hidden, prefs.order]
  )

  const dragAria = t('settings.mailPreviewMeta.dragAria')
  const dragTitle = t('settings.mailPreviewMeta.dragTitle')

  if (visibleIds.length === 0) return null

  const renderField = (id: MailReadingPreviewMetaFieldId): React.ReactNode => {
    switch (id) {
      case 'dateTime':
        return (
          <>
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="tabular-nums">{ctx.dateTimeLabel}</span>
          </>
        )
      case 'folder':
        return (
          <>
            <span className="shrink-0 text-xs italic text-muted-foreground">
              {t('mail.readingPane.metaFolder')}:
            </span>
            {ctx.folderLabel ? (
              <span className="truncate">{ctx.folderLabel}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </>
        )
      case 'from':
        return (
          <>
            <span className="shrink-0 text-xs italic text-muted-foreground">
              {t('mail.readingPane.metaFrom')}:
            </span>
            <span className="truncate font-medium">{ctx.fromLabel}</span>
            {ctx.fromAddrDetail ? (
              <span className="truncate text-xs text-muted-foreground">&lt;{ctx.fromAddrDetail}&gt;</span>
            ) : null}
          </>
        )
      case 'to':
        return (
          <>
            <span className="shrink-0 text-xs italic text-muted-foreground">
              {t('mail.readingPane.metaTo')}:
            </span>
            <span className="truncate">{ctx.toAddrs?.trim()}</span>
          </>
        )
      case 'cc':
        return (
          <>
            <span className="shrink-0 text-xs italic text-muted-foreground">
              {t('mail.readingPane.metaCc')}:
            </span>
            <span className="truncate">{ctx.ccAddrs?.trim()}</span>
          </>
        )
      case 'categories':
        return (
          <>
            <span className="shrink-0 text-xs italic text-muted-foreground">
              {t('mail.readingPane.metaCategories')}:
            </span>
            <button
              type="button"
              disabled={!accountEnabled}
              className="min-w-0 text-left disabled:cursor-default"
              title={t('mail.readingPane.categoriesTitle')}
              onClick={onOpenCategories}
            >
              {ctx.categories.length > 0 ? (
                <NotesCategoryBadges names={ctx.categories} colorByName={new Map()} />
              ) : (
                <span className="text-muted-foreground">{t('mail.readingPane.categoriesEmpty')}</span>
              )}
            </button>
          </>
        )
      case 'account':
        return (
          <>
            <span className="shrink-0 text-xs italic text-muted-foreground">
              {t('mail.readingPane.metaAccount')}:
            </span>
            <span className="truncate">{ctx.accountLabel}</span>
          </>
        )
      case 'flagged':
        return (
          <span className="inline-flex items-center gap-1 text-amber-500">
            <Star className="h-3 w-3 fill-current" aria-hidden />
            <span className="text-xs">{t('mail.readingPane.metaFlagged')}</span>
          </span>
        )
      case 'importance':
        return (
          <span className="text-xs font-medium text-destructive">
            {t('mail.readingPane.metaImportanceHigh')}
          </span>
        )
      default:
        return null
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
        <div
          className="group/metarow mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm"
          title={t('settings.mailPreviewMeta.previewDragHint')}
        >
          {visibleIds.map((id, index) => (
            <span key={id} className="inline-flex min-w-0 max-w-full items-center gap-x-1.5 gap-y-1">
              {index > 0 ? <PreviewMetaDot /> : null}
              <SortableMetaSegment
                id={id}
                dragAria={dragAria}
                dragTitle={dragTitle}
                onContextMenu={id === 'from' ? onFromContextMenu : undefined}
              >
                {renderField(id)}
              </SortableMetaSegment>
            </span>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
