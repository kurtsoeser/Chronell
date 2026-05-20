import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import {
  PROFILE_SYNC_OAUTH_PORT,
  PROFILE_SYNC_OAUTH_REDIRECT_URI,
  PROFILE_SYNC_OAUTH_TIMEOUT_MS
} from './profile-sync-oauth-constants'

export type ProfileSyncOAuthCallback =
  | { kind: 'code'; code: string }
  | { kind: 'tokens'; accessToken: string; refreshToken: string }

type ParseResult =
  | { ok: true; callback: ProfileSyncOAuthCallback }
  | { ok: false; reason: 'bridge' | 'ignore' }
  | { ok: false; reason: 'error'; message: string }

function parseCallbackFromUrl(url: string): ParseResult {
  const u = new URL(url)
  const error = u.searchParams.get('error')
  const errorDescription = u.searchParams.get('error_description')
  if (error) {
    return { ok: false, reason: 'error', message: errorDescription ?? error }
  }

  const code = u.searchParams.get('code')
  if (code) {
    return { ok: true, callback: { kind: 'code', code } }
  }

  const accessToken = u.searchParams.get('access_token')
  const refreshToken = u.searchParams.get('refresh_token')
  if (accessToken && refreshToken) {
    return { ok: true, callback: { kind: 'tokens', accessToken, refreshToken } }
  }

  const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash
  if (hash) {
    const params = new URLSearchParams(hash)
    const hashAccess = params.get('access_token')
    const hashRefresh = params.get('refresh_token')
    if (hashAccess && hashRefresh) {
      return {
        ok: true,
        callback: { kind: 'tokens', accessToken: hashAccess, refreshToken: hashRefresh }
      }
    }
    const hashCode = params.get('code')
    if (hashCode) {
      return { ok: true, callback: { kind: 'code', code: hashCode } }
    }
  }

  // Browser sendet #fragment nicht an den HTTP-Server → Hilfsseite im Browser nötig.
  if (u.pathname === '/' && u.search.length <= 1) {
    return { ok: false, reason: 'bridge' }
  }

  if (u.pathname === '/favicon.ico') {
    return { ok: false, reason: 'ignore' }
  }

  return {
    ok: false,
    reason: 'error',
    message: `Ungültige OAuth-Antwort (Pfad: ${u.pathname}, Query-Länge: ${u.search.length}).`
  }
}

function renderClosingPage(message: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Chronell</title>
<style>body{font-family:system-ui,Segoe UI,sans-serif;background:#0e0e12;color:#e6e6e8;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#16161c;border:1px solid #26262e;padding:32px 40px;border-radius:12px;max-width:480px;text-align:center}
h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#9a9aa3;margin:0}
</style></head><body><div class="card"><h1>Chronell Cloud</h1><p>${message}</p></div></body></html>`
}

/** Leitet URL-Fragment (#access_token=…) in Query-Parameter um — der Node-HTTP-Server sieht kein Hash. */
function renderHashBridgePage(): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Chronell</title>
<script>
(function () {
  var err = new URLSearchParams(location.hash.slice(1)).get('error')
  var errDesc = new URLSearchParams(location.hash.slice(1)).get('error_description')
  if (err) {
    location.replace('/?error=' + encodeURIComponent(err) + (errDesc ? '&error_description=' + encodeURIComponent(errDesc) : ''))
    return
  }
  if (location.hash && location.hash.length > 1) {
    location.replace('/?' + location.hash.slice(1))
    return
  }
  if (location.search && location.search.length > 1) {
    document.body.textContent = 'Anmeldung wird abgeschlossen…'
    return
  }
  document.body.textContent = 'Warte auf Anmeldung…'
})()
</script>
<body style="font-family:system-ui;background:#0e0e12;color:#9a9aa3;text-align:center;padding:2rem">Anmeldung wird abgeschlossen…</body></html>`
}

export interface ProfileSyncLoopbackHandle {
  redirectUri: string
  done: Promise<ProfileSyncOAuthCallback>
  cancel: () => void
}

export async function startProfileSyncOAuthLoopback(): Promise<ProfileSyncLoopbackHandle> {
  return new Promise((resolveOuter, rejectOuter) => {
    let settled = false
    let resolveResult!: (value: ProfileSyncOAuthCallback) => void
    let rejectResult!: (reason: Error) => void
    const done = new Promise<ProfileSyncOAuthCallback>((res, rej) => {
      resolveResult = res
      rejectResult = rej
    })

    const finishOk = (callback: ProfileSyncOAuthCallback): void => {
      if (settled) return
      settled = true
      resolveResult(callback)
      server.close()
    }

    const finishErr = (message: string): void => {
      if (settled) return
      settled = true
      rejectResult(new Error(message))
      server.close()
    }

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? '/', PROFILE_SYNC_OAUTH_REDIRECT_URI)
        const parsed = parseCallbackFromUrl(url.href)

        if (parsed.ok === false && parsed.reason === 'ignore') {
          res.writeHead(204)
          res.end()
          return
        }

        if (parsed.ok === false && parsed.reason === 'bridge') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(renderHashBridgePage())
          return
        }

        if (parsed.ok === false && parsed.reason === 'error') {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(renderClosingPage(parsed.message))
          finishErr(parsed.message)
          return
        }

        if (!parsed.ok) return
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderClosingPage('Anmeldung erfolgreich. Du kannst dieses Fenster schließen.'))
        finishOk(parsed.callback)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(renderClosingPage(message))
        }
        finishErr(message)
      }
    })

    server.once('error', (err: NodeJS.ErrnoException) => {
      rejectOuter(err)
    })

    server.listen(PROFILE_SYNC_OAUTH_PORT, '127.0.0.1', () => {
      resolveOuter({
        redirectUri: PROFILE_SYNC_OAUTH_REDIRECT_URI,
        done,
        cancel: (): void => {
          finishErr('cancelled')
        }
      })
    })
  })
}

export async function waitForProfileSyncOAuthCallback(
  loopback: ProfileSyncLoopbackHandle
): Promise<ProfileSyncOAuthCallback> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        loopback.cancel()
      } catch {
        /* already closed */
      }
      reject(
        new Error(
          'Zeitüberschreitung: Die Anmeldung im Browser wurde nicht abgeschlossen.'
        )
      )
    }, PROFILE_SYNC_OAUTH_TIMEOUT_MS)
  })

  try {
    return await Promise.race([loopback.done, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}
