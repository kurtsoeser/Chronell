import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node'
import { readSecure, writeSecure } from '../secure-store'

const CACHE_NAME = 'msal-token-cache'

/** In-process Snapshot — vermeidet parallele Disk-Reads bei vielen Graph-Aufrufen. */
let serializedCache: string | null = null
let loadedFromDisk = false

let cacheMutex: Promise<void> = Promise.resolve()

async function withCacheMutex<T>(fn: () => Promise<T>): Promise<T> {
  const prev = cacheMutex
  let release!: () => void
  cacheMutex = new Promise<void>((resolve) => {
    release = resolve
  })
  await prev
  try {
    return await fn()
  } finally {
    release()
  }
}

export const msalCachePlugin: ICachePlugin = {
  async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
    await withCacheMutex(async () => {
      if (!loadedFromDisk) {
        serializedCache = await readSecure(CACHE_NAME)
        loadedFromDisk = true
        if (serializedCache === null) {
          console.warn('[msal-cache] Kein gespeicherter Token-Cache auf der Platte (erste Anmeldung oder Entschluesselung fehlgeschlagen).')
        }
      }
      if (serializedCache !== null) {
        context.tokenCache.deserialize(serializedCache)
      }
    })
  },
  async afterCacheAccess(context: TokenCacheContext): Promise<void> {
    await withCacheMutex(async () => {
      if (context.cacheHasChanged) {
        serializedCache = context.tokenCache.serialize()
        await writeSecure(CACHE_NAME, serializedCache)
      }
    })
  }
}

/** Nach Konto-Entfernung: naechster Zugriff laedt den Cache erneut von der Platte. */
export function invalidateMsalCacheMemory(): void {
  loadedFromDisk = false
  serializedCache = null
}
