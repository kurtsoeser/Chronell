import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar1,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  NotebookPen,
  PanelRightClose,
  SquareArrowOutUpRight,
  UserRound
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderActionsClass,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderUppercaseLabelClass
} from '@/components/ModuleColumnHeader'
import { InboxCalendarSidebar } from '@/app/layout/InboxCalendarSidebar'
import { MailRightSidebarDashboard } from '@/app/layout/mail-right-sidebar/MailRightSidebarDashboard'
import { MailCalendarDaySidebar, type MailCalendarSidebarTodayHeaderState } from '@/app/layout/mail-right-sidebar/MailCalendarDaySidebar'
import { MailCalendarDayViewModeToggle } from '@/app/layout/mail-right-sidebar/MailCalendarDayViewModeToggle'
import { MailCalendarGoToTodayIconButton } from '@/app/layout/mail-right-sidebar/MailCalendarGoToTodayIconButton'
import {
  readMailCalendarSidebarViewMode,
  writeMailCalendarSidebarViewMode,
  type MailCalendarSidebarViewMode
} from '@/app/layout/mail-right-sidebar/mail-right-sidebar-calendar-view-mode'
import { MailContactDetailsSidebar } from '@/app/layout/mail-right-sidebar/MailContactDetailsSidebar'
import { MailTasksSidebar } from '@/app/layout/mail-right-sidebar/MailTasksSidebar'
import { MailNotesSidebar } from '@/app/layout/mail-right-sidebar/MailNotesSidebar'

export type MailRightSidebarTab =
  | 'dashboard'
  | 'agenda'
  | 'day'
  | 'contact'
  | 'tasks'
  | 'notes'

const K_ACTIVE_TAB = 'mailclient.mailRightSidebar.activeTab'

function readActiveTab(): MailRightSidebarTab {
  try {
    const v = window.localStorage.getItem(K_ACTIVE_TAB)
    if (
      v === 'dashboard' ||
      v === 'agenda' ||
      v === 'day' ||
      v === 'contact' ||
      v === 'tasks' ||
      v === 'notes'
    ) {
      return v
    }
  } catch {
    // ignore
  }
  return 'agenda'
}

function writeActiveTab(tab: MailRightSidebarTab): void {
  try {
    window.localStorage.setItem(K_ACTIVE_TAB, tab)
  } catch {
    // ignore
  }
}

export type MailRightSidebarProps = {
  hideChrome?: boolean
  onRequestUndock?: () => void
  onRequestClose?: () => void
}

