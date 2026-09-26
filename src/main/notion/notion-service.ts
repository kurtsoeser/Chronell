import type {
  CalendarEventView,
  MailFull,
  NotionAppendResult,
  NotionConnectionStatus,
  NotionCreatePageResult,
  NotionSearchPageHit
} from '@shared/types'
import {
  notionTitleMatchesQuery,
  parseNotionSearchQuery,
  richTextSegmentsToPlain
} from '@shared/notion-search'
import { loginNotion } from '../auth/notion-oauth'
import { loadConfig } from '../config'
import { getMessageById } from '../db/messages-repo'
import {
  buildCalendarEventNotionBlocks,
  buildMailNotionBlocks,
  buildNoteNotionBlocks
} from './notion-blocks'
import { getNoteById } from '../db/user-notes-repo'
import { fetchCalendarEventDescription } from './notion-calendar-description'
import {
  buildNotionAttachmentSectionBlocks,
  uploadMailAttachmentsToNotion
} from './notion-mail-attachments'
import { resolveMailWebLink } from './mail-web-link'
import { notionJson } from './notion-client'
import {
  readNotionDestinations,
  touchNotionDestinationUsed,
  writeNotionDestinations,
  type NotionDestinationsConfig,
  type NotionSavedDestination
} from './notion-destinations-store'
import {
  clearNotionInternalToken,
  readNotionInternalToken,
  writeNotionInternalToken
} from './notion-internal-token-store'
import { clearNotionTokens, readNotionTokens, writeNotionTokens } from './notion-token-store'
import { clearKurtrocksEventsDatabaseCache } from './notion-kurtrocks-events'

interface NotionSearchResponse {
  results: Array<{
    object: string
    id: string
    url?: string
    created_time?: string
    last_edited_time?: string
    icon?: { type: string; emoji?: string; external?: { url: string } } | null
    properties?: Record<string, unknown>
    title?: Array<{ plain_text?: string }>
  }>
  has_more: boolean
  next_cursor: string | null
}

function pageTitleFromResult(r: NotionSearchResponse['results'][number]): string {
  const fromRoot = richTextSegmentsToPlain(r.title)
  if (fromRoot) return fromRoot

  const props = r.properties
  if (props && typeof props === 'object') {
    for (const val of Object.values(props)) {
      if (val && typeof val === 'object' && 'title' in val) {
        const titles = (val as { title?: Array<{ plain_text?: string }> }).title
        const plain = richTextSegmentsToPlain(titles)
        if (plain) return plain
      }
    }
  }
  return 'Unbenannte Seite'
}

async function fetchNotionSearchPage(
  query: string | undefined,
  pageSize: number,
  startCursor?: string | null
): Promise<NotionSearchResponse> {
  return notionJson<NotionSearchResponse>('/search', {
    method: 'POST',
    body: JSON.stringify({
      query: query || undefined,
      filter: { value: 'page', property: 'object' },
      page_size: pageSize,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      start_cursor: startCursor ?? undefined
    })
  })
}

function mapSearchHits(results: NotionSearchResponse['results']): NotionSearchPageHit[] {
  const hits: NotionSearchPageHit[] = []
  for (const r of results) {
    if (r.object !== 'page' || !r.id) continue
    hits.push({
      id: r.id,
      title: pageTitleFromResult(r),
      url: r.url ?? null,
      icon: iconFromResult(r),
      kind: 'page',
      createdTime: r.created_time ?? null,
      lastEditedTime: r.last_edited_time ?? null
    })
  }
  return hits
}

