/**
 * #kurtrocks Events → Webinar-Import (Notion Read).
 * Feste Property-Namen der Kurtrocks-Events-DB.
 */

import { richTextSegmentsToPlain, plainTextToWebinarSupplementHtml } from '@shared/notion-search'
import {
  KURTROCKS_PUBLIC_SITE_ORIGIN,
  toKurtrocksPublicSiteUrl
} from '@shared/notion-kurtrocks-public-url'
import type {
  NotionKurtrocksEventHit,
  NotionWebinarImportResult
} from '@shared/types'
import { NotionApiError, notionFetch, notionJson } from './notion-client'

const KURTROCKS_EVENTS_DB_NAME = '#kurtrocks Events'
const PROP_TITLE = 'Titel'
const PROP_DATE = 'Datum'
const PROP_DESCRIPTION = 'Beschreibung'

export { KURTROCKS_PUBLIC_SITE_ORIGIN, toKurtrocksPublicSiteUrl }

const MAX_COVER_BYTES = 12 * 1024 * 1024

interface NotionSearchDatabaseResponse {
  results: Array<{
    object: string
    id: string
    title?: Array<{ plain_text?: string }>
    last_edited_time?: string
  }>
  has_more: boolean
  next_cursor: string | null
}

interface NotionDateValue {
  start?: string | null
  end?: string | null
  time_zone?: string | null
}

interface NotionPageProperties {
  [key: string]:
    | { type: 'title'; title?: Array<{ plain_text?: string }> }
    | { type: 'rich_text'; rich_text?: Array<{ plain_text?: string }> }
    | { type: 'url'; url?: string | null }
    | { type: 'date'; date?: NotionDateValue | null }
    | { type: string; [k: string]: unknown }
}

interface NotionPageResponse {
  id: string
  url?: string
  /** Veroeffentlichte Notion-Site-URL (Custom Domain z. B. www.kurtrocks.com/…). */
  public_url?: string | null
  last_edited_time?: string
  cover?: {
    type?: string
    external?: { url?: string }
    file?: { url?: string; expiry_time?: string }
  } | null
  properties?: NotionPageProperties
}

interface NotionDatabaseQueryResponse {
  results: NotionPageResponse[]
  has_more: boolean
  next_cursor: string | null
}

let cachedKurtrocksDbId: string | null = null

function databaseTitle(r: NotionSearchDatabaseResponse['results'][number]): string {
  return richTextSegmentsToPlain(r.title) || 'Unbenannte Datenbank'
}

function normalizeDbName(s: string): string {
  return s.replace(/^#/, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export async function resolveKurtrocksEventsDatabaseId(): Promise<string> {
  if (cachedKurtrocksDbId) return cachedKurtrocksDbId

  const target = normalizeDbName(KURTROCKS_EVENTS_DB_NAME)
  const data = await notionJson<NotionSearchDatabaseResponse>('/search', {
    method: 'POST',
    body: JSON.stringify({
      query: 'kurtrocks Events',
      filter: { value: 'database', property: 'object' },
      page_size: 25
    })
  })

  const databases = data.results.filter((r) => r.object === 'database' && r.id)
  const exact = databases.find((r) => normalizeDbName(databaseTitle(r)) === target)
  const fuzzy = databases.find((r) => {
    const n = normalizeDbName(databaseTitle(r))
    return n.includes('kurtrocks') && n.includes('event')
  })
  const hit = exact ?? fuzzy
  if (!hit?.id) {
    throw new Error(
      `Notion-Datenbank „${KURTROCKS_EVENTS_DB_NAME}“ nicht gefunden. ` +
        'Bitte die Integration für diese Datenbank freigeben.'
    )
  }
  cachedKurtrocksDbId = hit.id
  return hit.id
}

function findProperty(
  properties: NotionPageProperties | undefined,
  name: string
): NotionPageProperties[string] | null {
  if (!properties) return null
  if (properties[name]) return properties[name]
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(properties)) {
    if (key.toLowerCase() === lower) return val
  }
  return null
}

function titleFromProperties(properties: NotionPageProperties | undefined): string {
  const titled = findProperty(properties, PROP_TITLE)
  if (titled && titled.type === 'title') {
    const plain = richTextSegmentsToPlain(
      (titled as { title?: Array<{ plain_text?: string }> }).title
    )
    if (plain) return plain
  }
  if (properties) {
    for (const val of Object.values(properties)) {
      if (val && typeof val === 'object' && val.type === 'title') {
        const plain = richTextSegmentsToPlain(
          (val as { title?: Array<{ plain_text?: string }> }).title
        )
        if (plain) return plain
      }
    }
  }
  return 'Unbenanntes Event'
}

