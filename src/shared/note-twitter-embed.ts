import type { NoteEmbedTheme } from './note-embed-theme'

export const NOTE_TWITTER_EMBED_ATTR = 'data-note-twitter-id' as const
export const NOTE_TWITTER_EMBED_CLASS = 'note-twitter-embed' as const

const TWEET_ID_RE = /^\d{5,}$/

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

function isTwitterHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'twitter.com' || host === 'x.com' || host === 'mobile.twitter.com'
}

/** Tweet-ID aus X/Twitter-Status-URL extrahieren. */
export function parseTwitterTweetId(input: string): string | null {
  const url = parseUrl(input)
  if (!url) return null

  if (url.hostname.replace(/^www\./, '') === 'platform.twitter.com') {
    const id = url.searchParams.get('id')?.trim()
    return id && TWEET_ID_RE.test(id) ? id : null
  }

  if (!isTwitterHost(url.hostname)) return null

  const statusMatch = /^\/[^/]+\/status\/(\d+)/.exec(url.pathname)
  if (!statusMatch?.[1]) return null
  return TWEET_ID_RE.test(statusMatch[1]) ? statusMatch[1] : null
}

export function buildTwitterEmbedUrl(
  tweetId: string,
  theme: NoteEmbedTheme = 'light'
): string {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light'
  return `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(tweetId)}&theme=${normalizedTheme}`
}

export function parseTwitterEmbedTheme(src: string): NoteEmbedTheme | null {
  const url = parseUrl(src)
  if (!url) return null
  const theme = url.searchParams.get('theme')
  if (theme === 'dark' || theme === 'light') return theme
  return null
}

export function isAllowedTwitterEmbedSrc(src: string): boolean {
  const url = parseUrl(src)
  if (!url) return false
  return (
    url.hostname.replace(/^www\./, '') === 'platform.twitter.com' &&
    url.pathname === '/embed/Tweet.html' &&
    parseTwitterTweetId(src) != null
  )
}

export function isTwitterStatusUrl(input: string): boolean {
  return parseTwitterTweetId(input) != null
}
