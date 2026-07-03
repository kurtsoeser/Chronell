export const NOTE_SOUNDCLOUD_EMBED_ATTR = 'data-note-soundcloud-url' as const
export const NOTE_SOUNDCLOUD_EMBED_CLASS = 'note-soundcloud-embed' as const

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

function isSoundCloudPageHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'soundcloud.com'
}

function normalizeSoundCloudPageUrl(url: URL): string | null {
  if (!isSoundCloudPageHost(url.hostname)) return null
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null
  return `https://soundcloud.com/${segments.join('/')}`
}

/** Kanonische SoundCloud-Track-/Set-URL für den Player. */
export function parseSoundCloudPageUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('https://soundcloud.com/') || trimmed.startsWith('http://soundcloud.com/')) {
    const url = parseUrl(trimmed)
    return url ? normalizeSoundCloudPageUrl(url) : null
  }

  const url = parseUrl(trimmed)
  if (!url) return null

  if (url.hostname.replace(/^www\./, '') === 'w.soundcloud.com') {
    const trackUrl = url.searchParams.get('url')
    if (!trackUrl) return null
    const decoded = parseUrl(trackUrl)
    return decoded ? normalizeSoundCloudPageUrl(decoded) : null
  }

  return normalizeSoundCloudPageUrl(url)
}

export function buildSoundCloudEmbedUrl(pageUrl: string): string {
  const url = new URL('https://w.soundcloud.com/player/')
  url.searchParams.set('url', pageUrl)
  url.searchParams.set('color', '#ff5500')
  url.searchParams.set('auto_play', 'false')
  url.searchParams.set('hide_related', 'true')
  url.searchParams.set('show_comments', 'false')
  url.searchParams.set('show_user', 'true')
  url.searchParams.set('show_reposts', 'false')
  url.searchParams.set('show_teaser', 'false')
  return url.toString()
}

export function isAllowedSoundCloudEmbedSrc(src: string): boolean {
  const pageUrl = parseSoundCloudPageUrl(src)
  if (!pageUrl) return false
  const url = parseUrl(src)
  if (!url) return false
  return url.hostname.replace(/^www\./, '') === 'w.soundcloud.com' && url.pathname === '/player/'
}

export function isSoundCloudUrl(input: string): boolean {
  return parseSoundCloudPageUrl(input) != null
}
