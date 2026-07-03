import { parseM365VideoShareUrl } from '@shared/note-m365-video-embed'
import { isGoogleMapsUrl, parseGoogleMapsEmbedSrc } from '@shared/note-google-maps-embed'

const RESOLVE_TIMEOUT_MS = 8_000

function parseUrl(input: string): URL | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

async function fetchFinalUrl(url: string, method: 'HEAD' | 'GET'): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Chronell/1.0 (Electron)' }
    })
    return res.url || null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Folgt Redirects für Embed-Kurzlinks (Google Maps, 1drv.ms …). */
export async function resolveNoteEmbedRedirectUrl(input: string): Promise<string | null> {
  const trimmed = input.trim()
  if (!trimmed) return null

  let finalUrl = await fetchFinalUrl(trimmed, 'HEAD')
  if (!finalUrl) {
    finalUrl = await fetchFinalUrl(trimmed, 'GET')
  }
  if (!finalUrl) return null

  if (parseM365VideoShareUrl(finalUrl)) {
    return finalUrl
  }

  const resolved = parseUrl(finalUrl)
  if (!resolved || !isGoogleMapsUrl(finalUrl)) return null
  if (!parseGoogleMapsEmbedSrc(finalUrl)) return null
  return finalUrl
}
