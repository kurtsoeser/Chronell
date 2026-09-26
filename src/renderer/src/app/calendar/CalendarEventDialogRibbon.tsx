import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  Check,
  CircleDot,
  ExternalLink,
  LayoutTemplate,
  Loader2,
  Lock,
  NotebookPen,
  Plus,
  Repeat2,
  Sparkles,
  Tag,
  Video
} from 'lucide-react'
import type { CalendarEventShowAs } from '@shared/types'
import { CALENDAR_EVENT_SHOW_AS_OPTIONS } from '@shared/calendar-event-status'
import {
  formatOutlookReminderMinutes,
  OUTLOOK_REMINDER_MINUTES_OPTIONS
} from '@/lib/calendar-event-reminder-options'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import { cn } from '@/lib/utils'
import {
  useCalendarEventDialogJoinUrl,
  type CalendarEventDialogJoinUrlStore
} from '@/app/calendar/calendar-event-dialog-join-url-store'
import { voidOpenExternalUrl } from '@/lib/open-external'

type RecurrenceUiFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly'

export type CalendarEventRibbonTemplate = {
  id: string
  name: string
  emoji?: string
  teamsMeeting?: boolean
}

type RibbonMenuOption = {
  value: string
  label: string
}

function RibbonSep(): JSX.Element {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
}