export async function searchNotionPages(
  query: string,
  options?: { maxResults?: number }
): Promise<NotionSearchPageHit[]> {
  const parsed = parseNotionSearchQuery(query)
  const q = parsed.apiQuery
  const maxResults = Math.min(Math.max(options?.maxResults ?? (q ? 40 : 75), 1), 100)

  // Ohne Query: nur Recent-Pool.
  if (!q) {
    const hits: NotionSearchPageHit[] = []
    let cursor: string | null = null
    do {
      const pageSize = Math.min(100, maxResults - hits.length)
      const data = await fetchNotionSearchPage(undefined, pageSize, cursor)
      hits.push(...mapSearchHits(data.results))
      cursor =
        data.has_more && data.next_cursor && hits.length < maxResults ? data.next_cursor : null
    } while (cursor)
    return hits.slice(0, maxResults)
  }

  // Mit Query: Notion-Suche + lokaler Titel-Filter auf Recent-Pool
  // (Mentions im Titel, Tippfehler-Naehe, Phrasen mit Anfuehrungszeichen).
  const [apiHits, recentHits] = await Promise.all([
    (async (): Promise<NotionSearchPageHit[]> => {
      const data = await fetchNotionSearchPage(q, Math.min(100, maxResults))
      return mapSearchHits(data.results)
    })(),
    (async (): Promise<NotionSearchPageHit[]> => {
      const hits: NotionSearchPageHit[] = []
      let cursor: string | null = null
      const poolMax = 75
      do {
        const pageSize = Math.min(100, poolMax - hits.length)
        const data = await fetchNotionSearchPage(undefined, pageSize, cursor)
        hits.push(...mapSearchHits(data.results))
        cursor =
          data.has_more && data.next_cursor && hits.length < poolMax ? data.next_cursor : null
      } while (cursor)
      return hits
    })()
  ])

  const byId = new Map<string, NotionSearchPageHit>()
  for (const hit of apiHits) {
    byId.set(hit.id, hit)
  }
  for (const hit of recentHits) {
    if (notionTitleMatchesQuery(hit.title, parsed) && !byId.has(hit.id)) {
      byId.set(hit.id, hit)
    }
  }

  // Bei Phrasensuche: API-Treffer ohne Phrase im (vollen) Titel ausblenden.
  if (parsed.phrase) {
    for (const [id, hit] of [...byId.entries()]) {
      if (!notionTitleMatchesQuery(hit.title, parsed)) byId.delete(id)
    }
  }

  const merged = [...byId.values()]
  const qLower = q.toLowerCase()
  merged.sort((a, b) => {
    const at = a.title.toLowerCase()
    const bt = b.title.toLowerCase()
    const aStarts = at.startsWith(qLower) ? 0 : at.includes(qLower) ? 1 : 2
    const bStarts = bt.startsWith(qLower) ? 0 : bt.includes(qLower) ? 1 : 2
    if (aStarts !== bStarts) return aStarts - bStarts
    const ae = a.lastEditedTime ? Date.parse(a.lastEditedTime) : 0
    const be = b.lastEditedTime ? Date.parse(b.lastEditedTime) : 0
    return be - ae
  })

  return merged.slice(0, maxResults)
}

function iconFromResult(r: NotionSearchResponse['results'][number]): string | null {
  if (!r.icon) return null
  if (r.icon.type === 'emoji' && r.icon.emoji) return r.icon.emoji
  if (r.icon.type === 'external' && r.icon.external?.url) return r.icon.external.url
  return null
}

export async function getNotionConnectionStatus(): Promise<NotionConnectionStatus> {
  const config = await loadConfig()
  const hasCredentials = Boolean(
    config.notionClientId?.trim() && config.notionClientSecret?.trim()
  )

  const internal = await readNotionInternalToken()
  if (internal) {
    return {
      connected: true,
      authMode: 'internal',
      hasCredentials: true,
      workspaceName: 'Interne Integration',
      workspaceIcon: null,
      ownerName: null
    }
  }

  const tokens = await readNotionTokens()
  if (!tokens) {
    return {
      connected: false,
      authMode: 'none',
      hasCredentials,
      workspaceName: null,
      workspaceIcon: null,
      ownerName: null
    }
  }
  const ownerName =
    tokens.owner?.user?.name?.trim() ||
    tokens.owner?.user?.id ||
    null
  return {
    connected: true,
    authMode: 'oauth',
    hasCredentials,
    workspaceName: tokens.workspace_name,
    workspaceIcon: tokens.workspace_icon,
    ownerName,
    botId: tokens.bot_id,
    workspaceId: tokens.workspace_id
  }
}

