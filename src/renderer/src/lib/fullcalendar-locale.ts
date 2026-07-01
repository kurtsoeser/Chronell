import deLocale from '@fullcalendar/core/locales/de'
import enGbLocale from '@fullcalendar/core/locales/en-gb'
import type { LocaleInput } from '@fullcalendar/core'

/** FullCalendar-Locale aus App-Sprache (`de` / `en` / i18n.language). */
export function resolveFullCalendarLocale(languageOrLocale: string): LocaleInput {
  const tag = languageOrLocale.trim().toLowerCase()
  if (tag === 'en' || tag.startsWith('en-')) return enGbLocale
  if (tag.startsWith('de')) return deLocale
  return enGbLocale
}

export { deLocale, enGbLocale }
