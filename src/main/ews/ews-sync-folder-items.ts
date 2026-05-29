import { loadConfig } from '../config'
import { listAccounts } from '../accounts'
import { acquireEwsAccessToken } from '../auth/microsoft-ews'
import {
  distinguishedFolderIdXml,
  escapeXmlText,
  postEwsSoap
} from './ews-soap'
import { translateRestIdsToEwsIds } from './translate-exchange-ids'
import type { EwsSyncFolderItemsPage } from './ews-sync-parse'
import { parseSyncFolderItemsResponse } from './ews-sync-parse'

export const EWS_SYNC_STATE_PREFIX = 'ews:'

const EWS_WELL_KNOWN = new Set([
  'inbox',
  'sentitems',
  'drafts',
  'deleteditems',
  'archive',
  'junkemail',
  'outbox'
])

export function encodeEwsSyncStateToken(syncState: string): string {
  return `${EWS_SYNC_STATE_PREFIX}${Buffer.from(syncState, 'utf8').toString('base64url')}`
}

export function decodeEwsSyncStateToken(token: string | null | undefined): string | null {
  if (!token?.startsWith(EWS_SYNC_STATE_PREFIX)) return null
  const raw = token.slice(EWS_SYNC_STATE_PREFIX.length)
  if (!raw) return null
  return Buffer.from(raw, 'base64url').toString('utf8')
}

export function isEwsSyncStateToken(token: string | null | undefined): boolean {
  return Boolean(token?.startsWith(EWS_SYNC_STATE_PREFIX))
}

/** Ordner ohne synchronisierbare Nachrichten (EWS SyncFolderItems schlaegt oft fehl). */
const EWS_NON_SYNCABLE_WELL_KNOWN = new Set([
  'msgfolderroot',
  'searchfolders',
  'syncissues',
  'recoverableitemsdeletions',
  'conversationhistory',
  'serverfailures',
  'localfailures',
  'scheduled',
  'clutter',
  'conflicts'
])

export function isEwsSyncableMailFolder(wellKnown: string | null): boolean {
  if (!wellKnown) return true
  return !EWS_NON_SYNCABLE_WELL_KNOWN.has(wellKnown.toLowerCase())
}

function syncStateElement(syncState: string): string {
  if (!/[<&]/.test(syncState)) {
    return `<m:SyncState>${escapeXmlText(syncState)}</m:SyncState>`
  }
  const safe = syncState.replace(/]]>/g, ']]]]><![CDATA[>')
  return `<m:SyncState><![CDATA[${safe}]]></m:SyncState>`
}

async function ewsSoapContext(accountId: string): Promise<{ token: string; anchor: string }> {
  const config = await loadConfig()
  if (!config.microsoftClientId) throw new Error('Keine Azure Client-ID konfiguriert.')
  const token = await acquireEwsAccessToken(config.microsoftClientId, accountId)
  const accounts = await listAccounts()
  const email = accounts.find((a) => a.id === accountId)?.email?.trim()
  if (!email) throw new Error('Konto-E-Mail fuer EWS nicht gefunden.')
  return { token, anchor: email }
}

async function folderIdXml(
  accountId: string,
  folder: { remoteId: string; wellKnown: string | null }
): Promise<string> {
  const wk = folder.wellKnown?.toLowerCase()
  if (wk && EWS_WELL_KNOWN.has(wk)) {
    return distinguishedFolderIdXml(wk as Parameters<typeof distinguishedFolderIdXml>[0])
  }
  const map = await translateRestIdsToEwsIds(accountId, [folder.remoteId])
  const ewsFolderId = map.get(folder.remoteId.trim())
  if (!ewsFolderId) throw new Error('EWS-Ordner-ID nicht aufloesbar.')
  return `<t:FolderId Id="${escapeXmlText(ewsFolderId)}"/>`
}

export async function fetchEwsSyncFolderItemsPage(input: {
  accountId: string
  folder: { remoteId: string; wellKnown: string | null }
  syncState: string | null
  maxChanges?: number
}): Promise<EwsSyncFolderItemsPage> {
  const { token, anchor } = await ewsSoapContext(input.accountId)
  const syncFolderId = await folderIdXml(input.accountId, input.folder)
  const max = Math.min(Math.max(input.maxChanges ?? 256, 32), 512)
  const syncStateXml = input.syncState ? syncStateElement(input.syncState) : ''

  const xml = await postEwsSoap({
    accessToken: token,
    anchorMailbox: anchor,
    soapAction: 'http://schemas.microsoft.com/exchange/services/2006/messages/SyncFolderItems',
    bodyXml: `<m:SyncFolderItems>
  <m:ItemShape>
    <t:BaseShape>Default</t:BaseShape>
  </m:ItemShape>
  <m:SyncFolderId>
    ${syncFolderId}
  </m:SyncFolderId>
  ${syncStateXml}
  <m:MaxChangesReturned>${max}</m:MaxChangesReturned>
</m:SyncFolderItems>`
  })

  return parseSyncFolderItemsResponse(xml)
}
