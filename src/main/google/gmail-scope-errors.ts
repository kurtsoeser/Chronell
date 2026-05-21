import {
  GOOGLE_GMAIL_FULL_SCOPE_URL,
  storedGoogleScopeIncludesGmailFull
} from '../auth/google-scopes'

export function isGoogleInsufficientScopeError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as {
    message?: unknown
    code?: unknown
    status?: unknown
    errors?: Array<{ reason?: string; message?: string }>
    response?: {
      status?: number
      data?: { error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> } }
      headers?: Record<string, string | string[] | undefined>
    }
  }
  const nestedMsg = o.response?.data?.error?.message
  const msg =
    (typeof o.message === 'string' ? o.message : '') +
    (typeof nestedMsg === 'string' ? ` ${nestedMsg}` : '')
  if (/insufficient.*authentication.*scope|insufficient_scope/i.test(msg)) return true

  const nestedErrors = o.response?.data?.error?.errors ?? o.errors
  if (
    nestedErrors?.some(
      (er) =>
        er.reason === 'insufficientPermissions' &&
        /scope|permission/i.test(er.message ?? '')
    )
  ) {
    return true
  }

  const auth = o.response?.headers?.['www-authenticate']
  const authStr = Array.isArray(auth) ? auth.join(' ') : auth
  if (typeof authStr === 'string' && /insufficient_scope/i.test(authStr)) return true
  return false
}

export function googleGmailFullScopeRequiredMessage(): string {
  return (
    'Für das endgültige Löschen in Gmail (Papierkorb leeren, Shift+Entf) fehlt die Berechtigung «Gmail Vollzugriff» ' +
    '(https://mail.google.com/). ' +
    'Unter Einstellungen → Konten «Konto aktualisieren» und auf dem Google-Zustimmungsbildschirm alle Berechtigungen bestätigen — ' +
    'insbesondere den Zugriff auf Gmail mit Lesen, Schreiben und Löschen. ' +
    'Wenn der Punkt fehlt: In der Google Cloud Console unter OAuth-Zustimmungsbildschirm → Bereiche den Scope ' +
    '«https://mail.google.com/» hinzufügen (bei Test-Apps: Ihr Google-Konto als Testnutzer eintragen).'
  )
}

export function assertStoredGoogleGmailFullScope(
  scope: string | null | undefined
): void {
  if (storedGoogleScopeIncludesGmailFull(scope)) return
  throw new Error(googleGmailFullScopeRequiredMessage())
}

export { GOOGLE_GMAIL_FULL_SCOPE_URL }
