export const NOTE_M365_VIDEO_SCHEME = 'note-m365-video' as const

/** Wiedergabe-URL für M365-Videos über Custom-Protocol (Graph-Streaming im Main). */
export function noteM365VideoUrl(accountId: string, driveId: string, itemId: string): string {
  const account = encodeURIComponent(accountId.trim())
  const drive = encodeURIComponent(driveId.trim())
  const item = encodeURIComponent(itemId.trim())
  return `${NOTE_M365_VIDEO_SCHEME}://item/${account}/${drive}/${item}`
}

export function parseNoteM365VideoUrl(
  input: string
): { accountId: string; driveId: string; itemId: string } | null {
  try {
    const url = new URL(input.trim())
    if (url.protocol !== `${NOTE_M365_VIDEO_SCHEME}:`) return null
    if (url.hostname !== 'item') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 3) return null
    const accountId = decodeURIComponent(parts[0]!)
    const driveId = decodeURIComponent(parts[1]!)
    const itemId = decodeURIComponent(parts[2]!)
    if (!accountId || !driveId || !itemId) return null
    return { accountId, driveId, itemId }
  } catch {
    return null
  }
}

export function normalizeM365VideoMimeForPlayback(mime: string | null | undefined): string {
  const trimmed = (mime ?? '').trim().toLowerCase()
  if (trimmed.startsWith('video/')) return trimmed
  return 'video/mp4'
}
