import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CALENDAR_SHELL_COLUMN_IDS,
  type CalendarShellColumnId
} from '@/app/calendar/calendar-shell-column-order'
import { useCalendarPanelLayoutStore } from '@/stores/calendar-panel-layout'

const COLUMN_LABEL_KEY: Record<CalendarShellColumnId, string> = {
  calendar: 'calendar.shell.columnLabelCalendar',
  zeitliste: 'calendar.shell.columnLabelZeitliste',
  preview: 'calendar.shell.columnLabelPreview',
  context: 'calendar.shell.columnLabelContext'
}

export function CalendarShellColumnLayoutSection(): JSX.Element {
  const { t } = useTranslation()
  const columnOrder = useCalendarPanelLayoutStore((s) => s.columnOrder)
  const moveColumn = useCalendarPanelLayoutStore((s) => s.moveColumn)
  const setColumnOrder = useCalendarPanelLayoutStore((s) => s.setColumnOrder)

  return (
    <div className="mt-2 shrink-0 space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{t('calendar.shell.columnLayoutTitle')}</p>
      <p className="text-2xs leading-snug text-muted-foreground">{t('calendar.shell.columnLayoutHint')}</p>
      <ul className="space-y-1">
        {columnOrder.map((id, index) => (
          <li
            key={id}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-1.5 py-1"
          >
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {t(COLUMN_LABEL_KEY[id])}
            </span>
            <button
              type="button"
              disabled={index === 0}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35"
              title={t('calendar.shell.columnMoveUp')}
              aria-label={t('calendar.shell.columnMoveUp')}
              onClick={(e): void => {
                e.stopPropagation()
                moveColumn(id, -1)
              }}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={index === columnOrder.length - 1}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35"
              title={t('calendar.shell.columnMoveDown')}
              aria-label={t('calendar.shell.columnMoveDown')}
              onClick={(e): void => {
                e.stopPropagation()
                moveColumn(id, 1)
              }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="w-full rounded-md border border-border px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent"
        onClick={(e): void => {
          e.stopPropagation()
          setColumnOrder(['zeitliste', 'calendar', 'preview', 'context'])
        }}
        onMouseDown={(ev): void => ev.stopPropagation()}
      >
        {t('calendar.shell.columnLayoutPresetTimelineFirst')}
      </button>
      <button
        type="button"
        className="w-full rounded-md border border-border px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent"
        onClick={(e): void => {
          e.stopPropagation()
          setColumnOrder([...CALENDAR_SHELL_COLUMN_IDS])
        }}
        onMouseDown={(ev): void => ev.stopPropagation()}
      >
        {t('calendar.shell.columnLayoutPresetDefault')}
      </button>
    </div>
  )
}
