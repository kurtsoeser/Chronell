import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChronellDateField } from '@/components/ChronellDateField'
import type { UserNote } from '@shared/types'

function toLocalDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toLocalTimeInput(iso: string | null): string {
  if (!iso) return '09:00'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '09:00'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function combineLocalDateTime(date: string, time: string): string | null {
  if (!date.trim()) return null
  const t = time.trim() || '09:00'
  const d = new Date(`${date}T${t}:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function addMinutesToTimeInput(startTime: string, minutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export interface NotesNoteScheduleBlockProps {
  note: Pick<UserNote, 'scheduledStartIso' | 'scheduledEndIso' | 'scheduledAllDay'>
  defaultExpanded?: boolean
  defaultDurationMinutes?: number
  disabled?: boolean
  onChange: (value: {
    scheduledStartIso: string | null
    scheduledEndIso: string | null
    scheduledAllDay: boolean
    clearSchedule?: boolean
  }) => void
  /** `card`: eigener Abschnitt; `inline`: ohne Rahmen (OneNote-Metadaten). */
  variant?: 'card' | 'inline'
}

export function NotesNoteScheduleBlock({
  note,
  defaultExpanded = false,
  defaultDurationMinutes = 30,
  disabled = false,
  onChange,
  variant = 'card'
}: NotesNoteScheduleBlockProps): JSX.Element {
  const { t } = useTranslation()
  const [blockOpen, setBlockOpen] = useState(defaultExpanded || Boolean(note.scheduledStartIso))
  const [enabled, setEnabled] = useState(Boolean(note.scheduledStartIso))
  const [allDay, setAllDay] = useState(note.scheduledAllDay)
  const [date, setDate] = useState(() => toLocalDateInput(note.scheduledStartIso))
  const [startTime, setStartTime] = useState(() => toLocalTimeInput(note.scheduledStartIso))
  const [endTime, setEndTime] = useState(() => toLocalTimeInput(note.scheduledEndIso))

  useEffect(() => {
    const hasSchedule = Boolean(note.scheduledStartIso)
    setEnabled(hasSchedule)
    setBlockOpen(defaultExpanded || hasSchedule)
    setAllDay(note.scheduledAllDay)
    setDate(toLocalDateInput(note.scheduledStartIso))
    setStartTime(toLocalTimeInput(note.scheduledStartIso))
    setEndTime(toLocalTimeInput(note.scheduledEndIso))
  }, [note.scheduledStartIso, note.scheduledEndIso, note.scheduledAllDay, defaultExpanded])

  function emit(nextEnabled: boolean, nextAllDay: boolean, nextDate: string, nextStart: string, nextEnd: string): void {
    if (!nextEnabled) {
      onChange({
        scheduledStartIso: null,
        scheduledEndIso: null,
        scheduledAllDay: false,
        clearSchedule: true
      })
      return
    }
    if (nextAllDay) {
      const startIso = nextDate.trim() ? `${nextDate.trim()}T00:00:00.000Z`.slice(0, 10) : null
      onChange({
        scheduledStartIso: startIso,
        scheduledEndIso: startIso,
        scheduledAllDay: true
      })
      return
    }
    const startIso = combineLocalDateTime(nextDate, nextStart)
    const endIso = combineLocalDateTime(nextDate, nextEnd)
    onChange({
      scheduledStartIso: startIso,
      scheduledEndIso: endIso ?? startIso,
      scheduledAllDay: false
    })
  }

  const inline = variant === 'inline'
  const panelOpen = inline || blockOpen

  const fields = (
    <>
      {panelOpen ? (
        <label className="mt-2 flex items-center gap-2 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e): void => {
              const next = e.target.checked
              setEnabled(next)
              if (next && !note.scheduledStartIso) {
                const today = toLocalDateInput(new Date().toISOString())
                const start = toLocalTimeInput(new Date().toISOString())
                const end = addMinutesToTimeInput(start, defaultDurationMinutes)
                setDate(today)
                setStartTime(start)
                setEndTime(end)
                emit(true, allDay, today, start, end)
                return
              }
              emit(next, allDay, date, startTime, endTime)
            }}
          />
          {t('notes.schedule.enable')}
        </label>
      ) : null}
      {panelOpen && enabled ? (
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allDay}
              disabled={disabled}
              onChange={(e): void => {
                const next = e.target.checked
                setAllDay(next)
                emit(true, next, date, startTime, endTime)
              }}
            />
            {t('notes.schedule.allDay')}
          </label>
          <ChronellDateField
            value={date}
            disabled={disabled}
            onChange={(next): void => {
              setDate(next)
              emit(true, allDay, next, startTime, endTime)
            }}
          />
          {!allDay ? (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={startTime}
                disabled={disabled}
                onChange={(e): void => {
                  const next = e.target.value
                  setStartTime(next)
                  emit(true, allDay, date, next, endTime)
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                title={t('notes.schedule.start')}
              />
              <input
                type="time"
                value={endTime}
                disabled={disabled}
                onChange={(e): void => {
                  const next = e.target.value
                  setEndTime(next)
                  emit(true, allDay, date, startTime, next)
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                title={t('notes.schedule.end')}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )

  if (inline) {
    return <div className="space-y-1">{fields}</div>
  }

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <button
        type="button"
        onClick={(): void => setBlockOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-foreground"
      >
        <span>{t('notes.schedule.sectionTitle')}</span>
        <span className="text-muted-foreground">{blockOpen ? '▾' : '▸'}</span>
      </button>
      {fields}
    </div>
  )
}
