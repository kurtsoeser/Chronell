import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, CheckSquare, Clock, FolderInput, Mail, MailOpen, Star, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuRow } from '@/components/list-view-menu-parts'
import { useAnchoredListViewMenu } from '@/hooks/useAnchoredListViewMenu'
import {
  moduleColumnHeaderIconButtonClass,
  moduleColumnHeaderIconGlyphClass
} from '@/components/ModuleColumnHeader'
import { createPortal } from 'react-dom'
import type { MailListItem, TodoDueKindOpen } from '@shared/types'
import type { MailListKind } from '@/stores/mail'

const TODO_BUCKETS: TodoDueKindOpen[] = ['today', 'tomorrow', 'this_week', 'later']

interface Props {
  selectedCount: number
  selectedMessages: MailListItem[]
  listKind: MailListKind
  onClear: () => void
  onArchive: () => void
  onDelete: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onToggleFlag: () => void
  onMove: () => void
  onTodo: (dueKind: TodoDueKindOpen) => void
  onSnooze: (anchor: { x: number; y: number }) => void
}

function BulkIconButton({
  title,
  onClick,
  disabled,
  destructive,
  children
}: {
  title: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  destructive?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        moduleColumnHeaderIconButtonClass,
        destructive && 'hover:text-destructive',
        'disabled:pointer-events-none disabled:opacity-35'
      )}
    >
      {children}
    </button>
  )
}

function BulkToolbarDivider(): JSX.Element {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border/50" aria-hidden />
}

export function MailListBulkActionBar({
  selectedCount,
  selectedMessages,
  listKind,
  onClear,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleFlag,
  onMove,
  onTodo,
  onSnooze
}: Props): JSX.Element {
  const { t } = useTranslation()
  const { open: todoOpen, setOpen: setTodoOpen, btnRef: todoBtnRef, panelRef: todoPanelRef, panelStyle: todoPanelStyle } =
    useAnchoredListViewMenu()

  const anyUnread = selectedMessages.some((m) => !m.isRead)
  const allFlagged =
    selectedMessages.length > 0 && selectedMessages.every((m) => m.isFlagged)
  const singleAccount =
    selectedMessages.length > 0 &&
    selectedMessages.every((m) => m.accountId === selectedMessages[0]!.accountId)

  const flagTitle = allFlagged
    ? t('mail.list.starRemoveBulk', { count: selectedCount })
    : t('mail.list.starAddBulk', { count: selectedCount })

  const readTitle = anyUnread
    ? t('mail.list.markReadBulk', { count: selectedCount })
    : t('mail.list.markUnreadBulk', { count: selectedCount })

  const handleReadClick = useCallback((): void => {
    if (anyUnread) onMarkRead()
    else onMarkUnread()
  }, [anyUnread, onMarkRead, onMarkUnread])

  const deleteTitle =
    listKind === 'todo'
      ? t('mail.bulk.removeTodo', { count: selectedCount })
      : t('mail.bulk.delete', { count: selectedCount })

  const archiveDisabled = listKind === 'todo'

  const todoMenu = useMemo(
    () =>
      todoOpen
        ? createPortal(
            <div
              ref={todoPanelRef}
              role="menu"
              className="z-[200] min-w-[10rem] rounded-md border border-border bg-popover py-1 shadow-lg"
              style={todoPanelStyle}
            >
              {TODO_BUCKETS.map((kind) => (
                <MenuRow
                  key={kind}
                  onPick={(): void => {
                    setTodoOpen(false)
                    onTodo(kind)
                  }}
                >
                  {t(`mail.todoViewTitle.${kind}`)}
                </MenuRow>
              ))}
            </div>,
            document.body
          )
        : null,
    [todoOpen, todoPanelRef, todoPanelStyle, onTodo, setTodoOpen, t]
  )

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 border-b border-border/40 px-2 py-1"
      role="toolbar"
      aria-label={t('mail.bulk.toolbarAria', { count: selectedCount })}
    >
      <span
        className="mr-1 shrink-0 text-[11px] tabular-nums text-muted-foreground"
        title={t('mail.list.selectionHint')}
      >
        {t('mail.bulk.selected', { count: selectedCount })}
      </span>
      <BulkToolbarDivider />
      <BulkIconButton title={readTitle} onClick={handleReadClick} disabled={selectedCount === 0}>
        {anyUnread ? (
          <MailOpen className={moduleColumnHeaderIconGlyphClass} />
        ) : (
          <Mail className={moduleColumnHeaderIconGlyphClass} />
        )}
      </BulkIconButton>
      <BulkIconButton title={flagTitle} onClick={onToggleFlag} disabled={selectedCount === 0}>
        <Star
          className={cn(
            moduleColumnHeaderIconGlyphClass,
            allFlagged && 'fill-status-flagged text-status-flagged'
          )}
        />
      </BulkIconButton>
      <BulkIconButton
        title={t('mail.list.archiveTitleBulk', { count: selectedCount })}
        onClick={onArchive}
        disabled={archiveDisabled || selectedCount === 0}
      >
        <Archive className={moduleColumnHeaderIconGlyphClass} />
      </BulkIconButton>
      <BulkIconButton
        title={deleteTitle}
        onClick={onDelete}
        disabled={selectedCount === 0}
        destructive
      >
        <Trash2 className={moduleColumnHeaderIconGlyphClass} />
      </BulkIconButton>
      <BulkToolbarDivider />
      <BulkIconButton
        title={t('mail.bulk.move')}
        onClick={onMove}
        disabled={!singleAccount || selectedCount === 0}
      >
        <FolderInput className={moduleColumnHeaderIconGlyphClass} />
      </BulkIconButton>
      <div className="relative">
        <button
          ref={todoBtnRef}
          type="button"
          title={t('mail.bulk.todoMenu')}
          aria-label={t('mail.bulk.todoMenu')}
          aria-expanded={todoOpen}
          aria-haspopup="menu"
          disabled={selectedCount === 0}
          onClick={(): void => setTodoOpen((o) => !o)}
          className={cn(
            moduleColumnHeaderIconButtonClass,
            todoOpen && 'bg-muted/50 text-foreground',
            'disabled:pointer-events-none disabled:opacity-35'
          )}
        >
          <CheckSquare className={moduleColumnHeaderIconGlyphClass} />
        </button>
        {todoMenu}
      </div>
      <BulkIconButton
        title={t('mail.bulk.snooze')}
        onClick={(e): void => onSnooze({ x: e.clientX, y: e.clientY })}
        disabled={selectedCount === 0}
      >
        <Clock className={moduleColumnHeaderIconGlyphClass} />
      </BulkIconButton>
      <span className="flex-1" />
      <BulkIconButton title={t('mail.bulk.clearSelection')} onClick={onClear}>
        <X className={moduleColumnHeaderIconGlyphClass} />
      </BulkIconButton>
    </div>
  )
}
