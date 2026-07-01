import type { Dispatch, SetStateAction } from 'react'
import { addMonths } from 'date-fns'
import type { TFunction } from 'i18next'
import type { ConnectedAccount, CalendarGraphCalendarRow } from '@shared/types'
import type { SyncStatus } from '@shared/types'
import { ModuleNavMiniMonth } from '@/components/ModuleNavMiniMonth'
import { VerticalSplitter } from '@/components/ResizableSplitter'
import {
  moduleNavColumnScrollBodyClass,
  moduleNavColumnScrollBodyStackClass
} from '@/components/module-shell-layout'
import { CalendarShellOverlayToggles } from '@/app/calendar/shell/CalendarShellOverlayToggles'
import { CalendarShellSidebarCalendars } from '@/app/calendar/CalendarShellSidebarCalendars'
import type { ContextMenuItem } from '@/components/ContextMenu'

export interface CalendarShellLeftSidebarProps {
  t: TFunction
  moduleNavWidth: number
  onDragModuleNavWidth: (delta: number) => void
  miniMonth: Date
  setMiniMonth: Dispatch<SetStateAction<Date>>
  onSelectDayRange: (startInclusive: Date, endInclusive: Date) => void
  mailTodoOverlay: boolean
  setMailTodoOverlay: Dispatch<SetStateAction<boolean>>
  cloudTaskOverlay: boolean
  setCloudTaskOverlay: Dispatch<SetStateAction<boolean>>
  userNoteOverlay: boolean
  setUserNoteOverlay: Dispatch<SetStateAction<boolean>>
  taskAccountsCount: number
  calendarLinkedAccounts: ConnectedAccount[]
  calendarsByAccount: Record<string, CalendarGraphCalendarRow[]>
  sidebarHiddenCalendarKeys: Set<string>
  hiddenCalendarKeys: Set<string>
  toggleCalendarVisibility: (accountId: string, graphCalendarId: string) => void
  showAllCalendarsInView: () => void
  onCalendarRowContextMenu: (
    clientX: number,
    clientY: number,
    accountId: string,
    cal: CalendarGraphCalendarRow
  ) => void
  accountDisplayAvatarDataUrls: Record<string, string | undefined>
  setAccountSidebarOpen: Dispatch<SetStateAction<Record<string, boolean>>>
  isAccountSidebarOpen: (accountId: string) => boolean
  accountGroupCalSidebarOpen: Record<string, boolean>
  setAccountGroupCalSidebarOpen: Dispatch<SetStateAction<Record<string, boolean>>>
  groupCalendarsLoading: Record<string, boolean>
  m365GroupCalPaging: Record<string, { total: number; nextOffset: number }>
  fetchMicrosoft365GroupCalendarsIfNeeded: (accountId: string) => Promise<void>
  fetchMoreMicrosoft365GroupCalendars: (accountId: string, offset: number) => Promise<void>
  onAccountHeaderContextMenu: (clientX: number, clientY: number, account: ConnectedAccount) => void
  calendarSyncByAccount: Record<string, SyncStatus>
  onAccountSync: (accountId: string) => void
}

export function CalendarShellLeftSidebar({
  t,
  moduleNavWidth,
  onDragModuleNavWidth,
  miniMonth,
  setMiniMonth,
  onSelectDayRange,
  mailTodoOverlay,
  setMailTodoOverlay,
  cloudTaskOverlay,
  setCloudTaskOverlay,
  userNoteOverlay,
  setUserNoteOverlay,
  taskAccountsCount,
  calendarLinkedAccounts,
  calendarsByAccount,
  sidebarHiddenCalendarKeys,
  hiddenCalendarKeys,
  toggleCalendarVisibility,
  showAllCalendarsInView,
  onCalendarRowContextMenu,
  accountDisplayAvatarDataUrls,
  setAccountSidebarOpen,
  isAccountSidebarOpen,
  accountGroupCalSidebarOpen,
  setAccountGroupCalSidebarOpen,
  groupCalendarsLoading,
  m365GroupCalPaging,
  fetchMicrosoft365GroupCalendarsIfNeeded,
  fetchMoreMicrosoft365GroupCalendars,
  onAccountHeaderContextMenu,
  calendarSyncByAccount,
  onAccountSync
}: CalendarShellLeftSidebarProps): JSX.Element {
  return (
    <>
      <div style={{ width: moduleNavWidth }} className="flex h-full min-h-0 shrink-0 flex-col">
        <aside className="module-nav-column h-full min-h-0 w-full">
          <ModuleNavMiniMonth
            monthAnchor={miniMonth}
            today={new Date()}
            onSelectDayRange={onSelectDayRange}
            onPrevMonth={(): void => setMiniMonth((m) => addMonths(m, -1))}
            onNextMonth={(): void => setMiniMonth((m) => addMonths(m, 1))}
          />

          <div className={moduleNavColumnScrollBodyClass}>
            <div className={moduleNavColumnScrollBodyStackClass}>
              <CalendarShellOverlayToggles
                mailTodoOverlay={mailTodoOverlay}
                setMailTodoOverlay={setMailTodoOverlay}
                cloudTaskOverlay={cloudTaskOverlay}
                setCloudTaskOverlay={setCloudTaskOverlay}
                userNoteOverlay={userNoteOverlay}
                setUserNoteOverlay={setUserNoteOverlay}
                taskAccountsCount={taskAccountsCount}
              />

              <CalendarShellSidebarCalendars
                calendarLinkedAccounts={calendarLinkedAccounts}
                calendarsByAccount={calendarsByAccount}
                sidebarHiddenCalendarKeys={sidebarHiddenCalendarKeys}
                hiddenCalendarKeys={hiddenCalendarKeys}
                toggleCalendarVisibility={toggleCalendarVisibility}
                showAllCalendarsInView={showAllCalendarsInView}
                onCalendarRowContextMenu={onCalendarRowContextMenu}
                profilePhotoDataUrls={accountDisplayAvatarDataUrls as Record<string, string>}
                setAccountSidebarOpen={setAccountSidebarOpen}
                isAccountSidebarOpen={isAccountSidebarOpen}
                accountGroupCalSidebarOpen={accountGroupCalSidebarOpen}
                setAccountGroupCalSidebarOpen={setAccountGroupCalSidebarOpen}
                groupCalendarsLoading={groupCalendarsLoading}
                m365GroupCalPaging={m365GroupCalPaging}
                fetchMicrosoft365GroupCalendarsIfNeeded={fetchMicrosoft365GroupCalendarsIfNeeded}
                fetchMoreMicrosoft365GroupCalendars={fetchMoreMicrosoft365GroupCalendars}
                onAccountHeaderContextMenu={onAccountHeaderContextMenu}
                syncByAccount={calendarSyncByAccount}
                onAccountSync={onAccountSync}
              />
            </div>
          </div>
        </aside>
      </div>
      <VerticalSplitter
        variant="moduleNav"
        onDrag={onDragModuleNavWidth}
        ariaLabel={t('common.moduleNavSplitter')}
      />
    </>
  )
}
