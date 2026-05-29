import { InteractionRequiredAuthError, type AuthenticationResult } from '@azure/msal-node'
import { getPca } from './microsoft-pca'
import { loginMicrosoftWithScopes } from './microsoft'
import { withMicrosoftTokenLock } from './msal-token-lock'

/** Delegated scope fuer Exchange Web Services (Office 365 Exchange Online API). */
export const MICROSOFT_EWS_SCOPE = 'https://outlook.office365.com/EWS.AccessAsUser.All' as const

export const EWS_ENDPOINT_URL = 'https://outlook.office365.com/Ews/Exchange.asmx'

function homeAccountIdFromAccountId(accountId: string): string {
  return accountId.replace(/^ms:/, '')
}

/** Access Token nur fuer EWS (eigene Ressource, getrennt vom Graph-Token). */
export async function acquireEwsAccessToken(
  clientId: string,
  accountId: string
): Promise<string> {
  const homeAccountId = homeAccountIdFromAccountId(accountId)
  try {
    const result = await acquireEwsAccessTokenSilent(clientId, homeAccountId)
    return result.accessToken
  } catch (e) {
    if (!(e instanceof InteractionRequiredAuthError)) {
      throw e
    }
    console.warn(
      '[auth] EWS-Scope benoetigt Zustimmung — Browserfenster fuer EWS-Berechtigung.',
      e.errorCode ?? ''
    )
    await loginMicrosoftWithScopes(clientId, [MICROSOFT_EWS_SCOPE], { prompt: 'consent' })
    const retry = await acquireEwsAccessTokenSilent(clientId, homeAccountId)
    return retry.accessToken
  }
}

async function acquireEwsAccessTokenSilent(
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
      scopes: [MICROSOFT_EWS_SCOPE]
    })
    if (!result) {
      throw new Error('EWS silent token acquisition gab kein Ergebnis zurueck.')
    }
    return result
  })
}

/** Nach Graph-Login EWS-Token im MSAL-Cache vorhalten (Fehler nicht fatal). */
export async function warmMicrosoftEwsTokenAfterLogin(
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
        scopes: [MICROSOFT_EWS_SCOPE]
      })
    })
  } catch (e) {
    console.warn(
      '[auth] EWS-Token nach Login nicht verfuegbar (ggf. Admin-Zustimmung oder erneuter Consent):',
      e instanceof Error ? e.message : e
    )
  }
}
