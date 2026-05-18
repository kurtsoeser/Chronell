import type { MailListItem } from '@shared/types'

export function messageListDateIso(m: MailListItem): string | null {
  const iso = m.receivedAt ?? m.sentAt
  return iso && iso.trim().length > 0 ? iso : null
}

export function messageHasFrom(m: MailListItem): boolean {
  return Boolean(m.fromName?.trim() || m.fromAddr?.trim())
}

export function messageHasSubject(m: MailListItem): boolean {
  return Boolean(m.subject?.trim())
}

/** Hoeher = besser fuer Listen-Anzeige (Absender, Betreff, Datum, Snippet). */
export function messageDisplayScore(m: MailListItem): number {
  let score = 0
  if (messageHasFrom(m)) score += 4
  if (messageHasSubject(m)) score += 4
  if (messageListDateIso(m)) score += 2
  if (m.snippet?.trim()) score += 1
  return score
}

export function compareMessageChronoAsc(a: MailListItem, b: MailListItem): number {
  const ad = a.receivedAt ?? a.sentAt ?? ''
  const bd = b.receivedAt ?? b.sentAt ?? ''
  if (ad === bd) return a.id - b.id
  if (!ad) return 1
  if (!bd) return -1
  return ad < bd ? -1 : 1
}

export function compareMessageChronoDesc(a: MailListItem, b: MailListItem): number {
  return -compareMessageChronoAsc(a, b)
}

/**
 * Ursprungsmail fuer Thread-Kopf: chronologisch aelteste Mail mit brauchbaren Metadaten.
 */
export function pickThreadRootMessage(messages: MailListItem[]): MailListItem {
  if (messages.length === 0) {
    throw new Error('pickThreadRootMessage: empty')
  }
  const sorted = [...messages].sort(compareMessageChronoAsc)
  const rich = sorted.filter((m) => messageHasFrom(m) && messageHasSubject(m))
  if (rich.length > 0) return rich[0]!
  const withFrom = sorted.filter(messageHasFrom)
  if (withFrom.length > 0) return withFrom[0]!
  const withSubject = sorted.filter(messageHasSubject)
  if (withSubject.length > 0) return withSubject[0]!
  return sorted[0]!
}

/**
 * Neueste Mail fuer Sortierung/Vorschau: bevorzugt Datum, dann vollstaendige Metadaten.
 */
export function pickThreadLatestMessage(messages: MailListItem[]): MailListItem {
  if (messages.length === 0) {
    throw new Error('pickThreadLatestMessage: empty')
  }
  const sorted = [...messages].sort(compareMessageChronoDesc)
  const withDate = sorted.filter((m) => messageListDateIso(m))
  const pool = withDate.length > 0 ? withDate : sorted
  return pool.reduce((best, m) => (messageDisplayScore(m) > messageDisplayScore(best) ? m : best), pool[0]!)
}
