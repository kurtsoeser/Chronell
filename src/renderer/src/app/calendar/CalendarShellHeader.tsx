import { useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format, getWeek } from 'date-fns'
import { useCollatorLocale, useDateFnsLocale } from '@/lib/date-fns-locale'
import { useTranslation } from 'react-i18next'
import {
  BookMarked,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Video,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderToolbarToggleClass
} from '@/components/ModuleColumnHeader'
import { useCalendarViewMenuPortal } from '@/app/calendar/use-calendar-view-menu-portal'
import { MAX_TIME_GRID_SPAN_DAYS, viewIdToLabel } from '@/app/calendar/calendar-shell-view-helpers'
import type { TimeGridSlotMinutes } from '@/app/calendar/calendar-shell-storage'
import {
  isTimeGridSlotMinutes,
  TIME_GRID_SLOT_MINUTES_OPTIONS
} from '@/app/calendar/calendar-shell-storage'
import { CalendarShellColumnLayoutSection } from '@/components/calendar/CalendarShellColumnLayoutSection'
import {
  CalendarShellColumnHeaderDragSurface,
  calendarColumnHeaderNoDragProps
} from '@/app/calendar/calendar-shell-column-dnd'

export interface CalendarSidebarHiddenRestoreEntry {
  key: string
  accountId: string
  accountLabel: string
  calendarName: string
  /** Kalenderliste noch nicht geladen — Anzeige mit Platzhalter. */
  namePending?: boolean
}

export interface CalendarShellHeaderProps {
  rangeTitle: string
  visibleStart: Date
  viewMenuOpen: boolean
  setViewMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  activeViewId: string
  changeView: (viewId: string) => void
  daysSubOpen: boolean
  setDaysSubOpen: (open: boolean) => void
  settingsSubOpen: boolean
  setSettingsSubOpen: (open: boolean) => void
  /** Kalender, die nur in der Seitenleiste ausgeblendet sind (Wiederherstellung). */
  calendarSidebarHiddenRestoreEntries?: CalendarSidebarHiddenRestoreEntry[]
  onRestoreCalendarToSidebar?: (visibilityKey: string) => void
  /** Tag-/Wochenraster in Minuten (FullCalendar). */
  timeGridSlotMinutes?: TimeGridSlotMinutes
  onTimeGridSlotMinutesChange?: (min: TimeGridSlotMinutes) => void
  onCalendarToday: () => void
  onCalendarPrev: () => void
  onCalendarNext: () => void
  /** Kalender: neuer Termin (Erstellungsdialog). */
  onNewEventClick?: () => void
  /** Kalender: Webinar-Assistent (3 Schritte). */
  onNewWebinarClick?: () => void
  /** Webinar aus Notion (#kurtrocks Events). */
  onNewWebinarFromNotionClick?: () => void
  newEventDisabled?: boolean
  /** .ics-Datei importieren (Dateidialog). */
  onImportIcsClick?: () => void
  /** Aktiver Ereignis-Textfilter (Topbar oder /). */
  eventSearchQuery?: string
  onClearEventSearch?: () => void
  onOpenEventSearch?: () => void
}

