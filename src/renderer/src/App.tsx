import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToastStack } from './components/ToastStack'
import { useAccountsStore } from './stores/accounts'
import { useMailStore } from './stores/mail'
import { useCalendarSyncStore } from './stores/calendar-sync'
import { useGlobalShortcuts } from './lib/use-global-shortcuts'
import { useZoomShortcuts } from './hooks/use-zoom-shortcuts'
import { usePanelPopoutDockListener } from './hooks/use-panel-popout-dock-listener'
import {
  OPEN_ACCOUNT_SETTINGS_EVENT,
  type OpenAccountSettingsTab
} from './lib/open-account-settings'
import { PENDING_MAIL_RULES_SETTINGS_KEY, useAppModeStore } from './stores/app-mode'
import { useCustomViewsStore } from './stores/custom-views'
import {
  readActiveCustomViewId,
  readCustomViews,
  readCustomViewTopbarOrder,
  reconcileCustomViewTopbarOrder
} from '@/app/custom-views/custom-views-storage'
import {
  TOPBAR_MODULE_PREFS_CHANGED_EVENT,
  isTopbarModuleVisible,
  readTopbarModuleHiddenSet,
  resolveVisibleAppShellMode
} from '@/app/layout/topbar-module-prefs'
import { subscribeConnectivityFromMain } from './stores/connectivity'
import { ProfileSyncBridge } from './components/ProfileSyncBridge'
import { useSnoozeUiStore } from './stores/snooze-ui'
import { useCreateCloudTaskUiStore } from './stores/create-cloud-task-ui'
import { useNotionDestinationPickerStore } from './stores/notion-destination-picker'

const Topbar = lazy(async () => {
  const m = await import('./app/layout/Topbar')
  return { default: m.Topbar }
})
const AccountSetupDialog = lazy(async () => {
  const m = await import('./components/AccountSetupDialog')
  return { default: m.AccountSetupDialog }
})
const FirstRunWizard = lazy(async () => {
  const m = await import('./components/FirstRunWizard')
  return { default: m.FirstRunWizard }
})
const WorkflowMailFoldersIntro = lazy(async () => {
  const m = await import('./components/WorkflowMailFoldersIntro')
  return { default: m.WorkflowMailFoldersIntro }
})
const AppDialogHost = lazy(async () => {
  const m = await import('./components/AppDialogHost')
  return { default: m.AppDialogHost }
})
const NotionDestinationPickerDialog = lazy(async () => {
  const m = await import('./components/NotionDestinationPickerDialog')
  return { default: m.NotionDestinationPickerDialog }
})
const SnoozePickerHost = lazy(async () => {
  const m = await import('./components/SnoozePickerHost')
  return { default: m.SnoozePickerHost }
})
const MailReadingPopoutHost = lazy(async () => {
  const m = await import('./app/layout/MailReadingPopoutHost')
  return { default: m.MailReadingPopoutHost }
})
const CreateCloudTaskFromMailDialogHost = lazy(async () => {
  const m = await import('./components/CreateCloudTaskFromMailDialogHost')
  return { default: m.CreateCloudTaskFromMailDialogHost }
})
const CalendarIcsImportDialogHost = lazy(async () => {
  const m = await import('./components/CalendarIcsImportDialogHost')
  return { default: m.CalendarIcsImportDialogHost }
})
const MailCreateContactHost = lazy(async () => {
  const m = await import('./app/layout/MailCreateContactHost')
  return { default: m.MailCreateContactHost }
})
const MailReplyWithMeetingHost = lazy(async () => {
  const m = await import('./components/MailReplyWithMeetingHost')
  return { default: m.MailReplyWithMeetingHost }
})

const HomeDashboard = lazy(async () => {
  const m = await import('./app/home/HomeDashboard')
  return { default: m.HomeDashboard }
})
const LayoutStudioShell = lazy(async () => {
  const m = await import('./app/layout-studio/LayoutStudioShell')
  return { default: m.LayoutStudioShell }
})
const CustomViewShell = lazy(async () => {
  const m = await import('./app/custom-views/CustomViewShell')
  return { default: m.CustomViewShell }
})
const CreateCustomViewWizard = lazy(async () => {
  const m = await import('./app/custom-views/CreateCustomViewWizard')
  return { default: m.CreateCustomViewWizard }
})
const MailWorkspace = lazy(async () => {
  const m = await import('./app/layout/MailWorkspace')
  return { default: m.MailWorkspace }
})
const CalendarShell = lazy(async () => {
  const m = await import('./app/calendar/CalendarShell')
  return { default: m.CalendarShell }
})
const NotesShell = lazy(async () => {
  const m = await import('./app/notes/NotesShell')
  return { default: m.NotesShell }
})
const FilesShell = lazy(async () => {
  const m = await import('./app/files/FilesShell')
  return { default: m.FilesShell }
})
const ChatShell = lazy(async () => {
  const m = await import('./app/chat/ChatShell')
  return { default: m.ChatShell }
})
const TasksShell = lazy(async () => {
  const m = await import('./app/tasks/TasksShell')
  return { default: m.TasksShell }
})
const WorkShell = lazy(async () => {
  const m = await import('./app/work/WorkShell')
  return { default: m.WorkShell }
})
const PeopleShell = lazy(async () => {
  const m = await import('./app/people/PeopleShell')
  return { default: m.PeopleShell }
})
const ConnectionsShell = lazy(async () => {
  const m = await import('./app/connections/ConnectionsShell')
  return { default: m.ConnectionsShell }
})
const BookingsShell = lazy(async () => {
  const m = await import('./app/bookings/BookingsShell')
  return { default: m.BookingsShell }
})
const ComposerStack = lazy(async () => {
  const m = await import('./components/Composer')
  return { default: m.ComposerStack }
})

