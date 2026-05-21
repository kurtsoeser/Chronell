import {
  GOOGLE_GMAIL_FULL_SCOPE_URL,
  storedGoogleScopeIncludesGmailFull
} from '../auth/google-scopes'

export function isGoogleInsufficientScopeError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as {
    code?: unknown
    status?: unknown
    errors?: Array<{ reason?: string; message?: string }>
    response?: { status?: number; headers?: Record<string, string | string[] | undefined> }
  }
  if (o.code === 403 || o.status === 403 || o.response?.status === 403) return true
  if (o.errors?.some((er) => er.reason === 'insufficientPermissions')) return true
  const auth = o.response?.headers?.['www-authenticate']
  const authStr = Array.isArray(auth) ? auth.join(' ') : auth
  if (typeof authStr === 'string' && /insufficient_scope/i.test(authStr)) return true
  return false
}

export function googleGmailFullScopeRequiredMessage(): string {
  return (
    'Für das endgültige Leeren des Gmail-Papierkorbs fehlt die Berechtigung «Gmail Vollzugriff». ' +
    'Bitte unter Einstellungen → Konten das Google-Konto entfernen und erneut verbinden ' +
    '(oder «Konto aktualisieren»), damit die neue Berechtigung erteilt wird.'
  )
}

export function assertStoredGoogleGmailFullScope(
  scope: string | null | undefined
): void {
  if (storedGoogleScopeIncludesGmailFull(scope)) return
  throw new Error(googleGmailFullScopeRequiredMessage())
}

export { GOOGLE_GMAIL_FULL_SCOPE_URL }
