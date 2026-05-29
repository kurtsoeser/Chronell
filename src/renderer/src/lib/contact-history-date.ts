/** Kompaktes Datum fuer Zeilen im Kontakt-Verlauf (wie Mailliste). */
export function formatContactHistoryRowDate(iso: string | null | undefined, locale: string): string {
  if (!iso?.trim()) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    if (sameDay) {
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    }
    const sameYear = d.getFullYear() === now.getFullYear()
    if (sameYear) {
      return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })
    }
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return ''
  }
}

export function isLikelyReplySubject(subject: string | null | undefined): boolean {
  const s = subject?.trim() ?? ''
  return /^(re|aw|wg|fwd|fw)\s*:/i.test(s)
}
