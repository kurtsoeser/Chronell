import { createGraphClient } from '../graph/client'
import { loadConfig } from '../config'

type ExchangeIdFormat = 'restId' | 'ewsId' | 'entryId' | 'immutableEntryId' | 'restImmutableEntryId'

interface TranslateResultRow {
  sourceId?: string
  targetId?: string | null
  errorDetails?: { code?: string; message?: string } | null
}

const idCache = new Map<string, string>()

function cacheKey(
  accountId: string,
  sourceId: string,
  target: ExchangeIdFormat
): string {
  return `${accountId}\n${sourceId}\n${target}`
}

async function getGraphClient(accountId: string) {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

/** Graph REST-IDs in EWS-IDs umwandeln (Batch max. 1000). */
export async function translateRestIdsToEwsIds(
  accountId: string,
  restIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const pending: string[] = []

  for (const id of restIds) {
    const trimmed = id.trim()
    if (!trimmed) continue
    const hit = idCache.get(cacheKey(accountId, trimmed, 'ewsId'))
    if (hit) {
      out.set(trimmed, hit)
    } else {
      pending.push(trimmed)
    }
  }

  if (pending.length === 0) return out

  const client = await getGraphClient(accountId)
  const chunkSize = 200
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize)
    const page = (await client.api('/me/translateExchangeIds').post({
      inputIds: chunk,
      sourceIdType: 'restId',
      targetIdType: 'ewsId'
    })) as { value?: TranslateResultRow[] }

    for (const row of page.value ?? []) {
      const source = row.sourceId?.trim()
      const target = row.targetId?.trim()
      if (!source || !target) continue
      idCache.set(cacheKey(accountId, source, 'ewsId'), target)
      out.set(source, target)
    }
  }

  return out
}

export async function translateRestIdToEwsId(
  accountId: string,
  restId: string
): Promise<string> {
  const map = await translateRestIdsToEwsIds(accountId, [restId])
  const ewsId = map.get(restId.trim())
  if (!ewsId) {
    throw new Error('Konnte Graph-ID nicht in EWS-ID uebersetzen.')
  }
  return ewsId
}

/** EWS-IDs in Graph REST-IDs (fuer lokale DB `remote_id`). */
export async function translateEwsIdsToRestIds(
  accountId: string,
  ewsIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const pending: string[] = []

  for (const id of ewsIds) {
    const trimmed = id.trim()
    if (!trimmed) continue
    const hit = idCache.get(cacheKey(accountId, trimmed, 'restId'))
    if (hit) {
      out.set(trimmed, hit)
    } else {
      pending.push(trimmed)
    }
  }

  if (pending.length === 0) return out

  const client = await getGraphClient(accountId)
  const chunkSize = 200
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize)
    const page = (await client.api('/me/translateExchangeIds').post({
      inputIds: chunk,
      sourceIdType: 'ewsId',
      targetIdType: 'restId'
    })) as { value?: TranslateResultRow[] }

    for (const row of page.value ?? []) {
      const source = row.sourceId?.trim()
      const target = row.targetId?.trim()
      if (!source || !target) continue
      idCache.set(cacheKey(accountId, source, 'restId'), target)
      out.set(source, target)
    }
  }

  return out
}