export function CalendarShellHeader(props: CalendarShellHeaderProps): JSX.Element {
  const { t } = useTranslation()
  const dateFnsLocale = useDateFnsLocale()
  const {
    rangeTitle,
    visibleStart,
    viewMenuOpen,
    setViewMenuOpen,
    activeViewId,
    changeView,
    daysSubOpen,
    setDaysSubOpen,
    settingsSubOpen,
    setSettingsSubOpen,
    calendarSidebarHiddenRestoreEntries,
    onRestoreCalendarToSidebar,
    timeGridSlotMinutes,
    onTimeGridSlotMinutesChange,
    onCalendarToday,
    onCalendarPrev,
    onCalendarNext,
    onNewEventClick,
    onNewWebinarClick,
    onNewWebinarFromNotionClick,
    newEventDisabled,
    onImportIcsClick,
    eventSearchQuery,
    onClearEventSearch,
    onOpenEventSearch
  } = props

  const eventSearchActive = Boolean(eventSearchQuery?.trim())

  const collatorLocale = useCollatorLocale()
  const sidebarHiddenRestoreGroups = useMemo(() => {
    const entries = calendarSidebarHiddenRestoreEntries ?? []
    if (entries.length === 0) return []
    const byAccount = new Map<
      string,
      { accountLabel: string; items: CalendarSidebarHiddenRestoreEntry[] }
    >()
    for (const e of entries) {
      const existing = byAccount.get(e.accountId)
      if (existing) {
        existing.items.push(e)
      } else {
        byAccount.set(e.accountId, { accountLabel: e.accountLabel, items: [e] })
      }
    }
    return [...byAccount.values()]
      .map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) =>
          a.calendarName.localeCompare(b.calendarName, collatorLocale)
        )
      }))
      .sort((a, b) => a.accountLabel.localeCompare(b.accountLabel, collatorLocale))
  }, [calendarSidebarHiddenRestoreEntries, collatorLocale])

  const weekAnchor =
    visibleStart instanceof Date && !Number.isNaN(visibleStart.getTime())
      ? visibleStart
      : new Date()

  const rangeSubtitle = `${t('calendar.header.weekPrefix')} ${getWeek(weekAnchor, {
    weekStartsOn: 1,
    firstWeekContainsDate: 4
  })} · ${format(weekAnchor, 'MMMM yyyy', { locale: dateFnsLocale })}`

  const weekNavBtnClass = moduleColumnHeaderToolbarToggleClass(false)

  const closeViewMenu = useCallback((): void => {
    setViewMenuOpen(false)
    setDaysSubOpen(false)
    setSettingsSubOpen(false)
  }, [setViewMenuOpen, setDaysSubOpen, setSettingsSubOpen])

  const { btnRef: viewMenuBtnRef, panelRef: viewMenuPanelRef, panelStyle: viewMenuPanelStyle } =
    useCalendarViewMenuPortal(viewMenuOpen, closeViewMenu)

  const viewMenuPanelClass =
    'chronell-acrylic-popover w-max max-w-[calc(100vw-1rem)] py-1 text-popover-foreground shadow-lg'

  const viewMenuPanel =
    viewMenuOpen &&
    createPortal(
      <div
        ref={viewMenuPanelRef}
        className={viewMenuPanelClass}
        style={viewMenuPanelStyle}
        role="menu"
        aria-label={t('calendar.header.viewMenuAria')}
        onMouseDown={(e): void => e.stopPropagation()}
      >
        <ViewMenuRow
          label={t('calendar.views.day')}
          hint="1 oder D"
          active={activeViewId === 'timeGridDay'}
          onPick={(): void => changeView('timeGridDay')}
        />
        <ViewMenuRow
          label={t('calendar.views.week')}
          hint="0 oder W"
          active={activeViewId === 'timeGridWeek'}
          onPick={(): void => changeView('timeGridWeek')}
        />
        <ViewMenuRow
          label={t('calendar.views.month')}
          hint="M"
          active={activeViewId === 'dayGridMonth'}
          onPick={(): void => changeView('dayGridMonth')}
        />
        <ViewMenuRow
          label={t('calendar.views.year')}
          hint="Y"
          active={activeViewId === 'multiMonthYear'}
          onPick={(): void => changeView('multiMonthYear')}
        />
        <ViewMenuRow
          label={t('calendar.views.quarterYear')}
          active={activeViewId === 'multiMonthQuarter'}
          onPick={(): void => changeView('multiMonthQuarter')}
        />
        <ViewMenuRow
          label={t('calendar.views.list')}
          hint="L"
          active={activeViewId === 'listWeek'}
          onPick={(): void => changeView('listWeek')}
        />
        <ViewMenuRow
          label={t('calendar.views.ganttTimeline')}
          active={activeViewId === 'ganttTimeline'}
          onPick={(): void => changeView('ganttTimeline')}
        />
        <div className="my-1 h-px bg-border" />
        <div
          className="relative"
          onMouseEnter={(): void => setDaysSubOpen(true)}
          onMouseLeave={(): void => setDaysSubOpen(false)}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
          >
            <span className="whitespace-nowrap">{t('calendar.header.countDays')}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {daysSubOpen && (
            <div
              className={cn(
                'chronell-acrylic-popover absolute top-0 z-[510] min-w-[140px] py-1 text-popover-foreground shadow-lg',
                'left-full ml-1 max-md:left-0 max-md:ml-0 max-md:mt-1 max-md:max-h-[min(50vh,280px)] max-md:overflow-y-auto'
              )}
            >
              {Array.from({ length: MAX_TIME_GRID_SPAN_DAYS - 1 }, (_, i) => i + 2).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-sm hover:bg-accent',
                    activeViewId === `timeGrid${n}Day` && 'bg-muted'
                  )}
                  onClick={(): void => changeView(`timeGrid${n}Day`)}
                >
                  <span>{t('calendar.header.nDaysMenu', { count: n })}</span>
                  <span className="text-xs text-muted-foreground">{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="my-1 h-px bg-border" />
        <div
          className="relative"
          onMouseEnter={(): void => setSettingsSubOpen(true)}
          onMouseLeave={(): void => setSettingsSubOpen(false)}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
          >
            <span className="whitespace-nowrap">{t('calendar.header.viewSettings')}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {settingsSubOpen && (
            <div
              className={cn(
                'chronell-acrylic-popover absolute top-0 z-[510] flex max-h-[min(72vh,520px)] w-[min(92vw,320px)] flex-col px-3 py-2 text-sm leading-snug text-muted-foreground shadow-lg',
                'left-full ml-1 max-md:left-0 max-md:ml-0 max-md:mt-1'
              )}
            >
              <p className="shrink-0">{t('calendar.header.viewSettingsBody')}</p>
              <CalendarShellColumnLayoutSection />
              {onImportIcsClick != null ? (
                <button
                  type="button"
                  className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-accent"
                  onClick={(): void => {
                    closeViewMenu()
                    onImportIcsClick()
                  }}
                  onMouseDown={(ev): void => ev.stopPropagation()}
                >
                  {t('calendar.header.importIcs')}
                </button>
              ) : null}
              {timeGridSlotMinutes != null && onTimeGridSlotMinutesChange != null ? (
                <div className="mt-2 shrink-0 space-y-1">
                  <label
                    className="block text-xs font-semibold text-foreground"
                    htmlFor="cal-slot-min-select"
                  >
                    {t('calendar.header.slotDurationLabel')}
                  </label>
                  <select
                    id="cal-slot-min-select"
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={timeGridSlotMinutes}
                    onChange={(ev): void => {
                      const n = Number(ev.target.value)
                      if (isTimeGridSlotMinutes(n)) {
                        onTimeGridSlotMinutesChange(n)
                      }
                    }}
                    onMouseDown={(ev): void => ev.stopPropagation()}
                    onClick={(ev): void => ev.stopPropagation()}
                  >
                    {TIME_GRID_SLOT_MINUTES_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {t('calendar.header.slotMinutesOption', { count: m })}
                      </option>
                    ))}
                  </select>
                  <p className="text-2xs leading-snug text-muted-foreground/90">
                    {t('calendar.header.slotDurationShortcuts')}
                  </p>
                </div>
              ) : null}
              {sidebarHiddenRestoreGroups.length > 0 ? (
                <>
                  <div className="my-2 h-px shrink-0 bg-border" />
                  <p className="mb-1.5 shrink-0 text-xs font-semibold text-foreground">
                    {t('calendar.header.sidebarHiddenSectionTitle')}
                  </p>
                  <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
                    {sidebarHiddenRestoreGroups.map((group) => (
                      <li key={group.items[0]?.accountId ?? group.accountLabel}>
                        <p
                          className="truncate px-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
                          title={group.accountLabel}
                        >
                          {group.accountLabel}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {group.items.map((e) => {
                            const label = e.namePending
                              ? t('calendar.header.sidebarHiddenCalendarLoading')
                              : e.calendarName
                            return (
                              <li
                                key={e.key}
                                className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/25 px-2 py-1.5"
                              >
                                <p
                                  className={cn(
                                    'min-w-0 flex-1 truncate text-xs font-medium',
                                    e.namePending ? 'text-muted-foreground italic' : 'text-foreground'
                                  )}
                                  title={label}
                                >
                                  {label}
                                </p>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-md bg-primary/90 px-2 py-1 text-2xs font-medium text-primary-foreground hover:bg-primary"
                                  onClick={(ev): void => {
                                    ev.stopPropagation()
                                    onRestoreCalendarToSidebar?.(e.key)
                                  }}
                                >
                                  {t('calendar.header.sidebarHiddenRestore')}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>,
      document.body
    )

  return (
    <CalendarShellColumnHeaderDragSurface
      as="header"
      className={cn(
        'calendar-shell-dock-column-header relative z-50 min-h-0 w-full border-b-0 px-2'
      )}
    >
      <div
        className={cn(
          moduleColumnHeaderDockBarRowClass,
          'calendar-shell-header-bar min-w-0 !px-0'
        )}
      >
      <div
        className="calendar-shell-header-area-side flex shrink-0 items-center justify-start self-center"
        {...calendarColumnHeaderNoDragProps}
      >
        <ModuleColumnHeaderIconButton
          type="button"
          title={t('calendar.header.today')}
          aria-label={t('calendar.header.today')}
          onClick={onCalendarToday}
          {...calendarColumnHeaderNoDragProps}
        >
          <CalendarCheck2 className={moduleColumnHeaderIconGlyphClass} aria-hidden />
        </ModuleColumnHeaderIconButton>
      </div>

      <div
        className={cn(
          'calendar-shell-header-area-date flex min-h-0 min-w-0 flex-1 items-center justify-center gap-1 self-center sm:gap-2'
        )}
      >
        <>
          <button
            type="button"
            aria-label={t('calendar.header.prevAria')}
            onClick={onCalendarPrev}
            className={weekNavBtnClass}
            {...calendarColumnHeaderNoDragProps}
          >
            <ChevronLeft className={moduleColumnHeaderIconGlyphClass} />
          </button>
          <div
            className="min-w-0 max-w-full flex-1 text-center sm:max-w-[min(100%,28rem)]"
            title={rangeSubtitle}
          >
            <h1 className="chronell-type-calendar-range-title truncate text-foreground">
              {rangeTitle}
            </h1>
            <p className="chronell-type-calendar-range-subtitle truncate text-muted-foreground">
              {rangeSubtitle}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('calendar.header.nextAria')}
            onClick={onCalendarNext}
            className={weekNavBtnClass}
            {...calendarColumnHeaderNoDragProps}
          >
            <ChevronRight className={moduleColumnHeaderIconGlyphClass} />
          </button>
        </>
      </div>

      <div
        className={cn(
          'calendar-shell-header-area-actions flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1 self-center sm:gap-1.5'
        )}
        {...calendarColumnHeaderNoDragProps}
      >
        {onNewEventClick != null ? (
          <button
            type="button"
            disabled={Boolean(newEventDisabled)}
            title={
              newEventDisabled ? t('calendar.shell.noLinkedAccount') : t('calendar.shell.newEvent')
            }
            aria-label={t('calendar.shell.newEvent')}
            onClick={(): void => {
              if (newEventDisabled) return
              onNewEventClick()
            }}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:gap-1.5 sm:px-2.5 sm:text-xs',
              newEventDisabled && 'cursor-not-allowed opacity-45'
            )}
          >
            <Plus className={cn(moduleColumnHeaderIconGlyphClass, 'shrink-0')} />
            <span className="calendar-shell-header-new-event-label">
              {t('calendar.shell.newEvent')}
            </span>
          </button>
        ) : null}
        {onNewWebinarClick != null ? (
          <button
            type="button"
            disabled={Boolean(newEventDisabled)}
            title={
              newEventDisabled
                ? t('calendar.shell.noLinkedAccount')
                : t('calendar.shell.newWebinar')
            }
            aria-label={t('calendar.shell.newWebinar')}
            onClick={(): void => {
              if (newEventDisabled) return
              onNewWebinarClick()
            }}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-secondary',
              newEventDisabled && 'cursor-not-allowed opacity-45'
            )}
          >
            <Video className={cn(moduleColumnHeaderIconGlyphClass, 'shrink-0 text-blue-500')} />
          </button>
        ) : null}
        {onNewWebinarFromNotionClick != null ? (
          <button
            type="button"
            disabled={Boolean(newEventDisabled)}
            title={
              newEventDisabled
                ? t('calendar.shell.noLinkedAccount')
                : t('calendar.shell.newWebinarFromNotion')
            }
            aria-label={t('calendar.shell.newWebinarFromNotion')}
            onClick={(): void => {
              if (newEventDisabled) return
              onNewWebinarFromNotionClick()
            }}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-secondary',
              newEventDisabled && 'cursor-not-allowed opacity-45'
            )}
          >
            <BookMarked className={cn(moduleColumnHeaderIconGlyphClass, 'shrink-0 text-amber-500')} />
          </button>
        ) : null}

        {eventSearchActive ? (
          <div className="flex min-w-0 max-w-[14rem] items-center gap-1 rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-xs text-foreground">
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 hover:text-foreground"
              onClick={onOpenEventSearch}
              title={t('calendar.shell.eventSearchTitle')}
            >
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate">{eventSearchQuery!.trim()}</span>
            </button>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={onClearEventSearch}
              title={t('calendar.shell.eventSearchClear')}
              aria-label={t('calendar.shell.eventSearchClear')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        <button
          ref={viewMenuBtnRef}
          type="button"
          aria-expanded={viewMenuOpen}
          aria-haspopup="menu"
          onClick={(e): void => {
            e.stopPropagation()
            setViewMenuOpen((o) => !o)
          }}
          {...calendarColumnHeaderNoDragProps}
          className="flex max-w-[7.5rem] shrink-0 items-center gap-1 rounded-md border border-border bg-secondary py-1 pl-1.5 pr-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 sm:max-w-none sm:gap-1.5 sm:px-2 sm:text-xs"
        >
          <span className="min-w-0 truncate">{viewIdToLabel(activeViewId, t)}</span>
          <ChevronDown
            className={cn(
              moduleColumnHeaderIconGlyphClass,
              'shrink-0 text-muted-foreground',
              viewMenuOpen && 'rotate-180'
            )}
          />
        </button>
      </div>
      </div>
      {viewMenuPanel}
    </CalendarShellColumnHeaderDragSurface>
  )
}

function ViewMenuRow({
  label,
  hint,
  active,
  onPick
}: {
  label: string
  hint?: string
  active: boolean
  onPick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-3 px-2.5 py-1.5 text-left text-sm hover:bg-accent',
        active && 'bg-muted'
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {active ? (
          <span className="w-3 shrink-0 text-center text-foreground">✓</span>
        ) : (
          <span className="w-3 shrink-0" aria-hidden />
        )}
        <span className="whitespace-nowrap">{label}</span>
      </span>
      {hint ? (
        <span className="ml-auto shrink-0 pl-2 text-2xs tabular-nums text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </button>
  )
}
