import { addMonths } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { ModuleNavMiniMonth } from '@/components/ModuleNavMiniMonth'
import { moduleNavColumnClass } from '@/components/module-shell-layout'
import { NotesSidebarList } from '@/app/notes/NotesSidebarList'
import { clearNotesDateRange } from '@/app/notes/shell/notes-shell-date-range'
import type { useNotesListData } from '@/app/notes/shell/use-notes-list-data'
import type { useNotesShellLayout } from '@/app/notes/shell/use-notes-shell-layout'
import type { ConnectedAccount } from '@shared/types'
import { cn } from '@/lib/utils'

type ListData = ReturnType<typeof useNotesListData>
type Layout = ReturnType<typeof useNotesShellLayout>

export function NotesShellNavColumn({
  list,
  layout,
  accounts
}: {
  list: ListData
  layout: Layout
  accounts: ConnectedAccount[]
}): JSX.Element {
  const { t } = list

  return (
    <aside className={cn(moduleNavColumnClass, 'shrink-0')} style={{ width: layout.navWidth }}>
      <ModuleNavMiniMonth
        monthAnchor={list.miniMonth}
        today={new Date()}
        selectedRange={list.selectedRange}
        onSelectDayRange={(start, end): void =>
          list.applyNotesMiniCalendarRange(start, end, list.setDateFrom, list.setDateTo, list.setMiniMonth)
        }
        onPrevMonth={(): void => list.setMiniMonth((m) => addMonths(m, -1))}
        onNextMonth={(): void => list.setMiniMonth((m) => addMonths(m, 1))}
        footer={
          list.selectedRange ? (
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-2xs text-foreground">
                {t('notes.shell.dateRangeActive', { range: list.dateRangeLabel })}
              </span>
              <button
                type="button"
                onClick={(): void => clearNotesDateRange(list.setDateFrom, list.setDateTo)}
                className="shrink-0 text-2xs font-medium text-primary hover:underline"
              >
                {t('notes.shell.clearDateRange')}
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {list.loading && list.notes.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <NotesSidebarList
            accounts={accounts}
            sections={list.sections}
            notes={list.notes}
            listMode={list.listMode}
            onListModeChange={list.setListMode}
            navSelection={list.navSelection}
            onSelectScope={(scope): void => list.setNavSelection({ kind: 'sections', scope })}
            onSelectAccount={(accountKey): void =>
              list.setNavSelection({ kind: 'accounts', accountKey })
            }
            onSectionsChanged={list.onSectionsChanged}
          />
        )}
      </div>
    </aside>
  )
}
