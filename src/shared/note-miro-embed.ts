export const NOTE_MIRO_EMBED_ATTR = 'data-note-miro-board-id' as const
export const NOTE_MIRO_EMBED_CLASS = 'note-miro-embed' as const

const MIRO_BOARD_ID_RE = /^[A-Za-z0-9_-]+=?$/

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

function isMiroHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'miro.com'
}

function normalizeBoardId(candidate: string): string | null {
  const id = candidate.trim()
  if (!id || !MIRO_BOARD_ID_RE.test(id)) return null
  return id
}

/** Miro-Board-ID aus Teilen- oder Live-Embed-URL extrahieren. */
export function parseMiroBoardId(input: string): string | null {
  const trimmed = input.trim()
  if (MIRO_BOARD_ID_RE.test(trimmed) && trimmed.startsWith('uXj')) {
    return trimmed
  }

  const url = parseUrl(trimmed)
  if (!url || !isMiroHost(url.hostname)) return null

  const boardMatch = /^\/app\/board\/([^/?]+)/.exec(url.pathname)
  if (boardMatch?.[1]) return normalizeBoardId(decodeURIComponent(boardMatch[1]))

  const embedMatch = /^\/app\/live-embed\/([^/?]+)/.exec(url.pathname)
  if (embedMatch?.[1]) return normalizeBoardId(decodeURIComponent(embedMatch[1]))

  return null
}

export function buildMiroEmbedUrl(boardId: string): string {
  const id = encodeURIComponent(boardId)
  return `https://miro.com/app/live-embed/${id}/?embedMode=view_only_without_ui`
}

export function isAllowedMiroEmbedSrc(src: string): boolean {
  const boardId = parseMiroBoardId(src)
  if (!boardId) return false
  const url = parseUrl(src)
  if (!url || !isMiroHost(url.hostname)) return false
  return /^\/app\/live-embed\/[^/]+/.test(url.pathname)
}

export function isMiroUrl(input: string): boolean {
  return parseMiroBoardId(input) != null
}
