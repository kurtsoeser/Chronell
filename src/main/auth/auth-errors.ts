export function collectErrorMessages(e: unknown): string[] {
  const out: string[] = []
  const visit = (err: unknown): void => {
    if (err instanceof Error) {
      if (err.message) out.push(err.message)
      if ('cause' in err && err.cause) visit(err.cause)
    } else if (typeof err === 'string' && err.trim()) {
      out.push(err.trim())
    }
    if (err && typeof err === 'object') {
      const o = err as {
        response?: { data?: { error?: string; error_description?: string } }
      }
      const data = o.response?.data
      if (typeof data?.error === 'string' && data.error.trim()) out.push(data.error.trim())
      if (typeof data?.error_description === 'string' && data.error_description.trim()) {
        out.push(data.error_description.trim())
      }
    }
  }
  visit(e)
  return out
}

/**
 * Token/MSAL nicht verfügbar (Cache leer, abgelaufen, erneute Anmeldung nötig).
 * Aktionen bleiben lokal gültig; Server-Sync folgt nach erneutem Verbinden.
 */
export function isMicrosoftAuthUnavailable(e: unknown): boolean {
  return collectErrorMessages(e).some(
    (m) =>
      m.includes('MSAL-Cache') ||
      m.includes('Microsoft-Anmeldung abgelaufen') ||
      m.includes('InteractionRequired') ||
      /silent token acquisition/i.test(m)
  )
}

/** Google OAuth Refresh-Token abgelaufen oder widerrufen (invalid_grant). */
export function isGoogleAuthUnavailable(e: unknown): boolean {
  return collectErrorMessages(e).some(
    (m) =>
      m === 'invalid_grant' ||
      /invalid_grant/i.test(m) ||
      /token has been expired or revoked/i.test(m) ||
      /google-konto ist nicht angemeldet/i.test(m)
  )
}

export function isProviderAuthUnavailable(e: unknown): boolean {
  return isMicrosoftAuthUnavailable(e) || isGoogleAuthUnavailable(e)
}

export function googleAuthUnavailableUserMessage(): string {
  return (
    'Google-Anmeldung abgelaufen oder widerrufen. ' +
    'Bitte das Konto in den Einstellungen entfernen und erneut verbinden.'
  )
}

export function microsoftAuthUnavailableUserMessage(): string {
  return 'Microsoft-Anmeldung abgelaufen. Bitte das Konto in den Einstellungen erneut verbinden.'
}

export function providerAuthUnavailableUserMessage(e: unknown): string {
  if (isGoogleAuthUnavailable(e)) return googleAuthUnavailableUserMessage()
  if (isMicrosoftAuthUnavailable(e)) return microsoftAuthUnavailableUserMessage()
  return e instanceof Error ? e.message : String(e)
}

const warnedAuthAccounts = new Set<string>()

/**
 * Einmal pro Konto und Prozesslauf: kurze Warnung statt voller Gaxios-Stacks.
 */
export function warnProviderAuthOnce(context: string, accountId: string, e: unknown): void {
  if (!isProviderAuthUnavailable(e)) {
    console.warn(`[${context}]`, accountId, e)
    return
  }
  if (warnedAuthAccounts.has(accountId)) return
  warnedAuthAccounts.add(accountId)
  const provider = isGoogleAuthUnavailable(e) ? 'Google' : 'Microsoft'
  console.warn(
    `[${context}] ${provider}-Konto ${accountId}: Anmeldung erforderlich —`,
    providerAuthUnavailableUserMessage(e)
  )
}
