import { acquireTokenSilent } from '../auth/microsoft'
import { loadConfig } from '../config'
import { ONENOTE_MAIL_SECTION_NAME } from '@shared/onenote-catalog'
import type {
  OneNoteNotebook,
  OneNoteOpenedHint,
  OneNoteSection
} from '@shared/types/onenote'

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'

interface ODataPage<T> {
  value?: T[]
  '@odata.nextLink'?: string
}

interface GraphNotebook {
  id?: string
  displayName?: string
  lastModifiedDateTime?: string
  createdDateTime?: string
  isDefault?: boolean
  isShared?: boolean
  links?: {
    oneNoteClientUrl?: { href?: string }
    oneNoteWebUrl?: { href?: string }
  }
}

interface GraphSection {
  id?: string
  displayName?: string
  lastModifiedDateTime?: string
  createdDateTime?: string
}

interface GraphSectionGroup {
  id?: string
  displayName?: string
}

interface GraphInsight {
  resourceVisualization?: {
    title?: string
    type?: string
    mediaType?: string
    containerType?: string
  }
  resourceReference?: { type?: string; webUrl?: string; id?: string }
  lastUsed?: { lastAccessedDateTime?: string }
}

interface GraphPageCreated {
  id?: string
  links?: {
    oneNoteClientUrl?: { href?: string }
    oneNoteWebUrl?: { href?: string }
  }
}

export interface OneNoteGraphCatalog {
  notebooks: OneNoteNotebook[]
  sections: OneNoteSection[]
  opened: OneNoteOpenedHint[]
}

export interface OneNoteCreatedPage {
  sectionId: string
  sectionName: string
  pageId: string | null
  webUrl: string | null
  clientUrl: string | null
}

function explainOneNoteError(status: number, body: string): string {
  let message = body.trim()
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } }
    const code = parsed.error?.code?.trim()
    const text = parsed.error?.message?.trim()
    message = [code, text].filter(Boolean).join(' — ') || message
  } catch {
    /* Rohtext */
  }
  if (
    status === 403 ||
    /ErrorAccessDenied|Authorization_RequestDenied|Notes\.Read/i.test(message)
  ) {
    return (
      'OneNote-Zugriff fehlt (Berechtigung Notes.ReadWrite). ' +
      'Bitte das Microsoft-Konto neu verbinden und der Berechtigung zustimmen. ' +
      'Wenn der Mandant das sperrt, muss ein Admin in Entra „Notes.ReadWrite“ freigeben.'
    )
  }
  if (status === 401) {
    return 'Microsoft-Anmeldung abgelaufen. Bitte das Konto unter Einstellungen erneut verbinden.'
  }
  if (/invalid_scope|AADSTS650053|AADSTS70011/i.test(message)) {
    return (
      'Die App darf Notes.ReadWrite noch nicht anfragen. ' +
      'In der Entra-App-Registrierung die delegierte Berechtigung Notes.ReadWrite hinzufügen.'
    )
  }
  return message || `OneNote-Anfrage fehlgeschlagen (HTTP ${status}).`
}

async function accessToken(accountId: string): Promise<string> {
  const config = await loadConfig()
  const clientId = config.microsoftClientId?.trim()
  if (!clientId) throw new Error('Keine Azure Client-ID konfiguriert.')
  const token = await acquireTokenSilent(clientId, accountId.replace(/^ms:/, ''))
  return token.accessToken
}

