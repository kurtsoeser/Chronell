import type { EventsOsEventHit } from '@shared/types/events-os'

export type EventsOsGroupMode = 'zeitraum' | 'monat' | 'organisation'

export type EventsOsHitGroup = {
  key: string
  label: string
  /** Sortierreihenfolge der Gruppen (kleiner = oben). */
  order: number
  items: EventsOsEventHit[]
}

const GROUP_MODE_STORAGE_KEY = 'chronell.eventsOs.groupMode'

const ZEITRAUM_ORDER: Record<string, number> = {
  heute: 0,
  morgen: 1,
  dieseWoche: 2,
  naechsteWoche: 3,
  spaeter: 4,
  vergangen: 5,
  ohneDatum: 6
}

const ORG_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bPH\s*O[Öö](?:\b|$)/i, label: 'PH OÖ' },
  { re: /\bPH\s*Salzburg\b/i, label: 'PH Salzburg' },
  { re: /\bPH\s*Tirol\b/i, label: 'PH Tirol' },
  { re: /\bPH\s*Steiermark\b/i, label: 'PH Steiermark' },
  { re: /\bPH\s*N[Öö]\b/i, label: 'PH NÖ' },
  { re: /\bPH\s*Wien\b/i, label: 'PH Wien' },
  { re: /\bPH\s*Kärnten\b/i, label: 'PH Kärnten' },
  { re: /\bPH\s*Kaernten\b/i, label: 'PH Kärnten' },
  { re: /\bPH\s*Burgenland\b/i, label: 'PH Burgenland' },
  { re: /\bPHT\b/i, label: 'PHT' },
  { re: /\bPH\s*Vorarlberg\b/i, label: 'PH Vorarlberg' }
]

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

/** Montag 00:00 der ISO-ähnlichen Woche (Mo–So), lokal. */
export function startOfWeekMonday(d: Date): Date {
  const day = startOfLocalDay(d)
  const weekday = (day.getDay() + 6) % 7 // Mo=0 … So=6
  return addDays(day, -weekday)
}

export function hitTimeMs(hit: EventsOsEventHit): number | null {
  if (!hit.date) return null
  const t = Date.parse(hit.date)
  return Number.isFinite(t) ? t : null
}

export function sortHitsByDate(hits: EventsOsEventHit[]): EventsOsEventHit[] {
  return [...hits].sort((a, b) => {
    const ta = hitTimeMs(a)
    const tb = hitTimeMs(b)
    if (ta == null && tb == null) return a.title.localeCompare(b.title, 'de')
    if (ta == null) return 1
    if (tb == null) return -1
    if (ta !== tb) return ta - tb
    return a.title.localeCompare(b.title, 'de')
  })
}

export function extractOrganization(title: string): string {
  const t = String(title || '').trim()
  if (!t) return 'Sonstige'
  for (const { re, label } of ORG_PATTERNS) {
    if (re.test(t)) return label
  }
  const beforeColon = t.split(':')[0]?.trim() || ''
  if (
    beforeColon.length >= 2 &&
    beforeColon.length <= 36 &&
    beforeColon !== t &&
    /[A-Za-zÄÖÜäöüß]/.test(beforeColon)
  ) {
    return beforeColon.replace(/^Webinar\s+/i, '').trim() || 'Sonstige'
  }
  return 'Sonstige'
}

function zeitraumBucket(
  hit: EventsOsEventHit,
  now: Date
): { key: string; label: string; order: number } {
  const ms = hitTimeMs(hit)
  if (ms == null) {
    return { key: 'ohneDatum', label: 'Ohne Datum', order: ZEITRAUM_ORDER.ohneDatum }
  }
  const day = startOfLocalDay(new Date(ms))
  const today = startOfLocalDay(now)
  const tomorrow = addDays(today, 1)
  const weekStart = startOfWeekMonday(today)
  const nextWeekStart = addDays(weekStart, 7)
  const weekAfterNext = addDays(weekStart, 14)

  if (day.getTime() === today.getTime()) {
    return { key: 'heute', label: 'Heute', order: ZEITRAUM_ORDER.heute }
  }
  if (day.getTime() === tomorrow.getTime()) {
    return { key: 'morgen', label: 'Morgen', order: ZEITRAUM_ORDER.morgen }
  }
  if (day < today) {
    return { key: 'vergangen', label: 'Vergangen', order: ZEITRAUM_ORDER.vergangen }
  }
  if (day >= weekStart && day < nextWeekStart) {
    return {
      key: 'dieseWoche',
      label: 'Diese Woche',
      order: ZEITRAUM_ORDER.dieseWoche
    }
  }
  if (day >= nextWeekStart && day < weekAfterNext) {
    return {
      key: 'naechsteWoche',
      label: 'Nächste Woche',
      order: ZEITRAUM_ORDER.naechsteWoche
    }
  }
  return { key: 'spaeter', label: 'Später', order: ZEITRAUM_ORDER.spaeter }
}

function monthBucket(hit: EventsOsEventHit): { key: string; label: string; order: number } {
  const ms = hitTimeMs(hit)
  if (ms == null) {
    return { key: 'ohneDatum', label: 'Ohne Datum', order: Number.MAX_SAFE_INTEGER }
  }
  const d = new Date(ms)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const label = d.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })
  return { key, label, order: d.getFullYear() * 12 + d.getMonth() }
}

function organisationBucket(hit: EventsOsEventHit): {
  key: string
  label: string
  order: number
} {
  const label = extractOrganization(hit.title)
  const key = label.toLocaleLowerCase('de')
  const order = label === 'Sonstige' ? Number.MAX_SAFE_INTEGER : 0
  return { key, label, order }
}

/**
 * Sortiert Treffer nach Datum und gruppiert nach Zeitraum, Monat oder Organisation.
 */
export function groupEventsOsHits(
  hits: EventsOsEventHit[],
  mode: EventsOsGroupMode,
  now: Date = new Date()
): EventsOsHitGroup[] {
  const sorted = sortHitsByDate(hits)
  const map = new Map<string, EventsOsHitGroup>()

  for (const hit of sorted) {
    const bucket =
      mode === 'monat'
        ? monthBucket(hit)
        : mode === 'organisation'
          ? organisationBucket(hit)
          : zeitraumBucket(hit, now)

    const existing = map.get(bucket.key)
    if (existing) {
      existing.items.push(hit)
    } else {
      map.set(bucket.key, {
        key: bucket.key,
        label: bucket.label,
        order: bucket.order,
        items: [hit]
      })
    }
  }

  const groups = [...map.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.label.localeCompare(b.label, 'de')
  })

  // Vergangen: neueste zuerst
  for (const g of groups) {
    if (g.key === 'vergangen') {
      g.items = [...g.items].sort((a, b) => (hitTimeMs(b) ?? 0) - (hitTimeMs(a) ?? 0))
    }
  }

  return groups
}

export function loadEventsOsGroupMode(): EventsOsGroupMode {
  try {
    const v = localStorage.getItem(GROUP_MODE_STORAGE_KEY)
    if (v === 'monat' || v === 'organisation' || v === 'zeitraum') return v
  } catch {
    /* ignore */
  }
  return 'zeitraum'
}

export function saveEventsOsGroupMode(mode: EventsOsGroupMode): void {
  try {
    localStorage.setItem(GROUP_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}
