import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import type {
  CopilotRetrievalHit,
  CopilotRetrievalInput,
  CopilotRetrievalResult
} from '@shared/types'

interface GraphRetrievalHitRow {
  extract?: string | null
  relevanceScore?: number | null
  resourceMetadata?: Array<{ name?: string | null; value?: string | null } | null> | null
  webUrl?: string | null
  resourceUrl?: string | null
}

interface GraphRetrievalResponse {
  retrievalHits?: GraphRetrievalHitRow[] | null
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function emptyRetrieval(
  status: CopilotRetrievalResult['status'],
  extras?: Partial<CopilotRetrievalResult>
): CopilotRetrievalResult {
  return {
    status,
    hits: [],
    errorMessage: null,
    ...extras
  }
}

function metaValue(
  row: GraphRetrievalHitRow,
  names: string[]
): string | null {
  const meta = row.resourceMetadata ?? []
  for (const name of names) {
    const hit = meta.find((m) => m?.name?.toLowerCase() === name.toLowerCase())
    const v = hit?.value?.trim()
    if (v) return v
  }
  return null
}

export function mapCopilotRetrievalHits(rows: GraphRetrievalHitRow[] | null | undefined): CopilotRetrievalHit[] {
  return (rows ?? [])
    .filter((row): row is GraphRetrievalHitRow => !!row)
    .map((row) => {
      const extract = row.extract?.trim() || ''
      if (!extract) return null
      return {
        extract,
        resourceUrl:
          row.resourceUrl?.trim() ||
          row.webUrl?.trim() ||
          metaValue(row, ['url', 'webUrl', 'path']) ||
          null,
        resourceTitle: metaValue(row, ['title', 'filename', 'name']) || null,
        relevanceScore: typeof row.relevanceScore === 'number' ? row.relevanceScore : null
      } satisfies CopilotRetrievalHit
    })
    .filter((h): h is CopilotRetrievalHit => !!h)
}

/**
 * Microsoft 365 Copilot Retrieval API.
 * POST /v1.0/copilot/retrieval
 */
export async function graphCopilotRetrieve(input: CopilotRetrievalInput): Promise<CopilotRetrievalResult> {
  const accountId = input.accountId?.trim() ?? ''
  if (!accountId.startsWith('ms:')) {
    return emptyRetrieval('unsupported')
  }

  const queryString = input.queryString?.trim() ?? ''
  if (!queryString) {
    return emptyRetrieval('error', { errorMessage: 'Leere Abfrage.' })
  }

  const max = Math.min(25, Math.max(1, input.maximumNumberOfResults ?? 8))

  try {
    const client = await getClientFor(accountId)
    const body: Record<string, unknown> = {
      queryString: queryString.slice(0, 1500),
      dataSource: input.dataSource,
      maximumNumberOfResults: max,
      resourceMetadata: ['title', 'url', 'path', 'filename']
    }
    const filter = input.filterExpression?.trim()
    if (filter) body.filterExpression = filter

    const res = (await client.api('/copilot/retrieval').post(body)) as GraphRetrievalResponse
    const hits = mapCopilotRetrievalHits(res.retrievalHits)
    if (hits.length === 0) {
      return emptyRetrieval('empty')
    }
    return { status: 'ok', hits, errorMessage: null }
  } catch (e) {
    if (e instanceof GraphError) {
      const code = e.statusCode ?? 0
      if (code === 401 || code === 403) {
        return emptyRetrieval('forbidden', {
          errorMessage:
            e.message?.trim() ||
            'Copilot Retrieval nicht freigegeben (Scope oder Lizenz).'
        })
      }
      return emptyRetrieval('error', {
        errorMessage: e.message?.trim() || `Graph-Fehler (${code}).`
      })
    }
    return emptyRetrieval('error', {
      errorMessage: e instanceof Error ? e.message : String(e)
    })
  }
}
