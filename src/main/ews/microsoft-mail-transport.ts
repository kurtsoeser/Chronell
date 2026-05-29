import type { MicrosoftMailTransport } from '@shared/types'
import { loadConfig } from '../config'
import { acquireEwsAccessToken } from '../auth/microsoft-ews'

export async function resolveMicrosoftMailTransportMode(): Promise<MicrosoftMailTransport> {
  const config = await loadConfig()
  return config.microsoftMailTransport ?? 'auto'
}

/** `auto`: EWS wenn Token verfuegbar, sonst Graph. */
export async function shouldUseEwsForMicrosoftMail(accountId: string): Promise<boolean> {
  const mode = await resolveMicrosoftMailTransportMode()
  if (mode === 'graph') return false
  if (mode === 'ews') return true

  const config = await loadConfig()
  if (!config.microsoftClientId) return false
  try {
    await acquireEwsAccessToken(config.microsoftClientId, accountId)
    return true
  } catch {
    return false
  }
}
