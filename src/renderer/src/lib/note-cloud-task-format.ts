/** Anzeige-Label für Fälligkeit / Planung in Notiz-Aufgabenblöcken. */
export function formatNoteCloudTaskDueLabel(
  dueIso: string | null | undefined,
  locale: string
): string | null {
  const raw = dueIso?.trim()
  if (!raw) return null
  const date = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const hasTime = raw.includes('T') && !raw.endsWith('T00:00:00.000Z')
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(date)
}
