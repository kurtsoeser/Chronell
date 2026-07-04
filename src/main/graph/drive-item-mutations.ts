import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import { sanitizeFileName } from '../ipc/ipc-helpers'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function itemPath(itemId: string, driveId?: string | null): string {
  const id = itemId.trim()
  const d = driveId?.trim()
  return d ? `/drives/${d}/items/${id}` : `/me/drive/items/${id}`
}

function formatMutationError(action: string, e: unknown): string {
  const m =
    e instanceof GraphError
      ? (e.message ?? '').trim() || 'Unbekannter Graph-Fehler'
      : e instanceof Error
        ? (e.message ?? '').trim()
        : String(e)
  return `${action} fehlgeschlagen: ${m}`
}

export async function graphRenameDriveItem(input: {
  accountId: string
  itemId: string
  driveId?: string | null
  newName: string
}): Promise<void> {
  const newName = sanitizeFileName(input.newName.trim())
  if (!newName) throw new Error('Name darf nicht leer sein.')
  try {
    const client = await getClientFor(input.accountId)
    await client.api(itemPath(input.itemId, input.driveId)).patch({ name: newName })
  } catch (e) {
    throw new Error(formatMutationError('Umbenennen', e))
  }
}

export async function graphDeleteDriveItem(input: {
  accountId: string
  itemId: string
  driveId?: string | null
}): Promise<void> {
  try {
    const client = await getClientFor(input.accountId)
    await client.api(itemPath(input.itemId, input.driveId)).delete()
  } catch (e) {
    throw new Error(formatMutationError('Löschen', e))
  }
}
