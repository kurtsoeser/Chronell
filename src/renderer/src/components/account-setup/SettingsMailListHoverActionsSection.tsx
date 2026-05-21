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
  Archive,
  CheckSquare,
  Clock,
  Forward,
  GripVertical,
  Mail,
  MailOpen,
  MousePointerClick,
  PictureInPicture2,
  Reply,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react'
import { resolveQuickStepHoverIcon } from '@/lib/mail-quickstep-hover-icon'
import { useTranslation } from 'react-i18next'
import type { MailQuickStep } from '@shared/types'
import { cn } from '@/lib/utils'
import { isMailClientRuntimeComplete } from '@/lib/mail-client-runtime'
import {
  MAIL_LIST_HOVER_BUILTIN_ACTION_IDS,
  MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT,
  applyMailListHoverActionPrefs,
  mailListHoverQuickStepId,
  parseMailListHoverActionId,
  readMailListHoverActionPrefs,
  reconcileMailListHoverActionOrder,
  resetMailListHoverActionPrefs,
  type MailListHoverActionId,
  type MailListHoverBuiltinActionId
} from '@/lib/mail-list-hover-actions'

const BUILTIN_META: Record<
  MailListHoverBuiltinActionId,
  { icon: React.ComponentType<{ className?: string }>; labelKey: string }
> = {
  reply: { icon: Reply, labelKey: 'mail.list.rowReplyTitle' },
  flag: { icon: Star, labelKey: 'settings.mailListHover.builtin.flag' },
  archive: { icon: Archive, labelKey: 'mail.list.archiveTitle' },
  delete: { icon: Trash2, labelKey: 'mail.list.deleteTitle' },
  popout: { icon: PictureInPicture2, labelKey: 'mail.list.rowPopoutTitle' },
  forward: { icon: Forward, labelKey: 'settings.mailListHover.builtin.forward' },
  snooze: { icon: Clock, labelKey: 'settings.mailListHover.builtin.snooze' },
  markRead: { icon: MailOpen, labelKey: 'settings.mailListHover.builtin.markRead' },
  markUnread: { icon: Mail, labelKey: 'settings.mailListHover.builtin.markUnread' },
  todo: { icon: CheckSquare, labelKey: 'settings.mailListHover.builtin.todo' }
}

function SortableHoverActionRow({
  id,
  label,
  icon: Icon,
  visible,
  onToggleVisible,
  dragAria,
  dragTitle
}: {
  id: MailListHoverActionId
  label: string
  icon: React.ComponentType<{ className?: string }>
  visible: boolean
  onToggleVisible: (id: MailListHoverActionId, next: boolean) => void
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
        'flex items-center gap-2 rounded-md border border-border/35 bg-background px-2 py-1.5',
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
      <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
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

export function SettingsMailListHoverActionsSection(): JSX.Element {
  const { t } = useTranslation()
  const [quickSteps, setQuickSteps] = useState<MailQuickStep[]>([])
  const [order, setOrder] = useState<MailListHoverActionId[]>([])
  const [hidden, setHidden] = useState<Set<MailListHoverActionId>>(() => new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    if (!isMailClientRuntimeComplete()) return
    void window.mailClient.mail
      .listQuickSteps()
      .then(setQuickSteps)
      .catch(() => setQuickSteps([]))
  }, [])

  useEffect(() => {
    const prefs = readMailListHoverActionPrefs(quickSteps)
    setOrder(prefs.order)
    setHidden(prefs.hidden)
  }, [quickSteps])

  useEffect(() => {
    const onChanged = (): void => {
      const prefs = readMailListHoverActionPrefs(quickSteps)
      setOrder(prefs.order)
      setHidden(prefs.hidden)
    }
    window.addEventListener(MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT, onChanged)
  }, [quickSteps])

  const persist = useCallback(
    (nextOrder: MailListHoverActionId[], nextHidden: Set<MailListHoverActionId>) => {
      const reconciled = reconcileMailListHoverActionOrder(nextOrder, quickSteps)
      setOrder(reconciled)
      setHidden(nextHidden)
      applyMailListHoverActionPrefs(reconciled, nextHidden, quickSteps)
    },
    [quickSteps]
  )

  const rows = useMemo(() => {
    return order
      .map((id) => {
        if (id.startsWith('quickstep:')) {
          const qid = Number.parseInt(id.slice('quickstep:'.length), 10)
          const qs = quickSteps.find((q) => q.id === qid)
          if (!qs) return null
          return {
            id,
            label: qs.name,
            icon: resolveQuickStepHoverIcon(qs)
          }
        }
        const builtin = id as MailListHoverBuiltinActionId
        const meta = BUILTIN_META[builtin]
        if (!meta) return null
        return { id, label: t(meta.labelKey), icon: meta.icon }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
  }, [order, quickSteps, t])

  const onDragEnd = useCallback(
    (e: DragEndEvent): void => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIndex = order.indexOf(active.id as MailListHoverActionId)
      const newIndex = order.indexOf(over.id as MailListHoverActionId)
      if (oldIndex < 0 || newIndex < 0) return
      persist(arrayMove(order, oldIndex, newIndex), hidden)
    },
    [hidden, order, persist]
  )

  const onToggleVisible = useCallback(
    (id: MailListHoverActionId, nextVisible: boolean): void => {
      const nextHidden = new Set(hidden)
      if (nextVisible) nextHidden.delete(id)
      else nextHidden.add(id)
      persist(order, nextHidden)
    },
    [hidden, order, persist]
  )

  const addQuickStep = useCallback(
    (quickStepId: number): void => {
      const ref = mailListHoverQuickStepId(quickStepId)
      if (order.includes(ref)) {
        const nextHidden = new Set(hidden)
        nextHidden.delete(ref)
        persist(order, nextHidden)
        return
      }
      persist([...order, ref], hidden)
    },
    [hidden, order, persist]
  )

  const availableQuickSteps = useMemo(
    () => quickSteps.filter((q) => !order.includes(mailListHoverQuickStepId(q.id))),
    [order, quickSteps]
  )

  const dragAria = t('settings.mailListHover.dragAria')
  const dragTitle = t('settings.mailListHover.dragTitle')

  return (
    <section className="space-y-3 rounded-md border border-border/35 bg-muted/20 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
        {t('settings.mailListHover.heading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.mailListHover.intro')}</p>
      <p className="text-[10px] leading-relaxed text-muted-foreground">{t('settings.mailListHover.orderHint')}</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {rows.map(({ id, label, icon }) => (
              <SortableHoverActionRow
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

      {availableQuickSteps.length > 0 ? (
        <QuickStepAddButtons
          quickSteps={availableQuickSteps}
          onAdd={addQuickStep}
          label={t('settings.mailListHover.addQuickStep')}
        />
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={(): void => resetMailListHoverActionPrefs(quickSteps)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary/60"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          {t('settings.mailListHover.reset')}
        </button>
      </div>
    </section>
  )
}

function QuickStepAddButtons({
  quickSteps,
  onAdd,
  label
}: {
  quickSteps: MailQuickStep[]
  onAdd: (id: number) => void
  label: string
}): JSX.Element {
  return (
    <div className="space-y-1.5 border-t border-border/30 pt-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {quickSteps.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={(): void => onAdd(q.id)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:bg-secondary/40 hover:text-foreground"
          >
            {(() => {
              const Icon = resolveQuickStepHoverIcon(q)
              return <Icon className="h-3 w-3 shrink-0" aria-hidden />
            })()}
            {q.name}
          </button>
        ))}
      </div>
    </div>
  )
}
