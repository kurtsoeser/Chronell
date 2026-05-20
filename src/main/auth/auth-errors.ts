export function collectErrorMessages(e: unknown): string[] {
  const out: string[] = []
  const visit = (err: unknown): void => {
    if (err instanceof Error) {
      if (err.message) out.push(err.message)
      if ('cause' in err && err.cause) visit(err.cause)
    } else if (typeof err === 'string' && err.trim()) {
      out.push(err.trim())
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
