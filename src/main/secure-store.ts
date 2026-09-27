import { app, safeStorage } from 'electron'
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

/**
 * Verschluesselter Persistenz-Speicher fuer sensible Daten (Token-Caches,
 * Refresh-Tokens, Account-Liste). Nutzt Electrons safeStorage, das unter
 * Windows DPAPI (dieselbe Mechanik wie der Windows Credential Manager)
 * verwendet.
 *
 * Demo-Packs und portable Archives legen oft `secure/<name>.json` ab.
 * Wenn Encryption verfuegbar ist, aber noch kein `.bin` existiert, wird
 * die Plaintext-Datei gelesen (und beim naechsten Schreibvorgang nach `.bin`
 * migriert).
 */

function storePath(name: string): string {
  return join(app.getPath('userData'), 'secure', `${name}.bin`)
}

function plainPath(name: string): string {
  return join(app.getPath('userData'), 'secure', `${name}.json`)
}

function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

async function readPlainFile(name: string): Promise<string | null> {
  const path = plainPath(name)
  if (!existsSync(path)) return null
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

export async function readSecure(name: string): Promise<string | null> {
  if (encryptionAvailable()) {
    const path = storePath(name)
    if (existsSync(path)) {
      try {
        const blob = await readFile(path)
        return safeStorage.decryptString(blob)
      } catch (e) {
        console.warn(
          `[secure-store] Entschluesselung fehlgeschlagen (${name}) — Token-Cache leer, erneute Anmeldung noetig:`,
          e instanceof Error ? e.message : e
        )
        return null
      }
    }
    // Fallback: Demo-Pack / Import mit plaintext secure/<name>.json
    const plain = await readPlainFile(name)
    if (plain != null) {
      try {
        await writeSecure(name, plain)
        await unlink(plainPath(name)).catch(() => undefined)
      } catch (e) {
        console.warn(
          `[secure-store] Migration plaintext→bin fehlgeschlagen (${name}):`,
          e instanceof Error ? e.message : e
        )
      }
    }
    return plain
  }

  return readPlainFile(name)
}

export async function writeSecure(name: string, value: string): Promise<void> {
  const useEncryption = encryptionAvailable()
  const path = useEncryption ? storePath(name) : plainPath(name)
  await mkdir(dirname(path), { recursive: true })

  if (useEncryption) {
    const encrypted = safeStorage.encryptString(value)
    await writeFile(path, encrypted)
  } else {
    console.warn(
      '[secure-store] safeStorage encryption NOT available. Writing plaintext (not for production).'
    )
    await writeFile(path, value, 'utf8')
  }
}

export async function readJsonSecure<T>(name: string, fallback: T): Promise<T> {
  const raw = await readSecure(name)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function writeJsonSecure<T>(name: string, value: T): Promise<void> {
  await writeSecure(name, JSON.stringify(value))
}

export async function deleteSecure(name: string): Promise<void> {
  for (const path of [storePath(name), plainPath(name)]) {
    if (existsSync(path)) {
      try {
        await unlink(path)
      } catch {
        /* ignore */
      }
    }
  }
}
