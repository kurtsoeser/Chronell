import { GraphError, ResponseType } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import { sanitizeFileName } from '../ipc/ipc-helpers'

interface GraphDriveItem {
  id?: string
  name?: string
  file?: { mimeType?: string }
  folder?: unknown
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function formatDownloadError(e: unknown): string {
  const m =
    e instanceof GraphError
      ? (e.message ?? '').trim() || 'Unbekannter Graph-Fehler'
      : e instanceof Error
        ? (e.message ?? '').trim()
        : String(e)
  return `Download fehlgeschlagen: ${m}`
}

/**
 * Laedt den Inhalt einer Drive-Datei (OneDrive / SharePoint).
 */
export async function graphDownloadDriveItem(input: {
  accountId: string
  itemId: string
  driveId?: string | null
}): Promise<{ name: string; contentType: string | null; bytes: Buffer }> {
  const itemId = input.itemId.trim()
  if (!itemId) throw new Error('Datei-ID fehlt.')

  const driveId = input.driveId?.trim()
  const itemPath = driveId
    ? `/drives/${driveId}/items/${itemId}`
    : `/me/drive/items/${itemId}`

  try {
    const client = await getClientFor(input.accountId)
    const meta = (await client.api(itemPath).get()) as GraphDriveItem
    if (meta.folder) {
      throw new Error('Ordner koennen nicht heruntergeladen werden.')
    }
    const name = sanitizeFileName(meta.name?.trim() || 'datei')
    const contentType = meta.file?.mimeType ?? null

    const buf = (await client
      .api(`${itemPath}/content`)
      .responseType(ResponseType.ARRAYBUFFER)
      .get()) as ArrayBuffer

    return {
      name,
      contentType,
      bytes: Buffer.from(buf)
    }
  } catch (e) {
    throw new Error(formatDownloadError(e))
  }
}