export function MailRightSidebar({
  hideChrome = false,
  onRequestUndock,
  onRequestClose
}: MailRightSidebarProps = {}): JSX.Element {
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<MailRightSidebarTab>(() => readActiveTab())
  const [dayViewMode, setDayViewMode] = useState<MailCalendarSidebarViewMode>(() =>
    readMailCalendarSidebarViewMode()
  )
  const [dayTodayHeaderState, setDayTodayHeaderState] =
    useState<MailCalendarSidebarTodayHeaderState | null>(null)
  const [mountedTabs, setMountedTabs] = useState<Set<MailRightSidebarTab>>(
    () => new Set([readActiveTab()])
  )
  useEffect(() => {
    writeActiveTab(activeTab)
  }, [activeTab])
  useEffect(() => {
    writeMailCalendarSidebarViewMode(dayViewMode)
  }, [dayViewMode])
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  const tabs = useMemo(
    () =>
      [
        {
          id: 'dashboard' as const,
          icon: LayoutDashboard,
          label: t('mail.rightSidebar.tabs.dashboard')
        },
        {
          id: 'agenda' as const,
          icon: CalendarDays,
          label: t('mail.rightSidebar.tabs.agenda')
        },
        {
          id: 'day' as const,
          icon: Calendar1,
          label: t('mail.rightSidebar.tabs.day')
        },
        {
          id: 'contact' as const,
          icon: UserRound,
          label: t('mail.rightSidebar.tabs.contact')
        },
        {
          id: 'tasks' as const,
          icon: CheckSquare,
          label: t('mail.rightSidebar.tabs.tasks')
        },
        {
          id: 'notes' as const,
          icon: NotebookPen,
          label: t('mail.rightSidebar.tabs.notes')
        }
      ] as const,
    [t]
  )

  const renderTabContent = useCallback(
    (tabId: MailRightSidebarTab): JSX.Element => {
      switch (tabId) {
        case 'dashboard':
          return <MailRightSidebarDashboard />
        case 'agenda':
          return <InboxCalendarSidebar hideChrome />
        case 'day':
          return (
            <MailCalendarDaySidebar
              viewMode={dayViewMode}
              onViewModeChange={setDayViewMode}
              onTodayHeaderStateChange={setDayTodayHeaderState}
            />
          )
        case 'contact':
          return <MailContactDetailsSidebar />
        case 'tasks':
          return <MailTasksSidebar />
        case 'notes':
          return <MailNotesSidebar />
      }
    },
    [dayViewMode]
  )

  const active = useMemo(
    () => tabs.find((x) => x.id === activeTab) ?? tabs[0],
    [tabs, activeTab]
  )

  const title = useMemo(() => {
    switch (active.id) {
      case 'dashboard':
        return t('mail.rightSidebar.titleDashboard')
      case 'agenda':
        return t('mail.rightSidebar.titleAgenda')
      case 'day':
        if (dayViewMode === 'week') return t('mail.rightSidebar.titleWeek')
        if (dayViewMode === 'month') return t('mail.rightSidebar.titleMonth')
        return t('mail.rightSidebar.titleDay')
      case 'contact':
        return t('mail.rightSidebar.titleContact')
      case 'tasks':
        return t('mail.rightSidebar.titleTasks')
      case 'notes':
        return t('mail.rightSidebar.titleNotes')
      default:
        return t('mail.rightSidebar.title')
    }
  }, [active.id, dayViewMode, t])

  const onTabClick = useCallback((tab: MailRightSidebarTab): void => {
    setActiveTab(tab)
  }, [])

  return (
    <aside className={cn('flex h-full min-h-0 shrink-0 flex-col border-0')}>
      {!hideChrome ? (
        <div className={cn(moduleColumnHeaderDockBarRowClass, 'relative')}>
          <span className={cn(moduleColumnHeaderUppercaseLabelClass, 'relative z-10 min-w-0 shrink')}>
            {title}
          </span>
          {activeTab === 'day' ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
              <div className="pointer-events-auto">
                <MailCalendarDayViewModeToggle
                  viewMode={dayViewMode}
                  onChange={setDayViewMode}
                />
              </div>
            </div>
          ) : null}
          {onRequestUndock || onRequestClose || (activeTab === 'day' && dayTodayHeaderState) ? (
            <div className={cn(moduleColumnHeaderActionsClass, 'relative z-10 ml-auto')}>
              {activeTab === 'day' && dayTodayHeaderState ? (
                <MailCalendarGoToTodayIconButton
                  disabled={dayTodayHeaderState.isViewingToday}
                  onClick={dayTodayHeaderState.goToToday}
                />
              ) : null}
              {onRequestUndock ? (
                <ModuleColumnHeaderIconButton
                  title={t('mail.rightSidebar.undockTitle')}
                  onClick={onRequestUndock}
                >
                  <SquareArrowOutUpRight className={moduleColumnHeaderIconGlyphClass} />
                </ModuleColumnHeaderIconButton>
              ) : null}
              {onRequestClose ? (
                <ModuleColumnHeaderIconButton
                  title={t('mail.rightSidebar.hideTitle')}
                  onClick={onRequestClose}
                >
                  <PanelRightClose className={moduleColumnHeaderIconGlyphClass} />
                </ModuleColumnHeaderIconButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={cn('relative min-h-0 flex-1 overflow-hidden', hideChrome ? 'pt-2' : '')}>
        {tabs.map((tab) =>
          mountedTabs.has(tab.id) ? (
            <div
              key={tab.id}
              className={cn(
                'h-full min-h-0 overflow-hidden',
                tab.id !== activeTab && 'pointer-events-none invisible absolute inset-0'
              )}
              aria-hidden={tab.id !== activeTab}
            >
              {renderTabContent(tab.id)}
            </div>
          ) : null
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-sidebar/95 px-1 py-1.5 backdrop-blur">
        <div className="flex items-center justify-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === active.id
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.label}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={(): void => onTabClick(tab.id)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors',
                  isActive
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-transparent hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
