import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import { encodeGraphShareToken } from '@shared/note-m365-video-embed'
import { buildM365StreamEmbedSrc } from '@shared/note-m365-stream-embed'

interface GraphSharepointIds {
  listItemUniqueId?: string
  siteUrl?: string
}

interface GraphDriveItem {
  id?: string
  name?: string
  webUrl?: string
  file?: { mimeType?: string }
  folder?: unknown
  parentReference?: { driveId?: string }
  sharepointIds?: GraphSharepointIds
  thumbnails?: Array<{ large?: { url?: string }; medium?: { url?: string } }>
}

export interface GraphShareDriveItemResult {
  driveId: string
  itemId: string
  name: string
  webUrl: string | null
  thumbnailUrl: string | null
  mimeType: string | null
  streamEmbedSrc: string | null
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function formatGraphError(e: unknown): string {
  if (e instanceof GraphError) {
    return (e.message ?? '').trim() || 'Unbekannter Graph-Fehler'
  }
  return e instanceof Error ? (e.message ?? '').trim() : String(e)
}

function classifyGraphError(e: unknown): 'forbidden' | 'not_found' | 'unknown' {
  if (e instanceof GraphError) {
    const status = e.statusCode
    if (status === 401 || status === 403) return 'forbidden'
    if (status === 404) return 'not_found'
  }
  const message = formatGraphError(e).toLowerCase()
  if (message.includes('access denied') || message.includes('forbidden')) return 'forbidden'
  if (message.includes('not found') || message.includes('itemnotfound')) return 'not_found'
  return 'unknown'
}

function pickThumbnail(item: GraphDriveItem): string | null {
  const thumb = item.thumbnails?.[0]
  return thumb?.large?.url ?? thumb?.medium?.url ?? null
}

/** E2.2 — Share-URL über Graph `/shares/.../driveItem` auflösen. */
export async function graphResolveShareDriveItem(input: {
  accountId: string
  shareUrl: string
}): Promise<GraphShareDriveItemResult> {
  const shareUrl = input.shareUrl.trim()
  if (!shareUrl) throw new Error('Freigabe-URL fehlt.')

  const shareId = encodeGraphShareToken(shareUrl)
  const client = await getClientFor(input.accountId)
  const item = (await client
    .api(`/shares/${shareId}/driveItem`)
    .expand('thumbnails')
    .select('id,name,webUrl,file,folder,parentReference,sharepointIds')
    .get()) as GraphDriveItem

  if (item.folder) {
    throw new Error('Ordner können nicht als Video eingebettet werden.')
  }

  const itemId = item.id?.trim()
  const driveId = item.parentReference?.driveId?.trim()
  if (!itemId || !driveId) {
    throw new Error('Drive-Item konnte nicht aufgelöst werden.')
  }

  const mimeType = item.file?.mimeType ?? null
  if (mimeType && !mimeType.toLowerCase().startsWith('video/')) {
    throw new Error('not_video')
  }

  const webUrl = item.webUrl?.trim() || null
  const streamEmbedSrc = buildM365StreamEmbedSrc({
    webUrl,
    siteUrl: item.sharepointIds?.siteUrl ?? null,
    listItemUniqueId: item.sharepointIds?.listItemUniqueId ?? null
  })

  return {
    driveId,
    itemId,
    name: item.name?.trim() || 'Video',
    webUrl,
    thumbnailUrl: pickThumbnail(item),
    mimeType,
    streamEmbedSrc
  }
}

export type GraphResolveShareDriveItemErrorCode = 'forbidden' | 'not_found' | 'not_video' | 'unknown'

export async function graphResolveShareDriveItemSafe(input: {
  accountId: string
  shareUrl: string
}): Promise<
  | ({ ok: true } & GraphShareDriveItemResult)
  | { ok: false; error: GraphResolveShareDriveItemErrorCode; message: string }
> {
  try {
    const data = await graphResolveShareDriveItem(input)
    return { ok: true, ...data }
  } catch (e) {
    const message = formatGraphError(e)
    if (message === 'not_video') {
      return { ok: false, error: 'not_video', message: 'Die Datei ist kein Video.' }
    }
    return { ok: false, error: classifyGraphError(e), message }
  }
}
