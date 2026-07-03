import type { NoteM365VideoEmbedError, NoteM365VideoEmbedRef } from '@shared/note-m365-video-embed'
import {
  parseM365VideoShareUrl
} from '@shared/note-m365-video-embed'
import { parseSharePointStreamPageEmbedSrc } from '@shared/note-m365-stream-embed'
import type { ResolveM365VideoInput, ResolveM365VideoResult } from '@shared/note-m365-video-resolve'
import { listAccounts } from './accounts'
import { graphResolveShareDriveItemSafe } from './graph/drive-share-item'
import { resolveNoteEmbedRedirectUrl } from './note-embed-url-resolve'

export type { ResolveM365VideoInput, ResolveM365VideoResult } from '@shared/note-m365-video-resolve'

async function canonicalShareUrl(input: string): Promise<string | null> {
  const trimmed = input.trim()
  if (!trimmed) return null

  const direct = parseM365VideoShareUrl(trimmed)
  if (direct && !trimmed.includes('1drv.ms')) return direct

  const redirected = await resolveNoteEmbedRedirectUrl(trimmed)
  if (redirected) return parseM365VideoShareUrl(redirected)

  return direct
}

function mapGraphError(
  code: 'forbidden' | 'not_found' | 'not_video' | 'unknown',
  message: string,
  shareUrl: string
): ResolveM365VideoResult {
  const error: NoteM365VideoEmbedError =
    code === 'forbidden'
      ? 'forbidden'
      : code === 'not_found'
        ? 'not_found'
        : code === 'not_video'
          ? 'not_video'
          : 'unknown'
  return {
    ok: false,
    error,
    message,
    ref: { shareUrl, error }
  }
}

/** E2.2 — SharePoint/OneDrive-Video per Graph auflösen (alle MS-Konten oder bevorzugtes Konto). */
export async function resolveM365VideoEmbed(
  input: ResolveM365VideoInput
): Promise<ResolveM365VideoResult> {
  const trimmed = input.shareUrl.trim()
  const directStreamEmbed = parseSharePointStreamPageEmbedSrc(trimmed)
  const shareUrl = directStreamEmbed ? trimmed : await canonicalShareUrl(input.shareUrl)

  if (!shareUrl) {
    return {
      ok: false,
      error: 'unknown',
      message: 'Kein gültiger SharePoint- oder OneDrive-Video-Link.',
      ref: { shareUrl: trimmed, error: 'unknown' }
    }
  }

  const accounts = (await listAccounts()).filter((a) => a.provider === 'microsoft')
  if (accounts.length === 0) {
    const streamOnlyRef: NoteM365VideoEmbedRef = directStreamEmbed
      ? { shareUrl: trimmed, streamEmbedSrc: directStreamEmbed }
      : { shareUrl, error: 'no_account' }
    return {
      ok: false,
      error: 'no_account',
      message: 'Kein Microsoft-Konto verbunden.',
      ref: streamOnlyRef
    }
  }

  const preferred = input.accountId?.trim()
  const ordered = preferred
    ? [
        ...accounts.filter((a) => a.id === preferred),
        ...accounts.filter((a) => a.id !== preferred)
      ]
    : accounts

  let lastMessage = 'Video konnte nicht aufgelöst werden.'
  let lastError: NoteM365VideoEmbedError = 'unknown'

  for (const account of ordered) {
    const result = await graphResolveShareDriveItemSafe({
      accountId: account.id,
      shareUrl
    })
    if (result.ok) {
      const streamEmbedSrc = result.streamEmbedSrc ?? directStreamEmbed ?? undefined
      return {
        ok: true,
        ref: {
          shareUrl: trimmed,
          accountId: account.id,
          driveId: result.driveId,
          itemId: result.itemId,
          title: result.name,
          thumbnailUrl: result.thumbnailUrl ?? undefined,
          webUrl: result.webUrl ?? undefined,
          mimeType: result.mimeType ?? undefined,
          playback: 'native',
          ...(streamEmbedSrc ? { streamEmbedSrc } : {})
        }
      }
    }
    lastMessage = result.message
    lastError =
      result.error === 'forbidden'
        ? 'forbidden'
        : result.error === 'not_found'
          ? 'not_found'
          : result.error === 'not_video'
            ? 'not_video'
            : 'unknown'
  }

  if (directStreamEmbed) {
    return {
      ok: true,
      ref: {
        shareUrl: trimmed,
        streamEmbedSrc: directStreamEmbed
      }
    }
  }

  return {
    ok: false,
    error: lastError,
    message: lastMessage,
    ref: { shareUrl, error: lastError }
  }
}
