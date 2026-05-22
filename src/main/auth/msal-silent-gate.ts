/**
 * Blockiert stille Token-Aufrufe waehrend Browser-OAuth.
 * Verhindert, dass Hintergrund-Sync den MSAL-Cache waehrend der Anmeldung ueberschreibt.
 */

let silentGate: Promise<void> = Promise.resolve()

export async function awaitMicrosoftSilentGate(): Promise<void> {
  await silentGate
}

export async function runMicrosoftInteractiveLogin<T>(fn: () => Promise<T>): Promise<T> {
  let releaseHold!: () => void
  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve
  })
  const prev = silentGate
  silentGate = prev.then(() => hold)
  try {
    await prev
    return await fn()
  } finally {
    releaseHold()
  }
}
