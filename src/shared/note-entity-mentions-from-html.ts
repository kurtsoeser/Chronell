import type { NoteEntityLinkTarget } from './note-entity-links'
import { noteEntityLinkTargetKey } from './note-entity-links'
import { parseNoteEntityMentionHref, normalizeChronellLinkHref } from './note-entity-mention-link'
import { parseNoteWikiLinkHref } from './note-wiki-link'

export interface NoteBodyEntityMention {
  target: NoteEntityLinkTarget
  title: string
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

/** Liest @-Erwähnungen und Wiki-Links aus gespeichertem Notiz-HTML. */
export function collectNoteEntityMentionsFromHtml(html: string): NoteBodyEntityMention[] {
  const trimmed = html.trim()
  if (!trimmed) return []

  const out: NoteBodyEntityMention[] = []
  const seen = new Set<string>()
  const anchorRe = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorRe.exec(trimmed)) !== null) {
    const href = normalizeChronellLinkHref(match[1] ?? '')
    const inner = match[2] ?? ''
    let target = parseNoteEntityMentionHref(href)
    if (!target) {
      const noteId = parseNoteWikiLinkHref(href)
      if (noteId != null) target = { kind: 'note', noteId }
    }
    if (!target) continue

    const key = noteEntityLinkTargetKey(target)
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      target,
      title: stripHtml(inner) || '—'
    })
  }

  return out
}