function RibbonMenu({
  value,
  disabled,
  onChange,
  ariaLabel,
  title,
  icon,
  options,
  active
}: {
  value: string
  disabled?: boolean
  onChange: (v: string) => void
  ariaLabel: string
  title?: string
  icon: ReactNode
  options: RibbonMenuOption[]
  active?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? options[0],
    [options, value]
  )

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent): void {
      const el = wrapRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return (): void => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        title={selected ? `${title ?? ariaLabel}: ${selected.label}` : title ?? ariaLabel}
        aria-label={
          selected ? `${ariaLabel}: ${selected.label}` : ariaLabel
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={(): void => setOpen((p) => !p)}
        className={cn(
          'inline-flex items-center justify-center rounded-md border p-1.5 transition-colors',
          active || open
            ? 'border-primary/40 bg-primary/10 text-foreground'
            : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        <span className="shrink-0">{icon}</span>
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-[calc(100%+4px)] z-40 max-h-64 min-w-[12rem] overflow-y-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={(): void => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors',
                  isSelected
                    ? 'bg-primary/15 font-medium text-foreground'
                    : 'text-foreground hover:bg-secondary'
                )}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isSelected ? 'text-primary opacity-100' : 'opacity-0'
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function RibbonJoinTeamsButton({
  store,
  locked
}: {
  store: CalendarEventDialogJoinUrlStore
  locked: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  const joinUrl = useCalendarEventDialogJoinUrl(store)
  if (!joinUrl?.trim()) return null
  return (
    <button
      type="button"
      disabled={locked}
      title={t('calendar.eventDialog.joinTeamsShort')}
      aria-label={t('calendar.eventDialog.joinTeamsShort')}
      onClick={(): void => {
        voidOpenExternalUrl(joinUrl.trim())
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground',
        locked && 'pointer-events-none opacity-50'
      )}
    >
      <Video className="h-3.5 w-3.5 text-blue-500" />
    </button>
  )
}

export const CalendarEventDialogRibbon = memo(function CalendarEventDialogRibbon({
  disabled,
  eventFieldsLocked,
  showRecurrence,
  recurFreq,
  onRecurFreqChange,
  onOpenRecurrenceDetails,
  eventShowAs,
  onShowAsChange,
  reminderEnabled,
  reminderMinutesBefore,
  onReminderChange,
  eventIsPrivate,
  onPrivateChange,
  categoryNames,
  selectedCategories,
  categoryColorByName,
  categoriesLoading,
  onCategoryPick,
  templates,
  onApplyTemplate,
  onSaveAsTemplate,
  onTemplatesMenuOpen,
  onNotion,
  notionDisabled,
  onOpenInOutlook,
  onJoinTeams,
  joinUrlStore,
  onCopilot,
  copilotAvailable,
  embedded
}: {
  disabled?: boolean
  eventFieldsLocked?: boolean
  showRecurrence?: boolean
  recurFreq: RecurrenceUiFrequency
  onRecurFreqChange: (v: RecurrenceUiFrequency) => void
  onOpenRecurrenceDetails?: () => void
  eventShowAs: CalendarEventShowAs
  onShowAsChange: (v: CalendarEventShowAs) => void
  reminderEnabled: boolean
  reminderMinutesBefore: number
  onReminderChange: (enabled: boolean, minutes: number) => void
  eventIsPrivate: boolean
  onPrivateChange: (v: boolean) => void
  categoryNames?: string[]
  selectedCategories?: string[]
  categoryColorByName?: Map<string, string>
  categoriesLoading?: boolean
  onCategoryPick?: (name: string, multi: boolean) => void
  templates?: CalendarEventRibbonTemplate[]
  onApplyTemplate?: (id: string) => void
  onSaveAsTemplate?: () => void
  onTemplatesMenuOpen?: () => void
  onNotion?: () => void
  notionDisabled?: boolean
  onOpenInOutlook?: () => void
  onJoinTeams?: () => void
  /** Bevorzugt: Join-Button abonniert Store ohne Parent-Re-Render. */
  joinUrlStore?: CalendarEventDialogJoinUrlStore
  onCopilot?: () => void
  copilotAvailable?: boolean
  embedded?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const locked = disabled || eventFieldsLocked
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const templatesWrapRef = useRef<HTMLDivElement | null>(null)
  const categoriesWrapRef = useRef<HTMLDivElement | null>(null)
  const templateList = templates ?? []
  const showApplyTemplates = Boolean(onApplyTemplate && templateList.length > 0)
  const showCategories = Boolean(onCategoryPick)
  const selectedCats = selectedCategories ?? []
  const catNames = categoryNames ?? []
  const catColors = categoryColorByName ?? new Map<string, string>()

  const recurrenceOptions = useMemo(
    (): RibbonMenuOption[] => [
      { value: 'none', label: t('calendar.eventDialog.recurrenceFreqNone') },
      { value: 'daily', label: t('calendar.eventDialog.recurrenceFreqDaily') },
      { value: 'weekly', label: t('calendar.eventDialog.recurrenceFreqWeekly') },
      { value: 'biweekly', label: t('calendar.eventDialog.recurrenceFreqBiweekly') },
      { value: 'monthly', label: t('calendar.eventDialog.recurrenceFreqMonthly') },
      { value: 'yearly', label: t('calendar.eventDialog.recurrenceFreqYearly') }
    ],
    [t]
  )

  const showAsOptions = useMemo(
    (): RibbonMenuOption[] =>
      CALENDAR_EVENT_SHOW_AS_OPTIONS.map((opt) => ({
        value: opt,
        label: t(`calendar.eventDialog.statusShowAs.${opt}`)
      })),
    [t]
  )

  const reminderOptions = useMemo(
    (): RibbonMenuOption[] => [
      { value: 'none', label: t('calendar.eventDialog.reminderNone') },
      ...OUTLOOK_REMINDER_MINUTES_OPTIONS.map((m) => ({
        value: String(m),
        label: formatOutlookReminderMinutes(m, t)
      }))
    ],
    [t]
  )

  useEffect(() => {
    if (!templatesOpen) return
    function onDocDown(e: MouseEvent): void {
      const el = templatesWrapRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      setTemplatesOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return (): void => document.removeEventListener('mousedown', onDocDown)
  }, [templatesOpen])

  useEffect(() => {
    if (!categoriesOpen) return
    function onDocDown(e: MouseEvent): void {
      const el = categoriesWrapRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      setCategoriesOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setCategoriesOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return (): void => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [categoriesOpen])

  const categoriesTitle =
    selectedCats.length > 0
      ? `${t('calendar.eventDialog.categories')}: ${selectedCats.join(', ')}`
      : t('calendar.eventDialog.categoriesPickerAria')

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-0.5',
        embedded
          ? 'flex-1'
          : 'shrink-0 border-b border-border bg-secondary/10 px-3 py-1.5'
      )}
      role="toolbar"
      aria-label={t('calendar.eventDialog.ribbonAria')}
    >
      {showRecurrence ? (
        <>
          <RibbonMenu
            value={recurFreq}
            disabled={locked}
            active={recurFreq !== 'none'}
            ariaLabel={t('calendar.eventDialog.recurrenceHeading')}
            title={t('calendar.eventDialog.recurrenceHeading')}
            icon={<Repeat2 className="h-3.5 w-3.5" />}
            options={recurrenceOptions}
            onChange={(v): void => {
              const next = v as RecurrenceUiFrequency
              onRecurFreqChange(next)
              if (next !== 'none') onOpenRecurrenceDetails?.()
            }}
          />
          <RibbonSep />
        </>
      ) : null}

      <RibbonMenu
        value={eventShowAs}
        disabled={locked}
        ariaLabel={t('calendar.eventDialog.statusShowAsAria')}
        title={t('calendar.eventDialog.statusHeading')}
        icon={<CircleDot className="h-3.5 w-3.5" />}
        options={showAsOptions}
        onChange={(v): void => {
          if (
            v === 'free' ||
            v === 'tentative' ||
            v === 'busy' ||
            v === 'oof' ||
            v === 'workingElsewhere'
          ) {
            onShowAsChange(v)
          }
        }}
      />

      <RibbonMenu
        value={reminderEnabled ? String(reminderMinutesBefore) : 'none'}
        disabled={locked}
        active={reminderEnabled}
        ariaLabel={t('calendar.eventDialog.reminderHeading')}
        title={t('calendar.eventDialog.reminderHeading')}
        icon={<Bell className="h-3.5 w-3.5" />}
        options={reminderOptions}
        onChange={(v): void => {
          if (v === 'none') {
            onReminderChange(false, reminderMinutesBefore)
            return
          }
          onReminderChange(true, Math.max(0, Math.round(Number(v) || 0)))
        }}
      />

      <button
        type="button"
        disabled={locked}
        title={t('calendar.eventDialog.statusPrivate')}
        aria-label={t('calendar.eventDialog.statusPrivate')}
        aria-pressed={eventIsPrivate}
        onClick={(): void => onPrivateChange(!eventIsPrivate)}
        className={cn(
          'inline-flex items-center justify-center rounded-md border p-1.5 transition-colors',
          eventIsPrivate
            ? 'border-primary/40 bg-primary/10 text-foreground'
            : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground',
          locked && 'pointer-events-none opacity-50'
        )}
      >
        <Lock className="h-3.5 w-3.5" />
      </button>

      {showCategories ? (
        <div className="relative" ref={categoriesWrapRef}>
          <button
            type="button"
            disabled={locked}
            title={categoriesTitle}
            aria-label={categoriesTitle}
            aria-expanded={categoriesOpen}
            aria-haspopup="listbox"
            onClick={(): void => {
              setTemplatesOpen(false)
              setCategoriesOpen((p) => !p)
            }}
            className={cn(
              'relative inline-flex items-center justify-center rounded-md border p-1.5 transition-colors',
              selectedCats.length > 0 || categoriesOpen
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground',
              locked && 'pointer-events-none opacity-50'
            )}
          >
            {categoriesLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Tag className="h-3.5 w-3.5" aria-hidden />
            )}
            {selectedCats.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold leading-none text-primary-foreground">
                {selectedCats.length > 9 ? '9+' : selectedCats.length}
              </span>
            ) : null}
          </button>
          {categoriesOpen ? (
            <div
              role="listbox"
              aria-multiselectable
              aria-label={t('calendar.eventDialog.categories')}
              className="absolute left-0 top-[calc(100%+4px)] z-40 max-h-72 min-w-[14rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
            >
              {categoriesLoading && catNames.length === 0 ? (
                <p className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('calendar.eventDialog.loadingShort')}
                </p>
              ) : catNames.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  {t('calendar.eventDialog.categoriesEmptyOutlook')}
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto py-1">
                  {catNames.map((name) => {
                    const on = selectedCats.includes(name)
                    const dotClass = outlookCategoryDotClass(catColors.get(name))
                    return (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        aria-selected={on}
                        disabled={locked}
                        onClick={(e): void => {
                          const multi = e.ctrlKey || e.metaKey
                          onCategoryPick?.(name, multi)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors',
                          on
                            ? 'bg-primary/15 font-medium text-foreground'
                            : 'text-foreground hover:bg-secondary'
                        )}
                      >
                        <Check
                          className={cn(
                            'h-3.5 w-3.5 shrink-0',
                            on ? 'text-primary opacity-100' : 'opacity-0'
                          )}
                          aria-hidden
                        />
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="border-t border-border px-3 py-1.5 text-2xs text-muted-foreground">
                {t('calendar.eventDialog.ribbonCategoriesMultiHint')}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <RibbonSep />

      {showApplyTemplates || onSaveAsTemplate ? (
        <div className="relative" ref={templatesWrapRef}>
          <button
            type="button"
            disabled={locked}
            title={t('calendar.eventDialog.ribbonTemplates')}
            aria-label={t('calendar.eventDialog.ribbonTemplates')}
            aria-expanded={templatesOpen}
            aria-haspopup="menu"
            onClick={(): void => {
              setCategoriesOpen(false)
              const next = !templatesOpen
              if (next) onTemplatesMenuOpen?.()
              setTemplatesOpen(next)
            }}
            className={cn(
              'inline-flex items-center justify-center rounded-md border p-1.5 transition-colors',
              templatesOpen
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground',
              locked && 'pointer-events-none opacity-50'
            )}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
          </button>
          {templatesOpen ? (
            <div
              role="menu"
              className="absolute left-0 top-[calc(100%+4px)] z-40 min-w-[220px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
            >
              {showApplyTemplates ? (
                <>
                  <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('calendar.eventDialog.applyTemplateTitle')}
                  </p>
                  <div className="max-h-56 overflow-y-auto">
                    {templateList.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        role="menuitem"
                        onClick={(): void => {
                          onApplyTemplate?.(tpl.id)
                          setTemplatesOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <span className="shrink-0 text-base leading-none">{tpl.emoji || '📅'}</span>
                        <span className="min-w-0 flex-1 truncate">{tpl.name}</span>
                        {tpl.teamsMeeting ? (
                          <Video className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {t('calendar.eventDialog.ribbonTemplatesEmpty')}
                </p>
              )}
              {onSaveAsTemplate ? (
                <div className={cn(showApplyTemplates && 'border-t border-border')}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={locked}
                    onClick={(): void => {
                      setTemplatesOpen(false)
                      onSaveAsTemplate()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {t('calendar.eventDialog.saveAsTemplateBtn')}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {onNotion ? (
        <button
          type="button"
          disabled={notionDisabled || locked}
          title={t('calendar.eventDialog.ribbonNotion')}
          aria-label={t('calendar.eventDialog.ribbonNotion')}
          onClick={onNotion}
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground',
            (notionDisabled || locked) && 'pointer-events-none opacity-50'
          )}
        >
          <NotebookPen className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {onOpenInOutlook ? (
        <button
          type="button"
          disabled={locked}
          title={t('calendar.eventDialog.openInOutlook')}
          aria-label={t('calendar.eventDialog.openInOutlook')}
          onClick={onOpenInOutlook}
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground',
            locked && 'pointer-events-none opacity-50'
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {joinUrlStore ? (
        <RibbonJoinTeamsButton store={joinUrlStore} locked={!!locked} />
      ) : onJoinTeams ? (
        <button
          type="button"
          disabled={locked}
          title={t('calendar.eventDialog.joinTeamsShort')}
          aria-label={t('calendar.eventDialog.joinTeamsShort')}
          onClick={onJoinTeams}
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground',
            locked && 'pointer-events-none opacity-50'
          )}
        >
          <Video className="h-3.5 w-3.5 text-blue-500" />
        </button>
      ) : null}

      {onCopilot && copilotAvailable ? (
        <button
          type="button"
          disabled={locked}
          title={t('calendar.eventDialog.ribbonCopilot')}
          aria-label={t('calendar.eventDialog.ribbonCopilot')}
          onClick={onCopilot}
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-primary/30 bg-primary/5 p-1.5 text-foreground transition-colors hover:bg-primary/10',
            locked && 'pointer-events-none opacity-50'
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </button>
      ) : null}
    </div>
  )
})
