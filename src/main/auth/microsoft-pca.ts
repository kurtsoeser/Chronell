import { PublicClientApplication, type Configuration } from '@azure/msal-node'
import { msalCachePlugin } from './msal-cache'

let pcaCache: { clientId: string; pca: PublicClientApplication } | null = null

export function getPca(clientId: string): PublicClientApplication {
  if (pcaCache && pcaCache.clientId === clientId) {
    return pcaCache.pca
  }
  const config: Configuration = {
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/common'
    },
    cache: {
      cachePlugin: msalCachePlugin
    },
    system: {
      loggerOptions: {
        loggerCallback: (): void => {},
        piiLoggingEnabled: false
      }
    }
  }
  const pca = new PublicClientApplication(config)
  pcaCache = { clientId, pca }
  return pca
}
