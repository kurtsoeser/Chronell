import type { CopilotChatMessageAttribution } from '@shared/types'

export interface CopilotSourcePill {
  index: number
  label: string
  url: string | null
}

/** Attributionen bereinigen, deduplizieren und 1-basiert nummerieren. */
export function buildCopilotSourcePills(
  attributions: CopilotChatMessageAttribution[],
  replyText?: string | null
): CopilotSourcePill[] {
  const seen = new Set<string>()
  const pills: CopilotSourcePill[] = []

  // Citations bevorzugen; Annotationen nur wenn keine Citations
  const citations = attributions.filter(
    (a) => (a.attributionType || '').toLowerCase() === 'citation'
  )
  const pool = citations.length > 0 ? citations : attributions

  for (const a of pool) {
    const url = a.seeMoreWebUrl?.trim() || null
    const label = (a.providerDisplayName?.trim() || url || '').trim()
    if (!label && !url) continue
    const key = (url || label).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    pills.push({
      index: pills.length + 1,
      label: shortenSourceLabel(label || `Quelle ${pills.length + 1}`),
      url
    })
  }

  if (pills.length > 0) return pills

  // Markdown-Links aus dem Antworttext
  const text = replyText ?? ''
  for (const m of text.matchAll(/\[([^\]]{0,120})\]\((https?:\/\/[^)\s]+)\)/gi)) {
    const rawLabel = m[1]?.trim() || ''
    const url = m[2]?.trim() || null
    if (!url) continue
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const label =
      rawLabel && !/^\d{1,2}$/.test(rawLabel) ? rawLabel : shortenSourceLabel(url)
    pills.push({
      index: pills.length + 1,
      label: shortenSourceLabel(label),
      url
    })
  }
  if (pills.length > 0) return pills

  // Fallback: Zitationsnummern aus dem Text (ohne URL — trotzdem sichtbar)
  const indices = new Set<number>()
  for (const m of text.matchAll(/\[\^(\d{1,2})\^\]/g)) {
    indices.add(Number(m[1]))
  }
  for (const m of text.matchAll(/([.!?…»"”)\]'])\s+(\d{1,6})(?=\s|$)/g)) {
    const digits = m[2]
    if (digits.length >= 4) continue
    for (const d of digits) indices.add(Number(d))
  }
  return [...indices]
    .filter((n) => n >= 1 && n <= 40)
    .sort((a, b) => a - b)
    .map((index) => ({
      index,
      label: `Quelle ${index}`,
      url: null
    }))
}

function shortenSourceLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return 'Quelle'
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed)
      const path = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
      if (path && path.length > 2) return path.slice(0, 48)
      return u.hostname
    }
  } catch {
    // ignore
  }
  return trimmed.length > 56 ? `${trimmed.slice(0, 53)}…` : trimmed
}

/**
 * Copilot/Work IQ Fußnoten `[^1^]` und lose Ziffern nach Satzende → hochgestellte Anker.
 * Mehrstellige Folgen wie `23` werden als einzelne Ziffern 2,3 interpretiert (Copilot-Stil).
 */
export function linkifyCopilotCitationMarkers(markdown: string): string {
  let text = markdown
  text = text.replace(/\[\^(\d{1,2})\^\]/g, (_, n: string) => `[^cite:${n}]`)
  // Nach Satzzeichen: einzelne Ziffer oder Ziffernfolge (jede Ziffer = eine Quelle)
  text = text.replace(/([.!?…»"”)\]'])\s+(\d{1,6})(?=\s|$)/g, (full, punct: string, digits: string) => {
    if (digits.length >= 4) return full // eher Jahreszahl o.ä.
    const marks = [...digits].map((d) => `[^cite:${d}]`).join('')
    return `${punct} ${marks}`
  })
  text = text.replace(
    /\[\^cite:(\d{1,2})\]/g,
    '<sup class="copilot-cite"><a href="#copilot-cite-$1">$1</a></sup>'
  )
  return text
}