export async function connectNotion(): Promise<NotionConnectionStatus> {
  const config = await loadConfig()
  const clientId = config.notionClientId?.trim() ?? ''
  const clientSecret = config.notionClientSecret?.trim() ?? ''
  if (!clientId || !clientSecret) {
    throw new Error(
      'Notion OAuth: Client-ID und Client-Secret in den Einstellungen eintragen (Public Integration).'
    )
  }
  await clearNotionInternalToken()
  const tokens = await loginNotion(clientId, clientSecret)
  await writeNotionTokens(tokens)
  return getNotionConnectionStatus()
}

export async function connectNotionInternal(integrationToken: string): Promise<NotionConnectionStatus> {
  const token = integrationToken.trim()
  if (!token) {
    throw new Error('Notion: Integrations-Token fehlt.')
  }
  await clearNotionTokens()
  await writeNotionInternalToken(token)
  try {
    await notionJson<{ object?: string }>('/users/me')
  } catch (e) {
    await clearNotionInternalToken()
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Notion-Token ungueltig oder Seiten nicht freigegeben: ${msg}`)
  }
  return getNotionConnectionStatus()
}

export async function disconnectNotion(): Promise<NotionConnectionStatus> {
  await clearNotionTokens()
  await clearNotionInternalToken()
  clearKurtrocksEventsDatabaseCache()
  return getNotionConnectionStatus()
}

export async function getNotionDestinations(): Promise<NotionDestinationsConfig> {
  return readNotionDestinations()
}

export async function setNotionDestinations(config: NotionDestinationsConfig): Promise<void> {
  await writeNotionDestinations(config)
}

function notionTitleProperty(title: string): Record<string, unknown> {
  const content = title.trim().slice(0, 2000) || 'Neue Seite'
  return {
    title: {
      title: [{ type: 'text', text: { content } }]
    }
  }
}

async function createNotionPageUnderParent(
  title: string,
  parentPageId: string
): Promise<NotionCreatePageResult> {
  const page = await notionJson<{ id: string; url?: string }>('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { page_id: parentPageId },
      properties: notionTitleProperty(title)
    })
  })
  if (!page.id?.trim()) {
    throw new Error('Notion hat keine Seiten-ID zurueckgegeben.')
  }
  const pageUrl = page.url ?? `https://www.notion.so/${page.id.replace(/-/g, '')}`
  return { pageId: page.id, pageUrl }
}

async function createNotionPageAtWorkspace(title: string): Promise<NotionCreatePageResult> {
  const page = await notionJson<{ id: string; url?: string }>('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { workspace: true },
      properties: notionTitleProperty(title)
    })
  })
  if (!page.id?.trim()) {
    throw new Error('Notion hat keine Seiten-ID zurueckgegeben.')
  }
  const pageUrl = page.url ?? `https://www.notion.so/${page.id.replace(/-/g, '')}`
  return { pageId: page.id, pageUrl }
}

