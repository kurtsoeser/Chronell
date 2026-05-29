import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { de, enUS, type Locale } from 'date-fns/locale'

export function resolveDateFnsLocale(language: string): Locale {
  return language.startsWith('de') ? de : enUS
}

/** Anzeige fuer «Zuletzt synchronisiert» in den Konten-Einstellungen. */
export function formatAccountLastSyncLabel(
  iso: string | null | undefined,
  language: string,
  opts?: { neverLabel: string; syncingLabel?: string; isSyncing?: boolean }
): string {
  if (opts?.isSyncing && opts.syncingLabel) return opts.syncingLabel
  if (!iso?.trim()) return opts?.neverLabel ?? '—'
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return opts?.neverLabel ?? '—'
  const locale = resolveDateFnsLocale(language)
  const relative = formatDistanceToNow(d, { addSuffix: true, locale })
  const absolute = format(d, 'Pp', { locale })
  return `${relative} (${absolute})`
}
