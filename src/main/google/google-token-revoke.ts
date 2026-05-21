import { loadConfig } from '../config'
import { createGoogleOAuth2Client } from '../auth/google'
import { getGoogleCredentials } from './google-credentials-store'

/** Widerruft gespeicherte Google-Tokens vor Re-Consent (damit neue Scopes angeboten werden). */
export async function revokeGoogleAccountTokens(accountId: string): Promise<void> {
  const config = await loadConfig()
  const clientId = config.googleClientId?.trim()
  if (!clientId) return

  const stored = await getGoogleCredentials(accountId)
  const token = stored?.refresh_token ?? stored?.access_token
  if (!token) return

  const clientSecret = config.googleClientSecret?.trim()
  const oauth2 = createGoogleOAuth2Client(clientId, clientSecret && clientSecret.length > 0 ? clientSecret : undefined)
  try {
    await oauth2.revokeToken(token)
  } catch (e) {
    console.warn('[google-token-revoke] Token-Widerruf fehlgeschlagen (wird ignoriert):', e)
  }
}
