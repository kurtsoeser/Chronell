/** eM-Client-ähnliche Datums-Gruppen für den Kontakt-Korrespondenz-Verlauf. */

export interface ContactHistoryDateBucket {
  key: string
  label: string
  /** Niedriger = weiter oben in der Liste. */
  sortOrder: number
}

export interface ContactHistoryDateBucketLabels {
  unknown: string
  today: string
  yesterday: string
  lastWeek: string
  thisMonth: string
  older: string
}

function startOfDayMs(dt: Date): number {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
}

/**
 * Gruppierung: Heute → Gestern → Wochentag (2–6 Tage) → Letzte Woche (7–13) → Diesen Monat → Monat/Jahr.
 */
export function contactHistoryDateBucket(
  iso: string | null | undefined,
  labels: ContactHistoryDateBucketLabels,
  locale: string
): ContactHistoryDateBucket {
  if (!iso?.trim()) {
    return { key: 'unknown', label: labels.unknown, sortOrder: 999 }
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return { key: 'unknown', label: labels.unknown, sortOrder: 999 }
  }

  const now = new Date()
  const diffDays = Math.floor((startOfDayMs(now) - startOfDayMs(d)) / (24 * 60 * 60 * 1000))

  if (diffDays === 0) {
    return { key: 'today', label: labels.today, sortOrder: 0 }
  }
  if (diffDays === 1) {
    return { key: 'yesterday', label: labels.yesterday, sortOrder: 1 }
  }
  if (diffDays >= 2 && diffDays <= 6) {
    const weekday = d.toLocaleDateString(locale, { weekday: 'long' })
    const dayKey = d.toISOString().slice(0, 10)
    return { key: `weekday:${dayKey}`, label: weekday, sortOrder: 2 + diffDays }
  }
  if (diffDays >= 7 && diffDays <= 13) {
    return { key: 'last-week', label: labels.lastWeek, sortOrder: 20 }
  }

  const sameYearMonth =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  if (sameYearMonth) {
    return { key: 'this-month', label: labels.thisMonth, sortOrder: 30 }
  }

  const month = d.toLocaleDateString(locale, { month: 'long' })
  const year = d.getFullYear()
  const sameYear = year === now.getFullYear()
  if (sameYear) {
    return { key: `month:${year}-${d.getMonth()}`, label: month, sortOrder: 40 + d.getMonth() }
  }

  const monthYear = `${month} ${year}`
  return {
    key: `month:${year}-${d.getMonth()}`,
    label: monthYear,
    sortOrder: 50 + year * 12 + d.getMonth()
  }
}