function AppShellFallback(): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-muted shell-fade-pulse" />
        <span className="text-sm">{t('app.loadingShell')}</span>
      </div>
    </div>
  )
}

function TopbarFallback(): JSX.Element {
  return (
    <div
      className="electron-window-titlebar h-12 shrink-0 border-b border-border bg-card"
      aria-hidden
    />
  )
}

export function App(): JSX.Element {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [accountDialogInitialTab, setAccountDialogInitialTab] = useState<
    OpenAccountSettingsTab | undefined
  >(undefined)
  const [accountDialogInitialMailSubNav, setAccountDialogInitialMailSubNav] = useState<
    string | undefined
  >(undefined)
  const [accountDialogInitialBookingsSubNav, setAccountDialogInitialBookingsSubNav] = useState<
    string | undefined
  >(undefined)
  const accounts = useAccountsStore((s) => s.accounts)
  const config = useAccountsStore((s) => s.config)
  const accountsLoading = useAccountsStore((s) => s.loading)
  const refreshAccounts = useMailStore((s) => s.refreshAccounts)
  const mode = useAppModeStore((s) => s.mode)
  const setAppMode = useAppModeStore((s) => s.setMode)
  const snoozePickerOpen = useSnoozeUiStore((s) => s.pendingMessageId != null)
  const cloudTaskDialogOpen = useCreateCloudTaskUiStore((s) => s.pendingMessage != null)
  const notionPickerOpen = useNotionDestinationPickerStore((s) => s.open)

  const workflowMailTriageAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const showWorkflowFoldersIntro =
    !accountsLoading &&
    Boolean(config) &&
    !config?.workflowMailFoldersIntroDismissed &&
    workflowMailTriageAccounts.length > 0

  const showFirstRunWizard =
    !accountsLoading && config != null && config.firstRunSetupCompleted === false

  function openAccountSettings(
    tab: OpenAccountSettingsTab = 'general',
    mailSubNav?: string,
    bookingsSubNav?: string
  ): void {
    setAccountDialogInitialTab(tab)
    setAccountDialogInitialMailSubNav(mailSubNav)
    setAccountDialogInitialBookingsSubNav(bookingsSubNav)
    setAccountDialogOpen(true)
  }

  function closeAccountSettings(): void {
    setAccountDialogOpen(false)
    setAccountDialogInitialTab(undefined)
    setAccountDialogInitialMailSubNav(undefined)
    setAccountDialogInitialBookingsSubNav(undefined)
  }

  useEffect(() => {
    useMailStore.getState().initialize()
    useCalendarSyncStore.getState().initialize()
    void useAccountsStore.getState().initialize()

    const views = readCustomViews()
    const topbarOrder = reconcileCustomViewTopbarOrder(views, readCustomViewTopbarOrder())
    const activeViewId = readActiveCustomViewId()
    useCustomViewsStore.setState({ views, topbarOrder, activeViewId })

    if (useAppModeStore.getState().mode === 'customView') {
      const valid = activeViewId && views.some((v) => v.id === activeViewId)
      if (!valid) useAppModeStore.getState().setMode('home')
    }
  }, [])

  useGlobalShortcuts()
  useZoomShortcuts()
  usePanelPopoutDockListener(true)

  useEffect(() => {
    return subscribeConnectivityFromMain()
  }, [])

  useEffect(() => {
    try {
      if (window.localStorage.getItem(PENDING_MAIL_RULES_SETTINGS_KEY) === '1') {
        window.localStorage.removeItem(PENDING_MAIL_RULES_SETTINGS_KEY)
        openAccountSettings('mail', 'rules')
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmalig nach Migration vom Regeln-Modul
  }, [])

  useEffect(() => {
    if (accounts.length > 0) {
      void refreshAccounts(accounts)
    }
  }, [accounts, refreshAccounts])

  useEffect(() => {
    const hidden = readTopbarModuleHiddenSet()
    if (!isTopbarModuleVisible(mode, hidden)) {
      setAppMode(resolveVisibleAppShellMode(mode))
    }
  }, [mode, setAppMode])

  useEffect(() => {
    const onPrefsChanged = (): void => {
      const hidden = readTopbarModuleHiddenSet()
      const current = useAppModeStore.getState().mode
      if (!isTopbarModuleVisible(current, hidden)) {
        setAppMode(resolveVisibleAppShellMode(current))
      }
    }
    window.addEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, onPrefsChanged)
    return (): void =>
      window.removeEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, onPrefsChanged)
  }, [setAppMode])

  useEffect(() => {
    const onOpenSettings = (e: Event): void => {
      const ce = e as CustomEvent<{
        tab?: OpenAccountSettingsTab
        mailSubNav?: string
        bookingsSubNav?: string
      }>
      const tab = ce.detail?.tab ?? 'general'
      setAccountDialogInitialTab(tab)
      setAccountDialogInitialMailSubNav(ce.detail?.mailSubNav)
      setAccountDialogInitialBookingsSubNav(ce.detail?.bookingsSubNav)
      setAccountDialogOpen(true)
    }
    window.addEventListener(OPEN_ACCOUNT_SETTINGS_EVENT, onOpenSettings as EventListener)
    return (): void => window.removeEventListener(OPEN_ACCOUNT_SETTINGS_EVENT, onOpenSettings as EventListener)
  }, [])

  return (
    <div className="app-chrome-root flex h-full min-h-0 flex-col text-foreground">
      <ProfileSyncBridge />
      <Suspense fallback={<TopbarFallback />}>
        <Topbar onOpenAccountDialog={(): void => openAccountSettings('general')} />
      </Suspense>
      <div className="chronell-module-shell flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<AppShellFallback />}>
          {mode === 'home' && <HomeDashboard />}
          {mode === 'layoutStudio' && <LayoutStudioShell />}
          {mode === 'customView' && <CustomViewShell />}
          {mode === 'calendar' && <CalendarShell />}
          {mode === 'bookings' && <BookingsShell />}
          {mode === 'tasks' && <TasksShell />}
          {mode === 'work' && <WorkShell />}
          {mode === 'people' && <PeopleShell />}
          {mode === 'notes' && <NotesShell />}
          {mode === 'files' && <FilesShell />}
          {mode === 'connections' && <ConnectionsShell />}
          {mode === 'chat' && (
            <ChatShell onOpenAccountDialog={(): void => openAccountSettings('general')} />
          )}
          {mode === 'mail' && (
            <MailWorkspace onOpenAccountDialog={(): void => openAccountSettings('general')} />
          )}
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <CreateCustomViewWizard />
      </Suspense>
      {showFirstRunWizard ? (
        <Suspense fallback={null}>
          <FirstRunWizard
            onOpenSettings={(tab): void => {
              openAccountSettings(tab)
            }}
          />
        </Suspense>
      ) : null}
      {accountDialogOpen ? (
        <Suspense fallback={null}>
          <AccountSetupDialog
            open={accountDialogOpen}
            initialTab={accountDialogInitialTab}
            initialMailSubNav={accountDialogInitialMailSubNav}
            initialBookingsSubNav={accountDialogInitialBookingsSubNav}
            onClose={closeAccountSettings}
          />
        </Suspense>
      ) : null}
      {showWorkflowFoldersIntro ? (
        <Suspense fallback={null}>
          <WorkflowMailFoldersIntro
            open={showWorkflowFoldersIntro}
            workflowMailAccounts={workflowMailTriageAccounts}
            onClose={(): void => undefined}
            onOpenMailSettings={(): void => openAccountSettings('mail')}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={<div className="pointer-events-none fixed inset-0 z-[200]" aria-hidden />}>
        <ComposerStack />
      </Suspense>
      <Suspense fallback={null}>
        <MailReadingPopoutHost />
      </Suspense>
      {snoozePickerOpen ? (
        <Suspense fallback={null}>
          <SnoozePickerHost />
        </Suspense>
      ) : null}
      {cloudTaskDialogOpen ? (
        <Suspense fallback={null}>
          <CreateCloudTaskFromMailDialogHost />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <MailCreateContactHost />
      </Suspense>
      <Suspense fallback={null}>
        <MailReplyWithMeetingHost />
      </Suspense>
      <ToastStack />
      <Suspense fallback={null}>
        <AppDialogHost />
      </Suspense>
      <Suspense fallback={null}>
        <CalendarIcsImportDialogHost />
      </Suspense>
      {notionPickerOpen ? (
        <Suspense fallback={null}>
          <NotionDestinationPickerDialog />
        </Suspense>
      ) : null}
    </div>
  )
}