function parseDateProp(properties: NotionPageProperties | undefined): {
  startIso: string | null
  endIso: string | null
  isAllDay: boolean
} {
  const prop = findProperty(properties, PROP_DATE)
  if (!prop || prop.type !== 'date') {
    return { startIso: null, endIso: null, isAllDay: false }
  }
  const date = (prop as { date?: NotionDateValue | null }).date
  const start = date?.start?.trim() || null
  if (!start) return { startIso: null, endIso: null, isAllDay: false }
  const isAllDay = !start.includes('T')
  let end = date?.end?.trim() || null
  if (!end) {
    if (isAllDay) {
      end = start
    } else {
      try {
        const d = new Date(start)
        d.setHours(d.getHours() + 1)
        end = d.toISOString()
      } catch {
        end = start
      }
    }
  }
  return { startIso: start, endIso: end, isAllDay }
}

/**
 * Veranstaltungsseite fuer Webinar-Formular = nur veroeffentlichte Kurtrocks-URL.
 */
function resolveEventWebsiteUrl(page: NotionPageResponse): string | null {
  return toKurtrocksPublicSiteUrl(page.public_url)
}

function descriptionFromProperties(properties: NotionPageProperties | undefined): string {
  const prop = findProperty(properties, PROP_DESCRIPTION)
  if (!prop || prop.type !== 'rich_text') return ''
  return richTextSegmentsToPlain(
    (prop as { rich_text?: Array<{ plain_text?: string }> }).rich_text
  )
}

function coverUrlFromPage(page: NotionPageResponse): string | null {
  const cover = page.cover
  if (!cover) return null
  if (cover.type === 'external' && cover.external?.url) return cover.external.url.trim()
  if (cover.type === 'file' && cover.file?.url) return cover.file.url.trim()
  if (cover.external?.url) return cover.external.url.trim()
  if (cover.file?.url) return cover.file.url.trim()
  return null
}

function mapPageToHit(page: NotionPageResponse): NotionKurtrocksEventHit {
  const { startIso, endIso, isAllDay } = parseDateProp(page.properties)
  return {
    id: page.id,
    title: titleFromProperties(page.properties),
    startIso,
    endIso,
    isAllDay,
    websiteUrl: resolveEventWebsiteUrl(page),
    descriptionPreview: descriptionFromProperties(page.properties).slice(0, 160) || null,
    coverUrl: coverUrlFromPage(page),
    pageUrl: page.url ?? null,
    publicUrl: page.public_url?.trim() || null,
    lastEditedTime: page.last_edited_time ?? null
  }
}

export async function searchKurtrocksEvents(
  query: string,
  options?: { maxResults?: number }
): Promise<NotionKurtrocksEventHit[]> {
  const dbId = await resolveKurtrocksEventsDatabaseId()
  const maxResults = Math.min(Math.max(options?.maxResults ?? 40, 1), 100)
  const q = query.trim()

  const body: Record<string, unknown> = {
    page_size: Math.min(100, maxResults),
    sorts: [{ property: PROP_DATE, direction: 'descending' }]
  }
  if (q) {
    body.filter = {
      property: PROP_TITLE,
      title: { contains: q }
    }
  }

  const data = await notionJson<NotionDatabaseQueryResponse>(
    `/databases/${dbId}/query`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  )

  return data.results
    .filter((r) => r.id)
    .map(mapPageToHit)
    .slice(0, maxResults)
}