function resolveNewPageParentCandidates(
  cfg: NotionDestinationsConfig,
  kind: 'mail' | 'calendar' | 'note',
  explicitParent?: string | null
): string[] {
  const out: string[] = []
  const add = (id: string | null | undefined): void => {
    const t = id?.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  add(explicitParent)
  add(cfg.newPageParentId)
  if (kind === 'calendar') {
    add(cfg.defaultCalendarPageId)
  } else {
    add(cfg.defaultMailPageId)
  }
  add(cfg.lastUsedPageId)
  for (const f of cfg.favorites) add(f.id)
  return out
}

export async function createNotionPage(
  title: string,
  parentPageId?: string | null,
  kind: 'mail' | 'calendar' | 'note' = 'mail'
): Promise<NotionCreatePageResult> {
  const cfg = await readNotionDestinations()
  const explicit = parentPageId?.trim()
  if (explicit) {
    return createNotionPageUnderParent(title, explicit)
  }

  const parentCandidates = resolveNewPageParentCandidates(cfg, kind, null)
  let lastErr: unknown
  for (const parentId of parentCandidates) {
    try {
      return await createNotionPageUnderParent(title, parentId)
    } catch (e) {
      lastErr = e
    }
  }

  try {
    return await createNotionPageAtWorkspace(title)
  } catch (workspaceErr) {
    const msg =
      workspaceErr instanceof Error
        ? workspaceErr.message
        : lastErr instanceof Error
          ? lastErr.message
          : String(workspaceErr)
    throw new Error(
      `Neue Notion-Seite konnte nicht erstellt werden: ${msg}. ` +
        'In den Einstellungen eine uebergeordnete Seite als Favorit hinterlegen oder die Integration mit der Zielseite verbinden.'
    )
  }
}

async function appendBlocksToPage(pageId: string, children: unknown[]): Promise<string> {
  await notionJson(`/blocks/${pageId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children })
  })
  const pages = await notionJson<{ url?: string }>(`/pages/${pageId}`)
  return pages.url ?? `https://www.notion.so/${pageId.replace(/-/g, '')}`
}

function resolveTargetPageId(
  pageId: string | null | undefined,
  cfg: NotionDestinationsConfig,
  kind: 'mail' | 'calendar' | 'note'
): string {
  const explicit = pageId?.trim()
  if (explicit) return explicit
  const fallback =
    kind === 'calendar' ? cfg.defaultCalendarPageId : cfg.defaultMailPageId
  const last = cfg.lastUsedPageId
  const id = fallback?.trim() || last?.trim()
  if (!id) {
    throw new Error(
      'Kein Notion-Ziel gewählt. Bitte in den Einstellungen eine Standardseite setzen oder ein Ziel wählen.'
    )
  }
  return id
}

async function appendMailBlocksToPage(
  mail: MailFull,
  targetId: string,
  webLink?: string | null
): Promise<string> {
  const { uploads, skipped } = await uploadMailAttachmentsToNotion(mail)
  const attachmentBlocks = buildNotionAttachmentSectionBlocks(uploads, skipped)
  const resolvedWebLink = await resolveMailWebLink(mail, webLink)
  const blocks = buildMailNotionBlocks(mail, resolvedWebLink, attachmentBlocks)
  return appendBlocksToPage(targetId, blocks)
}

export async function appendMailToNotion(
  messageId: number,
  pageId?: string | null,
  webLink?: string | null
): Promise<NotionAppendResult> {
  const mail = getMessageById(messageId)
  if (!mail) {
    throw new Error('Mail nicht gefunden.')
  }
  const cfg = await readNotionDestinations()
  const targetId = resolveTargetPageId(pageId, cfg, 'mail')
  const pageUrl = await appendMailBlocksToPage(mail, targetId, webLink)
  await touchNotionDestinationUsed(targetId)
  return { pageId: targetId, pageUrl }
}

export async function createMailAsNotionPage(
  messageId: number,
  title: string,
  parentPageId?: string | null,
  webLink?: string | null
): Promise<NotionAppendResult> {
  const mail = getMessageById(messageId)
  if (!mail) {
    throw new Error('Mail nicht gefunden.')
  }
  const pageTitle = title.trim() || mail.subject?.trim() || '(Ohne Betreff)'
  const created = await createNotionPage(pageTitle, parentPageId, 'mail')
  const pageUrl = await appendMailBlocksToPage(mail, created.pageId, webLink)
  await touchNotionDestinationUsed(created.pageId)
  return { pageId: created.pageId, pageUrl }
}

async function appendCalendarEventBlocksToPage(
  event: CalendarEventView,
  targetId: string,
  localeCode: 'de' | 'en'
): Promise<string> {
  const description = await fetchCalendarEventDescription(event)
  const blocks = buildCalendarEventNotionBlocks(event, localeCode, description)
  return appendBlocksToPage(targetId, blocks)
}

export async function appendCalendarEventToNotion(
  event: CalendarEventView,
  pageId?: string | null,
  localeCode: 'de' | 'en' = 'de'
): Promise<NotionAppendResult> {
  const cfg = await readNotionDestinations()
  const targetId = resolveTargetPageId(pageId, cfg, 'calendar')
  const pageUrl = await appendCalendarEventBlocksToPage(event, targetId, localeCode)
  await touchNotionDestinationUsed(targetId)
  return { pageId: targetId, pageUrl }
}

export async function createCalendarEventAsNotionPage(
  event: CalendarEventView,
  title: string,
  parentPageId?: string | null,
  localeCode: 'de' | 'en' = 'de'
): Promise<NotionAppendResult> {
  const pageTitle = title.trim() || event.title?.trim() || (localeCode === 'de' ? 'Termin' : 'Event')
  const created = await createNotionPage(pageTitle, parentPageId, 'calendar')
  const pageUrl = await appendCalendarEventBlocksToPage(event, created.pageId, localeCode)
  await touchNotionDestinationUsed(created.pageId)
  return { pageId: created.pageId, pageUrl }
}

async function appendNoteBlocksToPage(
  noteId: number,
  targetId: string,
  localeCode: 'de' | 'en'
): Promise<string> {
  const note = getNoteById(noteId)
  if (!note) {
    throw new Error('Notiz nicht gefunden.')
  }
  const blocks = buildNoteNotionBlocks(note, localeCode)
  return appendBlocksToPage(targetId, blocks)
}

export async function appendNoteToNotion(
  noteId: number,
  pageId?: string | null,
  localeCode: 'de' | 'en' = 'de'
): Promise<NotionAppendResult> {
  const note = getNoteById(noteId)
  if (!note) {
    throw new Error('Notiz nicht gefunden.')
  }
  const cfg = await readNotionDestinations()
  const targetId = resolveTargetPageId(pageId, cfg, 'note')
  const pageUrl = await appendNoteBlocksToPage(note.id, targetId, localeCode)
  await touchNotionDestinationUsed(targetId)
  return { pageId: targetId, pageUrl }
}

export async function createNoteAsNotionPage(
  noteId: number,
  title: string,
  parentPageId?: string | null,
  localeCode: 'de' | 'en' = 'de'
): Promise<NotionAppendResult> {
  const note = getNoteById(noteId)
  if (!note) {
    throw new Error('Notiz nicht gefunden.')
  }
  const pageTitle =
    title.trim() || note.title?.trim() || (localeCode === 'de' ? 'Notiz' : 'Note')
  const created = await createNotionPage(pageTitle, parentPageId, 'note')
  const pageUrl = await appendNoteBlocksToPage(note.id, created.pageId, localeCode)
  await touchNotionDestinationUsed(created.pageId)
  return { pageId: created.pageId, pageUrl }
}

export async function addNotionFavorite(hit: NotionSearchPageHit): Promise<NotionSavedDestination[]> {
  const cfg = await readNotionDestinations()
  if (cfg.favorites.some((f) => f.id === hit.id)) {
    return cfg.favorites
  }
  const entry: NotionSavedDestination = {
    id: hit.id,
    title: hit.title,
    icon: hit.icon,
    kind: hit.kind,
    addedAt: new Date().toISOString()
  }
  const favorites = [entry, ...cfg.favorites].slice(0, 24)
  await writeNotionDestinations({ ...cfg, favorites })
  return favorites
}

export async function removeNotionFavorite(pageId: string): Promise<NotionSavedDestination[]> {
  const cfg = await readNotionDestinations()
  const favorites = cfg.favorites.filter((f) => f.id !== pageId)
  await writeNotionDestinations({ ...cfg, favorites })
  return favorites
}
