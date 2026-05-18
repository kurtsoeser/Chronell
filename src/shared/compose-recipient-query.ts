const COMPLETE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Suchanfrage fuer Empfaenger-Vorschlaege: aus «Name <a@b.c>» nur die Adresse;
 * verwaiste schliessende «>» (ohne «<») entfernen.
 */
export function normalizeRecipientSuggestionQuery(query: string): string {
  const t = query.trim()
  if (!t) return ''

  const angleMatch = t.match(/^(.*?)<([^>]+)>?\s*$/)
  if (angleMatch) {
    const address = angleMatch[2]?.trim() ?? ''
    if (COMPLETE_EMAIL_RE.test(address)) return address
  }

  const withoutOrphanGt = t.includes('<') ? t : t.replace(/>\s*$/g, '').trim()
  if (COMPLETE_EMAIL_RE.test(withoutOrphanGt)) return withoutOrphanGt

  return t
}

export function isCompleteEmailQuery(query: string): boolean {
  return COMPLETE_EMAIL_RE.test(normalizeRecipientSuggestionQuery(query))
}

/**
 * Query fuer Microsoft Graph `/me/people` `$search`.
 * Vollstaendige E-Mails und Zeichen wie «.» «@» «<» sind dort ungueltig.
 * Gibt `null` zurueck, wenn Graph-People-Suche uebersprungen werden soll.
 */
export function graphPeopleSearchQuery(query: string): string | null {
  const normalized = normalizeRecipientSuggestionQuery(query)
  if (!normalized) return null
  if (isCompleteEmailQuery(normalized)) return null

  const t = normalized
  if (/[<>"\\]/.test(t)) return null

  if (t.includes('@')) {
    const local = t.split('@')[0]?.trim() ?? ''
    if (!local) return null
    const terms = local.replace(/[.@]+/g, ' ').replace(/\s+/g, ' ').trim()
    return terms.length >= 1 ? terms : null
  }

  if (t.includes('.')) {
    const terms = t.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
    return terms.length >= 1 ? terms : null
  }

  return t
}
