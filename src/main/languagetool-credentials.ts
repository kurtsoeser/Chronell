import { deleteSecure, readSecure, writeSecure } from './secure-store'

const API_KEY_STORE = 'languagetool-api-key'

export async function readLanguageToolApiKey(): Promise<string | null> {
  const raw = await readSecure(API_KEY_STORE)
  const trimmed = raw?.trim()
  return trimmed || null
}

export async function writeLanguageToolApiKey(apiKey: string | null): Promise<void> {
  const trimmed = apiKey?.trim()
  if (!trimmed) {
    await deleteSecure(API_KEY_STORE)
    return
  }
  await writeSecure(API_KEY_STORE, trimmed)
}

export async function hasLanguageToolApiKey(): Promise<boolean> {
  return (await readLanguageToolApiKey()) != null
}
