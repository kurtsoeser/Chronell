function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface GraphErrLike {
  statusCode?: number
  code?: string
  message?: string
  headers?: Headers | Record<string, string | number | string[] | undefined>
}

function headerValue(
  headers: Headers | Record<string, string | number | string[] | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined
  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined
  }
  const raw = headers[name] ?? headers[name.toLowerCase()]
  if (raw == null) return undefined
  return Array.isArray(raw) ? String(raw[0]) : String(raw)
}

/** True bei Graph-Drosselung (429), die mit Warten sinnvoll wiederholt werden kann. */
export function isGraphThrottleError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as GraphErrLike
  if (e.statusCode !== 429) return false
  const code = typeof e.code === 'string' ? e.code : ''
  if (
    code === 'ApplicationThrottled' ||
    code === 'TooManyRequests' ||
    code === 'activityLimitReached'
  ) {
    return true
  }
  const msg = typeof e.message === 'string' ? e.message : ''
  return /throttl|concurrency|too many requests/i.test(msg)
}

function retryAfterMsFromError(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  const raw = headerValue((err as GraphErrLike).headers, 'retry-after')
  if (raw == null) return null
  const n = parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n * 1000
}

/**
 * Wiederholt bei Graph-Drosselung (429) mit exponentiellem Backoff (optional Retry-After).
 */
export async function withGraphThrottleRetry<T>(
  opLabel: string,
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; initialDelayMs?: number; maxDelayMs?: number }
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 5)
  const initialDelayMs = options?.initialDelayMs ?? 2000
  const maxDelayMs = options?.maxDelayMs ?? 60_000
  let delayMs = initialDelayMs
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (!isGraphThrottleError(e) || attempt === maxAttempts) {
        throw e
      }
      const fromHeader = retryAfterMsFromError(e)
      const waitMs = Math.min(maxDelayMs, Math.max(delayMs, fromHeader ?? delayMs))
      console.warn(
        `[graph-api] ${opLabel}: Drosselung (429), Versuch ${attempt}/${maxAttempts} — warte ${waitMs}ms …`
      )
      await sleepMs(waitMs)
      delayMs = Math.min(maxDelayMs, delayMs * 2)
    }
  }
  throw new Error('withGraphThrottleRetry: unreachable')
}
