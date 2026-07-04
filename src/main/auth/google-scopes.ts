/**
 * OAuth-Berechtigungen fuer Google (Gmail, Calendar, Tasks, Kontakte/People).
 *
 * Google Cloud Console (einmalig):
 * - Projekt anlegen, Gmail API + Google Calendar API + Google Tasks API aktivieren
 * - People API aktivieren (Kontakte / `people.connections.list`, Updates im Main-Prozess).
 *   Nach Hinzufuegen des Scopes `https://www.googleapis.com/auth/contacts` muessen Nutzer Google-Konten
 *   erneut verbinden (Re-Consent), damit der Refresh-Token die neue Berechtigung traegt.
 * - OAuth-Zustimmungsbildschirm (extern fuer Nutzer / intern fuer Tests)
 * - OAuth-Client Typ «Desktop» anlegen; Client-ID in der App (Build oder Einstellungen)
 * - Clientschluessel optional: PKCE mit ClientAuthentication.None (google-auth-library),
 *   sofern der Client als oeffentlicher Desktop-Client gefuehrt wird; sonst Secret fuer Token-Austausch
 * - Unter "Autorisierte Weiterleitungs-URIs" exakt diese URI eintragen
 *   (oder bei abweichendem Port dieselbe URI mit dem gewaehlten Port):
 *   @see GOOGLE_OAUTH_REDIRECT_URI
 *
 * Produktive Apps mit breitem Publikum: ggf. OAuth-Verifizierung fuer
 * sensible Scopes einplanen (Google-Pruefung, kann Wochen dauern).
 */

/** Fester Loopback-Port — muss in der Google Cloud Console als Redirect-URI eingetragen sein. */
export const GOOGLE_OAUTH_REDIRECT_URI = 'http://127.0.0.1:47836/oauth2callback'

/** People API (Sync, Anlegen, Bearbeiten). Erfordert Re-Consent, falls Konto ohne diesen Scope verbunden wurde. */
export const GOOGLE_CONTACTS_SCOPE_URL = 'https://www.googleapis.com/auth/contacts' as const

/**
 * Gmail Vollzugriff inkl. endgueltigem Loeschen (Papierkorb leeren, Shift+Delete).
 * `gmail.modify` allein reicht dafuer bei Google nicht (403 insufficient_scope).
 */
export const GOOGLE_GMAIL_FULL_SCOPE_URL = 'https://mail.google.com/' as const

/** Drive-Dateien, die die App fuer Kalender-Termin-Anhaenge anlegt. */
export const GOOGLE_DRIVE_FILE_SCOPE_URL = 'https://www.googleapis.com/auth/drive.file' as const

/** Google Drive durchsuchen (Dateien-Modul, schreibgeschuetzt). Erfordert Re-Consent nach Scope-Aenderung. */
export const GOOGLE_DRIVE_READONLY_SCOPE_URL =
  'https://www.googleapis.com/auth/drive.readonly' as const

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  GOOGLE_GMAIL_FULL_SCOPE_URL,
  'https://www.googleapis.com/auth/calendar',
  GOOGLE_DRIVE_FILE_SCOPE_URL,
  GOOGLE_DRIVE_READONLY_SCOPE_URL,
  'https://www.googleapis.com/auth/tasks',
  /** Kontakte lesen und bearbeiten (People API). Erfordert Re-Consent nach Scope-Aenderung. */
  GOOGLE_CONTACTS_SCOPE_URL
] as const

export function parseStoredScopeParts(scope: string | null | undefined): string[] {
  if (!scope || typeof scope !== 'string') return []
  return scope.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
}

/** Vereinigt gespeicherte und frisch erhaltene OAuth-Scopes (Refresh darf nie enger werden). */
export function mergeGoogleOAuthScopes(
  previous: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  const parts = new Set([...parseStoredScopeParts(previous), ...parseStoredScopeParts(incoming)])
  if (parts.size === 0) return null
  return [...parts].join(' ')
}

/** True, wenn die in `scope` gespeicherte OAuth-Antwort den Kontakte-Scope enthält (Leer = unbekannt). */
export function storedGoogleScopeIncludesContacts(scope: string | null | undefined): boolean {
  return parseStoredScopeParts(scope).includes(GOOGLE_CONTACTS_SCOPE_URL)
}

/** True, wenn Gmail-Vollzugriff (Papierkorb leeren / endgueltig loeschen) erteilt wurde. */
export function storedGoogleScopeIncludesDriveFile(scope: string | null | undefined): boolean {
  const parts = parseStoredScopeParts(scope)
  return (
    parts.includes(GOOGLE_DRIVE_FILE_SCOPE_URL) ||
    parts.includes('https://www.googleapis.com/auth/drive') ||
    parts.includes(GOOGLE_DRIVE_READONLY_SCOPE_URL)
  )
}

/** True, wenn Google Drive (Lesen) fuer Datei-Browser erteilt wurde. */
export function storedGoogleScopeIncludesDriveReadonly(scope: string | null | undefined): boolean {
  const parts = parseStoredScopeParts(scope)
  return (
    parts.includes(GOOGLE_DRIVE_READONLY_SCOPE_URL) ||
    parts.includes('https://www.googleapis.com/auth/drive')
  )
}

export function storedGoogleScopeIncludesGmailFull(scope: string | null | undefined): boolean {
  const parts = parseStoredScopeParts(scope)
  return (
    parts.includes(GOOGLE_GMAIL_FULL_SCOPE_URL) ||
    parts.includes('https://mail.google.com')
  )
}

export function assertGoogleGmailFullScopeGrantedAfterLogin(scope: string | null | undefined): void {
  if (storedGoogleScopeIncludesGmailFull(scope)) return
  throw new Error(
    'Google hat den Berechtigungsumfang «Gmail Vollzugriff» (https://mail.google.com/) nicht erteilt. ' +
      'Bitte die Verbindung erneut starten und auf dem Zustimmungsbildschirm alle Gmail-Berechtigungen aktivieren. ' +
      'Fehlt der Eintrag: In der Google Cloud Console unter OAuth-Zustimmungsbildschirm → Bereiche «https://mail.google.com/» ' +
      'hinzufügen; bei Test-Apps Ihr Konto unter Testnutzer eintragen.'
  )
}
