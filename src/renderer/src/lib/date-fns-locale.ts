import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { de, enUS, type Locale } from 'date-fns/locale'

/** date-fns-Locale aus App-Sprachcode (de* → de, sonst enUS). */
export function resolveDateFnsLocale(language: string): Locale {
  return language.startsWith('de') ? de : enUS
}

/** Collator-/Intl-Sortier-Locale für deutsche vs. englische Listen. */
export function resolveCollatorLocale(language: string): 'de' | 'en' {
  return language.startsWith('de') ? 'de' : 'en'
}

/** BCP-47-Tag für `toLocaleString` / `Intl.DateTimeFormat`. */
export function resolveIntlLocaleTag(language: string, english: 'gb' | 'us' = 'gb'): string {
  if (language.startsWith('de')) return 'de-DE'
  return english === 'us' ? 'en-US' : 'en-GB'
}

/** React-Hook: date-fns-Locale passend zur aktiven App-Sprache. */
export function useDateFnsLocale(): Locale {
  const { i18n } = useTranslation()
  return useMemo(() => resolveDateFnsLocale(i18n.language), [i18n.language])
}

/** React-Hook: Collator-Locale passend zur aktiven App-Sprache. */
export function useCollatorLocale(): 'de' | 'en' {
  const { i18n } = useTranslation()
  return resolveCollatorLocale(i18n.language)
}

/** React-Hook: BCP-47-Tag passend zur aktiven App-Sprache. */
export function useIntlLocaleTag(english: 'gb' | 'us' = 'gb'): string {
  const { i18n } = useTranslation()
  return resolveIntlLocaleTag(i18n.language, english)
}
