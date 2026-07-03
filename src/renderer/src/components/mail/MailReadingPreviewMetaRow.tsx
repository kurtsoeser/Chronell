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
  arrayMove,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Check, GripVertical, Pencil, Star } from 'lucide-react'
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

function MetaSegment({
  children,
  className,
  onContextMenu,
  editing = false
}: {
  children: React.ReactNode
  className?: string
  onContextMenu?: (e: React.MouseEvent) => void
  editing?: boolean
}): JSX.Element {
  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center gap-1', editing && 'rounded-sm ring-1 ring-border/60', className)}
      onContextMenu={onContextMenu}
    >
      {children}
    </span>
  )
}

function SortableMetaSegment({
  id,
  children,
  dragAria,
  dragTitle,
  onContextMenu
}: {
  id: MailReadingPreviewMetaFieldId
  children: React.ReactNode
  dragAria: string
  dragTitle: string
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
        'inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm ring-1 ring-primary/30 bg-secondary/20 px-0.5',
        isDragging && 'shadow-sm'
      )}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-secondary/60 active:cursor-grabbing"
        title={dragTitle}
        aria-label={dragAria}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" aria-hidden />
      </button>
      <span className="pointer-events-none min-w-0">{children}</span>
    </span>
  )
}

export function MailReadingPreviewMetaRow({
  messageId,
  ctx,
  accountEnabled,
  onOpenCategories,
  onFromContextMenu
}: {
  messageId: number
  ctx: MailReadingPreviewMetaFieldContext
  accountEnabled: boolean
  onOpenCategories: (e: React.MouseEvent | React.KeyboardEvent) => void
  onFromContextMenu: (e: React.MouseEvent) => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const prefs = useMailReadingPreviewMetaPrefs()
  const [editing, setEditing] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setEditing(false)
  }, [messageId])

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

  const renderField = (id: MailReadingPreviewMetaFieldId, interactive: boolean): React.ReactNode => {
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
            {interactive ? (
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
            ) : ctx.categories.length > 0 ? (
              <NotesCategoryBadges names={ctx.categories} colorByName={new Map()} />
            ) : (
              <span className="text-muted-foreground">{t('mail.readingPane.categoriesEmpty')}</span>
            )}
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

  const fieldsRow = editing ? (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          {visibleIds.map((id, index) => (
            <span key={id} className="inline-flex min-w-0 max-w-full items-center gap-x-1.5 gap-y-1">
              {index > 0 ? <PreviewMetaDot /> : null}
              <SortableMetaSegment id={id} dragAria={dragAria} dragTitle={dragTitle}>
                {renderField(id, false)}
              </SortableMetaSegment>
            </span>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  ) : (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      {visibleIds.map((id, index) => (
        <span key={id} className="inline-flex min-w-0 max-w-full items-center gap-x-1.5 gap-y-1">
          {index > 0 ? <PreviewMetaDot /> : null}
          <MetaSegment onContextMenu={id === 'from' ? onFromContextMenu : undefined}>
            {renderField(id, true)}
          </MetaSegment>
        </span>
      ))}
    </div>
  )

  return (
    <div className="mt-1 space-y-1">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">{fieldsRow}</div>
        <button
          type="button"
          onClick={(): void => setEditing((v) => !v)}
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
            editing
              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
              : 'border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
          )}
          title={editing ? t('mail.readingPane.metaEditDoneTitle') : t('mail.readingPane.metaEditTitle')}
          aria-label={editing ? t('mail.readingPane.metaEditDoneTitle') : t('mail.readingPane.metaEditTitle')}
          aria-pressed={editing}
        >
          {editing ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <Pencil className="h-3 w-3" aria-hidden />
          )}
        </button>
      </div>
      {editing ? (
        <p className="text-2xs text-muted-foreground">{t('mail.readingPane.metaEditHint')}</p>
      ) : null}
    </div>
  )
}
