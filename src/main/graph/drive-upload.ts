import { GraphError } from '@microsoft/microsoft-graph-client'
import type { FilesDriveUploadDestination } from '@shared/files'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import { sanitizeFileName } from '../ipc/ipc-helpers'

const SIMPLE_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024
const CHUNK_SIZE_BYTES = 5 * 1024 * 1024

interface GraphDriveItem {
  id?: string
  name?: string
  webUrl?: string
}

function readGraphStatusCode(e: unknown): number | undefined {
  if (e instanceof GraphError) return e.statusCode
  if (e && typeof e === 'object' && 'statusCode' in e) {
    const c = (e as { statusCode?: unknown }).statusCode
    return typeof c === 'number' ? c : undefined
  }
  return undefined
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function encodeDriveFileName(fileName: string): string {
  return encodeURIComponent(fileName)
}

/** Graph-Pfad für PUT content oder POST createUploadSession. */
export function buildDriveUploadItemPath(
  dest: FilesDriveUploadDestination,
  fileName: string,
  kind: 'content' | 'uploadSession'
): string {
  if (dest.scope === 'recent') {
    throw new Error('„Zuletzt“ ist kein Speicherort. Bitte einen Ordner wählen.')
  }

  const suffix = kind === 'content' ? ':/content' : ':/createUploadSession'
  const seg = encodeDriveFileName(fileName)
  const driveId = dest.folderDriveId?.trim()
  const folderId = dest.folderId?.trim()

  if (driveId) {
    if (!folderId) {
      return `/drives/${driveId}/root:/${seg}${suffix}`
    }
    return `/drives/${driveId}/items/${folderId}:/${seg}${suffix}`
  }

  if (folderId) {
    return `/me/drive/items/${folderId}:/${seg}${suffix}`
  }
  return `/me/drive/root:/${seg}${suffix}`
}

function formatUploadError(e: unknown): string {
  const c = readGraphStatusCode(e)
  const m =
    e instanceof GraphError
      ? (e.message ?? '').trim() || 'Unbekannter Graph-Fehler'
      : e instanceof Error
        ? (e.message ?? '').trim() || 'Unbekannter Graph-Fehler'
        : String(e)
  if (c === 403 || c === 401) {
    return `Upload fehlgeschlagen (${m}). Konto unter Einstellungen erneut mit Microsoft verbinden (Files.ReadWrite.All / Sites.ReadWrite.All).`
  }
  if (c === 404) {
    return `Zielordner nicht gefunden (${m}).`
  }
  if (c != null) {
    return `Upload fehlgeschlagen (${c}): ${m}`
  }
  return m
}

async function uploadSmall(
  client: ReturnType<typeof createGraphClient>,
  path: string,
  bytes: Buffer
): Promise<GraphDriveItem> {
  return (await client.api(path).put(bytes)) as GraphDriveItem
}

async function uploadLarge(
  client: ReturnType<typeof createGraphClient>,
  sessionPath: string,
  bytes: Buffer
): Promise<GraphDriveItem> {
  const session = (await client.api(sessionPath).post({
    item: { '@microsoft.graph.conflictBehavior': 'rename' },
    '@microsoft.graph.conflictBehavior': 'rename'
  })) as { uploadUrl?: string }

  const uploadUrl = session.uploadUrl?.trim()
  if (!uploadUrl) {
    throw new Error('Graph hat keine Upload-URL zurückgegeben.')
  }

  let lastItem: GraphDriveItem | null = null
  for (let start = 0; start < bytes.byteLength; start += CHUNK_SIZE_BYTES) {
    const end = Math.min(start + CHUNK_SIZE_BYTES, bytes.byteLength)
    const chunk = bytes.subarray(start, end)
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${end - 1}/${bytes.byteLength}`
      },
      body: chunk
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`Upload fehlgeschlagen (${res.status}): ${txt.slice(0, 200)}`)
    }
    if (res.status === 200 || res.status === 201) {
      lastItem = (await res.json()) as GraphDriveItem
    }
  }

  if (!lastItem?.webUrl) {
    throw new Error('Upload abgeschlossen, aber kein Datei-Link von Graph erhalten.')
  }
  return lastItem
}

/**
 * Lädt eine Datei in OneDrive oder eine SharePoint-Bibliothek hoch.
 */
export async function graphUploadDriveFile(input: {
  accountId: string
  destination: FilesDriveUploadDestination
  fileName: string
  bytes: Buffer
}): Promise<{ webUrl: string; name: string }> {
  const safeName = sanitizeFileName(input.fileName.trim()) || 'attachment'
  const contentPath = buildDriveUploadItemPath(input.destination, safeName, 'content')

  try {
    const client = await getClientFor(input.accountId)
    const item =
      input.bytes.length <= SIMPLE_UPLOAD_LIMIT_BYTES
        ? await uploadSmall(client, contentPath, input.bytes)
        : await uploadLarge(
            client,
            buildDriveUploadItemPath(input.destination, safeName, 'uploadSession'),
            input.bytes
          )

    const webUrl = item.webUrl?.trim()
    if (!webUrl) {
      throw new Error('Upload erfolgreich, aber kein Web-Link in der Antwort.')
    }
    return { webUrl, name: item.name?.trim() || safeName }
  } catch (e) {
    throw new Error(formatUploadError(e))
  }
}
