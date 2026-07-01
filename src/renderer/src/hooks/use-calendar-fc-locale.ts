import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocaleInput } from '@fullcalendar/core'
import { resolveFullCalendarLocale } from '@/lib/fullcalendar-locale'

/** FullCalendar-Locale abgestimmt auf die aktuelle App-Sprache. */
export function useCalendarFcLocale(): LocaleInput {
  const { i18n } = useTranslation()
  return useMemo(() => resolveFullCalendarLocale(i18n.language), [i18n.language])
}
