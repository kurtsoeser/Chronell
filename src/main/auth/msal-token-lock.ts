/** Serialisiert MSAL-Token-Operationen pro Client-ID (Refresh + Cache-Schreiben). */

const locks = new Map<string, Promise<void>>()

export async function withMicrosoftTokenLock<T>(
  clientId: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = locks.get(clientId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  locks.set(clientId, gate)
  await prev
  try {
    return await fn()
  } finally {
    release()
    if (locks.get(clientId) === gate) {
      locks.delete(clientId)
    }
  }
}
