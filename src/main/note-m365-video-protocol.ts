import { protocol } from 'electron'
import { acquireTokenSilent } from './auth/microsoft'
import { loadConfig } from './config'
import {
  normalizeM365VideoMimeForPlayback,
  parseNoteM365VideoUrl
} from '@shared/note-m365-video-url'

const SCHEME = 'note-m365-video'

export function registerNoteM365VideoScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

async function getAccessToken(accountId: string): Promise<string> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  const token = await acquireTokenSilent(config.microsoftClientId, homeAccountId)
  return token.accessToken
}

function graphContentUrl(driveId: string, itemId: string): string {
  return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`
}

function forwardHeaders(graphResponse: Response, contentType: string): Headers {
  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Accept-Ranges', 'bytes')

  const contentLength = graphResponse.headers.get('Content-Length')
  if (contentLength) headers.set('Content-Length', contentLength)

  const contentRange = graphResponse.headers.get('Content-Range')
  if (contentRange) headers.set('Content-Range', contentRange)

  return headers
}

/** E2.3 — Graph-Video-Stream mit Range-Unterstützung an `<video>` durchreichen. */
export async function registerNoteM365VideoProtocol(): Promise<void> {
  protocol.handle(SCHEME, async (request) => {
    const ids = parseNoteM365VideoUrl(request.url)
    if (!ids) {
      return new Response('Ungültige M365-Video-URL.', { status: 400 })
    }

    try {
      const token = await getAccessToken(ids.accountId)
      const rangeHeader = request.headers.get('Range')?.trim()
      const graphUrl = graphContentUrl(ids.driveId, ids.itemId)

      const graphResponse = await fetch(graphUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(rangeHeader ? { Range: rangeHeader } : {})
        }
      })

      if (!graphResponse.ok && graphResponse.status !== 206) {
        const detail = await graphResponse.text().catch(() => '')
        return new Response(detail || 'Graph-Stream fehlgeschlagen.', {
          status: graphResponse.status === 401 || graphResponse.status === 403 ? 403 : graphResponse.status
        })
      }

      const contentType = normalizeM365VideoMimeForPlayback(
        graphResponse.headers.get('Content-Type')
      )

      return new Response(graphResponse.body, {
        status: graphResponse.status,
        headers: forwardHeaders(graphResponse, contentType)
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return new Response(message, { status: 500 })
    }
  })
}