async function downloadUrlAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Manche Notion/S3-URLs erwarten einen Browser-UA
        'User-Agent': 'Chronell-MailClient/1.0'
      }
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_COVER_BYTES) return null
    const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]!.trim()
    if (!ct.startsWith('image/')) return null
    return `data:${ct};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function importKurtrocksEventForWebinar(
  pageId: string
): Promise<NotionWebinarImportResult> {
  const id = pageId.trim()
  if (!id) throw new Error('Notion: pageId fehlt.')

  const page = await notionJson<NotionPageResponse>(`/pages/${id}`)
  const title = titleFromProperties(page.properties)
  const { startIso, endIso, isAllDay } = parseDateProp(page.properties)
  const websiteUrl = resolveEventWebsiteUrl(page)
  const descriptionPlain = descriptionFromProperties(page.properties)
  const coverUrl = coverUrlFromPage(page)

  let heroImageDataUrl: string | null = null
  if (coverUrl) {
    heroImageDataUrl = await downloadUrlAsDataUrl(coverUrl)
    // Falls signed URL Auth braucht: mit Notion-Token erneut versuchen
    if (!heroImageDataUrl) {
      try {
        const res = await notionFetch(coverUrl)
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          if (buf.length > 0 && buf.length <= MAX_COVER_BYTES) {
            const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]!.trim()
            if (ct.startsWith('image/')) {
              heroImageDataUrl = `data:${ct};base64,${buf.toString('base64')}`
            }
          }
        }
      } catch (e) {
        if (!(e instanceof NotionApiError)) {
          // ignore
        }
      }
    }
  }

  return {
    pageId: page.id,
    pageUrl: page.url ?? null,
    publicUrl: page.public_url?.trim() || null,
    title,
    startIso,
    endIso,
    isAllDay,
    websiteUrl,
    descriptionPlain,
    descriptionHtml: plainTextToWebinarSupplementHtml(descriptionPlain),
    heroImageDataUrl
  }
}

const SURVEY_URL_PROP_ALIASES = ['umfrage-link', 'umfrage link', 'umfragelink', 'survey link', 'survey']
const MEETING_URL_PROP_ALIASES = [
  'meeting link',
  'meeting-link',
  'meetinglink',
  'teams link',
  'teams-link',
  'join url',
  'join link'
]

function findUrlPropertyKey(
  properties: NotionPageProperties | undefined,
  aliases: string[]
): string | null {
  if (!properties) return null
  const aliasSet = new Set(aliases.map((a) => a.toLowerCase()))
  for (const [key, val] of Object.entries(properties)) {
    if (!val || typeof val !== 'object') continue
    if ((val as { type?: string }).type !== 'url') continue
    if (aliasSet.has(key.trim().toLowerCase())) return key
  }
  return null
}

export interface UpdateKurtrocksEventLinksInput {
  pageId: string
  surveyUrl?: string | null
  meetingUrl?: string | null
}

export interface UpdateKurtrocksEventLinksResult {
  pageId: string
  updatedSurvey: boolean
  updatedMeeting: boolean
  missingSurveyProperty: boolean
  missingMeetingProperty: boolean
}

/**
 * Schreibt Forms-Ausfuell-Link und/oder Teams-Join-URL in die Notion-DB-Properties
 * „Umfrage-Link“ bzw. „Meeting Link“ (URL-Felder, Namen case-insensitive).
 */
export async function updateKurtrocksEventLinks(
  input: UpdateKurtrocksEventLinksInput
): Promise<UpdateKurtrocksEventLinksResult> {
  const pageId = input.pageId.trim()
  if (!pageId) throw new Error('Notion: pageId fehlt.')

  const surveyUrl = input.surveyUrl?.trim() || null
  const meetingUrl = input.meetingUrl?.trim() || null
  if (!surveyUrl && !meetingUrl) {
    return {
      pageId,
      updatedSurvey: false,
      updatedMeeting: false,
      missingSurveyProperty: false,
      missingMeetingProperty: false
    }
  }

  const page = await notionJson<NotionPageResponse>(`/pages/${pageId}`)
  const surveyKey = findUrlPropertyKey(page.properties, SURVEY_URL_PROP_ALIASES)
  const meetingKey = findUrlPropertyKey(page.properties, MEETING_URL_PROP_ALIASES)

  const properties: Record<string, { url: string | null }> = {}
  let updatedSurvey = false
  let updatedMeeting = false

  if (surveyUrl) {
    if (surveyKey) {
      properties[surveyKey] = { url: surveyUrl }
      updatedSurvey = true
    }
  }
  if (meetingUrl) {
    if (meetingKey) {
      properties[meetingKey] = { url: meetingUrl }
      updatedMeeting = true
    }
  }

  if (Object.keys(properties).length > 0) {
    await notionJson(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    })
  }

  return {
    pageId,
    updatedSurvey,
    updatedMeeting,
    missingSurveyProperty: Boolean(surveyUrl) && !surveyKey,
    missingMeetingProperty: Boolean(meetingUrl) && !meetingKey
  }
}

/** Cache leeren (z. B. nach Disconnect). */
export function clearKurtrocksEventsDatabaseCache(): void {
  cachedKurtrocksDbId = null
}
