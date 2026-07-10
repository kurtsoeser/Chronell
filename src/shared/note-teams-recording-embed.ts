export const NOTE_TEAMS_RECORDING_EMBED_ATTR = 'data-note-teams-recording-src' as const
export const NOTE_TEAMS_RECORDING_EMBED_CLASS = 'note-teams-recording-embed' as const

const STREAM_VIDEO_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseUrl(input: string): URL | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    try {
      return new URL(`https://${raw}`)
    } catch {
      return null
    }
  }
}

function buildStreamEmbedUrl(videoId: string): string {
  return `https://web.microsoftstream.com/embed/video/${videoId}?autoplay=false&showinfo=true`
}

function extractStreamVideoId(url: URL): string | null {
  const embedMatch = /^\/embed\/video\/([^/?]+)/.exec(url.pathname)
  if (embedMatch?.[1] && STREAM_VIDEO_ID_RE.test(embedMatch[1])) return embedMatch[1]

  const videoMatch = /^\/video\/([^/?]+)/.exec(url.pathname)
  if (videoMatch?.[1] && STREAM_VIDEO_ID_RE.test(videoMatch[1])) return videoMatch[1]

  return null
}

function isStreamHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'web.microsoftstream.com' || host.endsWith('.microsoftstream.com')
}

function isSharePointHost(hostname: string): boolean {
  return hostname.endsWith('.sharepoint.com')
}

/**
 * Embed-URL für Teams-Besprechungsaufzeichnungen / Stream / SharePoint.
 * Authentifizierung kann je nach Freigabe weiterhin erforderlich sein.
 */
export function parseTeamsRecordingEmbedSrc(input: string): string | null {
  const url = parseUrl(input)
  if (!url) return null

  if (isStreamHost(url.hostname)) {
    const videoId = extractStreamVideoId(url)
    return videoId ? buildStreamEmbedUrl(videoId) : null
  }

  if (isSharePointHost(url.hostname)) {
    if (url.pathname.includes('/embed.aspx')) {
      return url.toString()
    }
    if (url.pathname.toLowerCase().includes('stream.aspx')) {
      return url.toString()
    }
  }

  const host = url.hostname.replace(/^www\./, '')
  if (host === 'teams.microsoft.com' && url.pathname === '/l/meetingrecap') {
    return url.toString()
  }

  return null
}

export function buildTeamsRecordingEmbedUrl(embedSrc: string): string {
  return embedSrc
}

export function isAllowedTeamsRecordingEmbedSrc(src: string): boolean {
  const url = parseUrl(src)
  if (!url) return false

  if (isStreamHost(url.hostname)) {
    return url.pathname.startsWith('/embed/video/')
  }

  if (isSharePointHost(url.hostname)) {
    return url.pathname.includes('/embed.aspx') || url.pathname.toLowerCase().includes('stream.aspx')
  }

  const host = url.hostname.replace(/^www\./, '')
  return host === 'teams.microsoft.com' && url.pathname === '/l/meetingrecap'
}

export function isTeamsRecordingUrl(input: string): boolean {
  return parseTeamsRecordingEmbedSrc(input) != null
}

/**
 * SharePoint-/M365-Auth-Redirects innerhalb eingebetteter Stream-/Teams-Iframes.
 * Ohne diese Freigabe blockiert der Electron-Mail-Schutz `Authenticate.aspx` mit ERR_BLOCKED_BY_CLIENT.
 */
export function isAllowedM365EmbedSubFrameRedirectUrl(url: string): boolean {
  const parsed = parseUrl(url)
  if (!parsed) return false

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const path = parsed.pathname.toLowerCase()

  if (host.endsWith('.sharepoint.com')) {
    if (path.includes('/_layouts/') && path.endsWith('/authenticate.aspx')) return true
    if (path.includes('/_forms/')) return true
  }

  if (host === 'login.microsoftonline.com' || host.endsWith('.login.microsoftonline.com')) {
    return true
  }

  if (host === 'login.live.com' || host === 'login.microsoft.com') {
    return true
  }

  return false
}
