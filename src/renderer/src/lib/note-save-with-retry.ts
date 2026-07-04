const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 400

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

/** IPC-Speichern mit begrenzten Wiederholungen (1 Versuch + 2 Retries). */
export async function withNoteSaveRetry<T>(
  operation: () => Promise<T>,
  options?: { maxAttempts?: number; retryDelayMs?: number }
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
      await delay(retryDelayMs * attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
