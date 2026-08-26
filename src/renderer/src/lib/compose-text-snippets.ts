import { sanitizeComposeHtmlFragment, prepareComposeOutgoingHtmlFragment } from '@/lib/sanitize-compose-html'

const STORAGE_KEY = 'mailclient.composeTextSnippets.v1'

export interface ComposeTextSnippet {
  id: string
  name: string
  html: string
  updatedAt: string
  /** Eingebaute Vorlage — nicht löschbar, nur einfügbar. */
  builtin?: boolean
}

export function newComposeTextSnippetId(): string {
  return `snippet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const BUILTIN_COMPOSE_TEXT_SNIPPETS: readonly ComposeTextSnippet[] = [
  {
    id: 'builtin-greeting-formal',
    name: 'Anrede (formell)',
    html: '<blockquote><p>Sehr geehrte Damen und Herren,</p></blockquote><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-greeting-neutral',
    name: 'Anrede (neutral)',
    html: '<blockquote><p>Guten Tag,</p></blockquote><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-greeting-informal',
    name: 'Anrede (informell)',
    html: '<blockquote><p>Hallo,</p></blockquote><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-greeting-team',
    name: 'Anrede (Team)',
    html: '<blockquote><p>Liebes Team,</p></blockquote><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-greeting-en',
    name: 'Greeting (English)',
    html: '<blockquote><p>Dear Sir or Madam,</p></blockquote><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-thanks-reply',
    name: 'Dank für Nachricht',
    html: '<p>Vielen Dank für Ihre Nachricht.</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-thanks-quick',
    name: 'Dank (schnelle Rückmeldung)',
    html: '<p>Vielen Dank für Ihre schnelle Rückmeldung.</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-as-discussed',
    name: 'Wie besprochen',
    html: '<p>Wie besprochen sende ich Ihnen …</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-attachment',
    name: 'Anhang',
    html: '<p>Anbei erhalten Sie …</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-follow-up',
    name: 'Rückmeldung erbeten',
    html: '<p>Bitte um kurze Rückmeldung bis …</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-follow-up-later',
    name: 'Melde mich später',
    html: '<p>Ich melde mich, sobald ich mehr weiß.</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-closing-formal',
    name: 'Gruß (formell)',
    html: '<p>Mit freundlichen Grüßen</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-closing-friendly',
    name: 'Gruß (freundlich)',
    html: '<p>Freundliche Grüße</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-closing-best',
    name: 'Beste Grüße',
    html: '<p>Beste Grüße</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-closing-weekend',
    name: 'Schönes Wochenende',
    html: '<p>Schönes Wochenende und vielen Dank!</p><p></p>',
    updatedAt: '',
    builtin: true
  },
  {
    id: 'builtin-closing-en',
    name: 'Closing (English)',
    html: '<p>Best regards</p><p></p>',
    updatedAt: '',
    builtin: true
  }
] as const

function sortByName(snippets: ComposeTextSnippet[]): ComposeTextSnippet[] {
  return [...snippets].sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

function readCustomSnippets(): ComposeTextSnippet[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: ComposeTextSnippet[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const id = typeof r.id === 'string' ? r.id : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const html = typeof r.html === 'string' ? r.html : ''
      const updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : ''
      if (!id || !name || !html.trim()) continue
      out.push({
        id,
        name,
        html: sanitizeComposeHtmlFragment(html),
        updatedAt
      })
    }
    return sortByName(out)
  } catch {
    return []
  }
}

function persistCustomSnippets(snippets: ComposeTextSnippet[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets))
  } catch {
    // ignore
  }
}

export function loadCustomComposeTextSnippets(): ComposeTextSnippet[] {
  return readCustomSnippets()
}

export function upsertCustomComposeTextSnippet(
  snippets: ComposeTextSnippet[],
  entry: { id?: string; name: string; html: string }
): ComposeTextSnippet[] {
  const html = sanitizeComposeHtmlFragment(entry.html)
  const now = new Date().toISOString()
  const id = entry.id ?? newComposeTextSnippetId()
  const idx = snippets.findIndex((s) => s.id === id)
  if (idx >= 0) {
    const next = [...snippets]
    next[idx] = { ...next[idx], name: entry.name.trim(), html, updatedAt: now }
    return sortByName(next)
  }
  return sortByName([...snippets, { id, name: entry.name.trim(), html, updatedAt: now }])
}

export function removeCustomComposeTextSnippet(
  snippets: ComposeTextSnippet[],
  snippetId: string
): ComposeTextSnippet[] {
  return snippets.filter((s) => s.id !== snippetId)
}

export function saveCustomComposeTextSnippets(snippets: ComposeTextSnippet[]): void {
  persistCustomSnippets(snippets)
}

/** Plain-Text oder HTML in sicheres Compose-HTML umwandeln. */
export function textToComposeSnippetHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return '<p></p>'
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return prepareComposeOutgoingHtmlFragment(trimmed)
  }
  const paras = trimmed.split(/\n\n+/).filter(Boolean)
  if (paras.length === 0) return '<p></p>'
  return prepareComposeOutgoingHtmlFragment(
    paras
      .map((p) => {
        const inner = p
          .split('\n')
          .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
          .join('<br>')
        return `<p>${inner}</p>`
      })
      .join('')
  )
}
