import { Repeat2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChronellDateField } from '@/components/ChronellDateField'
import type { CalendarRecurrenceFrequency, CalendarRecurrenceRangeEndMode } from '@shared/types'

type RecurrenceUiFrequency = 'none' | CalendarRecurrenceFrequency

interface Props {
  /** i18n-Prefix, z. B. `calendar.eventDialog` oder `tasks.create`. */
  i18nPrefix?: string
  recurFreq: RecurrenceUiFrequency
  setRecurFreq: (v: RecurrenceUiFrequency) => void
  recurEnd: CalendarRecurrenceRangeEndMode
  setRecurEnd: (v: CalendarRecurrenceRangeEndMode) => void
  recurUntilDate: string
  setRecurUntilDate: (v: string) => void
  recurCount: string
  setRecurCount: (v: string) => void
  recurWeekdays: Array<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  >
  setRecurWeekdays: (
    v: Array<
      'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    >
  ) => void
  eventFieldsLocked: boolean
}

export function CalendarEventRecurrenceSection({
  i18nPrefix = 'calendar.eventDialog',
  recurFreq,
  setRecurFreq,
  recurEnd,
  setRecurEnd,
  recurUntilDate,
  setRecurUntilDate,
  recurCount,
  setRecurCount,
  recurWeekdays,
  setRecurWeekdays,
  eventFieldsLocked
}: Props): JSX.Element {
  const { t } = useTranslation()
  const tk = (key: string): string => t(`${i18nPrefix}.${key}`)
  const weekdayButtons: Array<{
    key: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    label: string
  }> = [
    { key: 'monday', label: t('calendar.eventDialog.weekdayMon') },
    { key: 'tuesday', label: t('calendar.eventDialog.weekdayTue') },
    { key: 'wednesday', label: t('calendar.eventDialog.weekdayWed') },
    { key: 'thursday', label: t('calendar.eventDialog.weekdayThu') },
    { key: 'friday', label: t('calendar.eventDialog.weekdayFri') },
    { key: 'saturday', label: t('calendar.eventDialog.weekdaySat') },
    { key: 'sunday', label: t('calendar.eventDialog.weekdaySun') }
  ]

  return (
    <div className="border-b border-border py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Repeat2 className="h-3.5 w-3.5" />
        {tk('recurrenceHeading')}
      </div>
      <label className="block text-xs text-muted-foreground" htmlFor="cal-recur-freq">
        {tk('recurrenceFreqLabel')}
      </label>
      <select
        id="cal-recur-freq"
        value={recurFreq}
        disabled={eventFieldsLocked}
        onChange={(e): void => {
          const v = e.target.value
          if (
            v === 'none' ||
            v === 'daily' ||
            v === 'weekly' ||
            v === 'biweekly' ||
            v === 'monthly' ||
            v === 'yearly'
          ) {
            setRecurFreq(v)
          }
        }}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="none">{tk('recurrenceFreqNone')}</option>
        <option value="daily">{tk('recurrenceFreqDaily')}</option>
        <option value="weekly">{tk('recurrenceFreqWeekly')}</option>
        <option value="biweekly">{tk('recurrenceFreqBiweekly')}</option>
        <option value="monthly">{tk('recurrenceFreqMonthly')}</option>
        <option value="yearly">{tk('recurrenceFreqYearly')}</option>
      </select>
      {recurFreq !== 'none' ? (
        <div className="mt-3 space-y-2">
          {(recurFreq === 'weekly' || recurFreq === 'biweekly') ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{tk('recurrenceWeekdaysLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {weekdayButtons.map((day) => {
                  const active = recurWeekdays.includes(day.key)
                  return (
                    <button
                      key={day.key}
                      type="button"
                      disabled={eventFieldsLocked}
                      onClick={(): void => {
                        const next = active
                          ? recurWeekdays.filter((d) => d !== day.key)
                          : [...recurWeekdays, day.key]
                        setRecurWeekdays(next)
                      }}
                      className={`h-8 min-w-8 rounded-full border px-2 text-xs ${active ? 'border-primary bg-primary/20 text-foreground' : 'border-border bg-background text-muted-foreground'} disabled:opacity-60`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          <label className="block text-xs text-muted-foreground" htmlFor="cal-recur-end">
            {tk('recurrenceEndLabel')}
          </label>
          <select
            id="cal-recur-end"
            value={recurEnd}
            disabled={eventFieldsLocked}
            onChange={(e): void => {
              const v = e.target.value
              if (v === 'never' || v === 'until' || v === 'count') setRecurEnd(v)
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="never">{tk('recurrenceEndNever')}</option>
            <option value="until">{tk('recurrenceEndUntil')}</option>
            <option value="count">{tk('recurrenceEndCount')}</option>
          </select>
          {recurEnd === 'until' ? (
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">
                {tk('recurrenceUntilLabel')}
              </span>
              <ChronellDateField
                value={recurUntilDate}
                onChange={setRecurUntilDate}
                disabled={eventFieldsLocked}
                className="text-xs"
              />
            </label>
          ) : null}
          {recurEnd === 'count' ? (
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">
                {tk('recurrenceCountLabel')}
              </span>
              <input
                type="number"
                min={1}
                max={999}
                value={recurCount}
                onChange={(e): void => setRecurCount(e.target.value)}
                disabled={eventFieldsLocked}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs tabular-nums"
              />
            </label>
          ) : null}
          <p className="text-2xs leading-snug text-muted-foreground">
            {tk('recurrenceHint')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
