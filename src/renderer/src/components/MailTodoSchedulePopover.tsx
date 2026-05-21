import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatScheduleSummary(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  locale: string
): string | null {
  if (!startIso || !endIso) return null
  const s = new Date(startIso)
  const e = new Date(endIso)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null
  const loc = locale.startsWith('de') ? 'de-DE' : 'en-GB'
  const dateFmt: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }
  const timeFmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  const sd = s.toLocaleDateString(loc, dateFmt)
  const ed = e.toLocaleDateString(loc, dateFmt)
  const st = s.toLocaleTimeString(loc, timeFmt)
  const et = e.toLocaleTimeString(loc, timeFmt)
  if (sd === ed) return `${sd} ${st}–${et}`
  return `${sd} ${st} – ${ed} ${et}`
}

export function MailTodoScheduleButton({
  disabled,
  start,
  end,
  scheduledStart,
  scheduledEnd,
  onStartChange,
  onEndChange,
  onSave
}: {
  disabled?: boolean
  start: string
  end: string
  scheduledStart?: string | null
  scheduledEnd?: string | null
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onSave: () => void
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ x: 0, y: 0 })
  const popoverRef = useRef<HTMLDivElement>(null)

  const hasSaved = Boolean(scheduledStart && scheduledEnd)
  const summary = formatScheduleSummary(scheduledStart, scheduledEnd, i18n.language)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent): void {
      const el = popoverRef.current
      if (!el || el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return (): void => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={
          summary
            ? `${t('mail.readingPane.todoScheduleLabel')}: ${summary}`
            : t('mail.readingPane.todoScheduleOpen')
        }
        aria-label={t('mail.readingPane.todoScheduleOpen')}
        aria-expanded={open}
        onClick={(e): void => {
          const r = e.currentTarget.getBoundingClientRect()
          setAnchor({ x: Math.max(8, r.left), y: r.bottom + 4 })
          setOpen((v) => !v)
        }}
        className={cn(
          'flex h-7 shrink-0 items-center justify-center rounded-md px-1.5 transition-colors',
          disabled
            ? 'cursor-not-allowed text-muted-foreground/40'
            : hasSaved
              ? 'bg-primary/15 text-primary hover:bg-primary/25'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )}
      >
        <CalendarClock className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className={cn(
            'chronell-acrylic-popover fixed z-[200] w-[min(18rem,calc(100vw-1.5rem))] p-3 text-xs',
            'text-popover-foreground'
          )}
          style={{ left: anchor.x, top: anchor.y }}
          role="dialog"
          aria-label={t('mail.readingPane.todoScheduleLabel')}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">{t('mail.readingPane.todoScheduleLabel')}</span>
            <button
              type="button"
              onClick={(): void => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={t('common.close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">{t('mail.readingPane.start')}</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(e): void => onStartChange(e.target.value)}
                className="h-8 rounded border border-border bg-background px-2 text-[11px] text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">{t('mail.readingPane.end')}</span>
              <input
                type="datetime-local"
                value={end}
                onChange={(e): void => onEndChange(e.target.value)}
                className="h-8 rounded border border-border bg-background px-2 text-[11px] text-foreground"
              />
            </label>
            <button
              type="button"
              className="mt-0.5 rounded-md bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
              onClick={(): void => {
                onSave()
                setOpen(false)
              }}
            >
              {t('mail.readingPane.saveAppointment')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
