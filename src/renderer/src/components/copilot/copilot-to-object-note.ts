import type {
  CopilotChatMessageAttribution,
  CopilotRetrievalHit,
  UserNote
} from '@shared/types'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { buildCopilotSourcePills } from '@/components/copilot/copilot-sources'
import { preprocessCopilotMarkdown } from '@/components/copilot/copilot-markdown'
import { marked } from 'marked'
import {
  prepareNoteBodyForEditor,
  storedBodyFromEditorHtml
} from '@/lib/note-body-html'
import { prepareNoteEditorHtml } from '@/lib/sanitize-compose-html'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function appendHtmlToBody(existingBody: string, snippetHtml: string): string {
  const prepared = prepareNoteBodyForEditor(existingBody).html
  if (!prepared.trim()) return snippetHtml
  return `${prepared}<hr><p></p>${snippetHtml}`
}

/** Copilot-Markdown → Notiz-HTML (ohne interne #copilot-cite-Anker). */
export function copilotReplyToNoteHtml(markdown: string): string {
  let text = preprocessCopilotMarkdown(markdown)
  if (!text) return ''
  // Hochzahlen-Anker entfernen; Quellen kommen separat als echte Links.
  text = text.replace(/<sup class="copilot-cite">[\s\S]*?<\/sup>/g, '')
  text = text.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim()
  const parsed = marked.parse(text, { async: false, breaks: true, gfm: true })
  const html = typeof parsed === 'string' ? parsed : ''
  return prepareNoteEditorHtml(html)
}

export function buildCopilotSourcesNoteHtml(input: {
  attributions: CopilotChatMessageAttribution[]
  replyText: string
  hits?: CopilotRetrievalHit[] | null
  sourcesHeading: string
}): string {
  const pills = buildCopilotSourcePills(input.attributions, input.replyText)
  const items: string[] = []
  const seen = new Set<string>()

  for (const pill of pills) {
    if (pill.url) {
      const key = pill.url.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push(
        `<li><a href="${escapeHtml(pill.url)}">${escapeHtml(`${pill.index}. ${pill.label}`)}</a></li>`
      )
    } else {
      items.push(`<li>${escapeHtml(`${pill.index}. ${pill.label}`)}</li>`)
    }
  }

  for (const hit of input.hits ?? []) {
    const url = hit.resourceUrl?.trim()
    if (!url) continue
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const label = (hit.resourceTitle?.trim() || url).trim()
    items.push(`<li><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></li>`)
  }

  if (items.length === 0) return ''
  return `<p><strong>${escapeHtml(input.sourcesHeading)}</strong></p><ul>${items.join('')}</ul>`
}

export function buildCopilotNoteSnippetHtml(input: {
  replyText: string
  attributions: CopilotChatMessageAttribution[]
  hits?: CopilotRetrievalHit[] | null
  heading: string
  sourcesHeading: string
}): string {
  const body = copilotReplyToNoteHtml(input.replyText)
  const sources = buildCopilotSourcesNoteHtml({
    attributions: input.attributions,
    replyText: input.replyText,
    hits: input.hits,
    sourcesHeading: input.sourcesHeading
  })
  const head = `<p><strong>${escapeHtml(input.heading)}</strong></p>`
  return prepareNoteEditorHtml(`${head}${body}${sources}`)
}

async function loadNoteForTarget(target: ObjectNoteTarget): Promise<UserNote | null> {
  if (target.kind === 'mail') return window.mailClient.notes.getMail(target.messageId)
  if (target.kind === 'people_contact') {
    return window.mailClient.notes.getPeopleContact(target.contactId)
  }
  return window.mailClient.notes.getCalendar({
    accountId: target.accountId,
    calendarSource: target.calendarSource,
    calendarRemoteId: target.calendarRemoteId,
    eventRemoteId: target.eventRemoteId
  })
}

async function saveNoteForTarget(target: ObjectNoteTarget, editorHtml: string): Promise<UserNote> {
  const body = storedBodyFromEditorHtml(editorHtml)
  if (target.kind === 'mail') {
    return window.mailClient.notes.upsertMail({
      messageId: target.messageId,
      title: target.title ?? null,
      body
    })
  }
  if (target.kind === 'people_contact') {
    return window.mailClient.notes.upsertPeopleContact({
      contactId: target.contactId,
      title: target.title ?? null,
      body
    })
  }
  return window.mailClient.notes.upsertCalendar({
    accountId: target.accountId,
    calendarSource: target.calendarSource,
    calendarRemoteId: target.calendarRemoteId,
    eventRemoteId: target.eventRemoteId,
    title: target.title ?? null,
    body,
    eventTitleSnapshot: target.eventTitleSnapshot ?? target.title ?? null,
    eventStartIsoSnapshot: target.eventStartIsoSnapshot ?? null
  })
}

/** Copilot-/Work-IQ-Antwort an die gebundene Chronell-Objektnotiz anhängen. */
export async function appendCopilotReplyToObjectNote(input: {
  target: ObjectNoteTarget
  replyText: string
  attributions: CopilotChatMessageAttribution[]
  hits?: CopilotRetrievalHit[] | null
  heading: string
  sourcesHeading: string
}): Promise<UserNote> {
  const snippet = buildCopilotNoteSnippetHtml({
    replyText: input.replyText,
    attributions: input.attributions,
    hits: input.hits,
    heading: input.heading,
    sourcesHeading: input.sourcesHeading
  })
  if (!snippet.trim()) {
    throw new Error('empty_copilot_snippet')
  }
  const existing = await loadNoteForTarget(input.target)
  const combined = appendHtmlToBody(existing?.body ?? '', snippet)
  return saveNoteForTarget(input.target, combined)
}
