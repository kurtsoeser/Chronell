import { InteractionRequiredAuthError, type AuthenticationResult } from '@azure/msal-node'
import { getPca } from './microsoft-pca'
import { loginMicrosoftWithScopes } from './microsoft'
import { withMicrosoftTokenLock } from './msal-token-lock'

/**
 * Delegated Scope fuer Microsoft Forms (Ressource forms.office.com).
 * Exakter Scope-Name: Forms.Read (Plural) — Form.Read existiert nicht (AADSTS650053).
 * Darf NICHT in MICROSOFT_SCOPES (Graph) gemischt werden — analog EWS.
 */
export const MICROSOFT_FORMS_SCOPE = 'https://forms.office.com/Forms.Read' as const

function homeAccountIdFromAccountId(accountId: string): string {
  return accountId.replace(/^ms:/, '')
}

export async function acquireFormsAccessToken(
  clientId: string,
  accountId: string
): Promise<string> {
  const homeAccountId = homeAccountIdFromAccountId(accountId)
  try {
    const result = await acquireFormsAccessTokenSilent(clientId, homeAccountId)
    return result.accessToken
  } catch (e) {
    if (!(e instanceof InteractionRequiredAuthError)) {
      throw e
    }
    console.warn(
      '[auth] Forms-Scope benoetigt Zustimmung — Browserfenster fuer Forms-Berechtigung.',
      e.errorCode ?? ''
    )
    await loginMicrosoftWithScopes(clientId, [MICROSOFT_FORMS_SCOPE], { prompt: 'consent' })
    const retry = await acquireFormsAccessTokenSilent(clientId, homeAccountId)
    return retry.accessToken
  }
}

async function acquireFormsAccessTokenSilent(
  clientId: string,
  homeAccountId: string
): Promise<AuthenticationResult> {
  return withMicrosoftTokenLock(clientId, async () => {
    const pca = getPca(clientId)
    const cache = pca.getTokenCache()
    const account = await cache.getAccountByHomeId(homeAccountId)
    if (!account) {
      throw new Error('Konto nicht im MSAL-Cache gefunden.')
    }
    const result = await pca.acquireTokenSilent({
      account,
      scopes: [MICROSOFT_FORMS_SCOPE]
    })
    if (!result) {
      throw new Error('Forms silent token acquisition gab kein Ergebnis zurueck.')
    }
    return result
  })
}

/** Nach Graph-Login Forms-Token vorhalten (Fehler nicht fatal). */
export async function warmMicrosoftFormsTokenAfterLogin(
  clientId: string,
  graphLogin: AuthenticationResult
): Promise<void> {
  const account = graphLogin.account
  if (!account) return
  try {
    await withMicrosoftTokenLock(clientId, async () => {
      const pca = getPca(clientId)
      await pca.acquireTokenSilent({
        account,
        scopes: [MICROSOFT_FORMS_SCOPE]
      })
    })
  } catch (e) {
    console.warn(
      '[auth] Forms-Token nach Login nicht verfuegbar (ggf. API-Permission Forms.Read / Consent):',
      e instanceof Error ? e.message : e
    )
  }
}
