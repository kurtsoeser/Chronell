/** Rich-Text-Segmente (Text + Mentions) zu einem Anzeige-/Such-Titel zusammenfuehren. */
export function richTextSegmentsToPlain(
  segments: Array<{ plain_text?: string | null }> | null | undefined
): string {
  if (!Array.isArray(segments) || segments.length === 0) return ''
  return segments
    .map((s) => (typeof s?.plain_text === 'string' ? s.plain_text : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Suchquery parsen.
 * - Umschliessende Anfuehrungszeichen → Phrasensuche (Substring, clientseitig).
 * - Sonst Token-Suche (alle Woerter muessen im Titel vorkommen).
 * Notion selbst behandelt "…" nicht als Exact Match.
 */
export function parseNotionSearchQuery(raw: string): {
  apiQuery: string
  /** Wenn gesetzt: Titel muss diese zusammenhaengende Phrase enthalten. */
  phrase: string | null
  tokens: string[]
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { apiQuery: '', phrase: null, tokens: [] }
  }

  // Gerade und typografische Anfuehrungszeichen (DE: „…“, EN: “…”, «…»).
  const quoted = trimmed.match(/^[\"„“«]([\s\S]+)[\"”“»]$/)
  if (quoted) {
    const phrase = quoted[1].replace(/\s+/g, ' ').trim()
    return {
      apiQuery: phrase,
      phrase: phrase || null,
      tokens: []
    }
  }

  const cleaned = trimmed
    .replace(/[\"„“”«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  return { apiQuery: cleaned, phrase: null, tokens }
}

export function notionTitleMatchesQuery(
  title: string,
  parsed: ReturnType<typeof parseNotionSearchQuery>
): boolean {
  const t = title.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (parsed.phrase) {
    return t.includes(parsed.phrase.toLowerCase())
  }
  if (parsed.tokens.length === 0) return true
  return parsed.tokens.every((tok) => t.includes(tok))
}

/** Plain-Text → einfache HTML-Absätze (z. B. Notion-Beschreibung → Webinar-Supplement). */
export function plainTextToWebinarSupplementHtml(text: string): string {
  const raw = text.replace(/\r\n/g, '\n').trim()
  if (!raw) return ''
  const escape = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((l) => escape(l.trim()))
        .filter(Boolean)
      if (lines.length === 0) return ''
      return `<p>${lines.join('<br/>')}</p>`
    })
    .filter(Boolean)
    .join('\n')
}
