import { format, parseISO, startOfDay, startOfMonth } from 'date-fns'
import type { TFunction } from 'i18next'
import type { RefObject } from 'react'
import type FullCalendar from '@fullcalendar/react'
import { ChronellDatePickerPanel } from '@/components/ChronellDatePickerPanel'

export interface CalendarShellGotoDateDialogProps {
  t: TFunction
  open: boolean
  draft: string
  onDraftChange: (ymd: string) => void
  onClose: () => void
  calendarRef: RefObject<FullCalendar | null>
  onNavigate: (monthAnchor: Date) => void
}

export function CalendarShellGotoDateDialog({
  t,
  open,
  draft,
  onDraftChange,
  onClose,
  calendarRef,
  onNavigate
}: CalendarShellGotoDateDialogProps): JSX.Element | null {
  if (!open) return null

  const applyDate = (ymd: string): void => {
    const d = parseISO(ymd.includes('T') ? ymd : `${ymd}T12:00:00`)
    if (Number.isNaN(d.getTime())) return
    calendarRef.current?.getApi()?.gotoDate(startOfDay(d))
    onNavigate(startOfMonth(d))
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cal-goto-date-title"
      onMouseDown={(e): void => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="chronell-dialog-panel w-full max-w-sm p-4"
        onMouseDown={(e): void => e.stopPropagation()}
      >
        <h2 id="cal-goto-date-title" className="mb-3 text-sm font-semibold text-foreground">
          {t('calendar.shell.gotoDateTitle')}
        </h2>
        <div className="mb-3">
          <ChronellDatePickerPanel
            value={draft}
            onChange={onDraftChange}
            onPick={(ymd): void => {
              if (!ymd) return
              applyDate(ymd)
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary/80"
            onClick={onClose}
          >
            {t('calendar.shell.gotoDateCancel')}
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={(): void => {
              applyDate(draft)
            }}
          >
            {t('calendar.shell.gotoDateApply')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Setzt Entwurf auf heute — fuer Tastaturkurz „Gehe zu Datum“. */
export function todayGotoDateDraft(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
