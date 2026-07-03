import { NOTE_EMBED_HTTP_ORIGIN } from './note-embed-constants'
import type { NoteEmbedThemeOptions } from './note-embed-theme'

export const NOTE_YOUTUBE_EMBED_ATTR = 'data-note-youtube-id' as const
export const NOTE_YOUTUBE_EMBED_CLASS = 'note-youtube-embed' as const

const YOUTUBE_VIDEO_ID_RE = /^[\w-]{11}$/

const YOUTUBE_EMBED_HOSTS = new Set(['youtube.com', 'youtube-nocookie.com'])

function normalizeVideoId(candidate: string): string | null {
  const id = candidate.trim()
  return YOUTUBE_VIDEO_ID_RE.test(id) ? id : null
}

function parseYouTubeUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    return normalizeVideoId(url.pathname.slice(1).split('/')[0] ?? '')
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      return normalizeVideoId(url.searchParams.get('v') ?? '')
    }
    const shortsMatch = /^\/shorts\/([^/?]+)/.exec(url.pathname)
    if (shortsMatch) return normalizeVideoId(shortsMatch[1] ?? '')
    const embedMatch = /^\/embed\/([^/?]+)/.exec(url.pathname)
    if (embedMatch) return normalizeVideoId(embedMatch[1] ?? '')
  }
  return null
}

/** YouTube-Video-ID aus URL oder Embed-Src extrahieren. */
export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (normalizeVideoId(raw)) return raw

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    try {
      url = new URL(`https://${raw}`)
    } catch {
      return null
    }
  }
  return parseYouTubeUrl(url)
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  _options?: NoteEmbedThemeOptions
): string {
  const url = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`)
  url.searchParams.set('playsinline', '1')
  url.searchParams.set('origin', NOTE_EMBED_HTTP_ORIGIN)
  return url.toString()
}

export function isAllowedYouTubeEmbedSrc(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed) return false
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return false
  }
  const host = url.hostname.replace(/^www\./, '')
  if (!YOUTUBE_EMBED_HOSTS.has(host)) {
    return false
  }
  return normalizeVideoId(/^\/embed\/([^/?]+)/.exec(url.pathname)?.[1] ?? '') != null
}

export function isYouTubeWatchUrl(input: string): boolean {
  return parseYouTubeVideoId(input) != null
}
