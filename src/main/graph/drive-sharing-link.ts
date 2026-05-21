import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import type { ComposeDriveSharingLinkScope, ComposeDriveSharingLinkType } from '@shared/types'

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

function formatSharingLinkError(e: unknown): string {
  const c = readGraphStatusCode(e)
  const m =
    e instanceof GraphError
      ? (e.message ?? '').trim() || 'Unbekannter Graph-Fehler'
      : e instanceof Error
        ? (e.message ?? '').trim() || 'Unbekannter Graph-Fehler'
        : String(e)
  if (c === 403 || c === 401) {
    return `Freigabe-Link konnte nicht erstellt werden (${m}). Konto unter Einstellungen erneut mit Microsoft verbinden (Berechtigungen «Files.ReadWrite.All» / «Sites.ReadWrite.All»).`
  }
  if (c === 404) {
    return `Datei nicht gefunden (${m}).`
  }
  if (c != null) {
    return `Freigabe-Link fehlgeschlagen (${c}): ${m}`
  }
  return m
}

/** Microsoft Graph: POST …/createLink — Freigabe-Link mit Berechtigungen. */
export async function graphCreateDriveSharingLink(input: {
  accountId: string
  itemId: string
  driveId?: string | null
  type: ComposeDriveSharingLinkType
  scope: ComposeDriveSharingLinkScope
  expirationDateTime?: string | null
}): Promise<{ webUrl: string }> {
  const itemId = input.itemId.trim()
  if (!itemId) throw new Error('Datei-ID fehlt.')

  const body: Record<string, unknown> = {
    type: input.type,
    scope: input.scope
  }
  const exp = input.expirationDateTime?.trim()
  if (exp) {
    body.expirationDateTime = exp
  }

  try {
    const client = await getClientFor(input.accountId)
    const driveId = input.driveId?.trim()
    const path = driveId
      ? `/drives/${driveId}/items/${itemId}/createLink`
      : `/me/drive/items/${itemId}/createLink`

    const res = (await client.api(path).post(body)) as {
      link?: { webUrl?: string; type?: string; scope?: string }
    }
    const webUrl = res.link?.webUrl?.trim()
    if (!webUrl) {
      throw new Error('Graph hat keinen Freigabe-Link (webUrl) zurückgegeben.')
    }
    return { webUrl }
  } catch (e) {
    throw new Error(formatSharingLinkError(e))
  }
}
