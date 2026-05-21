import {
  assertGoogleGmailFullScopeGrantedAfterLogin,
  mergeGoogleOAuthScopes,
  parseStoredScopeParts,
  storedGoogleScopeIncludesGmailFull
} from '../auth/google-scopes'
import {
  getGoogleCredentials,
  saveGoogleCredentialsForAccount,
  type StoredGoogleCredentials
} from './google-credentials-store'

/** Liest die tatsächlich am Access-Token hängenden Scopes (zuverlässiger als `tokens.scope` bei getToken). */
export async function fetchGoogleAccessTokenScopes(accessToken: string): Promise<string[]> {
  const token = accessToken.trim()
  if (!token) return []
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
    )
    if (!res.ok) return []
    const data = (await res.json()) as { scope?: string }
    return parseStoredScopeParts(data.scope)
  } catch {
    return []
  }
}

export async function resolveGoogleCredentialScopes(
  creds: Pick<StoredGoogleCredentials, 'scope' | 'access_token'>
): Promise<string | null> {
  const fromStore = creds.scope ?? null
  const access = creds.access_token?.trim()
  if (!access) return fromStore
  const live = await fetchGoogleAccessTokenScopes(access)
  if (live.length === 0) return fromStore
  return mergeGoogleOAuthScopes(fromStore, live.join(' '))
}

/** Aktualisiert gespeicherte Scopes aus tokeninfo, falls der Access-Token breiter ist. */
export async function enrichStoredGoogleScopesFromAccessToken(accountId: string): Promise<string | null> {
  const stored = await getGoogleCredentials(accountId)
  if (!stored?.access_token) return stored?.scope ?? null
  const merged = await resolveGoogleCredentialScopes(stored)
  if (!merged || merged === stored.scope) return stored.scope ?? null
  await saveGoogleCredentialsForAccount(accountId, { ...stored, scope: merged })
  return merged
}

export async function assertGoogleGmailFullScopeOnAccessToken(
  accountId: string,
  accessToken: string | null | undefined,
  fallbackScope: string | null | undefined
): Promise<void> {
  const token = accessToken?.trim()
  if (token) {
    const live = await fetchGoogleAccessTokenScopes(token)
    const merged = mergeGoogleOAuthScopes(fallbackScope, live.join(' '))
    if (storedGoogleScopeIncludesGmailFull(merged)) {
      const stored = await getGoogleCredentials(accountId)
      if (stored && merged !== stored.scope) {
        await saveGoogleCredentialsForAccount(accountId, { ...stored, scope: merged })
      }
      return
    }
  }
  if (storedGoogleScopeIncludesGmailFull(fallbackScope)) return

  assertGoogleGmailFullScopeGrantedAfterLogin(fallbackScope)
}
