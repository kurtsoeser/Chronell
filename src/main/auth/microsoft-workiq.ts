import { InteractionRequiredAuthError, type AuthenticationResult } from '@azure/msal-node'
import { getPca } from './microsoft-pca'
import { loginMicrosoftWithScopes } from './microsoft'
import { withMicrosoftTokenLock } from './msal-token-lock'

/**
 * Work IQ ist eine eigene Ressource (nicht Graph).
 * Scope darf NICHT in MICROSOFT_SCOPES gemischt werden (AADSTS70011).
 */
export const MICROSOFT_WORKIQ_SCOPE = 'api://workiq.svc.cloud.microsoft/WorkIQAgent.Ask' as const

function homeAccountIdFromAccountId(accountId: string): string {
  return accountId.replace(/^ms:/, '')
}

async function acquireWorkIqTokenSilent(
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
      scopes: [MICROSOFT_WORKIQ_SCOPE]
    })
    if (!result) {
      throw new Error('Work IQ silent token acquisition gab kein Ergebnis zurueck.')
    }
    return result
  })
}

/** Access Token nur fuer Work IQ REST (`workiq.svc.cloud.microsoft`). */
export async function acquireWorkIqAccessToken(
  clientId: string,
  accountId: string
): Promise<string> {
  const homeAccountId = homeAccountIdFromAccountId(accountId)
  try {
    const result = await acquireWorkIqTokenSilent(clientId, homeAccountId)
    return result.accessToken
  } catch (e) {
    if (!(e instanceof InteractionRequiredAuthError)) {
      throw e
    }
    console.warn(
      '[auth] Work IQ-Scope benoetigt Zustimmung — Browserfenster.',
      e.errorCode ?? ''
    )
    await loginMicrosoftWithScopes(clientId, [MICROSOFT_WORKIQ_SCOPE], { prompt: 'consent' })
    const retry = await acquireWorkIqTokenSilent(clientId, homeAccountId)
    return retry.accessToken
  }
}