async function graphRequest(
  accountId: string,
  urlOrPath: string,
  init?: { method?: string; body?: string; contentType?: string }
): Promise<{ status: number; text: string }> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${GRAPH_ROOT}${urlOrPath}`
  const token = await accessToken(accountId)
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (init?.contentType) headers['Content-Type'] = init.contentType
  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body
  })
  const text = await res.text()
  return { status: res.status, text }
}

async function graphJson<T>(accountId: string, urlOrPath: string): Promise<T> {
  const { status, text } = await graphRequest(accountId, urlOrPath)
  if (status < 200 || status >= 300) {
    throw new Error(explainOneNoteError(status, text))
  }
  if (!text.trim()) return {} as T
  return JSON.parse(text) as T
}

async function listAll<T>(accountId: string, path: string, maxPages = 4): Promise<T[]> {
  const out: T[] = []
  let url: string | null = path
  let pages = 0
  while (url && pages < maxPages) {
    const page: ODataPage<T> = await graphJson<ODataPage<T>>(accountId, url)
    if (Array.isArray(page.value)) out.push(...page.value)
    url = page['@odata.nextLink'] ?? null
    pages += 1
  }
  return out
}

async function listAllSafe<T>(accountId: string, path: string): Promise<T[]> {
  try {
    return await listAll<T>(accountId, path, 3)
  } catch (err) {
    console.warn(
      '[onenote] Liste übersprungen:',
      path,
      err instanceof Error ? err.message : err
    )
    return []
  }
}

function mapNotebook(raw: GraphNotebook): OneNoteNotebook | null {
  const id = raw.id?.trim()
  if (!id) return null
  return {
    id,
    displayName: raw.displayName?.trim() || '(Ohne Namen)',
    lastModifiedDateTime: raw.lastModifiedDateTime ?? null,
    createdDateTime: raw.createdDateTime ?? null,
    isDefault: raw.isDefault === true,
    isShared: raw.isShared === true,
    clientUrl: raw.links?.oneNoteClientUrl?.href?.trim() || null,
    webUrl: raw.links?.oneNoteWebUrl?.href?.trim() || null
  }
}

function mapSection(
  raw: GraphSection,
  notebook: OneNoteNotebook,
  sectionGroupName: string | null
): OneNoteSection | null {
  const id = raw.id?.trim()
  if (!id) return null
  return {
    id,
    displayName: raw.displayName?.trim() || '(Ohne Namen)',
    notebookId: notebook.id,
    notebookName: notebook.displayName,
    sectionGroupName,
    lastModifiedDateTime: raw.lastModifiedDateTime ?? null,
    createdDateTime: raw.createdDateTime ?? null
  }
}

async function sectionsFromPath(
  accountId: string,
  path: string,
  notebook: OneNoteNotebook,
  sectionGroupName: string | null
): Promise<OneNoteSection[]> {
  const raw = await listAllSafe<GraphSection>(accountId, path)
  return raw
    .map((item) => mapSection(item, notebook, sectionGroupName))
    .filter((item): item is OneNoteSection => item != null)
}

async function sectionsForNotebook(
  accountId: string,
  notebook: OneNoteNotebook
): Promise<OneNoteSection[]> {
  const notebookId = encodeURIComponent(notebook.id)
  const root = await sectionsFromPath(
    accountId,
    `/me/onenote/notebooks/${notebookId}/sections?$top=50`,
    notebook,
    null
  )
  const groups = await listAllSafe<GraphSectionGroup>(
    accountId,
    `/me/onenote/notebooks/${notebookId}/sectionGroups?$top=40`
  )
  const nested: OneNoteSection[] = []
  for (const group of groups) {
    const groupId = group.id?.trim()
    if (!groupId) continue
    const groupName = group.displayName?.trim() || null
    const encoded = encodeURIComponent(groupId)
    nested.push(
      ...(await sectionsFromPath(
        accountId,
        `/me/onenote/sectionGroups/${encoded}/sections?$top=50`,
        notebook,
        groupName
      ))
    )
  }
  const seen = new Set<string>()
  const all = [...root, ...nested]
  return all.filter((section) => {
    if (seen.has(section.id)) return false
    seen.add(section.id)
    return true
  })
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const out: R[] = new Array(items.length)
  let index = 0
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index
      index += 1
      out[current] = await fn(items[current] as T)
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return out
}

function insightBlob(item: GraphInsight): string {
  return [
    item.resourceVisualization?.type,
    item.resourceVisualization?.mediaType,
    item.resourceVisualization?.containerType,
    item.resourceReference?.type,
    item.resourceReference?.webUrl
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function matchOpenedNotebook(item: GraphInsight, notebooks: OneNoteNotebook[]): OneNoteNotebook | null {
  const blob = insightBlob(item)
  const looksLikeNotebook = blob.includes('onenote') || blob.includes('notebook')
  if (!looksLikeNotebook) return null
  const url = item.resourceReference?.webUrl || ''
  const byUrl = notebooks.find((notebook) => url.includes(notebook.id))
  if (byUrl) return byUrl
  const title = (item.resourceVisualization?.title || '').trim().toLocaleLowerCase('de')
  if (!title) return null
  const named = notebooks.filter(
    (notebook) => notebook.displayName.trim().toLocaleLowerCase('de') === title
  )
  return named.length === 1 ? named[0] : null
}

async function recentlyOpened(
  accountId: string,
  notebooks: OneNoteNotebook[]
): Promise<OneNoteOpenedHint[]> {
  let items: GraphInsight[] = []
  try {
    items = await listAll<GraphInsight>(accountId, '/me/insights/used?$top=40', 1)
  } catch (err) {
    console.warn(
      '[onenote] Zuletzt geöffnet nicht verfügbar:',
      err instanceof Error ? err.message : err
    )
    return []
  }
  const opened: OneNoteOpenedHint[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const notebook = matchOpenedNotebook(item, notebooks)
    if (!notebook || seen.has(notebook.id)) continue
    seen.add(notebook.id)
    opened.push({
      notebookId: notebook.id,
      accessedAt: item.lastUsed?.lastAccessedDateTime || new Date().toISOString()
    })
  }
  return opened
}

export async function loadOneNoteGraphCatalog(accountId: string): Promise<OneNoteGraphCatalog> {
  const rawNotebooks = await listAll<GraphNotebook>(
    accountId,
    '/me/onenote/notebooks?$top=50',
    4
  )
  const notebooks = rawNotebooks
    .map(mapNotebook)
    .filter((item): item is OneNoteNotebook => item != null)
  const sectionLists = await mapPool(notebooks, 3, (notebook) =>
    sectionsForNotebook(accountId, notebook)
  )
  const sections = sectionLists.flat()
  const opened = await recentlyOpened(accountId, notebooks)
  return { notebooks, sections, opened }
}

async function findChronellSection(
  accountId: string,
  notebookId: string
): Promise<{ id: string; name: string } | null> {
  const raw = await listAllSafe<GraphSection>(
    accountId,
    `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$top=50`
  )
  const hit = raw.find(
    (section) =>
      (section.displayName || '').trim().toLocaleLowerCase('de') ===
      ONENOTE_MAIL_SECTION_NAME.toLocaleLowerCase('de')
  )
  const id = hit?.id?.trim()
  if (!id) return null
  return { id, name: hit?.displayName?.trim() || ONENOTE_MAIL_SECTION_NAME }
}

export async function ensureOneNoteSection(
  accountId: string,
  notebookId: string,
  sectionId: string | null | undefined,
  sectionName: string | null | undefined
): Promise<{ id: string; name: string }> {
  const explicit = sectionId?.trim()
  if (explicit) {
    return { id: explicit, name: sectionName?.trim() || explicit }
  }
  const existing = await findChronellSection(accountId, notebookId)
  if (existing) return existing
  const { status, text } = await graphRequest(
    accountId,
    `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
    {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({ displayName: ONENOTE_MAIL_SECTION_NAME })
    }
  )
  if (status < 200 || status >= 300) {
    throw new Error(explainOneNoteError(status, text))
  }
  const parsed = JSON.parse(text) as GraphSection
  const id = parsed.id?.trim()
  if (!id) throw new Error('OneNote hat den neuen Abschnitt ohne Kennung zurückgegeben.')
  return { id, name: parsed.displayName?.trim() || ONENOTE_MAIL_SECTION_NAME }
}

export async function createOneNotePage(input: {
  accountId: string
  sectionId: string
  html: string
}): Promise<{ pageId: string | null; webUrl: string | null; clientUrl: string | null }> {
  const { status, text } = await graphRequest(
    input.accountId,
    `/me/onenote/sections/${encodeURIComponent(input.sectionId)}/pages`,
    {
      method: 'POST',
      contentType: 'text/html',
      body: input.html
    }
  )
  if (status < 200 || status >= 300) {
    throw new Error(explainOneNoteError(status, text))
  }
  const parsed = (text.trim() ? JSON.parse(text) : {}) as GraphPageCreated
  return {
    pageId: parsed.id?.trim() || null,
    webUrl: parsed.links?.oneNoteWebUrl?.href?.trim() || null,
    clientUrl: parsed.links?.oneNoteClientUrl?.href?.trim() || null
  }
}
