import { plainTextToWebinarSupplementHtml } from '@shared/notion-search'
import type { EventsOsWebinarImportResult } from '@shared/types'
import {
  EVENTS_OS_STUDIO_BASE,
  fetchEventsOsWebinarPrefill
} from './studio-client'

const MAX_COVER_BYTES = 12 * 1024 * 1024

function isDataUrl(url: string): boolean {
  return /^data:image\//i.test(url.trim())
}

async function downloadUrlAsDataUrl(url: string): Promise<string | null> {
  const raw = url.trim()
  if (!raw) return null
  if (isDataUrl(raw)) return raw
  try {
    const absolute = raw.startsWith('/')
      ? `${EVENTS_OS_STUDIO_BASE.replace(/\/$/, '')}${raw}`
      : raw
    const res = await fetch(absolute, {
      headers: { 'User-Agent': 'Chronell-MailClient/1.0' }
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

export async function importEventsOsEventForWebinar(
  eventId: string
): Promise<EventsOsWebinarImportResult> {
  const id = eventId.trim()
  if (!id) throw new Error('eventId fehlt')
  const raw = await fetchEventsOsWebinarPrefill(id)
  if (raw.ok === false) {
    throw new Error(raw.error || 'Events OS hat kein Webinar-Prefill geliefert.')
  }
  const descriptionPlain = String(raw.descriptionPlain || '')
  const descriptionHtml =
    String(raw.descriptionHtml || '').trim() ||
    plainTextToWebinarSupplementHtml(descriptionPlain)
  const fromStudio = String(raw.heroImageDataUrl || '').trim()
  const coverUrl = String(raw.coverUrl || '').trim()
  const heroImageDataUrl =
    (fromStudio && isDataUrl(fromStudio) ? fromStudio : null) ||
    (coverUrl ? await downloadUrlAsDataUrl(coverUrl) : null)
  return {
    eventId: raw.eventId || id,
    title: raw.title || 'Ohne Titel',
    startIso: raw.startIso,
    endIso: raw.endIso,
    isAllDay: Boolean(raw.isAllDay),
    websiteUrl: raw.websiteUrl,
    descriptionPlain,
    descriptionHtml,
    heroImageDataUrl,
    notionPageId: raw.notionPageId
  }
}
